// /settings page controller — Destinations + Camps tabs.

const tabsBar = document.getElementById("settings-tabs");
const panels = document.querySelectorAll(".settings-panel");

const destinationForm = document.getElementById("destination-form");
const destinationInput = document.getElementById("destination-input");
const destinationList = document.getElementById("destination-list");
const destinationSearch = document.getElementById("destination-search");
const destinationCount = document.getElementById("destination-count");
const destinationsStatus = document.getElementById("destinations-status");

const campSearch = document.getElementById("camp-search");
const campStatusPills = document.getElementById("camp-status-pills");
const campCount = document.getElementById("camp-count");
let campFilter = "";

const campForm = document.getElementById("camp-form");
const campFormModal = document.getElementById("camp-form-modal");
const campFormTitle = document.getElementById("camp-form-title");
const campAddButton = document.getElementById("camp-add-button");
const campSubmitButton = document.getElementById("camp-submit-button");
const campCancelButton = document.getElementById("camp-cancel-button");
const campContractCurrent = document.getElementById("camp-contract-current");
const campList = document.getElementById("camp-list");
const campStatus = document.getElementById("camp-status");
const campsStatus = document.getElementById("camps-status");

function openCampModal() {
  if (!campFormModal) return;
  campFormModal.classList.remove("is-hidden");
  campFormModal.removeAttribute("hidden");
  document.body.classList.add("modal-open");
}
function closeCampModal() {
  if (!campFormModal) return;
  campFormModal.classList.add("is-hidden");
  campFormModal.setAttribute("hidden", "");
  document.body.classList.remove("modal-open");
}

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
  const query = (destinationSearch?.value || "").trim().toLowerCase();
  const filtered = query
    ? destinations.filter((n) => n.toLowerCase().includes(query))
    : destinations;

  if (destinationCount) {
    destinationCount.textContent = query
      ? `${filtered.length} of ${destinations.length}`
      : `${destinations.length} destination${destinations.length === 1 ? "" : "s"}`;
  }

  if (!destinations.length) {
    destinationList.innerHTML = '<p class="empty">No destinations yet — add one above.</p>';
    return;
  }
  if (!filtered.length) {
    destinationList.innerHTML = '<p class="empty">No destinations match your search.</p>';
    return;
  }
  destinationList.innerHTML = filtered
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

destinationSearch?.addEventListener("input", renderDestinations);

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
  if (campFormTitle) campFormTitle.textContent = "Add camp";
  setStatus(campStatus, "");
}

function renderCamps() {
  const names = campSettings.campNames || [];
  const query = (campSearch?.value || "").trim().toLowerCase();

  const filtered = names.filter((name) => {
    const location = campSettings.campLocations?.[name] || "";
    const detail = campSettings.campDetails?.[name] || {};
    const hasPrice = !!(detail.price && detail.price.trim());
    const hasContract = !!(detail.contractPath && detail.contractPath.trim());

    if (query) {
      const hay = (name + " " + location).toLowerCase();
      if (!hay.includes(query)) return false;
    }
    if (campFilter === "has-price" && !hasPrice) return false;
    if (campFilter === "has-contract" && !hasContract) return false;
    if (campFilter === "missing-price" && hasPrice) return false;
    if (campFilter === "missing-contract" && hasContract) return false;
    return true;
  });

  if (campCount) {
    campCount.textContent = (query || campFilter)
      ? `${filtered.length} of ${names.length}`
      : `${names.length} camp${names.length === 1 ? "" : "s"}`;
  }

  if (!names.length) {
    campList.innerHTML = '<p class="empty">No camps yet — click "+ Add camp" above.</p>';
  } else if (!filtered.length) {
    campList.innerHTML = '<p class="empty">No camps match these filters.</p>';
  } else {
    campList.innerHTML = filtered
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
  renderAuxPills("transferPickups", campSettings.transferPickups || []);
  renderAuxPills("transferDropoffs", campSettings.transferDropoffs || []);
  renderTransferDrivers(campSettings.transferDrivers || []);
}

function renderTransferDrivers(drivers) {
  const host = document.getElementById("settings-transferDrivers");
  if (!host) return;
  if (!drivers.length) {
    host.innerHTML = '<p class="empty">No drivers yet. Add one above.</p>';
    return;
  }
  host.innerHTML = drivers.map((d) => `
    <div class="driver-setting-row">
      <span class="driver-setting-name">${escapeHtml(d.name)}</span>
      <span>${escapeHtml(d.carType || "—")}</span>
      <span>${escapeHtml(d.plateNumber || "—")}</span>
      <span>${escapeHtml(d.phoneNumber || "—")}</span>
      <span>${d.salary ? Number(d.salary).toLocaleString() + " ₮" : "—"}</span>
      <button type="button" class="ts-view-close" data-action="remove-driver" data-driver-id="${escapeHtml(d.id)}" aria-label="Remove driver">×</button>
    </div>
  `).join("");
}

const transferDriverForm = document.getElementById("transfer-driver-form");
transferDriverForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const f = transferDriverForm;
  const name = (f.elements.name?.value || "").trim();
  if (!name) return;
  const driver = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random(),
    name,
    carType: (f.elements.carType?.value || "").trim(),
    plateNumber: (f.elements.plateNumber?.value || "").trim(),
    phoneNumber: (f.elements.phoneNumber?.value || "").trim(),
    salary: parseInt(f.elements.salary?.value || "0", 10) || 0,
  };
  campSettings.transferDrivers = [...(campSettings.transferDrivers || []), driver];
  f.reset();
  await saveCampSettings("Driver added.");
});

