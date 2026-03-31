const CONTRACTS_ENDPOINT = "/api/contracts";

const qs = (selector, root = document) => root.querySelector(selector);
const qsa = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const formatDate = (value) => {
  if (!value) return "-";
  return value.split("T")[0];
};

const apiRequest = async (url, options = {}) => {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error || "Request failed";
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
  const form = qs("#contract-form");
  const statusEl = qs("#contract-status");

  if (!panel || !toggle || !form) return;

  const closeModal = () => {
    panel.classList.add("is-hidden");
  };

  toggle.addEventListener("click", () => {
    panel.classList.remove("is-hidden");
  });

  panel.addEventListener("click", (event) => {
    if (event.target.dataset.action === "close-contract-modal") closeModal();
  });

  qsa(".camp-modal-close", panel).forEach((button) => {
    button.addEventListener("click", closeModal);
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
      closeModal();
      loadContracts();
      setTimeout(() => (statusEl.textContent = ""), 2000);
    } catch (error) {
      statusEl.textContent = error.message;
    }
  });
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
  } catch (error) {
    summaryEl.innerHTML = `<div class="empty-state">Unable to load contract.</div>`;
  }

  qs("#signature-clear")?.addEventListener("click", () => {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  });

  qs("#signature-submit")?.addEventListener("click", async () => {
    statusEl.textContent = "Saving signature...";
    const signerName = qs("#signer-name")?.value || "";
    const signatureData = canvas.toDataURL("image/png");
    try {
      const result = await apiRequest(`${CONTRACTS_ENDPOINT}/${contractId}/sign`, {
        method: "POST",
        body: JSON.stringify({ signatureData, signerName }),
      });
      statusEl.textContent = "Signed successfully.";
      if (result.contract?.pdfPath) {
        downloadEl.innerHTML = `<a class="secondary-button" href="${result.contract.pdfPath}" download>Download PDF</a>`;
      }
    } catch (error) {
      statusEl.textContent = error.message;
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
