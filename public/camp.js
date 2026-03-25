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
  ["planning", "Төлөвлөж буй"],
  ["confirmed", "Баталгаажсан"],
  ["travelling", "Явж буй"],
  ["completed", "Дууссан"],
  ["cancelled", "Цуцлагдсан"],
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
  renderActiveTrip();
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
    planning: "Төлөвлөж буй",
    confirmed: "Баталгаажсан",
    travelling: "Явж буй",
    completed: "Дууссан",
    cancelled: "Цуцлагдсан",
    rejected: "Татгалзсан",
    pending: "Хүлээгдэж буй",
    in_progress: "Явцад байна",
    paid_deposit: "Урьдчилгаа төлсөн",
    paid: "Төлсөн",
    paid_100: "100% төлсөн",
    finished: "Дууссан",
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
    '<option value="">Кэмп сонгох</option>',
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
  tripLanguageSelect.innerHTML = renderOptionMarkup(languages, "Хэл сонгох");
  tripFilterLanguage.innerHTML = renderOptionMarkup(languages, "Бүх хэл");
  reservationTripSelect.innerHTML = `<option value="">Трип сонгох</option>${currentTrips
    .map((trip) => `<option value="${trip.id}">${escapeHtml(trip.tripName)}</option>`)
    .join("")}`;
  filterTripName.innerHTML = `<option value="">Бүх трип</option>${currentTrips
    .map((trip) => `<option value="${trip.id}">${escapeHtml(trip.tripName)}</option>`)
    .join("")}`;
  campNameSelect.innerHTML = renderCampSelectOptions();
  locationNameSelect.innerHTML = renderGenericSelectOptions(campSettings.locationNames, "Байршил сонгох");
  filterCampName.innerHTML = renderOptionMarkup(campSettings.campNames, "Бүх кэмп");
  staffAssignmentSelect.innerHTML = renderOptionMarkup(campSettings.staffAssignments, "Ажилтан сонгох");
  roomTypeSelect.innerHTML = renderOptionMarkup(campSettings.roomChoices, "Төрөл сонгох");
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
  renderSettingGroup("locationNames", campSettings.locationNames);
  renderSettingGroup("staffAssignments", campSettings.staffAssignments);
  renderSettingGroup("roomChoices", campSettings.roomChoices);
  renderSettingsOptions();
}

