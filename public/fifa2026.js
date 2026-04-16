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

const MATCH_CATALOG = [
  { stage: "Opening", matchNumber: "Match 1", matchDate: "2026-06-11", teamA: "MEX", teamB: "RSA", city: "Mexico City", venue: "Mexico City Stadium" },
  { stage: "Opening", matchNumber: "Match 4", matchDate: "2026-06-12", teamA: "USA", teamB: "PAR", city: "Los Angeles", venue: "Los Angeles Stadium" },
  { stage: "Group Stage", matchNumber: "Match 6", matchDate: "2026-06-13", teamA: "AUS", teamB: "TUR", city: "Vancouver", venue: "Vancouver Stadium" },
  { stage: "Group Stage", matchNumber: "Match 7", matchDate: "2026-06-13", teamA: "BRA", teamB: "MAR", city: "New York", venue: "New York Stadium" },
  { stage: "Group Stage", matchNumber: "Match 10", matchDate: "2026-06-14", teamA: "GER", teamB: "CUR", city: "Houston", venue: "Houston Stadium" },
  { stage: "Group Stage", matchNumber: "Match 11", matchDate: "2026-06-14", teamA: "NED", teamB: "JPN", city: "Dallas", venue: "Dallas Stadium" },
  { stage: "Group Stage", matchNumber: "Match 16", matchDate: "2026-06-15", teamA: "BEL", teamB: "EGY", city: "Seattle", venue: "Seattle Stadium" },
  { stage: "Group Stage", matchNumber: "Match 17", matchDate: "2026-06-16", teamA: "FRA", teamB: "SEN", city: "New York", venue: "New York Stadium" },
  { stage: "Group Stage", matchNumber: "Match 19", matchDate: "2026-06-16", teamA: "ARG", teamB: "ALG", city: "Kansas", venue: "Kansas Stadium" },
  { stage: "Group Stage", matchNumber: "Match 20", matchDate: "2026-06-16", teamA: "AUT", teamB: "JOR", city: "San Francisco", venue: "San Francisco Stadium" },
  { stage: "Group Stage", matchNumber: "Match 23", matchDate: "2026-06-17", teamA: "POR", teamB: "W1", city: "Houston", venue: "Houston Stadium" },
  { stage: "Group Stage", matchNumber: "Match 22", matchDate: "2026-06-17", teamA: "ENG", teamB: "CRO", city: "Dallas", venue: "Dallas Stadium" },
  { stage: "Group Stage", matchNumber: "Match 28", matchDate: "2026-06-18", teamA: "MEX", teamB: "KOR", city: "Guadalajara", venue: "Guadalajara Stadium" },
  { stage: "Group Stage", matchNumber: "Match 43", matchDate: "2026-06-22", teamA: "ARG", teamB: "AUS", city: "Dallas", venue: "Dallas Stadium" },
  { stage: "Group Stage", matchNumber: "Match 45", matchDate: "2026-06-23", teamA: "ENG", teamB: "GHA", city: "Boston", venue: "Boston Stadium" },
  { stage: "Group Stage", matchNumber: "Match 47", matchDate: "2026-06-23", teamA: "POR", teamB: "UZB", city: "Houston", venue: "Houston Stadium" },
  { stage: "Group Stage", matchNumber: "Match 51", matchDate: "2026-06-24", teamA: "SWI", teamB: "CAN", city: "Vancouver", venue: "Vancouver Stadium" },
  { stage: "Group Stage", matchNumber: "Match 53", matchDate: "2026-06-24", teamA: "MEX", teamB: "FIFA", city: "Mexico City", venue: "Mexico City Stadium" },
  { stage: "Group Stage", matchNumber: "Match 60", matchDate: "2026-06-25", teamA: "PAR", teamB: "AUS", city: "San Francisco", venue: "San Francisco Stadium" },
  { stage: "Group Stage", matchNumber: "Match 61", matchDate: "2026-06-26", teamA: "FRA", teamB: "NOR", city: "Boston", venue: "Boston Stadium" },
  { stage: "Group Stage", matchNumber: "Match 67", matchDate: "2026-06-27", teamA: "PAN", teamB: "ENG", city: "New York", venue: "New York Stadium" },
  { stage: "Group Stage", matchNumber: "Match 70", matchDate: "2026-06-27", teamA: "ARG", teamB: "JOR", city: "Dallas", venue: "Dallas Stadium" },
  { stage: "Round 32", matchNumber: "Match 73", matchDate: "2026-06-28", teamA: "2A", teamB: "2B", city: "Los Angeles", venue: "Los Angeles Stadium" },
  { stage: "Round 32", matchNumber: "Match 77", matchDate: "2026-06-30", teamA: "1I", teamB: "3CDFGH", city: "New York", venue: "New York Stadium" },
  { stage: "Round 32", matchNumber: "Match 87", matchDate: "2026-07-03", teamA: "1K", teamB: "3DEIJL", city: "Kansas", venue: "Kansas Stadium" },
  { stage: "Round 32", matchNumber: "Match 86", matchDate: "2026-07-03", teamA: "1J", teamB: "2H", city: "Miami", venue: "Miami Stadium" },
  { stage: "Round 16", matchNumber: "Match 89", matchDate: "2026-07-05", teamA: "W74", teamB: "W77", city: "Philadelphia", venue: "Philadelphia Stadium" },
  { stage: "Round 16", matchNumber: "Match 91", matchDate: "2026-07-06", teamA: "W76", teamB: "W78", city: "New York", venue: "New York Stadium" },
  { stage: "Round 16", matchNumber: "Match 93", matchDate: "2026-07-06", teamA: "W81", teamB: "W82", city: "Dallas", venue: "Dallas Stadium" },
  { stage: "Round 16", matchNumber: "Match 95", matchDate: "2026-07-08", teamA: "W86", teamB: "W88", city: "Atlanta", venue: "Atlanta Stadium" },
  { stage: "Round 16", matchNumber: "Match 96", matchDate: "2026-07-08", teamA: "W85", teamB: "W87", city: "Vancouver", venue: "Vancouver Stadium" },
  { stage: "Quarter Final", matchNumber: "Match 97", matchDate: "2026-07-10", teamA: "W89", teamB: "W90", city: "Boston", venue: "Boston Stadium" },
  { stage: "Quarter Final", matchNumber: "Match 98", matchDate: "2026-07-11", teamA: "W93", teamB: "W94", city: "Los Angeles", venue: "Los Angeles Stadium" },
  { stage: "Quarter Final", matchNumber: "Match 99", matchDate: "2026-07-12", teamA: "W91", teamB: "W92", city: "Miami", venue: "Miami Stadium" },
  { stage: "Quarter Final", matchNumber: "Match 100", matchDate: "2026-07-12", teamA: "W95", teamB: "W96", city: "Kansas", venue: "Kansas Stadium" },
  { stage: "Semi Final", matchNumber: "Match 101", matchDate: "2026-07-15", teamA: "W97", teamB: "W98", city: "Dallas", venue: "Dallas Stadium" },
  { stage: "Semi Final", matchNumber: "Match 102", matchDate: "2026-07-16", teamA: "W99", teamB: "W100", city: "Atlanta", venue: "Atlanta Stadium" },
  { stage: "Final", matchNumber: "Match 104", matchDate: "2026-07-20", teamA: "W101", teamB: "W102", city: "New York", venue: "New York Stadium" },
];

