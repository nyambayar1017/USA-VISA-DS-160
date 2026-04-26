(function () {
  const listNode = document.querySelector("#tourist-list");
  const countNode = document.querySelector("#tourist-count");
  const filterName = document.querySelector("#tourist-filter-name");
  const filterSerial = document.querySelector("#tourist-filter-serial");
  const filterTrip = document.querySelector("#tourist-filter-trip");
  const filterGroup = document.querySelector("#tourist-filter-group");
  const filterNationality = document.querySelector("#tourist-filter-nationality");
  const filterDobFrom = document.querySelector("#tourist-filter-dob-from");
  const filterDobTo = document.querySelector("#tourist-filter-dob-to");
  const filterAgeMin = document.querySelector("#tourist-filter-age-min");
  const filterAgeMax = document.querySelector("#tourist-filter-age-max");
  const statusPills = document.querySelector("#tourist-status-pills");
  const clearFilterBtn = document.querySelector("#tourist-clear-filter-btn");
  const viewPopover = document.querySelector("#tourist-view-popover");
  const promoBtn = document.querySelector("#tourist-promo-btn");
  const promoModal = document.querySelector("#promo-modal");
  const promoTarget = document.querySelector("#promo-modal-target");
  const promoForm = document.querySelector("#promo-form");
  const promoStatus = document.querySelector("#promo-status");
  if (!listNode) return;

  let trips = [];
  let groups = [];
  let tourists = [];
  const activeStatuses = new Set();
  // ids the user has explicitly UNchecked. Anything not in this set, and
  // currently in the filtered list, counts as selected for the promo send.
  const deselectedIds = new Set();

  const STATUS_LABELS = {
    potential: "Potential",
    standard: "Standard",
    vip: "VIP",
    child: "Child",
    do_not_contact: "Do not contact",
  };

  // # column is always shown (not toggleable). Actions column removed —
  // Trip column already links the way the user wants.
  const ALL_COLUMNS = [
    { key: "select", label: "", default: true, fixed: true },
    { key: "rowNum", label: "#", default: true, fixed: true },
    { key: "serial", label: "Serial", default: true },
    { key: "lastName", label: "Last name", default: true },
    { key: "firstName", label: "First name", default: true },
    { key: "age", label: "Age", default: true },
    { key: "trip", label: "Trip", default: true },
    { key: "group", label: "Group", default: true },
    { key: "nationality", label: "Nationality", default: false },
    { key: "passportNumber", label: "Passport #", default: false },
    { key: "passportExpiry", label: "Passport expiry", default: false },
    { key: "registrationNumber", label: "Reg #", default: false },
    { key: "phone", label: "Phone", default: false },
    { key: "email", label: "Email", default: true },
    { key: "marketingStatus", label: "Status", default: true },
  ];
  const VIEW_KEY = "tourists:visibleColumns";
  let visibleColumns = readVisibleColumns();

  function readVisibleColumns() {
    try {
      const raw = localStorage.getItem(VIEW_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const set = new Set(parsed);
          // Always include fixed columns regardless of stored prefs.
          ALL_COLUMNS.filter((c) => c.fixed).forEach((c) => set.add(c.key));
          return set;
        }
      }
    } catch {}
    return new Set(ALL_COLUMNS.filter((c) => c.default).map((c) => c.key));
  }
  function writeVisibleColumns() {
    try { localStorage.setItem(VIEW_KEY, JSON.stringify([...visibleColumns])); } catch {}
  }
  function colVisible(key) { return visibleColumns.has(key); }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function calcAge(dob) {
    if (!dob) return null;
    const m = String(dob).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    const today = new Date();
    let age = today.getFullYear() - Number(m[1]);
    const mm = today.getMonth() + 1;
    const dd = today.getDate();
    if (mm < Number(m[2]) || (mm === Number(m[2]) && dd < Number(m[3]))) age -= 1;
    return age >= 0 ? age : null;
  }

  function effectiveStatus(t) {
    const age = calcAge(t.dob);
    if (age !== null && age < 18) return "child";
    return String(t.marketingStatus || "standard").toLowerCase();
  }

  function statusSelectHtml(t) {
    const status = effectiveStatus(t);
    const isChild = status === "child";
    const opts = ["standard", "potential", "vip", "child", "do_not_contact"]
      .map((v) => `<option value="${v}"${v === status ? " selected" : ""}>${STATUS_LABELS[v]}</option>`)
      .join("");
    // disable the inline editor for children — status is computed.
    return `<select class="ts-status-select ts-pill ts-pill-${status}" data-tourist-id="${escapeHtml(t.id)}"${isChild ? " disabled title=\"Auto-set because age < 18\"" : ""}>${opts}</select>`;
  }

  async function fetchJson(url, options) {
    const res = await fetch(url, options);
    if (!res.ok) throw new Error("Request failed: " + url);
    return res.json();
  }

  async function loadAll() {
    try {
      const [tripData, groupData, touristData] = await Promise.all([
        fetchJson("/api/camp-trips"),
        fetchJson("/api/tourist-groups"),
        fetchJson("/api/tourists"),
      ]);
      trips = tripData.entries || [];
      groups = groupData.entries || [];
      tourists = touristData.entries || [];
      renderTripOptions();
      renderGroupOptions();
      renderViewToggle();
      render();
    } catch (err) {
      listNode.innerHTML = '<p class="empty">Could not load tourists: ' + escapeHtml(err.message) + "</p>";
    }
  }

  function renderTripOptions() {
    const current = filterTrip.value;
    filterTrip.innerHTML = '<option value="">All trips</option>' + trips
      .slice()
      .sort((a, b) => (a.serial || "").localeCompare(b.serial || ""))
      .map((t) => '<option value="' + escapeHtml(t.id) + '">' + escapeHtml(t.serial || "") + ' · ' + escapeHtml(t.tripName || "") + '</option>')
      .join("");
    filterTrip.value = current;
  }

  function renderGroupOptions() {
    const current = filterGroup.value;
    const tripId = filterTrip.value;
    const list = tripId ? groups.filter((g) => g.tripId === tripId) : groups;
    filterGroup.innerHTML = '<option value="">All groups</option>' + list
      .slice()
      .sort((a, b) => (a.serial || "").localeCompare(b.serial || ""))
      .map((g) => '<option value="' + escapeHtml(g.id) + '">' + escapeHtml(g.serial || "") + ' · ' + escapeHtml(g.name || "") + '</option>')
      .join("");
    filterGroup.value = current && list.some((g) => g.id === current) ? current : "";
  }

  function renderViewToggle() {
    viewPopover.innerHTML = '<p class="ts-view-title">Toggle columns</p>' +
      ALL_COLUMNS.filter((c) => !c.fixed).map((c) => `
        <label class="ts-view-row">
          <input type="checkbox" data-col="${escapeHtml(c.key)}" ${visibleColumns.has(c.key) ? "checked" : ""} />
          <span>${escapeHtml(c.label)}</span>
        </label>
      `).join("");
  }

  function getFiltered() {
    const name = (filterName.value || "").trim().toLowerCase();
    const serial = (filterSerial.value || "").trim().toLowerCase();
    const trip = filterTrip.value;
    const group = filterGroup.value;
    const nat = (filterNationality.value || "").trim().toLowerCase();
    const dobFrom = (filterDobFrom.value || "").trim();
    const dobTo = (filterDobTo.value || "").trim();
    const ageMinRaw = (filterAgeMin.value || "").trim();
    const ageMaxRaw = (filterAgeMax.value || "").trim();
    const ageMin = ageMinRaw === "" ? null : Number(ageMinRaw);
    const ageMax = ageMaxRaw === "" ? null : Number(ageMaxRaw);
    return tourists.filter((t) => {
      const fullName = ((t.lastName || "") + " " + (t.firstName || "")).toLowerCase();
      if (name && !fullName.includes(name)) return false;
      if (serial && !(t.serial || "").toLowerCase().includes(serial)) return false;
      if (trip && t.tripId !== trip) return false;
      if (group && t.groupId !== group) return false;
      if (nat && !(t.nationality || "").toLowerCase().includes(nat)) return false;
      if (activeStatuses.size && !activeStatuses.has(effectiveStatus(t))) return false;
      if (dobFrom || dobTo) {
        const dob = t.dob ? String(t.dob).slice(0, 10) : "";
        if (!dob) return false;
        if (dobFrom && dob < dobFrom) return false;
        if (dobTo && dob > dobTo) return false;
      }
      if (ageMin !== null || ageMax !== null) {
        const age = calcAge(t.dob);
        if (age === null) return false;
        if (ageMin !== null && age < ageMin) return false;
        if (ageMax !== null && age > ageMax) return false;
      }
      return true;
    });
  }

  function isPromoEligible(t) {
    if (deselectedIds.has(t.id)) return false;
    const status = effectiveStatus(t);
    if (status === "child" || status === "do_not_contact") return false;
    return !!(t.email && t.email.includes("@"));
  }

  function render() {
    const rows = getFiltered();
    const promoEligible = rows.filter(isPromoEligible).length;
    countNode.textContent =
      rows.length + " tourist" + (rows.length === 1 ? "" : "s") +
      " · " + promoEligible + " selectable for promo";
    if (!rows.length) {
      listNode.innerHTML = '<p class="empty">No tourists match the current filters.</p>';
      return;
    }
    const tripById = Object.fromEntries(trips.map((t) => [t.id, t]));
    const cols = ALL_COLUMNS.filter((c) => colVisible(c.key));
    const headers = cols.map((c) => {
      if (c.key === "select") {
        return '<th><input type="checkbox" id="tourist-select-all" title="Select all eligible" /></th>';
      }
      return "<th>" + escapeHtml(c.label) + "</th>";
    }).join("");
    const body = rows.map((t, idx) => {
      const trip = tripById[t.tripId];
      const tripCell = trip
        ? '<a href="/trip-detail?tripId=' + encodeURIComponent(t.tripId) + '" class="trip-name-link">' + escapeHtml(trip.serial || "") + ' · ' + escapeHtml(trip.tripName || "") + "</a>"
        : escapeHtml(t.tripSerial || "-");
      const grpCell = escapeHtml(t.groupSerial || "-") + (t.groupName ? " · " + escapeHtml(t.groupName) : "");
      const status = effectiveStatus(t);
      const isChild = status === "child";
      const isOptOut = status === "do_not_contact";
      const hasEmail = !!(t.email && t.email.includes("@"));
      const blocked = isChild || isOptOut || !hasEmail;
      const checked = !blocked && !deselectedIds.has(t.id);
      const checkboxTitle = isChild ? "Children cannot receive promos"
        : isOptOut ? "Do not contact"
        : !hasEmail ? "No email on file"
        : "Toggle promo recipient";
      const age = calcAge(t.dob);
      const cells = {
        select: `<input type="checkbox" class="ts-row-select" data-tourist-id="${escapeHtml(t.id)}"${checked ? " checked" : ""}${blocked ? " disabled" : ""} title="${escapeHtml(checkboxTitle)}" />`,
        rowNum: String(idx + 1),
        serial: '<strong>' + escapeHtml(t.serial || "") + "</strong>",
        lastName: escapeHtml(t.lastName || ""),
        firstName: escapeHtml(t.firstName || ""),
        age: age === null ? "-" : String(age),
        trip: tripCell,
        group: grpCell,
        nationality: escapeHtml(t.nationality || "-"),
        passportNumber: escapeHtml(t.passportNumber || "-"),
        passportExpiry: escapeHtml(t.passportExpiry || "-"),
        registrationNumber: escapeHtml(t.registrationNumber || "-"),
        phone: escapeHtml(t.phone || "-"),
        email: escapeHtml(t.email || "-"),
        marketingStatus: statusSelectHtml(t),
      };
      return "<tr>" + cols.map((c) => "<td>" + cells[c.key] + "</td>").join("") + "</tr>";
    }).join("");
    listNode.innerHTML = `
      <div class="camp-table-wrap">
        <table class="tourist-directory-table">
          <thead><tr>${headers}</tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    `;
    syncSelectAll();
  }

  function syncSelectAll() {
    const master = document.getElementById("tourist-select-all");
    if (!master) return;
    const cbs = listNode.querySelectorAll(".ts-row-select:not([disabled])");
    if (!cbs.length) {
      master.checked = false;
      master.indeterminate = false;
      return;
    }
    const checkedCount = [...cbs].filter((c) => c.checked).length;
    if (checkedCount === 0) { master.checked = false; master.indeterminate = false; }
    else if (checkedCount === cbs.length) { master.checked = true; master.indeterminate = false; }
    else { master.checked = false; master.indeterminate = true; }
  }

  // ── Inline status edit ──────────────────────────────────────────────
  listNode.addEventListener("change", async (e) => {
    const sel = e.target.closest(".ts-status-select");
    if (sel) {
      const id = sel.dataset.touristId;
      const value = sel.value;
      const tourist = tourists.find((t) => t.id === id);
      if (!tourist) return;
      // Children are auto-locked; ignore any attempt to edit (select is disabled anyway).
      const age = calcAge(tourist.dob);
      if (age !== null && age < 18) return;
      sel.disabled = true;
      try {
        const resp = await fetch("/api/tourists/" + encodeURIComponent(id), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ marketingStatus: value }),
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || "Update failed");
        tourist.marketingStatus = data.entry?.marketingStatus || value;
        // Repaint just this row's status cell to update class colors.
        const row = sel.closest("tr");
        if (row) {
          const newCell = document.createElement("td");
          newCell.innerHTML = statusSelectHtml(tourist);
          // Find the status cell — it's the one containing this select.
          sel.parentElement.replaceWith(newCell);
        }
        render();
      } catch (err) {
        alert("Алдаа: " + err.message);
        sel.disabled = false;
      }
      return;
    }
    const cb = e.target.closest(".ts-row-select");
    if (cb) {
      const id = cb.dataset.touristId;
      if (cb.checked) deselectedIds.delete(id); else deselectedIds.add(id);
      const promoEligible = getFiltered().filter(isPromoEligible).length;
      countNode.textContent =
        getFiltered().length + " tourist" + (getFiltered().length === 1 ? "" : "s") +
        " · " + promoEligible + " selectable for promo";
      syncSelectAll();
      return;
    }
    if (e.target.id === "tourist-select-all") {
      const master = e.target;
      const cbs = listNode.querySelectorAll(".ts-row-select:not([disabled])");
      cbs.forEach((c) => {
        c.checked = master.checked;
        const id = c.dataset.touristId;
        if (master.checked) deselectedIds.delete(id); else deselectedIds.add(id);
      });
      const promoEligible = getFiltered().filter(isPromoEligible).length;
      countNode.textContent =
        getFiltered().length + " tourist" + (getFiltered().length === 1 ? "" : "s") +
        " · " + promoEligible + " selectable for promo";
    }
  });

  // ── Filter wiring ────────────────────────────────────────────────────
  [filterName, filterSerial, filterNationality].forEach((el) => el.addEventListener("input", render));
  filterTrip.addEventListener("change", () => { renderGroupOptions(); render(); });
  filterGroup.addEventListener("change", render);
  [filterDobFrom, filterDobTo].forEach((el) => el.addEventListener("change", () => { updateDobCount(); render(); }));
  [filterAgeMin, filterAgeMax].forEach((el) => el.addEventListener("input", () => { updateAgeCount(); render(); }));
  statusPills.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-status]");
    if (!btn) return;
    const s = btn.dataset.status;
    if (activeStatuses.has(s)) activeStatuses.delete(s); else activeStatuses.add(s);
    btn.classList.toggle("is-active");
    render();
  });

  function updateDobCount() {
    const pill = document.getElementById("tourist-dob-pill");
    const badge = document.getElementById("tourist-dob-count");
    if (!pill || !badge) return;
    const n = (filterDobFrom.value ? 1 : 0) + (filterDobTo.value ? 1 : 0);
    if (n > 0) { badge.textContent = String(n); badge.removeAttribute("hidden"); pill.classList.add("has-active"); }
    else { badge.setAttribute("hidden", ""); pill.classList.remove("has-active"); }
  }
  function updateAgeCount() {
    const pill = document.getElementById("tourist-age-pill");
    const badge = document.getElementById("tourist-age-count");
    if (!pill || !badge) return;
    const n = (filterAgeMin.value ? 1 : 0) + (filterAgeMax.value ? 1 : 0);
    if (n > 0) { badge.textContent = String(n); badge.removeAttribute("hidden"); pill.classList.add("has-active"); }
    else { badge.setAttribute("hidden", ""); pill.classList.remove("has-active"); }
  }

  // ── View column toggle ───────────────────────────────────────────────
  viewPopover.addEventListener("change", (e) => {
    const cb = e.target.closest("input[data-col]");
    if (!cb) return;
    const key = cb.dataset.col;
    if (cb.checked) visibleColumns.add(key); else visibleColumns.delete(key);
    writeVisibleColumns();
    render();
  });

  document.addEventListener("click", (e) => {
    document.querySelectorAll("details[open]").forEach((d) => {
      if (!d.contains(e.target)) d.removeAttribute("open");
    });
  });

  // ── Saved filters ────────────────────────────────────────────────────
  const SAVED_FILTERS_KEY = "tourists:savedFilters";
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
      name: filterName.value, serial: filterSerial.value, trip: filterTrip.value,
      group: filterGroup.value, nationality: filterNationality.value,
      dobFrom: filterDobFrom.value, dobTo: filterDobTo.value,
      ageMin: filterAgeMin.value, ageMax: filterAgeMax.value,
      statuses: [...activeStatuses],
    };
  }
  function applyFilterStateFromSnapshot(snap) {
    filterName.value = snap?.name || "";
    filterSerial.value = snap?.serial || "";
    filterTrip.value = snap?.trip || "";
    renderGroupOptions();
    filterGroup.value = snap?.group || "";
    filterNationality.value = snap?.nationality || "";
    filterDobFrom.value = snap?.dobFrom || "";
    filterDobTo.value = snap?.dobTo || "";
    filterAgeMin.value = snap?.ageMin || "";
    filterAgeMax.value = snap?.ageMax || "";
    activeStatuses.clear();
    (snap?.statuses || []).forEach((s) => activeStatuses.add(s));
    statusPills.querySelectorAll(".invoices-status-pill").forEach((p) => {
      p.classList.toggle("is-active", activeStatuses.has(p.dataset.status));
    });
    updateDobCount();
    updateAgeCount();
    render();
  }
  function clearAllFilters() {
    filterName.value = filterSerial.value = filterNationality.value = "";
    filterTrip.value = ""; renderGroupOptions(); filterGroup.value = "";
    filterDobFrom.value = filterDobTo.value = "";
    filterAgeMin.value = filterAgeMax.value = "";
    activeStatuses.clear();
    deselectedIds.clear();
    statusPills.querySelectorAll(".invoices-status-pill").forEach((p) => p.classList.remove("is-active"));
    updateDobCount();
    updateAgeCount();
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
  savedDropdown?.addEventListener("click", (event) => {
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
      if (!window.confirm(`Delete saved filter "${name}"?`)) return;
      writeSavedFilters(readSavedFilters().filter((f) => f.name !== name));
      refreshSavedFiltersDropdown(activeSavedFilterName === name ? "" : activeSavedFilterName);
    } else if (action === "save") {
      savedDropdown.removeAttribute("open");
      const newName = (window.prompt("Save filter as:") || "").trim();
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
    clearAllFilters();
    refreshSavedFiltersDropdown("");
  });
  refreshSavedFiltersDropdown();

  // ── Send promo email ─────────────────────────────────────────────────
  function openPromoModal() {
    const filtered = getFiltered();
    const recipients = filtered.filter(isPromoEligible);
    if (!recipients.length) {
      alert("No selectable recipients. Either no tourists match the filters, or all matches are children, opted-out, missing email, or unchecked.");
      return;
    }
    const skippedChild = filtered.filter((t) => effectiveStatus(t) === "child").length;
    const skippedOptOut = filtered.filter((t) => effectiveStatus(t) === "do_not_contact").length;
    const skippedNoEmail = filtered.filter((t) => {
      const s = effectiveStatus(t);
      return s !== "child" && s !== "do_not_contact" && !(t.email && t.email.includes("@"));
    }).length;
    const unchecked = filtered.filter((t) => deselectedIds.has(t.id)
      && effectiveStatus(t) !== "child"
      && effectiveStatus(t) !== "do_not_contact"
      && t.email && t.email.includes("@")).length;

    const skippedParts = [];
    if (skippedChild) skippedParts.push(`${skippedChild} child`);
    if (skippedOptOut) skippedParts.push(`${skippedOptOut} opt-out`);
    if (skippedNoEmail) skippedParts.push(`${skippedNoEmail} no email`);
    if (unchecked) skippedParts.push(`${unchecked} unchecked`);
    const skippedSummary = skippedParts.length ? ` — skipped: ${skippedParts.join(", ")}` : "";

    promoTarget.textContent = `Recipients: ${recipients.length} (out of ${filtered.length} filtered${skippedSummary})`;
    promoStatus.textContent = "";
    promoModal.classList.remove("is-hidden");
    promoModal.removeAttribute("hidden");
    document.body.classList.add("modal-open");
    promoForm.dataset.recipientIds = recipients.map((r) => r.id).join(",");
  }
  function closePromoModal() {
    promoModal.classList.add("is-hidden");
    promoModal.setAttribute("hidden", "");
    document.body.classList.remove("modal-open");
  }
  promoBtn?.addEventListener("click", openPromoModal);
  promoModal.addEventListener("click", (e) => {
    if (e.target.dataset?.action === "close-promo-modal") closePromoModal();
  });
  promoForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const ids = (promoForm.dataset.recipientIds || "").split(",").filter(Boolean);
    if (!ids.length) { promoStatus.textContent = "No recipients."; return; }
    const subject = document.getElementById("promo-subject").value.trim();
    const body = document.getElementById("promo-body").value.trim();
    if (!subject || !body) { promoStatus.textContent = "Subject and body are required."; return; }
    const submitBtn = promoForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    promoStatus.textContent = "Илгээж байна...";
    try {
      const resp = await fetch("/api/tourists/promo-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          touristIds: ids, subject, body,
          workspace: typeof readWorkspace === "function" ? readWorkspace() : "",
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Send failed");
      const parts = [`✔ Амжилттай! ${data.sent} имэйл илгээгдлээ`];
      if (data.skippedChild) parts.push(`${data.skippedChild} child blocked`);
      if (data.skippedOptOut) parts.push(`${data.skippedOptOut} opt-out`);
      if (data.skippedNoEmail) parts.push(`${data.skippedNoEmail} no email`);
      if (data.failures && data.failures.length) parts.push(`${data.failures.length} failed`);
      const msg = parts.join(" · ");
      alert(msg);
      promoStatus.textContent = msg;
      document.getElementById("promo-subject").value = "";
      document.getElementById("promo-body").value = "";
      closePromoModal();
    } catch (err) {
      promoStatus.textContent = "Алдаа: " + err.message;
    } finally {
      submitBtn.disabled = false;
    }
  });

  loadAll();
})();
