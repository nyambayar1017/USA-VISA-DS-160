// Reusable rich text editor backed by contenteditable + execCommand.
// Window-scoped: window.RichEditor.create(container, options) → controller.
(function () {
  const FONT_FAMILIES = [
    { label: "Sans Serif", value: "Arial, Helvetica, sans-serif" },
    { label: "Serif", value: "Georgia, 'Times New Roman', serif" },
    { label: "Monospace", value: "'Courier New', monospace" },
    { label: "System", value: "system-ui, sans-serif" },
  ];

  // Three-row swatch palette: grays, vivid, muted pastels.
  const COLOR_ROWS = [
    ["#000000", "#3f3f3f", "#5b5b5b", "#737373", "#9ca3af", "#cbd5e1", "#e5e7eb", "#f1f5f9", "#ffffff"],
    ["#7f1d1d", "#dc2626", "#ea580c", "#facc15", "#65a30d", "#16a34a", "#0891b2", "#1d4ed8", "#7c3aed"],
    ["#fecaca", "#fed7aa", "#fef3c7", "#d9f99d", "#bbf7d0", "#bfdbfe", "#cffafe", "#ddd6fe", "#e9d5ff"],
  ];

  const SVG = {
    undo: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 5 5v0a5 5 0 0 1-5 5H8"/></svg>',
    redo: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14l5-5-5-5"/><path d="M20 9H9a5 5 0 0 0-5 5v0a5 5 0 0 0 5 5h7"/></svg>',
    bold: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M7 5h6.5a3.5 3.5 0 0 1 0 7H7zM7 12h7.5a3.5 3.5 0 0 1 0 7H7z"/></svg>',
    italic: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>',
    underline: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4v7a6 6 0 0 0 12 0V4"/><line x1="4" y1="20" x2="20" y2="20"/></svg>',
    strike: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="12" x2="20" y2="12"/><path d="M16 6a5 5 0 0 0-5-2 4 4 0 0 0-4 4c0 1.5 1 2.5 2.5 3"/><path d="M8 18a5 5 0 0 0 5 2 4 4 0 0 0 4-4c0-1.5-1-2.5-2.5-3"/></svg>',
    bullet: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="6" r="1.2" fill="currentColor"/><circle cx="5" cy="12" r="1.2" fill="currentColor"/><circle cx="5" cy="18" r="1.2" fill="currentColor"/><line x1="10" y1="6" x2="20" y2="6"/><line x1="10" y1="12" x2="20" y2="12"/><line x1="10" y1="18" x2="20" y2="18"/></svg>',
    numbered: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><text x="3" y="8" font-size="6" fill="currentColor" stroke="none">1</text><text x="3" y="14" font-size="6" fill="currentColor" stroke="none">2</text><text x="3" y="20" font-size="6" fill="currentColor" stroke="none">3</text><line x1="10" y1="6" x2="20" y2="6"/><line x1="10" y1="12" x2="20" y2="12"/><line x1="10" y1="18" x2="20" y2="18"/></svg>',
    alignLeft: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="14" y2="12"/><line x1="4" y1="18" x2="18" y2="18"/></svg>',
    alignCenter: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="7" y1="12" x2="17" y2="12"/><line x1="5" y1="18" x2="19" y2="18"/></svg>',
    alignRight: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="10" y1="12" x2="20" y2="12"/><line x1="6" y1="18" x2="20" y2="18"/></svg>',
    justify: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>',
    link: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1"/><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"/></svg>',
    image: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="1.5" fill="currentColor"/><path d="M21 15l-5-5L5 21"/></svg>',
    table: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="1"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>',
    chevronDown: '<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>',
    clear: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M16 6l-2 12"/><path d="M10 6l-2 12"/></svg>',
  };

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  }

  function exec(cmd, value) {
    try { document.execCommand(cmd, false, value == null ? null : value); } catch {}
  }

  // Save / restore selection so the popovers don't lose the editor's caret
  function saveSel() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    return sel.getRangeAt(0).cloneRange();
  }
  function restoreSel(range) {
    if (!range) return;
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function buildToolbar() {
    const fontOpts = FONT_FAMILIES
      .map((f) => `<option value="${escapeHtml(f.value)}">${escapeHtml(f.label)}</option>`)
      .join("");
    return `
      <div class="rich-toolbar" data-toolbar>
        <button type="button" data-cmd="undo" title="Undo (Ctrl+Z)">${SVG.undo}</button>
        <button type="button" data-cmd="redo" title="Redo (Ctrl+Y)">${SVG.redo}</button>
        <span class="rich-sep"></span>
        <button type="button" data-cmd="bold" title="Bold (Ctrl+B)">${SVG.bold}</button>
        <button type="button" data-cmd="italic" title="Italic (Ctrl+I)">${SVG.italic}</button>
        <button type="button" data-cmd="underline" title="Underline (Ctrl+U)">${SVG.underline}</button>
        <button type="button" data-cmd="strikeThrough" title="Strikethrough">${SVG.strike}</button>
        <span class="rich-sep"></span>
        <select data-cmd="fontName" title="Font family" class="rich-font-select">${fontOpts}</select>
        <select data-cmd="fontSize" title="Font size" class="rich-size-select">
          <option value="2">Small</option>
          <option value="3" selected>Normal</option>
          <option value="4">Large</option>
          <option value="5">Larger</option>
          <option value="6">Huge</option>
        </select>
        <span class="rich-sep"></span>
        <button type="button" data-popover="textcolor" title="Text color" class="rich-color-btn">
          <span class="rich-color-letter">A</span>
          <span class="rich-color-bar" data-color-bar="text" style="background:#000000"></span>
          ${SVG.chevronDown}
        </button>
        <button type="button" data-popover="hilitecolor" title="Highlight color" class="rich-color-btn">
          <span class="rich-color-marker">▍</span>
          <span class="rich-color-bar" data-color-bar="hilite" style="background:#fef08a"></span>
          ${SVG.chevronDown}
        </button>
        <span class="rich-sep"></span>
        <button type="button" data-cmd="insertUnorderedList" title="Bullet list">${SVG.bullet}</button>
        <button type="button" data-cmd="insertOrderedList" title="Numbered list">${SVG.numbered}</button>
        <span class="rich-sep"></span>
        <button type="button" data-cmd="justifyLeft" title="Align left">${SVG.alignLeft}</button>
        <button type="button" data-cmd="justifyCenter" title="Align center">${SVG.alignCenter}</button>
        <button type="button" data-cmd="justifyRight" title="Align right">${SVG.alignRight}</button>
        <button type="button" data-cmd="justifyFull" title="Justify">${SVG.justify}</button>
        <span class="rich-sep"></span>
        <button type="button" data-cmd="createLink" title="Insert link">${SVG.link}</button>
        <button type="button" data-cmd="image-upload" title="Insert image">${SVG.image}</button>
        <button type="button" data-popover="table" title="Insert table">${SVG.table}${SVG.chevronDown}</button>
        <span class="rich-sep"></span>
        <button type="button" data-cmd="removeFormat" title="Clear formatting">${SVG.clear}</button>
        <input type="file" accept="image/*" data-img-input hidden/>
      </div>
    `;
  }

  function buildColorSwatches(label, type) {
    const rows = COLOR_ROWS
      .map((row) =>
        `<div class="rich-color-row">${row
          .map((c) => `<button type="button" class="rich-color-swatch" data-pick-color="${c}" data-pick-type="${type}" style="background:${c}" title="${c}"></button>`)
          .join("")}</div>`
      )
      .join("");
    return `
      <div class="rich-color-pop">
        <div class="rich-color-pop-head">
          <strong>${escapeHtml(label)}</strong>
          <button type="button" class="rich-color-clear" data-clear-color="${type}">Clear</button>
        </div>
        ${rows}
      </div>
    `;
  }

  function buildTablePicker(maxRows = 6, maxCols = 8) {
    let cells = "";
    for (let r = 1; r <= maxRows; r++) {
      for (let c = 1; c <= maxCols; c++) {
        cells += `<button type="button" class="rich-table-cell" data-r="${r}" data-c="${c}"></button>`;
      }
    }
    return `
      <div class="rich-table-pop">
        <div class="rich-table-grid" style="grid-template-columns:repeat(${maxCols},14px);grid-template-rows:repeat(${maxRows},14px);" data-rows="${maxRows}" data-cols="${maxCols}">${cells}</div>
        <div class="rich-table-label" data-table-label>Insert table</div>
      </div>
    `;
  }

  function makeTableHtml(rows, cols) {
    const rowHtml = (r) => {
      let tds = "";
      for (let i = 0; i < cols; i++) tds += `<td style="border:1px solid #cbd5e1;padding:6px;min-width:60px;">&nbsp;</td>`;
      return `<tr>${tds}</tr>`;
    };
    let body = "";
    for (let i = 0; i < rows; i++) body += rowHtml(i);
    return `<table style="border-collapse:collapse;border:1px solid #cbd5e1;margin:6px 0;"><tbody>${body}</tbody></table><p><br></p>`;
  }

  function create(container, options = {}) {
    const initialHtml = options.initialHtml || "";
    const minHeight = options.minHeight || 220;
    const maxHeight = options.maxHeight || "60vh";

    const wrap = document.createElement("div");
    wrap.className = "rich-editor";
    wrap.innerHTML = `
      ${buildToolbar()}
      <div class="rich-content"
           contenteditable="true"
           data-content
           style="min-height:${minHeight}px;max-height:${maxHeight};"
      ></div>
      <div class="rich-popover" data-popover-content="textcolor" hidden>${buildColorSwatches("Text color", "fore")}</div>
      <div class="rich-popover" data-popover-content="hilitecolor" hidden>${buildColorSwatches("Highlight color", "hilite")}</div>
      <div class="rich-popover" data-popover-content="table" hidden>${buildTablePicker(6, 8)}</div>
    `;
    const content = wrap.querySelector("[data-content]");
    const toolbar = wrap.querySelector("[data-toolbar]");
    const fileInput = wrap.querySelector("[data-img-input]");
    content.innerHTML = initialHtml || "";

    let savedRange = null;
    let openPopover = null;

    function closePopover() {
      if (openPopover) {
        openPopover.setAttribute("hidden", "");
        openPopover = null;
      }
    }

    function positionPopover(popover, anchor) {
      // Anchor below the toolbar button, left-aligned to it
      const wrapRect = wrap.getBoundingClientRect();
      const anchorRect = anchor.getBoundingClientRect();
      popover.style.top = `${anchorRect.bottom - wrapRect.top + 4}px`;
      popover.style.left = `${anchorRect.left - wrapRect.left}px`;
    }

    function togglePopover(name, anchor) {
      const target = wrap.querySelector(`[data-popover-content="${name}"]`);
      if (!target) return;
      if (openPopover === target) {
        closePopover();
        return;
      }
      closePopover();
      // Save the editor selection BEFORE the popover button stole focus
      savedRange = saveSel();
      positionPopover(target, anchor);
      target.removeAttribute("hidden");
      openPopover = target;
    }

    // Don't let the toolbar steal focus on click — keeps the selection
    // alive in the editor when applying commands.
    toolbar.addEventListener("mousedown", (e) => {
      const ctrl = e.target.closest("[data-cmd], [data-popover]");
      if (ctrl && ctrl.tagName !== "INPUT" && ctrl.tagName !== "SELECT") {
        e.preventDefault();
      }
    });

    toolbar.addEventListener("click", async (e) => {
      const popBtn = e.target.closest("[data-popover]");
      if (popBtn) {
        e.preventDefault();
        togglePopover(popBtn.dataset.popover, popBtn);
        return;
      }
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

    // ── Color swatch picking ───────────────────────────────────
    wrap.addEventListener("click", (e) => {
      const swatch = e.target.closest("[data-pick-color]");
      if (swatch) {
        e.preventDefault();
        const color = swatch.dataset.pickColor;
        const type = swatch.dataset.pickType; // "fore" or "hilite"
        content.focus();
        restoreSel(savedRange);
        if (type === "fore") {
          exec("foreColor", color);
          const bar = wrap.querySelector('[data-color-bar="text"]');
          if (bar) bar.style.background = color;
        } else {
          // hiliteColor needs styleWithCSS=true on some browsers
          try { document.execCommand("styleWithCSS", false, true); } catch {}
          exec("hiliteColor", color);
          try { document.execCommand("styleWithCSS", false, false); } catch {}
          const bar = wrap.querySelector('[data-color-bar="hilite"]');
          if (bar) bar.style.background = color;
        }
        closePopover();
        return;
      }
      const clear = e.target.closest("[data-clear-color]");
      if (clear) {
        e.preventDefault();
        const type = clear.dataset.clearColor;
        content.focus();
        restoreSel(savedRange);
        if (type === "fore") {
          exec("foreColor", "#000000");
        } else {
          try { document.execCommand("styleWithCSS", false, true); } catch {}
          exec("hiliteColor", "transparent");
          try { document.execCommand("styleWithCSS", false, false); } catch {}
        }
        closePopover();
        return;
      }
    });

    // ── Table picker hover + insert ─────────────────────────────
    const tableGrid = wrap.querySelector(".rich-table-grid");
    const tableLabel = wrap.querySelector("[data-table-label]");
    if (tableGrid) {
      tableGrid.addEventListener("mousemove", (e) => {
        const cell = e.target.closest("[data-r]");
        if (!cell) return;
        const hr = +cell.dataset.r;
        const hc = +cell.dataset.c;
        tableGrid.querySelectorAll("[data-r]").forEach((c) => {
          const r = +c.dataset.r, col = +c.dataset.c;
          c.classList.toggle("is-hot", r <= hr && col <= hc);
        });
        if (tableLabel) tableLabel.textContent = `${hr} × ${hc}`;
      });
      tableGrid.addEventListener("mouseleave", () => {
        tableGrid.querySelectorAll(".is-hot").forEach((c) => c.classList.remove("is-hot"));
        if (tableLabel) tableLabel.textContent = "Insert table";
      });
      tableGrid.addEventListener("click", (e) => {
        const cell = e.target.closest("[data-r]");
        if (!cell) return;
        e.preventDefault();
        const rows = +cell.dataset.r;
        const cols = +cell.dataset.c;
        content.focus();
        restoreSel(savedRange);
        exec("insertHTML", makeTableHtml(rows, cols));
        closePopover();
      });
    }

    // Close popovers on outside click
    document.addEventListener("mousedown", (e) => {
      if (!openPopover) return;
      if (!wrap.contains(e.target)) closePopover();
      else if (!e.target.closest("[data-popover-content]") && !e.target.closest("[data-popover]")) {
        closePopover();
      }
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