const TEAM_FLAG_MAP = {
  ALG: "🇩🇿",
  ARG: "🇦🇷",
  AUS: "🇦🇺",
  AUT: "🇦🇹",
  BEL: "🇧🇪",
  BRA: "🇧🇷",
  CAN: "🇨🇦",
  COD: "🇨🇩",
  CRO: "🇭🇷",
  CUR: "🇨🇼",
  EGY: "🇪🇬",
  ENG: "🏴",
  FRA: "🇫🇷",
  GER: "🇩🇪",
  GHA: "🇬🇭",
  JOR: "🇯🇴",
  JPN: "🇯🇵",
  KOR: "🇰🇷",
  MAR: "🇲🇦",
  MEX: "🇲🇽",
  NED: "🇳🇱",
  NOR: "🇳🇴",
  PAN: "🇵🇦",
  PAR: "🇵🇾",
  POR: "🇵🇹",
  RSA: "🇿🇦",
  SEN: "🇸🇳",
  SWI: "🇨🇭",
  TUR: "🇹🇷",
  USA: "🇺🇸",
  UZB: "🇺🇿",
};

const STAGE_LABELS = {
  Opening: "Нээлтийн тоглолт",
  "Group Stage": "Хэсгийн шат",
  "Round 32": "32-ын шат",
  "Round 16": "16-ын шат",
  "Quarter Final": "Шөвгийн 8",
  "Semi Final": "Хагас шигшээ",
  Final: "Шигшээ тоглолт",
};

