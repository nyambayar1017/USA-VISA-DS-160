(function () {
  if (!window.location.pathname.startsWith("/trip-detail")) return;

  const invoicesListNode = document.getElementById("trip-invoices-list");
  const contractsListNode = document.getElementById("trip-contracts-list");
  const createBtn = document.getElementById("invoice-create-btn");
  const addContractBtn = document.getElementById("trip-add-contract-btn");

  if (!invoicesListNode || !contractsListNode || !createBtn) {
    console.warn("[invoice.js] missing nodes");
    return;
  }

  const tripId = new URLSearchParams(window.location.search).get("tripId") || "";
  let trip = null;
  let groups = [];
  let tourists = [];
  let invoices = [];
  let contracts = [];
  let wizardStep = 1;
  let editingInvoiceId = "";
  let draft = null;
  const expandedInvoiceIds = new Set();

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function fmtMoney(n) {
    const num = Number(String(n || 0).replace(/[^0-9.-]/g, "")) || 0;
    return num.toLocaleString("en-US") + " ₮";
  }

  function fmtDateOnly(value) {
    if (!value) return "-";
    return String(value).split("T")[0];
  }

  function fmtDateShort(value) {
    if (!value) return "-";
    return String(value).split("T")[0];
  }

  async function fetchJson(url, options) {
    const res = await fetch(url, options);
    let data = {};
    try { data = await res.json(); } catch {}
    if (!res.ok) throw new Error(data.error || `Request failed: ${url}`);
    return data;
  }

  // "+ Add contract" opens the modal in-place on the trip page (no nav).
  // Pre-fills destination/dates from trip and shows a tourist picker.
  if (addContractBtn) {
    addContractBtn.removeAttribute("href");
    addContractBtn.setAttribute("role", "button");
    addContractBtn.style.cursor = "pointer";
    addContractBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      if (typeof window.openContractModal !== "function") {
        window.location.href = `/contracts?openCreate=1&tripId=${encodeURIComponent(tripId)}`;
        return;
      }
      const norm = (s) => String(s || "").trim().toLowerCase();
      const onlyGroup = groups.length === 1 ? groups[0] : null;
      const leaderName = norm(onlyGroup?.leaderName);
      const leaderTourist = leaderName
        ? tourists.find((tt) => {
            const a = norm(`${tt.lastName || ""} ${tt.firstName || ""}`);
            const b = norm(`${tt.firstName || ""} ${tt.lastName || ""}`);
            return a === leaderName || b === leaderName;
          })
        : null;
      const adultCount = tourists.filter((tt) => {
        const cat = String(tt.category || tt.ageGroup || "").toLowerCase();
        return !cat || cat === "adult" || cat === "том";
      }).length || tourists.length || 1;
      const childCount = tourists.filter((tt) => {
        const cat = String(tt.category || tt.ageGroup || "").toLowerCase();
        return cat === "child" || cat === "хүүхэд";
      }).length;
      await window.openContractModal({
        tripId,
        groupId: onlyGroup?.id || "",
        tourists: tourists.map((tt) => ({
          id: tt.id,
          lastName: tt.lastName,
          firstName: tt.firstName,
          registrationNumber: tt.registrationNumber || tt.register || tt.registerNumber,
        })),
        defaultTouristId: leaderTourist?.id || tourists[0]?.id,
        prefill: {
          destination: trip?.destination || trip?.tripName || trip?.country || "",
          tripStartDate: trip?.startDate || trip?.tripStartDate || "",
          tripEndDate: trip?.endDate || trip?.tripEndDate || "",
          adultCount,
          childCount,
        },
        onSuccess: () => loadAll(),
      });
    });
  }

  async function loadAll() {
    if (!tripId) return;
    try {
      const [tripsRes, g, t, inv, contractsRes] = await Promise.all([
        fetchJson("/api/camp-trips").catch(() => ({ entries: [] })),
        fetchJson(`/api/tourist-groups?tripId=${encodeURIComponent(tripId)}`),
        fetchJson(`/api/tourists?tripId=${encodeURIComponent(tripId)}`),
        fetchJson(`/api/invoices?tripId=${encodeURIComponent(tripId)}`).catch(() => ({ entries: [] })),
        fetchJson("/api/contracts").catch(() => []),
      ]);
      const tripsList = Array.isArray(tripsRes) ? tripsRes : (tripsRes.entries || []);
      trip = tripsList.find((tt) => tt.id === tripId) || null;
      groups = g.entries || [];
      tourists = t.entries || [];
      invoices = inv.entries || [];
      const list = Array.isArray(contractsRes) ? contractsRes : (contractsRes.entries || []);
      contracts = list.filter((c) => c.tripId === tripId);
      renderContractsList();
      renderInvoicesList();
    } catch (e) {
      invoicesListNode.innerHTML = `<p class="empty">Could not load invoices: ${escapeHtml(e.message)}</p>`;
      contractsListNode.innerHTML = `<p class="empty">Could not load contracts: ${escapeHtml(e.message)}</p>`;
    }
  }

  // ── Contracts list — exact /contracts table design ──
  function renderContractsList() {
    if (!contracts.length) {
      contractsListNode.innerHTML = '<p class="empty">No contracts yet. Use + Add contract to create one.</p>';
      return;
    }
    contractsListNode.innerHTML = `
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
            ${contracts.map((c, i) => {
              const data = c.data || {};
              const lastName = data.touristLastName || "-";
              const firstName = data.touristFirstName || "-";
              const manager = (c.createdBy && c.createdBy.name) || (c.updatedBy && c.updatedBy.name) || "-";
              const status = c.status || "pending";
              const statusLabel = status === "signed" ? "Signed" : "Pending";
              const statusClass = status === "signed" ? "status-confirmed" : "status-pending";
              const pdfReady = c.pdfPath && String(c.pdfPath).endsWith(".pdf");
              const signed = status === "signed";
              const shareLink = `${window.location.origin}/contract/${c.id}`;
              return `
                <tr>
                  <td>${i + 1}</td>
                  <td>${escapeHtml(data.contractSerial || "-")}</td>
                  <td>${escapeHtml(lastName)}</td>
                  <td>${escapeHtml(firstName)}</td>
                  <td>${escapeHtml(manager)}</td>
                  <td>${escapeHtml(data.destination || "-")}</td>
                  <td>${escapeHtml(fmtDateOnly(data.tripStartDate || data.contractDate))}</td>
                  <td><span class="status-pill ${statusClass}">${statusLabel}</span></td>
                  <td>${escapeHtml(fmtDateOnly(c.createdAt))}</td>
                  <td>
                    <div class="contract-actions">
                      <a class="secondary-button" href="/api/contracts/${encodeURIComponent(c.id)}/document?mode=view" target="_blank" rel="noreferrer">View</a>
                      <button class="secondary-button" data-contract-action="edit" data-id="${escapeHtml(c.id)}" ${signed ? "disabled" : ""}>Edit</button>
                      <a class="secondary-button" href="${escapeHtml(c.docxPath || "#")}" download>Word</a>
                      ${pdfReady
                        ? `<a class="secondary-button ${signed ? "success-button" : ""}" href="/pdf-viewer?src=${encodeURIComponent("/api/contracts/" + c.id + "/document?mode=download")}&title=${encodeURIComponent(data.contractSerial || "Contract")}" target="_blank" rel="noreferrer">${signed ? "Signed PDF" : "PDF"}</a>`
                        : '<span class="muted">PDF pending</span>'}
                      <a class="secondary-button" href="/api/contracts/${encodeURIComponent(c.id)}/invoice?mode=view" target="_blank" rel="noreferrer">Invoice</a>
                      <button class="secondary-button" data-contract-action="copy" data-link="${escapeHtml(shareLink)}">Copy link</button>
                      <button class="secondary-button danger-button" data-contract-action="delete" data-id="${escapeHtml(c.id)}">Delete</button>
                    </div>
                  </td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  // ── Invoices list — Image #68 compact rows + expandable installments ──
  function renderInvoicesList() {
    if (!invoices.length) {
      invoicesListNode.innerHTML = '<p class="empty">No invoices yet. Use + Add invoice to create one.</p>';
      return;
    }
    const rows = invoices.map((inv) => {
      const expanded = expandedInvoiceIds.has(inv.id);
      const installmentRows = (inv.installments || []).map((ins) => {
        const status = (ins.status || "pending").toLowerCase();
        const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
        return `
          <div class="inv-installment-line">
            <span class="inv-inst-desc">${escapeHtml(ins.description || "-")}</span>
            <span class="inv-inst-amount">${fmtMoney(ins.amount)}</span>
            <span class="inv-inst-status"><span class="payment-status payment-status-${status}">${statusLabel}</span></span>
            <span class="inv-inst-due">${escapeHtml(fmtDateShort(ins.dueDate))}</span>
          </div>
        `;
      }).join("") || '<div class="inv-installment-line"><span class="inv-inst-desc muted">No installments</span></div>';
      return `
        <div class="inv-row ${expanded ? "is-expanded" : ""}" data-invoice-id="${escapeHtml(inv.id)}">
          <div class="inv-row-main">
            <button type="button" class="inv-chevron" data-inv-action="toggle" data-id="${escapeHtml(inv.id)}" aria-label="Toggle">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            <input type="checkbox" class="inv-row-check" data-inv-check data-id="${escapeHtml(inv.id)}" />
            <span class="inv-cell inv-serial">
              <a href="#" class="inv-serial-link" data-inv-action="open" data-id="${escapeHtml(inv.id)}">${escapeHtml(inv.serial || inv.id)}</a>
            </span>
            <span class="inv-cell inv-payer">${escapeHtml(inv.payerName || "-")}</span>
            <span class="inv-cell inv-total">${fmtMoney(inv.total)}</span>
            <span class="inv-row-actions">
              <button type="button" class="inv-row-action-btn" data-inv-action="open" data-id="${escapeHtml(inv.id)}" title="Edit" aria-label="Edit">✎</button>
              <button type="button" class="inv-row-action-btn is-danger" data-inv-action="delete" data-id="${escapeHtml(inv.id)}" title="Delete" aria-label="Delete">✕</button>
            </span>
            <details class="inv-row-menu">
              <summary aria-label="Actions">⋯</summary>
              <div class="inv-row-menu-popover">
                <button type="button" data-inv-action="open" data-id="${escapeHtml(inv.id)}">Edit</button>
                <button type="button" data-inv-action="open-view" data-id="${escapeHtml(inv.id)}">View</button>
                <button type="button" data-inv-action="copy-row" data-id="${escapeHtml(inv.id)}">Copy link</button>
                <button type="button" class="is-danger" data-inv-action="delete" data-id="${escapeHtml(inv.id)}">Delete</button>
              </div>
            </details>
          </div>
          <div class="inv-row-installments">
            ${installmentRows}
          </div>
        </div>
      `;
    }).join("");
    invoicesListNode.innerHTML = `
      <div class="inv-table">
        <div class="inv-row inv-row-header">
          <div class="inv-row-main">
            <span class="inv-chevron-spacer"></span>
            <input type="checkbox" class="inv-row-check" id="inv-check-all" />
            <span class="inv-cell inv-serial-h">Serial</span>
            <span class="inv-cell inv-payer-h">Payer</span>
            <span class="inv-cell inv-total-h">Total</span>
          </div>
          <div class="inv-row-installments inv-row-installments-h">
            <span class="inv-inst-desc">Description</span>
            <span class="inv-inst-amount">Amount</span>
            <span class="inv-inst-status">Status</span>
            <span class="inv-inst-due">Due Date</span>
          </div>
        </div>
        ${rows}
      </div>
    `;
  }

  // ── Invoice side panel — Image #69 ──
  function ensureSidePanel() {
    let panel = document.getElementById("inv-side-panel");
    if (panel) return panel;
    panel = document.createElement("aside");
    panel.id = "inv-side-panel";
    panel.className = "inv-side-panel is-hidden";
    panel.innerHTML = `
      <div class="inv-side-backdrop" data-inv-action="close-panel"></div>
      <div class="inv-side-dialog">
        <div class="inv-side-header">
          <h2 id="inv-side-title">Invoice</h2>
          <div class="inv-side-header-actions">
            <button type="button" class="inv-text-btn" data-inv-action="copy">Copy link</button>
            <button type="button" class="inv-text-btn" data-inv-action="open-view">Open</button>
            <button type="button" class="inv-icon-btn" data-inv-action="close-panel" aria-label="Close">×</button>
          </div>
        </div>
        <div class="inv-side-body" id="inv-side-body"></div>
      </div>
    `;
    document.body.appendChild(panel);
    panel.addEventListener("click", (e) => {
      const action = e.target.closest("[data-inv-action]")?.dataset?.invAction;
      if (action === "close-panel") closeSidePanel();
      if (action === "copy") {
        const id = panel.dataset.invoiceId;
        const link = `${window.location.origin}/invoice-view?id=${id}`;
        const btn = e.target.closest("[data-inv-action='copy']");
        navigator.clipboard?.writeText(link).then(() => {
          if (!btn) return;
          const t = btn.textContent;
          btn.textContent = "Copied";
          setTimeout(() => { btn.textContent = t; }, 1200);
        });
      }
      if (action === "open-view") {
        const id = panel.dataset.invoiceId;
        window.open(`/invoice-view?id=${id}`, "_blank");
      }
      if (action === "publish-now") {
        const id = panel.dataset.invoiceId;
        publishInvoice(id);
      }
      const editAction = e.target.closest("[data-inv-edit]")?.dataset?.invEdit;
      if (editAction === "payer") openEditPayerModal();
      if (editAction === "price") openEditPriceModal();
      if (editAction === "installments") openEditInstallmentsModal();
      const regBtn = e.target.closest("[data-inv-action='register-payment']");
      if (regBtn) registerPayment(Number(regBtn.dataset.idx));
    });
    return panel;
  }

  let sidePanelInvoice = null;
  function openSidePanel(invoice) {
    sidePanelInvoice = invoice;
    const panel = ensureSidePanel();
    panel.dataset.invoiceId = invoice.id;
    panel.classList.remove("is-hidden");
    document.body.classList.add("modal-open");
    renderSidePanel();
  }
  function closeSidePanel() {
    const panel = document.getElementById("inv-side-panel");
    if (panel) panel.classList.add("is-hidden");
    document.body.classList.remove("modal-open");
    sidePanelInvoice = null;
  }
  function renderSidePanel() {
    if (!sidePanelInvoice) return;
    const inv = sidePanelInvoice;
    const titleNode = document.getElementById("inv-side-title");
    const body = document.getElementById("inv-side-body");
    if (titleNode) titleNode.textContent = `Invoice ${inv.serial || inv.id}`;
    const participantNames = (inv.participantIds || [])
      .map((id) => tourists.find((t) => t.id === id))
      .filter(Boolean)
      .map((t) => `${t.lastName || ""} ${t.firstName || ""}`.trim())
      .join(", ") || "-";
    const itemRows = (inv.items || []).map((it) => `
      <tr>
        <td>${escapeHtml(it.description || "-")}</td>
        <td class="t-right">${fmtMoney(it.price)}</td>
        <td class="t-center">${escapeHtml(it.qty)}</td>
        <td class="t-right">${fmtMoney((Number(it.qty) || 0) * (Number(it.price) || 0))}</td>
      </tr>
    `).join("");
    const installmentCards = (inv.installments || []).map((ins, idx) => {
      const status = (ins.status || "pending").toLowerCase();
      const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
      return `
        <div class="inv-side-installment">
          <div class="inv-side-inst-grid">
            <div class="inv-side-inst-desc">${escapeHtml(ins.description || "-")}</div>
            <div>
              <div class="inv-side-inst-label">Issue Date</div>
              <div>${escapeHtml(fmtDateOnly(ins.issueDate))}</div>
            </div>
            <div>
              <div class="inv-side-inst-label">Due Date</div>
              <div>${escapeHtml(fmtDateOnly(ins.dueDate))}</div>
            </div>
            <div>
              <div class="inv-side-inst-label">Status</div>
              <div><span class="payment-status payment-status-${status}">${statusLabel}</span></div>
            </div>
            <div class="inv-side-inst-amount">${fmtMoney(ins.amount)}</div>
          </div>
          <button type="button" class="inv-side-register" data-inv-action="register-payment" data-idx="${idx}">
            <span class="inv-side-register-icon">+</span> Register payment
          </button>
        </div>
      `;
    }).join("") || '<p class="empty">No installments yet.</p>';

    const isPublished = inv.status === "published";
    const pubLabel = isPublished ? "Published" : (inv.status || "Draft").charAt(0).toUpperCase() + (inv.status || "draft").slice(1);

    body.innerHTML = `
      <div class="inv-side-card">
        <div class="inv-side-row">
          <div class="inv-side-row-label">Payer</div>
          <div class="inv-side-row-value">${escapeHtml(inv.payerName || "-")}</div>
          <button type="button" class="inv-side-edit" data-inv-edit="payer" aria-label="Edit payer">${pencilSvg()}</button>
        </div>
        <div class="inv-side-row">
          <div class="inv-side-row-label">Participants</div>
          <div class="inv-side-row-value">${escapeHtml(participantNames)}</div>
          <button type="button" class="inv-side-edit" data-inv-edit="payer" aria-label="Edit participants">${pencilSvg()}</button>
        </div>
        <div class="inv-side-row">
          <div class="inv-side-row-label">Publication Status</div>
          <div class="inv-side-row-value">
            ${escapeHtml(pubLabel)}
            ${isPublished ? "" : `<button type="button" class="inv-publish-btn" data-inv-action="publish-now">Publish</button>`}
          </div>
          <span class="inv-side-edit-spacer"></span>
        </div>
      </div>

      <div class="inv-side-card">
        <div class="inv-side-card-head">
          <div>
            <h3>Price Details</h3>
            <p class="inv-side-card-sub">All prices in MNT</p>
          </div>
          <button type="button" class="inv-side-edit" data-inv-edit="price" aria-label="Edit price">${pencilSvg()}</button>
        </div>
        <table class="inv-side-table">
          <thead>
            <tr><th>Description</th><th class="t-right">Price</th><th class="t-center">Qty</th><th class="t-right">Total</th></tr>
          </thead>
          <tbody>
            ${itemRows}
            <tr class="inv-side-table-total">
              <td colspan="3" class="t-right"><strong>Total</strong></td>
              <td class="t-right"><strong>${fmtMoney(inv.total)}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="inv-side-card">
        <div class="inv-side-card-head">
          <h3>Installments</h3>
          <button type="button" class="inv-side-edit" data-inv-edit="installments" aria-label="Edit installments">${pencilSvg()}</button>
        </div>
        ${installmentCards}
      </div>
    `;
  }

  function pencilSvg() {
    return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
  }

  async function publishInvoice(id) {
    try {
      await fetchJson(`/api/invoices/${id}/publish`, { method: "POST" });
      await loadAll();
      const updated = invoices.find((x) => x.id === id);
      if (updated) openSidePanel(updated);
    } catch (err) { alert(err.message || "Publish failed"); }
  }
  async function deleteInvoice(id) {
    if (!(await UI.confirm("Delete this invoice?", { dangerous: true }))) return;
    try {
      await fetchJson(`/api/invoices/${id}`, { method: "DELETE" });
      closeSidePanel();
      await loadAll();
    } catch (err) { alert(err.message || "Delete failed"); }
  }
  async function registerPayment(idx) {
    if (!sidePanelInvoice) return;
    const dt = await UI.prompt("Paid date (YYYY-MM-DD):", { defaultValue: new Date().toISOString().slice(0, 10) });
    if (!dt) return;
    // Optional free-text note so the manager can record context ("paid only
    // for his father, not his mother", etc). User cancellation / empty
    // string both leave the note unset.
    const note = await UI.prompt("Note (optional — context for this payment):", { defaultValue: "" });
    const body = { installmentIndex: idx, status: "paid", paidDate: dt };
    if (note != null) body.note = note;
    try {
      await fetchJson(`/api/invoices/${sidePanelInvoice.id}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      await loadAll();
      const updated = invoices.find((x) => x.id === sidePanelInvoice.id);
      if (updated) openSidePanel(updated);
    } catch (err) { alert(err.message || "Payment failed"); }
  }

  // ── Edit modals (#70 #71 #72) ──
  function ensureEditModal() {
    let m = document.getElementById("inv-edit-modal");
    if (m) return m;
    m = document.createElement("div");
    m.id = "inv-edit-modal";
    m.className = "inv-edit-modal is-hidden";
    m.innerHTML = `
      <div class="inv-edit-backdrop" data-inv-action="close-edit"></div>
      <div class="inv-edit-dialog">
        <button type="button" class="inv-edit-close" data-inv-action="close-edit" aria-label="Close">×</button>
        <div class="inv-edit-header">
          <h2 id="inv-edit-title">Edit</h2>
          <p class="inv-edit-sub" id="inv-edit-sub"></p>
        </div>
        <div class="inv-edit-body" id="inv-edit-body"></div>
        <div class="inv-edit-footer">
          <button type="button" class="inv-edit-cancel" data-inv-action="close-edit">Cancel</button>
          <button type="button" class="inv-edit-save" data-inv-action="save-edit">Save Changes</button>
        </div>
      </div>
    `;
    document.body.appendChild(m);
    m.addEventListener("click", (e) => {
      const a = e.target.closest("[data-inv-action]")?.dataset?.invAction;
      if (a === "close-edit") closeEditModal();
      if (a === "save-edit") saveEditModal();
    });
    return m;
  }
  let editKind = "";
  function openEditModal(kind, title, sub) {
    editKind = kind;
    const m = ensureEditModal();
    document.getElementById("inv-edit-title").textContent = title;
    document.getElementById("inv-edit-sub").textContent = sub;
    m.classList.remove("is-hidden");
    document.body.classList.add("modal-open");
  }
  function closeEditModal() {
    const m = document.getElementById("inv-edit-modal");
    if (m) m.classList.add("is-hidden");
    document.body.classList.remove("modal-open");
    editKind = "";
  }

  function openEditPayerModal() {
    if (!sidePanelInvoice) return;
    openEditModal("payer", "Edit Payer & Participants", "Update the payer and participants for this invoice.");
    const body = document.getElementById("inv-edit-body");
    const groupTourists = tourists.filter((t) => t.groupId === sidePanelInvoice.groupId);
    body.innerHTML = `
      <label class="inv-edit-field">
        <span>Payer name <span class="inv-required">*</span></span>
        <input id="inv-edit-payer-name" value="${escapeHtml(sidePanelInvoice.payerName || "")}" />
      </label>
      <label class="inv-edit-field">
        <span>Payer address</span>
        <input id="inv-edit-payer-address" value="${escapeHtml(sidePanelInvoice.payerAddress || "")}" placeholder="Enter payer address" />
      </label>
      <div class="inv-edit-field">
        <span>Participants <span class="inv-required">*</span></span>
        <label class="inv-participant-row">
          <input type="checkbox" id="inv-edit-select-all" />
          <span>Select All</span>
        </label>
        <div id="inv-edit-participants">
          ${groupTourists.map((t) => {
            const checked = (sidePanelInvoice.participantIds || []).includes(t.id);
            return `
              <label class="inv-participant-row">
                <input type="checkbox" data-pid="${t.id}" ${checked ? "checked" : ""} />
                <span>${escapeHtml(`${t.lastName || ""} ${t.firstName || ""}`.trim())}</span>
              </label>
            `;
          }).join("")}
        </div>
      </div>
    `;
    body.querySelector("#inv-edit-select-all").addEventListener("change", (e) => {
      body.querySelectorAll("[data-pid]").forEach((c) => { c.checked = e.target.checked; });
    });
  }

  function openEditPriceModal() {
    if (!sidePanelInvoice) return;
    openEditModal("price", "Edit Price Details", "Add or modify price items for this invoice.");
    renderEditPriceBody();
  }
  function renderEditPriceBody() {
    const items = JSON.parse(JSON.stringify(sidePanelInvoice.items || []));
    if (!items.length) items.push({ description: "", qty: 1, price: 0 });
    sidePanelInvoice._editItems = items;
    const body = document.getElementById("inv-edit-body");
    const grand = items.reduce((a, it) => a + (Number(it.qty) || 0) * (Number(it.price) || 0), 0);
    body.innerHTML = `
      <div class="inv-price-head">
        <span>Description</span>
        <span class="t-center">Qty</span>
        <span class="t-right">Price</span>
        <span class="t-right">Total</span>
      </div>
      <div id="inv-price-rows">
        ${items.map((it, i) => priceRowHtml(it, i)).join("")}
      </div>
      <button type="button" class="inv-add-item" id="inv-add-item-btn">+ Add Item</button>
      <div class="inv-price-total"><span>Total</span><strong>${fmtMoney(grand)}</strong></div>
    `;
    body.querySelector("#inv-add-item-btn").addEventListener("click", () => {
      sidePanelInvoice._editItems.push({ description: "", qty: 1, price: 0 });
      renderEditPriceBody();
    });
    body.addEventListener("input", priceRowInput);
    body.addEventListener("click", priceRowClick);
  }
  function priceRowHtml(it, i) {
    const total = (Number(it.qty) || 0) * (Number(it.price) || 0);
    return `
      <div class="inv-price-row" data-row-i="${i}">
        <button type="button" class="inv-price-remove" data-action="remove-row" aria-label="Remove">⋮</button>
        <input class="inv-price-desc" data-field="description" value="${escapeHtml(it.description || "")}" placeholder="Description" />
        <input class="inv-price-qty" type="number" min="0" data-field="qty" value="${escapeHtml(it.qty || 0)}" />
        <input class="inv-price-price" type="number" min="0" data-field="price" value="${escapeHtml(it.price || 0)}" />
        <span class="inv-price-total-cell">${fmtMoney(total)}</span>
      </div>
    `;
  }
  function priceRowInput(e) {
    const row = e.target.closest(".inv-price-row");
    if (!row) return;
    const i = Number(row.dataset.rowI);
    const field = e.target.dataset.field;
    if (!field) return;
    sidePanelInvoice._editItems[i][field] = field === "qty" || field === "price" ? Number(e.target.value) || 0 : e.target.value;
    const it = sidePanelInvoice._editItems[i];
    row.querySelector(".inv-price-total-cell").textContent = fmtMoney((Number(it.qty) || 0) * (Number(it.price) || 0));
    const grand = sidePanelInvoice._editItems.reduce((a, x) => a + (Number(x.qty) || 0) * (Number(x.price) || 0), 0);
    const tNode = document.querySelector("#inv-edit-body .inv-price-total strong");
    if (tNode) tNode.textContent = fmtMoney(grand);
  }
  function priceRowClick(e) {
    if (e.target.closest("[data-action='remove-row']")) {
      const row = e.target.closest(".inv-price-row");
      if (!row) return;
      const i = Number(row.dataset.rowI);
      sidePanelInvoice._editItems.splice(i, 1);
      renderEditPriceBody();
    }
  }

  function openEditInstallmentsModal() {
    if (!sidePanelInvoice) return;
    openEditModal("installments", "Edit Installments", "Add or modify installments for this invoice.");
    renderEditInstallmentsBody();
  }
  function renderEditInstallmentsBody() {
    const list = JSON.parse(JSON.stringify(sidePanelInvoice.installments || []));
    sidePanelInvoice._editInstallments = list;
    const body = document.getElementById("inv-edit-body");
    const total = (sidePanelInvoice.items || []).reduce((a, it) => a + (Number(it.qty) || 0) * (Number(it.price) || 0), 0);
    const sumInst = list.reduce((a, i) => a + (Number(i.amount) || 0), 0);
    const diff = total - sumInst;
    body.innerHTML = `
      <div id="inv-inst-list">
        ${list.map((ins, i) => installmentCardHtml(ins, i, list.length)).join("")}
      </div>
      <button type="button" class="inv-add-item" id="inv-add-inst-btn">+ Add installment</button>
      <div class="inv-inst-totals">
        <div><span>Total Installments:</span><strong>${fmtMoney(sumInst)}</strong></div>
        <div><span>Total Price:</span><strong>${fmtMoney(total)}</strong></div>
        <div class="${diff !== 0 ? "is-warning" : ""}"><span>Difference:</span><strong>${fmtMoney(diff)}</strong></div>
      </div>
    `;
    body.querySelector("#inv-add-inst-btn").addEventListener("click", () => {
      sidePanelInvoice._editInstallments.push({
        description: "Installment",
        issueDate: new Date().toISOString().slice(0, 10),
        dueDate: "",
        amount: 0,
        status: "pending",
      });
      renderEditInstallmentsBody();
    });
    body.addEventListener("input", instInput);
    body.addEventListener("click", instClick);
  }
  function installmentCardHtml(ins, i, total) {
    const expanded = i === 0;
    return `
      <div class="inv-inst-card ${expanded ? "is-expanded" : ""}" data-i="${i}">
        <div class="inv-inst-card-head">
          <strong>Installment ${i + 1}</strong>
          <div>
            <button type="button" data-action="toggle-inst" aria-label="Toggle">${expanded ? "▾" : "▸"}</button>
            <button type="button" data-action="remove-inst" aria-label="Remove">⋮</button>
          </div>
        </div>
        ${expanded ? `
          <div class="inv-inst-card-body">
            <label>Description<input data-field="description" value="${escapeHtml(ins.description || "")}" /></label>
            <div class="inv-inst-dates">
              <label>Due Date<input type="date" data-field="dueDate" value="${escapeHtml(ins.dueDate || "")}" /></label>
              <label>Issue Date<input type="date" data-field="issueDate" value="${escapeHtml(ins.issueDate || "")}" /></label>
            </div>
            <div class="inv-inst-chips">
              <button type="button" class="inv-chip" data-chip="7">7 days</button>
              <button type="button" class="inv-chip" data-chip="14">14 days</button>
              <button type="button" class="inv-chip" data-chip="30">30 days</button>
              <button type="button" class="inv-chip inv-chip-bell" title="Reminder">🔔</button>
            </div>
            <label>Amount<input type="number" min="0" data-field="amount" value="${escapeHtml(ins.amount || 0)}" /></label>
            <div class="inv-inst-chips">
              <button type="button" class="inv-chip" data-deposit="30">30% deposit</button>
              <button type="button" class="inv-chip" data-deposit="50">50% deposit</button>
              <button type="button" class="inv-chip" data-balance="1">Balance</button>
            </div>
          </div>
        ` : `
          <div class="inv-inst-card-summary">
            <span>${escapeHtml(ins.description || "-")}</span>
            <span>Due: ${escapeHtml(fmtDateShort(ins.dueDate))}</span>
            <strong>${fmtMoney(ins.amount)}</strong>
          </div>
        `}
      </div>
    `;
  }
  function instInput(e) {
    const card = e.target.closest(".inv-inst-card");
    if (!card) return;
    const i = Number(card.dataset.i);
    const field = e.target.dataset.field;
    if (!field) return;
    sidePanelInvoice._editInstallments[i][field] =
      field === "amount" ? Number(e.target.value) || 0 : e.target.value;
    refreshInstTotals();
  }
  function refreshInstTotals() {
    const list = sidePanelInvoice._editInstallments || [];
    const total = (sidePanelInvoice.items || []).reduce((a, it) => a + (Number(it.qty) || 0) * (Number(it.price) || 0), 0);
    const sumInst = list.reduce((a, x) => a + (Number(x.amount) || 0), 0);
    const diff = total - sumInst;
    const totals = document.querySelector("#inv-edit-body .inv-inst-totals");
    if (!totals) return;
    totals.innerHTML = `
      <div><span>Total Installments:</span><strong>${fmtMoney(sumInst)}</strong></div>
      <div><span>Total Price:</span><strong>${fmtMoney(total)}</strong></div>
      <div class="${diff !== 0 ? "is-warning" : ""}"><span>Difference:</span><strong>${fmtMoney(diff)}</strong></div>
    `;
  }
  function instClick(e) {
    const card = e.target.closest(".inv-inst-card");
    if (!card) return;
    const i = Number(card.dataset.i);
    const list = sidePanelInvoice._editInstallments;
    const total = (sidePanelInvoice.items || []).reduce((a, it) => a + (Number(it.qty) || 0) * (Number(it.price) || 0), 0);
    if (e.target.closest("[data-action='toggle-inst']")) {
      card.classList.toggle("is-expanded");
      renderEditInstallmentsBody();
      return;
    }
    if (e.target.closest("[data-action='remove-inst']")) {
      list.splice(i, 1);
      renderEditInstallmentsBody();
      return;
    }
    const chip = e.target.closest("[data-chip]");
    if (chip) {
      const days = Number(chip.dataset.chip);
      const issue = list[i].issueDate || new Date().toISOString().slice(0, 10);
      const d = new Date(issue);
      d.setDate(d.getDate() + days);
      list[i].dueDate = d.toISOString().slice(0, 10);
      renderEditInstallmentsBody();
      return;
    }
    const dep = e.target.closest("[data-deposit]");
    if (dep) {
      const pct = Number(dep.dataset.deposit) / 100;
      list[i].amount = Math.round(total * pct);
      renderEditInstallmentsBody();
      return;
    }
    if (e.target.closest("[data-balance]")) {
      const others = list.reduce((a, x, j) => (j === i ? a : a + (Number(x.amount) || 0)), 0);
      list[i].amount = Math.max(total - others, 0);
      renderEditInstallmentsBody();
    }
  }

  async function saveEditModal() {
    if (!sidePanelInvoice) return;
    const body = document.getElementById("inv-edit-body");
    const payload = {};
    if (editKind === "payer") {
      payload.payerName = body.querySelector("#inv-edit-payer-name").value.trim();
      payload.payerAddress = body.querySelector("#inv-edit-payer-address").value.trim();
      payload.participantIds = Array.from(body.querySelectorAll("[data-pid]:checked")).map((c) => c.dataset.pid);
    } else if (editKind === "price") {
      payload.items = sidePanelInvoice._editItems.filter((it) => (it.description || "").trim());
    } else if (editKind === "installments") {
      payload.installments = sidePanelInvoice._editInstallments;
    }
    payload.tripId = tripId;
    payload.groupId = sidePanelInvoice.groupId;
    payload.payerName = payload.payerName ?? sidePanelInvoice.payerName;
    payload.payerId = sidePanelInvoice.payerId || "";
    payload.participantIds = payload.participantIds ?? sidePanelInvoice.participantIds;
    payload.items = payload.items ?? sidePanelInvoice.items;
    payload.installments = payload.installments ?? sidePanelInvoice.installments;
    payload.currency = sidePanelInvoice.currency || "MNT";
    try {
      await fetchJson(`/api/invoices/${sidePanelInvoice.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      closeEditModal();
      await loadAll();
      const updated = invoices.find((x) => x.id === sidePanelInvoice.id);
      if (updated) openSidePanel(updated);
    } catch (err) { alert(err.message || "Save failed."); }
  }

  // ── Wizard (Create) — keep existing 3-step wizard for "+ Add invoice" ──
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
    if (overlay) { overlay.classList.add("is-hidden"); overlay.style.display = "none"; }
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
    if (wizardStep === 1) { copy.textContent = "Step 1 — Pick group, payer, participants."; body.innerHTML = renderStep1(); wireStep1(body); }
    else if (wizardStep === 2) { copy.textContent = "Step 2 — Add prices to your invoice."; body.innerHTML = renderStep2(); wireStep2(body); }
    else { copy.textContent = "Step 3 — Set up payment installments."; body.innerHTML = renderStep3(); wireStep3(body); }
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
      draft.groupId = e.target.value; draft.payerId = ""; draft.participantIds = []; renderWizardStep();
    });
    const payerSelect = body.querySelector("#invoice-payer-select");
    const payerName = body.querySelector("#invoice-payer-name");
    payerSelect.addEventListener("change", () => {
      draft.payerId = payerSelect.value;
      const t = tourists.find((x) => x.id === draft.payerId);
      if (t) { draft.payerName = `${t.lastName || ""} ${t.firstName || ""}`.trim(); payerName.value = draft.payerName; }
    });
    payerName.addEventListener("input", () => { draft.payerName = payerName.value; });
    body.querySelector("#invoice-participants-all")?.addEventListener("change", (e) => {
      const boxes = body.querySelectorAll("[data-participant]");
      boxes.forEach((b) => { b.checked = e.target.checked; });
      draft.participantIds = e.target.checked ? Array.from(boxes).map((b) => b.dataset.id) : [];
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
        <div class="invoice-items-head"><span>Description</span><span>Qty</span><span>Price</span><span>Total</span><span></span></div>
        <div id="invoice-items-list">${itemRows}</div>
        <button type="button" class="secondary-button invoice-add-item" data-action="invoice-item-add">+ Add item</button>
        <div class="invoice-grand-total">Total: <strong>${fmtMoney(grand)}</strong></div>
      </div>
    `;
  }
  function wireStep2(body) {
    body.querySelector("[data-action='invoice-item-add']").addEventListener("click", () => {
      draft.items.push({ description: "", qty: 1, price: 0 }); renderWizardStep();
    });
    body.addEventListener("click", (e) => {
      if (e.target.dataset?.action === "invoice-item-remove") {
        const idx = Number(e.target.closest(".invoice-item-row")?.dataset.itemIndex);
        if (!Number.isNaN(idx)) {
          draft.items.splice(idx, 1);
          if (!draft.items.length) draft.items.push({ description: "", qty: 1, price: 0 });
          renderWizardStep();
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
      if (action === "inst-add") { draft.installments.push({ description: "Installment", issueDate: today, dueDate: "", amount: 0, status: "pending" }); renderWizardStep(); }
      else if (action === "inst-split-30-70") {
        const total = totalPrice();
        draft.installments = [
          { description: "30% deposit", issueDate: today, dueDate: "", amount: Math.round(total * 0.3), status: "pending" },
          { description: "70% balance", issueDate: today, dueDate: "", amount: total - Math.round(total * 0.3), status: "pending" },
        ]; renderWizardStep();
      } else if (action === "inst-full") {
        draft.installments = [{ description: "Full payment", issueDate: today, dueDate: "", amount: totalPrice(), status: "pending" }];
        renderWizardStep();
      } else if (action === "inst-remove") {
        const idx = Number(e.target.closest(".invoice-installment")?.dataset.instIndex);
        if (!Number.isNaN(idx)) { draft.installments.splice(idx, 1); renderWizardStep(); }
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
      draft.items = valid; wizardStep = 3; renderWizardStep(); return;
    }
    try {
      const payload = {
        tripId, groupId: draft.groupId, payerId: draft.payerId, payerName: draft.payerName,
        participantIds: draft.participantIds, items: draft.items, installments: draft.installments,
        currency: draft.currency || "MNT",
      };
      const url = editingInvoiceId ? `/api/invoices/${editingInvoiceId}` : "/api/invoices";
      await fetchJson(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      closeWizard();
      await loadAll();
    } catch (err) { alert(err.message || "Could not save invoice."); }
  }

  // No silent auto-create: invoices need a group, but the user wants to
  // manage groups by hand so they aren't surprised by auto-named ones.
  // If the trip has none, throw a friendly error and the caller surfaces it.
  async function ensureDefaultGroup() {
    if (groups.length) return;
    try { await loadAll(); } catch {}
    if (groups.length) return;
    throw new Error("Please add a group on the trip first, then create the invoice.");
  }

  // ── Wire ──
  createBtn.addEventListener("click", async (event) => {
    event.preventDefault();
    try {
      await ensureDefaultGroup();
      if (!groups.length) {
        alert("Could not prepare a group for this invoice. Try again.");
        return;
      }
      openWizard(null);
    } catch (err) {
      alert("Could not open invoice wizard: " + (err.message || err));
    }
  });

  invoicesListNode.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-inv-action]");
    if (!btn) return;
    const action = btn.dataset.invAction;
    const id = btn.dataset.id;
    const invoice = invoices.find((x) => x.id === id);
    if (action === "toggle") {
      if (expandedInvoiceIds.has(id)) expandedInvoiceIds.delete(id);
      else expandedInvoiceIds.add(id);
      renderInvoicesList();
      return;
    }
    if (action === "open" && invoice) {
      e.preventDefault();
      btn.closest("details.inv-row-menu")?.removeAttribute("open");
      openSidePanel(invoice);
      return;
    }
    if (action === "open-view") {
      e.preventDefault();
      btn.closest("details.inv-row-menu")?.removeAttribute("open");
      window.open(`/invoice-view?id=${id}`, "_blank");
      return;
    }
    if (action === "copy-row") {
      btn.closest("details.inv-row-menu")?.removeAttribute("open");
      try {
        await navigator.clipboard.writeText(`${window.location.origin}/invoice-view?id=${id}`);
        const t = btn.textContent;
        btn.textContent = "Copied";
        setTimeout(() => { btn.textContent = t; }, 1200);
      } catch { alert("Could not copy."); }
      return;
    }
    if (action === "delete" && invoice) {
      btn.closest("details.inv-row-menu")?.removeAttribute("open");
      if (!(await UI.confirm(`Delete invoice #${invoice.serial || invoice.id}?`, { dangerous: true }))) return;
      try {
        await fetchJson(`/api/invoices/${id}`, { method: "DELETE" });
        await loadAll();
      } catch (err) { alert(err.message || "Could not delete."); }
    }
  });
  // Auto-close any open row-menu on outside click
  document.addEventListener("click", (e) => {
    invoicesListNode.querySelectorAll("details.inv-row-menu[open]").forEach((det) => {
      if (!det.contains(e.target)) det.removeAttribute("open");
    });
  });

  contractsListNode.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-contract-action]");
    if (!btn) return;
    const action = btn.dataset.contractAction;
    if (action === "copy") {
      try {
        await navigator.clipboard.writeText(btn.dataset.link || "");
        const label = btn.textContent;
        btn.textContent = "Copied";
        setTimeout(() => { btn.textContent = label; }, 1500);
      } catch { alert("Could not copy."); }
      return;
    }
    const id = btn.dataset.id;
    if (action === "delete") {
      if (!(await UI.confirm("Delete this contract?", { dangerous: true }))) return;
      try {
        await fetchJson(`/api/contracts/${id}`, { method: "DELETE" });
        await loadAll();
      } catch (err) { alert(err.message || "Could not delete contract."); }
    } else if (action === "edit") {
      window.open(`/contracts?editId=${encodeURIComponent(id)}#${encodeURIComponent(id)}`, "_blank", "noreferrer");
    }
  });

  loadAll().then(async () => {
    const params = new URLSearchParams(window.location.search);
    const preselectGroup = params.get("openInvoice");
    const fitOpen = params.get("openInvoiceFit");
    if (preselectGroup && groups.find((g) => g.id === preselectGroup)) {
      openWizard(null);
      const groupSelect = document.querySelector("#invoice-group-select");
      if (groupSelect) { groupSelect.value = preselectGroup; groupSelect.dispatchEvent(new Event("change")); }
    } else if (fitOpen) {
      try { await ensureDefaultGroup(); } catch {}
      if (groups.length) openWizard(null);
    }
  });
})();
