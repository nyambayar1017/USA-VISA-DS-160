(function () {
  "use strict";

  const listNode = document.getElementById("tpl-meal-list");
  const locListNode = document.getElementById("tpl-loc-list");

  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  // Category switching ── Locations / Meals / (Days/Services/Accomm soon)
  document.querySelectorAll(".tpl-cat").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      const cat = btn.dataset.cat;
      document.querySelectorAll(".tpl-cat").forEach((b) => b.classList.toggle("is-active", b === btn));
      document.querySelectorAll(".tpl-pane").forEach((p) => {
        const match = p.dataset.pane === cat;
        p.classList.toggle("is-active", match);
        p.hidden = !match;
      });
    });
  });

  // Three meal categories the trip-creator filters on. "" (empty) is
  // for legacy templates created before category was a field; they get
  // an extra "Uncategorized" section with a category dropdown.
  const CATEGORIES = [
    { key: "breakfast", title: "Breakfast", placeholder: "e.g. Hotel" },
    { key: "lunch",     title: "Lunch",     placeholder: "e.g. Local restaurant" },
    { key: "dinner",    title: "Dinner",    placeholder: "e.g. Hotel" },
  ];

  let templates = [];

  async function load() {
    listNode.innerHTML = `<p class="tpl-empty">Loading…</p>`;
    try {
      const res = await fetch("/api/meal-templates");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      templates = data.entries || [];
      render();
    } catch (err) {
      listNode.innerHTML = `<p class="tpl-empty">Could not load templates: ${escapeHtml(err.message)}</p>`;
    }
  }

  function rowHtml(t, opts) {
    const showCategoryPicker = !!(opts && opts.showCategoryPicker);
    const catOptions = ["breakfast", "lunch", "dinner"]
      .map((c) => `<option value="${c}"${c === t.category ? " selected" : ""}>${c[0].toUpperCase() + c.slice(1)}</option>`)
      .join("");
    return `
      <div class="tpl-meal-row" data-id="${escapeHtml(t.id)}" data-category="${escapeHtml(t.category || "")}">
        <input type="text" class="tpl-meal-name" value="${escapeHtml(t.name || "")}" />
        ${showCategoryPicker ? `<select class="tpl-meal-cat">
          <option value="">— Pick category —</option>
          ${catOptions}
        </select>` : ""}
        <button type="button" class="tpl-meal-save" data-action="save">Save</button>
        <button type="button" class="tpl-meal-delete" data-action="delete" aria-label="Delete">×</button>
      </div>
    `;
  }

  function sectionHtml(cat) {
    const items = templates.filter((t) => (t.category || "") === cat.key);
    const rows = items.length
      ? items.map((t) => rowHtml(t, { showCategoryPicker: false })).join("")
      : `<p class="tpl-section-empty">No ${cat.title.toLowerCase()} templates yet.</p>`;
    return `
      <div class="tpl-section" data-section="${cat.key}">
        <div class="tpl-section-head">
          <h3>${cat.title}</h3>
          <button type="button" class="tpl-section-add" data-action="add" data-cat="${cat.key}">+ Add ${cat.title.toLowerCase()}</button>
        </div>
        <div class="tpl-section-rows">${rows}</div>
      </div>
    `;
  }

  function uncategorizedSection() {
    const items = templates.filter((t) => !t.category);
    if (!items.length) return "";
    return `
      <div class="tpl-section tpl-section--legacy">
        <div class="tpl-section-head">
          <h3>Uncategorized</h3>
          <span class="tpl-section-hint">Pick a category and click Save.</span>
        </div>
        <div class="tpl-section-rows">
          ${items.map((t) => rowHtml(t, { showCategoryPicker: true })).join("")}
        </div>
      </div>
    `;
  }

  function render() {
    listNode.innerHTML = `
      ${uncategorizedSection()}
      ${CATEGORIES.map(sectionHtml).join("")}
    `;
  }

  async function createTemplate(category) {
    const ui = window.UI;
    const cat = CATEGORIES.find((c) => c.key === category);
    if (!cat) return;
    const raw = ui && ui.prompt
      ? await ui.prompt(`Reusable venue string the trip-creator suggests on ${cat.title} inputs.`, {
          title: `New ${cat.title.toLowerCase()} template`,
          confirmLabel: "Add",
          defaultValue: "",
        })
      : window.prompt(`${cat.title} template name`);
    const name = (raw || "").trim();
    if (!name) return;
    try {
      const res = await fetch("/api/meal-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, category }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      await load();
    } catch (err) {
      alert(`Could not create: ${err.message}`);
    }
  }

  async function saveTemplate(id, name, category) {
    try {
      const body = { name };
      if (category !== undefined) body.category = category;
      const res = await fetch(`/api/meal-templates/${encodeURIComponent(id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      await load();
    } catch (err) {
      alert(`Could not save: ${err.message}`);
    }
  }

  async function deleteTemplate(id, name) {
    const ui = window.UI;
    const ok = ui && ui.confirm
      ? await ui.confirm(`Delete meal template "${name}"?`, {
          title: "Delete template",
          confirmLabel: "Delete",
          cancelLabel: "Cancel",
        })
      : window.confirm(`Delete meal template "${name}"?`);
    if (!ok) return;
    try {
      const res = await fetch(`/api/meal-templates/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      await load();
    } catch (err) {
      alert(`Could not delete: ${err.message}`);
    }
  }

  listNode.addEventListener("click", (event) => {
    const addBtn = event.target.closest('[data-action="add"]');
    if (addBtn) {
      createTemplate(addBtn.dataset.cat);
      return;
    }
    const row = event.target.closest(".tpl-meal-row");
    if (!row) return;
    const id = row.dataset.id;
    const nameInput = row.querySelector(".tpl-meal-name");
    const catSelect = row.querySelector(".tpl-meal-cat");
    if (event.target.closest('[data-action="save"]')) {
      const value = (nameInput.value || "").trim();
      if (!value) return;
      const category = catSelect ? (catSelect.value || "") : undefined;
      saveTemplate(id, value, category);
      return;
    }
    if (event.target.closest('[data-action="delete"]')) {
      deleteTemplate(id, nameInput.value || id);
      return;
    }
  });

  load();

  // ──────────────────────────────────────────────────────────────────
  // Locations
  // ──────────────────────────────────────────────────────────────────
  const LOC_LANGS = [
    { code: "mn", label: "Mongolian (Монгол)" },
    { code: "en", label: "English" },
    { code: "fr", label: "French (Français)" },
    { code: "it", label: "Italian (Italiano)" },
    { code: "es", label: "Spanish (Español)" },
    { code: "ko", label: "Korean (한국어)" },
    { code: "zh", label: "Chinese (中文)" },
    { code: "ja", label: "Japanese (日本語)" },
    { code: "ru", label: "Russian (Русский)" },
  ];

  let locations = [];

  async function loadLocations() {
    locListNode.innerHTML = `<p class="tpl-empty">Loading…</p>`;
    try {
      const res = await fetch("/api/locations");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      locations = data.entries || [];
      renderLocations();
    } catch (err) {
      locListNode.innerHTML = `<p class="tpl-empty">Could not load locations: ${escapeHtml(err.message)}</p>`;
    }
  }

  function renderLocations() {
    if (!locations.length) {
      locListNode.innerHTML = `<p class="tpl-empty">No locations yet. Click <strong>+ Add location</strong> to create one (e.g. "Ulaanbaatar", "Kharkhorin").</p>`;
      return;
    }
    locListNode.innerHTML = `
      <table class="tpl-loc-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Name</th>
            <th>Lat / Lon</th>
            <th>Photos</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${locations.map((l, i) => `
            <tr data-id="${escapeHtml(l.id)}">
              <td>${i + 1}</td>
              <td><strong>${escapeHtml(l.name || "—")}</strong></td>
              <td>${l.latlonEnabled && (l.latitude || l.longitude)
                ? `${escapeHtml(l.latitude || "?")}, ${escapeHtml(l.longitude || "?")}`
                : "—"}</td>
              <td>${(l.imageIds || []).length}</td>
              <td class="tpl-loc-row-actions">
                <button type="button" class="header-action-btn" data-action="edit-loc">Edit</button>
                <button type="button" class="header-action-btn" data-action="delete-loc">Delete</button>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  }

  // ── Edit modal state ─────────────────────────────────────────────
  const locModal = document.getElementById("tpl-loc-modal");
  const locForm = document.getElementById("tpl-loc-form");
  const locIdField = document.getElementById("tpl-loc-id");
  const locNameField = document.getElementById("tpl-loc-name");
  const locCommentField = document.getElementById("tpl-loc-comment");
  const locLatlonEnabledField = document.getElementById("tpl-loc-latlon-enabled");
  const locLatField = document.getElementById("tpl-loc-lat");
  const locLonField = document.getElementById("tpl-loc-lon");
  const locLangGrid = document.getElementById("tpl-loc-lang-grid");
  const locImageIdsField = document.getElementById("tpl-loc-image-ids");
  const locImagePreview = document.getElementById("tpl-loc-image-preview");
  const locMapNode = document.getElementById("tpl-loc-map");
  let locLeafletMap = null;
  let locLeafletMarker = null;

  function openLocModal(rec) {
    locIdField.value = rec ? (rec.id || "") : "";
    locNameField.value = rec ? (rec.name || "") : "";
    locCommentField.value = rec ? (rec.comment || "") : "";
    locLatlonEnabledField.checked = rec ? !!rec.latlonEnabled : false;
    locLatField.value = rec ? (rec.latitude || "") : "";
    locLonField.value = rec ? (rec.longitude || "") : "";
    locImageIdsField.value = rec && Array.isArray(rec.imageIds) ? rec.imageIds.join(",") : "";
    // Language inputs.
    const names = (rec && rec.names) || {};
    locLangGrid.innerHTML = LOC_LANGS.map((l) => `
      <label class="tpl-loc-field">
        ${l.label}
        <input type="text" data-loc-lang="${l.code}" value="${escapeHtml(names[l.code] || "")}" />
      </label>
    `).join("");
    // Image preview.
    renderLocImages();
    // Switch to Latlon tab.
    document.querySelectorAll(".tpl-loc-tab").forEach((t) => t.classList.toggle("is-active", t.dataset.locTab === "latlon"));
    document.querySelectorAll(".tpl-loc-pane").forEach((p) => {
      const match = p.dataset.locPane === "latlon";
      p.classList.toggle("is-active", match);
      p.hidden = !match;
    });
    locModal.classList.remove("is-hidden");
    locModal.hidden = false;
    // Map needs the modal to be visible before it can measure itself.
    setTimeout(() => {
      locNameField.focus();
      refreshLocMapPreview();
    }, 80);
  }

  function closeLocModal() {
    locModal.classList.add("is-hidden");
    locModal.hidden = true;
  }

  function renderLocImages() {
    const ids = (locImageIdsField.value || "").split(",").map((s) => s.trim()).filter(Boolean);
    if (!ids.length) {
      locImagePreview.innerHTML = `<p class="tpl-empty">No photos yet.</p>`;
      return;
    }
    locImagePreview.innerHTML = ids.map((id) => `
      <div class="ct-image-thumb" data-id="${escapeHtml(id)}">
        <img src="/api/gallery/${encodeURIComponent(id)}/file?size=thumb" alt="" loading="lazy" />
        <button type="button" class="ct-image-remove" data-action="remove-loc-image" data-id="${escapeHtml(id)}" aria-label="Remove">×</button>
      </div>
    `).join("");
  }

  function refreshLocMapPreview() {
    const lat = parseFloat(locLatField.value);
    const lon = parseFloat(locLonField.value);
    const enabled = locLatlonEnabledField.checked && Number.isFinite(lat) && Number.isFinite(lon);
    if (!enabled) {
      locMapNode.hidden = true;
      return;
    }
    locMapNode.hidden = false;
    if (!window.L) return;
    if (!locLeafletMap) {
      locLeafletMap = L.map(locMapNode, { scrollWheelZoom: false }).setView([lat, lon], 8);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap contributors",
      }).addTo(locLeafletMap);
      locLeafletMarker = L.marker([lat, lon], { draggable: true }).addTo(locLeafletMap);
      locLeafletMarker.on("dragend", () => {
        const ll = locLeafletMarker.getLatLng();
        locLatField.value = ll.lat.toFixed(6);
        locLonField.value = ll.lng.toFixed(6);
      });
    } else {
      locLeafletMap.setView([lat, lon], locLeafletMap.getZoom());
      if (locLeafletMarker) locLeafletMarker.setLatLng([lat, lon]);
      // Leaflet needs invalidateSize after the map node toggles visible.
      setTimeout(() => locLeafletMap.invalidateSize(), 0);
    }
  }

  // OpenStreetMap (Nominatim) place lookup. Fills lat/lon plus
  // translated names returned in the namedetails block. Free, no key.
  async function autofillFromNominatim() {
    const query = (locNameField.value || "").trim();
    if (!query) {
      alert("Type a name first.");
      return;
    }
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&namedetails=1&limit=1`;
    try {
      const res = await fetch(url, { headers: { "Accept": "application/json" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data) || !data.length) {
        alert(`No place found for "${query}". Try a different name.`);
        return;
      }
      const r = data[0];
      // Lat/lon → enable + fill + remap.
      locLatField.value = parseFloat(r.lat).toFixed(6);
      locLonField.value = parseFloat(r.lon).toFixed(6);
      locLatlonEnabledField.checked = true;
      refreshLocMapPreview();
      // Multilingual names from namedetails: { "name:en": "...", … }.
      const nd = r.namedetails || {};
      LOC_LANGS.forEach((l) => {
        const key = `name:${l.code}`;
        const input = locLangGrid.querySelector(`[data-loc-lang="${l.code}"]`);
        if (!input) return;
        const value = (nd[key] || "").trim();
        if (value && !input.value.trim()) input.value = value;
      });
      // English fallback if name:en missing.
      const enInput = locLangGrid.querySelector('[data-loc-lang="en"]');
      if (enInput && !enInput.value.trim() && r.display_name) {
        enInput.value = r.display_name.split(",")[0].trim();
      }
    } catch (err) {
      alert(`Lookup failed: ${err.message}`);
    }
  }
  document.getElementById("tpl-loc-autofill").addEventListener("click", autofillFromNominatim);

  document.getElementById("tpl-loc-add").addEventListener("click", () => openLocModal(null));

  locListNode.addEventListener("click", (event) => {
    const row = event.target.closest("tr[data-id]");
    if (!row) return;
    const id = row.dataset.id;
    const rec = locations.find((l) => l.id === id);
    if (event.target.closest('[data-action="edit-loc"]')) {
      openLocModal(rec);
      return;
    }
    if (event.target.closest('[data-action="delete-loc"]')) {
      const ui = window.UI;
      const ok = ui && ui.confirm
        ? ui.confirm(`Delete location "${rec ? rec.name : id}"?`, { title: "Delete location", confirmLabel: "Delete" })
        : Promise.resolve(window.confirm(`Delete location "${rec ? rec.name : id}"?`));
      Promise.resolve(ok).then(async (yes) => {
        if (!yes) return;
        try {
          const res = await fetch(`/api/locations/${encodeURIComponent(id)}`, { method: "DELETE" });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || `HTTP ${res.status}`);
          }
          await loadLocations();
        } catch (err) {
          alert(`Could not delete: ${err.message}`);
        }
      });
      return;
    }
  });

  // Modal close + tab switching
  locModal.addEventListener("click", (event) => {
    if (event.target.closest('[data-action="close-loc"]')) {
      closeLocModal();
      return;
    }
    const tab = event.target.closest(".tpl-loc-tab");
    if (tab) {
      const target = tab.dataset.locTab;
      document.querySelectorAll(".tpl-loc-tab").forEach((t) => t.classList.toggle("is-active", t === tab));
      document.querySelectorAll(".tpl-loc-pane").forEach((p) => {
        const match = p.dataset.locPane === target;
        p.classList.toggle("is-active", match);
        p.hidden = !match;
      });
      if (target === "latlon" && locLeafletMap) {
        setTimeout(() => locLeafletMap.invalidateSize(), 0);
      }
      return;
    }
    const removeImg = event.target.closest('[data-action="remove-loc-image"]');
    if (removeImg) {
      const id = removeImg.dataset.id;
      const ids = (locImageIdsField.value || "").split(",").map((s) => s.trim()).filter(Boolean);
      locImageIdsField.value = ids.filter((x) => x !== id).join(",");
      renderLocImages();
      return;
    }
  });

  document.getElementById("tpl-loc-pick-images").addEventListener("click", async () => {
    if (!window.ImagePicker) return;
    const current = (locImageIdsField.value || "").split(",").map((s) => s.trim()).filter(Boolean);
    const picked = await window.ImagePicker.open({
      selected: current,
      multiple: true,
      title: "Choose location photos",
    });
    if (Array.isArray(picked)) {
      locImageIdsField.value = picked.join(",");
      renderLocImages();
    }
  });

  [locLatField, locLonField, locLatlonEnabledField].forEach((el) => {
    el.addEventListener("input", refreshLocMapPreview);
    el.addEventListener("change", refreshLocMapPreview);
  });

  locForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const id = locIdField.value;
    const names = {};
    locLangGrid.querySelectorAll("[data-loc-lang]").forEach((input) => {
      names[input.dataset.locLang] = (input.value || "").trim();
    });
    const payload = {
      name: (locNameField.value || "").trim(),
      comment: (locCommentField.value || "").trim(),
      latlonEnabled: locLatlonEnabledField.checked,
      latitude: (locLatField.value || "").trim(),
      longitude: (locLonField.value || "").trim(),
      names,
      imageIds: (locImageIdsField.value || "").split(",").map((s) => s.trim()).filter(Boolean),
    };
    if (!payload.name) {
      alert("Name is required");
      return;
    }
    try {
      const url = id ? `/api/locations/${encodeURIComponent(id)}` : "/api/locations";
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      closeLocModal();
      await loadLocations();
    } catch (err) {
      alert(`Could not save: ${err.message}`);
    }
  });

  loadLocations();
})();
