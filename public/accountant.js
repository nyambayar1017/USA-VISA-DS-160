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

  function render() {
    const list = filtered();
    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="12" class="empty">No paid documents match these filters.</td></tr>`;
      countNode.textContent = "0 of 0";
      bulkBtn.disabled = true;
      return;
    }
    tbody.innerHTML = list.map((r, i) => {
      const isSel = selected.has(r.id);
      const docCell = r.paidDocumentUrl
        ? `<a href="${escapeHtml(r.paidDocumentUrl)}" target="_blank" rel="noreferrer">${escapeHtml(r.paidDocumentName || "View")}</a>`
        : `<span class="muted">—</span>`;
      const tripCell = r.tripId
        ? `<a href="/trip-detail?tripId=${encodeURIComponent(r.tripId)}" class="trip-name-link">${escapeHtml(r.tripName || r.tripSerial || r.tripId)}</a>`
        : escapeHtml(r.tripName || "—");
      const numCell = r.paidDocumentUrl
        ? `<a href="${escapeHtml(r.paidDocumentUrl)}" target="_blank" rel="noreferrer">${i + 1}</a>`
        : (i + 1);
      return `
        <tr>
          <td><input type="checkbox" data-acct-select="${escapeHtml(r.id)}" data-acct-url="${escapeHtml(r.paidDocumentUrl || "")}" data-acct-name="${escapeHtml(r.paidDocumentName || "")}" ${isSel ? "checked" : ""}/></td>
          <td>${numCell}</td>
          <td>${escapeHtml(r.paidDate || "—")}</td>
          <td data-col="trip">${tripCell}</td>
          <td data-col="invoice">${escapeHtml(r.invoiceSerial || "—")}</td>
          <td data-col="payer">${escapeHtml(r.payerName || "—")}</td>
          <td>${escapeHtml(fmtAmount(r.amount))}</td>
          <td>${escapeHtml(r.currency || "—")}</td>
          <td data-col="bank">${escapeHtml(r.bankLabel || "—")}</td>
          <td data-col="manager">${escapeHtml(r.manager || "—")}</td>
          <td>${docCell}</td>
          <td data-col="note">${escapeHtml(r.note || "")}</td>
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
