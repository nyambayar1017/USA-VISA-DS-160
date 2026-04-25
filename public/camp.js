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
const campViewPdf = document.querySelector("#camp-view-pdf");
const campExportPdf = document.querySelector("#camp-export-pdf");
const campCheckin = document.querySelector("#camp-checkin");
const campCheckout = document.querySelector("#camp-checkout");
const campStays = document.querySelector("#camp-stays");
const settingsStatus = document.querySelector("#settings-status");
const campCreatedDate = campForm.querySelector('[name="createdDate"]');
const tripTabBar = document.getElementById("trip-tab-bar");
const docFilterTabsEl = document.getElementById("doc-filter-tabs");
const MONGOLIA_TIME_ZONE = "Asia/Ulaanbaatar";
const CAMP_RESERVATIONS_PATH = "/camp-reservations";
const TRIP_DETAIL_PATH = "/trip-detail";
const TRIP_TAB_PANEL_IDS = ["reservations-section", "flight-reservations-section", "flight-payments-section", "transfer-reservations-section"];
const TRIP_TAB_TO_PANELS = {
  "reservations-section": ["reservations-section"],
  "flight-reservations-section": ["flight-reservations-section", "flight-payments-section"],
  "transfer-reservations-section": ["transfer-reservations-section"],
};

let currentTrips = [];
let currentEntries = [];
let activeDocFilter = "all";
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
let activeCampDateFrom = "";
let activeCampDateTo = "";
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
  return window.location.pathname === "/camp" || window.location.pathname === "/backoffice";
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

function getReservationUnitLabel(reservationType = "") {
  return reservationType === "hotel" ? "Number of Rooms" : "Number of Gers";
}

function getReservationCampLabel(reservationType = "") {
  return reservationType === "hotel" ? "Hotel" : "Camp";
}

function getReservationRoomChoiceLabel(reservationType = "") {
  return reservationType === "hotel" ? "Room type" : "Ger / Room choice";
}

function updateReservationUnitLabels(formNode) {
  if (!formNode) {
    return;
  }
  const reservationType = formNode.elements?.reservationType?.value || "";
  formNode.querySelectorAll('[data-role="ger-count-label"]').forEach((node) => {
    node.textContent = getReservationUnitLabel(reservationType);
  });
  formNode.querySelectorAll('[data-role="camp-name-label"]').forEach((node) => {
    node.textContent = getReservationCampLabel(reservationType);
  });
  formNode.querySelectorAll('[data-role="room-choice-label"]').forEach((node) => {
    node.textContent = getReservationRoomChoiceLabel(reservationType);
  });
}

