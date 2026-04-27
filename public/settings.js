// /settings page controller — Destinations + Camps tabs.

const tabsBar = document.getElementById("settings-tabs");
const panels = document.querySelectorAll(".settings-panel");

const destinationForm = document.getElementById("destination-form");
const destinationInput = document.getElementById("destination-input");
const destinationList = document.getElementById("destination-list");
const destinationsStatus = document.getElementById("destinations-status");

const campForm = document.getElementById("camp-form");
const campSubmitButton = document.getElementById("camp-submit-button");
const campCancelButton = document.getElementById("camp-cancel-button");
const campContractCurrent = document.getElementById("camp-contract-current");
const campList = document.getElementById("camp-list");
const campStatus = document.getElementById("camp-status");
const campsStatus = document.getElementById("camps-status");

let destinations = [];
let campSettings = {
  campNames: [],
  locationNames: [],
  staffAssignments: [],
  roomChoices: [],
  campLocations: {},
  campDetails: {},
};
let editingCampName = "";
let pendingContractPath = "";

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function setStatus(node, message, isError = false) {
  if (!node) return;
  node.textContent = message || "";
  node.dataset.tone = isError ? "error" : "ok";
}

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

// ── Tab switching ─────────────────────────────────────────────────────
tabsBar?.addEventListener("click", (event) => {
  const tab = event.target.closest(".settings-tab");
  if (!tab) return;
  const target = tab.dataset.tab;
  tabsBar.querySelectorAll(".settings-tab").forEach((b) => b.classList.toggle("is-active", b === tab));
  panels.forEach((p) => p.classList.toggle("is-hidden", p.dataset.panel !== target));
});

// ── Destinations ─────────────────────────────────────────────────────
function renderDestinations() {
  if (!destinations.length) {
    destinationList.innerHTML = '<p class="empty">No destinations yet — add one above.</p>';
    return;
  }
  destinationList.innerHTML = destinations
    .map(
      (name) => `
        <span class="setting-pill">
          ${escapeHtml(name)}
          <button type="button" data-action="remove-destination" data-value="${escapeHtml(name)}" aria-label="Remove ${escapeHtml(name)}">×</button>
        </span>
      `
    )
    .join("");
}

async function loadDestinations() {
  try {
    const data = await fetchJson("/api/settings");
    destinations = data.entry?.destinations || [];
    renderDestinations();
  } catch (err) {
    destinationList.innerHTML = `<p class="empty">${escapeHtml(err.message)}</p>`;
  }
}

async function saveDestinations(message = "Saved.") {
  try {
    await fetchJson("/api/settings/destinations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ destinations }),
    });
    setStatus(destinationsStatus, message);
    renderDestinations();
  } catch (err) {
    setStatus(destinationsStatus, err.message, true);
  }
}

destinationForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const value = (destinationInput.value || "").trim();
  if (!value) return;
  if (destinations.includes(value)) {
    setStatus(destinationsStatus, "Already in the list.", true);
    return;
  }
  destinations = [...destinations, value];
  destinationInput.value = "";
  await saveDestinations("Added.");
});

destinationList?.addEventListener("click", async (event) => {
  const btn = event.target.closest('[data-action="remove-destination"]');
  if (!btn) return;
  const value = btn.dataset.value;
  if (!confirm(`Remove "${value}" from destinations?`)) return;
  destinations = destinations.filter((d) => d !== value);
  await saveDestinations("Removed.");
});

// ── Camps ────────────────────────────────────────────────────────────
function resetCampForm() {
  campForm.reset();
  campForm.elements.originalName.value = "";
  editingCampName = "";
  pendingContractPath = "";
  campContractCurrent.textContent = "";
  campSubmitButton.textContent = "Add camp";
  setStatus(campStatus, "");
}

function renderCamps() {
  const names = campSettings.campNames || [];
  if (!names.length) {
    campList.innerHTML = '<p class="empty">No camps yet — add one above.</p>';
  } else {
    campList.innerHTML = names
      .map((name) => {
        const location = campSettings.campLocations?.[name] || "";
        const detail = campSettings.campDetails?.[name] || {};
        const price = detail.price || "";
        const contract = detail.contractPath || "";
        return `
          <div class="settings-camp-card">
            <div class="settings-camp-card-head">
              <div>
                <h3>${escapeHtml(name)}</h3>
                ${location ? `<p>${escapeHtml(location)}</p>` : ""}
              </div>
              <div class="settings-camp-card-actions">
                <button type="button" data-action="edit-camp" data-name="${escapeHtml(name)}">Edit</button>
                <button type="button" data-action="remove-camp" data-name="${escapeHtml(name)}" class="button-secondary">Delete</button>
              </div>
            </div>
            ${price ? `<pre class="settings-camp-price">${escapeHtml(price)}</pre>` : '<p class="settings-camp-empty">No prices saved.</p>'}
            ${contract ? `<a class="settings-camp-contract" href="${escapeHtml(contract)}" target="_blank" rel="noreferrer">📄 Contract document</a>` : ""}
          </div>
        `;
      })
      .join("");
  }
  renderAuxPills("staffAssignments", campSettings.staffAssignments || []);
  renderAuxPills("roomChoices", campSettings.roomChoices || []);
}

function renderAuxPills(group, values) {
  const host = document.getElementById(`settings-${group}`);
  if (!host) return;
  host.innerHTML = values
    .map(
      (v) => `
        <span class="setting-pill">
          ${escapeHtml(v)}
          <button type="button" data-action="remove-aux" data-group="${group}" data-value="${escapeHtml(v)}">×</button>
        </span>
      `
    )
    .join("");
}

