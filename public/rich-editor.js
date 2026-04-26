// Reusable rich text editor backed by contenteditable + execCommand.
// Window-scoped: window.RichEditor.create(container, options) → controller.
(function () {
  const FONT_FAMILIES = [
    { label: "Sans Serif", value: "Arial, Helvetica, sans-serif" },
    { label: "Serif", value: "Georgia, 'Times New Roman', serif" },
    { label: "Monospace", value: "'Courier New', monospace" },
    { label: "System", value: "system-ui, sans-serif" },
  ];

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  }

  function exec(cmd, value) {
    try { document.execCommand(cmd, false, value == null ? null : value); } catch {}
  }

  function buildToolbar(opts) {
    const fontOpts = FONT_FAMILIES
      .map((f) => `<option value="${escapeHtml(f.value)}">${escapeHtml(f.label)}</option>`)
      .join("");
    return `
      <div class="rich-toolbar" data-toolbar>
        <button type="button" data-cmd="undo" title="Undo (Ctrl+Z)">↶</button>
        <button type="button" data-cmd="redo" title="Redo (Ctrl+Y)">↷</button>
        <span class="rich-sep"></span>
        <button type="button" data-cmd="bold" title="Bold (Ctrl+B)"><b>B</b></button>
        <button type="button" data-cmd="italic" title="Italic (Ctrl+I)"><i>I</i></button>
        <button type="button" data-cmd="underline" title="Underline (Ctrl+U)"><u>U</u></button>
        <button type="button" data-cmd="strikeThrough" title="Strikethrough"><s>S</s></button>
        <span class="rich-sep"></span>
        <select data-cmd="fontName" title="Font family" class="rich-font-select">${fontOpts}</select>
        <select data-cmd="fontSize" title="Font size" class="rich-size-select">
          <option value="2">Small</option>
          <option value="3" selected>Normal</option>
          <option value="4">Large</option>
          <option value="5">Larger</option>
          <option value="6">Huge</option>
        </select>
        <label class="rich-color" title="Text color">
          <input type="color" data-cmd="foreColor" value="#0f172a"/>
          <span>🎨</span>
        </label>
        <span class="rich-sep"></span>
        <button type="button" data-cmd="insertUnorderedList" title="Bullet list">• ⋮</button>
        <button type="button" data-cmd="insertOrderedList" title="Numbered list">1. ⋮</button>
        <span class="rich-sep"></span>
        <button type="button" data-cmd="justifyLeft" title="Align left">⇤</button>
        <button type="button" data-cmd="justifyCenter" title="Align center">↔</button>
        <button type="button" data-cmd="justifyRight" title="Align right">⇥</button>
        <button type="button" data-cmd="justifyFull" title="Justify">≡</button>
        <span class="rich-sep"></span>
        <button type="button" data-cmd="createLink" title="Insert link">🔗</button>
        <button type="button" data-cmd="image-upload" title="Insert image">🖼</button>
        <span class="rich-sep"></span>
        <button type="button" data-cmd="removeFormat" title="Clear formatting">⌫</button>
        <input type="file" accept="image/*" data-img-input hidden/>
      </div>
    `;
  }

  function create(container, options = {}) {
    const initialHtml = options.initialHtml || "";
    const minHeight = options.minHeight || 220;
    const maxHeight = options.maxHeight || "60vh";
    const placeholder = options.placeholder || "";

    const wrap = document.createElement("div");
    wrap.className = "rich-editor";
    wrap.innerHTML = `
      ${buildToolbar(options)}
      <div class="rich-content"
           contenteditable="true"
           data-content
           data-placeholder="${escapeHtml(placeholder)}"
           style="min-height:${minHeight}px;max-height:${maxHeight};"
      ></div>
    `;
    const content = wrap.querySelector("[data-content]");
    const toolbar = wrap.querySelector("[data-toolbar]");
    const fileInput = wrap.querySelector("[data-img-input]");
    content.innerHTML = initialHtml || "";

    // Don't let the toolbar steal focus on click — keeps the selection
    // alive in the editor when applying commands.
    toolbar.addEventListener("mousedown", (e) => {
      const ctrl = e.target.closest("[data-cmd]");
      if (ctrl && ctrl.tagName !== "INPUT" && ctrl.tagName !== "SELECT") {
        e.preventDefault();
      }
    });

    toolbar.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-cmd]");
      if (!btn) return;
      if (btn.tagName === "INPUT" || btn.tagName === "SELECT") return;
      e.preventDefault();
      const cmd = btn.dataset.cmd;
      content.focus();
      if (cmd === "createLink") {
        const url = await (window.UI?.prompt
          ? UI.prompt("Link URL", { defaultValue: "https://", confirmLabel: "Insert" })
          : Promise.resolve(window.prompt("Link URL", "https://")));
        if (url) exec("createLink", url);
      } else if (cmd === "image-upload") {
        fileInput.click();
      } else {
        exec(cmd);
      }
    });

    toolbar.addEventListener("change", (e) => {
      const ctrl = e.target.closest("[data-cmd]");
      if (!ctrl) return;
      content.focus();
      exec(ctrl.dataset.cmd, ctrl.value);
    });

    fileInput.addEventListener("change", async () => {
      const f = fileInput.files[0];
      if (!f) return;
      const fd = new FormData();
      fd.append("image", f);
      try {
        const r = await fetch("/api/mail/signature-image", { method: "POST", body: fd });
        const data = await r.json();
        if (r.ok && data.url) {
          content.focus();
          exec("insertImage", data.url);
        } else {
          window.UI?.toast?.(data.error || "Upload failed", "error");
        }
      } catch {
        window.UI?.toast?.("Upload failed", "error");
      }
      fileInput.value = "";
    });

    container.innerHTML = "";
    container.appendChild(wrap);

    return {
      getHtml: () => content.innerHTML,
      setHtml: (html) => { content.innerHTML = html || ""; },
      focus: () => content.focus(),
      element: wrap,
      contentElement: content,
    };
  }

  window.RichEditor = { create };
})();
