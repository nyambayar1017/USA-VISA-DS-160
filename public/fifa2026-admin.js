const ticketForm = document.querySelector("#fifa-ticket-form");
const saleForm = document.querySelector("#fifa-sale-form");
const ticketList = document.querySelector("#fifa-ticket-list");
const saleList = document.querySelector("#fifa-sale-list");
const ticketStatusNode = document.querySelector("#fifa-ticket-status");
const saleStatusNode = document.querySelector("#fifa-sale-status");
const saleTicketSelect = document.querySelector("#fifa-sale-ticket");

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
  sold: document.querySelector("#fifa-summary-sold"),
  collected: document.querySelector("#fifa-summary-collected"),
  matches: document.querySelector("#fifa-summary-matches"),
};

const ticketCountNode = document.querySelector("#fifa-ticket-count");
const ticketMetaNode = document.querySelector("#fifa-ticket-meta");
const reloadSeedButton = document.querySelector("#fifa-reload-seed");

const state = {
  tickets: [],
  sales: [],
  summary: null,
  editingTicketId: "",
  editingSaleId: "",
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
  if (Number.isNaN(date.getTime())) {
    return String(value).replace("T", " ");
  }
  return date.toLocaleString();
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString();
}

function fillSelect(node, values, placeholder, keepValue = "") {
  if (!node) return;
  node.innerHTML = [`<option value="">${placeholder}</option>`]
    .concat(values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`))
    .join("");
  if (keepValue && values.includes(keepValue)) {
    node.value = keepValue;
  }
}

function updateSummary() {
  const summary = state.summary || {};
  if (summaryNodes.available) summaryNodes.available.textContent = summary.tickets?.availableUnits ?? 0;
  if (summaryNodes.sold) summaryNodes.sold.textContent = summary.tickets?.soldUnits ?? 0;
  if (summaryNodes.collected) summaryNodes.collected.textContent = formatMoney(summary.sales?.collected ?? 0);
  if (summaryNodes.matches) summaryNodes.matches.textContent = summary.tickets?.matches ?? 0;
}

function refreshFilterOptions() {
  const filters = state.summary?.filters || {};
  fillSelect(ticketFilters.match, filters.matches || [], "All matches", ticketFilters.match?.value || "");
  fillSelect(ticketFilters.stage, filters.stages || [], "All stages", ticketFilters.stage.value);
  fillSelect(ticketFilters.city, filters.cities || [], "All cities", ticketFilters.city.value);
  fillSelect(ticketFilters.category, filters.categories || [], "All categories", ticketFilters.category.value);
  fillSelect(saleFilters.city, filters.cities || [], "All cities", saleFilters.city.value);
  fillSelect(saleFilters.soldBy, filters.soldBy || [], "All managers", saleFilters.soldBy.value);
}

function refreshSaleTicketOptions() {
  if (!saleTicketSelect) return;
  const currentValue = saleTicketSelect.value;
  const groups = new Map();
  state.tickets
    .filter((ticket) => ticket.status === "active" && ticket.availableQuantity > 0)
    .forEach((ticket) => {
      const key = `${ticket.matchNumber} · ${ticket.matchLabel}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(ticket);
    });
  const options = [...groups.entries()]
    .map(([label, tickets]) => {
      const inner = tickets
        .map((ticket) => {
          const optionLabel = `CAT ${ticket.categoryCode} · ${ticket.seatDetails} · ${ticket.availableQuantity}/${ticket.totalQuantity} left · ${formatMoney(ticket.price, ticket.currency)}`;
          return `<option value="${escapeHtml(ticket.id)}">${escapeHtml(optionLabel)}</option>`;
        })
        .join("");
      return `<optgroup label="${escapeHtml(label)}">${inner}</optgroup>`;
    })
    .join("");
  saleTicketSelect.innerHTML = `<option value="">Choose ticket lot</option>${options}`;
  if (state.tickets.some((ticket) => ticket.id === currentValue)) {
    saleTicketSelect.value = currentValue;
  }
}

function resetTicketForm() {
  if (!ticketForm) return;
  ticketForm.reset();
  ticketForm.elements.id.value = "";
  ticketForm.elements.categoryCode.value = "1";
  ticketForm.elements.totalQuantity.value = "1";
  ticketForm.elements.currency.value = "USD";
  ticketForm.elements.visibility.value = "public";
  ticketForm.elements.status.value = "active";
  state.editingTicketId = "";
  setNodeText(document.querySelector("#fifa-ticket-submit"), "Save ticket lot");
  clearStatus(ticketStatusNode);
}