document.addEventListener("click", async (event) => {
  const btn = event.target.closest('[data-action="remove-driver"]');
  if (!btn) return;
  if (!confirm("Remove this driver?")) return;
  const id = btn.dataset.driverId;
  campSettings.transferDrivers = (campSettings.transferDrivers || []).filter((d) => d.id !== id);
  await saveCampSettings("Driver removed.");
});

campSearch?.addEventListener("input", renderCamps);
campStatusPills?.addEventListener("click", (event) => {
  const pill = event.target.closest(".invoices-status-pill");
  if (!pill) return;
  const value = pill.dataset.campFilter;
  campFilter = campFilter === value ? "" : value;
  campStatusPills.querySelectorAll(".invoices-status-pill").forEach((b) => {
    b.classList.toggle("is-active", b.dataset.campFilter === campFilter);
  });
  renderCamps();
});

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
      transferPickups: campSettings.transferPickups || [],
      transferDropoffs: campSettings.transferDropoffs || [],
      transferDrivers: campSettings.transferDrivers || [],
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
  if (campFormTitle) campFormTitle.textContent = `Edit ${name}`;
  openCampModal();
}

async function uploadContract(file, campName) {
  // Compress images client-side; PDFs/DOCs go through unchanged.
  const dataUrl = (file.type && file.type.startsWith("image/") && window.CompressUpload)
    ? await window.CompressUpload.image(file)
    : await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Could not read file"));
        reader.readAsDataURL(file);
      });
  const result = await fetchJson("/api/camp-settings/contract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ campName, data: dataUrl }),
  });
  return result.path;
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
  closeCampModal();
});

campAddButton?.addEventListener("click", () => {
  resetCampForm();
  openCampModal();
});
campCancelButton?.addEventListener("click", () => {
  resetCampForm();
  closeCampModal();
});
campFormModal?.addEventListener("click", (event) => {
  if (event.target?.dataset?.action === "close-camp-form") {
    resetCampForm();
    closeCampModal();
  }
});

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

// ── Bank accounts ────────────────────────────────────────────────────
const bankList = document.getElementById("bank-list");
const bankStatus = document.getElementById("bank-status");
const bankAddButton = document.getElementById("bank-add-button");
const bankFormModal = document.getElementById("bank-form-modal");
const bankForm = document.getElementById("bank-form");
const bankFormTitle = document.getElementById("bank-form-title");
const bankFormStatus = document.getElementById("bank-form-status");
const bankCancelButton = document.getElementById("bank-cancel-button");
let bankAccounts = [];

