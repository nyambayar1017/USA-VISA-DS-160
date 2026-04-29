// Reusable gallery image picker.
//
//   const picked = await window.ImagePicker.open({
//     selected: ["id1", "id2"],   // optional pre-selected IDs
//     multiple: true,             // default true
//     title: "Choose photos",
//   });
//   // → array of selected gallery image IDs (or null if user cancelled)

(function () {
  const STATE = {
    overlay: null,
    resolve: null,
    selected: new Set(),
    multiple: true,
    folder: "",
    q: "",
    entries: [],
    folders: [],
  };

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function buildOverlay(title) {
    const overlay = document.createElement("div");
    overlay.className = "img-picker-overlay";
    overlay.innerHTML = `
      <div class="img-picker-dialog" role="dialog" aria-modal="true">
        <div class="img-picker-head">
          <h2>${escapeHtml(title || "Select photos")}</h2>
          <button type="button" class="img-picker-close" data-action="cancel" aria-label="Close">×</button>
        </div>
        <div class="img-picker-toolbar">
          <select data-action="folder">
            <option value="">All folders</option>
            <option value="__none__">No folder</option>
          </select>
          <input type="search" placeholder="Search name / tag" data-action="search" />
          <span class="img-picker-count" data-picker-count>0 selected</span>
        </div>
        <div class="img-picker-grid" data-picker-grid>
          <p class="empty">Loading…</p>
        </div>
        <div class="img-picker-foot">
          <button type="button" class="button-secondary" data-action="cancel">Cancel</button>
          <button type="button" class="img-picker-confirm" data-action="confirm">Add selected</button>
        </div>
      </div>
    `;
    return overlay;
  }

  function refreshFolders() {
    const select = STATE.overlay.querySelector('[data-action="folder"]');
    const prev = select.value;
    select.innerHTML = `
      <option value="">All folders</option>
      <option value="__none__">No folder</option>
      ${STATE.folders.map((f) => `<option value="${escapeHtml(f)}">${escapeHtml(f)}</option>`).join("")}
    `;
    if ([...select.options].some((o) => o.value === prev)) select.value = prev;
  }

  function refreshGrid() {
    const grid = STATE.overlay.querySelector("[data-picker-grid]");
    const filtered = STATE.entries.filter((e) => {
      if (e.kind !== "image") return false;
      if (STATE.folder === "__none__" && (e.folder || "").trim()) return false;
      if (STATE.folder && STATE.folder !== "__none__" && (e.folder || "").toLowerCase() !== STATE.folder.toLowerCase()) return false;
      if (STATE.q) {
        const hay = `${e.originalName} ${(e.tags || []).join(" ")} ${e.folder || ""}`.toLowerCase();
        if (!hay.includes(STATE.q)) return false;
      }
      return true;
    });
    if (!filtered.length) {
      grid.innerHTML = `<p class="empty">No images match these filters. Upload more from <a href="/gallery" target="_blank" rel="noopener">Gallery</a>.</p>`;
      return;
    }
    grid.innerHTML = filtered
      .map((e) => {
        const sel = STATE.selected.has(e.id);
        return `
          <button type="button" class="img-picker-tile${sel ? " is-selected" : ""}" data-id="${escapeHtml(e.id)}" title="${escapeHtml(e.originalName)}">
            <img src="${escapeHtml(e.url)}" alt="${escapeHtml(e.originalName)}" loading="lazy" />
            <span class="img-picker-check">✓</span>
          </button>
        `;
      })
      .join("");
    refreshCount();
  }

  function refreshCount() {
    const node = STATE.overlay.querySelector("[data-picker-count]");
    node.textContent = `${STATE.selected.size} selected`;
  }

  async function load() {
    try {
      const res = await fetch("/api/gallery?kind=image");
      const data = await res.json();
      STATE.entries = data.entries || [];
      STATE.folders = data.folders || [];
      refreshFolders();
      refreshGrid();
    } catch (err) {
      const grid = STATE.overlay.querySelector("[data-picker-grid]");
      grid.innerHTML = `<p class="empty">${escapeHtml(err.message || "Could not load gallery.")}</p>`;
    }
  }

  function close(result) {
    if (!STATE.overlay) return;
    document.body.removeChild(STATE.overlay);
    STATE.overlay = null;
    document.body.classList.remove("img-picker-open");
    const r = STATE.resolve;
    STATE.resolve = null;
    STATE.selected = new Set();
    if (r) r(result);
  }

  function open(opts = {}) {
    if (STATE.overlay) return Promise.resolve(null);
    STATE.multiple = opts.multiple !== false;
    STATE.selected = new Set(opts.selected || []);
    STATE.folder = "";
    STATE.q = "";
    STATE.overlay = buildOverlay(opts.title);
    document.body.appendChild(STATE.overlay);
    document.body.classList.add("img-picker-open");

    STATE.overlay.addEventListener("click", (event) => {
      const action = event.target.closest("[data-action]")?.dataset.action;
      const tile = event.target.closest(".img-picker-tile");
      if (action === "cancel") return close(null);
      if (action === "confirm") return close(Array.from(STATE.selected));
      if (tile) {
        const id = tile.dataset.id;
        if (!STATE.multiple) {
          STATE.selected = new Set([id]);
          return close(Array.from(STATE.selected));
        }
        if (STATE.selected.has(id)) STATE.selected.delete(id);
        else STATE.selected.add(id);
        refreshGrid();
      }
    });

    STATE.overlay.addEventListener("input", (event) => {
      if (event.target.dataset.action === "search") {
        STATE.q = (event.target.value || "").trim().toLowerCase();
        refreshGrid();
      }
    });
    STATE.overlay.addEventListener("change", (event) => {
      if (event.target.dataset.action === "folder") {
        STATE.folder = event.target.value;
        refreshGrid();
      }
    });

    return new Promise((resolve) => {
      STATE.resolve = resolve;
      load();
    });
  }

  window.ImagePicker = { open };
})();
