// Backoffice-style toast + confirm + prompt. Replaces native alert.
// Exposes: window.UI.toast(msg, kind), UI.confirm(msg, opts), UI.prompt(msg, opts)
// Overrides: window.alert (fire-and-forget → toast)
(function () {
  if (window.UI && window.UI._installed) return;

  function ensureContainer() {
    let el = document.getElementById("ui-toast-stack");
    if (el) return el;
    el = document.createElement("div");
    el.id = "ui-toast-stack";
    el.className = "ui-toast-stack";
    document.body.appendChild(el);
    return el;
  }

  function escapeText(s) { return String(s == null ? "" : s); }

  function toast(message, kind) {
    const stack = ensureContainer();
    const node = document.createElement("div");
    const k = (kind || "info").toLowerCase();
    node.className = "ui-toast ui-toast--" + k;
    const icon = document.createElement("span");
    icon.className = "ui-toast__icon";
    icon.textContent = k === "success" ? "✓" : k === "error" || k === "danger" ? "!" : k === "warning" || k === "warn" ? "!" : "i";
    const body = document.createElement("span");
    body.className = "ui-toast__body";
    body.textContent = escapeText(message);
    const close = document.createElement("button");
    close.type = "button";
    close.className = "ui-toast__close";
    close.setAttribute("aria-label", "Close");
    close.textContent = "×";
    close.addEventListener("click", () => dismiss());
    node.appendChild(icon);
    node.appendChild(body);
    node.appendChild(close);
    stack.appendChild(node);
    requestAnimationFrame(() => node.classList.add("is-shown"));
    let timer = setTimeout(dismiss, k === "error" || k === "danger" ? 6000 : 4000);
    function dismiss() {
      if (!node.parentNode) return;
      clearTimeout(timer);
      node.classList.remove("is-shown");
      node.classList.add("is-leaving");
      setTimeout(() => { if (node.parentNode) node.parentNode.removeChild(node); }, 220);
    }
    return { dismiss };
  }

  function buildBackdrop() {
    const back = document.createElement("div");
    back.className = "ui-modal-back";
    return back;
  }

  function showDialog({ title, message, kind, defaultValue, isPrompt, confirmLabel, cancelLabel, dangerous }) {
    return new Promise((resolve) => {
      const back = buildBackdrop();
      const card = document.createElement("div");
      card.className = "ui-modal-card";
      if (kind) card.classList.add("ui-modal-card--" + kind);
      const head = document.createElement("div");
      head.className = "ui-modal-head";
      head.textContent = title || (isPrompt ? "Enter a value" : "Please confirm");
      const body = document.createElement("div");
      body.className = "ui-modal-body";
      const msg = document.createElement("p");
      msg.className = "ui-modal-msg";
      msg.textContent = escapeText(message);
      body.appendChild(msg);
      let input = null;
      if (isPrompt) {
        input = document.createElement("input");
        input.type = "text";
        input.className = "ui-modal-input";
        input.value = defaultValue == null ? "" : String(defaultValue);
        body.appendChild(input);
      }
      const foot = document.createElement("div");
      foot.className = "ui-modal-foot";
      const cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = "ui-modal-btn ui-modal-btn--ghost";
      cancelBtn.textContent = cancelLabel || "Cancel";
      const okBtn = document.createElement("button");
      okBtn.type = "button";
      okBtn.className = "ui-modal-btn " + (dangerous ? "ui-modal-btn--danger" : "ui-modal-btn--primary");
      okBtn.textContent = confirmLabel || "OK";
      foot.appendChild(cancelBtn);
      foot.appendChild(okBtn);
      card.appendChild(head);
      card.appendChild(body);
      card.appendChild(foot);
      back.appendChild(card);
      document.body.appendChild(back);
      requestAnimationFrame(() => back.classList.add("is-shown"));

      function close(value) {
        back.classList.remove("is-shown");
        back.classList.add("is-leaving");
        setTimeout(() => { if (back.parentNode) back.parentNode.removeChild(back); document.removeEventListener("keydown", onKey); }, 180);
        resolve(value);
      }
      function onKey(e) {
        if (e.key === "Escape") { e.preventDefault(); close(isPrompt ? null : false); }
        else if (e.key === "Enter") { e.preventDefault(); close(isPrompt ? input.value : true); }
      }
      cancelBtn.addEventListener("click", () => close(isPrompt ? null : false));
      okBtn.addEventListener("click", () => close(isPrompt ? input.value : true));
      back.addEventListener("click", (e) => { if (e.target === back) close(isPrompt ? null : false); });
      document.addEventListener("keydown", onKey);
      setTimeout(() => { (input || okBtn).focus(); if (input) input.select(); }, 60);
    });
  }

  function confirmDialog(message, opts) {
    const o = opts || {};
    return showDialog({
      title: o.title || "Please confirm",
      message: message,
      kind: o.dangerous ? "danger" : null,
      isPrompt: false,
      confirmLabel: o.confirmLabel || (o.dangerous ? "Delete" : "Confirm"),
      cancelLabel: o.cancelLabel || "Cancel",
      dangerous: !!o.dangerous,
    });
  }

  function promptDialog(message, opts) {
    const o = opts || {};
    return showDialog({
      title: o.title || "Enter a value",
      message: message,
      isPrompt: true,
      defaultValue: o.defaultValue || "",
      confirmLabel: o.confirmLabel || "Save",
      cancelLabel: o.cancelLabel || "Cancel",
    });
  }

  // ── Override native alert ──────────────────────────────────────
  // Native alert is sync but returns nothing — safe to override with
  // a fire-and-forget toast. confirm/prompt are sync-blocking, so we
  // do NOT override them; call sites should use UI.confirm/UI.prompt.
  const _nativeAlert = window.alert;
  window.alert = function (msg) {
    try {
      const text = String(msg == null ? "" : msg);
      const lower = text.toLowerCase();
      const kind = lower.includes("could not") || lower.includes("failed") || lower.includes("error") ? "error"
                 : lower.includes("saved") || lower.includes("success") || lower.includes("done") ? "success"
                 : "info";
      toast(text, kind);
    } catch (_) {
      try { _nativeAlert.call(window, msg); } catch (__) {}
    }
  };

  window.UI = {
    _installed: true,
    toast: toast,
    confirm: confirmDialog,
    prompt: promptDialog,
  };
})();