function renderBankAccounts() {
  if (!bankList) return;
  if (!bankAccounts.length) {
    bankList.innerHTML = '<p class="empty">No bank accounts yet. Add one to use it on the invoice email step.</p>';
    return;
  }
  bankList.innerHTML = bankAccounts.map((b) => `
    <div class="settings-camp-card">
      <div class="settings-camp-card-head">
        <strong>${escapeHtml(b.label || b.bankName || "(unnamed)")}</strong>
        <span class="settings-camp-location">${escapeHtml(b.currency || "MNT")}</span>
      </div>
      <div class="settings-camp-card-body">
        <p><strong>${escapeHtml(b.bankName || "")}</strong>${b.accountName ? " · " + escapeHtml(b.accountName) : ""}</p>
        ${b.accountNumber ? `<p>Acct: ${escapeHtml(b.accountNumber)}</p>` : ""}
        ${b.swift ? `<p>SWIFT: ${escapeHtml(b.swift)}</p>` : ""}
        ${b.notes ? `<p class="muted">${escapeHtml(b.notes)}</p>` : ""}
      </div>
      <div class="settings-camp-card-actions">
        <button type="button" data-bank-edit="${escapeHtml(b.id)}">Edit</button>
        <button type="button" data-bank-delete="${escapeHtml(b.id)}" class="button-secondary">Delete</button>
      </div>
    </div>
  `).join("");
}

function openBankForm(account) {
  if (!bankFormModal || !bankForm) return;
  bankForm.reset();
  bankForm.elements.id.value = account?.id || "";
  bankForm.elements.label.value = account?.label || "";
  bankForm.elements.bankName.value = account?.bankName || "";
  bankForm.elements.accountName.value = account?.accountName || "";
  bankForm.elements.accountNumber.value = account?.accountNumber || "";
  bankForm.elements.currency.value = account?.currency || "MNT";
  bankForm.elements.swift.value = account?.swift || "";
  bankForm.elements.notes.value = account?.notes || "";
  if (bankFormTitle) bankFormTitle.textContent = account ? "Edit bank account" : "Add bank account";
  if (bankFormStatus) bankFormStatus.textContent = "";
  bankFormModal.classList.remove("is-hidden");
  bankFormModal.removeAttribute("hidden");
}
function closeBankForm() {
  if (!bankFormModal) return;
  bankFormModal.classList.add("is-hidden");
  bankFormModal.setAttribute("hidden", "");
}

async function saveBankAccounts(message) {
  try {
    await fetchJson("/api/settings/bank-accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bankAccounts }),
    });
    if (bankStatus) bankStatus.textContent = message || "Saved.";
    renderBankAccounts();
  } catch (err) {
    if (bankStatus) bankStatus.textContent = err.message || "Could not save.";
  }
}

async function loadBankAccounts() {
  try {
    const res = await fetch("/api/settings");
    if (!res.ok) return;
    const data = await res.json();
    bankAccounts = (data.entry?.bankAccounts) || [];
    renderBankAccounts();
  } catch {}
}

bankAddButton?.addEventListener("click", () => openBankForm(null));
bankCancelButton?.addEventListener("click", closeBankForm);
bankFormModal?.addEventListener("click", (e) => {
  if (e.target?.dataset?.action === "close-bank-form") closeBankForm();
});
bankForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = bankForm.elements;
  const record = {
    id: f.id.value || undefined,
    label: f.label.value.trim(),
    bankName: f.bankName.value.trim(),
    accountName: f.accountName.value.trim(),
    accountNumber: f.accountNumber.value.trim(),
    currency: f.currency.value,
    swift: f.swift.value.trim(),
    notes: f.notes.value.trim(),
  };
  if (!record.label && !record.bankName) {
    if (bankFormStatus) bankFormStatus.textContent = "Label or bank name is required.";
    return;
  }
  if (record.id) {
    bankAccounts = bankAccounts.map((b) => (b.id === record.id ? { ...b, ...record } : b));
  } else {
    record.id = `bank_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    bankAccounts = [record, ...bankAccounts];
  }
  closeBankForm();
  await saveBankAccounts(record.id && bankAccounts.find((b) => b.id === record.id && b !== bankAccounts[0]) ? "Updated." : "Added.");
});

bankList?.addEventListener("click", async (e) => {
  const editBtn = e.target.closest("[data-bank-edit]");
  if (editBtn) {
    const acct = bankAccounts.find((b) => b.id === editBtn.dataset.bankEdit);
    if (acct) openBankForm(acct);
    return;
  }
  const delBtn = e.target.closest("[data-bank-delete]");
  if (delBtn) {
    const acct = bankAccounts.find((b) => b.id === delBtn.dataset.bankDelete);
    if (!acct) return;
    if (!confirm(`Remove "${acct.label || acct.bankName}"?`)) return;
    bankAccounts = bankAccounts.filter((b) => b.id !== acct.id);
    await saveBankAccounts("Removed.");
  }
});

// ── Init ─────────────────────────────────────────────────────────────
loadDestinations();
loadCampSettings();
loadBankAccounts();
