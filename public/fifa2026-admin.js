const ticketForm = document.querySelector("#fifa-ticket-form");
const saleForm = document.querySelector("#fifa-sale-form");
const ticketList = document.querySelector("#fifa-ticket-list");
const saleList = document.querySelector("#fifa-sale-list");
const ticketStatusNode = document.querySelector("#fifa-ticket-status");
const saleStatusNode = document.querySelector("#fifa-sale-status");
const saleTicketSelect = document.querySelector("#fifa-sale-ticket");
const saleTicketIdsInput = document.querySelector("#fifa-sale-ticket-ids");

const ticketFilters = {
  search: document.querySelector("#ticket-filter-search"),
  match: document.querySelector("#ticket-filter-match"),
  stage: document.querySelector("#ticket-filter-stage"),
  city: document.querySelector("#ticket-filter-city"),
  category: document.querySelector("#ticket-filter-category"),
  visibility: document.querySelector("#ticket-filter-visibility"),
  availability: document.querySelector("#ticket-filter-availability"),
};

const saleFilters = {
  search: document.querySelector("#sale-filter-search"),
  payment: document.querySelector("#sale-filter-payment"),
  status: document.querySelector("#sale-filter-status"),
  city: document.querySelector("#sale-filter-city"),
  soldBy: document.querySelector("#sale-filter-sold-by"),
  paidState: document.querySelector("#sale-filter-paid-state"),
};

const summaryNodes = {
  available: document.querySelector("#fifa-summary-available"),
  total: document.querySelector("#fifa-summary-total"),
  sold: document.querySelector("#fifa-summary-sold"),
};

const ticketCountNode = document.querySelector("#fifa-ticket-count");
const ticketMetaNode = document.querySelector("#fifa-ticket-meta");
const ticketFormToggleButton = document.querySelector("#fifa-show-ticket-form");
const ticketInventoryView = document.querySelector("#fifa-ticket-inventory-view");
const saleFormToggleButton = document.querySelector("#fifa-show-sale-form");
const saleBlockList = document.querySelector("#fifa-sale-block-list");
const saleParticipantList = document.querySelector("#fifa-sale-participant-list");
const saleMatchSelect = document.querySelector("#fifa-sale-match-select");
const saleCategorySelect = document.querySelector("#fifa-sale-category-select");
const saleBlockQuantityInput = document.querySelector("#fifa-sale-block-quantity");
const saleSeatPicker = document.querySelector("#fifa-sale-seat-picker");
const salePriceBreakdown = document.querySelector("#fifa-sale-price-breakdown");
const invoiceScheduleEditor = document.querySelector("#fifa-invoice-schedule-editor");
const ticketRowContainers = {
  "1": document.querySelector('[data-ticket-rows="1"]'),
  "2": document.querySelector('[data-ticket-rows="2"]'),
  "3": document.querySelector('[data-ticket-rows="3"]'),
};
const DEFAULT_INVOICE_EXCHANGE_RATE = 3600;
const BANK_ACCOUNTS = {
  state: { bankName: "Төрийн Банк", prefix: "MN030034", accountNumber: "3432 7777 9999" },
  golomt: { bankName: "Голомт Банк", prefix: "MN80001500", accountNumber: "3675114666" },
  "lkham-erdene": { bankName: "Лхам-Эрдэнэ", prefix: "Хувийн данс", accountNumber: "" },
  azjargal: { bankName: "Азжаргал", prefix: "Хувийн данс", accountNumber: "" },
  bayaraa: { bankName: "Баяраа", prefix: "Хувийн данс", accountNumber: "" },
  other: { bankName: "Other", prefix: "", accountNumber: "" },
};
const NATIONALITY_OPTIONS = [
  "Mongolian",
  "Japanese",
  "Korean",
  "Mexican",
  "Brazilian",
  "English",
  "French",
  "American",
  "Other",
];

function closeOpenTripMenus(exceptMenu = null) {
  document.querySelectorAll(".trip-menu[open]").forEach((menu) => {
    if (exceptMenu && menu === exceptMenu) {
      return;
    }
    menu.removeAttribute("open");
  });
}

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
  { stage: "Round 32", matchNumber: "Match 77", matchDate: "2026-06-30", teamA: "1L", teamB: "3CDFGH", city: "New York", venue: "New York Stadium" },
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

const CITY_TO_VENUE = Object.fromEntries(MATCH_CATALOG.map((item) => [item.city, item.venue]));
const MATCH_LOOKUP = Object.fromEntries(MATCH_CATALOG.map((item) => [item.matchNumber, item]));
const EXTRA_TEAM_CODES = ["COD"];
const TEAM_CODES = [...new Set([...MATCH_CATALOG.flatMap((item) => [item.teamA, item.teamB]), ...EXTRA_TEAM_CODES])]
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

const state = {
  tickets: [],
  sales: [],
  summary: null,
  editingTicketId: "",
  editingSaleId: "",
  expandedMatches: new Set(),
  expandedSales: new Set(),
  selectedTickets: new Set(),
  saleBlocks: [],
  participants: [],
  pendingSaleSeatIds: [],
  invoiceSchedule: [],
  invoiceScheduleTouched: false,
  invoiceDrafts: {},
};

function setNodeText(node, value) {
  if (!node) return;
  node.textContent = value;
}

function setStatus(node, message, isError = false) {
  if (!node) return;
  node.textContent = message;
  node.dataset.tone = isError ? "error" : "ok";
}

function clearStatus(node) {
  if (!node) return;
  node.textContent = "";
  delete node.dataset.tone;
}

function safeDateInput(value) {
  const raw = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (/^\d{4}\.\d{2}\.\d{2}$/.test(raw)) return raw.replaceAll(".", "-");
  return "";
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatMoney(value, currency = "USD") {
  if ((currency || "USD") === "MNT") {
    return `${new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 0,
    }).format(Number(value || 0))}₮`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).replace("T", " ");
  return date.toLocaleString();
}

function formatDate(value) {
  if (!value) return "-";
  const normalized = String(value).slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().slice(0, 10);
}

function currentInvoiceExchangeRate() {
  return Math.max(Number(saleForm?.elements?.invoiceExchangeRate?.value || DEFAULT_INVOICE_EXCHANGE_RATE), 1);
}

function currentDiscountUsd() {
  const discountMnt = Math.max(Number(saleForm?.elements?.discountAmountMnt?.value || 0), 0);
  return Math.round(discountMnt / currentInvoiceExchangeRate());
}

function currentAmountPaidUsd() {
  const paidFromSchedule = activeInvoiceSchedule()
    .filter((line) => String(line.status || "").trim().toLowerCase() === "paid")
    .reduce((sum, line) => sum + Math.max(Number(line.amount || 0), 0), 0);
  return Math.round(paidFromSchedule);
}

function currentSaleTotalUsd() {
  const blockTotalUsd = state.saleBlocks.reduce((sum, block) => sum + Number(block.totalPrice || 0), 0);
  return Math.max(blockTotalUsd - currentDiscountUsd(), 0);
}

function combinedParticipantName(participant) {
  const givenName = String(participant?.givenName || "").trim();
  const surname = String(participant?.surname || "").trim();
  return [surname, givenName].filter(Boolean).join(" ").trim() || String(participant?.name || "").trim();
}

function naturalTextCompare(left, right) {
  return String(left || "").localeCompare(String(right || ""), undefined, { numeric: true, sensitivity: "base" });
}

function matchNumberSortValue(value) {
  const match = String(value || "").match(/(\d+)/);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function managerInitial(value) {
  const raw = String(value || "").trim();
  if (!raw) return "-";
  const emailSafe = raw.includes("@") ? raw.split("@")[0] : raw;
  return `${emailSafe.charAt(0).toUpperCase()}.`;
}

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

const TEAM_NAME_MAP = {
  COD: "DR Congo",
};

function teamDisplay(code) {
  const teamCode = String(code || "").trim().toUpperCase();
  if (!teamCode) return "";
  const flag = TEAM_FLAG_MAP[teamCode];
  return flag ? `${flag} ${teamCode}` : teamCode;
}

function teamOptionLabel(code) {
  const teamCode = String(code || "").trim().toUpperCase();
  if (!teamCode) return "";
  const base = teamDisplay(teamCode);
  const teamName = TEAM_NAME_MAP[teamCode];
  return teamName ? `${base} - ${teamName}` : base;
}

function fillSelect(node, values, placeholder, keepValue = "") {
  if (!node) return;
  node.innerHTML = [`<option value="">${placeholder}</option>`]
    .concat(values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`))
    .join("");
  if (keepValue && values.includes(keepValue)) node.value = keepValue;
}

function fillSelectFromOptions(node, options, placeholder, keepValue = "") {
  if (!node) return;
  node.innerHTML = [`<option value="">${placeholder}</option>`]
    .concat(options.map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`))
    .join("");
  if (keepValue && options.some((option) => option.value === keepValue)) node.value = keepValue;
}

function parseSeatLines(rawValue) {
  return String(rawValue || "")
    .split(/\n|\|/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const cleaned = line.replace(/^Ticket\s+\d+\s*:\s*/i, "").trim();
      return {
        seat: cleaned.replace(/^Seat\s*/i, "").replace(/^Price\s+\d+\s*\|\s*/i, "").trim(),
      };
    });
}

function syncCategorySeatTextarea(categoryCode) {
  if (!ticketForm) return;
  const container = ticketRowContainers[categoryCode];
  const textarea = ticketForm.elements[`category${categoryCode}Seats`];
  if (!container || !textarea) return;
  const values = [...container.querySelectorAll("[data-ticket-row]")]
    .map((row, index) => {
      const seat = row.querySelector('[data-row-seat]')?.value.trim() || "";
      return seat ? `Ticket ${index + 1}: ${seat}` : "";
    })
    .filter(Boolean);
  textarea.value = values.join("\n");
}

function setTicketFormVisible(isVisible) {
  if (!ticketForm) return;
  if (isVisible) {
    ticketForm.dataset.open = "true";
    ticketFormToggleButton?.setAttribute("hidden", "");
    ticketInventoryView?.setAttribute("hidden", "");
  } else {
    ticketForm.dataset.open = "false";
    ticketFormToggleButton?.removeAttribute("hidden");
    ticketInventoryView?.removeAttribute("hidden");
  }
}

function setSaleFormVisible(isVisible) {
  if (!saleForm) return;
  if (isVisible) {
    saleForm.dataset.open = "true";
    saleFormToggleButton?.setAttribute("hidden", "");
  } else {
    saleForm.dataset.open = "false";
    saleFormToggleButton?.removeAttribute("hidden");
  }
}

function renderCategoryTicketRows(categoryCode, ticketRows = []) {
  const container = ticketRowContainers[categoryCode];
  if (!ticketForm || !container) return;
  const quantity = Math.max(Number(ticketForm.elements[`category${categoryCode}Quantity`].value || 0), 0);
  const assignedLater = ticketForm.elements[`category${categoryCode}AssignedLater`].value === "yes";
  if (!quantity) {
    container.innerHTML = '<p class="fifa-seat-help">Set total quantity first. Then each ticket row will appear here.</p>';
    syncCategorySeatTextarea(categoryCode);
    return;
  }
  container.innerHTML = Array.from({ length: quantity }, (_, index) => {
    const row = ticketRows[index] || {};
    return `
      <div class="fifa-ticket-row" data-ticket-row="${index + 1}">
        <label class="full-span">
          Ticket ${index + 1} seat number
          <input
            type="text"
            data-row-seat
            value="${escapeHtml(row.seat || "")}"
            placeholder="${assignedLater ? "Seat will be assigned later" : `Seat detail for ticket ${index + 1}`}"
            ${assignedLater ? 'disabled aria-disabled="true"' : ""}
          />
        </label>
      </div>
    `;
  }).join("");
  if (assignedLater) {
    ticketForm.elements[`category${categoryCode}Seats`].value = "Seat will be assigned later";
  } else {
    syncCategorySeatTextarea(categoryCode);
  }
}

function buildMatchLabel(teamA, teamB) {
  const left = String(teamA || "").trim();
  const right = String(teamB || "").trim();
  return left && right ? `${teamDisplay(left)} vs ${teamDisplay(right)}` : teamDisplay(left || right);
}

function buildMatchTitle(matchNumber, teamA, teamB) {
  const label = buildMatchLabel(teamA, teamB);
  return matchNumber ? `${matchNumber}: ${label}` : label;
}

function normalizeStageValue(value) {
  const stage = String(value || "").trim();
  if (stage === "Opening Ceremony") return "Opening";
  if (stage === "QuarterFinal") return "Quarter Final";
  return stage;
}

function normalizeSaleStatusValue(value) {
  const status = String(value || "").trim().toLowerCase();
  if (status === "active") return "confirmed";
  if (["pending", "confirmed", "cancelled"].includes(status)) return status;
  return "pending";
}

function saleStatusLabel(value) {
  const status = normalizeSaleStatusValue(value);
  if (status === "confirmed") return "Confirmed";
  if (status === "cancelled") return "Cancelled";
  return "Pending";
}

function paymentStatusLabel(value) {
  const status = String(value || "").trim().toLowerCase();
  if (status === "paid") return "100% paid";
  if (status === "partial") return "In progress";
  if (status === "refunded") return "Refunded";
  return "Pending";
}

function populateInventoryFormOptions() {
  if (!ticketForm) return;
  fillSelect(
    ticketForm.elements.matchNumber,
    MATCH_CATALOG.map((item) => item.matchNumber),
    "Choose match",
    ticketForm.elements.matchNumber.value
  );
  fillSelectFromOptions(
    ticketForm.elements.teamA,
    TEAM_CODES.map((code) => ({ value: code, label: teamOptionLabel(code) })),
    "Choose team",
    ticketForm.elements.teamA.value
  );
  fillSelectFromOptions(
    ticketForm.elements.teamB,
    TEAM_CODES.map((code) => ({ value: code, label: teamOptionLabel(code) })),
    "Choose team",
    ticketForm.elements.teamB.value
  );
  fillSelect(
    ticketForm.elements.city,
    [...new Set(MATCH_CATALOG.map((item) => item.city))],
    "Choose city",
    ticketForm.elements.city.value
  );
}

function updateSummary() {
  const summary = state.summary || {};
  if (summaryNodes.available) summaryNodes.available.textContent = summary.tickets?.availableUnits ?? 0;
  if (summaryNodes.total) {
    const totalTickets = state.tickets.reduce((sum, ticket) => sum + Number(ticket.totalQuantity || 0), 0);
    summaryNodes.total.textContent = totalTickets;
  }
  if (summaryNodes.sold) summaryNodes.sold.textContent = summary.tickets?.soldUnits ?? 0;
}

function refreshFilterOptions() {
  const filters = state.summary?.filters || {};
  fillSelect(ticketFilters.match, filters.matches || [], "All matches", ticketFilters.match?.value || "");
  fillSelect(ticketFilters.stage, filters.stages || [], "All stages", ticketFilters.stage?.value || "");
  fillSelect(ticketFilters.city, filters.cities || [], "All cities", ticketFilters.city?.value || "");
  fillSelect(ticketFilters.category, filters.categories || [], "All categories", ticketFilters.category?.value || "");
  fillSelect(saleFilters.city, filters.cities || [], "All cities", saleFilters.city?.value || "");
  fillSelect(saleFilters.soldBy, filters.soldBy || [], "All managers", saleFilters.soldBy?.value || "");
}

function refreshSaleTicketOptions() {
  if (!saleMatchSelect || !saleCategorySelect) return;
  const matches = groupTicketsByMatch(
    state.tickets.filter((ticket) => ticket.status === "active" && ticket.availableQuantity > 0)
  );
  fillSelectFromOptions(
    saleMatchSelect,
    matches.map((group) => ({
      value: group.matchNumber,
      label: `${group.matchNumber}: ${buildMatchLabel(group.teamA, group.teamB)}`,
    })),
    "Choose match",
    saleMatchSelect.value
  );
  refreshSaleCategoryOptions();
}

function refreshSaleCategoryOptions(selectedCategory = "") {
  if (!saleMatchSelect || !saleCategorySelect) return;
  const matchNumber = saleMatchSelect.value;
  const categories = [...new Set(
    state.tickets
      .filter((ticket) => ticket.matchNumber === matchNumber && ticket.status === "active" && ticket.availableQuantity > 0)
      .map((ticket) => String(ticket.categoryCode || ""))
      .filter(Boolean)
  )].sort((a, b) => Number(a) - Number(b));
  fillSelect(saleCategorySelect, categories.map((code) => `CAT ${code}`), "Choose category", selectedCategory ? `CAT ${selectedCategory}` : saleCategorySelect.value);
  renderSaleSeatPicker();
}

function saleBlockAvailableTickets(matchNumber, categoryCode, excludedIds = []) {
  const excluded = new Set(excludedIds);
  return state.tickets
    .filter((ticket) =>
      ticket.matchNumber === matchNumber
      && String(ticket.categoryCode || "") === String(categoryCode || "")
      && ticket.status === "active"
      && ticket.availableQuantity > 0
      && !excluded.has(ticket.id)
    )
    .sort((left, right) => {
      const seatDiff = compareSeatSortValue(left.seatDetails, right.seatDetails);
      if (seatDiff !== 0) return seatDiff;
      return naturalTextCompare(left.seatDetails, right.seatDetails);
    });
}

