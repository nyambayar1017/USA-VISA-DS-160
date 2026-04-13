const publicList = document.querySelector("#fifa-public-list");
const publicSummaryLots = document.querySelector("#public-summary-lots");
const publicSummaryUnits = document.querySelector("#public-summary-units");

const filters = {
  search: document.querySelector("#public-filter-search"),
  match: document.querySelector("#public-filter-match"),
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

function matchKey(ticket) {
  return `${ticket.matchDate}|${ticket.matchNumber}|${ticket.matchLabel}|${ticket.city}|${ticket.stage}`;
}

function buildRows() {
  const grouped = new Map();
  state.tickets.forEach((ticket) => {
    const key = matchKey(ticket);
    if (!grouped.has(key)) {
      grouped.set(key, {
        matchDate: ticket.matchDate,
        matchNumber: ticket.matchNumber,
        matchLabel: ticket.matchLabel,
        teamA: ticket.teamA,
        teamB: ticket.teamB,
        city: ticket.city,
        stage: ticket.stage,
        categories: { "1": 0, "2": 0, "3": 0 },
        seats: { "1": [], "2": [], "3": [] },
        totalUnits: 0,
      });
    }
    const row = grouped.get(key);
    row.categories[ticket.categoryCode] += Number(ticket.availableQuantity || 0);
    row.totalUnits += Number(ticket.availableQuantity || 0);
    if (ticket.seatDetails) {
      row.seats[ticket.categoryCode].push(ticket.seatDetails);
    }
  });
  return [...grouped.values()].sort((left, right) => {
    const dateCompare = String(left.matchDate || "").localeCompare(String(right.matchDate || ""));
    if (dateCompare !== 0) return dateCompare;
    return String(left.matchNumber || "").localeCompare(String(right.matchNumber || ""));
  });
}

function filteredRows() {
  const query = filters.search.value.trim().toLowerCase();
  return buildRows().filter((row) => {
    if (filters.match.value && `${row.matchNumber} · ${row.matchLabel}` !== filters.match.value) return false;
    if (filters.stage.value && row.stage !== filters.stage.value) return false;
    if (filters.city.value && row.city !== filters.city.value) return false;
    if (filters.category.value && row.categories[filters.category.value] <= 0) return false;
    if (filters.dateFrom.value && row.matchDate < filters.dateFrom.value) return false;
    if (filters.dateTo.value && row.matchDate > filters.dateTo.value) return false;
    if (!query) return true;
    return [
      row.matchNumber,
      row.matchLabel,
      row.teamA,
      row.teamB,
      row.city,
      row.stage,
      ...row.seats["1"],
      ...row.seats["2"],
      ...row.seats["3"],
    ].some((value) => String(value || "").toLowerCase().includes(query));
  });
}

function seatSummary(row) {
  const parts = ["1", "2", "3"]
    .filter((category) => row.seats[category].length)
    .map((category) => `CAT ${category}: ${row.seats[category].join(" / ")}`);
  return parts.join(" | ") || "-";
}

function renderRows() {
  const rows = filteredRows();
  if (publicSummaryLots) publicSummaryLots.textContent = String(rows.length);
  if (publicSummaryUnits) publicSummaryUnits.textContent = String(rows.reduce((sum, row) => sum + row.totalUnits, 0));

  if (!rows.length) {
    publicList.innerHTML = '<p class="empty">No matches match the current filters.</p>';
    return;
  }

  publicList.innerHTML = `
    <table class="fifa-public-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Stage</th>
          <th>Match</th>
          <th>Teams</th>
          <th>City</th>
          <th>Category 1</th>
          <th>Category 2</th>
          <th>Category 3</th>
          <th>Seat Number</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (row) => `
              <tr>
                <td>${escapeHtml(row.matchDate)}</td>
                <td>${escapeHtml(row.stage)}</td>
                <td>${escapeHtml(row.matchNumber)}</td>
                <td>${escapeHtml(row.teamA)} vs ${escapeHtml(row.teamB)}</td>
                <td>${escapeHtml(row.city)}</td>
                <td>${row.categories["1"] || ""}</td>
                <td>${row.categories["2"] || ""}</td>
                <td>${row.categories["3"] || ""}</td>
                <td class="fifa-public-seat-cell">${escapeHtml(seatSummary(row))}</td>
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
  const rows = buildRows();
  if (publicSummaryLots) publicSummaryLots.textContent = String(rows.length);
  if (publicSummaryUnits) publicSummaryUnits.textContent = String(rows.reduce((sum, row) => sum + row.totalUnits, 0));
  fillSelect(filters.match, [...new Set(rows.map((row) => `${row.matchNumber} · ${row.matchLabel}`))], "All matches");
  fillSelect(filters.stage, [...new Set(rows.map((row) => row.stage).filter(Boolean))].sort(), "All stages");
  fillSelect(filters.city, [...new Set(rows.map((row) => row.city).filter(Boolean))].sort(), "All cities");
  fillSelect(filters.category, ["1", "2", "3"], "All categories");
  renderRows();
}

Object.values(filters).forEach((node) => {
  node?.addEventListener("input", renderRows);
  node?.addEventListener("change", renderRows);
});

fetchPublicTickets().catch((error) => {
  publicList.innerHTML = `<p class="empty">${escapeHtml(error.message)}</p>`;
});
