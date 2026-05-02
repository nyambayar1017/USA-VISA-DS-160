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
          <button type="button" class="img-picker-tool-btn" data-action="new-folder" title="Create a new folder">+ Folder</button>
          <button type="button" class="img-picker-tool-btn is-primary" data-action="upload" title="Upload photos to the current folder">+ Upload</button>
          <input type="file" accept="image/*" multiple hidden data-action="file-input" />
          <span class="img-picker-count" data-picker-count>0 selected</span>
        </div>
        <p class="img-picker-status" data-picker-status hidden></p>
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
      grid.innerHTML = `<p class="empty">No images match these filters. Use <strong>+ Upload</strong> above to add some.</p>`;
      return;
    }
    grid.innerHTML = filtered
      .map((e) => {
        const sel = STATE.selected.has(e.id);
        const thumb = `/api/gallery/${encodeURIComponent(e.id)}/file?size=thumb`;
        return `
          <button type="button" class="img-picker-tile${sel ? " is-selected" : ""}" data-id="${escapeHtml(e.id)}" title="${escapeHtml(e.originalName)}">
            <img src="${escapeHtml(thumb)}" alt="${escapeHtml(e.originalName)}" loading="lazy" />
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

  function setStatus(msg, kind) {
    const node = STATE.overlay?.querySelector("[data-picker-status]");
    if (!node) return;
    if (!msg) {
      node.hidden = true;
      node.textContent = "";
      node.className = "img-picker-status";
      return;
    }
    node.hidden = false;
    node.textContent = msg;
    node.className = `img-picker-status${kind ? ` is-${kind}` : ""}`;
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

  // Upload destination = currently active folder filter, unless it's
  // "All" or "No folder" — in which case upload to no folder.
  function uploadFolder() {
    if (!STATE.folder || STATE.folder === "__none__") return "";
    return STATE.folder;
  }

  async function uploadOne(file, folder) {
    const compressed =
      window.CompressUpload && window.CompressUpload.file
        ? await window.CompressUpload.file(file)
        : file;
    const fd = new FormData();
    fd.append("file", compressed, compressed.name || "image.jpg");
    if (folder) fd.append("folder", folder);
    const res = await fetch("/api/gallery", { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Upload failed");
    return data.entry;
  }

  async function uploadFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const folder = uploadFolder();
    const dest = folder ? `📁 ${folder}` : "no folder";
    let done = 0;
    setStatus(`Uploading 0 / ${files.length} → ${dest}…`);
    const newIds = [];
    for (const file of files) {
      try {
        const entry = await uploadOne(file, folder);
        if (entry?.id) {
          STATE.entries.unshift(entry);
          newIds.push(entry.id);
          if (STATE.multiple) STATE.selected.add(entry.id);
          else STATE.selected = new Set([entry.id]);
        }
        done++;
        setStatus(`Uploading ${done} / ${files.length} → ${dest}…`);
      } catch (err) {
        setStatus(`${file.name}: ${err.message || "upload failed"}`, "error");
      }
    }
    // Folder may now exist if it was just created via "+ Folder" — reload
    // from server so folder list + counts stay accurate.
    await load();
    if (newIds.length) {
      setStatus(`Uploaded ${newIds.length} photo${newIds.length === 1 ? "" : "s"}.`, "ok");
      setTimeout(() => setStatus(""), 2400);
    }
  }

  async function createFolder() {
    const name = window.UI?.prompt
      ? await window.UI.prompt("Folder name", { confirmLabel: "Create" })
      : window.prompt("Folder name");
    const trimmed = (name || "").trim();
    if (!trimmed) return;
    try {
      const res = await fetch("/api/gallery/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create folder");
      STATE.folder = trimmed;
      await load();
      // Keep the new folder selected in the dropdown.
      const sel = STATE.overlay.querySelector('[data-action="folder"]');
      if (sel) sel.value = trimmed;
      setStatus(`Folder "${trimmed}" created. Uploads will go here.`, "ok");
      setTimeout(() => setStatus(""), 2400);
    } catch (err) {
      setStatus(err.message || "Could not create folder", "error");
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
      if (action === "upload") {
        STATE.overlay.querySelector('[data-action="file-input"]').click();
        return;
      }
      if (action === "new-folder") {
        createFolder();
        return;
      }
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
      } else if (event.target.dataset.action === "file-input") {
        const input = event.target;
        const files = input.files;
        // Clear the value so the same file can be re-picked later.
        uploadFiles(files).finally(() => {
          input.value = "";
        });
      }
    });

    return new Promise((resolve) => {
      STATE.resolve = resolve;
      load();
    });
  }

  // Look up loaded gallery entries by id. Used by callers (location editor,
  // trip creator) to inherit fields like alt text from the gallery instead of
  // re-asking the user. Returns null if the picker hasn't been opened yet.
  function getEntry(id) {
    if (!id) return null;
    return (STATE.entries || []).find((e) => e && e.id === id) || null;
  }

  window.ImagePicker = { open, getEntry };
})();
