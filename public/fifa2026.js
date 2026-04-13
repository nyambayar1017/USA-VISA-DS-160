const publicList = document.querySelector("#fifa-public-list");
const publicSummaryLots = document.querySelector("#public-summary-lots");
const publicSummaryUnits = document.querySelector("#public-summary-units");

const filters = {
  search: document.querySelector("#public-filter-search"),
  stage: document.querySelector("#public-filter-stage"),
  city: document.querySelector("#public-filter-city"),
  category: document.querySelector("#public-filter-category"),
  maxPrice: document.querySelector("#public-filter-price"),
};

const state = {
  tickets: [],
};

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatMoney(value, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function fillSelect(node, values, placeholder) {
  node.innerHTML = [`<option value="">${placeholder}</option>`]
    .concat(values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`))
    .join("");
}

async function fetchPublicTickets() {
  const response = await fetch("/api/fifa2026/public");
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Could not load tickets");
  }
  state.tickets = data.tickets || [];
  publicSummaryLots.textContent = String(data.summary?.visibleLots ?? state.tickets.length);
  publicSummaryUnits.textContent = String(data.summary?.visibleUnits ?? state.tickets.reduce((sum, ticket) => sum + Number(ticket.availableQuantity || 0), 0));
  fillSelect(filters.stage, [...new Set(state.tickets.map((ticket) => ticket.stage).filter(Boolean))].sort(), "All stages");
  fillSelect(filters.city, [...new Set(state.tickets.map((ticket) => ticket.city).filter(Boolean))].sort(), "All cities");
  fillSelect(filters.category, [...new Set(state.tickets.map((ticket) => ticket.categoryCode).filter(Boolean))].sort(), "All categories");
  renderPublicTickets();
}

function filteredTickets() {
  const query = filters.search.value.trim().toLowerCase();
  const maxPrice = Number(filters.maxPrice.value || 0);
  return state.tickets
    .filter((ticket) => {
      if (filters.stage.value && ticket.stage !== filters.stage.value) return false;
      if (filters.city.value && ticket.city !== filters.city.value) return false;
      if (filters.category.value && ticket.categoryCode !== filters.category.value) return false;
      if (maxPrice > 0 && Number(ticket.price || 0) > maxPrice) return false;
      if (!query) return true;
      return [
        ticket.matchLabel,
        ticket.matchNumber,
        ticket.teamA,
        ticket.teamB,
        ticket.stage,
        ticket.city,
        ticket.venue,
        ticket.categoryCode,
        ticket.categoryName,
        ticket.seatSection,
        ticket.seatDetails,
      ].some((value) => String(value || "").toLowerCase().includes(query));
    })
    .sort((left, right) => String(left.matchDate || "").localeCompare(String(right.matchDate || "")));
}

function renderPublicTickets() {
  const tickets = filteredTickets();
  if (!tickets.length) {
    publicList.innerHTML = '<p class="empty">No tickets match the current filters.</p>';
    return;
  }
  publicList.innerHTML = tickets
    .map(
      (ticket) => `
        <article class="fifa-public-card">
          <div class="fifa-public-card-head">
            <p>${escapeHtml(ticket.stage)}</p>
            <span>${escapeHtml(ticket.matchNumber || "Match")}</span>
          </div>
          <h2>${escapeHtml(ticket.matchLabel)}</h2>
          <p class="fifa-public-meta">${escapeHtml(ticket.city)} · ${escapeHtml(ticket.venue || "Venue TBC")} · ${escapeHtml(ticket.matchDate)}</p>
          <div class="fifa-public-tags">
            <span>${escapeHtml(ticket.categoryCode)}</span>
            <span>${escapeHtml(ticket.categoryName || "Ticket")}</span>
            <span>${ticket.seatAssignedLater ? "Seat assigned later" : escapeHtml(ticket.seatSection || "Seat info")}</span>
          </div>
          <p class="fifa-public-seat">${escapeHtml(ticket.seatDetails || "Seat details available after confirmation")}</p>
          <div class="fifa-public-footer">
            <strong>${escapeHtml(formatMoney(ticket.price, ticket.currency))}</strong>
            <span>${ticket.availableQuantity} left</span>
          </div>
        </article>
      `
    )
    .join("");
}

Object.values(filters).forEach((node) => node.addEventListener("input", renderPublicTickets));
Object.values(filters).forEach((node) => node.addEventListener("change", renderPublicTickets));

fetchPublicTickets().catch((error) => {
  publicList.innerHTML = `<p class="empty">${escapeHtml(error.message)}</p>`;
});
