// Trip Creator editor.
//
// Phase 1 scope: shell + persistence. The page binds to an existing trip
// via ?tripId=… and reads/writes a single JSON document at
// /api/trip-creators/:tripId. No content library, no public render —
// those come in later phases.

(function () {
  const params = new URLSearchParams(window.location.search);
  const tripId = (params.get("tripId") || "").trim();
  const saveStatus = document.getElementById("tc-save-status");
  const saveBtn = document.getElementById("tc-save-btn");
  const titleNode = document.getElementById("tc-page-title");
  const metaNode = document.getElementById("tc-trip-meta");

  const $ = (id) => document.getElementById(id);

  if (!tripId) {
    metaNode.textContent = "Missing tripId. Open this page from a trip.";
    saveBtn.disabled = true;
    return;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function setStatus(message, tone) {
    saveStatus.textContent = message || "";
    saveStatus.dataset.tone = tone || "";
  }

  // ── Tabs ─────────────────────────────────────────────────────────
  document.getElementById("tc-tabs").addEventListener("click", (event) => {
    const btn = event.target.closest(".tc-tab");
    if (!btn) return;
    const target = btn.dataset.tab;
    document.querySelectorAll(".tc-tab").forEach((t) => t.classList.toggle("is-active", t === btn));
    document.querySelectorAll(".tc-pane").forEach((pane) => {
      const match = pane.id === `tc-pane-${target}`;
      pane.classList.toggle("is-active", match);
      pane.toggleAttribute("hidden", !match);
    });
  });

  // ── Program editor (day rows) ────────────────────────────────────
  const programList = document.getElementById("tc-program-list");

  function renderProgram(rows) {
    programList.innerHTML = (rows || [])
      .map(
        (row, idx) => `
          <div class="tc-program-row" data-idx="${idx}">
            <div class="tc-program-row-head">
              <input type="text" class="tc-program-day" placeholder="Өдөр ${idx + 1}" value="${escapeHtml(row.day || `Өдөр ${idx + 1}`)}" />
              <input type="text" class="tc-program-title" placeholder="e.g. УБ - Истанбул нислэг" value="${escapeHtml(row.title || "")}" />
              <button type="button" class="tc-program-delete" data-action="delete-day" data-idx="${idx}" aria-label="Remove day">✕</button>
            </div>
            <textarea class="tc-program-body" rows="3" placeholder="Description, attractions, notes…">${escapeHtml(row.body || "")}</textarea>
          </div>
        `
      )
      .join("");
  }

  document.getElementById("tc-add-day").addEventListener("click", () => {
    const current = readProgram();
    current.push({ day: `Өдөр ${current.length + 1}`, title: "", body: "" });
    renderProgram(current);
  });

  programList.addEventListener("click", (event) => {
    const del = event.target.closest('[data-action="delete-day"]');
    if (!del) return;
    const idx = Number(del.dataset.idx);
    const current = readProgram();
    current.splice(idx, 1);
    renderProgram(current);
  });

  function readProgram() {
    return Array.from(programList.querySelectorAll(".tc-program-row")).map((row) => ({
      day: row.querySelector(".tc-program-day")?.value || "",
      title: row.querySelector(".tc-program-title")?.value || "",
      body: row.querySelector(".tc-program-body")?.value || "",
    }));
  }

  // ── Quotation editor (rows) ─────────────────────────────────────
  const quoteRows = document.getElementById("tc-quote-rows");
  const quoteTotalNode = document.getElementById("tc-quote-total");

  function renderQuote(rows) {
    quoteRows.innerHTML = (rows || [])
      .map(
        (row, idx) => `
          <tr data-idx="${idx}">
            <td><input type="text" class="tc-quote-label" placeholder="e.g. Хоол" value="${escapeHtml(row.label || "")}" /></td>
            <td><input type="number" class="tc-quote-qty" min="0" step="0.01" value="${escapeHtml(row.qty || "")}" /></td>
            <td><input type="number" class="tc-quote-unit" min="0" step="0.01" value="${escapeHtml(row.unitPrice || "")}" /></td>
            <td><input type="text" class="tc-quote-currency" placeholder="MNT" value="${escapeHtml(row.currency || "")}" /></td>
            <td class="tc-quote-subtotal" data-idx="${idx}">—</td>
            <td><button type="button" class="tc-quote-delete" data-action="delete-row" data-idx="${idx}" aria-label="Remove line">✕</button></td>
          </tr>
        `
      )
      .join("");
    recomputeTotals();
  }

  document.getElementById("tc-add-row").addEventListener("click", () => {
    const current = readQuoteRows();
    current.push({ label: "", qty: "", unitPrice: "", currency: $("tc-currency").value || "" });
    renderQuote(current);
  });

  quoteRows.addEventListener("click", (event) => {
    const del = event.target.closest('[data-action="delete-row"]');
    if (!del) return;
    const idx = Number(del.dataset.idx);
    const current = readQuoteRows();
    current.splice(idx, 1);
    renderQuote(current);
  });

  quoteRows.addEventListener("input", (event) => {
    if (event.target.matches(".tc-quote-qty, .tc-quote-unit")) recomputeTotals();
  });

  function readQuoteRows() {
    return Array.from(quoteRows.querySelectorAll("tr")).map((tr) => ({
      label: tr.querySelector(".tc-quote-label")?.value || "",
      qty: tr.querySelector(".tc-quote-qty")?.value || "",
      unitPrice: tr.querySelector(".tc-quote-unit")?.value || "",
      currency: tr.querySelector(".tc-quote-currency")?.value || "",
    }));
  }

  function recomputeTotals() {
    let total = 0;
    let currency = "";
    quoteRows.querySelectorAll("tr").forEach((tr) => {
      const qty = parseFloat(tr.querySelector(".tc-quote-qty")?.value || "0") || 0;
      const unit = parseFloat(tr.querySelector(".tc-quote-unit")?.value || "0") || 0;
      const sub = qty * unit;
      const cur = tr.querySelector(".tc-quote-currency")?.value || "";
      tr.querySelector(".tc-quote-subtotal").textContent = sub
        ? `${sub.toLocaleString()} ${cur}`.trim()
        : "—";
      total += sub;
      // If every row uses the same currency, show it; otherwise blank.
      if (sub > 0) {
        if (!currency) currency = cur;
        else if (currency !== cur) currency = "";
      }
    });
    quoteTotalNode.textContent = total
      ? `${total.toLocaleString()} ${currency}`.trim()
      : "—";
  }

  // ── Rating sliders show "n/5" beside the input ─────────────────
  ["rate", "comfort", "difficulty"].forEach((key) => {
    const input = $(`tc-${key}`);
    const out = $(`tc-${key}-out`);
    if (!input || !out) return;
    const sync = () => {
      out.textContent = `${input.value}/5`;
    };
    input.addEventListener("input", sync);
    sync();
  });

  // ── Load / save ────────────────────────────────────────────────
  async function loadDoc() {
    setStatus("Loading…");
    saveBtn.disabled = true;
    try {
      const tripsRes = await fetch("/api/camp-trips").then((r) => r.json());
      const trip = (tripsRes.entries || []).find((t) => t.id === tripId);
      if (trip) {
        titleNode.textContent = `Trip Creator · ${trip.tripName || trip.serial || ""}`.trim();
        metaNode.textContent = [
          trip.serial,
          trip.tripName,
          trip.startDate ? `Start ${trip.startDate}` : "",
        ].filter(Boolean).join(" · ");
        // Pre-fill some defaults from the trip if the doc is empty.
        const docRes = await fetch(`/api/trip-creators/${encodeURIComponent(tripId)}`);
        const docPayload = await docRes.json();
        const doc = docPayload.doc || {};
        $("tc-title").value = doc.title || trip.tripName || "";
        $("tc-total-days").value = doc.totalDays || trip.totalDays || "";
        $("tc-total-km").value = doc.totalKm || "";
        $("tc-language").value = doc.language || "mn";
        $("tc-trip-type").value = doc.tripType || (trip.tripType || "TRIP").toUpperCase();
        $("tc-currency").value = doc.currency || "MNT";
        $("tc-offer-type").value = doc.offerType || "range";
        $("tc-international-flight").value = doc.internationalFlight || "included";
        $("tc-themes").value = (doc.themes || []).join(", ");
        $("tc-intro").value = doc.intro || "";
        ["rate", "comfort", "difficulty"].forEach((key) => {
          $(`tc-${key}`).value = String(doc[key] || 0);
          $(`tc-${key}-out`).textContent = `${doc[key] || 0}/5`;
        });
        renderProgram(doc.program && doc.program.length ? doc.program : seedProgramFromTrip(trip));
        renderQuote((doc.quotation && doc.quotation.rows) || []);
        $("tc-quote-note").value = (doc.quotation && doc.quotation.note) || "";
      } else {
        metaNode.textContent = "Trip not found.";
      }
      setStatus("");
    } catch (err) {
      setStatus(err.message || "Could not load.", "error");
    } finally {
      saveBtn.disabled = false;
    }
  }

  function seedProgramFromTrip(trip) {
    // First time the editor opens for a trip, scaffold one row per day so
    // the user has something to fill in. After they save once, we trust
    // the stored program and never re-seed.
    const days = Number(trip.totalDays || 0);
    if (!days || days > 30) return [];
    const out = [];
    for (let i = 1; i <= days; i++) {
      out.push({ day: `Өдөр ${i}`, title: "", body: "" });
    }
    return out;
  }

  function readPayload() {
    return {
      title: $("tc-title").value.trim(),
      totalDays: $("tc-total-days").value.trim(),
      totalKm: $("tc-total-km").value.trim(),
      language: $("tc-language").value,
      tripType: $("tc-trip-type").value,
      currency: $("tc-currency").value,
      offerType: $("tc-offer-type").value,
      internationalFlight: $("tc-international-flight").value,
      themes: $("tc-themes").value.split(",").map((s) => s.trim()).filter(Boolean),
      rate: Number($("tc-rate").value) || 0,
      comfort: Number($("tc-comfort").value) || 0,
      difficulty: Number($("tc-difficulty").value) || 0,
      intro: $("tc-intro").value,
      program: readProgram(),
      quotation: {
        rows: readQuoteRows(),
        note: $("tc-quote-note").value,
      },
    };
  }

  async function save() {
    setStatus("Saving…");
    saveBtn.disabled = true;
    try {
      const res = await fetch(`/api/trip-creators/${encodeURIComponent(tripId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(readPayload()),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setStatus("Saved.", "ok");
      setTimeout(() => setStatus(""), 1800);
    } catch (err) {
      setStatus(err.message || "Save failed.", "error");
    } finally {
      saveBtn.disabled = false;
    }
  }

  saveBtn.addEventListener("click", save);

  // Cmd/Ctrl-S also saves so users typing into long textareas don't have
  // to mouse over to the button.
  document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "s") {
      event.preventDefault();
      save();
    }
  });

  loadDoc();
})();
