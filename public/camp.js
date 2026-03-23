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
              <h3>${escapeHtml(entry.campName)}</h3>
              <p>${escapeHtml(entry.region || "No region")} · ${escapeHtml(entry.inboundCompany)} -> ${escapeHtml(entry.outboundCompany)}</p>
            </div>
            <time>${formatDate(entry.checkIn)} - ${formatDate(entry.checkOut)}</time>
          </div>
          <div class="details-grid">
            <div class="detail">
              <span>Status</span>
              <strong>${escapeHtml(entry.status)}</strong>
            </div>
            <div class="detail">
              <span>Deposit</span>
              <strong>${formatMoney(entry.depositAmount)} MNT · ${escapeHtml(entry.depositStatus)}</strong>
            </div>
            <div class="detail">
              <span>Guests / Gers</span>
              <strong>${escapeHtml(entry.guestCount)} guests · ${escapeHtml(entry.gerCount || 0)} gers</strong>
            </div>
            <div class="detail">
              <span>Contact</span>
              <strong>${escapeHtml(entry.contactName || "-")} · ${escapeHtml(entry.contactPhone || "-")}</strong>
            </div>
            <div class="detail full-span">
              <span>Notes</span>
              <strong>${escapeHtml(entry.notes || "-")}</strong>
            </div>
          </div>
        </article>
      `
    )
    .join("");
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
    campForm.guestCount.value = "2";
    campForm.gerCount.value = "1";
    await loadCampReservations();
  } catch (error) {
    campStatus.textContent = error.message;
  }
});

loadCampReservations();
