(function () {
  if (window.__agentWidgetMounted) return;
  window.__agentWidgetMounted = true;

  const ENDPOINT = "/api/agent/chat";

  let panelOpen = false;
  let busy = false;
  let messages = []; // {role:"user"|"assistant", text:string, actions?:[]}
  let bubble, panel, listEl, inputEl, sendBtn, clearBtn, statusEl;

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
        "Сайн уу? Би таны туслах. Жишээ нь:",
        el("br"),
        el("br"),
        "• \"DTX-н идэвхтэй аяллуудыг харуул\"",
        el("br"),
        "• \"Шинэ аялал нэмье\"",
        el("br"),
        "• \"Энэ группд жуулчин нэмье\"",
      ]);
      listEl.appendChild(hint);
    }
    messages.forEach((m) => {
      const cls = "agent-msg " + (m.role === "user" ? "is-user" : "is-assistant");
      const node = el("div", { class: cls });
      const body = el("div", { class: "agent-msg-body" }, [m.text || ""]);
      node.appendChild(body);
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
    if (!text || busy) return;
    inputEl.value = "";
    messages.push({ role: "user", text });
    render();
    setBusy(true);
    try {
      const r = await fetch(ENDPOINT, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        messages.push({
          role: "assistant",
          text: "⚠ " + (data.error || ("HTTP " + r.status)),
        });
      } else {
        messages.push({
          role: "assistant",
          text: data.reply || "(хариу алга)",
          actions: data.actions || [],
        });
      }
    } catch (err) {
      messages.push({ role: "assistant", text: "⚠ Сүлжээний алдаа" });
    } finally {
      setBusy(false);
      render();
      inputEl.focus();
    }
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
      title: "AI туслах",
      onclick: () => togglePanel(),
    }, ["AI"]);

    listEl = el("div", { class: "agent-list" });
    statusEl = el("div", { class: "agent-status" });
    inputEl = el("textarea", {
      class: "agent-input",
      rows: "2",
      placeholder: "Юу хийх вэ? (Жишээ: 'DTX-н идэвхтэй аяллуудыг харуул')",
      onkeydown: (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          send();
        }
      },
    });
    sendBtn = el("button", { class: "agent-send", type: "button", onclick: send }, ["Илгээх"]);
    clearBtn = el("button", { class: "agent-clear", type: "button", onclick: clearHistory, title: "Түүх цэвэрлэх" }, ["Цэвэрлэх"]);

    const header = el("div", { class: "agent-header" }, [
      el("div", { class: "agent-title" }, ["AI туслах ", el("span", { class: "agent-tag" }, ["admin"])]),
      el("div", { class: "agent-header-actions" }, [
        clearBtn,
        el("button", { class: "agent-close", type: "button", onclick: () => togglePanel(false) }, ["×"]),
      ]),
    ]);

    const inputRow = el("div", { class: "agent-input-row" }, [inputEl, sendBtn]);

    panel = el("div", { class: "agent-panel" }, [header, listEl, statusEl, inputRow]);

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
