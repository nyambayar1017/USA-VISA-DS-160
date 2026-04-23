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
const campLocationSelect = locationNameSelect;
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
const paymentFilterTripName = document.querySelector("#payment-filter-trip-name");
const paymentFilterCampName = document.querySelector("#payment-filter-camp-name");
const campExportPdf = document.querySelector("#camp-export-pdf");
const campCheckin = document.querySelector("#camp-checkin");
const campCheckout = document.querySelector("#camp-checkout");
const campStays = document.querySelector("#camp-stays");
const settingsStatus = document.querySelector("#settings-status");
const campCreatedDate = campForm.querySelector('[name="createdDate"]');
const MONGOLIA_TIME_ZONE = "Asia/Ulaanbaatar";
const CAMP_RESERVATIONS_PATH = "/camp-reservations";
const TRIP_DETAIL_PATH = "/trip-detail";

let currentTrips = [];
let currentEntries = [];
let campSettings = {
  campNames: [],
  locationNames: [],
  staffAssignments: [],
  roomChoices: [],
  campLocations: {},
};

function getLocationOptions() {
  return [...new Set(Object.values(campSettings.campLocations || {}).filter(Boolean).concat(campSettings.locationNames || []))].sort((left, right) =>
    String(left).localeCompare(String(right))
  );
}
let activeTripId = "";
let activeCampName = "";
let editingReservationId = "";
let editingTripId = "";
let editingPaymentGroupKey = "";
let currentPage = 1;
let currentTripPage = 1;
let currentPaymentPage = 1;
let selectedReservationIds = new Set();
let activeTripDayFilter = "";
let activeTripPanelHidden = false;
let activeCampPanelHidden = false;
const PAGE_SIZE = 15;
const TRIP_STATUS_OPTIONS = [
  ["planning", "Planning"],
  ["confirmed", "Confirmed"],
  ["travelling", "Travelling"],
  ["completed", "Completed"],
  ["cancelled", "Cancelled"],
];

function hoistModalPanelsToBody(panels) {
  panels.forEach((panel) => {
    if (!panel || panel.parentElement === document.body) {
      return;
    }
    document.body.appendChild(panel);
  });
}

hoistModalPanelsToBody([tripFormPanel, campFormPanel, reservationEditPanel, paymentEditPanel]);

function openPanel(panel) {
  if (!panel) {
    return;
  }
  if (panel.parentElement !== document.body) {
    document.body.appendChild(panel);
  }
  panel.classList.remove("is-hidden");
  document.body.classList.add("modal-open");
  panel.scrollTop = 0;
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
  if (!panel) {
    return;
  }
  panel.classList.add("is-hidden");
  if (document.querySelectorAll(".camp-modal:not(.is-hidden)").length === 0) {
    document.body.classList.remove("modal-open");
  }
}

function closeOpenTripMenus(exceptMenu = null) {
  document.querySelectorAll(".trip-menu[open]").forEach((menu) => {
    if (exceptMenu && menu === exceptMenu) {
      return;
    }
    menu.removeAttribute("open");
  });
}

function isTripsPage() {
  return window.location.pathname === "/camp";
}

function isCampReservationsPage() {
  return window.location.pathname === CAMP_RESERVATIONS_PATH;
}

function isTripDetailPage() {
  return window.location.pathname === TRIP_DETAIL_PATH;
}

function buildCampReservationsUrl(params = {}) {
  const url = new URL(CAMP_RESERVATIONS_PATH, window.location.origin);
  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      url.searchParams.set(key, value);
    }
  });
  return url.toString();
}

function buildTripDetailUrl(tripId) {
  const url = new URL(TRIP_DETAIL_PATH, window.location.origin);
  if (tripId) {
    url.searchParams.set("tripId", tripId);
  }
  return url.toString();
}