const state = {
  tickets: [],
  expandedMatches: new Set(),
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

function fillSelectFromOptions(node, options, placeholder) {
  if (!node) return;
  node.innerHTML = [`<option value="">${placeholder}</option>`]
    .concat(options.map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`))
    .join("");
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("mn-MN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function naturalTextCompare(left, right) {
  return String(left || "").localeCompare(String(right || ""), undefined, { numeric: true, sensitivity: "base" });
}

function matchNumberSortValue(value) {
  const match = String(value || "").match(/(\d+)/);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function normalizedCategory(ticket) {
  const code = String(ticket.categoryCode || "").trim();
  if (["1", "2", "3"].includes(code)) return code;
  const digits = code.replace(/\D+/g, "");
  return ["1", "2", "3"].includes(digits) ? digits : "";
}

function teamDisplay(code) {
  const teamCode = String(code || "").trim().toUpperCase();
  if (!teamCode) return "";
  const flag = TEAM_FLAG_MAP[teamCode];
  return flag ? `${flag} ${teamCode}` : teamCode;
}

function buildMatchLabel(teamA, teamB) {
  const left = String(teamA || "").trim();
  const right = String(teamB || "").trim();
  if (!left && !right) return "";
  if (!left || !right) return teamDisplay(left || right);
  return `${teamDisplay(left)} vs ${teamDisplay(right)}`;
}

function stageLabel(stage) {
  return STAGE_LABELS[String(stage || "").trim()] || String(stage || "-");
}

function ticketSeatLabel(ticket) {
  return String(ticket.seatDetails || "").trim() || "Суудлын дугаар дараа оноогдоно";
}

function ticketCategoryLabel(categoryCode) {
  return categoryCode ? `CAT ${categoryCode}` : "Ангилал тодорхойгүй";
}

function buildCatalogRows() {
  const groups = new Map();

  MATCH_CATALOG.forEach((match) => {
    const key = match.matchNumber || [match.matchDate, match.teamA, match.teamB, match.city].join("|");
    groups.set(key, {
      key,
      matchNumber: match.matchNumber || "",
      matchDate: match.matchDate || "",
      stage: match.stage || "",
      city: match.city || "",
      venue: match.venue || "",
      teamA: match.teamA || "",
      teamB: match.teamB || "",
      label: buildMatchLabel(match.teamA, match.teamB),
      tickets: [],
      categoryBreakdown: [
        { categoryCode: "1", available: 0, total: 0 },
        { categoryCode: "2", available: 0, total: 0 },
        { categoryCode: "3", available: 0, total: 0 },
      ],
    });
  });

  state.tickets.forEach((ticket) => {
    const key = ticket.matchNumber || [ticket.matchDate, ticket.teamA, ticket.teamB, ticket.city].join("|");
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        matchNumber: ticket.matchNumber || "",
        matchDate: ticket.matchDate || "",
        stage: ticket.stage || "",
        city: ticket.city || "",
        venue: ticket.venue || "",
        teamA: ticket.teamA || "",
        teamB: ticket.teamB || "",
        label: ticket.matchLabel || buildMatchLabel(ticket.teamA, ticket.teamB),
        tickets: [],
        categoryBreakdown: [
          { categoryCode: "1", available: 0, total: 0 },
          { categoryCode: "2", available: 0, total: 0 },
          { categoryCode: "3", available: 0, total: 0 },
        ],
      });
    }

    const group = groups.get(key);
    group.label = group.label || ticket.matchLabel || buildMatchLabel(ticket.teamA, ticket.teamB);
    group.tickets.push(ticket);

    const categoryCode = normalizedCategory(ticket);
    const category = group.categoryBreakdown.find((item) => item.categoryCode === categoryCode);
    if (category) {
      category.available += Number(ticket.availableQuantity || 0);
      category.total += Number(ticket.totalQuantity || 0);
    }
  });

  return [...groups.values()]
    .map((row) => ({
      ...row,
      tickets: [...row.tickets].sort((left, right) => {
        const categoryDiff = Number(normalizedCategory(left) || 0) - Number(normalizedCategory(right) || 0);
        if (categoryDiff !== 0) return categoryDiff;
        return naturalTextCompare(ticketSeatLabel(left), ticketSeatLabel(right));
      }),
    }))
    .sort((left, right) => {
      const dateDiff = String(left.matchDate || "").localeCompare(String(right.matchDate || ""));
      if (dateDiff !== 0) return dateDiff;
      return matchNumberSortValue(left.matchNumber) - matchNumberSortValue(right.matchNumber);
    })
    .map((row, index) => ({ ...row, number: index + 1 }));
}

function filteredRows() {
  const query = filters.search.value.trim().toLowerCase();
  return buildCatalogRows().filter((row) => {
    if (filters.stage.value && row.stage !== filters.stage.value) return false;
    if (filters.city.value && row.city !== filters.city.value) return false;
    if (filters.category.value) {
      const category = row.categoryBreakdown.find((item) => item.categoryCode === filters.category.value);
      if (!category || !Number(category.available || 0)) return false;
    }
    if (filters.dateFrom.value && row.matchDate < filters.dateFrom.value) return false;
    if (filters.dateTo.value && row.matchDate > filters.dateTo.value) return false;
    if (!query) return true;
    return [
      row.matchNumber,
      row.label,
      row.city,
      row.stage,
      row.venue,
      ...row.tickets.map((ticket) => `${ticketCategoryLabel(normalizedCategory(ticket))} ${ticketSeatLabel(ticket)}`),
    ].some((value) => String(value || "").toLowerCase().includes(query));
  });
}

function renderTicketTable(row) {
  if (!row.tickets.length) {
    return '<p class="empty">Энэ тоглолтод одоогоор нийтлэгдсэн билет алга байна.</p>';
  }

  return `
    <table class="manager-table fifa-table fifa-nested-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Ангилал</th>
          <th>Суудал / Билет</th>
          <th>Үлдэгдэл</th>
          <th>Тайлбар</th>
        </tr>
      </thead>
      <tbody>
        ${row.tickets
          .map((ticket, index) => {
            const categoryCode = normalizedCategory(ticket);
            const available = Number(ticket.availableQuantity || 0);
            const total = Number(ticket.totalQuantity || 0);
            const noteParts = [];
            if (ticket.seatSection) noteParts.push(ticket.seatSection);
            if (ticket.categoryName) noteParts.push(ticket.categoryName);
            return `
              <tr>
                <td>${index + 1}</td>
                <td>
                  <strong>${escapeHtml(ticketCategoryLabel(categoryCode))}</strong>
                </td>
                <td>
                  <strong>${escapeHtml(ticketSeatLabel(ticket))}</strong>
                </td>
                <td>
                  <strong>${escapeHtml(String(available))}</strong>
                  <span class="fifa-table-sub">Нийт: ${escapeHtml(String(total))}</span>
                </td>
                <td>
                  <span class="fifa-table-sub">${escapeHtml(noteParts.join(" · ") || "Нэмэлт мэдээлэлгүй")}</span>
                </td>
              </tr>
            `;
          })
          .join("")}
      </tbody>
    </table>
  `;
}

function renderPublicTickets() {
  const rows = filteredRows();
  const availableTickets = rows.reduce(
    (sum, row) => sum + row.categoryBreakdown.reduce((categorySum, item) => categorySum + Number(item.available || 0), 0),
    0
  );

  if (publicSummaryLots) publicSummaryLots.textContent = String(rows.length);
  if (publicSummaryUnits) publicSummaryUnits.textContent = String(availableTickets);
  if (publicListCount) publicListCount.textContent = `${rows.length} тоглолт`;
  if (publicListMeta) publicListMeta.textContent = `Нийт боломжтой билет: ${availableTickets}`;

  if (!rows.length) {
    publicList.innerHTML = '<p class="empty">Шүүлтүүрт тохирох тоглолт олдсонгүй.</p>';
    return;
  }

  publicList.innerHTML = `
    <div class="fifa-match-accordion fifa-match-accordion--table fifa-public-match-list">
      <div class="fifa-match-table-head">
        <span>#</span>
        <span>Огноо</span>
        <span>Тоглолт</span>
        <span>Билет</span>
        <span>Хот</span>
        <span>Шат</span>
      </div>
      ${rows
        .map((row) => {
          const isExpanded = state.expandedMatches.has(row.key);
          const availabilitySummary = row.categoryBreakdown
            .filter((item) => item.available > 0)
            .map((item) => `${ticketCategoryLabel(item.categoryCode)}: ${item.available}`)
            .join(" · ");
          const totalAvailable = row.categoryBreakdown.reduce((sum, item) => sum + Number(item.available || 0), 0);
          return `
            <article class="fifa-match-card ${isExpanded ? "is-open" : ""}">
              <div class="fifa-match-toggle" data-action="toggle-match" data-match-key="${escapeHtml(row.key)}" role="button" tabindex="0">
                <div class="fifa-match-col fifa-match-col--number">
                  <strong>${isExpanded ? "▾" : "▸"} ${row.number}</strong>
                </div>
                <div class="fifa-match-col">
                  <strong>${escapeHtml(formatDate(row.matchDate))}</strong>
                  <span class="fifa-table-sub">${escapeHtml(row.matchNumber || "-")}</span>
                </div>
                <div class="fifa-match-col fifa-match-col--teams">
                  <strong>${escapeHtml(row.label || "Тоглолтын мэдээлэлгүй")}</strong>
                  <span class="fifa-table-sub">${escapeHtml(row.venue || "Цэнгэлдэх мэдээлэлгүй")}</span>
                </div>
                <div class="fifa-match-col fifa-match-col--availability">
                  <strong>${escapeHtml(availabilitySummary || "Боломжтой билет алга")}</strong>
                  <span class="fifa-table-sub">${escapeHtml(String(totalAvailable))} боломжтой билет</span>
                </div>
                <div class="fifa-match-col">
                  <strong>${escapeHtml(row.city || "-")}</strong>
                </div>
                <div class="fifa-match-col">
                  <strong>${escapeHtml(stageLabel(row.stage))}</strong>
                </div>
              </div>
              ${
                isExpanded
                  ? `
                    <div class="fifa-match-details">
                      ${renderTicketTable(row)}
                    </div>
                  `
                  : ""
              }
            </article>
          `;
        })
        .join("")}
    </div>
  `;
}

function toggleMatch(key) {
  if (!key) return;
  if (state.expandedMatches.has(key)) {
    state.expandedMatches.delete(key);
  } else {
    state.expandedMatches.add(key);
  }
  renderPublicTickets();
}

async function fetchPublicTickets() {
  const response = await fetch("/api/fifa2026/public");
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Тасалбарын мэдээлэл ачаалж чадсангүй");
  }
  state.tickets = data.tickets || [];
  const rows = buildCatalogRows();
  fillSelectFromOptions(
    filters.stage,
    [...new Set(rows.map((row) => row.stage).filter(Boolean))].map((value) => ({ value, label: stageLabel(value) })),
    "Бүх шат"
  );
  fillSelect(filters.city, [...new Set(rows.map((row) => row.city).filter(Boolean))], "Бүх хот");
  fillSelectFromOptions(
    filters.category,
    ["1", "2", "3"].map((value) => ({ value, label: ticketCategoryLabel(value) })),
    "Бүх ангилал"
  );
  renderPublicTickets();
}

Object.values(filters).forEach((node) => {
  node?.addEventListener("input", renderPublicTickets);
  node?.addEventListener("change", renderPublicTickets);
});

publicList?.addEventListener("click", (event) => {
  const toggle = event.target.closest('[data-action="toggle-match"]');
  if (!toggle) return;
  toggleMatch(toggle.dataset.matchKey || "");
});

publicList?.addEventListener("keydown", (event) => {
  const toggle = event.target.closest('[data-action="toggle-match"]');
  if (!toggle) return;
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  toggleMatch(toggle.dataset.matchKey || "");
});

fetchPublicTickets().catch((error) => {
  publicList.innerHTML = `<p class="empty">${escapeHtml(error.message)}</p>`;
});
