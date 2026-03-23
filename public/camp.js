const tripForm = document.querySelector("#trip-form");
const tripStatus = document.querySelector("#trip-status");
const tripList = document.querySelector("#trip-list");
const activeTripBox = document.querySelector("#active-trip");
const campForm = document.querySelector("#camp-form");
const campStatus = document.querySelector("#camp-status");
const campList = document.querySelector("#camp-list");
const campToggleForm = document.querySelector("#camp-toggle-form");
const campFormPanel = document.querySelector("#camp-form-panel");
const reservationTripSelect = document.querySelector("#reservation-trip-select");
const filterCampName = document.querySelector("#filter-camp-name");
const filterTripName = document.querySelector("#filter-trip-name");
const filterStatus = document.querySelector("#filter-status");

let currentTrips = [];
let currentEntries = [];
let activeTripId = "";
let editingReservationId = "";
let currentPage = 1;
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

function formatDate(value) {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat("mn-MN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function normalizeStatus(status) {
  return String(status || "").trim().toLowerCase();
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

function setActiveTrip(tripId) {
  activeTripId = tripId || "";
  reservationTripSelect.value = activeTripId;
  filterTripName.value = activeTripId;
  currentPage = 1;
  renderTrips(currentTrips);
  renderActiveTrip();
  renderEntries(getFilteredEntries());
}

function renderTrips(trips) {
  if (!trips.length) {
    tripList.innerHTML = '<p class="empty">No trips yet. Create your first trip.</p>';
    reservationTripSelect.innerHTML = '<option value="">Select trip</option>';
    filterTripName.innerHTML = '<option value="">All trips</option>';
    return;
  }

  tripList.innerHTML = trips
    .map(
      (trip) => `
        <article class="camp-trip-card ${activeTripId === trip.id ? "is-active" : ""}" data-trip-id="${trip.id}">
          <div class="camp-trip-card-top">
            <strong>${escapeHtml(trip.tripName)}</strong>
            <button type="button" class="secondary-button" data-action="open-trip" data-trip-id="${trip.id}">
              ${activeTripId === trip.id ? "Opened" : "Open trip"}
            </button>
          </div>
          <span>Language: ${escapeHtml(trip.language || "Other")}</span>
        </article>
      `
    )
    .join("");

  const tripOptions = trips
    .map((trip) => `<option value="${trip.id}">${escapeHtml(trip.tripName)}</option>`)
    .join("");

  reservationTripSelect.innerHTML = `<option value="">Select trip</option>${tripOptions}`;
  filterTripName.innerHTML = `<option value="">All trips</option>${tripOptions}`;

  if (activeTripId) {
    reservationTripSelect.value = activeTripId;
    filterTripName.value = activeTripId;
  }
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
  activeTripBox.className = "camp-active-trip";
  activeTripBox.innerHTML = `
    <div>
      <strong>${escapeHtml(trip.tripName)}</strong>
      <span>Language: ${escapeHtml(trip.language || "Other")}</span>
    </div>
    <div>
      <strong>${tripReservations.length}</strong>
      <span>reservations in this trip</span>
    </div>
  `;
}

function getFilteredEntries() {
  const campNeedle = filterCampName.value.trim().toLowerCase();
  const tripId = filterTripName.value;
  const status = filterStatus.value;

  return currentEntries.filter((entry) => {
    const matchesCamp = !campNeedle || entry.campName.toLowerCase().includes(campNeedle);
    const matchesTrip = !tripId || entry.tripId === tripId;
    const matchesStatus = !status || entry.status === status;
    return matchesCamp && matchesTrip && matchesStatus;
  });
}

function statusClass(entry) {
  const status = normalizeStatus(entry.status);
  return status ? `status-${status}` : "";
}

function renderReadOnlyRow(entry, index) {
  return `
    <tr class="${statusClass(entry)}">
      <td>${index + 1}</td>
      <td>${escapeHtml(entry.tripName)}</td>
      <td>${escapeHtml(entry.campName)}</td>
      <td>${entry.clientCount}</td>
      <td>${entry.staffCount}</td>
      <td>${formatDate(entry.checkIn)}</td>
      <td>${formatDate(entry.checkOut)}</td>
      <td>${entry.nights}</td>
      <td>${entry.gerCount}</td>
      <td>${escapeHtml(entry.roomType)}</td>
      <td>${escapeHtml(entry.staffAssignment || "-")}</td>
      <td><span class="status-pill is-${normalizeStatus(entry.status)}">${escapeHtml(entry.status)}</span></td>
      <td>${formatMoney(entry.deposit)}</td>
      <td>${formatMoney(entry.totalPayment)}</td>
      <td>${formatMoney(entry.balancePayment)}</td>
      <td>${escapeHtml(entry.notes || "-")}</td>
      <td class="camp-row-actions">
        <button type="button" class="table-action" data-action="edit" data-id="${entry.id}">Edit</button>
        <a class="table-link secondary" href="${entry.pdfViewPath}" target="_blank" rel="noreferrer">View</a>
        <a class="table-link" href="${entry.pdfPath}" download>PDF</a>
      </td>
    </tr>
  `;
}

function renderEditableRow(entry, index) {
  return `
    <tr class="is-editing ${statusClass(entry)}">
      <td>${index + 1}</td>
      <td>${escapeHtml(entry.tripName)}</td>
      <td><input data-role="campName" data-id="${entry.id}" value="${escapeHtml(entry.campName)}" /></td>
      <td><input data-role="clientCount" data-id="${entry.id}" type="number" min="1" value="${entry.clientCount}" /></td>
      <td><input data-role="staffCount" data-id="${entry.id}" type="number" min="0" value="${entry.staffCount}" /></td>
      <td><input data-role="checkIn" data-id="${entry.id}" type="date" value="${entry.checkIn}" /></td>
      <td><input data-role="checkOut" data-id="${entry.id}" type="date" value="${entry.checkOut}" /></td>
      <td><input data-role="nights" data-id="${entry.id}" type="number" min="1" value="${entry.nights}" /></td>
      <td><input data-role="gerCount" data-id="${entry.id}" type="number" min="1" value="${entry.gerCount}" /></td>
      <td>
        <select data-role="roomType" data-id="${entry.id}">
          ${["Standard Ger (Double / Twin)", "Standard Ger (3-4 pax)", "Luxury Ger with bathroom", "Luxury Ger without bathroom"]
            .map((option) => `<option value="${option}" ${entry.roomType === option ? "selected" : ""}>${option}</option>`)
            .join("")}
        </select>
      </td>
      <td><input data-role="staffAssignment" data-id="${entry.id}" value="${escapeHtml(entry.staffAssignment || "")}" /></td>
      <td>
        <select data-role="status" data-id="${entry.id}">
          ${["pending", "confirmed", "cancelled", "rejected"]
            .map((option) => `<option value="${option}" ${entry.status === option ? "selected" : ""}>${option}</option>`)
            .join("")}
        </select>
      </td>
      <td><input data-role="deposit" data-id="${entry.id}" inputmode="numeric" value="${entry.deposit}" /></td>
      <td><input data-role="totalPayment" data-id="${entry.id}" inputmode="numeric" value="${entry.totalPayment}" /></td>
      <td><input data-role="balancePayment" data-id="${entry.id}" inputmode="numeric" value="${entry.balancePayment}" /></td>
      <td>
        <textarea data-role="notes" data-id="${entry.id}" rows="2">${escapeHtml(entry.notes || "")}</textarea>
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
      <td class="camp-row-actions">
        <button type="button" class="table-action" data-action="save" data-id="${entry.id}">Save</button>
        <button type="button" class="table-action secondary" data-action="cancel-edit">Cancel</button>
      </td>
    </tr>
  `;
}

function renderEntries(entries) {
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
            <th>#</th>
            <th>Trip</th>
            <th>Camp</th>
            <th>Clients</th>
            <th>Staff</th>
            <th>Check-in</th>
            <th>Check-out</th>
            <th>Nights</th>
            <th>Gers</th>
            <th>Room</th>
            <th>Assigned Staff</th>
            <th>Status</th>
            <th>Deposit</th>
            <th>Total</th>
            <th>Balance</th>
            <th>Notes / Meals</th>
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
  currentTrips = payload.entries;
  renderTrips(currentTrips);
  if (activeTripId && !getTripById(activeTripId)) {
    activeTripId = "";
  }
  renderActiveTrip();
}

async function loadReservations() {
  const payload = await fetchJson("/api/camp-reservations");
  currentEntries = payload.entries;
  renderActiveTrip();
  renderEntries(getFilteredEntries());
}

async function updateReservation(id) {
  const roles = [
    "campName",
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

tripForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  tripStatus.textContent = "Saving trip...";

  try {
    const result = await fetchJson("/api/camp-trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPayload(tripForm)),
    });
    tripStatus.textContent = `Trip created: ${result.entry.tripName}`;
    tripForm.reset();
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
    campStatus.textContent = "Please create or open a trip first.";
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
    campForm.createdDate.valueAsDate = new Date();
    campForm.clientCount.value = "2";
    campForm.staffCount.value = "0";
    campForm.gerCount.value = "1";
    campForm.nights.value = "1";
    reservationTripSelect.value = selectedTrip.id;
    campFormPanel.classList.add("is-hidden");
    await loadReservations();
  } catch (error) {
    campStatus.textContent = error.message;
  }
});

campToggleForm.addEventListener("click", () => {
  if (!activeTripId) {
    campStatus.textContent = "Open a trip first.";
    return;
  }
  reservationTripSelect.value = activeTripId;
  campFormPanel.classList.toggle("is-hidden");
});

tripList.addEventListener("click", (event) => {
  const button = event.target.closest('[data-action="open-trip"]');
  const card = event.target.closest("[data-trip-id]");
  const tripId = button?.dataset.tripId || card?.dataset.tripId;
  if (!tripId) {
    return;
  }
  setActiveTrip(tripId);
  tripStatus.textContent = `Opened trip: ${getTripById(tripId)?.tripName || ""}`;
});

campList.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) {
    return;
  }

  const action = target.dataset.action;
  if (action === "edit") {
    editingReservationId = target.dataset.id;
    renderEntries(getFilteredEntries());
    return;
  }
  if (action === "save") {
    updateReservation(target.dataset.id);
    return;
  }
  if (action === "cancel-edit") {
    editingReservationId = "";
    renderEntries(getFilteredEntries());
    return;
  }
  if (action === "page-prev") {
    currentPage = Math.max(1, currentPage - 1);
    renderEntries(getFilteredEntries());
    return;
  }
  if (action === "page-next") {
    const totalPages = Math.max(1, Math.ceil(getFilteredEntries().length / PAGE_SIZE));
    currentPage = Math.min(totalPages, currentPage + 1);
    renderEntries(getFilteredEntries());
  }
});

[filterCampName, filterTripName, filterStatus].forEach((node) => {
  node.addEventListener("input", () => {
    currentPage = 1;
    renderEntries(getFilteredEntries());
  });
  node.addEventListener("change", () => {
    currentPage = 1;
    renderEntries(getFilteredEntries());
  });
});

async function init() {
  campForm.createdDate.valueAsDate = new Date();
  await loadTrips();
  await loadReservations();
}

init();
