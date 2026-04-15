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
const ticketRowContainers = {
  "1": document.querySelector('[data-ticket-rows="1"]'),
  "2": document.querySelector('[data-ticket-rows="2"]'),
  "3": document.querySelector('[data-ticket-rows="3"]'),
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

const CITY_TO_VENUE = Object.fromEntries(MATCH_CATALOG.map((item) => [item.city, item.venue]));
const MATCH_LOOKUP = Object.fromEntries(MATCH_CATALOG.map((item) => [item.matchNumber, item]));
const TEAM_CODES = [...new Set(MATCH_CATALOG.flatMap((item) => [item.teamA, item.teamB]))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

const state = {
  tickets: [],
  sales: [],
  summary: null,
  editingTicketId: "",
  editingSaleId: "",
  expandedMatches: new Set(),
  selectedTickets: new Set(),
  saleBlocks: [],
  participants: [],
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

function fillSelect(node, values, placeholder, keepValue = "") {
  if (!node) return;
  node.innerHTML = [`<option value="">${placeholder}</option>`]
    .concat(values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`))
    .join("");
  if (keepValue && values.includes(keepValue)) node.value = keepValue;
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
  return left && right ? `${left} vs ${right}` : "";
}

function normalizeStageValue(value) {
  const stage = String(value || "").trim();
  if (stage === "Opening Ceremony") return "Opening";
  if (stage === "QuarterFinal") return "Quarter Final";
  return stage;
}

function populateInventoryFormOptions() {
  if (!ticketForm) return;
  fillSelect(
    ticketForm.elements.matchNumber,
    MATCH_CATALOG.map((item) => item.matchNumber),
    "Choose match",
    ticketForm.elements.matchNumber.value
  );
  fillSelect(ticketForm.elements.teamA, TEAM_CODES, "Choose team", ticketForm.elements.teamA.value);
  fillSelect(ticketForm.elements.teamB, TEAM_CODES, "Choose team", ticketForm.elements.teamB.value);
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
  fillSelect(
    saleMatchSelect,
    matches.map((group) => group.matchNumber),
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
    .sort((left, right) => String(left.seatDetails || "").localeCompare(String(right.seatDetails || "")));
}

function selectedSaleTicketIds() {
  return state.saleBlocks.flatMap((block) => block.ticketIds || []);
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
  const totalPrice = state.saleBlocks.reduce((sum, block) => sum + Number(block.totalPrice || 0), 0);
  const averagePrice = totalTickets ? Math.round(totalPrice / totalTickets) : 0;
  saleForm.elements.quantity.value = String(totalTickets || 0);
  saleForm.elements.pricePerTicket.value = averagePrice ? String(averagePrice) : "";
  saleForm.elements.totalPrice.value = totalPrice ? String(totalPrice) : "";
  syncSaleTotals();
}

function renderParticipants() {
  if (!saleParticipantList) return;
  if (!state.participants.length) {
    saleParticipantList.innerHTML = '<p class="fifa-seat-help">Participants will appear from the selected ticket quantity.</p>';
    return;
  }
  saleParticipantList.innerHTML = state.participants
    .map((participant, index) => `
      <div class="fifa-sale-participant-card" data-participant-index="${index}">
        <h4>Participant ${index + 1}</h4>
        <div class="manager-form-grid fifa-form-grid">
          <label>
            Full name
            <input type="text" data-participant-field="name" value="${escapeHtml(participant.name || "")}" />
          </label>
          <label>
            Passport number
            <input type="text" data-participant-field="passportNumber" value="${escapeHtml(participant.passportNumber || "")}" />
          </label>
          <label>
            Nationality
            <input type="text" data-participant-field="nationality" value="${escapeHtml(participant.nationality || "")}" />
          </label>
          <label>
            Notes
            <input type="text" data-participant-field="notes" value="${escapeHtml(participant.notes || "")}" />
          </label>
        </div>
      </div>
    `)
    .join("");
}

function syncParticipantsFromBlocks() {
  const minimum = selectedSaleTicketIds().length;
  while (state.participants.length < minimum) {
    state.participants.push({ name: "", passportNumber: "", nationality: "", notes: "" });
  }
  renderParticipants();
}

function renderSaleBlocks() {
  if (!saleBlockList) return;
  if (!state.saleBlocks.length) {
    saleBlockList.innerHTML = '<p class="fifa-seat-help">Choose match, category, and quantity, then add a ticket block.</p>';
    syncSaleTicketInputs();
    syncSalePriceFields();
    syncParticipantsFromBlocks();
    return;
  }
  saleBlockList.innerHTML = state.saleBlocks
    .map((block, index) => `
      <div class="fifa-sale-block-item" data-sale-block-index="${index}">
        <div>
          <strong>${escapeHtml(block.matchLabel)}</strong>
          <span class="fifa-table-sub">CAT ${escapeHtml(block.categoryCode)} · ${escapeHtml(block.quantity)} ticket(s) · ${escapeHtml(formatMoney(block.totalPrice))}</span>
          <span class="fifa-table-sub">${escapeHtml(block.seatPreview || "Seat will be assigned later")}</span>
        </div>
        <button type="button" class="button-secondary" data-action="remove-sale-block" data-index="${index}">Remove</button>
      </div>
    `)
    .join("");
  syncSaleTicketInputs();
  syncSalePriceFields();
  syncParticipantsFromBlocks();
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
  saleForm.elements.quantity.value = "1";
  saleForm.elements.amountPaid.value = "0";
  saleForm.elements.saleStatus.value = "active";
  saleForm.elements.paymentStatus.value = "unpaid";
  saleForm.elements.paymentMethod.value = "Bank transfer";
  saleForm.elements.buyerTitle.value = "";
  state.editingSaleId = "";
  state.saleBlocks = [];
  state.participants = [];
  if (saleMatchSelect) saleMatchSelect.value = "";
  if (saleCategorySelect) saleCategorySelect.value = "";
  if (saleBlockQuantityInput) saleBlockQuantityInput.value = "1";
  refreshSaleTicketOptions();
  renderSaleBlocks();
  renderParticipants();
  setNodeText(document.querySelector("#fifa-sale-submit"), "Register sale");
  clearStatus(saleStatusNode);
  setSaleFormVisible(false);
}

function applyMatchSelection(matchNumber) {
  if (!ticketForm) return;
  const match = MATCH_LOOKUP[matchNumber];
  if (!match) return;
  ticketForm.elements.stage.value = match.stage;
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
  saleForm.elements.pricePerTicket.value = sale.pricePerTicket || "";
  saleForm.elements.totalPrice.value = sale.totalPrice || "";
  saleForm.elements.amountPaid.value = sale.amountPaid || 0;
  saleForm.elements.paymentStatus.value = sale.paymentStatus || "unpaid";
  saleForm.elements.paymentMethod.value = sale.paymentMethod || "Bank transfer";
  saleForm.elements.saleStatus.value = sale.saleStatus || "active";
  saleForm.elements.soldAt.value = String(sale.soldAt || "").slice(0, 16);
  saleForm.elements.buyerTitle.value = sale.buyerTitle || "";
  saleForm.elements.buyerName.value = sale.buyerName || "";
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
    totalPrice: Number(block.totalPrice || 0),
    seatPreview: block.seatPreview || "",
    ticketIds: [...(block.ticketIds || [])],
  }));
  if (!state.saleBlocks.length && sale.ticketId) {
    const ticket = state.tickets.find((item) => item.id === sale.ticketId);
    if (ticket) {
      state.saleBlocks = [{
        matchNumber: ticket.matchNumber,
        matchLabel: buildMatchLabel(ticket.teamA, ticket.teamB),
        categoryCode: String(ticket.categoryCode || ""),
        quantity: Number(sale.quantity || 1),
        totalPrice: Number(sale.totalPrice || ticket.price || 0),
        seatPreview: ticket.seatDetails || "",
        ticketIds: sale.ticketIds?.length ? [...sale.ticketIds] : [sale.ticketId],
      }];
    }
  }
  state.participants = (sale.participants || []).map((participant) => ({
    name: participant.name || "",
    passportNumber: participant.passportNumber || "",
    nationality: participant.nationality || "",
    notes: participant.notes || "",
  }));
  renderSaleBlocks();
  renderParticipants();
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
    matchLabel: buildMatchLabel(ticket.teamA, ticket.teamB),
    categoryCode: String(ticket.categoryCode || ""),
    quantity: 1,
    totalPrice: Number(ticket.price || 0),
    seatPreview: ticket.seatDetails || "",
    ticketIds: [ticket.id],
  }];
  renderSaleBlocks();
  saleForm.elements.pricePerTicket.value = ticket.price || "";
  saleForm.elements.totalPrice.value = ticket.price || "";
  setSaleFormVisible(true);
  saleForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function syncSaleTotals() {
  if (!saleForm) return;
  const quantity = Number(saleForm.elements.quantity.value || 0);
  const pricePerTicket = Number(saleForm.elements.pricePerTicket.value || 0);
  if (!saleForm.elements.totalPrice.matches(":focus")) {
    saleForm.elements.totalPrice.value = quantity > 0 && pricePerTicket > 0 ? String(quantity * pricePerTicket) : "";
  }
  const totalPrice = Number(saleForm.elements.totalPrice.value || 0);
  const amountPaid = Number(saleForm.elements.amountPaid.value || 0);
  if (!saleForm.elements.paymentStatus.matches(":focus")) {
    saleForm.elements.paymentStatus.value = totalPrice > 0 && amountPaid >= totalPrice ? "paid" : amountPaid > 0 ? "partial" : "unpaid";
  }
}

function createSaleBlockFromSelection() {
  if (!saleMatchSelect || !saleCategorySelect || !saleBlockQuantityInput) return null;
  const matchNumber = saleMatchSelect.value;
  const categoryLabel = saleCategorySelect.value;
  const categoryCode = categoryLabel.replace(/^CAT\s+/i, "").trim();
  const quantity = Math.max(Number(saleBlockQuantityInput.value || 0), 0);
  if (!matchNumber || !categoryCode || !quantity) {
    throw new Error("Choose match, category, and quantity first");
  }
  const match = MATCH_LOOKUP[matchNumber];
  const availableTickets = saleBlockAvailableTickets(matchNumber, categoryCode, selectedSaleTicketIds());
  if (availableTickets.length < quantity) {
    throw new Error(`Only ${availableTickets.length} ticket(s) are available for ${matchNumber} CAT ${categoryCode}`);
  }
  const chosen = availableTickets.slice(0, quantity);
  return {
    matchNumber,
    matchLabel: match ? buildMatchLabel(match.teamA, match.teamB) : buildMatchLabel(chosen[0]?.teamA, chosen[0]?.teamB),
    categoryCode,
    quantity,
    totalPrice: chosen.reduce((sum, ticket) => sum + Number(ticket.price || 0), 0),
    seatPreview: chosen.map((ticket) => ticket.seatDetails || "Seat will be assigned later").join(" | "),
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
    .sort((left, right) => String(left.matchDate || "").localeCompare(String(right.matchDate || "")));
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
        const seatDiff = String(left.seatDetails || "").localeCompare(String(right.seatDetails || ""));
        if (seatDiff !== 0) return seatDiff;
        return String(left.createdAt || "").localeCompare(String(right.createdAt || ""));
      });
      const availableUnits = groupTickets.reduce((sum, ticket) => sum + Number(ticket.availableQuantity || 0), 0);
      const soldUnits = groupTickets.reduce((sum, ticket) => sum + Number(ticket.soldQuantity || 0), 0);
      const categoryBreakdown = ["1", "2", "3"].map((categoryCode) => {
        const categoryTickets = groupTickets.filter((ticket) => String(ticket.categoryCode || "") === categoryCode);
        const total = categoryTickets.reduce((sum, ticket) => sum + Number(ticket.totalQuantity || 0), 0);
        const available = categoryTickets.reduce((sum, ticket) => sum + Number(ticket.availableQuantity || 0), 0);
        return { categoryCode, total, available };
      });
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
    .sort((left, right) => String(left.matchDate || "").localeCompare(String(right.matchDate || "")));
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
        <span>Team vs Team</span>
        <span>Availability</span>
        <span>City</span>
        <span>Stage</span>
      </div>
      ${groups
        .map((group, index) => {
          const isExpanded = state.expandedMatches.has(group.key);
          const availabilitySummary = group.categoryBreakdown
            .map(
              (item) => `
                    <span class="fifa-availability-line">CAT ${item.categoryCode}: ${item.available}/${item.total}</span>
              `
            )
            .join("");
          return `
            <article class="fifa-match-card ${isExpanded ? "is-open" : ""}">
              <div class="fifa-match-toggle" data-action="toggle-match" data-match-key="${escapeHtml(group.key)}" role="button" tabindex="0">
                <div class="fifa-match-col fifa-match-col--number">
                  <strong>${index + 1}</strong>
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
                    ${availabilitySummary}
                    <span class="fifa-table-sub fifa-availability-total">Total available: ${group.availableUnits}</span>
                  </div>
                </div>
                <div class="fifa-match-col">
                  <strong>${escapeHtml(group.city)}</strong>
                </div>
                <div class="fifa-match-col fifa-match-col--stage">
                  <strong>${escapeHtml(group.stage)}</strong>
                  <div class="fifa-match-stage-actions">
                    <button type="button" class="button-secondary fifa-inline-action" data-action="edit-match" data-match-number="${escapeHtml(group.matchNumber)}">Edit</button>
                    <button type="button" class="button-secondary fifa-inline-action" data-action="delete-match" data-match-key="${escapeHtml(group.key)}">Delete</button>
                    <button type="button" class="fifa-inline-action" data-action="add-ticket-match" data-match-number="${escapeHtml(group.matchNumber)}">Add Ticket</button>
                  </div>
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
                                  .map(
                                    (ticket) => `
                                      <tr>
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
                                          <strong>${ticket.availableQuantity}/${ticket.totalQuantity}</strong>
                                          <span class="fifa-table-sub">sold ${ticket.soldQuantity}</span>
                                        </td>
                                        <td>
                                          <span class="fifa-pill ${ticket.visibility === "public" ? "is-public" : "is-private"}">${escapeHtml(ticket.visibility)}</span>
                                          ${ticket.seatAssignedLater ? '<span class="fifa-pill">assigned later</span>' : ""}
                                        </td>
                                        <td class="fifa-actions-cell">
                                          <button type="button" data-action="sell" data-id="${escapeHtml(ticket.id)}">Sell</button>
                                          <button type="button" class="button-secondary" data-action="edit-ticket" data-id="${escapeHtml(ticket.id)}">Edit</button>
                                          <button type="button" class="button-secondary" data-action="toggle-visibility" data-id="${escapeHtml(ticket.id)}">${ticket.visibility === "public" ? "Make private" : "Make public"}</button>
                                          <button type="button" class="button-secondary" data-action="delete-ticket" data-id="${escapeHtml(ticket.id)}">Delete</button>
                                        </td>
                                      </tr>
                                    `
                                  )
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

function renderSales() {
  const sales = filteredSales();
  if (!sales.length) {
    if (saleList) saleList.innerHTML = '<p class="empty">No sales match these filters yet.</p>';
    return;
  }
  if (!saleList) return;
  saleList.innerHTML = `
    <table class="manager-table fifa-table">
      <thead>
        <tr>
          <th>Buyer</th>
          <th>Ticket</th>
          <th>Qty</th>
          <th>Total</th>
          <th>Paid</th>
          <th>Status</th>
          <th>Manager</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${sales
          .map(
            (sale) => `
              <tr>
                <td>
                  <strong>${escapeHtml(sale.buyerTitle || sale.buyerName)}</strong>
                  ${sale.buyerTitle ? `<span class="fifa-table-sub">${escapeHtml(sale.buyerName || "")}</span>` : ""}
                  <span class="fifa-table-sub">${escapeHtml(sale.buyerPhone || sale.buyerEmail || "-")}</span>
                  <span class="fifa-table-sub">${escapeHtml(sale.buyerPassportNumber || "")}</span>
                </td>
                <td>
                  <strong>${escapeHtml(sale.ticketLabel || "-")}</strong>
                  <span class="fifa-table-sub">${escapeHtml(sale.city || "")}</span>
                  <span class="fifa-table-sub">${escapeHtml(sale.seatDetails || "")}</span>
                </td>
                <td>${sale.quantity}</td>
                <td>${escapeHtml(formatMoney(sale.totalPrice))}</td>
                <td>
                  <strong>${escapeHtml(formatMoney(sale.amountPaid))}</strong>
                  <span class="fifa-table-sub">Balance ${escapeHtml(formatMoney(sale.balanceDue))}</span>
                </td>
                <td>
                  <span class="fifa-pill">${escapeHtml(sale.paymentStatus)}</span>
                  <span class="fifa-pill ${sale.saleStatus === "cancelled" ? "is-cancelled" : ""}">${escapeHtml(sale.saleStatus)}</span>
                </td>
                <td>
                  <strong>${escapeHtml(sale.soldByName || "-")}</strong>
                  <span class="fifa-table-sub">${escapeHtml(formatDateTime(sale.soldAt))}</span>
                </td>
                <td class="fifa-actions-cell">
                  <button type="button" class="button-secondary" data-action="edit-sale" data-id="${escapeHtml(sale.id)}">Edit</button>
                  <button type="button" class="button-secondary" data-action="cancel-sale" data-id="${escapeHtml(sale.id)}">Cancel</button>
                  <button type="button" class="button-secondary" data-action="delete-sale" data-id="${escapeHtml(sale.id)}">Delete</button>
                </td>
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  `;
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
    payload.ticketIds = selectedSaleTicketIds();
    payload.ticketBlocks = state.saleBlocks.map((block) => ({
      matchNumber: block.matchNumber,
      matchLabel: block.matchLabel,
      categoryCode: block.categoryCode,
      quantity: block.quantity,
      totalPrice: block.totalPrice,
      seatPreview: block.seatPreview,
      ticketIds: [...(block.ticketIds || [])],
    }));
    payload.participants = state.participants
      .map((participant) => ({
        name: String(participant.name || "").trim(),
        passportNumber: String(participant.passportNumber || "").trim(),
        nationality: String(participant.nationality || "").trim(),
        notes: String(participant.notes || "").trim(),
      }))
      .filter((participant) => participant.name || participant.passportNumber || participant.nationality || participant.notes);
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
saleForm?.elements?.quantity?.addEventListener("input", syncSaleTotals);
saleForm?.elements?.pricePerTicket?.addEventListener("input", syncSaleTotals);
saleForm?.elements?.amountPaid?.addEventListener("input", syncSaleTotals);
saleMatchSelect?.addEventListener("change", () => refreshSaleCategoryOptions());
document.querySelector("#fifa-sale-add-block")?.addEventListener("click", () => {
  try {
    const block = createSaleBlockFromSelection();
    state.saleBlocks.push(block);
    renderSaleBlocks();
    clearStatus(saleStatusNode);
  } catch (error) {
    setStatus(saleStatusNode, error.message, true);
  }
});
document.querySelector("#fifa-sale-add-participant")?.addEventListener("click", () => {
  state.participants.push({ name: "", passportNumber: "", nationality: "", notes: "" });
  renderParticipants();
});

Object.values(ticketFilters).forEach((node) => {
  node?.addEventListener("input", renderTickets);
  node?.addEventListener("change", renderTickets);
});
Object.values(saleFilters).forEach((node) => {
  node?.addEventListener("input", renderSales);
  node?.addEventListener("change", renderSales);
});

ticketList?.addEventListener("click", async (event) => {
  const checkbox = event.target.closest('input[type="checkbox"][data-action="select-ticket"]');
  if (checkbox) {
    if (checkbox.checked) state.selectedTickets.add(checkbox.dataset.id);
    else state.selectedTickets.delete(checkbox.dataset.id);
    renderTickets();
    return;
  }

  const target = event.target.closest("[data-action]");
  if (target?.dataset.action === "toggle-match") {
    const matchKey = target.dataset.matchKey || "";
    if (state.expandedMatches.has(matchKey)) {
      state.expandedMatches.delete(matchKey);
    } else {
      state.expandedMatches.add(matchKey);
    }
    renderTickets();
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
    if (!window.confirm(`Delete match ${group.matchNumber} and all of its tickets?`)) return;
    try {
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
  if (target.dataset.action === "sell") {
    startSaleForTicket(ticketId);
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
  const target = event.target.closest("button[data-action]");
  if (!target) return;
  const saleId = target.dataset.id;
  const sale = state.sales.find((item) => item.id === saleId);
  if (!sale) return;

  if (target.dataset.action === "edit-sale") {
    fillSaleForm(sale);
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

saleBlockList?.addEventListener("click", (event) => {
  const target = event.target.closest('[data-action="remove-sale-block"]');
  if (!target) return;
  const index = Number(target.dataset.index || -1);
  if (index < 0) return;
  state.saleBlocks.splice(index, 1);
  renderSaleBlocks();
});

saleParticipantList?.addEventListener("input", (event) => {
  const card = event.target.closest("[data-participant-index]");
  if (!card) return;
  const index = Number(card.dataset.participantIndex || -1);
  const field = event.target.dataset.participantField;
  if (index < 0 || !field || !state.participants[index]) return;
  state.participants[index][field] = event.target.value;
});

resetTicketForm();
resetSaleForm();
loadDashboard().catch((error) => {
  setStatus(ticketStatusNode, error.message, true);
  setStatus(saleStatusNode, error.message, true);
});
