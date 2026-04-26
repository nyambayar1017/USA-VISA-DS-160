const publicList = document.querySelector("#fifa-public-list");
const publicSummaryLots = document.querySelector("#public-summary-lots");
const publicSummaryTotal = document.querySelector("#public-summary-total");
const publicSummaryUnits = document.querySelector("#public-summary-units");
const publicListCount = document.querySelector("#public-list-count");
const publicListMeta = document.querySelector("#public-list-meta");
const publicGroups = document.querySelector("#fifa-public-groups");
const publicBracket = document.querySelector("#fifa-public-bracket");
const mobileMenuToggle = document.querySelector("#travelx-mobile-menu-toggle");
const mobileMenu = document.querySelector("#travelx-mobile-menu");

const filters = {
  search: document.querySelector("#public-filter-search"),
  stage: document.querySelector("#public-filter-stage"),
  city: document.querySelector("#public-filter-city"),
  category: document.querySelector("#public-filter-category"),
  dateFrom: document.querySelector("#public-filter-date-from"),
  dateTo: document.querySelector("#public-filter-date-to"),
};

const PUBLIC_SHOWCASE_MATCH_COUNT = 38;
const PUBLIC_SHOWCASE_TOTAL_TICKETS = 3340;
const PUBLIC_PAGE_SIZE = 15;
const ENGLAND_FLAG = "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}";
const SCOTLAND_FLAG = "\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}";
const STADIUM_IMAGE_MAP = {
  "Mexico City": { title: "MEXICO CITY - Estadio Azteca Stadium", file: "MEXICO CITY - Estadio Azteca Stadium.png" },
  "Los Angeles": { title: "LOS ANGELES - SoFi Stadium", file: "LOS ANGELES - SoFi Stadium.png" },
  Vancouver: { title: "VANCOUVER - BC Place Stadium", file: "VANCOUVER - BC Place Stadium.png" },
  "New York": { title: "NEW YORK NEW JERSEY - MetLife Stadium", file: "NEW YORK NEW JERSEY - MetLife Stadium.png" },
  Houston: { title: "HOUSTON - NRG Stadium", file: "HOUSTON - NRG Stadium.png" },
  Dallas: { title: "DALLAS - AT&T Stadium", file: "DALLAS - AT&T Stadium.png" },
  Seattle: { title: "SEATTLE - Lumen Field Stadium", file: "SEATTLE - Lumen Field Stadium.png" },
  Kansas: { title: "KANSAS CITY - ARROWHEAD Stadium", file: "KANSAS CITY - ARROWHEAD Stadium.png" },
  "San Francisco": { title: "SAN FRANCISCO BAY AREA - Levi's Stadium", file: "SAN FRANCISCO BAY AREA - Levi's Stadium.png" },
  Guadalajara: { title: "GUADALAJARA - Akron Stadium", file: "GUADALAJARA - Akron Stadium.png" },
  Boston: { title: "BOSTON - Gillette Stadium", file: "BOSTON - Gillette Stadium.png" },
  Miami: { title: "MIAMI - Hard Rock Stadium", file: "MIAMI - Hard Rock Stadium.png" },
  Philadelphia: { title: "PHILADELPHIA - Lincoln Financial Field Stadium", file: "PHILADELPHIA - Lincoln Financial Field Stadium.png" },
  Atlanta: { title: "ATLANTA - Mercedes-Benz Stadium", file: "ATLANTA - Mercedes-Benz Stadium.png" },
};

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
  CZE: "🇨🇿",
  EGY: "🇪🇬",
  ENG: ENGLAND_FLAG,
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
  mobileMenuOpen: false,
  publicPage: 1,
};

