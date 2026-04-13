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

const MATCH_CATALOG = [
  { n: 1, d: "2026-06-11", s: "Opening", m: "Match 1", t: "MEX vs RSA", c: "Mexico", q1: 2, q2: 10, q3: 0 },
  { n: 2, d: "2026-06-12", s: "Opening", m: "Match 4", t: "USA vs PAR", c: "Los Angeles", q1: 0, q2: 0, q3: 4 },
  { n: 3, d: "2026-06-13", s: "Group Stage", m: "Match 6", t: "AUS vs FIFA", c: "Vancouver", q1: 0, q2: 3, q3: 0 },
  { n: 4, d: "2026-06-13", s: "Group Stage", m: "Match 7", t: "BRA vs MAR", c: "New York", q1: 0, q2: 0, q3: 10 },
  { n: 5, d: "2026-06-14", s: "Group Stage", m: "Match 10", t: "GER vs CUR", c: "Houston", q1: 4, q2: 4, q3: 0 },
  { n: 6, d: "2026-06-14", s: "Group Stage", m: "Match 11", t: "NED vs JPN", c: "Dallas", q1: 4, q2: 0, q3: 10 },
  { n: 7, d: "2026-06-15", s: "Group Stage", m: "Match 16", t: "BEL vs EGY", c: "Seattle", q1: 0, q2: 4, q3: 0 },
  { n: 8, d: "2026-06-16", s: "Group Stage", m: "Match 17", t: "FRA vs SEN", c: "New York", q1: 4, q2: 0, q3: 3 },
  { n: 9, d: "2026-06-16", s: "Group Stage", m: "Match 19", t: "ARG vs ALG", c: "Kansas", q1: 0, q2: 0, q3: 3 },
  { n: 10, d: "2026-06-16", s: "Group Stage", m: "Match 20", t: "AUT vs JOR", c: "San Francisco", q1: 3, q2: 0, q3: 0 },
  { n: 11, d: "2026-06-17", s: "Group Stage", m: "Match 23", t: "POR vs W1", c: "Houston", q1: 4, q2: 4, q3: 0 },
  { n: 12, d: "2026-06-17", s: "Group Stage", m: "Match 22", t: "ENG vs CRO", c: "Dallas", q1: 4, q2: 6, q3: 13 },
  { n: 13, d: "2026-06-18", s: "Group Stage", m: "Match 28", t: "MEX vs KOR", c: "Guadalajara", q1: 4, q2: 0, q3: 0 },
  { n: 14, d: "2026-06-22", s: "Group Stage", m: "Match 43", t: "ARG vs AUS", c: "Dallas", q1: 2, q2: 0, q3: 0 },
  { n: 15, d: "2026-06-23", s: "Group Stage", m: "Match 45", t: "ENG vs GHA", c: "Boston", q1: 4, q2: 0, q3: 0 },
  { n: 16, d: "2026-06-23", s: "Group Stage", m: "Match 47", t: "POR vs UZB", c: "Houston", q1: 4, q2: 6, q3: 7 },
  { n: 17, d: "2026-06-24", s: "Group Stage", m: "Match 51", t: "SWI vs CAN", c: "Vancouver", q1: 4, q2: 0, q3: 0 },
  { n: 18, d: "2026-06-24", s: "Group Stage", m: "Match 53", t: "MEX vs FIFA", c: "Mexico", q1: 4, q2: 0, q3: 0 },
  { n: 19, d: "2026-06-25", s: "Group Stage", m: "Match 60", t: "PAR vs AUS", c: "San Francisco", q1: 0, q2: 4, q3: 0 },
  { n: 20, d: "2026-06-26", s: "Group Stage", m: "Match 61", t: "FRA vs NOR", c: "Boston", q1: 4, q2: 2, q3: 0 },
  { n: 21, d: "2026-06-27", s: "Group Stage", m: "Match 67", t: "PAN vs ENG", c: "New York", q1: 4, q2: 0, q3: 8 },
  { n: 22, d: "2026-06-27", s: "Group Stage", m: "Match 70", t: "ARG vs JOR", c: "Dallas", q1: 4, q2: 0, q3: 6 },
  { n: 23, d: "2026-06-28", s: "Round 32", m: "Match 73", t: "2A vs 2B", c: "Los Angeles", q1: 4, q2: 4, q3: 0 },
  { n: 24, d: "2026-06-30", s: "Round 32", m: "Match 77", t: "1I vs 3CDFGH", c: "New York", q1: 8, q2: 0, q3: 10 },
  { n: 25, d: "2026-07-03", s: "Round 32", m: "Match 87", t: "1K vs 3DEIJL", c: "Kansas", q1: 4, q2: 0, q3: 0 },
  { n: 26, d: "2026-07-03", s: "Round 32", m: "Match 86", t: "1J vs 2H", c: "Miami", q1: 8, q2: 0, q3: 10 },
  { n: 27, d: "2026-07-05", s: "Round 16", m: "Match 89", t: "W74 vs W77", c: "Philadelphia", q1: 10, q2: 10, q3: 0 },
  { n: 28, d: "2026-07-06", s: "Round 16", m: "Match 91", t: "W76 vs W78", c: "New York", q1: 0, q2: 10, q3: 0 },
  { n: 29, d: "2026-07-06", s: "Round 16", m: "Match 93", t: "W81 vs W82", c: "Dallas", q1: 0, q2: 4, q3: 0 },
  { n: 30, d: "2026-07-08", s: "Round 16", m: "Match 95", t: "W86 vs W88", c: "Atlanta", q1: 0, q2: 10, q3: 0 },
  { n: 31, d: "2026-07-08", s: "Round 16", m: "Match 96", t: "W85 vs W87", c: "Vancouver", q1: 0, q2: 0, q3: 0 },
  { n: 32, d: "2026-07-10", s: "Quarter Final", m: "Match 97", t: "W89 vs W90", c: "Boston", q1: 10, q2: 4, q3: 0 },
  { n: 33, d: "2026-07-11", s: "Quarter Final", m: "Match 98", t: "W93 vs W94", c: "Los Angeles", q1: 0, q2: 4, q3: 0 },
  { n: 34, d: "2026-07-12", s: "Quarter Final", m: "Match 99", t: "W91 vs W92", c: "Miami", q1: 0, q2: 4, q3: 0 },
  { n: 35, d: "2026-07-12", s: "Quarter Final", m: "Match 100", t: "W95 vs W96", c: "Kansas", q1: 14, q2: 10, q3: 0 },
  { n: 36, d: "2026-07-15", s: "Semi Final", m: "Match 101", t: "W97 vs W98", c: "Dallas", q1: 2, q2: 0, q3: 0 },
  { n: 37, d: "2026-07-16", s: "Semi Final", m: "Match 102", t: "W99 vs W100", c: "Atlanta", q1: 2, q2: 0, q3: 0 },
  { n: 38, d: "2026-07-20", s: "Final", m: "Match 104", t: "W101 vs W102", c: "New York", q1: 2, q2: 0, q3: 0 },
];

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
  return ["1", "2", "3"].includes(digits) ? digits : "";
}