function selectedSaleTicketIds() {
  return state.saleBlocks.flatMap((block) => block.ticketIds || []);
}

function ticketSummaryLabel(ticket) {
  return `${buildMatchTitle(ticket.matchNumber, ticket.teamA, ticket.teamB)} · CAT ${ticket.categoryCode} · ${ticket.seatDetails || "Seat will be assigned later"}`;
}

function extractSeatSortValue(label) {
  const raw = String(label || "");
  const tierMatch = raw.match(/(Lower Tier|Middle Tier|Upper Tier)/i);
  const blockMatch = raw.match(/Block\s+([A-Z0-9-]+)/i);
  const rowMatch = raw.match(/Row\s+([A-Z0-9-]+)/i);
  const seatMatch = raw.match(/Seat\s+(\d+)/i);
  const tier = tierMatch ? String(tierMatch[1]).toLowerCase() : "";
  const tierOrderMap = {
    "lower tier": 1,
    "middle tier": 2,
    "upper tier": 3,
  };
  return {
    tier,
    tierOrder: tierOrderMap[tier] || Number.MAX_SAFE_INTEGER,
    block: blockMatch ? String(blockMatch[1]).toUpperCase() : "",
    row: rowMatch ? String(rowMatch[1]).toUpperCase() : "",
    seat: seatMatch ? Number(seatMatch[1]) : Number.MAX_SAFE_INTEGER,
    raw,
  };
}

function compareTicketSeatOrder(leftTicket, rightTicket) {
  const left = extractSeatSortValue(leftTicket?.seatDetails || leftTicket?.seatSection || "");
  const right = extractSeatSortValue(rightTicket?.seatDetails || rightTicket?.seatSection || "");
  const tierDiff = left.tierOrder - right.tierOrder;
  if (tierDiff !== 0) return tierDiff;
  const blockDiff = naturalTextCompare(left.block, right.block);
  if (blockDiff !== 0) return blockDiff;
  const rowDiff = naturalTextCompare(left.row, right.row);
  if (rowDiff !== 0) return rowDiff;
  const seatDiff = left.seat - right.seat;
  if (seatDiff !== 0) return seatDiff;
  const sectionDiff = naturalTextCompare(leftTicket?.seatSection, rightTicket?.seatSection);
  if (sectionDiff !== 0) return sectionDiff;
  return naturalTextCompare(left.raw, right.raw);
}

function compareSeatSortValue(leftLabel, rightLabel) {
  return compareTicketSeatOrder(
    { seatDetails: leftLabel, seatSection: leftLabel },
    { seatDetails: rightLabel, seatSection: rightLabel }
  );
}

function renderSaleSeatPicker() {
  if (!saleSeatPicker || !saleMatchSelect || !saleCategorySelect || !saleBlockQuantityInput) return;
  const matchNumber = saleMatchSelect.value;
  const categoryCode = saleCategorySelect.value.replace(/^CAT\s+/i, "").trim();
  if (!matchNumber || !categoryCode) {
    saleSeatPicker.innerHTML = '<p class="fifa-seat-help">Choose a match and category first. Then the available seats will appear here.</p>';
    state.pendingSaleSeatIds = [];
    saleBlockQuantityInput.value = "0";
    return;
  }
  const availableTickets = saleBlockAvailableTickets(matchNumber, categoryCode, selectedSaleTicketIds());
  state.pendingSaleSeatIds = state.pendingSaleSeatIds.filter((id) => availableTickets.some((ticket) => ticket.id === id));
  if (!availableTickets.length) {
    saleSeatPicker.innerHTML = '<p class="fifa-seat-help">No available seats for this match and category.</p>';
    state.pendingSaleSeatIds = [];
    saleBlockQuantityInput.value = "0";
    return;
  }
  saleSeatPicker.innerHTML = availableTickets
    .map((ticket, index) => `
      <label class="fifa-sale-seat-option">
        <input type="checkbox" data-sale-seat-option value="${escapeHtml(ticket.id)}" ${state.pendingSaleSeatIds.includes(ticket.id) ? "checked" : ""} />
        <div>
          <strong>Ticket ${index + 1}: ${escapeHtml(ticket.seatDetails || "Seat will be assigned later")}</strong>
          <span class="fifa-table-sub">${escapeHtml(ticket.matchNumber)}: ${escapeHtml(buildMatchLabel(ticket.teamA, ticket.teamB))}</span>
          <span class="fifa-table-sub">CAT ${escapeHtml(ticket.categoryCode)} · ${escapeHtml(formatMoney(ticket.price || 0))}</span>
        </div>
      </label>
    `)
    .join("");
  saleBlockQuantityInput.value = String(state.pendingSaleSeatIds.length);
}

function syncSaleTicketInputs() {
  const ids = selectedSaleTicketIds();
  if (saleTicketSelect) saleTicketSelect.value = ids[0] || "";
  if (saleTicketIdsInput) saleTicketIdsInput.value = ids.join(",");
  if (saleForm?.elements?.ticketId) saleForm.elements.ticketId.value = ids[0] || "";
  if (saleForm?.elements?.quantity) saleForm.elements.quantity.value = String(ids.length || 0);
}

function syncSalePriceFields() {
  if (!saleForm) return;
  const totalTickets = selectedSaleTicketIds().length;
  const blockTotalPrice = state.saleBlocks.reduce((sum, block) => sum + Number(block.totalPrice || 0), 0);
  const exchangeRate = currentInvoiceExchangeRate();
  const discountAmount = currentDiscountUsd();
  const totalPrice = Math.max(blockTotalPrice - discountAmount, 0);
  const unitPrices = [...new Set(state.saleBlocks.map((block) => Number(block.unitPrice || 0)).filter(Boolean))];
  saleForm.elements.quantity.value = String(totalTickets || 0);
  if (saleForm.elements.pricePerTicket) {
    saleForm.elements.pricePerTicket.value = unitPrices.length === 1 ? String(unitPrices[0]) : "";
  }
  if (salePriceBreakdown) {
    const lines = state.saleBlocks.flatMap((block, index) => {
      const unitPriceMnt = Math.round(Number(block.unitPrice || 0) * exchangeRate);
      const totalPriceMnt = Math.round(Number(block.totalPrice || 0) * exchangeRate);
      return [
        `${index + 1}. ${block.matchLabel}`,
        `Price ticket: ${formatMoney(unitPriceMnt, "MNT")}`,
        `Quantity: ${String(block.quantity || 0)}`,
        `Total price: ${formatMoney(totalPriceMnt, "MNT")}`,
      ];
    });
    if (discountAmount > 0) lines.push(`Discount: -${formatMoney(Math.round(discountAmount * exchangeRate), "MNT")}`);
    lines.push(`Grand total amount: ${formatMoney(Math.round(totalPrice * exchangeRate), "MNT")}`);
    salePriceBreakdown.value = lines.join("\n");
  }
  saleForm.elements.totalPrice.value = totalPrice ? String(totalPrice) : "";
  if (saleForm.elements.totalPriceMnt) saleForm.elements.totalPriceMnt.value = totalPrice ? String(Math.round(totalPrice * exchangeRate)) : "";
  if (saleForm.elements.discountAmount) saleForm.elements.discountAmount.value = String(discountAmount);
  syncSaleTotals();
  renderInvoiceScheduleEditor();
}

function resetSaleBlockSelection() {
  state.pendingSaleSeatIds = [];
  if (saleMatchSelect) saleMatchSelect.value = "";
  if (saleCategorySelect) {
    saleCategorySelect.innerHTML = '<option value="">Choose category</option>';
    saleCategorySelect.value = "";
  }
  if (saleBlockQuantityInput) saleBlockQuantityInput.value = "0";
  renderSaleSeatPicker();
}

function renderSaleSummary() {
  const summaryNode = document.querySelector("#fifa-sale-summary");
  if (!summaryNode) return;
  if (!state.saleBlocks.length) {
    summaryNode.innerHTML = "";
    return;
  }
  const totalTickets = state.saleBlocks.reduce((sum, block) => sum + Number(block.quantity || 0), 0);
  const exchangeRate = currentInvoiceExchangeRate();
  const totalPrice = currentSaleTotalUsd();
  const totalPriceMnt = Math.round(totalPrice * exchangeRate);
  summaryNode.innerHTML = `
    <div class="fifa-sale-summary-box fifa-sale-summary-box--editor">
      <div class="fifa-sale-summary-head">
        <strong>Pricing</strong>
      </div>
      <div class="fifa-sale-summary-list">
        <div class="fifa-sale-summary-editor-grid">
          <label>
            Currency rate
            <input type="number" min="1" step="1" data-sale-summary-field="exchangeRate" value="${escapeHtml(String(exchangeRate))}" />
          </label>
          ${state.saleBlocks.map((block, index) => `
            <div class="fifa-sale-summary-editor-row" data-sale-block-editor="${index}">
              <strong>${escapeHtml(block.matchLabel)}</strong>
              <label>
                Price for chosen match
                <input type="number" min="0" step="1" data-sale-summary-field="blockPrice" data-index="${index}" value="${escapeHtml(String(Math.round(Number(block.unitPrice || 0) * exchangeRate)))}" />
              </label>
              <label>
                Quantity
                <input type="number" value="${escapeHtml(String(block.quantity || 0))}" readonly />
              </label>
              <label>
                Total amount
                <input type="text" value="${escapeHtml(formatMoney(Math.round(Number(block.totalPrice || 0) * exchangeRate), "MNT"))}" readonly />
              </label>
            </div>
          `).join("")}
          <label class="full-span">
            Grand total price
            <input type="text" value="${escapeHtml(formatMoney(totalPriceMnt, "MNT"))}" readonly />
          </label>
        </div>
      </div>
    </div>
  `;
}

function getInvoiceBankAccount(key) {
  if (typeof key === "object" && key) return key;
  return BANK_ACCOUNTS[key] || BANK_ACCOUNTS.state;
}

function invoiceBankAccountLabel(bankKey, otherValue = "") {
  if (bankKey === "other") return String(otherValue || "").trim() || "Other";
  const account = getInvoiceBankAccount(bankKey);
  return [account.bankName, account.prefix, account.accountNumber].filter(Boolean).join(" ");
}

function toggleOtherBankAccountField() {
  const otherField = document.querySelector("#fifa-sale-other-bank-account-field");
  if (!otherField || !saleForm?.elements?.invoiceBankAccount) return;
  const isOther = saleForm.elements.invoiceBankAccount.value === "other";
  if (isOther) {
    otherField.removeAttribute("hidden");
  } else {
    otherField.setAttribute("hidden", "");
  }
}

function buildInvoiceDraftFromSale(sale) {
  const exchangeRate = Math.max(Number(sale.invoiceExchangeRate || DEFAULT_INVOICE_EXCHANGE_RATE), 1);
  const invoiceRows = buildInvoiceRowsForSale(sale);
  return {
    buyerName: sale.buyerName || sale.buyerTitle || "",
    invoiceExchangeRate: exchangeRate,
    invoiceBankAccount: sale.invoiceBankAccount || "state",
    invoiceBankAccountOther: sale.invoiceBankAccountOther || "",
    invoiceDescriptions: invoiceRows.map((row) => row.description || ""),
    invoiceSchedule: activeInvoiceSchedule(sale).map((row) => ({
      title: row.title || "",
      created: safeDateInput(row.created || ""),
      due: safeDateInput(row.due || ""),
      status: row.status || "waiting",
      amount: Math.max(Number(row.amount || 0), 0),
      amountMnt: String(Math.round(Math.max(Number(row.amount || 0), 0) * exchangeRate)),
    })),
  };
}

function invoiceDraftForSale(sale) {
  return state.invoiceDrafts[sale.id] || null;
}

function captureInlineInvoiceDraft(sale) {
  const existing = invoiceDraftForSale(sale) || buildInvoiceDraftFromSale(sale);
  const container = saleList?.querySelector(`[data-inline-invoice="${sale.id}"]`);
  if (!container) return existing;
  const buyerNameInput = container.querySelector('[data-action="invoice-draft-field"][data-field="buyerName"]');
  const exchangeRateInput = container.querySelector('[data-action="invoice-draft-field"][data-field="invoiceExchangeRate"]');
  const bankAccountSelect = container.querySelector('[data-action="invoice-draft-field"][data-field="invoiceBankAccount"]');
  const bankAccountOtherInput = container.querySelector('[data-action="invoice-draft-field"][data-field="invoiceBankAccountOther"]');
  const descriptions = [...container.querySelectorAll('[data-action="invoice-draft-description"]')].map((node) => node.value);
  const schedule = [...container.querySelectorAll("[data-inline-invoice-row]")].map((rowNode, index) => {
    const getValue = (field) => rowNode.querySelector(`[data-field="${field}"]`)?.value || "";
    const amountMnt = String(getValue("amount") || "").replace(/[^\d]/g, "");
    const exchangeRate = Math.max(Number(exchangeRateInput?.value || existing.invoiceExchangeRate || DEFAULT_INVOICE_EXCHANGE_RATE), 1);
    return {
      title: getValue("title"),
      created: getValue("created"),
      due: getValue("due"),
      status: getValue("status") || "waiting",
      amount: Math.max(Math.round(Number(amountMnt || 0) / exchangeRate), 0),
      amountMnt,
    };
  });
  const captured = {
    ...existing,
    buyerName: buyerNameInput?.value ?? existing.buyerName,
    invoiceExchangeRate: Math.max(Number(exchangeRateInput?.value || existing.invoiceExchangeRate || DEFAULT_INVOICE_EXCHANGE_RATE), 1),
    invoiceBankAccount: bankAccountSelect?.value || existing.invoiceBankAccount || "state",
    invoiceBankAccountOther: bankAccountOtherInput?.value ?? existing.invoiceBankAccountOther ?? "",
    invoiceDescriptions: descriptions.length ? descriptions : existing.invoiceDescriptions,
    invoiceSchedule: schedule.length ? schedule : existing.invoiceSchedule,
  };
  state.invoiceDrafts[sale.id] = captured;
  return captured;
}

function saleLikeWithInvoiceDraft(sale) {
  const draft = invoiceDraftForSale(sale);
  if (!draft) return sale;
  return {
    ...sale,
    buyerName: draft.buyerName,
    invoiceExchangeRate: draft.invoiceExchangeRate,
    invoiceBankAccount: draft.invoiceBankAccount,
    invoiceBankAccountOther: draft.invoiceBankAccountOther,
    invoiceDescriptions: draft.invoiceDescriptions,
    invoiceSchedule: draft.invoiceSchedule,
  };
}

function saleInvoiceSubtotal(saleLike = null) {
  const blocks = saleLike?.ticketBlocks || state.saleBlocks || [];
  return blocks.reduce((sum, block) => sum + Number(block.totalPrice || 0), 0);
}

function saleInvoiceTotal(saleLike = null) {
  const subtotal = saleInvoiceSubtotal(saleLike);
  const discountAmount = Math.max(Number(saleLike?.discountAmount ?? saleForm?.elements?.discountAmount?.value ?? 0), 0);
  return Math.max(subtotal - discountAmount, 0);
}

function defaultInvoiceSchedule(totalPrice, amountPaid, soldAtValue = "") {
  const soldAt = safeDateInput(soldAtValue) || new Date().toISOString().slice(0, 10);
  const paidAmount = Math.max(Number(amountPaid || 0), 0);
  const total = Math.max(Number(totalPrice || 0), 0);
  const balance = Math.max(total - paidAmount, 0);
  const lines = [];
  if (paidAmount > 0) {
    lines.push({
      title: balance > 0 ? "Урьдчилгаа төлбөр" : "Төлбөр",
      created: soldAt,
      due: soldAt,
      status: "paid",
      amount: paidAmount,
    });
  }
  if (balance > 0) {
    lines.push({
      title: lines.length ? "Үлдэгдэл төлбөр" : "Төлбөр",
      created: soldAt,
      due: soldAt,
      status: paidAmount > 0 ? "waiting" : "waiting",
      amount: balance,
    });
  }
  if (!lines.length) {
    lines.push({
      title: "Төлбөр",
      created: soldAt,
      due: soldAt,
      status: "waiting",
      amount: total,
    });
  }
  return lines;
}

function normalizedInvoiceSchedule(lines) {
  return (lines || [])
    .map((line, index) => ({
      title: String(line?.title || "").trim() || `Төлбөр ${index + 1}`,
      created: safeDateInput(line?.created || line?.createdAt || ""),
      due: safeDateInput(line?.due || line?.dueDate || ""),
      status: ["paid", "waiting", "overdue"].includes(String(line?.status || "").trim()) ? String(line.status).trim() : "waiting",
      amount: Math.max(Number(line?.amount || 0), 0),
    }))
    .filter((line) => line.title || line.amount > 0);
}

