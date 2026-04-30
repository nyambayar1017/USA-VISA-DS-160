// Accountant page: lists every approved payment-request with its proof
// receipt. The data comes from /api/accountant/paid (workspace-scoped on
// the server), filters live entirely client-side.

(function () {
  const tbody = document.getElementById("acct-tbody");
  const countNode = document.getElementById("acct-count");
  const searchInput = document.getElementById("acct-search");
  const directionSelect = document.getElementById("acct-direction");
  const categorySelect = document.getElementById("acct-category");
  const currencySelect = document.getElementById("acct-currency");
  const bankSelect = document.getElementById("acct-bank");
  const dateFromInput = document.getElementById("acct-date-from");
  const dateToInput = document.getElementById("acct-date-to");
  const clearBtn = document.getElementById("acct-clear-filter");
  const selectAll = document.getElementById("acct-select-all");
  const bulkBtn = document.getElementById("acct-bulk-download");
  const viewDropdown = document.getElementById("acct-view-dropdown");
  const newExpenseBtn = document.getElementById("acct-new-expense");
  const statsBlock = document.getElementById("acct-stats");
  const statsGrid = document.getElementById("acct-stats-grid");
  const statsCustom = document.getElementById("acct-stats-custom");
  const statsFromInput = document.getElementById("acct-stats-from");
  const statsToInput = document.getElementById("acct-stats-to");

  let statsPeriod = "month";

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
    if (isAdminOrAccountant()) {
      renderStats();
    } else if (statsBlock) {
      statsBlock.setAttribute("hidden", "");
    }
  }

  function statsRange() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (statsPeriod === "day") return [today, null];
    if (statsPeriod === "week") {
      const d = new Date(today); d.setDate(today.getDate() - 6); return [d, null];
    }
    if (statsPeriod === "2week") {
      const d = new Date(today); d.setDate(today.getDate() - 13); return [d, null];
    }
    if (statsPeriod === "3week") {
      const d = new Date(today); d.setDate(today.getDate() - 20); return [d, null];
    }
    if (statsPeriod === "month") {
      return [new Date(now.getFullYear(), now.getMonth(), 1), null];
    }
    if (statsPeriod === "quarter") {
      const d = new Date(today); d.setMonth(today.getMonth() - 3); return [d, null];
    }
    if (statsPeriod === "year") {
      return [new Date(now.getFullYear(), 0, 1), null];
    }
    if (statsPeriod === "custom") {
      const from = statsFromInput?.value ? new Date(statsFromInput.value) : null;
      const to = statsToInput?.value ? new Date(statsToInput.value) : null;
      if (to) to.setHours(23, 59, 59, 999);
      return [from, to];
    }
    return [null, null]; // "all"
  }

  function renderStats() {
    if (!statsBlock || !statsGrid) return;
    statsBlock.removeAttribute("hidden");
    const [from, to] = statsRange();
    const inRange = (iso) => {
      if (!from && !to) return true;
      if (!iso) return false;
      const ts = new Date(iso).getTime();
      if (!Number.isFinite(ts)) return false;
      if (from && ts < from.getTime()) return false;
      if (to && ts > to.getTime()) return false;
      return true;
    };

    // Group by currency. For paid rows the relevant date is paidDate;
    // for pending rows we still show counts but not amounts in the
    // totals (otherwise pending volume inflates "we paid X").
    const byCcy = {};
    let pendingCount = 0;
    rows.forEach((r) => {
      const status = (r.status || "").toLowerCase();
      const dir = r.direction || "incoming";
      const dateStr = r.paidDate || r.requestedAt || "";
      if (!inRange(dateStr)) return;
      const ccy = r.currency || "MNT";
      const bucket = (byCcy[ccy] = byCcy[ccy] || { incoming: 0, outgoing: 0, pendingIn: 0, pendingOut: 0 });
      const amt = Number(r.amount) || 0;
      if (status === "pending") {
        pendingCount += 1;
        if (dir === "incoming") bucket.pendingIn += amt;
        else bucket.pendingOut += amt;
      } else if (status === "approved") {
        if (dir === "incoming") bucket.incoming += amt;
        else bucket.outgoing += amt;
      }
    });

    const fmt = (n, ccy) => `${ccy} ${Number(n || 0).toLocaleString()}`;
    const cards = Object.entries(byCcy).map(([ccy, b]) => {
      const net = (b.incoming || 0) - (b.outgoing || 0);
      const netClass = net >= 0 ? "is-positive" : "is-negative";
      return `
        <div class="acct-stats-card">
          <header>${escapeHtml(ccy)}</header>
          <dl>
            <div><dt>Incoming</dt><dd class="is-positive">${escapeHtml(fmt(b.incoming, ccy))}</dd></div>
            <div><dt>Outgoing</dt><dd class="is-negative">${escapeHtml(fmt(b.outgoing, ccy))}</dd></div>
            <div class="acct-stats-net"><dt>Net</dt><dd class="${netClass}">${escapeHtml(fmt(net, ccy))}</dd></div>
            ${b.pendingIn || b.pendingOut ? `
              <div class="acct-stats-pending">
                <dt>Pending</dt>
                <dd>${b.pendingIn ? `<span class="is-positive">+${escapeHtml(fmt(b.pendingIn, ccy))}</span>` : ""} ${b.pendingOut ? `<span class="is-negative">-${escapeHtml(fmt(b.pendingOut, ccy))}</span>` : ""}</dd>
              </div>
            ` : ""}
          </dl>
        </div>
      `;
    }).join("");

    statsGrid.innerHTML = cards || `<p class="muted">No payments in this period.</p>`;
  }

  // Period chip handler.
  document.querySelectorAll("#acct-stats [data-period]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#acct-stats [data-period]").forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      statsPeriod = btn.dataset.period;
      if (statsPeriod === "custom") statsCustom.removeAttribute("hidden");
      else statsCustom.setAttribute("hidden", "");
      renderStats();
    });
  });
  statsFromInput?.addEventListener("change", () => statsPeriod === "custom" && renderStats());
  statsToInput?.addEventListener("change", () => statsPeriod === "custom" && renderStats());

  function populateFilters() {
    currencySelect.innerHTML = '<option value="">All currencies</option>'
      + uniq(rows.map((r) => r.currency))
        .map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`)
        .join("");
    bankSelect.innerHTML = '<option value="">All banks</option>'
      + uniq(rows.map((r) => r.bankLabel))
        .map((b) => `<option value="${escapeHtml(b)}">${escapeHtml(b)}</option>`)
        .join("");
    if (categorySelect) {
      categorySelect.innerHTML = '<option value="">All categories</option>'
        + uniq(rows.map((r) => r.category))
          .map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`)
          .join("");
    }
  }

  function fmtDuration(ms) {
    if (!Number.isFinite(ms) || ms < 0) return "";
    if (ms < 5 * 60 * 1000) return "Instant";   // approved within 5 minutes
    const m = Math.floor(ms / 60000);
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} h`;
    const d = Math.floor(h / 24);
    return `${d} d`;
  }

  function fmtPendingFor(row) {
    // Pending rows: how long they've been waiting.
    // Resolved rows: how long the round-trip took (request → paid).
    if (!row?.requestedAt) return "";
    const requestedTs = new Date(row.requestedAt).getTime();
    if (!Number.isFinite(requestedTs)) return "";
    const status = (row.status || "").toLowerCase();
    if (status === "pending") return fmtDuration(Date.now() - requestedTs);
    const resolvedAt = row.approvedAt || row.rejectedAt || row.paidDate || "";
    const resolvedTs = resolvedAt ? new Date(resolvedAt).getTime() : NaN;
    if (!Number.isFinite(resolvedTs)) return "";
    return fmtDuration(resolvedTs - requestedTs);
  }

  function pendingTone(row) {
    if (!row?.requestedAt) return "";
    const status = (row.status || "").toLowerCase();
    if (status !== "pending") return "is-resolved";
    const diff = Date.now() - new Date(row.requestedAt).getTime();
    if (diff > 72 * 3600 * 1000) return "is-overdue";
    if (diff > 24 * 3600 * 1000) return "is-warning";
    return "";
  }

  function filtered() {
    const q = (searchInput.value || "").trim().toLowerCase();
    const ccy = currencySelect.value;
    const bank = bankSelect.value;
    const dir = directionSelect ? directionSelect.value : "";
    const cat = categorySelect ? categorySelect.value : "";
    const dateFrom = dateFromInput.value;
    const dateTo = dateToInput.value;
    return rows.filter((r) => {
      if (q) {
        const hay = `${r.payerName} ${r.payeeName} ${r.tripName} ${r.tripSerial} ${r.invoiceSerial} ${r.manager} ${r.category}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (dir && r.direction !== dir) return false;
      if (cat && r.category !== cat) return false;
      if (ccy && r.currency !== ccy) return false;
      if (bank && r.bankLabel !== bank) return false;
      if (dateFrom && (r.paidDate || r.requestedAt || "").slice(0, 10) < dateFrom) return false;
      if (dateTo && (r.paidDate || r.requestedAt || "").slice(0, 10) > dateTo) return false;
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
      const isOutgoing = (r.direction || "incoming") === "outgoing";
      const isSel = selected.has(r.id);
      const downloadUrl = r.paidDocumentUrl ? `${r.paidDocumentUrl}?download=1` : "";
      const docCell = r.paidDocumentUrl
        ? `<a href="${escapeHtml(r.paidDocumentUrl)}" target="_blank" rel="noreferrer">${escapeHtml(r.paidDocumentName || "View")}</a>`
        : (isPending
            ? `<span class="acct-pending-doc">— awaiting receipt —</span>`
            : `<span class="muted">—</span>`);
      const tripCell = r.tripId
        ? `<a href="/trip-detail?tripId=${encodeURIComponent(r.tripId)}" class="trip-name-link">${escapeHtml(r.tripName || r.tripSerial || r.tripId)}</a>`
        : (isOutgoing ? `<span class="muted">Office / overhead</span>` : `<span class="muted">—</span>`);
      const numCell = r.paidDocumentUrl
        ? `<a href="${escapeHtml(r.paidDocumentUrl)}" target="_blank" rel="noreferrer">${i + 1}</a>`
        : (i + 1);
      const statusCell = isPending
        ? `<span class="payment-status waiting">Pending</span>`
        : `<span class="payment-status paid">Paid</span>`;
      const dirCell = isOutgoing
        ? `<span class="acct-direction is-outgoing" title="We pay">↙ Outgoing</span>`
        : `<span class="acct-direction is-incoming" title="Client pays us">↗ Incoming</span>`;
      const counterParty = isOutgoing
        ? (r.payeeName || "—")
        : (r.payerName || "—");
      const pendingForCell = `<span class="acct-pending-for ${pendingTone(r)}">${escapeHtml(fmtPendingFor(r) || "—")}</span>`;

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
      // Always offer "Delete request" for admin/accountant so orphan
      // records (e.g. approvals from before the auto-attach landed,
      // status=Paid but no document) can be cleaned up. Falls through
      // to DELETE /api/payment-requests/<id>.
      if (canDelete) {
        items.push(`<button type="button" class="row-action-item is-danger" data-acct-delete-request data-id="${escapeHtml(r.id)}" data-serial="${escapeHtml(r.invoiceSerial || "")}">${isPending ? "Cancel request" : "Delete request"}</button>`);
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
          <td>${dirCell}</td>
          <td data-col="category">${escapeHtml(r.category || "—")}</td>
          <td>${escapeHtml(r.paidDate || "—")}</td>
          <td data-col="trip">${tripCell}</td>
          <td data-col="invoice">${escapeHtml(r.invoiceSerial || (isOutgoing ? "—" : "—"))}</td>
          <td data-col="payer">${escapeHtml(counterParty)}</td>
          <td>${escapeHtml(fmtAmount(r.amount))}</td>
          <td>${escapeHtml(r.currency || "—")}</td>
          <td data-col="bank">${escapeHtml(r.bankLabel || "—")}</td>
          <td data-col="manager">${escapeHtml(r.manager || "—")}</td>
          <td>${statusCell}</td>
          <td data-col="pending">${pendingForCell}</td>
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
  directionSelect?.addEventListener("change", render);
  categorySelect?.addEventListener("change", render);
  currencySelect?.addEventListener("change", render);
  bankSelect?.addEventListener("change", render);
  dateFromInput?.addEventListener("change", render);
  dateToInput?.addEventListener("change", render);

  // Pending-for cells age live; re-render once a minute.
  setInterval(() => { if (rows.length) render(); }, 60000);

  clearBtn?.addEventListener("click", () => {
    searchInput.value = "";
    if (directionSelect) directionSelect.value = "";
    if (categorySelect) categorySelect.value = "";
    currencySelect.value = "";
    bankSelect.value = "";
    dateFromInput.value = "";
    dateToInput.value = "";
    selected.clear();
    if (selectAll) selectAll.checked = false;
    render();
  });

  newExpenseBtn?.addEventListener("click", () => {
    if (typeof window.openExpenseRequestModal === "function") {
      window.openExpenseRequestModal({ scope: "office", onSuccess: load });
    }
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
    const deleteRequestBtn = e.target.closest("[data-acct-delete-request]");
    if (deleteRequestBtn) {
      e.preventDefault();
      const id = deleteRequestBtn.dataset.id;
      const serial = deleteRequestBtn.dataset.serial || "this record";
      const confirmed = window.UI?.confirm
        ? await window.UI.confirm(`Remove the payment request for "${serial}" from the ledger? This does not unmark the invoice as paid — it only deletes the request record.`, { dangerous: true })
        : window.confirm(`Remove the payment request for "${serial}"?`);
      if (!confirmed) return;
      try {
        const r = await fetch(`/api/payment-requests/${encodeURIComponent(id)}`, { method: "DELETE" });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Delete failed");
        load();
      } catch (err) {
        window.UI?.alert ? window.UI.alert(err.message || "Delete failed") : alert(err.message || "Delete failed");
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

  // Bulk download — server bundles every selected receipt into a
  // single ZIP. Reliable across browsers (sequential <a download>
  // clicks got rate-limited or blocked).
  bulkBtn?.addEventListener("click", async () => {
    const ids = Array.from(tbody.querySelectorAll("[data-acct-select]:checked")).map((cb) => cb.dataset.acctSelect);
    if (!ids.length) return;
    const original = bulkBtn.textContent;
    bulkBtn.disabled = true;
    bulkBtn.textContent = "Bundling…";
    try {
      const res = await fetch("/api/accountant/download-zip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Bundle failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const cd = res.headers.get("Content-Disposition") || "";
      const m = /filename="([^"]+)"/.exec(cd);
      a.download = m ? m[1] : "receipts.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (err) {
      window.UI?.alert ? window.UI.alert(err.message || "Download failed") : alert(err.message || "Download failed");
    } finally {
      bulkBtn.disabled = false;
      bulkBtn.textContent = original;
    }
  });

  // The approval modal in app-shell.js fires this when a request gets
  // approved or rejected, so the table refreshes without polling.
  window.addEventListener("payment-request:resolved", () => {
    load();
  });

  // Close any open kebab menu when another row's menu opens (only
  // one ⋯ should be visible at a time) and when the user clicks
  // anywhere outside the open menu — <details> doesn't do this on
  // its own.
  tbody?.addEventListener("toggle", (e) => {
    if (!(e.target instanceof HTMLElement)) return;
    if (e.target.tagName !== "DETAILS" || !e.target.open) return;
    tbody.querySelectorAll("details.row-action-menu[open]").forEach((d) => {
      if (d !== e.target) d.removeAttribute("open");
    });
  }, true);
  document.addEventListener("click", (e) => {
    const open = tbody?.querySelectorAll("details.row-action-menu[open]");
    if (!open?.length) return;
    open.forEach((d) => {
      if (!d.contains(e.target)) d.removeAttribute("open");
    });
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
