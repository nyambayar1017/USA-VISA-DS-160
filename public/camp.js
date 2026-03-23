const campForm = document.querySelector("#camp-form");
const campStatus = document.querySelector("#camp-status");
const campList = document.querySelector("#camp-list");
const campSummary = document.querySelector("#camp-summary");

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

function buildPayload(formNode) {
  return Object.fromEntries(new FormData(formNode).entries());
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }

  return data;
}

function renderSummary(summary) {
  const cards = [
    ["Total reservations", summary.total],
    ["Confirmed", summary.confirmed],
    ["Pending", summary.pending],
    ["Cancelled", summary.cancelled],
    ["Rejected", summary.rejected],
    ["Deposit pending", summary.depositPending],
    ["Deposit paid", summary.depositPaid],
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

function renderEntries(entries) {
  if (!entries.length) {
    campList.innerHTML = '<p class="empty">No camp reservations yet.</p>';
    return;
  }

  campList.innerHTML = entries
    .map(
      (entry) => `
        <article class="submission-card camp-entry-card">
          <div class="submission-top">
            <div>
              <h3>${escapeHtml(entry.tourName)}</h3>
              <p>${escapeHtml(entry.campName)} · ${escapeHtml(entry.region || "No region")} · ${escapeHtml(entry.inboundCompany)} -> ${escapeHtml(entry.outboundCompany)}</p>
            </div>
            <div class="camp-entry-actions">
              <a class="table-link" href="${entry.pdfPath}" download>Download PDF</a>
              <a class="table-link secondary" href="${entry.pdfViewPath}" target="_blank" rel="noreferrer">Preview</a>
            </div>
          </div>
          <div class="camp-table-wrap">
            <table class="camp-table">
              <thead>
                <tr>
                  <th>Guests</th>
                  <th>Staff</th>
                  <th>Arrival</th>
                  <th>Departure</th>
                  <th>Nights</th>
                  <th>Room type</th>
                  <th>Meal type</th>
                  <th>Deposit</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>${escapeHtml(entry.guestCount)}</td>
                  <td>${escapeHtml(entry.staffCount || 0)}</td>
                  <td>${formatDate(entry.checkIn)}</td>
                  <td>${formatDate(entry.checkOut)}</td>
                  <td>${escapeHtml(entry.nights || "-")}</td>
                  <td>${escapeHtml(entry.roomType)}</td>
                  <td>${escapeHtml(entry.mealType)}</td>
                  <td>${formatMoney(entry.depositAmount)} MNT</td>
                  <td>${escapeHtml(entry.status)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="camp-update-row">
            <label>
              Status
              <select data-role="status" data-id="${entry.id}">
                <option value="pending" ${entry.status === "pending" ? "selected" : ""}>Pending</option>
                <option value="confirmed" ${entry.status === "confirmed" ? "selected" : ""}>Confirmed</option>
                <option value="cancelled" ${entry.status === "cancelled" ? "selected" : ""}>Cancelled</option>
                <option value="rejected" ${entry.status === "rejected" ? "selected" : ""}>Rejected</option>
              </select>
            </label>
            <label>
              Deposit
              <select data-role="depositStatus" data-id="${entry.id}">
                <option value="not-required" ${entry.depositStatus === "not-required" ? "selected" : ""}>Not required</option>
                <option value="pending" ${entry.depositStatus === "pending" ? "selected" : ""}>Pending</option>
                <option value="paid" ${entry.depositStatus === "paid" ? "selected" : ""}>Paid</option>
              </select>
            </label>
            <label class="camp-note-field">
              Notes
              <input data-role="notes" data-id="${entry.id}" value="${escapeHtml(entry.notes || "")}" />
            </label>
            <button type="button" class="camp-update-button" data-action="update" data-id="${entry.id}">Update</button>
          </div>
        </article>
      `
    )
    .join("");
}

async function updateReservation(id) {
  const statusField = document.querySelector(`[data-role="status"][data-id="${id}"]`);
  const depositField = document.querySelector(`[data-role="depositStatus"][data-id="${id}"]`);
  const notesField = document.querySelector(`[data-role="notes"][data-id="${id}"]`);

  campStatus.textContent = "Updating reservation...";

  try {
    await fetchJson(`/api/camp-reservations/${id}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: statusField.value,
        depositStatus: depositField.value,
        notes: notesField.value,
      }),
    });

    campStatus.textContent = "Reservation updated.";
    await loadCampReservations();
  } catch (error) {
    campStatus.textContent = error.message;
  }
}

async function loadCampReservations() {
  const payload = await fetchJson("/api/camp-reservations");
  renderSummary(payload.summary);
  renderEntries(payload.entries);
}

campForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  campStatus.textContent = "Saving...";

  try {
    const result = await fetchJson("/api/camp-reservations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildPayload(campForm)),
    });

    campStatus.textContent = `Saved. ${result.entry.campName} is now ${result.entry.status}.`;
    campForm.reset();
    campForm.inboundCompany.value = "Unlock Steppe Mongolia";
    campForm.outboundCompany.value = "Delkhii Travel X";
    campForm.createdDate.valueAsDate = new Date();
    campForm.guestCount.value = "2";
    campForm.staffCount.value = "0";
    campForm.gerCount.value = "1";
    campForm.nights.value = "1";
    await loadCampReservations();
  } catch (error) {
    campStatus.textContent = error.message;
  }
});

campList.addEventListener("click", (event) => {
  const button = event.target.closest('[data-action="update"]');
  if (!button) {
    return;
  }

  updateReservation(button.dataset.id);
});

campForm.createdDate.valueAsDate = new Date();

loadCampReservations();
