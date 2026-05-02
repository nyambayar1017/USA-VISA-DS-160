const tripForm = document.querySelector("#trip-form");
const tripStatus = document.querySelector("#trip-status");
const tripList = document.querySelector("#trip-list");
// Trip-list View dropdown wiring (column visibility toggles).
(function () {
  const popover = document.getElementById("trip-list-view-popover");
  const dropdown = document.getElementById("trip-list-view-dropdown");
  if (!popover || !dropdown) return;
  popover.addEventListener("change", (e) => {
    const cb = e.target.closest('input[type="checkbox"][data-col]');
    if (!cb) return;
    const key = cb.dataset.col;
    if (cb.checked) visibleTripListColumns.add(key);
    else visibleTripListColumns.delete(key);
    writeTripListColumns();
    renderTrips();
  });
  popover.addEventListener("click", (e) => {
    if (e.target.closest("[data-close-view]")) dropdown.removeAttribute("open");
  });
  document.addEventListener("click", (e) => {
    if (!dropdown.open) return;
    if (dropdown.contains(e.target)) return;
    dropdown.removeAttribute("open");
  });
})();
const tripToggleForm = document.querySelector("#trip-toggle-form");
const tripFormPanel = document.querySelector("#trip-form-panel");
const activeTripBox = document.querySelector("#active-trip");
const activeTripReservations = document.querySelector("#active-trip-reservations");
const activeTripCampPayments = document.querySelector("#active-trip-camp-payments");
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
// On pages where the Selected Trip dropdown is visible (camp-reservations,
// flight-reservations, transfer-reservations), upgrade the native <select>
// into a searchable picker once the helper has loaded. Trip-detail hides the
// select via [data-trip-scope-hide], so the upgrade has no visual effect there.
if (reservationTripSelect && window.TripPicker) {
  window.TripPicker.upgrade(reservationTripSelect, { placeholder: "Choose trip…" });
}
const campNameSelect = document.querySelector("#camp-name-select");
// Same searchable picker for the Camp/Hotel dropdown — usable when there are
// hundreds of camps and hotels.
if (campNameSelect && window.TripPicker) {
  window.TripPicker.upgrade(campNameSelect, { placeholder: "Choose camp…" });
}
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
const campCreatedDate = campForm ? campForm.querySelector('[name="createdDate"]') : null;
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
const selectedTripIds = new Set();
let activeCampDateFrom = "";
let activeCampDateTo = "";
let activeTripPanelHidden = false;
let activeCampPanelHidden = false;
const PAGE_SIZE = 20;
const TRIP_STATUS_OPTIONS = [
  ["offer", "Offer"],
  ["confirmed", "Confirmed"],
  ["cancelled", "Cancelled"],
  ["ignored", "Ignored"],
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
  // USM only operates inside Mongolia, so the international destinations
  // dropdown is irrelevant on every USM trip — hide it when the trip form
  // opens in that workspace. Same logic for the per-trip Flights block:
  // USM tracks flights in its workspace-level Flight Reservations page,
  // not bolted onto the trip record, so the inline editor would just
  // duplicate that flow.
  const ws = (typeof readWorkspace === "function" ? readWorkspace() : "") || "";
  const destBlock = panel.querySelector("[data-trip-form-destinations]");
  if (destBlock) {
    destBlock.style.display = ws === "USM" ? "none" : "";
  }
  const flightsBlock = panel.querySelector("[data-trip-form-flights]");
  if (flightsBlock) {
    flightsBlock.style.display = ws === "USM" ? "none" : "";
  }
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
  document.querySelectorAll(".trip-menu[open], .doc-menu[open]").forEach((menu) => {
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

// On the trip-detail page (and any reservations page entered with a ?tripId
// in the URL) the active trip is implied — there's no need to expose Trip
// Name filters or Selected Trip form fields. Tagging the body with
// `is-trip-scoped` lets the CSS collapse those controls. Also drop the
// `required` attribute on the hidden trip selects so form validation
// doesn't refuse submit just because the user can't see the field.
function hasTripIdUrlParam() {
  try { return !!new URLSearchParams(window.location.search).get("tripId"); }
  catch { return false; }
}
if (isTripDetailPage() || hasTripIdUrlParam()) {
  document.body.classList.add("is-trip-scoped");
  document.querySelectorAll("[data-trip-scope-hide]").forEach((el) => {
    // Belt-and-suspenders: in addition to the CSS rule, set display:none
    // inline so the field disappears even if the stylesheet was cached
    // before the rule was added.
    el.style.setProperty("display", "none", "important");
    el.querySelectorAll("select[required]").forEach((sel) => sel.removeAttribute("required"));
  });
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
    offer: "Offer",
    planning: "Planning",
    confirmed: "Confirmed",
    travelling: "Travelling",
    completed: "Completed",
    cancelled: "Cancelled",
    ignored: "Ignored",
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

// Used when the active tripId in the URL doesn't match anything in the
// workspace's filtered trip list — could be a real deletion, or a
// notification-clicked trip that lives in the OTHER workspace. Hit the
// workspace-agnostic /info endpoint to find out, and rewrite the banner.
async function verifyTripExistsCrossWorkspace(tripId) {
  const banner = document.querySelector("[data-trip-missing-banner]");
  try {
    const r = await fetch(`/api/camp-trips/${encodeURIComponent(tripId)}/info`);
    if (!r.ok) {
      if (banner) banner.innerHTML = '<span>!</span><strong>This trip has been deleted.</strong>';
      return;
    }
    const data = await r.json();
    const tripCompany = (data.company || "").toUpperCase();
    const currentWs = (typeof readWorkspace === "function" ? readWorkspace() : "") || "";
    if (tripCompany && currentWs && tripCompany !== currentWs) {
      // Auto-switch — coming here from a notification means the user
      // already wants to view this trip; making them click another button
      // is friction. Set the workspace and reload so the page picks up
      // the new scope.
      const tripLabel = `${data.serial || ""} ${data.tripName || ""}`.trim() || "this trip";
      if (banner) {
        banner.innerHTML = `<span>↺</span><strong>Switching to ${tripCompany} workspace for ${escapeHtml(tripLabel)}…</strong>`;
      }
      if (typeof setWorkspace === "function") setWorkspace(tripCompany);
      try { sessionStorage.clear(); } catch {}
      window.location.reload();
      return;
    }
    if (banner) {
      // Same workspace but missing locally → must actually be deleted (or our
      // local trips list is stale; the page reload covers that case).
      banner.innerHTML = '<span>!</span><strong>This trip has been deleted.</strong>';
    }
  } catch {
    if (banner) banner.innerHTML = '<span>!</span><strong>Could not load trip.</strong>';
  }
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action='switch-ws-and-reload']");
  if (!btn) return;
  const target = (btn.dataset.targetWs || "").toUpperCase();
  if (!target) return;
  if (typeof setWorkspace === "function") setWorkspace(target);
  // Force live-list / page caches to drop the stale workspace's data.
  try { sessionStorage.clear(); } catch {}
  window.location.reload();
});

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
  if (!campCheckin || !campStays || !campCheckout) return;
  const stay = normalizeStayFields(campCheckin.value, campStays.value, "");
  campStays.value = stay.nights;
  campCheckout.value = stay.checkOut;
}

function syncStayFromCheckout() {
  if (!campCheckin || !campStays || !campCheckout) return;
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
  renderCampPayments();  renderActiveTripCampPayments();
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
  renderCampPayments();  renderActiveTripCampPayments();
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

const TRIP_LIST_COLUMNS = [
  { key: "select", label: "", fixed: true, default: true },
  { key: "rowNum", label: "#", fixed: true, default: true },
  { key: "serial", label: "Serial", default: true },
  { key: "type", label: "Type", default: true },
  { key: "tripName", label: "Trip", default: true },
  { key: "startDate", label: "Start", default: true },
  { key: "endDate", label: "End", default: true },
  { key: "destinations", label: "Destinations", default: true },
  { key: "pax", label: "Pax", default: true },
  { key: "staff", label: "Staff", default: true },
  { key: "status", label: "Status", default: true },
  { key: "createdAt", label: "Created", default: true },
  { key: "manager", label: "Manager", default: true },
  { key: "actions", label: "Actions", fixed: true, default: true },
];
const TRIP_LIST_VIEW_KEY = "trip-list:visibleColumns";
function readTripListColumns() {
  try {
    const raw = localStorage.getItem(TRIP_LIST_VIEW_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        const set = new Set(arr);
        TRIP_LIST_COLUMNS.filter((c) => c.fixed).forEach((c) => set.add(c.key));
        return set;
      }
    }
  } catch {}
  return new Set(TRIP_LIST_COLUMNS.filter((c) => c.default).map((c) => c.key));
}
let visibleTripListColumns = readTripListColumns();
function writeTripListColumns() {
  try { localStorage.setItem(TRIP_LIST_VIEW_KEY, JSON.stringify([...visibleTripListColumns])); } catch {}
}

function renderTripListViewToggle() {
  const popover = document.getElementById("trip-list-view-popover");
  if (!popover) return;
  popover.innerHTML =
    '<div class="ts-view-head"><p class="ts-view-title">Toggle columns</p>' +
    '<button type="button" class="ts-view-close" data-close-view aria-label="Close">×</button></div>' +
    TRIP_LIST_COLUMNS.filter((c) => !c.fixed).map((c) => `
      <label class="ts-view-row">
        <input type="checkbox" data-col="${escapeHtml(c.key)}" ${visibleTripListColumns.has(c.key) ? "checked" : ""} />
        <span>${escapeHtml(c.label)}</span>
      </label>
    `).join("");
}

// Column model for the chosen-trip "<TripName> reservations" detail table.
// `col` is the 1-based index in the rendered table so we can hide via
// :nth-child() in a generated <style> block.
const CAMP_DETAIL_COLUMNS = [
  { key: "rowNum", label: "#", col: 1, fixed: true, default: true },
  { key: "trip", label: "Trip", col: 2, default: false },
  { key: "reservationName", label: "Reservation Name", col: 3, default: true },
  { key: "day", label: "Day", col: 4, default: true },
  { key: "camp", label: "Camp", col: 5, default: true },
  { key: "location", label: "Location", col: 6, default: true },
  { key: "type", label: "Type", col: 7, default: true },
  { key: "clients", label: "Clients", col: 8, default: true },
  { key: "staff", label: "Staff", col: 9, default: true },
  { key: "checkIn", label: "Check-in", col: 10, default: true },
  { key: "nights", label: "Nights", col: 11, default: true },
  { key: "checkOut", label: "Check-out", col: 12, default: true },
  { key: "gers", label: "Gers", col: 13, default: false },
  { key: "room", label: "Room", col: 14, default: true },
  { key: "assignedStaff", label: "Assigned Staff", col: 15, default: true },
  { key: "status", label: "Status", col: 16, default: true },
  { key: "createdBy", label: "Created by", col: 17, default: false },
  { key: "notes", label: "Notes", col: 18, default: true },
  { key: "meals", label: "Meals", col: 19, default: false },
  { key: "actions", label: "Actions", col: 20, fixed: true, default: true },
];
const CAMP_DETAIL_VIEW_KEY = "camp-detail:visibleColumns";
function readCampDetailColumns() {
  try {
    const raw = localStorage.getItem(CAMP_DETAIL_VIEW_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        const set = new Set(arr);
        CAMP_DETAIL_COLUMNS.filter((c) => c.fixed).forEach((c) => set.add(c.key));
        return set;
      }
    }
  } catch {}
  return new Set(CAMP_DETAIL_COLUMNS.filter((c) => c.default).map((c) => c.key));
}
let visibleCampDetailColumns = readCampDetailColumns();
function writeCampDetailColumns() {
  try { localStorage.setItem(CAMP_DETAIL_VIEW_KEY, JSON.stringify([...visibleCampDetailColumns])); } catch {}
}
function buildCampDetailHideStyle() {
  const hidden = CAMP_DETAIL_COLUMNS.filter((c) => !visibleCampDetailColumns.has(c.key));
  if (!hidden.length) return "";
  const rules = hidden.map((c) => `.camp-table-detail th:nth-child(${c.col}),.camp-table-detail td:nth-child(${c.col}){display:none}`).join("");
  return `<style data-camp-detail-hide>${rules}</style>`;
}
function renderCampDetailViewPopover() {
  return CAMP_DETAIL_COLUMNS.filter((c) => !c.fixed).map((c) => `
    <label class="ts-view-row">
      <input type="checkbox" data-cdcol="${escapeHtml(c.key)}" ${visibleCampDetailColumns.has(c.key) ? "checked" : ""} />
      <span>${escapeHtml(c.label)}</span>
    </label>
  `).join("");
}
// Listen once for changes anywhere — the toolbar that hosts the popover gets
// re-rendered each time renderActiveTripReservations() runs, so use document
// delegation rather than re-binding handlers.
document.addEventListener("change", (e) => {
  const cb = e.target && e.target.closest && e.target.closest('input[type="checkbox"][data-cdcol]');
  if (!cb) return;
  const key = cb.dataset.cdcol;
  if (cb.checked) visibleCampDetailColumns.add(key);
  else visibleCampDetailColumns.delete(key);
  writeCampDetailColumns();
  renderActiveTripReservations();
});
document.addEventListener("click", (e) => {
  if (!e.target || !e.target.closest) return;
  const closer = e.target.closest("[data-close-camp-detail-view]");
  if (closer) {
    const dd = closer.closest("details");
    if (dd) dd.removeAttribute("open");
    return;
  }
  const dd = document.getElementById("camp-detail-view-dropdown");
  if (!dd || !dd.open) return;
  if (!dd.contains(e.target)) dd.removeAttribute("open");
});