function resetSaleForm() {
  if (!saleForm) return;
  saleForm.reset();
  saleForm.elements.id.value = "";
  saleForm.elements.quantity.value = "1";
  saleForm.elements.amountPaid.value = "0";
  saleForm.elements.saleStatus.value = "active";
  saleForm.elements.paymentStatus.value = "unpaid";
  state.editingSaleId = "";
  setNodeText(document.querySelector("#fifa-sale-submit"), "Register sale");
  clearStatus(saleStatusNode);
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
  const tickets = filteredTickets();
  if (ticketCountNode) {
    ticketCountNode.textContent = `${tickets.length} ticket lots`;
  }
  if (ticketMetaNode) {
    const matchCount = new Set(tickets.map((ticket) => ticket.matchNumber)).size;
    ticketMetaNode.textContent = `${matchCount} matches in current view. Seat numbers come directly from the Excel import.`;
  }
  if (!tickets.length) {
    if (ticketList) ticketList.innerHTML = '<p class="empty">No ticket lots match these filters yet.</p>';
    return;
  }

  if (!ticketList) return;
  ticketList.innerHTML = `
    <table class="manager-table fifa-table">
      <thead>
        <tr>
          <th>Match</th>
          <th>Date</th>
          <th>City</th>
          <th>Category</th>
          <th>Seat / Ticket Number</th>
          <th>Price</th>
          <th>Qty</th>
          <th>Visibility</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${tickets
          .map(
            (ticket) => `
              <tr>
                <td>
                  <strong>${escapeHtml(ticket.matchLabel)}</strong>
                  <span class="fifa-table-sub">${escapeHtml(ticket.stage)} · ${escapeHtml(ticket.matchNumber || "-")}</span>
                </td>
                <td>${escapeHtml(formatDate(ticket.matchDate))}</td>
                <td>
                  <strong>${escapeHtml(ticket.city)}</strong>
                  <span class="fifa-table-sub">${escapeHtml(ticket.venue || "-")}</span>
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
                  <span class="fifa-pill">${escapeHtml(ticket.status)}</span>
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
                  <strong>${escapeHtml(sale.buyerName)}</strong>
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

function fillTicketForm(ticket) {
  if (!ticketForm) return;
  ticketForm.elements.id.value = ticket.id;
  ticketForm.elements.stage.value = ticket.stage || "";
  ticketForm.elements.matchNumber.value = ticket.matchNumber || "";
  ticketForm.elements.matchLabel.value = ticket.matchLabel || "";
  ticketForm.elements.matchDate.value = ticket.matchDate || "";
  ticketForm.elements.teamA.value = ticket.teamA || "";
  ticketForm.elements.teamB.value = ticket.teamB || "";
  ticketForm.elements.city.value = ticket.city || "";
  ticketForm.elements.venue.value = ticket.venue || "";
  ticketForm.elements.categoryCode.value = ticket.categoryCode || "";
  ticketForm.elements.categoryName.value = ticket.categoryName || "";
  ticketForm.elements.seatSection.value = ticket.seatSection || "";
  ticketForm.elements.seatDetails.value = ticket.seatDetails || "";
  ticketForm.elements.price.value = ticket.price || "";
  ticketForm.elements.currency.value = ticket.currency || "USD";
  ticketForm.elements.totalQuantity.value = ticket.totalQuantity || 1;
  ticketForm.elements.visibility.value = ticket.visibility || "public";
  ticketForm.elements.status.value = ticket.status || "active";
  ticketForm.elements.seatAssignedLater.checked = Boolean(ticket.seatAssignedLater);
  ticketForm.elements.notes.value = ticket.notes || "";
  state.editingTicketId = ticket.id;
  setNodeText(document.querySelector("#fifa-ticket-submit"), "Update ticket lot");
  setStatus(ticketStatusNode, "Editing ticket lot.");
  ticketForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function fillSaleForm(sale) {
  if (!saleForm) return;
  saleForm.elements.id.value = sale.id;
  saleForm.elements.ticketId.value = sale.ticketId || "";
  saleForm.elements.quantity.value = sale.quantity || 1;
  saleForm.elements.pricePerTicket.value = sale.pricePerTicket || "";
  saleForm.elements.totalPrice.value = sale.totalPrice || "";
  saleForm.elements.amountPaid.value = sale.amountPaid || 0;
  saleForm.elements.paymentStatus.value = sale.paymentStatus || "unpaid";
  saleForm.elements.paymentMethod.value = sale.paymentMethod || "";
  saleForm.elements.saleStatus.value = sale.saleStatus || "active";
  saleForm.elements.soldAt.value = String(sale.soldAt || "").slice(0, 16);
  saleForm.elements.buyerName.value = sale.buyerName || "";
  saleForm.elements.buyerPhone.value = sale.buyerPhone || "";
  saleForm.elements.buyerEmail.value = sale.buyerEmail || "";
  saleForm.elements.buyerPassportNumber.value = sale.buyerPassportNumber || "";
  saleForm.elements.buyerNationality.value = sale.buyerNationality || "";
  saleForm.elements.buyerNotes.value = sale.buyerNotes || "";
  state.editingSaleId = sale.id;
  setNodeText(document.querySelector("#fifa-sale-submit"), "Update sale");
  setStatus(saleStatusNode, "Editing sale.");
  saleForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function startSaleForTicket(ticketId) {
  if (!saleForm) return;
  resetSaleForm();
  const ticket = state.tickets.find((item) => item.id === ticketId);
  if (!ticket) return;
  saleForm.elements.ticketId.value = ticket.id;
  saleForm.elements.pricePerTicket.value = ticket.price || "";
  saleForm.elements.totalPrice.value = ticket.price || "";
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

async function loadDashboard() {
  const data = await fetchJson("/api/fifa2026");
  state.tickets = data.tickets || [];
  state.sales = data.sales || [];
  state.summary = data.summary || null;
  updateSummary();
  refreshFilterOptions();
  refreshSaleTicketOptions();
  renderTickets();
  renderSales();
}

if (ticketForm) {
  ticketForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(ticketForm).entries());
    payload.seatAssignedLater = ticketForm.elements.seatAssignedLater.checked;
    const ticketId = ticketForm.elements.id.value;
    setStatus(ticketStatusNode, ticketId ? "Updating ticket lot..." : "Saving ticket lot...");
    try {
      await fetchJson(ticketId ? `/api/fifa2026/tickets/${ticketId}` : "/api/fifa2026/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      resetTicketForm();
      await loadDashboard();
      setStatus(ticketStatusNode, ticketId ? "Ticket lot updated." : "Ticket lot saved.");
    } catch (error) {
      setStatus(ticketStatusNode, error.message, true);
    }
  });
}

if (saleForm) {
  saleForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(saleForm).entries());
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
document.querySelector("#fifa-sale-cancel")?.addEventListener("click", resetSaleForm);
reloadSeedButton?.addEventListener("click", async () => {
  if (!window.confirm("Replace current FIFA inventory with the full Excel-imported match list?")) return;
  setStatus(ticketStatusNode, "Reloading all matches from Excel seed...");
  try {
    await fetchJson("/api/fifa2026/reset-from-seed", { method: "POST" });
    await loadDashboard();
    setStatus(ticketStatusNode, "All matches and ticket lots were reloaded from the Excel seed.");
  } catch (error) {
    setStatus(ticketStatusNode, error.message, true);
  }
});
saleForm?.elements?.quantity?.addEventListener("input", syncSaleTotals);
saleForm?.elements?.pricePerTicket?.addEventListener("input", syncSaleTotals);
saleForm?.elements?.amountPaid?.addEventListener("input", syncSaleTotals);
saleTicketSelect?.addEventListener("change", () => {
  const ticket = state.tickets.find((item) => item.id === saleTicketSelect.value);
  if (!ticket || !saleForm) return;
  if (!state.editingSaleId) {
    saleForm.elements.pricePerTicket.value = ticket.price || "";
    syncSaleTotals();
  }
});

Object.values(ticketFilters).forEach((node) => node?.addEventListener("input", renderTickets));
Object.values(ticketFilters).forEach((node) => node?.addEventListener("change", renderTickets));
Object.values(saleFilters).forEach((node) => node?.addEventListener("input", renderSales));
Object.values(saleFilters).forEach((node) => node?.addEventListener("change", renderSales));

ticketList?.addEventListener("click", async (event) => {
  const target = event.target.closest("button[data-action]");
  if (!target) return;
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

resetTicketForm();
resetSaleForm();
loadDashboard().catch((error) => {
  setStatus(ticketStatusNode, error.message, true);
  setStatus(saleStatusNode, error.message, true);
});
