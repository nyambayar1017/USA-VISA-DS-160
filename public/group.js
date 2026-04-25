const params = new URLSearchParams(window.location.search);
const tripId = params.get("tripId") || "";
const groupId = params.get("groupId") || "";

const breadcrumb = document.getElementById("group-breadcrumb");
const summaryNode = document.getElementById("group-summary");
const invoicesList = document.getElementById("group-invoices-list");
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
let flights = [];
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
    // Combine contracts (legacy) and invoices (new) attached to this trip/group.
    try {
      const [contractsRes, invoicesRes] = await Promise.all([
        fetchJson("/api/contracts").catch(() => []),
        fetchJson(`/api/invoices?tripId=${encodeURIComponent(tripId)}`).catch(() => ({ entries: [] })),
      ]);
      const contractList = Array.isArray(contractsRes) ? contractsRes : (contractsRes.entries || []);
      const matchingContracts = contractList
        .filter((c) => c.groupId === groupId || (c.tripId === tripId && !c.groupId))
        .map((c) => ({
          kind: "contract",
          id: c.id,
          serial: (c.data && c.data.contractSerial) || c.id || "-",
          client: (c.data && (c.data.touristLastName || "") + " " + (c.data.touristFirstName || "")).trim() || "-",
          total: (c.data && c.data.totalPrice) || "-",
          createdAt: c.createdAt || "",
        }));
      const matchingInvoices = (invoicesRes.entries || [])
        .filter((i) => !i.groupId || i.groupId === groupId)
        .map((i) => ({
          kind: "invoice",
          id: i.id,
          serial: i.serial || i.id,
          client: i.payerName || "-",
          total: i.total || 0,
          status: i.status || "draft",
          createdAt: i.createdAt || "",
        }));
      invoices = [...matchingContracts, ...matchingInvoices];
    } catch {
      invoices = [];
    }
    rebuildRoomColorMap();
    renderBreadcrumb();
    renderSummary();
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
      <a class="header-action-btn" href="/contracts?openCreate=1&tripId=${encodeURIComponent(tripId)}&groupId=${encodeURIComponent(groupId)}">+ Add contract</a>
      <a class="header-action-btn" href="/trip-detail?tripId=${encodeURIComponent(tripId)}&openInvoice=${encodeURIComponent(groupId)}#invoices-section">+ Add invoice</a>
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

function renderInvoices() {
  if (!invoices.length) {
    invoicesList.innerHTML = '<p class="empty">No invoices or contracts linked to this group yet.</p>';
    return;
  }
  invoicesList.innerHTML = `
    <div class="camp-table-wrap">
      <table class="camp-table reservation-addon-table">
        <thead><tr><th>#</th><th>Type</th><th>Serial</th><th>Client</th><th>Total</th><th>Created</th><th>Open</th></tr></thead>
        <tbody>
          ${invoices.map((inv, i) => {
            const href = inv.kind === "contract"
              ? `/contracts#${encodeURIComponent(inv.id)}`
              : `/invoice-view?id=${encodeURIComponent(inv.id)}`;
            return `
              <tr>
                <td>${i + 1}</td>
                <td>${inv.kind === "contract" ? "Contract" : "Invoice"}</td>
                <td><strong>${escapeHtml(inv.serial)}</strong></td>
                <td>${escapeHtml(inv.client || "-")}</td>
                <td>${escapeHtml(String(inv.total))}</td>
                <td>${escapeHtml(formatDate(inv.createdAt))}</td>
                <td><a class="table-link compact secondary" href="${href}" target="_blank" rel="noreferrer">Open</a></td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

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
    ].forEach((key) => {
      if (form.elements[key]) form.elements[key].value = t[key] || "";
    });
    formTitle.textContent = `Edit ${t.serial}`;
    openModal();
  } else if (btn.dataset.action === "delete") {
    if (!confirm(`Delete ${t.serial} ${t.lastName} ${t.firstName}?`)) return;
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
  if (!confirm(`Delete group "${group?.name || ""}"? This cannot be undone.`)) return;
  try {
    await fetchJson(`/api/tourist-groups/${groupId}`, { method: "DELETE" });
    window.location.href = `/trip-detail?tripId=${encodeURIComponent(tripId)}`;
  } catch (err) {
    groupEditStatus.textContent = err.message || "Could not delete.";
  }
});

loadAll();
