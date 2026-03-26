const tripForm = document.querySelector("#trip-form");
const tripStatus = document.querySelector("#trip-status");
const tripList = document.querySelector("#trip-list");
const tripToggleForm = document.querySelector("#trip-toggle-form");
const tripFormPanel = document.querySelector("#trip-form-panel");
const activeTripBox = document.querySelector("#active-trip");
const activeTripReservations = document.querySelector("#active-trip-reservations");
const activeCampReservations = document.querySelector("#active-camp-reservations");
const reservationEditPanel = document.querySelector("#reservation-edit-panel");
const paymentEditPanel = document.querySelector("#payment-edit-panel");
const campForm = document.querySelector("#camp-form");
const campStatus = document.querySelector("#camp-status");
const campList = document.querySelector("#camp-list");
const campPaymentList = document.querySelector("#camp-payment-list");
const campToggleForm = document.querySelector("#camp-toggle-form");
const campFormPanel = document.querySelector("#camp-form-panel");
const reservationTripSelect = document.querySelector("#reservation-trip-select");
const campNameSelect = document.querySelector("#camp-name-select");
const locationNameSelect = document.querySelector("#location-name-select");
const newCampNameInput = document.querySelector("#new-camp-name");
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
  locationNames: [],
  staffAssignments: [],
  roomChoices: [],
  campLocations: {},
};
let activeTripId = "";
let activeCampName = "";
let editingReservationId = "";
let editingTripId = "";
let editingPaymentGroupKey = "";
let currentPage = 1;
let currentTripPage = 1;
let selectedReservationIds = new Set();
let activeTripDayFilter = "";
let activeTripPanelHidden = false;
let activeCampPanelHidden = false;
const PAGE_SIZE = 20;
const TRIP_STATUS_OPTIONS = [
  ["planning", "Planning"],
  ["confirmed", "Confirmed"],
  ["travelling", "Travelling"],
  ["completed", "Completed"],
  ["cancelled", "Cancelled"],
];

function openPanel(panel) {
  panel.classList.remove("is-hidden");
  document.body.classList.add("modal-open");
  const dialog = panel.querySelector(".camp-modal-dialog");
  const form = panel.querySelector("form");
  requestAnimationFrame(() => {
    window.scrollTo(0, 0);
    if (dialog) {
      dialog.scrollTop = 0;
    }
    if (form) {
      form.scrollTop = 0;
    }
  });
}

function closePanel(panel) {
  panel.classList.add("is-hidden");
  if (tripFormPanel.classList.contains("is-hidden") && campFormPanel.classList.contains("is-hidden")) {
    document.body.classList.remove("modal-open");
  }
}

function closeInlineEditPanels() {
  editingReservationId = "";
  editingPaymentGroupKey = "";
  reservationEditPanel.classList.add("is-hidden");
  reservationEditPanel.innerHTML = "";
  paymentEditPanel.classList.add("is-hidden");
  paymentEditPanel.innerHTML = "";
}

function hideSelectionPanels() {
  activeTripId = "";
  activeCampName = "";
  activeTripDayFilter = "";
  activeTripPanelHidden = true;
  activeCampPanelHidden = true;
  closeInlineEditPanels();
  activeTripReservations.classList.add("is-hidden");
  activeTripReservations.innerHTML = "";
  activeCampReservations.classList.add("is-hidden");
  activeCampReservations.innerHTML = "";
  renderEntries();
  renderActiveTrip();
  renderActiveTripReservations();
  renderActiveCampReservations();
}

function closeReservationEditPanel() {
  editingReservationId = "";
  reservationEditPanel.classList.add("is-hidden");
  reservationEditPanel.innerHTML = "";
}

function closePaymentEditPanel() {
  editingPaymentGroupKey = "";
  paymentEditPanel.classList.add("is-hidden");
  paymentEditPanel.innerHTML = "";
}

function refreshCampSettingsViews() {
  renderAllSettings();
  renderSettingsOptions();
  renderEntries();
  renderActiveTripReservations();
  renderActiveCampReservations();
}

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
    in_progress: "In progress",
    paid_deposit: "Deposit paid",
    paid: "Paid",
    paid_100: "Paid 100%",
    finished: "Finished",
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

function renderCampSelectOptions(selectedValue = "") {
  const values = [...campSettings.campNames];
  if (selectedValue && !values.includes(selectedValue)) {
    values.unshift(selectedValue);
  }
  return [
    '<option value="">Choose camp</option>',
    ...values.map((value) => `<option value="${escapeHtml(value)}" ${selectedValue === value ? "selected" : ""}>${escapeHtml(value)}</option>`),
  ].join("");
}

