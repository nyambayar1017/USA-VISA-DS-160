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
  const locSearchEl = document.getElementById("tpl-loc-search");
  const locCoordsFilterEl = document.getElementById("tpl-loc-coords-filter");
  const locPhotosFilterEl = document.getElementById("tpl-loc-photos-filter");
  const locSortEl = document.getElementById("tpl-loc-sort");
  const locCountEl = document.getElementById("tpl-loc-count");

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

  function filteredLocations() {
    const q = (locSearchEl?.value || "").trim().toLowerCase();
    const coordsFilter = locCoordsFilterEl?.value || "";
    const photosFilter = locPhotosFilterEl?.value || "";
    const sort = locSortEl?.value || "name-asc";
    const matchesQuery = (l) => {
      if (!q) return true;
      // Search across the primary name + every translated name.
      const haystacks = [l.name || "", ...Object.values(l.names || {})];
      return haystacks.some((s) => String(s).toLowerCase().includes(q));
    };
    const matchesCoords = (l) => {
      const has = !!(l.latlonEnabled && (l.latitude || l.longitude));
      if (coordsFilter === "with-coords") return has;
      if (coordsFilter === "no-coords") return !has;
      return true;
    };
    const matchesPhotos = (l) => {
      const has = (l.imageIds || []).length > 0;
      if (photosFilter === "with-photos") return has;
      if (photosFilter === "no-photos") return !has;
      return true;
    };
    const out = locations.filter((l) => matchesQuery(l) && matchesCoords(l) && matchesPhotos(l));
    switch (sort) {
      case "name-desc":
        out.sort((a, b) => (b.name || "").localeCompare(a.name || "", undefined, { sensitivity: "base" }));
        break;
      case "photos-desc":
        out.sort((a, b) => (b.imageIds || []).length - (a.imageIds || []).length);
        break;
      case "newest":
        out.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
        break;
      case "name-asc":
      default:
        out.sort((a, b) => (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" }));
    }
    return out;
  }

  function renderLocations() {
    const list = filteredLocations();
    if (locCountEl) {
      locCountEl.textContent = `${list.length} of ${locations.length}`;
    }
    if (!locations.length) {
      locListNode.innerHTML = `<p class="tpl-empty">No locations yet. Click <strong>+ Add location</strong> to create one (e.g. "Ulaanbaatar", "Kharkhorin").</p>`;
      return;
    }
    if (!list.length) {
      locListNode.innerHTML = `<p class="tpl-empty">No locations match these filters.</p>`;
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
          ${list.map((l, i) => `
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

  [locSearchEl, locCoordsFilterEl, locPhotosFilterEl, locSortEl].forEach((el) => {
    el?.addEventListener("input", renderLocations);
    el?.addEventListener("change", renderLocations);
  });

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
  // In-memory list of {id, alt} used by the editor. Persisted on save.
  let locImagesState = [];
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
    // Hydrate images state from new {id, alt} array, or fall back to
    // legacy imageIds[] (no alt yet).
    if (rec && Array.isArray(rec.images)) {
      locImagesState = rec.images
        .map((i) => ({ id: String(i.id || "").trim(), alt: String(i.alt || "").trim() }))
        .filter((i) => i.id);
    } else if (rec && Array.isArray(rec.imageIds)) {
      locImagesState = rec.imageIds.filter(Boolean).map((id) => ({ id, alt: "" }));
    } else {
      locImagesState = [];
    }
    locImageIdsField.value = locImagesState.map((i) => i.id).join(",");
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
    if (!locImagesState.length) {
      locImagePreview.innerHTML = `<p class="tpl-empty">No photos yet.</p>`;
      return;
    }
    locImagePreview.innerHTML = locImagesState.map((img) => `
      <div class="tpl-loc-image-item" data-id="${escapeHtml(img.id)}">
        <div class="tpl-loc-image-thumb">
          <img src="/api/gallery/${encodeURIComponent(img.id)}/file?size=thumb" alt="${escapeHtml(img.alt || "")}" loading="lazy" />
          <button type="button" class="ct-image-remove" data-action="remove-loc-image" data-id="${escapeHtml(img.id)}" aria-label="Remove">×</button>
        </div>
        <label class="tpl-loc-alt-label">
          Alt text (SEO + accessibility)
          <input type="text" class="tpl-loc-alt" data-id="${escapeHtml(img.id)}" value="${escapeHtml(img.alt || "")}" placeholder="Describe what's in the photo" />
        </label>
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
      locLeafletMap = L.map(locMapNode, {
        scrollWheelZoom: true,
        zoomControl: true,
      }).setView([lat, lon], 8);
      // Two base layers + a Google-Maps-style switcher in the top-
      // right corner. Default is the OSM road map; "Satellite" pulls
      // the imagery from Esri's free World_Imagery service.
      const street = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap contributors",
      });
      const satellite = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
          maxZoom: 19,
          attribution: "Imagery © Esri, Maxar, Earthstar Geographics",
        }
      );
      const hybrid = L.layerGroup([
        satellite,
        L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
          { maxZoom: 19, attribution: "" }
        ),
      ]);
      street.addTo(locLeafletMap);
      L.control
        .layers(
          { Map: street, Satellite: satellite, Hybrid: hybrid },
          {},
          { position: "topright", collapsed: false }
        )
        .addTo(locLeafletMap);
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
      // OSM rarely has all 9 languages — fan-out a translate pass to fill
      // anything still empty so the manager doesn't have to click twice.
      try { await translateLocNamesToAll(); } catch (_) {}
    } catch (err) {
      alert(`Lookup failed: ${err.message}`);
    }
  }
  document.getElementById("tpl-loc-autofill").addEventListener("click", autofillFromNominatim);

  // Translate the location name into every empty language slot. Source =
  // English if filled, else Mongolian, else the first non-empty value, else
  // the main "name" field. Uses the same MyMemory endpoint as gallery alt-text
  // translation — free, no key, CORS-enabled.
  async function translateLocNamesToAll() {
    const inputs = {};
    LOC_LANGS.forEach((l) => {
      const el = locLangGrid.querySelector(`[data-loc-lang="${l.code}"]`);
      if (el) inputs[l.code] = el;
    });
    let sourceLang = "en";
    let sourceText = (inputs.en?.value || "").trim();
    if (!sourceText) {
      sourceLang = "mn";
      sourceText = (inputs.mn?.value || "").trim();
    }
    if (!sourceText) {
      const found = LOC_LANGS.find((l) => (inputs[l.code]?.value || "").trim());
      if (found) {
        sourceLang = found.code;
        sourceText = inputs[found.code].value.trim();
      }
    }
    if (!sourceText) {
      sourceText = (locNameField.value || "").trim();
      sourceLang = "en";
    }
    if (!sourceText) {
      alert("Type a name in any language first, then press Translate.");
      return;
    }
    const status = document.getElementById("tpl-loc-translate-status");
    const btn = document.getElementById("tpl-loc-translate");
    btn.disabled = true;
    if (status) {
      status.hidden = false;
      status.textContent = "Translating…";
    }
    const targets = LOC_LANGS.filter((l) => l.code !== sourceLang && !(inputs[l.code]?.value || "").trim());
    let failed = 0;
    await Promise.all(targets.map(async (l) => {
      try {
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(sourceText)}&langpair=${encodeURIComponent(sourceLang)}|${encodeURIComponent(l.code)}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const text = (data?.responseData?.translatedText || "").trim();
        if (text && inputs[l.code]) inputs[l.code].value = text;
      } catch {
        failed += 1;
      }
    }));
    btn.disabled = false;
    if (status) {
      if (failed) status.textContent = `Done — ${failed} language(s) failed, edit manually.`;
      else status.textContent = `Translated from ${sourceLang.toUpperCase()} into ${targets.length} language(s).`;
    }
  }
  document.getElementById("tpl-loc-translate").addEventListener("click", translateLocNamesToAll);

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
      locImagesState = locImagesState.filter((img) => img.id !== id);
      locImageIdsField.value = locImagesState.map((i) => i.id).join(",");
      renderLocImages();
      return;
    }
  });

  // Persist alt-text edits straight into locImagesState as the user
  // types, so save() reads the latest values without a separate sync.
  locImagePreview.addEventListener("input", (event) => {
    const altInput = event.target.closest(".tpl-loc-alt");
    if (!altInput) return;
    const id = altInput.dataset.id;
    const img = locImagesState.find((i) => i.id === id);
    if (img) img.alt = altInput.value;
  });

  document.getElementById("tpl-loc-pick-images").addEventListener("click", async () => {
    if (!window.ImagePicker) return;
    const current = locImagesState.map((i) => i.id);
    const picked = await window.ImagePicker.open({
      selected: current,
      multiple: true,
      title: "Choose location photos",
    });
    if (!Array.isArray(picked)) return;
    // Preserve alt text for previously-picked images. For newly-added
    // ones, inherit the alt that was already saved on the gallery entry
    // (prefer English, fall back to Mongolian, then any non-empty value)
    // so the manager doesn't have to retype what they already wrote.
    const altByIdBefore = new Map(locImagesState.map((i) => [i.id, i.alt || ""]));
    locImagesState = picked.map((id) => {
      const prior = altByIdBefore.get(id);
      if (prior) return { id, alt: prior };
      let inherited = "";
      const entry = window.ImagePicker?.getEntry?.(id);
      const altObj = entry && entry.alt;
      if (altObj && typeof altObj === "object") {
        inherited = (altObj.en || altObj.mn || Object.values(altObj).find((v) => (v || "").trim()) || "").trim();
      } else if (typeof altObj === "string") {
        inherited = altObj.trim();
      }
      return { id, alt: inherited };
    });
    locImageIdsField.value = locImagesState.map((i) => i.id).join(",");
    renderLocImages();
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
      images: locImagesState.map((img) => ({
        id: img.id,
        alt: (img.alt || "").trim(),
      })),
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
      const msg = err?.message || "Save failed";
      // Special-case the duplicate-name error: when the user is *creating*
      // a new location whose name collides with an existing one, offer to
      // open that existing one for editing instead of just rejecting.
      if (!id && /already exists/i.test(msg)) {
        const existing = (locations || []).find(
          (l) => (l.name || "").toLowerCase() === payload.name.toLowerCase()
        );
        const goEdit = existing && (window.UI?.confirm
          ? await window.UI.confirm(
              `A location named "${payload.name}" already exists. Open that one to edit instead?`,
              { confirmLabel: "Open existing" }
            )
          : window.confirm(`"${payload.name}" already exists. Open it to edit?`));
        if (goEdit && existing) {
          openLocModal(existing);
          return;
        }
        alert(`A location named "${payload.name}" already exists. Pick a different name (e.g. add a country code) or close this dialog and click that one in the list.`);
        return;
      }
      alert(`Could not save: ${msg}`);
    }
  });

  loadLocations();

  // ─────────────────────────────────────────────────────────────────
  // Trip costing templates
  // Each template lists the expense lines we typically pay on this
  // kind of trip (camp, hotel, transfer, driver, cook, guide,
  // museums, …) with default amount + currency + trip day. The trip
  // builder will copy these lines onto a new trip; the accountant
  // ledger reuses the same categories when payments come through.
  // ─────────────────────────────────────────────────────────────────
  const tripListNode = document.getElementById("tpl-trip-list");
  const tripModal    = document.getElementById("tpl-trip-modal");
  const tripForm     = document.getElementById("tpl-trip-form");
  const tripLinesBody = document.getElementById("tpl-trip-lines-body");
  const tripAddBtn   = document.getElementById("tpl-trip-add");
  const tripAddLine  = document.getElementById("tpl-trip-add-line");
  const tripStatus   = document.getElementById("tpl-trip-status");
  let tripTemplates = [];

  async function loadTripTemplates() {
    try {
      const r = await fetch("/api/trip-templates");
      const data = await r.json();
      tripTemplates = data.entries || [];
    } catch {
      tripTemplates = [];
    }
    renderTripTemplates();
  }

  function renderTripTemplates() {
    if (!tripListNode) return;
    if (!tripTemplates.length) {
      tripListNode.innerHTML = '<p class="tpl-empty">No trip templates yet. Click <strong>+ New trip template</strong> to add one.</p>';
      return;
    }
    tripListNode.innerHTML = tripTemplates.map((t) => {
      const ws = (t.workspace || "DTX").toUpperCase();
      const days = t.days || 1;
      const lineCount = (t.expenseLines || []).length;
      const total = (t.expenseLines || []).reduce((acc, l) => {
        const cur = (l.currency || "MNT").toUpperCase();
        acc[cur] = (acc[cur] || 0) + (Number(l.amount) || 0);
        return acc;
      }, {});
      const totalsHtml = Object.entries(total)
        .map(([ccy, amt]) => `<span class="tpl-trip-total">${escapeHtml(ccy)} ${amt.toLocaleString()}</span>`)
        .join(" ");
      return `
        <article class="tpl-trip-card" data-id="${escapeHtml(t.id)}">
          <header>
            <div>
              <h3>${escapeHtml(t.name)} <span class="tpl-trip-ws">${escapeHtml(ws)}</span></h3>
              <p class="muted">${days} day${days === 1 ? "" : "s"} · ${lineCount} line${lineCount === 1 ? "" : "s"} · ${totalsHtml || "no expenses yet"}</p>
            </div>
            <div class="camp-toolbar">
              <button type="button" class="header-action-btn" data-trip-tpl-edit="${escapeHtml(t.id)}">Edit</button>
              <button type="button" class="header-action-btn button-secondary is-danger" data-trip-tpl-delete="${escapeHtml(t.id)}">Delete</button>
            </div>
          </header>
          ${t.notes ? `<p class="muted">${escapeHtml(t.notes)}</p>` : ""}
        </article>
      `;
    }).join("");
  }

  function blankLine(dayOffset = 1) {
    return { dayOffset, category: "", payeeName: "", amount: 0, currency: "MNT", note: "" };
  }

  function renderTripLines(lines) {
    tripLinesBody.innerHTML = lines.map((l, i) => `
      <tr data-line-i="${i}">
        <td><input type="number" min="0" data-line-field="dayOffset" value="${escapeHtml(l.dayOffset)}" style="width:60px;" /></td>
        <td><input type="text" data-line-field="category" value="${escapeHtml(l.category || "")}" placeholder="Camp / Hotel / Driver salary…" /></td>
        <td><input type="text" data-line-field="payeeName" value="${escapeHtml(l.payeeName || "")}" placeholder="Who gets paid" /></td>
        <td><input type="number" step="0.01" min="0" data-line-field="amount" value="${escapeHtml(l.amount || 0)}" style="width:120px;" /></td>
        <td>
          <select data-line-field="currency">
            <option value="MNT" ${l.currency === "MNT" ? "selected" : ""}>MNT</option>
            <option value="USD" ${l.currency === "USD" ? "selected" : ""}>USD</option>
            <option value="EUR" ${l.currency === "EUR" ? "selected" : ""}>EUR</option>
          </select>
        </td>
        <td><input type="text" data-line-field="note" value="${escapeHtml(l.note || "")}" placeholder="Optional note" /></td>
        <td><button type="button" class="button-secondary is-danger" data-line-remove="${i}">×</button></td>
      </tr>
    `).join("") || `<tr><td colspan="7" class="tpl-empty">No expense lines yet — click + Add line</td></tr>`;
  }

  function readTripLines() {
    return Array.from(tripLinesBody.querySelectorAll("tr[data-line-i]")).map((row) => {
      const get = (field) => row.querySelector(`[data-line-field="${field}"]`)?.value || "";
      return {
        dayOffset: Number(get("dayOffset")) || 0,
        category: get("category").trim(),
        payeeName: get("payeeName").trim(),
        amount: Number(get("amount")) || 0,
        currency: get("currency") || "MNT",
        note: get("note").trim(),
      };
    });
  }

  let editingTripId = "";

  function openTripModal(template) {
    if (!tripModal) return;
    editingTripId = template?.id || "";
    tripForm.reset();
    tripForm.elements.id.value = editingTripId;
    tripForm.elements.name.value = template?.name || "";
    tripForm.elements.workspace.value = template?.workspace || "DTX";
    tripForm.elements.days.value = template?.days || 1;
    tripForm.elements.marginPct.value = template?.marginPct || 0;
    tripForm.elements.notes.value = template?.notes || "";
    const lines = (template?.expenseLines || []).slice();
    if (!lines.length) lines.push(blankLine(1));
    renderTripLines(lines);
    tripStatus.textContent = "";
    tripModal.classList.remove("is-hidden");
    tripModal.removeAttribute("hidden");
    document.body.classList.add("modal-open");
  }

  function closeTripModal() {
    if (!tripModal) return;
    tripModal.classList.add("is-hidden");
    tripModal.setAttribute("hidden", "");
    document.body.classList.remove("modal-open");
  }

  tripAddBtn?.addEventListener("click", () => openTripModal(null));
  tripAddLine?.addEventListener("click", () => {
    const lines = readTripLines();
    lines.push(blankLine(lines.length ? Math.max(...lines.map((l) => l.dayOffset)) : 1));
    renderTripLines(lines);
  });
  tripModal?.addEventListener("click", (e) => {
    if (e.target.dataset.action === "close-trip-tpl") closeTripModal();
    const removeIdx = e.target.dataset.lineRemove;
    if (removeIdx !== undefined) {
      const lines = readTripLines();
      lines.splice(Number(removeIdx), 1);
      renderTripLines(lines.length ? lines : [blankLine(1)]);
    }
  });
  tripListNode?.addEventListener("click", async (e) => {
    const editId = e.target.dataset.tripTplEdit;
    if (editId) {
      const tpl = tripTemplates.find((t) => t.id === editId);
      if (tpl) openTripModal(tpl);
      return;
    }
    const delId = e.target.dataset.tripTplDelete;
    if (delId) {
      const tpl = tripTemplates.find((t) => t.id === delId);
      const ok = window.UI?.confirm
        ? await window.UI.confirm(`Delete template "${tpl?.name || ""}"?`, { dangerous: true })
        : window.confirm(`Delete template "${tpl?.name || ""}"?`);
      if (!ok) return;
      try {
        const r = await fetch(`/api/trip-templates/${encodeURIComponent(delId)}`, { method: "DELETE" });
        if (!r.ok) throw new Error((await r.json()).error || "Delete failed");
        loadTripTemplates();
      } catch (err) {
        alert(err.message || "Delete failed");
      }
    }
  });
  tripForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const body = {
      name: tripForm.elements.name.value.trim(),
      workspace: tripForm.elements.workspace.value || "DTX",
      days: Number(tripForm.elements.days.value) || 1,
      marginPct: Number(tripForm.elements.marginPct.value) || 0,
      notes: tripForm.elements.notes.value.trim(),
      expenseLines: readTripLines().filter((l) => l.category || l.payeeName || l.amount),
    };
    if (!body.name) { tripStatus.textContent = "Name is required."; return; }
    tripStatus.textContent = "Saving…";
    try {
      const url = editingTripId ? `/api/trip-templates/${encodeURIComponent(editingTripId)}` : "/api/trip-templates";
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Save failed");
      closeTripModal();
      loadTripTemplates();
    } catch (err) {
      tripStatus.textContent = err.message || "Save failed";
    }
  });

  loadTripTemplates();
})();