// Tourists in trips that have actually been booked (confirmed) or are
// past that point (travelling, completed). Excludes offer/planning/cancelled.
const CONFIRMED_TOURIST_STATUSES = new Set(["confirmed", "travelling", "completed"]);

// FIT trips: participantCount is the actual tourist count.
// GIT trips: participantCount is the planned/max slots; actualTouristCount
// is how many real tourists are booked so far. The "5/10" cell means 5 actual
// of 10 slots — this stat counts the 5.
function tripActualPax(trip) {
  const isFit = String(trip.tripType || "").toLowerCase() === "fit";
  return isFit ? Number(trip.participantCount) || 0 : Number(trip.actualTouristCount) || 0;
}

function computeConfirmedTouristStats(allTrips) {
  const confirmed = allTrips.filter((t) => CONFIRMED_TOURIST_STATUSES.has(normalizeStatus(t.status)));
  let total = 0;
  let fitTrips = 0;
  let gitTrips = 0;
  let fitPax = 0;
  let gitPax = 0;
  const byDestination = new Map();
  const byStatus = new Map();
  const byMonth = new Map();
  confirmed.forEach((t) => {
    const isFit = String(t.tripType || "").toLowerCase() === "fit";
    const pax = tripActualPax(t);
    total += pax;
    if (isFit) { fitTrips += 1; fitPax += pax; }
    else { gitTrips += 1; gitPax += pax; }
    const tags = Array.isArray(t.tags) ? t.tags.filter(Boolean) : [];
    if (pax) {
      // A trip with multiple destinations (e.g. "Singapore Malaysia") is
      // ONE trip, not one per destination — combine the tags into a single
      // key so the sum across rows equals the overall total. Sort the tags
      // first so "Singapore, Malaysia" and "Malaysia, Singapore" don't end
      // up as different buckets.
      const key = tags.length
        ? tags.slice().sort((a, b) => a.localeCompare(b)).join(", ")
        : "(no destination)";
      byDestination.set(key, (byDestination.get(key) || 0) + pax);
    }
    const statusKey = normalizeStatus(t.status) || "unknown";
    byStatus.set(statusKey, (byStatus.get(statusKey) || 0) + pax);
    const month = String(t.startDate || "").slice(0, 7);
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      byMonth.set(month, (byMonth.get(month) || 0) + pax);
    }
  });
  return {
    total,
    totalTrips: confirmed.length,
    fitTrips,
    gitTrips,
    fitPax,
    gitPax,
    byDestination: [...byDestination.entries()].sort((a, b) => b[1] - a[1]),
    byStatus: [...byStatus.entries()].sort((a, b) => b[1] - a[1]),
    byMonth: [...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0])),
  };
}

