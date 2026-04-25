const listNode = document.querySelector("#tourist-list");
const countNode = document.querySelector("#tourist-count");
const filterName = document.querySelector("#tourist-filter-name");
const filterSerial = document.querySelector("#tourist-filter-serial");
const filterTrip = document.querySelector("#tourist-filter-trip");
const filterGroup = document.querySelector("#tourist-filter-group");
const filterNationality = document.querySelector("#tourist-filter-nationality");

let trips = [];
let groups = [];
let tourists = [];

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed: ${url}`);
  return res.json();
}

async function loadAll() {
  try {
    const [tripData, groupData, touristData] = await Promise.all([
      fetchJson("/api/camp-trips"),
      fetchJson("/api/tourist-groups"),
      fetchJson("/api/tourists"),
    ]);
    trips = tripData.entries || [];
    groups = groupData.entries || [];
    tourists = touristData.entries || [];
    renderTripOptions();
    renderGroupOptions();
    render();
  } catch (err) {
    listNode.innerHTML = `<p class="empty">Could not load tourists: ${escapeHtml(err.message)}</p>`;
  }
}

function renderTripOptions() {
  const current = filterTrip.value;
  filterTrip.innerHTML = `<option value="">All trips</option>${trips
    .slice()
    .sort((a, b) => (a.serial || "").localeCompare(b.serial || ""))
    .map((t) => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.serial || "")} · ${escapeHtml(t.tripName || "")}</option>`)
    .join("")}`;
  filterTrip.value = current;
}

function renderGroupOptions() {
  const current = filterGroup.value;
  const tripId = filterTrip.value;
  const list = tripId ? groups.filter((g) => g.tripId === tripId) : groups;
  filterGroup.innerHTML = `<option value="">All groups</option>${list
    .slice()
    .sort((a, b) => (a.serial || "").localeCompare(b.serial || ""))
    .map((g) => `<option value="${escapeHtml(g.id)}">${escapeHtml(g.serial || "")} · ${escapeHtml(g.name || "")}</option>`)
    .join("")}`;
  filterGroup.value = current && list.some((g) => g.id === current) ? current : "";
}

function getFiltered() {
  const name = (filterName.value || "").trim().toLowerCase();
  const serial = (filterSerial.value || "").trim().toLowerCase();
  const trip = filterTrip.value;
  const group = filterGroup.value;
  const nat = (filterNationality.value || "").trim().toLowerCase();
  return tourists.filter((t) => {
    const fullName = `${t.lastName || ""} ${t.firstName || ""}`.toLowerCase();
    if (name && !fullName.includes(name)) return false;
    if (serial && !(t.serial || "").toLowerCase().includes(serial)) return false;
    if (trip && t.tripId !== trip) return false;
    if (group && t.groupId !== group) return false;
    if (nat && !(t.nationality || "").toLowerCase().includes(nat)) return false;
    return true;
  });
}

function render() {
  const rows = getFiltered();
  countNode.textContent = `${rows.length} tourist${rows.length === 1 ? "" : "s"}`;
  if (!rows.length) {
    listNode.innerHTML = '<p class="empty">No tourists match your filters.</p>';
    return;
  }
  const tripById = Object.fromEntries(trips.map((t) => [t.id, t]));
  listNode.innerHTML = `
    <div class="camp-table-wrap">
      <table class="camp-table reservation-addon-table tourist-directory-table">
        <thead>
          <tr>
            <th>Serial</th>
            <th>Last name</th>
            <th>First name</th>
            <th>Trip</th>
            <th>Group</th>
            <th>Nationality</th>
            <th>Passport #</th>
            <th>Passport expiry</th>
            <th>Reg #</th>
            <th>Phone</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map((t) => {
              const trip = tripById[t.tripId];
              return `
                <tr>
                  <td><strong>${escapeHtml(t.serial || "")}</strong></td>
                  <td>${escapeHtml(t.lastName || "")}</td>
                  <td>${escapeHtml(t.firstName || "")}</td>
                  <td>${trip ? `<a href="/trip-detail?tripId=${encodeURIComponent(t.tripId)}" class="trip-name-link">${escapeHtml(trip.serial || "")} · ${escapeHtml(trip.tripName || "")}</a>` : escapeHtml(t.tripSerial || "-")}</td>
                  <td>${escapeHtml(t.groupSerial || "-")}${t.groupName ? ` · ${escapeHtml(t.groupName)}` : ""}</td>
                  <td>${escapeHtml(t.nationality || "-")}</td>
                  <td>${escapeHtml(t.passportNumber || "-")}</td>
                  <td>${escapeHtml(t.passportExpiry || "-")}</td>
                  <td>${escapeHtml(t.registrationNumber || "-")}</td>
                  <td>${escapeHtml(t.phone || "-")}</td>
                  <td><a class="table-link compact secondary" href="/trip-detail?tripId=${encodeURIComponent(t.tripId)}#tourists-section">Open trip</a></td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

[filterName, filterSerial, filterNationality].forEach((node) => {
  node.addEventListener("input", render);
});
filterTrip.addEventListener("change", () => {
  renderGroupOptions();
  render();
});
filterGroup.addEventListener("change", render);

loadAll();
