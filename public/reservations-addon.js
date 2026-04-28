(function () {
  const flightList = document.querySelector("#flight-list");
  const transferList = document.querySelector("#transfer-list");
  const flightPaymentList = document.querySelector("#flight-payment-list");
  const flightFormPanel = document.querySelector("#flight-form-panel");
  const transferFormPanel = document.querySelector("#transfer-form-panel");
  const flightPaymentFormPanel = document.querySelector("#flight-payment-form-panel");
  const flightForm = document.querySelector("#flight-form");
  const transferForm = document.querySelector("#transfer-form");
  const flightPaymentForm = document.querySelector("#flight-payment-form");
  const flightStatus = document.querySelector("#flight-status");
  const transferStatus = document.querySelector("#transfer-status");
  const flightPaymentStatus = document.querySelector("#flight-payment-status");
  const flightToggleForm = document.querySelector("#flight-toggle-form");
  const transferToggleForm = document.querySelector("#transfer-toggle-form");
  const flightPaymentToggleForm = document.querySelector("#flight-payment-toggle-form");
  const flightTripSelect = document.querySelector("#flight-trip-select");
  const transferTripSelect = document.querySelector("#transfer-trip-select");
  const flightPaymentSelect = document.querySelector("#flight-payment-select");
  const flightFilterTrip = document.querySelector("#flight-filter-trip");
  const flightFilterStatus = document.querySelector("#flight-filter-status");
  const flightFilterDate = document.querySelector("#flight-filter-date");
  const flightPaymentFilterTrip = document.querySelector("#flight-payment-filter-trip");
  const flightPaymentFilterStatus = document.querySelector("#flight-payment-filter-status");
  const transferFilterTrip = document.querySelector("#transfer-filter-trip");
  const transferFilterType = document.querySelector("#transfer-filter-type");
  const transferFilterStatus = document.querySelector("#transfer-filter-status");
  const transferFilterDriver = document.querySelector("#transfer-filter-driver");
  const transferFilterDate = document.querySelector("#transfer-filter-date");

  if (!flightList || !transferList || !flightPaymentList || !flightForm || !transferForm || !flightPaymentForm) {
    return;
  }

  let trips = [];
  let flights = [];
  let transfers = [];
  let editingFlightId = "";
  let editingTransferId = "";
  let editingFlightPaymentId = "";

  function hoistModalPanelsToBody(panels) {
    panels.forEach((panel) => {
      if (!panel || panel.parentElement === document.body) {
        return;
      }
      document.body.appendChild(panel);
    });
  }

  hoistModalPanelsToBody([flightFormPanel, transferFormPanel, flightPaymentFormPanel]);

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
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(response.ok ? "Server returned an unexpected response." : "Request failed. Please refresh and try again.");
    }
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

  function formatMoney(value) {
    const amount = Number(value || 0);
    if (!amount) {
      return "-";
    }
    return `₮${new Intl.NumberFormat("en-US").format(amount)}`;
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

  function getFlight(flightId) {
    return flights.find((flight) => flight.id === flightId) || null;
  }

  function renderTripOptions(selectedValue = "", placeholder = "Choose trip") {
    return [
      `<option value="">${placeholder}</option>`,
      ...trips.map(
        (trip) =>
          `<option value="${escapeHtml(trip.id)}" ${trip.id === selectedValue ? "selected" : ""}>${escapeHtml(trip.tripName)}</option>`
      ),
    ].join("");
  }

  function renderFlightOptions(selectedValue = "") {
    return [
      '<option value="">Choose flight</option>',
      ...flights.map((flight) => {
        const route = [flight.fromCity, flight.toCity].filter(Boolean).join(" → ");
        const label = [flight.tripName, route].filter(Boolean).join(" - ");
        return `<option value="${escapeHtml(flight.id)}" ${flight.id === selectedValue ? "selected" : ""}>${escapeHtml(label)}</option>`;
      }),
    ].join("");
  }

  function refreshTripSelectors() {
    const currentFlightFilter = flightFilterTrip.value;
    const currentFlightPaymentFilter = flightPaymentFilterTrip.value;
    const currentTransferFilter = transferFilterTrip.value;
    const currentTransferDriver = transferFilterDriver ? transferFilterDriver.value : "";
    const currentFlightFormTrip = flightTripSelect.value;
    const currentTransferFormTrip = transferTripSelect.value;

    flightTripSelect.innerHTML = renderTripOptions(currentFlightFormTrip);
    transferTripSelect.innerHTML = renderTripOptions(currentTransferFormTrip);
    flightFilterTrip.innerHTML = `<option value="">All trips</option>${trips
      .map((trip) => `<option value="${escapeHtml(trip.id)}">${escapeHtml(trip.tripName)}</option>`)
      .join("")}`;
    flightPaymentFilterTrip.innerHTML = `<option value="">All trips</option>${trips
      .map((trip) => `<option value="${escapeHtml(trip.id)}">${escapeHtml(trip.tripName)}</option>`)
      .join("")}`;
    transferFilterTrip.innerHTML = `<option value="">All trips</option>${trips
      .map((trip) => `<option value="${escapeHtml(trip.id)}">${escapeHtml(trip.tripName)}</option>`)
      .join("")}`;

    flightFilterTrip.value = currentFlightFilter;
    flightPaymentFilterTrip.value = currentFlightPaymentFilter;
    transferFilterTrip.value = currentTransferFilter;
    if (transferFilterDriver) {
      transferFilterDriver.value = currentTransferDriver;
    }
  }

  function refreshFlightPaymentSelector(selectedValue = "") {
    flightPaymentSelect.innerHTML = renderFlightOptions(selectedValue);
  }

  function openPanel(panel) {
    if (!panel) {
      return;
    }
    if (panel.parentElement !== document.body) {
      document.body.appendChild(panel);
    }
    panel.classList.remove("is-hidden");
    document.body.classList.add("modal-open");
    const dialog = panel.querySelector(".camp-modal-dialog");
    const form = panel.querySelector("form");
    requestAnimationFrame(() => {
      if (panel) {
        panel.scrollTop = 0;
      }
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

  function syncFlightTripDefaults(tripId, force = false) {
    const trip = getTrip(tripId);
    const staffNode = flightForm.elements.staffCount;
    if (!trip || !staffNode) {
      return;
    }
    if (force || !String(staffNode.value || "").trim()) {
      staffNode.value = String(trip.staffCount || 0);
    }
  }

  function ensureDefaultTrip(tripSelect) {
    if (!trips.length || tripSelect.value) {
      return;
    }
    // On the trip-detail page, the URL carries the trip id. Use it so a
    // flight/transfer added from a chosen trip is auto-scoped, instead of
    // defaulting to whichever trip happens to be first in the list.
    let preferredId = "";
    if (window.location.pathname === "/trip-detail") {
      try { preferredId = new URLSearchParams(window.location.search).get("tripId") || ""; } catch {}
    }
    const fallback = trips.find((t) => t.id === preferredId) ? preferredId : trips[0].id;
    tripSelect.value = fallback;
    if (tripSelect === flightTripSelect) {
      syncFlightTripDefaults(tripSelect.value, true);
    }
  }

  function ensureDefaultFlightSelection() {
    if (!flights.length || flightPaymentSelect.value) {
      return;
    }
    flightPaymentSelect.value = flights[0].id;
  }

  function getFilteredFlights() {
    return flights
      .filter((entry) => (!flightFilterTrip.value || entry.tripId === flightFilterTrip.value))
      .filter((entry) => (!flightFilterStatus.value || (entry.touristTicketStatus || "waiting_list") === flightFilterStatus.value))
      .filter((entry) => (!flightFilterDate.value || entry.departureDate === flightFilterDate.value))
      .sort((left, right) => String(left.departureDate || "").localeCompare(String(right.departureDate || "")));
  }

  function getFilteredFlightPayments() {
    return flights
      .filter((entry) => (!flightPaymentFilterTrip.value || entry.tripId === flightPaymentFilterTrip.value))
      .filter((entry) => (!flightPaymentFilterStatus.value || (entry.paymentStatus || "unpaid") === flightPaymentFilterStatus.value))
      .sort((left, right) => String(left.departureDate || "").localeCompare(String(right.departureDate || "")));
  }

  function getFilteredTransfers() {
    return transfers
      .filter((entry) => (!transferFilterTrip.value || entry.tripId === transferFilterTrip.value))
      .filter((entry) => (!transferFilterType?.value || entry.transferType === transferFilterType.value))
      .filter((entry) => (!transferFilterStatus?.value || entry.paymentStatus === transferFilterStatus.value))
      .filter((entry) => !transferFilterDriver?.value || String(entry.driverName || "").toLowerCase().includes(transferFilterDriver.value.trim().toLowerCase()))
      .filter((entry) => (!transferFilterDate.value || entry.serviceDate === transferFilterDate.value))
      .sort((left, right) => String(left.serviceDate || "").localeCompare(String(right.serviceDate || "")));
  }

  function applyQueryFilters() {
    const params = new URLSearchParams(window.location.search);
    const tripId = params.get("tripId");
    if (!tripId) {
      return;
    }
    if (flightFilterTrip) {
      flightFilterTrip.value = tripId;
    }
    if (flightPaymentFilterTrip) {
      flightPaymentFilterTrip.value = tripId;
    }
    if (transferFilterTrip) {
      transferFilterTrip.value = tripId;
    }
  }

  function renderFlights() {
    const rows = getFilteredFlights();
    if (!rows.length) {
      flightList.innerHTML = '<p class="empty">No flight reservations found for the selected filters.</p>';
      return;
    }

    flightList.innerHTML = `
      <div class="camp-table-wrap">
        <table class="camp-table reservation-addon-table flight-reservation-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Trip</th>
              <th>Route</th>
              <th>Airline</th>
              <th>Departure</th>
              <th>Arrival</th>
              <th>Pax</th>
              <th>Staff</th>
              <th>Tourist Ticket</th>
              <th>Guide Ticket</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (entry, index) => `
                  <tr>
                    <td class="table-center">${index + 1}</td>
                    <td><a href="/trip-detail?tripId=${encodeURIComponent(entry.tripId)}" class="trip-name-link">${escapeHtml(entry.tripName)}</a></td>
                    <td>${escapeHtml([entry.fromCity, entry.toCity].filter(Boolean).join(" → ") || "-")}</td>
                    <td>${escapeHtml(entry.airline || "-")}</td>
                    <td>${escapeHtml(`${formatDate(entry.departureDate)} ${entry.departureTime || ""}`.trim())}</td>
                    <td>${escapeHtml(`${formatDate(entry.arrivalDate)} ${entry.arrivalTime || ""}`.trim() || "-")}</td>
                    <td class="table-center">${escapeHtml(entry.passengerCount || "-")}</td>
                    <td class="table-center">${escapeHtml(entry.staffCount || "-")}</td>
                    <td><span class="status-pill is-${escapeHtml(entry.touristTicketStatus || "pending")}">${escapeHtml(formatStatus(entry.touristTicketStatus || "pending"))}</span></td>
                    <td><span class="status-pill is-${escapeHtml(entry.guideTicketStatus || "pending")}">${escapeHtml(formatStatus(entry.guideTicketStatus || "pending"))}</span></td>
                    <td>
                      <details class="trip-menu row-action-menu">
                        <summary class="trip-menu-trigger" aria-label="Flight reservation actions">⋯</summary>
                        <div class="trip-menu-popover">
                          <button type="button" class="trip-menu-item" data-action="edit-flight" data-id="${escapeHtml(entry.id)}">Edit</button>
                          <button type="button" class="trip-menu-item is-danger" data-action="delete-flight" data-id="${escapeHtml(entry.id)}">Delete</button>
                        </div>
                      </details>
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

  function renderFlightPayments() {
    const rows = getFilteredFlightPayments();
    if (!rows.length) {
      flightPaymentList.innerHTML = '<p class="empty">No flight payments found for the selected filters.</p>';
      return;
    }

    flightPaymentList.innerHTML = `
      <div class="camp-table-wrap">
        <table class="camp-table reservation-addon-table flight-payment-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Trip</th>
              <th>Route</th>
              <th>Ticket Price</th>
              <th>Total Ticket Price</th>
              <th>Payment</th>
              <th>Paid To</th>
              <th>Paid From</th>
              <th>Paid Date</th>
              <th>Notes</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (entry, index) => `
                  <tr>
                    <td class="table-center">${index + 1}</td>
                    <td><a href="/trip-detail?tripId=${encodeURIComponent(entry.tripId)}" class="trip-name-link">${escapeHtml(entry.tripName)}</a></td>
                    <td>${escapeHtml([entry.fromCity, entry.toCity].filter(Boolean).join(" → ") || "-")}</td>
                    <td class="table-right">${escapeHtml(formatMoney(entry.ticketPrice))}</td>
                    <td class="table-right">${escapeHtml(formatMoney(entry.totalTicketPrice || entry.amount))}</td>
                    <td><span class="status-pill is-${escapeHtml(entry.paymentStatus || "unpaid")}">${escapeHtml(formatStatus(entry.paymentStatus || "unpaid"))}</span></td>
                    <td>${escapeHtml(entry.paidTo || "-")}</td>
                    <td>${escapeHtml(entry.paidFromAccount || "-")}</td>
                    <td>${escapeHtml(formatDate(entry.paidDate))}</td>
                    <td>${escapeHtml(entry.paymentNotes || "-")}</td>
                    <td>
                      <div class="trip-row-actions payment-row-actions">
                        <button type="button" class="table-action compact secondary" data-action="edit-flight-payment" data-id="${escapeHtml(entry.id)}">Edit</button>
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
        <table class="camp-table reservation-addon-table transfer-reservation-table">
          <colgroup>
            <col class="transfer-col-index" />
            <col class="transfer-col-trip" />
            <col class="transfer-col-type" />
            <col class="transfer-col-pickup" />
            <col class="transfer-col-dropoff" />
            <col class="transfer-col-date" />
            <col class="transfer-col-pax" />
            <col class="transfer-col-driver" />
            <col class="transfer-col-vehicle" />
            <col class="transfer-col-salary" />
            <col class="transfer-col-payment" />
            <col class="transfer-col-notes" />
            <col class="transfer-col-actions" />
          </colgroup>
          <thead>
            <tr>
              <th>#</th>
              <th>Trip</th>
              <th>Transfer Type</th>
              <th>Pickup</th>
              <th>Dropoff</th>
              <th>Date / Time</th>
              <th>Pax</th>
              <th>Driver</th>
              <th>Vehicle</th>
              <th>Driver Salary</th>
              <th>Payment</th>
              <th>Notes</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (entry, index) => `
                  <tr>
                    <td class="table-center">${index + 1}</td>
                    <td><a href="/trip-detail?tripId=${encodeURIComponent(entry.tripId)}" class="trip-name-link">${escapeHtml(entry.tripName)}</a></td>
                    <td>${escapeHtml(formatStatus(entry.transferType))}</td>
                    <td>${escapeHtml(entry.pickupLocation)}</td>
                    <td>${escapeHtml(entry.dropoffLocation)}</td>
                    <td>${escapeHtml(`${formatDate(entry.serviceDate)} ${entry.serviceTime || ""}`.trim())}</td>
                    <td class="table-center">${escapeHtml(entry.passengerCount || "-")}</td>
                    <td>${escapeHtml(entry.driverName || "-")}</td>
                    <td>${escapeHtml(entry.vehicleType || "-")}</td>
                    <td class="table-right">${escapeHtml(formatMoney(entry.driverSalary || entry.amount))}</td>
                    <td><span class="status-pill is-${escapeHtml(entry.paymentStatus)}">${escapeHtml(formatStatus(entry.paymentStatus))}</span></td>
                    <td>${escapeHtml(entry.notes || "-")}</td>
                    <td>
                      <details class="trip-menu row-action-menu">
                        <summary class="trip-menu-trigger" aria-label="Transfer reservation actions">⋯</summary>
                        <div class="trip-menu-popover">
                          <button type="button" class="trip-menu-item" data-action="edit-transfer" data-id="${escapeHtml(entry.id)}">Edit</button>
                          <button type="button" class="trip-menu-item is-danger" data-action="delete-transfer" data-id="${escapeHtml(entry.id)}">Delete</button>
                        </div>
                      </details>
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
    applyQueryFilters();
  }

  async function loadFlights() {
    const payload = await fetchJson("/api/flight-reservations");
    flights = payload.entries || [];
    refreshFlightPaymentSelector(flightPaymentSelect.value);
    renderFlights();
    renderFlightPayments();
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
    flightForm.elements.staffCount.value = "0";
    flightForm.elements.ticketPrice.value = "0";
    flightForm.elements.totalTicketPrice.value = "0";
    flightForm.elements.requested.value = "no";
    flightForm.elements.touristTicketStatus.value = "pending";
    flightForm.elements.guideTicketStatus.value = "pending";
    flightStatus.textContent = "";
    refreshTripSelectors();
    ensureDefaultTrip(flightTripSelect);
  }

  function resetFlightPaymentForm() {
    editingFlightPaymentId = "";
    flightPaymentForm.reset();
    flightPaymentForm.elements.paymentStatus.value = "unpaid";
    flightPaymentStatus.textContent = "";
    refreshFlightPaymentSelector();
    ensureDefaultFlightSelection();
  }

  function resetTransferForm() {
    editingTransferId = "";
    transferForm.reset();
    transferForm.elements.passengerCount.value = "1";
    transferForm.elements.driverSalary.value = "0";
    transferForm.elements.paymentStatus.value = "unpaid";
    transferStatus.textContent = "";
    refreshTripSelectors();
    ensureDefaultTrip(transferTripSelect);
  }

  function fillFlightForm(entry) {
    editingFlightId = entry.id;
    Object.entries(entry).forEach(([key, value]) => {
      if (flightForm.elements[key]) {
        flightForm.elements[key].value = value || "";
      }
    });
  }

  function fillFlightPaymentForm(entry) {
    editingFlightPaymentId = entry.id;
    resetFlightPaymentForm();
    flightPaymentForm.elements.id.value = entry.id || "";
    flightPaymentForm.elements.flightId.value = entry.id || "";
    flightPaymentForm.elements.paymentStatus.value = entry.paymentStatus || "unpaid";
    flightPaymentForm.elements.paidTo.value = entry.paidTo || "";
    flightPaymentForm.elements.paidFromAccount.value = entry.paidFromAccount || "";
    flightPaymentForm.elements.paidDate.value = entry.paidDate || "";
    flightPaymentForm.elements.paymentNotes.value = entry.paymentNotes || "";
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

  flightPaymentToggleForm?.addEventListener("click", async () => {
    await loadTrips();
    await loadFlights();
    resetFlightPaymentForm();
    openPanel(flightPaymentFormPanel);
  });

  transferToggleForm?.addEventListener("click", async () => {
    await loadTrips();
    resetTransferForm();
    openPanel(transferFormPanel);
  });

  flightTripSelect?.addEventListener("change", () => {
    syncFlightTripDefaults(flightTripSelect.value);
  });

  [flightFilterTrip, flightFilterStatus, flightFilterDate].forEach((node) => {
    node?.addEventListener("input", renderFlights);
    node?.addEventListener("change", renderFlights);
  });

  [flightPaymentFilterTrip, flightPaymentFilterStatus].forEach((node) => {
    node?.addEventListener("input", renderFlightPayments);
    node?.addEventListener("change", renderFlightPayments);
  });

  [transferFilterTrip, transferFilterType, transferFilterStatus, transferFilterDriver, transferFilterDate].forEach((node) => {
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
    payload.currency = "MNT";
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

  flightPaymentForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = buildPayload(flightPaymentForm);
    const flight = getFlight(payload.flightId);
    if (!flight) {
      flightPaymentStatus.textContent = "Please select a flight reservation first.";
      return;
    }

    flightPaymentStatus.textContent = "Saving flight payment...";
    try {
      await fetchJson(`/api/flight-reservations/${flight.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentStatus: payload.paymentStatus,
          paidTo: payload.paidTo,
          paidFromAccount: payload.paidFromAccount,
          paidDate: payload.paidDate,
          paymentNotes: payload.paymentNotes,
        }),
      });
      closePanel(flightPaymentFormPanel);
      await loadFlights();
      resetFlightPaymentForm();
    } catch (error) {
      flightPaymentStatus.textContent = error.message;
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
    payload.currency = "MNT";
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
    if (target.closest(".trip-menu")) {
      closeOpenTripMenus();
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
    if (target.dataset.action === "delete-flight") {
      if (!(await UI.confirm("Delete this flight reservation?", { dangerous: true }))) return;
      try {
        await fetchJson(`/api/flight-reservations/${entry.id}`, { method: "DELETE" });
        await loadFlights();
      } catch (error) {
        flightStatus.textContent = error.message;
      }
    }
  });

  flightPaymentList.addEventListener("click", async (event) => {
    const target = event.target.closest("[data-action]");
    if (!target) {
      return;
    }
    if (target.closest(".trip-menu")) {
      closeOpenTripMenus();
    }
    const entry = flights.find((item) => item.id === target.dataset.id);
    if (!entry) {
      return;
    }
    if (target.dataset.action === "edit-flight-payment") {
      await loadTrips();
      await loadFlights();
      fillFlightPaymentForm(entry);
      openPanel(flightPaymentFormPanel);
    }
  });

  transferList.addEventListener("click", async (event) => {
    const target = event.target.closest("[data-action]");
    if (!target) {
      return;
    }
    if (target.closest(".trip-menu")) {
      closeOpenTripMenus();
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
    if (target.dataset.action === "delete-transfer") {
      if (!(await UI.confirm("Delete this transfer?", { dangerous: true }))) return;
      try {
        await fetchJson(`/api/transfer-reservations/${entry.id}`, { method: "DELETE" });
        await loadTransfers();
      } catch (error) {
        transferStatus.textContent = error.message;
      }
    }
  });

  document.addEventListener("click", (event) => {
    const clickedMenu = event.target.closest(".trip-menu");
    if (!clickedMenu) {
      closeOpenTripMenus();
    }
    const target = event.target.closest("[data-action]");
    if (!target) {
      return;
    }
    if (target.dataset.action === "close-flight-modal") {
      closePanel(flightFormPanel);
      resetFlightForm();
    }
    if (target.dataset.action === "close-flight-payment-modal") {
      closePanel(flightPaymentFormPanel);
      resetFlightPaymentForm();
    }
    if (target.dataset.action === "close-transfer-modal") {
      closePanel(transferFormPanel);
      resetTransferForm();
    }
  });

  Promise.all([loadTrips(), loadFlights(), loadTransfers()])
    .then(() => {
      renderFlights();
      renderFlightPayments();
      renderTransfers();
    })
    .catch((error) => {
      if (flightStatus) {
        flightStatus.textContent = error.message;
      }
      if (flightPaymentStatus) {
        flightPaymentStatus.textContent = error.message;
      }
      if (transferStatus) {
        transferStatus.textContent = error.message;
      }
    });
})();
