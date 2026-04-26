const params = new URLSearchParams(window.location.search);
const tripId = params.get("tripId") || "";
const groupId = params.get("groupId") || "";

const breadcrumb = document.getElementById("group-breadcrumb");
const summaryNode = document.getElementById("group-summary");
const invoicesList = document.getElementById("group-invoices-list");
const contractsListNode = document.getElementById("group-contracts-list");
const addContractBtnTop = document.getElementById("group-add-contract-btn");
const addInvoiceBtnTop = document.getElementById("group-add-invoice-btn");
const campList = document.getElementById("group-camp-list");
const flightsList = document.getElementById("group-flights-list");
const flightPaymentsList = document.getElementById("group-flight-payments-list");
const transfersList = document.getElementById("group-transfers-list");
const roomingList = document.getElementById("group-rooming-list");
const participantsList = document.getElementById("group-participants-list");
const addBtn = document.getElementById("group-add-tourist");
const suggestBtn = document.getElementById("group-rooming-suggest");

const formPanel = document.getElementById("group-tourist-form-panel");
const form = document.getElementById("group-tourist-form");
const formTitle = document.getElementById("group-tourist-form-title");
const formStatus = document.getElementById("group-tourist-form-status");

let trip = null;
let group = null;
let tourists = [];
let invoices = [];
let contracts = [];
let flights = [];
const expandedInvoiceIds = new Set();
let campReservations = [];
let transfers = [];
let editingId = "";

const ROOM_TYPE_LABELS = {
  single: "Single",
  double: "Double",
  twin: "Twin",
  triple: "Triple",
  family: "Family connected",
  other: "Other",
};
const ROOM_TYPE_SHORT = {
  single: "sgl",
  double: "dbl",
  twin: "twin",
  triple: "tpl",
  family: "fam",
  other: "other",
};

// Distinct, light pastels for room color-coding. Cycles if more rooms.
const ROOM_PALETTE = [
  { bg: "#fde2e4", fg: "#7a1d2a" },
  { bg: "#dbeafe", fg: "#1e3a8a" },
  { bg: "#dcfce7", fg: "#14532d" },
  { bg: "#fef3c7", fg: "#78350f" },
  { bg: "#e9d5ff", fg: "#5b21b6" },
  { bg: "#fed7aa", fg: "#7c2d12" },
  { bg: "#cffafe", fg: "#155e75" },
  { bg: "#fbcfe8", fg: "#831843" },
  { bg: "#d9f99d", fg: "#365314" },
  { bg: "#fde68a", fg: "#713f12" },
];

let roomColorMap = {};
function roomKey(t) {
  if (!t || !t.roomType) return "";
  return `${t.roomType}|${t.roomCode || ""}`;
}
function rebuildRoomColorMap() {
  roomColorMap = {};
  let i = 0;
  tourists
    .filter((t) => t.roomType)
    .forEach((t) => {
      const key = roomKey(t);
      if (!(key in roomColorMap)) {
        roomColorMap[key] = ROOM_PALETTE[i % ROOM_PALETTE.length];
        i += 1;
      }
    });
}
function roomColor(t) {
  return roomColorMap[roomKey(t)] || null;
}

function sortTourists(a, b) {
  const ai = Number.isFinite(a.orderIndex) ? a.orderIndex : 9999;
  const bi = Number.isFinite(b.orderIndex) ? b.orderIndex : 9999;
  if (ai !== bi) return ai - bi;
  return String(a.serial || "").localeCompare(String(b.serial || ""));
}

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(d) {
  if (!d) return "-";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toISOString().slice(0, 10);
}

function ageFromDob(dob) {
  if (!dob) return "";
  const dt = new Date(dob);
  if (Number.isNaN(dt.getTime())) return "";
  const ms = Date.now() - dt.getTime();
  return Math.floor(ms / (365.25 * 24 * 60 * 60 * 1000));
}

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  let data = {};
  try { data = await res.json(); } catch {}
  if (!res.ok) throw new Error(data.error || `Request failed: ${url}`);
  return data;
}

async function loadAll() {
  if (!tripId || !groupId) {
    summaryNode.innerHTML = '<p class="empty">Missing trip or group id in URL.</p>';
    return;
  }
  try {
    const [tripData, groupData, touristData, flightData, transferData, campData] = await Promise.all([
      fetchJson("/api/camp-trips"),
      fetchJson(`/api/tourist-groups?tripId=${encodeURIComponent(tripId)}`),
      fetchJson(`/api/tourists?groupId=${encodeURIComponent(groupId)}`),
      fetchJson("/api/flight-reservations").catch(() => ({ entries: [] })),
      fetchJson("/api/transfer-reservations").catch(() => ({ entries: [] })),
      fetchJson("/api/camp-reservations").catch(() => ({ entries: [] })),
    ]);
    trip = (tripData.entries || []).find((t) => t.id === tripId) || null;
    group = (groupData.entries || []).find((g) => g.id === groupId) || null;
    tourists = (touristData.entries || []).slice().sort(sortTourists);
    flights = (flightData.entries || []).filter((f) => f.tripId === tripId);
    transfers = (transferData.entries || []).filter((t) => t.tripId === tripId);
    campReservations = (campData.entries || []).filter((c) => c.tripId === tripId);
    // Load contracts and invoices into separate lists.
    try {
      const [contractsRes, invoicesRes] = await Promise.all([
        fetchJson("/api/contracts").catch(() => []),
        fetchJson(`/api/invoices?tripId=${encodeURIComponent(tripId)}`).catch(() => ({ entries: [] })),
      ]);
      const contractList = Array.isArray(contractsRes) ? contractsRes : (contractsRes.entries || []);
      contracts = contractList.filter((c) => c.groupId === groupId || (c.tripId === tripId && !c.groupId));
      invoices = (invoicesRes.entries || []).filter((i) => !i.groupId || i.groupId === groupId);
    } catch {
      contracts = []; invoices = [];
    }
    rebuildRoomColorMap();
    renderBreadcrumb();
    renderSummary();
    renderContracts();
    renderInvoices();
    renderCampReservations();
    renderFlights();
    renderFlightPayments();
    renderTransfers();
    renderRooming();
    renderParticipants();
    loadDocuments();
  } catch (err) {
    summaryNode.innerHTML = `<p class="empty">Could not load group: ${escapeHtml(err.message)}</p>`;
  }
}

function loadDocuments() {
  const docsNode = document.getElementById("group-documents-list");
  if (!docsNode) return;
  const docs = (trip && trip.documents) || [];
  if (!docs.length) {
    docsNode.innerHTML = '<p class="empty">No documents uploaded for this trip yet. Add them on the trip page.</p>';
    return;
  }
  docsNode.innerHTML = `
    <ul class="group-doc-list">
      ${docs.map((d) => `
        <li>
          <a href="${escapeHtml(d.url || d.path || "#")}" target="_blank" rel="noreferrer">
            ${escapeHtml(d.name || d.filename || "Document")}
          </a>
          <span class="group-doc-meta">
            ${d.category ? escapeHtml(d.category) + " · " : ""}${d.uploadedAt ? escapeHtml(formatDate(d.uploadedAt)) : ""}
          </span>
        </li>
      `).join("")}
    </ul>
  `;
}

function renderBreadcrumb() {
  breadcrumb.innerHTML = `
    <a href="/backoffice">Trips</a>
    <span>›</span>
    <a href="/trip-detail?tripId=${encodeURIComponent(tripId)}">${escapeHtml(trip?.serial || "")} · ${escapeHtml(trip?.tripName || "")}</a>
    <span>›</span>
    <strong>${escapeHtml(group?.serial || "")} · ${escapeHtml(group?.name || "")}</strong>
  `;
}

function buildRoomingSummary(list) {
  const counts = {};
  list.forEach((t) => {
    if (!t.roomType) return;
    counts[t.roomType] = (counts[t.roomType] || 0) + 1;
  });
  // Each room holds: single=1, double=2, twin=2, triple=3, family=variable, other=variable
  const occupancy = { single: 1, double: 2, twin: 2, triple: 3 };
  const parts = [];
  Object.keys(counts).forEach((type) => {
    const occupants = counts[type];
    const cap = occupancy[type] || 1;
    const rooms = Math.ceil(occupants / cap);
    parts.push(`${ROOM_TYPE_SHORT[type] || type} - ${rooms}`);
  });
  return parts.join(", ");
}

