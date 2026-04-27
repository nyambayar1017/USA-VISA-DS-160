(function () {
  const tbody = document.getElementById("doc-tbody");
  const countNode = document.getElementById("doc-count");
  const filterName = document.getElementById("doc-filter-name");
  const filterTourist = document.getElementById("doc-filter-tourist");
  const filterDestination = document.getElementById("doc-filter-destination");
  const filterTrip = document.getElementById("doc-filter-trip");
  const filterCategory = document.getElementById("doc-filter-category");
  const filterExt = document.getElementById("doc-filter-ext");
  const filterFrom = document.getElementById("doc-filter-from");
  const filterTo = document.getElementById("doc-filter-to");
  const resetBtn = document.getElementById("doc-reset");
  const clearFilterBtn = document.getElementById("doc-clear-filter-btn");
  if (!tbody) return;

  let docs = [];

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function fmtSize(bytes) {
    const n = Number(bytes || 0);
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
    return (n / (1024 * 1024)).toFixed(1) + " MB";
  }

  function fileExt(name) {
    const m = String(name || "").match(/\.([a-z0-9]+)$/i);
    return m ? m[1].toLowerCase() : "";
  }

  async function load() {
    try {
      const res = await fetch("/api/documents");
      if (!res.ok) throw new Error("Could not load documents");
      const data = await res.json();
      docs = data.entries || [];
      buildOptionLists();
      render();
    } catch (err) {
      tbody.innerHTML = '<tr><td colspan="9" class="empty">' + escapeHtml(err.message) + "</td></tr>";
    }
  }

  function buildOptionLists() {
    // Trip dropdown — unique trips with serial · name.
    const trips = new Map();
    const cats = new Set();
    const exts = new Set();
    docs.forEach((d) => {
      if (d.tripId) trips.set(d.tripId, (d.tripSerial || "") + " · " + (d.tripName || ""));
      if (d.category) cats.add(d.category);
      const ext = fileExt(d.originalName);
      if (ext) exts.add(ext);
    });
    const tripCurrent = filterTrip.value;
    filterTrip.innerHTML = '<option value="">All trips</option>' +
      [...trips.entries()].sort((a, b) => a[1].localeCompare(b[1]))
        .map(([id, label]) => '<option value="' + escapeHtml(id) + '">' + escapeHtml(label) + "</option>")
        .join("");
    filterTrip.value = tripCurrent;

    const catCurrent = filterCategory.value;
    filterCategory.innerHTML = '<option value="">All categories</option>' +
      [...cats].sort().map((c) => '<option value="' + escapeHtml(c) + '">' + escapeHtml(c) + "</option>").join("");
    filterCategory.value = catCurrent;

    const extCurrent = filterExt.value;
    filterExt.innerHTML = '<option value="">All file types</option>' +
      [...exts].sort().map((e) => '<option value="' + escapeHtml(e) + '">.' + escapeHtml(e) + "</option>").join("");
    filterExt.value = extCurrent;
  }

  function getFiltered() {
    const name = (filterName.value || "").trim().toLowerCase();
    const tourist = (filterTourist.value || "").trim().toLowerCase();
    const trip = filterTrip.value;
    const cat = filterCategory.value;
    const ext = filterExt.value;
    const from = (filterFrom.value || "").trim();
    const to = (filterTo.value || "").trim();
    const destination = (filterDestination?.value || "").trim().toLowerCase();
    return docs.filter((d) => {
      if (name && !((d.originalName || "").toLowerCase().includes(name))) return false;
      if (tourist) {
        const hay = ((d.touristLastName || "") + " " + (d.touristFirstName || "") + " " + (d.touristName || "")).toLowerCase();
        if (!hay.includes(tourist)) return false;
      }
      if (destination) {
        const dests = Array.isArray(d.destinations) ? d.destinations : [];
        if (!dests.some((x) => String(x || "").toLowerCase().includes(destination))) return false;
      }
      if (trip && d.tripId !== trip) return false;
      if (cat && d.category !== cat) return false;
      if (ext && fileExt(d.originalName) !== ext) return false;
      if (from || to) {
        const date = (d.uploadedAt || "").slice(0, 10);
        if (!date) return false;
        if (from && date < from) return false;
        if (to && date > to) return false;
      }
      return true;
    });
  }

  function render() {
    const rows = getFiltered();
    countNode.textContent = rows.length + " document" + (rows.length === 1 ? "" : "s");
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="12" class="empty">No documents match the current filters.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map((d, idx) => {
      const dateTime = (d.uploadedAt || "").slice(0, 16).replace("T", " ");
      const ext = fileExt(d.originalName);
      const rawUrl = "/trip-uploads/" + encodeURIComponent(d.tripId) + "/" + encodeURIComponent(d.storedName);
      const downloadUrl = rawUrl + "?download=1";
      const isPdf = (d.mimeType || "").includes("pdf") || (d.storedName || "").toLowerCase().endsWith(".pdf");
      const viewUrl = isPdf
        ? "/pdf-viewer?src=" + encodeURIComponent(rawUrl) + "&title=" + encodeURIComponent(d.originalName || "")
        : rawUrl;
      const tripUrl = "/trip-detail?tripId=" + encodeURIComponent(d.tripId);
      const uploadedBy = d.uploadedBy?.name || d.uploadedBy?.email || "-";
      const dests = Array.isArray(d.destinations) ? d.destinations : [];
      const destChips = dests.length
        ? dests.map((x) => '<span class="tourist-tag-chip">' + escapeHtml(x) + '</span>').join(" ")
        : '<span class="tourist-tag-empty">—</span>';
      const lastName = d.touristLastName || (d.touristName ? d.touristName.split(" ")[0] : "") || "";
      const firstName = d.touristFirstName || (d.touristName ? d.touristName.split(" ").slice(1).join(" ") : "") || "";
      return "<tr>" +
        "<td>" + (idx + 1) + "</td>" +
        '<td><a class="doc-file-link" href="' + escapeHtml(viewUrl) + '" target="_blank" rel="noreferrer">' + escapeHtml(d.originalName || "-") + "</a></td>" +
        "<td>" + escapeHtml(lastName || "-") + "</td>" +
        "<td>" + escapeHtml(firstName || "-") + "</td>" +
        '<td><a class="trip-name-link" href="' + escapeHtml(tripUrl) + '">' + escapeHtml((d.tripSerial || "") + " · " + (d.tripName || "")) + "</a></td>" +
        "<td>" + destChips + "</td>" +
        "<td>" + escapeHtml(d.category || "-") + "</td>" +
        "<td>" + (ext ? "." + escapeHtml(ext) : "-") + "</td>" +
        "<td>" + escapeHtml(fmtSize(d.size)) + "</td>" +
        "<td>" + escapeHtml(dateTime || "-") + "</td>" +
        "<td>" + escapeHtml(uploadedBy) + "</td>" +
        '<td><a class="doc-download-pill" href="' + escapeHtml(downloadUrl) + '" download>Download</a></td>' +
        "</tr>";
    }).join("");
  }

  function updateDateCount() {
    const pill = document.getElementById("doc-daterange-pill");
    const badge = document.getElementById("doc-daterange-count");
    if (!pill || !badge) return;
    const n = (filterFrom.value ? 1 : 0) + (filterTo.value ? 1 : 0);
    if (n > 0) { badge.textContent = String(n); badge.removeAttribute("hidden"); pill.classList.add("has-active"); }
    else { badge.setAttribute("hidden", ""); pill.classList.remove("has-active"); }
  }

  [filterName, filterTourist, filterDestination].filter(Boolean).forEach((el) => el.addEventListener("input", render));
  [filterTrip, filterCategory, filterExt].forEach((el) => el.addEventListener("change", render));
  [filterFrom, filterTo].forEach((el) => el.addEventListener("change", () => { updateDateCount(); render(); }));
  resetBtn.addEventListener("click", () => {
    filterName.value = "";
    filterTourist.value = "";
    if (filterDestination) filterDestination.value = "";
    filterTrip.value = "";
    filterCategory.value = "";
    filterExt.value = "";
    filterFrom.value = "";
    filterTo.value = "";
    updateDateCount();
    render();
  });

  document.addEventListener("click", (e) => {
    document.querySelectorAll("details[open]").forEach((d) => {
      if (!d.contains(e.target)) d.removeAttribute("open");
    });
  });

  // ── Saved filters ────────────────────────────────────────────────────
  const SAVED_FILTERS_KEY = "documents:savedFilters";
  let activeSavedFilterName = "";

  function readSavedFilters() {
    try {
      const raw = localStorage.getItem(SAVED_FILTERS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }
  function writeSavedFilters(list) {
    try { localStorage.setItem(SAVED_FILTERS_KEY, JSON.stringify(list)); } catch {}
  }
  function snapshotFilterState() {
    return {
      name: filterName.value, tourist: filterTourist.value,
      trip: filterTrip.value,
      category: filterCategory.value, ext: filterExt.value,
      from: filterFrom.value, to: filterTo.value,
    };
  }
  function applyFilterStateFromSnapshot(s) {
    filterName.value = s?.name || "";
    filterTourist.value = s?.tourist || "";
    filterTrip.value = s?.trip || "";
    filterCategory.value = s?.category || "";
    filterExt.value = s?.ext || "";
    filterFrom.value = s?.from || "";
    filterTo.value = s?.to || "";
    updateDateCount();
    render();
  }
  function refreshSavedFiltersDropdown(selectName) {
    const dropdown = document.querySelector("[data-saved-filter-dropdown]");
    const popover = document.querySelector("[data-saved-filter-popover]");
    const label = document.querySelector("[data-saved-filter-current]");
    if (!dropdown || !popover || !label) return;
    const list = readSavedFilters();
    const next = selectName !== undefined ? selectName : activeSavedFilterName;
    if (next && list.some((f) => f.name === next)) {
      activeSavedFilterName = next; label.textContent = next; dropdown.classList.add("has-active");
    } else {
      activeSavedFilterName = ""; label.textContent = "Select saved filter"; dropdown.classList.remove("has-active");
    }
    const items = list.length
      ? list.map((f) => `
          <div class="trip-saved-filter-item ${f.name === activeSavedFilterName ? "is-active" : ""}">
            <button type="button" class="trip-saved-filter-name" data-saved-action="apply" data-name="${escapeHtml(f.name)}">${escapeHtml(f.name)}</button>
            <button type="button" class="trip-saved-filter-remove" data-saved-action="delete" data-name="${escapeHtml(f.name)}" aria-label="Delete ${escapeHtml(f.name)}">×</button>
          </div>
        `).join("")
      : '<p class="trip-saved-filter-empty">No saved filters yet.</p>';
    const updateBtn = activeSavedFilterName
      ? `<button type="button" class="trip-saved-filter-save trip-saved-filter-update" data-saved-action="update" data-name="${escapeHtml(activeSavedFilterName)}">↻ Update "${escapeHtml(activeSavedFilterName)}"</button>`
      : "";
    popover.innerHTML = `${items}<div class="trip-saved-filter-divider"></div>${updateBtn}<button type="button" class="trip-saved-filter-save" data-saved-action="save">+ Save current as…</button>`;
  }
  const savedDropdown = document.querySelector("[data-saved-filter-dropdown]");
  savedDropdown?.addEventListener("click", async (event) => {
    const target = event.target.closest("[data-saved-action]");
    if (!target) return;
    event.preventDefault();
    const action = target.dataset.savedAction;
    const name = target.dataset.name || "";
    if (action === "apply") {
      const found = readSavedFilters().find((f) => f.name === name);
      if (!found) return;
      savedDropdown.removeAttribute("open");
      refreshSavedFiltersDropdown(name);
      applyFilterStateFromSnapshot(found.state);
    } else if (action === "delete") {
      if (!(await UI.confirm(`Delete saved filter "${name}"?`, { dangerous: true }))) return;
      writeSavedFilters(readSavedFilters().filter((f) => f.name !== name));
      refreshSavedFiltersDropdown(activeSavedFilterName === name ? "" : activeSavedFilterName);
    } else if (action === "save") {
      savedDropdown.removeAttribute("open");
      const newName = ((await UI.prompt("Save filter as:")) || "").trim();
      if (!newName) return;
      const list = readSavedFilters().filter((f) => f.name !== newName);
      list.push({ name: newName, state: snapshotFilterState() });
      writeSavedFilters(list);
      refreshSavedFiltersDropdown(newName);
    } else if (action === "update") {
      savedDropdown.removeAttribute("open");
      const list = readSavedFilters().map((f) => f.name === name ? { name, state: snapshotFilterState() } : f);
      writeSavedFilters(list);
      refreshSavedFiltersDropdown(name);
    }
  });
  clearFilterBtn?.addEventListener("click", () => {
    filterName.value = filterTourist.value = filterTrip.value = filterCategory.value = filterExt.value = "";
    filterFrom.value = filterTo.value = "";
    updateDateCount();
    render();
    refreshSavedFiltersDropdown("");
  });
  refreshSavedFiltersDropdown();

  load();
})();
