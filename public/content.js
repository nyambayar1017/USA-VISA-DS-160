// Content library: reusable attractions / hotels / activities / etc.
// Linked from trip programs by slug. Photos are referenced by gallery
// image ID — uploads happen on the Gallery page and IDs are pasted here.

(function () {
  const list = document.getElementById("ct-list");
  const count = document.getElementById("ct-count");
  const searchInput = document.getElementById("ct-search");
  const typeFilter = document.getElementById("ct-type");
  const countryFilter = document.getElementById("ct-country");
  const publishFilter = document.getElementById("ct-publish");
  const addBtn = document.getElementById("ct-add-btn");
  const modal = document.getElementById("ct-modal");
  const form = document.getElementById("ct-form");
  const statusNode = document.getElementById("ct-status");
  const deleteBtn = document.getElementById("ct-delete-btn");
  const groupsNode = document.getElementById("ct-groups");
  const imageIdsInput = document.getElementById("ct-image-ids");
  const imagePreview = document.getElementById("ct-image-preview");
  const pickImagesBtn = document.getElementById("ct-pick-images-btn");
  const viewLink = document.getElementById("ct-view-link");

  // Keep the View link's href in sync with the slug field, but only enable
  // it once the item has been saved (otherwise /c/<slug> 404s).
  function setViewLink(slug, enabled) {
    if (!viewLink) return;
    viewLink.href = slug ? `/c/${encodeURIComponent(slug)}` : "#";
    viewLink.classList.toggle("is-disabled", !enabled || !slug);
    viewLink.setAttribute("aria-disabled", (!enabled || !slug) ? "true" : "false");
  }
  const modalTitle = document.getElementById("ct-modal-title");

  const state = { entries: [], editingId: "" };

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function setStatus(message, tone) {
    if (!statusNode) return;
    statusNode.textContent = message || "";
    statusNode.dataset.tone = tone || "";
  }

  // ── List ─────────────────────────────────────────────────────────
  function render() {
    if (!state.entries.length) {
      list.innerHTML = `<p class="empty">No content yet. Click "+ Add content" to create your first item.</p>`;
      count.textContent = "0 items";
      return;
    }
    count.textContent = `${state.entries.length} item${state.entries.length === 1 ? "" : "s"}`;
    list.innerHTML = `
      <div class="invoices-table-wrap">
        <table class="invoices-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Title</th>
              <th>Type</th>
              <th>Country</th>
              <th>Photos</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${state.entries.map((e, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td>
                  <strong>${escapeHtml(e.title)}</strong>
                  <div class="muted" style="font-size:11px;"><code>${escapeHtml(e.slug)}</code></div>
                </td>
                <td>${escapeHtml(e.type)}</td>
                <td>${escapeHtml(e.country || "-")}</td>
                <td>${(e.imageIds || []).length}</td>
                <td>
                  ${e.publishStatus === "published"
                    ? `<span class="ct-pill ct-pill-pub">Published</span>`
                    : `<span class="ct-pill ct-pill-draft">Draft</span>`}
                </td>
                <td>
                  <details class="row-menu">
                    <summary class="row-menu-trigger" aria-label="Actions">⋯</summary>
                    <div class="row-menu-popover">
                      <button type="button" class="row-menu-item" data-action="edit" data-id="${escapeHtml(e.id)}">Edit</button>
                      <button type="button" class="row-menu-item is-danger" data-action="delete" data-id="${escapeHtml(e.id)}" data-title="${escapeHtml(e.title)}">Delete</button>
                    </div>
                  </details>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  async function load() {
    list.innerHTML = `<p class="empty">Loading…</p>`;
    try {
      const params = new URLSearchParams();
      if (searchInput.value.trim()) params.set("q", searchInput.value.trim());
      if (typeFilter.value) params.set("type", typeFilter.value);
      if (countryFilter.value.trim()) params.set("country", countryFilter.value.trim());
      if (publishFilter.value) params.set("publish", publishFilter.value);
      const res = await fetch(`/api/content?${params.toString()}`);
      const data = await res.json();
      state.entries = data.entries || [];
      render();
    } catch (err) {
      list.innerHTML = `<p class="empty">${escapeHtml(err.message || "Could not load.")}</p>`;
    }
  }

  // ── Modal open/close + bullet groups + image preview ─────────────
  function openModal(rec) {
    state.editingId = rec ? rec.id : "";
    modalTitle.textContent = rec ? "Edit content" : "Add content";
    form.elements.id.value = state.editingId;
    form.elements.title.value = rec ? rec.title || "" : "";
    form.elements.slug.value = rec ? rec.slug || "" : "";
    // After load, treat the existing slug as "auto" so a follow-up
    // title edit still updates it. If the user manually retypes the
    // slug, it diverges from lastAutoSlug and stays sticky.
    lastAutoSlug = rec ? rec.slug || "" : "";
    form.elements.type.value = rec ? rec.type || "attraction" : "attraction";
    form.elements.country.value = rec ? rec.country || "" : "";
    form.elements.publishStatus.value = rec ? rec.publishStatus || "published" : "published";
    form.elements.videoUrl.value = rec ? rec.videoUrl || "" : "";
    form.elements.location.value = rec ? rec.location || "" : "";
    form.elements.summary.value = rec ? rec.summary || "" : "";
    renderGroups((rec && rec.bulletGroups) || [{ heading: "", items: [""] }]);
    setImageIds((rec && rec.imageIds) || []);
    deleteBtn.hidden = !state.editingId;
    setViewLink(rec ? rec.slug : "", !!state.editingId);
    setStatus("");
    modal.classList.remove("is-hidden");
    modal.removeAttribute("hidden");
    document.body.classList.add("modal-open");
  }

  function closeModal() {
    modal.classList.add("is-hidden");
    modal.setAttribute("hidden", "");
    document.body.classList.remove("modal-open");
    state.editingId = "";
  }

  modal.addEventListener("click", (event) => {
    if (event.target.dataset.action === "close-modal") closeModal();
  });

  // Auto-generate slug from the title — only when slug is empty or
  // still equal to the previous auto-generated value, so a manually
  // edited slug is preserved.
  function slugify(text) {
    return String(text || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 80);
  }
  let lastAutoSlug = "";
  form.elements.title.addEventListener("input", () => {
    const slugInput = form.elements.slug;
    if (!slugInput.value || slugInput.value === lastAutoSlug) {
      const next = slugify(form.elements.title.value);
      slugInput.value = next;
      lastAutoSlug = next;
    }
  });

  // Populate the country datalist from existing entries so the user
  // gets quick auto-complete instead of typing free text. Refreshed
  // each time the modal opens.
  function refreshCountryOptions() {
    const options = new Set(
      (state.entries || []).map((e) => (e.country || "").trim()).filter(Boolean)
    );
    // Add a base list of common destinations so a brand-new install
    // still has suggestions.
    [
      "Mongolia", "China", "Japan", "South Korea", "Singapore", "Malaysia",
      "Thailand", "Indonesia", "Vietnam", "Philippines", "India", "UAE",
      "Turkey", "Russia", "USA", "France", "Italy", "Spain", "Germany",
    ].forEach((c) => options.add(c));
    const datalist = document.getElementById("ct-country-options");
    if (datalist) {
      datalist.innerHTML = Array.from(options)
        .sort((a, b) => a.localeCompare(b))
        .map((c) => `<option value="${escapeHtml(c)}"></option>`)
        .join("");
    }
  }

  addBtn.addEventListener("click", () => { refreshCountryOptions(); openModal(null); });
  list.addEventListener("click", async (event) => {
    const editBtn = event.target.closest('[data-action="edit"]');
    if (editBtn) {
      const id = editBtn.dataset.id;
      try {
        const res = await fetch(`/api/content/${encodeURIComponent(id)}`);
        const rec = await res.json();
        if (!res.ok) throw new Error(rec.error || "Could not load");
        refreshCountryOptions();
        openModal(rec);
      } catch (err) {
        alert(err.message || "Could not load");
      }
      return;
    }
    const deleteBtn = event.target.closest('[data-action="delete"]');
    if (deleteBtn) {
      const id = deleteBtn.dataset.id;
      const title = deleteBtn.dataset.title || "this content";
      const ok = window.UI?.confirm
        ? await window.UI.confirm(`Delete "${title}"? This removes the popup and unlinks it from any trip programs that referenced its slug.`, { dangerous: true })
        : window.confirm(`Delete "${title}"?`);
      if (!ok) return;
      try {
        const res = await fetch(`/api/content/${encodeURIComponent(id)}`, { method: "DELETE" });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Could not delete");
        }
        await load();
      } catch (err) {
        alert(err.message || "Could not delete");
      }
    }
  });

  function renderGroups(groups) {
    groupsNode.innerHTML = (groups || [])
      .map((g, gi) => `
        <div class="ct-group" data-gi="${gi}">
          <div class="ct-group-head">
            <input type="text" class="ct-group-heading" placeholder="Heading e.g. Ерөнхий мэдээлэл" value="${escapeHtml(g.heading || "")}" />
            <button type="button" class="ct-group-delete" data-action="delete-group" data-gi="${gi}">✕</button>
          </div>
          <div class="ct-group-items" data-gi="${gi}">
            ${(g.items || []).map((item, ii) => `
              <div class="ct-item-row">
                <input type="text" class="ct-item" placeholder="Bullet text" value="${escapeHtml(item)}" />
                <button type="button" class="ct-item-delete" data-action="delete-item" data-gi="${gi}" data-ii="${ii}">✕</button>
              </div>
            `).join("")}
          </div>
          <button type="button" class="ct-add-item-btn" data-action="add-item" data-gi="${gi}">+ Add bullet</button>
        </div>
      `)
      .join("");
  }

  function readGroups() {
    return Array.from(groupsNode.querySelectorAll(".ct-group")).map((groupEl) => ({
      heading: groupEl.querySelector(".ct-group-heading")?.value || "",
      items: Array.from(groupEl.querySelectorAll(".ct-item")).map((i) => i.value).filter((s) => s.trim()),
    }));
  }

  groupsNode.addEventListener("click", (event) => {
    const target = event.target.closest("[data-action]");
    if (!target) return;
    const groups = readGroups();
    const gi = Number(target.dataset.gi);
    if (target.dataset.action === "delete-group") {
      groups.splice(gi, 1);
      renderGroups(groups);
    } else if (target.dataset.action === "add-item") {
      groups[gi].items = (groups[gi].items || []).concat([""]);
      renderGroups(groups);
    } else if (target.dataset.action === "delete-item") {
      const ii = Number(target.dataset.ii);
      groups[gi].items.splice(ii, 1);
      renderGroups(groups);
    }
  });

  form.addEventListener("click", (event) => {
    if (event.target.dataset.action === "add-group") {
      const groups = readGroups();
      groups.push({ heading: "", items: [""] });
      renderGroups(groups);
    }
  });

  function getImageIds() {
    return (imageIdsInput.value || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function setImageIds(ids) {
    const cleaned = (ids || []).filter(Boolean);
    imageIdsInput.value = cleaned.join(",");
    refreshImagePreview();
  }

  function refreshImagePreview() {
    const ids = getImageIds();
    if (!ids.length) {
      imagePreview.innerHTML = `<p class="ct-hint">No photos yet. Click "+ Add photos from gallery".</p>`;
      return;
    }
    imagePreview.innerHTML = ids
      .map((id) => `
        <div class="ct-image-thumb" title="${escapeHtml(id)}">
          <img src="/api/gallery/${encodeURIComponent(id)}/file?size=thumb" alt="" loading="lazy" />
          <button type="button" class="ct-image-remove" data-action="remove-image" data-id="${escapeHtml(id)}" aria-label="Remove">×</button>
        </div>
      `)
      .join("");
  }

  imagePreview.addEventListener("click", (event) => {
    const target = event.target.closest('[data-action="remove-image"]');
    if (!target) return;
    setImageIds(getImageIds().filter((id) => id !== target.dataset.id));
  });

  viewLink?.addEventListener("click", (event) => {
    if (viewLink.classList.contains("is-disabled")) {
      event.preventDefault();
      setStatus("Save first, then click View.", "error");
      setTimeout(() => setStatus(""), 2000);
    }
  });

  pickImagesBtn?.addEventListener("click", async () => {
    if (!window.ImagePicker) return;
    const picked = await window.ImagePicker.open({
      selected: getImageIds(),
      multiple: true,
      title: "Choose photos for this content",
    });
    if (Array.isArray(picked)) setImageIds(picked);
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus("Saving…");
    const id = state.editingId;
    const payload = {
      title: form.elements.title.value.trim(),
      slug: form.elements.slug.value.trim(),
      type: form.elements.type.value,
      country: form.elements.country.value.trim(),
      publishStatus: form.elements.publishStatus.value,
      videoUrl: form.elements.videoUrl.value.trim(),
      location: form.elements.location.value.trim(),
      summary: form.elements.summary.value,
      bulletGroups: readGroups(),
      imageIds: getImageIds(),
    };
    try {
      const url = id ? `/api/content/${encodeURIComponent(id)}` : "/api/content";
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setStatus("Saved.", "ok");
      // Activate View link with the saved slug (slug may have been auto-
      // generated from the title or de-duped server-side).
      if (data.entry && data.entry.slug) {
        state.editingId = data.entry.id || state.editingId;
        setViewLink(data.entry.slug, true);
      }
      closeModal();
      load();
    } catch (err) {
      setStatus(err.message || "Save failed.", "error");
    }
  });

  deleteBtn.addEventListener("click", async () => {
    if (!state.editingId) return;
    if (!window.confirm("Delete this content item?")) return;
    try {
      const res = await fetch(`/api/content/${encodeURIComponent(state.editingId)}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Delete failed");
      }
      closeModal();
      load();
    } catch (err) {
      setStatus(err.message || "Delete failed.", "error");
    }
  });

  [searchInput, typeFilter, countryFilter, publishFilter].forEach((node) => {
    node?.addEventListener("input", load);
    node?.addEventListener("change", load);
  });

  load();
})();