function getActiveCampEntries() {
  return sortByDateAsc(
    currentEntries.filter((entry) => {
      if (entry.campName !== activeCampName) {
        return false;
      }
      if (activeCampDateFrom && entry.checkIn < activeCampDateFrom) {
        return false;
      }
      if (activeCampDateTo && entry.checkIn > activeCampDateTo) {
        return false;
      }
      return true;
    }),
    "checkIn"
  );
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

function setActiveTab(tabId) {
  if (!tripTabBar) return;
  tripTabBar.querySelectorAll(".trip-tab").forEach(function(btn) {
    btn.classList.toggle("is-active", btn.dataset.tab === tabId);
  });
  const showIds = TRIP_TAB_TO_PANELS[tabId] || [tabId];
  TRIP_TAB_PANEL_IDS.forEach(function(id) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle("is-hidden", showIds.indexOf(id) === -1);
  });
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
  if (isTripDetailPage() && activeTripId) {
    const ws = (typeof readWorkspace === "function" ? readWorkspace() : "") || "DTX";
    if (tripTabBar) {
      if (ws === "DTX") {
        tripTabBar.classList.add("is-hidden");
        TRIP_TAB_PANEL_IDS.forEach(function(id) {
          const el = document.getElementById(id);
          if (el) el.classList.add("is-hidden");
        });
      } else {
        tripTabBar.classList.remove("is-hidden");
        setActiveTab("reservations-section");
      }
    }
    loadTripDocuments(activeTripId);
  }
  if (!options.skipScroll) {
    requestAnimationFrame(() => {
      if (tripTabBar && !tripTabBar.classList.contains("is-hidden")) {
        tripTabBar.scrollIntoView({ behavior: "smooth", block: "start" });
      } else if (activeTripReservations) {
        activeTripReservations.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }
}

function setActiveCamp(campName, options = {}) {
  activeCampName = campName || "";
  activeCampDateFrom = "";
  activeCampDateTo = "";
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

// New filter state shared across Trip filter pills (in addition to legacy
// inline inputs that still exist for back-compat with other JS).
const tripFilterState = {
  name: "",
  serial: "",
  tags: new Set(),
  status: new Set(),
  language: new Set(),
  dateFrom: "",
  dateTo: "",
};

function computeTripEndDate(trip) {
  if (!trip || !trip.startDate) return "";
  const start = new Date(trip.startDate);
  if (Number.isNaN(start.getTime())) return "";
  const days = parseInt(trip.totalDays, 10);
  if (!days || days < 1) return trip.startDate;
  const end = new Date(start);
  end.setDate(end.getDate() + days - 1);
  return end.toISOString().slice(0, 10);
}

function renderTripTagPills(tags) {
  if (!Array.isArray(tags) || tags.length === 0) return "<span class=\"trip-tag-empty\">-</span>";
  return tags
    .map((tag) => `<span class="trip-tag">${escapeHtml(tag)}</span>`)
    .join("");
}

function getFilteredTrips() {
  const name = (tripFilterState.name || "").trim().toLowerCase();
  const serial = (tripFilterState.serial || "").trim().toLowerCase();
  const tags = tripFilterState.tags;
  const statuses = tripFilterState.status;
  const langs = tripFilterState.language;
  const from = tripFilterState.dateFrom || "";
  const to = tripFilterState.dateTo || "";
  return sortByDateAsc(currentTrips, "startDate").filter((trip) => {
    const tripName = String(trip.tripName || "").toLowerCase();
    const reservationName = String(trip.reservationName || "").toLowerCase();
    const id = String(trip.id || "").toLowerCase();
    const matchesName = !name || tripName.includes(name) || reservationName.includes(name);
    const tripSerial = String(trip.serial || "").toLowerCase();
    const matchesSerial = !serial || tripSerial.includes(serial) || id.includes(serial) || reservationName.includes(serial) || tripName.includes(serial);
    const tripTags = Array.isArray(trip.tags) ? trip.tags.map((t) => String(t).toLowerCase()) : [];
    const matchesTags = tags.size === 0 || [...tags].some((t) => tripTags.includes(String(t).toLowerCase()));
    const matchesStatus = statuses.size === 0 || statuses.has(trip.status);
    const matchesLang = langs.size === 0 || langs.has(trip.language);
    const start = String(trip.startDate || "");
    const matchesFrom = !from || start >= from;
    const matchesTo = !to || start <= to;
    return matchesName && matchesSerial && matchesTags && matchesStatus && matchesLang && matchesFrom && matchesTo;
  });
}

function getFilteredEntries() {
  const campNeedle = filterCampName.value;
  const tripId = filterTripName.value;
  const reservedDate = filterReservedDate?.value || "";
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
  const currentLanguageFilter = tripFilterLanguage?.value || "";
  const currentReservationTrip = reservationTripSelect.value;
  const languages = [...new Set(currentTrips.map((trip) => trip.language).filter(Boolean).concat(["English", "French", "Mongolian", "Korean", "Spanish", "Italian", "Other"]))];
  if (tripLanguageSelect) tripLanguageSelect.innerHTML = renderOptionMarkup(languages, "Choose language");
  if (tripFilterLanguage) tripFilterLanguage.innerHTML = renderOptionMarkup(languages, "All languages");
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
  if (tripFilterLanguage) tripFilterLanguage.value = currentLanguageFilter;
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
          <col style="width: 86px" />
          <col style="width: 210px" />
          <col style="width: 118px" />
          <col style="width: 96px" />
          <col style="width: 96px" />
          <col style="width: 130px" />
          <col style="width: 52px" />
          <col style="width: 52px" />
          <col style="width: 44px" />
          <col style="width: 44px" />
          <col style="width: 96px" />
          <col style="width: 128px" />
          <col style="width: 120px" />
          <col style="width: 280px" />
        </colgroup>
        <thead>
          <tr>
            <th>#</th>
            <th>Serial</th>
            <th>Trip</th>
            <th>Reservation Name</th>
            <th>Start</th>
            <th>End</th>
            <th>Tags</th>
            <th>Pax</th>
            <th>Staff</th>
            <th>Driver</th>
            <th>Cook</th>
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
                  <td class="trip-serial-cell">
                    <a href="${buildTripDetailUrl(trip.id)}" class="trip-name-link"><strong>${escapeHtml(trip.serial || "-")}</strong></a>
                  </td>
                  <td class="table-primary-cell">${escapeHtml(trip.tripName)}</td>
                  <td>${escapeHtml(trip.reservationName || trip.tripName)}</td>
                  <td>${formatDate(trip.startDate)}</td>
                  <td>${formatDate(trip.endDate || computeTripEndDate(trip))}</td>
                  <td class="trip-tag-cell">${renderTripTagPills(trip.tags)}</td>
                  <td class="trip-pax-cell">${trip.participantCount}</td>
                  <td class="trip-pax-cell">${trip.staffCount}</td>
                  <td>${escapeHtml(trip.driverName || "-")}</td>
                  <td>${escapeHtml(trip.cookName || "-")}</td>
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
  const tripGroupName = trip.groupName ? ` · ${escapeHtml(trip.groupName)}` : "";
  const tripTypeBadge = trip.tripType ? `<span class="trip-type-pill">${escapeHtml(String(trip.tripType).toUpperCase())}</span> ` : "";
  const isFit = String(trip.tripType || "").toLowerCase() === "fit";
  const fitActions = isFit ? `
    <a class="header-action-btn" href="/contracts?openCreate=1&tripId=${encodeURIComponent(trip.id)}">+ Add contract</a>
    <a class="header-action-btn" href="/trip-detail?tripId=${encodeURIComponent(trip.id)}&openInvoiceFit=1#invoices-section">+ Add invoice</a>
  ` : "";
  // Toggle Groups section visibility based on FIT/GIT
  const groupsSection = document.getElementById("groups-section");
  if (groupsSection) groupsSection.classList.toggle("is-hidden", isFit);
  activeTripBox.innerHTML = `
    <div class="section-head">
      <div>
        <h2>${trip.serial ? `<span class="trip-serial-tag">${escapeHtml(trip.serial)}</span> ` : ""}${tripTypeBadge}${escapeHtml(trip.tripName)}${tripGroupName}</h2>
        <p>${escapeHtml(trip.reservationName || trip.tripName)} · Start ${formatDate(trip.startDate)}${trip.endDate ? ` → ${formatDate(trip.endDate)}` : ""} · ${escapeHtml(formatStatusLabel(trip.status))}</p>
        <div id="trip-flight-info" class="trip-flight-info"></div>
      </div>
      <div class="trip-summary-actions">
        ${fitActions}
        <button type="button" class="header-action-btn header-action-edit" id="active-trip-edit-btn" aria-label="Edit trip">✎ Edit</button>
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
        <span>Driver</span>
        <strong>${escapeHtml(trip.driverName || "-")}</strong>
      </article>
      <article class="trip-summary-stat">
        <span>Cook</span>
        <strong>${escapeHtml(trip.cookName || "-")}</strong>
      </article>
    </div>
  `;
  loadTripFlightInfo(trip.id);
  document.getElementById("active-trip-edit-btn")?.addEventListener("click", () => {
    startTripEdit(trip.id);
  });
}

async function loadTripFlightInfo(tripId) {
  const node = document.getElementById("trip-flight-info");
  if (!node || !tripId) return;
  try {
    const data = await fetch("/api/flight-reservations").then((r) => r.json());
    const list = (data.entries || []).filter((f) => f.tripId === tripId);
    if (!list.length) { node.innerHTML = ""; return; }
    const sorted = list.slice().sort((a, b) => String(a.departureDate || "").localeCompare(String(b.departureDate || "")));
    const out = sorted[0];
    const ret = sorted.length > 1 ? sorted[sorted.length - 1] : null;
    const fmt = (f, label) => `<span><strong>${label}:</strong> ${escapeHtml(formatDate(f.departureDate))} ${escapeHtml(f.departureTime || "")} · ${escapeHtml(f.fromCity || "-")} → ${escapeHtml(f.toCity || "-")} ${escapeHtml(f.airline || "")} ${escapeHtml(f.flightNumber || "")}</span>`;
    node.innerHTML = `${out ? fmt(out, "Depart") : ""}${ret ? fmt(ret, "Return") : ""}`;
  } catch (err) {
    node.innerHTML = "";
  }
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
          ${entries
            .map((entry, index) =>
              editingReservationId === entry.id
                ? renderEditableRow(entry, index, { showIndex: true })
                : renderReadOnlyRow(entry, index, { showIndex: true })
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
  const campEntries = sortByDateAsc(currentEntries.filter((entry) => entry.campName === activeCampName), "checkIn");
  if (!campEntries.length) {
    activeCampReservations.classList.add("is-hidden");
    activeCampReservations.innerHTML = "";
    return;
  }
  const entries = getActiveCampEntries();
  activeCampReservations.classList.remove("is-hidden");
  activeCampReservations.innerHTML = `
    <div class="section-head">
      <h2>${escapeHtml(activeCampName)} reservations</h2>
      <div class="camp-toolbar trip-detail-toolbar">
        <label class="trip-day-filter-label">
          <span>Check-in from</span>
          <input type="date" value="${escapeHtml(activeCampDateFrom)}" data-action="active-camp-date-from" />
        </label>
        <label class="trip-day-filter-label">
          <span>Check-in to</span>
          <input type="date" value="${escapeHtml(activeCampDateTo)}" data-action="active-camp-date-to" />
        </label>
        <button type="button" class="secondary-button" data-action="view-active-camp-pdf">View camp PDF</button>
        <button type="button" class="secondary-button" data-action="download-active-camp-pdf">Download camp PDF</button>
        <button type="button" class="secondary-button" data-action="hide-camp-panel">Hide table</button>
      </div>
    </div>
    ${entries.length ? "" : `<p class="empty">No reservations found for this date filter.</p>`}
    <div class="camp-table-wrap">
      <table class="camp-table camp-table-detail">
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
          ${entries.map((entry, index) => renderReadOnlyRow(entry, index, { includeCheckbox: false, showIndex: true })).join("")}
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
      <td class="table-primary-cell table-nowrap"><a href="${buildTripDetailUrl(entry.tripId)}" class="trip-name-link">${escapeHtml(entry.tripName)}</a></td>
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
      <td class="camp-row-actions compact">
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
      <td class="table-primary-cell table-nowrap"><a href="${buildTripDetailUrl(entry.tripId)}" class="trip-name-link">${escapeHtml(entry.tripName)}</a></td>
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
            <span data-role="camp-name-label">Camp</span>
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
            <span data-role="ger-count-label">Number of Gers</span>
            <input name="gerCount" type="number" min="1" value="${Number(reservationData.gerCount || 1)}" required />
          </label>
          <label>
            <span data-role="room-choice-label">Ger / Room choice</span>
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
      if (target.getAttribute("name") === "reservationType") {
        updateReservationUnitLabels(formNode);
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
  updateReservationUnitLabels(formNode);
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
  refreshFilterPopoverOptions();
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
  if (tripForm.elements.reservationName) tripForm.elements.reservationName.value = trip.reservationName || trip.tripName || "";
  tripForm.elements.startDate.value = String(trip.startDate || "").slice(0, 10);
  if (tripForm.elements.endDate) {
    tripForm.elements.endDate.value = String(trip.endDate || "").slice(0, 10);
  }
  tripForm.elements.participantCount.value = String(trip.participantCount || 0);
  tripForm.elements.staffCount.value = String(trip.staffCount || 0);
  tripForm.elements.totalDays.value = String(trip.totalDays || 1);
  if (tripForm.elements.language) tripForm.elements.language.value = trip.language || "";
  tripForm.elements.status.value = trip.status || "planning";
  if (tripForm.elements.tags) {
    tripForm.elements.tags.value = Array.isArray(trip.tags) ? trip.tags.join(", ") : "";
  }
  tripStatus.textContent = `Editing trip: ${trip.tripName}`;
  if (tripForm.elements.guideName) tripForm.elements.guideName.value = trip.guideName || "";
  if (tripForm.elements.driverName) tripForm.elements.driverName.value = trip.driverName || "";
  if (tripForm.elements.cookName) tripForm.elements.cookName.value = trip.cookName || "";
  if (tripForm.elements.tripType) {
    tripForm.elements.tripType.value = (trip.tripType || "git").toLowerCase();
  }
  if (tripForm.elements.groupName) {
    tripForm.elements.groupName.value = trip.groupName || "";
  }
  applyTripTypeMode();
}

function resetTripFormState() {
  editingTripId = "";
  tripForm.reset();
  tripForm.elements.participantCount.value = "2";
  tripForm.elements.staffCount.value = "0";
  tripForm.elements.totalDays.value = "1";
  tripForm.elements.status.value = "planning";
  if (tripForm.elements.tripType) tripForm.elements.tripType.value = "git";
  applyTripTypeMode();
  clearTripFlightRows();
  tripStatus.textContent = "";
}

function applyTripTypeMode() {
  const sel = tripForm?.elements?.tripType;
  const groupInput = tripForm?.elements?.groupName;
  const hint = document.getElementById("trip-group-name-hint");
  if (!sel || !groupInput) return;
  const isGit = (sel.value || "git").toLowerCase() === "git";
  if (isGit) {
    groupInput.required = true;
    if (hint) hint.textContent = "(required for GIT)";
  } else {
    groupInput.required = false;
    if (hint) hint.textContent = "(optional for FIT)";
  }
}

if (tripForm && tripForm.elements && tripForm.elements.tripType) {
  tripForm.elements.tripType.addEventListener("change", applyTripTypeMode);
  applyTripTypeMode();
}

function recalcTripTotalDays() {
  if (!tripForm || !tripForm.elements) return;
  const startEl = tripForm.elements.startDate;
  const endEl = tripForm.elements.endDate;
  const totalEl = tripForm.elements.totalDays;
  if (!startEl || !endEl || !totalEl) return;
  const start = startEl.value;
  const end = endEl.value;
  if (!start || !end) return;
  const startMs = new Date(start + "T00:00:00").getTime();
  const endMs = new Date(end + "T00:00:00").getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs < startMs) return;
  const days = Math.round((endMs - startMs) / 86400000) + 1;
  if (days > 0) totalEl.value = String(days);
}
if (tripForm && tripForm.elements) {
  ["startDate", "endDate"].forEach((name) => {
    const el = tripForm.elements[name];
    if (el) el.addEventListener("change", recalcTripTotalDays);
  });
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

async function viewCurrentReservations() {
  const selectedEntries = getFilteredEntries().filter((entry) => selectedReservationIds.has(entry.id));
  const entries = selectedEntries.length ? selectedEntries : getFilteredEntries();
  await exportReservationsAsPdf(entries, "camp-reservations.pdf", "view");
}

async function exportReservationsAsPdf(entries, filename = "camp-reservations.pdf", mode = "download") {
  if (!entries.length) {
    campStatus.textContent = "No reservations to export.";
    return;
  }
  campStatus.textContent = "Preparing PDF...";
  try {
    const ids = entries.map((entry) => entry.id).join(",");
    const result = await fetchJson(`/api/camp-reservations/export?ids=${encodeURIComponent(ids)}`);
    if (mode === "view") {
      window.open(result.entry.pdfViewPath || result.entry.pdfPath, "_blank", "noopener,noreferrer");
      campStatus.textContent = "PDF preview ready.";
      return;
    }
    const pdfSrc = encodeURIComponent(result.entry.pdfPath || "");
    const pdfTitle = encodeURIComponent(filename.replace(".pdf", ""));
    window.open("/pdf-viewer?src=" + pdfSrc + "&title=" + pdfTitle, "_blank", "noopener,noreferrer");
    campStatus.textContent = "PDF ready.";
  } catch (error) {
    campStatus.textContent = error.message;
  }
}

function getTripFlightsList() {
  return tripForm?.querySelector("[data-trip-flights-list]") || null;
}

function addTripFlightRow(prefill = {}) {
  const list = getTripFlightsList();
  if (!list) return;
  const idx = list.querySelectorAll(".trip-flight-row").length + 1;
  const div = document.createElement("div");
  div.className = "trip-flight-row";
  div.innerHTML = `
    <div class="trip-flight-row-head">
      <strong>Flight ${idx}</strong>
      <button type="button" class="table-link compact secondary" data-action="trip-flight-remove">Remove</button>
    </div>
    <div class="trip-flight-row-grid">
      <label>Airline<input data-flight-field="airline" placeholder="MIAT" value="${prefill.airline || ""}" /></label>
      <label>Flight #<input data-flight-field="flightNumber" placeholder="OM 301" value="${prefill.flightNumber || ""}" /></label>
      <label>From<input data-flight-field="fromCity" placeholder="UBN" value="${prefill.fromCity || ""}" /></label>
      <label>To<input data-flight-field="toCity" placeholder="SGN" value="${prefill.toCity || ""}" /></label>
      <label>Depart date<input type="date" data-flight-field="departureDate" value="${prefill.departureDate || ""}" /></label>
      <label>Depart time<input type="time" data-flight-field="departureTime" value="${prefill.departureTime || ""}" /></label>
      <label>Arrive date<input type="date" data-flight-field="arrivalDate" value="${prefill.arrivalDate || ""}" /></label>
      <label>Arrive time<input type="time" data-flight-field="arrivalTime" value="${prefill.arrivalTime || ""}" /></label>
    </div>
  `;
  list.appendChild(div);
}

function readTripFlightRows() {
  const list = getTripFlightsList();
  if (!list) return [];
  return Array.from(list.querySelectorAll(".trip-flight-row")).map((row) => {
    const obj = {};
    row.querySelectorAll("[data-flight-field]").forEach((el) => {
      obj[el.dataset.flightField] = el.value || "";
    });
    return obj;
  }).filter((f) => f.airline || f.flightNumber || f.fromCity || f.toCity || f.departureDate);
}

function clearTripFlightRows() {
  const list = getTripFlightsList();
  if (list) list.innerHTML = "";
}

tripForm?.addEventListener("click", (e) => {
  const t = e.target;
  if (!(t instanceof HTMLElement)) return;
  if (t.dataset.action === "trip-flight-add") {
    e.preventDefault();
    addTripFlightRow();
  } else if (t.dataset.action === "trip-flight-remove") {
    e.preventDefault();
    t.closest(".trip-flight-row")?.remove();
  }
});

tripForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  tripStatus.textContent = editingTripId ? "Saving trip changes..." : "Saving trip...";

  try {
    const payload = buildPayload(tripForm);
    if (!payload.language) payload.language = "Other";
    const flights = readTripFlightRows();
    const result = await fetchJson(editingTripId ? `/api/camp-trips/${editingTripId}` : "/api/camp-trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const tripId = result.entry.id;
    if (flights.length) {
      tripStatus.textContent = "Saving flights...";
      for (const f of flights) {
        const flightPayload = {
          tripId,
          tripName: result.entry.tripName,
          airline: f.airline || "",
          flightNumber: f.flightNumber || "",
          fromCity: f.fromCity || "",
          toCity: f.toCity || "",
          departureDate: f.departureDate || "",
          departureTime: f.departureTime || "",
          arrivalDate: f.arrivalDate || "",
          arrivalTime: f.arrivalTime || "",
          passengerCount: result.entry.participantCount || 0,
          staffCount: result.entry.staffCount || 0,
          touristTicketStatus: "waiting_list",
          guideTicketStatus: "waiting_list",
          paymentStatus: "unpaid",
        };
        try {
          await fetchJson("/api/flight-reservations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(flightPayload),
          });
        } catch (e) { console.warn("Flight save failed", e); }
      }
    }
    tripStatus.textContent = editingTripId ? `Trip updated: ${result.entry.tripName}` : `Trip created: ${result.entry.tripName}`;
    resetTripFormState();
    closePanel(tripFormPanel);
    await loadTrips();
    setActiveTrip(tripId);
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
  if (form && target.getAttribute("name") === "reservationType") {
    updateReservationUnitLabels(form);
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
    updateReservationUnitLabels(campForm);
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

  if (actionTarget.dataset.action === "select-trip" || actionTarget.dataset.action === "goto-trip") {
    window.location.href = buildTripDetailUrl(actionTarget.dataset.tripId);
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
    const pdfSrc = encodeURIComponent("/api/camp-reservations/" + target.dataset.id + "/document?mode=download");
    window.open("/pdf-viewer?src=" + pdfSrc + "&title=Reservation", "_blank", "noopener,noreferrer");
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
  if (action === "view-active-camp-pdf") {
    const entries = getActiveCampEntries();
    exportReservationsAsPdf(entries, `${activeCampName || "camp"}-reservations.pdf`, "view");
    return;
  }
  if (action === "download-active-camp-pdf") {
    const entries = getActiveCampEntries();
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
  if (node.dataset.action === "active-camp-date-from") {
    activeCampDateFrom = node.value;
    renderActiveCampReservations();
    return;
  }
  if (node.dataset.action === "active-camp-date-to") {
    activeCampDateTo = node.value;
    renderActiveCampReservations();
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
activeCampReservations.addEventListener("input", handleCampTableChange);
activeCampReservations.addEventListener("change", handleCampTableChange);
reservationEditPanel.addEventListener("click", handleCampTableClick);
reservationEditPanel.addEventListener("input", handleCampTableInput);
reservationEditPanel.addEventListener("change", handleCampTableChange);
paymentEditPanel.addEventListener("click", handleCampTableClick);
paymentEditPanel.addEventListener("change", handleCampTableChange);
campPaymentList.addEventListener("click", handleCampTableClick);

[filterTripName, filterCampName, filterTripStartDate, filterReservedDate, filterStatus].forEach((node) => {
  if (!node) return;
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

// Legacy refs kept null-safe for back-compat — the new pill-based
// trip filter bar is initialised by setupTripFilterBar() below.
[tripFilterName, tripFilterStartDate, tripFilterStatus, tripFilterLanguage, tripFilterCreatedDate].forEach((node) => {
  if (!node) return;
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
campForm.elements.reservationType?.addEventListener("change", () => updateReservationUnitLabels(campForm));
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
campViewPdf?.addEventListener("click", viewCurrentReservations);
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

// ── Trip Documents ──────────────────────────────────────────────────────────

const docDropZone = document.getElementById("doc-drop-zone");
const docDropInner = document.getElementById("doc-drop-inner");
const docFileInput = document.getElementById("doc-file-input");
const docCategorySelect = document.getElementById("doc-category");
const docUploadStatus = document.getElementById("doc-upload-status");
const docList = document.getElementById("doc-list");

function docFileIcon(mimeType, name) {
  const ext = (name || "").split(".").pop().toLowerCase();
  if (mimeType.includes("pdf") || ext === "pdf") return "📄";
  if (["doc", "docx"].includes(ext)) return "📝";
  if (["xls", "xlsx"].includes(ext)) return "📊";
  if (["jpg", "jpeg", "png", "gif"].includes(ext)) return "🖼️";
  return "📎";
}

function docFormatSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function docViewUrl(doc, tripId) {
  const src = "/trip-uploads/" + tripId + "/" + doc.storedName;
  const mime = doc.mimeType || "";
  if (mime.includes("pdf") || doc.storedName.endsWith(".pdf")) {
    return "/pdf-viewer?src=" + encodeURIComponent(src) + "&title=" + encodeURIComponent(doc.originalName);
  }
  return src;
}

const DOC_CATEGORY_ORDER = ["Invoices", "Flight Tickets", "Passports & Visas", "Hotel Vouchers", "Contracts", "Other"];

function renderDocFilterCounts(docs) {
  if (!docFilterTabsEl) return;
  const counts = { all: docs.length };
  docs.forEach(function(doc) {
    const cat = doc.category || "Other";
    counts[cat] = (counts[cat] || 0) + 1;
  });
  docFilterTabsEl.querySelectorAll(".doc-filter-tab").forEach(function(btn) {
    const filter = btn.dataset.filter;
    const count = counts[filter] || 0;
    const label = filter === "all" ? "All" : filter;
    btn.textContent = count > 0 ? label + " (" + count + ")" : label;
    btn.classList.toggle("is-active", filter === activeDocFilter);
  });
}

function renderDocItem(doc, tripId, num) {
  const icon = docFileIcon(doc.mimeType || "", doc.originalName);
  const size = docFormatSize(doc.size || 0);
  const uploadedAt = doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : "";
  const uploader = doc.uploadedBy ? (doc.uploadedBy.name || doc.uploadedBy.email || "") : "";
  const viewUrl = docViewUrl(doc, tripId);
  const downloadUrl = "/trip-uploads/" + tripId + "/" + doc.storedName + "?download=1";
  return (
    '<div class="doc-item">' +
      '<div class="doc-num">' + num + '</div>' +
      '<div class="doc-icon">' + icon + '</div>' +
      '<div class="doc-meta">' +
        '<div class="doc-name" title="' + escapeHtml(doc.originalName) + '">' + escapeHtml(doc.originalName) + '</div>' +
        '<div class="doc-info">' + escapeHtml(size) + (uploadedAt ? ' · ' + uploadedAt : '') + (uploader ? ' · ' + escapeHtml(uploader) : '') + '</div>' +
      '</div>' +
      '<div class="doc-actions">' +
        '<a class="secondary-button" href="' + escapeHtml(viewUrl) + '" target="_blank" rel="noreferrer">View</a>' +
        '<a class="secondary-button" href="' + escapeHtml(downloadUrl) + '" download>Download</a>' +
        '<button class="secondary-button" data-doc-rename="' + escapeHtml(doc.id) + '" data-doc-name="' + escapeHtml(doc.originalName) + '">Rename</button>' +
        '<button class="secondary-button danger-button" data-doc-delete="' + escapeHtml(doc.id) + '" data-doc-name="' + escapeHtml(doc.originalName) + '">Delete</button>' +
      '</div>' +
    '</div>'
  );
}

function renderTripDocuments(docs, tripId) {
  if (!docList) return;
  renderDocFilterCounts(docs || []);
  const filtered = activeDocFilter === "all" ? (docs || []) : (docs || []).filter(function(d) { return (d.category || "Other") === activeDocFilter; });
  if (!filtered.length) {
    docList.innerHTML = '<p class="muted" style="padding:8px 0">' + (activeDocFilter === "all" ? "No documents uploaded yet." : 'No documents in "' + escapeHtml(activeDocFilter) + '".') + '</p>';
    return;
  }
  if (activeDocFilter !== "all") {
    docList.innerHTML = filtered.map(function(doc, i) { return renderDocItem(doc, tripId, i + 1); }).join("");
    return;
  }
  const groups = {};
  filtered.forEach(function(doc) {
    const cat = doc.category || "Other";
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(doc);
  });
  const allCats = DOC_CATEGORY_ORDER.concat(Object.keys(groups).filter(function(c) { return DOC_CATEGORY_ORDER.indexOf(c) === -1; }));
  let html = "";
  let globalNum = 1;
  allCats.forEach(function(cat) {
    const group = groups[cat];
    if (!group || !group.length) return;
    html += '<div class="doc-group">';
    html += '<div class="doc-group-header">' + escapeHtml(cat) + ' <span class="doc-group-count">(' + group.length + ')</span></div>';
    group.forEach(function(doc) { html += renderDocItem(doc, tripId, globalNum++); });
    html += '</div>';
  });
  docList.innerHTML = html;
}

async function loadTripDocuments(tripId) {
  if (!docList || !isTripDetailPage()) return;
  try {
    const trips = await fetchJson("/api/camp-trips");
    const trip = (trips.entries || trips).find((t) => t.id === tripId);
    renderTripDocuments(trip ? (trip.documents || []) : [], tripId);
  } catch (_) {
    // silently fail — documents are non-critical
  }
}

async function uploadFiles(tripId, files) {
  if (!tripId) { if (docUploadStatus) docUploadStatus.textContent = "Select a trip first."; return; }
  const category = (docCategorySelect && docCategorySelect.value) || "Other";
  for (const file of files) {
    if (docUploadStatus) docUploadStatus.textContent = "Uploading " + file.name + "…";
    const form = new FormData();
    form.append("file", file);
    form.append("category", category);
    try {
      const resp = await fetch("/api/camp-trips/" + tripId + "/documents", { method: "POST", body: form });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Upload failed");
    } catch (err) {
      if (docUploadStatus) docUploadStatus.textContent = "Error: " + err.message;
      return;
    }
  }
  if (docUploadStatus) docUploadStatus.textContent = files.length + " file(s) uploaded.";
  await loadTripDocuments(tripId);
}

if (docDropZone && isTripDetailPage()) {
  docDropZone.addEventListener("dragover", (e) => { e.preventDefault(); docDropZone.classList.add("drag-over"); });
  docDropZone.addEventListener("dragleave", () => docDropZone.classList.remove("drag-over"));
  docDropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    docDropZone.classList.remove("drag-over");
    uploadFiles(activeTripId, Array.from(e.dataTransfer.files));
  });
  if (docFileInput) {
    docFileInput.addEventListener("change", () => {
      if (docFileInput.files.length) uploadFiles(activeTripId, Array.from(docFileInput.files));
      docFileInput.value = "";
    });
  }
  if (docList) {
    docList.addEventListener("click", async (e) => {
      const deleteBtn = e.target.closest("[data-doc-delete]");
      if (deleteBtn) {
        const docId = deleteBtn.dataset.docDelete;
        const docName = deleteBtn.dataset.docName || "this file";
        if (!window.confirm('Delete "' + docName + '"?')) return;
        try {
          const resp = await fetch("/api/camp-trips/" + activeTripId + "/documents/" + docId, { method: "DELETE" });
          if (!resp.ok) { const d = await resp.json(); throw new Error(d.error || "Delete failed"); }
          await loadTripDocuments(activeTripId);
        } catch (err) {
          alert("Could not delete: " + err.message);
        }
        return;
      }
      const renameBtn = e.target.closest("[data-doc-rename]");
      if (renameBtn) {
        const docId = renameBtn.dataset.docRename;
        const currentName = renameBtn.dataset.docName || "";
        const newName = window.prompt("New file name:", currentName);
        if (!newName || newName.trim() === currentName.trim()) return;
        try {
          const resp = await fetch("/api/camp-trips/" + activeTripId + "/documents/" + docId, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: newName.trim() }),
          });
          if (!resp.ok) { const d = await resp.json(); throw new Error(d.error || "Rename failed"); }
          await loadTripDocuments(activeTripId);
        } catch (err) {
          alert("Could not rename: " + err.message);
        }
      }
    });
  }
}

if (tripTabBar && isTripDetailPage()) {
  tripTabBar.addEventListener("click", function(e) {
    const tab = e.target.closest(".trip-tab");
    if (!tab) return;
    setActiveTab(tab.dataset.tab);
  });
}

if (docFilterTabsEl && isTripDetailPage()) {
  docFilterTabsEl.addEventListener("click", function(e) {
    const tab = e.target.closest(".doc-filter-tab");
    if (!tab) return;
    activeDocFilter = tab.dataset.filter;
    if (activeTripId) loadTripDocuments(activeTripId);
  });
}

// ── End Trip Documents ──────────────────────────────────────────────────────

// ── Trip filter bar (pills + saved filters) ─────────────────────────────────
const SAVED_FILTERS_KEY = "trips:savedFilters";
let tripFilterBarReady = false;
let suppressFilterRender = false;

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
    name: tripFilterState.name,
    serial: tripFilterState.serial,
    tags: [...tripFilterState.tags],
    status: [...tripFilterState.status],
    language: [...tripFilterState.language],
    dateFrom: tripFilterState.dateFrom,
    dateTo: tripFilterState.dateTo,
  };
}

function applyFilterStateFromSnapshot(snap) {
  suppressFilterRender = true;
  tripFilterState.name = snap?.name || "";
  tripFilterState.serial = snap?.serial || "";
  tripFilterState.tags = new Set(snap?.tags || []);
  tripFilterState.status = new Set(snap?.status || []);
  tripFilterState.language = new Set(snap?.language || []);
  tripFilterState.dateFrom = snap?.dateFrom || "";
  tripFilterState.dateTo = snap?.dateTo || "";
  syncFilterBarUiFromState();
  suppressFilterRender = false;
  currentTripPage = 1;
  renderTrips();
}

function syncFilterBarUiFromState() {
  const bar = document.querySelector("[data-trip-filter-bar]");
  if (!bar) return;
  const nameInput = bar.querySelector("#trip-filter-name");
  if (nameInput) nameInput.value = tripFilterState.name;
  const serialInput = bar.querySelector("#trip-filter-serial");
  if (serialInput) serialInput.value = tripFilterState.serial;
  const fromInput = bar.querySelector("#trip-filter-date-from");
  if (fromInput) fromInput.value = tripFilterState.dateFrom;
  const toInput = bar.querySelector("#trip-filter-date-to");
  if (toInput) toInput.value = tripFilterState.dateTo;
  syncPillUi("status", bar);
  syncPillUi("language", bar);
  syncPillUi("tags", bar);
  updateDateRangePillCount(bar);
}

function syncPillUi(name, bar) {
  const pill = bar.querySelector(`details[data-filter-pill="${name}"]`);
  if (!pill) return;
  const set = tripFilterState[name];
  pill.querySelectorAll("input[type=checkbox]").forEach((cb) => {
    cb.checked = set.has(cb.value);
  });
  updatePillCount(pill, set.size);
}

function updatePillCount(pill, count) {
  const badge = pill.querySelector(".trip-filter-pill-count");
  const label = pill.querySelector(".trip-filter-pill-label");
  if (!badge) return;
  if (count > 0) {
    badge.textContent = String(count);
    badge.removeAttribute("hidden");
    pill.classList.add("has-active");
    if (label) label.classList.add("has-selected");
  } else {
    badge.setAttribute("hidden", "");
    pill.classList.remove("has-active");
    if (label) label.classList.remove("has-selected");
  }
}

function updateDateRangePillCount(bar) {
  const pill = bar.querySelector('details[data-filter-pill="date-range"]');
  if (!pill) return;
  const count = (tripFilterState.dateFrom ? 1 : 0) + (tripFilterState.dateTo ? 1 : 0);
  updatePillCount(pill, count);
}

function refreshFilterPopoverOptions() {
  const bar = document.querySelector("[data-trip-filter-bar]");
  if (!bar) return;
  const tagSet = new Set();
  const langSet = new Set();
  currentTrips.forEach((trip) => {
    (trip.tags || []).forEach((t) => tagSet.add(t));
    if (trip.language) langSet.add(trip.language);
  });
  ["English", "French", "Mongolian", "Korean", "Spanish", "Italian", "Other"].forEach((l) => langSet.add(l));

  const tagsList = bar.querySelector('details[data-filter-pill="tags"] [data-popover-list]');
  if (tagsList) {
    if (tagSet.size === 0) {
      tagsList.innerHTML = '<p class="trip-filter-empty">No tags yet. Add tags when creating a trip.</p>';
    } else {
      tagsList.innerHTML = [...tagSet]
        .sort((a, b) => a.localeCompare(b))
        .map((t) => `<label class="trip-filter-checkbox"><input type="checkbox" value="${escapeHtml(t)}" data-tag-checkbox /><span>${escapeHtml(t)}</span></label>`)
        .join("");
    }
  }

  const langList = bar.querySelector('details[data-filter-pill="language"] [data-popover-list]');
  if (langList) {
    langList.innerHTML = [...langSet]
      .sort((a, b) => a.localeCompare(b))
      .map((l) => `<label class="trip-filter-checkbox"><input type="checkbox" value="${escapeHtml(l)}" data-lang-checkbox /><span>${escapeHtml(l)}</span></label>`)
      .join("");
  }

  syncPillUi("tags", bar);
  syncPillUi("language", bar);
}

let activeSavedFilterName = "";

function refreshSavedFiltersDropdown(selectName) {
  const dropdown = document.querySelector("[data-saved-filter-dropdown]");
  const popover = document.querySelector("[data-saved-filter-popover]");
  const label = document.querySelector("[data-saved-filter-current]");
  if (!dropdown || !popover || !label) return;
  const list = readSavedFilters();
  const next = selectName !== undefined ? selectName : activeSavedFilterName;
  if (next && list.some((f) => f.name === next)) {
    activeSavedFilterName = next;
    label.textContent = next;
    dropdown.classList.add("has-active");
  } else {
    activeSavedFilterName = "";
    label.textContent = "Select saved filter";
    dropdown.classList.remove("has-active");
  }
  const items = list.length
    ? list
        .map(
          (f) => `
            <div class="trip-saved-filter-item ${f.name === activeSavedFilterName ? "is-active" : ""}">
              <button type="button" class="trip-saved-filter-name" data-saved-action="apply" data-name="${escapeHtml(f.name)}">${escapeHtml(f.name)}</button>
              <button type="button" class="trip-saved-filter-remove" data-saved-action="delete" data-name="${escapeHtml(f.name)}" aria-label="Delete ${escapeHtml(f.name)}">×</button>
            </div>
          `
        )
        .join("")
    : '<p class="trip-saved-filter-empty">No saved filters yet.</p>';
  const updateBtn = activeSavedFilterName
    ? `<button type="button" class="trip-saved-filter-save trip-saved-filter-update" data-saved-action="update" data-name="${escapeHtml(activeSavedFilterName)}">↻ Update “${escapeHtml(activeSavedFilterName)}”</button>`
    : "";
  popover.innerHTML = `
    ${items}
    <div class="trip-saved-filter-divider"></div>
    ${updateBtn}
    <button type="button" class="trip-saved-filter-save" data-saved-action="save">+ Save current as…</button>
  `;
}

function setupTripFilterBar() {
  if (tripFilterBarReady) return;
  const bar = document.querySelector("[data-trip-filter-bar]");
  if (!bar) return;
  tripFilterBarReady = true;

  const onChange = () => {
    if (suppressFilterRender) return;
    currentTripPage = 1;
    renderTrips();
  };

  const nameInput = bar.querySelector("#trip-filter-name");
  nameInput?.addEventListener("input", () => {
    tripFilterState.name = nameInput.value;
    onChange();
  });
  const serialInput = bar.querySelector("#trip-filter-serial");
  serialInput?.addEventListener("input", () => {
    tripFilterState.serial = serialInput.value;
    onChange();
  });
  const fromInput = bar.querySelector("#trip-filter-date-from");
  fromInput?.addEventListener("change", () => {
    tripFilterState.dateFrom = fromInput.value;
    updateDateRangePillCount(bar);
    onChange();
  });
  const toInput = bar.querySelector("#trip-filter-date-to");
  toInput?.addEventListener("change", () => {
    tripFilterState.dateTo = toInput.value;
    updateDateRangePillCount(bar);
    onChange();
  });

  bar.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.type !== "checkbox") return;
    const pill = target.closest("details[data-filter-pill]");
    if (!pill) return;
    const name = pill.dataset.filterPill;
    if (!tripFilterState[name]) return;
    if (target.checked) tripFilterState[name].add(target.value);
    else tripFilterState[name].delete(target.value);
    updatePillCount(pill, tripFilterState[name].size);
    onChange();
  });

  // Close any open filter popover when clicking outside
  document.addEventListener("click", (event) => {
    bar.querySelectorAll("details[data-filter-pill][open]").forEach((pill) => {
      if (!pill.contains(event.target)) pill.removeAttribute("open");
    });
  });

  const dropdown = document.querySelector("[data-saved-filter-dropdown]");
  dropdown?.addEventListener("click", (event) => {
    const target = event.target.closest("[data-saved-action]");
    if (!target) return;
    event.preventDefault();
    const action = target.dataset.savedAction;
    const name = target.dataset.name || "";
    if (action === "apply") {
      const found = readSavedFilters().find((f) => f.name === name);
      if (!found) return;
      dropdown.removeAttribute("open");
      refreshSavedFiltersDropdown(name);
      applyFilterStateFromSnapshot(found.state);
    } else if (action === "delete") {
      if (!window.confirm(`Delete saved filter "${name}"?`)) return;
      const list = readSavedFilters().filter((f) => f.name !== name);
      writeSavedFilters(list);
      refreshSavedFiltersDropdown(activeSavedFilterName === name ? "" : activeSavedFilterName);
    } else if (action === "save") {
      dropdown.removeAttribute("open");
      const newName = (window.prompt("Save filter as:") || "").trim();
      if (!newName) return;
      const list = readSavedFilters().filter((f) => f.name !== newName);
      list.push({ name: newName, state: snapshotFilterState() });
      writeSavedFilters(list);
      refreshSavedFiltersDropdown(newName);
    } else if (action === "update") {
      dropdown.removeAttribute("open");
      const list = readSavedFilters().map((f) =>
        f.name === name ? { name, state: snapshotFilterState() } : f
      );
      writeSavedFilters(list);
      refreshSavedFiltersDropdown(name);
    }
  });

  document.addEventListener("click", (event) => {
    if (dropdown?.hasAttribute("open") && !dropdown.contains(event.target)) {
      dropdown.removeAttribute("open");
    }
  });

  document.querySelector("#trip-clear-filter-btn")?.addEventListener("click", () => {
    applyFilterStateFromSnapshot({});
    refreshSavedFiltersDropdown("");
  });

  refreshSavedFiltersDropdown();
}

async function init() {
  if (isTripDetailPage()) {
    TRIP_TAB_PANEL_IDS.forEach(function(id) {
      const el = document.getElementById(id);
      if (el) el.classList.add("is-hidden");
    });
  }
  campCreatedDate.value = getMongoliaToday();
  setupTripFilterBar();
  await loadSettings();
  await loadTrips();
  refreshFilterPopoverOptions();
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
  updateReservationUnitLabels(campForm);
}

init();
