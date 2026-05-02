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

  // ── Contract templates: list + structured editor ──────────────────
  const tplSelect = qs("#contract-template-select");
  const tplListNode = qs("#contract-template-list");
  const tplAddBtn = qs("#contract-template-add-btn");
  const tplViewBtn = qs("#contract-template-view-btn");
  const tplListModal = qs("#contract-template-list-modal");
  const tplListHost = qs("#contract-template-list-host");
  const tplEditor = qs("#contract-template-editor");
  const tplEditorTitle = qs("#contract-template-editor-title");
  const tplSectionsHost = qs("#contract-template-sections");
  const tplAddSectionBtn = qs("#contract-template-add-section");
  const tplSaveBtn = qs("#contract-template-save");
  const tplStatus = qs("#contract-template-status");

  let editorMode = "create";          // "create" | "edit" | "view"
  let editorEditingId = "";
  let editorName = "";
  let editorIntro = [];               // ["preamble paragraph", …]
  let editorSections = [];            // [{title, paragraphs:[text,…]}]
  const isReadOnly = () => editorMode === "view";
  const escAttr = (v) => String(v || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  const escText = (v) => String(v || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

  async function loadTemplatesIntoSelect() {
    if (!tplSelect) return [];
    let entries = [];
    try {
      const data = await apiRequest("/api/contract-templates");
      entries = Array.isArray(data?.entries) ? data.entries : [];
    } catch {}
    const current = tplSelect.value;
    tplSelect.innerHTML =
      `<option value="">Анхдагч (Default)</option>` +
      entries.map((e) => `<option value="${escAttr(e.id)}">${escText(e.name)}</option>`).join("");
    if (current && entries.some((e) => e.id === current)) tplSelect.value = current;
    return entries;
  }

  async function loadTemplateList() {
    const entries = await loadTemplatesIntoSelect();
    if (!tplListNode) return;
    if (!entries.length) {
      tplListNode.innerHTML = `<p class="empty">No custom templates yet. Click "+ Add contract template" to create one.</p>`;
      return;
    }
    tplListNode.innerHTML = `
      <div class="camp-table-wrap">
        <table class="camp-table">
          <thead><tr><th>Name</th><th>Sections</th><th>Updated</th><th>Actions</th></tr></thead>
          <tbody>
            ${entries.map((e) => `
              <tr>
                <td><strong>${escText(e.name)}</strong></td>
                <td>${(e.sections || []).length} sections · ${(e.sections || []).reduce((n, s) => n + (s.paragraphs || []).length, 0)} paragraphs</td>
                <td>${escText((e.updatedAt || "").slice(0, 10))}</td>
                <td>
                  <button type="button" class="header-action-btn" data-tpl-action="view" data-id="${escAttr(e.id)}">View</button>
                  <button type="button" class="header-action-btn" data-tpl-action="edit" data-id="${escAttr(e.id)}">Edit</button>
                  <button type="button" class="header-action-btn button-danger" data-tpl-action="delete" data-id="${escAttr(e.id)}">Delete</button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  // Templates accept light HTML (lists, bold, italic, underline)
  // via the toolbar. Saved bodies are sanitised to this allowlist
  // and tokens are stored as plain "{{name}}" text — they get
  // re-wrapped in red contract-var spans only when rendered into
  // the editor.
  const TEMPLATE_ALLOWED_TAGS = new Set(["ul", "ol", "li", "strong", "b", "em", "i", "u", "br", "p"]);

  // Take stored HTML and wrap every {{token}} substring in a
  // .contract-var span — walking text nodes so list / bold tags
  // are preserved untouched.
  function paragraphInnerHtml(stored) {
    if (stored == null || stored === "") return "";
    const tmp = document.createElement("div");
    tmp.innerHTML = String(stored);
    const walker = document.createTreeWalker(tmp, NodeFilter.SHOW_TEXT);
    const targets = [];
    let n;
    while ((n = walker.nextNode())) {
      if (/\{\{\s*[a-zA-Z][a-zA-Z0-9_]*\s*\}\}/.test(n.nodeValue || "")) targets.push(n);
    }
    targets.forEach((node) => {
      const text = node.nodeValue;
      const frag = document.createDocumentFragment();
      let lastIdx = 0;
      const re = /\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g;
      let m;
      while ((m = re.exec(text))) {
        if (m.index > lastIdx) frag.appendChild(document.createTextNode(text.slice(lastIdx, m.index)));
        const span = document.createElement("span");
        span.className = "contract-var";
        span.textContent = `{{${m[1]}}}`;
        frag.appendChild(span);
        lastIdx = m.index + m[0].length;
      }
      if (lastIdx < text.length) frag.appendChild(document.createTextNode(text.slice(lastIdx)));
      node.parentNode.replaceChild(frag, node);
    });
    return tmp.innerHTML;
  }

  // Convert the live contenteditable DOM back into a sanitised
  // storable HTML string. Strips contract-var spans (keeps just
  // the "{{name}}" text), drops tags outside the allowlist, and
  // removes every attribute on tags we keep.
  function paragraphHtmlForStorage(node) {
    if (!node) return "";
    const clone = node.cloneNode(true);
    clone.querySelectorAll(".contract-var").forEach((span) => {
      span.replaceWith(document.createTextNode(span.textContent || ""));
    });
    function clean(host) {
      Array.from(host.children).forEach((child) => {
        clean(child);
        const tag = (child.tagName || "").toLowerCase();
        if (!TEMPLATE_ALLOWED_TAGS.has(tag)) {
          while (child.firstChild) child.parentNode.insertBefore(child.firstChild, child);
          child.parentNode.removeChild(child);
        } else {
          Array.from(child.attributes).forEach((a) => child.removeAttribute(a.name));
        }
      });
    }
    clean(clone);
    return clone.innerHTML.replace(/(?:\s*<br\s*\/?>)+$/i, "").trim();
  }

  function renderEditorSections() {
    if (!tplSectionsHost) return;
    const ro = isReadOnly();
    const introBlock = `
      <fieldset class="contract-template-section contract-template-intro" data-intro-block>
        <legend>Intro (preamble — appears above Section 1)</legend>
        <div class="contract-template-paragraphs">
          ${editorIntro.map((p, iIdx) => `
            <div class="contract-template-paragraph-row">
              <span class="contract-template-paragraph-number">¶</span>
              <div data-intro-paragraph data-paragraph-index="${iIdx}" contenteditable="${ro ? "false" : "true"}" class="contract-template-textarea${ro ? " is-readonly" : ""}">${paragraphInnerHtml(p || "")}</div>
              ${ro ? "" : `<button type="button" class="header-action-btn button-danger" data-intro-remove data-paragraph-index="${iIdx}" title="Remove paragraph">×</button>`}
            </div>
          `).join("")}
        </div>
        ${ro ? "" : `<div class="contract-template-section-actions">
          <button type="button" class="secondary-button" data-intro-add>+ Add intro paragraph</button>
        </div>`}
      </fieldset>
    `;
    tplSectionsHost.innerHTML = introBlock + editorSections.map((sec, sIdx) => `
      <fieldset class="contract-template-section" data-section-index="${sIdx}">
        <legend>Section ${sIdx + 1}</legend>
        <label class="contract-template-title-label">
          <span>Title</span>
          <input type="text" data-section-title value="${escAttr(sec.title || "")}" ${ro ? "readonly" : ""} />
        </label>
        <div data-paragraphs class="contract-template-paragraphs">
          ${(sec.paragraphs || []).map((p, pIdx) => `
            <div class="contract-template-paragraph-row">
              <span class="contract-template-paragraph-number">${sIdx + 1}.${pIdx + 1}.</span>
              <div data-paragraph data-paragraph-index="${pIdx}" contenteditable="${ro ? "false" : "true"}" class="contract-template-textarea${ro ? " is-readonly" : ""}">${paragraphInnerHtml(p || "")}</div>
              ${ro ? "" : `<button type="button" class="header-action-btn button-danger" data-paragraph-remove data-paragraph-index="${pIdx}" title="Remove paragraph">×</button>`}
            </div>
          `).join("")}
        </div>
        ${ro ? "" : `<div class="contract-template-section-actions">
          <button type="button" class="secondary-button" data-paragraph-add>+ Add paragraph</button>
          <span style="flex:1"></span>
          <button type="button" class="header-action-btn button-danger" data-section-remove>Remove section</button>
        </div>`}
      </fieldset>
    `).join("");
    // Hide save / +Add title in read-only mode.
    if (tplSaveBtn) tplSaveBtn.style.display = ro ? "none" : "";
    if (tplAddSectionBtn) tplAddSectionBtn.style.display = ro ? "none" : "";
  }

  function readEditorIntro() {
    return Array.from(tplSectionsHost.querySelectorAll("[data-intro-paragraph]"))
      .map((t) => paragraphHtmlForStorage(t));
  }
  function readEditorSections() {
    const fieldsets = tplSectionsHost.querySelectorAll("[data-section-index]");
    return Array.from(fieldsets).map((node) => {
      const title = node.querySelector("[data-section-title]")?.value || "";
      // contenteditable: read .innerText so token spans collapse to
      // their plain "{{tokenName}}" text. Trim trailing newlines a
      // browser sometimes adds.
      const paragraphs = Array.from(node.querySelectorAll("[data-paragraph]"))
        .map((t) => paragraphHtmlForStorage(t));
      return { title, paragraphs };
    });
  }

  function openEditor() {
    if (!tplEditor) return;
    renderEditorSections();
    tplEditor.classList.remove("is-hidden");
    tplEditor.removeAttribute("hidden");
    document.body.classList.add("modal-open");
  }
  function closeEditor() {
    if (!tplEditor) return;
    tplEditor.classList.add("is-hidden");
    tplEditor.setAttribute("hidden", "");
    document.body.classList.remove("modal-open");
    if (tplStatus) tplStatus.textContent = "";
  }

  tplAddBtn?.addEventListener("click", async () => {
    let name;
    try {
      name = await window.UI.prompt("Template name (e.g. JEJU, Korea-FIT):", {
        title: "New contract template",
        defaultValue: "",
        confirmLabel: "Continue",
      });
    } catch { return; }
    if (!name) return;
    let intro = [];
    let sections = [];
    try {
      const data = await apiRequest("/api/contract-templates/default");
      intro = Array.isArray(data?.intro) ? data.intro : [];
      sections = Array.isArray(data?.sections) ? data.sections : [];
    } catch (err) {
      alert(err.message || "Could not load default template.");
      return;
    }
    editorMode = "create";
    editorEditingId = "";
    editorName = name;
    editorIntro = intro;
    editorSections = sections;
    if (tplEditorTitle) tplEditorTitle.textContent = `New template — ${name}`;
    openEditor();
  });

  tplListNode?.addEventListener("click", async (event) => {
    const btn = event.target.closest("[data-tpl-action]");
    if (!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.tplAction;
    if (action === "edit") {
      try {
        const data = await apiRequest(`/api/contract-templates/${encodeURIComponent(id)}`);
        const entry = data?.entry;
        if (!entry) throw new Error("Not found");
        editorMode = "edit";
        editorEditingId = id;
        editorName = entry.name || "";
        editorSections = Array.isArray(entry.sections) ? entry.sections : [];
        if (tplEditorTitle) tplEditorTitle.textContent = `Edit template — ${editorName}`;
        openEditor();
      } catch (err) {
        alert(err.message || "Could not open template.");
      }
    } else if (action === "delete") {
      try {
        const ok = await window.UI.confirm(
          "Delete this template? Existing contracts that referenced it will fall back to the default on re-render.",
          { title: "Delete template", dangerous: true, confirmLabel: "Delete" }
        );
        if (!ok) return;
        await apiRequest(`/api/contract-templates/${encodeURIComponent(id)}`, { method: "DELETE" });
        await loadTemplatesIntoSelect();
      } catch (err) {
        if (err) alert(err.message || "Could not delete.");
      }
    }
  });

  // ── Formatting toolbar (Bold / Italic / Underline / lists) ──
  // Each button runs document.execCommand on the current selection
  // inside the focused paragraph. We track the last focused
  // contenteditable so clicking a toolbar button doesn't kill the
  // selection.
  let lastFocusedParagraph = null;
  tplSectionsHost?.addEventListener("focusin", (event) => {
    const t = event.target;
    if (t && t.matches && t.matches("[data-paragraph], [data-intro-paragraph]")) {
      lastFocusedParagraph = t;
    }
  });
  document.querySelector("#contract-template-toolbar")?.addEventListener("mousedown", (event) => {
    const btn = event.target.closest("[data-fmt-cmd]");
    if (!btn) return;
    event.preventDefault();
    if (lastFocusedParagraph) lastFocusedParagraph.focus();
    try { document.execCommand(btn.dataset.fmtCmd, false, null); } catch (_) {}
  });

  // ── @-autocomplete for {{tokens}} inside template paragraphs ──
  // Manager types @ → a small popover shows the full token list,
  // typing more letters filters, Enter / click inserts the chosen
  // {{tokenName}} (already wrapped in the red contract-var span).
  const TOKEN_OPTIONS = [
    { token: "contractSerial",         label: "Contract serial" },
    { token: "contractDate",           label: "Contract date" },
    { token: "tripStartDate",          label: "Trip start date" },
    { token: "tripEndDate",            label: "Trip end date" },
    { token: "tripDuration",           label: "Trip duration (e.g. 8 өдөр 7 шөнө)" },
    { token: "destination",            label: "Destination / direction" },
    { token: "managerLastName",        label: "Manager last name" },
    { token: "managerFirstName",       label: "Manager first name" },
    { token: "managerFormalName",      label: "Manager formal name" },
    { token: "managerEmail",           label: "Manager email" },
    { token: "managerPhone",           label: "Manager phone" },
    { token: "touristLastName",        label: "Tourist last name" },
    { token: "touristFirstName",       label: "Tourist first name" },
    { token: "touristRegister",        label: "Tourist register (РД)" },
    { token: "travelerCount",          label: "Total traveler count" },
    { token: "adultCount",             label: "Adult count" },
    { token: "childCount",             label: "Child count" },
    { token: "infantCount",            label: "Infant count" },
    { token: "totalPrice",             label: "Total price" },
    { token: "adultPrice",             label: "Adult price" },
    { token: "childPrice",             label: "Child price" },
    { token: "infantPrice",            label: "Infant price" },
    { token: "depositAmount",          label: "Deposit amount" },
    { token: "balanceAmount",          label: "Balance amount" },
    { token: "depositDueDate",         label: "Deposit due date" },
    { token: "balanceDueDate",         label: "Balance due date" },
    { token: "bankPhrase",             label: "Bank — chosen on contract form" },
    { token: "clientPhone",            label: "Client phone" },
    { token: "emergencyContactName",   label: "Emergency contact name" },
    { token: "emergencyContactPhone",  label: "Emergency contact phone" },
    { token: "emergencyContactRelation", label: "Emergency contact relation" },
    { token: "paymentParagraph",       label: "Payment paragraph (computed)" },
    { token: "depositParagraph",       label: "Deposit paragraph (computed)" },
    { token: "balanceParagraph",       label: "Balance paragraph (computed)" },
  ];

  let tokenPopover = null;
  let tokenPopoverState = null;  // {anchor, queryStart, query, items, selected}

  function ensureTokenPopover() {
    if (tokenPopover) return tokenPopover;
    tokenPopover = document.createElement("div");
    tokenPopover.className = "contract-token-popover";
    tokenPopover.style.position = "fixed";
    tokenPopover.style.zIndex = "10000";
    tokenPopover.style.display = "none";
    document.body.appendChild(tokenPopover);
    return tokenPopover;
  }

  function closeTokenPopover() {
    if (!tokenPopoverState) return;
    if (tokenPopover) tokenPopover.style.display = "none";
    tokenPopoverState = null;
  }

  function renderTokenPopover() {
    if (!tokenPopoverState) return;
    const items = tokenPopoverState.items;
    if (!items.length) {
      tokenPopover.innerHTML = `<div class="contract-token-empty">No matching token</div>`;
      return;
    }
    tokenPopover.innerHTML = items.map((opt, i) => `
      <button type="button" class="contract-token-option${i === tokenPopoverState.selected ? " is-active" : ""}" data-token-pick="${opt.token}">
        <strong>{{${opt.token}}}</strong>
        <span>${escText(opt.label)}</span>
      </button>
    `).join("");
  }

  function positionTokenPopover(rect) {
    if (!tokenPopover) return;
    const top = rect.bottom + 4;
    const left = rect.left;
    tokenPopover.style.top = `${top}px`;
    tokenPopover.style.left = `${left}px`;
  }

  function filterTokens(query) {
    const q = String(query || "").toLowerCase();
    if (!q) return TOKEN_OPTIONS.slice(0, 12);
    return TOKEN_OPTIONS.filter((opt) =>
      opt.token.toLowerCase().includes(q) || opt.label.toLowerCase().includes(q)
    ).slice(0, 12);
  }

  function selectionRange() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    return sel.getRangeAt(0);
  }

  function findAtTrigger(node, offset) {
    // Look back from cursor inside a single text node to find an @
    // that is at the start or preceded by whitespace. Returns
    // {atOffset, query} or null.
    if (!node || node.nodeType !== Node.TEXT_NODE) return null;
    const text = node.textContent || "";
    let i = offset;
    while (i > 0) {
      const ch = text[i - 1];
      if (ch === "@") {
        const before = i - 2 >= 0 ? text[i - 2] : "";
        if (i - 1 === 0 || /\s/.test(before)) {
          return { node, atOffset: i - 1, query: text.slice(i, offset) };
        }
        return null;
      }
      if (/\s/.test(ch)) return null;
      i -= 1;
    }
    return null;
  }

  function tryOpenTokenPopover() {
    const range = selectionRange();
    if (!range || !range.collapsed) return closeTokenPopover();
    const node = range.startContainer;
    const host = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    if (!host || !host.closest("[data-paragraph], [data-intro-paragraph]")) return closeTokenPopover();
    const trigger = findAtTrigger(node, range.startOffset);
    if (!trigger) return closeTokenPopover();
    const items = filterTokens(trigger.query);
    ensureTokenPopover();
    tokenPopoverState = {
      paragraphNode: host.closest("[data-paragraph], [data-intro-paragraph]"),
      textNode: trigger.node,
      atOffset: trigger.atOffset,
      query: trigger.query,
      items,
      selected: 0,
    };
    renderTokenPopover();
    tokenPopover.style.display = "block";
    // Position popover at the @ character.
    const r = document.createRange();
    r.setStart(trigger.node, trigger.atOffset);
    r.setEnd(trigger.node, trigger.atOffset + 1);
    positionTokenPopover(r.getBoundingClientRect());
  }

  function insertChosenToken(tokenName) {
    if (!tokenPopoverState) return;
    const { textNode, atOffset, query } = tokenPopoverState;
    // Replace "@<query>" in the text node with a contract-var span.
    const range = document.createRange();
    range.setStart(textNode, atOffset);
    range.setEnd(textNode, atOffset + 1 + query.length);
    range.deleteContents();
    const span = document.createElement("span");
    span.className = "contract-var";
    span.textContent = `{{${tokenName}}}`;
    range.insertNode(span);
    // Move cursor after the inserted span and add a trailing space.
    const space = document.createTextNode(" ");
    span.parentNode.insertBefore(space, span.nextSibling);
    const sel = window.getSelection();
    sel.removeAllRanges();
    const after = document.createRange();
    after.setStartAfter(space);
    after.collapse(true);
    sel.addRange(after);
    closeTokenPopover();
  }

  // Open / update the popover on every keystroke inside a paragraph.
  tplSectionsHost?.addEventListener("input", (event) => {
    const target = event.target;
    if (!target || !target.matches || !target.matches("[data-paragraph], [data-intro-paragraph]")) return;
    tryOpenTokenPopover();
  });

  // Keyboard navigation inside the popover.
  tplSectionsHost?.addEventListener("keydown", (event) => {
    if (!tokenPopoverState) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeTokenPopover();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      tokenPopoverState.selected = Math.min(tokenPopoverState.items.length - 1, tokenPopoverState.selected + 1);
      renderTokenPopover();
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      tokenPopoverState.selected = Math.max(0, tokenPopoverState.selected - 1);
      renderTokenPopover();
      return;
    }
    if (event.key === "Enter" || event.key === "Tab") {
      const opt = tokenPopoverState.items[tokenPopoverState.selected];
      if (opt) {
        event.preventDefault();
        insertChosenToken(opt.token);
      }
    }
  });

  document.addEventListener("click", (event) => {
    if (!tokenPopoverState) return;
    const pickBtn = event.target.closest("[data-token-pick]");
    if (pickBtn) {
      event.preventDefault();
      insertChosenToken(pickBtn.dataset.tokenPick);
      return;
    }
    // Click outside the popover closes it.
    if (tokenPopover && !tokenPopover.contains(event.target)) closeTokenPopover();
  });

  // Paste from Word: strip formatting + normalise whitespace, and
  // — when every line starts with a Word-style bullet glyph (○ ●
  // • ▪ ◦ ▫ ‣ – etc) — turn the paragraphs into a proper <ul><li>
  // list instead of leaving the literal glyph + tab sitting in
  // the text (which rendered with Word's font fallback and looked
  // broken).
  const BULLET_LINE_RE = /^[\s ]*[\u2022\u25CB\u25CF\u25AA\u25C6\u25E6\u2023\u00B7\u2013-][\s ]+/;
  tplSectionsHost?.addEventListener("paste", (event) => {
    const target = event.target;
    if (!target || !target.matches || !target.matches("[data-paragraph], [data-intro-paragraph]")) return;
    event.preventDefault();
    const raw = (event.clipboardData || window.clipboardData)?.getData("text/plain") || "";
    const cleaned = raw
      .replace(/\u00a0/g, " ")
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .replace(/\r\n?/g, "\n")
      .replace(/[ \t]+/g, " ")
      .trim();
    if (!cleaned) return;
    const lines = cleaned.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    const allBulleted = lines.length >= 2 && lines.every((l) => BULLET_LINE_RE.test(l));
    if (allBulleted) {
      const items = lines
        .map((l) => l.replace(BULLET_LINE_RE, "").trim())
        .filter(Boolean)
        .map((t) => `<li>${escText(t)}</li>`)
        .join("");
      try {
        document.execCommand("insertHTML", false, `<ul>${items}</ul>`);
        return;
      } catch (_) {}
    }
    document.execCommand("insertText", false, cleaned);
  });

  tplSectionsHost?.addEventListener("click", (event) => {
    // Sync both intro + sections from current DOM before mutating.
    editorIntro = readEditorIntro();
    editorSections = readEditorSections();

    if (event.target.matches("[data-intro-add]")) {
      editorIntro.push("");
      renderEditorSections();
      return;
    }
    if (event.target.matches("[data-intro-remove]")) {
      const iIdx = Number(event.target.dataset.paragraphIndex);
      editorIntro.splice(iIdx, 1);
      renderEditorSections();
      return;
    }

    const sectionNode = event.target.closest("[data-section-index]");
    if (!sectionNode) return;
    const sIdx = Number(sectionNode.dataset.sectionIndex);
    if (event.target.matches("[data-paragraph-add]")) {
      editorSections[sIdx].paragraphs.push("");
      renderEditorSections();
    } else if (event.target.matches("[data-paragraph-remove]")) {
      const pIdx = Number(event.target.dataset.paragraphIndex);
      editorSections[sIdx].paragraphs.splice(pIdx, 1);
      renderEditorSections();
    } else if (event.target.matches("[data-section-remove]")) {
      editorSections.splice(sIdx, 1);
      renderEditorSections();
    }
  });

  tplAddSectionBtn?.addEventListener("click", () => {
    editorIntro = readEditorIntro();
    editorSections = readEditorSections();
    editorSections.push({ title: "", paragraphs: [""] });
    renderEditorSections();
  });

  tplSaveBtn?.addEventListener("click", async () => {
    const intro = readEditorIntro();
    const sections = readEditorSections();
    if (tplStatus) tplStatus.textContent = "Saving…";
    try {
      const url = editorMode === "edit"
        ? `/api/contract-templates/${encodeURIComponent(editorEditingId)}`
        : "/api/contract-templates";
      await apiRequest(url, {
        method: "POST",
        body: JSON.stringify({ name: editorName, intro, sections }),
      });
      closeEditor();
      await loadTemplatesIntoSelect();
    } catch (err) {
      if (tplStatus) tplStatus.textContent = err.message || "Could not save.";
    }
  });

  tplEditor?.addEventListener("click", (event) => {
    if (event.target.matches('[data-action="close-template-editor"]')) closeEditor();
  });

  // ── List modal (View templates) ────────────────────────────────
  async function renderTemplateListModal() {
    const entries = await loadTemplatesIntoSelect();
    if (!tplListHost) return;
    const defaultRow = `
      <tr class="contract-template-default-row">
        <td><strong>Анхдагч (Default)</strong> <span class="muted">— built-in</span></td>
        <td class="muted">8 sections</td>
        <td class="muted">TravelX</td>
        <td class="muted">—</td>
        <td>
          <button type="button" class="header-action-btn" data-tpl-action="view" data-id="__default__">View</button>
          <button type="button" class="header-action-btn" data-tpl-action="clone" data-id="__default__">Clone &amp; edit</button>
        </td>
      </tr>
    `;
    const creatorName = (e) => {
      const cb = e.createdBy || {};
      return cb.name || cb.fullName || cb.email || "—";
    };
    const customRows = entries.map((e) => `
      <tr>
        <td><strong>${escText(e.name)}</strong></td>
        <td>${(e.sections || []).length} sections · ${(e.sections || []).reduce((n, s) => n + (s.paragraphs || []).length, 0)} paragraphs</td>
        <td>${escText(creatorName(e))}</td>
        <td>${escText((e.updatedAt || "").slice(0, 10))}</td>
        <td>
          <button type="button" class="header-action-btn" data-tpl-action="view" data-id="${escAttr(e.id)}">View</button>
          <button type="button" class="header-action-btn" data-tpl-action="edit" data-id="${escAttr(e.id)}">Edit</button>
          <button type="button" class="header-action-btn button-danger" data-tpl-action="delete" data-id="${escAttr(e.id)}">Delete</button>
        </td>
      </tr>
    `).join("");
    tplListHost.innerHTML = `
      <div class="camp-table-wrap">
        <table class="camp-table">
          <thead><tr><th>Name</th><th>Sections</th><th>Made by</th><th>Updated</th><th>Actions</th></tr></thead>
          <tbody>${defaultRow}${customRows}</tbody>
        </table>
      </div>
    `;
  }
  function openTemplateListModal() {
    if (!tplListModal) return;
    tplListModal.classList.remove("is-hidden");
    tplListModal.removeAttribute("hidden");
    document.body.classList.add("modal-open");
    renderTemplateListModal();
  }
  function closeTemplateListModal() {
    if (!tplListModal) return;
    tplListModal.classList.add("is-hidden");
    tplListModal.setAttribute("hidden", "");
    document.body.classList.remove("modal-open");
  }
  tplViewBtn?.addEventListener("click", openTemplateListModal);
  tplListModal?.addEventListener("click", async (event) => {
    if (event.target.matches('[data-action="close-template-list"]')) {
      closeTemplateListModal();
      return;
    }
    const btn = event.target.closest("[data-tpl-action]");
    if (!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.tplAction;
    if (id === "__default__" && (action === "view" || action === "clone")) {
      try {
        const data = await apiRequest("/api/contract-templates/default");
        const intro = Array.isArray(data?.intro) ? data.intro : [];
        const sections = Array.isArray(data?.sections) ? data.sections : [];
        if (action === "view") {
          editorMode = "view";
          editorEditingId = "";
          editorName = "Анхдагч (Default)";
          editorIntro = intro;
          editorSections = sections;
          if (tplEditorTitle) tplEditorTitle.textContent = `View template — ${editorName}`;
          closeTemplateListModal();
          openEditor();
        } else {
          // "Clone & edit": prompt for a new name, then open the
          // editor in create mode pre-filled with the default body.
          let name;
          try {
            name = await window.UI.prompt("New template name (e.g. JEJU, Korea-FIT):", {
              title: "Clone Default template",
              defaultValue: "",
              confirmLabel: "Continue",
            });
          } catch { return; }
          if (!name) return;
          editorMode = "create";
          editorEditingId = "";
          editorName = name;
          editorIntro = intro;
          editorSections = sections;
          if (tplEditorTitle) tplEditorTitle.textContent = `New template — ${name}`;
          closeTemplateListModal();
          openEditor();
        }
      } catch (err) {
        alert(err.message || "Could not open Default template.");
      }
      return;
    }
    if (action === "view" || action === "edit") {
      try {
        const data = await apiRequest(`/api/contract-templates/${encodeURIComponent(id)}`);
        const entry = data?.entry;
        if (!entry) throw new Error("Not found");
        editorMode = action;
        editorEditingId = id;
        editorName = entry.name || "";
        editorIntro = Array.isArray(entry.intro) ? entry.intro : [];
        editorSections = Array.isArray(entry.sections) ? entry.sections : [];
        if (tplEditorTitle) tplEditorTitle.textContent = `${action === "view" ? "View" : "Edit"} template — ${editorName}`;
        closeTemplateListModal();
        openEditor();
      } catch (err) {
        alert(err.message || "Could not open template.");
      }
    } else if (action === "delete") {
      try {
        const ok = await window.UI.confirm(
          "Delete this template? Existing contracts that referenced it will fall back to the default on re-render.",
          { title: "Delete template", dangerous: true, confirmLabel: "Delete" }
        );
        if (!ok) return;
        await apiRequest(`/api/contract-templates/${encodeURIComponent(id)}`, { method: "DELETE" });
        await renderTemplateListModal();
      } catch (err) {
        if (err) alert(err.message || "Could not delete.");
      }
    }
  });

  loadTemplatesIntoSelect();

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
