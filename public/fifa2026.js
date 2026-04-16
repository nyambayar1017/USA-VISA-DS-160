const publicList = document.querySelector("#fifa-public-list");
const publicSummaryLots = document.querySelector("#public-summary-lots");
const publicSummaryTotal = document.querySelector("#public-summary-total");
const publicSummaryUnits = document.querySelector("#public-summary-units");
const publicListCount = document.querySelector("#public-list-count");
const publicListMeta = document.querySelector("#public-list-meta");
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
  mobileMenuOpen: false,
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
  return String(ticket.seatDetails || "").trim() || "Суудлын дугаар дараа оноогдоно";
}

function ticketCategoryLabel(categoryCode) {
  return categoryCode ? `CAT ${categoryCode}` : "Ангилал тодорхойгүй";
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
          <th>Үлдэгдэл</th>
          <th>Тайлбар</th>
        </tr>
      </thead>
      <tbody>
        ${visibleTickets
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

  if (publicSummaryLots) publicSummaryLots.textContent = String(PUBLIC_SHOWCASE_MATCH_COUNT);
  if (publicSummaryTotal) publicSummaryTotal.textContent = String(PUBLIC_SHOWCASE_TOTAL_TICKETS);
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
        <span>Хэсэг</span>
        <span>Шат</span>
        <span>Суудал</span>
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
                  <strong>${escapeHtml(availabilitySummary || "Боломжит билет алга")}</strong>
                  <span class="fifa-table-sub">${escapeHtml(String(totalAvailable))} боломжтой билет</span>
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

fetchPublicTickets().catch((error) => {
  publicList.innerHTML = `<p class="empty">${escapeHtml(error.message)}</p>`;
});
