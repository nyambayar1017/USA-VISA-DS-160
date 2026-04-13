const publicList = document.querySelector("#fifa-public-list");
const publicSummaryLots = document.querySelector("#public-summary-lots");
const publicSummaryUnits = document.querySelector("#public-summary-units");
const publicListCount = document.querySelector("#public-list-count");
const publicListMeta = document.querySelector("#public-list-meta");

const filters = {
  search: document.querySelector("#public-filter-search"),
  stage: document.querySelector("#public-filter-stage"),
  city: document.querySelector("#public-filter-city"),
  category: document.querySelector("#public-filter-category"),
  dateFrom: document.querySelector("#public-filter-date-from"),
  dateTo: document.querySelector("#public-filter-date-to"),
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

function fillSelect(node, values, placeholder) {
  if (!node) return;
  node.innerHTML = [`<option value="">${placeholder}</option>`]
    .concat(values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`))
    .join("");
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString();
}

function normalizedCategory(ticket) {
  const code = String(ticket.categoryCode || "").trim();
  if (["1", "2", "3"].includes(code)) return code;
  const digits = code.replace(/\D+/g, "");
  return ["1", "2", "3"].includes(digits) ? digits : code || "-";
}

function filteredTickets() {
  const query = filters.search.value.trim().toLowerCase();
  return [...state.tickets]
    .filter((ticket) => {
      if (filters.stage.value && ticket.stage !== filters.stage.value) return false;
      if (filters.city.value && ticket.city !== filters.city.value) return false;
      if (filters.category.value && normalizedCategory(ticket) !== filters.category.value) return false;
      if (filters.dateFrom.value && String(ticket.matchDate || "") < filters.dateFrom.value) return false;
      if (filters.dateTo.value && String(ticket.matchDate || "") > filters.dateTo.value) return false;
      if (!query) return true;
      return [
        ticket.matchLabel,
        ticket.matchNumber,
        ticket.teamA,
        ticket.teamB,
        ticket.stage,
        ticket.city,
        ticket.venue,
        ticket.categoryName,
        ticket.categoryCode,
        ticket.seatSection,
        ticket.seatDetails,
      ].some((value) => String(value || "").toLowerCase().includes(query));
    })
    .sort((left, right) => {
      const dateCompare = String(left.matchDate || "").localeCompare(String(right.matchDate || ""));
      if (dateCompare !== 0) return dateCompare;
      return String(left.matchNumber || "").localeCompare(String(right.matchNumber || ""));
    });
}

function renderPublicTickets() {
  const tickets = filteredTickets();
  if (publicSummaryLots) publicSummaryLots.textContent = String(new Set(tickets.map((ticket) => ticket.matchNumber)).size);
  if (publicSummaryUnits) publicSummaryUnits.textContent = String(tickets.reduce((sum, ticket) => sum + Number(ticket.availableQuantity || 0), 0));
  if (publicListCount) publicListCount.textContent = `${tickets.length} ticket lots`;
  if (publicListMeta) {
    const matchCount = new Set(tickets.map((ticket) => ticket.matchNumber)).size;
    publicListMeta.textContent = `${matchCount} matches in current view. Seat numbers are shown directly in the list.`;
  }

  if (!tickets.length) {
    publicList.innerHTML = '<p class="empty">No tickets match the current filters.</p>';
    return;
  }

  publicList.innerHTML = `
    <table class="fifa-public-table">
      <thead>
        <tr>
          <th>Match</th>
          <th>Date</th>
          <th>City</th>
          <th>Category</th>
          <th>Seat / Ticket Number</th>
          <th>Available</th>
        </tr>
      </thead>
      <tbody>
        ${tickets
          .map(
            (ticket) => `
              <tr>
                <td>
                  <strong>${escapeHtml(ticket.matchLabel || "-")}</strong>
                  <div class="fifa-public-sub">${escapeHtml(ticket.stage || "-")} · ${escapeHtml(ticket.matchNumber || "-")}</div>
                </td>
                <td>${escapeHtml(formatDate(ticket.matchDate))}</td>
                <td>
                  <strong>${escapeHtml(ticket.city || "-")}</strong>
                  <div class="fifa-public-sub">${escapeHtml(ticket.venue || "-")}</div>
                </td>
                <td>
                  <strong>CAT ${escapeHtml(normalizedCategory(ticket))}</strong>
                  <div class="fifa-public-sub">${escapeHtml(ticket.categoryName || "-")}</div>
                </td>
                <td class="fifa-public-seat-cell">
                  <strong>${escapeHtml(ticket.seatDetails || "-")}</strong>
                  <div class="fifa-public-sub">${escapeHtml(ticket.seatSection || "")}</div>
                </td>
                <td>${escapeHtml(String(ticket.availableQuantity || 0))}</td>
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  `;
}

async function fetchPublicTickets() {
  const response = await fetch("/api/fifa2026/public");
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Could not load tickets");
  }
  state.tickets = data.tickets || [];
  if (publicSummaryLots) {
    publicSummaryLots.textContent = String(data.summary?.matchCount ?? new Set(state.tickets.map((ticket) => ticket.matchNumber)).size);
  }
  if (publicSummaryUnits) {
    publicSummaryUnits.textContent = String(data.summary?.visibleUnits ?? state.tickets.reduce((sum, ticket) => sum + Number(ticket.availableQuantity || 0), 0));
  }
  fillSelect(filters.stage, [...new Set(state.tickets.map((ticket) => ticket.stage).filter(Boolean))].sort(), "All stages");
  fillSelect(filters.city, [...new Set(state.tickets.map((ticket) => ticket.city).filter(Boolean))].sort(), "All cities");
  fillSelect(filters.category, ["1", "2", "3"], "All categories");
  renderPublicTickets();
}

Object.values(filters).forEach((node) => {
  node?.addEventListener("input", renderPublicTickets);
  node?.addEventListener("change", renderPublicTickets);
});

fetchPublicTickets().catch((error) => {
  publicList.innerHTML = `<p class="empty">${escapeHtml(error.message)}</p>`;
});
