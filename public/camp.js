const campForm = document.querySelector("#camp-form");
const campStatus = document.querySelector("#camp-status");
const campList = document.querySelector("#camp-list");
const campSummary = document.querySelector("#camp-summary");
const campToggleForm = document.querySelector("#camp-toggle-form");
const campFormPanel = document.querySelector("#camp-form-panel");
const filterCampName = document.querySelector("#filter-camp-name");
const filterDateFrom = document.querySelector("#filter-date-from");
const filterDateTo = document.querySelector("#filter-date-to");

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

function buildPayload(formNode) {
  const payload = Object.fromEntries(new FormData(formNode).entries());
  payload.mealType = [payload.breakfast === "Yes" ? "Breakfast" : "", payload.lunch === "Yes" ? "Lunch" : "", payload.dinner === "Yes" ? "Dinner" : ""]
    .filter(Boolean)
    .join(" / ") || "No meal";
  return payload;
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

function getFilteredEntries() {
  const campNameNeedle = filterCampName.value.trim().toLowerCase();
  const dateFrom = filterDateFrom.value;
  const dateTo = filterDateTo.value;

  return currentEntries.filter((entry) => {
    const matchesCamp = !campNameNeedle || entry.campName.toLowerCase().includes(campNameNeedle);
    const matchesFrom = !dateFrom || entry.checkIn >= dateFrom;
    const matchesTo = !dateTo || entry.checkIn <= dateTo;
    return matchesCamp && matchesFrom && matchesTo;
  });
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
                  <th>Accommodation</th>
                  <th>Breakfast</th>
                  <th>Lunch</th>
                  <th>Dinner</th>
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
                  <td>${escapeHtml(entry.accommodation || "-")}</td>
                  <td>${escapeHtml(entry.breakfast || "No")}</td>
                  <td>${escapeHtml(entry.lunch || "No")}</td>
                  <td>${escapeHtml(entry.dinner || "No")}</td>
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
  currentEntries = payload.entries;
  renderSummary(payload.summary);
  renderEntries(getFilteredEntries());
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
    campForm.nights.value = "1";
    campForm.breakfast.value = "No";
    campForm.lunch.value = "No";
    campForm.dinner.value = "No";
    campFormPanel.classList.add("is-hidden");
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

campToggleForm.addEventListener("click", () => {
  campFormPanel.classList.toggle("is-hidden");
});

[filterCampName, filterDateFrom, filterDateTo].forEach((node) => {
  node.addEventListener("input", () => {
    renderEntries(getFilteredEntries());
  });
});

campForm.createdDate.valueAsDate = new Date();
campForm.breakfast.value = "No";
campForm.lunch.value = "No";
campForm.dinner.value = "No";

loadCampReservations();