function activeInvoiceSchedule(saleLike = null) {
  if (saleLike) {
    const saved = normalizedInvoiceSchedule(saleLike.invoiceSchedule || []);
    return saved.length
      ? saved
      : defaultInvoiceSchedule(saleInvoiceTotal(saleLike), Number(saleLike.amountPaid || 0), saleLike.soldAt || "");
  }
  if (state.invoiceScheduleTouched) {
    const current = normalizedInvoiceSchedule(state.invoiceSchedule);
    return current.length
      ? current
      : defaultInvoiceSchedule(saleInvoiceTotal(), Number(saleForm?.elements?.amountPaid?.value || 0), saleForm?.elements?.soldAt?.value || "");
  }
  return defaultInvoiceSchedule(saleInvoiceTotal(), Number(saleForm?.elements?.amountPaid?.value || 0), saleForm?.elements?.soldAt?.value || "");
}

function renderInvoiceScheduleEditor() {
  if (!invoiceScheduleEditor || !saleForm) return;
  const schedule = activeInvoiceSchedule();
  const totalPrice = saleInvoiceTotal();
  const exchangeRate = Number(saleForm.elements.invoiceExchangeRate?.value || DEFAULT_INVOICE_EXCHANGE_RATE);
  const scheduleTotal = schedule.reduce((sum, line) => sum + Number(line.amount || 0), 0);
  const paidTotal = schedule
    .filter((line) => String(line.status || "").trim().toLowerCase() === "paid")
    .reduce((sum, line) => sum + Number(line.amount || 0), 0);
  const totalMnt = Math.round(totalPrice * exchangeRate);
  const scheduleTotalMnt = Math.round(scheduleTotal * exchangeRate);
  const paidTotalMnt = Math.round(paidTotal * exchangeRate);
  const balanceMnt = Math.max(totalMnt - scheduleTotalMnt, 0);
  const paymentStatus = paidTotal <= 0
    ? "Pending"
    : paidTotal >= totalPrice && totalPrice > 0
      ? "100% paid"
      : "In progress";
  const saleStatus = normalizeSaleStatusValue(saleForm.elements.saleStatus?.value || "pending");
  invoiceScheduleEditor.innerHTML = `
    <div class="fifa-invoice-schedule-box">
      <div class="fifa-invoice-schedule-head">
        <strong>Payment schedule</strong>
        <button type="button" class="button-secondary fifa-inline-action" data-action="add-invoice-line">Add line</button>
      </div>
      <div class="fifa-sale-summary-editor-grid fifa-sale-schedule-meta">
        <label>
          Sale status
          <select data-schedule-meta="saleStatus">
            <option value="pending"${saleStatus === "pending" ? " selected" : ""}>Pending</option>
            <option value="confirmed"${saleStatus === "confirmed" ? " selected" : ""}>Confirmed</option>
            <option value="cancelled"${saleStatus === "cancelled" ? " selected" : ""}>Cancelled</option>
          </select>
        </label>
        <label>
          Paid amount
          <input type="text" value="${escapeHtml(formatMoney(paidTotalMnt, "MNT"))}" readonly />
        </label>
        <label>
          Balance
          <input type="text" value="${escapeHtml(formatMoney(balanceMnt, "MNT"))}" readonly />
        </label>
        <label>
          Payment status
          <input type="text" value="${escapeHtml(paymentStatus)}" readonly />
        </label>
      </div>
      <div class="fifa-invoice-schedule-list">
        ${schedule.map((line, index) => `
          <div class="fifa-invoice-schedule-row" data-schedule-index="${index}">
            <label>
              Payment title
              <input type="text" data-schedule-field="title" value="${escapeHtml(line.title)}" />
            </label>
            <label>
              Created date
              <input type="date" data-schedule-field="created" value="${escapeHtml(line.created)}" />
            </label>
            <label>
              Due / paid date
              <input type="date" data-schedule-field="due" value="${escapeHtml(line.due)}" />
            </label>
            <label>
              Төлөв
              <select data-schedule-field="status">
                <option value="paid"${line.status === "paid" ? " selected" : ""}>Төлөгдсөн</option>
                <option value="waiting"${line.status === "waiting" ? " selected" : ""}>Хүлээгдэж буй</option>
                <option value="overdue"${line.status === "overdue" ? " selected" : ""}>Хугацаа хэтэрсэн</option>
              </select>
            </label>
            <label>
              Amount (₮)
              <input type="number" min="0" step="1" data-schedule-field="amount" value="${escapeHtml(String(Math.round(Number(line.amount || 0) * exchangeRate)))}" />
            </label>
            <button type="button" class="button-secondary fifa-inline-action" data-action="remove-invoice-line" data-index="${index}">Remove</button>
          </div>
        `).join("")}
      </div>
      <div class="fifa-invoice-schedule-footer">
        <span>Total scheduled: ${formatMoney(scheduleTotalMnt, "MNT")}</span>
        <span>Total balance: ${formatMoney(balanceMnt, "MNT")}</span>
      </div>
    </div>
  `;
}

