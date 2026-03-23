const tripForm = document.querySelector("#trip-form");
const tripStatus = document.querySelector("#trip-status");
const tripList = document.querySelector("#trip-list");
const campForm = document.querySelector("#camp-form");
const campStatus = document.querySelector("#camp-status");
const campList = document.querySelector("#camp-list");
const campSummary = document.querySelector("#camp-summary");
const campToggleForm = document.querySelector("#camp-toggle-form");
const campFormPanel = document.querySelector("#camp-form-panel");
const reservationTripSelect = document.querySelector("#reservation-trip-select");
const filterCampName = document.querySelector("#filter-camp-name");
const filterTripName = document.querySelector("#filter-trip-name");
const filterStatus = document.querySelector("#filter-status");

let currentTrips = [];
let currentEntries = [];

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

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data;
}

function buildPayload(formNode) {
  return Object.fromEntries(new FormData(formNode).entries());
}

function renderSummary(summary) {
  const cards = [
    ["Reservations", summary.total],
    ["Trips", summary.trips],
    ["Confirmed", summary.confirmed],
    ["Pending", summary.pending],
    ["Cancelled", summary.cancelled],
    ["Rejected", summary.rejected],
  ];

  campSummary.innerHTML = cards
    .map(
      ([label, value]) => `
        <article class="camp-summary-card">
          <p>${label}</p>
          <strong>${value}</strong>
        </article>
      `
    )
    .join("");
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
        <article class="camp-trip-card ${reservationTripSelect.value === trip.id ? "is-active" : ""}" data-trip-id="${trip.id}">
          <strong>${escapeHtml(trip.tripName)}</strong>
          <span>${escapeHtml(trip.address || "No address")}</span>
        </article>
      `
    )
    .join("");

  reservationTripSelect.innerHTML = `
    <option value="">Select trip</option>
    ${trips.map((trip) => `<option value="${trip.id}">${escapeHtml(trip.tripName)}</option>`).join("")}
  `;

  filterTripName.innerHTML = `
    <option value="">All trips</option>
    ${trips.map((trip) => `<option value="${trip.id}">${escapeHtml(trip.tripName)}</option>`).join("")}
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

function renderEntries(entries) {
  if (!entries.length) {
    campList.innerHTML = '<p class="empty">No reservations for the selected filters.</p>';
    return;
  }

  campList.innerHTML = `
    <div class="camp-table-wrap">
      <table class="camp-table camp-table-editor">
        <thead>
          <tr>
            <th>#</th>
            <th>Trip</th>
            <th>Camp</th>
            <th>Clients</th>
            <th>Staff</th>
            <th>Assigned Staff</th>
            <th>Check-in</th>
            <th>Check-out</th>
            <th>Nights</th>
            <th>Gers</th>
            <th>Room</th>
            <th>Breakfast</th>
            <th>Lunch</th>
            <th>Dinner</th>
            <th>Deposit</th>
            <th>Total</th>
            <th>Balance</th>
            <th>Status</th>
            <th>Note</th>
            <th>PDF</th>
            <th>Save</th>
          </tr>
        </thead>
        <tbody>
          ${entries
            .map(
              (entry, index) => `
                <tr>
                  <td>${index + 1}</td>
                  <td>${escapeHtml(entry.tripName)}</td>
                  <td><input data-role="campName" data-id="${entry.id}" value="${escapeHtml(entry.campName)}" /></td>
                  <td><input data-role="clientCount" data-id="${entry.id}" type="number" min="1" value="${entry.clientCount}" /></td>
                  <td><input data-role="staffCount" data-id="${entry.id}" type="number" min="0" value="${entry.staffCount}" /></td>
                  <td><input data-role="staffAssignment" data-id="${entry.id}" value="${escapeHtml(entry.staffAssignment || "")}" /></td>
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
                  <td>
                    <select data-role="breakfast" data-id="${entry.id}">
                      <option value="No" ${entry.breakfast === "No" ? "selected" : ""}>No</option>
                      <option value="Yes" ${entry.breakfast === "Yes" ? "selected" : ""}>Yes</option>
                    </select>
                  </td>
                  <td>
                    <select data-role="lunch" data-id="${entry.id}">
                      <option value="No" ${entry.lunch === "No" ? "selected" : ""}>No</option>
                      <option value="Yes" ${entry.lunch === "Yes" ? "selected" : ""}>Yes</option>
                    </select>
                  </td>
                  <td>
                    <select data-role="dinner" data-id="${entry.id}">
                      <option value="No" ${entry.dinner === "No" ? "selected" : ""}>No</option>
                      <option value="Yes" ${entry.dinner === "Yes" ? "selected" : ""}>Yes</option>
                    </select>
                  </td>
                  <td><input data-role="deposit" data-id="${entry.id}" inputmode="numeric" value="${entry.deposit}" /></td>
                  <td><input data-role="totalPayment" data-id="${entry.id}" inputmode="numeric" value="${entry.totalPayment}" /></td>
                  <td><input data-role="balancePayment" data-id="${entry.id}" inputmode="numeric" value="${entry.balancePayment}" /></td>
                  <td>
                    <select data-role="status" data-id="${entry.id}">
                      ${["pending", "confirmed", "cancelled", "rejected"]
                        .map((option) => `<option value="${option}" ${entry.status === option ? "selected" : ""}>${option}</option>`)
                        .join("")}
                    </select>
                  </td>
                  <td><input data-role="notes" data-id="${entry.id}" value="${escapeHtml(entry.notes || "")}" /></td>
                  <td>
                    <a class="table-link" href="${entry.pdfPath}" download>PDF</a>
                  </td>
                  <td>
                    <button type="button" class="camp-update-button" data-action="update" data-id="${entry.id}">Save</button>
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

async function loadTrips() {
  const payload = await fetchJson("/api/camp-trips");
  currentTrips = payload.entries;
  renderTrips(currentTrips);
}

async function loadReservations() {
  const payload = await fetchJson("/api/camp-reservations");
  currentEntries = payload.entries;
  renderSummary(payload.summary);
  renderEntries(getFilteredEntries());
}

async function updateReservation(id) {
  const roles = ["campName", "clientCount", "staffCount", "staffAssignment", "checkIn", "checkOut", "nights", "gerCount", "roomType", "breakfast", "lunch", "dinner", "deposit", "totalPayment", "balancePayment", "status", "notes"];
  const payload = {};

  roles.forEach((role) => {
    const node = document.querySelector(`[data-role="${role}"][data-id="${id}"]`);
    payload[role] = node.value;
  });

  campStatus.textContent = "Updating...";

  try {
    await fetchJson(`/api/camp-reservations/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
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
    reservationTripSelect.value = result.entry.id;
    filterTripName.value = result.entry.id;
    renderEntries(getFilteredEntries());
  } catch (error) {
    tripStatus.textContent = error.message;
  }
});

campForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  campStatus.textContent = "Saving reservation...";

  const selectedTrip = currentTrips.find((trip) => trip.id === reservationTripSelect.value);
  if (!selectedTrip) {
    campStatus.textContent = "Please create or select a trip first.";
    return;
  }

  const payload = buildPayload(campForm);
  payload.tripName = selectedTrip.tripName;
  payload.address = selectedTrip.address;

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
  if (!currentTrips.length) {
    campStatus.textContent = "Create a trip first.";
    return;
  }
  campFormPanel.classList.toggle("is-hidden");
});

tripList.addEventListener("click", (event) => {
  const card = event.target.closest("[data-trip-id]");
  if (!card) {
    return;
  }
  reservationTripSelect.value = card.dataset.tripId;
  filterTripName.value = card.dataset.tripId;
  renderTrips(currentTrips);
  renderEntries(getFilteredEntries());
});

campList.addEventListener("click", (event) => {
  const button = event.target.closest('[data-action="update"]');
  if (!button) {
    return;
  }
  updateReservation(button.dataset.id);
});

[filterCampName, filterTripName, filterStatus].forEach((node) => {
  node.addEventListener("input", () => renderEntries(getFilteredEntries()));
  node.addEventListener("change", () => renderEntries(getFilteredEntries()));
});

async function init() {
  campForm.createdDate.valueAsDate = new Date();
  await loadTrips();
  await loadReservations();
}

init();