function getOutboundFlight() {
  if (!flights.length) return null;
  const sorted = flights.slice().sort((a, b) =>
    String(a.departureDate || "").localeCompare(String(b.departureDate || ""))
  );
  return sorted[0];
}

function getReturnFlight() {
  if (!flights.length) return null;
  const sorted = flights.slice().sort((a, b) =>
    String(b.departureDate || "").localeCompare(String(a.departureDate || ""))
  );
  return sorted[0];
}

function renderSummary() {
  if (!group) {
    summaryNode.innerHTML = '<p class="empty">Group not found.</p>';
    return;
  }
  const adults = tourists.filter((t) => {
    const a = ageFromDob(t.dob);
    return a === "" || a >= 18;
  }).length;
  const children = tourists.length - adults;
  const rooming = buildRoomingSummary(tourists) || "Not set";
  const outbound = getOutboundFlight();
  const ret = flights.length > 1 ? getReturnFlight() : null;
  const flightInfo = (outbound || ret) ? `
    <div class="group-summary-flights">
      <p class="group-summary-label">Flight info</p>
      ${outbound ? `<p><strong>Depart:</strong> ${escapeHtml(formatDate(outbound.departureDate))} ${escapeHtml(outbound.departureTime || "")} · ${escapeHtml(outbound.fromCity || "-")} → ${escapeHtml(outbound.toCity || "-")} ${escapeHtml(outbound.airline || "")} ${escapeHtml(outbound.flightNumber || "")}</p>` : ""}
      ${ret ? `<p><strong>Return:</strong> ${escapeHtml(formatDate(ret.departureDate))} ${escapeHtml(ret.departureTime || "")} · ${escapeHtml(ret.fromCity || "-")} → ${escapeHtml(ret.toCity || "-")} ${escapeHtml(ret.airline || "")} ${escapeHtml(ret.flightNumber || "")}</p>` : ""}
    </div>
  ` : "";
  summaryNode.innerHTML = `
    <div class="group-summary-actions">
      <button type="button" class="header-action-btn header-action-edit" id="group-edit-btn" aria-label="Edit group">✎ Edit</button>
    </div>
    <div class="group-summary-grid">
      <div>
        <p class="group-summary-label">Group</p>
        <h1>${escapeHtml(trip?.serial || "")} · ${escapeHtml(group.name || "—")}</h1>
        <p class="group-summary-meta">
          <span>${escapeHtml(group.serial || "")}</span>
          <span>${escapeHtml(trip?.tripName || "")}</span>
          <span>${formatDate(trip?.startDate)} → ${formatDate(trip?.endDate || "")}</span>
          ${trip?.tripType ? `<span class="trip-type-pill">${escapeHtml(trip.tripType.toUpperCase())}</span>` : ""}
          ${group.status ? `<span class="status-pill is-${escapeHtml(group.status)}">${escapeHtml(group.status)}</span>` : ""}
        </p>
        ${flightInfo}
      </div>
      <div class="group-summary-stats">
        <div><span class="group-stat-label">Headcount</span><strong>${tourists.length} / ${group.headcount || "-"}</strong></div>
        <div><span class="group-stat-label">Adults</span><strong>${adults}</strong></div>
        <div><span class="group-stat-label">Children</span><strong>${children}</strong></div>
        <div><span class="group-stat-label">Rooming</span><strong>${escapeHtml(rooming)}</strong></div>
      </div>
      <div class="group-summary-leader">
        <p class="group-summary-label">Group leader</p>
        <p><strong>${escapeHtml(group.leaderName || "-")}</strong></p>
        <p>${escapeHtml(group.leaderEmail || "-")}</p>
        <p>${escapeHtml(group.leaderPhone || "-")}</p>
        <p>${escapeHtml(group.leaderNationality || "")}</p>
      </div>
    </div>
  `;
  document.getElementById("group-edit-btn")?.addEventListener("click", openGroupEdit);
}

function fmtMoney(n) {
  const num = Number(String(n || 0).replace(/[^0-9.-]/g, "")) || 0;
  return num.toLocaleString("en-US") + " ₮";
}
function fmtDateOnly(value) {
  if (!value) return "-";
  return String(value).split("T")[0];
}
function fmtDateShort(value) {
  if (!value) return "-";
  return String(value).split("T")[0];
}

// "+ Add contract" opens the modal in-place on the group page (no nav).
// Pre-fills destination/dates from trip, traveler counts from group, and
// shows a tourist picker so admin can choose who signs (default: leader).
if (addContractBtnTop) {
  addContractBtnTop.removeAttribute("href");
  addContractBtnTop.setAttribute("role", "button");
  addContractBtnTop.style.cursor = "pointer";
  addContractBtnTop.addEventListener("click", async (e) => {
    e.preventDefault();
    if (typeof window.openContractModal !== "function") {
      // Fallback to old redirect if the shared modal failed to load.
      window.location.href = `/contracts?openCreate=1&tripId=${encodeURIComponent(tripId)}&groupId=${encodeURIComponent(groupId)}`;
      return;
    }
    const norm = (s) => String(s || "").trim().toLowerCase();
    const leaderName = norm(group?.leaderName);
    const leaderTourist = leaderName
      ? tourists.find((t) => {
          const a = norm(`${t.lastName || ""} ${t.firstName || ""}`);
          const b = norm(`${t.firstName || ""} ${t.lastName || ""}`);
          return a === leaderName || b === leaderName;
        })
      : null;
    const adultCount = tourists.filter((t) => {
      const cat = String(t.category || t.ageGroup || "").toLowerCase();
      return !cat || cat === "adult" || cat === "том";
    }).length || tourists.length || 1;
    const childCount = tourists.filter((t) => {
      const cat = String(t.category || t.ageGroup || "").toLowerCase();
      return cat === "child" || cat === "хүүхэд";
    }).length;
    await window.openContractModal({
      tripId,
      groupId,
      tourists: tourists.map((t) => ({
        id: t.id,
        lastName: t.lastName,
        firstName: t.firstName,
        registrationNumber: t.registrationNumber || t.register || t.registerNumber,
      })),
      defaultTouristId: leaderTourist?.id || tourists[0]?.id,
      prefill: {
        destination: trip?.destination || trip?.tripName || trip?.country || "",
        tripStartDate: trip?.startDate || trip?.tripStartDate || "",
        tripEndDate: trip?.endDate || trip?.tripEndDate || "",
        adultCount,
        childCount,
      },
      onSuccess: () => loadAll(),
    });
  });
}