function renderParticipants() {
  if (!saleParticipantList) return;
  if (!state.participants.length) {
    saleParticipantList.innerHTML = '<p class="fifa-seat-help">Travelers will appear from the selected tickets.</p>';
    return;
  }
  const nationalityOptions = NATIONALITY_OPTIONS.map((option) => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`).join("");
  saleParticipantList.innerHTML = state.participants
    .map((participant, index) => `
      <div class="fifa-sale-participant-card" data-participant-index="${index}">
        <h4>Ticket ${index + 1}</h4>
        <p class="fifa-table-sub">${escapeHtml(participant.ticketLabel || "Selected ticket")}</p>
        <div class="manager-form-grid fifa-form-grid">
          <label>
            Name
            <input type="text" data-participant-field="givenName" value="${escapeHtml(participant.givenName || participant.name || "")}" />
          </label>
          <label>
            Surname
            <input type="text" data-participant-field="surname" value="${escapeHtml(participant.surname || "")}" />
          </label>
          <label>
            Passport number
            <input type="text" data-participant-field="passportNumber" value="${escapeHtml(participant.passportNumber || "")}" />
          </label>
          <label>
            Nationality
            <select data-participant-field="nationality">
              ${nationalityOptions.replace(`value="${escapeHtml(participant.nationality || "Mongolian")}"`, `value="${escapeHtml(participant.nationality || "Mongolian")}" selected`)}
            </select>
          </label>
          <label>
            Birth date
            <input type="date" data-participant-field="birthDate" value="${escapeHtml(safeDateInput(participant.birthDate || ""))}" />
          </label>
          <label>
            Passport expiry date
            <input type="date" data-participant-field="passportExpiryDate" value="${escapeHtml(safeDateInput(participant.passportExpiryDate || ""))}" />
          </label>
          <label class="full-span">
            Notes
            <input type="text" data-participant-field="notes" value="${escapeHtml(participant.notes || "")}" />
          </label>
        </div>
      </div>
    `)
    .join("");
}

function syncParticipantsFromBlocks() {
  const previous = new Map((state.participants || []).map((participant) => [participant.ticketId, participant]));
  const selectedTickets = selectedSaleTicketIds()
    .map((ticketId) => state.tickets.find((ticket) => ticket.id === ticketId))
    .filter(Boolean);
  state.participants = selectedTickets.map((ticket) => {
    const existing = previous.get(ticket.id) || {};
    return {
      ticketId: ticket.id,
      ticketLabel: ticketSummaryLabel(ticket),
      name: existing.name || "",
      givenName: existing.givenName || existing.name || "",
      surname: existing.surname || "",
      passportNumber: existing.passportNumber || "",
      nationality: existing.nationality || "Mongolian",
      birthDate: existing.birthDate || "",
      passportExpiryDate: existing.passportExpiryDate || "",
      notes: existing.notes || "",
    };
  });
  renderParticipants();
}

function renderSaleBlocks() {
  if (!saleBlockList) return;
  if (!state.saleBlocks.length) {
    saleBlockList.innerHTML = '<p class="fifa-seat-help">Choose match, category, and seats, then add a ticket block.</p>';
    syncSaleTicketInputs();
    syncSalePriceFields();
    syncParticipantsFromBlocks();
    renderSaleSummary();
    return;
  }
  saleBlockList.innerHTML = state.saleBlocks
    .map((block, index) => {
      const derivedUnitPrice = Number(block.unitPrice || 0) || (Number(block.quantity || 0) ? Math.round(Number(block.totalPrice || 0) / Number(block.quantity || 1)) : 0);
      return `
      <div class="fifa-sale-block-item" data-sale-block-index="${index}">
        <div class="fifa-sale-block-body">
          <div class="fifa-sale-block-head">
            <strong>${escapeHtml(block.matchLabel)}</strong>
            <span class="fifa-pill">${escapeHtml(`CAT ${block.categoryCode}`)}</span>
          </div>
          <span class="fifa-table-sub">CAT ${escapeHtml(block.categoryCode)} · ${escapeHtml(block.quantity)} ticket(s)</span>
          <span class="fifa-table-sub">Price ticket: ${escapeHtml(formatMoney(derivedUnitPrice, "USD"))}</span>
          <span class="fifa-table-sub">Total for ${escapeHtml(block.matchLabel)}: ${escapeHtml(formatMoney(Number(block.totalPrice || 0), "USD"))}</span>
          <div class="fifa-sale-ticket-list">
            ${(block.ticketLabels || []).map((label, ticketIndex) => `<span class="fifa-table-sub"><strong>Ticket ${ticketIndex + 1}</strong> · ${escapeHtml(label)}</span>`).join("")}
          </div>
        </div>
        <button type="button" class="button-secondary" data-action="remove-sale-block" data-index="${index}">Remove</button>
      </div>
    `;
    })
    .join("");
  syncSaleTicketInputs();
  syncSalePriceFields();
  syncParticipantsFromBlocks();
  renderSaleSummary();
}

function clearCategoryBlock(categoryCode) {
  if (!ticketForm) return;
  ticketForm.elements[`category${categoryCode}Id`].value = "";
  ticketForm.elements[`category${categoryCode}Price`].value = "";
  ticketForm.elements[`category${categoryCode}Quantity`].value = "0";
  ticketForm.elements[`category${categoryCode}Name`].value = "";
  ticketForm.elements[`category${categoryCode}Section`].value = "";
  ticketForm.elements[`category${categoryCode}Seats`].value = "";
  ticketForm.elements[`category${categoryCode}AssignedLater`].value = "no";
  renderCategoryTicketRows(categoryCode, []);
}

function resetTicketForm() {
  if (!ticketForm) return;
  ticketForm.reset();
  ticketForm.elements.id.value = "";
  ticketForm.elements.currency.value = "USD";
  ticketForm.elements.visibility.value = "public";
  populateInventoryFormOptions();
  ["1", "2", "3"].forEach(clearCategoryBlock);
  state.editingTicketId = "";
  setNodeText(document.querySelector("#fifa-ticket-submit"), "Save categories");
  clearStatus(ticketStatusNode);
  setTicketFormVisible(false);
}

function resetSaleForm() {
  if (!saleForm) return;
  saleForm.reset();
  saleForm.elements.id.value = "";
  saleForm.elements.ticketId.value = "";
  if (saleTicketIdsInput) saleTicketIdsInput.value = "";
  saleForm.elements.quantity.value = "0";
  saleForm.elements.amountPaid.value = "0";
  if (saleForm.elements.amountPaidMnt) saleForm.elements.amountPaidMnt.value = "0";
  if (saleForm.elements.totalPriceMnt) saleForm.elements.totalPriceMnt.value = "0";
  saleForm.elements.saleStatus.value = "pending";
  saleForm.elements.paymentStatus.value = "unpaid";
  saleForm.elements.paymentMethod.value = "state";
  saleForm.elements.buyerTitle.value = "";
  state.editingSaleId = "";
  state.saleBlocks = [];
  state.participants = [];
  state.pendingSaleSeatIds = [];
  state.invoiceSchedule = [];
  state.invoiceScheduleTouched = false;
  if (saleMatchSelect) saleMatchSelect.value = "";
  if (saleCategorySelect) saleCategorySelect.value = "";
  if (saleBlockQuantityInput) saleBlockQuantityInput.value = "0";
  refreshSaleTicketOptions();
  renderSaleBlocks();
  renderParticipants();
  renderSaleSeatPicker();
  if (saleForm.elements.discountAmount) saleForm.elements.discountAmount.value = "0";
  if (saleForm.elements.discountAmountMnt) saleForm.elements.discountAmountMnt.value = "0";
  if (saleForm.elements.invoiceExchangeRate) saleForm.elements.invoiceExchangeRate.value = String(DEFAULT_INVOICE_EXCHANGE_RATE);
  if (saleForm.elements.invoiceBankAccount) saleForm.elements.invoiceBankAccount.value = "state";
  if (saleForm.elements.invoiceBankAccountOther) saleForm.elements.invoiceBankAccountOther.value = "";
  toggleOtherBankAccountField();
  if (saleForm.elements.soldAt) saleForm.elements.soldAt.value = new Date().toISOString().slice(0, 10);
  if (salePriceBreakdown) salePriceBreakdown.value = "";
  renderInvoiceScheduleEditor();
  setNodeText(document.querySelector("#fifa-sale-submit"), "Register sale");
  clearStatus(saleStatusNode);
  setSaleFormVisible(false);
}

function applyMatchSelection(matchNumber) {
  if (!ticketForm) return;
  const match = MATCH_LOOKUP[matchNumber];
  if (!match) return;
  ticketForm.elements.stage.value = match.stage;
  if (ticketForm.elements.groupLabel) ticketForm.elements.groupLabel.value = match.groupLabel || "";
  ticketForm.elements.matchNumber.value = match.matchNumber;
  ticketForm.elements.matchDate.value = match.matchDate;
  ticketForm.elements.teamA.value = match.teamA;
  ticketForm.elements.teamB.value = match.teamB;
  ticketForm.elements.city.value = match.city;
  ticketForm.elements.venue.value = match.venue;
}

function applyCityVenue(city) {
  if (!ticketForm) return;
  ticketForm.elements.venue.value = CITY_TO_VENUE[city] || "";
}

function blockHasInput(categoryCode) {
  if (!ticketForm) return false;
  const price = Number(ticketForm.elements[`category${categoryCode}Price`].value || 0);
  const quantity = Number(ticketForm.elements[`category${categoryCode}Quantity`].value || 0);
  const name = ticketForm.elements[`category${categoryCode}Name`].value.trim();
  const section = ticketForm.elements[`category${categoryCode}Section`].value.trim();
  const seats = ticketForm.elements[`category${categoryCode}Seats`].value.trim();
  return Boolean(price || quantity || name || section || seats);
}

function buildCategoryRows(categoryCode) {
  const assignedLater = ticketForm.elements[`category${categoryCode}AssignedLater`].value === "yes";
  const container = ticketRowContainers[categoryCode];
  const rows = container
    ? [...container.querySelectorAll("[data-ticket-row]")].map((row) => ({
        id: row.dataset.ticketId || "",
        seat: assignedLater ? "Seat will be assigned later" : (row.querySelector("[data-row-seat]")?.value.trim() || ""),
      }))
    : [];
  if (!assignedLater) syncCategorySeatTextarea(categoryCode);
  return rows;
}

function commonTicketPayload() {
  const teamA = ticketForm.elements.teamA.value;
  const teamB = ticketForm.elements.teamB.value;
  return {
    stage: ticketForm.elements.stage.value,
    groupLabel: ticketForm.elements.groupLabel?.value || "",
    matchNumber: ticketForm.elements.matchNumber.value,
    matchLabel: buildMatchLabel(teamA, teamB),
    matchDate: ticketForm.elements.matchDate.value,
    teamA,
    teamB,
    city: ticketForm.elements.city.value,
    venue: ticketForm.elements.venue.value,
    currency: ticketForm.elements.currency.value || "USD",
    visibility: ticketForm.elements.visibility.value || "public",
    status: "active",
    notes: ticketForm.elements.notes.value.trim(),
  };
}

function matchIdentity(ticket) {
  return [
    ticket.matchNumber || "",
    ticket.matchDate || "",
    ticket.teamA || "",
    ticket.teamB || "",
    ticket.city || "",
  ].join("|");
}

function fillTicketForm(ticket) {
  if (!ticketForm) return;
  resetTicketForm();
  const groupId = matchIdentity(ticket);
  const matchTickets = state.tickets.filter((item) => matchIdentity(item) === groupId);
  const lead = matchTickets[0] || ticket;
  ticketForm.elements.id.value = ticket.id;
  ticketForm.elements.stage.value = normalizeStageValue(lead.stage);
  if (ticketForm.elements.groupLabel) ticketForm.elements.groupLabel.value = lead.groupLabel || "";
  ticketForm.elements.matchNumber.value = lead.matchNumber || "";
  ticketForm.elements.matchDate.value = lead.matchDate || "";
  ticketForm.elements.teamA.value = lead.teamA || "";
  ticketForm.elements.teamB.value = lead.teamB || "";
  ticketForm.elements.city.value = lead.city || "";
  ticketForm.elements.venue.value = lead.venue || "";
  ticketForm.elements.currency.value = lead.currency || "USD";
  ticketForm.elements.visibility.value = lead.visibility || "public";
  ticketForm.elements.notes.value = lead.notes || "";

  matchTickets.forEach((item) => {
    const code = String(item.categoryCode || "").trim();
    if (!["1", "2", "3"].includes(code)) return;
    const existingIds = ticketForm.elements[`category${code}Id`].value
      ? ticketForm.elements[`category${code}Id`].value.split(",").filter(Boolean)
      : [];
    existingIds.push(item.id);
    ticketForm.elements[`category${code}Id`].value = existingIds.join(",");
    ticketForm.elements[`category${code}Price`].value = item.price || "";
    ticketForm.elements[`category${code}Quantity`].value = existingIds.length;
    ticketForm.elements[`category${code}Name`].value = item.categoryName || "";
    ticketForm.elements[`category${code}Section`].value = item.seatSection || "";
    ticketForm.elements[`category${code}Seats`].value = item.seatDetails || "";
    ticketForm.elements[`category${code}AssignedLater`].value = item.seatAssignedLater ? "yes" : "no";
  });

  ["1", "2", "3"].forEach((code) => {
    const categoryItems = matchTickets
      .filter((item) => String(item.categoryCode || "").trim() === code)
      .map((item) => ({ id: item.id, price: item.price || "", seat: item.seatAssignedLater ? "" : item.seatDetails || "" }));
    renderCategoryTicketRows(code, categoryItems);
  });

  state.editingTicketId = ticket.id;
  setNodeText(document.querySelector("#fifa-ticket-submit"), "Update categories");
  setStatus(ticketStatusNode, "Editing match categories.");
  setTicketFormVisible(true);
  ticketForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function fillSaleForm(sale) {
  if (!saleForm) return;
  resetSaleForm();
  saleForm.elements.id.value = sale.id;
  saleForm.elements.ticketId.value = sale.ticketId || "";
  if (saleTicketIdsInput) saleTicketIdsInput.value = (sale.ticketIds || []).join(",");
  saleForm.elements.quantity.value = sale.quantity || 1;
  if (saleForm.elements.pricePerTicket) saleForm.elements.pricePerTicket.value = sale.pricePerTicket || "";
  if (saleForm.elements.discountAmount) saleForm.elements.discountAmount.value = sale.discountAmount || 0;
  if (saleForm.elements.discountAmountMnt) saleForm.elements.discountAmountMnt.value = String(Math.round(Number(sale.discountAmount || 0) * Number(sale.invoiceExchangeRate || DEFAULT_INVOICE_EXCHANGE_RATE)));
  if (saleForm.elements.invoiceExchangeRate) saleForm.elements.invoiceExchangeRate.value = sale.invoiceExchangeRate || DEFAULT_INVOICE_EXCHANGE_RATE;
  if (saleForm.elements.invoiceBankAccount) saleForm.elements.invoiceBankAccount.value = sale.invoiceBankAccount || "state";
  if (saleForm.elements.invoiceBankAccountOther) saleForm.elements.invoiceBankAccountOther.value = sale.invoiceBankAccountOther || "";
  toggleOtherBankAccountField();
  saleForm.elements.totalPrice.value = sale.totalPrice || "";
  if (saleForm.elements.totalPriceMnt) saleForm.elements.totalPriceMnt.value = String(Math.round(Number(sale.totalPrice || 0) * Number(sale.invoiceExchangeRate || DEFAULT_INVOICE_EXCHANGE_RATE)));
  saleForm.elements.amountPaid.value = sale.amountPaid || 0;
  if (saleForm.elements.amountPaidMnt) saleForm.elements.amountPaidMnt.value = String(Math.round(Number(sale.amountPaid || 0) * Number(sale.invoiceExchangeRate || DEFAULT_INVOICE_EXCHANGE_RATE)));
  saleForm.elements.paymentStatus.value = sale.paymentStatus || "unpaid";
  saleForm.elements.paymentMethod.value = sale.paymentMethod || "state";
  saleForm.elements.saleStatus.value = normalizeSaleStatusValue(sale.saleStatus);
  saleForm.elements.soldAt.value = String(sale.soldAt || "").slice(0, 10);
  saleForm.elements.buyerTitle.value = sale.buyerTitle || "";
  saleForm.elements.buyerName.value = sale.buyerName || sale.buyerTitle || "";
  saleForm.elements.buyerPhone.value = sale.buyerPhone || "";
  saleForm.elements.buyerEmail.value = sale.buyerEmail || "";
  saleForm.elements.buyerPassportNumber.value = sale.buyerPassportNumber || "";
  saleForm.elements.buyerNationality.value = sale.buyerNationality || "";
  saleForm.elements.buyerNotes.value = sale.buyerNotes || "";
  state.saleBlocks = (sale.ticketBlocks || []).map((block) => ({
    matchNumber: block.matchNumber || "",
    matchLabel: block.matchLabel || "",
    categoryCode: String(block.categoryCode || ""),
    quantity: Number(block.quantity || 0),
    unitPrice: Number(block.unitPrice || 0),
    totalPrice: Number(block.totalPrice || 0),
    seatPreview: block.seatPreview || "",
    ticketLabels: block.ticketLabels || [],
    ticketIds: [...(block.ticketIds || [])],
  }));
  if (!state.saleBlocks.length && sale.ticketId) {
    const ticket = state.tickets.find((item) => item.id === sale.ticketId);
    if (ticket) {
      state.saleBlocks = [{
        matchNumber: ticket.matchNumber,
        matchLabel: buildMatchTitle(ticket.matchNumber, ticket.teamA, ticket.teamB),
        categoryCode: String(ticket.categoryCode || ""),
        quantity: Number(sale.quantity || 1),
        unitPrice: Number(ticket.price || 0),
        totalPrice: Number(sale.totalPrice || ticket.price || 0),
        seatPreview: ticket.seatDetails || "",
        ticketLabels: (sale.ticketIds?.length ? sale.ticketIds : [sale.ticketId])
          .map((ticketId) => state.tickets.find((item) => item.id === ticketId))
          .filter(Boolean)
          .map((item) => ticketSummaryLabel(item)),
        ticketIds: sale.ticketIds?.length ? [...sale.ticketIds] : [sale.ticketId],
      }];
    }
  }
  state.participants = (sale.participants || []).map((participant) => ({
    ticketId: participant.ticketId || "",
    ticketLabel: participant.ticketLabel || "Selected ticket",
    name: participant.name || "",
    givenName: participant.givenName || participant.name || "",
    surname: participant.surname || "",
    passportNumber: participant.passportNumber || "",
    nationality: participant.nationality || "Mongolian",
    birthDate: participant.birthDate || "",
    passportExpiryDate: participant.passportExpiryDate || "",
    notes: participant.notes || "",
  }));
  state.invoiceSchedule = normalizedInvoiceSchedule(sale.invoiceSchedule || []);
  state.invoiceScheduleTouched = Boolean(state.invoiceSchedule.length);
  renderSaleBlocks();
  renderInvoiceScheduleEditor();
  renderParticipants();
  renderSaleSeatPicker();
  state.editingSaleId = sale.id;
  setNodeText(document.querySelector("#fifa-sale-submit"), "Update sale");
  setStatus(saleStatusNode, "Editing sale.");
  setSaleFormVisible(true);
  saleForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function startSaleForTicket(ticketId) {
  if (!saleForm) return;
  resetSaleForm();
  const ticket = state.tickets.find((item) => item.id === ticketId);
  if (!ticket) return;
  state.saleBlocks = [{
    matchNumber: ticket.matchNumber,
        matchLabel: buildMatchTitle(ticket.matchNumber, ticket.teamA, ticket.teamB),
    categoryCode: String(ticket.categoryCode || ""),
    quantity: 1,
    unitPrice: Number(ticket.price || 0),
    totalPrice: Number(ticket.price || 0),
    seatPreview: ticket.seatDetails || "",
    ticketLabels: [ticketSummaryLabel(ticket)],
    ticketIds: [ticket.id],
  }];
  state.invoiceSchedule = [];
  state.invoiceScheduleTouched = false;
  renderSaleBlocks();
  saleForm.elements.pricePerTicket.value = ticket.price || "";
  saleForm.elements.totalPrice.value = ticket.price || "";
  renderInvoiceScheduleEditor();
  setSaleFormVisible(true);
  saleForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function syncSaleTotals() {
  if (!saleForm) return;
  const exchangeRate = currentInvoiceExchangeRate();
  const quantity = Number(saleForm.elements.quantity.value || 0);
  const discountAmount = currentDiscountUsd();
  const computedTotalUsd = state.saleBlocks.length ? currentSaleTotalUsd() : 0;
  saleForm.elements.totalPrice.value = computedTotalUsd ? String(computedTotalUsd) : "";
  if (saleForm.elements.totalPriceMnt) saleForm.elements.totalPriceMnt.value = computedTotalUsd ? String(Math.round(computedTotalUsd * exchangeRate)) : "";
  if (saleForm.elements.discountAmount) saleForm.elements.discountAmount.value = String(discountAmount);
  if (saleForm.elements.amountPaid) saleForm.elements.amountPaid.value = String(currentAmountPaidUsd());
  const totalPrice = Number(saleForm.elements.totalPrice.value || 0);
  const amountPaid = Number(saleForm.elements.amountPaid.value || 0);
  saleForm.elements.paymentStatus.value = totalPrice > 0 && amountPaid >= totalPrice ? "paid" : amountPaid > 0 ? "partial" : "unpaid";
  saleForm.elements.paymentMethod.value = saleForm.elements.invoiceBankAccount?.value || "state";
  saleForm.elements.soldAt.value = saleForm.elements.soldAt.value || new Date().toISOString().slice(0, 10);
  const buyerTitle = String(saleForm.elements.buyerTitle?.value || "").trim();
  saleForm.elements.buyerName.value = state.participants.map(combinedParticipantName).find(Boolean) || buyerTitle;
  const leadParticipant = state.participants[0] || {};
  saleForm.elements.buyerPassportNumber.value = leadParticipant.passportNumber || "";
  saleForm.elements.buyerNationality.value = leadParticipant.nationality || "Mongolian";
  saleForm.elements.buyerPhone.value = "";
  saleForm.elements.buyerEmail.value = "";
}

function createSaleBlockFromSelection() {
  if (!saleMatchSelect || !saleCategorySelect || !saleBlockQuantityInput) return null;
  const matchNumber = saleMatchSelect.value;
  const categoryLabel = saleCategorySelect.value;
  const categoryCode = categoryLabel.replace(/^CAT\s+/i, "").trim();
  const quantity = Math.max(Number(saleBlockQuantityInput.value || 0), 0);
  if (!matchNumber || !categoryCode || !quantity) {
    throw new Error("Choose match, category, and seats first");
  }
  const availableTickets = saleBlockAvailableTickets(matchNumber, categoryCode, selectedSaleTicketIds());
  const chosen = availableTickets.filter((ticket) => state.pendingSaleSeatIds.includes(ticket.id));
  if (chosen.length !== quantity) {
    throw new Error("Choose the exact seats you want first");
  }
  const leadTicket = chosen[0] || null;
  return {
    matchNumber,
    matchLabel: leadTicket
      ? buildMatchTitle(leadTicket.matchNumber, leadTicket.teamA, leadTicket.teamB)
      : buildMatchTitle(matchNumber, "", ""),
    categoryCode,
    quantity,
    unitPrice: leadTicket ? Number(leadTicket.price || 0) : 0,
    totalPrice: chosen.reduce((sum, ticket) => sum + Number(ticket.price || 0), 0),
    seatPreview: chosen.map((ticket) => ticket.seatDetails || "Seat will be assigned later").join(" | "),
    ticketLabels: chosen.map((ticket) => ticketSummaryLabel(ticket)),
    ticketIds: chosen.map((ticket) => ticket.id),
  };
}

function filteredTickets() {
  const query = ticketFilters.search.value.trim().toLowerCase();
  return [...state.tickets]
    .filter((ticket) => {
      if (ticketFilters.stage.value && ticket.stage !== ticketFilters.stage.value) return false;
      if (ticketFilters.match.value && `${ticket.matchNumber} · ${ticket.matchLabel}` !== ticketFilters.match.value) return false;
      if (ticketFilters.city.value && ticket.city !== ticketFilters.city.value) return false;
      if (ticketFilters.category.value && ticket.categoryCode !== ticketFilters.category.value) return false;
      if (ticketFilters.visibility.value && ticket.visibility !== ticketFilters.visibility.value) return false;
      if (ticketFilters.availability.value === "available" && ticket.availableQuantity <= 0) return false;
      if (ticketFilters.availability.value === "sold-out" && ticket.availableQuantity > 0) return false;
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
      const dateDiff = String(left.matchDate || "").localeCompare(String(right.matchDate || ""));
      if (dateDiff !== 0) return dateDiff;
      return matchNumberSortValue(left.matchNumber) - matchNumberSortValue(right.matchNumber);
    });
}

function groupTicketsByMatch(tickets) {
  const groups = new Map();
  tickets.forEach((ticket) => {
    const key = matchIdentity(ticket);
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
        tickets: [],
      });
    }
    groups.get(key).tickets.push(ticket);
  });

  return [...groups.values()]
    .map((group) => {
      const groupTickets = group.tickets.sort((left, right) => {
        const categoryDiff = Number(left.categoryCode || 0) - Number(right.categoryCode || 0);
        if (categoryDiff !== 0) return categoryDiff;
        const seatDiff = compareTicketSeatOrder(left, right);
        if (seatDiff !== 0) return seatDiff;
        const labelDiff = naturalTextCompare(left.seatDetails, right.seatDetails);
        if (labelDiff !== 0) return labelDiff;
        return naturalTextCompare(left.createdAt, right.createdAt);
      });
      const availableUnits = groupTickets.reduce((sum, ticket) => sum + Number(ticket.availableQuantity || 0), 0);
      const soldUnits = groupTickets.reduce((sum, ticket) => sum + Number(ticket.soldQuantity || 0), 0);
      const categoryBreakdown = ["1", "2", "3"].map((categoryCode) => {
        const categoryTickets = groupTickets.filter((ticket) => String(ticket.categoryCode || "") === categoryCode);
        const total = categoryTickets.reduce((sum, ticket) => sum + Number(ticket.totalQuantity || 0), 0);
        const available = categoryTickets.reduce((sum, ticket) => sum + Number(ticket.availableQuantity || 0), 0);
        const sold = categoryTickets.reduce((sum, ticket) => sum + Number(ticket.soldQuantity || 0), 0);
        const priceTicket = categoryTickets.find((ticket) => Number(ticket.price || 0) > 0) || categoryTickets[0] || null;
        return {
          categoryCode,
          total,
          available,
          sold,
          price: priceTicket ? Number(priceTicket.price || 0) : 0,
          currency: priceTicket?.currency || groupTickets[0]?.currency || "USD",
        };
      }).filter((item) => item.total > 0);
      return {
        ...group,
        label: buildMatchLabel(group.teamA, group.teamB),
        tickets: groupTickets,
        ticketCount: groupTickets.length,
        availableUnits,
        soldUnits,
        categoryBreakdown,
      };
    })
    .sort((left, right) => {
      const dateDiff = String(left.matchDate || "").localeCompare(String(right.matchDate || ""));
      if (dateDiff !== 0) return dateDiff;
      return matchNumberSortValue(left.matchNumber) - matchNumberSortValue(right.matchNumber);
    });
}

function buildTicketGroups() {
  return groupTicketsByMatch(filteredTickets());
}

function filteredSales() {
  const query = saleFilters.search.value.trim().toLowerCase();
  return [...state.sales]
    .filter((sale) => {
      if (saleFilters.payment.value && sale.paymentStatus !== saleFilters.payment.value) return false;
      if (saleFilters.status.value && sale.saleStatus !== saleFilters.status.value) return false;
      if (saleFilters.city.value && sale.city !== saleFilters.city.value) return false;
      if (saleFilters.soldBy.value && sale.soldByName !== saleFilters.soldBy.value) return false;
      if (saleFilters.paidState.value === "paid-in-full" && !sale.isPaid) return false;
      if (saleFilters.paidState.value === "balance-due" && sale.balanceDue <= 0) return false;
      if (!query) return true;
      return [
        sale.buyerName,
        sale.buyerPhone,
        sale.buyerEmail,
        sale.buyerPassportNumber,
        sale.ticketLabel,
        sale.city,
        sale.seatDetails,
      ].some((value) => String(value || "").toLowerCase().includes(query));
    })
    .sort((left, right) => String(right.soldAt || "").localeCompare(String(left.soldAt || "")));
}

function renderTickets() {
  const groups = buildTicketGroups();
  if (ticketCountNode) ticketCountNode.textContent = `${groups.length} matches`;
  if (ticketMetaNode) {
    ticketMetaNode.textContent = "";
  }
  if (!ticketList) return;
  if (!groups.length) {
    ticketList.innerHTML = '<p class="empty">No saved matches yet.</p>';
    return;
  }
  ticketList.innerHTML = `
    <div class="fifa-match-accordion fifa-match-accordion--table">
      <div class="fifa-match-table-head">
        <span>#</span>
        <span>Date</span>
        <span>Match</span>
        <span>Availability</span>
        <span>City</span>
        <span>Group</span>
        <span>Stage</span>
        <span>Actions</span>
      </div>
      ${groups
        .map((group, index) => {
          const isExpanded = state.expandedMatches.has(group.key);
          const availabilitySummary = group.categoryBreakdown
            .map(
              (item) => `
                    ${item.available > 0 ? `<span class="fifa-availability-line is-available">CAT ${item.categoryCode} available: ${item.available}</span>` : ""}
                    ${item.sold > 0 ? `<span class="fifa-availability-line is-sold">CAT ${item.categoryCode} sold: ${item.sold}</span>` : ""}
              `
            )
            .join("");
          const availabilityBadges = `
            ${availabilitySummary}
            <span class="fifa-availability-line is-available">Total available: ${group.availableUnits}</span>
            ${group.soldUnits > 0 ? `<span class="fifa-availability-line is-sold">Total sold: ${group.soldUnits}</span>` : ""}
          `;
          const priceSummary = group.categoryBreakdown
            .filter((item) => item.price > 0)
            .map((item) => `<span class="fifa-price-line">Cat ${item.categoryCode}: ${escapeHtml(formatMoney(item.price, item.currency))}</span>`)
            .join("");
          return `
            <article class="fifa-match-card ${isExpanded ? "is-open" : ""}">
              <div class="fifa-match-toggle" data-action="toggle-match" data-match-key="${escapeHtml(group.key)}" role="button" tabindex="0">
                <div class="fifa-match-col fifa-match-col--number">
                  <strong>${isExpanded ? "▾" : "▸"} ${index + 1}</strong>
                </div>
                <div class="fifa-match-col">
                  <strong>${escapeHtml(formatDate(group.matchDate))}</strong>
                  <span class="fifa-table-sub">${escapeHtml(group.matchNumber)}</span>
                </div>
                <div class="fifa-match-col fifa-match-col--teams">
                  <strong>${escapeHtml(group.label)}</strong>
                  <span class="fifa-table-sub">${escapeHtml(group.venue || "-")}</span>
                </div>
                <div class="fifa-match-col fifa-match-col--availability">
                  <div class="fifa-availability-block">
                    ${availabilityBadges}
                  </div>
                  ${priceSummary ? `<div class="fifa-price-block">${priceSummary}</div>` : ""}
                </div>
                <div class="fifa-match-col fifa-match-col--city">
                  <strong>${escapeHtml(group.city)}</strong>
                </div>
                <div class="fifa-match-col fifa-match-col--group">
                  <strong>${escapeHtml(group.groupLabel || "-")}</strong>
                </div>
                <div class="fifa-match-col fifa-match-col--stage">
                  <strong>${escapeHtml(group.stage)}</strong>
                </div>
                <div class="fifa-match-col fifa-match-col--actions">
                  <details class="trip-menu fifa-action-menu">
                    <summary class="trip-menu-trigger" data-action="toggle-match-menu" aria-label="Match actions">⋮</summary>
                    <div class="trip-menu-popover">
                      <button type="button" class="trip-menu-item" data-action="edit-match" data-match-number="${escapeHtml(group.matchNumber)}">Edit</button>
                      <button type="button" class="trip-menu-item" data-action="add-ticket-match" data-match-number="${escapeHtml(group.matchNumber)}">Add Ticket</button>
                      <button type="button" class="trip-menu-item is-danger" data-action="delete-match" data-match-key="${escapeHtml(group.key)}">Delete</button>
                    </div>
                  </details>
                </div>
              </div>
              ${
                isExpanded
                  ? `
                    <div class="fifa-match-details">
                      ${
                        group.tickets.length
                          ? `
                            <table class="manager-table fifa-table fifa-nested-table">
                              <thead>
                                <tr>
                                  <th>#</th>
                                  <th class="checkbox-col">Mark</th>
                                  <th>Category</th>
                                  <th>Seat / Ticket Number</th>
                                  <th>Price</th>
                                  <th>Qty</th>
                                  <th>Visibility</th>
                                  <th>Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                ${group.tickets
                                  .map((ticket, ticketIndex) => {
                                    const relatedSale = state.sales.find((sale) => {
                                      const saleTicketIds = sale.ticketIds?.length ? sale.ticketIds : (sale.ticketId ? [sale.ticketId] : []);
                                      return saleTicketIds.includes(ticket.id) && sale.saleStatus !== "cancelled";
                                    });
                                    const soldBuyerLabel = relatedSale?.buyerTitle || relatedSale?.buyerName || "Sold buyer";
                                    const soldOut = Number(ticket.availableQuantity || 0) <= 0 && Number(ticket.soldQuantity || 0) > 0;
                                    return `
                                      <tr class="${soldOut ? "is-sold" : ""}">
                                        <td>${ticketIndex + 1}</td>
                                        <td class="checkbox-col">
                                          <input type="checkbox" data-action="select-ticket" data-id="${escapeHtml(ticket.id)}" ${state.selectedTickets.has(ticket.id) ? "checked" : ""} />
                                        </td>
                                        <td>
                                          <strong>CAT ${escapeHtml(ticket.categoryCode)}</strong>
                                          <span class="fifa-table-sub">${escapeHtml(ticket.categoryName || "-")}</span>
                                        </td>
                                        <td>
                                          <strong>${escapeHtml(ticket.seatDetails || "-")}</strong>
                                          <span class="fifa-table-sub">${escapeHtml(ticket.seatSection || "")}</span>
                                        </td>
                                        <td>${escapeHtml(formatMoney(ticket.price, ticket.currency))}</td>
                                        <td>
                                          <strong>${soldOut ? "Sold" : `${ticket.availableQuantity}/${ticket.totalQuantity}`}</strong>
                                          <span class="fifa-table-sub">${soldOut ? "Buyer assigned" : `sold ${ticket.soldQuantity}`}</span>
                                        </td>
                                        <td>
                                          <span class="fifa-pill ${ticket.visibility === "public" ? "is-public" : "is-private"}">${escapeHtml(ticket.visibility)}</span>
                                          ${ticket.seatAssignedLater ? '<span class="fifa-pill">assigned later</span>' : ""}
                                        </td>
                                        <td class="fifa-actions-cell">
                                          ${
                                            soldOut
                                              ? `
                                                <span class="fifa-inline-badge fifa-inline-badge--sold">Sold</span>
                                                <button type="button" class="button-secondary fifa-inline-action fifa-inline-action--see-buyer" data-action="view-sold-ticket" data-id="${escapeHtml(ticket.id)}">See buyer</button>
                                              `
                                              : `
                                                <button type="button" class="button-secondary" data-action="edit-ticket" data-id="${escapeHtml(ticket.id)}">Edit</button>
                                                <button type="button" class="button-secondary" data-action="toggle-visibility" data-id="${escapeHtml(ticket.id)}">${ticket.visibility === "public" ? "Make private" : "Make public"}</button>
                                                <button type="button" class="button-secondary" data-action="delete-ticket" data-id="${escapeHtml(ticket.id)}">Delete</button>
                                              `
                                          }
                                        </td>
                                      </tr>
                                    `;
                                  })
                                  .join("")}
                              </tbody>
                            </table>
                          `
                          : '<p class="empty">No ticket rows for this match yet.</p>'
                      }
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

function buildInvoiceItemsForSale(sale) {
  const items = (sale.ticketBlocks || [])
    .filter((block) => Number(block.quantity || 0) > 0)
    .map((block, index) => ({
      index: index + 1,
      description: block.matchLabel || "-",
      quantity: Number(block.quantity || 0),
      unitPrice: Number(block.unitPrice || 0),
      totalPrice: Number(block.totalPrice || 0),
      categoryCode: block.categoryCode || "",
    }));
  if (items.length) return items;
  const grouped = {};
  (sale.ticketIds || []).forEach((ticketId) => {
    const ticket = state.tickets.find((item) => item.id === ticketId);
    if (!ticket) return;
    const key = `${ticket.matchNumber || ""}|${ticket.categoryCode || ""}`;
    if (!grouped[key]) {
      grouped[key] = {
        description: buildMatchTitle(ticket.matchNumber, ticket.teamA, ticket.teamB),
        quantity: 0,
        unitPrice: Number(ticket.price || 0),
        totalPrice: 0,
        categoryCode: ticket.categoryCode || "",
      };
    }
    grouped[key].quantity += 1;
    grouped[key].totalPrice += Number(ticket.price || 0);
  });
  return Object.values(grouped).map((item, index) => ({ index: index + 1, ...item }));
}

function buildInvoiceRowsForSale(sale) {
  const items = buildInvoiceItemsForSale(sale);
  const discountAmount = Math.max(Number(sale.discountAmount || 0), 0);
  const rows = discountAmount > 0
    ? [
        ...items,
        {
          index: items.length + 1,
          description: "Хямдрал",
          quantity: "",
          unitPrice: "",
          totalPrice: -discountAmount,
          categoryCode: "",
          isDiscount: true,
        },
      ]
    : items;
  const labels = Array.isArray(sale.invoiceDescriptions) ? sale.invoiceDescriptions : [];
  return rows.map((row, index) => ({
    ...row,
    description: labels[index] || row.description,
  }));
}

function buildInvoiceScheduleForSale(sale) {
  return activeInvoiceSchedule(sale).map((row) => ({
    ...row,
    statusMeta: row.status === "paid"
      ? { label: "Төлөгдсөн", className: "paid" }
      : row.status === "overdue"
        ? { label: "Хугацаа хэтэрсэн", className: "overdue" }
        : { label: "Хүлээгдэж буй", className: "waiting" },
  }));
}

function renderSales() {
  const sales = filteredSales();
  if (!sales.length) {
    if (saleList) saleList.innerHTML = '<p class="empty">No sales match these filters yet.</p>';
    return;
  }
  if (!saleList) return;
  saleList.innerHTML = `
    <div class="fifa-match-accordion fifa-match-accordion--table fifa-sales-accordion">
      <div class="fifa-match-table-head fifa-sales-table-head">
        <span>#</span>
        <span>Buyer</span>
        <span>Tickets</span>
        <span>Total</span>
        <span>Paid</span>
        <span>Status</span>
        <span>Manager</span>
        <span>Actions</span>
      </div>
      ${sales
        .map((sale, saleIndex) => {
          const editingInvoice = Boolean(invoiceDraftForSale(sale));
          const invoiceSource = saleLikeWithInvoiceDraft(sale);
          const isExpanded = state.expandedSales.has(sale.id);
          const ticketLines = (sale.ticketIds || []).map((ticketId, index) => {
            const ticket = state.tickets.find((item) => item.id === ticketId);
            const participant = sale.participants?.find((p) => p.ticketId === ticketId) || sale.participants?.[index];
            return {
              ticketId,
              matchNumber: ticket?.matchNumber || "",
              matchDate: ticket?.matchDate || "",
              matchLabel: ticket ? `${ticket.matchNumber}: ${buildMatchLabel(ticket.teamA, ticket.teamB)}` : sale.ticketLabel || "-",
              unitPrice: ticket?.price || sale.pricePerTicket || 0,
              ticketLabel: ticket ? ticketSummaryLabel(ticket) : sale.ticketLabel || "-",
              travelerName: participant?.name || "-",
              travelerPassport: participant?.passportNumber || "",
              seatSortValue: ticket ? extractSeatSortValue(ticket.seatDetails) : extractSeatSortValue(participant?.ticketLabel || ""),
            };
          });
          if (!ticketLines.length && sale.ticketBlocks?.length) {
            sale.ticketBlocks.forEach((block) => {
              (block.ticketLabels || []).forEach((label, index) => {
                const participant = sale.participants?.[ticketLines.length];
                ticketLines.push({
                  ticketId: participant?.ticketId || `${block.matchNumber}-${index}`,
                  matchNumber: block.matchNumber || "",
                  matchDate: "",
                  matchLabel: block.matchLabel || sale.ticketLabel || "-",
                  unitPrice: block.unitPrice || sale.pricePerTicket || 0,
                  ticketLabel: label,
                  travelerName: participant?.name || "-",
                  travelerPassport: participant?.passportNumber || "",
                  seatSortValue: extractSeatSortValue(label),
                });
              });
            });
          }
          const groupedTicketLines = [...ticketLines]
            .sort((left, right) => {
              const dateDiff = String(left.matchDate || "").localeCompare(String(right.matchDate || ""));
              if (dateDiff !== 0) return dateDiff;
              const matchDiff = matchNumberSortValue(left.matchNumber) - matchNumberSortValue(right.matchNumber);
              if (matchDiff !== 0) return matchDiff;
              const blockDiff = naturalTextCompare(left.seatSortValue.block, right.seatSortValue.block);
              if (blockDiff !== 0) return blockDiff;
              const rowDiff = naturalTextCompare(left.seatSortValue.row, right.seatSortValue.row);
              if (rowDiff !== 0) return rowDiff;
              const seatDiff = left.seatSortValue.seat - right.seatSortValue.seat;
              if (seatDiff !== 0) return seatDiff;
              return naturalTextCompare(left.ticketLabel, right.ticketLabel);
            })
            .reduce((groups, item) => {
              const key = item.matchLabel || "-";
              if (!groups[key]) groups[key] = [];
              groups[key].push(item);
              return groups;
            }, {});
          const groupedSaleSummaries = Object.entries(groupedTicketLines).map(([matchLabel, items]) => ({
            matchLabel,
            quantity: items.length,
            total: items.reduce((sum, item) => sum + Number(item.unitPrice || 0), 0),
          }));
          const blockTotalPrice = (sale.ticketBlocks || []).reduce((sum, block) => sum + Number(block.totalPrice || 0), 0);
          const discountAmount = Number(sale.discountAmount || 0);
          const lineTotalPrice = ticketLines.length
            ? ticketLines.reduce((sum, item) => sum + Number(item.unitPrice || 0), 0)
            : 0;
          const computedBaseTotal = blockTotalPrice || lineTotalPrice || Number(sale.totalPrice || 0);
          const computedTotalPrice = Math.max(Number(sale.totalPrice || 0) || (computedBaseTotal - discountAmount), 0);
          const exchangeRate = Math.max(Number(invoiceSource.invoiceExchangeRate || DEFAULT_INVOICE_EXCHANGE_RATE), 1);
          const totalMnt = Math.max(0, Math.round(computedTotalPrice * exchangeRate));
          const paidMnt = Math.max(0, Math.round(Number(sale.amountPaid || 0) * exchangeRate));
          const balanceMnt = Math.max(0, totalMnt - paidMnt);
          const saleStatus = normalizeSaleStatusValue(sale.saleStatus);
          const saleStatusClass = saleStatus === "confirmed"
            ? "is-paid"
            : saleStatus === "cancelled"
              ? "is-cancelled"
              : "is-pending";
          const saleStatusText = saleStatusLabel(sale.saleStatus);
          const paymentLabel = paidMnt <= 0
            ? "Pending"
            : paidMnt >= totalMnt && totalMnt > 0
              ? "100% paid"
              : "In progress";
          const paymentClass = paidMnt >= totalMnt && totalMnt > 0
            ? "is-paid"
            : paidMnt > 0
              ? "is-pending"
              : "is-pending";
          const invoiceRows = buildInvoiceRowsForSale(invoiceSource);
          const invoiceSchedule = buildInvoiceScheduleForSale(invoiceSource);
          const invoiceBank = getInvoiceBankAccount(invoiceSource.invoiceBankAccount || "state");
          return `
            <article class="fifa-match-card fifa-sale-card ${isExpanded ? "is-open" : ""}">
              <div class="fifa-match-toggle fifa-sale-toggle" data-action="toggle-sale" data-id="${escapeHtml(sale.id)}" role="button" tabindex="0">
                <div class="fifa-match-col fifa-match-col--number">
                  <strong>${isExpanded ? "▾" : "▸"} ${saleIndex + 1}</strong>
                </div>
                <div class="fifa-match-col fifa-match-col--teams">
                  <strong>${escapeHtml(sale.buyerTitle || sale.buyerName || "-")}</strong>
                  ${sale.buyerTitle ? `<span class="fifa-table-sub">${escapeHtml(sale.buyerName || "")}</span>` : ""}
                  <span class="fifa-table-sub">${escapeHtml(sale.buyerPhone || sale.buyerEmail || "-")}</span>
                </div>
                <div class="fifa-match-col">
                  <strong>${ticketLines.length || sale.quantity} ticket(s)</strong>
                  <div class="fifa-sale-summary-preview">
                    ${groupedSaleSummaries.map((item) => `<span class="fifa-table-sub">${escapeHtml(item.matchLabel)} · ${item.quantity} ticket(s) · ${escapeHtml(formatMoney(Math.round(item.total * exchangeRate), "MNT"))}</span>`).join("")}
                  </div>
                </div>
                <div class="fifa-match-col">
                  <strong>${escapeHtml(formatMoney(totalMnt, "MNT"))}</strong>
                  <span class="fifa-table-sub">Balance ${escapeHtml(formatMoney(balanceMnt, "MNT"))}</span>
                </div>
                <div class="fifa-match-col">
                  <strong>${escapeHtml(formatMoney(paidMnt, "MNT"))}</strong>
                  <span class="fifa-table-sub">${escapeHtml(formatDate(sale.soldAt))}</span>
                </div>
                <div class="fifa-match-col fifa-sale-status-col">
                  <span class="fifa-pill ${saleStatusClass}">${escapeHtml(saleStatusText)}</span>
                  <span class="fifa-table-sub">Payment: ${escapeHtml(paymentLabel)}</span>
                </div>
                <div class="fifa-match-col">
                  <strong>${escapeHtml(sale.soldByName || "-")}</strong>
                </div>
                <div class="fifa-match-col fifa-match-col--actions">
                  <details class="trip-menu fifa-action-menu">
                    <summary class="trip-menu-trigger" aria-label="Sale actions">⋮</summary>
                    <div class="trip-menu-popover">
                      <button type="button" class="trip-menu-item" data-action="edit-sale" data-id="${escapeHtml(sale.id)}">Edit</button>
                      <button type="button" class="trip-menu-item is-danger" data-action="delete-sale" data-id="${escapeHtml(sale.id)}">Delete</button>
                    </div>
                  </details>
                </div>
              </div>
              ${
                isExpanded
                  ? `
                    <div class="fifa-match-details">
                      <div class="fifa-sale-groups">
                        ${Object.entries(groupedTicketLines).map(([matchLabel, items]) => `
                          <section class="fifa-sale-group">
                            <div class="fifa-sale-group-head">
                              <strong>MATCH ${escapeHtml(matchLabel)}</strong>
                              <span class="fifa-table-sub">${items.length} ticket(s) · ${escapeHtml(formatMoney(items.reduce((sum, item) => sum + Number(item.unitPrice || 0), 0)))} total</span>
                            </div>
                            <table class="manager-table fifa-table fifa-nested-table fifa-sale-nested-table">
                              <thead>
                                <tr>
                                  <th>#</th>
                                  <th>Ticket</th>
                                  <th>Price</th>
                                  <th>Traveler</th>
                                </tr>
                              </thead>
                              <tbody>
                                ${items.map((item, index) => `
                                  <tr>
                                    <td>${index + 1}</td>
                                    <td>
                                      <strong>Ticket ${index + 1}</strong>
                                      <span class="fifa-table-sub">${escapeHtml(item.ticketLabel)}</span>
                                    </td>
                                    <td>${escapeHtml(formatMoney(item.unitPrice || 0))}</td>
                                    <td>
                                      <strong>${escapeHtml(item.travelerName || "-")}</strong>
                                      <span class="fifa-table-sub">${escapeHtml(item.travelerPassport || "")}</span>
                                    </td>
                                  </tr>
                                `).join("")}
                              </tbody>
                            </table>
                          </section>
                        `).join("")}
                      </div>
                      <section class="fifa-sale-inline-invoice">
                        <div class="fifa-sale-inline-invoice-head">
                          <strong>PAYMENT SCHEDULE</strong>
                          <div class="fifa-sale-inline-actions">
                            <button type="button" class="button-secondary fifa-inline-action" data-action="edit-sale" data-id="${escapeHtml(sale.id)}">Edit</button>
                            <button type="button" class="button-secondary fifa-inline-action" data-action="delete-sale" data-id="${escapeHtml(sale.id)}">Delete</button>
                          </div>
                        </div>
                        <div class="fifa-sale-inline-schedule">
                          <div class="fifa-sale-inline-schedule-list">
                            ${invoiceSchedule.map((row) => `
                              <div class="fifa-sale-inline-schedule-row">
                                <div class="fifa-sale-inline-schedule-main">
                                  <strong>${escapeHtml(row.title)}</strong>
                                  <span class="fifa-table-sub">Created ${escapeHtml(row.created || "-")} · Due / paid ${escapeHtml(row.due || "-")}</span>
                                </div>
                                <span class="fifa-pill is-${escapeHtml(row.statusMeta.className)}">${escapeHtml(row.statusMeta.label)}</span>
                                <strong>${escapeHtml(formatMoney(Number(row.amount || 0) * exchangeRate, "MNT"))}</strong>
                              </div>
                            `).join("")}
                          </div>
                          <div class="fifa-invoice-schedule-footer">
                            <span>Total scheduled: ${escapeHtml(formatMoney(invoiceSchedule.reduce((sum, row) => sum + Number(row.amount || 0), 0) * exchangeRate, "MNT"))}</span>
                            <span>Total balance: ${escapeHtml(formatMoney(Math.max((computedTotalPrice * exchangeRate) - (invoiceSchedule.reduce((sum, row) => sum + Number(row.amount || 0), 0) * exchangeRate), 0), "MNT"))}</span>
                          </div>
                        </div>
                      </section>
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

function openSaleInvoice(sale) {
  const formatInvoiceDate = (value) => {
    const normalized = formatDate(value);
    return normalized && normalized !== "-" ? normalized.replaceAll("-", ".") : "-";
  };
  const invoiceNumber = `FIFA-${String(sale.id || "").slice(0, 8).toUpperCase() || "00000000"}-1`;
  const buyerName = sale.buyerName || sale.buyerTitle || "-";
  const soldDate = formatDate(sale.soldAt);
  const invoiceDate = formatInvoiceDate(sale.soldAt);
  const exchangeRate = Math.max(Number(sale.invoiceExchangeRate || DEFAULT_INVOICE_EXCHANGE_RATE), 1);
  const formatMnt = (value) => `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(Number(value || 0)))} ₮`;
  const invoiceRows = buildInvoiceRowsForSale(sale);
  const total = saleInvoiceTotal(sale);
  const paymentRows = buildInvoiceScheduleForSale(sale);
  const selectedBankAccount = sale.invoiceBankAccount || "state";
  const popup = window.open("", "_blank");
  if (!popup) return;
  popup.document.write(`
    <html>
      <head>
        <title>FIFA Invoice</title>
        <style>
          @page { size: A4; margin: 14mm; }
          * { box-sizing: border-box; }
          body { margin: 0; background: #f3f5fb; color: #22283a; font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 14px; }
          .toolbar { position: sticky; top: 0; z-index: 10; display: flex; justify-content: center; gap: 12px; padding: 16px; background: rgba(255, 255, 255, 0.96); border-bottom: 1px solid rgba(34, 40, 58, 0.08); backdrop-filter: blur(10px); }
          .toolbar button { padding: 12px 18px; border: none; border-radius: 999px; background: #253776; color: #fff; font: 700 14px/1.2 Inter, system-ui, sans-serif; cursor: pointer; }
          .toolbar .secondary { background: #e9edf8; color: #2a3c78; }
          .toolbar .save { background: #157347; }
          .page { width: min(980px, calc(100vw - 48px)); min-height: calc(min(980px, calc(100vw - 48px)) * 1.4142); margin: 18px auto 32px; padding: 72px 62px 68px; background: #fff; border: 1px solid #e6e8ef; border-radius: 12px; box-shadow: 0 16px 44px rgba(34, 40, 58, 0.08); }
          .invoice-number { margin: 0 0 18px; color: #3b4257; font-size: 17px; font-weight: 500; }
          .header-grid { display: grid; grid-template-columns: 1.1fr 1fr; gap: 26px; align-items: start; }
          .invoice-logo { width: 154px; max-width: 100%; display: block; margin-bottom: 8px; }
          .company-name { margin: 0 0 6px; font-size: 15px; font-weight: 700; color: #2a3150; }
          .company-block p, .customer-block p, .meta-note { margin: 0; font-size: 14px; line-height: 1.4; }
          .meta-note { text-align: right; color: #535b74; }
          .customer-block { padding-top: 54px; }
          .customer-block .label { display: block; margin-bottom: 4px; color: #6f7791; font-size: 13px; }
          .section-title { margin: 22px 0 12px; color: #7f889d; font-size: 14px; font-weight: 500; }
          table { width: 100%; border-collapse: collapse; overflow: hidden; border-radius: 12px; border: 1px solid #e7e9f1; }
          th, td { padding: 11px 12px; border-bottom: 1px solid #eceef5; text-align: left; font-size: 14px; }
          th { background: #fbfcfe; color: #4d566f; font-weight: 700; }
          td:last-child, th:last-child, td:nth-last-child(2), th:nth-last-child(2) { text-align: right; }
          .total-row td { font-weight: 700; background: #fdfdfd; }
          .payment-stack { display: grid; gap: 14px; }
          .payment-card { display: grid; grid-template-columns: 1.3fr repeat(3, minmax(110px, 0.8fr)) auto; gap: 14px; align-items: center; padding: 15px 16px; border: 1px solid #e7e9f1; border-radius: 14px; background: #fff; }
          .payment-title, .payment-amount { font-size: 14px; font-weight: 600; color: #2b3148; }
          .payment-amount { text-align: right; white-space: nowrap; }
          .payment-meta { display: grid; gap: 4px; }
          .meta-value { font-size: 14px; font-weight: 600; color: #2b3148; }
          .meta-label { color: #8b93a9; font-size: 13px; }
          .payment-status { display: inline-flex; align-items: center; justify-content: center; min-height: 30px; padding: 6px 12px; border-radius: 999px; font-size: 13px; font-weight: 700; }
          .payment-status.paid { background: #dcf4e3; color: #1f8550; }
          .payment-status.overdue { background: #f8dede; color: #c44747; }
          .payment-status.waiting { background: #eef2fb; color: #506189; }
          .payment-status-select { display: none; min-height: 38px; padding: 8px 12px; border: 1px solid #cfd7eb; border-radius: 12px; background: #fff; color: #2b3148; font: 600 13px/1.2 Inter, system-ui, sans-serif; }
          body.is-editing .payment-status { display: none; }
          body.is-editing .payment-status-select { display: inline-flex; }
          .exchange-section { margin-top: 16px; display: none; }
          body.is-editing .exchange-section { display: block; }
          .exchange-rate-input { width: 220px; min-height: 40px; padding: 8px 12px; border: 1px solid #cfd7eb; border-radius: 12px; background: #fff; color: #2b3148; font: 600 13px/1.2 Inter, system-ui, sans-serif; }
          .bank-section { margin-top: 16px; padding-bottom: 0; }
          .bank-select-wrap { display: none; margin: 0 0 10px; }
          .bank-account-select { width: 100%; min-height: 40px; padding: 8px 12px; border: 1px solid #cfd7eb; border-radius: 12px; background: #fff; color: #2b3148; font: 600 13px/1.2 Inter, system-ui, sans-serif; }
          body.is-editing .bank-select-wrap { display: block; }
          .bank-grid { display: flex; gap: 10px; flex-wrap: wrap; align-items: baseline; font-size: 14px; color: #2d344c; }
          .invoice-footer { margin-top: 28px; padding-top: 18px; border-top: 1px solid #e7e9f1; }
          .invoice-footer-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; align-items: start; }
          .invoice-footer-party { display: flex; flex-direction: column; }
          .invoice-footer-label { margin: 0 0 10px; color: #8b93a9; font-size: 13px; }
          .finance-asset-wrap { position: relative; min-height: 136px; }
          .finance-stamp { position: absolute; left: 16px; top: 14px; width: 172px; z-index: 2; }
          .finance-stamp img { width: 100%; height: auto; display: block; }
          .finance-signature { position: absolute; left: 74px; top: 18px; width: 150px; z-index: 1; height: 62px; overflow: hidden; }
          .finance-signature img { width: 220px; max-width: none; display: block; transform: translate(-42px, -28px) rotate(-3deg); }
          .invoice-footer-space { min-height: 136px; }
          .invoice-sign-line { height: 1px; background: #d6dceb; }
          .invoice-sign-name { margin-top: 8px; font-size: 13px; font-weight: 700; color: #2b3148; }
          .invoice-view-text { display: inline; }
          .invoice-edit-input { display: none; }
          body.is-editing .invoice-view-text { display: none; }
          body.is-editing .invoice-edit-input { display: block; width: 100%; min-height: 36px; padding: 8px 10px; border: 1px solid #cfd7eb; border-radius: 10px; background: #fff; color: #2b3148; font: 600 13px/1.2 Inter, system-ui, sans-serif; }
          @media print {
            .toolbar { display: none; }
            .exchange-section { display: none !important; }
            body { background: #fff; }
            .page { width: auto; min-height: auto; margin: 0; padding: 18mm 16mm 18mm; border: none; border-radius: 0; box-shadow: none; }
          }
        </style>
      </head>
      <body>
        <div class="toolbar">
          <button type="button" class="secondary" data-mode="view">View</button>
          <button type="button" class="secondary" data-mode="edit">Edit</button>
          <button type="button" class="save" data-save hidden>Save</button>
          <button type="button" data-print>PDF Татах</button>
        </div>
        <div class="page">
          <p class="invoice-number">Нэхэмжлэх #${escapeHtml(invoiceNumber)}</p>
          <div class="header-grid">
            <div class="company-block">
              <img class="invoice-logo" src="/assets/logo.png" alt="Дэлхий Трэвел" />
              <p class="company-name">Дэлхий Трэвел Икс ХХК (6925073)</p>
              <p>Улаанбаатар хот, ХУД, 17-р хороо</p>
              <p>Их Монгол Улс гудамж, Кинг Тауэр, 121 байр, 102 тоот</p>
              <p>info@travelx.mn</p>
              <p>+976 72007722</p>
            </div>
            <div>
              <p class="meta-note">Сангийн сайдын 2017 оны 12 дугаар сарын 05</p>
              <p class="meta-note">өдрийн 347 тоот тушаалын хавсралт</p>
              <div class="customer-block">
                <span class="label">Төлөгч</span>
                <p><strong>${escapeHtml(buyerName)}</strong></p>
              </div>
            </div>
          </div>
          <p class="section-title">Үнийн мэдээлэл</p>
          <table>
            <thead>
              <tr>
                <th>№</th>
                <th>Утга</th>
                <th>Тоо ширхэг</th>
                <th>Нэгжийн үнэ</th>
                <th>Нийт үнэ</th>
              </tr>
            </thead>
            <tbody>
              ${invoiceRows.map((item) => `
                <tr${item.isDiscount ? ' class="invoice-discount-row"' : ""} data-usd-unit="${item.isDiscount ? 0 : Number(item.unitPrice || 0)}" data-usd-total="${Number(item.totalPrice || 0)}">
                  <td>${item.index}</td>
                  <td>
                    <span class="invoice-view-text">${escapeHtml(item.description.replace(/^Match\s+/i, "Тоглолт "))}${item.categoryCode ? ` · Кат ${escapeHtml(item.categoryCode)}` : ""}</span>
                    <input class="invoice-edit-input" value="${escapeHtml(item.description.replace(/^Match\s+/i, "Тоглолт "))}${item.categoryCode ? ` · Кат ${escapeHtml(item.categoryCode)}` : ""}" />
                  </td>
                  <td>
                    <span class="invoice-view-text">${item.quantity}</span>
                    <input class="invoice-edit-input" type="number" value="${item.quantity}" />
                  </td>
                  <td>
                    <span class="invoice-view-text">${item.isDiscount ? "" : escapeHtml(formatMnt(item.unitPrice * exchangeRate))}</span>
                    <input class="invoice-edit-input" type="number" value="${item.isDiscount ? "" : Math.round(item.unitPrice * exchangeRate)}" />
                  </td>
                  <td>
                    <span class="invoice-view-text">${escapeHtml(formatMnt(item.totalPrice * exchangeRate))}</span>
                    <input class="invoice-edit-input" type="number" value="${Math.round(item.totalPrice * exchangeRate)}" />
                  </td>
                </tr>
              `).join("")}
              <tr class="total-row">
                <td colspan="4">Нийт үнэ</td>
                <td data-grand-total>${escapeHtml(formatMnt(total * exchangeRate))}</td>
              </tr>
            </tbody>
          </table>
          <div class="exchange-section">
            <p class="section-title">Ханш</p>
            <input class="exchange-rate-input" type="number" min="1" step="1" value="${Math.round(exchangeRate)}" />
          </div>
          <p class="section-title">Төлбөрийн хуваарь</p>
          <div class="payment-stack">
            ${paymentRows.map((row) => `
              <div class="payment-card" data-payment-usd="${Number(row.amount || 0)}">
                <div class="payment-main">
                  <span class="payment-title invoice-view-text">${escapeHtml(row.title)}</span>
                  <input class="invoice-edit-input" value="${escapeHtml(row.title)}" />
                </div>
                <div class="payment-meta">
                  <span class="meta-label">Нэхэмжилсэн огноо</span>
                  <span class="meta-value invoice-view-text">${escapeHtml(formatInvoiceDate(row.created))}</span>
                  <input class="invoice-edit-input" type="date" value="${escapeHtml(safeDateInput(row.created))}" />
                </div>
                <div class="payment-meta">
                  <span class="meta-label">${escapeHtml(row.status === "paid" ? "Төлсөн огноо" : "Эцсийн хугацаа")}</span>
                  <span class="meta-value invoice-view-text">${escapeHtml(formatInvoiceDate(row.due))}</span>
                  <input class="invoice-edit-input" type="date" value="${escapeHtml(safeDateInput(row.due))}" />
                </div>
                <div class="payment-meta">
                  <span class="meta-label">Төлөв</span>
                  <span class="payment-status ${row.statusMeta.className}">${escapeHtml(row.statusMeta.label)}</span>
                  <select class="payment-status-select">
                    <option value="paid"${row.statusMeta.className === "paid" ? " selected" : ""}>Төлөгдсөн</option>
                    <option value="waiting"${row.statusMeta.className === "waiting" ? " selected" : ""}>Хүлээгдэж буй</option>
                    <option value="overdue"${row.statusMeta.className === "overdue" ? " selected" : ""}>Хугацаа хэтэрсэн</option>
                  </select>
                </div>
                <div class="payment-amount" data-payment-amount>${escapeHtml(formatMnt(row.amount * exchangeRate))}</div>
              </div>
            `).join("")}
          </div>
          <div class="bank-section">
            <p class="section-title">Дансны мэдээлэл</p>
            <div class="bank-select-wrap">
              <select class="bank-account-select" data-bank-account-select>
                <option value="state"${selectedBankAccount === "state" ? " selected" : ""}>Төрийн Банк / MN030034 / 3432 7777 9999</option>
                <option value="golomt"${selectedBankAccount === "golomt" ? " selected" : ""}>Голомт Банк / MN80001500 / 3675114666</option>
              </select>
            </div>
            <div class="bank-grid">
              <span>Дэлхий Трэвел Икс</span>
              <span data-bank-name>${escapeHtml(getInvoiceBankAccount(selectedBankAccount).bankName)}</span>
              <span data-bank-prefix>${escapeHtml(getInvoiceBankAccount(selectedBankAccount).prefix)}</span>
              <strong data-bank-number>${escapeHtml(getInvoiceBankAccount(selectedBankAccount).accountNumber)}</strong>
            </div>
          </div>
          <div class="invoice-footer">
            <div class="invoice-footer-grid">
              <div class="invoice-footer-party">
                <p class="invoice-footer-label">Нягтлан</p>
                <div class="finance-asset-wrap">
                  <div class="finance-stamp">
                    <img src="/assets/invoice-finance-stamp.png" alt="Санхүүгийн тамга" />
                  </div>
                  <div class="finance-signature">
                    <img src="/assets/invoice-finance-signature-source.png" alt="Нягтлан гарын үсэг" />
                  </div>
                </div>
                <div class="invoice-sign-line"></div>
                <div class="invoice-sign-name">Г.Баясгалан</div>
              </div>
              <div class="invoice-footer-party">
                <p class="invoice-footer-label">Төлөгч</p>
                <div class="invoice-footer-space"></div>
                <div class="invoice-sign-line"></div>
                <div class="invoice-sign-name">${escapeHtml(buyerName)}</div>
              </div>
            </div>
          </div>
        </div>
        <script>
          const bankAccounts = ${JSON.stringify(BANK_ACCOUNTS)};
          const modeButtons = Array.from(document.querySelectorAll('[data-mode]'));
          const saveButton = document.querySelector('[data-save]');
          const bankSelect = document.querySelector('[data-bank-account-select]');
          const bankName = document.querySelector('[data-bank-name]');
          const bankPrefix = document.querySelector('[data-bank-prefix]');
          const bankNumber = document.querySelector('[data-bank-number]');
          const exchangeRateInput = document.querySelector('.exchange-rate-input');
          document.querySelector('[data-print]')?.addEventListener('click', () => window.print());
          const syncBankAccount = () => {
            const selected = bankAccounts[bankSelect?.value || 'state'] || bankAccounts.state;
            if (bankName) bankName.textContent = selected.bankName;
            if (bankPrefix) bankPrefix.textContent = selected.prefix;
            if (bankNumber) bankNumber.textContent = selected.accountNumber;
          };
          const formatMnt = (value) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.round(Number(value || 0))) + ' ₮';
          const syncExchangeRate = () => {
            const rate = Math.max(Number(exchangeRateInput?.value || 0), 1);
            document.querySelectorAll('tbody tr').forEach((row) => {
              const inputs = row.querySelectorAll('.invoice-edit-input');
              const usdUnit = Number(row.dataset.usdUnit || 0);
              const usdTotal = Number(row.dataset.usdTotal || 0);
              const viewCells = row.querySelectorAll('.invoice-view-text');
              if (viewCells[2]) viewCells[2].textContent = usdUnit ? formatMnt(usdUnit * rate) : '';
              if (viewCells[3]) viewCells[3].textContent = formatMnt(usdTotal * rate);
              if (inputs[2]) inputs[2].value = usdUnit ? String(Math.round(usdUnit * rate)) : '';
              if (inputs[3]) inputs[3].value = String(Math.round(usdTotal * rate));
            });
            const grandTotal = document.querySelector('[data-grand-total]');
            if (grandTotal) grandTotal.textContent = formatMnt(${total} * rate);
            document.querySelectorAll('[data-payment-usd]').forEach((card) => {
              const amount = Number(card.dataset.paymentUsd || 0);
              const amountNode = card.querySelector('[data-payment-amount]');
              if (amountNode) amountNode.textContent = formatMnt(amount * rate);
            });
          };
          bankSelect?.addEventListener('change', syncBankAccount);
          exchangeRateInput?.addEventListener('input', syncExchangeRate);
          modeButtons.forEach((button) => {
            button.addEventListener('click', () => {
              const isEdit = button.dataset.mode === 'edit';
              document.body.classList.toggle('is-editing', isEdit);
              saveButton.hidden = !isEdit;
              modeButtons.forEach((item) => {
                item.style.background = item.dataset.mode === button.dataset.mode ? '#253776' : '#e9edf8';
                item.style.color = item.dataset.mode === button.dataset.mode ? '#fff' : '#2a3c78';
              });
            });
          });
          saveButton?.addEventListener('click', () => {
            document.body.classList.remove('is-editing');
            saveButton.hidden = true;
            modeButtons.forEach((item) => {
              item.style.background = item.dataset.mode === 'view' ? '#253776' : '#e9edf8';
              item.style.color = item.dataset.mode === 'view' ? '#fff' : '#2a3c78';
            });
          });
          if (modeButtons[0]) {
            modeButtons[0].style.background = '#253776';
            modeButtons[0].style.color = '#fff';
          }
          syncBankAccount();
          syncExchangeRate();
        </script>
      </body>
    </html>
  `);
  popup.document.close();
}

async function loadDashboard() {
  const data = await fetchJson("/api/fifa2026");
  state.tickets = data.tickets || [];
  state.sales = data.sales || [];
  state.summary = data.summary || null;
  updateSummary();
  populateInventoryFormOptions();
  refreshFilterOptions();
  refreshSaleTicketOptions();
  renderTickets();
  renderSales();
}

if (ticketForm) {
  ["1", "2", "3"].forEach((categoryCode) => {
    ticketForm.elements[`category${categoryCode}Quantity`]?.addEventListener("input", () => {
      renderCategoryTicketRows(
        categoryCode,
        parseSeatLines(ticketForm.elements[`category${categoryCode}Seats`].value)
      );
    });
    ticketForm.elements[`category${categoryCode}AssignedLater`]?.addEventListener("change", () => {
      renderCategoryTicketRows(
        categoryCode,
        parseSeatLines(ticketForm.elements[`category${categoryCode}Seats`].value)
      );
    });
    ticketRowContainers[categoryCode]?.addEventListener("input", (event) => {
      if (!event.target.closest("[data-ticket-row]")) return;
      syncCategorySeatTextarea(categoryCode);
    });
  });

  ticketForm.elements.matchNumber.addEventListener("change", () => applyMatchSelection(ticketForm.elements.matchNumber.value));
  ticketForm.elements.city.addEventListener("change", () => applyCityVenue(ticketForm.elements.city.value));
  ticketForm.elements.teamA.addEventListener("change", () => {
    if (!ticketForm.elements.matchNumber.value) ticketForm.elements.matchDate.value = ticketForm.elements.matchDate.value || "";
  });

  ticketForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const base = commonTicketPayload();
    const tasks = [];
    const isEditing = Boolean(state.editingTicketId);
    let hasValidationError = false;

    for (const categoryCode of ["1", "2", "3"]) {
      const existingIds = ticketForm.elements[`category${categoryCode}Id`].value
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      const hasInput = blockHasInput(categoryCode);
      if (!hasInput && existingIds.length) {
        existingIds.forEach((ticketId) => {
          tasks.push(fetchJson(`/api/fifa2026/tickets/${ticketId}`, { method: "DELETE" }));
        });
        continue;
      }
      if (!hasInput) continue;
      const categoryRows = buildCategoryRows(categoryCode);
      if (!categoryRows.length) {
        setStatus(ticketStatusNode, `Category ${categoryCode} needs at least one ticket row.`, true);
        return;
      }
      const categoryPrice = Number(ticketForm.elements[`category${categoryCode}Price`].value || 0);
      if (!categoryPrice) {
        setStatus(ticketStatusNode, `Category ${categoryCode} needs a category price.`, true);
        return;
      }
      const categoryName = ticketForm.elements[`category${categoryCode}Name`].value.trim();
      const seatSection = ticketForm.elements[`category${categoryCode}Section`].value.trim();
      const seatAssignedLater = ticketForm.elements[`category${categoryCode}AssignedLater`].value === "yes";
      categoryRows.forEach((row, index) => {
        const payload = {
          ...base,
          categoryCode,
          categoryName: categoryName || (seatAssignedLater ? "Seat will be assigned later" : `Category ${categoryCode}`),
          seatSection: seatSection || (seatAssignedLater ? "Seat will be assigned later" : ""),
          seatDetails: row.seat || (seatAssignedLater ? "Seat will be assigned later" : ""),
          seatAssignedLater,
          price: categoryPrice,
          totalQuantity: 1,
        };
        tasks.push(
          fetchJson(existingIds[index] ? `/api/fifa2026/tickets/${existingIds[index]}` : "/api/fifa2026/tickets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        );
      });
      existingIds.slice(categoryRows.length).forEach((ticketId) => {
        tasks.push(fetchJson(`/api/fifa2026/tickets/${ticketId}`, { method: "DELETE" }));
      });
    }

    if (hasValidationError) {
      return;
    }

    if (!tasks.length) {
      setStatus(ticketStatusNode, "Add at least one category block before saving.", true);
      return;
    }

    setStatus(ticketStatusNode, isEditing ? "Updating categories..." : "Saving categories...");
    try {
      await Promise.all(tasks);
      resetTicketForm();
      await loadDashboard();
      setStatus(ticketStatusNode, isEditing ? "Categories updated." : "Categories saved.");
    } catch (error) {
      setStatus(ticketStatusNode, error.message, true);
    }
  });
}

if (saleForm) {
  saleForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(saleForm).entries());
    payload.discountAmount = String(currentDiscountUsd());
    payload.totalPrice = String(currentSaleTotalUsd());
    payload.amountPaid = String(currentAmountPaidUsd());
    payload.paymentMethod = payload.invoiceBankAccount || "state";
    payload.saleStatus = normalizeSaleStatusValue(payload.saleStatus || saleForm.elements.saleStatus.value || "pending");
    payload.buyerName = String(state.participants.map(combinedParticipantName).find(Boolean) || payload.buyerTitle || "").trim();
    payload.buyerNationality = state.participants[0]?.nationality || "Mongolian";
    payload.buyerPassportNumber = state.participants[0]?.passportNumber || "";
    payload.soldAt = payload.soldAt || new Date().toISOString().slice(0, 10);
    payload.ticketIds = selectedSaleTicketIds();
    payload.ticketBlocks = state.saleBlocks.map((block) => ({
      matchNumber: block.matchNumber,
      matchLabel: block.matchLabel,
      categoryCode: block.categoryCode,
      quantity: block.quantity,
      unitPrice: block.unitPrice,
      totalPrice: block.totalPrice,
      seatPreview: block.seatPreview,
      ticketLabels: [...(block.ticketLabels || [])],
      ticketIds: [...(block.ticketIds || [])],
    }));
    payload.participants = state.participants
      .map((participant) => ({
        ticketId: String(participant.ticketId || "").trim(),
        ticketLabel: String(participant.ticketLabel || "").trim(),
        name: String(combinedParticipantName(participant) || "").trim(),
        givenName: String(participant.givenName || participant.name || "").trim(),
        surname: String(participant.surname || "").trim(),
        passportNumber: String(participant.passportNumber || "").trim(),
        nationality: String(participant.nationality || "Mongolian").trim(),
        birthDate: safeDateInput(participant.birthDate || ""),
        passportExpiryDate: safeDateInput(participant.passportExpiryDate || ""),
        notes: String(participant.notes || "").trim(),
      }))
      .filter((participant) => participant.ticketId || participant.name || participant.passportNumber || participant.nationality || participant.notes || participant.birthDate || participant.passportExpiryDate);
    payload.invoiceSchedule = activeInvoiceSchedule().map((line) => ({
      title: line.title,
      created: line.created,
      due: line.due,
      status: line.status,
      amount: Math.round(Number(line.amount || 0)),
    }));
    if (!payload.ticketIds.length) {
      setStatus(saleStatusNode, "Add at least one ticket block first.", true);
      return;
    }
    const saleId = saleForm.elements.id.value;
    setStatus(saleStatusNode, saleId ? "Updating sale..." : "Registering sale...");
    try {
      await fetchJson(saleId ? `/api/fifa2026/sales/${saleId}` : "/api/fifa2026/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      resetSaleForm();
      await loadDashboard();
      setStatus(saleStatusNode, saleId ? "Sale updated." : "Sale registered.");
    } catch (error) {
      setStatus(saleStatusNode, error.message, true);
    }
  });
}

document.querySelector("#fifa-ticket-cancel")?.addEventListener("click", resetTicketForm);
ticketFormToggleButton?.addEventListener("click", () => {
  setTicketFormVisible(true);
  ticketForm?.scrollIntoView({ behavior: "smooth", block: "start" });
});
document.querySelector("#fifa-sale-cancel")?.addEventListener("click", resetSaleForm);
saleFormToggleButton?.addEventListener("click", () => {
  setSaleFormVisible(true);
  saleForm?.scrollIntoView({ behavior: "smooth", block: "start" });
});
saleForm?.elements?.buyerTitle?.addEventListener("input", syncSaleTotals);
saleForm?.elements?.quantity?.addEventListener("input", syncSaleTotals);
saleForm?.elements?.pricePerTicket?.addEventListener("input", syncSaleTotals);
saleForm?.elements?.discountAmountMnt?.addEventListener("input", syncSalePriceFields);
saleForm?.elements?.amountPaidMnt?.addEventListener("input", () => {
  if (!state.invoiceScheduleTouched) renderInvoiceScheduleEditor();
  syncSaleTotals();
});
saleForm?.elements?.soldAt?.addEventListener("input", () => {
  if (!state.invoiceScheduleTouched) renderInvoiceScheduleEditor();
});
saleForm?.elements?.invoiceExchangeRate?.addEventListener("input", () => {
  syncSalePriceFields();
  if (!state.invoiceScheduleTouched) renderInvoiceScheduleEditor();
});
saleForm?.elements?.invoiceBankAccount?.addEventListener("change", () => {
  toggleOtherBankAccountField();
  syncSaleTotals();
});
saleMatchSelect?.addEventListener("change", () => refreshSaleCategoryOptions());
saleCategorySelect?.addEventListener("change", () => renderSaleSeatPicker());
saleSeatPicker?.addEventListener("change", () => {
  state.pendingSaleSeatIds = [...saleSeatPicker.querySelectorAll('[data-sale-seat-option]:checked')].map((node) => node.value);
  if (saleBlockQuantityInput) saleBlockQuantityInput.value = String(state.pendingSaleSeatIds.length);
});
document.querySelector("#fifa-sale-add-block")?.addEventListener("click", () => {
  try {
    const block = createSaleBlockFromSelection();
    state.saleBlocks.push(block);
    refreshSaleTicketOptions();
    resetSaleBlockSelection();
    renderSaleBlocks();
    clearStatus(saleStatusNode);
  } catch (error) {
    setStatus(saleStatusNode, error.message, true);
  }
});

Object.values(ticketFilters).forEach((node) => {
  node?.addEventListener("input", renderTickets);
  node?.addEventListener("change", renderTickets);
});
Object.values(saleFilters).forEach((node) => {
  node?.addEventListener("input", renderSales);
  node?.addEventListener("change", renderSales);
});

document.addEventListener("click", (event) => {
  const clickedMenu = event.target.closest(".trip-menu");
  if (!clickedMenu) {
    closeOpenTripMenus();
  }
});

ticketList?.addEventListener("click", async (event) => {
  const menuTrigger = event.target.closest(".trip-menu summary");
  if (menuTrigger) {
    event.stopPropagation();
    return;
  }

  const actionColumn = event.target.closest(".fifa-match-col--actions");
  if (actionColumn && !event.target.closest("[data-action]") && !event.target.closest(".trip-menu")) {
    event.stopPropagation();
    return;
  }

  const checkbox = event.target.closest('input[type="checkbox"][data-action="select-ticket"]');
  if (checkbox) {
    if (checkbox.checked) state.selectedTickets.add(checkbox.dataset.id);
    else state.selectedTickets.delete(checkbox.dataset.id);
    renderTickets();
    return;
  }

  const target = event.target.closest("[data-action]");
  if (target?.closest(".trip-menu")) {
    event.stopPropagation();
  }
  if (target?.dataset.action === "toggle-match") {
    const matchKey = target.dataset.matchKey || "";
    if (state.expandedMatches.has(matchKey)) {
      state.expandedMatches.delete(matchKey);
    } else {
      state.expandedMatches.clear();
      state.expandedMatches.add(matchKey);
    }
    renderTickets();
    return;
  }
  if (target?.dataset.action === "toggle-sale") {
    return;
  }
  if (target?.dataset.action === "toggle-match-menu") {
    event.stopPropagation();
    return;
  }
  if (target?.dataset.action === "add-ticket-match") {
    event.stopPropagation();
    resetTicketForm();
    applyMatchSelection(target.dataset.matchNumber || "");
    setTicketFormVisible(true);
    ticketForm?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  if (target?.dataset.action === "edit-match") {
    event.stopPropagation();
    const group = buildTicketGroups().find((item) => item.matchNumber === target.dataset.matchNumber);
    if (group?.tickets?.[0]) fillTicketForm(group.tickets[0]);
    return;
  }
  if (target?.dataset.action === "delete-match") {
    event.stopPropagation();
    const group = buildTicketGroups().find((item) => item.key === target.dataset.matchKey);
    if (!group || !group.tickets.length) return;
    if (!window.confirm(`Delete match ${group.matchNumber} with all of its sales and tickets?`)) return;
    try {
      const relatedTicketIds = new Set(group.tickets.map((item) => item.id));
      const relatedSales = state.sales.filter((sale) => {
        const saleTicketIds = sale.ticketIds?.length ? sale.ticketIds : (sale.ticketId ? [sale.ticketId] : []);
        return saleTicketIds.some((ticketId) => relatedTicketIds.has(ticketId));
      });
      for (const sale of relatedSales) {
        await fetchJson(`/api/fifa2026/sales/${sale.id}`, { method: "DELETE" });
      }
      for (const groupedTicket of group.tickets) {
        await fetchJson(`/api/fifa2026/tickets/${groupedTicket.id}`, { method: "DELETE" });
      }
      await loadDashboard();
    } catch (error) {
      setStatus(ticketStatusNode, error.message, true);
    }
    return;
  }
  if (!target) {
    return;
  }
  const ticketId = target.dataset.id;
  const ticket = state.tickets.find((item) => item.id === ticketId);
  if (!ticket) return;

  if (target.dataset.action === "edit-ticket") {
    fillTicketForm(ticket);
    return;
  }
  if (target.dataset.action === "view-sold-ticket") {
    const relatedSale = state.sales.find((sale) => {
      const saleTicketIds = sale.ticketIds?.length ? sale.ticketIds : (sale.ticketId ? [sale.ticketId] : []);
      return saleTicketIds.includes(ticketId) && sale.saleStatus !== "cancelled";
    });
    if (relatedSale) {
      state.expandedSales.clear();
      state.expandedSales.add(relatedSale.id);
      renderSales();
      document.querySelector("#sales-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
      setStatus(saleStatusNode, `Sold to ${relatedSale.buyerTitle || relatedSale.buyerName || "buyer"}.`);
    }
    return;
  }
  if (target.dataset.action === "toggle-visibility") {
    try {
      await fetchJson(`/api/fifa2026/tickets/${ticketId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibility: ticket.visibility === "public" ? "private" : "public" }),
      });
      await loadDashboard();
    } catch (error) {
      setStatus(ticketStatusNode, error.message, true);
    }
    return;
  }
  if (target.dataset.action === "delete-ticket") {
    if (!window.confirm("Delete this ticket lot?")) return;
    try {
      await fetchJson(`/api/fifa2026/tickets/${ticketId}`, { method: "DELETE" });
      await loadDashboard();
    } catch (error) {
      setStatus(ticketStatusNode, error.message, true);
    }
  }
});

saleList?.addEventListener("click", async (event) => {
  const menuTrigger = event.target.closest(".trip-menu summary");
  if (menuTrigger) {
    event.stopPropagation();
    return;
  }

  const actionColumn = event.target.closest(".fifa-match-col--actions");
  if (actionColumn && !event.target.closest("button[data-action]") && !event.target.closest(".trip-menu")) {
    event.stopPropagation();
    return;
  }

  const target = event.target.closest("button[data-action]");
  const toggle = event.target.closest('[data-action="toggle-sale"]');
  if (toggle && !target && !event.target.closest(".trip-menu")) {
    const saleId = toggle.dataset.id || "";
    if (state.expandedSales.has(saleId)) {
      state.expandedSales.delete(saleId);
    } else {
      state.expandedSales.clear();
      state.expandedSales.add(saleId);
    }
    renderSales();
    return;
  }
  if (!target) return;
  if (target.closest(".trip-menu")) {
    event.stopPropagation();
  }
  const saleId = target.dataset.id;
  const sale = state.sales.find((item) => item.id === saleId);
  if (!sale) return;

  if (target.dataset.action === "edit-sale") {
    fillSaleForm(sale);
    return;
  }
  if (target.dataset.action === "edit-inline-invoice") {
    state.invoiceDrafts[sale.id] = buildInvoiceDraftFromSale(sale);
    renderSales();
    return;
  }
  if (target.dataset.action === "cancel-inline-invoice") {
    delete state.invoiceDrafts[sale.id];
    renderSales();
    return;
  }
  if (target.dataset.action === "add-inline-invoice-line") {
    const draft = captureInlineInvoiceDraft(sale);
    const fallbackDate = safeDateInput(sale.soldAt || "") || new Date().toISOString().slice(0, 10);
    draft.invoiceSchedule.push({
      title: `Төлбөр ${draft.invoiceSchedule.length + 1}`,
      created: fallbackDate,
      due: fallbackDate,
      status: "waiting",
      amount: 0,
      amountMnt: "0",
    });
    state.invoiceDrafts[sale.id] = draft;
    renderSales();
    return;
  }
  if (target.dataset.action === "remove-inline-invoice-line") {
    const draft = captureInlineInvoiceDraft(sale);
    const index = Number(target.dataset.index || -1);
    if (index >= 0) draft.invoiceSchedule.splice(index, 1);
    state.invoiceDrafts[sale.id] = draft;
    renderSales();
    return;
  }
  if (target.dataset.action === "save-inline-invoice") {
    const draft = captureInlineInvoiceDraft(sale);
    if (!draft) return;
    try {
      await fetchJson(`/api/fifa2026/sales/${sale.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyerName: draft.buyerName,
          invoiceExchangeRate: Math.max(Number(draft.invoiceExchangeRate || DEFAULT_INVOICE_EXCHANGE_RATE), 1),
          invoiceBankAccount: draft.invoiceBankAccount || "state",
          invoiceDescriptions: draft.invoiceDescriptions || [],
          invoiceSchedule: (draft.invoiceSchedule || []).map((row) => ({
            title: row.title || "",
            created: row.created || "",
            due: row.due || "",
            status: row.status || "waiting",
            amount: Math.max(Number(row.amount || 0), 0),
          })),
        }),
      });
      delete state.invoiceDrafts[sale.id];
      await loadDashboard();
      setStatus(saleStatusNode, "Invoice updated.");
    } catch (error) {
      setStatus(saleStatusNode, error.message, true);
    }
    return;
  }
  if (target.dataset.action === "invoice-sale") {
    openSaleInvoice(saleLikeWithInvoiceDraft(sale));
    return;
  }
  if (target.dataset.action === "cancel-sale") {
    try {
      await fetchJson(`/api/fifa2026/sales/${saleId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saleStatus: "cancelled" }),
      });
      await loadDashboard();
    } catch (error) {
      setStatus(saleStatusNode, error.message, true);
    }
    return;
  }
  if (target.dataset.action === "delete-sale") {
    if (!window.confirm("Delete this sale permanently?")) return;
    try {
      await fetchJson(`/api/fifa2026/sales/${saleId}`, { method: "DELETE" });
      await loadDashboard();
    } catch (error) {
      setStatus(saleStatusNode, error.message, true);
    }
  }
});

saleList?.addEventListener("input", (event) => {
  const action = event.target.dataset.action;
  const saleId = event.target.dataset.id;
  if (!saleId || !saleList || !["invoice-draft-field", "invoice-draft-line", "invoice-draft-description"].includes(action)) return;
  const sale = state.sales.find((item) => item.id === saleId);
  if (!sale) return;
  const draft = captureInlineInvoiceDraft(sale);
  if (action === "invoice-draft-line" && event.target.dataset.field === "amount") {
    const digitsOnly = String(event.target.value || "").replace(/[^\d]/g, "");
    event.target.value = digitsOnly;
    const index = Number(event.target.dataset.index || -1);
    if (index >= 0 && draft.invoiceSchedule[index]) {
      draft.invoiceSchedule[index].amountMnt = digitsOnly;
      draft.invoiceSchedule[index].amount = Math.max(
        Math.round(Number(digitsOnly || 0) / Math.max(Number(draft.invoiceExchangeRate || DEFAULT_INVOICE_EXCHANGE_RATE), 1)),
        0
      );
    }
    state.invoiceDrafts[sale.id] = draft;
    return;
  }
  if (action === "invoice-draft-field" && event.target.dataset.field === "invoiceExchangeRate") {
    draft.invoiceSchedule = (draft.invoiceSchedule || []).map((row) => ({
      ...row,
      amountMnt: String(Math.round(Math.max(Number(row.amount || 0), 0) * draft.invoiceExchangeRate)),
    }));
    state.invoiceDrafts[sale.id] = draft;
    renderSales();
    return;
  }
  state.invoiceDrafts[sale.id] = draft;
});

saleList?.addEventListener("change", (event) => {
  const action = event.target.dataset.action;
  const saleId = event.target.dataset.id;
  if (!saleId || !["invoice-draft-field", "invoice-draft-line", "invoice-draft-description"].includes(action)) return;
  const sale = state.sales.find((item) => item.id === saleId);
  if (!sale) return;
  const draft = captureInlineInvoiceDraft(sale);
  state.invoiceDrafts[sale.id] = draft;
  if (action === "invoice-draft-field" && event.target.dataset.field === "invoiceExchangeRate") {
    renderSales();
  }
});

saleList?.addEventListener("click", (event) => {
  if (event.target.closest("[data-inline-invoice] input, [data-inline-invoice] select, [data-inline-invoice] button")) {
    event.stopPropagation();
  }
});

saleList?.addEventListener("keydown", (event) => {
  if (event.target.closest("[data-inline-invoice] input, [data-inline-invoice] select, [data-inline-invoice] textarea")) {
    event.stopPropagation();
  }
});

saleBlockList?.addEventListener("click", (event) => {
  const target = event.target.closest('[data-action="remove-sale-block"]');
  if (!target) return;
  const index = Number(target.dataset.index || -1);
  if (index < 0) return;
  state.saleBlocks.splice(index, 1);
  state.pendingSaleSeatIds = [];
  renderSaleSeatPicker();
  renderSaleBlocks();
});

document.querySelector("#fifa-sale-summary")?.addEventListener("input", (event) => {
  const field = event.target.dataset.saleSummaryField;
  if (!field || !saleForm) return;
  if (field === "exchangeRate") {
    saleForm.elements.invoiceExchangeRate.value = String(Math.max(Number(event.target.value || DEFAULT_INVOICE_EXCHANGE_RATE), 1));
    syncSalePriceFields();
    return;
  }
  if (field === "blockPrice") {
    const index = Number(event.target.dataset.index || -1);
    if (index < 0 || !state.saleBlocks[index]) return;
    const rate = currentInvoiceExchangeRate();
    const unitPriceMnt = Math.max(Number(event.target.value || 0), 0);
    const unitPriceUsd = Math.round(unitPriceMnt / rate);
    state.saleBlocks[index].unitPrice = unitPriceUsd;
    state.saleBlocks[index].totalPrice = unitPriceUsd * Math.max(Number(state.saleBlocks[index].quantity || 0), 0);
    const rowNode = event.target.closest("[data-sale-block-editor]");
    const totalField = rowNode?.querySelector("label:last-child input");
    if (totalField) {
      totalField.value = formatMoney(Math.round(Number(state.saleBlocks[index].totalPrice || 0) * rate), "MNT");
    }
    saleForm.elements.totalPrice.value = String(currentSaleTotalUsd());
    if (saleForm.elements.totalPriceMnt) {
      saleForm.elements.totalPriceMnt.value = String(Math.round(currentSaleTotalUsd() * rate));
    }
    const grandTotalField = document.querySelector("#fifa-sale-summary .full-span input");
    if (grandTotalField) {
      grandTotalField.value = formatMoney(Math.round(currentSaleTotalUsd() * rate), "MNT");
    }
    return;
  }
});

document.querySelector("#fifa-sale-summary")?.addEventListener("change", (event) => {
  const field = event.target.dataset.saleSummaryField;
  if (!field || !saleForm) return;
  if (field === "blockPrice" || field === "exchangeRate") {
    syncSalePriceFields();
  }
});

saleParticipantList?.addEventListener("input", (event) => {
  const card = event.target.closest("[data-participant-index]");
  if (!card) return;
  const index = Number(card.dataset.participantIndex || -1);
  const field = event.target.dataset.participantField;
  if (index < 0 || !field || !state.participants[index]) return;
  state.participants[index][field] = event.target.value;
  state.participants[index].name = combinedParticipantName(state.participants[index]);
  syncSaleTotals();
});

saleParticipantList?.addEventListener("change", (event) => {
  const card = event.target.closest("[data-participant-index]");
  if (!card) return;
  const index = Number(card.dataset.participantIndex || -1);
  const field = event.target.dataset.participantField;
  if (index < 0 || !field || !state.participants[index]) return;
  state.participants[index][field] = event.target.value;
  state.participants[index].name = combinedParticipantName(state.participants[index]);
  syncSaleTotals();
});

toggleOtherBankAccountField();

invoiceScheduleEditor?.addEventListener("input", (event) => {
  const row = event.target.closest("[data-schedule-index]");
  if (!row) return;
  const index = Number(row.dataset.scheduleIndex || -1);
  const field = event.target.dataset.scheduleField;
  if (index < 0 || !field) return;
  const schedule = activeInvoiceSchedule();
  if (!schedule[index]) return;
  const rate = Math.max(Number(saleForm?.elements?.invoiceExchangeRate?.value || DEFAULT_INVOICE_EXCHANGE_RATE), 1);
  state.invoiceScheduleTouched = true;
  state.invoiceSchedule = normalizedInvoiceSchedule(schedule);
  if (!state.invoiceSchedule[index]) return;
  if (field === "amount") {
    state.invoiceSchedule[index].amount = Math.max(Math.round(Number(event.target.value || 0) / rate), 0);
  } else {
    state.invoiceSchedule[index][field] = event.target.value;
  }
  syncSaleTotals();
  renderSaleSummary();
});

invoiceScheduleEditor?.addEventListener("change", (event) => {
  if (event.target.matches("[data-schedule-meta='saleStatus']")) {
    saleForm.elements.saleStatus.value = normalizeSaleStatusValue(event.target.value || "pending");
    return;
  }
  if (event.target.matches("[data-schedule-field='status']")) {
    const row = event.target.closest("[data-schedule-index]");
    const index = Number(row?.dataset.scheduleIndex || -1);
    const schedule = activeInvoiceSchedule();
    if (index < 0 || !schedule[index]) return;
    state.invoiceScheduleTouched = true;
    state.invoiceSchedule = normalizedInvoiceSchedule(schedule);
    if (!state.invoiceSchedule[index]) return;
    state.invoiceSchedule[index].status = event.target.value;
    syncSaleTotals();
    renderSaleSummary();
    renderInvoiceScheduleEditor();
  }
});

invoiceScheduleEditor?.addEventListener("click", (event) => {
  const addButton = event.target.closest('[data-action="add-invoice-line"]');
  if (addButton) {
    const current = activeInvoiceSchedule();
    state.invoiceScheduleTouched = true;
    state.invoiceSchedule = normalizedInvoiceSchedule(current);
    const soldAt = safeDateInput(saleForm?.elements?.soldAt?.value || "") || new Date().toISOString().slice(0, 10);
    state.invoiceSchedule.push({
      title: `Төлбөр ${state.invoiceSchedule.length + 1}`,
      created: soldAt,
      due: soldAt,
      status: "waiting",
      amount: 0,
    });
    syncSaleTotals();
    renderSaleSummary();
    renderInvoiceScheduleEditor();
    return;
  }
  const removeButton = event.target.closest('[data-action="remove-invoice-line"]');
  if (removeButton) {
    const index = Number(removeButton.dataset.index || -1);
    const current = activeInvoiceSchedule();
    state.invoiceScheduleTouched = true;
    state.invoiceSchedule = normalizedInvoiceSchedule(current);
    if (index >= 0) state.invoiceSchedule.splice(index, 1);
    syncSaleTotals();
    renderSaleSummary();
    renderInvoiceScheduleEditor();
  }
});

resetTicketForm();
resetSaleForm();
loadDashboard().catch((error) => {
  setStatus(ticketStatusNode, error.message, true);
  setStatus(saleStatusNode, error.message, true);
});
