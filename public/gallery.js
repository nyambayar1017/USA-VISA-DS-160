// Gallery: shared media library. Images are compressed client-side via
// CompressUpload before upload (saves Render disk + bandwidth). Videos
// store just the URL — provider hosting handles delivery.

(function () {
  const grid = document.getElementById("gal-grid");
  const count = document.getElementById("gal-count");
  const searchInput = document.getElementById("gal-search");
  const kindSelect = document.getElementById("gal-kind");
  const folderSelect = document.getElementById("gal-folder");
  const tagInput = document.getElementById("gal-tag");
  const fileInput = document.getElementById("gal-file");
  const uploadLabel = document.getElementById("gal-upload-btn");
  const videoModal = document.getElementById("gal-video-modal");
  const videoForm = document.getElementById("gal-video-form");
  const videoStatus = document.getElementById("gal-video-status");
  const addVideoBtn = document.getElementById("gal-add-video-btn");
  const bulkBar = document.getElementById("gal-bulk-bar");
  const bulkCount = document.getElementById("gal-bulk-count");
  const bulkFolderInput = document.getElementById("gal-bulk-folder");
  const bulkMoveBtn = document.getElementById("gal-bulk-move");
  const bulkClearBtn = document.getElementById("gal-bulk-clear");

  const state = { entries: [], folders: [], selected: new Set() };

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
    if (!bulkBar) return;
    if (!state.selected.size) {
      bulkBar.hidden = true;
      return;
    }
    bulkBar.hidden = false;
    bulkCount.textContent = `${state.selected.size} selected`;
  }

  function refreshFolderOptions() {
    if (!folderSelect) return;
    const prev = folderSelect.value;
    const optsHtml = state.folders
      .map((f) => `<option value="${escapeHtml(f)}">${escapeHtml(f)}</option>`)
      .join("");
    folderSelect.innerHTML = `
      <option value="">All folders</option>
      <option value="__none__">No folder</option>
      ${optsHtml}
    `;
    if ([...folderSelect.options].some((o) => o.value === prev)) folderSelect.value = prev;
  }

  function render() {
    const q = (searchInput.value || "").trim().toLowerCase();
    const tag = (tagInput.value || "").trim().toLowerCase();
    const kind = kindSelect.value;
    const folderFilter = folderSelect ? folderSelect.value : "";
    const filtered = state.entries.filter((e) => {
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
    count.textContent = `${filtered.length} item${filtered.length === 1 ? "" : "s"}`;
    if (!filtered.length) {
      grid.innerHTML = `<p class="empty">No media match these filters.</p>`;
      return;
    }
    grid.innerHTML = filtered
      .map((e) => {
        const tags = (e.tags || [])
          .map((t) => `<span class="gallery-chip">${escapeHtml(t)}</span>`)
          .join(" ");
        const preview = e.kind === "image"
          ? `<img src="${escapeHtml(e.url)}" alt="${escapeHtml(e.originalName)}" loading="lazy" />`
          : `<div class="gallery-video-placeholder">▶ Video</div>`;
        const meta = e.kind === "image"
          ? fmtSize(e.size)
          : `<a href="${escapeHtml(e.url)}" target="_blank" rel="noopener">Open ↗</a>`;
        const isSelected = state.selected.has(e.id);
        const folderBadge = e.folder
          ? `<span class="gallery-folder-badge">📁 ${escapeHtml(e.folder)}</span>`
          : "";
        return `
          <article class="gallery-card${isSelected ? " is-selected" : ""}" data-id="${escapeHtml(e.id)}">
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
      state.folders = data.folders || [];
      refreshFolderOptions();
      render();
    } catch (err) {
      grid.innerHTML = `<p class="empty">${escapeHtml(err.message || "Could not load.")}</p>`;
    }
  }

  // ── Image upload (client-compressed) ──────────────────────────
  async function uploadImage(file) {
    const compressed = (window.CompressUpload && window.CompressUpload.compressToFile)
      ? await window.CompressUpload.compressToFile(file)
      : file;
    const formData = new FormData();
    formData.append("file", compressed, compressed.name || "image.jpg");
    const res = await fetch("/api/gallery", { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Upload failed");
    return data.entry;
  }

  fileInput.addEventListener("change", async () => {
    const files = Array.from(fileInput.files || []);
    if (!files.length) return;
    uploadLabel.classList.add("is-disabled");
    const originalText = uploadLabel.firstChild;
    let succeeded = 0;
    for (const file of files) {
      try {
        const entry = await uploadImage(file);
        state.entries.unshift(entry);
        succeeded++;
        render();
      } catch (err) {
        // Continue uploading remaining files but flag the failure.
        alert(`${file.name}: ${err.message}`);
      }
    }
    uploadLabel.classList.remove("is-disabled");
    fileInput.value = "";
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

  // ── Card actions: select, copy id, delete ───────────────────
  grid.addEventListener("change", (event) => {
    const cb = event.target.closest('[data-action="toggle-select"]');
    if (!cb) return;
    const id = cb.dataset.id;
    if (cb.checked) state.selected.add(id);
    else state.selected.delete(id);
    refreshBulkBar();
    cb.closest(".gallery-card")?.classList.toggle("is-selected", cb.checked);
  });

  grid.addEventListener("click", async (event) => {
    const target = event.target.closest("[data-action]");
    if (!target) return;
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
    if (target.dataset.action === "delete") {
      if (!window.confirm("Delete this media item?")) return;
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
      // Re-derive folders from current entries since we just renamed some.
      state.folders = Array.from(new Set(state.entries.map((e) => (e.folder || "").trim()).filter(Boolean))).sort();
      refreshFolderOptions();
      refreshBulkBar();
      render();
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

  [searchInput, kindSelect, folderSelect, tagInput].forEach((node) => {
    node?.addEventListener("input", render);
    node?.addEventListener("change", render);
  });

  load();
})();