function renderTrips() {
  const trips = getFilteredTrips();
  if (!trips.length) {
    tripList.innerHTML = '<p class="empty">Сонгосон шүүлтэд тохирох трип алга.</p>';
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
            <th>Трип</th>
            <th>Захиалгын нэр</th>
            <th>Эхлэх өдөр</th>
            <th>Жуулчин</th>
            <th>Ажилтан</th>
            <th>Хэл</th>
            <th>Төлөв</th>
            <th>Үүсгэсэн</th>
            <th>Менежер</th>
            <th>Үйлдэл</th>
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
                  <td>${escapeHtml(trip.language)}</td>
                  <td><span class="status-pill is-${normalizeStatus(trip.status)}">${formatStatusLabel(trip.status)}</span></td>
                  <td>${formatDate(trip.createdAt, true)}</td>
                  <td>${escapeHtml(trip.createdBy?.name || trip.createdBy?.email || "-")}</td>
                  <td>
                    <div class="trip-row-actions trip-row-actions-grid">
                      <select class="inline-status-select" data-action="trip-status" data-trip-id="${trip.id}">
                        ${TRIP_STATUS_OPTIONS
                          .map(([value, label]) => `<option value="${value}" ${trip.status === value ? "selected" : ""}>${label}</option>`)
                          .join("")}
                      </select>
                      <button type="button" class="table-action compact secondary" data-action="edit-trip" data-trip-id="${trip.id}">Засах</button>
                      <button type="button" class="table-action compact" data-action="add-reservation" data-trip-id="${trip.id}">Захиалга нэмэх</button>
                      <button type="button" class="table-action compact danger" data-action="delete-trip" data-trip-id="${trip.id}">Устгах</button>
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
        <button type="button" data-action="trip-page-prev" ${currentTripPage === 1 ? "disabled" : ""}>Өмнөх</button>
        <button type="button" data-action="trip-page-next" ${currentTripPage === totalPages ? "disabled" : ""}>Дараах</button>
      </div>
    </div>
  `;
}

function renderActiveTrip() {
  const trip = getTripById(activeTripId);
  if (!trip || activeTripPanelHidden) {
    activeTripBox.className = "camp-active-trip is-hidden";
    activeTripBox.innerHTML = "";
    return;
  }

  const tripReservations = currentEntries.filter((entry) => entry.tripId === trip.id);
  const totalInternalCost = tripReservations.reduce((sum, entry) => sum + Number(entry.totalPayment || 0), 0);
  activeTripBox.className = "camp-active-trip";
  activeTripBox.innerHTML = `
    <div>
      <strong>${escapeHtml(trip.tripName)}</strong>
      <span>${formatDate(trip.startDate)} · ${escapeHtml(trip.language || "-")} · ${trip.participantCount || 0} жуулчин / ${trip.staffCount || 0} ажилтан · ${trip.totalDays || 1} хоног</span>
      <span>Захиалгын нэр: ${escapeHtml(trip.reservationName || trip.tripName)}</span>
    </div>
    <div>
      <strong>${tripReservations.length} захиалга</strong>
      <span>Дотоод кэмп зардал: ${formatMoney(totalInternalCost)}</span>
    </div>
  `;
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
    campPaymentList.innerHTML = '<p class="empty">Кэмпийн төлбөрийн мэдээлэл алга.</p>';
    return;
  }
  campPaymentList.innerHTML = `
    <div class="camp-table-wrap">
      <table class="camp-table camp-payment-table">
        <thead>
          <tr>
            <th>Трип</th>
            <th>Захиалгын нэр</th>
            <th>Кэмп</th>
            <th>Захиалга</th>
            <th>Урьдчилгаа</th>
            <th>Урьдчилгаа төлсөн өдөр</th>
            <th>2-р төлбөр</th>
            <th>2-р төлбөрийн өдөр</th>
            <th>Төлсөн</th>
            <th>Үлдэгдэл</th>
            <th>Нийт</th>
            <th>Төлөв</th>
            <th>Үйлдэл</th>
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
                      <button type="button" class="table-action compact secondary" data-action="edit-payment-group" data-group-key="${escapeHtml(row.key)}">Засах</button>
                      <button type="button" class="table-action compact danger" data-action="delete-payment-group" data-group-key="${escapeHtml(row.key)}">Устгах</button>
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
        <h2>${escapeHtml(trip?.tripName || "Трип")} захиалгууд</h2>
        <div class="camp-toolbar trip-detail-toolbar">
          <label class="trip-day-filter-label">
            <span>Өдрөөр шүүх</span>
            <select data-action="trip-day-filter">
              <option value="">Бүх өдөр</option>
              ${Array.from({ length: totalDays }, (_, index) => `<option value="${index + 1}" ${String(index + 1) === String(activeTripDayFilter) ? "selected" : ""}>Өдөр ${index + 1}</option>`).join("")}
            </select>
          </label>
          <button type="button" class="secondary-button" data-action="hide-trip-panel">Хаах</button>
        </div>
      </div>
      <p class="empty">Энэ трипт захиалга алга.</p>
    `;
    return;
  }

  activeTripReservations.classList.remove("is-hidden");
  activeTripReservations.innerHTML = `
    <div class="section-head">
      <h2>${escapeHtml(trip?.tripName || "Трип")} захиалгууд</h2>
      <div class="camp-toolbar trip-detail-toolbar">
        <label class="trip-day-filter-label">
          <span>Өдрөөр шүүх</span>
          <select data-action="trip-day-filter">
            <option value="">Бүх өдөр</option>
            ${Array.from({ length: totalDays }, (_, index) => `<option value="${index + 1}" ${String(index + 1) === String(activeTripDayFilter) ? "selected" : ""}>Өдөр ${index + 1}</option>`).join("")}
          </select>
        </label>
        <button type="button" class="secondary-button" data-action="hide-trip-panel">Хаах</button>
      </div>
    </div>
    <div class="camp-table-wrap">
      <table class="camp-table camp-table-detail">
        <thead>
          <tr>
            <th class="checkbox-col"><button type="button" class="row-selector-button ${entries.every((entry) => selectedReservationIds.has(entry.id)) ? "is-selected" : ""}" data-action="toggle-select-all-detail" aria-label="Бүгдийг сонгох">${entries.every((entry) => selectedReservationIds.has(entry.id)) ? "✓" : ""}</button></th>
            <th>Трип</th>
            <th>Захиалгын нэр</th>
            <th>Өдөр</th>
            <th>Кэмп</th>
            <th>Байршил</th>
            <th>Төрөл</th>
            <th>Жуулчин</th>
            <th>Ажилтан</th>
            <th>Очих</th>
            <th>Хоног</th>
            <th>Явах</th>
            <th>Гэр</th>
            <th>Өрөө</th>
            <th>Хариуцсан</th>
            <th>Төлөв</th>
            <th>Үүсгэсэн</th>
            <th>Тэмдэглэл</th>
            <th>Хоол</th>
            <th>Үйлдэл</th>
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
      <h2>${escapeHtml(activeCampName)} захиалгууд</h2>
      <div class="camp-toolbar trip-detail-toolbar">
        <button type="button" class="secondary-button" data-action="hide-camp-panel">Хаах</button>
      </div>
    </div>
    <div class="camp-table-wrap">
      <table class="camp-table camp-table-detail">
        <thead>
          <tr>
            <th>Трип</th>
            <th>Захиалгын нэр</th>
            <th>Өдөр</th>
            <th>Кэмп</th>
            <th>Байршил</th>
            <th>Төрөл</th>
            <th>Жуулчин</th>
            <th>Ажилтан</th>
            <th>Очих</th>
            <th>Хоног</th>
            <th>Явах</th>
            <th>Гэр</th>
            <th>Өрөө</th>
            <th>Хариуцсан</th>
            <th>Төлөв</th>
            <th>Үүсгэсэн</th>
            <th>Тэмдэглэл</th>
            <th>Хоол</th>
            <th>Үйлдэл</th>
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
  const meals = [entry.breakfast === "Yes" && "Өглөөний цай", entry.lunch === "Yes" && "Өдрийн хоол", entry.dinner === "Yes" && "Оройн хоол"]
    .filter(Boolean)
    .join(" / ");
  return `
    <tr class="${statusClass(entry)}">
      ${includeCheckbox ? `<td class="checkbox-col"><button type="button" class="row-selector-button ${isSelected ? "is-selected" : ""}" data-action="toggle-select" data-id="${entry.id}" aria-label="Сонгох">${isSelected ? "✓" : ""}</button></td>` : ""}
      <td class="table-primary-cell table-nowrap">${escapeHtml(entry.tripName)}</td>
      <td class="table-nowrap">${escapeHtml(entry.reservationName || entry.tripName)}</td>
      <td class="table-nowrap">${getTripDayLabel(entry)}</td>
      <td><button type="button" class="table-link compact secondary" data-action="select-camp" data-camp-name="${escapeHtml(entry.campName)}">${escapeHtml(entry.campName)}</button></td>
      <td>${escapeHtml(entry.locationName || "-")}</td>
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
        <div class="camp-row-actions stacked-pills">
          <button type="button" class="table-action compact secondary" data-action="edit" data-id="${entry.id}">Засах</button>
          <button type="button" class="table-action compact secondary" data-action="view-pdf" data-id="${entry.id}">Харах</button>
          <button type="button" class="table-action compact" data-action="download-pdf" data-id="${entry.id}">PDF</button>
          <button type="button" class="table-action compact danger" data-action="delete-reservation" data-id="${entry.id}">Устгах</button>
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
        <select data-role="locationName" data-id="${entry.id}">
          <option value="">Байршил сонгох</option>
          ${campSettings.locationNames.map((option) => `<option value="${escapeHtml(option)}" ${entry.locationName === option ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}
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
          <option value="">Ажилтан сонгох</option>
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
            <option value="No" ${entry.breakfast === "No" ? "selected" : ""}>Өглөө: Үгүй</option>
            <option value="Yes" ${entry.breakfast === "Yes" ? "selected" : ""}>Өглөө: Тийм</option>
          </select>
          <select data-role="lunch" data-id="${entry.id}">
            <option value="No" ${entry.lunch === "No" ? "selected" : ""}>Өдөр: Үгүй</option>
            <option value="Yes" ${entry.lunch === "Yes" ? "selected" : ""}>Өдөр: Тийм</option>
          </select>
          <select data-role="dinner" data-id="${entry.id}">
            <option value="No" ${entry.dinner === "No" ? "selected" : ""}>Орой: Үгүй</option>
            <option value="Yes" ${entry.dinner === "Yes" ? "selected" : ""}>Орой: Тийм</option>
          </select>
        </div>
      </td>
      <td class="camp-row-actions compact">
        <button type="button" class="table-action compact" data-action="save" data-id="${entry.id}">Хадгалах</button>
        <button type="button" class="table-action compact secondary" data-action="cancel-edit">Болих</button>
      </td>
    </tr>
  `;
}

function renderEntries() {
  const entries = getFilteredEntries();
  if (!entries.length) {
    campList.innerHTML = '<p class="empty">Сонгосон шүүлтэд тохирох захиалга алга.</p>';
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
            <th class="checkbox-col"><button type="button" class="row-selector-button ${visibleEntries.length && visibleEntries.every((entry) => selectedReservationIds.has(entry.id)) ? "is-selected" : ""}" data-action="toggle-select-all" aria-label="Бүгдийг сонгох">${visibleEntries.length && visibleEntries.every((entry) => selectedReservationIds.has(entry.id)) ? "✓" : ""}</button></th>
            <th>Трип</th>
            <th>Захиалгын нэр</th>
            <th>Өдөр</th>
            <th>Кэмп</th>
            <th>Байршил</th>
            <th>Төрөл</th>
            <th>Жуулчин</th>
            <th>Ажилтан</th>
            <th>Очих</th>
            <th>Хоног</th>
            <th>Явах</th>
            <th>Гэр</th>
            <th>Өрөө</th>
            <th>Хариуцсан</th>
            <th>Төлөв</th>
            <th>Үүсгэсэн</th>
            <th>Тэмдэглэл</th>
            <th>Хоол</th>
            <th>Үйлдэл</th>
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
        <button type="button" data-action="page-prev" ${currentPage === 1 ? "disabled" : ""}>Өмнөх</button>
        <button type="button" data-action="page-next" ${currentPage === totalPages ? "disabled" : ""}>Дараах</button>
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
  reservationEditPanel.classList.remove("is-hidden");
  reservationEditPanel.innerHTML = `
    <div class="section-head">
      <h2>${isCreate ? "Шинэ захиалга" : "Захиалга засварлах"}</h2>
      <div class="camp-toolbar trip-detail-toolbar">
        <button type="button" class="secondary-button" data-action="hide-reservation-edit">Хаах</button>
      </div>
    </div>
    <form id="${isCreate ? "reservation-create-form" : "reservation-edit-form"}" class="field-grid camp-edit-panel-form">
      <input type="hidden" name="id" value="${reservationData.id || ""}" />
      <div class="camp-form-section full-span">
        <div class="camp-form-section-head">
          <h3>Захиалгын мэдээлэл</h3>
          <p>${isCreate ? "Шинэ захиалгын мэдээллийг бөглөөд хадгална." : "Захиалгын мэдээллийг засварлаад хадгална."}</p>
        </div>
        <div class="field-grid field-grid-compact">
          <label>
            Сонгосон трип
            <select name="tripId" required>
              ${currentTrips.map((trip) => `<option value="${escapeHtml(trip.id)}" ${trip.id === reservationData.tripId ? "selected" : ""}>${escapeHtml(trip.tripName)}</option>`).join("")}
            </select>
          </label>
          <label>
            Захиалгын нэр
            <input name="reservationName" value="${escapeHtml(reservationData.reservationName || reservationData.tripName || "")}" required />
          </label>
          <label>
            Захиалсан өдөр
            <input name="createdDate" type="date" value="${escapeHtml(reservationData.createdDate || "")}" />
          </label>
          <label>
            Кэмп
            <select name="campName" required>
              ${renderCampSelectOptions(reservationData.campName)}
            </select>
          </label>
          <label>
            Байршил
            <select name="locationName">
              ${renderGenericSelectOptions(campSettings.locationNames, "Байршил сонгох", reservationData.locationName || "")}
            </select>
          </label>
          <label>
            Шинэ кэмп
            <input name="newCampName" placeholder="Жагсаалтад байхгүй бол шинэ кэмп нэмэх" />
          </label>
          <label>
            Захиалгын төрөл
            <select name="reservationType" required>
              <option value="camp" ${reservationData.reservationType === "camp" ? "selected" : ""}>Баазын захиалга</option>
              <option value="hotel" ${reservationData.reservationType === "hotel" ? "selected" : ""}>Буудлын захиалга</option>
              <option value="herder" ${reservationData.reservationType === "herder" ? "selected" : ""}>Малчин айлын захиалга</option>
            </select>
          </label>
          <label>
            Очих өдөр
            <input name="checkIn" type="date" value="${escapeHtml(reservationData.checkIn || "")}" required />
          </label>
          <label>
            Хоногийн тоо
            <input name="nights" type="number" min="1" value="${Number(reservationData.nights || 1)}" required />
          </label>
          <label>
            Явах өдөр
            <input name="checkOut" type="date" value="${escapeHtml(reservationData.checkOut || "")}" required />
          </label>
          <label>
            Жуулчны тоо
            <input name="clientCount" type="number" min="1" value="${Number(reservationData.clientCount || 2)}" required />
          </label>
          <label>
            Ажилтны тоо
            <input name="staffCount" type="number" min="0" value="${Number(reservationData.staffCount || 0)}" />
          </label>
          <label>
            Хариуцсан ажилтан
            <select name="staffAssignment">
              ${renderGenericSelectOptions(campSettings.staffAssignments, "Ажилтан сонгох", reservationData.staffAssignment || "")}
            </select>
          </label>
          <label>
            Гэр / өрөөний тоо
            <input name="gerCount" type="number" min="1" value="${Number(reservationData.gerCount || 1)}" required />
          </label>
          <label>
            Гэр / өрөөний төрөл
            <select name="roomType" required>
              ${renderGenericSelectOptions(campSettings.roomChoices, "Төрөл сонгох", reservationData.roomType || "")}
            </select>
          </label>
          <label>
            Өглөөний цай
            <select name="breakfast">
              <option value="No" ${reservationData.breakfast === "No" ? "selected" : ""}>Үгүй</option>
              <option value="Yes" ${reservationData.breakfast === "Yes" ? "selected" : ""}>Тийм</option>
            </select>
          </label>
          <label>
            Өдрийн хоол
            <select name="lunch">
              <option value="No" ${reservationData.lunch === "No" ? "selected" : ""}>Үгүй</option>
              <option value="Yes" ${reservationData.lunch === "Yes" ? "selected" : ""}>Тийм</option>
            </select>
          </label>
          <label>
            Оройн хоол
            <select name="dinner">
              <option value="No" ${reservationData.dinner === "No" ? "selected" : ""}>Үгүй</option>
              <option value="Yes" ${reservationData.dinner === "Yes" ? "selected" : ""}>Тийм</option>
            </select>
          </label>
          <label>
            Төлөв
            <select name="status">
              <option value="pending" ${reservationData.status === "pending" ? "selected" : ""}>Хүлээгдэж буй</option>
              <option value="confirmed" ${reservationData.status === "confirmed" ? "selected" : ""}>Баталгаажсан</option>
              <option value="cancelled" ${reservationData.status === "cancelled" ? "selected" : ""}>Цуцлагдсан</option>
              <option value="rejected" ${reservationData.status === "rejected" ? "selected" : ""}>Татгалзсан</option>
            </select>
          </label>
          <label class="full-span">
            Нэмэлт тэмдэглэл
            <textarea name="notes" rows="4">${escapeHtml(reservationData.notes || "")}</textarea>
          </label>
        </div>
      </div>
      <div class="actions full-span">
        <button type="submit">${isCreate ? "Захиалга хадгалах" : "Засварыг хадгалах"}</button>
        <button type="button" class="secondary-button" data-action="hide-reservation-edit">Болих</button>
        <p class="status" id="reservation-edit-status"></p>
      </div>
    </form>
  `;
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
      <h2>Кэмпийн төлбөр засварлах</h2>
      <div class="camp-toolbar trip-detail-toolbar">
        <button type="button" class="secondary-button" data-action="hide-payment-edit">Хаах</button>
      </div>
    </div>
    <form id="payment-edit-form" class="field-grid">
      <input type="hidden" name="groupKey" value="${escapeHtml(groupKey)}" />
      <div class="camp-form-section full-span">
        <div class="camp-form-section-head">
          <h3>${escapeHtml(group.tripName)} · ${escapeHtml(group.campName)}</h3>
          <p>Захиалгын нэр: ${escapeHtml(group.reservationName)}</p>
        </div>
        <div class="field-grid field-grid-compact">
          <label>Урьдчилгаа<input name="deposit" inputmode="numeric" value="${String(group.deposit || "")}" /></label>
          <label>Урьдчилгаа төлсөн өдөр<input name="depositPaidDate" type="date" value="${escapeHtml(group.depositPaidDate)}" /></label>
          <label>2-р төлбөр<input name="secondPayment" inputmode="numeric" value="${String(group.secondPayment || "")}" /></label>
          <label>2-р төлбөрийн өдөр<input name="secondPaidDate" type="date" value="${escapeHtml(group.secondPaidDate)}" /></label>
          <label>Төлсөн дүн<input name="paidAmount" inputmode="numeric" value="${String(group.paidAmount || "")}" /></label>
          <label>Үлдэгдэл<input name="balancePayment" inputmode="numeric" value="${String(group.balancePayment || "")}" /></label>
          <label>Нийт төлбөр<input name="totalPayment" inputmode="numeric" value="${String(group.totalPayment || "")}" /></label>
          <label>
            Төлөв
            <select name="paymentStatus">
              <option value="in_progress" ${group.paymentStatus === "in_progress" ? "selected" : ""}>Явцад байна</option>
              <option value="paid_deposit" ${group.paymentStatus === "paid_deposit" ? "selected" : ""}>Урьдчилгаа төлсөн</option>
              <option value="paid" ${group.paymentStatus === "paid" ? "selected" : ""}>Төлсөн</option>
              <option value="paid_100" ${group.paymentStatus === "paid_100" ? "selected" : ""}>100% төлсөн</option>
              <option value="finished" ${group.paymentStatus === "finished" ? "selected" : ""}>Дууссан</option>
            </select>
          </label>
        </div>
      </div>
      <div class="actions full-span">
        <button type="submit">Төлбөр хадгалах</button>
        <button type="button" class="secondary-button" data-action="hide-payment-edit">Болих</button>
        <p class="status" id="payment-edit-status"></p>
      </div>
    </form>
  `;
  paymentEditPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  requestAnimationFrame(() => {
    window.scrollTo({ top: Math.max(paymentEditPanel.getBoundingClientRect().top + window.scrollY - 24, 0), behavior: "smooth" });
  });
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
    tripStatus.textContent = "Трип шинэчлэгдлээ.";
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
  campForm.reset();
  editingReservationId = reservation?.id || "";
  const defaultTripId = reservation?.tripId || tripId || activeTripId || reservationTripSelect.value || "";
  reservationTripSelect.value = defaultTripId;
  campCreatedDate.value = reservation?.createdDate || new Date().toISOString().slice(0, 10);
  campNameSelect.innerHTML = renderCampSelectOptions(reservation?.campName || "");
  locationNameSelect.innerHTML = renderGenericSelectOptions(campSettings.locationNames, "Байршил сонгох", reservation?.locationName || "");
  campNameSelect.value = reservation?.campName || "";
  locationNameSelect.value = reservation?.locationName || "";
  newCampNameInput.value = "";
  campForm.elements.reservationName.value = reservation?.reservationName || getTripById(defaultTripId)?.reservationName || getTripById(defaultTripId)?.tripName || "";
  campForm.elements.reservationType.value = reservation?.reservationType || "camp";
  campForm.elements.checkIn.value = reservation?.checkIn || "";
  campForm.elements.nights.value = String(reservation?.nights || 1);
  campForm.elements.checkOut.value = reservation?.checkOut || "";
  campForm.elements.clientCount.value = String(reservation?.clientCount || 2);
  campForm.elements.staffCount.value = String(reservation?.staffCount || 0);
  campForm.elements.staffAssignment.value = reservation?.staffAssignment || "";
  campForm.elements.gerCount.value = String(reservation?.gerCount || 1);
  campForm.elements.roomType.value = reservation?.roomType || "";
  campForm.elements.breakfast.value = reservation?.breakfast || "No";
  campForm.elements.lunch.value = reservation?.lunch || "No";
  campForm.elements.dinner.value = reservation?.dinner || "No";
  campForm.elements.deposit.value = String(reservation?.deposit || "");
  campForm.elements.totalPayment.value = String(reservation?.totalPayment || "");
  campForm.elements.balancePayment.value = String(reservation?.balancePayment || "");
  campForm.elements.paidAmount.value = String(reservation?.paidAmount || "");
  campForm.elements.depositPaidDate.value = reservation?.depositPaidDate || "";
  campForm.elements.secondPayment.value = String(reservation?.secondPayment || "");
  campForm.elements.secondPaidDate.value = reservation?.secondPaidDate || "";
  campForm.elements.paymentStatus.value = reservation?.paymentStatus || "in_progress";
  campForm.elements.status.value = reservation?.status || "pending";
  campForm.elements.notes.value = reservation?.notes || "";
  if (!campForm.elements.checkOut.value) {
    syncCheckoutFromStay();
  }
  campStatus.textContent = reservation
    ? `Editing reservation: ${reservation.reservationName || reservation.tripName}`
    : defaultTripId
      ? `Захиалга нэмж байна: ${getTripById(defaultTripId)?.tripName || ""}`
      : "Эхлээд трипээ сонгоод дараа нь захиалга нэмнэ үү.";
  openPanel(campFormPanel);
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

  campStatus.textContent = "Захиалга шинэчилж байна...";

  try {
    await fetchJson(`/api/camp-reservations/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    editingReservationId = "";
    campStatus.textContent = "Захиалга шинэчлэгдлээ.";
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
    campStatus.textContent = "Экспортлох захиалга алга.";
    return;
  }
  campStatus.textContent = "PDF бэлдэж байна...";
  try {
    const ids = entries.map((entry) => entry.id).join(",");
    const result = await fetchJson(`/api/camp-reservations/export?ids=${encodeURIComponent(ids)}`);
    const link = document.createElement("a");
    link.href = appendDownloadQuery(result.entry.pdfPath);
    link.download = "camp-reservations.pdf";
    document.body.appendChild(link);
    link.click();
    link.remove();
    campStatus.textContent = "PDF бэлэн боллоо.";
  } catch (error) {
    campStatus.textContent = error.message;
  }
}

tripForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  tripStatus.textContent = editingTripId ? "Трип шинэчилж байна..." : "Трип хадгалж байна...";

  try {
    const result = await fetchJson(editingTripId ? `/api/camp-trips/${editingTripId}` : "/api/camp-trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPayload(tripForm)),
    });
    tripStatus.textContent = editingTripId ? `Трип шинэчлэгдлээ: ${result.entry.tripName}` : `Трип үүслээ: ${result.entry.tripName}`;
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
  if (target.id === "reservation-edit-form") {
    event.preventDefault();
    const statusNode = target.querySelector("#reservation-edit-status");
    if (statusNode) statusNode.textContent = "Захиалга хадгалж байна...";
    const payload = buildPayload(target);
    const selectedTrip = getTripById(payload.tripId);
    if (!selectedTrip) {
      if (statusNode) statusNode.textContent = "Эхлээд трипээ сонгоно уу.";
      return;
    }
    payload.tripName = selectedTrip.tripName;
    payload.reservationName = payload.reservationName || selectedTrip.reservationName || selectedTrip.tripName;
    try {
      await fetchJson(`/api/camp-reservations/${payload.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      closeInlineEditPanels();
      hideSelectionPanels();
      campStatus.textContent = "Захиалга шинэчлэгдлээ.";
      await loadSettings();
      await loadReservations();
    } catch (error) {
      if (statusNode) statusNode.textContent = error.message;
    }
    return;
  }
  if (target.id === "reservation-create-form") {
    event.preventDefault();
    const statusNode = target.querySelector("#reservation-edit-status");
    if (statusNode) statusNode.textContent = "Захиалга хадгалж байна...";
    const payload = buildPayload(target);
    const selectedTrip = getTripById(payload.tripId);
    if (!selectedTrip) {
      if (statusNode) statusNode.textContent = "Эхлээд трипээ сонгоно уу.";
      return;
    }
    payload.tripId = selectedTrip.id;
    payload.tripName = selectedTrip.tripName;
    payload.reservationName = payload.reservationName || selectedTrip.reservationName || selectedTrip.tripName;
    try {
      await fetchJson("/api/camp-reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      closeInlineEditPanels();
      hideSelectionPanels();
      campStatus.textContent = "Захиалга амжилттай хадгалагдлаа.";
      await loadSettings();
      await loadReservations();
    } catch (error) {
      if (statusNode) statusNode.textContent = error.message;
    }
    return;
  }
  if (target.id === "payment-edit-form") {
    event.preventDefault();
    const statusNode = target.querySelector("#payment-edit-status");
    if (statusNode) statusNode.textContent = "Төлбөр хадгалж байна...";
    const payload = buildPayload(target);
    const entries = getEntriesByGroupKey(payload.groupKey);
    try {
      await Promise.all(
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
      closeInlineEditPanels();
      campStatus.textContent = "Төлбөр шинэчлэгдлээ.";
      await loadReservations();
    } catch (error) {
      if (statusNode) statusNode.textContent = error.message;
    }
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
  }
});

document.addEventListener("change", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }
  const form = target.closest("#reservation-edit-form, #reservation-create-form");
  if (form && target.getAttribute("name") === "checkOut") {
    syncInlineEditNights(form);
  }
});

campForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  campStatus.textContent = editingReservationId ? "Захиалга шинэчилж байна..." : "Захиалга хадгалж байна...";

  const selectedTrip = getTripById(reservationTripSelect.value || activeTripId);
  if (!selectedTrip) {
    campStatus.textContent = "Эхлээд трипээ сонгоно уу.";
    return;
  }

  const payload = buildPayload(campForm);
  payload.tripId = selectedTrip.id;
  payload.tripName = selectedTrip.tripName;
  payload.reservationName = payload.reservationName || selectedTrip.reservationName || selectedTrip.tripName;

  try {
    await fetchJson(editingReservationId ? `/api/camp-reservations/${editingReservationId}` : "/api/camp-reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    campStatus.textContent = editingReservationId ? "Захиалга шинэчлэгдлээ." : "Захиалга хадгалагдлаа.";
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
    await loadReservations();
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
    tripStatus.textContent = `Сонгосон трип: ${getTripById(actionTarget.dataset.tripId)?.tripName || ""}`;
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
    if (window.confirm("Энэ трип болон холбоотой бүх захиалгыг устгах уу?")) {
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
    if (window.confirm("Энэ захиалгыг устгах уу?")) {
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
    return;
  }
  if (action === "hide-payment-edit") {
    closeInlineEditPanels();
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
activeCampReservations.addEventListener("click", handleCampTableClick);
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