async function loadCampSettings() {
  try {
    const data = await fetchJson("/api/camp-settings");
    campSettings = data.entry || campSettings;
    renderCamps();
  } catch (err) {
    campList.innerHTML = `<p class="empty">${escapeHtml(err.message)}</p>`;
  }
}

async function saveCampSettings(message = "Saved.") {
  try {
    const payload = {
      campNames: campSettings.campNames || [],
      locationNames: campSettings.locationNames || [],
      staffAssignments: campSettings.staffAssignments || [],
      roomChoices: campSettings.roomChoices || [],
      campLocations: campSettings.campLocations || {},
      campDetails: campSettings.campDetails || {},
    };
    const data = await fetchJson("/api/camp-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    campSettings = data.entry || campSettings;
    setStatus(campsStatus, message);
    renderCamps();
  } catch (err) {
    setStatus(campsStatus, err.message, true);
  }
}

function startCampEdit(name) {
  editingCampName = name;
  pendingContractPath = "";
  const detail = campSettings.campDetails?.[name] || {};
  const location = campSettings.campLocations?.[name] || "";
  campForm.elements.originalName.value = name;
  campForm.elements.campName.value = name;
  campForm.elements.campLocation.value = location;
  campForm.elements.price.value = detail.price || "";
  campForm.elements.contractFile.value = "";
  campContractCurrent.innerHTML = detail.contractPath
    ? `Current: <a href="${escapeHtml(detail.contractPath)}" target="_blank" rel="noreferrer">${escapeHtml(detail.contractPath.split("/").pop())}</a>`
    : "";
  campSubmitButton.textContent = "Update camp";
  campForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function uploadContract(file, campName) {
  const reader = new FileReader();
  return new Promise((resolve, reject) => {
    reader.onload = async () => {
      try {
        const result = await fetchJson("/api/camp-settings/contract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ campName, data: reader.result }),
        });
        resolve(result.path);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

campForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = (campForm.elements.campName.value || "").trim();
  if (!name) return;
  const originalName = (campForm.elements.originalName.value || "").trim();
  const location = (campForm.elements.campLocation.value || "").trim();
  const price = campForm.elements.price.value || "";
  const file = campForm.elements.contractFile.files?.[0];

  setStatus(campStatus, "Saving...");

  // Upload contract if a new file was chosen.
  let contractPath = campSettings.campDetails?.[originalName]?.contractPath || "";
  if (file) {
    try {
      contractPath = await uploadContract(file, name);
    } catch (err) {
      setStatus(campStatus, err.message, true);
      return;
    }
  }

  // Update local state — rename if name changed, otherwise patch in place.
  let names = [...(campSettings.campNames || [])];
  const locations = { ...(campSettings.campLocations || {}) };
  const details = { ...(campSettings.campDetails || {}) };

  if (originalName && originalName !== name) {
    names = names.map((n) => (n === originalName ? name : n));
    locations[name] = location;
    delete locations[originalName];
    details[name] = { price, contractPath };
    delete details[originalName];
  } else if (originalName) {
    if (!names.includes(name)) names.push(name);
    locations[name] = location;
    details[name] = { price, contractPath };
  } else {
    if (names.includes(name)) {
      setStatus(campStatus, "A camp with this name already exists.", true);
      return;
    }
    names.push(name);
    locations[name] = location;
    details[name] = { price, contractPath };
  }

  campSettings.campNames = names;
  campSettings.campLocations = locations;
  campSettings.campDetails = details;

  await saveCampSettings(originalName ? "Camp updated." : "Camp added.");
  setStatus(campStatus, "");
  resetCampForm();
});

campCancelButton?.addEventListener("click", () => resetCampForm());

campList?.addEventListener("click", async (event) => {
  const editBtn = event.target.closest('[data-action="edit-camp"]');
  const removeBtn = event.target.closest('[data-action="remove-camp"]');
  if (editBtn) {
    startCampEdit(editBtn.dataset.name);
    return;
  }
  if (removeBtn) {
    const name = removeBtn.dataset.name;
    if (!confirm(`Remove camp "${name}"?`)) return;
    campSettings.campNames = (campSettings.campNames || []).filter((n) => n !== name);
    if (campSettings.campLocations) delete campSettings.campLocations[name];
    if (campSettings.campDetails) delete campSettings.campDetails[name];
    await saveCampSettings("Camp removed.");
  }
});

// Aux groups (staff, rooms) — same pattern as old camp.js.
document.querySelectorAll("[data-aux-group]").forEach((formNode) => {
  formNode.addEventListener("submit", async (event) => {
    event.preventDefault();
    const group = formNode.dataset.auxGroup;
    const input = formNode.querySelector("input[name='value']");
    const value = (input?.value || "").trim();
    if (!value) return;
    const list = campSettings[group] || [];
    if (list.includes(value)) {
      setStatus(campsStatus, "Already in the list.", true);
      return;
    }
    campSettings[group] = [...list, value];
    input.value = "";
    await saveCampSettings("Added.");
  });
});

document.addEventListener("click", async (event) => {
  const btn = event.target.closest('[data-action="remove-aux"]');
  if (!btn) return;
  const group = btn.dataset.group;
  const value = btn.dataset.value;
  if (!confirm(`Remove "${value}"?`)) return;
  campSettings[group] = (campSettings[group] || []).filter((v) => v !== value);
  await saveCampSettings("Removed.");
});

// ── Init ─────────────────────────────────────────────────────────────
loadDestinations();
loadCampSettings();
