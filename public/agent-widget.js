(function () {
  if (window.__agentWidgetMounted) return;
  window.__agentWidgetMounted = true;

  const ENDPOINT = "/api/agent/chat";

  let panelOpen = false;
  let busy = false;
  let messages = []; // {role:"user"|"assistant", text:string, actions?:[], images?:[]}
  let pendingImages = []; // {name, dataUrl}
  let bubble, panel, listEl, inputEl, sendBtn, clearBtn, statusEl, micBtn, ttsBtn, attachBtn, fileInput, pendingArea;
  let recognition = null;
  let recognizing = false;
  let ttsEnabled = false;
  const MAX_IMAGES = 5;
  const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
  try { ttsEnabled = localStorage.getItem("agent-tts") === "1"; } catch (e) {}

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
    if ((!text && !pendingImages.length) || busy) return;
    inputEl.value = "";
    const sentImages = pendingImages.slice();
    pendingImages = [];
    renderPending();
    messages.push({ role: "user", text, images: sentImages });
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

  async function handleFiles(files) {
    for (const f of files) {
      if (pendingImages.length >= MAX_IMAGES) {
        alert(`Хамгийн ихдээ ${MAX_IMAGES} зураг хавсаргана.`);
        break;
      }
      if (!/^image\/(jpeg|png|gif|webp)$/i.test(f.type)) {
        alert("Зөвхөн JPG, PNG, GIF, WebP зураг хавсаргана.");
        continue;
      }
      if (f.size > MAX_IMAGE_BYTES) {
        alert(`"${f.name}" хэт том (5MB-ээс илүү).`);
        continue;
      }
      try {
        const dataUrl = await fileToDataUrl(f);
        pendingImages.push({ name: f.name, dataUrl });
      } catch (e) {}
    }
    renderPending();
  }

  function renderPending() {
    if (!pendingArea) return;
    pendingArea.innerHTML = "";
    if (!pendingImages.length) {
      pendingArea.classList.remove("has-files");
      return;
    }
    pendingArea.classList.add("has-files");
    pendingImages.forEach((f, idx) => {
      const chip = el("div", { class: "agent-pending-chip" }, [
        el("img", { src: f.dataUrl, alt: f.name }),
        el("button", {
          type: "button",
          class: "agent-pending-x",
          title: "Устгах",
          onclick: () => { pendingImages.splice(idx, 1); renderPending(); },
        }, ["×"]),
      ]);
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
      accept: "image/jpeg,image/png,image/gif,image/webp",
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
      title: "Зураг хавсаргах",
      onclick: () => fileInput.click(),
    }, ["📎"]);

    pendingArea = el("div", { class: "agent-pending-area" });

    const header = el("div", { class: "agent-header" }, [
      el("div", { class: "agent-title" }, ["Батаа ", el("span", { class: "agent-tag" }, ["admin"])]),
      el("div", { class: "agent-header-actions" }, [
        ttsBtn,
        clearBtn,
        el("button", { class: "agent-close", type: "button", onclick: () => togglePanel(false) }, ["×"]),
      ]),
    ]);

    const inputRow = el("div", { class: "agent-input-row" }, [attachBtn, micBtn, inputEl, sendBtn, fileInput]);

    panel = el("div", { class: "agent-panel" }, [header, listEl, statusEl, pendingArea, inputRow]);

    document.body.appendChild(bubble);
    document.body.appendChild(panel);
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