function renderContracts() {
  if (!contractsListNode) return;
  if (!contracts.length) {
    contractsListNode.innerHTML = '<p class="empty">No contracts yet. Use + Add contract to create one.</p>';
    return;
  }
  contractsListNode.innerHTML = `
    <div class="table-scroll">
      <table class="contract-table">
        <thead>
          <tr>
            <th>#</th><th>Serial</th><th>Tourist</th><th>Manager</th><th>Destination</th><th>Starting Date</th><th>Status</th><th>Created</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${contracts.map((c, i) => {
            const data = c.data || {};
            const tourist = `${data.touristLastName || ""} ${data.touristFirstName || ""}`.trim() || "-";
            const manager = (c.createdBy && c.createdBy.name) || (c.updatedBy && c.updatedBy.name) || "-";
            const status = c.status || "pending";
            const statusLabel = status === "signed" ? "Signed" : "Pending";
            const statusClass = status === "signed" ? "status-confirmed" : "status-pending";
            const pdfReady = c.pdfPath && String(c.pdfPath).endsWith(".pdf");
            const signed = status === "signed";
            const shareLink = `${window.location.origin}/contract/${c.id}`;
            return `
              <tr>
                <td>${i + 1}</td>
                <td>${escapeHtml(data.contractSerial || "-")}</td>
                <td>${escapeHtml(tourist)}</td>
                <td>${escapeHtml(manager)}</td>
                <td>${escapeHtml(data.destination || "-")}</td>
                <td>${escapeHtml(fmtDateOnly(data.tripStartDate || data.contractDate))}</td>
                <td><span class="status-pill ${statusClass}">${statusLabel}</span></td>
                <td>${escapeHtml(fmtDateOnly(c.createdAt))}</td>
                <td>
                  <div class="contract-actions">
                    <a class="secondary-button" href="/api/contracts/${encodeURIComponent(c.id)}/document?mode=view" target="_blank" rel="noreferrer">View</a>
                    <button class="secondary-button" data-contract-action="edit" data-id="${escapeHtml(c.id)}" ${signed ? "disabled" : ""}>Edit</button>
                    <a class="secondary-button" href="${escapeHtml(c.docxPath || "#")}" download>Word</a>
                    ${pdfReady
                      ? `<a class="secondary-button ${signed ? "success-button" : ""}" href="/pdf-viewer?src=${encodeURIComponent("/api/contracts/" + c.id + "/document?mode=download")}&title=${encodeURIComponent(data.contractSerial || "Contract")}" target="_blank" rel="noreferrer">${signed ? "Signed PDF" : "PDF"}</a>`
                      : '<span class="muted">PDF pending</span>'}
                    <a class="secondary-button" href="/api/contracts/${encodeURIComponent(c.id)}/invoice?mode=view" target="_blank" rel="noreferrer">Invoice</a>
                    <button class="secondary-button" data-contract-action="copy" data-link="${escapeHtml(shareLink)}">Copy link</button>
                    <button class="secondary-button danger-button" data-contract-action="delete" data-id="${escapeHtml(c.id)}">Delete</button>
                  </div>
                </td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderInvoices() {
  if (!invoices.length) {
    invoicesList.innerHTML = '<p class="empty">No invoices yet. Use + Add invoice to create one.</p>';
    return;
  }
  const rows = invoices.map((inv) => {
    const expanded = expandedInvoiceIds.has(inv.id);
    const installmentRows = (inv.installments || []).map((ins) => {
      const status = (ins.status || "pending").toLowerCase();
      const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
      return `
        <div class="inv-installment-line">
          <span class="inv-inst-desc">${escapeHtml(ins.description || "-")}</span>
          <span class="inv-inst-amount">${fmtMoney(ins.amount)}</span>
          <span class="inv-inst-status"><span class="payment-status payment-status-${status}">${statusLabel}</span></span>
          <span class="inv-inst-due">${escapeHtml(fmtDateShort(ins.dueDate))}</span>
        </div>
      `;
    }).join("") || '<div class="inv-installment-line"><span class="inv-inst-desc muted">No installments</span></div>';
    return `
      <div class="inv-row ${expanded ? "is-expanded" : ""}" data-invoice-id="${escapeHtml(inv.id)}">
        <div class="inv-row-main">
          <button type="button" class="inv-chevron" data-inv-action="toggle" data-id="${escapeHtml(inv.id)}" aria-label="Toggle">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <input type="checkbox" class="inv-row-check" data-inv-check data-id="${escapeHtml(inv.id)}" />
          <span class="inv-cell inv-serial">
            <a href="#" class="inv-serial-link" data-inv-action="open" data-id="${escapeHtml(inv.id)}">${escapeHtml(inv.serial || inv.id)}</a>
          </span>
          <span class="inv-cell inv-payer">${escapeHtml(inv.payerName || "-")}</span>
          <span class="inv-cell inv-total">${fmtMoney(inv.total)}</span>
          <span class="inv-row-actions">
            <button type="button" class="inv-row-action-btn" data-inv-action="open" data-id="${escapeHtml(inv.id)}" title="Edit" aria-label="Edit">✎</button>
            <button type="button" class="inv-row-action-btn is-danger" data-inv-action="delete" data-id="${escapeHtml(inv.id)}" title="Delete" aria-label="Delete">✕</button>
          </span>
          <details class="inv-row-menu">
            <summary aria-label="Actions">⋯</summary>
            <div class="inv-row-menu-popover">
              <button type="button" data-inv-action="open" data-id="${escapeHtml(inv.id)}">Edit</button>
              <button type="button" data-inv-action="open-view" data-id="${escapeHtml(inv.id)}">View</button>
              <button type="button" data-inv-action="copy-row" data-id="${escapeHtml(inv.id)}">Copy link</button>
              <button type="button" class="is-danger" data-inv-action="delete" data-id="${escapeHtml(inv.id)}">Delete</button>
            </div>
          </details>
        </div>
        <div class="inv-row-installments">${installmentRows}</div>
      </div>
    `;
  }).join("");
  invoicesList.innerHTML = `
    <div class="inv-table">
      <div class="inv-row inv-row-header">
        <div class="inv-row-main">
          <span class="inv-chevron-spacer"></span>
          <input type="checkbox" class="inv-row-check" id="inv-check-all" />
          <span class="inv-cell inv-serial-h">Serial</span>
          <span class="inv-cell inv-payer-h">Payer</span>
          <span class="inv-cell inv-total-h">Total</span>
        </div>
        <div class="inv-row-installments inv-row-installments-h">
          <span class="inv-inst-desc">Description</span>
          <span class="inv-inst-amount">Amount</span>
          <span class="inv-inst-status">Status</span>
          <span class="inv-inst-due">Due Date</span>
        </div>
      </div>
      ${rows}
    </div>
  `;
}

// ── Side panel + edit modals (mirrors invoice.js) ──
function pencilSvg() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
}
let sidePanelInvoice = null;
function ensureSidePanel() {
  let panel = document.getElementById("inv-side-panel");
  if (panel) return panel;
  panel = document.createElement("aside");
  panel.id = "inv-side-panel";
  panel.className = "inv-side-panel is-hidden";
  panel.innerHTML = `
    <div class="inv-side-backdrop" data-inv-action="close-panel"></div>
    <div class="inv-side-dialog">
      <div class="inv-side-header">
        <h2 id="inv-side-title">Invoice</h2>
        <div class="inv-side-header-actions">
          <button type="button" class="inv-text-btn" data-inv-action="copy">Copy link</button>
          <button type="button" class="inv-text-btn" data-inv-action="open-view">Open</button>
          <button type="button" class="inv-icon-btn" data-inv-action="close-panel" aria-label="Close">×</button>
        </div>
      </div>
      <div class="inv-side-body" id="inv-side-body"></div>
    </div>
  `;
  document.body.appendChild(panel);
  panel.addEventListener("click", (e) => {
    const a = e.target.closest("[data-inv-action]")?.dataset?.invAction;
    if (a === "close-panel") closeSidePanel();
    if (a === "copy") {
      const id = panel.dataset.invoiceId;
      const link = `${window.location.origin}/invoice-view?id=${id}`;
      const btn = e.target.closest("[data-inv-action='copy']");
      navigator.clipboard?.writeText(link).then(() => {
        if (!btn) return;
        const t = btn.textContent;
        btn.textContent = "Copied";
        setTimeout(() => { btn.textContent = t; }, 1200);
      });
    }
    if (a === "open-view") {
      const id = panel.dataset.invoiceId;
      window.open(`/invoice-view?id=${id}`, "_blank");
    }
    if (a === "publish-now") {
      publishInvoice(panel.dataset.invoiceId);
    }
    const ek = e.target.closest("[data-inv-edit]")?.dataset?.invEdit;
    if (ek === "payer") openEditPayerModal();
    if (ek === "price") openEditPriceModal();
    if (ek === "installments") openEditInstallmentsModal();
    const reg = e.target.closest("[data-inv-action='register-payment']");
    if (reg) registerPayment(Number(reg.dataset.idx));
  });
  return panel;
}
function openSidePanel(invoice) {
  sidePanelInvoice = invoice;
  const panel = ensureSidePanel();
  panel.dataset.invoiceId = invoice.id;
  panel.classList.remove("is-hidden");
  document.body.classList.add("modal-open");
  renderSidePanel();
}
function closeSidePanel() {
  const p = document.getElementById("inv-side-panel");
  if (p) p.classList.add("is-hidden");
  document.body.classList.remove("modal-open");
  sidePanelInvoice = null;
}
function renderSidePanel() {
  if (!sidePanelInvoice) return;
  const inv = sidePanelInvoice;
  const titleNode = document.getElementById("inv-side-title");
  const body = document.getElementById("inv-side-body");
  if (titleNode) titleNode.textContent = `Invoice ${inv.serial || inv.id}`;
  const participantNames = (inv.participantIds || [])
    .map((id) => tourists.find((t) => t.id === id))
    .filter(Boolean)
    .map((t) => `${t.lastName || ""} ${t.firstName || ""}`.trim())
    .join(", ") || "-";
  const itemRows = (inv.items || []).map((it) => `
    <tr>
      <td>${escapeHtml(it.description || "-")}</td>
      <td class="t-right">${fmtMoney(it.price)}</td>
      <td class="t-center">${escapeHtml(it.qty)}</td>
      <td class="t-right">${fmtMoney((Number(it.qty) || 0) * (Number(it.price) || 0))}</td>
    </tr>
  `).join("");
  const installmentCards = (inv.installments || []).map((ins, idx) => {
    const status = (ins.status || "pending").toLowerCase();
    const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
    return `
      <div class="inv-side-installment">
        <div class="inv-side-inst-grid">
          <div class="inv-side-inst-desc">${escapeHtml(ins.description || "-")}</div>
          <div><div class="inv-side-inst-label">Issue Date</div><div>${escapeHtml(fmtDateOnly(ins.issueDate))}</div></div>
          <div><div class="inv-side-inst-label">Due Date</div><div>${escapeHtml(fmtDateOnly(ins.dueDate))}</div></div>
          <div><div class="inv-side-inst-label">Status</div><div><span class="payment-status payment-status-${status}">${statusLabel}</span></div></div>
          <div class="inv-side-inst-amount">${fmtMoney(ins.amount)}</div>
        </div>
        <button type="button" class="inv-side-register" data-inv-action="register-payment" data-idx="${idx}">
          <span class="inv-side-register-icon">+</span> Register payment
        </button>
      </div>
    `;
  }).join("") || '<p class="empty">No installments yet.</p>';
  const isPub = inv.status === "published";
  const pubLabel = isPub ? "Published" : (inv.status || "Draft").charAt(0).toUpperCase() + (inv.status || "draft").slice(1);
  body.innerHTML = `
    <div class="inv-side-card">
      <div class="inv-side-row">
        <div class="inv-side-row-label">Payer</div>
        <div class="inv-side-row-value">${escapeHtml(inv.payerName || "-")}</div>
        <button type="button" class="inv-side-edit" data-inv-edit="payer" aria-label="Edit payer">${pencilSvg()}</button>
      </div>
      <div class="inv-side-row">
        <div class="inv-side-row-label">Participants</div>
        <div class="inv-side-row-value">${escapeHtml(participantNames)}</div>
        <button type="button" class="inv-side-edit" data-inv-edit="payer" aria-label="Edit participants">${pencilSvg()}</button>
      </div>
      <div class="inv-side-row">
        <div class="inv-side-row-label">Publication Status</div>
        <div class="inv-side-row-value">
          ${escapeHtml(pubLabel)}
          ${isPub ? "" : `<button type="button" class="inv-publish-btn" data-inv-action="publish-now">Publish</button>`}
        </div>
        <span class="inv-side-edit-spacer"></span>
      </div>
    </div>
    <div class="inv-side-card">
      <div class="inv-side-card-head">
        <div><h3>Price Details</h3><p class="inv-side-card-sub">All prices in MNT</p></div>
        <button type="button" class="inv-side-edit" data-inv-edit="price" aria-label="Edit price">${pencilSvg()}</button>
      </div>
      <table class="inv-side-table">
        <thead><tr><th>Description</th><th class="t-right">Price</th><th class="t-center">Qty</th><th class="t-right">Total</th></tr></thead>
        <tbody>
          ${itemRows}
          <tr class="inv-side-table-total"><td colspan="3" class="t-right"><strong>Total</strong></td><td class="t-right"><strong>${fmtMoney(inv.total)}</strong></td></tr>
        </tbody>
      </table>
    </div>
    <div class="inv-side-card">
      <div class="inv-side-card-head">
        <h3>Installments</h3>
        <button type="button" class="inv-side-edit" data-inv-edit="installments" aria-label="Edit installments">${pencilSvg()}</button>
      </div>
      ${installmentCards}
    </div>
  `;
}
async function publishInvoice(id) {
  try {
    await fetchJson(`/api/invoices/${id}/publish`, { method: "POST" });
    await loadAll();
    const updated = invoices.find((x) => x.id === id);
    if (updated) openSidePanel(updated);
  } catch (err) { alert(err.message || "Publish failed"); }
}
async function deleteInvoice(id) {
  if (!(await UI.confirm("Delete this invoice?", { dangerous: true }))) return;
  try {
    await fetchJson(`/api/invoices/${id}`, { method: "DELETE" });
    closeSidePanel();
    await loadAll();
  } catch (err) { alert(err.message || "Delete failed"); }
}
async function registerPayment(idx) {
  if (!sidePanelInvoice) return;
  const dt = await UI.prompt("Paid date (YYYY-MM-DD):", { defaultValue: new Date().toISOString().slice(0, 10) });
  if (!dt) return;
  try {
    await fetchJson(`/api/invoices/${sidePanelInvoice.id}/payment`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ installmentIndex: idx, status: "paid", paidDate: dt }),
    });
    await loadAll();
    const updated = invoices.find((x) => x.id === sidePanelInvoice.id);
    if (updated) openSidePanel(updated);
  } catch (err) { alert(err.message || "Payment failed"); }
}

