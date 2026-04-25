(function () {
  if (!window.location.pathname.startsWith("/trip-detail")) return;

  const listNode = document.getElementById("trip-invoices-list");
  const createBtn = document.getElementById("invoice-create-btn");
  if (!listNode || !createBtn) {
    console.warn("[invoice.js] missing nodes:", { listNode, createBtn });
    return;
  }
  console.log("[invoice.js] initialized");

  const tripId = new URLSearchParams(window.location.search).get("tripId") || "";
  let groups = [];
  let tourists = [];
  let invoices = [];
  let wizardStep = 1;
  let editingInvoiceId = "";
  let draft = null;

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function fmtMoney(n) {
    const num = Number(n) || 0;
    return num.toLocaleString("en-US") + " ₮";
  }

  async function fetchJson(url, options) {
    const res = await fetch(url, options);
    let data = {};
    try { data = await res.json(); } catch {}
    if (!res.ok) throw new Error(data.error || `Request failed: ${url}`);
    return data;
  }

  let contracts = [];
  async function loadAll() {
    if (!tripId) return;
    try {
      const [g, t, inv, contractsRes] = await Promise.all([
        fetchJson(`/api/tourist-groups?tripId=${encodeURIComponent(tripId)}`),
        fetchJson(`/api/tourists?tripId=${encodeURIComponent(tripId)}`),
        fetchJson(`/api/invoices?tripId=${encodeURIComponent(tripId)}`).catch(() => ({ entries: [] })),
        fetchJson("/api/contracts").catch(() => []),
      ]);
      groups = g.entries || [];
      tourists = t.entries || [];
      invoices = inv.entries || [];
      const list = Array.isArray(contractsRes) ? contractsRes : (contractsRes.entries || []);
      contracts = list.filter((c) => c.tripId === tripId);
      renderList();
    } catch (e) {
      listNode.innerHTML = `<p class="empty">Could not load invoices: ${escapeHtml(e.message)}</p>`;
    }
  }

  function fmtDateOnly(value) {
    if (!value) return "-";
    return String(value).split("T")[0];
  }

  function renderList() {
    const total = invoices.length + contracts.length;
    if (!total) {
      listNode.innerHTML = '<p class="empty">No invoices or contracts yet. Use the buttons at the top of the trip to add one.</p>';
      return;
    }
    let rowIndex = 0;
    const contractRows = contracts.map((c) => {
      rowIndex += 1;
      const data = c.data || {};
      const serial = data.contractSerial || c.id;
      const tourist = `${data.touristLastName || ""} ${data.touristFirstName || ""}`.trim() || "-";
      const manager = (c.createdBy && c.createdBy.name) || (c.updatedBy && c.updatedBy.name) || "-";
      const destination = data.destination || "-";
      const totalAmt = data.totalPrice ? Number(String(data.totalPrice).replace(/[^0-9.-]/g, "")) || 0 : 0;
      const status = c.status || "pending";
      const statusLabel = status === "signed" ? "Signed" : "Pending";
      const statusClass = status === "signed" ? "is-confirmed" : "is-pending";
      const pdfReady = c.pdfPath && String(c.pdfPath).endsWith(".pdf");
      const signed = status === "signed";
      const shareLink = `${window.location.origin}/contract/${c.id}`;
      const docxAttr = c.docxPath ? `href="${escapeHtml(c.docxPath)}" download` : "href=\"#\" data-disabled=\"1\"";
      return `
        <tr data-row-kind="contract" data-row-id="${escapeHtml(c.id)}">
          <td>${rowIndex}</td>
          <td><span class="trip-type-pill">Contract</span></td>
          <td><strong>${escapeHtml(serial)}</strong></td>
          <td>${escapeHtml(tourist)}</td>
          <td>${escapeHtml(manager)}</td>
          <td>${escapeHtml(destination)}</td>
          <td>${escapeHtml(fmtDateOnly(data.tripStartDate || data.contractDate))}</td>
          <td>${fmtMoney(totalAmt)}</td>
          <td><span class="status-pill ${statusClass}">${statusLabel}</span></td>
          <td>${escapeHtml(fmtDateOnly(c.createdAt))}</td>
          <td>
            <div class="contract-actions">
              <a class="secondary-button" href="/api/contracts/${encodeURIComponent(c.id)}/document?mode=view" target="_blank" rel="noreferrer">View</a>
              <button type="button" class="secondary-button" data-contract-action="edit" data-id="${escapeHtml(c.id)}" ${signed ? "disabled" : ""}>Edit</button>
              <a class="secondary-button" ${docxAttr}>Word</a>
              ${pdfReady
                ? `<a class="secondary-button ${signed ? "success-button" : ""}" href="/pdf-viewer?src=${encodeURIComponent("/api/contracts/" + c.id + "/document?mode=download")}&title=${encodeURIComponent(serial || "Contract")}" target="_blank" rel="noreferrer">${signed ? "Signed PDF" : "PDF"}</a>`
                : '<span class="muted">PDF pending</span>'}
              <a class="secondary-button" href="/api/contracts/${encodeURIComponent(c.id)}/invoice?mode=view" target="_blank" rel="noreferrer">Invoice</a>
              <button type="button" class="secondary-button" data-contract-action="copy" data-link="${escapeHtml(shareLink)}">Copy link</button>
              <button type="button" class="secondary-button danger-button" data-contract-action="delete" data-id="${escapeHtml(c.id)}">Delete</button>
            </div>
          </td>
        </tr>
      `;
    }).join("");
    const invoiceRows = invoices.map((inv) => {
      rowIndex += 1;
      const grp = groups.find((g) => g.id === inv.groupId);
      const status = inv.status || "draft";
      const statusClass = status === "paid" || status === "published"
        ? "is-confirmed"
        : status === "cancelled"
          ? "is-cancelled"
          : "is-pending";
      const issue = (inv.installments && inv.installments[0] && inv.installments[0].issueDate) || inv.createdAt;
      return `
        <tr data-row-kind="invoice" data-row-id="${escapeHtml(inv.id)}">
          <td>${rowIndex}</td>
          <td><span class="trip-type-pill">Invoice</span></td>
          <td><strong>#${escapeHtml(inv.serial)}</strong></td>
          <td>${escapeHtml(inv.payerName || "-")}</td>
          <td>${escapeHtml((inv.createdBy && inv.createdBy.name) || "-")}</td>
          <td>${escapeHtml(grp?.name || "-")}</td>
          <td>${escapeHtml(fmtDateOnly(issue))}</td>
          <td>${fmtMoney(inv.total)}</td>
          <td><span class="status-pill ${statusClass}">${escapeHtml(status)}</span></td>
          <td>${escapeHtml(fmtDateOnly(inv.createdAt))}</td>
          <td>
            <div class="contract-actions">
              <a class="secondary-button" href="/invoice-view?id=${encodeURIComponent(inv.id)}" target="_blank" rel="noreferrer">View</a>
              <button type="button" class="secondary-button" data-invoice-action="edit" data-id="${escapeHtml(inv.id)}">Edit</button>
              <button type="button" class="secondary-button" data-invoice-action="detail" data-id="${escapeHtml(inv.id)}">Details</button>
              <button type="button" class="secondary-button danger-button" data-invoice-action="delete" data-id="${escapeHtml(inv.id)}">Delete</button>
            </div>
          </td>
        </tr>
      `;
    }).join("");
    listNode.innerHTML = `
      <div class="table-scroll">
        <table class="contract-table contract-trip-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Type</th>
              <th>Serial</th>
              <th>Client</th>
              <th>Manager</th>
              <th>Destination</th>
              <th>Date</th>
              <th>Total</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>${contractRows}${invoiceRows}</tbody>
        </table>
      </div>
    `;
  }

  // ── Wizard ──
  function buildOverlay() {
    let overlay = document.getElementById("invoice-wizard-overlay");
    if (overlay) return overlay;
    overlay = document.createElement("div");
    overlay.id = "invoice-wizard-overlay";
    overlay.className = "camp-modal workspace-form-modal is-hidden";
    overlay.innerHTML = `
      <div class="camp-modal-backdrop" data-action="invoice-close"></div>
      <div class="camp-modal-dialog workspace-form-modal-dialog workspace-form-modal-dialog-wide">
        <div class="camp-modal-header">
          <div>
            <h2 id="invoice-wizard-title">Create Invoice</h2>
            <p class="camp-modal-copy" id="invoice-wizard-copy">Step 1 — Pick group, payer, participants.</p>
          </div>
          <button type="button" class="camp-modal-close" data-action="invoice-close" aria-label="Close">×</button>
        </div>
        <div id="invoice-wizard-body"></div>
        <div class="invoice-wizard-footer">
          <div class="invoice-step-dots" id="invoice-step-dots"></div>
          <div class="invoice-wizard-actions">
            <button type="button" class="secondary-button" id="invoice-back-btn">Back</button>
            <button type="button" id="invoice-next-btn">Next</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener("click", (e) => {
      if (e.target.dataset?.action === "invoice-close") closeWizard();
    });
    overlay.querySelector("#invoice-back-btn").addEventListener("click", () => {
      if (wizardStep > 1) { wizardStep -= 1; renderWizardStep(); }
    });
    overlay.querySelector("#invoice-next-btn").addEventListener("click", onWizardNext);
    return overlay;
  }

  function openWizard(invoice = null) {
    console.log("[invoice.js] openWizard", { invoice, groupCount: groups.length });
    editingInvoiceId = invoice?.id || "";
    draft = invoice
      ? JSON.parse(JSON.stringify(invoice))
      : {
          groupId: groups[0]?.id || "",
          payerId: "",
          payerName: "",
          participantIds: [],
          items: [{ description: "", qty: 1, price: 0 }],
          installments: [],
          currency: "MNT",
        };
    wizardStep = 1;
    const overlay = buildOverlay();
    overlay.classList.remove("is-hidden");
    overlay.removeAttribute("hidden");
    overlay.style.display = "flex";
    document.body.classList.add("modal-open");
    renderWizardStep();
  }

  function closeWizard() {
    const overlay = document.getElementById("invoice-wizard-overlay");
    if (overlay) {
      overlay.classList.add("is-hidden");
      overlay.style.display = "none";
    }
    document.body.classList.remove("modal-open");
    draft = null;
    editingInvoiceId = "";
  }

  function renderStepDots() {
    const dots = document.getElementById("invoice-step-dots");
    if (!dots) return;
    dots.innerHTML = [1, 2, 3].map((s) =>
      `<span class="invoice-dot ${s === wizardStep ? "is-active" : ""}"></span>`
    ).join("");
  }

  function renderWizardStep() {
    const body = document.getElementById("invoice-wizard-body");
    const copy = document.getElementById("invoice-wizard-copy");
    const nextBtn = document.getElementById("invoice-next-btn");
    const backBtn = document.getElementById("invoice-back-btn");
    if (!body) return;
    backBtn.disabled = wizardStep === 1;
    nextBtn.textContent = wizardStep === 3 ? "Finish" : "Next";
    if (wizardStep === 1) {
      copy.textContent = "Step 1 — Pick group, payer, participants.";
      body.innerHTML = renderStep1();
      wireStep1(body);
    } else if (wizardStep === 2) {
      copy.textContent = "Step 2 — Add prices to your invoice.";
      body.innerHTML = renderStep2();
      wireStep2(body);
    } else {
      copy.textContent = "Step 3 — Set up payment installments.";
      body.innerHTML = renderStep3();
      wireStep3(body);
    }
    renderStepDots();
  }

  function renderStep1() {
    const groupOpts = groups.map((g) => `<option value="${g.id}" ${g.id === draft.groupId ? "selected" : ""}>${escapeHtml(g.serial)} — ${escapeHtml(g.name)}</option>`).join("");
    const groupTourists = tourists.filter((t) => t.groupId === draft.groupId);
    const payerOpts = `<option value="">Same as participant…</option>` +
      groupTourists.map((t) => `<option value="${t.id}" ${t.id === draft.payerId ? "selected" : ""}>${escapeHtml((t.lastName || "") + " " + (t.firstName || ""))}</option>`).join("");
    const partRows = groupTourists.map((t) => `
      <label class="invoice-participant-row">
        <input type="checkbox" data-participant data-id="${t.id}" ${draft.participantIds.includes(t.id) ? "checked" : ""} />
        <span>${escapeHtml((t.lastName || "") + " " + (t.firstName || ""))}</span>
      </label>
    `).join("");
    return `
      <div class="invoice-wizard-section">
        <label class="invoice-field">
          <span>Group <span class="invoice-required">*</span></span>
          <select id="invoice-group-select">${groupOpts}</select>
        </label>
        <label class="invoice-field">
          <span>Payer <span class="invoice-required">*</span></span>
          <select id="invoice-payer-select">${payerOpts}</select>
          <input id="invoice-payer-name" placeholder="Or type payer name" value="${escapeHtml(draft.payerName || "")}" />
        </label>
        <div class="invoice-field">
          <span>Participants <span class="invoice-required">*</span></span>
          <label class="invoice-participant-row">
            <input type="checkbox" id="invoice-participants-all" />
            <span><strong>Select all</strong></span>
          </label>
          <div id="invoice-participants-list">${partRows || '<p class="empty">No tourists in this group yet.</p>'}</div>
        </div>
      </div>
    `;
  }

  function wireStep1(body) {
    body.querySelector("#invoice-group-select").addEventListener("change", (e) => {
      draft.groupId = e.target.value;
      draft.payerId = "";
      draft.participantIds = [];
      renderWizardStep();
    });
    const payerSelect = body.querySelector("#invoice-payer-select");
    const payerName = body.querySelector("#invoice-payer-name");
    payerSelect.addEventListener("change", () => {
      draft.payerId = payerSelect.value;
      const t = tourists.find((x) => x.id === draft.payerId);
      if (t) {
        draft.payerName = `${t.lastName || ""} ${t.firstName || ""}`.trim();
        payerName.value = draft.payerName;
      }
    });
    payerName.addEventListener("input", () => { draft.payerName = payerName.value; });
    const all = body.querySelector("#invoice-participants-all");
    all?.addEventListener("change", () => {
      const boxes = body.querySelectorAll("[data-participant]");
      boxes.forEach((b) => { b.checked = all.checked; });
      draft.participantIds = all.checked ? Array.from(boxes).map((b) => b.dataset.id) : [];
    });
    body.addEventListener("change", (e) => {
      if (e.target.matches("[data-participant]")) {
        const id = e.target.dataset.id;
        if (e.target.checked) draft.participantIds.push(id);
        else draft.participantIds = draft.participantIds.filter((x) => x !== id);
      }
    });
  }

  function renderStep2() {
    const itemRows = draft.items.map((it, i) => `
      <div class="invoice-item-row" data-item-index="${i}">
        <input class="invoice-item-desc" placeholder="Write a description" value="${escapeHtml(it.description || "")}" />
        <input class="invoice-item-qty" type="number" min="0" step="1" value="${escapeHtml(it.qty)}" />
        <input class="invoice-item-price" type="number" min="0" step="0.01" value="${escapeHtml(it.price)}" />
        <span class="invoice-item-total">${fmtMoney((Number(it.qty) || 0) * (Number(it.price) || 0))}</span>
        <button type="button" class="table-link compact secondary" data-action="invoice-item-remove">×</button>
      </div>
    `).join("");
    const grand = draft.items.reduce((acc, it) => acc + (Number(it.qty) || 0) * (Number(it.price) || 0), 0);
    return `
      <div class="invoice-wizard-section">
        <div class="invoice-items-head">
          <span>Description</span><span>Qty</span><span>Price</span><span>Total</span><span></span>
        </div>
        <div id="invoice-items-list">${itemRows}</div>
        <button type="button" class="secondary-button invoice-add-item" data-action="invoice-item-add">+ Add item</button>
        <div class="invoice-grand-total">Total: <strong>${fmtMoney(grand)}</strong></div>
      </div>
    `;
  }

  function wireStep2(body) {
    function recompute() { renderWizardStep(); }
    body.querySelector("[data-action='invoice-item-add']").addEventListener("click", () => {
      draft.items.push({ description: "", qty: 1, price: 0 });
      recompute();
    });
    body.addEventListener("click", (e) => {
      if (e.target.dataset?.action === "invoice-item-remove") {
        const idx = Number(e.target.closest(".invoice-item-row")?.dataset.itemIndex);
        if (!Number.isNaN(idx)) {
          draft.items.splice(idx, 1);
          if (!draft.items.length) draft.items.push({ description: "", qty: 1, price: 0 });
          recompute();
        }
      }
    });
    body.addEventListener("input", (e) => {
      const row = e.target.closest(".invoice-item-row");
      if (!row) return;
      const idx = Number(row.dataset.itemIndex);
      const item = draft.items[idx];
      if (!item) return;
      if (e.target.classList.contains("invoice-item-desc")) item.description = e.target.value;
      else if (e.target.classList.contains("invoice-item-qty")) item.qty = Number(e.target.value) || 0;
      else if (e.target.classList.contains("invoice-item-price")) item.price = Number(e.target.value) || 0;
      const totalCell = row.querySelector(".invoice-item-total");
      if (totalCell) totalCell.textContent = fmtMoney((Number(item.qty) || 0) * (Number(item.price) || 0));
      const grand = draft.items.reduce((a, it) => a + (Number(it.qty) || 0) * (Number(it.price) || 0), 0);
      const grandNode = body.querySelector(".invoice-grand-total strong");
      if (grandNode) grandNode.textContent = fmtMoney(grand);
    });
  }

  function totalPrice() {
    return draft.items.reduce((a, it) => a + (Number(it.qty) || 0) * (Number(it.price) || 0), 0);
  }

  function renderStep3() {
    const total = totalPrice();
    const sumInst = (draft.installments || []).reduce((a, i) => a + (Number(i.amount) || 0), 0);
    const diff = total - sumInst;
    const today = new Date().toISOString().slice(0, 10);
    const rows = (draft.installments || []).map((inst, i) => `
      <div class="invoice-installment" data-inst-index="${i}">
        <div class="invoice-installment-head">
          <strong>Installment ${i + 1}</strong>
          <button type="button" class="table-link compact secondary" data-action="inst-remove">Remove</button>
        </div>
        <div class="invoice-installment-grid">
          <label>Description<input data-inst-field="description" value="${escapeHtml(inst.description || "")}" /></label>
          <label>Issue Date<input type="date" data-inst-field="issueDate" value="${escapeHtml(inst.issueDate || today)}" /></label>
          <label>Due Date<input type="date" data-inst-field="dueDate" value="${escapeHtml(inst.dueDate || "")}" /></label>
          <label>Amount<input type="number" min="0" step="0.01" data-inst-field="amount" value="${escapeHtml(inst.amount || 0)}" /></label>
        </div>
      </div>
    `).join("");
    return `
      <div class="invoice-wizard-section">
        <div class="invoice-inst-toolbar">
          <button type="button" class="secondary-button" data-action="inst-add">+ Add installment</button>
          <button type="button" class="secondary-button" data-action="inst-split-30-70">+ Split 30/70</button>
          <button type="button" class="secondary-button" data-action="inst-full">+ Full payment</button>
        </div>
        <div id="invoice-installments-list">${rows || '<p class="empty">No installments yet.</p>'}</div>
        <div class="invoice-totals">
          <div>Total Installments: <strong>${fmtMoney(sumInst)}</strong></div>
          <div>Total Price: <strong>${fmtMoney(total)}</strong></div>
          <div class="${diff !== 0 ? "is-warning" : ""}">Difference: <strong>${fmtMoney(diff)}</strong></div>
        </div>
      </div>
    `;
  }

  function wireStep3(body) {
    const today = new Date().toISOString().slice(0, 10);
    body.addEventListener("click", (e) => {
      const action = e.target.dataset?.action;
      if (action === "inst-add") {
        draft.installments.push({ description: "Installment", issueDate: today, dueDate: "", amount: 0, status: "pending" });
        renderWizardStep();
      } else if (action === "inst-split-30-70") {
        const total = totalPrice();
        draft.installments = [
          { description: "30% deposit", issueDate: today, dueDate: "", amount: Math.round(total * 0.3), status: "pending" },
          { description: "70% balance", issueDate: today, dueDate: "", amount: total - Math.round(total * 0.3), status: "pending" },
        ];
        renderWizardStep();
      } else if (action === "inst-full") {
        draft.installments = [
          { description: "Full payment", issueDate: today, dueDate: "", amount: totalPrice(), status: "pending" },
        ];
        renderWizardStep();
      } else if (action === "inst-remove") {
        const idx = Number(e.target.closest(".invoice-installment")?.dataset.instIndex);
        if (!Number.isNaN(idx)) {
          draft.installments.splice(idx, 1);
          renderWizardStep();
        }
      }
    });
    body.addEventListener("input", (e) => {
      const row = e.target.closest(".invoice-installment");
      if (!row) return;
      const idx = Number(row.dataset.instIndex);
      const inst = draft.installments[idx];
      if (!inst) return;
      const field = e.target.dataset.instField;
      if (!field) return;
      inst[field] = field === "amount" ? Number(e.target.value) || 0 : e.target.value;
      const sumNode = body.querySelector(".invoice-totals strong");
      if (sumNode) {
        const sum = draft.installments.reduce((a, i) => a + (Number(i.amount) || 0), 0);
        sumNode.textContent = fmtMoney(sum);
      }
    });
  }

  async function onWizardNext() {
    if (wizardStep === 1) {
      if (!draft.groupId) return alert("Pick a group.");
      if (!draft.payerName) return alert("Enter payer name.");
      if (!draft.participantIds.length) return alert("Pick at least one participant.");
      wizardStep = 2; renderWizardStep(); return;
    }
    if (wizardStep === 2) {
      const valid = draft.items.filter((it) => (it.description || "").trim());
      if (!valid.length) return alert("Add at least one item with a description.");
      draft.items = valid;
      wizardStep = 3; renderWizardStep(); return;
    }
    // Step 3 → save
    try {
      const payload = {
        tripId,
        groupId: draft.groupId,
        payerId: draft.payerId,
        payerName: draft.payerName,
        participantIds: draft.participantIds,
        items: draft.items,
        installments: draft.installments,
        currency: draft.currency || "MNT",
      };
      const url = editingInvoiceId ? `/api/invoices/${editingInvoiceId}` : "/api/invoices";
      await fetchJson(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      closeWizard();
      await loadAll();
    } catch (err) {
      alert(err.message || "Could not save invoice.");
    }
  }

  // ── Detail modal ──
  function openDetailModal(invoice) {
    const grp = groups.find((g) => g.id === invoice.groupId);
    let modal = document.getElementById("invoice-detail-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "invoice-detail-modal";
      modal.className = "camp-modal workspace-form-modal";
      document.body.appendChild(modal);
      modal.addEventListener("click", (e) => {
        if (e.target.dataset?.action === "detail-close") modal.classList.add("is-hidden");
      });
    }
    modal.classList.remove("is-hidden");
    document.body.classList.add("modal-open");
    const itemsHtml = (invoice.items || []).map((it) => `
      <tr>
        <td>${escapeHtml(it.description)}</td>
        <td class="table-center">${escapeHtml(it.qty)}</td>
        <td class="table-right">${fmtMoney(it.price)}</td>
        <td class="table-right">${fmtMoney(it.total)}</td>
      </tr>
    `).join("");
    const installmentsHtml = (invoice.installments || []).map((inst, idx) => `
      <div class="invoice-installment-display">
        <div class="invoice-installment-display-row">
          <strong>${escapeHtml(inst.description)}</strong>
          <span>Issue: ${escapeHtml(inst.issueDate || "-")}</span>
          <span>Due: ${escapeHtml(inst.dueDate || "-")}</span>
          <span class="invoice-status invoice-status-${escapeHtml(inst.status || "pending")}">${escapeHtml(inst.status || "pending")}</span>
          <strong class="table-right">${fmtMoney(inst.amount)}</strong>
          <button type="button" class="table-link compact secondary" data-action="register-payment" data-invoice-id="${invoice.id}" data-installment-index="${idx}">Register payment</button>
        </div>
      </div>
    `).join("") || '<p class="empty">No installments.</p>';
    const isPublished = invoice.status === "published";
    const shareUrl = isPublished ? `${window.location.origin}/invoice-view?id=${invoice.id}` : "";
    modal.innerHTML = `
      <div class="camp-modal-backdrop" data-action="detail-close"></div>
      <div class="camp-modal-dialog workspace-form-modal-dialog workspace-form-modal-dialog-wide">
        <div class="camp-modal-header">
          <div>
            <h2>Invoice #${escapeHtml(invoice.serial)}</h2>
            <p class="camp-modal-copy">${escapeHtml(grp?.name || "")} · Status: ${escapeHtml(invoice.status)}</p>
          </div>
          <div class="invoice-detail-actions">
            <button type="button" class="secondary-button" data-action="detail-edit" data-id="${invoice.id}">Edit</button>
            ${isPublished
              ? `<button type="button" class="secondary-button" data-action="detail-share" data-id="${invoice.id}">Share</button>`
              : `<button type="button" id="invoice-publish-btn" data-id="${invoice.id}">Publish</button>`}
            <a class="secondary-button" href="/invoice-view?id=${invoice.id}" target="_blank" rel="noreferrer">View / PDF</a>
            <button type="button" class="camp-modal-close" data-action="detail-close" aria-label="Close">×</button>
          </div>
        </div>
        <div class="invoice-detail-body">
          <div class="invoice-detail-row">
            <div><span class="invoice-detail-label">Payer</span><strong>${escapeHtml(invoice.payerName || "-")}</strong></div>
            <div><span class="invoice-detail-label">Participants</span><strong>${invoice.participantIds.length}</strong></div>
            <div><span class="invoice-detail-label">Currency</span><strong>${escapeHtml(invoice.currency)}</strong></div>
          </div>
          <h3>Price Details</h3>
          <table class="camp-table reservation-addon-table">
            <thead><tr><th>Description</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
            <tbody>${itemsHtml}</tbody>
            <tfoot><tr><td colspan="3" class="table-right"><strong>Total</strong></td><td class="table-right"><strong>${fmtMoney(invoice.total)}</strong></td></tr></tfoot>
          </table>
          <h3>Installments</h3>
          ${installmentsHtml}
          ${isPublished ? `<div class="invoice-share-row"><span>Share URL:</span> <input value="${escapeHtml(shareUrl)}" readonly /></div>` : ""}
        </div>
      </div>
    `;
    modal.querySelector("#invoice-publish-btn")?.addEventListener("click", async (e) => {
      try {
        const id = e.target.dataset.id;
        await fetchJson(`/api/invoices/${id}/publish`, { method: "POST" });
        await loadAll();
        const updated = invoices.find((x) => x.id === id);
        if (updated) openDetailModal(updated);
      } catch (err) { alert(err.message || "Publish failed"); }
    });
    modal.querySelectorAll("[data-action='register-payment']").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.invoiceId;
        const idx = Number(btn.dataset.installmentIndex);
        const dt = prompt("Paid date (YYYY-MM-DD):", new Date().toISOString().slice(0, 10));
        if (!dt) return;
        try {
          await fetchJson(`/api/invoices/${id}/payment`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ installmentIndex: idx, status: "paid", paidDate: dt }),
          });
          await loadAll();
          const updated = invoices.find((x) => x.id === id);
          if (updated) openDetailModal(updated);
        } catch (err) { alert(err.message || "Payment failed"); }
      });
    });
    modal.querySelector("[data-action='detail-edit']")?.addEventListener("click", () => {
      modal.classList.add("is-hidden");
      openWizard(invoice);
    });
    modal.querySelector("[data-action='detail-share']")?.addEventListener("click", () => {
      navigator.clipboard?.writeText(shareUrl).then(() => alert("Link copied to clipboard."));
    });
  }

  // ── Wire ──
  createBtn.addEventListener("click", async (event) => {
    event.preventDefault();
    console.log("[invoice.js] Create invoice clicked");
    try {
      if (!groups.length) {
        try { await loadAll(); } catch (err) { console.error("[invoice.js] reload error", err); }
      }
      if (!groups.length) {
        alert("Add a group to this trip first, then create an invoice for it.");
        return;
      }
      openWizard(null);
    } catch (err) {
      console.error("[invoice.js] open wizard failed", err);
      alert("Could not open invoice wizard: " + (err && err.message ? err.message : err));
    }
  });

  listNode.addEventListener("click", async (e) => {
    const invBtn = e.target.closest("[data-invoice-action]");
    if (invBtn) {
      const id = invBtn.dataset.id;
      const invoice = invoices.find((x) => x.id === id);
      if (!invoice) return;
      const action = invBtn.dataset.invoiceAction;
      if (action === "detail" || action === "view") openDetailModal(invoice);
      else if (action === "edit") openWizard(invoice);
      else if (action === "delete") {
        if (!confirm(`Delete invoice #${invoice.serial}?`)) return;
        try {
          await fetchJson(`/api/invoices/${id}`, { method: "DELETE" });
          await loadAll();
        } catch (err) { alert(err.message || "Could not delete"); }
      }
      return;
    }
    const ctrBtn = e.target.closest("[data-contract-action]");
    if (ctrBtn) {
      const action = ctrBtn.dataset.contractAction;
      if (action === "copy") {
        const link = ctrBtn.dataset.link || "";
        try {
          await navigator.clipboard.writeText(link);
          const label = ctrBtn.textContent;
          ctrBtn.textContent = "Copied";
          setTimeout(() => { ctrBtn.textContent = label; }, 1500);
        } catch { alert("Could not copy."); }
        return;
      }
      const id = ctrBtn.dataset.id;
      if (action === "delete") {
        if (!confirm("Delete this contract?")) return;
        try {
          await fetchJson(`/api/contracts/${id}`, { method: "DELETE" });
          await loadAll();
        } catch (err) { alert(err.message || "Could not delete contract."); }
      } else if (action === "edit") {
        // Re-launch /contracts editor with the contract pre-loaded
        window.open(`/contracts?editId=${encodeURIComponent(id)}#${encodeURIComponent(id)}`, "_blank", "noreferrer");
      }
      return;
    }
  });

  loadAll().then(() => {
    const params = new URLSearchParams(window.location.search);
    const preselectGroup = params.get("openInvoice");
    const fitOpen = params.get("openInvoiceFit");
    if (preselectGroup && groups.find((g) => g.id === preselectGroup)) {
      openWizard(null);
      const groupSelect = document.querySelector("#invoice-group-select");
      if (groupSelect) {
        groupSelect.value = preselectGroup;
        groupSelect.dispatchEvent(new Event("change"));
      }
    } else if (fitOpen && groups.length) {
      openWizard(null);
    } else if (fitOpen) {
      alert("Add a group to this trip first, then create an invoice for it.");
    }
  });
})();
