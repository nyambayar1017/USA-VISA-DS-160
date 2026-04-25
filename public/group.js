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
    tourists = touristData.entries || [];
    flights = (flightData.entries || []).filter((f) => f.tripId === tripId);
    transfers = (transferData.entries || []).filter((t) => t.tripId === tripId);
    campReservations = (campData.entries || []).filter((c) => c.tripId === tripId);
    // Invoices: not yet group-tagged. Filter by tripId where possible.
    try {
      const contracts = await fetchJson("/api/contracts");
      const list = Array.isArray(contracts) ? contracts : (contracts.entries || []);
      invoices = list.filter((c) => c.tripId === tripId || c.groupId === groupId);
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
    <div class="group-summary-grid">
      <div>
        <p class="group-summary-label">Group</p>
        <h1>${escapeHtml(trip?.serial || "")} · ${escapeHtml(group.name || "—")}</h1>
        <p class="group-summary-meta">
          <span>${escapeHtml(group.serial || "")}</span>
          <span>${escapeHtml(trip?.tripName || "")}</span>
          <span>${formatDate(trip?.startDate)} → ${formatDate(trip?.endDate || "")}</span>
          ${trip?.tripType ? `<span class="trip-type-pill">${escapeHtml(trip.tripType.toUpperCase())}</span>` : ""}
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
}

function renderInvoices() {
  if (!invoices.length) {
    invoicesList.innerHTML = '<p class="empty">No invoices linked to this group yet.</p>';
    return;
  }
  invoicesList.innerHTML = `
    <div class="camp-table-wrap">
      <table class="camp-table reservation-addon-table">
        <thead><tr><th>#</th><th>Type</th><th>Client</th><th>Total</th><th>Created</th></tr></thead>
        <tbody>
          ${invoices.map((inv, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>${escapeHtml(inv.contractType || inv.type || "-")}</td>
              <td>${escapeHtml(inv.clientName || inv.client || "-")}</td>
              <td>${escapeHtml(inv.totalAmount || inv.amount || "-")}</td>
              <td>${escapeHtml(formatDate(inv.createdAt))}</td>
            </tr>
          `).join("")}
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
                  <button type="button" class="table-link compact secondary" data-action="edit" data-id="${t.id}">Edit</button>
                  <button type="button" class="table-link compact secondary" data-action="delete" data-id="${t.id}">Delete</button>
                </td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
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

participantsList.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const id = btn.dataset.id;
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

// Tab switching
const GROUP_TAB_PANEL_IDS = [
  "group-participants-section",
  "group-flights-section",
  "group-transfers-section",
  "group-invoices-section",
  "group-rooming-section",
  "group-documents-section",
];
const tabBar = document.getElementById("group-tab-bar");
function setActiveTab(tabId) {
  tabBar.querySelectorAll(".trip-tab").forEach((b) => {
    b.classList.toggle("is-active", b.dataset.tab === tabId);
  });
  GROUP_TAB_PANEL_IDS.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle("is-hidden", id !== tabId);
  });
}
tabBar?.addEventListener("click", (e) => {
  const tab = e.target.closest(".trip-tab");
  if (!tab) return;
  setActiveTab(tab.dataset.tab);
});

loadAll();
