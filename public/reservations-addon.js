(function () {
  const flightList = document.querySelector("#flight-list");
  const transferList = document.querySelector("#transfer-list");
  const flightFormPanel = document.querySelector("#flight-form-panel");
  const transferFormPanel = document.querySelector("#transfer-form-panel");
  const flightForm = document.querySelector("#flight-form");
  const transferForm = document.querySelector("#transfer-form");
  const flightStatus = document.querySelector("#flight-status");
  const transferStatus = document.querySelector("#transfer-status");
  const flightToggleForm = document.querySelector("#flight-toggle-form");
  const transferToggleForm = document.querySelector("#transfer-toggle-form");
  const flightTripSelect = document.querySelector("#flight-trip-select");
  const transferTripSelect = document.querySelector("#transfer-trip-select");
  const flightFilterTrip = document.querySelector("#flight-filter-trip");
  const flightFilterScope = document.querySelector("#flight-filter-scope");
  const flightFilterStatus = document.querySelector("#flight-filter-status");
  const flightFilterDate = document.querySelector("#flight-filter-date");
  const transferFilterTrip = document.querySelector("#transfer-filter-trip");
  const transferFilterType = document.querySelector("#transfer-filter-type");
  const transferFilterStatus = document.querySelector("#transfer-filter-status");
  const transferFilterDate = document.querySelector("#transfer-filter-date");

  if (!flightList || !transferList || !flightForm || !transferForm) {
    return;
  }

  let trips = [];
  let flights = [];
  let transfers = [];
  let editingFlightId = "";
  let editingTransferId = "";

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  async function fetchJson(url, options) {
    const response = await fetch(url, options);
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    if (!response.ok) {
      throw new Error(data.error || "Request failed");
    }
    return data;
  }

  function buildPayload(formNode) {
    return Object.fromEntries(new FormData(formNode).entries());
  }

  function formatDate(value) {
    return value || "-";
  }

  function formatMoney(value, currency) {
    const amount = Number(value || 0);
    if (!amount) {
      return "-";
    }
    return `${new Intl.NumberFormat("en-US").format(amount)} ${currency || ""}`.trim();
  }

  function formatStatus(status) {
    return (
      String(status || "")
        .replaceAll("_", " ")
        .replace(/\b\w/g, (match) => match.toUpperCase()) || "-"
    );
  }

  function getTrip(tripId) {
    return trips.find((trip) => trip.id === tripId) || null;
  }

  function renderTripOptions(selectedValue = "") {
    return [
      '<option value="">Choose trip</option>',
      ...trips.map(
        (trip) =>
          `<option value="${escapeHtml(trip.id)}" ${trip.id === selectedValue ? "selected" : ""}>${escapeHtml(trip.tripName)}</option>`
      ),
    ].join("");
  }

  function syncReservationName(formNode, tripId, force = false) {
    const trip = getTrip(tripId);
    if (!trip) {
      return;
    }
    const nameNode = formNode.querySelector('[name="reservationName"]');
    if (nameNode && (force || !nameNode.value.trim())) {
      nameNode.value = trip.reservationName || trip.tripName || "";
    }
  }

  function refreshTripSelectors() {
    const currentFlightFilter = flightFilterTrip.value;
    const currentTransferFilter = transferFilterTrip.value;
    const currentFlightFormTrip = flightTripSelect.value;
    const currentTransferFormTrip = transferTripSelect.value;

    flightTripSelect.innerHTML = renderTripOptions(currentFlightFormTrip);
    transferTripSelect.innerHTML = renderTripOptions(currentTransferFormTrip);
    flightFilterTrip.innerHTML = `<option value="">All trips</option>${trips
      .map((trip) => `<option value="${escapeHtml(trip.id)}">${escapeHtml(trip.tripName)}</option>`)
      .join("")}`;
    transferFilterTrip.innerHTML = `<option value="">All trips</option>${trips
      .map((trip) => `<option value="${escapeHtml(trip.id)}">${escapeHtml(trip.tripName)}</option>`)
      .join("")}`;

    flightFilterTrip.value = currentFlightFilter;
    transferFilterTrip.value = currentTransferFilter;
  }

  function openPanel(panel) {
    panel.classList.remove("is-hidden");
    document.body.classList.add("modal-open");
    const dialog = panel.querySelector(".camp-modal-dialog");
    const form = panel.querySelector("form");
    requestAnimationFrame(() => {
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
    if (
      flightFormPanel.classList.contains("is-hidden") &&
      transferFormPanel.classList.contains("is-hidden") &&
      document.querySelectorAll(".camp-modal:not(.is-hidden)").length === 0
    ) {
      document.body.classList.remove("modal-open");
    }
  }

  function ensureDefaultTrip(formNode, tripSelect) {
    if (!trips.length) {
      return;
    }
    if (!tripSelect.value) {
      tripSelect.value = trips[0].id;
    }
    syncReservationName(formNode, tripSelect.value, true);
  }

  function getFilteredFlights() {
    return flights
      .filter((entry) => (!flightFilterTrip.value || entry.tripId === flightFilterTrip.value))
      .filter((entry) => (!flightFilterScope.value || entry.flightScope === flightFilterScope.value))
      .filter((entry) => (!flightFilterStatus.value || entry.status === flightFilterStatus.value))
      .filter((entry) => (!flightFilterDate.value || entry.departureDate === flightFilterDate.value))
      .sort((left, right) => String(left.departureDate || "").localeCompare(String(right.departureDate || "")));
  }

  function getFilteredTransfers() {
    return transfers
      .filter((entry) => (!transferFilterTrip.value || entry.tripId === transferFilterTrip.value))
      .filter((entry) => (!transferFilterType.value || entry.transferType === transferFilterType.value))
      .filter((entry) => (!transferFilterStatus.value || entry.status === transferFilterStatus.value))
      .filter((entry) => (!transferFilterDate.value || entry.serviceDate === transferFilterDate.value))
      .sort((left, right) => String(left.serviceDate || "").localeCompare(String(right.serviceDate || "")));
  }

  function renderFlights() {
    const rows = getFilteredFlights();
    if (!rows.length) {
      flightList.innerHTML = '<p class="empty">No flight reservations found for the selected filters.</p>';
      return;
    }
    flightList.innerHTML = `
      <div class="camp-table-wrap">
        <table class="camp-table reservation-addon-table">
          <thead>
            <tr>
              <th>Trip</th>
              <th>Reservation Name</th>
              <th>Type</th>
              <th>Route</th>
              <th>Airline / No</th>
              <th>Departure</th>
              <th>Arrival</th>
              <th>PNR</th>
              <th>Pax</th>
              <th>Status</th>
              <th>Bought</th>
              <th>Payment</th>
              <th>Amount</th>
              <th>Notes</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (entry) => `
                  <tr>
                    <td>${escapeHtml(entry.tripName)}</td>
                    <td>${escapeHtml(entry.reservationName || entry.tripName)}</td>
                    <td>${escapeHtml(formatStatus(entry.flightScope))}</td>
                    <td>${escapeHtml([entry.fromCity, entry.toCity].filter(Boolean).join(" → "))}</td>
                    <td>${escapeHtml([entry.airline, entry.flightNumber].filter(Boolean).join(" / ") || "-")}</td>
                    <td>${escapeHtml(`${formatDate(entry.departureDate)} ${entry.departureTime || ""}`.trim())}</td>
                    <td>${escapeHtml(`${formatDate(entry.arrivalDate)} ${entry.arrivalTime || ""}`.trim() || "-")}</td>
                    <td>${escapeHtml(entry.bookingReference || "-")}</td>
                    <td>${escapeHtml(entry.passengerCount || "-")}</td>
                    <td><span class="status-pill is-${escapeHtml(entry.status)}">${escapeHtml(formatStatus(entry.status))}</span></td>
                    <td>${escapeHtml(formatDate(entry.boughtDate))}</td>
                    <td><span class="status-pill is-${escapeHtml(entry.paymentStatus)}">${escapeHtml(formatStatus(entry.paymentStatus))}</span></td>
                    <td>${escapeHtml(formatMoney(entry.amount, entry.currency))}</td>
                    <td>${escapeHtml(entry.notes || "-")}</td>
                    <td>
                      <div class="trip-row-actions payment-row-actions">
                        <button type="button" class="table-action compact secondary" data-action="edit-flight" data-id="${escapeHtml(entry.id)}">Edit</button>
                        <button type="button" class="table-action compact danger" data-action="delete-flight" data-id="${escapeHtml(entry.id)}">Delete</button>
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

  function renderTransfers() {
    const rows = getFilteredTransfers();
    if (!rows.length) {
      transferList.innerHTML = '<p class="empty">No transfers found for the selected filters.</p>';
      return;
    }
    transferList.innerHTML = `
      <div class="camp-table-wrap">
        <table class="camp-table reservation-addon-table">
          <thead>
            <tr>
              <th>Trip</th>
              <th>Reservation Name</th>
              <th>Transfer Type</th>
              <th>Pickup</th>
              <th>Dropoff</th>
              <th>Date / Time</th>
              <th>Supplier</th>
              <th>Driver</th>
              <th>Vehicle</th>
              <th>Pax</th>
              <th>Status</th>
              <th>Payment</th>
              <th>Amount</th>
              <th>Notes</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (entry) => `
                  <tr>
                    <td>${escapeHtml(entry.tripName)}</td>
                    <td>${escapeHtml(entry.reservationName || entry.tripName)}</td>
                    <td>${escapeHtml(formatStatus(entry.transferType))}</td>
                    <td>${escapeHtml(entry.pickupLocation)}</td>
                    <td>${escapeHtml(entry.dropoffLocation)}</td>
                    <td>${escapeHtml(`${formatDate(entry.serviceDate)} ${entry.serviceTime || ""}`.trim())}</td>
                    <td>${escapeHtml(entry.supplierName || "-")}</td>
                    <td>${escapeHtml(entry.driverName || "-")}</td>
                    <td>${escapeHtml(entry.vehicleType || "-")}</td>
                    <td>${escapeHtml(entry.passengerCount || "-")}</td>
                    <td><span class="status-pill is-${escapeHtml(entry.status)}">${escapeHtml(formatStatus(entry.status))}</span></td>
                    <td><span class="status-pill is-${escapeHtml(entry.paymentStatus)}">${escapeHtml(formatStatus(entry.paymentStatus))}</span></td>
                    <td>${escapeHtml(formatMoney(entry.amount, entry.currency))}</td>
                    <td>${escapeHtml(entry.notes || "-")}</td>
                    <td>
                      <div class="trip-row-actions payment-row-actions">
                        <button type="button" class="table-action compact secondary" data-action="edit-transfer" data-id="${escapeHtml(entry.id)}">Edit</button>
                        <button type="button" class="table-action compact danger" data-action="delete-transfer" data-id="${escapeHtml(entry.id)}">Delete</button>
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

  async function loadTrips() {
    const payload = await fetchJson("/api/camp-trips");
    trips = payload.entries || [];
    refreshTripSelectors();
  }

  async function loadFlights() {
    const payload = await fetchJson("/api/flight-reservations");
    flights = payload.entries || [];
    renderFlights();
  }

  async function loadTransfers() {
    const payload = await fetchJson("/api/transfer-reservations");
    transfers = payload.entries || [];
    renderTransfers();
  }

  function resetFlightForm() {
    editingFlightId = "";
    flightForm.reset();
    flightForm.elements.passengerCount.value = "1";
    flightForm.elements.amount.value = "0";
    flightForm.elements.currency.value = "USD";
    flightForm.elements.status.value = "to_check";
    flightForm.elements.paymentStatus.value = "unpaid";
    flightStatus.textContent = "";
    refreshTripSelectors();
    ensureDefaultTrip(flightForm, flightTripSelect);
  }

  function resetTransferForm() {
    editingTransferId = "";
    transferForm.reset();
    transferForm.elements.passengerCount.value = "1";
    transferForm.elements.amount.value = "0";
    transferForm.elements.currency.value = "USD";
    transferForm.elements.status.value = "pending";
    transferForm.elements.paymentStatus.value = "unpaid";
    transferStatus.textContent = "";
    refreshTripSelectors();
    ensureDefaultTrip(transferForm, transferTripSelect);
  }

  function fillFlightForm(entry) {
    editingFlightId = entry.id;
    Object.entries(entry).forEach(([key, value]) => {
      if (flightForm.elements[key]) {
        flightForm.elements[key].value = value || "";
      }
    });
  }

  function fillTransferForm(entry) {
    editingTransferId = entry.id;
    Object.entries(entry).forEach(([key, value]) => {
      if (transferForm.elements[key]) {
        transferForm.elements[key].value = value || "";
      }
    });
  }

  flightToggleForm?.addEventListener("click", async () => {
    await loadTrips();
    resetFlightForm();
    openPanel(flightFormPanel);
  });

  transferToggleForm?.addEventListener("click", async () => {
    await loadTrips();
    resetTransferForm();
    openPanel(transferFormPanel);
  });

  flightTripSelect?.addEventListener("change", () => syncReservationName(flightForm, flightTripSelect.value));
  transferTripSelect?.addEventListener("change", () => syncReservationName(transferForm, transferTripSelect.value));

  [flightFilterTrip, flightFilterScope, flightFilterStatus, flightFilterDate].forEach((node) => {
    node?.addEventListener("input", renderFlights);
    node?.addEventListener("change", renderFlights);
  });

  [transferFilterTrip, transferFilterType, transferFilterStatus, transferFilterDate].forEach((node) => {
    node?.addEventListener("input", renderTransfers);
    node?.addEventListener("change", renderTransfers);
  });

  flightForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    flightStatus.textContent = editingFlightId ? "Saving flight..." : "Creating flight...";
    const payload = buildPayload(flightForm);
    const trip = getTrip(payload.tripId);
    if (!trip) {
      flightStatus.textContent = "Please select a trip first.";
      return;
    }
    payload.tripName = trip.tripName;
    payload.reservationName = payload.reservationName || trip.reservationName || trip.tripName;
    try {
      await fetchJson(editingFlightId ? `/api/flight-reservations/${editingFlightId}` : "/api/flight-reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      closePanel(flightFormPanel);
      await loadFlights();
      resetFlightForm();
    } catch (error) {
      flightStatus.textContent = error.message;
    }
  });

  transferForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    transferStatus.textContent = editingTransferId ? "Saving transfer..." : "Creating transfer...";
    const payload = buildPayload(transferForm);
    const trip = getTrip(payload.tripId);
    if (!trip) {
      transferStatus.textContent = "Please select a trip first.";
      return;
    }
    payload.tripName = trip.tripName;
    payload.reservationName = payload.reservationName || trip.reservationName || trip.tripName;
    try {
      await fetchJson(editingTransferId ? `/api/transfer-reservations/${editingTransferId}` : "/api/transfer-reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      closePanel(transferFormPanel);
      await loadTransfers();
      resetTransferForm();
    } catch (error) {
      transferStatus.textContent = error.message;
    }
  });

  flightList.addEventListener("click", async (event) => {
    const target = event.target.closest("[data-action]");
    if (!target) {
      return;
    }
    const entry = flights.find((item) => item.id === target.dataset.id);
    if (!entry) {
      return;
    }
    if (target.dataset.action === "edit-flight") {
      await loadTrips();
      resetFlightForm();
      fillFlightForm(entry);
      openPanel(flightFormPanel);
      return;
    }
    if (target.dataset.action === "delete-flight" && window.confirm("Delete this flight reservation?")) {
      try {
        await fetchJson(`/api/flight-reservations/${entry.id}`, { method: "DELETE" });
        await loadFlights();
      } catch (error) {
        flightStatus.textContent = error.message;
      }
    }
  });

  transferList.addEventListener("click", async (event) => {
    const target = event.target.closest("[data-action]");
    if (!target) {
      return;
    }
    const entry = transfers.find((item) => item.id === target.dataset.id);
    if (!entry) {
      return;
    }
    if (target.dataset.action === "edit-transfer") {
      await loadTrips();
      resetTransferForm();
      fillTransferForm(entry);
      openPanel(transferFormPanel);
      return;
    }
    if (target.dataset.action === "delete-transfer" && window.confirm("Delete this transfer?")) {
      try {
        await fetchJson(`/api/transfer-reservations/${entry.id}`, { method: "DELETE" });
        await loadTransfers();
      } catch (error) {
        transferStatus.textContent = error.message;
      }
    }
  });

  document.addEventListener("click", (event) => {
    const target = event.target.closest("[data-action]");
    if (!target) {
      return;
    }
    if (target.dataset.action === "close-flight-modal") {
      closePanel(flightFormPanel);
      resetFlightForm();
    }
    if (target.dataset.action === "close-transfer-modal") {
      closePanel(transferFormPanel);
      resetTransferForm();
    }
  });

  Promise.all([loadTrips(), loadFlights(), loadTransfers()]).catch((error) => {
    if (flightStatus) {
      flightStatus.textContent = error.message;
    }
    if (transferStatus) {
      transferStatus.textContent = error.message;
    }
  });
})();