function buildCatalogRows() {
  const liveByMatch = new Map();

  for (const ticket of state.tickets) {
    const key = `${ticket.matchNumber}|${ticket.matchLabel}|${ticket.city}`;
    if (!liveByMatch.has(key)) {
      liveByMatch.set(key, {
        q1: null,
        q2: null,
        q3: null,
        seats1: [],
        seats2: [],
        seats3: [],
      });
    }
    const bucket = liveByMatch.get(key);
    const category = normalizedCategory(ticket);
    if (!category) continue;

    const quantityKey = `q${category}`;
    const seatsKey = `seats${category}`;
    if (bucket[quantityKey] === null) bucket[quantityKey] = 0;
    bucket[quantityKey] += Number(ticket.availableQuantity || 0);
    if (ticket.seatDetails) bucket[seatsKey].push(ticket.seatDetails);
  }

  return MATCH_CATALOG.map((row) => {
    const key = `${row.m}|${row.t}|${row.c}`;
    const live = liveByMatch.get(key);
    return {
      ...row,
      q1: live && live.q1 !== null ? live.q1 : row.q1,
      q2: live && live.q2 !== null ? live.q2 : row.q2,
      q3: live && live.q3 !== null ? live.q3 : row.q3,
      seatDetails: [
        ...(live?.seats1 || []),
        ...(live?.seats2 || []),
        ...(live?.seats3 || []),
      ].join(" | "),
    };
  });
}

function filteredRows() {
  const query = filters.search.value.trim().toLowerCase();
  return buildCatalogRows().filter((row) => {
    if (filters.stage.value && row.s !== filters.stage.value) return false;
    if (filters.city.value && row.c !== filters.city.value) return false;
    if (filters.category.value && !Number(row[`q${filters.category.value}`] || 0)) return false;
    if (filters.dateFrom.value && row.d < filters.dateFrom.value) return false;
    if (filters.dateTo.value && row.d > filters.dateTo.value) return false;
    if (!query) return true;
    return [row.m, row.t, row.c, row.s, row.seatDetails].some((value) =>
      String(value || "").toLowerCase().includes(query)
    );
  });
}

function renderPublicTickets() {
  const rows = filteredRows();
  if (publicSummaryLots) publicSummaryLots.textContent = String(rows.length);
  if (publicSummaryUnits) {
    publicSummaryUnits.textContent = String(
      rows.reduce((sum, row) => sum + Number(row.q1 || 0) + Number(row.q2 || 0) + Number(row.q3 || 0), 0)
    );
  }
  if (publicListCount) publicListCount.textContent = `${rows.length} matches`;
  if (publicListMeta) publicListMeta.textContent = "38 matches loaded. Seat numbers are shown directly in the list where available.";

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
                <td>${escapeHtml(formatDate(row.d))}</td>
                <td>${escapeHtml(row.s)}</td>
                <td>${escapeHtml(row.m)}</td>
                <td>${escapeHtml(row.t)}</td>
                <td>${escapeHtml(row.c)}</td>
                <td>${row.q1 || ""}</td>
                <td>${row.q2 || ""}</td>
                <td>${row.q3 || ""}</td>
                <td class="fifa-public-seat-cell">${escapeHtml(row.seatDetails || "-")}</td>
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
  fillSelect(filters.stage, [...new Set(MATCH_CATALOG.map((row) => row.s))], "All stages");
  fillSelect(filters.city, [...new Set(MATCH_CATALOG.map((row) => row.c))], "All cities");
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
