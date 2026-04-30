// Accountant page: lists every approved payment-request with its proof
// receipt. The data comes from /api/accountant/paid (workspace-scoped on
// the server), filters live entirely client-side.

(function () {
  const tbody = document.getElementById("acct-tbody");
  const countNode = document.getElementById("acct-count");
  const searchInput = document.getElementById("acct-search");
  const currencySelect = document.getElementById("acct-currency");
  const bankSelect = document.getElementById("acct-bank");
  const dateFromInput = document.getElementById("acct-date-from");
  const dateToInput = document.getElementById("acct-date-to");
  const clearBtn = document.getElementById("acct-clear-filter");
  const selectAll = document.getElementById("acct-select-all");
  const bulkBtn = document.getElementById("acct-bulk-download");
  const viewDropdown = document.getElementById("acct-view-dropdown");

  let rows = [];
  const selected = new Set();

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function fmtAmount(value) {
    const n = Number(value || 0);
    return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  function uniq(arr) {
    return Array.from(new Set(arr.filter(Boolean))).sort();
  }

  async function load() {
    try {
      const res = await fetch("/api/accountant/paid");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load");
      rows = data.entries || [];
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="12" class="empty">${escapeHtml(err.message)}</td></tr>`;
      return;
    }
    populateFilters();
    render();
  }

  function populateFilters() {
    currencySelect.innerHTML = '<option value="">All currencies</option>'
      + uniq(rows.map((r) => r.currency))
        .map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`)
        .join("");
    bankSelect.innerHTML = '<option value="">All banks</option>'
      + uniq(rows.map((r) => r.bankLabel))
        .map((b) => `<option value="${escapeHtml(b)}">${escapeHtml(b)}</option>`)
        .join("");
  }

  function filtered() {
    const q = (searchInput.value || "").trim().toLowerCase();
    const ccy = currencySelect.value;
    const bank = bankSelect.value;
    const dateFrom = dateFromInput.value;
    const dateTo = dateToInput.value;
    return rows.filter((r) => {
      if (q) {
        const hay = `${r.payerName} ${r.tripName} ${r.tripSerial} ${r.invoiceSerial} ${r.manager}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (ccy && r.currency !== ccy) return false;
      if (bank && r.bankLabel !== bank) return false;
      if (dateFrom && (r.paidDate || "") < dateFrom) return false;
      if (dateTo && (r.paidDate || "") > dateTo) return false;
      return true;
    });
  }

  function applyViewToggles() {
    const checks = viewDropdown.querySelectorAll("[data-view-col]");
    checks.forEach((cb) => {
      const col = cb.dataset.viewCol;
      const cells = document.querySelectorAll(`[data-col="${col}"]`);
      cells.forEach((el) => {
        el.style.display = cb.checked ? "" : "none";
      });
    });
  }

  function isAdminOrAccountant() {
    const role = (window.currentUser?.role || "").toLowerCase();
    return role === "admin" || role === "accountant";
  }

  function render() {
    const list = filtered();
    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="14" class="empty">No payments match these filters.</td></tr>`;
      countNode.textContent = "0 of 0";
      bulkBtn.disabled = true;
      return;
    }
    const canDelete = isAdminOrAccountant();
    const canApprove = isAdminOrAccountant();
    tbody.innerHTML = list.map((r, i) => {
      const isPending = (r.status || "") === "pending";
      const isSel = selected.has(r.id);
      const downloadUrl = r.paidDocumentUrl ? `${r.paidDocumentUrl}?download=1` : "";
      const docCell = r.paidDocumentUrl
        ? `<a href="${escapeHtml(r.paidDocumentUrl)}" target="_blank" rel="noreferrer">${escapeHtml(r.paidDocumentName || "View")}</a>`
        : (isPending
            ? `<span class="acct-pending-doc">— awaiting receipt —</span>`
            : `<span class="muted">—</span>`);
      const tripCell = r.tripId
        ? `<a href="/trip-detail?tripId=${encodeURIComponent(r.tripId)}" class="trip-name-link">${escapeHtml(r.tripName || r.tripSerial || r.tripId)}</a>`
        : escapeHtml(r.tripName || "—");
      const numCell = r.paidDocumentUrl
        ? `<a href="${escapeHtml(r.paidDocumentUrl)}" target="_blank" rel="noreferrer">${i + 1}</a>`
        : (i + 1);
      const statusCell = isPending
        ? `<span class="payment-status waiting">Pending</span>`
        : `<span class="payment-status paid">Paid</span>`;

      // Build the kebab-menu items per row.
      const items = [];
      if (isPending && canApprove) {
        items.push(`<button type="button" class="row-action-item" data-acct-register data-id="${escapeHtml(r.id)}">+ Register payment</button>`);
      }
      if (r.paidDocumentUrl) {
        items.push(`<a class="row-action-item" href="${escapeHtml(downloadUrl)}" download>Download</a>`);
        items.push(`<a class="row-action-item" href="${escapeHtml(r.paidDocumentUrl)}" target="_blank" rel="noreferrer">Open</a>`);
        items.push(`<button type="button" class="row-action-item" data-acct-rename data-trip="${escapeHtml(r.tripId)}" data-doc="${escapeHtml(r.paidDocumentId)}" data-name="${escapeHtml(r.paidDocumentName || "")}">Rename</button>`);
        if (canDelete) {
          items.push(`<button type="button" class="row-action-item is-danger" data-acct-delete data-trip="${escapeHtml(r.tripId)}" data-doc="${escapeHtml(r.paidDocumentId)}" data-name="${escapeHtml(r.paidDocumentName || "")}">Delete</button>`);
        }
      }
      const actionsCell = items.length
        ? `<details class="trip-menu row-action-menu">
             <summary class="trip-menu-trigger" aria-label="Actions">⋯</summary>
             <div class="trip-menu-popover">${items.join("")}</div>
           </details>`
        : `<span class="muted">—</span>`;

      return `
        <tr class="${isPending ? "is-pending-row" : ""}">
          <td><input type="checkbox" data-acct-select="${escapeHtml(r.id)}" data-acct-url="${escapeHtml(downloadUrl)}" data-acct-name="${escapeHtml(r.paidDocumentName || "")}" ${isSel ? "checked" : ""} ${r.paidDocumentUrl ? "" : "disabled"}/></td>
          <td>${numCell}</td>
          <td>${escapeHtml(r.paidDate || "—")}</td>
          <td data-col="trip">${tripCell}</td>
          <td data-col="invoice">${escapeHtml(r.invoiceSerial || "—")}</td>
          <td data-col="payer">${escapeHtml(r.payerName || "—")}</td>
          <td>${escapeHtml(fmtAmount(r.amount))}</td>
          <td>${escapeHtml(r.currency || "—")}</td>
          <td data-col="bank">${escapeHtml(r.bankLabel || "—")}</td>
          <td data-col="manager">${escapeHtml(r.manager || "—")}</td>
          <td>${statusCell}</td>
          <td>${docCell}</td>
          <td data-col="note">${escapeHtml(r.note || "")}</td>
          <td class="acct-actions-cell">${actionsCell}</td>
        </tr>
      `;
    }).join("");
    countNode.textContent = `${list.length} of ${rows.length}`;
    bulkBtn.disabled = !selected.size;
    applyViewToggles();
  }

  searchInput?.addEventListener("input", render);
  currencySelect?.addEventListener("change", render);
  bankSelect?.addEventListener("change", render);
  dateFromInput?.addEventListener("change", render);
  dateToInput?.addEventListener("change", render);

  clearBtn?.addEventListener("click", () => {
    searchInput.value = "";
    currencySelect.value = "";
    bankSelect.value = "";
    dateFromInput.value = "";
    dateToInput.value = "";
    selected.clear();
    if (selectAll) selectAll.checked = false;
    render();
  });

  selectAll?.addEventListener("change", () => {
    const want = selectAll.checked;
    filtered().forEach((r) => {
      if (want) selected.add(r.id);
      else selected.delete(r.id);
    });
    render();
  });

  tbody?.addEventListener("change", (e) => {
    const cb = e.target.closest("[data-acct-select]");
    if (!cb) return;
    const id = cb.dataset.acctSelect;
    if (cb.checked) selected.add(id);
    else selected.delete(id);
    bulkBtn.disabled = !selected.size;
  });

  tbody?.addEventListener("click", async (e) => {
    const registerBtn = e.target.closest("[data-acct-register]");
    if (registerBtn) {
      e.preventDefault();
      // The approval modal lives in app-shell.js. It expects the request
      // to be in the global paymentRequestsCache; if it isn't (this row
      // came from /api/accountant/paid, not the ₮ popover) the modal
      // will refetch on its own.
      if (typeof window.openPaymentRequestApproveModal === "function") {
        window.openPaymentRequestApproveModal(registerBtn.dataset.id);
      }
      return;
    }
    const renameBtn = e.target.closest("[data-acct-rename]");
    if (renameBtn) {
      e.preventDefault();
      const trip = renameBtn.dataset.trip;
      const doc = renameBtn.dataset.doc;
      const current = renameBtn.dataset.name;
      const next = window.UI?.prompt
        ? await window.UI.prompt("Rename document", { initialValue: current, confirmLabel: "Save" })
        : window.prompt("Rename document", current);
      if (!next || next.trim() === current) return;
      try {
        const r = await fetch(`/api/camp-trips/${encodeURIComponent(trip)}/documents/${encodeURIComponent(doc)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: next.trim() }),
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Rename failed");
        load();
      } catch (err) {
        window.UI?.alert ? window.UI.alert(err.message || "Rename failed") : alert(err.message || "Rename failed");
      }
      return;
    }
    const deleteBtn = e.target.closest("[data-acct-delete]");
    if (deleteBtn) {
      e.preventDefault();
      const trip = deleteBtn.dataset.trip;
      const doc = deleteBtn.dataset.doc;
      const name = deleteBtn.dataset.name || "this document";
      const confirmed = window.UI?.confirm
        ? await window.UI.confirm(`Delete "${name}"? This removes it from the trip's Paid documents.`, { dangerous: true })
        : window.confirm(`Delete "${name}"?`);
      if (!confirmed) return;
      try {
        const r = await fetch(`/api/camp-trips/${encodeURIComponent(trip)}/documents/${encodeURIComponent(doc)}`, {
          method: "DELETE",
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Delete failed");
        load();
      } catch (err) {
        window.UI?.alert ? window.UI.alert(err.message || "Delete failed") : alert(err.message || "Delete failed");
      }
    }
  });

  viewDropdown?.addEventListener("change", () => {
    applyViewToggles();
  });

  // Bulk download — one click per file (browsers won't accept a real
  // multi-file zip without server help). For now sequential opens, which
  // most browsers handle fine for 5-10 selected files.
  bulkBtn?.addEventListener("click", () => {
    const checks = tbody.querySelectorAll("[data-acct-select]:checked");
    checks.forEach((cb, i) => {
      const url = cb.dataset.acctUrl;
      if (!url) return;
      setTimeout(() => {
        const a = document.createElement("a");
        a.href = url;
        a.download = cb.dataset.acctName || "";
        a.target = "_blank";
        document.body.appendChild(a);
        a.click();
        a.remove();
      }, i * 250);
    });
  });

  // The approval modal in app-shell.js fires this when a request gets
  // approved or rejected, so the table refreshes without polling.
  window.addEventListener("payment-request:resolved", () => {
    load();
  });

  // If we landed here from the ₮ popover with ?open=<requestId>, scroll to
  // and highlight that row once data is in.
  load().then(() => {
    const params = new URLSearchParams(window.location.search);
    const target = params.get("open");
    if (!target) return;
    const cb = tbody.querySelector(`[data-acct-select="${CSS.escape(target)}"]`);
    if (cb) {
      const tr = cb.closest("tr");
      tr?.scrollIntoView({ behavior: "smooth", block: "center" });
      tr?.classList.add("is-active");
    }
  });
})();
