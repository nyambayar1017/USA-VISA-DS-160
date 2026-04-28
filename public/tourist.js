(function () {
  const listNode = document.querySelector("#tourist-list");
  const countNode = document.querySelector("#tourist-count");
  const filterName = document.querySelector("#tourist-filter-name");
  const filterSerial = document.querySelector("#tourist-filter-serial");
  const filterTrip = document.querySelector("#tourist-filter-trip");
  const filterGroup = document.querySelector("#tourist-filter-group");
  const filterTag = document.querySelector("#tourist-filter-tag");
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
  let promoEditor = null;
  if (!listNode) return;

  let trips = [];
  let groups = [];
  let tourists = [];
  const activeStatuses = new Set();
  const pgn = new window.Paginator({ pageSize: 20, onChange: function () { render(); } });
  pgn.attach(listNode);
  // Opt-in selection: only ids in this set are sent to the promo modal.
  // (Bataa explicitly wanted nothing pre-checked — manager must opt-in to
  // every recipient.)
  const selectedIds = new Set();

  const STATUS_LABELS = {
    potential: "Potential",
    standard: "Standard",
    vip: "VIP",
    child: "Child",
    do_not_contact: "Do not contact",
  };

  // # column is always shown (not toggleable). Actions column carries the
  // 3-dot menu with Edit + Delete (added now that promo contacts can be
  // created from this page directly).
  const ALL_COLUMNS = [
    { key: "select", label: "", default: true, fixed: true },
    { key: "rowNum", label: "#", default: true, fixed: true },
    { key: "serial", label: "Serial", default: true },
    { key: "lastName", label: "Last name", default: true },
    { key: "firstName", label: "First name", default: true },
    { key: "age", label: "Age", default: true },
    { key: "sex", label: "Sex", default: true },
    { key: "trip", label: "Trip", default: true },
    { key: "group", label: "Group", default: true },
    { key: "nationality", label: "Nationality", default: false },
    { key: "tags", label: "Destinations", default: true },
    { key: "passportNumber", label: "Passport #", default: false },
    { key: "passportExpiry", label: "Passport expiry", default: false },
    { key: "registrationNumber", label: "Reg #", default: false },
    { key: "phone", label: "Phone", default: false },
    { key: "email", label: "Email", default: true },
    { key: "marketingStatus", label: "Status", default: true },
    { key: "actions", label: "", default: true, fixed: true },
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

  function expirySoonClass(value) {
    if (!value) return "";
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return "";
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() + 8);
    return dt <= cutoff ? "passport-expiry-soon" : "";
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

  function renderTagsCell(t) {
    const tags = Array.isArray(t.tags) ? t.tags : [];
    const chips = tags.length
      ? tags.map((tag) => '<span class="tourist-tag-chip">' + escapeHtml(tag) + '</span>').join("")
      : '<span class="tourist-tag-empty">—</span>';
    return '<button type="button" class="tourist-tag-cell" data-tags-edit="' + escapeHtml(t.id) + '" title="Click to edit tags">' + chips + '</button>';
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
    const tagQuery = (filterTag.value || "").trim().toLowerCase();
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
      if (tagQuery) {
        const tags = Array.isArray(t.tags) ? t.tags : [];
        if (!tags.some((tag) => String(tag || "").toLowerCase().includes(tagQuery))) return false;
      }
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

  function isEligibleForPromo(t) {
    const status = effectiveStatus(t);
    if (status === "child" || status === "do_not_contact") return false;
    return !!(t.email && t.email.includes("@"));
  }
  // A row counts as a "promo recipient" only if it's eligible AND the user
  // has explicitly checked it (selectedIds).
  function isPromoSelected(t) {
    return selectedIds.has(t.id) && isEligibleForPromo(t);
  }

  function render() {
    const allRows = getFiltered();
    const eligible = allRows.filter(isEligibleForPromo).length;
    const selected = allRows.filter(isPromoSelected).length;
    countNode.textContent =
      allRows.length + " tourist" + (allRows.length === 1 ? "" : "s") +
      " · " + selected + " selected (of " + eligible + " eligible)";
    if (!allRows.length) {
      listNode.innerHTML = '<p class="empty">No tourists match the current filters.</p>';
      return;
    }
    const rows = pgn.slice(allRows);
    const pageOffset = (pgn.page - 1) * pgn.pageSize;
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
      const grpCell = `<span class="tourist-group-cell">${escapeHtml(t.groupSerial || "-")}${t.groupName ? " · " + escapeHtml(t.groupName) : ""}</span>`;
      const status = effectiveStatus(t);
      const isChild = status === "child";
      const isOptOut = status === "do_not_contact";
      const hasEmail = !!(t.email && t.email.includes("@"));
      const blocked = isChild || isOptOut || !hasEmail;
      const checked = !blocked && selectedIds.has(t.id);
      const checkboxTitle = isChild ? "Children cannot receive promos"
        : isOptOut ? "Do not contact"
        : !hasEmail ? "No email on file"
        : "Toggle promo recipient";
      const age = calcAge(t.dob);
      const actionsCell = `
        <details class="row-menu">
          <summary class="row-menu-trigger" aria-label="Actions">⋯</summary>
          <div class="row-menu-popover">
            <button type="button" class="row-menu-item" data-tourist-edit="${escapeHtml(t.id)}">Edit</button>
            <button type="button" class="row-menu-item is-danger" data-tourist-delete="${escapeHtml(t.id)}">Delete</button>
          </div>
        </details>`;
      const cells = {
        select: `<input type="checkbox" class="ts-row-select" data-tourist-id="${escapeHtml(t.id)}"${checked ? " checked" : ""}${blocked ? " disabled" : ""} title="${escapeHtml(checkboxTitle)}" />`,
        rowNum: String(pageOffset + idx + 1),
        serial: '<strong>' + escapeHtml(t.serial || "—") + "</strong>",
        lastName: escapeHtml(t.lastName || ""),
        firstName: escapeHtml(t.firstName || ""),
        age: age === null ? "-" : String(age),
        sex: t.gender === "male" ? "Male" : t.gender === "female" ? "Female" : "-",
        trip: tripCell,
        group: grpCell,
        nationality: escapeHtml(t.nationality || "-"),
        tags: renderTagsCell(t),
        passportNumber: escapeHtml(t.passportNumber || "-"),
        passportExpiry: t.passportExpiry
          ? `<span class="${expirySoonClass(t.passportExpiry)}">${escapeHtml(t.passportExpiry)}</span>`
          : "-",
        registrationNumber: escapeHtml(t.registrationNumber || "-"),
        phone: escapeHtml(t.phone || "-"),
        email: escapeHtml(t.email || "-"),
        marketingStatus: statusSelectHtml(t),
        actions: actionsCell,
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
      ${pgn.controlsHtml()}
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
          method: "POST",
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
      if (cb.checked) selectedIds.add(id); else selectedIds.delete(id);
      updateRowCount();
      syncSelectAll();
      return;
    }
    if (e.target.id === "tourist-select-all") {
      const master = e.target;
      // Apply the master toggle to EVERY eligible row in the filtered set
      // — not just the rows currently rendered on this page. Otherwise on
      // a 42-tourist filter the user only marks the 20 rows on page 1.
      const eligibleRows = getFiltered().filter(isEligibleForPromo);
      eligibleRows.forEach((t) => {
        if (master.checked) selectedIds.add(t.id);
        else selectedIds.delete(t.id);
      });
      // Repaint so the visible-row checkboxes reflect the new state.
      render();
    }
  });

  function updateRowCount() {
    const rows = getFiltered();
    const eligible = rows.filter(isEligibleForPromo).length;
    const selected = rows.filter(isPromoSelected).length;
    countNode.textContent =
      rows.length + " tourist" + (rows.length === 1 ? "" : "s") +
      " · " + selected + " selected (of " + eligible + " eligible)";
  }

  // ── Inline tag edit ──────────────────────────────────────────────────
  listNode.addEventListener("click", async (e) => {
    const editBtn = e.target.closest("[data-tourist-edit]");
    if (editBtn) {
      e.preventDefault();
      const t = tourists.find((x) => x.id === editBtn.dataset.touristEdit);
      if (t) openTouristEditor(t);
      return;
    }
    const delBtn = e.target.closest("[data-tourist-delete]");
    if (delBtn) {
      e.preventDefault();
      const t = tourists.find((x) => x.id === delBtn.dataset.touristDelete);
      if (!t) return;
      const label = `${t.serial || ""} ${t.lastName || ""} ${t.firstName || ""}`.trim() || "this tourist";
      const ok = window.UI?.confirm
        ? await window.UI.confirm(`Delete ${label}?`, { dangerous: true })
        : window.confirm(`Delete ${label}?`);
      if (!ok) return;
      try {
        const resp = await fetch("/api/tourists/" + encodeURIComponent(t.id), { method: "DELETE" });
        if (!resp.ok) {
          const data = await resp.json().catch(() => ({}));
          throw new Error(data.error || "Delete failed");
        }
        tourists = tourists.filter((x) => x.id !== t.id);
        selectedIds.delete(t.id);
        render();
      } catch (err) {
        alert("Алдаа: " + err.message);
      }
      return;
    }
    const tagBtn = e.target.closest("[data-tags-edit]");
    if (!tagBtn) return;
    e.preventDefault();
    // Use the full editor modal (which has the destinations multi-select
    // backed by /api/settings) instead of a free-text prompt — that way
    // there's a single canonical source for destinations.
    const t = tourists.find((x) => x.id === tagBtn.dataset.tagsEdit);
    if (t) openTouristEditor(t);
  });

  // ── Add / Edit modal ──────────────────────────────────────────────────
  // Mirrors the trip-side tourist form: passport scan dropzone with OCR
  // auto-fill (via /api/tourists/passport-scan), full name + passport +
  // registration fields, destinations multi-select.
  const editModal = document.querySelector("#tourist-edit-modal");
  const editForm = document.querySelector("#tourist-edit-form");
  const editTitle = document.querySelector("#tourist-edit-title");
  const editStatus = document.querySelector("#tourist-edit-status");
  const addBtn = document.querySelector("#tourist-add-btn");
  let editingId = "";

  // Wire the destinations multi-select once the modal exists.
  if (window.DestinationsMulti && editForm) {
    window.DestinationsMulti.attachAll(editForm);
  }

  // Passport upload zone (uploads to /api/tourists/passport-scan, gets back
  // a token + OCR'd MRZ fields, fills empty inputs).
  const passportDropzone = document.getElementById("tourist-dir-passport-dropzone");
  const passportFileInput = document.getElementById("tourist-dir-passport-file");
  const passportTokenInput = document.getElementById("tourist-dir-passport-token");
  const passportStatusEl = document.getElementById("tourist-dir-passport-status");
  const passportPreviewEl = document.getElementById("tourist-dir-passport-preview");
  const passportFilenameEl = document.getElementById("tourist-dir-passport-filename");

  function setPassportStatus(text, kind) {
    if (!passportStatusEl) return;
    passportStatusEl.textContent = text || "";
    passportStatusEl.className = "tourist-passport-status" + (kind ? " is-" + kind : "");
    passportStatusEl.hidden = !text;
  }
  function clearPassportSelection() {
    if (passportTokenInput) passportTokenInput.value = "";
    if (passportFileInput) passportFileInput.value = "";
    if (passportPreviewEl) passportPreviewEl.hidden = true;
    if (passportFilenameEl) passportFilenameEl.textContent = "";
    setPassportStatus("", "");
    if (passportDropzone) passportDropzone.disabled = false;
  }
  function applyPassportFields(fields) {
    if (!fields || !editForm) return;
    const fillIfEmpty = (name, value) => {
      const el = editForm.elements?.[name];
      if (!el || !value) return;
      if (el.value && el.value.trim()) return;
      el.value = value;
    };
    fillIfEmpty("firstName", fields.firstName);
    fillIfEmpty("lastName", fields.lastName);
    fillIfEmpty("gender", (fields.gender || "").toLowerCase());
    fillIfEmpty("dob", fields.dob);
    fillIfEmpty("nationality", fields.nationality);
    fillIfEmpty("passportNumber", fields.passportNumber);
    fillIfEmpty("passportIssueDate", fields.passportIssueDate);
    fillIfEmpty("passportExpiry", fields.passportExpiry);
    fillIfEmpty("passportIssuePlace", fields.passportIssuePlace);
  }
  async function uploadPassportFile(file) {
    if (!file) return;
    setPassportStatus("Uploading and reading passport…", "info");
    if (passportDropzone) passportDropzone.disabled = true;
    try {
      // Compress image client-side first if available so we don't blow disk.
      let toSend = file;
      if (window.CompressUpload && file.type && file.type.startsWith("image/")) {
        try { toSend = await window.CompressUpload.file(file); } catch {}
      }
      const form = new FormData();
      form.append("file", toSend);
      const res = await fetch("/api/tourists/passport-scan", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      if (passportTokenInput) passportTokenInput.value = data.token || "";
      if (passportFilenameEl) passportFilenameEl.textContent = file.name || "passport";
      if (passportPreviewEl) passportPreviewEl.hidden = false;
      applyPassportFields(data.fields || {});
      setPassportStatus(data.fields ? "Auto-filled — please double-check." : "Uploaded.", "ok");
    } catch (err) {
      setPassportStatus(err.message || "Upload failed", "err");
    } finally {
      if (passportDropzone) passportDropzone.disabled = false;
    }
  }
  passportDropzone?.addEventListener("click", () => passportFileInput?.click());
  passportFileInput?.addEventListener("change", () => {
    const f = passportFileInput.files && passportFileInput.files[0];
    if (f) uploadPassportFile(f);
  });
  passportPreviewEl?.addEventListener("click", (e) => {
    if (e.target?.dataset?.action === "clear-passport") clearPassportSelection();
  });
  // Drag-and-drop onto the dropzone too.
  passportDropzone?.addEventListener("dragover", (e) => { e.preventDefault(); });
  passportDropzone?.addEventListener("drop", (e) => {
    e.preventDefault();
    const f = e.dataTransfer?.files?.[0];
    if (f) uploadPassportFile(f);
  });

  function openTouristEditor(tourist) {
    editingId = tourist?.id || "";
    clearPassportSelection();
    window.NationalitySelect?.applyTo?.(editForm);
    if (editForm) {
      editForm.reset();
      const f = editForm.elements;
      f.id.value = tourist?.id || "";
      f.lastName.value = tourist?.lastName || "";
      f.firstName.value = tourist?.firstName || "";
      f.email.value = tourist?.email || "";
      f.phone.value = tourist?.phone || "";
      f.dob.value = (tourist?.dob || "").slice(0, 10);
      f.gender.value = tourist?.gender || "";
      f.nationality.value = tourist?.nationality || "";
      f.passportNumber.value = tourist?.passportNumber || "";
      f.passportIssueDate.value = (tourist?.passportIssueDate || "").slice(0, 10);
      f.passportExpiry.value = (tourist?.passportExpiry || "").slice(0, 10);
      f.passportIssuePlace.value = tourist?.passportIssuePlace || "";
      f.registrationNumber.value = tourist?.registrationNumber || "";
      f.marketingStatus.value = tourist?.marketingStatus || "standard";
      f.roomType.value = tourist?.roomType || "";
      f.roomCode.value = tourist?.roomCode || "";
      f.notes.value = tourist?.notes || "";
      // tags: hidden input + multi-select component
      f.tags.value = Array.isArray(tourist?.tags) ? tourist.tags.join(", ") : "";
      try { f.tags.dispatchEvent(new CustomEvent("destinations:set")); } catch {}
    }
    if (editTitle) editTitle.textContent = tourist
      ? `Edit ${tourist.serial || ""} ${tourist.lastName || ""} ${tourist.firstName || ""}`.trim()
      : "New tourist";
    if (editStatus) editStatus.textContent = "";
    if (editModal) {
      editModal.hidden = false;
      editModal.classList.remove("is-hidden");
    }
  }
  function closeTouristEditor() {
    editingId = "";
    clearPassportSelection();
    if (editModal) {
      editModal.classList.add("is-hidden");
      editModal.hidden = true;
    }
  }
  addBtn?.addEventListener("click", () => openTouristEditor(null));
  editModal?.addEventListener("click", (e) => {
    if (e.target?.dataset?.action === "close-tourist-modal") closeTouristEditor();
  });
  // Same auto-uppercase rule the trip-side form uses, so passport-case is
  // consistent across both entry points.
  const UPPER_FIELDS = ["firstName", "lastName", "nationality", "passportNumber", "passportIssuePlace", "registrationNumber"];
  editForm?.addEventListener("input", (e) => {
    const el = e.target;
    if (!(el instanceof HTMLInputElement)) return;
    if (!UPPER_FIELDS.includes(el.name)) return;
    const start = el.selectionStart, end = el.selectionEnd;
    const upper = el.value.toUpperCase();
    if (upper !== el.value) {
      el.value = upper;
      try { el.setSelectionRange(start, end); } catch {}
    }
  });
  editForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = editForm.elements;
    const payload = {
      lastName: f.lastName.value.trim(),
      firstName: f.firstName.value.trim(),
      email: f.email.value.trim(),
      phone: f.phone.value.trim(),
      dob: f.dob.value,
      gender: f.gender.value,
      nationality: f.nationality.value.trim(),
      passportNumber: f.passportNumber.value.trim(),
      passportIssueDate: f.passportIssueDate.value,
      passportExpiry: f.passportExpiry.value,
      passportIssuePlace: f.passportIssuePlace.value.trim(),
      registrationNumber: f.registrationNumber.value.trim(),
      marketingStatus: f.marketingStatus.value,
      roomType: f.roomType.value,
      roomCode: f.roomCode.value.trim(),
      tags: f.tags.value,
      notes: f.notes.value.trim(),
      passportFileToken: f.passportFileToken?.value || "",
    };
    if (!payload.lastName && !payload.firstName) {
      if (editStatus) editStatus.textContent = "Last or first name is required.";
      return;
    }
    const url = editingId ? "/api/tourists/" + encodeURIComponent(editingId) : "/api/tourists";
    if (editStatus) editStatus.textContent = editingId ? "Saving…" : "Creating…";
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Save failed");
      const saved = data.entry || {};
      if (editingId) {
        tourists = tourists.map((t) => (t.id === editingId ? { ...t, ...saved } : t));
      } else {
        tourists = [saved, ...tourists];
      }
      closeTouristEditor();
      render();
    } catch (err) {
      if (editStatus) editStatus.textContent = err.message || "Could not save.";
    }
  });

  // ── Filter wiring ────────────────────────────────────────────────────
  // Any filter change snaps back to page 1 — otherwise a user on page 5 of
  // an unfiltered list could be left staring at an empty page after typing
  // a search term.
  function rerenderFromFilter() { pgn.reset(); render(); }
  [filterName, filterSerial, filterTag].forEach((el) => el.addEventListener("input", rerenderFromFilter));
  filterTrip.addEventListener("change", () => { renderGroupOptions(); rerenderFromFilter(); });
  filterGroup.addEventListener("change", rerenderFromFilter);
  [filterDobFrom, filterDobTo].forEach((el) => el.addEventListener("change", () => { updateDobCount(); rerenderFromFilter(); }));
  [filterAgeMin, filterAgeMax].forEach((el) => el.addEventListener("input", () => { updateAgeCount(); rerenderFromFilter(); }));
  statusPills.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-status]");
    if (!btn) return;
    const s = btn.dataset.status;
    if (activeStatuses.has(s)) activeStatuses.delete(s); else activeStatuses.add(s);
    btn.classList.toggle("is-active");
    rerenderFromFilter();
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
      group: filterGroup.value, tag: filterTag.value,
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
    filterTag.value = snap?.tag || snap?.nationality || "";
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
    filterName.value = filterSerial.value = filterTag.value = "";
    filterTrip.value = ""; renderGroupOptions(); filterGroup.value = "";
    filterDobFrom.value = filterDobTo.value = "";
    filterAgeMin.value = filterAgeMax.value = "";
    activeStatuses.clear();
    selectedIds.clear();
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
    clearAllFilters();
    refreshSavedFiltersDropdown("");
  });
  refreshSavedFiltersDropdown();

  // ── Send promo email ─────────────────────────────────────────────────
  function openPromoModal() {
    const filtered = getFiltered();
    const recipients = filtered.filter(isPromoSelected);
    if (!recipients.length) {
      const eligible = filtered.filter(isEligibleForPromo).length;
      if (!eligible) {
        alert("No tourists in the current filter are eligible for promo (children, opt-outs, and rows without an email are excluded).");
      } else {
        alert(`Tick the checkbox on the rows you want to email. ${eligible} of the ${filtered.length} filtered tourists are eligible.`);
      }
      return;
    }
    promoTarget.textContent = `Recipients: ${recipients.length} (manually selected)`;
    promoStatus.textContent = "";
    promoModal.classList.remove("is-hidden");
    promoModal.removeAttribute("hidden");
    document.body.classList.add("modal-open");
    promoForm.dataset.recipientIds = recipients.map((r) => r.id).join(",");
    // Lazy-init the rich editor on first open so we don't pay for it on
    // every page load.
    const host = document.getElementById("promo-body-host");
    if (host && !promoEditor && window.RichEditor) {
      promoEditor = window.RichEditor.create(host, { minHeight: 260 });
    }
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
    const bodyHtml = (promoEditor?.getHtml() || "").trim();
    const body = (promoEditor?.getText() || "").trim();
    if (!subject || !body) { promoStatus.textContent = "Subject and body are required."; return; }
    const submitBtn = promoForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    promoStatus.textContent = "Илгээж байна...";
    try {
      const resp = await fetch("/api/tourists/promo-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          touristIds: ids, subject, body, bodyHtml,
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
      promoEditor?.setHtml("");
      closePromoModal();
    } catch (err) {
      promoStatus.textContent = "Алдаа: " + err.message;
    } finally {
      submitBtn.disabled = false;
    }
  });

  loadAll();
})();