let editKind = "";
function ensureEditModal() {
  let m = document.getElementById("inv-edit-modal");
  if (m) return m;
  m = document.createElement("div");
  m.id = "inv-edit-modal";
  m.className = "inv-edit-modal is-hidden";
  m.innerHTML = `
    <div class="inv-edit-backdrop" data-inv-action="close-edit"></div>
    <div class="inv-edit-dialog">
      <button type="button" class="inv-edit-close" data-inv-action="close-edit" aria-label="Close">×</button>
      <div class="inv-edit-header">
        <h2 id="inv-edit-title">Edit</h2>
        <p class="inv-edit-sub" id="inv-edit-sub"></p>
      </div>
      <div class="inv-edit-body" id="inv-edit-body"></div>
      <div class="inv-edit-footer">
        <button type="button" class="inv-edit-cancel" data-inv-action="close-edit">Cancel</button>
        <button type="button" class="inv-edit-save" data-inv-action="save-edit">Save Changes</button>
      </div>
    </div>
  `;
  document.body.appendChild(m);
  m.addEventListener("click", (e) => {
    const a = e.target.closest("[data-inv-action]")?.dataset?.invAction;
    if (a === "close-edit") closeEditModal();
    if (a === "save-edit") saveEditModal();
  });
  return m;
}
function openEditModal(kind, title, sub) {
  editKind = kind;
  const m = ensureEditModal();
  document.getElementById("inv-edit-title").textContent = title;
  document.getElementById("inv-edit-sub").textContent = sub;
  m.classList.remove("is-hidden");
  document.body.classList.add("modal-open");
}
function closeEditModal() {
  const m = document.getElementById("inv-edit-modal");
  if (m) m.classList.add("is-hidden");
  document.body.classList.remove("modal-open");
  editKind = "";
}
function openEditPayerModal() {
  if (!sidePanelInvoice) return;
  openEditModal("payer", "Edit Payer & Participants", "Update the payer and participants for this invoice.");
  const body = document.getElementById("inv-edit-body");
  const groupTourists = tourists;
  body.innerHTML = `
    <label class="inv-edit-field">
      <span>Payer name <span class="inv-required">*</span></span>
      <input id="inv-edit-payer-name" value="${escapeHtml(sidePanelInvoice.payerName || "")}" />
    </label>
    <label class="inv-edit-field">
      <span>Payer address</span>
      <input id="inv-edit-payer-address" value="${escapeHtml(sidePanelInvoice.payerAddress || "")}" placeholder="Enter payer address" />
    </label>
    <div class="inv-edit-field">
      <span>Participants <span class="inv-required">*</span></span>
      <label class="inv-participant-row">
        <input type="checkbox" id="inv-edit-select-all" />
        <span>Select All</span>
      </label>
      <div id="inv-edit-participants">
        ${groupTourists.map((t) => {
          const checked = (sidePanelInvoice.participantIds || []).includes(t.id);
          return `
            <label class="inv-participant-row">
              <input type="checkbox" data-pid="${t.id}" ${checked ? "checked" : ""} />
              <span>${escapeHtml(`${t.lastName || ""} ${t.firstName || ""}`.trim())}</span>
            </label>
          `;
        }).join("")}
      </div>
    </div>
  `;
  body.querySelector("#inv-edit-select-all").addEventListener("change", (e) => {
    body.querySelectorAll("[data-pid]").forEach((c) => { c.checked = e.target.checked; });
  });
}
function openEditPriceModal() {
  if (!sidePanelInvoice) return;
  openEditModal("price", "Edit Price Details", "Add or modify price items for this invoice.");
  renderEditPriceBody();
}
function renderEditPriceBody() {
  const items = JSON.parse(JSON.stringify(sidePanelInvoice.items || []));
  if (!items.length) items.push({ description: "", qty: 1, price: 0 });
  sidePanelInvoice._editItems = items;
  const body = document.getElementById("inv-edit-body");
  const grand = items.reduce((a, it) => a + (Number(it.qty) || 0) * (Number(it.price) || 0), 0);
  body.innerHTML = `
    <div class="inv-price-head">
      <span>Description</span><span class="t-center">Qty</span><span class="t-right">Price</span><span class="t-right">Total</span>
    </div>
    <div id="inv-price-rows">${items.map((it, i) => priceRowHtml(it, i)).join("")}</div>
    <button type="button" class="inv-add-item" id="inv-add-item-btn">+ Add Item</button>
    <div class="inv-price-total"><span>Total</span><strong>${fmtMoney(grand)}</strong></div>
  `;
  body.querySelector("#inv-add-item-btn").addEventListener("click", () => {
    sidePanelInvoice._editItems.push({ description: "", qty: 1, price: 0 });
    renderEditPriceBody();
  });
  body.addEventListener("input", priceRowInput);
  body.addEventListener("click", priceRowClick);
}
function priceRowHtml(it, i) {
  const total = (Number(it.qty) || 0) * (Number(it.price) || 0);
  return `
    <div class="inv-price-row" data-row-i="${i}">
      <button type="button" class="inv-price-remove" data-action="remove-row" aria-label="Remove">⋮</button>
      <input class="inv-price-desc" data-field="description" value="${escapeHtml(it.description || "")}" placeholder="Description" />
      <input class="inv-price-qty" type="number" min="0" data-field="qty" value="${escapeHtml(it.qty || 0)}" />
      <input class="inv-price-price" type="number" min="0" data-field="price" value="${escapeHtml(it.price || 0)}" />
      <span class="inv-price-total-cell">${fmtMoney(total)}</span>
    </div>
  `;
}
function priceRowInput(e) {
  const row = e.target.closest(".inv-price-row");
  if (!row) return;
  const i = Number(row.dataset.rowI);
  const field = e.target.dataset.field;
  if (!field) return;
  sidePanelInvoice._editItems[i][field] = field === "qty" || field === "price" ? Number(e.target.value) || 0 : e.target.value;
  const it = sidePanelInvoice._editItems[i];
  row.querySelector(".inv-price-total-cell").textContent = fmtMoney((Number(it.qty) || 0) * (Number(it.price) || 0));
  const grand = sidePanelInvoice._editItems.reduce((a, x) => a + (Number(x.qty) || 0) * (Number(x.price) || 0), 0);
  const tNode = document.querySelector("#inv-edit-body .inv-price-total strong");
  if (tNode) tNode.textContent = fmtMoney(grand);
}
function priceRowClick(e) {
  if (e.target.closest("[data-action='remove-row']")) {
    const row = e.target.closest(".inv-price-row");
    if (!row) return;
    const i = Number(row.dataset.rowI);
    sidePanelInvoice._editItems.splice(i, 1);
    renderEditPriceBody();
  }
}
function openEditInstallmentsModal() {
  if (!sidePanelInvoice) return;
  openEditModal("installments", "Edit Installments", "Add or modify installments for this invoice.");
  renderEditInstallmentsBody();
}
function renderEditInstallmentsBody() {
  const list = JSON.parse(JSON.stringify(sidePanelInvoice.installments || []));
  sidePanelInvoice._editInstallments = list;
  const body = document.getElementById("inv-edit-body");
  const total = (sidePanelInvoice.items || []).reduce((a, it) => a + (Number(it.qty) || 0) * (Number(it.price) || 0), 0);
  const sumInst = list.reduce((a, i) => a + (Number(i.amount) || 0), 0);
  const diff = total - sumInst;
  body.innerHTML = `
    <div id="inv-inst-list">${list.map((ins, i) => installmentCardHtml(ins, i, list.length)).join("")}</div>
    <button type="button" class="inv-add-item" id="inv-add-inst-btn">+ Add installment</button>
    <div class="inv-inst-totals">
      <div><span>Total Installments:</span><strong>${fmtMoney(sumInst)}</strong></div>
      <div><span>Total Price:</span><strong>${fmtMoney(total)}</strong></div>
      <div class="${diff !== 0 ? "is-warning" : ""}"><span>Difference:</span><strong>${fmtMoney(diff)}</strong></div>
    </div>
  `;
  body.querySelector("#inv-add-inst-btn").addEventListener("click", () => {
    sidePanelInvoice._editInstallments.push({
      description: "Installment", issueDate: new Date().toISOString().slice(0, 10),
      dueDate: "", amount: 0, status: "pending",
    });
    renderEditInstallmentsBody();
  });
  body.addEventListener("input", instInput);
  body.addEventListener("click", instClick);
}
function installmentCardHtml(ins, i, total) {
  const expanded = i === 0;
  return `
    <div class="inv-inst-card ${expanded ? "is-expanded" : ""}" data-i="${i}">
      <div class="inv-inst-card-head">
        <strong>Installment ${i + 1}</strong>
        <div>
          <button type="button" data-action="toggle-inst" aria-label="Toggle">${expanded ? "▾" : "▸"}</button>
          <button type="button" data-action="remove-inst" aria-label="Remove">⋮</button>
        </div>
      </div>
      ${expanded ? `
        <div class="inv-inst-card-body">
          <label>Description<input data-field="description" value="${escapeHtml(ins.description || "")}" /></label>
          <div class="inv-inst-dates">
            <label>Due Date<input type="date" data-field="dueDate" value="${escapeHtml(ins.dueDate || "")}" /></label>
            <label>Issue Date<input type="date" data-field="issueDate" value="${escapeHtml(ins.issueDate || "")}" /></label>
          </div>
          <div class="inv-inst-chips">
            <button type="button" class="inv-chip" data-chip="7">7 days</button>
            <button type="button" class="inv-chip" data-chip="14">14 days</button>
            <button type="button" class="inv-chip" data-chip="30">30 days</button>
            <button type="button" class="inv-chip inv-chip-bell" title="Reminder">🔔</button>
          </div>
          <label>Amount<input type="number" min="0" data-field="amount" value="${escapeHtml(ins.amount || 0)}" /></label>
          <div class="inv-inst-chips">
            <button type="button" class="inv-chip" data-deposit="30">30% deposit</button>
            <button type="button" class="inv-chip" data-deposit="50">50% deposit</button>
            <button type="button" class="inv-chip" data-balance="1">Balance</button>
          </div>
        </div>
      ` : `
        <div class="inv-inst-card-summary">
          <span>${escapeHtml(ins.description || "-")}</span>
          <span>Due: ${escapeHtml(fmtDateShort(ins.dueDate))}</span>
          <strong>${fmtMoney(ins.amount)}</strong>
        </div>
      `}
    </div>
  `;
}
function instInput(e) {
  const card = e.target.closest(".inv-inst-card");
  if (!card) return;
  const i = Number(card.dataset.i);
  const field = e.target.dataset.field;
  if (!field) return;
  sidePanelInvoice._editInstallments[i][field] = field === "amount" ? Number(e.target.value) || 0 : e.target.value;
  refreshInstTotals();
}
function refreshInstTotals() {
  const list = sidePanelInvoice._editInstallments || [];
  const total = (sidePanelInvoice.items || []).reduce((a, it) => a + (Number(it.qty) || 0) * (Number(it.price) || 0), 0);
  const sumInst = list.reduce((a, x) => a + (Number(x.amount) || 0), 0);
  const diff = total - sumInst;
  const totals = document.querySelector("#inv-edit-body .inv-inst-totals");
  if (!totals) return;
  totals.innerHTML = `
    <div><span>Total Installments:</span><strong>${fmtMoney(sumInst)}</strong></div>
    <div><span>Total Price:</span><strong>${fmtMoney(total)}</strong></div>
    <div class="${diff !== 0 ? "is-warning" : ""}"><span>Difference:</span><strong>${fmtMoney(diff)}</strong></div>
  `;
}
function instClick(e) {
  const card = e.target.closest(".inv-inst-card");
  if (!card) return;
  const i = Number(card.dataset.i);
  const list = sidePanelInvoice._editInstallments;
  const total = (sidePanelInvoice.items || []).reduce((a, it) => a + (Number(it.qty) || 0) * (Number(it.price) || 0), 0);
  if (e.target.closest("[data-action='toggle-inst']")) { card.classList.toggle("is-expanded"); renderEditInstallmentsBody(); return; }
  if (e.target.closest("[data-action='remove-inst']")) { list.splice(i, 1); renderEditInstallmentsBody(); return; }
  const chip = e.target.closest("[data-chip]");
  if (chip) {
    const days = Number(chip.dataset.chip);
    const issue = list[i].issueDate || new Date().toISOString().slice(0, 10);
    const d = new Date(issue);
    d.setDate(d.getDate() + days);
    list[i].dueDate = d.toISOString().slice(0, 10);
    renderEditInstallmentsBody();
    return;
  }
  const dep = e.target.closest("[data-deposit]");
  if (dep) { list[i].amount = Math.round(total * (Number(dep.dataset.deposit) / 100)); renderEditInstallmentsBody(); return; }
  if (e.target.closest("[data-balance]")) {
    const others = list.reduce((a, x, j) => (j === i ? a : a + (Number(x.amount) || 0)), 0);
    list[i].amount = Math.max(total - others, 0);
    renderEditInstallmentsBody();
  }
}
async function saveEditModal() {
  if (!sidePanelInvoice) return;
  const body = document.getElementById("inv-edit-body");
  const payload = { tripId, groupId, payerId: sidePanelInvoice.payerId || "", currency: sidePanelInvoice.currency || "MNT" };
  if (editKind === "payer") {
    payload.payerName = body.querySelector("#inv-edit-payer-name").value.trim();
    payload.payerAddress = body.querySelector("#inv-edit-payer-address").value.trim();
    payload.participantIds = Array.from(body.querySelectorAll("[data-pid]:checked")).map((c) => c.dataset.pid);
    payload.items = sidePanelInvoice.items;
    payload.installments = sidePanelInvoice.installments;
  } else if (editKind === "price") {
    payload.payerName = sidePanelInvoice.payerName;
    payload.participantIds = sidePanelInvoice.participantIds;
    payload.items = sidePanelInvoice._editItems.filter((it) => (it.description || "").trim());
    payload.installments = sidePanelInvoice.installments;
  } else if (editKind === "installments") {
    payload.payerName = sidePanelInvoice.payerName;
    payload.participantIds = sidePanelInvoice.participantIds;
    payload.items = sidePanelInvoice.items;
    payload.installments = sidePanelInvoice._editInstallments;
  }
  try {
    await fetchJson(`/api/invoices/${sidePanelInvoice.id}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    closeEditModal();
    await loadAll();
    const updated = invoices.find((x) => x.id === sidePanelInvoice.id);
    if (updated) openSidePanel(updated);
  } catch (err) { alert(err.message || "Save failed."); }
}

// + Add invoice for the group: deep-link into trip-detail wizard with this group preselected.
addInvoiceBtnTop?.addEventListener("click", () => {
  window.location.href = `/trip-detail?tripId=${encodeURIComponent(tripId)}&openInvoice=${encodeURIComponent(groupId)}#invoices-section`;
});

// Click handlers for the two lists
contractsListNode?.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-contract-action]");
  if (!btn) return;
  const action = btn.dataset.contractAction;
  if (action === "copy") {
    try {
      await navigator.clipboard.writeText(btn.dataset.link || "");
      const label = btn.textContent;
      btn.textContent = "Copied";
      setTimeout(() => { btn.textContent = label; }, 1500);
    } catch { alert("Could not copy."); }
    return;
  }
  const id = btn.dataset.id;
  if (action === "delete") {
    if (!(await UI.confirm("Delete this contract?", { dangerous: true }))) return;
    try { await fetchJson(`/api/contracts/${id}`, { method: "DELETE" }); await loadAll(); }
    catch (err) { alert(err.message || "Could not delete contract."); }
  } else if (action === "edit") {
    window.open(`/contracts?editId=${encodeURIComponent(id)}#${encodeURIComponent(id)}`, "_blank", "noreferrer");
  }
});

