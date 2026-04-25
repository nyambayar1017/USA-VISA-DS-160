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
      renderGroups();
      renderTourists();
      renderGroupOptions();
    } catch (err) {
      console.warn("trip-extras load failed:", err);
    }
  }

  function renderGroups() {
    if (!groups.length) {
      groupListNode.innerHTML = '<p class="empty">No groups yet. Click "Add group" to create one.</p>';
      return;
    }
    groupListNode.innerHTML = `
      <div class="camp-table-wrap">
        <table class="camp-table reservation-addon-table">
          <thead>
            <tr>
              <th>Serial</th>
              <th>Group name</th>
              <th>Leader</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Headcount</th>
              <th>Tourists</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${groups
              .map((g) => {
                const inGroup = tourists.filter((t) => t.groupId === g.id).length;
                return `
                  <tr>
                    <td><strong>${escapeHtml(g.serial)}</strong></td>
                    <td>${escapeHtml(g.name)}</td>
                    <td>${escapeHtml(g.leaderName || "-")}</td>
                    <td>${escapeHtml(g.leaderEmail || "-")}</td>
                    <td>${escapeHtml(g.leaderPhone || "-")}</td>
                    <td class="table-center">${g.headcount || "-"}</td>
                    <td class="table-center">${inGroup}</td>
                    <td>
                      <div class="trip-row-actions trip-row-actions-inline">
                        <button type="button" class="table-link compact secondary" data-group-action="filter" data-id="${g.id}">View tourists</button>
                        <button type="button" class="table-link compact secondary" data-group-action="edit" data-id="${g.id}">Edit</button>
                        <button type="button" class="table-link compact secondary" data-group-action="delete" data-id="${g.id}">Delete</button>
                      </div>
                    </td>
                  </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>
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
              <th>Serial</th>
              <th>Last name</th>
              <th>First name</th>
              <th>Group</th>
              <th>Nationality</th>
              <th>Passport #</th>
              <th>Passport expiry</th>
              <th>Reg #</th>
              <th>Phone</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (t) => `
                  <tr>
                    <td><strong>${escapeHtml(t.serial)}</strong></td>
                    <td>${escapeHtml(t.lastName || "")}</td>
                    <td>${escapeHtml(t.firstName || "")}</td>
                    <td>${escapeHtml(t.groupSerial || "-")}</td>
                    <td>${escapeHtml(t.nationality || "-")}</td>
                    <td>${escapeHtml(t.passportNumber || "-")}</td>
                    <td>${escapeHtml(t.passportExpiry || "-")}</td>
                    <td>${escapeHtml(t.registrationNumber || "-")}</td>
                    <td>${escapeHtml(t.phone || "-")}</td>
                    <td>
                      <div class="trip-row-actions trip-row-actions-inline">
                        <button type="button" class="table-link compact secondary" data-tourist-action="edit" data-id="${t.id}">Edit</button>
                        <button type="button" class="table-link compact secondary" data-tourist-action="delete" data-id="${t.id}">Delete</button>
                      </div>
                    </td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  // ── Group form ───────────────────────────────────────────────
  function resetGroupForm() {
    editingGroupId = "";
    groupForm.reset();
    groupForm.elements.id.value = "";
    if (groupFormTitle) groupFormTitle.textContent = "New group";
    if (groupStatus) groupStatus.textContent = "";
  }

  groupToggleBtn?.addEventListener("click", () => {
    if (!getTripIdFromUrl()) {
      alert("Open a trip first to add groups.");
      return;
    }
    resetGroupForm();
    openModal(groupFormPanel);
  });

  groupFormPanel?.addEventListener("click", (e) => {
    if (e.target.dataset?.action === "close-group-modal") closeModal(groupFormPanel);
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
    const action = btn.dataset.groupAction;
    const id = btn.dataset.id;
    const group = groups.find((g) => g.id === id);
    if (!group) return;
    if (action === "edit") {
      editingGroupId = id;
      groupForm.elements.name.value = group.name || "";
      groupForm.elements.headcount.value = group.headcount || "";
      groupForm.elements.leaderName.value = group.leaderName || "";
      groupForm.elements.leaderEmail.value = group.leaderEmail || "";
      groupForm.elements.leaderPhone.value = group.leaderPhone || "";
      groupForm.elements.leaderNationality.value = group.leaderNationality || "";
      groupForm.elements.notes.value = group.notes || "";
      if (groupFormTitle) groupFormTitle.textContent = `Edit group ${group.serial}`;
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

  touristToggleBtn?.addEventListener("click", () => {
    if (!groups.length) {
      alert("Create a group first, then add tourists into it.");
      return;
    }
    resetTouristForm();
    openModal(touristFormPanel);
  });

  touristFormPanel?.addEventListener("click", (e) => {
    if (e.target.dataset?.action === "close-tourist-modal") closeModal(touristFormPanel);
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
        "registrationNumber", "phone", "email", "notes",
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
