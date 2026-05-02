const CONTRACTS_ENDPOINT = "/api/contracts";
const CONTRACTS_POLL_INTERVAL_MS = 10000;
const CONTRACTS_PAGE_SIZE = 20;
let contractsPollHandle = null;
let latestContractsSignature = "";
let allContracts = [];
let contractsCurrentPage = 1;
let editingContractId = null;

const qs = (selector, root = document) => root.querySelector(selector);
const qsa = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const contractsFormatDate = (value) => {
  if (!value) return "-";
  return value.split("T")[0];
};

const parseDate = (value) => {
  if (!value) return null;
  const parts = value.split("-");
  if (parts.length !== 3) return null;
  const [year, month, day] = parts.map(Number);
  if (!year || !month || !day) return null;
  return new Date(Date.UTC(year, month - 1, day));
};

// Best-effort Latin → Cyrillic transliteration for tourist names, passport
// register numbers, and destinations on the contract form. Tourists are stored
// in CAPS Latin (e.g. "BATBAYAR SUKHBAYAR", "UK91101311") but contracts are
// always rendered in Mongolian Cyrillic. The mapping is lossy (u → у only,
// not ү/ө) so admins may need to tweak diacritics by hand.
const CYR_DIGRAPHS = [
  ["shch", "щ"], ["sch", "щ"],
  ["kh", "х"], ["ch", "ч"], ["sh", "ш"], ["ts", "ц"],
  ["yo", "ё"], ["ye", "е"], ["ya", "я"], ["yu", "ю"],
];
const CYR_SINGLES = {
  a: "а", b: "б", v: "в", g: "г", d: "д", e: "е",
  j: "ж", z: "з", i: "и", y: "й", k: "к", l: "л",
  m: "м", n: "н", o: "о", p: "п", r: "р", s: "с",
  t: "т", u: "у", f: "ф", h: "х", c: "ц", q: "к",
  w: "в", x: "х",
};
const DESTINATION_DICT = {
  singapore: "Сингапур", thailand: "Тайланд", bangkok: "Бангкок",
  vietnam: "Вьетнам", japan: "Япон", tokyo: "Токио", osaka: "Осака",
  korea: "Солонгос", "south korea": "Өмнөд Солонгос", seoul: "Сөүл",
  china: "Хятад", beijing: "Бээжин", shanghai: "Шанхай",
  "hong kong": "Хонг Конг", taiwan: "Тайвань", taipei: "Тайбэй",
  malaysia: "Малайз", "kuala lumpur": "Куала Лумпур",
  indonesia: "Индонез", bali: "Бали", philippines: "Филиппин",
  india: "Энэтхэг", "sri lanka": "Шри Ланка", maldives: "Мальдив",
  dubai: "Дубай", uae: "АНЭУ", turkey: "Турк", istanbul: "Истанбул",
  russia: "Орос", moscow: "Москва", germany: "Герман", france: "Франц",
  paris: "Парис", italy: "Итали", spain: "Испани", uk: "Их Британи",
  london: "Лондон", usa: "АНУ", "new york": "Нью Йорк",
  australia: "Австрали", canada: "Канад", mongolia: "Монгол",
};

const latinToCyrillic = (input) => {
  if (!input) return "";
  const s = String(input).toLowerCase();
  let out = "";
  let i = 0;
  while (i < s.length) {
    let matched = false;
    for (const [from, to] of CYR_DIGRAPHS) {
      if (s.substr(i, from.length) === from) {
        out += to;
        i += from.length;
        matched = true;
        break;
      }
    }
    if (matched) continue;
    const c = s[i];
    out += CYR_SINGLES[c] !== undefined ? CYR_SINGLES[c] : c;
    i += 1;
  }
  return out;
};

const titleCaseCyrillic = (s) => {
  return String(s || "")
    .split(/(\s+|-)/)
    .map((w) => (w && /\S/.test(w) ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join("");
};

const transliterateName = (s) => titleCaseCyrillic(latinToCyrillic(s));
const transliterateRegister = (s) => latinToCyrillic(s).toUpperCase();
const transliterateDestination = (s) => {
  const key = String(s || "").trim().toLowerCase();
  if (!key) return "";
  if (DESTINATION_DICT[key]) return DESTINATION_DICT[key];
  return titleCaseCyrillic(latinToCyrillic(key));
};

const formatDuration = (startValue, endValue) => {
  const start = parseDate(startValue);
  const end = parseDate(endValue);
  if (!start || !end) return "";
  const diffDays = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
  if (diffDays <= 0) return "";
  const nights = Math.max(diffDays - 1, 0);
  return `${diffDays} өдөр ${nights} шөнө`;
};

const normalizeNumber = (value) => {
  const raw = String(value || "").replace(/[^0-9.-]/g, "");
  return Number(raw || 0);
};

const normalizeTextValue = (value) => String(value ?? "").trim();

const apiRequest = async (url, options = {}) => {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...options,
  });
  const responseClone = response.clone();
  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }
  if (!response.ok) {
    let message = data?.error;
    if (!message) {
      try {
        const text = await responseClone.text();
        if (text) {
          if (/<html/i.test(text) || /<!DOCTYPE html/i.test(text)) {
            if (response.status >= 500) {
              message = "Server error while saving the contract. Please try again.";
            } else {
              message = "Unexpected server response. Please refresh and try again.";
            }
          } else {
            message = text;
          }
        }
      } catch {}
    }
    if (!message) message = "Request failed";
    throw new Error(message);
  }
  return data;
};

const getCreatorName = (entry) =>
  normalizeTextValue(entry?.createdBy?.name || entry?.updatedBy?.name || "");

const getFilteredContracts = () => {
  const manager = normalizeTextValue(qs("#contract-filter-manager")?.value || "");
  const destination = normalizeTextValue(qs("#contract-filter-destination")?.value || "").toLowerCase();
  const dateFrom = normalizeTextValue(qs("#contract-filter-date-from")?.value || "");
  const dateTo = normalizeTextValue(qs("#contract-filter-date-to")?.value || "");

  return allContracts.filter((entry) => {
    const data = entry.data || {};
    const createdBy = getCreatorName(entry);
    if (manager && createdBy !== manager) return false;
    if (destination && !String(data.destination || "").toLowerCase().includes(destination)) return false;
    const contractDate = normalizeTextValue(data.contractDate || "");
    if (dateFrom && contractDate && contractDate < dateFrom) return false;
    if (dateTo && contractDate && contractDate > dateTo) return false;
    return true;
  });
};