function renderConfirmedStatsModal(stats) {
  const monthLabel = (key) => {
    const [y, m] = key.split("-");
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${months[Number(m) - 1] || m} ${y}`;
  };
  const section = (title, rows, formatLabel = (s) => s) => `
    <section class="confirmed-modal-section">
      <h3>${escapeHtml(title)}</h3>
      ${rows.length
        ? `<div class="confirmed-modal-rows">${rows.map(([k, v]) => `<div class="confirmed-modal-row"><span>${escapeHtml(formatLabel(k))}</span><strong>${v}</strong></div>`).join("")}</div>`
        : `<p class="confirmed-modal-empty">No data.</p>`}
    </section>
  `;
  const tripTypeRows = [];
  if (stats.fitTrips) tripTypeRows.push([`FIT (${stats.fitTrips} trip${stats.fitTrips > 1 ? "s" : ""})`, stats.fitPax]);
  if (stats.gitTrips) tripTypeRows.push([`GIT (${stats.gitTrips} trip${stats.gitTrips > 1 ? "s" : ""})`, stats.gitPax]);
  return `
    <div class="confirmed-modal-headline">
      <span class="confirmed-modal-headline-icon">✓</span>
      <strong class="confirmed-modal-headline-count">${stats.total}</strong>
      <span class="confirmed-modal-headline-label">tourists confirmed across ${stats.totalTrips} trip${stats.totalTrips === 1 ? "" : "s"}</span>
    </div>
    <div class="confirmed-modal-grid">
      ${section("By trip type", tripTypeRows)}
      ${section("By status", stats.byStatus, (s) => formatStatusLabel(s))}
      ${section("By destination", stats.byDestination)}
      ${section("By start month", stats.byMonth, monthLabel)}
    </div>
  `;
}

function openConfirmedStatsModal() {
  const modal = document.getElementById("confirmed-stats-modal");
  if (!modal) return;
  const body = modal.querySelector("[data-confirmed-modal-body]");
  if (body) body.innerHTML = renderConfirmedStatsModal(computeConfirmedTouristStats(currentTrips));
  modal.classList.remove("is-hidden");
  modal.removeAttribute("hidden");
}

function closeConfirmedStatsModal() {
  const modal = document.getElementById("confirmed-stats-modal");
  if (!modal) return;
  modal.classList.add("is-hidden");
  modal.setAttribute("hidden", "");
}

(function ensureConfirmedStatsModal() {
  if (document.getElementById("confirmed-stats-modal")) return;
  const wrapper = document.createElement("div");
  wrapper.id = "confirmed-stats-modal";
  wrapper.className = "camp-modal is-hidden";
  wrapper.setAttribute("hidden", "");
  wrapper.innerHTML = `
    <div class="camp-modal-backdrop" data-action="close-confirmed-stats"></div>
    <div class="camp-modal-dialog confirmed-modal-dialog">
      <div class="camp-modal-header">
        <h2>Confirmed tourists</h2>
        <button type="button" class="camp-modal-close" data-action="close-confirmed-stats" aria-label="Close">×</button>
      </div>
      <div class="confirmed-modal-body" data-confirmed-modal-body></div>
    </div>
  `;
  document.body.appendChild(wrapper);
  wrapper.addEventListener("click", (e) => {
    const target = e.target;
    if (target instanceof HTMLElement && target.dataset.action === "close-confirmed-stats") {
      closeConfirmedStatsModal();
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !wrapper.classList.contains("is-hidden")) closeConfirmedStatsModal();
  });
})();

function renderTrips() {
  const trips = getFilteredTrips();
  renderTripListViewToggle();
  if (!trips.length) {
    tripList.innerHTML = '<p class="empty">No trips found for the selected filters.</p>';
    return;
  }

  const totalPages = Math.max(1, Math.ceil(trips.length / PAGE_SIZE));
  currentTripPage = Math.min(currentTripPage, totalPages);
  const startIndex = (currentTripPage - 1) * PAGE_SIZE;
  const visibleTrips = trips.slice(startIndex, startIndex + PAGE_SIZE);
  const confirmedStats = computeConfirmedTouristStats(currentTrips);
  const cols = TRIP_LIST_COLUMNS.filter((c) => visibleTripListColumns.has(c.key));

  const headers = cols.map((c) => {
    if (c.key === "select") {
      return '<th class="trip-cb-cell"><input type="checkbox" id="trip-rooming-select-all" aria-label="Select all visible trips" /></th>';
    }
    return `<th>${escapeHtml(c.label)}</th>`;
  }).join("");
  const body = visibleTrips.map((trip, index) => {
    const isFit = String(trip.tripType || "git").toLowerCase() === "fit";
    const checked = selectedTripIds.has(trip.id) ? " checked" : "";
    const cells = {
      select: `<td class="trip-cb-cell"><input type="checkbox" class="trip-rooming-select" data-trip-id="${escapeHtml(trip.id)}"${checked} /></td>`,
      rowNum: `<td>${startIndex + index + 1}</td>`,
      serial: `<td class="trip-serial-cell"><a href="${buildTripDetailUrl(trip.id)}" class="trip-name-link"><strong>${escapeHtml(trip.serial || "-")}</strong></a></td>`,
      type: `<td><span class="trip-type-pill">${escapeHtml(String(trip.tripType || "git").toUpperCase())}</span></td>`,
      tripName: `<td class="table-primary-cell">${escapeHtml(trip.tripName)}</td>`,
      startDate: `<td>${formatDate(trip.startDate)}</td>`,
      endDate: `<td>${formatDate(trip.endDate || computeTripEndDate(trip))}</td>`,
      destinations: `<td class="trip-tag-cell">${renderTripTagPills(trip.tags)}</td>`,
      pax: `<td class="trip-pax-cell">${isFit ? trip.participantCount : `${trip.actualTouristCount || 0}/${trip.participantCount}`}</td>`,
      staff: `<td class="trip-pax-cell">${trip.staffCount}</td>`,
      status: `<td><span class="status-dot-cell"><span class="status-dot status-dot-${normalizeStatus(trip.status)}"></span><span>${formatStatusLabel(trip.status)}</span></span></td>`,
      createdAt: `<td class="trip-created-cell">${formatDate(trip.createdAt, true)}</td>`,
      manager: `<td>${escapeHtml(trip.createdBy?.name || trip.createdBy?.email || "-")}</td>`,
      actions: `<td>
        <div class="trip-row-actions trip-row-actions-inline">
          <details class="trip-menu trip-page-menu">
            <summary class="trip-menu-trigger" aria-label="Trip actions">⋯</summary>
            <div class="trip-menu-popover">
              <button type="button" class="trip-menu-item" data-action="select-trip" data-trip-id="${trip.id}">View</button>
              <button type="button" class="trip-menu-item" data-action="edit-trip" data-trip-id="${trip.id}">Edit</button>
              <button type="button" class="trip-menu-item is-danger" data-action="delete-trip" data-trip-id="${trip.id}">Delete</button>
            </div>
          </details>
        </div>
      </td>`,
    };
    return `<tr class="${activeTripId === trip.id ? "is-trip-active" : ""}">${cols.map((c) => cells[c.key]).join("")}</tr>`;
  }).join("");

  tripList.innerHTML = `
    <div class="camp-table-wrap">
      <table class="camp-table trip-table">
        <thead><tr>${headers}</tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>
    <div class="table-pagination table-pagination-3col">
      <p class="pagination-count">${startIndex + 1}-${startIndex + visibleTrips.length} / ${trips.length}</p>
      <button type="button" class="confirmed-stat-chip" data-action="open-confirmed-stats" title="Click to see full statistics">
        <span class="confirmed-stat-icon" aria-hidden="true">✓</span>
        <span class="confirmed-stat-count">${confirmedStats.total}</span>
        <span class="confirmed-stat-label">tourists confirmed</span>
      </button>
      <div class="pagination-actions">
        <button type="button" data-action="trip-page-prev" ${currentTripPage === 1 ? "disabled" : ""}>Previous</button>
        <button type="button" data-action="trip-page-next" ${currentTripPage === totalPages ? "disabled" : ""}>Next</button>
      </div>
    </div>
  `;
  tripList.querySelector('[data-action="open-confirmed-stats"]')?.addEventListener("click", openConfirmedStatsModal);
  refreshRoomingDownloadButton();
  syncRoomingSelectAllCheckbox();
}

function renderActiveTrip() {
  if (!activeTripId || !isTripDetailPage()) {
    activeTripBox.className = "is-hidden";
    activeTripBox.innerHTML = "";
    return;
  }
  const trip = getTripById(activeTripId);
  if (!trip) {
    if (isTripDetailPage() && activeTripId && trips.length > 0) {
      activeTripBox.className = "card";
      activeTripBox.innerHTML = '<div class="deleted-banner" data-trip-missing-banner><span>!</span><strong>Loading trip…</strong></div>';
      // The trip might just live in another workspace (notification clicked
      // from USM linking to a DTX trip, etc.). Hit the workspace-agnostic
      // lookup before declaring it deleted.
      verifyTripExistsCrossWorkspace(activeTripId);
    } else {
      activeTripBox.className = "is-hidden";
      activeTripBox.innerHTML = "";
    }
    return;
  }
  activeTripBox.className = "card trip-summary-card";
  const tripGroupName = trip.groupName ? `<span class="trip-group-name">${escapeHtml(trip.groupName)}</span>` : "";
  const tripTypeBadge = trip.tripType ? `<span class="trip-type-pill">${escapeHtml(String(trip.tripType).toUpperCase())}</span> ` : "";
  const isFit = String(trip.tripType || "").toLowerCase() === "fit";
  // Contract/Invoice add buttons now live in the section headers themselves; no need to duplicate them here.
  const fitActions = "";
  // Toggle Groups section visibility based on FIT/GIT
  const groupsSection = document.getElementById("groups-section");
  if (groupsSection) groupsSection.classList.toggle("is-hidden", isFit);
  // Status select lives in the action bar next to Edit on desktop. On mobile
  // the action bar flex-wraps below the title — see CSS for exact placement.
  activeTripBox.innerHTML = `
    <div class="section-head trip-summary-section-head">
      <div>
        <h2>${trip.serial ? `<span class="trip-serial-tag">${escapeHtml(trip.serial)}</span> ` : ""}${tripTypeBadge}${escapeHtml(trip.tripName)}${tripGroupName}</h2>
        <p>${escapeHtml(trip.reservationName || trip.tripName)} · Start ${formatDate(trip.startDate)}${trip.endDate ? ` → ${formatDate(trip.endDate)}` : ""}</p>
      </div>
      <div class="trip-summary-actions">
        ${fitActions}
        <a class="header-action-btn header-action-create-trip" href="/trip-creator?tripId=${encodeURIComponent(trip.id)}" aria-label="Open trip creator">Trip</a>
        <button type="button" class="header-action-btn header-action-edit" id="active-trip-edit-btn" aria-label="Edit trip">✎ Edit</button>
        <select id="active-trip-status-select" class="trip-status-select trip-status-select--compact trip-status-select--${normalizeStatus(trip.status) || "offer"}" aria-label="Trip status">
          ${["offer","confirmed","cancelled","ignored"].map((s) =>
            `<option value="${s}" ${normalizeStatus(trip.status) === s ? "selected" : ""}>${escapeHtml(formatStatusLabel(s))}</option>`
          ).join("")}
        </select>
      </div>
    </div>
    <div id="trip-flight-info" class="trip-flight-info"></div>
    <div class="trip-summary-grid trip-summary-grid--3">
      <article class="trip-summary-stat trip-summary-stat--compact">
        <span>Pax</span>
        <strong>${isFit
          ? trip.participantCount
          : `${trip.actualTouristCount || 0}/${trip.participantCount}`}</strong>
      </article>
      <article class="trip-summary-stat trip-summary-stat--compact">
        <span>Staff</span>
        <strong>${trip.staffCount}</strong>
      </article>
      <article class="trip-summary-stat trip-summary-stat--compact">
        <span>Total days</span>
        <strong>${escapeHtml(trip.totalDays || "-")}</strong>
      </article>
    </div>
  `;
  loadTripFlightInfo(trip.id);
  document.getElementById("active-trip-edit-btn")?.addEventListener("click", () => {
    startTripEdit(trip.id);
  });
  const statusSelect = document.getElementById("active-trip-status-select");
  statusSelect?.addEventListener("change", async (e) => {
    const newStatus = e.target.value;
    // Keep --compact (height/radius/width) and only swap the colour modifier
    // so the pill keeps its size when the status changes.
    statusSelect.className = `trip-status-select trip-status-select--compact trip-status-select--${newStatus}`;
    await updateTripStatus(trip.id, newStatus);
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
    // Airline-style summary table (one row per flight): Flight | Date |
    // Departure | Arrival. Dates are kept strictly ISO yyyy-mm-dd so they
    // line up vertically the way the reference layout does.
    const isoDate = (s) => {
      const v = String(s || "").slice(0, 10);
      return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "—";
    };
    const cell = (time, city, dayOffsetSuffix = "") => {
      const t = escapeHtml(String(time || "").slice(0, 5));
      const c = escapeHtml(city || "—");
      const suffix = dayOffsetSuffix ? `<span class="trip-flight-day-offset"> ${escapeHtml(dayOffsetSuffix)}</span>` : "";
      return `<div class="trip-flight-cell"><strong>${t || "—"}${suffix}</strong> ${c}</div>`;
    };
    // Overnight flights: depart 23:44, arrive 05:00 next day → show "+1" on
    // the arrival cell so the day rollover is obvious.
    const dayOffset = (depDate, arrDate) => {
      const dep = String(depDate || "").slice(0, 10);
      const arr = String(arrDate || "").slice(0, 10);
      if (!dep || !arr || dep === arr) return "";
      try {
        const days = Math.round((new Date(`${arr}T00:00:00`) - new Date(`${dep}T00:00:00`)) / 86400000);
        if (days > 0) return `+${days}`;
        if (days < 0) return String(days);
      } catch {}
      return "";
    };
    const aliasMap = new Map(
      (campSettings.airlineAliases || []).map((a) => [String(a.name).toLowerCase(), a.alias || a.name])
    );
    const aliasFor = (airline) => {
      const key = String(airline || "").trim().toLowerCase();
      return aliasMap.get(key) || airline || "—";
    };
    const rows = sorted.map((f, i) => {
      const carrier = `${escapeHtml(aliasFor(f.airline))}${f.flightNumber ? `<div class="trip-flight-num">${escapeHtml(f.flightNumber)}</div>` : ""}`;
      return `
        <tr>
          <td class="trip-flight-num-col">${i + 1}</td>
          <td class="trip-flight-date">${isoDate(f.departureDate)}</td>
          <td>${cell(f.departureTime, f.fromCity)}</td>
          <td>${cell(f.arrivalTime, f.toCity, dayOffset(f.departureDate, f.arrivalDate))}</td>
          <td class="trip-flight-carrier">${carrier}</td>
        </tr>
      `;
    }).join("");
    node.innerHTML = `
      <div class="trip-flight-summary-wrap">
        <table class="trip-flight-summary-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Date</th>
              <th>Departure</th>
              <th>Arrival</th>
              <th>Flight</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  } catch (err) {
    node.innerHTML = "";
  }
}

