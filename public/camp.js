const tripForm = document.querySelector("#trip-form");
const tripStatus = document.querySelector("#trip-status");
const tripList = document.querySelector("#trip-list");
const tripToggleForm = document.querySelector("#trip-toggle-form");
const tripFormPanel = document.querySelector("#trip-form-panel");
const activeTripBox = document.querySelector("#active-trip");
const activeTripReservations = document.querySelector("#active-trip-reservations");
const campForm = document.querySelector("#camp-form");
const campStatus = document.querySelector("#camp-status");
const campList = document.querySelector("#camp-list");
const campToggleForm = document.querySelector("#camp-toggle-form");
const campFormPanel = document.querySelector("#camp-form-panel");
const reservationTripSelect = document.querySelector("#reservation-trip-select");
const campNameSelect = document.querySelector("#camp-name-select");
const staffAssignmentSelect = document.querySelector("#staff-assignment-select");
const roomTypeSelect = document.querySelector("#room-type-select");
const tripLanguageSelect = document.querySelector("#trip-language-select");
const tripFilterName = document.querySelector("#trip-filter-name");
const tripFilterStartDate = document.querySelector("#trip-filter-start-date");
const tripFilterStatus = document.querySelector("#trip-filter-status");
const tripFilterLanguage = document.querySelector("#trip-filter-language");
const tripFilterCreatedDate = document.querySelector("#trip-filter-created-date");
const filterCampName = document.querySelector("#filter-camp-name");
const filterTripName = document.querySelector("#filter-trip-name");
const filterTripStartDate = document.querySelector("#filter-trip-start-date");
const filterReservedDate = document.querySelector("#filter-reserved-date");
const filterStatus = document.querySelector("#filter-status");
const campExportPdf = document.querySelector("#camp-export-pdf");
const campCheckin = document.querySelector("#camp-checkin");
const campCheckout = document.querySelector("#camp-checkout");
const campStays = document.querySelector("#camp-stays");
const settingsStatus = document.querySelector("#settings-status");
const campCreatedDate = campForm.querySelector('[name="createdDate"]');

let currentTrips = [];
let currentEntries = [];
let campSettings = {
  campNames: [],
  staffAssignments: [],
  roomChoices: [],
};
let activeTripId = "";
let editingReservationId = "";
let editingTripId = "";
let currentPage = 1;
let currentTripPage = 1;
let selectedReservationIds = new Set();
let activeTripDayFilter = "";
let activeTripPanelHidden = false;
const PAGE_SIZE = 20;

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatMoney(value) {
  return new Intl.NumberFormat("en-US").format(Number(value || 0));
}

function formatDate(value, withTime = false) {
  if (!value) {
    return "-";
  }
  const iso = value.includes("T") ? value : `${value}T00:00:00`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  if (withTime) {
    return iso.slice(0, 16).replace("T", " ");
  }
  return iso.slice(0, 10);
}

function normalizeStatus(status) {
  return String(status || "").trim().toLowerCase();
}

function formatStatusLabel(status) {
  const labels = {
    planning: "Planning",
    confirmed: "Confirmed",
    travelling: "Travelling",
    completed: "Completed",
    cancelled: "Cancelled",
    rejected: "Rejected",
    pending: "Pending",
  };
  return labels[normalizeStatus(status)] || status || "-";
}

function sortByDateAsc(items, field) {
  return [...items].sort((left, right) => String(left[field] || "").localeCompare(String(right[field] || "")));
}

function renderOptionMarkup(values, placeholder) {
  return [`<option value="">${placeholder}</option>`]
    .concat(values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`))
    .join("");
}

function addDays(dateValue, days) {
  if (!dateValue || !days) {
    return "";
  }
  const base = new Date(`${dateValue}T00:00:00`);
  base.setDate(base.getDate() + Math.max(Number(days), 0));
  return base.toISOString().slice(0, 10);
}

function diffDays(startValue, endValue) {
  if (!startValue || !endValue) {
    return "";
  }
  const start = new Date(`${startValue}T00:00:00`);
  const end = new Date(`${endValue}T00:00:00`);
  const delta = Math.round((end - start) / (1000 * 60 * 60 * 24));
  return String(Math.max(delta, 1));
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error("Server returned an unexpected response.");
  }
  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data;
}

function buildPayload(formNode) {
  return Object.fromEntries(new FormData(formNode).entries());
}

function getTripById(tripId) {
  return currentTrips.find((trip) => trip.id === tripId) || null;
}

function getTripDayLabel(entry) {
  const trip = getTripById(entry.tripId);
  if (!trip?.startDate || !entry.checkIn) {
    return "-";
  }
  const start = new Date(`${trip.startDate}T00:00:00`);
  const checkIn = new Date(`${entry.checkIn}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(checkIn.getTime())) {
    return "-";
  }
  const startDay = Math.round((checkIn - start) / (1000 * 60 * 60 * 24)) + 1;
  if (startDay <= 0) {
    return "-";
  }
  const stayCount = Math.max(Number(entry.nights || 1), 1);
  if (stayCount === 1) {
    return `Day ${startDay}`;
  }
  const endDay = startDay + stayCount - 1;
  return `Day ${startDay},${endDay}`;
}