function renderGenericSelectOptions(values, placeholder, selectedValue = "") {
  const nextValues = [...values];
  if (selectedValue && !nextValues.includes(selectedValue)) {
    nextValues.unshift(selectedValue);
  }
  return [
    `<option value="">${placeholder}</option>`,
    ...nextValues.map((value) => `<option value="${escapeHtml(value)}" ${selectedValue === value ? "selected" : ""}>${escapeHtml(value)}</option>`),
  ].join("");
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
  activeCampPanelHidden = true;
  reservationTripSelect.value = activeTripId;
  currentPage = 1;
  renderTrips();
  renderActiveTrip();
  renderEntries();
  renderActiveTripReservations();
  renderActiveCampReservations();
  renderCampPayments();
  requestAnimationFrame(() => {
    activeTripReservations.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function setActiveCamp(campName) {
  activeCampName = campName || "";
  activeCampPanelHidden = false;
  closeInlineEditPanels();
  renderEntries();
  renderActiveCampReservations();
  requestAnimationFrame(() => {
    activeCampReservations.scrollIntoView({ behavior: "smooth", block: "start" });
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
  campNameSelect.innerHTML = renderCampSelectOptions();
  locationNameSelect.innerHTML = renderGenericSelectOptions(campSettings.locationNames, "Choose location");
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

function getCampLocation(campName) {
  return campSettings.campLocations?.[campName] || "";
}

function applyCampLocationToForm(formNode) {
  if (!formNode) return;
  const campNode = formNode.querySelector('[name="campName"]');
  const locationNode = formNode.querySelector('[name="locationName"]');
  const newCampNode = formNode.querySelector('[name="newCampName"]');
  if (!campNode || !locationNode) return;
  if (newCampNode && newCampNode.value.trim()) return;
  const mapped = getCampLocation(campNode.value);
  if (mapped) {
    locationNode.value = mapped;
  }
}

function syncReservationDraftFromTrip(formNode) {
  if (!formNode) return;
  const tripNode = formNode.querySelector('[name="tripId"]');
  const reservationNameNode = formNode.querySelector('[name="reservationName"]');
  if (!tripNode || !reservationNameNode) return;
  const selectedTrip = getTripById(tripNode.value);
  if (!selectedTrip) return;
  reservationNameNode.value = selectedTrip.reservationName || selectedTrip.tripName || "";
}

function syncReservationDraftFromCamp(formNode) {
  if (!formNode) return;
  applyCampLocationToForm(formNode);
}

function focusReservationResults(trip) {
  if (!trip) {
    return;
  }
  activeTripId = trip.id;
  activeTripPanelHidden = false;
  activeCampPanelHidden = true;
  currentPage = 1;
  currentTripPage = 1;
  activeTripDayFilter = "";
  filterTripName.value = trip.id;
  filterCampName.value = "";
  filterTripStartDate.value = trip.startDate || "";
  filterReservedDate.value = "";
  filterStatus.value = "";
  renderEntries();
  renderActiveTrip();
  renderActiveTripReservations();
  renderActiveCampReservations();
  renderCampPayments();
  requestAnimationFrame(() => {
    const anchor = activeTripReservations.classList.contains("is-hidden") ? campList : activeTripReservations;
    anchor.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function renderSettingGroup(groupName, values) {
  const container = document.querySelector(`#settings-${groupName}`);
  if (!container) {
    return;
  }
  if (groupName === "campNames") {
    container.innerHTML = values
      .map((value) => {
        const location = campSettings.campLocations?.[value] || "";
        return `
          <span class="setting-pill">
            ${escapeHtml(value)}${location ? ` · ${escapeHtml(location)}` : ""}
            <button type="button" data-action="remove-setting" data-group="${groupName}" data-value="${escapeHtml(value)}">×</button>
          </span>
        `;
      })
      .join("");
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
  renderSettingGroup("locationNames", campSettings.locationNames);
  renderSettingGroup("staffAssignments", campSettings.staffAssignments);
  renderSettingGroup("roomChoices", campSettings.roomChoices);
  renderSettingsOptions();
}

function renderTrips() {
  const trips = getFilteredTrips();
  if (!trips.length) {
    tripList.innerHTML = '<p class="empty">No trips found for the selected filters.</p>';
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
            <th>Reservation Name</th>
            <th>Start</th>
            <th>Pax</th>
            <th>Staff</th>
            <th>Guide</th>
            <th>Driver</th>
            <th>Cook</th>
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
                  <td>${escapeHtml(trip.reservationName || trip.tripName)}</td>
                  <td>${formatDate(trip.startDate)}</td>
                  <td class="trip-pax-cell">${trip.participantCount}</td>
                  <td class="trip-pax-cell">${trip.staffCount}</td>
                  <td>${escapeHtml(trip.guideName || "-")}</td>
                  <td>${escapeHtml(trip.driverName || "-")}</td>
                  <td>${escapeHtml(trip.cookName || "-")}</td>
                  <td>${escapeHtml(trip.language)}</td>
                  <td><span class="status-pill is-${normalizeStatus(trip.status)}">${formatStatusLabel(trip.status)}</span></td>
                  <td>${formatDate(trip.createdAt, true)}</td>
                  <td>${escapeHtml(trip.createdBy?.name || trip.createdBy?.email || "-")}</td>
                  <td>
                    <div class="trip-row-actions trip-row-actions-grid">
                      <div class="trip-action-row">
                        <select class="inline-status-select" data-action="trip-status" data-trip-id="${trip.id}">
                          ${TRIP_STATUS_OPTIONS
                            .map(([value, label]) => `<option value="${value}" ${trip.status === value ? "selected" : ""}>${label}</option>`)
                            .join("")}
                        </select>
                        <button type="button" class="table-action compact secondary" data-action="edit-trip" data-trip-id="${trip.id}">Edit</button>
                      </div>
                      <div class="trip-action-row">
                        <button type="button" class="table-action compact" data-action="add-reservation" data-trip-id="${trip.id}">Add Reservation</button>
                        <button type="button" class="table-action compact danger" data-action="delete-trip" data-trip-id="${trip.id}">Delete</button>
                      </div>
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
      <p>${startIndex + 1}-${startIndex + visibleTrips.length} / ${trips.length}</p>
      <div class="pagination-actions">
        <button type="button" data-action="trip-page-prev" ${currentTripPage === 1 ? "disabled" : ""}>Previous</button>
        <button type="button" data-action="trip-page-next" ${currentTripPage === totalPages ? "disabled" : ""}>Next</button>
      </div>
    </div>
  `;
}

function renderActiveTrip() {
  activeTripBox.className = "is-hidden";
  activeTripBox.innerHTML = "";
}

function renderCampPayments() {
  const grouped = new Map();
  currentEntries.forEach((entry) => {
    const key = `${entry.tripId}::${entry.campName}`;
    const group = grouped.get(key) || {
      key,
      tripId: entry.tripId,
      tripName: entry.tripName,
      reservationName: entry.reservationName || entry.tripName,
      campName: entry.campName,
      reservations: 0,
      deposit: 0,
      depositPaidDate: "",
      secondPayment: 0,
      secondPaidDate: "",
      totalPayment: 0,
      balancePayment: 0,
      paidAmount: 0,
      paymentStatus: "",
      entries: [],
    };
    group.reservations += 1;
    group.deposit += Number(entry.deposit || 0);
    group.secondPayment += Number(entry.secondPayment || 0);
    group.totalPayment += Number(entry.totalPayment || 0);
    group.balancePayment += Number(entry.balancePayment || 0);
    group.paidAmount += Number(entry.paidAmount || 0);
    group.depositPaidDate = entry.depositPaidDate || group.depositPaidDate;
    group.secondPaidDate = entry.secondPaidDate || group.secondPaidDate;
    group.paymentStatus = entry.paymentStatus || group.paymentStatus;
    group.entries.push(entry);
    grouped.set(key, group);
  });
  const rows = [...grouped.values()].sort((left, right) => {
    const tripCompare = String(left.tripName || "").localeCompare(String(right.tripName || ""));
    return tripCompare || String(left.campName || "").localeCompare(String(right.campName || ""));
  });
  if (!rows.length) {
    campPaymentList.innerHTML = '<p class="empty">No camp payment data yet.</p>';
    return;
  }
  campPaymentList.innerHTML = `
    <div class="camp-table-wrap">
      <table class="camp-table camp-payment-table">
        <thead>
          <tr>
            <th>Trip</th>
            <th>Reservation Name</th>
            <th>Camp</th>
            <th>Reservations</th>
            <th>Deposit</th>
            <th>Deposit paid date</th>
            <th>2nd payment</th>
            <th>2nd paid date</th>
            <th>Paid</th>
            <th>Balance</th>
            <th>Total</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) => `
                <tr>
                  <td>${escapeHtml(row.tripName)}</td>
                  <td>${escapeHtml(row.reservationName)}</td>
                  <td><button type="button" class="table-link compact secondary" data-action="select-camp" data-camp-name="${escapeHtml(row.campName)}">${escapeHtml(row.campName)}</button></td>
                  <td class="table-center">${row.reservations}</td>
                  <td class="table-right">${formatMoney(row.deposit)}</td>
                  <td>${formatDate(row.depositPaidDate)}</td>
                  <td class="table-right">${formatMoney(row.secondPayment)}</td>
                  <td>${formatDate(row.secondPaidDate)}</td>
                  <td class="table-right">${formatMoney(row.paidAmount)}</td>
                  <td class="table-right">${formatMoney(row.balancePayment)}</td>
                  <td class="table-right">${formatMoney(row.totalPayment)}</td>
                  <td><span class="status-pill is-${normalizeStatus(row.paymentStatus || "in_progress")}">${formatStatusLabel(row.paymentStatus || "in_progress")}</span></td>
                  <td>
                    <div class="trip-row-actions payment-row-actions">
                      <button type="button" class="table-action compact secondary" data-action="edit-payment-group" data-group-key="${escapeHtml(row.key)}">Edit</button>
                      <button type="button" class="table-action compact danger" data-action="delete-payment-group" data-group-key="${escapeHtml(row.key)}">Delete</button>
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

function renderActiveTripReservations() {
  if (!activeTripId) {
    activeTripReservations.classList.add("is-hidden");
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
    activeTripReservations.classList.add("is-hidden");
    activeTripReservations.innerHTML = "";
    return;
  }
  if (!entries.length) {
    activeTripReservations.classList.remove("is-hidden");
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
      <p class="empty">No reservations found for this trip.</p>
    `;
    return;
  }

  activeTripReservations.classList.remove("is-hidden");
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
            <th class="checkbox-col table-center"><input type="checkbox" class="table-checkbox" data-action="toggle-select-all-detail-checkbox" ${entries.every((entry) => selectedReservationIds.has(entry.id)) ? "checked" : ""} aria-label="Select all" /></th>
            <th>Trip</th>
            <th>Reservation Name</th>
            <th>Day</th>
            <th>Camp</th>
            <th>Location</th>
            <th>Type</th>
            <th>Clients</th>
            <th>Staff</th>
            <th>Check-in</th>
            <th>Nights</th>
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

function renderActiveCampReservations() {
  if (!activeCampName || activeCampPanelHidden) {
    activeCampReservations.classList.add("is-hidden");
    activeCampReservations.innerHTML = "";
    return;
  }
  const entries = sortByDateAsc(currentEntries.filter((entry) => entry.campName === activeCampName), "checkIn");
  if (!entries.length) {
    activeCampReservations.classList.add("is-hidden");
    activeCampReservations.innerHTML = "";
    return;
  }
  activeCampReservations.classList.remove("is-hidden");
  activeCampReservations.innerHTML = `
    <div class="section-head">
      <h2>${escapeHtml(activeCampName)} reservations</h2>
      <div class="camp-toolbar trip-detail-toolbar">
        <button type="button" class="secondary-button" data-action="hide-camp-panel">Hide table</button>
      </div>
    </div>
    <div class="camp-table-wrap">
      <table class="camp-table camp-table-detail">
        <thead>
          <tr>
            <th>Trip</th>
            <th>Reservation Name</th>
            <th>Day</th>
            <th>Camp</th>
            <th>Location</th>
            <th>Type</th>
            <th>Clients</th>
            <th>Staff</th>
            <th>Check-in</th>
            <th>Nights</th>
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
          ${entries.map((entry, index) => renderReadOnlyRow(entry, index, { includeCheckbox: false })).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderReadOnlyRow(entry, index, options = {}) {
  const { includeCheckbox = true } = options;
  const isSelected = selectedReservationIds.has(entry.id);
  const meals = [entry.breakfast === "Yes" && "Breakfast", entry.lunch === "Yes" && "Lunch", entry.dinner === "Yes" && "Dinner"]
    .filter(Boolean)
    .join(" / ");
  return `
    <tr class="${statusClass(entry)}">
      ${includeCheckbox ? `<td class="checkbox-col table-center"><input type="checkbox" class="table-checkbox" data-action="toggle-select-checkbox" data-id="${entry.id}" ${isSelected ? "checked" : ""} aria-label="Select reservation" /></td>` : ""}
      <td class="table-primary-cell table-nowrap">${escapeHtml(entry.tripName)}</td>
      <td class="table-nowrap">${escapeHtml(entry.reservationName || entry.tripName)}</td>
      <td class="table-nowrap">${getTripDayLabel(entry)}</td>
      <td><button type="button" class="table-link compact secondary" data-action="select-camp" data-camp-name="${escapeHtml(entry.campName)}">${escapeHtml(entry.campName)}</button></td>
      <td>${escapeHtml(entry.locationName || "-")}</td>
      <td>${escapeHtml(entry.reservationType === "hotel" ? "Hotel" : entry.reservationType === "herder" ? "Herder" : "Camp")}</td>
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
        <div class="camp-row-actions stacked-pills">
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
      <td class="checkbox-col"></td>
      <td class="table-primary-cell table-nowrap">${escapeHtml(entry.tripName)}</td>
      <td class="table-nowrap">${escapeHtml(entry.reservationName || entry.tripName)}</td>
      <td class="table-nowrap">${getTripDayLabel(entry)}</td>
      <td>
        <select data-role="campName" data-id="${entry.id}">
          ${campSettings.campNames.map((option) => `<option value="${escapeHtml(option)}" ${entry.campName === option ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}
        </select>
      </td>
      <td>
        <select data-role="locationName" data-id="${entry.id}">
          <option value="">Choose location</option>
          ${campSettings.locationNames.map((option) => `<option value="${escapeHtml(option)}" ${entry.locationName === option ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}
        </select>
      </td>
      <td>
        <select data-role="reservationType" data-id="${entry.id}">
          <option value="camp" ${entry.reservationType === "camp" ? "selected" : ""}>Camp reservation</option>
          <option value="hotel" ${entry.reservationType === "hotel" ? "selected" : ""}>Hotel reservation</option>
          <option value="herder" ${entry.reservationType === "herder" ? "selected" : ""}>Herder family reservation</option>
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
    campList.innerHTML = '<p class="empty">No reservations found for the selected filters.</p>';
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
            <th class="checkbox-col table-center"><input type="checkbox" class="table-checkbox" data-action="toggle-select-all-checkbox" ${visibleEntries.length && visibleEntries.every((entry) => selectedReservationIds.has(entry.id)) ? "checked" : ""} aria-label="Select all" /></th>
            <th>Trip</th>
            <th>Reservation Name</th>
            <th>Day</th>
            <th>Camp</th>
            <th>Location</th>
            <th>Type</th>
            <th>Clients</th>
            <th>Staff</th>
            <th>Check-in</th>
            <th>Nights</th>
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
      <p>${startIndex + 1}-${startIndex + visibleEntries.length} / ${entries.length}</p>
      <div class="pagination-actions">
        <button type="button" data-action="page-prev" ${currentPage === 1 ? "disabled" : ""}>Previous</button>
        <button type="button" data-action="page-next" ${currentPage === totalPages ? "disabled" : ""}>Next</button>
      </div>
    </div>
  `;
}

function renderReservationEditPanel(reservation, options = {}) {
  if (!reservation && !options.isCreate) {
    reservationEditPanel.classList.add("is-hidden");
    reservationEditPanel.innerHTML = "";
    return;
  }
  const isCreate = Boolean(options.isCreate);
  const reservationData = reservation || {
    id: "",
    tripId: options.tripId || activeTripId || filterTripName.value || "",
    tripName: getTripById(options.tripId || activeTripId || filterTripName.value || "")?.tripName || "",
    reservationName: "",
    createdDate: new Date().toISOString().slice(0, 10),
    campName: "",
    locationName: "",
    reservationType: "camp",
    checkIn: "",
    nights: 1,
    checkOut: "",
    clientCount: 2,
    staffCount: 0,
    staffAssignment: "",
    gerCount: 1,
    roomType: "",
    breakfast: "No",
    lunch: "No",
    dinner: "No",
    status: "pending",
    notes: "",
  };
  if (!reservationData.reservationName) {
    const selectedTrip = getTripById(reservationData.tripId);
    reservationData.reservationName = selectedTrip?.reservationName || selectedTrip?.tripName || "";
  }
  if (!reservationData.locationName && reservationData.campName) {
    reservationData.locationName = getCampLocation(reservationData.campName);
  }
  reservationEditPanel.classList.remove("is-hidden");
  reservationEditPanel.innerHTML = `
    <div class="section-head">
      <h2>${isCreate ? "New reservation" : "Edit reservation"}</h2>
      <div class="camp-toolbar trip-detail-toolbar">
        <button type="button" class="secondary-button" data-action="hide-reservation-edit">Hide</button>
      </div>
    </div>
    <form id="${isCreate ? "reservation-create-form" : "reservation-edit-form"}" class="field-grid camp-edit-panel-form">
      <input type="hidden" name="id" value="${reservationData.id || ""}" />
      <div class="camp-form-section full-span">
        <div class="camp-form-section-head">
          <h3>Reservation details</h3>
          <p>${isCreate ? "Fill the reservation details and save." : "Update the reservation details and save."}</p>
        </div>
        <div class="field-grid field-grid-compact">
          <label>
            Selected Trip
            <select name="tripId" required>
              ${currentTrips.map((trip) => `<option value="${escapeHtml(trip.id)}" ${trip.id === reservationData.tripId ? "selected" : ""}>${escapeHtml(trip.tripName)}</option>`).join("")}
            </select>
          </label>
          <label>
            Reservation Name
            <input name="reservationName" value="${escapeHtml(reservationData.reservationName || reservationData.tripName || "")}" required />
          </label>
          <label>
            Reservation date
            <input name="createdDate" type="date" value="${escapeHtml(reservationData.createdDate || "")}" />
          </label>
          <label>
            Camp
            <select name="campName" required>
              ${renderCampSelectOptions(reservationData.campName)}
            </select>
          </label>
          <label>
            Location
            <select name="locationName">
              ${renderGenericSelectOptions(campSettings.locationNames, "Choose location", reservationData.locationName || "")}
            </select>
          </label>
          <label>
            New Camp
            <input name="newCampName" placeholder="Create new camp if not listed" />
          </label>
          <label>
            Reservation type
            <select name="reservationType" required>
              <option value="camp" ${reservationData.reservationType === "camp" ? "selected" : ""}>Camp reservation</option>
              <option value="hotel" ${reservationData.reservationType === "hotel" ? "selected" : ""}>Hotel reservation</option>
              <option value="herder" ${reservationData.reservationType === "herder" ? "selected" : ""}>Herder family reservation</option>
            </select>
          </label>
          <label>
            Check-in
            <input name="checkIn" type="date" value="${escapeHtml(reservationData.checkIn || "")}" required />
          </label>
          <label>
            Number of nights
            <input name="nights" type="number" min="1" value="${Number(reservationData.nights || 1)}" required />
          </label>
          <label>
            Check-out
            <input name="checkOut" type="date" value="${escapeHtml(reservationData.checkOut || "")}" required />
          </label>
          <label>
            Number of clients
            <input name="clientCount" type="number" min="1" value="${Number(reservationData.clientCount || 2)}" required />
          </label>
          <label>
            Number of staff
            <input name="staffCount" type="number" min="0" value="${Number(reservationData.staffCount || 0)}" />
          </label>
          <label>
            Staff Assignment
            <select name="staffAssignment">
              ${renderGenericSelectOptions(campSettings.staffAssignments, "Choose staff", reservationData.staffAssignment || "")}
            </select>
          </label>
          <label>
            Number of Gers
            <input name="gerCount" type="number" min="1" value="${Number(reservationData.gerCount || 1)}" required />
          </label>
          <label>
            Ger / Room choice
            <select name="roomType" required>
              ${renderGenericSelectOptions(campSettings.roomChoices, "Choose room type", reservationData.roomType || "")}
            </select>
          </label>
          <label>
            Breakfast
            <select name="breakfast">
              <option value="No" ${reservationData.breakfast === "No" ? "selected" : ""}>No</option>
              <option value="Yes" ${reservationData.breakfast === "Yes" ? "selected" : ""}>Yes</option>
            </select>
          </label>
          <label>
            Lunch
            <select name="lunch">
              <option value="No" ${reservationData.lunch === "No" ? "selected" : ""}>No</option>
              <option value="Yes" ${reservationData.lunch === "Yes" ? "selected" : ""}>Yes</option>
            </select>
          </label>
          <label>
            Dinner
            <select name="dinner">
              <option value="No" ${reservationData.dinner === "No" ? "selected" : ""}>No</option>
              <option value="Yes" ${reservationData.dinner === "Yes" ? "selected" : ""}>Yes</option>
            </select>
          </label>
          <label>
            Status
            <select name="status">
              <option value="pending" ${reservationData.status === "pending" ? "selected" : ""}>Pending</option>
              <option value="confirmed" ${reservationData.status === "confirmed" ? "selected" : ""}>Confirmed</option>
              <option value="cancelled" ${reservationData.status === "cancelled" ? "selected" : ""}>Cancelled</option>
              <option value="rejected" ${reservationData.status === "rejected" ? "selected" : ""}>Rejected</option>
            </select>
          </label>
          <label class="full-span">
            Notes
            <textarea name="notes" rows="4">${escapeHtml(reservationData.notes || "")}</textarea>
          </label>
        </div>
      </div>
      <div class="actions full-span">
        <button type="submit">${isCreate ? "Save reservation" : "Save changes"}</button>
        <button type="button" class="secondary-button" data-action="hide-reservation-edit">Cancel</button>
        <p class="status" id="reservation-edit-status"></p>
      </div>
    </form>
  `;
  const formNode = reservationEditPanel.querySelector("form");
  syncReservationDraftFromTrip(formNode);
  syncReservationDraftFromCamp(formNode);
  syncInlineEditCheckout(formNode);
  reservationEditPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  requestAnimationFrame(() => {
    window.scrollTo({ top: Math.max(reservationEditPanel.getBoundingClientRect().top + window.scrollY - 24, 0), behavior: "smooth" });
  });
}

function renderPaymentEditPanel(groupKey) {
  const entries = getEntriesByGroupKey(groupKey);
  if (!entries.length) {
    paymentEditPanel.classList.add("is-hidden");
    paymentEditPanel.innerHTML = "";
    return;
  }
  const first = entries[0];
  const group = {
    tripName: first.tripName,
    reservationName: first.reservationName || first.tripName,
    campName: first.campName,
    deposit: entries.reduce((sum, entry) => sum + Number(entry.deposit || 0), 0),
    depositPaidDate: first.depositPaidDate || "",
    secondPayment: entries.reduce((sum, entry) => sum + Number(entry.secondPayment || 0), 0),
    secondPaidDate: first.secondPaidDate || "",
    paidAmount: entries.reduce((sum, entry) => sum + Number(entry.paidAmount || 0), 0),
    balancePayment: entries.reduce((sum, entry) => sum + Number(entry.balancePayment || 0), 0),
    totalPayment: entries.reduce((sum, entry) => sum + Number(entry.totalPayment || 0), 0),
    paymentStatus: first.paymentStatus || "in_progress",
  };
  paymentEditPanel.classList.remove("is-hidden");
  paymentEditPanel.innerHTML = `
    <div class="section-head">
      <h2>Edit camp payment</h2>
      <div class="camp-toolbar trip-detail-toolbar">
        <button type="button" class="secondary-button" data-action="hide-payment-edit">Hide</button>
      </div>
    </div>
    <form id="payment-edit-form" class="field-grid">
      <input type="hidden" name="groupKey" value="${escapeHtml(groupKey)}" />
      <div class="camp-form-section full-span">
        <div class="camp-form-section-head">
          <h3>${escapeHtml(group.tripName)} · ${escapeHtml(group.campName)}</h3>
          <p>Reservation Name: ${escapeHtml(group.reservationName)}</p>
        </div>
        <div class="field-grid field-grid-compact">
          <label>Deposit<input name="deposit" inputmode="numeric" value="${String(group.deposit || "")}" /></label>
          <label>Deposit paid date<input name="depositPaidDate" type="date" value="${escapeHtml(group.depositPaidDate)}" /></label>
          <label>2nd payment<input name="secondPayment" inputmode="numeric" value="${String(group.secondPayment || "")}" /></label>
          <label>2nd paid date<input name="secondPaidDate" type="date" value="${escapeHtml(group.secondPaidDate)}" /></label>
          <label>Paid amount<input name="paidAmount" inputmode="numeric" value="${String(group.paidAmount || "")}" /></label>
          <label>Balance<input name="balancePayment" inputmode="numeric" value="${String(group.balancePayment || "")}" /></label>
          <label>Total payment<input name="totalPayment" inputmode="numeric" value="${String(group.totalPayment || "")}" /></label>
          <label>
            Status
            <select name="paymentStatus">
              <option value="in_progress" ${group.paymentStatus === "in_progress" ? "selected" : ""}>In progress</option>
              <option value="paid_deposit" ${group.paymentStatus === "paid_deposit" ? "selected" : ""}>Deposit paid</option>
              <option value="paid" ${group.paymentStatus === "paid" ? "selected" : ""}>Paid</option>
              <option value="paid_100" ${group.paymentStatus === "paid_100" ? "selected" : ""}>Paid 100%</option>
              <option value="finished" ${group.paymentStatus === "finished" ? "selected" : ""}>Finished</option>
            </select>
          </label>
        </div>
      </div>
      <div class="actions full-span">
        <button type="submit">Save payment</button>
        <button type="button" class="secondary-button" data-action="hide-payment-edit">Cancel</button>
        <p class="status" id="payment-edit-status"></p>
      </div>
    </form>
  `;
  paymentEditPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  requestAnimationFrame(() => {
    window.scrollTo({ top: Math.max(paymentEditPanel.getBoundingClientRect().top + window.scrollY - 24, 0), behavior: "smooth" });
  });
}

async function handleInlineReservationSubmit(event) {
  event.preventDefault();
  event.stopPropagation();
  const target = event.target;
  if (!(target instanceof HTMLFormElement)) {
    return;
  }
  const statusNode = target.querySelector("#reservation-edit-status");
  if (statusNode) statusNode.textContent = "Saving reservation...";
  const payload = buildPayload(target);
  const selectedTrip = getTripById(payload.tripId);
  if (!selectedTrip) {
    if (statusNode) statusNode.textContent = "Please select a trip first.";
    return;
  }
  if (payload.checkIn && payload.nights) {
    payload.checkOut = addDays(payload.checkIn, payload.nights);
    const checkOutNode = target.querySelector('[name="checkOut"]');
    if (checkOutNode) {
      checkOutNode.value = payload.checkOut;
    }
  }
  if (!payload.locationName && payload.campName && !payload.newCampName) {
    payload.locationName = getCampLocation(payload.campName);
  }
  payload.tripId = selectedTrip.id;
  payload.tripName = selectedTrip.tripName;
  payload.reservationName = payload.reservationName || selectedTrip.reservationName || selectedTrip.tripName;
  try {
    const result = await fetchJson(target.id === "reservation-edit-form" ? `/api/camp-reservations/${payload.id}` : "/api/camp-reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const savedEntry = result?.entry || null;
    if (savedEntry?.id) {
      if (target.id === "reservation-edit-form") {
        currentEntries = currentEntries.map((entry) => (entry.id === savedEntry.id ? savedEntry : entry));
      } else {
        currentEntries = [savedEntry, ...currentEntries.filter((entry) => entry.id !== savedEntry.id)];
      }
      selectedReservationIds = new Set([savedEntry.id]);
    }
    closeInlineEditPanels();
    closeReservationEditPanel();
    campStatus.textContent = target.id === "reservation-edit-form" ? "Reservation updated." : "Reservation saved.";
    await loadSettings();
    await loadTrips();
    await loadReservations();
    const nextTrip = getTripById(payload.tripId) || selectedTrip;
    focusReservationResults(nextTrip);
    if (savedEntry?.id) {
      selectedReservationIds = new Set([savedEntry.id]);
      renderEntries();
      renderActiveTripReservations();
      renderActiveCampReservations();
    }
  } catch (error) {
    if (statusNode) statusNode.textContent = error.message;
  }
}

async function handleInlinePaymentSubmit(event) {
  event.preventDefault();
  event.stopPropagation();
  const target = event.target;
  if (!(target instanceof HTMLFormElement)) {
    return;
  }
  const statusNode = target.querySelector("#payment-edit-status");
  if (statusNode) statusNode.textContent = "Saving payment...";
  const payload = buildPayload(target);
  const entries = getEntriesByGroupKey(payload.groupKey);
  try {
    const updates = await Promise.all(
      entries.map((entry) =>
        fetchJson(`/api/camp-reservations/${entry.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deposit: payload.deposit,
            depositPaidDate: payload.depositPaidDate,
            secondPayment: payload.secondPayment,
            secondPaidDate: payload.secondPaidDate,
            paidAmount: payload.paidAmount,
            balancePayment: payload.balancePayment,
            totalPayment: payload.totalPayment,
            paymentStatus: payload.paymentStatus,
          }),
        })
      )
    );
    const updatedEntries = updates.map((item) => item?.entry).filter(Boolean);
    if (updatedEntries.length) {
      const byId = new Map(updatedEntries.map((entry) => [entry.id, entry]));
      currentEntries = currentEntries.map((entry) => byId.get(entry.id) || entry);
    }
    closePaymentEditPanel();
    campStatus.textContent = "Camp payment updated.";
    await loadReservations();
    const anchorTrip = entries[0] ? getTripById(entries[0].tripId) : null;
    if (anchorTrip) {
      focusReservationResults(anchorTrip);
    }
  } catch (error) {
    if (statusNode) statusNode.textContent = error.message;
  }
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
  renderActiveCampReservations();
  renderEntries();
  renderCampPayments();
}

async function saveSettings() {
  settingsStatus.textContent = "Saving settings...";
  try {
    const payload = {
      campNames: campSettings.campNames,
      locationNames: campSettings.locationNames,
      staffAssignments: campSettings.staffAssignments,
      roomChoices: campSettings.roomChoices,
      campLocations: campSettings.campLocations,
    };
    await fetchJson("/api/camp-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    settingsStatus.textContent = "Settings updated.";
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
  openPanel(tripFormPanel);
  tripForm.elements.tripName.value = trip.tripName || "";
  tripForm.elements.reservationName.value = trip.reservationName || trip.tripName || "";
  tripForm.elements.startDate.value = String(trip.startDate || "").slice(0, 10);
  tripForm.elements.participantCount.value = String(trip.participantCount || 0);
  tripForm.elements.staffCount.value = String(trip.staffCount || 0);
  tripForm.elements.totalDays.value = String(trip.totalDays || 1);
  tripForm.elements.language.value = trip.language || "";
  tripForm.elements.status.value = trip.status || "planning";
  tripStatus.textContent = `Editing trip: ${trip.tripName}`;
  tripForm.elements.guideName.value = trip.guideName || "";
  tripForm.elements.driverName.value = trip.driverName || "";
  tripForm.elements.cookName.value = trip.cookName || "";
}

function resetTripFormState() {
  editingTripId = "";
  tripForm.reset();
  tripForm.elements.participantCount.value = "2";
  tripForm.elements.staffCount.value = "0";
  tripForm.elements.totalDays.value = "1";
  tripForm.elements.status.value = "planning";
  tripStatus.textContent = "";
}

function openReservationModal(tripId = "", reservation = null) {
  closePanel(campFormPanel);
  campFormPanel.classList.add("is-hidden");
  document.body.classList.remove("modal-open");
  if (reservation) {
    renderReservationEditPanel(reservation);
  } else {
    renderReservationEditPanel(null, { isCreate: true, tripId });
  }
}

function startReservationEdit(id) {
  const reservation = currentEntries.find((entry) => entry.id === id);
  if (!reservation) {
    return;
  }
  editingReservationId = reservation.id;
  renderReservationEditPanel(reservation);
}

function startReservationCreate(tripId = "") {
  editingReservationId = "";
  closePanel(campFormPanel);
  campFormPanel.classList.add("is-hidden");
  document.body.classList.remove("modal-open");
  campStatus.textContent = "";
  closePaymentEditPanel();
  renderReservationEditPanel(null, { isCreate: true, tripId });
}

function syncInlineEditCheckout(formNode) {
  const checkInNode = formNode.querySelector('[name="checkIn"]');
  const nightsNode = formNode.querySelector('[name="nights"]');
  const checkOutNode = formNode.querySelector('[name="checkOut"]');
  if (!checkInNode || !nightsNode || !checkOutNode || !checkInNode.value) {
    return;
  }
  checkOutNode.value = addDays(checkInNode.value, nightsNode.value);
}

function syncInlineEditNights(formNode) {
  const checkInNode = formNode.querySelector('[name="checkIn"]');
  const nightsNode = formNode.querySelector('[name="nights"]');
  const checkOutNode = formNode.querySelector('[name="checkOut"]');
  if (!checkInNode || !nightsNode || !checkOutNode || !checkInNode.value || !checkOutNode.value) {
    return;
  }
  nightsNode.value = diffDays(checkInNode.value, checkOutNode.value);
}

async function updateReservation(id) {
  const existingEntry = currentEntries.find((entry) => entry.id === id);
  const roles = [
    "campName",
    "locationName",
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
    "paidAmount",
    "depositPaidDate",
    "secondPayment",
    "secondPaidDate",
    "paymentStatus",
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

  if (payload.checkIn && payload.nights) {
    payload.checkOut = addDays(payload.checkIn, payload.nights);
  }

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
    if (existingEntry?.tripId) {
      setActiveTrip(existingEntry.tripId);
    } else {
      renderEntries();
      renderActiveTripReservations();
      renderActiveCampReservations();
    }
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

function getEntriesByGroupKey(groupKey) {
  const [tripId, campName] = String(groupKey || "").split("::");
  return currentEntries.filter((entry) => entry.tripId === tripId && entry.campName === campName);
}

function editPaymentGroup(groupKey) {
  const entries = getEntriesByGroupKey(groupKey);
  if (!entries.length) {
    return;
  }
  editingPaymentGroupKey = groupKey;
  closeReservationEditPanel();
  renderPaymentEditPanel(groupKey);
}

async function clearPaymentGroup(groupKey) {
  const entries = getEntriesByGroupKey(groupKey);
  if (!entries.length) {
    return;
  }
  campStatus.textContent = "Clearing payment data...";
  try {
    await Promise.all(
      entries.map((entry) =>
        fetchJson(`/api/camp-reservations/${entry.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deposit: 0,
            depositPaidDate: "",
            secondPayment: 0,
            secondPaidDate: "",
            paidAmount: 0,
            balancePayment: 0,
            totalPayment: 0,
            paymentStatus: "in_progress",
          }),
        })
      )
    );
    campStatus.textContent = "Payment data cleared.";
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
  campStatus.textContent = "Preparing PDF...";
  try {
    const ids = entries.map((entry) => entry.id).join(",");
    const result = await fetchJson(`/api/camp-reservations/export?ids=${encodeURIComponent(ids)}`);
    const link = document.createElement("a");
    link.href = appendDownloadQuery(result.entry.pdfPath);
    link.download = "camp-reservations.pdf";
    document.body.appendChild(link);
    link.click();
    link.remove();
    campStatus.textContent = "PDF ready.";
  } catch (error) {
    campStatus.textContent = error.message;
  }
}

tripForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  tripStatus.textContent = editingTripId ? "Saving trip changes..." : "Saving trip...";

  try {
    const result = await fetchJson(editingTripId ? `/api/camp-trips/${editingTripId}` : "/api/camp-trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPayload(tripForm)),
    });
    tripStatus.textContent = editingTripId ? `Trip updated: ${result.entry.tripName}` : `Trip created: ${result.entry.tripName}`;
    resetTripFormState();
    closePanel(tripFormPanel);
    await loadTrips();
    setActiveTrip(result.entry.id);
  } catch (error) {
    tripStatus.textContent = error.message;
  }
});

document.addEventListener("submit", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLFormElement)) {
    return;
  }
  if (target.id === "reservation-edit-form" || target.id === "reservation-create-form") {
    await handleInlineReservationSubmit(event);
    return;
  }
  if (target.id === "payment-edit-form") {
    await handleInlinePaymentSubmit(event);
    return;
  }
});

document.addEventListener("input", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }
  const form = target.closest("#reservation-edit-form, #reservation-create-form");
  if (form && (target.getAttribute("name") === "checkIn" || target.getAttribute("name") === "nights")) {
    syncInlineEditCheckout(form);
    return;
  }
  if (form && target.getAttribute("name") === "newCampName" && !target.value.trim()) {
    syncReservationDraftFromCamp(form);
  }
});

document.addEventListener("change", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }
  const form = target.closest("#reservation-edit-form, #reservation-create-form");
  if (form && target.getAttribute("name") === "tripId") {
    syncReservationDraftFromTrip(form);
    return;
  }
  if (form && target.getAttribute("name") === "campName") {
    syncReservationDraftFromCamp(form);
    return;
  }
  if (form && (target.getAttribute("name") === "checkIn" || target.getAttribute("name") === "nights")) {
    syncInlineEditCheckout(form);
    return;
  }
  if (form && target.getAttribute("name") === "checkOut") {
    syncInlineEditNights(form);
  }
});

campForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (campFormPanel.classList.contains("is-hidden")) {
    return;
  }
  campStatus.textContent = editingReservationId ? "Updating reservation..." : "Saving reservation...";

  const selectedTrip = getTripById(reservationTripSelect.value || activeTripId);
  if (!selectedTrip) {
    campStatus.textContent = "Please select a trip first.";
    return;
  }

  const payload = buildPayload(campForm);
  syncCheckoutFromStay();
  payload.checkOut = campCheckout.value;
  payload.tripId = selectedTrip.id;
  payload.tripName = selectedTrip.tripName;
  payload.reservationName = payload.reservationName || selectedTrip.reservationName || selectedTrip.tripName;

  try {
    await fetchJson(editingReservationId ? `/api/camp-reservations/${editingReservationId}` : "/api/camp-reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    campStatus.textContent = editingReservationId ? "Reservation updated." : "Reservation saved.";
    campForm.reset();
    campCreatedDate.value = new Date().toISOString().slice(0, 10);
    campForm.querySelector('[name="clientCount"]').value = "2";
    campForm.querySelector('[name="staffCount"]').value = "0";
    campForm.querySelector('[name="gerCount"]').value = "1";
    campForm.querySelector('[name="nights"]').value = "1";
    campForm.querySelector('[name="status"]').value = "pending";
    reservationTripSelect.value = selectedTrip.id;
    editingReservationId = "";
    syncCheckoutFromStay();
    closePanel(campFormPanel);
    await loadSettings();
    await loadTrips();
    await loadReservations();
    setActiveTrip(selectedTrip.id);
  } catch (error) {
    campStatus.textContent = error.message;
  }
});

tripToggleForm.addEventListener("click", () => {
  resetTripFormState();
  openPanel(tripFormPanel);
});

campToggleForm.addEventListener("click", () => {
  startReservationCreate(activeTripId || filterTripName.value || "");
});

tripList.addEventListener("click", (event) => {
  const actionTarget = event.target.closest("[data-action]");
  if (!actionTarget) {
    return;
  }

  if (actionTarget.dataset.action === "select-trip") {
    setActiveTrip(actionTarget.dataset.tripId);
    activeCampPanelHidden = true;
    closeInlineEditPanels();
    renderActiveCampReservations();
    tripStatus.textContent = `Selected trip: ${getTripById(actionTarget.dataset.tripId)?.tripName || ""}`;
    return;
  }

  if (actionTarget.dataset.action === "edit-trip") {
    startTripEdit(actionTarget.dataset.tripId);
    return;
  }

  if (actionTarget.dataset.action === "add-reservation") {
    setActiveTrip(actionTarget.dataset.tripId);
    activeCampPanelHidden = true;
    closeInlineEditPanels();
    renderActiveCampReservations();
    startReservationCreate(actionTarget.dataset.tripId);
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
    startReservationEdit(target.dataset.id);
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
    renderActiveTripReservations();
    renderActiveCampReservations();
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
  if (action === "select-camp") {
    setActiveCamp(target.dataset.campName);
    return;
  }
  if (action === "edit-payment-group") {
    editPaymentGroup(target.dataset.groupKey);
    return;
  }
  if (action === "delete-payment-group") {
    clearPaymentGroup(target.dataset.groupKey);
    return;
  }
  if (action === "toggle-select-all") {
    const visibleIds = getFilteredEntries()
      .slice((currentPage - 1) * PAGE_SIZE, (currentPage - 1) * PAGE_SIZE + PAGE_SIZE)
      .map((entry) => entry.id);
    const shouldSelect = !visibleIds.every((id) => selectedReservationIds.has(id));
    if (shouldSelect) {
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
    const shouldSelect = !visibleIds.every((id) => selectedReservationIds.has(id));
    if (shouldSelect) {
      visibleIds.forEach((id) => selectedReservationIds.add(id));
    } else {
      visibleIds.forEach((id) => selectedReservationIds.delete(id));
    }
    renderEntries();
    renderActiveTripReservations();
    return;
  }
  if (action === "toggle-select") {
    if (selectedReservationIds.has(target.dataset.id)) {
      selectedReservationIds.delete(target.dataset.id);
    } else {
      selectedReservationIds.add(target.dataset.id);
    }
    renderEntries();
    renderActiveTripReservations();
    renderActiveCampReservations();
    return;
  }
  if (action === "hide-trip-panel") {
    hideSelectionPanels();
    return;
  }
  if (action === "hide-camp-panel") {
    hideSelectionPanels();
    return;
  }
  if (action === "hide-reservation-edit") {
    closeInlineEditPanels();
    campStatus.textContent = "";
    return;
  }
  if (action === "hide-payment-edit") {
    closeInlineEditPanels();
    campStatus.textContent = "";
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
  const id = node.dataset.id;
  if (!id) {
    return;
  }
  const role = node.dataset.role;
  if (role === "campName") {
    const locationNode = document.querySelector(`[data-role="locationName"][data-id="${id}"]`);
    if (locationNode && node instanceof HTMLSelectElement) {
      locationNode.value = getCampLocation(node.value) || "";
    }
    return;
  }
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
activeCampReservations.addEventListener("click", handleCampTableClick);
reservationEditPanel.addEventListener("click", handleCampTableClick);
reservationEditPanel.addEventListener("input", handleCampTableInput);
reservationEditPanel.addEventListener("change", handleCampTableChange);
paymentEditPanel.addEventListener("click", handleCampTableClick);
paymentEditPanel.addEventListener("change", handleCampTableChange);
campPaymentList.addEventListener("click", handleCampTableClick);

[filterTripName, filterCampName, filterTripStartDate, filterReservedDate, filterStatus].forEach((node) => {
  node.addEventListener("input", () => {
    currentPage = 1;
    renderEntries();
    renderActiveTripReservations();
    renderActiveCampReservations();
    renderCampPayments();
  });
  node.addEventListener("change", () => {
    currentPage = 1;
    renderEntries();
    renderActiveTripReservations();
    renderActiveCampReservations();
    renderCampPayments();
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
reservationTripSelect.addEventListener("change", () => {
  const trip = getTripById(reservationTripSelect.value);
  if (!trip) {
    return;
  }
  if (!campForm.elements.reservationName.value) {
    campForm.elements.reservationName.value = trip.reservationName || trip.tripName;
  }
});

document.addEventListener("change", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }
  const action = target.dataset.action;
  if (action === "toggle-select-checkbox") {
    const reservationId = target.dataset.id;
    if (!reservationId) {
      return;
    }
    if (target.checked) {
      selectedReservationIds.add(reservationId);
    } else {
      selectedReservationIds.delete(reservationId);
    }
    renderEntries();
    renderActiveTripReservations();
    renderActiveCampReservations();
    return;
  }
  if (action === "toggle-select-all-checkbox") {
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
  if (action === "toggle-select-all-detail-checkbox") {
    const visibleIds = sortByDateAsc(currentEntries.filter((entry) => entry.tripId === activeTripId), "checkIn").map((entry) => entry.id);
    if (target.checked) {
      visibleIds.forEach((id) => selectedReservationIds.add(id));
    } else {
      visibleIds.forEach((id) => selectedReservationIds.delete(id));
    }
    renderEntries();
    renderActiveTripReservations();
  }
});
campNameSelect.addEventListener("change", () => applyCampLocationToForm(campForm));
newCampNameInput.addEventListener("input", () => {
  if (!newCampNameInput.value.trim()) {
    applyCampLocationToForm(campForm);
  }
});
campExportPdf?.addEventListener("click", exportCurrentReservations);

document.querySelectorAll("[data-settings-group]").forEach((formNode) => {
  formNode.addEventListener("submit", async (event) => {
    event.preventDefault();
    const group = formNode.dataset.settingsGroup;
    if (group === "campNames") {
      const campName = formNode.elements.campName.value.trim();
      const campLocation = formNode.elements.campLocation.value.trim();
      if (!campName) {
        return;
      }
      if (!campSettings.campNames.includes(campName)) {
        campSettings.campNames.push(campName);
      }
      if (campLocation) {
        campSettings.campLocations[campName] = campLocation;
        if (!campSettings.locationNames.includes(campLocation)) {
          campSettings.locationNames.push(campLocation);
        }
      } else {
        campSettings.campLocations[campName] = campSettings.campLocations[campName] || "";
      }
      campSettings.campNames.sort((left, right) => left.localeCompare(right));
      campSettings.locationNames.sort((left, right) => left.localeCompare(right));
      refreshCampSettingsViews();
      formNode.reset();
      await saveSettings();
      return;
    }
    const value = formNode.elements.value.value.trim();
    if (!value) {
      return;
    }
    if (!campSettings[group].includes(value)) {
      campSettings[group].push(value);
      campSettings[group].sort((left, right) => left.localeCompare(right));
      refreshCampSettingsViews();
      await saveSettings();
    }
    formNode.reset();
  });
});

document.addEventListener("click", async (event) => {
  const modalAction = event.target.closest("[data-action]");
  if (modalAction?.dataset.action === "hide-reservation-edit" || modalAction?.dataset.action === "hide-payment-edit") {
    closeInlineEditPanels();
    return;
  }
  if (modalAction?.dataset.action === "hide-trip-panel") {
    hideSelectionPanels();
    return;
  }
  if (modalAction?.dataset.action === "hide-camp-panel") {
    hideSelectionPanels();
    return;
  }
  if (modalAction?.dataset.action === "close-trip-modal") {
    closePanel(tripFormPanel);
    resetTripFormState();
    return;
  }
  if (modalAction?.dataset.action === "close-camp-modal") {
    closePanel(campFormPanel);
    editingReservationId = "";
    campStatus.textContent = "";
    return;
  }
  const target = event.target.closest('[data-action="remove-setting"]');
  if (!target) {
    return;
  }
  const group = target.dataset.group;
  const value = target.dataset.value;
  campSettings[group] = campSettings[group].filter((item) => item !== value);
  if (group === "campNames") {
    delete campSettings.campLocations[value];
  }
  refreshCampSettingsViews();
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