function renderCampPayments() {
  if (!campPaymentList) return;
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

// Trip-detail "Camp payments" — same per-camp grouping as the
// global Camp Payments grid (Deposit / 2nd / Paid / Balance /
// Total / Status), scoped to the active trip. Per-row Actions
// column hosts Edit, Request payment (or REQUEST SENT pill while
// a camp_group request is awaiting accountant approval), and
// Delete. Approving the request flips every camp_reservation in
// the trip+camp pair to paid in one shot.
function renderActiveTripCampPayments() {
  if (!activeTripCampPayments) return;
  if (!activeTripId || !isTripDetailPage() || activeTripPanelHidden) {
    activeTripCampPayments.classList.add("is-hidden");
    activeTripCampPayments.innerHTML = "";
    return;
  }

  const tripEntries = currentEntries.filter((e) => e.tripId === activeTripId);
  if (!tripEntries.length) {
    activeTripCampPayments.classList.add("is-hidden");
    activeTripCampPayments.innerHTML = "";
    return;
  }

  const grouped = new Map();
  tripEntries.forEach((entry) => {
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
      currency: entry.currency || "MNT",
      depositInvoiceDocumentId: entry.depositInvoiceDocumentId || entry.invoiceDocumentId || "",
      depositInvoiceDocumentName: entry.depositInvoiceDocumentName || entry.invoiceDocumentName || "",
      depositInvoiceStoredName: entry.depositInvoiceStoredName || entry.invoiceStoredName || "",
      balanceInvoiceDocumentId: entry.balanceInvoiceDocumentId || "",
      balanceInvoiceDocumentName: entry.balanceInvoiceDocumentName || "",
      balanceInvoiceStoredName: entry.balanceInvoiceStoredName || "",
    };
    group.reservations += 1;
    grouped.set(key, group);
  });

  const rows = [...grouped.values()].sort((a, b) =>
    String(a.campName || "").localeCompare(String(b.campName || ""))
  );

  const pendingSet = window.pendingCampGroupPaymentSet || new Set();
  const approvedCounts = window.approvedCampGroupCount || new Map();

  // One stage = one table cell containing amount + paid pill, paid
  // date, invoice link/upload button, and a Request payment button
  // (or REQUEST SENT pill while a stage-specific camp_group request
  // is awaiting accountant approval).
  const renderStageCell = (row, stage, amount, paidDate, invoice) => {
    const stageKey = `${row.key}::${stage}`;
    const isPending = pendingSet.has(stageKey);
    const isPaid = !!paidDate;
    const hasAmount = amount > 0;
    const invoiceCtl = invoice.documentId && invoice.storedName
      ? `<a class="table-link compact" target="_blank" rel="noopener" href="/trip-uploads/${encodeURIComponent(row.tripId)}/${encodeURIComponent(invoice.storedName)}" title="${escapeHtml(invoice.documentName || "Invoice")}">📎 View invoice</a>
         <button type="button" class="link-button compact" data-action="upload-camp-group-invoice" data-group-key="${escapeHtml(row.key)}" data-stage="${stage}" title="Replace invoice">Replace</button>`
      : `<button type="button" class="link-button compact" data-action="upload-camp-group-invoice" data-group-key="${escapeHtml(row.key)}" data-stage="${stage}">📎 Upload invoice</button>`;
    const requestCtl = isPaid
      ? ""
      : isPending
        ? `<span class="status-pill is-pending" title="Awaiting accountant approval">REQUEST SENT</span>`
        : (hasAmount
            ? `<button type="button" class="table-action compact" data-action="request-camp-group-payment"
                  data-group-key="${escapeHtml(row.key)}"
                  data-trip-id="${escapeHtml(row.tripId)}"
                  data-camp-name="${escapeHtml(row.campName)}"
                  data-amount="${escapeHtml(String(amount))}"
                  data-currency="${escapeHtml(row.currency || "MNT")}"
                  data-stage="${stage}">Request payment</button>`
            : "");
    return `
      <td class="stage-cell">
        <div class="stage-cell-amount">${formatMoney(amount)} ${hasAmount ? (isPaid ? `<span class="stage-pill is-paid">Paid</span>` : `<span class="stage-pill is-unpaid">Unpaid</span>`) : ""}</div>
        <div class="stage-cell-date">${paidDate ? formatDate(paidDate) : "—"}</div>
        <div class="stage-cell-invoice">${invoiceCtl}</div>
        <div class="stage-cell-action">${requestCtl}</div>
      </td>
    `;
  };

  const renderActionsCell = (row) => `
    <div class="trip-row-actions payment-row-actions">
      <button type="button" class="table-action compact secondary" data-action="edit-payment-group" data-group-key="${escapeHtml(row.key)}">Edit</button>
      <button type="button" class="table-action compact danger" data-action="delete-payment-group" data-group-key="${escapeHtml(row.key)}">Delete</button>
    </div>
  `;

  activeTripCampPayments.classList.remove("is-hidden");
  activeTripCampPayments.innerHTML = `
    <div class="section-head">
      <h2>Camp payments</h2>
    </div>
    <div class="camp-table-wrap">
      <table class="camp-table camp-payment-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Camp</th>
            <th>Res.</th>
            <th>Deposit</th>
            <th>Balance</th>
            <th>Total</th>
            <th>Status</th>
            <th>Receipts</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map((row, index) => {
              const approvedCount = approvedCounts.get(row.key) || 0;
              return `
                <tr>
                  <td class="table-center">${index + 1}</td>
                  <td><button type="button" class="table-link compact secondary" data-action="select-camp" data-camp-name="${escapeHtml(row.campName)}">${escapeHtml(row.campName)}</button></td>
                  <td class="table-center">${row.reservations}</td>
                  ${renderStageCell(row, "deposit", row.deposit, row.depositPaidDate, {
                    documentId: row.depositInvoiceDocumentId,
                    documentName: row.depositInvoiceDocumentName,
                    storedName: row.depositInvoiceStoredName,
                  })}
                  ${renderStageCell(row, "balance", row.secondPayment, row.secondPaidDate, {
                    documentId: row.balanceInvoiceDocumentId,
                    documentName: row.balanceInvoiceDocumentName,
                    storedName: row.balanceInvoiceStoredName,
                  })}
                  <td class="table-right"><strong>${formatMoney(row.totalPayment)}</strong></td>
                  <td><span class="status-pill is-${normalizeStatus(row.paymentStatus || "in_progress")}">${formatStatusLabel(row.paymentStatus || "in_progress")}</span></td>
                  <td class="table-center">${approvedCount || "-"}</td>
                  <td>${renderActionsCell(row)}</td>
                </tr>
              `;
            })
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
  const campDetailViewToolbar = `
    <details class="trip-saved-filter-dropdown" id="camp-detail-view-dropdown">
      <summary>
        <span>View</span>
        <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </summary>
      <div class="trip-saved-filter-popover tourist-view-popover">
        <div class="ts-view-head">
          <p class="ts-view-title">Toggle columns</p>
          <button type="button" class="ts-view-close" data-close-camp-detail-view aria-label="Close">×</button>
        </div>
        ${renderCampDetailViewPopover()}
      </div>
    </details>
  `;

  if (!entries.length) {
    activeTripReservations.classList.remove("is-hidden");
    activeTripReservations.innerHTML = `
      <div class="section-head">
        <h2>${escapeHtml(trip?.tripName || "Trip")} reservations</h2>
        <div class="camp-toolbar trip-detail-toolbar">
          ${campDetailViewToolbar}
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
    ${buildCampDetailHideStyle()}
    <div class="section-head">
        <h2>${escapeHtml(trip?.tripName || "Trip")} reservations</h2>
      <div class="camp-toolbar trip-detail-toolbar">
        ${campDetailViewToolbar}
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
          <summary class="trip-menu-trigger" aria-label="Camp reservation actions">⋯</summary>
          <div class="trip-menu-popover">
            <button type="button" class="trip-menu-item" data-action="edit" data-id="${entry.id}">Edit</button>
            <button type="button" class="trip-menu-item" data-action="view-pdf" data-id="${entry.id}">View</button>
            <button type="button" class="trip-menu-item" data-action="download-pdf" data-id="${entry.id}">Download PDF</button>
            ${(entry.paymentStatus || "in_progress") !== "paid" && (entry.paymentStatus || "") !== "paid_100"
              ? ((window.pendingCampPaymentSet && window.pendingCampPaymentSet.has(entry.id))
                  ? `<span class="trip-menu-item" style="background:#fef3c7;color:#8a4b12;cursor:default" title="Awaiting accountant approval">REQUEST SENT</span>`
                  : `<button type="button" class="trip-menu-item" data-action="request-camp-payment" data-id="${entry.id}" data-trip-id="${escapeHtml(entry.tripId || "")}" data-amount="${escapeHtml(entry.totalPrice || "")}" data-currency="${escapeHtml(entry.currency || "MNT")}" data-payee="${escapeHtml(entry.campName || "")}">Request paid</button>`)
              : ""}
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
  // Auto-fill from the chosen Trip on Create — clients + staff default to
  // whatever the trip already records, so a manager doesn't re-type counts
  // that already exist on the Trip page. They can still edit before saving.
  const seedTrip = isCreate ? getTripById(options.tripId || activeTripId || filterTripName.value || "") : null;
  const reservationData = reservation || {
    id: "",
    tripId: options.tripId || activeTripId || filterTripName.value || "",
    tripName: seedTrip?.tripName || "",
    reservationName: "",
    createdDate: getMongoliaToday(),
    campName: "",
    locationName: "",
    reservationType: "camp",
    checkIn: "",
    nights: 1,
    checkOut: "",
    clientCount: Number(seedTrip?.participantCount) || 2,
    staffCount: Number(seedTrip?.staffCount) || 0,
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
          <label data-trip-scope-hide>
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
  // Re-apply trip-scope hiding for the freshly-rendered form (the inline
  // hider in the HTML only ran once at DOMContentLoaded — this form was
  // built later, so its [data-trip-scope-hide] labels need the inline
  // display:none applied now).
  if (document.body.classList.contains("is-trip-scoped")) {
    reservationEditPanel.querySelectorAll("[data-trip-scope-hide]").forEach((el) => {
      el.style.setProperty("display", "none", "important");
      el.querySelectorAll("select[required]").forEach((s) => s.removeAttribute("required"));
    });
  }
  const formNode = reservationEditPanel.querySelector("form");
  // Upgrade the dynamic form's trip + camp <select>s into searchable pickers
  // so they stay usable when there are hundreds of trips/camps.
  if (formNode && window.TripPicker) {
    const tripSelect = formNode.querySelector('select[name="tripId"]');
    if (tripSelect) window.TripPicker.upgrade(tripSelect, { placeholder: "Choose trip…" });
    const campSelect = formNode.querySelector('select[name="campName"]');
    if (campSelect) window.TripPicker.upgrade(campSelect, { placeholder: "Choose camp…" });
  }
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

let tripsController = null;

function applyTripsPayload(payload) {
  currentTrips = (payload && payload.entries) || [];
  // On /trip-detail keep activeTripId even if the trip isn't in the
  // workspace-scoped list — renderActiveTrip's verifyTripExistsCrossWorkspace
  // handles cross-workspace lookup + auto-switch. Clearing it here defeats
  // that fallback and leaves the header empty when a notification or modal
  // link points at a trip in the other workspace.
  if (activeTripId && !getTripById(activeTripId) && !isTripDetailPage()) {
    activeTripId = "";
  }
  renderSettingsOptions();
  refreshFilterPopoverOptions();
  renderTrips();
  renderActiveTrip();
}

async function loadTrips() {
  if (tripsController) {
    tripsController.invalidate();
    return tripsController.refresh();
  }
  if (window.LiveList) {
    tripsController = window.LiveList.subscribe("/api/camp-trips", {
      cacheKey: "livelist:camp-trips",
      onData: applyTripsPayload,
    });
    return;
  }
  const payload = await fetchJson("/api/camp-trips");
  applyTripsPayload(payload);
}

async function loadSettings() {
  const payload = await fetchJson("/api/camp-settings");
  campSettings = payload.entry;
  renderAllSettings();
}

// Set of camp_reservation ids with a pending payment_request. The
// renderReadOnlyRow() helper reads it to decide between rendering a
// "REQUEST SENT" pill or a clickable "Request paid" item.
window.pendingCampPaymentSet = new Set();
// Set of "<tripId>::<campName>" keys with a pending camp_group
// payment_request, used by the trip-detail Camp payments cards.
window.pendingCampGroupPaymentSet = new Set();
// Map of "<tripId>::<campName>" → number of approved camp_group
// requests, displayed inline on each card.
window.approvedCampGroupCount = new Map();
async function loadPendingCampPaymentRequests() {
  try {
    const [pendingRes, approvedRes] = await Promise.all([
      fetch("/api/payment-requests?status=pending"),
      fetch("/api/payment-requests?status=approved"),
    ]);
    if (pendingRes.ok) {
      const data = await pendingRes.json();
      const entries = data.entries || [];
      window.pendingCampPaymentSet = new Set(
        entries.filter((x) => x.recordType === "camp_reservation" && x.recordId).map((x) => x.recordId)
      );
      // Key by "<recordId>::<stage>" so each payment stage of a
      // camp_group request has its own independent pending state.
      // Stageless legacy requests fall back to "::" suffix.
      window.pendingCampGroupPaymentSet = new Set(
        entries
          .filter((x) => x.recordType === "camp_group" && x.recordId)
          .map((x) => `${x.recordId}::${(x.stage || "").toLowerCase()}`)
      );
    }
    if (approvedRes.ok) {
      const data = await approvedRes.json();
      const counts = new Map();
      (data.entries || [])
        .filter((x) => x.recordType === "camp_group" && x.recordId)
        .forEach((x) => counts.set(x.recordId, (counts.get(x.recordId) || 0) + 1));
      window.approvedCampGroupCount = counts;
    }
  } catch {}
}

async function loadReservations() {
  const [payload] = await Promise.all([
    fetchJson("/api/camp-reservations"),
    loadPendingCampPaymentRequests(),
  ]);
  currentEntries = payload.entries || [];
  selectedReservationIds = new Set([...selectedReservationIds].filter((id) => currentEntries.some((entry) => entry.id === id)));
  renderActiveTrip();
  renderActiveTripReservations();
  renderActiveCampReservations();
  renderEntries();
  renderCampPayments();  renderActiveTripCampPayments();
}

async function saveSettings() {
  if (settingsStatus) settingsStatus.textContent = "Saving settings...";
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
    if (settingsStatus) settingsStatus.textContent = "Settings updated.";
  } catch (error) {
    if (settingsStatus) settingsStatus.textContent = error.message;
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
    // Optimistic in-place update so we don't have to re-render the active
    // trip card. Re-rendering wipes the flight summary table and the
    // attached NOTE button — both of which are expensive to repaint and
    // jarring for the user. Just patch the local trip + the trip-list pills.
    const localTrip = getTripById(id);
    if (localTrip) localTrip.status = status;
    renderTrips();
    tripStatus.textContent = "Trip updated.";
  } catch (error) {
    tripStatus.textContent = error.message;
    // Recover authoritative state if the save failed.
    await loadTrips();
  }
}

function startTripEdit(id) {
  const trip = getTripById(id);
  if (!trip) {
    return;
  }
  editingTripId = id;
  openPanel(tripFormPanel);
  // Seed the existing flights for this trip so a second "+ Add flight"
  // appends a new row instead of starting at "Flight 1" again.
  clearTripFlightRows();
  loadExistingTripFlights(id);
  // Trip costing — fill the template picker, restore previously saved
  // expense lines + margin + FX rates.
  loadTripTemplatesIntoPicker();
  renderTripExpenseLines((trip.expenseLines || []).map((l) => ({ ...l })));
  if (tripForm.elements.marginPct) tripForm.elements.marginPct.value = String(trip.marginPct || 0);
  const rates = trip.exchangeRates || {};
  if (tripForm.elements.rateUsd) tripForm.elements.rateUsd.value = rates.USD || "";
  if (tripForm.elements.rateEur) tripForm.elements.rateEur.value = rates.EUR || "";
  refreshTripCostingTotals();
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
    tripForm.elements.tags.dispatchEvent(new CustomEvent("destinations:set"));
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
  loadTripTemplatesIntoPicker();
  renderTripExpenseLines([]);
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

// Reverse direction: start date + total days → end date. Fires when the user
// types a number into "Total days of tour" with a start date already set.
function recalcTripEndDate() {
  if (!tripForm || !tripForm.elements) return;
  const startEl = tripForm.elements.startDate;
  const endEl = tripForm.elements.endDate;
  const totalEl = tripForm.elements.totalDays;
  if (!startEl || !endEl || !totalEl) return;
  const start = startEl.value;
  const totalRaw = parseInt(totalEl.value, 10);
  if (!start || !Number.isFinite(totalRaw) || totalRaw < 1) return;
  const startMs = new Date(start + "T00:00:00").getTime();
  if (Number.isNaN(startMs)) return;
  const endDate = new Date(startMs + (totalRaw - 1) * 86400000);
  const yyyy = endDate.getFullYear();
  const mm = String(endDate.getMonth() + 1).padStart(2, "0");
  const dd = String(endDate.getDate()).padStart(2, "0");
  endEl.value = `${yyyy}-${mm}-${dd}`;
}

if (tripForm && tripForm.elements) {
  ["startDate", "endDate"].forEach((name) => {
    const el = tripForm.elements[name];
    if (el) el.addEventListener("change", recalcTripTotalDays);
  });
  // Also: when start changes and totalDays is already filled, project end.
  const startEl = tripForm.elements.startDate;
  const totalEl = tripForm.elements.totalDays;
  if (startEl) startEl.addEventListener("change", recalcTripEndDate);
  if (totalEl) {
    totalEl.addEventListener("input", recalcTripEndDate);
    totalEl.addEventListener("change", recalcTripEndDate);
  }
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
  if (prefill.id) div.dataset.flightId = prefill.id;
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
    const obj = { id: row.dataset.flightId || "" };
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

// ── Trip costing: expense lines + template picker + margin + FX ──
let tripTemplateCache = [];

function getTripExpenseBody() {
  return tripForm?.querySelector("[data-trip-expense-lines]") || null;
}

function blankExpenseLine(dayOffset = 1) {
  return { dayOffset, category: "", payeeName: "", amount: 0, currency: "MNT", note: "" };
}

function renderTripExpenseLines(lines) {
  const body = getTripExpenseBody();
  if (!body) return;
  if (!lines.length) {
    body.innerHTML = `<tr><td colspan="7" class="muted">No expense lines yet — click + Add line</td></tr>`;
    refreshTripCostingTotals([]);
    return;
  }
  body.innerHTML = lines.map((l, i) => `
    <tr data-line-i="${i}">
      <td><input type="number" min="0" data-expense-field="dayOffset" value="${escapeHtml(l.dayOffset)}" style="width:60px;" /></td>
      <td><input type="text" data-expense-field="category" value="${escapeHtml(l.category || "")}" placeholder="Camp / Driver salary…" /></td>
      <td><input type="text" data-expense-field="payeeName" value="${escapeHtml(l.payeeName || "")}" placeholder="Payee" /></td>
      <td><input type="number" step="0.01" min="0" data-expense-field="amount" value="${escapeHtml(l.amount || 0)}" style="width:120px;" /></td>
      <td>
        <select data-expense-field="currency">
          <option value="MNT" ${l.currency === "MNT" ? "selected" : ""}>MNT</option>
          <option value="USD" ${l.currency === "USD" ? "selected" : ""}>USD</option>
          <option value="EUR" ${l.currency === "EUR" ? "selected" : ""}>EUR</option>
        </select>
      </td>
      <td><input type="text" data-expense-field="note" value="${escapeHtml(l.note || "")}" placeholder="Optional" /></td>
      <td><button type="button" class="button-secondary is-danger" data-expense-remove="${i}">×</button></td>
    </tr>
  `).join("");
  refreshTripCostingTotals(lines);
}

function readTripExpenseLines() {
  const body = getTripExpenseBody();
  if (!body) return [];
  return Array.from(body.querySelectorAll("tr[data-line-i]")).map((row) => {
    const get = (f) => row.querySelector(`[data-expense-field="${f}"]`)?.value || "";
    return {
      dayOffset: Number(get("dayOffset")) || 0,
      category: get("category").trim(),
      payeeName: get("payeeName").trim(),
      amount: Number(get("amount")) || 0,
      currency: get("currency") || "MNT",
      note: get("note").trim(),
    };
  }).filter((l) => l.category || l.payeeName || l.amount);
}

function refreshTripCostingTotals(linesArg) {
  const node = tripForm?.querySelector("[data-trip-costing-totals]");
  if (!node) return;
  const lines = linesArg || readTripExpenseLines();
  const usd = Number(tripForm.elements.rateUsd?.value) || 0;
  const eur = Number(tripForm.elements.rateEur?.value) || 0;
  const margin = Number(tripForm.elements.marginPct?.value) || 0;
  let mntTotal = 0;
  const byCcy = {};
  lines.forEach((l) => {
    const ccy = (l.currency || "MNT").toUpperCase();
    const amt = Number(l.amount) || 0;
    byCcy[ccy] = (byCcy[ccy] || 0) + amt;
    if (ccy === "MNT") mntTotal += amt;
    else if (ccy === "USD") mntTotal += amt * (usd || 0);
    else if (ccy === "EUR") mntTotal += amt * (eur || 0);
  });
  const summary = Object.entries(byCcy)
    .map(([c, a]) => `${c} ${a.toLocaleString()}`)
    .join(" + ");
  // Gross margin: profit as % of selling price → quote = cost / (1 - margin%).
  // Matches the client-facing quote panel; 20% on 100k = 125k.
  const quoted = (margin >= 100) ? 0 : mntTotal / (1 - margin / 100);
  node.innerHTML = `
    <span>Cost: <strong>${escapeHtml(summary || "—")}</strong></span>
    ${(usd || eur)
      ? `<span> · MNT total <strong>${mntTotal.toLocaleString()}</strong></span>`
      : ""}
    ${margin
      ? `<span> · Margin ${margin}% → quote <strong>${quoted.toLocaleString()} MNT</strong></span>`
      : ""}
  `;
}

async function loadTripTemplatesIntoPicker() {
  const sel = tripForm?.querySelector("[data-trip-template-pick]");
  if (!sel) return;
  try {
    const r = await fetch("/api/trip-templates");
    const data = await r.json();
    tripTemplateCache = data.entries || [];
  } catch {
    tripTemplateCache = [];
  }
  sel.innerHTML = '<option value="">— No template —</option>'
    + tripTemplateCache
        .map((t) => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.name)}${t.workspace ? ` (${escapeHtml(t.workspace)})` : ""}</option>`)
        .join("");
}

function applyTripTemplate(templateId) {
  const tpl = tripTemplateCache.find((t) => t.id === templateId);
  if (!tpl) return;
  if (!tripForm.elements.totalDays.value || tripForm.elements.totalDays.value === "1") {
    tripForm.elements.totalDays.value = String(tpl.days || 1);
  }
  if (tripForm.elements.marginPct && (!tripForm.elements.marginPct.value || tripForm.elements.marginPct.value === "0")) {
    tripForm.elements.marginPct.value = String(tpl.marginPct || 0);
  }
  renderTripExpenseLines((tpl.expenseLines || []).map((l) => ({ ...l })));
}

if (tripForm) {
  tripForm.addEventListener("click", (e) => {
    if (e.target.dataset?.action === "trip-expense-add") {
      e.preventDefault();
      const lines = readTripExpenseLines();
      lines.push(blankExpenseLine(lines.length ? Math.max(...lines.map((l) => l.dayOffset)) : 1));
      renderTripExpenseLines(lines);
    }
    const removeIdx = e.target.dataset?.expenseRemove;
    if (removeIdx !== undefined) {
      e.preventDefault();
      const lines = readTripExpenseLines();
      lines.splice(Number(removeIdx), 1);
      renderTripExpenseLines(lines);
    }
  });
  tripForm.addEventListener("change", (e) => {
    if (e.target.dataset?.tripTemplatePick !== undefined || e.target.matches("[data-trip-template-pick]")) {
      applyTripTemplate(e.target.value);
    }
    if (["marginPct", "rateUsd", "rateEur"].includes(e.target.name) || e.target.dataset?.expenseField) {
      refreshTripCostingTotals();
    }
  });
  tripForm.addEventListener("input", (e) => {
    if (e.target.dataset?.expenseField === "amount" || ["marginPct", "rateUsd", "rateEur"].includes(e.target.name)) {
      refreshTripCostingTotals();
    }
  });
}

// Set on edit, used by the submit handler to detect rows that were
// removed in this session so we can DELETE them server-side.
let initialTripFlightIds = new Set();

async function loadExistingTripFlights(tripId) {
  initialTripFlightIds = new Set();
  if (!tripId) return;
  try {
    const data = await fetch("/api/flight-reservations").then((r) => r.json());
    const flights = (data.entries || [])
      .filter((f) => f.tripId === tripId)
      .sort((a, b) => String(a.departureDate || "").localeCompare(String(b.departureDate || "")));
    flights.forEach((f) => {
      if (f.id) initialTripFlightIds.add(f.id);
      addTripFlightRow({
        id: f.id || "",
        airline: f.airline || "",
        flightNumber: f.flightNumber || "",
        fromCity: f.fromCity || "",
        toCity: f.toCity || "",
        departureDate: String(f.departureDate || "").slice(0, 10),
        departureTime: String(f.departureTime || "").slice(0, 5),
        arrivalDate: String(f.arrivalDate || "").slice(0, 10),
        arrivalTime: String(f.arrivalTime || "").slice(0, 5),
      });
    });
  } catch (err) {
    console.warn("Could not load trip flights for editing", err);
  }
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
    // Trip costing fields — expense plan, margin %, FX snapshot.
    payload.expenseLines = readTripExpenseLines();
    payload.marginPct = Number(tripForm.elements.marginPct?.value) || 0;
    payload.exchangeRates = {};
    const rateUsd = Number(tripForm.elements.rateUsd?.value) || 0;
    const rateEur = Number(tripForm.elements.rateEur?.value) || 0;
    if (rateUsd) payload.exchangeRates.USD = rateUsd;
    if (rateEur) payload.exchangeRates.EUR = rateEur;
    // Destinations are required on DTX so the trip flows correctly
    // into the confirmed-tourist destination breakdown and the
    // public render. USM only operates inside Mongolia and the
    // destinations block is hidden in openPanel — don't gate save on
    // a field the user can't see.
    const ws = (typeof readWorkspace === "function" ? readWorkspace() : "") || "";
    const tagsRaw = (tripForm.elements.tags?.value || "").trim();
    const hasTags = tagsRaw.length > 0;
    if (ws !== "USM" && !hasTags) {
      tripStatus.textContent = "Pick at least one destination before saving.";
      tripForm.querySelector("[data-trip-form-destinations]")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const flights = readTripFlightRows();
    const result = await fetchJson(editingTripId ? `/api/camp-trips/${editingTripId}` : "/api/camp-trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const tripId = result.entry.id;
    if (flights.length || initialTripFlightIds.size) {
      tripStatus.textContent = "Saving flights...";
      const survivingIds = new Set(flights.map((f) => f.id).filter(Boolean));
      for (const f of flights) {
        // Existing rows update in place (preserve ticket / payment state
        // set elsewhere); new rows create with workspace defaults.
        const existing = !!f.id;
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
        };
        if (!existing) {
          flightPayload.passengerCount = result.entry.participantCount || 0;
          flightPayload.staffCount = result.entry.staffCount || 0;
          flightPayload.touristTicketStatus = "waiting_list";
          flightPayload.guideTicketStatus = "waiting_list";
          flightPayload.paymentStatus = "unpaid";
        }
        const url = existing ? `/api/flight-reservations/${encodeURIComponent(f.id)}` : "/api/flight-reservations";
        try {
          await fetchJson(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(flightPayload),
          });
        } catch (e) { console.warn("Flight save failed", e); }
      }
      for (const oldId of initialTripFlightIds) {
        if (survivingIds.has(oldId)) continue;
        try {
          await fetch(`/api/flight-reservations/${encodeURIComponent(oldId)}`, { method: "DELETE" });
        } catch (e) { console.warn("Flight delete failed", e); }
      }
      initialTripFlightIds = new Set();
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

// Phase 2a cleanup: the legacy campForm.submit handler used to live here.
// It was unreachable — its first line bailed because campFormPanel is always
// kept hidden by the rebuild flow. The actual save path is the dynamic
// reservation-create-form rendered by renderReservationEditPanel(), which
// has its own submit handler in handleInlineReservationSubmit().

tripToggleForm.addEventListener("click", () => {
  resetTripFormState();
  openPanel(tripFormPanel);
});

campToggleForm.addEventListener("click", () => {
  startReservationCreate(activeTripId || filterTripName.value || "");
});

tripList.addEventListener("click", async (event) => {
  const menuTrigger = event.target.closest(".trip-menu summary");
  if (menuTrigger) {
    closeOpenTripMenus(menuTrigger.closest(".trip-menu"));
    event.stopPropagation();
    return;
  }
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
    const ok = await UI.confirm("Delete this trip and all linked reservations?", { dangerous: true });
    if (ok) deleteTrip(actionTarget.dataset.tripId);
  }
});

tripList.addEventListener("change", (event) => {
  const select = event.target.closest('[data-action="trip-status"]');
  if (select) {
    updateTripStatus(select.dataset.tripId, select.value);
    return;
  }
  const rowCb = event.target.closest(".trip-rooming-select");
  if (rowCb) {
    const id = rowCb.dataset.tripId;
    if (rowCb.checked) selectedTripIds.add(id);
    else selectedTripIds.delete(id);
    refreshRoomingDownloadButton();
    syncRoomingSelectAllCheckbox();
    return;
  }
  const all = event.target.closest("#trip-rooming-select-all");
  if (all) {
    const visible = tripList.querySelectorAll(".trip-rooming-select");
    visible.forEach((cb) => {
      cb.checked = all.checked;
      const id = cb.dataset.tripId;
      if (all.checked) selectedTripIds.add(id);
      else selectedTripIds.delete(id);
    });
    refreshRoomingDownloadButton();
  }
});

function refreshRoomingDownloadButton() {
  const btn = document.getElementById("trip-rooming-download");
  const emailBtn = document.getElementById("trip-rooming-email");
  const n = selectedTripIds.size;
  if (btn) {
    btn.hidden = n === 0;
    btn.textContent = `Download rooming (${n})`;
  }
  if (emailBtn) {
    emailBtn.hidden = n === 0;
    emailBtn.textContent = `Email rooming (${n})`;
  }
}

function syncRoomingSelectAllCheckbox() {
  const all = document.getElementById("trip-rooming-select-all");
  if (!all) return;
  const visible = Array.from(tripList.querySelectorAll(".trip-rooming-select"));
  all.checked = visible.length > 0 && visible.every((cb) => cb.checked);
}

function openRoomingEmailModal(tripIds) {
  // Single-modal form so the user fills email, name, and optional
  // message in one place instead of 3 sequential prompts. Built and
  // mounted on first use, then reused; backdrop / × close + Esc.
  let modal = document.getElementById("rooming-email-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "rooming-email-modal";
    modal.className = "camp-modal workspace-form-modal is-hidden";
    modal.hidden = true;
    modal.innerHTML = `
      <div class="camp-modal-backdrop" data-action="close"></div>
      <div class="camp-modal-dialog workspace-form-modal-dialog" style="max-width:520px;">
        <div class="camp-modal-header">
          <div>
            <h2>Email rooming list</h2>
            <p class="camp-modal-copy">Send the selected trip's rooming spreadsheet to a client or partner.</p>
          </div>
          <button type="button" class="camp-modal-close" data-action="close" aria-label="Close">×</button>
        </div>
        <form id="rooming-email-form" class="field-grid" autocomplete="off">
          <label class="full-span">
            Recipient email <span class="invoice-required">*</span>
            <input name="to" type="email" required placeholder="client@example.com" autocomplete="email" />
          </label>
          <label class="full-span">
            Recipient's name <span class="muted" style="font-weight:400;">(optional, used in the greeting)</span>
            <input name="recipientName" type="text" placeholder="Sukhbat" autocomplete="off" />
          </label>
          <label class="full-span">
            Extra message <span class="muted" style="font-weight:400;">(optional)</span>
            <textarea name="message" rows="3" placeholder="Any note you want to add to the email — leave blank to skip."></textarea>
          </label>
          <div class="actions full-span" style="display:flex; justify-content:flex-end; gap:8px;">
            <button type="button" class="secondary-button" data-action="close">Cancel</button>
            <button type="submit" id="rooming-email-send">Send email</button>
            <p id="rooming-email-status" class="status" style="margin-left:auto"></p>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);

    const close = () => {
      modal.classList.add("is-hidden");
      modal.hidden = true;
    };
    modal.addEventListener("click", (e) => {
      if (e.target?.dataset?.action === "close") close();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !modal.hidden) close();
    });
    modal.querySelector("#rooming-email-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const form = e.currentTarget;
      const ids = Array.from(modal._tripIds || []);
      if (!ids.length) { close(); return; }
      const to = (form.elements.to.value || "").trim();
      if (!to.includes("@")) { alert("That doesn't look like a valid email."); return; }
      const name = (form.elements.recipientName.value || "").trim();
      const message = (form.elements.message.value || "").trim();
      const sendBtn = modal.querySelector("#rooming-email-send");
      const statusEl = modal.querySelector("#rooming-email-status");
      sendBtn.disabled = true;
      statusEl.textContent = "Sending…";
      try {
        const res = await fetch("/api/tourists/email-rooming", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tripIds: ids, to, recipientName: name, message }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) { statusEl.textContent = data.error || "Could not send."; statusEl.style.color = "#b91c1c"; return; }
        statusEl.textContent = `Sent to ${to} ✓`;
        statusEl.style.color = "#1f8550";
        window.UI?.toast?.(`Rooming list sent to ${to}.`, "ok");
        setTimeout(close, 800);
      } finally {
        sendBtn.disabled = false;
      }
    });
  }
  // Reset state for each open
  modal._tripIds = tripIds.slice();
  const form = modal.querySelector("#rooming-email-form");
  form.reset();
  modal.querySelector("#rooming-email-status").textContent = "";
  modal.classList.remove("is-hidden");
  modal.hidden = false;
  setTimeout(() => form.elements.to.focus(), 50);
}