invoicesList.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-inv-action]");
  if (!btn) return;
  const action = btn.dataset.invAction;
  const id = btn.dataset.id;
  const invoice = invoices.find((x) => x.id === id);
  if (action === "toggle") {
    if (expandedInvoiceIds.has(id)) expandedInvoiceIds.delete(id);
    else expandedInvoiceIds.add(id);
    renderInvoices();
    return;
  }
  if (action === "open" && invoice) {
    e.preventDefault();
    btn.closest("details.inv-row-menu")?.removeAttribute("open");
    openSidePanel(invoice);
    return;
  }
  if (action === "open-view") {
    e.preventDefault();
    btn.closest("details.inv-row-menu")?.removeAttribute("open");
    window.open(`/invoice-view?id=${id}`, "_blank");
    return;
  }
  if (action === "copy-row") {
    btn.closest("details.inv-row-menu")?.removeAttribute("open");
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/invoice-view?id=${id}`);
      const t = btn.textContent;
      btn.textContent = "Copied";
      setTimeout(() => { btn.textContent = t; }, 1200);
    } catch { alert("Could not copy."); }
    return;
  }
  if (action === "delete" && invoice) {
    btn.closest("details.inv-row-menu")?.removeAttribute("open");
    if (!(await UI.confirm(`Delete invoice #${invoice.serial || invoice.id}?`, { dangerous: true }))) return;
    try {
      await fetchJson(`/api/invoices/${id}`, { method: "DELETE" });
      await loadAll();
    } catch (err) { alert(err.message || "Could not delete."); }
  }
});
document.addEventListener("click", (e) => {
  invoicesList.querySelectorAll("details.inv-row-menu[open]").forEach((det) => {
    if (!det.contains(e.target)) det.removeAttribute("open");
  });
});

