// Trip Profit & Loss card on /trip-detail.
//
// Reads four sources and joins them by tripId:
//   1. /api/camp-trips/<id>          → expenseLines (planned), exchangeRates, marginPct
//   2. /api/payment-requests?status=approved&direction=outgoing → actual paid
//   3. /api/invoices                 → income (paid installments only)
//   4. /api/payment-requests?status=pending&direction=outgoing → "in flight" rows
//
// Each planned line is matched to a paid request by (category, payeeName).
// Lines without a match show a "+ Pay this" button that opens the
// expense-request modal pre-filled with the line's data.

(function () {
  const section = document.getElementById("trip-pnl-section");
  if (!section) return;
  const tbody = document.getElementById("trip-pl-tbody");
  const summary = document.getElementById("trip-pl-summary");
  const addBtn = document.getElementById("trip-pl-add-line");
  if (!tbody || !summary) return;

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function getTripId() {
    return window.__tripIdOverride || new URLSearchParams(window.location.search).get("tripId") || "";
  }

  function toMnt(amount, currency, rates, invoiceFxRate) {
    const ccy = (currency || "MNT").toUpperCase();
    const amt = Number(amount) || 0;
    if (ccy === "MNT") return amt;
    // Prefer the rate frozen on the invoice itself (set when the
    // invoice was saved). Falls back to the trip-level rate table
    // for legacy invoices that pre-date the fxRate field.
    const r = Number(invoiceFxRate) > 0
      ? Number(invoiceFxRate)
      : Number(rates?.[ccy]) || 0;
    return r ? amt * r : amt; // if no rate, leave the raw number — better than zero
  }

  async function fetchJson(url, fallback) {
    try {
      const r = await fetch(url);
      if (!r.ok) return fallback;
      return await r.json();
    } catch {
      return fallback;
    }
  }

  let cachedTrip = null;

  async function load() {
    const tripId = getTripId();
    if (!tripId) return;
    const [tripsResp, invoicesResp, paymentsResp] = await Promise.all([
      fetchJson("/api/camp-trips", { entries: [] }),
      fetchJson("/api/invoices", { entries: [] }),
      fetchJson(`/api/payment-requests?invoiceId=&workspace=`, { entries: [] }),
    ]);
    const trips = tripsResp.entries || tripsResp || [];
    const trip = trips.find((t) => t.id === tripId);
    if (!trip) return;
    cachedTrip = trip;

    const expenseLines = trip.expenseLines || [];
    const rates = trip.exchangeRates || {};
    const marginPct = Number(trip.marginPct) || 0;

    const invoices = (invoicesResp.entries || []).filter((i) => i.tripId === tripId);
    let incomeMnt = 0;
    let incomePending = 0;
    // Per-currency income breakdown so the Trip-finance summary
    // can surface a rate input next to each non-MNT currency. Both
    // paid + pending stack onto the same currency bucket.
    const incomePaidByCcy = {};
    const incomePendingByCcy = {};
    invoices.forEach((inv) => {
      const ccy = (inv.currency || "MNT").toUpperCase();
      (inv.installments || []).forEach((inst) => {
        const status = (inst.status || "").toLowerCase();
        const amt = Number(inst.paidAmount != null ? inst.paidAmount : inst.amount) || 0;
        const m = toMnt(amt, inv.currency, rates, inv.fxRate);
        if (status === "paid" || status === "confirmed") {
          incomeMnt += m;
          incomePaidByCcy[ccy] = (incomePaidByCcy[ccy] || 0) + amt;
        } else {
          incomePending += m;
          incomePendingByCcy[ccy] = (incomePendingByCcy[ccy] || 0) + amt;
        }
      });
    });

    // Outgoing payment-requests for this trip — by status + direction.
    const allReqs = (paymentsResp.entries || []).filter((r) => r.tripId === tripId);
    const outgoingPaid = allReqs.filter((r) => (r.direction || "incoming") === "outgoing" && (r.status || "") === "approved");
    const outgoingPending = allReqs.filter((r) => (r.direction || "incoming") === "outgoing" && (r.status || "") === "pending");

    let plannedMnt = 0;
    let actualMnt = 0;
    outgoingPaid.forEach((r) => { actualMnt += toMnt(r.paidAmount || 0, r.currency, rates); });

    // Match each planned line to a paid request (category + payee both
    // case-insensitive). A used set avoids matching one paid request to
    // two planned lines.
    const usedReqIds = new Set();
    const findMatchedPaid = (line) => {
      const cat = (line.category || "").toLowerCase();
      const payee = (line.payeeName || "").toLowerCase();
      const match = outgoingPaid.find((r) => {
        if (usedReqIds.has(r.id)) return false;
        if ((r.category || "").toLowerCase() !== cat) return false;
        if (payee && (r.payeeName || "").toLowerCase() !== payee) return false;
        return true;
      });
      if (match) usedReqIds.add(match.id);
      return match;
    };
    const findMatchedPending = (line) => {
      const cat = (line.category || "").toLowerCase();
      const payee = (line.payeeName || "").toLowerCase();
      return outgoingPending.find((r) => {
        if ((r.category || "").toLowerCase() !== cat) return false;
        if (payee && (r.payeeName || "").toLowerCase() !== payee) return false;
        return true;
      });
    };

    // Render rows.
    if (!expenseLines.length && !outgoingPaid.length && !outgoingPending.length) {
      tbody.innerHTML = `<tr><td colspan="8" class="empty">No expense plan for this trip. Edit the trip and pick a costing template, or add lines manually.</td></tr>`;
    } else {
      const vendorCell = (req) => {
        const meta = req?.vendorInvoiceMeta;
        if (!meta || !meta.storedName) return `<span class="muted">—</span>`;
        const url = `/trip-uploads/_vendor/${encodeURIComponent(meta.storedName)}`;
        return `<a href="${url}" target="_blank" rel="noreferrer">${escapeHtml(meta.originalName || "View")}</a>`;
      };
      const lineRows = expenseLines.map((line) => {
        const paid = findMatchedPaid(line);
        const pending = !paid ? findMatchedPending(line) : null;
        const plannedMntLine = toMnt(line.amount, line.currency, rates);
        plannedMnt += plannedMntLine;
        const status = paid
          ? `<span class="payment-status paid">Paid</span>`
          : (pending
              ? `<span class="payment-status waiting">Pending</span>`
              : `<span class="muted">—</span>`);
        const actualText = paid
          ? `${escapeHtml(paid.currency || "MNT")} ${Number(paid.paidAmount || 0).toLocaleString()}`
          : "—";
        const actionBtn = (!paid && !pending)
          ? `<button type="button" class="header-action-btn" data-pay-line="1" data-day="${escapeHtml(line.dayOffset)}" data-category="${escapeHtml(line.category)}" data-payee="${escapeHtml(line.payeeName)}" data-amount="${escapeHtml(line.amount)}" data-currency="${escapeHtml(line.currency)}">+ Pay</button>`
          : "";
        return `
          <tr>
            <td>${escapeHtml(line.dayOffset)}</td>
            <td>${escapeHtml(line.category || "—")}</td>
            <td>${escapeHtml(line.payeeName || "—")}</td>
            <td>${escapeHtml(line.currency || "MNT")} ${Number(line.amount || 0).toLocaleString()}</td>
            <td>${actualText}</td>
            <td>${vendorCell(paid || pending)}</td>
            <td>${status}</td>
            <td>${actionBtn}</td>
          </tr>
        `;
      });

      // Plus any paid/pending requests that didn't match a planned line
      // (manager added an ad-hoc expense from the ₮ flow).
      const adhoc = outgoingPaid.filter((r) => !usedReqIds.has(r.id))
        .concat(outgoingPending.filter((p) => !expenseLines.some((l) => (l.category || "").toLowerCase() === (p.category || "").toLowerCase())));
      adhoc.forEach((r) => {
        const status = (r.status || "") === "approved"
          ? `<span class="payment-status paid">Paid</span>`
          : `<span class="payment-status waiting">Pending</span>`;
        lineRows.push(`
          <tr class="trip-pl-adhoc">
            <td>—</td>
            <td>${escapeHtml(r.category || "Other")} <span class="muted">(ad-hoc)</span></td>
            <td>${escapeHtml(r.payeeName || "—")}</td>
            <td class="muted">—</td>
            <td>${escapeHtml(r.currency || "MNT")} ${Number(r.paidAmount || 0).toLocaleString()}</td>
            <td>${vendorCell(r)}</td>
            <td>${status}</td>
            <td></td>
          </tr>
        `);
      });

      tbody.innerHTML = lineRows.join("");
    }

    // Summary cards.
    const net = incomeMnt - actualMnt;
    // Gross margin: profit as % of selling price → quote = cost / (1 - margin%).
    // Matches the client-facing quote panel; 20% on 100k = 125k.
    const margin = (plannedMnt > 0 && marginPct < 100)
      ? Math.round(plannedMnt / (1 - marginPct / 100))
      : 0;

    // Build one tile per non-MNT currency present in invoices: shows
    // the original-currency total plus an editable Rate → MNT input.
    // When the rate is blank the MNT-equivalent tile reads "—" so the
    // missing-rate state is obvious.
    const ccySymbols = { USD: "$", EUR: "€", MNT: "₮", GBP: "£", JPY: "¥", KRW: "₩", CNY: "¥" };
    const fmtCcy = (ccy, amt) => {
      const n = Math.round(Number(amt) || 0).toLocaleString();
      return ccy === "MNT" ? `MNT ${n}` : `${ccySymbols[ccy] || ""}${n} ${ccy}`;
    };
    const otherCurrencies = Object.keys(incomePaidByCcy).filter((c) => c !== "MNT" && incomePaidByCcy[c] > 0);
    const rateTiles = otherCurrencies.map((ccy) => {
      const paidOriginal = incomePaidByCcy[ccy] || 0;
      const currentRate = Number(rates[ccy]) || 0;
      const placeholder = ccy === "USD" ? "3500" : ccy === "EUR" ? "4100" : "0";
      const mntFromCcy = currentRate > 0 ? Math.round(paidOriginal * currentRate) : null;
      return `
        <div class="trip-pl-card"><dt>Income paid (${ccy})</dt><dd class="is-positive">${fmtCcy(ccy, paidOriginal)}</dd></div>
        <div class="trip-pl-card trip-pl-rate-card"><dt>Rate ${ccy} → MNT</dt>
          <dd>
            <input type="number" min="0" step="0.01" value="${currentRate || ""}" placeholder="${placeholder}" data-trip-rate-input="${ccy}" />
            <button type="button" class="header-action-btn" data-trip-rate-save="${ccy}">Save</button>
          </dd>
        </div>
        <div class="trip-pl-card"><dt>Income in MNT (${ccy})</dt><dd class="${mntFromCcy != null ? "is-positive" : "muted"}">${mntFromCcy != null ? `MNT ${mntFromCcy.toLocaleString()}` : "— set rate"}</dd></div>
      `;
    }).join("");

    summary.innerHTML = `
      ${rateTiles}
      <div class="trip-pl-card"><dt>Income (paid, MNT total)</dt><dd class="is-positive">MNT ${incomeMnt.toLocaleString()}</dd></div>
      ${incomePending ? `<div class="trip-pl-card"><dt>Income (pending)</dt><dd class="muted">MNT ${incomePending.toLocaleString()}</dd></div>` : ""}
      <div class="trip-pl-card"><dt>Actual paid</dt><dd class="is-negative">MNT ${actualMnt.toLocaleString()}</dd></div>
      <div class="trip-pl-card"><dt>Net (income − paid)</dt><dd class="${net >= 0 ? "is-positive" : "is-negative"}">MNT ${net.toLocaleString()}</dd></div>
      ${margin ? `<div class="trip-pl-card"><dt>Quote price (margin ${marginPct}%)</dt><dd>MNT ${margin.toLocaleString()}</dd></div>` : ""}
    `;

    // Wire each "Save" button to PATCH the trip's exchangeRates and
    // re-render. Inputs Enter-key trigger the same save.
    summary.querySelectorAll("[data-trip-rate-save]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const ccy = btn.dataset.tripRateSave;
        const input = summary.querySelector(`input[data-trip-rate-input="${ccy}"]`);
        const value = Number(input?.value) || 0;
        if (value <= 0) return;
        const nextRates = { ...(trip.exchangeRates || {}), [ccy]: value };
        try {
          await fetch(`/api/camp-trips/${tripId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...trip, exchangeRates: nextRates }),
          });
          await load();
        } catch (err) { alert(err.message || "Could not save rate."); }
      });
    });
    summary.querySelectorAll("[data-trip-rate-input]").forEach((inp) => {
      inp.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          summary.querySelector(`[data-trip-rate-save="${inp.dataset.tripRateInput}"]`)?.click();
        }
      });
    });
  }

  // Wire row buttons.
  tbody.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-pay-line]");
    if (!btn) return;
    if (typeof window.openExpenseRequestModal !== "function") return;
    window.openExpenseRequestModal({
      scope: "trip",
      tripId: getTripId(),
      category: btn.dataset.category,
      payeeName: btn.dataset.payee,
      amount: btn.dataset.amount,
      currency: btn.dataset.currency,
      onSuccess: load,
    });
  });

  addBtn?.addEventListener("click", () => {
    if (typeof window.openExpenseRequestModal !== "function") return;
    window.openExpenseRequestModal({
      scope: "trip",
      tripId: getTripId(),
      onSuccess: load,
    });
  });

  // Refresh after the user approves a request elsewhere on the page.
  window.addEventListener("payment-request:resolved", load);
  window.__tripPlLoad = load;
  load();
})();
