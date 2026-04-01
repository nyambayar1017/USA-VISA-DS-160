const CONTRACTS_ENDPOINT = "/api/contracts";

const qs = (selector, root = document) => root.querySelector(selector);
const qsa = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const formatDate = (value) => {
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
        if (text) message = text;
      } catch {}
    }
    if (!message) message = "Request failed";
    throw new Error(message);
  }
  return data;
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
            <th>Tourist</th>
            <th>Destination</th>
            <th>Contract Date</th>
            <th>Status</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${contracts
            .map((entry, index) => {
              const data = entry.data || {};
              const tourist = `${data.touristLastName || ""} ${data.touristFirstName || ""}`.trim();
              const status = entry.status || "pending";
              const statusLabel = status === "signed" ? "Signed" : "Pending";
              const statusClass = status === "signed" ? "status-confirmed" : "status-pending";
              const pdfReady = entry.pdfPath && entry.pdfPath.endsWith(".pdf");
              const shareLink = `${location.origin}/contract/${entry.id}`;
              return `
                <tr>
                  <td>${index + 1}</td>
                  <td>${data.contractSerial || "-"}</td>
                  <td>${tourist || "-"}</td>
                  <td>${data.destination || "-"}</td>
                  <td>${formatDate(data.contractDate)}</td>
                  <td><span class="status-pill ${statusClass}">${statusLabel}</span></td>
                  <td>${formatDate(entry.createdAt)}</td>
                  <td>
                    <div class="contract-actions">
                      <a class="secondary-button" href="/api/contracts/${entry.id}/document?mode=view" target="_blank">View</a>
                      <a class="secondary-button" href="${entry.docxPath}" download>Word</a>
                      ${pdfReady ? `<a class="secondary-button" href="/api/contracts/${entry.id}/document?mode=download" download>PDF</a>` : `<span class="muted">PDF pending</span>`}
                      <button class="secondary-button" data-copy-link="${shareLink}">Copy link</button>
                      <button class="table-action danger compact" data-delete-id="${entry.id}">Delete</button>
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
      if (!confirm("Delete this contract?")) return;
      await apiRequest(`${CONTRACTS_ENDPOINT}/${button.dataset.deleteId}`, { method: "DELETE" });
      loadContracts();
    });
  });
};

const loadContracts = async () => {
  try {
    const data = await apiRequest(CONTRACTS_ENDPOINT);
    const contracts = Array.isArray(data) ? data : data.contracts || data.entries || [];
    renderContractsTable(contracts);
  } catch (error) {
    const container = qs("#contract-list");
    if (container) {
      container.innerHTML = `<div class="empty-state">Failed to load contracts: ${error.message}</div>`;
    }
  }
};

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

  if (!panel || !toggle || !countSetup || !continueButton || !form) return;

  const openStepOne = () => {
    countSetup.classList.remove("is-hidden");
    form.classList.add("is-hidden");
  };

  const openStepTwo = () => {
    countSetup.classList.add("is-hidden");
    form.classList.remove("is-hidden");
  };

  const closePanel = () => {
    panel.classList.add("is-hidden");
    panel.setAttribute("hidden", "");
    openStepOne();
  };

  toggle.addEventListener("click", () => {
    panel.classList.remove("is-hidden");
    panel.removeAttribute("hidden");
    const dateInput = form.querySelector("input[name='contractDate']");
    if (dateInput && !dateInput.value) {
      dateInput.value = new Date().toISOString().split("T")[0];
    }
    openStepOne();
  });

  panel.addEventListener("click", (event) => {
    if (event.target.dataset.action === "close-contract-panel") closePanel();
    if (event.target.dataset.action === "contract-continue") {
      syncCountStepToForm();
      openStepTwo();
      form.scrollIntoView({ behavior: "smooth", block: "start" });
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
      await apiRequest(CONTRACTS_ENDPOINT, { method: "POST", body: JSON.stringify(payload) });
      statusEl.textContent = "Saved successfully";
      form.reset();
      closePanel();
      loadContracts();
      setTimeout(() => (statusEl.textContent = ""), 2000);
    } catch (error) {
      statusEl.textContent = error.message;
    }
  });

  // Ensure the panel is hidden on first load even if browser caches styles.
  closePanel();

  const loadManagers = async () => {
    if (!managerSelect) return;
    try {
      const data = await apiRequest("/api/camp-settings");
      const names = data?.entry?.staffAssignments || [];
      managerSelect.innerHTML =
        `<option value="">Менежер сонгох</option>` +
        names.map((name) => `<option value="${name}">${name}</option>`).join("");
      if (names.length === 1) {
        managerSelect.value = names[0];
        managerSelect.dispatchEvent(new Event("change"));
      }
    } catch {}
  };

  managerSelect?.addEventListener("change", () => {
    const value = managerSelect.value || "";
    if (!value) {
      if (managerLastInput) managerLastInput.value = "";
      if (managerFirstInput) managerFirstInput.value = "";
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
  const durationInput = form.querySelector("input[name='tripDuration']");
  const travelerInput = form.querySelector("input[name='travelerCount']");
  const totalPriceInput = form.querySelector("input[name='totalPrice']");
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
    const depositInput = form.querySelector("input[name='depositAmount']");
    if (depositInput && !normalizeTextValue(depositInput.value)) depositInput.value = "0";
  };

  continueButton.addEventListener("click", () => {
    syncCountStepToForm();
    openStepTwo();
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  tripStartInput?.addEventListener("change", updateDuration);
  tripEndInput?.addEventListener("change", updateDuration);
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
  loadManagers();
};

const initSignatureCanvas = (canvas) => {
  const ctx = canvas.getContext("2d");
  ctx.strokeStyle = "#1b2a6b";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  let drawing = false;

  const getPos = (event) => {
    const rect = canvas.getBoundingClientRect();
    const touch = event.touches ? event.touches[0] : null;
    return {
      x: (touch ? touch.clientX : event.clientX) - rect.left,
      y: (touch ? touch.clientY : event.clientY) - rect.top,
    };
  };

  const startDraw = (event) => {
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

  initSignatureCanvas(canvas);

  try {
    const data = await apiRequest(`${CONTRACTS_ENDPOINT}/${contractId}`);
    const contract = data.contract;
    const info = contract.data || {};
    summaryEl.innerHTML = `
      <div class="summary-row">
        <div>
          <strong>${info.touristLastName || ""} ${info.touristFirstName || ""}</strong>
          <p>${info.destination || ""}</p>
          <p>Contract No: ${info.contractSerial || "-"}</p>
        </div>
        <a class="secondary-button" href="/api/contracts/${contractId}/document?mode=view" target="_blank">View contract</a>
      </div>
    `;
    if (previewFrame) {
      previewFrame.src = `/api/contracts/${contractId}/document?mode=view`;
    }
  } catch (error) {
    summaryEl.innerHTML = `<div class="empty-state">Unable to load contract.</div>`;
  }

  qs("#signature-clear")?.addEventListener("click", () => {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  });

  qs("#signature-submit")?.addEventListener("click", async () => {
    statusEl.textContent = "Saving signature...";
    const lastName = qs("#signer-last-name")?.value || "";
    const firstName = qs("#signer-first-name")?.value || "";
    const signerRegister = qs("#signer-register")?.value || "";
    const accepted = qs("#signer-accept")?.checked || false;
    if (!accepted) {
      statusEl.textContent = "Та гэрээг зөвшөөрөх ёстой.";
      return;
    }
    const signatureData = canvas.toDataURL("image/png");
    try {
      const result = await apiRequest(`${CONTRACTS_ENDPOINT}/${contractId}/sign`, {
        method: "POST",
        body: JSON.stringify({
          signatureData,
          signerName: `${lastName} ${firstName}`.trim(),
          signerLastName: lastName,
          signerFirstName: firstName,
          signerRegister,
          accepted,
        }),
      });
      statusEl.textContent = "Signed successfully.";
      if (result.contract?.pdfPath) {
        downloadEl.innerHTML = `<a class="secondary-button" href="${result.contract.pdfPath}" download>Download PDF</a>`;
      }
    } catch (error) {
      statusEl.textContent = error.message || "Could not confirm signature and generate PDF.";
    }
  });
};

document.addEventListener("DOMContentLoaded", () => {
  if (location.pathname === "/contracts") {
    initContractForm();
    loadContracts();
  }
  if (location.pathname.startsWith("/contract/")) {
    initContractSignPage();
  }
});
