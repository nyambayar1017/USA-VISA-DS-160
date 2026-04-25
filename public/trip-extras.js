(function () {
  if (!document.body.dataset.page || document.body.dataset.page !== "camp-reservations") {
    // The trip-detail page sets data-page="camp-reservations" too. We
    // gate on the URL containing /trip-detail to avoid running on the
    // generic camp page.
    if (!window.location.pathname.startsWith("/trip-detail")) return;
  }

  const groupSection = document.getElementById("groups-section");
  const touristSection = document.getElementById("tourists-section");
  if (!groupSection || !touristSection) return;

  const groupListNode = groupSection.querySelector("#group-list");
  const groupForm = document.getElementById("group-form");
  const groupFormPanel = document.getElementById("group-form-panel");
  const groupFormTitle = document.getElementById("group-form-title");
  const groupStatus = document.getElementById("group-status");
  const groupToggleBtn = document.getElementById("group-toggle-form");

  const touristListNode = touristSection.querySelector("#tourist-section-list");
  const touristForm = document.getElementById("tourist-form");
  const touristFormPanel = document.getElementById("tourist-form-panel");
  const touristFormTitle = document.getElementById("tourist-form-title");
  const touristFormStatus = document.getElementById("tourist-form-status");
  const touristFormGroup = document.getElementById("tourist-form-group");
  const touristToggleBtn = document.getElementById("tourist-toggle-form");
  const touristFilterGroup = document.getElementById("tourist-section-filter-group");
  const touristFilterName = document.getElementById("tourist-section-filter-name");

  let tripId = "";
  let groups = [];
  let tourists = [];
  let editingGroupId = "";
  let editingTouristId = "";

  const ROOM_PALETTE = [
    { bg: "#fde2e4", fg: "#7a1d2a" },
    { bg: "#dbeafe", fg: "#1e3a8a" },
    { bg: "#dcfce7", fg: "#14532d" },
    { bg: "#fef3c7", fg: "#78350f" },
    { bg: "#e9d5ff", fg: "#5b21b6" },
    { bg: "#fed7aa", fg: "#7c2d12" },
    { bg: "#cffafe", fg: "#155e75" },
    { bg: "#fbcfe8", fg: "#831843" },
    { bg: "#d9f99d", fg: "#365314" },
    { bg: "#fde68a", fg: "#713f12" },
  ];
  // Same color across all tourists sharing groupId+roomType+roomCode
  const roomColorCache = new Map();
  function roomKeyFor(t) {
    if (!t || !t.roomType) return "";
    return `${t.groupId || ""}|${t.roomType}|${t.roomCode || ""}`;
  }
  function roomColorFor(t) {
    const key = roomKeyFor(t);
    if (!key) return null;
    if (!roomColorCache.has(key)) {
      roomColorCache.set(key, ROOM_PALETTE[roomColorCache.size % ROOM_PALETTE.length]);
    }
    return roomColorCache.get(key);
  }
  function rebuildRoomColors() {
    roomColorCache.clear();
    tourists.filter((t) => t.roomType).forEach(roomColorFor);
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getTripIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get("tripId") || "";
  }

  function openModal(panel) {
    panel.classList.remove("is-hidden");
    panel.removeAttribute("hidden");
    document.body.classList.add("modal-open");
  }
  function closeModal(panel) {
    panel.classList.add("is-hidden");
    panel.setAttribute("hidden", "");
    document.body.classList.remove("modal-open");
  }

  async function fetchJson(url, options) {
    const res = await fetch(url, options);
    let data = {};
    try { data = await res.json(); } catch {}
    if (!res.ok) throw new Error(data.error || `Request failed: ${url}`);
    return data;
  }

  function buildPayload(form) {
    return Object.fromEntries(new FormData(form).entries());
  }

  async function loadGroupsAndTourists(currentTripId) {
    if (!currentTripId) return;
    tripId = currentTripId;
    try {
      const [g, t] = await Promise.all([
        fetchJson(`/api/tourist-groups?tripId=${encodeURIComponent(tripId)}`),
        fetchJson(`/api/tourists?tripId=${encodeURIComponent(tripId)}`),
      ]);
      groups = g.entries || [];
      tourists = t.entries || [];
      rebuildRoomColors();
      renderGroups();
      renderTourists();
      renderGroupOptions();
    } catch (err) {
      console.warn("trip-extras load failed:", err);
    }
  }

  const ROOM_SHORT = { single: "sgl", double: "dbl", twin: "twin", triple: "tpl", family: "fam", other: "other" };
  const ROOM_OCCUPANCY = { single: 1, double: 2, twin: 2, triple: 3 };

  function buildRoomingSummary(list) {
    const counts = {};
    list.forEach((t) => {
      if (!t.roomType) return;
      counts[t.roomType] = (counts[t.roomType] || 0) + 1;
    });
    const parts = Object.keys(counts).map((type) => {
      const occupants = counts[type];
      const cap = ROOM_OCCUPANCY[type] || 1;
      const rooms = Math.ceil(occupants / cap);
      return `${ROOM_SHORT[type] || type} - ${rooms}`;
    });
    return parts.join(", ");
  }

  function renderGroups() {
    if (!groups.length) {
      groupListNode.innerHTML = '<p class="empty">No groups yet. Click "Add group" to create one.</p>';
      return;
    }
    groupListNode.innerHTML = `
      <div class="group-card-grid">
        ${groups
          .map((g) => {
            const groupTourists = tourists.filter((t) => t.groupId === g.id);
            const rooming = buildRoomingSummary(groupTourists);
            const initials = (g.leaderName || g.name || "?")
              .split(/\s+/)
              .filter(Boolean)
              .slice(0, 2)
              .map((p) => p[0]?.toUpperCase() || "")
              .join("") || "?";
            return `
              <a class="group-card" href="/group?tripId=${encodeURIComponent(tripId)}&groupId=${encodeURIComponent(g.id)}">
                <div class="group-card-row">
                  <span class="group-card-status"></span>
                  <span class="group-card-title">${escapeHtml(g.serial)} · ${escapeHtml(g.name)}</span>
                  <details class="group-card-menu-wrap" onclick="event.preventDefault(); event.stopPropagation();">
                    <summary class="group-card-menu" aria-label="Group menu">⋯</summary>
                    <div class="group-card-menu-popover">
                      <button type="button" class="trip-menu-item" data-group-action="edit" data-id="${escapeHtml(g.id)}">Edit</button>
                      <button type="button" class="trip-menu-item is-danger" data-group-action="delete" data-id="${escapeHtml(g.id)}">Delete</button>
                    </div>
                  </details>
                </div>
                <div class="group-card-meta">
                  <span>${groupTourists.length} tourist${groupTourists.length === 1 ? "" : "s"}${groupTourists.length ? ` (adult - ${groupTourists.length})` : ""}</span>
                  ${rooming ? `<span class="group-card-rooming">${escapeHtml(rooming)}</span>` : ""}
                </div>
                <div class="group-card-leader">
                  <span class="group-card-avatar">${escapeHtml(initials)}</span>
                </div>
              </a>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function renderGroupOptions() {
    const currentFilter = touristFilterGroup.value;
    const currentForm = touristFormGroup.value;
    const opts = `<option value="">— Select group —</option>${groups
      .map((g) => `<option value="${escapeHtml(g.id)}">${escapeHtml(g.serial)} · ${escapeHtml(g.name)}</option>`)
      .join("")}`;
    touristFormGroup.innerHTML = opts;
    touristFilterGroup.innerHTML = `<option value="">All groups</option>${groups
      .map((g) => `<option value="${escapeHtml(g.id)}">${escapeHtml(g.serial)} · ${escapeHtml(g.name)}</option>`)
      .join("")}`;
    if (currentForm && groups.some((g) => g.id === currentForm)) touristFormGroup.value = currentForm;
    if (currentFilter && groups.some((g) => g.id === currentFilter)) touristFilterGroup.value = currentFilter;
  }

  function renderTourists() {
    const filterGroup = touristFilterGroup.value;
    const filterName = (touristFilterName.value || "").toLowerCase().trim();
    const rows = tourists.filter((t) => {
      if (filterGroup && t.groupId !== filterGroup) return false;
      if (filterName) {
        const blob = `${t.lastName || ""} ${t.firstName || ""} ${t.passportNumber || ""}`.toLowerCase();
        if (!blob.includes(filterName)) return false;
      }
      return true;
    });
    if (!rows.length) {
      touristListNode.innerHTML = '<p class="empty">No tourists yet. Click "Add tourist" to add one.</p>';
      return;
    }
    touristListNode.innerHTML = `
      <div class="camp-table-wrap">
        <table class="camp-table reservation-addon-table">
          <thead>
            <tr>
              <th><input type="checkbox" id="tourist-select-all" aria-label="Select all" /></th>
              <th>Group</th>
              <th>Last name</th>
              <th>First name</th>
              <th>Nationality</th>
              <th>Passport #</th>
              <th>Passport expiry</th>
              <th>Reg #</th>
              <th>Phone</th>
              <th>Room</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (t) => {
                  const roomTypeShort = { single: "SGL", double: "DBL", twin: "TWIN", triple: "TPL", family: "FAM", other: "OTH" };
                  const roomLabel = t.roomType
                    ? `${escapeHtml(t.roomCode || "—")} ${escapeHtml(roomTypeShort[t.roomType] || t.roomType.toUpperCase())}`
                    : "—";
                  const c = roomColorFor(t);
                  const roomStyle = c ? `style="background:${c.bg};color:${c.fg};font-weight:700;"` : "";
                  return `
                    <tr>
                      <td><input type="checkbox" class="tourist-select" data-id="${escapeHtml(t.id)}" ${selectedTouristIds.has(t.id) ? "checked" : ""} /></td>
                      <td><strong>${escapeHtml((groups.find((g) => g.id === t.groupId) || {}).name || t.groupSerial || "-")}</strong></td>
                      <td>${escapeHtml(t.lastName || "")}</td>
                      <td>${escapeHtml(t.firstName || "")}</td>
                      <td>${escapeHtml(t.nationality || "-")}</td>
                      <td>${escapeHtml(t.passportNumber || "-")}</td>
                      <td>${escapeHtml(t.passportExpiry || "-")}</td>
                      <td>${escapeHtml(t.registrationNumber || "-")}</td>
                      <td>${escapeHtml(t.phone || "-")}</td>
                      <td ${roomStyle}>${roomLabel}</td>
                      <td>
                        <div class="trip-row-actions trip-row-actions-inline">
                          <button type="button" class="table-link compact secondary" data-tourist-action="edit" data-id="${t.id}">Edit</button>
                          <button type="button" class="table-link compact secondary" data-tourist-action="delete" data-id="${t.id}">Delete</button>
                        </div>
                      </td>
                    </tr>
                  `;
                }
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;
    const selectAll = touristListNode.querySelector("#tourist-select-all");
    if (selectAll) {
      const visibleIds = rows.map((r) => r.id);
      selectAll.checked = visibleIds.length > 0 && visibleIds.every((id) => selectedTouristIds.has(id));
    }
  }

  const selectedTouristIds = new Set();

  async function downloadTouristsXlsx(ids, filename) {
    const body = ids.length ? { ids } : { tripId };
    const res = await fetch("/api/tourists/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      let err = "Could not download.";
      try { err = (await res.json()).error || err; } catch {}
      alert(err);
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  document.getElementById("tourist-export-all")?.addEventListener("click", () => {
    if (!tourists.length) { alert("No tourists to download."); return; }
    downloadTouristsXlsx([], `tourists-${tripId || "trip"}.xlsx`);
  });
  document.getElementById("tourist-export-selected")?.addEventListener("click", () => {
    const ids = Array.from(selectedTouristIds);
    if (!ids.length) { alert("Select at least one tourist first."); return; }
    downloadTouristsXlsx(ids, `tourists-selected-${tripId || "trip"}.xlsx`);
  });

  // ── Group form ───────────────────────────────────────────────
  function resetGroupForm() {
    editingGroupId = "";
    groupForm.reset();
    groupForm.elements.id.value = "";
    if (groupFormTitle) groupFormTitle.textContent = "New group";
    if (groupStatus) groupStatus.textContent = "";
    document.getElementById("group-delete-btn")?.setAttribute("hidden", "");
  }

  groupToggleBtn?.addEventListener("click", () => {
    if (!getTripIdFromUrl()) {
      alert("Open a trip first to add groups.");
      return;
    }
    resetGroupForm();
    openModal(groupFormPanel);
  });

  groupFormPanel?.addEventListener("click", async (e) => {
    if (e.target.dataset?.action === "close-group-modal") {
      closeModal(groupFormPanel);
      return;
    }
    if (e.target.id === "group-delete-btn") {
      const id = e.target.dataset.id;
      const group = groups.find((g) => g.id === id);
      if (!group) return;
      const inGroup = tourists.filter((t) => t.groupId === id).length;
      const msg = inGroup
        ? `Delete group "${group.name}" and its ${inGroup} tourist${inGroup === 1 ? "" : "s"}?`
        : `Delete group "${group.name}"?`;
      if (!confirm(msg)) return;
      try {
        await fetchJson(`/api/tourist-groups/${id}`, { method: "DELETE" });
        closeModal(groupFormPanel);
        resetGroupForm();
        await loadGroupsAndTourists(tripId);
      } catch (err) {
        alert(err.message || "Could not delete group.");
      }
    }
  });

  groupForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!tripId) { groupStatus.textContent = "No trip selected."; return; }
    const payload = buildPayload(groupForm);
    payload.tripId = tripId;
    delete payload.id;
    try {
      groupStatus.textContent = editingGroupId ? "Saving..." : "Creating...";
      await fetchJson(editingGroupId ? `/api/tourist-groups/${editingGroupId}` : "/api/tourist-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      groupStatus.textContent = "Saved.";
      closeModal(groupFormPanel);
      resetGroupForm();
      await loadGroupsAndTourists(tripId);
    } catch (err) {
      groupStatus.textContent = err.message || "Could not save group.";
    }
  });

  groupListNode?.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-group-action]");
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    const action = btn.dataset.groupAction;
    const id = btn.dataset.id;
    const group = groups.find((g) => g.id === id);
    if (!group) return;
    btn.closest("details")?.removeAttribute("open");
    if (action === "menu" || action === "edit") {
      editingGroupId = id;
      groupForm.elements.name.value = group.name || "";
      groupForm.elements.headcount.value = group.headcount || "";
      groupForm.elements.leaderName.value = group.leaderName || "";
      groupForm.elements.leaderEmail.value = group.leaderEmail || "";
      groupForm.elements.leaderPhone.value = group.leaderPhone || "";
      groupForm.elements.leaderNationality.value = group.leaderNationality || "";
      groupForm.elements.notes.value = group.notes || "";
      if (groupFormTitle) groupFormTitle.textContent = `Edit group ${group.serial}`;
      const delBtn = document.getElementById("group-delete-btn");
      if (delBtn) {
        delBtn.removeAttribute("hidden");
        delBtn.dataset.id = id;
      }
      openModal(groupFormPanel);
    } else if (action === "delete") {
      const inGroup = tourists.filter((t) => t.groupId === id).length;
      const msg = inGroup
        ? `Delete group "${group.name}" and its ${inGroup} tourist${inGroup === 1 ? "" : "s"}?`
        : `Delete group "${group.name}"?`;
      if (!confirm(msg)) return;
      try {
        await fetchJson(`/api/tourist-groups/${id}`, { method: "DELETE" });
        await loadGroupsAndTourists(tripId);
      } catch (err) {
        alert(err.message || "Could not delete group.");
      }
    } else if (action === "filter") {
      touristFilterGroup.value = id;
      renderTourists();
      touristSection.classList.remove("is-hidden");
      groupSection.classList.add("is-hidden");
      const tabBar = document.getElementById("trip-tab-bar");
      tabBar?.querySelectorAll(".trip-tab").forEach((b) => b.classList.toggle("is-active", b.dataset.tab === "tourists-section"));
      touristSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });

  // ── Tourist form ─────────────────────────────────────────────
  function resetTouristForm() {
    editingTouristId = "";
    touristForm.reset();
    touristForm.elements.id.value = "";
    if (touristFormTitle) touristFormTitle.textContent = "New tourist";
    if (touristFormStatus) touristFormStatus.textContent = "";
  }

  async function ensureDefaultGroup() {
    if (groups.length) return groups[0];
    if (!tripId) {
      alert("Open a trip first.");
      return null;
    }
    // Auto-create a default group named after the trip (used for FIT trips)
    const tripName = (document.querySelector("#active-trip h2")?.textContent || "Main").trim();
    try {
      const created = await fetchJson("/api/tourist-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId, name: tripName.slice(0, 80), headcount: 1 }),
      });
      const g = created.entry || created;
      groups.push(g);
      renderGroupOptions();
      return g;
    } catch (err) {
      alert("Could not create a group automatically: " + (err.message || err));
      return null;
    }
  }

  touristToggleBtn?.addEventListener("click", async () => {
    const g = await ensureDefaultGroup();
    if (!g) return;
    resetTouristForm();
    openModal(touristFormPanel);
  });

  touristFormPanel?.addEventListener("click", (e) => {
    if (e.target.dataset?.action === "close-tourist-modal") closeModal(touristFormPanel);
  });

  // Auto-uppercase passport-related inputs on the legacy tourist form
  const UPPER_NAMES = new Set(["firstName", "lastName", "nationality", "passportNumber", "passportIssuePlace", "registrationNumber"]);
  touristForm?.addEventListener("input", (e) => {
    const el = e.target;
    if (!(el instanceof HTMLInputElement)) return;
    if (!UPPER_NAMES.has(el.name)) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const upper = el.value.toUpperCase();
    if (upper !== el.value) {
      el.value = upper;
      try { el.setSelectionRange(start, end); } catch {}
    }
  });

  touristForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = buildPayload(touristForm);
    delete payload.id;
    try {
      touristFormStatus.textContent = editingTouristId ? "Saving..." : "Creating...";
      await fetchJson(editingTouristId ? `/api/tourists/${editingTouristId}` : "/api/tourists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      touristFormStatus.textContent = "Saved.";
      closeModal(touristFormPanel);
      resetTouristForm();
      await loadGroupsAndTourists(tripId);
    } catch (err) {
      touristFormStatus.textContent = err.message || "Could not save tourist.";
    }
  });

  touristListNode?.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-tourist-action]");
    if (!btn) return;
    const action = btn.dataset.touristAction;
    const id = btn.dataset.id;
    const tourist = tourists.find((t) => t.id === id);
    if (!tourist) return;
    if (action === "edit") {
      editingTouristId = id;
      [
        "firstName", "lastName", "gender", "dob", "nationality",
        "passportNumber", "passportIssueDate", "passportExpiry", "passportIssuePlace",
        "registrationNumber", "phone", "email", "notes", "roomType", "roomCode",
      ].forEach((key) => {
        if (touristForm.elements[key]) touristForm.elements[key].value = tourist[key] || "";
      });
      touristForm.elements.groupId.value = tourist.groupId || "";
      if (touristFormTitle) touristFormTitle.textContent = `Edit tourist ${tourist.serial}`;
      openModal(touristFormPanel);
    } else if (action === "delete") {
      if (!confirm(`Delete tourist ${tourist.serial}?`)) return;
      try {
        await fetchJson(`/api/tourists/${id}`, { method: "DELETE" });
        await loadGroupsAndTourists(tripId);
      } catch (err) {
        alert(err.message || "Could not delete tourist.");
      }
    }
  });

  touristFilterGroup?.addEventListener("change", renderTourists);
  touristFilterName?.addEventListener("input", renderTourists);

  touristListNode?.addEventListener("change", (e) => {
    const target = e.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.id === "tourist-select-all") {
      const boxes = touristListNode.querySelectorAll(".tourist-select");
      boxes.forEach((b) => {
        b.checked = target.checked;
        const id = b.dataset.id;
        if (target.checked) selectedTouristIds.add(id);
        else selectedTouristIds.delete(id);
      });
    } else if (target.classList.contains("tourist-select")) {
      const id = target.dataset.id;
      if (target.checked) selectedTouristIds.add(id);
      else selectedTouristIds.delete(id);
      const selectAll = touristListNode.querySelector("#tourist-select-all");
      if (selectAll) {
        const boxes = touristListNode.querySelectorAll(".tourist-select");
        const allOn = boxes.length > 0 && Array.from(boxes).every((b) => b.checked);
        selectAll.checked = allOn;
      }
    }
  });

  // Hook into the existing trip-tab-bar
  const tabBar = document.getElementById("trip-tab-bar");
  tabBar?.addEventListener("click", (e) => {
    const tab = e.target.closest(".trip-tab");
    if (!tab) return;
    const id = tab.dataset.tab;
    if (id === "groups-section" || id === "tourists-section") {
      const tripParam = getTripIdFromUrl();
      if (tripParam && tripParam !== tripId) {
        loadGroupsAndTourists(tripParam);
      }
    }
  });

  // Initial load if tripId already in URL
  if (getTripIdFromUrl()) {
    loadGroupsAndTourists(getTripIdFromUrl());
  }
})();
