// Gallery: shared media library. Images are compressed client-side via
// CompressUpload before upload (saves Render disk + bandwidth). Videos
// store just the URL — provider hosting handles delivery.

(function () {
  const grid = document.getElementById("gal-grid");
  const count = document.getElementById("gal-count");
  const searchInput = document.getElementById("gal-search");
  const kindSelect = document.getElementById("gal-kind");
  const folderBar = document.getElementById("gal-folder-bar");
  const tagInput = document.getElementById("gal-tag");
  const tagListEl = document.getElementById("gal-tag-list");
  const fileInput = document.getElementById("gal-file");
  const uploadBtn = document.getElementById("gal-upload-btn");
  const uploadModal = document.getElementById("gal-upload-modal");
  const uploadForm = document.getElementById("gal-upload-form");
  const uploadStatus = document.getElementById("gal-upload-status");
  const uploadDestinationInput = document.getElementById("gal-upload-destination");
  const uploadDestinationList = document.getElementById("gal-upload-destination-list");
  const uploadTagsInput = document.getElementById("gal-upload-tags");
  const uploadAltInput = document.getElementById("gal-upload-alt");
  const uploadFolderSelect = document.getElementById("gal-upload-folder");
  const uploadSubmit = document.getElementById("gal-upload-submit");
  const editModal = document.getElementById("gal-edit-modal");
  const editForm = document.getElementById("gal-edit-form");
  const editStatus = document.getElementById("gal-edit-status");
  const editNameInput = document.getElementById("gal-edit-name");
  const editFolderSelect = document.getElementById("gal-edit-folder");
  const editAltInput = document.getElementById("gal-edit-alt");
  const editTagsInput = document.getElementById("gal-edit-tags");
  const videoModal = document.getElementById("gal-video-modal");
  const videoForm = document.getElementById("gal-video-form");
  const videoStatus = document.getElementById("gal-video-status");
  const addVideoBtn = document.getElementById("gal-add-video-btn");
  const bulkBar = document.getElementById("gal-bulk-bar");
  const bulkCount = document.getElementById("gal-bulk-count");
  const bulkFolderInput = document.getElementById("gal-bulk-folder");
  const bulkMoveBtn = document.getElementById("gal-bulk-move");
  const bulkDeleteBtn = document.getElementById("gal-bulk-delete");
  const bulkClearBtn = document.getElementById("gal-bulk-clear");
  const selectAllBtn = document.getElementById("gal-select-all");

  const state = {
    entries: [],
    folders: [], // [{name, count}]
    noFolderCount: 0,
    totalCount: 0,
    activeFolder: "", // "" = All, "__none__" = no folder, else folder name
    selected: new Set(),
  };

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function fmtSize(bytes) {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }

  function refreshBulkBar() {
    document.body.classList.toggle("gallery-select-mode", state.selected.size > 0);
    if (!bulkBar) return;
    if (!state.selected.size) {
      bulkBar.hidden = true;
      return;
    }
    bulkBar.hidden = false;
    bulkCount.textContent = `${state.selected.size} selected`;
  }

  function refreshFolderBar() {
    if (!folderBar) return;
    const total = state.totalCount;
    const noneCount = state.noFolderCount;
    const chips = [
      `<button type="button" class="gallery-folder-chip${state.activeFolder === "" ? " is-active" : ""}" data-folder=""><span>All</span><em>${total}</em></button>`,
      `<button type="button" class="gallery-folder-chip${state.activeFolder === "__none__" ? " is-active" : ""}" data-folder="__none__"><span>No folder</span><em>${noneCount}</em></button>`,
    ];
    state.folders.forEach((f) => {
      const isActive = state.activeFolder.toLowerCase() === f.name.toLowerCase();
      chips.push(`
        <button type="button" class="gallery-folder-chip${isActive ? " is-active" : ""}" data-folder="${escapeHtml(f.name)}">
          <span>📁 ${escapeHtml(f.name)}</span>
          <em>${f.count}</em>
          <span class="gallery-folder-menu" data-folder-menu="${escapeHtml(f.name)}" title="Rename / delete">⋯</span>
        </button>
      `);
    });
    chips.push('<button type="button" class="gallery-folder-chip is-add" id="gal-new-folder-btn" data-folder-action="new">+ New folder</button>');
    folderBar.innerHTML = chips.join("");
  }

  function allTags() {
    const set = new Set();
    state.entries.forEach((e) => {
      (e.tags || []).forEach((t) => {
        const v = String(t || "").trim();
        if (v) set.add(v);
      });
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }

  function refreshTagDatalists() {
    const tags = allTags();
    const opts = tags.map((t) => `<option value="${escapeHtml(t)}"></option>`).join("");
    if (tagListEl) tagListEl.innerHTML = opts;
    if (uploadDestinationList) uploadDestinationList.innerHTML = opts;
  }

  function populateFolderSelect(selectEl, currentValue) {
    if (!selectEl) return;
    const options = ['<option value="">— No folder —</option>'];
    state.folders.forEach((f) => {
      const val = escapeHtml(f.name);
      options.push(`<option value="${val}">📁 ${val}</option>`);
    });
    selectEl.innerHTML = options.join("");
    if (currentValue != null) selectEl.value = currentValue;
  }

  function currentFiltered() {
    const q = (searchInput.value || "").trim().toLowerCase();
    const tag = (tagInput.value || "").trim().toLowerCase();
    const kind = kindSelect.value;
    const folderFilter = state.activeFolder;
    return state.entries.filter((e) => {
      if (kind && e.kind !== kind) return false;
      if (folderFilter === "__none__" && (e.folder || "").trim()) return false;
      else if (folderFilter && folderFilter !== "__none__" && (e.folder || "").toLowerCase() !== folderFilter.toLowerCase()) return false;
      if (tag && !(e.tags || []).some((t) => t.toLowerCase() === tag)) return false;
      if (q) {
        const hay = `${e.originalName} ${(e.tags || []).join(" ")} ${e.folder || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  function render() {
    const q = (searchInput.value || "").trim().toLowerCase();
    const tag = (tagInput.value || "").trim().toLowerCase();
    const kind = kindSelect.value;
    const folderFilter = state.activeFolder;
    const filtered = currentFiltered();

    // Folder cards appear inline with media — but only on the "All" view
    // (no folder selected) so the grid doubles as a Finder-style browser.
    // Inside a folder, we want to focus on its contents only.
    const showFolderCards = folderFilter === "" && !q && !tag && !kind;
    const folderCardsHtml = showFolderCards
      ? state.folders.map((f) => {
          const sample = state.entries.find(
            (e) => e.kind === "image" && (e.folder || "").toLowerCase() === f.name.toLowerCase()
          );
          const cover = sample
            ? `<img src="/api/gallery/${encodeURIComponent(sample.id)}/file?size=thumb" alt="" loading="lazy" />`
            : `<div class="gallery-folder-cover-empty">📁</div>`;
          return `
            <article class="gallery-card gallery-folder-card" data-folder-target="${escapeHtml(f.name)}">
              <div class="gallery-thumb gallery-folder-cover">${cover}</div>
              <div class="gallery-card-body">
                <p class="gallery-card-title" title="${escapeHtml(f.name)}">📁 ${escapeHtml(f.name)}</p>
                <p class="gallery-card-meta">${f.count} item${f.count === 1 ? "" : "s"}</p>
              </div>
            </article>
          `;
        }).join("")
      : "";

    count.textContent = `${filtered.length} item${filtered.length === 1 ? "" : "s"}`;
    if (!filtered.length && !folderCardsHtml) {
      grid.innerHTML = `<p class="empty">No media match these filters.</p>`;
      return;
    }
    grid.innerHTML = folderCardsHtml + filtered
      .map((e) => {
        const tags = (e.tags || [])
          .map((t) => `<span class="gallery-chip">${escapeHtml(t)}</span>`)
          .join(" ");
        const thumb = e.kind === "image"
          ? `/api/gallery/${encodeURIComponent(e.id)}/file?size=thumb`
          : "";
        const preview = e.kind === "image"
          ? `<img src="${escapeHtml(thumb)}" alt="${escapeHtml(e.originalName)}" loading="lazy" />`
          : `<div class="gallery-video-placeholder">▶ Video</div>`;
        const meta = e.kind === "image"
          ? fmtSize(e.size)
          : `<a href="${escapeHtml(e.url)}" target="_blank" rel="noopener">Open ↗</a>`;
        const isSelected = state.selected.has(e.id);
        const folderBadge = e.folder
          ? `<span class="gallery-folder-badge">📁 ${escapeHtml(e.folder)}</span>`
          : "";
        return `
          <article class="gallery-card${isSelected ? " is-selected" : ""}" data-id="${escapeHtml(e.id)}" draggable="true">
            <label class="gallery-select">
              <input type="checkbox" data-action="toggle-select" data-id="${escapeHtml(e.id)}" ${isSelected ? "checked" : ""} />
            </label>
            <div class="gallery-thumb">${preview}</div>
            <div class="gallery-card-body">
              <p class="gallery-card-title" title="${escapeHtml(e.originalName)}">${escapeHtml(e.originalName)}</p>
              <p class="gallery-card-meta">${meta} ${folderBadge}</p>
              <div class="gallery-tags">${tags}</div>
              <div class="gallery-actions">
                <button type="button" class="gallery-copy-id" data-action="copy-id" data-id="${escapeHtml(e.id)}" title="Copy ID">📋 ID</button>
                <button type="button" class="gallery-edit" data-action="edit" data-id="${escapeHtml(e.id)}">Edit</button>
                <button type="button" class="gallery-delete" data-action="delete" data-id="${escapeHtml(e.id)}">Delete</button>
              </div>
            </div>
          </article>
        `;
      })
      .join("");
  }

  async function load() {
    grid.innerHTML = `<p class="empty">Loading…</p>`;
    try {
      const res = await fetch("/api/gallery");
      const data = await res.json();
      state.entries = data.entries || [];
      state.folders = data.folderStats || [];
      state.noFolderCount = Number(data.noFolderCount || 0);
      state.totalCount = Number(data.totalCount || state.entries.length);
      refreshFolderBar();
      refreshTagDatalists();
      render();
    } catch (err) {
      grid.innerHTML = `<p class="empty">${escapeHtml(err.message || "Could not load.")}</p>`;
    }
  }

  // ── Image upload (client-compressed) ──────────────────────────
  async function uploadImage(file, { folder = "", tags = "", alt = "" } = {}) {
    const compressed = (window.CompressUpload && window.CompressUpload.compressToFile)
      ? await window.CompressUpload.compressToFile(file)
      : file;
    const formData = new FormData();
    formData.append("file", compressed, compressed.name || "image.jpg");
    if (folder) formData.append("folder", folder);
    if (tags) formData.append("tags", tags);
    if (alt) formData.append("alt", alt);
    const res = await fetch("/api/gallery", { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Upload failed");
    return data.entry;
  }

  function openUploadModal() {
    uploadForm.reset();
    if (uploadStatus) uploadStatus.textContent = "";
    refreshTagDatalists();
    // Default folder to the currently-active folder chip (if a real folder).
    const defaultFolder = state.activeFolder && state.activeFolder !== "__none__" ? state.activeFolder : "";
    populateFolderSelect(uploadFolderSelect, defaultFolder);
    uploadModal.classList.remove("is-hidden");
    uploadModal.removeAttribute("hidden");
    document.body.classList.add("modal-open");
    setTimeout(() => uploadDestinationInput?.focus(), 60);
  }
  function closeUploadModal() {
    uploadModal.classList.add("is-hidden");
    uploadModal.setAttribute("hidden", "");
    document.body.classList.remove("modal-open");
  }
  uploadBtn.addEventListener("click", openUploadModal);
  uploadModal.addEventListener("click", (event) => {
    if (event.target.dataset.action === "close-upload-modal") closeUploadModal();
  });
  uploadForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const files = Array.from(fileInput.files || []);
    if (!files.length) {
      if (uploadStatus) uploadStatus.textContent = "Pick at least one file.";
      return;
    }
    const destination = (uploadDestinationInput.value || "").trim();
    const extra = (uploadTagsInput.value || "").trim();
    // Combine destination + extra tags into a single comma-separated list.
    const combinedTags = [destination, extra].filter(Boolean).join(", ");
    const folder = uploadFolderSelect.value || "";
    const alt = (uploadAltInput?.value || "").trim();
    uploadSubmit.disabled = true;
    if (uploadStatus) uploadStatus.textContent = `Uploading 0 / ${files.length}…`;
    let succeeded = 0;
    for (const file of files) {
      try {
        const entry = await uploadImage(file, { folder, tags: combinedTags, alt });
        state.entries.unshift(entry);
        succeeded++;
        if (uploadStatus) uploadStatus.textContent = `Uploading ${succeeded} / ${files.length}…`;
      } catch (err) {
        alert(`${file.name}: ${err.message}`);
      }
    }
    uploadSubmit.disabled = false;
    if (succeeded) {
      closeUploadModal();
      await load();
    } else if (uploadStatus) {
      uploadStatus.textContent = "Upload failed.";
    }
  });

  // ── Add video URL modal ───────────────────────────────────────
  function openVideoModal() {
    videoForm.reset();
    if (videoStatus) videoStatus.textContent = "";
    videoModal.classList.remove("is-hidden");
    videoModal.removeAttribute("hidden");
    document.body.classList.add("modal-open");
  }
  function closeVideoModal() {
    videoModal.classList.add("is-hidden");
    videoModal.setAttribute("hidden", "");
    document.body.classList.remove("modal-open");
  }
  addVideoBtn.addEventListener("click", openVideoModal);
  videoModal.addEventListener("click", (event) => {
    if (event.target.dataset.action === "close-video-modal") closeVideoModal();
  });
  videoForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (videoStatus) videoStatus.textContent = "Saving…";
    const data = Object.fromEntries(new FormData(videoForm).entries());
    try {
      const res = await fetch("/api/gallery/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: data.title,
          videoUrl: data.videoUrl,
          tags: (data.tags || "").split(",").map((s) => s.trim()).filter(Boolean),
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Save failed");
      state.entries.unshift(result.entry);
      render();
      closeVideoModal();
    } catch (err) {
      if (videoStatus) videoStatus.textContent = err.message || "Save failed.";
    }
  });

  // ── Card actions: select, copy id, edit, delete ─────────────
  function toggleSelected(id, on) {
    if (on) state.selected.add(id);
    else state.selected.delete(id);
    const card = grid.querySelector(`.gallery-card[data-id="${CSS.escape(id)}"]`);
    card?.classList.toggle("is-selected", on);
    const cb = card?.querySelector('[data-action="toggle-select"]');
    if (cb) cb.checked = on;
    refreshBulkBar();
  }

  grid.addEventListener("change", (event) => {
    const cb = event.target.closest('[data-action="toggle-select"]');
    if (!cb) return;
    toggleSelected(cb.dataset.id, cb.checked);
  });

  grid.addEventListener("click", async (event) => {
    const target = event.target.closest("[data-action]");
    if (target) {
      const id = target.dataset.id;
      if (target.dataset.action === "copy-id") {
        try {
          await navigator.clipboard.writeText(id);
          const prev = target.textContent;
          target.textContent = "✓ Copied";
          setTimeout(() => { target.textContent = prev; }, 1200);
        } catch {
          window.prompt("Copy this ID:", id);
        }
        return;
      }
      if (target.dataset.action === "edit") {
        const entry = state.entries.find((e) => e.id === id);
        if (entry) openEditModal(entry);
        return;
      }
      if (target.dataset.action === "delete") {
        const ok = window.UI?.confirm
          ? await window.UI.confirm("Delete this media item?", { dangerous: true, confirmLabel: "Delete" })
          : window.confirm("Delete this media item?");
        if (!ok) return;
        try {
          const res = await fetch(`/api/gallery/${encodeURIComponent(id)}`, { method: "DELETE" });
          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || "Delete failed");
          }
          state.entries = state.entries.filter((e) => e.id !== id);
          state.selected.delete(id);
          refreshBulkBar();
          render();
        } catch (err) {
          alert(err.message || "Delete failed");
        }
        return;
      }
      // toggle-select handled by the change listener above.
      if (target.dataset.action === "toggle-select") return;
    }

    // Click-to-select: once at least one item is already selected, clicking
    // anywhere on a card toggles its selection (no need to find the tiny
    // checkbox). Skip when the click was on an interactive element.
    if (state.selected.size > 0) {
      const card = event.target.closest(".gallery-card");
      if (!card) return;
      // Ignore clicks on the checkbox/label, action buttons, or links —
      // those have their own behavior.
      if (event.target.closest("a") || event.target.closest("button") || event.target.closest("input") || event.target.closest("label")) return;
      event.preventDefault();
      const id = card.dataset.id;
      toggleSelected(id, !state.selected.has(id));
    }
  });

  // ── Edit modal ───────────────────────────────────────────────
  function openEditModal(entry) {
    editForm.reset();
    if (editStatus) editStatus.textContent = "";
    editForm.elements.id.value = entry.id;
    editNameInput.value = entry.originalName || "";
    populateFolderSelect(editFolderSelect, entry.folder || "");
    if (editAltInput) editAltInput.value = entry.alt || "";
    editTagsInput.value = (entry.tags || []).join(", ");
    editModal.classList.remove("is-hidden");
    editModal.removeAttribute("hidden");
    document.body.classList.add("modal-open");
    setTimeout(() => editNameInput.focus(), 60);
  }
  function closeEditModal() {
    editModal.classList.add("is-hidden");
    editModal.setAttribute("hidden", "");
    document.body.classList.remove("modal-open");
  }
  editModal.addEventListener("click", (event) => {
    if (event.target.dataset.action === "close-edit-modal") closeEditModal();
  });
  editForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const id = editForm.elements.id.value;
    const payload = {
      originalName: editNameInput.value.trim(),
      folder: editFolderSelect.value || "",
      alt: (editAltInput?.value || "").trim(),
      tags: editTagsInput.value.split(",").map((s) => s.trim()).filter(Boolean),
    };
    if (editStatus) editStatus.textContent = "Saving…";
    try {
      const res = await fetch(`/api/gallery/${encodeURIComponent(id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      const idx = state.entries.findIndex((e) => e.id === id);
      if (idx >= 0) state.entries[idx] = { ...state.entries[idx], ...data.entry };
      closeEditModal();
      // Reload so folder counts + tag list stay accurate.
      await load();
    } catch (err) {
      if (editStatus) editStatus.textContent = err.message || "Save failed.";
    }
  });

  // ── Bulk move-to-folder ──────────────────────────────────────
  bulkMoveBtn?.addEventListener("click", async () => {
    if (!state.selected.size) return;
    const folder = (bulkFolderInput.value || "").trim();
    bulkMoveBtn.disabled = true;
    try {
      for (const id of Array.from(state.selected)) {
        const res = await fetch(`/api/gallery/${encodeURIComponent(id)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ folder }),
        });
        if (res.ok) {
          const data = await res.json();
          const idx = state.entries.findIndex((e) => e.id === id);
          if (idx >= 0) state.entries[idx] = { ...state.entries[idx], ...data.entry };
        }
      }
      state.selected.clear();
      bulkFolderInput.value = "";
      refreshBulkBar();
      // Reload to get refreshed folder counts from the server.
      await load();
    } catch (err) {
      alert(err.message || "Could not move");
    } finally {
      bulkMoveBtn.disabled = false;
    }
  });
  bulkClearBtn?.addEventListener("click", () => {
    state.selected.clear();
    refreshBulkBar();
    render();
  });

  // ── Bulk delete ─────────────────────────────────────────────
  bulkDeleteBtn?.addEventListener("click", async () => {
    if (!state.selected.size) return;
    const n = state.selected.size;
    const ok = window.UI?.confirm
      ? await window.UI.confirm(
          `Delete ${n} selected item${n === 1 ? "" : "s"}? This can't be undone.`,
          { dangerous: true, confirmLabel: "Delete" }
        )
      : window.confirm(`Delete ${n} selected item${n === 1 ? "" : "s"}?`);
    if (!ok) return;
    bulkDeleteBtn.disabled = true;
    let failed = 0;
    for (const id of Array.from(state.selected)) {
      try {
        const res = await fetch(`/api/gallery/${encodeURIComponent(id)}`, { method: "DELETE" });
        if (!res.ok) { failed++; continue; }
        state.entries = state.entries.filter((e) => e.id !== id);
      } catch (_) {
        failed++;
      }
    }
    state.selected.clear();
    refreshBulkBar();
    bulkDeleteBtn.disabled = false;
    await load();
    if (failed) {
      window.UI?.toast?.(`Deleted ${n - failed}, ${failed} failed.`, "error");
    } else {
      window.UI?.toast?.(`Deleted ${n} item${n === 1 ? "" : "s"}.`, "success");
    }
  });

  // ── Select-all (filtered) toggle ────────────────────────────
  // Selects every photo card currently visible. Folder cards are
  // skipped (they aren't deletable items). Re-clicking when all
  // visible items are already selected clears just those.
  selectAllBtn?.addEventListener("click", () => {
    const filtered = currentFiltered().filter((e) => e.kind === "image");
    if (!filtered.length) return;
    const allSelected = filtered.every((e) => state.selected.has(e.id));
    if (allSelected) {
      filtered.forEach((e) => state.selected.delete(e.id));
    } else {
      filtered.forEach((e) => state.selected.add(e.id));
    }
    refreshBulkBar();
    render();
  });

  [searchInput, kindSelect, tagInput].forEach((node) => {
    node?.addEventListener("input", render);
    node?.addEventListener("change", render);
  });

  // ── Folder bar interactions ──────────────────────────────────
  // The chip ⋯ menu uses a small inline dropdown rendered into the bar.
  let openFolderMenu = null; // {name, dropdownEl}
  function closeFolderMenu() {
    if (openFolderMenu && openFolderMenu.dropdownEl?.parentNode) {
      openFolderMenu.dropdownEl.parentNode.removeChild(openFolderMenu.dropdownEl);
    }
    openFolderMenu = null;
  }

  function openFolderActionsMenu(folderName, anchor) {
    closeFolderMenu();
    const drop = document.createElement("div");
    drop.className = "gallery-folder-dropdown";
    drop.innerHTML = `
      <button type="button" data-folder-act="rename">Rename</button>
      <button type="button" data-folder-act="delete">Delete</button>
    `;
    document.body.appendChild(drop);
    const rect = anchor.getBoundingClientRect();
    drop.style.position = "fixed";
    drop.style.top = `${Math.round(rect.bottom + 6)}px`;
    drop.style.left = `${Math.round(rect.left)}px`;
    drop.style.zIndex = "500";
    openFolderMenu = { name: folderName, dropdownEl: drop };

    drop.addEventListener("click", async (ev) => {
      const btn = ev.target.closest("[data-folder-act]");
      if (!btn) return;
      const act = btn.dataset.folderAct;
      closeFolderMenu();
      if (act === "rename") await renameFolder(folderName);
      if (act === "delete") await deleteFolder(folderName);
    });
  }

  document.addEventListener("click", (e) => {
    if (!openFolderMenu) return;
    if (e.target.closest(".gallery-folder-dropdown")) return;
    if (e.target.closest("[data-folder-menu]")) return;
    closeFolderMenu();
  });

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
      state.activeFolder = trimmed;
      await load();
    } catch (err) {
      alert(err.message || "Could not create folder");
    }
  }

  async function renameFolder(oldName) {
    const next = window.UI?.prompt
      ? await window.UI.prompt(`Rename "${oldName}" to:`, { defaultValue: oldName, confirmLabel: "Rename" })
      : window.prompt(`Rename "${oldName}" to:`, oldName);
    const trimmed = (next || "").trim();
    if (!trimmed || trimmed === oldName) return;
    try {
      const res = await fetch(`/api/gallery/folders/${encodeURIComponent(oldName)}/rename`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Rename failed");
      if (state.activeFolder.toLowerCase() === oldName.toLowerCase()) {
        state.activeFolder = trimmed;
      }
      await load();
    } catch (err) {
      alert(err.message || "Rename failed");
    }
  }

  async function deleteFolder(name) {
    const ok = window.UI?.confirm
      ? await window.UI.confirm(
          `Delete folder "${name}"? Photos inside will stay in the gallery but lose their folder.`,
          { dangerous: true, confirmLabel: "Delete folder" }
        )
      : window.confirm(`Delete folder "${name}"? Photos stay; folder is removed.`);
    if (!ok) return;
    try {
      const res = await fetch(`/api/gallery/folders/${encodeURIComponent(name)}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      if (state.activeFolder.toLowerCase() === name.toLowerCase()) {
        state.activeFolder = "";
      }
      await load();
    } catch (err) {
      alert(err.message || "Delete failed");
    }
  }

  folderBar?.addEventListener("click", (event) => {
    // ⋯ menu trigger sits inside the chip. Handle it first so the chip
    // click handler below doesn't also fire and switch the active folder.
    const menuTrigger = event.target.closest("[data-folder-menu]");
    if (menuTrigger) {
      event.stopPropagation();
      const folderName = menuTrigger.dataset.folderMenu;
      openFolderActionsMenu(folderName, menuTrigger);
      return;
    }
    const chip = event.target.closest("[data-folder]");
    if (chip) {
      state.activeFolder = chip.dataset.folder;
      refreshFolderBar();
      render();
      return;
    }
    if (event.target.closest('[data-folder-action="new"]')) {
      createFolder();
    }
  });

  // ── Folder cards in the grid: click to enter ─────────────────
  // Folder cards (rendered when no folder is active) double as drop
  // targets and as folder navigation. The drag-and-drop logic below
  // handles the drop case; this handles the plain click.
  grid.addEventListener("click", (event) => {
    const folderCard = event.target.closest(".gallery-folder-card");
    if (!folderCard) return;
    // Skip if this click is part of a drag (browsers fire click after a
    // failed drop — but `dragging` flag below is cleared on dragend).
    state.activeFolder = folderCard.dataset.folderTarget;
    refreshFolderBar();
    render();
  });

  // ── Drag-and-drop: move media into a folder ──────────────────
  // The grid (image cards) and the folder chip bar both participate.
  // Folder cards in the grid and folder chips in the chip bar are drop
  // targets; image cards are drag sources. If the dragged card is one of
  // many selected, we move all selected items in one go.
  let dragPayload = null; // Set { ids: [...] }
  function clearDragHover() {
    document.querySelectorAll(".is-drop-hover").forEach((el) => el.classList.remove("is-drop-hover"));
  }

  grid.addEventListener("dragstart", (event) => {
    const card = event.target.closest(".gallery-card");
    if (!card || card.classList.contains("gallery-folder-card")) {
      event.preventDefault();
      return;
    }
    const id = card.dataset.id;
    // If the dragged card is part of a multi-selection, drag the whole set.
    const ids = state.selected.has(id) && state.selected.size > 1
      ? Array.from(state.selected)
      : [id];
    dragPayload = { ids };
    event.dataTransfer.effectAllowed = "move";
    try { event.dataTransfer.setData("text/plain", ids.join(",")); } catch (_) {}
    document.body.classList.add("gallery-dragging");
  });
  grid.addEventListener("dragend", () => {
    dragPayload = null;
    document.body.classList.remove("gallery-dragging");
    clearDragHover();
  });

  function bindDropTarget(root, getFolderName) {
    if (!root) return;
    root.addEventListener("dragover", (event) => {
      if (!dragPayload) return;
      const target = event.target.closest("[data-folder-target], [data-folder]");
      if (!target) return;
      const name = getFolderName(target);
      if (name === null) return; // not a valid drop spot
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      // Visual hint: only highlight the current target.
      if (!target.classList.contains("is-drop-hover")) {
        clearDragHover();
        target.classList.add("is-drop-hover");
      }
    });
    root.addEventListener("dragleave", (event) => {
      const target = event.target.closest("[data-folder-target], [data-folder]");
      if (target && !target.contains(event.relatedTarget)) {
        target.classList.remove("is-drop-hover");
      }
    });
    root.addEventListener("drop", async (event) => {
      if (!dragPayload) return;
      const target = event.target.closest("[data-folder-target], [data-folder]");
      if (!target) return;
      const name = getFolderName(target);
      if (name === null) return;
      event.preventDefault();
      const ids = dragPayload.ids;
      dragPayload = null;
      clearDragHover();
      await moveItemsToFolder(ids, name);
    });
  }
  // Folder cards in the grid carry data-folder-target. The chip bar uses
  // data-folder. The "All" chip (data-folder="") is skipped because
  // dragging "to All" has no clear meaning.
  bindDropTarget(grid, (target) => target.dataset.folderTarget || null);
  bindDropTarget(folderBar, (target) => {
    const v = target.dataset.folder;
    if (v == null) return null;
    if (v === "") return null; // "All" — ignore drops here
    if (v === "__none__") return ""; // "No folder" → clear folder
    return v;
  });

  async function moveItemsToFolder(ids, folder) {
    try {
      for (const id of ids) {
        const res = await fetch(`/api/gallery/${encodeURIComponent(id)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ folder }),
        });
        if (res.ok) {
          const data = await res.json();
          const idx = state.entries.findIndex((e) => e.id === id);
          if (idx >= 0) state.entries[idx] = { ...state.entries[idx], ...data.entry };
        }
      }
      // Clear selection so the user isn't surprised by lingering selections.
      state.selected.clear();
      refreshBulkBar();
      await load();
      const target = folder ? `📁 ${folder}` : "No folder";
      window.UI?.toast?.(`Moved ${ids.length} item${ids.length === 1 ? "" : "s"} → ${target}`, "success");
    } catch (err) {
      alert(err.message || "Could not move");
    }
  }

  load();
})();
