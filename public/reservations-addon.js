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
  // Upgrade the form-side trip dropdowns into searchable pickers. Filters keep
  // their native <select> (they need the synthetic "All trips" option, which
  // the picker treats as no-value).
  if (window.TripPicker) {
    if (flightTripSelect) window.TripPicker.upgrade(flightTripSelect, { placeholder: "Choose trip…" });
    if (transferTripSelect) window.TripPicker.upgrade(transferTripSelect, { placeholder: "Choose trip…" });
  }
  const flightPaymentSelect = document.querySelector("#flight-payment-select");
  // Same searchable picker treatment for the flight-payment "Selected Flight"
  // dropdown so it stays usable when there are many flights.
  if (window.TripPicker && flightPaymentSelect) {
    window.TripPicker.upgrade(flightPaymentSelect, { placeholder: "Choose flight…" });
  }
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
    if (!trip) return;
    // Pull counts and the start date from the trip so a new flight reservation
    // pre-populates the same numbers the trip is already tracking. Only fills
    // empty fields unless force=true so an editing manager's typed values are
    // preserved.
    const setIfEmpty = (name, value) => {
      const node = flightForm.elements[name];
      if (!node || value == null || value === "") return;
      if (force || !String(node.value || "").trim()) {
        node.value = String(value);
      }
    };
    setIfEmpty("staffCount", trip.staffCount || 0);
    setIfEmpty("passengerCount", trip.participantCount || "");
    setIfEmpty("departureDate", trip.startDate || "");
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

  function paidByLabel(value) {
    const v = String(value || "").toLowerCase();
    if (v === "client") return "By Client";
    if (v === "usm") return "By USM";
    if (v === "dtx") return "By DTX";
    return "—";
  }
  function flightScopeLabel(value) {
    const v = String(value || "").toLowerCase();
    if (v === "international") return "International";
    if (v === "domestic") return "Domestic";
    return "—";
  }

  // For overnight flights — e.g. depart 23:44, arrive 05:00 next morning —
  // show the arrival as "05:00 +1" so the day rollover is obvious.
  function arrivalTimeWithDayOffset(entry) {
    const time = String(entry.arrivalTime || "").slice(0, 5);
    if (!time) return "-";
    const dep = String(entry.departureDate || "").slice(0, 10);
    const arr = String(entry.arrivalDate || "").slice(0, 10);
    if (!dep || !arr || dep === arr) return time;
    try {
      const d1 = new Date(`${dep}T00:00:00`);
      const d2 = new Date(`${arr}T00:00:00`);
      const days = Math.round((d2 - d1) / 86400000);
      if (days > 0) return `${time} +${days}`;
      if (days < 0) return `${time} ${days}`;
    } catch {}
    return time;
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
              <th data-trip-scope-hide>Trip</th>
              <th>Type</th>
              <th>Date</th>
              <th>Trip day</th>
              <th>From</th>
              <th>Departure Time</th>
              <th>To</th>
              <th>Arrival Time</th>
              <th>Pax</th>
              <th>Staff</th>
              <th>Tourist Ticket</th>
              <th>Paid by</th>
              <th>Guide Ticket</th>
              <th>Paid by</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (entry, index) => `
                  <tr>
                    <td class="table-center">${index + 1}</td>
                    <td data-trip-scope-hide><a href="/trip-detail?tripId=${encodeURIComponent(entry.tripId)}" class="trip-name-link">${escapeHtml(entry.tripName)}</a></td>
                    <td>${escapeHtml(flightScopeLabel(entry.flightScope))}</td>
                    <td class="table-nowrap">${escapeHtml(formatDate(entry.departureDate) || "-")}</td>
                    <td class="table-nowrap">${escapeHtml(entry.tripDay || "-")}</td>
                    <td>${escapeHtml(entry.fromCity || "-")}</td>
                    <td class="table-nowrap">${escapeHtml(entry.departureTime || "-")}</td>
                    <td>${escapeHtml(entry.toCity || "-")}</td>
                    <td class="table-nowrap">${escapeHtml(arrivalTimeWithDayOffset(entry))}</td>
                    <td class="table-center">${escapeHtml(entry.passengerCount || "-")}</td>
                    <td class="table-center">${escapeHtml(entry.staffCount || "-")}</td>
                    <td><span class="status-pill is-${escapeHtml(entry.touristTicketStatus || "pending")}">${escapeHtml(formatStatus(entry.touristTicketStatus || "pending"))}</span></td>
                    <td>${escapeHtml(paidByLabel(entry.touristPaidBy))}</td>
                    <td><span class="status-pill is-${escapeHtml(entry.guideTicketStatus || "pending")}">${escapeHtml(formatStatus(entry.guideTicketStatus || "pending"))}</span></td>
                    <td>${escapeHtml(paidByLabel(entry.guidePaidBy))}</td>
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
    // Flight payments only track money the agency itself pays out. So a row
    // appears here only if at least one of the linked reservation's tickets
    // is marked Paid by USM or DTX. Anything fully paid-by-client (or with
    // no payer set) is irrelevant to our cash flow and stays hidden.
    const flightById = new Map(flights.map((f) => [f.id, f]));
    const rows = getFilteredFlightPayments().filter((r) => {
      const f = flightById.get(r.id);
      if (!f) return false;
      const t = String(f.touristPaidBy || "").toLowerCase();
      const g = String(f.guidePaidBy || "").toLowerCase();
      const isAgency = (v) => v === "usm" || v === "dtx";
      return isAgency(t) || isAgency(g);
    });
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
              <th data-trip-scope-hide>Trip</th>
              <th data-trip-scope-hide>Route</th>
              <th>Trip day</th>
              <th>Ticket Number</th>
              <th>Ticket Price</th>
              <th>Total Ticket Price</th>
              <th>Payment Status</th>
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
                    <td data-trip-scope-hide><a href="/trip-detail?tripId=${encodeURIComponent(entry.tripId)}" class="trip-name-link">${escapeHtml(entry.tripName)}</a></td>
                    <td data-trip-scope-hide>${escapeHtml([entry.fromCity, entry.toCity].filter(Boolean).join(" → ") || "-")}</td>
                    <td class="table-nowrap">${escapeHtml((flightById.get(entry.id) || {}).tripDay || entry.tripDay || "-")}</td>
                    <td>${escapeHtml(entry.ticketNumber || "—")}</td>
                    <td class="table-right">${escapeHtml(formatMoney(entry.ticketPrice))}</td>
                    <td class="table-right">${escapeHtml(formatMoney(entry.totalTicketPrice || entry.amount))}</td>
                    <td><span class="status-pill is-${escapeHtml(entry.paymentStatus || "unpaid")}">${escapeHtml(formatStatus(entry.paymentStatus || "unpaid"))}</span></td>
                    <td>${escapeHtml(entry.paidTo || "-")}</td>
                    <td>${escapeHtml(bankAccountLabel(entry.paidFromAccount))}</td>
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

  // Simple urgency colour for the pickup time cell on the chosen-trip
  // transfer table. Today = yellow (urgent), future = green (planned),
  // past = no class (done). Comparisons use local-day boundaries so the
  // user can see "today" the way Mongolia time would.
  function pickupTimeUrgency(serviceDate) {
    const v = String(serviceDate || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return "";
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const target = new Date(`${v}T00:00:00`);
    const diff = Math.round((target - today) / (1000 * 60 * 60 * 24));
    if (diff === 0) return "pickup-time-today";
    if (diff > 0) return "pickup-time-future";
    return "pickup-time-past";
  }

  // Bank accounts pulled from /settings → Bank accounts. Used for the
  // flight-payment "Paid from" dropdown so the user picks an actual account
  // rather than free-typing.
  let bankAccountsCache = [];
  async function loadBankAccounts() {
    try {
      const payload = await fetchJson("/api/settings");
      bankAccountsCache = (payload && payload.entry && Array.isArray(payload.entry.bankAccounts)) ? payload.entry.bankAccounts : [];
    } catch { bankAccountsCache = []; }
    populateFlightPaymentBankSelect();
  }
  function bankAccountLabel(id) {
    const a = bankAccountsCache.find((x) => x.id === id);
    if (!a) return id || "—";
    return a.label || a.bankName || a.accountName || a.id;
  }
  function populateFlightPaymentBankSelect() {
    if (!flightPaymentForm) return;
    const sel = flightPaymentForm.elements.paidFromAccount;
    if (!sel || sel.tagName !== "SELECT") return;
    const cur = sel.value;
    sel.innerHTML = '<option value="">Choose paid-from account</option>'
      + bankAccountsCache.map((a) => `<option value="${escapeHtml(a.id)}">${escapeHtml(a.label || a.bankName || a.id)}</option>`).join("");
    if (cur && [...sel.options].some((o) => o.value === cur)) sel.value = cur;
  }

  function transferTypeLabel(value) {
    const v = String(value || "").toLowerCase();
    if (v === "airport_welcome") return "Airport welcome";
    if (v === "airport_departure") return "Airport departure";
    if (v === "train_welcome") return "Train welcome";
    if (v === "train_departure") return "Train departure";
    // Legacy values from before the refactor — surface them for clarity.
    if (v) return formatStatus(v);
    return "—";
  }

  // The "Type time" column means different things per row: flight time on
  // airport rows, train time on train rows. Show the time with that
  // contextual prefix so the column header can stay generic.
  function transferTypeTimeCellLabel(transferType) {
    const v = String(transferType || "").toLowerCase();
    if (v.startsWith("airport")) return "Flight";
    if (v.startsWith("train")) return "Train";
    return "";
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
          <thead>
            <tr>
              <th>#</th>
              <th data-trip-scope-hide>Trip</th>
              <th>Type</th>
              <th>Date</th>
              <th>Pickup time</th>
              <th>Type time</th>
              <th>Driver</th>
              <th>Vehicle</th>
              <th>Plate Number</th>
              <th>Driver Number</th>
              <th>Salary</th>
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
                    <td data-trip-scope-hide><a href="/trip-detail?tripId=${encodeURIComponent(entry.tripId)}" class="trip-name-link">${escapeHtml(entry.tripName)}</a></td>
                    <td>${escapeHtml(transferTypeLabel(entry.transferType))}</td>
                    <td class="table-nowrap">${escapeHtml(formatDate(entry.serviceDate))}</td>
                    <td class="table-nowrap ${pickupTimeUrgency(entry.serviceDate)}">${escapeHtml(entry.serviceTime || "—")}</td>
                    <td class="table-nowrap">${(() => {
                      const t = entry.typeTime || "";
                      if (!t) return "—";
                      const prefix = transferTypeTimeCellLabel(entry.transferType);
                      return prefix
                        ? `<span class="transfer-type-time-prefix">${escapeHtml(prefix)}</span> ${escapeHtml(t)}`
                        : escapeHtml(t);
                    })()}</td>
                    <td>${escapeHtml(entry.driverName || "—")}</td>
                    <td>${escapeHtml(entry.vehicleType || "—")}</td>
                    <td>${escapeHtml(entry.plateNumber || "—")}</td>
                    <td>${escapeHtml(entry.driverPhoneNumber || "—")}</td>
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

  // Cache of camp-settings transfer lists; refilled on every form open so
  // recent additions in /settings show up without a full page reload.
  let transferSettingsCache = { places: [], drivers: [] };
  async function loadTransferSettings() {
    try {
      const payload = await fetchJson("/api/camp-settings");
      const e = (payload && payload.entry) || {};
      // Merge the new transferPlaces list with any legacy pickup/dropoff
      // arrays so old data still appears in the dropdowns.
      const places = [...new Set([
        ...(Array.isArray(e.transferPlaces) ? e.transferPlaces : []),
        ...(Array.isArray(e.transferPickups) ? e.transferPickups : []),
        ...(Array.isArray(e.transferDropoffs) ? e.transferDropoffs : []),
      ])];
      transferSettingsCache = {
        places,
        drivers: Array.isArray(e.transferDrivers) ? e.transferDrivers : [],
      };
    } catch {
      transferSettingsCache = { places: [], drivers: [] };
    }
    populateTransferFormSelectors();
  }
  function populateTransferFormSelectors() {
    if (!transferForm) return;
    const pickupSel = transferForm.querySelector("[data-transfer-pickup-select]");
    const dropoffSel = transferForm.querySelector("[data-transfer-dropoff-select]");
    const driverSel = transferForm.querySelector("[data-transfer-driver-select]");
    const opt = (v, label = v) => `<option value="${escapeHtml(v)}">${escapeHtml(label)}</option>`;
    const placesHtml = transferSettingsCache.places.map((p) => opt(p)).join("");
    if (pickupSel) {
      const cur = pickupSel.value;
      pickupSel.innerHTML = '<option value="">Choose pickup</option>' + placesHtml;
      if (cur && [...pickupSel.options].some((o) => o.value === cur)) pickupSel.value = cur;
    }
    if (dropoffSel) {
      const cur = dropoffSel.value;
      dropoffSel.innerHTML = '<option value="">Choose dropoff</option>' + placesHtml;
      if (cur && [...dropoffSel.options].some((o) => o.value === cur)) dropoffSel.value = cur;
    }
    if (driverSel) {
      const cur = driverSel.value;
      driverSel.innerHTML = '<option value="">Choose driver</option>' + transferSettingsCache.drivers.map((d) => `<option value="${escapeHtml(d.id)}">${escapeHtml(d.name)}</option>`).join("");
      if (cur && [...driverSel.options].some((o) => o.value === cur)) driverSel.value = cur;
    }
  }
  function applyDriverSnapshotToForm(driverId) {
    if (!transferForm) return;
    const driver = transferSettingsCache.drivers.find((d) => d.id === driverId);
    const setVal = (sel, val) => {
      const node = transferForm.querySelector(sel);
      if (node) node.value = val == null ? "" : String(val);
    };
    setVal("[data-transfer-vehicle]", driver ? driver.carType || "" : "");
    setVal("[data-transfer-plate]", driver ? driver.plateNumber || "" : "");
    setVal("[data-transfer-phone]", driver ? driver.phoneNumber || "" : "");
    if (driver && driver.salary) {
      const sal = transferForm.querySelector("[data-transfer-salary]");
      if (sal) sal.value = String(driver.salary);
    }
    if (transferForm.elements.driverName) {
      transferForm.elements.driverName.value = driver ? driver.name : "";
    }
  }
  function applyTransferTypeTimeLabel() {
    if (!transferForm) return;
    const type = transferForm.elements.transferType?.value || "";
    const label = transferForm.querySelector("[data-transfer-type-time-label]");
    if (label) label.textContent = type.startsWith("train_") ? "Train time" : "Flight time";
  }
  if (transferForm) {
    transferForm.addEventListener("change", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.matches("[data-transfer-driver-select]")) {
        applyDriverSnapshotToForm(target.value);
      } else if (target.matches("[data-transfer-type-select]")) {
        applyTransferTypeTimeLabel();
      }
    });
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
    populateFlightPaymentBankSelect();
  }

  // Phase 1: pull passenger count and service date from the chosen Trip on
  // a fresh transfer reservation. Only fills empty fields unless force=true,
  // so editing a saved transfer never overwrites manager-typed values.
  function syncTransferTripDefaults(tripId, force = false) {
    const trip = getTrip(tripId);
    if (!trip) return;
    const setIfEmpty = (name, value) => {
      const node = transferForm.elements[name];
      if (!node || value == null || value === "") return;
      if (force || !String(node.value || "").trim()) node.value = String(value);
    };
    setIfEmpty("passengerCount", trip.participantCount || "");
    setIfEmpty("serviceDate", trip.startDate || "");
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
    syncTransferTripDefaults(transferTripSelect.value, true);
    populateTransferFormSelectors();
    applyDriverSnapshotToForm("");
    applyTransferTypeTimeLabel();
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
    populateTransferFormSelectors();
    Object.entries(entry).forEach(([key, value]) => {
      if (transferForm.elements[key]) {
        transferForm.elements[key].value = value || "";
      }
    });
    // The driverId-based select stays as-is; fall back to the snapshot fields
    // (vehicle/plate/phone) on the row so editing legacy records works too.
    applyTransferTypeTimeLabel();
  }

  flightToggleForm?.addEventListener("click", async () => {
    await loadTrips();
    resetFlightForm();
    openPanel(flightFormPanel);
  });

  flightPaymentToggleForm?.addEventListener("click", async () => {
    await Promise.all([loadTrips(), loadFlights(), loadBankAccounts()]);
    resetFlightPaymentForm();
    openPanel(flightPaymentFormPanel);
  });

  transferToggleForm?.addEventListener("click", async () => {
    await Promise.all([loadTrips(), loadTransferSettings()]);
    resetTransferForm();
    openPanel(transferFormPanel);
  });

  flightTripSelect?.addEventListener("change", () => {
    syncFlightTripDefaults(flightTripSelect.value);
  });
  transferTripSelect?.addEventListener("change", () => {
    syncTransferTripDefaults(transferTripSelect.value);
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
    // The driver picker stores the driver id; snapshot the rest of the
    // record onto the reservation so it survives a later settings change.
    if (payload.driverId) {
      const driver = transferSettingsCache.drivers.find((d) => d.id === payload.driverId);
      if (driver) {
        payload.driverName = driver.name || "";
        if (!payload.vehicleType) payload.vehicleType = driver.carType || "";
        if (!payload.plateNumber) payload.plateNumber = driver.plateNumber || "";
        if (!payload.driverPhoneNumber) payload.driverPhoneNumber = driver.phoneNumber || "";
      }
    }
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
      await Promise.all([loadTrips(), loadFlights(), loadBankAccounts()]);
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
      await Promise.all([loadTrips(), loadTransferSettings()]);
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
