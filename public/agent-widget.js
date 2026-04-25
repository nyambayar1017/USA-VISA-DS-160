(function () {
  if (window.__agentWidgetMounted) return;
  window.__agentWidgetMounted = true;

  const ENDPOINT = "/api/agent/chat";

  let panelOpen = false;
  let busy = false;
  let messages = []; // {role:"user"|"assistant", text:string, actions?:[], images?:[], documents?:[]}
  let pendingFiles = []; // {name, dataUrl, kind: "image"|"document", type}
  let bubble, panel, listEl, inputEl, sendBtn, clearBtn, statusEl, micBtn, ttsBtn, attachBtn, fileInput, pendingArea, maxBtn, dropOverlay;
  let dragDepth = 0;
  let recognition = null;
  let recognizing = false;
  let ttsEnabled = false;
  let maximized = false;
  const MAX_FILES = 5;
  const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
  const MAX_DOC_BYTES = 30 * 1024 * 1024;
  const IMAGE_TYPES = /^image\/(jpeg|png|gif|webp)$/i;
  const HEIC_TYPES = /^image\/(heic|heif)$/i;
  const DOC_EXTS = /\.(pdf|xlsx|txt|csv|md)$/i;
  try { ttsEnabled = localStorage.getItem("agent-tts") === "1"; } catch (e) {}
  try { maximized = localStorage.getItem("agent-maximized") === "1"; } catch (e) {}

  function el(tag, props, children) {
    const node = document.createElement(tag);
    if (props) {
      for (const k in props) {
        if (k === "class") node.className = props[k];
        else if (k === "style") node.style.cssText = props[k];
        else if (k.startsWith("on") && typeof props[k] === "function") {
          node.addEventListener(k.slice(2).toLowerCase(), props[k]);
        } else if (k === "html") node.innerHTML = props[k];
        else node.setAttribute(k, props[k]);
      }
    }
    (children || []).forEach((c) => {
      if (c == null) return;
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return node;
  }

  function render() {
    listEl.innerHTML = "";
    if (!messages.length) {
      const hint = el("div", { class: "agent-empty" }, [
        "Сайн уу? Би Батаа.",
      ]);
      listEl.appendChild(hint);
    }
    messages.forEach((m) => {
      const cls = "agent-msg " + (m.role === "user" ? "is-user" : "is-assistant");
      const node = el("div", { class: cls });
      if (Array.isArray(m.images) && m.images.length) {
        const imgWrap = el("div", { class: "agent-msg-images" });
        m.images.forEach((img) => {
          imgWrap.appendChild(el("img", { src: img.dataUrl, alt: img.name || "image" }));
        });
        node.appendChild(imgWrap);
      }
      if (Array.isArray(m.documents) && m.documents.length) {
        const docWrap = el("div", { class: "agent-msg-docs" });
        m.documents.forEach((d) => {
          docWrap.appendChild(el("div", { class: "agent-msg-doc" }, [
            el("span", { class: "agent-msg-doc-icon" }, [fileExtIcon(d.name || "")]),
            el("span", { class: "agent-msg-doc-name" }, [d.name || "document"]),
          ]));
        });
        node.appendChild(docWrap);
      }
      if (m.text) {
        const body = el("div", { class: "agent-msg-body" }, [m.text]);
        node.appendChild(body);
      }
      if (Array.isArray(m.actions) && m.actions.length) {
        const acts = el("div", { class: "agent-actions" });
        m.actions.forEach((a) => {
          const cls2 = "agent-action " + (a.ok ? "is-ok" : "is-err");
          acts.appendChild(el("div", { class: cls2 }, [`${a.tool}: ${a.summary || ""}`]));
        });
        node.appendChild(acts);
      }
      listEl.appendChild(node);
    });
    listEl.scrollTop = listEl.scrollHeight;
  }

  function setBusy(b, label) {
    busy = b;
    sendBtn.disabled = b;
    inputEl.disabled = b;
    statusEl.textContent = b ? (label || "Бодож байна…") : "";
  }

  async function loadHistory() {
    try {
      const r = await fetch(ENDPOINT + "?history=1", { credentials: "same-origin" });
      if (!r.ok) return;
      const data = await r.json();
      const out = [];
      (data.messages || []).forEach((m) => {
        if (m.role === "user") {
          const txt = (m.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
          if (txt) out.push({ role: "user", text: txt });
        } else if (m.role === "assistant") {
          const txt = (m.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
          if (txt) out.push({ role: "assistant", text: txt });
        }
      });
      messages = out;
      render();
    } catch (e) {}
  }

  async function send() {
    const text = (inputEl.value || "").trim();
    if ((!text && !pendingFiles.length) || busy) return;
    inputEl.value = "";
    const sentImages = pendingFiles.filter((f) => f.kind === "image");
    const sentDocs = pendingFiles.filter((f) => f.kind === "document");
    pendingFiles = [];
    renderPending();
    messages.push({ role: "user", text, images: sentImages, documents: sentDocs });
    render();
    setBusy(true);
    try {
      const r = await fetch(ENDPOINT, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          images: sentImages.map((f) => ({ dataUrl: f.dataUrl })),
          documents: sentDocs.map((f) => ({ name: f.name, dataUrl: f.dataUrl })),
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        messages.push({
          role: "assistant",
          text: "⚠ " + (data.error || ("HTTP " + r.status)),
        });
      } else {
        const reply = data.reply || "(хариу алга)";
        messages.push({
          role: "assistant",
          text: reply,
          actions: data.actions || [],
        });
        if (ttsEnabled) speak(reply);
      }
    } catch (err) {
      messages.push({ role: "assistant", text: "⚠ Сүлжээний алдаа" });
    } finally {
      setBusy(false);
      render();
      inputEl.focus();
    }
  }

  function speak(text) {
    try {
      if (!("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = "mn-MN";
      utter.rate = 1.0;
      utter.pitch = 1.0;
      window.speechSynthesis.speak(utter);
    } catch (e) {}
  }

  function ensureRecognition() {
    if (recognition) return recognition;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;
    recognition = new SR();
    recognition.lang = "mn-MN";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let finalText = "";
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += t;
        else interim += t;
      }
      if (finalText) {
        const cur = (inputEl.value || "").replace(/\s+$/, "");
        inputEl.value = (cur ? cur + " " : "") + finalText.trim();
      } else if (interim) {
        statusEl.textContent = "🎙 " + interim;
      }
    };
    recognition.onerror = (e) => {
      recognizing = false;
      micBtn.classList.remove("is-rec");
      statusEl.textContent = "🎙 Алдаа: " + (e.error || "unknown");
      setTimeout(() => { if (statusEl.textContent.startsWith("🎙")) statusEl.textContent = ""; }, 2400);
    };
    recognition.onend = () => {
      recognizing = false;
      micBtn.classList.remove("is-rec");
      if (statusEl.textContent.startsWith("🎙")) statusEl.textContent = "";
    };
    return recognition;
  }

  function toggleMic() {
    const rec = ensureRecognition();
    if (!rec) {
      alert("Энэ хөтөч дуу таних боломжгүй (Chrome эсвэл Safari ашиглана уу).");
      return;
    }
    if (recognizing) {
      try { rec.stop(); } catch (e) {}
      return;
    }
    try {
      rec.start();
      recognizing = true;
      micBtn.classList.add("is-rec");
      statusEl.textContent = "🎙 Сонсож байна…";
    } catch (e) {
      statusEl.textContent = "🎙 Эхлүүлж чадсангүй";
    }
  }

  function applyMaximizedClass() {
    if (!panel) return;
    panel.classList.toggle("is-maximized", maximized);
    if (maxBtn) {
      maxBtn.textContent = maximized ? "Жиж" : "Том";
      maxBtn.title = maximized ? "Жижигрүүлэх" : "Томруулах";
    }
  }

  function toggleMaximize() {
    maximized = !maximized;
    try { localStorage.setItem("agent-maximized", maximized ? "1" : "0"); } catch (e) {}
    applyMaximizedClass();
  }

  function toggleTts() {
    ttsEnabled = !ttsEnabled;
    try { localStorage.setItem("agent-tts", ttsEnabled ? "1" : "0"); } catch (e) {}
    ttsBtn.classList.toggle("is-on", ttsEnabled);
    ttsBtn.title = ttsEnabled ? "Дуугаар уншихыг унтраах" : "Хариуг дуугаар унших";
    if (!ttsEnabled && "speechSynthesis" in window) {
      try { window.speechSynthesis.cancel(); } catch (e) {}
    }
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  function downsizeImage(dataUrl, maxEdge, quality) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const w = img.naturalWidth, h = img.naturalHeight;
        // No need to resize if already small enough.
        if (w <= maxEdge && h <= maxEdge) {
          resolve(dataUrl);
          return;
        }
        const scale = Math.min(maxEdge / w, maxEdge / h);
        const cw = Math.round(w * scale);
        const ch = Math.round(h * scale);
        const canvas = document.createElement("canvas");
        canvas.width = cw;
        canvas.height = ch;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, cw, ch);
        ctx.drawImage(img, 0, 0, cw, ch);
        try {
          const out = canvas.toDataURL("image/jpeg", quality || 0.85);
          resolve(out);
        } catch (e) { resolve(dataUrl); }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }

  function classifyFile(f) {
    if (IMAGE_TYPES.test(f.type)) return "image";
    if (HEIC_TYPES.test(f.type) || /\.(heic|heif)$/i.test(f.name)) return "heic";
    if (f.type === "application/pdf" || /\.pdf$/i.test(f.name)) return "document";
    if (/\.xlsx$/i.test(f.name) || f.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") return "document";
    if (/\.(txt|csv|md)$/i.test(f.name) || (f.type || "").startsWith("text/")) return "document";
    if (/\.docx$/i.test(f.name) || f.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "docx";
    return "other";
  }

  function fileExtIcon(name) {
    const ext = (name.split(".").pop() || "").toLowerCase();
    if (ext === "pdf") return "PDF";
    if (ext === "xlsx" || ext === "xls" || ext === "csv") return "XLS";
    if (ext === "docx" || ext === "doc") return "DOC";
    if (ext === "txt" || ext === "md") return "TXT";
    return ext.slice(0, 3).toUpperCase() || "FILE";
  }

  async function handleFiles(files) {
    for (const f of files) {
      if (pendingFiles.length >= MAX_FILES) {
        alert(`Хамгийн ихдээ ${MAX_FILES} файл хавсаргана.`);
        break;
      }
      const kind = classifyFile(f);
      if (kind === "heic") {
        alert(`"${f.name}" — HEIC/HEIF зургийг шууд боловсруулах боломжгүй. JPG болгож хөрвүүлээд дахин оруулна уу.`);
        continue;
      }
      if (kind === "docx") {
        alert(`"${f.name}" — Word .docx форматыг шууд унших боломжгүй. PDF болгож хадгалаад оруулна уу.`);
        continue;
      }
      if (kind === "other") {
        alert(`"${f.name}" — энэ файлын форматыг дэмждэггүй.`);
        continue;
      }
      const cap = kind === "image" ? MAX_IMAGE_BYTES : MAX_DOC_BYTES;
      if (f.size > cap) {
        const limit = kind === "image" ? "5MB" : "30MB";
        alert(`"${f.name}" хэт том (${limit}-ээс илүү).`);
        continue;
      }
      try {
        let dataUrl = await fileToDataUrl(f);
        // Resize images down so the upload to Anthropic stays under
        // ~400 KB. iPhone passport scans are 3-5 MB which makes every
        // tool loop slow and risks Render proxy timeouts.
        if (kind === "image") {
          try {
            dataUrl = await downsizeImage(dataUrl, 1280, 0.85);
          } catch (e) {}
        }
        pendingFiles.push({ name: f.name, dataUrl, kind, type: f.type || "" });
      } catch (e) {}
    }
    renderPending();
  }

  function renderPending() {
    if (!pendingArea) return;
    pendingArea.innerHTML = "";
    if (!pendingFiles.length) {
      pendingArea.classList.remove("has-files");
      return;
    }
    pendingArea.classList.add("has-files");
    pendingFiles.forEach((f, idx) => {
      const removeBtn = el("button", {
        type: "button",
        class: "agent-pending-x",
        title: "Устгах",
        onclick: () => { pendingFiles.splice(idx, 1); renderPending(); },
      }, ["×"]);
      let chip;
      if (f.kind === "image") {
        chip = el("div", { class: "agent-pending-chip" }, [
          el("img", { src: f.dataUrl, alt: f.name }),
          removeBtn,
        ]);
      } else {
        chip = el("div", { class: "agent-pending-chip is-doc", title: f.name }, [
          el("div", { class: "agent-pending-icon" }, [fileExtIcon(f.name)]),
          el("div", { class: "agent-pending-name" }, [f.name]),
          removeBtn,
        ]);
      }
      pendingArea.appendChild(chip);
    });
  }

  async function clearHistory() {
    if (!confirm("Чатын түүхийг устгах уу?")) return;
    try {
      await fetch(ENDPOINT, { method: "DELETE", credentials: "same-origin" });
    } catch (e) {}
    messages = [];
    render();
  }

  function togglePanel(open) {
    panelOpen = typeof open === "boolean" ? open : !panelOpen;
    panel.classList.toggle("is-open", panelOpen);
    bubble.classList.toggle("is-open", panelOpen);
    if (panelOpen) {
      setTimeout(() => inputEl && inputEl.focus(), 50);
      if (!messages.length) loadHistory();
    }
  }

  function mount() {
    bubble = el("button", {
      class: "agent-bubble",
      type: "button",
      title: "Батаа",
      onclick: () => togglePanel(),
    }, ["Батаа"]);

    listEl = el("div", { class: "agent-list" });
    statusEl = el("div", { class: "agent-status" });
    inputEl = el("textarea", {
      class: "agent-input",
      rows: "2",
      placeholder: "",
      onkeydown: (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          send();
        }
      },
    });
    sendBtn = el("button", { class: "agent-send", type: "button", onclick: send }, ["Илгээх"]);
    clearBtn = el("button", { class: "agent-clear", type: "button", onclick: clearHistory, title: "Түүх цэвэрлэх" }, ["Цэвэрлэх"]);

    micBtn = el("button", {
      class: "agent-mic",
      type: "button",
      title: "Дуугаар оруулах",
      onclick: toggleMic,
    }, ["🎙"]);
    ttsBtn = el("button", {
      class: "agent-tts" + (ttsEnabled ? " is-on" : ""),
      type: "button",
      title: ttsEnabled ? "Дуугаар уншихыг унтраах" : "Хариуг дуугаар унших",
      onclick: toggleTts,
    }, ["🔊"]);

    fileInput = el("input", {
      type: "file",
      accept: "image/jpeg,image/png,image/gif,image/webp,application/pdf,.pdf,.xlsx,.txt,.csv,.md",
      multiple: "multiple",
      style: "display:none",
    });
    fileInput.addEventListener("change", () => {
      handleFiles(Array.from(fileInput.files || []));
      fileInput.value = "";
    });
    attachBtn = el("button", {
      class: "agent-attach",
      type: "button",
      title: "Файл хавсаргах (зураг, PDF, Excel)",
      onclick: () => fileInput.click(),
    }, ["📎"]);

    pendingArea = el("div", { class: "agent-pending-area" });

    maxBtn = el("button", {
      class: "agent-max",
      type: "button",
      onclick: toggleMaximize,
    }, [maximized ? "Жиж" : "Том"]);
    maxBtn.title = maximized ? "Жижигрүүлэх" : "Томруулах";

    const header = el("div", { class: "agent-header" }, [
      el("div", { class: "agent-title" }, ["Батаа ", el("span", { class: "agent-tag" }, ["admin"])]),
      el("div", { class: "agent-header-actions" }, [
        ttsBtn,
        clearBtn,
        maxBtn,
        el("button", { class: "agent-close", type: "button", onclick: () => togglePanel(false) }, ["×"]),
      ]),
    ]);

    const inputRow = el("div", { class: "agent-input-row" }, [attachBtn, micBtn, inputEl, sendBtn, fileInput]);

    panel = el("div", { class: "agent-panel" }, [header, listEl, statusEl, pendingArea, inputRow]);

    dropOverlay = el("div", { class: "agent-drop-overlay" }, [
      el("div", { class: "agent-drop-msg" }, ["📥 Файлыг энд тавь"]),
    ]);
    panel.appendChild(dropOverlay);

    panel.addEventListener("dragenter", (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragDepth += 1;
      panel.classList.add("is-dragging");
    });
    panel.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    });
    panel.addEventListener("dragleave", (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragDepth = Math.max(0, dragDepth - 1);
      if (dragDepth === 0) panel.classList.remove("is-dragging");
    });
    panel.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragDepth = 0;
      panel.classList.remove("is-dragging");
      const files = e.dataTransfer ? Array.from(e.dataTransfer.files || []) : [];
      if (files.length) handleFiles(files);
    });
    // Block default browser behaviour (open file in tab) when dropping
    // anywhere outside the panel as well — feels nicer.
    ["dragover", "drop"].forEach((evt) => {
      window.addEventListener(evt, (e) => {
        if (!panel.contains(e.target)) e.preventDefault();
      });
    });

    document.body.appendChild(bubble);
    document.body.appendChild(panel);
    applyMaximizedClass();
    render();
  }

  async function bootstrap() {
    let me = null;
    try {
      const r = await fetch("/api/auth/me", { credentials: "same-origin" });
      if (r.ok) me = await r.json();
    } catch (e) {}
    const role = (me && (me.user || me).role) || "";
    if (role !== "admin") return; // Admin-only.
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", mount);
    } else {
      mount();
    }
  }

  bootstrap();
})();