function syncCheckoutFromStay() {
  if (!campCheckin.value) {
    campCheckout.value = "";
    return;
  }
  const stays = Math.max(Number(campStays.value || 0), 1);
  campCheckout.value = addDays(campCheckin.value, stays);
}

function syncStayFromCheckout() {
  campStays.value = diffDays(campCheckin.value, campCheckout.value);
}

function setActiveTrip(tripId) {
  activeTripId = tripId || "";
  activeTripDayFilter = "";
  activeTripPanelHidden = false;
  reservationTripSelect.value = activeTripId;
  currentPage = 1;
  renderTrips();
  renderActiveTrip();
  renderEntries();
  renderActiveTripReservations();
  requestAnimationFrame(() => {
    activeTripReservations.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function getFilteredTrips() {
  return sortByDateAsc(currentTrips, "startDate").filter((trip) => {
    const matchesTripName = !tripFilterName.value || String(trip.tripName || "").toLowerCase().includes(tripFilterName.value.trim().toLowerCase());
    const matchesStartDate = !tripFilterStartDate.value || String(trip.startDate || "") >= tripFilterStartDate.value;
    const matchesStatus = !tripFilterStatus.value || trip.status === tripFilterStatus.value;
    const matchesLanguage = !tripFilterLanguage.value || trip.language === tripFilterLanguage.value;
    const matchesCreated = !tripFilterCreatedDate.value || String(trip.createdAt || "").slice(0, 16) === tripFilterCreatedDate.value;
    return matchesTripName && matchesStartDate && matchesStatus && matchesLanguage && matchesCreated;
  });
}

function getFilteredEntries() {
  const campNeedle = filterCampName.value;
  const tripId = filterTripName.value;
  const reservedDate = filterReservedDate.value;
  const status = filterStatus.value;

  return sortByDateAsc(currentEntries, "checkIn").filter((entry) => {
    const trip = getTripById(entry.tripId);
    const matchesCamp = !campNeedle || entry.campName === campNeedle;
    const matchesTrip = !tripId || entry.tripId === tripId;
    const matchesStatus = !status || entry.status === status;
    const matchesTripStart = !filterTripStartDate.value || String(trip?.startDate || "") === filterTripStartDate.value;
    const matchesReservedDate = !reservedDate || String(entry.createdDate || "").slice(0, 10) === reservedDate;
    return matchesCamp && matchesTrip && matchesStatus && matchesTripStart && matchesReservedDate;
  });
}

function statusClass(entry) {
  const status = normalizeStatus(entry.status);
  return status ? `status-${status}` : "";
}

function renderSettingsOptions() {
  const currentTripFilter = filterTripName.value;
  const currentCampFilter = filterCampName.value;
  const currentLanguageFilter = tripFilterLanguage.value;
  const currentReservationTrip = reservationTripSelect.value;
  const languages = [...new Set(currentTrips.map((trip) => trip.language).filter(Boolean).concat(["English", "French", "Mongolian", "Korean", "Spanish", "Italian", "Other"]))];
  tripLanguageSelect.innerHTML = renderOptionMarkup(languages, "Choose language");
  tripFilterLanguage.innerHTML = renderOptionMarkup(languages, "All languages");
  reservationTripSelect.innerHTML = `<option value="">Choose trip</option>${currentTrips
    .map((trip) => `<option value="${trip.id}">${escapeHtml(trip.tripName)}</option>`)
    .join("")}`;
  filterTripName.innerHTML = `<option value="">All trips</option>${currentTrips
    .map((trip) => `<option value="${trip.id}">${escapeHtml(trip.tripName)}</option>`)
    .join("")}`;
  campNameSelect.innerHTML = renderOptionMarkup(campSettings.campNames, "Choose camp");
  filterCampName.innerHTML = renderOptionMarkup(campSettings.campNames, "All camps");
  staffAssignmentSelect.innerHTML = renderOptionMarkup(campSettings.staffAssignments, "Choose staff");
  roomTypeSelect.innerHTML = renderOptionMarkup(campSettings.roomChoices, "Choose room type");
  tripFilterLanguage.value = currentLanguageFilter;
  filterTripName.value = currentTripFilter;
  filterCampName.value = currentCampFilter;

  if (activeTripId) {
    reservationTripSelect.value = activeTripId;
    filterTripName.value = activeTripId;
  } else if (currentReservationTrip) {
    reservationTripSelect.value = currentReservationTrip;
  }
}

function renderSettingGroup(groupName, values) {
  const container = document.querySelector(`#settings-${groupName}`);
  if (!container) {
    return;
  }
  container.innerHTML = values
    .map(
      (value) => `
        <span class="setting-pill">
          ${escapeHtml(value)}
          <button type="button" data-action="remove-setting" data-group="${groupName}" data-value="${escapeHtml(value)}">×</button>
        </span>
      `
    )
    .join("");
}

function renderAllSettings() {
  renderSettingGroup("campNames", campSettings.campNames);
  renderSettingGroup("staffAssignments", campSettings.staffAssignments);
  renderSettingGroup("roomChoices", campSettings.roomChoices);
  renderSettingsOptions();
}

function renderTrips() {
  const trips = getFilteredTrips();
  if (!trips.length) {
    tripList.innerHTML = '<p class="empty">No trips for the selected filters.</p>';
    return;
  }

  const totalPages = Math.max(1, Math.ceil(trips.length / PAGE_SIZE));
  currentTripPage = Math.min(currentTripPage, totalPages);
  const startIndex = (currentTripPage - 1) * PAGE_SIZE;
  const visibleTrips = trips.slice(startIndex, startIndex + PAGE_SIZE);

  tripList.innerHTML = `
    <div class="camp-table-wrap">
      <table class="camp-table trip-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Trip</th>
            <th>Start</th>
            <th>Pax</th>
            <th>Staff</th>
            <th>Language</th>
            <th>Status</th>
            <th>Created</th>
            <th>Manager</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${visibleTrips
            .map(
              (trip, index) => `
                <tr class="${activeTripId === trip.id ? "is-trip-active" : ""}">
                  <td>${startIndex + index + 1}</td>
                  <td class="table-primary-cell">
                    <button type="button" class="table-link compact secondary trip-select-link" data-action="select-trip" data-trip-id="${trip.id}">${escapeHtml(trip.tripName)}</button>
                  </td>
                  <td>${formatDate(trip.startDate)}</td>
                  <td class="trip-pax-cell">${trip.participantCount}</td>
                  <td>${trip.staffCount}</td>
                  <td>${escapeHtml(trip.language)}</td>
                  <td><span class="status-pill is-${normalizeStatus(trip.status)}">${formatStatusLabel(trip.status)}</span></td>
                  <td>${formatDate(trip.createdAt, true)}</td>
                  <td>${escapeHtml(trip.createdBy?.name || trip.createdBy?.email || "-")}</td>
                  <td>
                    <div class="trip-row-actions">
                      <select class="inline-status-select" data-action="trip-status" data-trip-id="${trip.id}">
                        ${["planning", "confirmed", "travelling", "completed", "cancelled"]
                          .map((option) => `<option value="${option}" ${trip.status === option ? "selected" : ""}>${formatStatusLabel(option)}</option>`)
                          .join("")}
                      </select>
                      <button type="button" class="table-action compact secondary" data-action="edit-trip" data-trip-id="${trip.id}">Edit</button>
                      <button type="button" class="table-action compact danger" data-action="delete-trip" data-trip-id="${trip.id}">Delete</button>
                    </div>
                  </td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    </div>
    <div class="table-pagination">
      <p>Showing ${startIndex + 1}-${startIndex + visibleTrips.length} of ${trips.length}</p>
      <div class="pagination-actions">
        <button type="button" data-action="trip-page-prev" ${currentTripPage === 1 ? "disabled" : ""}>Previous</button>
        <button type="button" data-action="trip-page-next" ${currentTripPage === totalPages ? "disabled" : ""}>Next</button>
      </div>
    </div>
  `;
}

function renderActiveTrip() {
  const trip = getTripById(activeTripId);
  if (!trip) {
    activeTripBox.className = "camp-active-trip empty";
    activeTripBox.innerHTML = `
      <strong>No active trip selected</strong>
      <span>Create or open a trip first.</span>
    `;
    return;
  }

  const tripReservations = currentEntries.filter((entry) => entry.tripId === trip.id);
  const totalInternalCost = tripReservations.reduce((sum, entry) => sum + Number(entry.totalPayment || 0), 0);
  activeTripBox.className = "camp-active-trip";
  activeTripBox.innerHTML = `
    <div>
      <strong>${escapeHtml(trip.tripName)}</strong>
      <span>${formatDate(trip.startDate)} · ${escapeHtml(trip.language || "-")} · ${trip.participantCount || 0} pax / ${trip.staffCount || 0} staff · ${trip.totalDays || 1} days</span>
    </div>
    <div>
      <strong>${tripReservations.length} reservations</strong>
      <span>Internal camp cost: ${formatMoney(totalInternalCost)}</span>
    </div>
  `;
}

function renderActiveTripReservations() {
  if (!activeTripId) {
    activeTripReservations.innerHTML = "";
    return;
  }
  const trip = getTripById(activeTripId);
  const baseEntries = sortByDateAsc(currentEntries.filter((entry) => entry.tripId === activeTripId), "checkIn");
  const totalDays = Math.max(Number(trip?.totalDays || 1), 1);
  const entries = activeTripDayFilter
    ? baseEntries.filter((entry) => {
        if (!trip?.startDate || !entry.checkIn) return false;
        const start = new Date(`${trip.startDate}T00:00:00`);
        const checkIn = new Date(`${entry.checkIn}T00:00:00`);
        const delta = Math.round((checkIn - start) / (1000 * 60 * 60 * 24)) + 1;
        return String(delta) === String(activeTripDayFilter);
      })
    : baseEntries;
  if (activeTripPanelHidden) {
    activeTripReservations.innerHTML = "";
    return;
  }
  if (!entries.length) {
    activeTripReservations.innerHTML = `
      <div class="section-head">
        <h2>${escapeHtml(trip?.tripName || "Trip")} reservations</h2>
        <div class="camp-toolbar trip-detail-toolbar">
          <label class="trip-day-filter-label">
            <span>Filter by day</span>
            <select data-action="trip-day-filter">
              <option value="">All days</option>
              ${Array.from({ length: totalDays }, (_, index) => `<option value="${index + 1}" ${String(index + 1) === String(activeTripDayFilter) ? "selected" : ""}>Day ${index + 1}</option>`).join("")}
            </select>
          </label>
          <button type="button" class="secondary-button" data-action="hide-trip-panel">Hide table</button>
        </div>
      </div>
      <p class="empty">No reservations for this trip yet.</p>
    `;
    return;
  }

  activeTripReservations.innerHTML = `
    <div class="section-head">
      <h2>${escapeHtml(trip?.tripName || "Trip")} reservations</h2>
      <div class="camp-toolbar trip-detail-toolbar">
        <label class="trip-day-filter-label">
          <span>Filter by day</span>
          <select data-action="trip-day-filter">
            <option value="">All days</option>
            ${Array.from({ length: totalDays }, (_, index) => `<option value="${index + 1}" ${String(index + 1) === String(activeTripDayFilter) ? "selected" : ""}>Day ${index + 1}</option>`).join("")}
          </select>
        </label>
        <button type="button" class="secondary-button" data-action="hide-trip-panel">Hide table</button>
      </div>
    </div>
    <div class="camp-table-wrap">
      <table class="camp-table camp-table-detail">
        <thead>
          <tr>
            <th class="checkbox-col"><input type="checkbox" data-action="toggle-select-all-detail" ${entries.every((entry) => selectedReservationIds.has(entry.id)) ? "checked" : ""} /></th>
            <th>Trip</th>
            <th>Day</th>
            <th>Camp</th>
            <th>Type</th>
            <th>Clients</th>
            <th>Staff</th>
            <th>Check-in</th>
            <th>Stays</th>
            <th>Check-out</th>
            <th>Gers</th>
            <th>Room</th>
            <th>Assigned Staff</th>
            <th>Status</th>
            <th>Created by</th>
            <th>Notes</th>
            <th>Meals</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${entries
            .map((entry, index) =>
              editingReservationId === entry.id
                ? renderEditableRow(entry, index)
                : renderReadOnlyRow(entry, index)
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderReadOnlyRow(entry, index) {
  const isSelected = selectedReservationIds.has(entry.id);
  const meals = [entry.breakfast === "Yes" && "Breakfast", entry.lunch === "Yes" && "Lunch", entry.dinner === "Yes" && "Dinner"]
    .filter(Boolean)
    .join(" / ");
  return `
    <tr class="${statusClass(entry)}">
      <td class="checkbox-col">
        <input type="checkbox" class="row-selector" data-action="toggle-select" data-id="${entry.id}" ${isSelected ? "checked" : ""} />
      </td>
      <td class="table-primary-cell table-nowrap">${escapeHtml(entry.tripName)}</td>
      <td class="table-nowrap">${getTripDayLabel(entry)}</td>
      <td>${escapeHtml(entry.campName)}</td>
      <td>${escapeHtml(entry.reservationType === "hotel" ? "Буудал" : entry.reservationType === "herder" ? "Малчин айл" : "Бааз")}</td>
      <td>${entry.clientCount}</td>
      <td>${entry.staffCount}</td>
      <td class="table-nowrap">${formatDate(entry.checkIn)}</td>
      <td class="table-center">${entry.nights}</td>
      <td class="table-nowrap">${formatDate(entry.checkOut)}</td>
      <td class="table-nowrap table-center">${entry.gerCount}</td>
      <td>${escapeHtml(entry.roomType)}</td>
      <td>${escapeHtml(entry.staffAssignment || "-")}</td>
      <td><span class="status-pill is-${normalizeStatus(entry.status)}">${formatStatusLabel(entry.status)}</span></td>
      <td>${escapeHtml(entry.createdBy?.name || entry.createdBy?.email || "-")}</td>
      <td>
        <strong>${escapeHtml(entry.notes || "-")}</strong>
      </td>
      <td>${escapeHtml(meals || "-")}</td>
      <td>
        <div class="camp-row-actions compact stacked-pills">
          <button type="button" class="table-action compact secondary" data-action="edit" data-id="${entry.id}">Edit</button>
          <button type="button" class="table-action compact secondary" data-action="view-pdf" data-id="${entry.id}">View</button>
          <button type="button" class="table-action compact" data-action="download-pdf" data-id="${entry.id}">PDF</button>
          <button type="button" class="table-action compact danger" data-action="delete-reservation" data-id="${entry.id}">Delete</button>
        </div>
      </td>
    </tr>
  `;
}

function renderEditableRow(entry, index) {
  return `
    <tr class="is-editing ${statusClass(entry)}">
      <td>${index + 1}</td>
      <td>${escapeHtml(entry.tripName)}</td>
      <td class="table-nowrap">${getTripDayLabel(entry)}</td>
      <td>
        <select data-role="campName" data-id="${entry.id}">
          ${campSettings.campNames.map((option) => `<option value="${escapeHtml(option)}" ${entry.campName === option ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}
        </select>
      </td>
      <td>
        <select data-role="reservationType" data-id="${entry.id}">
          <option value="camp" ${entry.reservationType === "camp" ? "selected" : ""}>Баазын захиалга</option>
          <option value="hotel" ${entry.reservationType === "hotel" ? "selected" : ""}>Буудлын захиалга</option>
          <option value="herder" ${entry.reservationType === "herder" ? "selected" : ""}>Малчин айлын захиалга</option>
        </select>
      </td>
      <td><input data-role="clientCount" data-id="${entry.id}" type="number" min="1" value="${entry.clientCount}" /></td>
      <td><input data-role="staffCount" data-id="${entry.id}" type="number" min="0" value="${entry.staffCount}" /></td>
      <td><input data-role="checkIn" data-id="${entry.id}" type="date" value="${entry.checkIn}" /></td>
      <td><input data-role="nights" data-id="${entry.id}" type="number" min="1" value="${entry.nights}" /></td>
      <td><input data-role="checkOut" data-id="${entry.id}" type="date" value="${entry.checkOut}" /></td>
      <td><input data-role="gerCount" data-id="${entry.id}" type="number" min="1" value="${entry.gerCount}" /></td>
      <td>
        <select data-role="roomType" data-id="${entry.id}">
          ${campSettings.roomChoices
            .map((option) => `<option value="${escapeHtml(option)}" ${entry.roomType === option ? "selected" : ""}>${escapeHtml(option)}</option>`)
            .join("")}
        </select>
      </td>
      <td>
        <select data-role="staffAssignment" data-id="${entry.id}">
          <option value="">Choose staff</option>
          ${campSettings.staffAssignments
            .map((option) => `<option value="${escapeHtml(option)}" ${entry.staffAssignment === option ? "selected" : ""}>${escapeHtml(option)}</option>`)
            .join("")}
        </select>
      </td>
      <td>
        <select data-role="status" data-id="${entry.id}">
          ${["pending", "confirmed", "cancelled", "rejected"]
            .map((option) => `<option value="${option}" ${entry.status === option ? "selected" : ""}>${formatStatusLabel(option)}</option>`)
            .join("")}
        </select>
      </td>
      <td>${escapeHtml(entry.createdBy?.name || entry.createdBy?.email || "-")}</td>
      <td>
        <textarea data-role="notes" data-id="${entry.id}" rows="2">${escapeHtml(entry.notes || "")}</textarea>
      </td>
      <td>
        <div class="camp-inline-grid">
          <select data-role="breakfast" data-id="${entry.id}">
            <option value="No" ${entry.breakfast === "No" ? "selected" : ""}>Breakfast: No</option>
            <option value="Yes" ${entry.breakfast === "Yes" ? "selected" : ""}>Breakfast: Yes</option>
          </select>
          <select data-role="lunch" data-id="${entry.id}">
            <option value="No" ${entry.lunch === "No" ? "selected" : ""}>Lunch: No</option>
            <option value="Yes" ${entry.lunch === "Yes" ? "selected" : ""}>Lunch: Yes</option>
          </select>
          <select data-role="dinner" data-id="${entry.id}">
            <option value="No" ${entry.dinner === "No" ? "selected" : ""}>Dinner: No</option>
            <option value="Yes" ${entry.dinner === "Yes" ? "selected" : ""}>Dinner: Yes</option>
          </select>
        </div>
      </td>
      <td class="camp-row-actions compact">
        <button type="button" class="table-action compact" data-action="save" data-id="${entry.id}">Save</button>
        <button type="button" class="table-action compact secondary" data-action="cancel-edit">Cancel</button>
      </td>
    </tr>
  `;
}

function renderEntries() {
  const entries = getFilteredEntries();
  if (!entries.length) {
    campList.innerHTML = '<p class="empty">No reservations for the selected filters.</p>';
    return;
  }

  const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  currentPage = Math.min(currentPage, totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const visibleEntries = entries.slice(startIndex, startIndex + PAGE_SIZE);

  campList.innerHTML = `
    <div class="camp-table-wrap">
      <table class="camp-table">
        <thead>
          <tr>
            <th class="checkbox-col"><input type="checkbox" data-action="toggle-select-all" ${visibleEntries.length && visibleEntries.every((entry) => selectedReservationIds.has(entry.id)) ? "checked" : ""} /></th>
            <th>Trip</th>
            <th>Day</th>
            <th>Camp</th>
            <th>Type</th>
            <th>Clients</th>
            <th>Staff</th>
            <th>Check-in</th>
            <th>Stays</th>
            <th>Check-out</th>
            <th>Gers</th>
            <th>Room</th>
            <th>Assigned Staff</th>
            <th>Status</th>
            <th>Created by</th>
            <th>Notes</th>
            <th>Meals</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${visibleEntries
            .map((entry, index) =>
              editingReservationId === entry.id
                ? renderEditableRow(entry, startIndex + index)
                : renderReadOnlyRow(entry, startIndex + index)
            )
            .join("")}
        </tbody>
      </table>
    </div>
    <div class="table-pagination">
      <p>Showing ${startIndex + 1}-${startIndex + visibleEntries.length} of ${entries.length}</p>
      <div class="pagination-actions">
        <button type="button" data-action="page-prev" ${currentPage === 1 ? "disabled" : ""}>Previous</button>
        <button type="button" data-action="page-next" ${currentPage === totalPages ? "disabled" : ""}>Next</button>
      </div>
    </div>
  `;
}

async function loadTrips() {
  const payload = await fetchJson("/api/camp-trips");
  currentTrips = payload.entries || [];
  if (activeTripId && !getTripById(activeTripId)) {
    activeTripId = "";
  }
  renderSettingsOptions();
  renderTrips();
  renderActiveTrip();
}

async function loadSettings() {
  const payload = await fetchJson("/api/camp-settings");
  campSettings = payload.entry;
  renderAllSettings();
}

async function loadReservations() {
  const payload = await fetchJson("/api/camp-reservations");
  currentEntries = payload.entries || [];
  selectedReservationIds = new Set([...selectedReservationIds].filter((id) => currentEntries.some((entry) => entry.id === id)));
  renderActiveTrip();
  renderActiveTripReservations();
  renderEntries();
}

async function saveSettings() {
  settingsStatus.textContent = "Saving settings...";
  try {
    const payload = {
      campNames: campSettings.campNames,
      staffAssignments: campSettings.staffAssignments,
      roomChoices: campSettings.roomChoices,
    };
    await fetchJson("/api/camp-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    settingsStatus.textContent = "Settings updated.";
    renderAllSettings();
  } catch (error) {
    settingsStatus.textContent = error.message;
  }
}

async function updateTripStatus(id, status) {
  tripStatus.textContent = "Updating trip...";
  try {
    await fetchJson(`/api/camp-trips/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    tripStatus.textContent = "Trip updated.";
    await loadTrips();
  } catch (error) {
    tripStatus.textContent = error.message;
  }
}

function startTripEdit(id) {
  const trip = getTripById(id);
  if (!trip) {
    return;
  }
  editingTripId = id;
  tripFormPanel.classList.remove("is-hidden");
  tripForm.elements.tripName.value = trip.tripName || "";
  tripForm.elements.startDate.value = String(trip.startDate || "").slice(0, 10);
  tripForm.elements.participantCount.value = String(trip.participantCount || 0);
  tripForm.elements.staffCount.value = String(trip.staffCount || 0);
  tripForm.elements.totalDays.value = String(trip.totalDays || 1);
  tripForm.elements.language.value = trip.language || "";
  tripForm.elements.status.value = trip.status || "planning";
  tripStatus.textContent = `Editing trip: ${trip.tripName}`;
}

async function updateReservation(id) {
  const roles = [
    "campName",
    "reservationType",
    "createdDate",
    "clientCount",
    "staffCount",
    "staffAssignment",
    "checkIn",
    "checkOut",
    "nights",
    "gerCount",
    "roomType",
    "breakfast",
    "lunch",
    "dinner",
    "deposit",
    "totalPayment",
    "balancePayment",
    "status",
    "notes",
  ];
  const payload = {};

  roles.forEach((role) => {
    const node = document.querySelector(`[data-role="${role}"][data-id="${id}"]`);
    if (node) {
      payload[role] = node.value;
    }
  });

  campStatus.textContent = "Updating reservation...";

  try {
    await fetchJson(`/api/camp-reservations/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    editingReservationId = "";
    campStatus.textContent = "Reservation updated.";
    await loadReservations();
  } catch (error) {
    campStatus.textContent = error.message;
  }
}

async function deleteTrip(id) {
  tripStatus.textContent = "Deleting trip...";
  try {
    await fetchJson(`/api/camp-trips/${id}`, { method: "DELETE" });
    if (activeTripId === id) {
      activeTripId = "";
      editingReservationId = "";
    }
    tripStatus.textContent = "Trip deleted.";
    await loadTrips();
    await loadReservations();
  } catch (error) {
    tripStatus.textContent = error.message;
  }
}

async function deleteReservation(id) {
  campStatus.textContent = "Deleting reservation...";
  try {
    await fetchJson(`/api/camp-reservations/${id}`, { method: "DELETE" });
    if (editingReservationId === id) {
      editingReservationId = "";
    }
    campStatus.textContent = "Reservation deleted.";
    await loadReservations();
  } catch (error) {
    campStatus.textContent = error.message;
  }
}

async function exportCurrentReservations() {
  const selectedEntries = getFilteredEntries().filter((entry) => selectedReservationIds.has(entry.id));
  const entries = selectedEntries.length ? selectedEntries : getFilteredEntries();
  if (!entries.length) {
    campStatus.textContent = "No reservations to export.";
    return;
  }
  campStatus.textContent = "Preparing PDF export...";
  try {
    const ids = entries.map((entry) => entry.id).join(",");
    const result = await fetchJson(`/api/camp-reservations/export?ids=${encodeURIComponent(ids)}`);
    const link = document.createElement("a");
    link.href = appendDownloadQuery(result.entry.pdfPath);
    link.download = "camp-reservations.pdf";
    document.body.appendChild(link);
    link.click();
    link.remove();
    campStatus.textContent = "PDF export ready.";
  } catch (error) {
    campStatus.textContent = error.message;
  }
}

tripForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  tripStatus.textContent = editingTripId ? "Updating trip..." : "Saving trip...";

  try {
    const result = await fetchJson(editingTripId ? `/api/camp-trips/${editingTripId}` : "/api/camp-trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPayload(tripForm)),
    });
    tripStatus.textContent = editingTripId ? `Trip updated: ${result.entry.tripName}` : `Trip created: ${result.entry.tripName}`;
    tripForm.reset();
    editingTripId = "";
    tripFormPanel.classList.add("is-hidden");
    await loadTrips();
    setActiveTrip(result.entry.id);
  } catch (error) {
    tripStatus.textContent = error.message;
  }
});

campForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  campStatus.textContent = "Saving reservation...";

  const selectedTrip = getTripById(reservationTripSelect.value || activeTripId);
  if (!selectedTrip) {
    campStatus.textContent = "Please choose a trip first.";
    return;
  }

  const payload = buildPayload(campForm);
  payload.tripId = selectedTrip.id;
  payload.tripName = selectedTrip.tripName;

  try {
    await fetchJson("/api/camp-reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    campStatus.textContent = "Reservation saved.";
    campForm.reset();
    campCreatedDate.value = new Date().toISOString().slice(0, 10);
    campForm.querySelector('[name="clientCount"]').value = "2";
    campForm.querySelector('[name="staffCount"]').value = "0";
    campForm.querySelector('[name="gerCount"]').value = "1";
    campForm.querySelector('[name="nights"]').value = "1";
    reservationTripSelect.value = selectedTrip.id;
    syncCheckoutFromStay();
    campFormPanel.classList.add("is-hidden");
    await loadReservations();
  } catch (error) {
    campStatus.textContent = error.message;
  }
});

tripToggleForm.addEventListener("click", () => {
  tripFormPanel.classList.toggle("is-hidden");
});

campToggleForm.addEventListener("click", () => {
  reservationTripSelect.value = activeTripId || reservationTripSelect.value || "";
  campStatus.textContent = activeTripId ? `Adding reservation for: ${getTripById(activeTripId)?.tripName || ""}` : "Choose a trip, then add the reservation.";
  syncCheckoutFromStay();
  campFormPanel.classList.toggle("is-hidden");
});

tripList.addEventListener("click", (event) => {
  const actionTarget = event.target.closest("[data-action]");
  if (!actionTarget) {
    return;
  }

  if (actionTarget.dataset.action === "select-trip") {
    setActiveTrip(actionTarget.dataset.tripId);
    tripStatus.textContent = `Selected trip: ${getTripById(actionTarget.dataset.tripId)?.tripName || ""}`;
    return;
  }

  if (actionTarget.dataset.action === "edit-trip") {
    startTripEdit(actionTarget.dataset.tripId);
    return;
  }

  if (actionTarget.dataset.action === "trip-page-prev") {
    currentTripPage = Math.max(1, currentTripPage - 1);
    renderTrips();
    return;
  }

  if (actionTarget.dataset.action === "trip-page-next") {
    const totalPages = Math.max(1, Math.ceil(getFilteredTrips().length / PAGE_SIZE));
    currentTripPage = Math.min(totalPages, currentTripPage + 1);
    renderTrips();
    return;
  }

  if (actionTarget.dataset.action === "delete-trip") {
    if (window.confirm("Delete this trip and all linked reservations?")) {
      deleteTrip(actionTarget.dataset.tripId);
    }
  }
});

tripList.addEventListener("change", (event) => {
  const select = event.target.closest('[data-action="trip-status"]');
  if (!select) {
    return;
  }
  updateTripStatus(select.dataset.tripId, select.value);
});

function handleCampTableClick(event) {
  const target = event.target.closest("[data-action]");
  if (!target) {
    return;
  }

  const action = target.dataset.action;
  if (action === "edit") {
    editingReservationId = target.dataset.id;
    renderEntries();
    return;
  }
  if (action === "save") {
    updateReservation(target.dataset.id);
    return;
  }
  if (action === "view-pdf") {
    window.open(`/api/camp-reservations/${target.dataset.id}/document?mode=view`, "_blank", "noopener,noreferrer");
    return;
  }
  if (action === "download-pdf") {
    const link = document.createElement("a");
    link.href = `/api/camp-reservations/${target.dataset.id}/document?mode=download`;
    link.download = "";
    document.body.appendChild(link);
    link.click();
    link.remove();
    return;
  }
  if (action === "cancel-edit") {
    editingReservationId = "";
    renderEntries();
    return;
  }
  if (action === "page-prev") {
    currentPage = Math.max(1, currentPage - 1);
    renderEntries();
    return;
  }
  if (action === "page-next") {
    const totalPages = Math.max(1, Math.ceil(getFilteredEntries().length / PAGE_SIZE));
    currentPage = Math.min(totalPages, currentPage + 1);
    renderEntries();
    return;
  }
  if (action === "delete-reservation") {
    if (window.confirm("Delete this reservation?")) {
      deleteReservation(target.dataset.id);
    }
    return;
  }
  if (action === "toggle-select-all") {
    const visibleIds = getFilteredEntries()
      .slice((currentPage - 1) * PAGE_SIZE, (currentPage - 1) * PAGE_SIZE + PAGE_SIZE)
      .map((entry) => entry.id);
    if (target.checked) {
      visibleIds.forEach((id) => selectedReservationIds.add(id));
    } else {
      visibleIds.forEach((id) => selectedReservationIds.delete(id));
    }
    renderEntries();
    renderActiveTripReservations();
    return;
  }
  if (action === "toggle-select-all-detail") {
    const visibleIds = sortByDateAsc(currentEntries.filter((entry) => entry.tripId === activeTripId), "checkIn").map((entry) => entry.id);
    if (target.checked) {
      visibleIds.forEach((id) => selectedReservationIds.add(id));
    } else {
      visibleIds.forEach((id) => selectedReservationIds.delete(id));
    }
    renderEntries();
    renderActiveTripReservations();
    return;
  }
  if (action === "hide-trip-panel") {
    activeTripPanelHidden = true;
    renderActiveTripReservations();
    return;
  }
}

function appendDownloadQuery(path) {
  return path.includes("?") ? `${path}&download=1` : `${path}?download=1`;
}

function handleCampTableInput(event) {
  const node = event.target;
  if (!(node instanceof HTMLElement)) {
    return;
  }
  const id = node.dataset.id;
  if (!id) {
    return;
  }
  const role = node.dataset.role;
  if (role === "checkIn" || role === "nights") {
    const checkInNode = document.querySelector(`[data-role="checkIn"][data-id="${id}"]`);
    const nightsNode = document.querySelector(`[data-role="nights"][data-id="${id}"]`);
    const checkOutNode = document.querySelector(`[data-role="checkOut"][data-id="${id}"]`);
    if (checkInNode && nightsNode && checkOutNode) {
      checkOutNode.value = addDays(checkInNode.value, nightsNode.value);
    }
  }
}

function handleCampTableChange(event) {
  const node = event.target;
  if (!(node instanceof HTMLElement)) {
    return;
  }
  if (node.dataset.action === "trip-day-filter") {
    activeTripDayFilter = node.value;
    renderActiveTripReservations();
    return;
  }
  if (node.dataset.action === "toggle-select") {
    if (node.checked) {
      selectedReservationIds.add(node.dataset.id);
    } else {
      selectedReservationIds.delete(node.dataset.id);
    }
    return;
  }
  const id = node.dataset.id;
  if (!id) {
    return;
  }
  const role = node.dataset.role;
  if (role === "checkOut") {
    const checkInNode = document.querySelector(`[data-role="checkIn"][data-id="${id}"]`);
    const nightsNode = document.querySelector(`[data-role="nights"][data-id="${id}"]`);
    const checkOutNode = document.querySelector(`[data-role="checkOut"][data-id="${id}"]`);
    if (checkInNode && nightsNode && checkOutNode) {
      nightsNode.value = diffDays(checkInNode.value, checkOutNode.value);
    }
  }
}

campList.addEventListener("click", handleCampTableClick);
campList.addEventListener("input", handleCampTableInput);
campList.addEventListener("change", handleCampTableChange);
activeTripReservations.addEventListener("click", handleCampTableClick);
activeTripReservations.addEventListener("input", handleCampTableInput);
activeTripReservations.addEventListener("change", handleCampTableChange);

[filterTripName, filterCampName, filterTripStartDate, filterReservedDate, filterStatus].forEach((node) => {
  node.addEventListener("input", () => {
    currentPage = 1;
    renderEntries();
    renderActiveTripReservations();
  });
  node.addEventListener("change", () => {
    currentPage = 1;
    renderEntries();
    renderActiveTripReservations();
  });
});

[tripFilterName, tripFilterStartDate, tripFilterStatus, tripFilterLanguage, tripFilterCreatedDate].forEach((node) => {
  node.addEventListener("input", () => {
    currentTripPage = 1;
    renderTrips();
  });
  node.addEventListener("change", () => {
    currentTripPage = 1;
    renderTrips();
  });
});

campCheckin.addEventListener("change", syncCheckoutFromStay);
campCheckin.addEventListener("input", syncCheckoutFromStay);
campStays.addEventListener("input", syncCheckoutFromStay);
campStays.addEventListener("change", syncCheckoutFromStay);
campCheckout.addEventListener("change", syncStayFromCheckout);
campExportPdf?.addEventListener("click", exportCurrentReservations);

document.querySelectorAll("[data-settings-group]").forEach((formNode) => {
  formNode.addEventListener("submit", async (event) => {
    event.preventDefault();
    const group = formNode.dataset.settingsGroup;
    const value = formNode.elements.value.value.trim();
    if (!value) {
      return;
    }
    if (!campSettings[group].includes(value)) {
      campSettings[group].push(value);
      campSettings[group].sort((left, right) => left.localeCompare(right));
      await saveSettings();
    }
    formNode.reset();
  });
});

document.addEventListener("click", async (event) => {
  const target = event.target.closest('[data-action="remove-setting"]');
  if (!target) {
    return;
  }
  const group = target.dataset.group;
  const value = target.dataset.value;
  campSettings[group] = campSettings[group].filter((item) => item !== value);
  await saveSettings();
});

async function init() {
  campCreatedDate.value = new Date().toISOString().slice(0, 10);
  await loadSettings();
  await loadTrips();
  await loadReservations();
  syncCheckoutFromStay();
}

init();