document.getElementById("trip-rooming-email")?.addEventListener("click", () => {
  const ids = Array.from(selectedTripIds);
  if (!ids.length) return;
  openRoomingEmailModal(ids);
});

document.getElementById("trip-rooming-download")?.addEventListener("click", async () => {
  const ids = Array.from(selectedTripIds);
  if (!ids.length) return;
  const btn = document.getElementById("trip-rooming-download");
  const oldLabel = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Preparing…";
  try {
    const res = await fetch("/api/tourists/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tripIds: ids }),
    });
    if (!res.ok) {
      let msg = "Could not download.";
      try { msg = (await res.json()).error || msg; } catch {}
      alert(msg);
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = ids.length > 1
      ? `rooming-list-${ids.length}-trips.xlsx`
      : `rooming-${ids[0]}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } finally {
    btn.disabled = false;
    btn.textContent = oldLabel;
  }
});

async function handleCampTableClick(event) {
  const menuTrigger = event.target.closest(".trip-menu summary");
  if (menuTrigger) {
    closeOpenTripMenus(menuTrigger.closest(".trip-menu"));
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
    const ok = await UI.confirm("Delete this reservation?", { dangerous: true });
    if (ok) deleteReservation(target.dataset.id);
    return;
  }
  if (action === "request-camp-payment") {
    if (typeof window.openExpenseRequestModal !== "function") {
      alert("Expense request modal not loaded — refresh the page.");
      return;
    }
    window.openExpenseRequestModal({
      scope: "trip",
      tripId: target.dataset.tripId || "",
      recordType: "camp_reservation",
      recordId: target.dataset.id,
      category: "Camp payment",
      payeeName: target.dataset.payee || "",
      amount: target.dataset.amount || "",
      currency: target.dataset.currency || "MNT",
      onSuccess: () => loadReservations(),
    });
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
  if (action === "upload-camp-group-invoice") {
    const groupKey = target.dataset.groupKey || "";
    const stage = (target.dataset.stage || "deposit").toLowerCase();
    if (!groupKey) return;
    const picker = document.createElement("input");
    picker.type = "file";
    picker.accept = "application/pdf,image/*";
    picker.addEventListener("change", async () => {
      const file = picker.files && picker.files[0];
      if (!file) return;
      const fd = new FormData();
      fd.append("file", file);
      fd.append("stage", stage);
      campStatus.textContent = "Uploading invoice…";
      try {
        const r = await fetch(`/api/camp-payment-groups/${encodeURIComponent(groupKey)}/invoice`, {
          method: "POST",
          body: fd,
        });
        if (!r.ok) {
          const data = await r.json().catch(() => ({}));
          throw new Error(data.error || `Upload failed (${r.status})`);
        }
        campStatus.textContent = "Invoice uploaded.";
        await loadReservations();
      } catch (err) {
        campStatus.textContent = err?.message || "Upload failed.";
      }
    });
    picker.click();
    return;
  }
  if (action === "request-camp-group-payment") {
    if (typeof window.openExpenseRequestModal !== "function") return;
    const tripId = target.dataset.tripId || "";
    const campName = target.dataset.campName || "";
    const amount = Number(target.dataset.amount || 0);
    const stage = (target.dataset.stage || "").toLowerCase();
    window.openExpenseRequestModal({
      recordType: "camp_group",
      recordId: target.dataset.groupKey || `${tripId}::${campName}`,
      stage,
      tripId,
      payeeName: stage ? `${campName} (${stage})` : campName,
      amount: amount > 0 ? amount : "",
      currency: target.dataset.currency || "MNT",
      category: "Camp / Hotel",
      onSuccess: () => loadReservations(),
    });
    return;
  }
  if (action === "payment-page-prev") {
    currentPaymentPage = Math.max(1, currentPaymentPage - 1);
    renderCampPayments();    renderActiveTripCampPayments();
    return;
  }
  if (action === "payment-page-next") {
    const totalPages = Math.max(1, Math.ceil(getFilteredPaymentGroups().length / PAGE_SIZE));
    currentPaymentPage = Math.min(totalPages, currentPaymentPage + 1);
    renderCampPayments();    renderActiveTripCampPayments();
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
if (campPaymentList) campPaymentList.addEventListener("click", handleCampTableClick);
if (activeTripCampPayments) activeTripCampPayments.addEventListener("click", handleCampTableClick);

[filterTripName, filterCampName, filterTripStartDate, filterReservedDate, filterStatus].forEach((node) => {
  if (!node) return;
  node.addEventListener("input", () => {
    currentPage = 1;
    renderEntries();
    renderActiveTripReservations();
    renderActiveCampReservations();
    renderCampPayments();    renderActiveTripCampPayments();
  });
  node.addEventListener("change", () => {
    currentPage = 1;
    renderEntries();
    renderActiveTripReservations();
    renderActiveCampReservations();
    renderCampPayments();    renderActiveTripCampPayments();
  });
});

[paymentFilterTripName, paymentFilterCampName].forEach((node) => {
  node?.addEventListener("input", () => {
    currentPaymentPage = 1;
    renderCampPayments();    renderActiveTripCampPayments();
  });
  node?.addEventListener("change", () => {
    currentPaymentPage = 1;
    renderCampPayments();    renderActiveTripCampPayments();
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

if (campCheckin) {
  campCheckin.addEventListener("change", syncCheckoutFromStay);
  campCheckin.addEventListener("input", syncCheckoutFromStay);
}
if (campStays) {
  campStays.addEventListener("input", syncCheckoutFromStay);
  campStays.addEventListener("change", syncCheckoutFromStay);
}
if (campCheckout) {
  campCheckout.addEventListener("change", syncStayFromCheckout);
}
campForm?.elements.reservationType?.addEventListener("change", () => updateReservationUnitLabels(campForm));
reservationTripSelect?.addEventListener("change", () => {
  const trip = getTripById(reservationTripSelect.value);
  if (!trip) {
    return;
  }
  if (campForm && !campForm.elements.reservationName.value) {
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
  const clickedMenu = event.target.closest(".trip-menu, .doc-menu");
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
const docTouristSelect = document.getElementById("doc-tourist");
const docUploadStatus = document.getElementById("doc-upload-status");
let docTouristCache = []; // tourists for the active trip, used by upload picker AND inline-edit selects
const docList = document.getElementById("doc-list");
// Doc-menu popovers flip above their trigger when the row is in the bottom
// third of the viewport — keeps the menu off the chat bubble and off-screen.
if (docList) {
  docList.addEventListener("toggle", (e) => {
    const det = e.target;
    if (!(det instanceof HTMLDetailsElement) || !det.classList.contains("doc-menu")) return;
    if (!det.open) {
      det.classList.remove("is-up");
      return;
    }
    const trigger = det.querySelector("summary");
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const popover = det.querySelector(".doc-menu-popover");
    const estimatedHeight = popover ? popover.offsetHeight || 160 : 160;
    if (rect.bottom + estimatedHeight + 16 > window.innerHeight) {
      det.classList.add("is-up");
    } else {
      det.classList.remove("is-up");
    }
  }, true);
}
const docEmailBar = document.getElementById("doc-email-bar");
const docEmailCount = document.getElementById("doc-email-count");
const docEmailRecipient = document.getElementById("doc-email-recipient");
const docEmailName = document.getElementById("doc-email-name");
const docEmailSend = document.getElementById("doc-email-send");
const docEmailClear = document.getElementById("doc-email-clear");
const docEmailStatus = document.getElementById("doc-email-status");
const docSelectAll = document.getElementById("doc-select-all");
const selectedDocIds = new Set();

function syncSelectAllCheckbox() {
  if (!docSelectAll || !docList) return;
  const all = docList.querySelectorAll("[data-doc-select]");
  const checked = docList.querySelectorAll("[data-doc-select]:checked");
  if (!all.length || checked.length === 0) {
    docSelectAll.checked = false;
    docSelectAll.indeterminate = false;
  } else if (checked.length === all.length) {
    docSelectAll.checked = true;
    docSelectAll.indeterminate = false;
  } else {
    docSelectAll.checked = false;
    docSelectAll.indeterminate = true;
  }
}

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

const DOC_CATEGORY_ORDER = ["Invoices", "Flight Tickets", "Passports & Visas", "Hotel Vouchers", "Contracts", "Paid documents", "Other"];

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

function renderTouristPickerOptions(selectedId) {
  // Re-used by both the upload picker and the inline-edit select on each
  // doc row, so the option list stays in sync as the trip's tourists change.
  const opts = ['<option value="">— None —</option>'].concat(
    docTouristCache.map(function (t) {
      const label = ((t.lastName || "") + " " + (t.firstName || "")).trim() || "(unnamed)";
      const sel = t.id === selectedId ? " selected" : "";
      return '<option value="' + escapeHtml(t.id) + '"' + sel + ">" + escapeHtml(label) + "</option>";
    })
  );
  return opts.join("");
}

function renderDocItem(doc, tripId, num) {
  const icon = docFileIcon(doc.mimeType || "", doc.originalName);
  const size = docFormatSize(doc.size || 0);
  const uploadedAt = doc.uploadedAt ? String(doc.uploadedAt).split("T")[0] : "";
  const uploader = doc.uploadedBy ? (doc.uploadedBy.name || doc.uploadedBy.email || "") : "";
  const viewUrl = docViewUrl(doc, tripId);
  const downloadUrl = "/trip-uploads/" + tripId + "/" + doc.storedName + "?download=1";
  const checked = selectedDocIds.has(doc.id) ? " checked" : "";
  const touristLabel = doc.touristName ? doc.touristName : "";
  const isImg = (doc.mimeType || "").startsWith("image/") || /\.(jpg|jpeg|png|gif|webp)$/i.test(doc.originalName || "");
  const thumbHtml = isImg
    ? '<img class="doc-thumb-img" src="/trip-uploads/' + escapeHtml(tripId) + '/' + escapeHtml(doc.storedName) + '" alt="' + escapeHtml(doc.originalName) + '" loading="lazy" />'
    : '<div class="doc-thumb-fallback">' + icon + '</div>';
  return (
    '<div class="doc-item">' +
      '<label class="doc-select" aria-label="Select for email">' +
        '<input type="checkbox" data-doc-select="' + escapeHtml(doc.id) + '"' + checked + ' />' +
      '</label>' +
      '<div class="doc-num">' + num + '</div>' +
      '<a class="doc-icon doc-thumb" href="' + escapeHtml(viewUrl) + '" target="_blank" rel="noreferrer">' + thumbHtml + '</a>' +
      '<div class="doc-meta">' +
        '<a class="doc-name doc-name-link" href="' + escapeHtml(viewUrl) + '" target="_blank" rel="noreferrer" title="' + escapeHtml(doc.originalName) + '">' + escapeHtml(doc.originalName) + '</a>' +
        '<div class="doc-info">' + escapeHtml(size) + (uploadedAt ? ' · ' + uploadedAt : '') + (uploader ? ' · ' + escapeHtml(uploader) : '') + '</div>' +
        '<div class="doc-tourist-row">' +
          '<span class="doc-tourist-label">Tourist:</span> ' +
          '<select class="doc-tourist-select" data-doc-tourist="' + escapeHtml(doc.id) + '">' +
            renderTouristPickerOptions(doc.touristId || "") +
          '</select>' +
          (touristLabel ? '' : '<span class="doc-tourist-empty">not linked</span>') +
        '</div>' +
      '</div>' +
      '<details class="doc-menu">' +
        '<summary class="doc-menu-trigger" aria-label="Document actions">⋯</summary>' +
        '<div class="doc-menu-popover">' +
          '<a class="doc-menu-item" href="' + escapeHtml(viewUrl) + '" target="_blank" rel="noreferrer">View</a>' +
          '<a class="doc-menu-item" href="' + escapeHtml(downloadUrl) + '" download>Download</a>' +
          '<button type="button" class="doc-menu-item" data-doc-rename="' + escapeHtml(doc.id) + '" data-doc-name="' + escapeHtml(doc.originalName) + '">Rename</button>' +
          '<button type="button" class="doc-menu-item is-danger" data-doc-delete="' + escapeHtml(doc.id) + '" data-doc-name="' + escapeHtml(doc.originalName) + '">Delete</button>' +
        '</div>' +
      '</details>' +
    '</div>'
  );
}

function docKindOf(d) {
  const m = (d.mimeType || "").toLowerCase();
  const n = (d.originalName || "").toLowerCase();
  if (m.startsWith("image/") || /\.(jpg|jpeg|png|gif|webp)$/.test(n)) return "image";
  if (m.includes("pdf") || n.endsWith(".pdf")) return "pdf";
  if (n.endsWith(".doc") || n.endsWith(".docx") || m.includes("msword") || m.includes("officedocument.wordprocessing")) return "doc";
  if (n.endsWith(".xls") || n.endsWith(".xlsx") || m.includes("spreadsheet")) return "sheet";
  return "other";
}

let docToolbarSearch = "";
let docToolbarKind = "";
let docToolbarSort = localStorage.getItem("td_sort") || "newest";
let docToolbarView = "list";

function applyDocToolbarSortFilter(visible) {
  let out = visible.slice();
  if (activeDocFilter && activeDocFilter !== "all") {
    out = out.filter(function (d) { return (d.category || "Other") === activeDocFilter; });
  }
  if (docToolbarKind) {
    out = out.filter(function (d) { return docKindOf(d) === docToolbarKind; });
  }
  if (docToolbarSearch) {
    const q = docToolbarSearch.toLowerCase();
    out = out.filter(function (d) {
      const hay = (d.originalName || "") + " " + (d.touristName || "") + " " + (d.category || "");
      return hay.toLowerCase().includes(q);
    });
  }
  const cmps = {
    "newest":    function (a, b) { return String(b.uploadedAt || "").localeCompare(String(a.uploadedAt || "")); },
    "oldest":    function (a, b) { return String(a.uploadedAt || "").localeCompare(String(b.uploadedAt || "")); },
    "name-asc":  function (a, b) { return (a.originalName || "").localeCompare(b.originalName || ""); },
    "name-desc": function (a, b) { return (b.originalName || "").localeCompare(a.originalName || ""); },
    "size-desc": function (a, b) { return (b.size || 0) - (a.size || 0); },
  };
  out.sort(cmps[docToolbarSort] || cmps["newest"]);
  return out;
}

function applyDocViewClass() {
  if (!docList) return;
  docList.classList.remove("doc-view-icons", "doc-view-compact", "doc-view-list");
  docList.classList.add("doc-view-" + docToolbarView);
  document.querySelectorAll("[data-doc-view-btn]").forEach(function (btn) {
    btn.classList.toggle("is-active", btn.dataset.view === docToolbarView);
  });
}

function renderTripDocuments(docs, tripId) {
  if (!docList) return;
  // Hide docs whose tourist was deleted — they live on the global Documents
  // page with a "Removed from <trip>" pill, but the trip-detail view should
  // only show docs tied to current participants.
  const visible = (docs || []).filter(function(d) { return !d.touristRemovedAt; });
  applyDocViewClass();
  const filtered = applyDocToolbarSortFilter(visible);
  if (!filtered.length) {
    docList.innerHTML = '<p class="muted" style="padding:8px 0">' + (visible.length ? "No documents match these filters." : "No documents uploaded yet.") + '</p>';
    return;
  }
  // When any filter is set OR the user picked a non-default sort, render flat.
  // Default view (no filter, sort by upload date) keeps category groupings.
  const flat = activeDocFilter !== "all" || docToolbarSearch || docToolbarKind || docToolbarSort !== "newest";
  if (flat) {
    docList.innerHTML = filtered.map(function(doc, i) { return renderDocItem(doc, tripId, i + 1); }).join("");
    syncSelectAllCheckbox();
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
    html += '<div class="doc-group-inner">';
    group.forEach(function(doc) { html += renderDocItem(doc, tripId, globalNum++); });
    html += '</div></div>';
  });
  docList.innerHTML = html;
  syncSelectAllCheckbox();
}

async function loadTripDocuments(tripId) {
  if (!docList || !isTripDetailPage()) return;
  try {
    const [trips, touristsResp] = await Promise.all([
      fetchJson("/api/camp-trips"),
      fetchJson("/api/tourists"),
    ]);
    const trip = (trips.entries || trips).find((t) => t.id === tripId);
    docTouristCache = (touristsResp.entries || []).filter((t) => t.tripId === tripId);
    if (docTouristSelect) {
      docTouristSelect.innerHTML = renderTouristPickerOptions("");
    }
    renderTripDocuments(trip ? (trip.documents || []) : [], tripId);
  } catch (_) {
    // silently fail — documents are non-critical
  }
}

async function uploadFiles(tripId, files) {
  if (!tripId) { if (docUploadStatus) docUploadStatus.textContent = "Select a trip first."; return; }
  const category = (docCategorySelect && docCategorySelect.value) || "Other";
  const touristId = (docTouristSelect && docTouristSelect.value) || "";
  for (let file of files) {
    // Compress images client-side before upload to save Render disk space.
    if (window.CompressUpload && file.type && file.type.startsWith("image/")) {
      try { file = await window.CompressUpload.file(file); } catch {}
    }
    if (docUploadStatus) docUploadStatus.textContent = "Uploading " + file.name + "…";
    const form = new FormData();
    form.append("file", file);
    form.append("category", category);
    if (touristId) form.append("touristId", touristId);
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
  function updateDocEmailBar() {
    if (!docEmailBar || !docEmailCount) return;
    const n = selectedDocIds.size;
    docEmailCount.textContent = n + " selected";
    docEmailBar.classList.toggle("is-hidden", n === 0);
    syncSelectAllCheckbox();
  }

  if (docSelectAll) {
    docSelectAll.addEventListener("change", () => {
      const want = docSelectAll.checked;
      docList.querySelectorAll("[data-doc-select]").forEach((cb) => {
        cb.checked = want;
        const id = cb.getAttribute("data-doc-select");
        if (want) selectedDocIds.add(id);
        else selectedDocIds.delete(id);
      });
      updateDocEmailBar();
    });
  }

  if (docList) {
    docList.addEventListener("change", async (e) => {
      const cb = e.target.closest("[data-doc-select]");
      if (cb) {
        const id = cb.getAttribute("data-doc-select");
        if (cb.checked) selectedDocIds.add(id);
        else selectedDocIds.delete(id);
        updateDocEmailBar();
        return;
      }
      const ts = e.target.closest("[data-doc-tourist]");
      if (ts) {
        const docId = ts.getAttribute("data-doc-tourist");
        const tripId = activeTripId;
        if (!tripId) return;
        ts.disabled = true;
        try {
          const resp = await fetch("/api/camp-trips/" + tripId + "/documents/" + docId, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ touristId: ts.value }),
          });
          const data = await resp.json();
          if (!resp.ok) throw new Error(data.error || "Update failed");
          await loadTripDocuments(tripId);
        } catch (err) {
          alert("Алдаа: " + err.message);
          ts.disabled = false;
        }
      }
    });
  }

  if (docEmailClear) {
    docEmailClear.addEventListener("click", () => {
      selectedDocIds.clear();
      docList.querySelectorAll("[data-doc-select]").forEach((cb) => { cb.checked = false; });
      updateDocEmailBar();
      if (docEmailStatus) docEmailStatus.textContent = "";
    });
  }

  if (docEmailSend) {
    docEmailSend.addEventListener("click", async () => {
      if (!activeTripId) { docEmailStatus.textContent = "Open a trip first."; return; }
      if (!selectedDocIds.size) { docEmailStatus.textContent = "Select at least one file."; return; }
      const recipient = (docEmailRecipient?.value || "").trim();
      if (!recipient || !recipient.includes("@")) {
        docEmailStatus.textContent = "Enter a valid client email.";
        docEmailRecipient?.focus();
        return;
      }
      const name = (docEmailName?.value || "").trim();
      docEmailSend.disabled = true;
      docEmailStatus.style.color = "";
      docEmailStatus.style.fontWeight = "";
      docEmailStatus.textContent = "Илгээж байна...";
      try {
        const resp = await fetch("/api/camp-trips/" + activeTripId + "/documents/email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipientEmail: recipient,
            recipientName: name,
            docIds: [...selectedDocIds],
            workspace: typeof readWorkspace === "function" ? readWorkspace() : "",
          }),
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || "Send failed");
        const successMsg = "✔ Амжилттай илгээгдлээ! " + data.sent + " файл → " + recipient;
        docEmailStatus.textContent = successMsg;
        docEmailStatus.style.color = "#1a7f3a";
        docEmailStatus.style.fontWeight = "600";
        alert(successMsg);
        selectedDocIds.clear();
        docList.querySelectorAll("[data-doc-select]").forEach((cb) => { cb.checked = false; });
        updateDocEmailBar();
        if (docEmailRecipient) docEmailRecipient.value = "";
        if (docEmailName) docEmailName.value = "";
      } catch (err) {
        docEmailStatus.textContent = "Алдаа: " + err.message;
      } finally {
        docEmailSend.disabled = false;
      }
    });
  }

  if (docList) {
    docList.addEventListener("click", async (e) => {
      const deleteBtn = e.target.closest("[data-doc-delete]");
      if (deleteBtn) {
        const docId = deleteBtn.dataset.docDelete;
        const docName = deleteBtn.dataset.docName || "this file";
        if (!(await UI.confirm('Delete "' + docName + '"?', { dangerous: true }))) return;
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
        const newName = await UI.prompt("New file name:", { defaultValue: currentName });
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

if (isTripDetailPage()) {
  const docSearchEl   = document.getElementById("doc-search");
  const docKindEl     = document.getElementById("doc-kind");
  const docCatFilter  = document.getElementById("doc-category-filter");
  const docSortEl     = document.getElementById("doc-sort");
  const docViewBtns   = document.querySelectorAll("[data-doc-view-btn]");
  function rerender() { if (activeTripId) loadTripDocuments(activeTripId); }
  if (docSearchEl)  docSearchEl.addEventListener("input",  function () { docToolbarSearch = docSearchEl.value || ""; rerender(); });
  if (docKindEl)    docKindEl.addEventListener("change",   function () { docToolbarKind   = docKindEl.value   || ""; rerender(); });
  if (docCatFilter) docCatFilter.addEventListener("change", function () { activeDocFilter = docCatFilter.value || "all"; rerender(); });
  if (docSortEl) {
    docSortEl.value = docToolbarSort;
    docSortEl.addEventListener("change", function () {
      docToolbarSort = docSortEl.value || "newest";
      localStorage.setItem("td_sort", docToolbarSort);
      rerender();
    });
  }
  docViewBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      docToolbarView = btn.dataset.view || "icons";
      localStorage.setItem("td_view", docToolbarView);
      applyDocViewClass();
    });
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
  dropdown?.addEventListener("click", async (event) => {
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
      if (!(await UI.confirm(`Delete saved filter "${name}"?`, { dangerous: true }))) return;
      const list = readSavedFilters().filter((f) => f.name !== name);
      writeSavedFilters(list);
      refreshSavedFiltersDropdown(activeSavedFilterName === name ? "" : activeSavedFilterName);
    } else if (action === "save") {
      dropdown.removeAttribute("open");
      const newName = ((await UI.prompt("Save filter as:")) || "").trim();
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
  if (campCreatedDate) campCreatedDate.value = getMongoliaToday();
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
  if (window.DestinationsMulti) window.DestinationsMulti.attachAll(document);
}

init();