const renderPagination = (contracts) => {
  const container = qs("#contract-pagination");
  if (!container) return;
  const totalPages = Math.max(1, Math.ceil(contracts.length / CONTRACTS_PAGE_SIZE));
  if (contractsCurrentPage > totalPages) contractsCurrentPage = totalPages;
  if (totalPages <= 1) {
    container.innerHTML = "";
    return;
  }

  const buttons = [];
  for (let page = 1; page <= totalPages; page += 1) {
    buttons.push(
      `<button type="button" class="secondary-button ${page === contractsCurrentPage ? "is-active" : ""}" data-contract-page="${page}">${page}</button>`
    );
  }
  container.innerHTML = buttons.join("");
  qsa("[data-contract-page]", container).forEach((button) => {
    button.addEventListener("click", () => {
      contractsCurrentPage = Number(button.dataset.contractPage || "1");
      renderContractsView();
    });
  });
};

const renderContractsTable = (contracts) => {
  const container = qs("#contract-list");
  if (!container) return;

  if (!contracts.length) {
    container.innerHTML = `<div class="empty-state">No contracts yet.</div>`;
    return;
  }

  container.innerHTML = `
    <div class="table-scroll">
      <table class="contract-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Serial</th>
            <th>Last name</th>
            <th>First name</th>
            <th>Manager</th>
            <th>Destination</th>
            <th>Starting Date</th>
            <th>Status</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${contracts
            .map((entry, index) => {
              const data = entry.data || {};
              const lastName = data.touristLastName || "";
              const firstName = data.touristFirstName || "";
              const creatorName = getCreatorName(entry);
              const status = entry.status || "pending";
              const statusLabel = status === "signed" ? "Signed" : "Pending";
              const statusClass = status === "signed" ? "status-confirmed" : "status-pending";
              const pdfReady = entry.pdfPath && entry.pdfPath.endsWith(".pdf");
              const shareLink = `${location.origin}/contract/${entry.id}`;
              const signed = status === "signed";
              const pdfHref = pdfReady
                ? '/pdf-viewer?src=' + encodeURIComponent('/api/contracts/' + entry.id + '/document?mode=download') + '&title=' + encodeURIComponent(data.contractSerial || 'Contract')
                : '';
              const pdfButton = pdfReady
                ? `<a class="secondary-button ${signed ? "success-button" : ""}" href="${pdfHref}" target="_blank" rel="noreferrer">${signed ? "Signed PDF" : "PDF"}</a>`
                : `<span class="muted">PDF pending</span>`;
              return `
                <tr>
                  <td>${(contractsCurrentPage - 1) * CONTRACTS_PAGE_SIZE + index + 1}</td>
                  <td>${data.contractSerial || "-"}</td>
                  <td>${lastName || "-"}</td>
                  <td>${firstName || "-"}</td>
                  <td>${creatorName || "-"}</td>
                  <td>${data.destination || "-"}</td>
                  <td>${contractsFormatDate(data.tripStartDate || data.contractDate)}</td>
                  <td><span class="status-pill ${statusClass}">${statusLabel}</span></td>
                  <td>${contractsFormatDate(entry.createdAt)}</td>
                  <td>
                    <div class="contract-actions">
                      ${pdfButton}
                      <a class="secondary-button" href="/api/contracts/${entry.id}/invoice?mode=view" target="_blank">Invoice</a>
                      <details class="trip-menu trip-page-menu">
                        <summary class="trip-menu-trigger" aria-label="Contract actions">⋯</summary>
                        <div class="trip-menu-popover">
                          <a class="trip-menu-item" href="/api/contracts/${entry.id}/document?mode=view" target="_blank">View</a>
                          <button type="button" class="trip-menu-item" data-edit-id="${entry.id}" ${signed ? "disabled" : ""}>Edit</button>
                          <a class="trip-menu-item" href="${entry.docxPath}" download>Word</a>
                          <button type="button" class="trip-menu-item" data-copy-link="${shareLink}">Copy link</button>
                          <button type="button" class="trip-menu-item is-danger" data-delete-id="${entry.id}">Delete</button>
                        </div>
                      </details>
                    </div>
                  </td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    </div>
  `;

  qsa("[data-copy-link]", container).forEach((button) => {
    button.addEventListener("click", async () => {
      await navigator.clipboard.writeText(button.dataset.copyLink);
      button.textContent = "Copied";
      setTimeout(() => (button.textContent = "Copy link"), 1500);
    });
  });

  qsa("[data-delete-id]", container).forEach((button) => {
    button.addEventListener("click", async () => {
      if (!(await UI.confirm("Delete this contract?", { dangerous: true }))) return;
      await apiRequest(`${CONTRACTS_ENDPOINT}/${button.dataset.deleteId}`, { method: "DELETE" });
      loadContracts();
    });
  });

  qsa("[data-edit-id]", container).forEach((button) => {
    button.addEventListener("click", () => {
      const contract = allContracts.find((entry) => entry.id === button.dataset.editId);
      if (!contract || contract.status === "signed") return;
      window.openContractEditor?.(contract);
    });
  });
};

const getContractsSignature = (contracts) =>
  JSON.stringify(
    (contracts || []).map((entry) => ({
      id: entry.id,
      updatedAt: entry.updatedAt || "",
      signedAt: entry.signedAt || "",
      status: entry.status || "",
      pdfPath: entry.pdfPath || "",
    }))
  );

const loadContracts = async ({ silent = false } = {}) => {
  try {
    const data = await apiRequest(CONTRACTS_ENDPOINT);
    const contracts = Array.isArray(data) ? data : data.contracts || data.entries || [];
    const nextSignature = getContractsSignature(contracts);
    if (silent && nextSignature === latestContractsSignature) {
      return;
    }
    latestContractsSignature = nextSignature;
    allContracts = contracts;
    refreshManagerFilterOptions();
    renderContractsView();
  } catch (error) {
    if (silent) return;
    const container = qs("#contract-list");
    if (container) {
      container.innerHTML = `<div class="empty-state">Failed to load contracts: ${error.message}</div>`;
    }
  }
};

const renderContractsView = () => {
  const filteredContracts = getFilteredContracts();
  const start = (contractsCurrentPage - 1) * CONTRACTS_PAGE_SIZE;
  const pageContracts = filteredContracts.slice(start, start + CONTRACTS_PAGE_SIZE);
  renderContractsTable(pageContracts);
  renderPagination(filteredContracts);
};

const refreshManagerFilterOptions = () => {
  const select = qs("#contract-filter-manager");
  if (!select) return;
  const currentValue = select.value;
  const names = Array.from(new Set(allContracts.map((entry) => getCreatorName(entry)).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  select.innerHTML = `<option value="">Бүгд</option>${names.map((name) => `<option value="${name}">${name}</option>`).join("")}`;
  select.value = names.includes(currentValue) ? currentValue : "";
};

const startContractsLiveRefresh = () => {
  if (contractsPollHandle || location.pathname !== "/contracts") return;

  contractsPollHandle = window.setInterval(() => {
    if (document.hidden) return;
    loadContracts({ silent: true });
  }, CONTRACTS_POLL_INTERVAL_MS);

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      loadContracts({ silent: true });
    }
  });

  window.addEventListener("focus", () => {
    loadContracts({ silent: true });
  });
};

// Lazy-load the contract modal markup on pages that don't ship it inline
// (group, trip-detail, etc.). Single source of truth = /contracts page HTML.
async function ensureContractModalInDOM() {
  if (document.getElementById("contract-form-panel")) return;
  const html = await fetch("/contracts", { credentials: "include" }).then((r) => r.text());
  const tmpl = document.createElement("template");
  tmpl.innerHTML = html;
  const panel = tmpl.content.querySelector("#contract-form-panel");
  if (panel) document.body.appendChild(panel);
  // initContractForm bails if these aren't present — provide hidden stand-ins so
  // it can wire up the same modal on any page.
  const stub = (id) => {
    if (document.getElementById(id)) return;
    const el = document.createElement("button");
    el.id = id;
    el.type = "button";
    el.style.display = "none";
    document.body.appendChild(el);
  };
  stub("contract-toggle-form");
}

const initContractForm = () => {
  const panel = qs("#contract-form-panel");
  const toggle = qs("#contract-toggle-form");
  const countSetup = qs("#contract-count-setup");
  const continueButton = qs("#contract-continue-button");
  const form = qs("#contract-form");
  const statusEl = qs("#contract-status");
  const managerSelect = qs("#manager-select");
  const managerLastInput = form.querySelector("input[name='managerLastName']");
  const managerFirstInput = form.querySelector("input[name='managerFirstName']");
  const managerEmailInput = form.querySelector("input[name='managerEmail']");
  const managerPhoneInput = form.querySelector("input[name='managerPhone']");
  const managerSignatureInput = form.querySelector("input[name='managerSignaturePath']");
  const formTitle = panel.querySelector(".camp-modal-header h2");
  const formSubmitButton = form.querySelector("button[type='submit']");

  if (!panel || !toggle || !countSetup || !continueButton || !form) return;

  if (panel.parentElement !== document.body) {
    document.body.appendChild(panel);
  }

  const setSectionHidden = (element, hidden) => {
    if (!element) return;
    element.classList.toggle("is-hidden", hidden);
    if (hidden) {
      element.setAttribute("hidden", "");
    } else {
      element.removeAttribute("hidden");
    }
  };

  const openStepOne = () => {
    setSectionHidden(countSetup, false);
    setSectionHidden(form, true);
  };

  const openStepTwo = () => {
    setSectionHidden(countSetup, true);
    setSectionHidden(form, false);
  };

  const closePanel = () => {
    panel.classList.add("is-hidden");
    panel.setAttribute("hidden", "");
    document.body.classList.remove("modal-open");
    editingContractId = null;
    if (formTitle) formTitle.textContent = "Contract details";
    if (formSubmitButton) formSubmitButton.textContent = "Save contract";
    openStepOne();
  };

  toggle.addEventListener("click", () => {
    panel.classList.remove("is-hidden");
    panel.removeAttribute("hidden");
    document.body.classList.add("modal-open");
    const dateInput = form.querySelector("input[name='contractDate']");
    if (dateInput && !dateInput.value) {
      dateInput.value = new Date().toISOString().split("T")[0];
    }
    updateDepositDueDate();
    openStepOne();
  });

  // Auto-launch the form when ?openCreate=1 is in the URL (used by + Add contract from trip/group pages).
  // Stash tripId/groupId as hidden fields so the submit handler attaches them to the saved contract.
  (function autoLaunchFromUrl() {
    const params = new URLSearchParams(window.location.search);
    if (!params.get("openCreate")) return;
    const tripId = params.get("tripId") || "";
    const groupId = params.get("groupId") || "";
    if (tripId || groupId) {
      let tripField = form.querySelector("input[name='attachedTripId']");
      if (!tripField) {
        tripField = document.createElement("input");
        tripField.type = "hidden";
        tripField.name = "attachedTripId";
        form.appendChild(tripField);
      }
      tripField.value = tripId;
      let groupField = form.querySelector("input[name='attachedGroupId']");
      if (!groupField) {
        groupField = document.createElement("input");
        groupField.type = "hidden";
        groupField.name = "attachedGroupId";
        form.appendChild(groupField);
      }
      groupField.value = groupId;
    }
    // Open the form modal automatically
    setTimeout(() => toggle.click(), 50);
  })();

  panel.addEventListener("click", (event) => {
    if (event.target.dataset.action === "close-contract-panel") closePanel();
    if (event.target.dataset.action === "contract-continue") {
      syncCountStepToForm();
      openStepTwo();
      window.requestAnimationFrame(() => {
        form.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  });

  qsa(".camp-modal-close", panel).forEach((button) => {
    button.addEventListener("click", closePanel);
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    statusEl.textContent = "Saving...";
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());
    try {
      const targetUrl = editingContractId ? `${CONTRACTS_ENDPOINT}/${editingContractId}` : CONTRACTS_ENDPOINT;
      const method = editingContractId ? "POST" : "POST";
      await apiRequest(targetUrl, { method, body: JSON.stringify(payload) });
      statusEl.textContent = editingContractId ? "Updated successfully" : "Saved successfully";
      form.reset();
      closePanel();
      // Per-page success hook (set by openContractModal). Falls back to the
      // /contracts page list refresh.
      if (typeof window.__contractOnSuccess === "function") {
        try { window.__contractOnSuccess(); } catch {}
      } else if (location.pathname === "/contracts") {
        loadContracts();
      }
      setTimeout(() => (statusEl.textContent = ""), 2000);
    } catch (error) {
      statusEl.textContent = error.message;
    }
  });

  // ---- public openContractModal API (called from group.js / trip pages) ----
  // Keeps the heavy form-handling logic here in contracts.js; other pages just
  // pass in the tripId/groupId, prefill values, and tourist list.
  const setHiddenFormField = (name, value) => {
    let f = form.querySelector(`input[name='${name}']`);
    if (!f) {
      f = document.createElement("input");
      f.type = "hidden";
      f.name = name;
      form.appendChild(f);
    }
    f.value = value || "";
  };

  const setupTouristPicker = (tourists, defaultId) => {
    const lastInput = form.querySelector("input[name='touristLastName']");
    const firstInput = form.querySelector("input[name='touristFirstName']");
    const regInput = form.querySelector("input[name='touristRegister']");
    let pickerLabel = form.querySelector("label[data-tourist-picker]");
    if (!pickerLabel) {
      pickerLabel = document.createElement("label");
      pickerLabel.setAttribute("data-tourist-picker", "");
      pickerLabel.innerHTML = `Жуулчин сонгох<select name="touristPicker"><option value="">Сонгох...</option></select>`;
      const anchor = lastInput?.closest("label");
      if (anchor && anchor.parentElement) {
        anchor.parentElement.insertBefore(pickerLabel, anchor);
      } else {
        form.prepend(pickerLabel);
      }
    }
    const picker = pickerLabel.querySelector("select");
    const escape = (s) => String(s || "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
    picker.innerHTML = `<option value="">Сонгох...</option>` + tourists.map((t) => {
      const last = t.lastName || "";
      const first = t.firstName || "";
      const reg = t.registrationNumber || t.register || t.registerNumber || "";
      return `<option value="${escape(t.id)}" data-last="${escape(last)}" data-first="${escape(first)}" data-register="${escape(reg)}">${escape(`${last} ${first}`.trim() || t.id)}</option>`;
    }).join("");
    picker.onchange = () => {
      const opt = picker.selectedOptions[0];
      if (!opt || !opt.value) return;
      if (lastInput) lastInput.value = transliterateName(opt.dataset.last || "");
      if (firstInput) firstInput.value = transliterateName(opt.dataset.first || "");
      if (regInput) regInput.value = transliterateRegister(opt.dataset.register || "");
    };
    if (defaultId && [...picker.options].some((o) => o.value === defaultId)) {
      picker.value = defaultId;
      picker.dispatchEvent(new Event("change"));
    }
  };

  window.__openContractModalInternal = (opts = {}) => {
    setHiddenFormField("attachedTripId", opts.tripId);
    setHiddenFormField("attachedGroupId", opts.groupId);
    window.__contractOnSuccess = typeof opts.onSuccess === "function" ? opts.onSuccess : null;
    if (Array.isArray(opts.tourists) && opts.tourists.length) {
      setupTouristPicker(opts.tourists, opts.defaultTouristId);
    }
    const prefill = opts.prefill || {};
    Object.entries(prefill).forEach(([name, value]) => {
      if (value === null || value === undefined || value === "") return;
      let v = value;
      if (name === "destination") v = transliterateDestination(value);
      const input = form.querySelector(`[name="${name}"]`);
      if (input) input.value = v;
    });
    // Pre-fill the step-1 setup count (Том хүний тоо) so admins don't retype it.
    if (prefill.adultCount != null) {
      const setupAdult = countSetup.querySelector("input[name='setupAdultCount']");
      if (setupAdult) setupAdult.value = String(prefill.adultCount);
    }
    if (prefill.childCount != null) {
      const setupChild = countSetup.querySelector("input[name='setupChildCount']");
      if (setupChild) setupChild.value = String(prefill.childCount);
    }
    // Trigger trip-date listeners so tripDuration ("8 өдөр 7 шөнө") and
    // related fields auto-fill from the dates we just wrote.
    const startInput = form.querySelector("input[name='tripStartDate']");
    const endInput = form.querySelector("input[name='tripEndDate']");
    if (startInput?.value) startInput.dispatchEvent(new Event("change"));
    if (endInput?.value) endInput.dispatchEvent(new Event("change"));
    toggle.click();
  };

  // Ensure the panel is hidden on first load even if browser caches styles.
  closePanel();

  const loadManagers = async () => {
    if (!managerSelect) return;
    try {
      const data = await apiRequest("/api/team-members");
      const entries = Array.isArray(data?.entries) ? data.entries : [];
      managerSelect.removeAttribute("disabled");
      managerSelect.innerHTML =
        `<option value="">Менежер сонгох</option>` +
        entries
          .map((entry) => {
            const label = normalizeTextValue(entry.fullName || entry.email || "");
            const lastName = normalizeTextValue(entry.contractLastName || "");
            const firstName = normalizeTextValue(entry.contractFirstName || "");
            const contractEmail = normalizeTextValue(entry.contractEmail || "");
            const contractPhone = normalizeTextValue(entry.contractPhone || "");
            const contractSignaturePath = normalizeTextValue(entry.contractSignaturePath || "");
            return `<option value="${label}" data-last-name="${lastName}" data-first-name="${firstName}" data-email="${contractEmail}" data-phone="${contractPhone}" data-signature-path="${contractSignaturePath}">${label}</option>`;
          })
          .join("");
      if (entries.length === 1) {
        managerSelect.selectedIndex = 1;
        managerSelect.dispatchEvent(new Event("change"));
      }
    } catch {}
  };

  managerSelect?.addEventListener("change", () => {
    const selectedOption = managerSelect.options[managerSelect.selectedIndex];
    const value = managerSelect.value || "";
    const contractLastName = normalizeTextValue(selectedOption?.dataset.lastName || "");
    const contractFirstName = normalizeTextValue(selectedOption?.dataset.firstName || "");
    const contractEmail = normalizeTextValue(selectedOption?.dataset.email || "");
    const contractPhone = normalizeTextValue(selectedOption?.dataset.phone || "");
    const contractSignaturePath = normalizeTextValue(selectedOption?.dataset.signaturePath || "");
    if (!value) {
      if (managerLastInput) managerLastInput.value = "";
      if (managerFirstInput) managerFirstInput.value = "";
      if (managerEmailInput) managerEmailInput.value = "";
      if (managerPhoneInput) managerPhoneInput.value = "";
      if (managerSignatureInput) managerSignatureInput.value = "";
      return;
    }
    if (managerEmailInput) managerEmailInput.value = contractEmail;
    if (managerPhoneInput) managerPhoneInput.value = contractPhone;
    if (managerSignatureInput) managerSignatureInput.value = contractSignaturePath;
    if (contractLastName || contractFirstName) {
      if (managerLastInput) managerLastInput.value = contractLastName;
      if (managerFirstInput) managerFirstInput.value = contractFirstName;
      return;
    }
    const parts = value.trim().split(/\s+/);
    if (parts.length === 1) {
      if (managerLastInput) managerLastInput.value = parts[0];
      if (managerFirstInput) managerFirstInput.value = parts[0];
    } else {
      if (managerLastInput) managerLastInput.value = parts[0];
      if (managerFirstInput) managerFirstInput.value = parts.slice(1).join(" ");
    }
  });

  const tripStartInput = form.querySelector("input[name='tripStartDate']");
  const tripEndInput = form.querySelector("input[name='tripEndDate']");
  const contractDateInput = form.querySelector("input[name='contractDate']");
  const durationInput = form.querySelector("input[name='tripDuration']");
  const travelerInput = form.querySelector("input[name='travelerCount']");
  const totalPriceInput = form.querySelector("input[name='totalPrice']");
  const depositPercentageInput = form.querySelector("select[name='depositPercentage']");
  const depositAmountInput = form.querySelector("input[name='depositAmount']");
  const balanceAmountDisplayInput = form.querySelector("input[name='balanceAmountDisplay']");
  const depositDueDateInput = form.querySelector("input[name='depositDueDate']");
  const balanceDuePresetInput = form.querySelector("select[name='balanceDuePreset']");
  const balanceDueDateInput = form.querySelector("input[name='balanceDueDate']");
  const countInputs = {
    adult: form.querySelector("input[name='adultCount']"),
    child: form.querySelector("input[name='childCount']"),
    infant: form.querySelector("input[name='infantCount']"),
    ticketOnly: form.querySelector("input[name='ticketOnlyCount']"),
    landOnly: form.querySelector("input[name='landOnlyCount']"),
    custom: form.querySelector("input[name='customCount']"),
  };
  const countDisplays = {
    adult: form.querySelector("input[name='adultCountDisplay']"),
    child: form.querySelector("input[name='childCountDisplay']"),
    infant: form.querySelector("input[name='infantCountDisplay']"),
    ticketOnly: form.querySelector("input[name='ticketOnlyCountDisplay']"),
    landOnly: form.querySelector("input[name='landOnlyCountDisplay']"),
    custom: form.querySelector("input[name='customCountDisplay']"),
  };
  const setupCounts = {
    adult: countSetup.querySelector("input[name='setupAdultCount']"),
    child: countSetup.querySelector("input[name='setupChildCount']"),
    infant: countSetup.querySelector("input[name='setupInfantCount']"),
    ticketOnly: countSetup.querySelector("input[name='setupTicketOnlyCount']"),
    landOnly: countSetup.querySelector("input[name='setupLandOnlyCount']"),
    custom: countSetup.querySelector("input[name='setupCustomCount']"),
  };
  const visibleCountInputs = [
    countInputs.adult,
    form.querySelector("input[name='adultCount']"),
    countInputs.child,
    countInputs.infant,
    countInputs.ticketOnly,
    countInputs.landOnly,
    countInputs.custom,
  ].filter(Boolean);
  const priceInputs = {
    adult: form.querySelector("input[name='adultPrice']"),
    child: form.querySelector("input[name='childPrice']"),
    infant: form.querySelector("input[name='infantPrice']"),
    ticketOnly: form.querySelector("input[name='ticketOnlyPrice']"),
    landOnly: form.querySelector("input[name='landOnlyPrice']"),
    custom: form.querySelector("input[name='customPrice']"),
  };
  const customLabelInput = form.querySelector("input[name='customPriceLabel']");

  const updateDuration = () => {
    if (!durationInput) return;
    const value = formatDuration(tripStartInput?.value, tripEndInput?.value);
    if (value) durationInput.value = value;
  };

  const syncTripEndToStart = () => {
    if (!tripStartInput || !tripEndInput || !tripStartInput.value) return;
    if (!tripEndInput.value || tripEndInput.value < tripStartInput.value) {
      tripEndInput.value = tripStartInput.value;
    }
  };

  const contractsFormatDateInputValue = (date) => {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const shiftDateByDays = (value, days) => {
    const parsed = parseDate(value);
    if (!parsed) return "";
    parsed.setUTCDate(parsed.getUTCDate() - days);
    return contractsFormatDateInputValue(parsed);
  };

  const updateDepositDueDate = () => {
    if (!contractDateInput || !depositDueDateInput) return;
    if (!contractDateInput.value) return;
    depositDueDateInput.value = contractDateInput.value;
  };

  const updateBalanceDueDate = () => {
    if (!tripStartInput || !balanceDuePresetInput || !balanceDueDateInput) return;
    const days = normalizeNumber(balanceDuePresetInput.value);
    if (!tripStartInput.value || !days) return;
    balanceDueDateInput.value = shiftDateByDays(tripStartInput.value, days);
  };

  const updateTravelerCount = () => {
    if (!travelerInput) return;
    const total = Object.values(countInputs).reduce((sum, input) => sum + normalizeNumber(input?.value), 0);
    travelerInput.value = String(total || 0);
  };

  const setHidden = (element, hidden) => {
    if (!element) return;
    const label = element.closest("label");
    if (label) label.classList.toggle("is-hidden", hidden);
  };

  const updatePriceVisibility = () => {
    const childCount = normalizeNumber(countInputs.child?.value);
    const infantCount = normalizeNumber(countInputs.infant?.value);
    const ticketOnlyCount = normalizeNumber(countInputs.ticketOnly?.value);
    const landOnlyCount = normalizeNumber(countInputs.landOnly?.value);
    const customCount = normalizeNumber(countInputs.custom?.value);

    setHidden(countDisplays.child, childCount <= 0);
    setHidden(priceInputs.child, childCount <= 0);

    setHidden(countDisplays.infant, infantCount <= 0);
    setHidden(priceInputs.infant, infantCount <= 0);

    setHidden(countDisplays.ticketOnly, ticketOnlyCount <= 0);
    setHidden(priceInputs.ticketOnly, ticketOnlyCount <= 0);

    setHidden(countDisplays.landOnly, landOnlyCount <= 0);
    setHidden(priceInputs.landOnly, landOnlyCount <= 0);

    setHidden(countDisplays.custom, customCount <= 0);
    setHidden(customLabelInput, customCount <= 0);
    setHidden(priceInputs.custom, customCount <= 0);
  };

  const formatMoney = (value) => {
    if (!value) return "0";
    return Number(value).toLocaleString("en-US");
  };

  const allowedDepositPercentages = ["10", "20", "30", "40", "50"];

  const setBalanceAmount = (amount) => {
    if (balanceAmountDisplayInput) balanceAmountDisplayInput.value = formatMoney(Math.max(amount, 0));
  };

  const updateTotalPrice = () => {
    if (!totalPriceInput) return;
    const adultCount = normalizeNumber(countInputs.adult?.value);
    const childCount = normalizeNumber(countInputs.child?.value);
    const infantCount = normalizeNumber(countInputs.infant?.value);
    const ticketOnlyCount = normalizeNumber(countInputs.ticketOnly?.value);
    const landOnlyCount = normalizeNumber(countInputs.landOnly?.value);
    const customCount = normalizeNumber(countInputs.custom?.value);

    const adultPrice = normalizeNumber(priceInputs.adult?.value);
    const childPrice = normalizeNumber(priceInputs.child?.value);
    const infantPrice = normalizeNumber(priceInputs.infant?.value);
    const ticketOnlyPrice = normalizeNumber(priceInputs.ticketOnly?.value);
    const landOnlyPrice = normalizeNumber(priceInputs.landOnly?.value);
    const customPrice = normalizeNumber(priceInputs.custom?.value);

    const total =
      adultCount * adultPrice +
      childCount * childPrice +
      infantCount * infantPrice +
      ticketOnlyCount * ticketOnlyPrice +
      landOnlyCount * landOnlyPrice +
      customCount * customPrice;

    totalPriceInput.value = formatMoney(total);

    let depositAmount = normalizeNumber(depositAmountInput?.value || 0);
    const percentageMode = depositPercentageInput?.value || "manual";
    if (
      depositPercentageInput &&
      percentageMode !== "manual" &&
      document.activeElement !== depositAmountInput
    ) {
      depositAmount = Math.round((total * normalizeNumber(percentageMode)) / 100);
      if (depositAmountInput) depositAmountInput.value = String(depositAmount);
    }
    if (depositAmount > total) {
      depositAmount = total;
      if (depositAmountInput) depositAmountInput.value = String(total);
    }
    const balanceAmount = Math.max(total - depositAmount, 0);
    setBalanceAmount(balanceAmount);
    if (depositPercentageInput) {
      if (document.activeElement === depositAmountInput) {
        if (total <= 0 || depositAmount <= 0) {
          depositPercentageInput.value = "manual";
        } else {
          const ratio = Math.round((depositAmount / total) * 100);
          depositPercentageInput.value = allowedDepositPercentages.includes(String(ratio)) ? String(ratio) : "manual";
        }
      } else if (total <= 0 || depositAmount <= 0) {
        depositPercentageInput.value = "manual";
      } else if (percentageMode === "manual") {
        const ratio = Math.round((depositAmount / total) * 100);
        depositPercentageInput.value = allowedDepositPercentages.includes(String(ratio)) ? String(ratio) : "manual";
      }
    }
  };

  const updateDepositFromPercentage = () => {
    if (!depositPercentageInput || !depositAmountInput || !totalPriceInput) return;
    if (depositPercentageInput.value === "manual") {
      updateTotalPrice();
      return;
    }
    const total = normalizeNumber(totalPriceInput.value);
    const percentage = normalizeNumber(depositPercentageInput.value);
    const depositAmount = Math.round((total * percentage) / 100);
    depositAmountInput.value = String(depositAmount);
    setBalanceAmount(total - depositAmount);
    updateTotalPrice();
  };

  const syncCountStepToForm = () => {
    Object.entries(setupCounts).forEach(([key, setupInput]) => {
      const value = String(normalizeNumber(setupInput?.value));
      if (countInputs[key]) countInputs[key].value = value;
      if (countDisplays[key]) countDisplays[key].value = value;
    });
    updateTravelerCount();
    updatePriceVisibility();
    updateTotalPrice();
  };

  const ensureZeroDefaults = () => {
    Object.values(priceInputs).forEach((input) => {
      if (!input) return;
      const value = normalizeTextValue(input.value);
      if (!value || value === "-") input.value = "0";
    });
    if (totalPriceInput && !normalizeTextValue(totalPriceInput.value)) totalPriceInput.value = "0";
    if (depositAmountInput && !normalizeTextValue(depositAmountInput.value)) depositAmountInput.value = "0";
    if (balanceAmountDisplayInput && !normalizeTextValue(balanceAmountDisplayInput.value)) balanceAmountDisplayInput.value = "0";
  };

  continueButton.addEventListener("click", () => {
    syncCountStepToForm();
    openStepTwo();
    window.requestAnimationFrame(() => {
      form.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  tripStartInput?.addEventListener("change", () => {
    syncTripEndToStart();
    updateDuration();
    updateBalanceDueDate();
  });
  tripEndInput?.addEventListener("change", updateDuration);
  contractDateInput?.addEventListener("change", updateDepositDueDate);
  depositAmountInput?.addEventListener("input", updateTotalPrice);
  depositPercentageInput?.addEventListener("change", updateDepositFromPercentage);
  balanceDuePresetInput?.addEventListener("change", updateBalanceDueDate);
  visibleCountInputs.forEach((input) =>
    input.addEventListener("input", () => {
      updateTravelerCount();
      updatePriceVisibility();
      updateTotalPrice();
    })
  );
  Object.values(priceInputs).forEach((input) => {
    if (!input) return;
    input.addEventListener("input", updateTotalPrice);
  });

  ensureZeroDefaults();
  syncCountStepToForm();
  updateTravelerCount();
  updatePriceVisibility();
  updateTotalPrice();
  syncTripEndToStart();
  updateDepositDueDate();
  updateBalanceDueDate();
  loadManagers();

  // ── Contract templates: list / upload / replace / rename / delete ──
  const templateSelect = qs("#contract-template-select");
  const templateListNode = qs("#contract-template-list");
  const templateAddBtn = qs("#contract-template-add-btn");
  const templatePicker = qs("#contract-template-file-picker");
  const templateReplacePicker = qs("#contract-template-replace-picker");
  let pendingReplaceId = "";

  async function loadContractTemplates() {
    let entries = [];
    try {
      const data = await apiRequest("/api/contract-templates");
      entries = Array.isArray(data?.entries) ? data.entries : [];
    } catch {}
    if (templateSelect) {
      const current = templateSelect.value;
      templateSelect.innerHTML =
        `<option value="">Анхдагч (Default)</option>` +
        entries.map((e) => `<option value="${escapeHtmlAttr(e.id)}">${escapeHtmlText(e.name)}</option>`).join("");
      if (current && entries.some((e) => e.id === current)) templateSelect.value = current;
    }
    if (templateListNode) {
      if (!entries.length) {
        templateListNode.innerHTML = `<p class="empty">No custom templates yet. Click "+ Upload template" to add one.</p>`;
      } else {
        templateListNode.innerHTML = `
          <div class="camp-table-wrap">
            <table class="camp-table">
              <thead><tr><th>Name</th><th>Notes</th><th>File</th><th>Updated</th><th>Actions</th></tr></thead>
              <tbody>
                ${entries.map((e) => `
                  <tr data-template-id="${escapeHtmlAttr(e.id)}">
                    <td><strong>${escapeHtmlText(e.name)}</strong></td>
                    <td>${escapeHtmlText(e.notes || "—")}</td>
                    <td><a href="/api/contract-templates/${encodeURIComponent(e.id)}/document" target="_blank" rel="noreferrer">${escapeHtmlText(e.originalName || "template.docx")}</a></td>
                    <td>${escapeHtmlText((e.updatedAt || "").slice(0, 10))}</td>
                    <td>
                      <button type="button" class="header-action-btn" data-tpl-action="rename" data-id="${escapeHtmlAttr(e.id)}">Rename</button>
                      <button type="button" class="header-action-btn" data-tpl-action="replace" data-id="${escapeHtmlAttr(e.id)}">Replace .docx</button>
                      <button type="button" class="header-action-btn button-danger" data-tpl-action="delete" data-id="${escapeHtmlAttr(e.id)}">Delete</button>
                    </td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        `;
      }
    }
  }
  function escapeHtmlText(v) { return String(v || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"); }
  function escapeHtmlAttr(v) { return escapeHtmlText(v).replaceAll('"', "&quot;"); }

  templateAddBtn?.addEventListener("click", () => templatePicker?.click());
  templatePicker?.addEventListener("change", async () => {
    const file = templatePicker.files && templatePicker.files[0];
    if (!file) return;
    try {
      const name = await window.UI.prompt("Template name (e.g. JEJU, Default, Korea-FIT):", {
        title: "New contract template",
        defaultValue: file.name.replace(/\.docx$/i, ""),
        confirmLabel: "Next",
      });
      if (!name) { templatePicker.value = ""; return; }
      const notes = (await window.UI.prompt("Notes (optional — when to use this template):", {
        title: "Template notes",
        defaultValue: "",
        confirmLabel: "Upload",
      })) || "";
      const fd = new FormData();
      fd.append("file", file);
      fd.append("name", name);
      if (notes) fd.append("notes", notes);
      const r = await fetch("/api/contract-templates", { method: "POST", body: fd });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.error || "Upload failed");
      }
      await loadContractTemplates();
    } catch (err) {
      if (err) alert(err.message || "Could not upload template.");
    } finally {
      templatePicker.value = "";
    }
  });

  templateReplacePicker?.addEventListener("change", async () => {
    const file = templateReplacePicker.files && templateReplacePicker.files[0];
    if (!file || !pendingReplaceId) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      const r = await fetch(`/api/contract-templates/${encodeURIComponent(pendingReplaceId)}`, { method: "POST", body: fd });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.error || "Replace failed");
      }
      await loadContractTemplates();
    } catch (err) {
      alert(err.message || "Could not replace template.");
    } finally {
      templateReplacePicker.value = "";
      pendingReplaceId = "";
    }
  });

  templateListNode?.addEventListener("click", async (event) => {
    const btn = event.target.closest("[data-tpl-action]");
    if (!btn) return;
    const action = btn.dataset.tplAction;
    const id = btn.dataset.id;
    if (!id) return;
    if (action === "rename") {
      const row = btn.closest("tr");
      const currentName = row?.querySelector("strong")?.textContent || "";
      try {
        const next = await window.UI.prompt("New name:", {
          title: "Rename contract template",
          defaultValue: currentName,
          confirmLabel: "Save",
        });
        if (!next || next === currentName) return;
        const r = await fetch(`/api/contract-templates/${encodeURIComponent(id)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: next }),
        });
        if (!r.ok) {
          const data = await r.json().catch(() => ({}));
          throw new Error(data.error || "Rename failed");
        }
        await loadContractTemplates();
      } catch (err) {
        if (err) alert(err.message || "Could not rename template.");
      }
    } else if (action === "replace") {
      pendingReplaceId = id;
      templateReplacePicker?.click();
    } else if (action === "delete") {
      try {
        const ok = await window.UI.confirm(
          "Delete this template? Existing contracts that used it will fall back to the default template on re-render.",
          { title: "Delete template", dangerous: true, confirmLabel: "Delete" }
        );
        if (!ok) return;
        const r = await fetch(`/api/contract-templates/${encodeURIComponent(id)}`, { method: "DELETE" });
        if (!r.ok) {
          const data = await r.json().catch(() => ({}));
          throw new Error(data.error || "Delete failed");
        }
        await loadContractTemplates();
      } catch (err) {
        if (err) alert(err.message || "Could not delete template.");
      }
    }
  });

  loadContractTemplates();

  const filterInputs = [
    qs("#contract-filter-manager"),
    qs("#contract-filter-destination"),
    qs("#contract-filter-date-from"),
    qs("#contract-filter-date-to"),
  ].filter(Boolean);
  filterInputs.forEach((input) => {
    input.addEventListener("input", () => {
      contractsCurrentPage = 1;
      renderContractsView();
    });
    input.addEventListener("change", () => {
      contractsCurrentPage = 1;
      renderContractsView();
    });
  });

  const openEditorWithData = (contract) => {
    const data = contract.data || {};
    editingContractId = contract.id;
    panel.classList.remove("is-hidden");
    panel.removeAttribute("hidden");
    document.body.classList.add("modal-open");
    openStepTwo();
    if (formTitle) formTitle.textContent = "Edit contract";
    if (formSubmitButton) formSubmitButton.textContent = "Update contract";
    Object.entries(data).forEach(([key, value]) => {
      const element = form.elements[key];
      if (element) {
        element.value = value ?? "";
      }
    });
    if (setupCounts.adult) setupCounts.adult.value = data.adultCount || 0;
    if (setupCounts.child) setupCounts.child.value = data.childCount || 0;
    if (setupCounts.infant) setupCounts.infant.value = data.infantCount || 0;
    if (setupCounts.ticketOnly) setupCounts.ticketOnly.value = data.ticketOnlyCount || 0;
    if (setupCounts.landOnly) setupCounts.landOnly.value = data.landOnlyCount || 0;
    if (setupCounts.custom) setupCounts.custom.value = data.customCount || 0;
    form.elements.managerSignaturePath.value = data.managerSignaturePath || "";
    form.elements.managerSelect.value = getCreatorName(contract) || "";
    if (depositAmountInput) depositAmountInput.value = String(normalizeNumber(data.depositAmount || 0));
    if (depositPercentageInput) {
      const total = normalizeNumber(data.totalPrice || 0);
      const deposit = normalizeNumber(data.depositAmount || 0);
      const ratio = total > 0 ? Math.round((deposit / total) * 100) : 0;
      depositPercentageInput.value = allowedDepositPercentages.includes(String(ratio)) ? String(ratio) : "manual";
    }
    if (balanceDuePresetInput && data.tripStartDate && data.balanceDueDate) {
      const startDate = parseDate(data.tripStartDate);
      const balanceDate = parseDate(data.balanceDueDate);
      if (startDate && balanceDate) {
        const diffDays = Math.round((startDate - balanceDate) / (1000 * 60 * 60 * 24));
        const allowedDiffs = ["30", "20", "15", "10", "7"];
        balanceDuePresetInput.value = allowedDiffs.includes(String(diffDays)) ? String(diffDays) : "7";
      }
    }
    syncCountStepToForm();
    updateTravelerCount();
    updatePriceVisibility();
  updateTotalPrice();
  };

  window.openContractEditor = openEditorWithData;
};

const initSignatureCanvas = (canvas) => {
  const ctx = canvas.getContext("2d");
  let drawing = false;
  let hasInk = false;
  const baseWidth = 700;
  const baseHeight = 220;
  const pixelRatio = Math.max(window.devicePixelRatio || 1, 1);

  const setupCanvas = () => {
    canvas.width = Math.floor(baseWidth * pixelRatio);
    canvas.height = Math.floor(baseHeight * pixelRatio);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(pixelRatio, pixelRatio);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, baseWidth, baseHeight);
    ctx.lineWidth = 2.6;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.imageSmoothingEnabled = true;
    ctx.setLineDash([8, 8]);
    ctx.strokeStyle = "rgba(37, 58, 119, 0.24)";
    ctx.beginPath();
    ctx.moveTo(28, 178);
    ctx.lineTo(baseWidth - 28, 178);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = "#1b2a6b";
    hasInk = false;
  };

  setupCanvas();

  const getPos = (event) => {
    const rect = canvas.getBoundingClientRect();
    const touch = event.touches ? event.touches[0] : null;
    return {
      x: ((touch ? touch.clientX : event.clientX) - rect.left) * (baseWidth / rect.width),
      y: ((touch ? touch.clientY : event.clientY) - rect.top) * (baseHeight / rect.height),
    };
  };

  const startDraw = (event) => {
    event.preventDefault();
    drawing = true;
    const pos = getPos(event);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (event) => {
    if (!drawing) return;
    event.preventDefault();
    const pos = getPos(event);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    hasInk = true;
  };

  const endDraw = () => {
    drawing = false;
  };

  canvas.addEventListener("mousedown", startDraw);
  canvas.addEventListener("mousemove", draw);
  canvas.addEventListener("mouseup", endDraw);
  canvas.addEventListener("mouseleave", endDraw);
  canvas.addEventListener("touchstart", startDraw, { passive: false });
  canvas.addEventListener("touchmove", draw, { passive: false });
  canvas.addEventListener("touchend", endDraw);

  return {
    clear: setupCanvas,
    hasInk: () => hasInk,
  };
};

const initContractSignPage = async () => {
  if (!location.pathname.startsWith("/contract/")) return;
  const contractId = location.pathname.replace("/contract/", "").replace(/\/$/, "");
  const summaryEl = qs("#contract-summary");
  const statusEl = qs("#signature-status");
  const downloadEl = qs("#signature-download");
  const canvas = qs("#signature-canvas");
  const previewFrame = qs("#contract-preview-frame");

  if (!contractId || !summaryEl || !canvas) return;

  const signaturePad = initSignatureCanvas(canvas);

  try {
    const data = await apiRequest(`${CONTRACTS_ENDPOINT}/${contractId}`);
    const contract = data.contract;
    const info = contract.data || {};
    summaryEl.innerHTML = `
      <div class="summary-row">
        <div>
          <p><strong>Овог: ${info.touristLastName || "-"}</strong></p>
          <p><strong>Нэр: ${info.touristFirstName || "-"}</strong></p>
          <p>Аяллын чиглэл: ${info.destination || "-"}</p>
          <p>Гэрээний дугаар: ${info.contractSerial || "-"}</p>
        </div>
        <a class="secondary-button" href="/api/contracts/${contractId}/document?mode=view" target="_blank">Гэрээ харах</a>
      </div>
    `;
    const clientPhoneInput = qs("#signer-client-phone");
    const clientEmailInput = qs("#signer-client-email");
    const emergencyNameInput = qs("#signer-emergency-name");
    const emergencyPhoneInput = qs("#signer-emergency-phone");
    const emergencyRelationInput = qs("#signer-emergency-relation");
    if (clientPhoneInput) clientPhoneInput.value = info.clientPhone || "";
    if (clientEmailInput) clientEmailInput.value = info.clientEmail || "";
    if (emergencyNameInput) emergencyNameInput.value = info.emergencyContactName || "";
    if (emergencyPhoneInput) emergencyPhoneInput.value = info.emergencyContactPhone || "";
    if (emergencyRelationInput) emergencyRelationInput.value = info.emergencyContactRelation || "";
    if (previewFrame) {
      previewFrame.src = `/api/contracts/${contractId}/document?mode=view`;
    }
  } catch (error) {
    summaryEl.innerHTML = `<div class="empty-state">Гэрээ ачаалж чадсангүй.</div>`;
  }

  qs("#signature-clear")?.addEventListener("click", () => {
    signaturePad?.clear();
  });

  qs("#signature-submit")?.addEventListener("click", async () => {
    statusEl.textContent = "Гарын үсгийг хадгалж байна...";
    const clientPhone = normalizeTextValue(qs("#signer-client-phone")?.value || "");
    const clientEmail = normalizeTextValue(qs("#signer-client-email")?.value || "");
    const emergencyName = normalizeTextValue(qs("#signer-emergency-name")?.value || "");
    const emergencyPhone = normalizeTextValue(qs("#signer-emergency-phone")?.value || "");
    const emergencyRelation = normalizeTextValue(qs("#signer-emergency-relation")?.value || "");
    const accepted = qs("#signer-accept")?.checked || false;
    if (!clientPhone || !clientEmail || !emergencyName || !emergencyPhone || !emergencyRelation) {
      statusEl.textContent = "Бүх холбоо барих мэдээллийг бөглөнө үү.";
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clientEmail)) {
      statusEl.textContent = "Имэйл хаяг буруу байна.";
      return;
    }
    if (!accepted) {
      statusEl.textContent = "Та гэрээг зөвшөөрөх ёстой.";
      return;
    }
    if (!signaturePad?.hasInk()) {
      statusEl.textContent = "Гарын үсгээ зурна уу.";
      return;
    }
    const signatureData = canvas.toDataURL("image/png");
    try {
      const result = await apiRequest(`${CONTRACTS_ENDPOINT}/${contractId}/sign`, {
        method: "POST",
        body: JSON.stringify({
          clientPhone,
          clientEmail,
          emergencyContactName: emergencyName,
          emergencyContactPhone: emergencyPhone,
          emergencyContactRelation: emergencyRelation,
          signatureData,
          accepted,
        }),
      });
      const emailSuffix = result.emailSent
        ? ` Гэрээ болон нэхэмжлэх ${clientEmail} хаяг руу илгээгдлээ.`
        : "";
      statusEl.textContent = "Гарын үсэг амжилттай хадгалагдлаа." + emailSuffix;
      if (result.contract?.pdfPath) {
        const pdfSrc = encodeURIComponent(result.contract.pdfPath);
        const pdfTitle = encodeURIComponent(result.contract.data?.contractSerial || "Contract");
        downloadEl.innerHTML = `<a class="secondary-button success-button" href="/pdf-viewer?src=${pdfSrc}&title=${pdfTitle}" target="_blank" rel="noreferrer">PDF Татах</a>`;
      }
    } catch (error) {
      statusEl.textContent = error.message || "Could not confirm signature and generate PDF.";
    }
  });
};

// Populate the contract form's bank-account dropdown from /api/settings.
// Used on every code path that opens the contract modal (page load, group
// page, trip page, FIT/GIT pages).
async function loadContractBankAccounts() {
  const sel = document.getElementById("contract-bank-account");
  if (!sel || sel.dataset.loaded === "1") return;
  try {
    const res = await fetch("/api/settings");
    if (!res.ok) return;
    const data = await res.json();
    const accounts = (data.entry?.bankAccounts) || [];
    sel.innerHTML = '<option value="">— Choose —</option>' + accounts.map((b) =>
      `<option value="${b.id}">${(b.label || b.bankName || "(unnamed)").replace(/&/g, "&amp;").replace(/</g, "&lt;")}${b.currency ? " · " + b.currency : ""}</option>`
    ).join("");
    sel.dataset.loaded = "1";
  } catch {}
}

document.addEventListener("DOMContentLoaded", () => {
  if (location.pathname === "/contracts") {
    initContractForm();
    loadContracts();
    startContractsLiveRefresh();
    loadContractBankAccounts();
  }
  if (location.pathname.startsWith("/contract/")) {
    initContractSignPage();
  }
});

// Public entrypoint for trip/group/FIT/GIT pages: lazy-loads the modal
// markup, wires it up once, applies prefill, and opens it in-place.
window.openContractModal = async (opts = {}) => {
  await ensureContractModalInDOM();
  if (!window.__contractFormInited) {
    initContractForm();
    window.__contractFormInited = true;
  }
  loadContractBankAccounts();
  if (typeof window.__openContractModalInternal === "function") {
    window.__openContractModalInternal(opts);
  }
};