function ensureStadiumModal() {
  let modal = document.querySelector("#fifa-stadium-modal");
  if (modal) return modal;
  modal = document.createElement("div");
  modal.id = "fifa-stadium-modal";
  modal.className = "camp-modal is-hidden fifa-form-modal fifa-stadium-modal";
  modal.setAttribute("aria-hidden", "true");
  modal.hidden = true;
  modal.innerHTML = `
    <div class="camp-modal-backdrop" data-action="close-stadium-modal"></div>
    <div class="camp-modal-dialog fifa-form-modal-dialog fifa-stadium-modal-dialog">
      <div class="camp-modal-header">
        <div class="camp-modal-copy">
          <h2 id="fifa-stadium-modal-title">Стадион зураг</h2>
          <p>Суудлын байршлын зургийг бүтэн дэлгэцээр харах боломжтой.</p>
        </div>
        <button type="button" class="camp-modal-close" data-action="close-stadium-modal" aria-label="Close">×</button>
      </div>
      <div class="fifa-stadium-modal-body">
        <img id="fifa-stadium-modal-image" src="" alt="" />
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  return modal;
}

const stadiumModal = ensureStadiumModal();
const stadiumModalTitle = stadiumModal.querySelector("#fifa-stadium-modal-title");
const stadiumModalImage = stadiumModal.querySelector("#fifa-stadium-modal-image");
stadiumModal.addEventListener("click", (event) => {
  if (event.target.closest('[data-action="close-stadium-modal"]')) {
    closeStadiumModal();
  }
});

function closeStadiumModal() {
  stadiumModal.classList.add("is-hidden");
  stadiumModal.hidden = true;
  stadiumModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

function openStadiumModal(location) {
  const stadium = STADIUM_IMAGE_MAP[location];
  if (!stadium) return;
  stadiumModalTitle.textContent = stadium.title;
  stadiumModalImage.src = `/stadiums/${encodeURIComponent(stadium.file)}`;
  stadiumModalImage.alt = stadium.title;
  stadiumModal.classList.remove("is-hidden");
  stadiumModal.hidden = false;
  stadiumModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  stadiumModal.querySelector(".camp-modal-dialog")?.scrollTo({ top: 0 });
}

const GROUP_STAGE_TABLES = [
  { group: "A", teams: [["🇲🇽", "Mexico"], ["🇿🇦", "South Africa"], ["🇰🇷", "Korea Republic"], ["🇨🇿", "Czechia"]] },
  { group: "B", teams: [["🇨🇦", "Canada"], ["🇧🇦", "Bosnia-Herzegovina"], ["🇶🇦", "Qatar"], ["🇨🇭", "Switzerland"]] },
  { group: "C", teams: [["🇧🇷", "Brazil"], ["🇲🇦", "Morocco"], ["🇭🇹", "Haiti"], [SCOTLAND_FLAG, "Scotland"]] },
  { group: "D", teams: [["🇺🇸", "USA"], ["🇵🇾", "Paraguay"], ["🇦🇺", "Australia"], ["🇹🇷", "Türkiye"]] },
  { group: "E", teams: [["🇩🇪", "Germany"], ["🇨🇼", "Curaçao"], ["🇨🇮", "Côte d'Ivoire"], ["🇪🇨", "Ecuador"]] },
  { group: "F", teams: [["🇳🇱", "Netherlands"], ["🇯🇵", "Japan"], ["🇸🇪", "Sweden"], ["🇹🇳", "Tunisia"]] },
  { group: "G", teams: [["🇧🇪", "Belgium"], ["🇪🇬", "Egypt"], ["🇮🇷", "IR Iran"], ["🇳🇿", "New Zealand"]] },
  { group: "H", teams: [["🇪🇸", "Spain"], ["🇨🇻", "Cabo Verde"], ["🇸🇦", "Saudi Arabia"], ["🇺🇾", "Uruguay"]] },
  { group: "I", teams: [["🇫🇷", "France"], ["🇸🇳", "Senegal"], ["🇮🇶", "Iraq"], ["🇳🇴", "Norway"]] },
  { group: "J", teams: [["🇦🇷", "Argentina"], ["🇩🇿", "Algeria"], ["🇦🇹", "Austria"], ["🇯🇴", "Jordan"]] },
  { group: "K", teams: [["🇵🇹", "Portugal"], ["🇨🇩", "Congo DR"], ["🇺🇿", "Uzbekistan"], ["🇨🇴", "Colombia"]] },
  { group: "L", teams: [[ENGLAND_FLAG, "England"], ["🇭🇷", "Croatia"], ["🇬🇭", "Ghana"], ["🇵🇦", "Panama"]] },
];

const KNOCKOUT_BRACKET_COLUMNS = [
  {
    title: "Round of 32",
    matches: [
      ["M74", "1E", "3ABCDF"],
      ["M77", "1I", "3CDFGH"],
      ["M73", "2A", "2B"],
      ["M75", "1F", "2C"],
      ["M83", "2K", "2L"],
      ["M84", "1H", "2J"],
      ["M81", "1D", "3BEFIJ"],
      ["M82", "1G", "3AEHIJ"],
    ],
  },
  {
    title: "Round of 16",
    matches: [
      ["M89", "W74", "W77"],
      ["M90", "W73", "W75"],
      ["M93", "W83", "W84"],
      ["M94", "W81", "W82"],
    ],
  },
  {
    title: "Quarter-final",
    matches: [
      ["M97", "W89", "W90"],
      ["M98", "W93", "W94"],
    ],
  },
  {
    title: "Semi-final",
    matches: [
      ["M101", "W97", "W98"],
    ],
  },
  {
    title: "Final",
    featured: true,
    matches: [
      ["M104", "W101", "W102"],
      ["M103", "RU101", "RU102", "Play-off for third place"],
    ],
  },
  {
    title: "Semi-final",
    matches: [
      ["M102", "W99", "W100"],
    ],
  },
  {
    title: "Quarter-final",
    matches: [
      ["M99", "W91", "W92"],
      ["M100", "W95", "W96"],
    ],
  },
  {
    title: "Round of 16",
    matches: [
      ["M91", "W76", "W78"],
      ["M92", "W79", "W80"],
      ["M95", "W86", "W88"],
      ["M96", "W85", "W87"],
    ],
  },
  {
    title: "Round of 32",
    matches: [
      ["M76", "1C", "2F"],
      ["M78", "2E", "2I"],
      ["M79", "1A", "3CEFHI"],
      ["M80", "1L", "3EHIJK"],
      ["M86", "1J", "2H"],
      ["M88", "2D", "2G"],
      ["M85", "1B", "3EFGIJ"],
      ["M87", "1K", "3DEIJL"],
    ],
  },
];

const KNOCKOUT_MATCH_META = {
  M73: { date: "06/28/2026", time: "" },
  M74: { date: "06/29/2026", time: "" },
  M75: { date: "06/29/2026", time: "" },
  M76: { date: "06/29/2026", time: "" },
  M77: { date: "06/30/2026", time: "" },
  M78: { date: "06/30/2026", time: "" },
  M79: { date: "06/30/2026", time: "" },
  M80: { date: "07/01/2026", time: "" },
  M81: { date: "07/01/2026", time: "" },
  M82: { date: "07/01/2026", time: "" },
  M83: { date: "07/02/2026", time: "" },
  M84: { date: "07/02/2026", time: "" },
  M85: { date: "07/02/2026", time: "" },
  M86: { date: "07/03/2026", time: "" },
  M87: { date: "07/03/2026", time: "" },
  M88: { date: "07/03/2026", time: "" },
  M89: { date: "07/04/2026", time: "" },
  M90: { date: "07/04/2026", time: "" },
  M91: { date: "07/05/2026", time: "" },
  M92: { date: "07/05/2026", time: "" },
  M93: { date: "07/06/2026", time: "" },
  M94: { date: "07/06/2026", time: "" },
  M95: { date: "07/07/2026", time: "" },
  M96: { date: "07/07/2026", time: "" },
  M97: { date: "07/09/2026", time: "" },
  M98: { date: "07/10/2026", time: "" },
  M99: { date: "07/11/2026", time: "" },
  M100: { date: "07/11/2026", time: "" },
  M101: { date: "07/14/2026", time: "" },
  M102: { date: "07/15/2026", time: "" },
  M103: { date: "07/18/2026", time: "" },
  M104: { date: "07/19/2026", time: "" },
};

function setMobileMenuOpen(isOpen) {
  state.mobileMenuOpen = Boolean(isOpen);
  if (mobileMenu) mobileMenu.hidden = !state.mobileMenuOpen;
  if (mobileMenuToggle) mobileMenuToggle.setAttribute("aria-expanded", state.mobileMenuOpen ? "true" : "false");
  document.body.classList.toggle("travelx-menu-open", state.mobileMenuOpen);
}

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

function paginateItems(items, page, pageSize = PUBLIC_PAGE_SIZE) {
  const totalPages = Math.max(Math.ceil(items.length / pageSize), 1);
  const currentPage = Math.min(Math.max(Number(page || 1), 1), totalPages);
  const start = (currentPage - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    currentPage,
    totalPages,
    startIndex: start,
    totalItems: items.length,
  };
}

function formatDate(value) {
  if (!value) return "-";
  const normalized = String(value).slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString().slice(0, 10);
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

function normalizeTicketMatchData(ticket) {
  if (!ticket || typeof ticket !== "object") return ticket;
  const matchNumber = String(ticket.matchNumber || "").trim().toLowerCase();
  const teamA = String(ticket.teamA || "").trim().toUpperCase();
  const teamB = String(ticket.teamB || "").trim().toUpperCase();
  if (matchNumber === "match 53" && teamA === "MEX" && ["FIFA", "CZECH", "CZECHIA", ""].includes(teamB)) {
    return {
      ...ticket,
      teamB: "CZE",
      matchLabel: !ticket.matchLabel || String(ticket.matchLabel).toUpperCase().includes("FIFA") ? "MEX vs CZE" : ticket.matchLabel,
    };
  }
  return ticket;
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

function publicMatchLabel(ticket) {
  const liveLabel = buildMatchLabel(ticket.teamA, ticket.teamB);
  return liveLabel || String(ticket.matchLabel || "").trim();
}

function stageLabel(stage) {
  return STAGE_LABELS[String(stage || "").trim()] || String(stage || "-");
}

function ticketSeatLabel(ticket) {
  const seat = String(ticket.seatDetails || "").trim();
  if (!seat || /seat will be assigned later/i.test(seat)) return "Суудал хараахан гараагүй байна";
  return seat;
}

function ticketCategoryLabel(categoryCode) {
  return categoryCode ? `Кат ${categoryCode}` : "Ангилал тодорхойгүй";
}

function buildCatalogRows() {
  const groups = new Map();

  state.tickets.forEach((ticket) => {
    const key = ticket.matchNumber || [ticket.matchDate, ticket.teamA, ticket.teamB, ticket.city].join("|");
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        matchNumber: ticket.matchNumber || "",
        matchDate: ticket.matchDate || "",
        stage: ticket.stage || "",
        groupLabel: ticket.groupLabel || "",
        city: ticket.city || "",
        venue: ticket.venue || "",
        teamA: ticket.teamA || "",
        teamB: ticket.teamB || "",
        label: publicMatchLabel(ticket),
        tickets: [],
        categoryBreakdown: [
          { categoryCode: "1", available: 0, total: 0 },
          { categoryCode: "2", available: 0, total: 0 },
          { categoryCode: "3", available: 0, total: 0 },
        ],
      });
    }

    const group = groups.get(key);
    group.label = publicMatchLabel(ticket) || group.label;
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
    .filter((row) =>
      row.tickets.some((ticket) => Number(ticket.totalQuantity || 0) > 0 || Number(ticket.soldQuantity || 0) > 0 || Number(ticket.availableQuantity || 0) > 0)
    )
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
      row.groupLabel,
      row.stage,
      row.venue,
      ...row.tickets.map((ticket) => `${ticketCategoryLabel(normalizedCategory(ticket))} ${ticketSeatLabel(ticket)}`),
    ].some((value) => String(value || "").toLowerCase().includes(query));
  });
}

function renderTicketTable(row) {
  const visibleTickets = row.tickets.filter((ticket) => Number(ticket.availableQuantity || 0) > 0);
  if (!visibleTickets.length) {
    return '<p class="empty">Энэ тоглолтод одоогоор нийтлэгдсэн билет алга байна.</p>';
  }

  return `
    <table class="manager-table fifa-table fifa-nested-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Ангилал</th>
          <th>Суудал / Билет</th>
          <th>Стадион</th>
        </tr>
      </thead>
      <tbody>
        ${visibleTickets
          .map((ticket, index) => {
            const categoryCode = normalizedCategory(ticket);
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
                  <button
                    type="button"
                    class="button-secondary fifa-inline-action fifa-stadium-button"
                    data-action="open-stadium-image"
                    data-stadium-location="${escapeHtml(ticket.city || row.city || "")}"
                  >
                    ${escapeHtml(ticket.venue || row.venue || ticket.city || row.city || "Стадион")}
                  </button>
                </td>
              </tr>
            `;
          })
          .join("")}
      </tbody>
    </table>
  `;
}

function renderPublicPagination(pagination) {
  if (pagination.totalItems <= PUBLIC_PAGE_SIZE) return "";
  return `
    <div class="table-pagination fifa-public-pagination">
      <p>Хуудас ${pagination.currentPage}/${pagination.totalPages}</p>
      <div class="pagination-actions">
        <button type="button" class="button-secondary" data-action="paginate-public" data-page="${pagination.currentPage - 1}" ${pagination.currentPage <= 1 ? "disabled" : ""}>Өмнөх</button>
        <button type="button" class="button-secondary" data-action="paginate-public" data-page="${pagination.currentPage + 1}" ${pagination.currentPage >= pagination.totalPages ? "disabled" : ""}>Дараах</button>
      </div>
    </div>
  `;
}

function renderGroupStageTables() {
  if (!publicGroups) return;
  publicGroups.innerHTML = GROUP_STAGE_TABLES.map((group) => `
    <article class="fifa-group-card">
      <div class="fifa-group-card__head">
        <h3>Group ${escapeHtml(group.group)}</h3>
      </div>
      <ol class="fifa-group-card__list">
        ${group.teams.map(([flag, name], index) => `
          <li>
            <span class="fifa-group-rank">${index + 1}</span>
            <span class="fifa-group-team-flag">${escapeHtml(flag)}</span>
            <span class="fifa-group-team-name">${escapeHtml(name)}</span>
          </li>
        `).join("")}
      </ol>
    </article>
  `).join("");
}

function renderKnockoutBracket() {
  if (!publicBracket) return;
  publicBracket.innerHTML = `
    <div class="fifa-knockout-grid fifa-knockout-grid--public">
      ${KNOCKOUT_BRACKET_COLUMNS.map((column, index) => `
        <section class="fifa-knockout-round${column.featured ? " is-featured" : ""}" data-round-index="${index}">
          <div class="fifa-knockout-round__head">${escapeHtml(column.title)}</div>
          <div class="fifa-knockout-round__matches">
            ${column.matches.map((match) => `
              <article class="fifa-knockout-match${column.featured ? " is-featured" : ""}">
                ${match[3] ? `<p class="fifa-knockout-match__label">${escapeHtml(match[3])}</p>` : ""}
                ${column.title === "Final" && match[0] === "M104" ? `<p class="fifa-knockout-match__label fifa-knockout-match__label--final">🏆 Final</p>` : ""}
                <div class="fifa-knockout-match__meta">
                  <strong>${escapeHtml(match[0])}</strong>
                  <span class="fifa-knockout-match__date">${escapeHtml(KNOCKOUT_MATCH_META[match[0]]?.date || "")}</span>
                </div>
                <div class="fifa-knockout-match__body">
                  <span>${escapeHtml(match[1])}</span>
                  <span>${escapeHtml(match[2])}</span>
                </div>
              </article>
            `).join("")}
          </div>
        </section>
      `).join("")}
    </div>
  `;
}

function renderPublicTickets() {
  const rows = filteredRows();
  const pagination = paginateItems(rows, state.publicPage);
  state.publicPage = pagination.currentPage;
  const availableTickets = rows.reduce(
    (sum, row) => sum + row.categoryBreakdown.reduce((categorySum, item) => categorySum + Number(item.available || 0), 0),
    0
  );

  if (publicSummaryLots) publicSummaryLots.textContent = String(PUBLIC_SHOWCASE_MATCH_COUNT);
  if (publicSummaryTotal) publicSummaryTotal.textContent = String(PUBLIC_SHOWCASE_TOTAL_TICKETS);
  if (publicSummaryUnits) publicSummaryUnits.textContent = String(availableTickets);
  if (publicListCount) publicListCount.textContent = `${rows.length} тоглолт`;
  if (publicListMeta) publicListMeta.textContent = rows.length > PUBLIC_PAGE_SIZE
    ? `Нийт боломжтой билет: ${availableTickets} · Хуудас ${pagination.currentPage}/${pagination.totalPages}`
    : `Нийт боломжтой билет: ${availableTickets}`;

  if (!rows.length) {
    publicList.innerHTML = '<p class="empty">Шүүлтүүрт тохирох тоглолт олдсонгүй.</p>';
    return;
  }

  const renderCatNumberCell = (row, code) => {
    const cat = row.categoryBreakdown.find((item) => item.categoryCode === code);
    const available = cat ? Number(cat.available || 0) : 0;
    const display = available > 0 ? String(available) : "—";
    const emptyClass = available > 0 ? "" : "fifa-cat-empty";
    return `
      <div class="fifa-match-col fifa-match-col--cat">
        <strong class="${emptyClass}">${display}</strong>
      </div>
    `;
  };

  publicList.innerHTML = `
    <div class="fifa-match-accordion fifa-match-accordion--table fifa-public-match-list">
      <div class="fifa-match-table-head">
        <span>#</span>
        <span>Огноо</span>
        <span>Тоглолт</span>
        <span>Кат 1</span>
        <span>Кат 2</span>
        <span>Кат 3</span>
        <span>Нийт</span>
        <span>Хот</span>
        <span>Хэсэг</span>
        <span>Шат</span>
        <span>Суудал</span>
      </div>
      ${pagination.items
        .map((row) => {
          const isExpanded = state.expandedMatches.has(row.key);
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
                ${renderCatNumberCell(row, "1")}
                ${renderCatNumberCell(row, "2")}
                ${renderCatNumberCell(row, "3")}
                <div class="fifa-match-col fifa-match-col--total">
                  <strong>${totalAvailable}</strong>
                </div>
                <div class="fifa-match-col">
                  <strong>${escapeHtml(row.city || "-")}</strong>
                </div>
                <div class="fifa-match-col fifa-match-col--group">
                  <strong>${escapeHtml(row.groupLabel || "-")}</strong>
                </div>
                <div class="fifa-match-col">
                  <strong>${escapeHtml(stageLabel(row.stage))}</strong>
                </div>
                <div class="fifa-match-col fifa-match-col--actions">
                  <button type="button" class="button-secondary fifa-inline-action" data-action="toggle-match" data-match-key="${escapeHtml(row.key)}">
                    ${isExpanded ? "Суудал нуух" : "Суудал харах"}
                  </button>
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
    ${renderPublicPagination(pagination)}
  `;
}

function toggleMatch(key) {
  if (!key) return;
  if (state.expandedMatches.has(key)) {
    state.expandedMatches.delete(key);
  } else {
    state.expandedMatches = new Set([key]);
  }
  renderPublicTickets();
}

async function fetchPublicTickets() {
  const response = await fetch("/api/fifa2026/public");
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Тасалбарын мэдээлэл ачаалж чадсангүй");
  }
  state.tickets = (data.tickets || []).map(normalizeTicketMatchData);
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
  node?.addEventListener("input", () => {
    state.publicPage = 1;
    renderPublicTickets();
  });
  node?.addEventListener("change", () => {
    state.publicPage = 1;
    renderPublicTickets();
  });
});

publicList?.addEventListener("click", (event) => {
  const pageButton = event.target.closest('[data-action="paginate-public"]');
  if (pageButton) {
    state.publicPage = Math.max(Number(pageButton.dataset.page || 1), 1);
    renderPublicTickets();
    return;
  }
  const stadiumButton = event.target.closest('[data-action="open-stadium-image"]');
  if (stadiumButton) {
    openStadiumModal(stadiumButton.dataset.stadiumLocation || "");
    return;
  }
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

mobileMenuToggle?.addEventListener("click", () => {
  setMobileMenuOpen(!state.mobileMenuOpen);
});

mobileMenu?.addEventListener("click", (event) => {
  if (event.target === mobileMenu) {
    setMobileMenuOpen(false);
    return;
  }
  if (event.target.closest("a")) {
    setMobileMenuOpen(false);
  }
});

window.addEventListener("resize", () => {
  if (window.innerWidth > 980 && state.mobileMenuOpen) {
    setMobileMenuOpen(false);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !stadiumModal.classList.contains("is-hidden")) {
    closeStadiumModal();
  }
});

fetchPublicTickets().catch((error) => {
  publicList.innerHTML = `<p class="empty">${escapeHtml(error.message)}</p>`;
});

renderGroupStageTables();
renderKnockoutBracket();