function closeInlineEditPanels() {
  editingReservationId = "";
  editingPaymentGroupKey = "";
  reservationEditPanel.classList.add("is-hidden");
  reservationEditPanel.innerHTML = "";
  paymentEditPanel.classList.add("is-hidden");
  paymentEditPanel.innerHTML = "";
  document.body.classList.remove("modal-open");
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

function formatDateParts(date, timeZone = MONGOLIA_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
}

function getMongoliaToday() {
  const parts = formatDateParts(new Date(), MONGOLIA_TIME_ZONE);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function formatMongoliaDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: MONGOLIA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const map = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day} ${map.hour}:${map.minute}`;
}

function toUtcDate(value) {
  const match = /^(\d{4})[-.](\d{2})[-.](\d{2})$/.exec(String(value || ""));
  if (!match) {
    return null;
  }
  const [, year, month, day] = match;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}

function formatUtcDate(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function formatDate(value, withTime = false) {
  if (!value) {
    return "-";
  }
  if (withTime) {
    return formatMongoliaDateTime(value);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    return String(value);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  const parts = formatDateParts(date, MONGOLIA_TIME_ZONE);
  return `${parts.year}-${parts.month}-${parts.day}`;
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
  const base = toUtcDate(dateValue);
  if (!base) {
    return "";
  }
  base.setUTCDate(base.getUTCDate() + Math.max(Number(days), 0));
  return formatUtcDate(base);
}

function diffDays(startValue, endValue) {
  if (!startValue || !endValue) {
    return "";
  }
  const start = toUtcDate(startValue);
  const end = toUtcDate(endValue);
  if (!start || !end) {
    return "";
  }
  const delta = Math.round((end - start) / (1000 * 60 * 60 * 24));
  return String(Math.max(delta, 1));
}

function normalizeStayFields(checkIn, nights, checkOut) {
  if (!checkIn) {
    return {
      checkIn: "",
      nights: String(Math.max(Number(nights || 1), 1)),
      checkOut: checkOut || "",
    };
  }
  const explicitNights = Math.max(Number(nights || 0), 0);
  if (explicitNights > 0) {
    return {
      checkIn,
      nights: String(explicitNights),
      checkOut: addDays(checkIn, explicitNights),
    };
  }
  if (checkOut) {
    const normalizedNights = diffDays(checkIn, checkOut);
    return {
      checkIn,
      nights: normalizedNights || "1",
      checkOut: addDays(checkIn, normalizedNights || 1),
    };
  }
  return {
    checkIn,
    nights: "1",
    checkOut: addDays(checkIn, 1),
  };
}

function getCreatedAtFilterValue(value) {
  if (!value) {
    return "";
  }
  return formatMongoliaDateTime(value).replace(" ", "T");
}

function getGroupPaymentValue(entries, field) {
  const match = entries.find((entry) => entry[field] !== "" && entry[field] !== null && entry[field] !== undefined);
  return match ? match[field] : "";
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
  const stay = normalizeStayFields(campCheckin.value, campStays.value, "");
  campStays.value = stay.nights;
  campCheckout.value = stay.checkOut;
}

function syncStayFromCheckout() {
  const stay = normalizeStayFields(campCheckin.value, campStays.value, campCheckout.value);
  campStays.value = stay.nights;
  campCheckout.value = stay.checkOut;
}

function setActiveTrip(tripId, options = {}) {
  activeTripId = tripId || "";
  activeTripDayFilter = "";
  activeTripPanelHidden = false;
  activeCampPanelHidden = true;
  const shouldSyncFilter = options.syncFilters !== false;
  if (shouldSyncFilter) {
    reservationTripSelect.value = activeTripId;
  }
  currentPage = 1;
  renderTrips();
  renderActiveTrip();
  renderEntries();
  renderActiveTripReservations();
  renderActiveCampReservations();
  renderCampPayments();
  if (!options.skipScroll) {
    requestAnimationFrame(() => {
      activeTripReservations.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
}

function setActiveCamp(campName, options = {}) {
  activeCampName = campName || "";
  activeCampPanelHidden = false;
  closeInlineEditPanels();
  renderEntries();
  renderActiveCampReservations();
  if (!options.skipScroll) {
    requestAnimationFrame(() => {
      activeCampReservations.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
}

function getFilteredTrips() {
  return sortByDateAsc(currentTrips, "startDate").filter((trip) => {
    const matchesTripName = !tripFilterName.value || String(trip.tripName || "").toLowerCase().includes(tripFilterName.value.trim().toLowerCase());
    const matchesStartDate = !tripFilterStartDate.value || String(trip.startDate || "") >= tripFilterStartDate.value;
    const matchesStatus = !tripFilterStatus.value || trip.status === tripFilterStatus.value;
    const matchesLanguage = !tripFilterLanguage.value || trip.language === tripFilterLanguage.value;
    const matchesCreated = !tripFilterCreatedDate.value || getCreatedAtFilterValue(trip.createdAt) === tripFilterCreatedDate.value;
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

function getFilteredPaymentGroups() {
  const grouped = new Map();
  const tripId = paymentFilterTripName?.value || "";
  const campName = paymentFilterCampName?.value || "";

  currentEntries
    .filter((entry) => {
      const matchesTrip = !tripId || entry.tripId === tripId;
      const matchesCamp = !campName || entry.campName === campName;
      return matchesTrip && matchesCamp;
    })
    .forEach((entry) => {
      const key = `${entry.tripId}::${entry.campName}`;
      const group = grouped.get(key) || {
        key,
        tripId: entry.tripId,
        tripName: entry.tripName,
        reservationName: entry.reservationName || entry.tripName,
        campName: entry.campName,
        reservations: 0,
        deposit: Number(entry.deposit || 0),
        depositPaidDate: entry.depositPaidDate || "",
        secondPayment: Number(entry.secondPayment || 0),
        secondPaidDate: entry.secondPaidDate || "",
        totalPayment: Number(entry.totalPayment || 0),
        balancePayment: Number(entry.balancePayment || 0),
        paidAmount: Number(entry.paidAmount || 0),
        paymentStatus: entry.paymentStatus || "",
        entries: [],
      };
      group.reservations += 1;
      group.entries.push(entry);
      grouped.set(key, group);
    });

  return [...grouped.values()].sort((left, right) => {
    const tripCompare = String(left.tripName || "").localeCompare(String(right.tripName || ""));
    return tripCompare || String(left.campName || "").localeCompare(String(right.campName || ""));
  });
}

function statusClass(entry) {
  const status = normalizeStatus(entry.status);
  return status ? `status-${status}` : "";
}

function renderSettingsOptions() {
  const currentTripFilter = filterTripName.value;
  const currentCampFilter = filterCampName.value;
  const currentPaymentTripFilter = paymentFilterTripName?.value || "";
  const currentPaymentCampFilter = paymentFilterCampName?.value || "";
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
  if (paymentFilterTripName) {
    paymentFilterTripName.innerHTML = `<option value="">All trips</option>${currentTrips
      .map((trip) => `<option value="${trip.id}">${escapeHtml(trip.tripName)}</option>`)
      .join("")}`;
  }
  campNameSelect.innerHTML = renderCampSelectOptions();
  locationNameSelect.innerHTML = renderGenericSelectOptions(getLocationOptions(), "Choose location");
  filterCampName.innerHTML = renderOptionMarkup(campSettings.campNames, "All camps");
  if (paymentFilterCampName) {
    paymentFilterCampName.innerHTML = renderOptionMarkup(campSettings.campNames, "All camps");
  }
  staffAssignmentSelect.innerHTML = renderOptionMarkup(campSettings.staffAssignments, "Choose staff");
  roomTypeSelect.innerHTML = renderOptionMarkup(campSettings.roomChoices, "Choose room type");
  tripFilterLanguage.value = currentLanguageFilter;
  filterTripName.value = currentTripFilter;
  filterCampName.value = currentCampFilter;
  if (paymentFilterTripName) {
    paymentFilterTripName.value = currentPaymentTripFilter;
  }
  if (paymentFilterCampName) {
    paymentFilterCampName.value = currentPaymentCampFilter;
  }

  if (activeTripId) {
    reservationTripSelect.value = activeTripId;
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
  if (!campNode || !locationNode) return;
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

function focusReservationResults(trip, options = {}) {
  if (!trip) {
    return;
  }
  activeTripId = trip.id;
  if (options.syncFilters !== false) {
    reservationTripSelect.value = trip.id;
  }
  activeTripPanelHidden = false;
  activeCampPanelHidden = true;
  currentPage = 1;
  currentTripPage = 1;
  activeTripDayFilter = "";
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
        <colgroup>
          <col style="width: 40px" />
          <col style="width: 210px" />
          <col style="width: 118px" />
          <col style="width: 96px" />
          <col style="width: 52px" />
          <col style="width: 52px" />
          <col style="width: 92px" />
          <col style="width: 44px" />
          <col style="width: 44px" />
          <col style="width: 92px" />
          <col style="width: 96px" />
          <col style="width: 128px" />
          <col style="width: 120px" />
          <col style="width: 280px" />
        </colgroup>
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
                  <td class="trip-created-cell">${formatDate(trip.createdAt, true)}</td>
                  <td>${escapeHtml(trip.createdBy?.name || trip.createdBy?.email || "-")}</td>
                  <td>
                    <div class="trip-row-actions trip-row-actions-inline">
                      <select class="inline-status-select" data-action="trip-status" data-trip-id="${trip.id}">
                        ${TRIP_STATUS_OPTIONS
                          .map(([value, label]) => `<option value="${value}" ${trip.status === value ? "selected" : ""}>${label}</option>`)
                          .join("")}
                      </select>
                      <details class="trip-menu trip-page-menu">
                        <summary class="trip-menu-trigger" aria-label="Trip actions">⋮</summary>
                        <div class="trip-menu-popover">
                          <button type="button" class="trip-menu-item" data-action="select-trip" data-trip-id="${trip.id}">View</button>
                          <button type="button" class="trip-menu-item" data-action="edit-trip" data-trip-id="${trip.id}">Edit</button>
                          <button type="button" class="trip-menu-item" data-action="add-reservation" data-trip-id="${trip.id}">Add Camp</button>
                          <button type="button" class="trip-menu-item is-danger" data-action="delete-trip" data-trip-id="${trip.id}">Delete</button>
                        </div>
                      </details>
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
  if (!activeTripId || !isTripDetailPage()) {
    activeTripBox.className = "is-hidden";
    activeTripBox.innerHTML = "";
    return;
  }
  const trip = getTripById(activeTripId);
  if (!trip) {
    activeTripBox.className = "is-hidden";
    activeTripBox.innerHTML = "";
    return;
  }
  activeTripBox.className = "card trip-summary-card";
  activeTripBox.innerHTML = `
    <div class="section-head">
      <div>
        <h2>${escapeHtml(trip.tripName)}</h2>
        <p>${escapeHtml(trip.reservationName || trip.tripName)} · Start ${formatDate(trip.startDate)} · ${escapeHtml(formatStatusLabel(trip.status))}</p>
      </div>
      <div class="camp-toolbar">
        <a class="secondary-button" href="/camp-reservations?tripId=${encodeURIComponent(trip.id)}">Camp Page</a>
        <a class="secondary-button" href="/flight-reservations?tripId=${encodeURIComponent(trip.id)}">Flights Page</a>
        <a class="secondary-button" href="/transfer-reservations?tripId=${encodeURIComponent(trip.id)}">Transfers Page</a>
      </div>
    </div>
    <div class="trip-summary-grid">
      <article class="trip-summary-stat">
        <span>Pax</span>
        <strong>${trip.participantCount}</strong>
      </article>
      <article class="trip-summary-stat">
        <span>Staff</span>
        <strong>${trip.staffCount}</strong>
      </article>
      <article class="trip-summary-stat">
        <span>Guide</span>
        <strong>${escapeHtml(trip.guideName || "-")}</strong>
      </article>
      <article class="trip-summary-stat">
        <span>Language</span>
        <strong>${escapeHtml(trip.language || "-")}</strong>
      </article>
    </div>
  `;
}

function renderCampPayments() {
  const rows = getFilteredPaymentGroups();
  if (!rows.length) {
    campPaymentList.innerHTML = '<p class="empty">No camp payment data found for the selected filters.</p>';
    return;
  }

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  currentPaymentPage = Math.min(currentPaymentPage, totalPages);
  const startIndex = (currentPaymentPage - 1) * PAGE_SIZE;
  const visibleRows = rows.slice(startIndex, startIndex + PAGE_SIZE);

  campPaymentList.innerHTML = `
    <div class="camp-table-wrap">
      <table class="camp-table camp-payment-table">
        <thead>
          <tr>
            <th>#</th>
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
          ${visibleRows
            .map(
              (row, index) => `
                <tr>
                  <td class="table-center">${startIndex + index + 1}</td>
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
    <div class="table-pagination">
      <p>${startIndex + 1}-${startIndex + visibleRows.length} / ${rows.length}</p>
      <div class="pagination-actions">
        <button type="button" data-action="payment-page-prev" ${currentPaymentPage === 1 ? "disabled" : ""}>Previous</button>
        <button type="button" data-action="payment-page-next" ${currentPaymentPage === totalPages ? "disabled" : ""}>Next</button>
      </div>
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
        <button type="button" class="secondary-button" data-action="download-active-camp-pdf">Download camp PDF</button>
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
  const meals = [entry.breakfast === "Yes" && "Breakfast", entry.lunch === "Yes" && "Lunch", entry.dinner === "Yes" && "Dinner"]
    .filter(Boolean)
    .join(" / ");
  const rowNumber = options.showIndex ? `<td class="table-center">${index + 1}</td>` : "";
  return `
    <tr class="${statusClass(entry)}">
      ${rowNumber}
      <td class="table-primary-cell table-nowrap">${escapeHtml(entry.tripName)}</td>
      <td class="table-nowrap">${escapeHtml(entry.reservationName || entry.tripName)}</td>
      <td class="table-nowrap">${getTripDayLabel(entry)}</td>
      <td><button type="button" class="table-link compact secondary" data-action="select-camp" data-camp-name="${escapeHtml(entry.campName)}">${escapeHtml(entry.campName)}</button></td>
      <td>${escapeHtml(entry.locationName || "-")}</td>
      <td>${escapeHtml(entry.reservationType === "hotel" ? "Hotel" : entry.reservationType === "herder" ? "Herder" : entry.reservationType === "tent" ? "Tent" : "Camp")}</td>
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
        <details class="trip-menu row-action-menu">
          <summary class="trip-menu-trigger" aria-label="Camp reservation actions">⋮</summary>
          <div class="trip-menu-popover">
            <button type="button" class="trip-menu-item" data-action="edit" data-id="${entry.id}">Edit</button>
            <button type="button" class="trip-menu-item" data-action="view-pdf" data-id="${entry.id}">View</button>
            <button type="button" class="trip-menu-item" data-action="download-pdf" data-id="${entry.id}">Download PDF</button>
            <button type="button" class="trip-menu-item is-danger" data-action="delete-reservation" data-id="${entry.id}">Delete</button>
          </div>
        </details>
      </td>
    </tr>
  `;
}

function renderEditableRow(entry, index, options = {}) {
  const rowNumber = options.showIndex ? `<td class="table-center">${index + 1}</td>` : "";
  return `
    <tr class="is-editing ${statusClass(entry)}">
      ${rowNumber}
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
          ${getLocationOptions().map((option) => `<option value="${escapeHtml(option)}" ${entry.locationName === option ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}
        </select>
      </td>
      <td>
        <select data-role="reservationType" data-id="${entry.id}">
          <option value="camp" ${entry.reservationType === "camp" ? "selected" : ""}>Camp reservation</option>
          <option value="tent" ${entry.reservationType === "tent" ? "selected" : ""}>Tent reservation</option>
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
      <table class="camp-table camp-reservation-table">
        <thead>
          <tr>
            <th>#</th>
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
                ? renderEditableRow(entry, startIndex + index, { showIndex: true })
                : renderReadOnlyRow(entry, startIndex + index, { showIndex: true })
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
    document.body.classList.remove("modal-open");
    return;
  }
  const isCreate = Boolean(options.isCreate);
  const reservationData = reservation || {
    id: "",
    tripId: options.tripId || activeTripId || filterTripName.value || "",
    tripName: getTripById(options.tripId || activeTripId || filterTripName.value || "")?.tripName || "",
    reservationName: "",
    createdDate: getMongoliaToday(),
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
  document.body.classList.add("modal-open");
  reservationEditPanel.innerHTML = `
    <div class="camp-modal-backdrop" data-action="hide-reservation-edit"></div>
    <div class="camp-modal-dialog camp-modal-dialog-wide">
      <div class="camp-modal-header">
        <div>
          <h2>${isCreate ? "New reservation" : "Edit reservation"}</h2>
          <p class="camp-modal-copy">${isCreate ? "Fill the reservation details and save." : "Update the reservation details and save."}</p>
        </div>
        <button type="button" class="camp-modal-close" data-action="hide-reservation-edit" aria-label="Close reservation window">×</button>
      </div>
      <form id="${isCreate ? "reservation-create-form" : "reservation-edit-form"}" class="field-grid camp-edit-panel-form">
      <input type="hidden" name="id" value="${reservationData.id || ""}" />
      <div class="camp-form-section full-span">
        <div class="camp-form-section-head">
          <h3>Reservation details</h3>
          <p>Main reservation information.</p>
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
              ${renderGenericSelectOptions(getLocationOptions(), "Choose location", reservationData.locationName || "")}
            </select>
          </label>
          <label>
            Reservation type
            <select name="reservationType" required>
              <option value="camp" ${reservationData.reservationType === "camp" ? "selected" : ""}>Camp reservation</option>
              <option value="tent" ${reservationData.reservationType === "tent" ? "selected" : ""}>Tent reservation</option>
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
    </div>
  `;
  const formNode = reservationEditPanel.querySelector("form");
  if (formNode && !formNode.dataset.boundSubmit) {
    formNode.dataset.boundSubmit = "true";
    formNode.addEventListener("submit", handleInlineReservationSubmit);
    formNode.addEventListener("input", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.getAttribute("name") === "checkIn" || target.getAttribute("name") === "nights") {
        syncInlineEditCheckout(formNode);
      }
    });
    formNode.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.getAttribute("name") === "tripId") {
        syncReservationDraftFromTrip(formNode);
        return;
      }
      if (target.getAttribute("name") === "campName") {
        syncReservationDraftFromCamp(formNode);
        return;
      }
      if (target.getAttribute("name") === "checkIn" || target.getAttribute("name") === "nights") {
        syncInlineEditCheckout(formNode);
        return;
      }
      if (target.getAttribute("name") === "checkOut") {
        syncInlineEditNights(formNode);
      }
    });
  }
  syncReservationDraftFromTrip(formNode);
  syncReservationDraftFromCamp(formNode);
  syncInlineEditNights(formNode);
}

function renderPaymentEditPanel(groupKey) {
  const entries = getEntriesByGroupKey(groupKey);
  if (!entries.length) {
    paymentEditPanel.classList.add("is-hidden");
    paymentEditPanel.innerHTML = "";
    document.body.classList.remove("modal-open");
    return;
  }
  const first = entries[0];
  const group = {
    tripId: first.tripId,
    tripName: first.tripName,
    reservationName: first.reservationName || first.tripName,
    campName: first.campName,
    locationName: first.locationName || "",
    deposit: Number(getGroupPaymentValue(entries, "deposit") || 0),
    depositPaidDate: getGroupPaymentValue(entries, "depositPaidDate") || "",
    secondPayment: Number(getGroupPaymentValue(entries, "secondPayment") || 0),
    secondPaidDate: getGroupPaymentValue(entries, "secondPaidDate") || "",
    paidAmount: Number(getGroupPaymentValue(entries, "paidAmount") || 0),
    balancePayment: Number(getGroupPaymentValue(entries, "balancePayment") || 0),
    totalPayment: Number(getGroupPaymentValue(entries, "totalPayment") || 0),
    paymentStatus: getGroupPaymentValue(entries, "paymentStatus") || "in_progress",
  };
  paymentEditPanel.classList.remove("is-hidden");
  document.body.classList.add("modal-open");
  paymentEditPanel.innerHTML = `
    <div class="camp-modal-backdrop" data-action="hide-payment-edit"></div>
    <div class="camp-modal-dialog">
      <div class="camp-modal-header">
        <div>
          <h2>Edit camp payment</h2>
          <p class="camp-modal-copy">Update payment details for this reservation.</p>
        </div>
        <button type="button" class="camp-modal-close" data-action="hide-payment-edit" aria-label="Close payment window">×</button>
      </div>
      <form id="payment-edit-form" class="field-grid">
      <input type="hidden" name="groupKey" value="${escapeHtml(groupKey)}" />
      <input type="hidden" name="tripId" value="${escapeHtml(group.tripId || "")}" />
      <input type="hidden" name="tripName" value="${escapeHtml(group.tripName || "")}" />
      <input type="hidden" name="reservationName" value="${escapeHtml(group.reservationName || "")}" />
      <input type="hidden" name="campName" value="${escapeHtml(group.campName || "")}" />
      <input type="hidden" name="locationName" value="${escapeHtml(group.locationName || "")}" />
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
    </div>
  `;
  const paymentFormNode = paymentEditPanel.querySelector("form");
  if (paymentFormNode && !paymentFormNode.dataset.boundSubmit) {
    paymentFormNode.dataset.boundSubmit = "true";
    paymentFormNode.addEventListener("submit", handleInlinePaymentSubmit);
  }
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
  const isEdit = target.id === "reservation-edit-form" || Boolean(editingReservationId);
  if (isEdit && !payload.id && editingReservationId) {
    payload.id = editingReservationId;
  }
  if (isEdit && !payload.id) {
    if (statusNode) statusNode.textContent = "Missing reservation id.";
    return;
  }
  const selectedTrip = getTripById(payload.tripId);
  if (!selectedTrip) {
    if (statusNode) statusNode.textContent = "Please select a trip first.";
    return;
  }
  const stay = normalizeStayFields(payload.checkIn, payload.nights, payload.checkOut);
  payload.checkIn = stay.checkIn;
  payload.nights = stay.nights;
  payload.checkOut = stay.checkOut;
  const nightsNode = target.querySelector('[name="nights"]');
  const checkOutNode = target.querySelector('[name="checkOut"]');
  if (nightsNode) {
    nightsNode.value = payload.nights;
  }
  if (checkOutNode) {
    checkOutNode.value = payload.checkOut;
  }
  if (!payload.createdDate) {
    payload.createdDate = formatDate(new Date().toISOString());
  }
  if (!payload.locationName && payload.campName) {
    payload.locationName = getCampLocation(payload.campName);
  }
  payload.tripId = selectedTrip.id;
  payload.tripName = selectedTrip.tripName;
  payload.reservationName = payload.reservationName || selectedTrip.reservationName || selectedTrip.tripName;
  try {
    const result = await fetchJson(isEdit ? `/api/camp-reservations/${payload.id}` : "/api/camp-reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const savedEntry = result?.entry || null;
    if (savedEntry?.id) {
      if (isEdit) {
        currentEntries = currentEntries.map((entry) => (entry.id === savedEntry.id ? savedEntry : entry));
      } else {
        currentEntries = [savedEntry, ...currentEntries.filter((entry) => entry.id !== savedEntry.id)];
      }
      selectedReservationIds = new Set([savedEntry.id]);
    }
    closeInlineEditPanels();
    closeReservationEditPanel();
    campStatus.textContent = isEdit ? "Reservation updated successfully." : "Reservation saved successfully.";
    await loadSettings();
    await loadTrips();
    await loadReservations();
    const nextTrip = getTripById(payload.tripId) || selectedTrip;
    focusReservationResults(nextTrip, { syncFilters: false });
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
  if (!entries.length) {
    if (statusNode) statusNode.textContent = "No reservations found for this camp payment.";
    return;
  }
  if (!payload.reservationName) {
    payload.reservationName = entries[0]?.reservationName || entries[0]?.tripName || "";
  }
  if (!payload.reservationName) {
    if (statusNode) statusNode.textContent = "Missing reservation name.";
    return;
  }
  try {
    const updates = await Promise.all(
      entries.map((entry) =>
        fetchJson(`/api/camp-reservations/${entry.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tripId: payload.tripId || entry.tripId,
            tripName: payload.tripName || entry.tripName,
            reservationName: payload.reservationName || entry.reservationName,
            campName: payload.campName || entry.campName,
            locationName: payload.locationName || entry.locationName,
            reservationType: entry.reservationType,
            createdDate: entry.createdDate,
            checkIn: entry.checkIn,
            checkOut: entry.checkOut,
            nights: entry.nights,
            roomType: entry.roomType,
            status: entry.status,
            staffAssignment: entry.staffAssignment,
            notes: entry.notes,
            breakfast: entry.breakfast,
            lunch: entry.lunch,
            dinner: entry.dinner,
            clientCount: entry.clientCount,
            staffCount: entry.staffCount,
            gerCount: entry.gerCount,
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
    campStatus.textContent = "Camp payment saved successfully.";
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
      locationNames: getLocationOptions(),
      staffAssignments: campSettings.staffAssignments,
      roomChoices: campSettings.roomChoices,
      campLocations: campSettings.campLocations,
    };
    const result = await fetchJson("/api/camp-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (result?.entry) {
      campSettings = result.entry;
      renderAllSettings();
    }
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
  if (!checkInNode || !nightsNode || !checkOutNode) {
    return;
  }
  const stay = normalizeStayFields(checkInNode.value, nightsNode.value, "");
  nightsNode.value = stay.nights;
  checkOutNode.value = stay.checkOut;
}

function syncInlineEditNights(formNode) {
  const checkInNode = formNode.querySelector('[name="checkIn"]');
  const nightsNode = formNode.querySelector('[name="nights"]');
  const checkOutNode = formNode.querySelector('[name="checkOut"]');
  if (!checkInNode || !nightsNode || !checkOutNode) {
    return;
  }
  const stay = normalizeStayFields(checkInNode.value, nightsNode.value, checkOutNode.value);
  nightsNode.value = stay.nights;
  checkOutNode.value = stay.checkOut;
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

  const stay = normalizeStayFields(payload.checkIn, payload.nights, payload.checkOut);
  payload.checkIn = stay.checkIn;
  payload.nights = stay.nights;
  payload.checkOut = stay.checkOut;

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
      setActiveTrip(existingEntry.tripId, { syncFilters: false });
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
  await exportReservationsAsPdf(entries, "camp-reservations.pdf");
}

async function exportReservationsAsPdf(entries, filename = "camp-reservations.pdf") {
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
    link.download = filename;
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
  const stay = normalizeStayFields(payload.checkIn, payload.nights, payload.checkOut);
  payload.checkIn = stay.checkIn;
  payload.nights = stay.nights;
  payload.checkOut = stay.checkOut;
  campStays.value = stay.nights;
  campCheckout.value = stay.checkOut;
  if (!payload.createdDate) {
    payload.createdDate = getMongoliaToday();
    campCreatedDate.value = payload.createdDate;
  }
  if (!payload.locationName && payload.campName) {
    payload.locationName = getCampLocation(payload.campName);
    if (payload.locationName) {
      campLocationSelect.value = payload.locationName;
    }
  }
  payload.tripId = selectedTrip.id;
  payload.tripName = selectedTrip.tripName;
  payload.reservationName = payload.reservationName || selectedTrip.reservationName || selectedTrip.tripName;

  try {
    const result = await fetchJson(editingReservationId ? `/api/camp-reservations/${editingReservationId}` : "/api/camp-reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const savedEntry = result?.entry || null;
    if (savedEntry?.id) {
      if (editingReservationId) {
        currentEntries = currentEntries.map((entry) => (entry.id === savedEntry.id ? savedEntry : entry));
      } else {
        currentEntries = [savedEntry, ...currentEntries.filter((entry) => entry.id !== savedEntry.id)];
      }
      selectedReservationIds = new Set([savedEntry.id]);
    }
    campStatus.textContent = editingReservationId ? "Reservation updated successfully." : "Reservation saved successfully.";
    campForm.reset();
    campCreatedDate.value = getMongoliaToday();
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
    const nextTrip = getTripById(selectedTrip.id) || selectedTrip;
    focusReservationResults(nextTrip);
    renderEntries();
    renderActiveTripReservations();
    renderActiveCampReservations();
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
  if (actionTarget.closest(".trip-menu")) {
    closeOpenTripMenus();
  }

  if (actionTarget.dataset.action === "select-trip") {
    if (isTripsPage()) {
      window.location.href = buildTripDetailUrl(actionTarget.dataset.tripId);
      return;
    }
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
  const menuTrigger = event.target.closest(".trip-menu summary");
  if (menuTrigger) {
    event.stopPropagation();
    return;
  }

  const target = event.target.closest("[data-action]");
  if (!target) {
    return;
  }
  if (target.closest(".trip-menu")) {
    closeOpenTripMenus();
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
    if (isTripsPage()) {
      window.location.href = buildCampReservationsUrl({ campName: target.dataset.campName });
      return;
    }
    setActiveCamp(target.dataset.campName);
    return;
  }
  if (action === "download-active-camp-pdf") {
    const entries = sortByDateAsc(currentEntries.filter((entry) => entry.campName === activeCampName), "checkIn");
    exportReservationsAsPdf(entries, `${activeCampName || "camp"}-reservations.pdf`);
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
  if (action === "payment-page-prev") {
    currentPaymentPage = Math.max(1, currentPaymentPage - 1);
    renderCampPayments();
    return;
  }
  if (action === "payment-page-next") {
    const totalPages = Math.max(1, Math.ceil(getFilteredPaymentGroups().length / PAGE_SIZE));
    currentPaymentPage = Math.min(totalPages, currentPaymentPage + 1);
    renderCampPayments();
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
      const stay = normalizeStayFields(checkInNode.value, nightsNode.value, "");
      nightsNode.value = stay.nights;
      checkOutNode.value = stay.checkOut;
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
      const stay = normalizeStayFields(checkInNode.value, nightsNode.value, checkOutNode.value);
      nightsNode.value = stay.nights;
      checkOutNode.value = stay.checkOut;
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

[paymentFilterTripName, paymentFilterCampName].forEach((node) => {
  node?.addEventListener("input", () => {
    currentPaymentPage = 1;
    renderCampPayments();
  });
  node?.addEventListener("change", () => {
    currentPaymentPage = 1;
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
campNameSelect?.addEventListener("change", () => applyCampLocationToForm(campForm));
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
  const clickedMenu = event.target.closest(".trip-menu");
  if (!clickedMenu) {
    closeOpenTripMenus();
  }
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
  campCreatedDate.value = getMongoliaToday();
  await loadSettings();
  await loadTrips();
  await loadReservations();
  if (isCampReservationsPage() || isTripDetailPage()) {
    const params = new URLSearchParams(window.location.search);
    const tripId = params.get("tripId");
    const campName = params.get("campName");
    if (tripId && getTripById(tripId)) {
      setActiveTrip(tripId, { skipScroll: true });
      tripStatus.textContent = `Selected trip: ${getTripById(tripId)?.tripName || ""}`;
    }
    if (campName) {
      setActiveCamp(campName, { skipScroll: true });
    }
  }
  syncCheckoutFromStay();
}

init();