function renderFlights() {
  if (!flights.length) {
    flightsList.innerHTML = '<p class="empty">No flight reservations on this trip.</p>';
    return;
  }
  flightsList.innerHTML = `
    <div class="camp-table-wrap">
      <table class="camp-table reservation-addon-table">
        <thead><tr><th>#</th><th>Airline</th><th>Route</th><th>Departure</th><th>Pax</th></tr></thead>
        <tbody>
          ${flights.map((f, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>${escapeHtml(f.airline || "-")} ${escapeHtml(f.flightNumber || "")}</td>
              <td>${escapeHtml(f.fromCity || "-")} → ${escapeHtml(f.toCity || "-")}</td>
              <td>${escapeHtml(formatDate(f.departureDate))} ${escapeHtml(f.departureTime || "")}</td>
              <td>${escapeHtml(f.passengerCount || "-")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderCampReservations() {
  if (!campList) return;
  if (!campReservations.length) {
    campList.innerHTML = '<p class="empty">No camp reservations on this trip.</p>';
    return;
  }
  campList.innerHTML = `
    <div class="camp-table-wrap">
      <table class="camp-table reservation-addon-table">
        <thead><tr><th>#</th><th>Camp</th><th>Type</th><th>Check-in</th><th>Check-out</th><th>Room</th><th>Status</th></tr></thead>
        <tbody>
          ${campReservations.map((c, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>${escapeHtml(c.campName || "-")}</td>
              <td>${escapeHtml((c.reservationType || "-").toString().replace(/_/g, " "))}</td>
              <td>${escapeHtml(formatDate(c.checkIn))}</td>
              <td>${escapeHtml(formatDate(c.checkOut))}</td>
              <td>${escapeHtml((c.roomType || "-").toString().replace(/_/g, " "))}</td>
              <td>${escapeHtml((c.status || "-").toString().replace(/_/g, " "))}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderFlightPayments() {
  if (!flightPaymentsList) return;
  if (!flights.length) {
    flightPaymentsList.innerHTML = '<p class="empty">No flight payments yet.</p>';
    return;
  }
  flightPaymentsList.innerHTML = `
    <div class="camp-table-wrap">
      <table class="camp-table reservation-addon-table">
        <thead><tr><th>#</th><th>Airline</th><th>Route</th><th>Departure</th><th>Amount</th><th>Status</th></tr></thead>
        <tbody>
          ${flights.map((f, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>${escapeHtml(f.airline || "-")} ${escapeHtml(f.flightNumber || "")}</td>
              <td>${escapeHtml(f.fromCity || "-")} → ${escapeHtml(f.toCity || "-")}</td>
              <td>${escapeHtml(formatDate(f.departureDate))} ${escapeHtml(f.departureTime || "")}</td>
              <td>${escapeHtml(f.totalAmount || f.amount || "-")}</td>
              <td>${escapeHtml((f.paymentStatus || "unpaid").toString().replace(/_/g, " "))}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderTransfers() {
  if (!transfers.length) {
    transfersList.innerHTML = '<p class="empty">No transfers on this trip.</p>';
    return;
  }
  transfersList.innerHTML = `
    <div class="camp-table-wrap">
      <table class="camp-table reservation-addon-table">
        <thead><tr><th>#</th><th>Type</th><th>From → To</th><th>Date</th><th>Pax</th></tr></thead>
        <tbody>
          ${transfers.map((t, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>${escapeHtml((t.transferType || "-").toString().replace(/_/g, " "))}</td>
              <td>${escapeHtml(t.pickupLocation || "-")} → ${escapeHtml(t.dropoffLocation || "-")}</td>
              <td>${escapeHtml(formatDate(t.serviceDate))} ${escapeHtml(t.serviceTime || "")}</td>
              <td>${escapeHtml(t.passengerCount || "-")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderRooming() {
  if (!tourists.length) {
    roomingList.innerHTML = '<p class="empty">Add participants first, then assign rooms.</p>';
    return;
  }
  const rooms = {};
  tourists.forEach((t) => {
    if (!t.roomType) return;
    const key = `${t.roomType}|${t.roomCode || ""}`;
    rooms[key] = rooms[key] || { type: t.roomType, code: t.roomCode || "", occupants: [], colors: roomColor(t) };
    rooms[key].occupants.push(t);
  });
  const unassigned = tourists.filter((t) => !t.roomType);
  const roomCards = Object.values(rooms)
    .sort((a, b) => (a.code || "").localeCompare(b.code || "") || a.type.localeCompare(b.type))
    .map((room) => {
      const c = room.colors || { bg: "#f3f4f6", fg: "#374151" };
      return `
        <div class="rooming-card" style="background:${c.bg};color:${c.fg};border-color:${c.fg}22;">
          <header>
            <strong>${escapeHtml(room.code || "—")} ${escapeHtml(ROOM_TYPE_LABELS[room.type] || room.type)}</strong>
            <span>${room.occupants.length} pax</span>
          </header>
          <ul>
            ${room.occupants.map((o) => `<li>${escapeHtml(o.serial)} · ${escapeHtml(o.lastName)} ${escapeHtml(o.firstName)}</li>`).join("")}
          </ul>
        </div>
      `;
    })
    .join("");
  const unassignedCard = unassigned.length
    ? `<div class="rooming-card rooming-card-empty"><header><strong>Unassigned</strong><span>${unassigned.length} pax</span></header><ul>${unassigned.map((o) => `<li>${escapeHtml(o.serial)} · ${escapeHtml(o.lastName)} ${escapeHtml(o.firstName)}</li>`).join("")}</ul></div>`
    : "";
  roomingList.innerHTML = `<div class="rooming-grid">${roomCards}${unassignedCard}</div>`;
}

function renderParticipants() {
  if (!tourists.length) {
    participantsList.innerHTML = '<p class="empty">No participants yet. Click "Add participant".</p>';
    return;
  }
  participantsList.innerHTML = `
    <div class="camp-table-wrap">
      <table class="camp-table reservation-addon-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Serial</th>
            <th>Name</th>
            <th>Passport</th>
            <th>Expiry</th>
            <th>Birth date</th>
            <th>Age</th>
            <th>Gender</th>
            <th>Phone</th>
            <th>Room</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${tourists.map((t, i) => {
            const c = roomColor(t);
            const roomStyle = c ? `style="background:${c.bg};color:${c.fg};font-weight:700;"` : "";
            const roomLabel = t.roomType
              ? `${escapeHtml(t.roomCode || "—")} ${escapeHtml((ROOM_TYPE_LABELS[t.roomType] || "").toUpperCase())}`
              : "—";
            const upDisabled = i === 0 ? "disabled" : "";
            const downDisabled = i === tourists.length - 1 ? "disabled" : "";
            return `
              <tr>
                <td>${i + 1}</td>
                <td><strong>${escapeHtml(t.serial)}</strong></td>
                <td>${escapeHtml(t.lastName || "")} ${escapeHtml(t.firstName || "")}</td>
                <td>${escapeHtml(t.passportNumber || "-")}</td>
                <td>${escapeHtml(formatDate(t.passportExpiry))}</td>
                <td>${escapeHtml(formatDate(t.dob))}</td>
                <td>${ageFromDob(t.dob) || "-"}</td>
                <td>${escapeHtml((t.gender || "-").toUpperCase())}</td>
                <td>${escapeHtml(t.phone || "-")}</td>
                <td ${roomStyle}>${roomLabel}</td>
                <td>
                  <details class="row-menu">
                    <summary class="row-menu-trigger" aria-label="Actions">⋯</summary>
                    <div class="row-menu-popover">
                      <button type="button" class="row-menu-item" data-action="edit" data-id="${t.id}">Edit</button>
                      <button type="button" class="row-menu-item" data-action="move-up" data-id="${t.id}" ${upDisabled}>▲ Move up</button>
                      <button type="button" class="row-menu-item" data-action="move-down" data-id="${t.id}" ${downDisabled}>▼ Move down</button>
                      <button type="button" class="row-menu-item is-danger" data-action="delete" data-id="${t.id}">Delete</button>
                    </div>
                  </details>
                </td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

async function moveTourist(id, direction) {
  const idx = tourists.findIndex((t) => t.id === id);
  if (idx < 0) return;
  const swapWith = direction === "up" ? idx - 1 : idx + 1;
  if (swapWith < 0 || swapWith >= tourists.length) return;
  // Renumber and persist all tourists' orderIndex 0..N-1 with the swap applied
  const reordered = tourists.slice();
  const [moved] = reordered.splice(idx, 1);
  reordered.splice(swapWith, 0, moved);
  // Persist new orderIndex sequence
  try {
    await Promise.all(
      reordered.map((t, i) =>
        t.orderIndex === i
          ? Promise.resolve()
          : fetchJson(`/api/tourists/${t.id}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ orderIndex: i }),
            })
      )
    );
    await loadAll();
  } catch (err) {
    alert(err.message || "Could not reorder.");
  }
}

function openModal() {
  formPanel.classList.remove("is-hidden");
  formPanel.removeAttribute("hidden");
  document.body.classList.add("modal-open");
}
function closeModal() {
  formPanel.classList.add("is-hidden");
  formPanel.setAttribute("hidden", "");
  document.body.classList.remove("modal-open");
}

function resetForm() {
  editingId = "";
  form.reset();
  form.elements.id.value = "";
  formTitle.textContent = "New participant";
  formStatus.textContent = "";
  // DTX participants are overwhelmingly Mongolian with passports issued in
  // Ulaanbaatar — pre-fill those defaults to save typing. Admin can overwrite.
  // USM clients are international, so leave blank there.
  if (typeof readWorkspace === "function" && readWorkspace() === "DTX") {
    if (form.elements.nationality && !form.elements.nationality.value) {
      form.elements.nationality.value = "MONGOLIAN";
    }
    if (form.elements.passportIssuePlace && !form.elements.passportIssuePlace.value) {
      form.elements.passportIssuePlace.value = "ULAANBAATAR";
    }
  }
}

addBtn.addEventListener("click", () => {
  resetForm();
  openModal();
});

formPanel.addEventListener("click", (e) => {
  if (e.target.dataset?.action === "close-tourist-modal") closeModal();
});

// Auto-uppercase
form.addEventListener("input", (e) => {
  const t = e.target;
  if (!(t instanceof HTMLInputElement)) return;
  if (t.dataset.uppercase !== undefined) {
    const start = t.selectionStart;
    const end = t.selectionEnd;
    const upper = t.value.toUpperCase();
    if (upper !== t.value) {
      t.value = upper;
      try { t.setSelectionRange(start, end); } catch {}
    }
  }
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = Object.fromEntries(new FormData(form).entries());
  payload.tripId = tripId;
  payload.groupId = groupId;
  delete payload.id;
  try {
    formStatus.textContent = editingId ? "Saving..." : "Creating...";
    await fetchJson(editingId ? `/api/tourists/${editingId}` : "/api/tourists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    formStatus.textContent = "Saved.";
    closeModal();
    resetForm();
    await loadAll();
  } catch (err) {
    formStatus.textContent = err.message || "Could not save.";
  }
});

participantsList.addEventListener("toggle", (e) => {
  const det = e.target;
  if (!(det instanceof HTMLDetailsElement) || !det.classList.contains("row-menu")) return;
  if (!det.open) return;
  const trigger = det.querySelector("summary");
  const popover = det.querySelector(".row-menu-popover");
  if (!trigger || !popover) return;
  const rect = trigger.getBoundingClientRect();
  // Render off-screen briefly to measure actual height
  popover.style.left = "-9999px";
  popover.style.top = "0px";
  requestAnimationFrame(() => {
    const ph = popover.offsetHeight;
    const pw = popover.offsetWidth;
    const margin = 6;
    let top = rect.bottom + margin;
    if (top + ph > window.innerHeight - 8) top = Math.max(8, rect.top - ph - margin);
    let left = rect.right - pw;
    if (left < 8) left = 8;
    popover.style.top = `${top}px`;
    popover.style.left = `${left}px`;
  });
}, true);
// Close any open row-menu when clicking elsewhere
document.addEventListener("click", (e) => {
  document.querySelectorAll("details.row-menu[open]").forEach((det) => {
    if (!det.contains(e.target)) det.removeAttribute("open");
  });
});

participantsList.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const id = btn.dataset.id;
  btn.closest("details.row-menu")?.removeAttribute("open");
  if (btn.dataset.action === "move-up") { await moveTourist(id, "up"); return; }
  if (btn.dataset.action === "move-down") { await moveTourist(id, "down"); return; }
  const t = tourists.find((x) => x.id === id);
  if (!t) return;
  if (btn.dataset.action === "edit") {
    editingId = id;
    [
      "firstName", "lastName", "gender", "dob", "nationality",
      "passportNumber", "passportIssueDate", "passportExpiry", "passportIssuePlace",
      "registrationNumber", "phone", "email", "notes", "roomType", "roomCode",
      "marketingStatus",
    ].forEach((key) => {
      if (form.elements[key]) form.elements[key].value = t[key] || (key === "marketingStatus" ? "standard" : "");
    });
    formTitle.textContent = `Edit ${t.serial}`;
    openModal();
  } else if (btn.dataset.action === "delete") {
    if (!(await UI.confirm(`Delete ${t.serial} ${t.lastName} ${t.firstName}?`, { dangerous: true }))) return;
    try {
      await fetchJson(`/api/tourists/${id}`, { method: "DELETE" });
      await loadAll();
    } catch (err) {
      alert(err.message || "Could not delete.");
    }
  }
});

suggestBtn.addEventListener("click", async () => {
  // Suggest room codes for tourists with roomType but missing roomCode
  const updates = [];
  const used = new Set(tourists.map((t) => t.roomCode).filter(Boolean));
  let next = 1;
  const nextCode = () => {
    while (used.has(String(next).padStart(2, "0"))) next++;
    const code = String(next).padStart(2, "0");
    used.add(code);
    return code;
  };
  // Pair up tourists by roomType
  const pending = tourists.filter((t) => t.roomType && !t.roomCode);
  pending.forEach((t) => {
    const code = nextCode();
    updates.push({ id: t.id, roomCode: code });
  });
  if (!updates.length) {
    alert("Every tourist with a room type already has a room code.");
    return;
  }
  for (const u of updates) {
    try {
      await fetchJson(`/api/tourists/${u.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomCode: u.roomCode }),
      });
    } catch (err) {
      console.warn("Failed to update room code:", err);
    }
  }
  await loadAll();
});

// Group edit modal
const groupEditPanel = document.getElementById("group-edit-panel");
const groupEditForm = document.getElementById("group-edit-form");
const groupEditStatus = document.getElementById("group-edit-status");

function openGroupEdit() {
  if (!group || !groupEditPanel) return;
  groupEditForm.elements.name.value = group.name || "";
  groupEditForm.elements.headcount.value = group.headcount || "";
  groupEditForm.elements.leaderName.value = group.leaderName || "";
  groupEditForm.elements.leaderEmail.value = group.leaderEmail || "";
  groupEditForm.elements.leaderPhone.value = group.leaderPhone || "";
  groupEditForm.elements.leaderNationality.value = group.leaderNationality || "";
  groupEditForm.elements.notes.value = group.notes || "";
  if (groupEditForm.elements.status) groupEditForm.elements.status.value = group.status || "pending";
  groupEditStatus.textContent = "";
  groupEditPanel.classList.remove("is-hidden");
  groupEditPanel.removeAttribute("hidden");
  document.body.classList.add("modal-open");
}
function closeGroupEdit() {
  groupEditPanel.classList.add("is-hidden");
  groupEditPanel.setAttribute("hidden", "");
  document.body.classList.remove("modal-open");
}
groupEditPanel?.addEventListener("click", (e) => {
  if (e.target.dataset?.action === "close-group-edit") closeGroupEdit();
});
groupEditForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = Object.fromEntries(new FormData(groupEditForm).entries());
  try {
    groupEditStatus.textContent = "Saving...";
    await fetchJson(`/api/tourist-groups/${groupId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    closeGroupEdit();
    await loadAll();
  } catch (err) {
    groupEditStatus.textContent = err.message || "Could not save.";
  }
});
document.getElementById("group-edit-delete")?.addEventListener("click", async () => {
  if (!(await UI.confirm(`Delete group "${group?.name || ""}"? This cannot be undone.`, { dangerous: true }))) return;
  try {
    await fetchJson(`/api/tourist-groups/${groupId}`, { method: "DELETE" });
    window.location.href = `/trip-detail?tripId=${encodeURIComponent(tripId)}`;
  } catch (err) {
    groupEditStatus.textContent = err.message || "Could not delete.";
  }
});

loadAll();
