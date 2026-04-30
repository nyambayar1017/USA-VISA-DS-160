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
  // Show the "← Back to trip details" link in place of the generic
  // "TravelX" kicker once we know the trip — matches the user's ask
  // to return to /trip-detail without bouncing through Home.
  const backLink = document.getElementById("tc-back-to-trip");
  const backFallback = document.getElementById("tc-back-fallback");
  if (backLink && backFallback) {
    backLink.href = `/trip-detail?tripId=${encodeURIComponent(tripId)}`;
    backLink.removeAttribute("hidden");
    backFallback.setAttribute("hidden", "");
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

  // Reflect "is this trip live for clients?" in the toolbar. The public
  // /trip/<id> URL only resolves once a doc has been saved at least once,
  // so we gate Preview/Copy until that happens.
  let isPublished = false;
  function setPublishedState(published) {
    isPublished = !!published;
    const stateNode = document.getElementById("tc-publish-state");
    const previewLink = document.getElementById("tc-preview-link");
    const copyBtn = document.getElementById("tc-copy-link-btn");
    if (stateNode) {
      stateNode.dataset.state = isPublished ? "live" : "draft";
      stateNode.textContent = isPublished
        ? "✓ Published — share the link with clients"
        : "Draft — click Publish to share with clients";
    }
    if (previewLink) previewLink.classList.toggle("is-disabled", !isPublished);
    if (copyBtn) copyBtn.disabled = !isPublished;
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
      .map((row, idx) => {
        const ids = Array.isArray(row.imageIds) ? row.imageIds : [];
        const meals = row.meals || {};
        const thumbs = ids
          .map(
            (id) => `
              <div class="ct-image-thumb" data-id="${escapeHtml(id)}">
                <img src="/api/gallery/${encodeURIComponent(id)}/file?size=thumb" alt="" loading="lazy" />
                <button type="button" class="ct-image-remove" data-action="remove-day-image" data-idx="${idx}" data-id="${escapeHtml(id)}" aria-label="Remove">×</button>
              </div>
            `
          )
          .join("");
        return `
          <div class="tc-program-row" data-idx="${idx}" data-day-id="${escapeHtml(row.id || "")}">
            <input type="hidden" class="tc-program-id" value="${escapeHtml(row.id || "")}" />
            <input type="hidden" class="tc-program-template-id" value="${escapeHtml(row.templateId || "")}" />
            <div class="tc-program-row-head">
              <input type="text" class="tc-program-day" placeholder="Өдөр ${idx + 1}" value="${escapeHtml(row.day || `Өдөр ${idx + 1}`)}" />
              <input type="text" class="tc-program-title" placeholder="e.g. УБ - Истанбул нислэг" value="${escapeHtml(row.title || "")}" />
              <button type="button" class="tc-program-delete" data-action="delete-day" data-idx="${idx}" aria-label="Remove day">✕</button>
            </div>
            <div class="tc-program-meta-row">
              <label>Date <input type="text" class="tc-program-date" placeholder="e.g. 2026-07-11" value="${escapeHtml(row.date || "")}" /></label>
            </div>
            <div class="tc-program-route">
              <label>From <input type="text" class="tc-program-from" placeholder="Origin" value="${escapeHtml(row.fromName || "")}" /></label>
              <label>To <input type="text" class="tc-program-to" placeholder="Destination" value="${escapeHtml(row.toName || "")}" /></label>
              <label>Distance <input type="text" class="tc-program-distance" placeholder="80km" value="${escapeHtml(row.distance || "")}" /></label>
              <label>Drive <input type="text" class="tc-program-drive" placeholder="1h 30m" value="${escapeHtml(row.drive || "")}" /></label>
            </div>
            <textarea class="tc-program-body" rows="3" placeholder="Description. Use + Content link to embed [[slug]] markers that turn yellow on the public page.">${escapeHtml(row.body || "")}</textarea>
            <div class="tc-program-accomm">
              <label class="tc-program-accomm-name">Accommodation
                <input type="text" class="tc-program-accommodation" placeholder="Holiday Inn (or content slug)" value="${escapeHtml(row.accommodation || "")}" />
              </label>
              <label>Breakfast
                <div class="tc-meal-combo" data-meal-cat="breakfast">
                  <input type="text" class="tc-program-meal-b tc-meal-combo-input" placeholder="Hotel" value="${escapeHtml(typeof meals.breakfast === "string" ? meals.breakfast : "")}" autocomplete="off" />
                  <button type="button" class="tc-meal-combo-toggle" tabindex="-1" aria-label="Show suggestions">⌄</button>
                  <div class="tc-meal-combo-list" hidden></div>
                </div>
              </label>
              <label>Lunch
                <div class="tc-meal-combo" data-meal-cat="lunch">
                  <input type="text" class="tc-program-meal-l tc-meal-combo-input" placeholder="Restaurant" value="${escapeHtml(typeof meals.lunch === "string" ? meals.lunch : "")}" autocomplete="off" />
                  <button type="button" class="tc-meal-combo-toggle" tabindex="-1" aria-label="Show suggestions">⌄</button>
                  <div class="tc-meal-combo-list" hidden></div>
                </div>
              </label>
              <label>Dinner
                <div class="tc-meal-combo" data-meal-cat="dinner">
                  <input type="text" class="tc-program-meal-d tc-meal-combo-input" placeholder="Restaurant" value="${escapeHtml(typeof meals.dinner === "string" ? meals.dinner : "")}" autocomplete="off" />
                  <button type="button" class="tc-meal-combo-toggle" tabindex="-1" aria-label="Show suggestions">⌄</button>
                  <div class="tc-meal-combo-list" hidden></div>
                </div>
              </label>
            </div>
            <input type="hidden" class="tc-program-image-ids" value="${escapeHtml(ids.join(","))}" />
            <div class="tc-program-day-photos">
              <button type="button" class="ct-add-item-btn" data-action="pick-day-images" data-idx="${idx}">+ Photos</button>
              <button type="button" class="ct-add-item-btn" data-action="insert-content" data-idx="${idx}">+ Content link</button>
              <div class="ct-image-preview tc-day-thumbs">${thumbs}</div>
            </div>
          </div>
        `;
      })
      .join("");
  }

  document.getElementById("tc-add-day").addEventListener("click", () => {
    const current = readProgram();
    current.push({ day: `Өдөр ${current.length + 1}`, title: "", body: "" });
    renderProgram(current);
  });

  programList.addEventListener("click", async (event) => {
    const del = event.target.closest('[data-action="delete-day"]');
    if (del) {
      const idx = Number(del.dataset.idx);
      const current = readProgram();
      current.splice(idx, 1);
      renderProgram(current);
      return;
    }
    const removeImg = event.target.closest('[data-action="remove-day-image"]');
    if (removeImg) {
      const idx = Number(removeImg.dataset.idx);
      const id = removeImg.dataset.id;
      const current = readProgram();
      const day = current[idx];
      if (day) {
        day.imageIds = (day.imageIds || []).filter((existing) => existing !== id);
        renderProgram(current);
      }
      return;
    }
    const pick = event.target.closest('[data-action="pick-day-images"]');
    if (pick && window.ImagePicker) {
      const idx = Number(pick.dataset.idx);
      const current = readProgram();
      const day = current[idx] || { imageIds: [] };
      const picked = await window.ImagePicker.open({
        selected: day.imageIds || [],
        multiple: true,
        title: `Photos for ${day.day || `Day ${idx + 1}`}`,
      });
      if (Array.isArray(picked)) {
        day.imageIds = picked;
        current[idx] = day;
        renderProgram(current);
      }
      return;
    }
    const insertContent = event.target.closest('[data-action="insert-content"]');
    if (insertContent && window.ContentPicker) {
      const idx = Number(insertContent.dataset.idx);
      const row = programList.querySelector(`.tc-program-row[data-idx="${idx}"]`);
      const textarea = row?.querySelector(".tc-program-body");
      if (!textarea) return;
      const item = await window.ContentPicker.open({ title: "Insert content link" });
      if (!item || !item.slug) return;
      const insert = `[[${item.slug}|${(item.title || item.slug).replace(/\]/g, "")}]]`;
      // Replace any selected range or insert at the caret. After insertion,
      // place the cursor right after so the user can keep typing.
      const start = textarea.selectionStart ?? textarea.value.length;
      const end = textarea.selectionEnd ?? textarea.value.length;
      const before = textarea.value.slice(0, start);
      const after = textarea.value.slice(end);
      const sep = before && !/\s$/.test(before) ? " " : "";
      const trail = after && !/^\s/.test(after) ? " " : "";
      textarea.value = `${before}${sep}${insert}${trail}${after}`;
      const caret = before.length + sep.length + insert.length + trail.length;
      textarea.focus();
      textarea.setSelectionRange(caret, caret);
    }
  });

  function readProgram() {
    return Array.from(programList.querySelectorAll(".tc-program-row")).map((row) => {
      const idsRaw = row.querySelector(".tc-program-image-ids")?.value || "";
      return {
        id: row.querySelector(".tc-program-id")?.value || "",
        templateId: row.querySelector(".tc-program-template-id")?.value || "",
        day: row.querySelector(".tc-program-day")?.value || "",
        title: row.querySelector(".tc-program-title")?.value || "",
        date: row.querySelector(".tc-program-date")?.value || "",
        fromName: row.querySelector(".tc-program-from")?.value || "",
        toName: row.querySelector(".tc-program-to")?.value || "",
        distance: row.querySelector(".tc-program-distance")?.value || "",
        drive: row.querySelector(".tc-program-drive")?.value || "",
        accommodation: row.querySelector(".tc-program-accommodation")?.value || "",
        meals: {
          breakfast: row.querySelector(".tc-program-meal-b")?.value || "",
          lunch: row.querySelector(".tc-program-meal-l")?.value || "",
          dinner: row.querySelector(".tc-program-meal-d")?.value || "",
        },
        body: row.querySelector(".tc-program-body")?.value || "",
        imageIds: idsRaw.split(",").map((s) => s.trim()).filter(Boolean),
      };
    });
  }

  // ── Cover photos ────────────────────────────────────────────────
  const coverIdsInput = document.getElementById("tc-cover-ids");
  const coverPreview = document.getElementById("tc-cover-preview");
  const pickCoversBtn = document.getElementById("tc-pick-covers");

  function getCoverIds() {
    return (coverIdsInput.value || "").split(",").map((s) => s.trim()).filter(Boolean);
  }
  function setCoverIds(ids) {
    coverIdsInput.value = (ids || []).filter(Boolean).join(",");
    refreshCoverPreview();
  }
  function refreshCoverPreview() {
    const ids = getCoverIds();
    if (!ids.length) {
      coverPreview.innerHTML = `<p class="ct-hint">No cover photos. Click "+ Add cover photos".</p>`;
      return;
    }
    coverPreview.innerHTML = ids
      .map((id) => `
        <div class="ct-image-thumb" title="${escapeHtml(id)}">
          <img src="/api/gallery/${encodeURIComponent(id)}/file?size=thumb" alt="" loading="lazy" />
          <button type="button" class="ct-image-remove" data-action="remove-cover" data-id="${escapeHtml(id)}" aria-label="Remove">×</button>
        </div>
      `)
      .join("");
  }
  coverPreview.addEventListener("click", (event) => {
    const remove = event.target.closest('[data-action="remove-cover"]');
    if (!remove) return;
    setCoverIds(getCoverIds().filter((id) => id !== remove.dataset.id));
  });
  pickCoversBtn?.addEventListener("click", async () => {
    if (!window.ImagePicker) return;
    const picked = await window.ImagePicker.open({
      selected: getCoverIds(),
      multiple: true,
      title: "Choose cover photos for the trip",
    });
    if (Array.isArray(picked)) setCoverIds(picked);
  });

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

  // ── Brochure tab: accommSummary + flightLegs repeating rows ───
  const accommRowsEl = document.getElementById("tc-accomm-rows");
  const flightRowsEl = document.getElementById("tc-flight-rows");
  const addAccommBtn = document.getElementById("tc-add-accomm-row");
  const addFlightBtn = document.getElementById("tc-add-flight");

  function renderAccommSummary(rows) {
    accommRowsEl.innerHTML = (rows || []).map((row, idx) => `
      <div class="tc-repeat-row" data-idx="${idx}">
        <input type="hidden" class="tc-accomm-id" value="${escapeHtml(row.id || "")}" />
        <input type="hidden" class="tc-accomm-template-id" value="${escapeHtml(row.templateId || "")}" />
        <input type="text" class="tc-accomm-nights" placeholder="Nights" value="${escapeHtml(row.nights || "")}" />
        <input type="text" class="tc-accomm-label" placeholder="Place (e.g. Ulaanbaatar (2 nights))" value="${escapeHtml(row.label || "")}" />
        <input type="text" class="tc-accomm-hotel" placeholder="Hotel / camp name" value="${escapeHtml(row.hotel || "")}" />
        <button type="button" class="tc-program-delete" data-action="delete-accomm" data-idx="${idx}" aria-label="Remove">✕</button>
      </div>
    `).join("");
  }
  function readAccommSummary() {
    return Array.from(accommRowsEl.querySelectorAll(".tc-repeat-row")).map((r) => ({
      id: r.querySelector(".tc-accomm-id")?.value || "",
      templateId: r.querySelector(".tc-accomm-template-id")?.value || "",
      nights: r.querySelector(".tc-accomm-nights")?.value || "",
      label: r.querySelector(".tc-accomm-label")?.value || "",
      hotel: r.querySelector(".tc-accomm-hotel")?.value || "",
    }));
  }
  addAccommBtn?.addEventListener("click", () => {
    const cur = readAccommSummary();
    cur.push({ nights: "", label: "", hotel: "" });
    renderAccommSummary(cur);
  });
  accommRowsEl?.addEventListener("click", (e) => {
    const del = e.target.closest('[data-action="delete-accomm"]');
    if (!del) return;
    const cur = readAccommSummary();
    cur.splice(Number(del.dataset.idx), 1);
    renderAccommSummary(cur);
  });

  function renderFlightLegs(rows) {
    flightRowsEl.innerHTML = (rows || []).map((row, idx) => `
      <div class="tc-repeat-row tc-repeat-row--flight" data-idx="${idx}">
        <input type="hidden" class="tc-flight-id" value="${escapeHtml(row.id || "")}" />
        <input type="hidden" class="tc-flight-template-id" value="${escapeHtml(row.templateId || "")}" />
        <input type="text" class="tc-flight-n" placeholder="#" value="${escapeHtml(row.n || String(idx + 1))}" />
        <input type="text" class="tc-flight-date" placeholder="Date" value="${escapeHtml(row.date || "")}" />
        <input type="text" class="tc-flight-dep" placeholder="Dep" value="${escapeHtml(row.dep || "")}" />
        <input type="text" class="tc-flight-from" placeholder="From" value="${escapeHtml(row.depFrom || "")}" />
        <input type="text" class="tc-flight-arr" placeholder="Arr" value="${escapeHtml(row.arr || "")}" />
        <input type="text" class="tc-flight-to" placeholder="To" value="${escapeHtml(row.arrTo || "")}" />
        <input type="text" class="tc-flight-flight" placeholder="Flight #" value="${escapeHtml(row.flight || "")}" />
        <button type="button" class="tc-program-delete" data-action="delete-flight" data-idx="${idx}" aria-label="Remove">✕</button>
      </div>
    `).join("");
  }
  function readFlightLegs() {
    return Array.from(flightRowsEl.querySelectorAll(".tc-repeat-row")).map((r) => ({
      id: r.querySelector(".tc-flight-id")?.value || "",
      templateId: r.querySelector(".tc-flight-template-id")?.value || "",
      n: r.querySelector(".tc-flight-n")?.value || "",
      date: r.querySelector(".tc-flight-date")?.value || "",
      dep: r.querySelector(".tc-flight-dep")?.value || "",
      depFrom: r.querySelector(".tc-flight-from")?.value || "",
      arr: r.querySelector(".tc-flight-arr")?.value || "",
      arrTo: r.querySelector(".tc-flight-to")?.value || "",
      flight: r.querySelector(".tc-flight-flight")?.value || "",
    }));
  }
  addFlightBtn?.addEventListener("click", () => {
    const cur = readFlightLegs();
    cur.push({ n: String(cur.length + 1) });
    renderFlightLegs(cur);
  });
  flightRowsEl?.addEventListener("click", (e) => {
    const del = e.target.closest('[data-action="delete-flight"]');
    if (!del) return;
    const cur = readFlightLegs();
    cur.splice(Number(del.dataset.idx), 1);
    renderFlightLegs(cur);
  });

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
        $("tc-subtitle").value = doc.subtitle || "";
        $("tc-total-days").value = doc.totalDays || trip.totalDays || "";
        $("tc-total-km").value = doc.totalKm || "";
        $("tc-price-from").value = doc.priceFrom || "";
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
        setCoverIds(Array.isArray(doc.coverIds) ? doc.coverIds : []);
        renderQuote((doc.quotation && doc.quotation.rows) || []);
        $("tc-quote-note").value = (doc.quotation && doc.quotation.note) || "";
        // Brochure tab
        $("tc-highlights").value = (doc.highlights || []).join("\n");
        $("tc-included").value = (doc.included || []).join("\n");
        $("tc-not-included").value = (doc.notIncluded || []).join("\n");
        const m = doc.manager || {};
        $("tc-manager-name").value = m.name || "";
        $("tc-manager-role").value = m.role || "";
        $("tc-manager-phone").value = m.phone || "";
        $("tc-manager-email").value = m.email || "";
        $("tc-manager-avatar").value = m.avatar || "";
        renderAccommSummary(doc.accommSummary || []);
        renderFlightLegs(doc.flightLegs || []);
        // Guide tab
        $("tc-mongolia-guide").value = doc.mongoliaGuide || "";
        // The doc has updatedAt only after at least one save — that's our
        // proxy for "this trip is live at /trip/<id>".
        setPublishedState(!!doc.updatedAt);
      } else {
        metaNode.textContent = "Trip not found.";
        setPublishedState(false);
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

  function splitLines(value) {
    return String(value || "").split("\n").map((s) => s.trim()).filter(Boolean);
  }

  function readPayload() {
    return {
      title: $("tc-title").value.trim(),
      subtitle: $("tc-subtitle").value.trim(),
      totalDays: $("tc-total-days").value.trim(),
      totalKm: $("tc-total-km").value.trim(),
      priceFrom: $("tc-price-from").value.trim(),
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
      coverIds: getCoverIds(),
      program: readProgram(),
      highlights: splitLines($("tc-highlights").value),
      included: splitLines($("tc-included").value),
      notIncluded: splitLines($("tc-not-included").value),
      accommSummary: readAccommSummary(),
      flightLegs: readFlightLegs(),
      manager: {
        name: $("tc-manager-name").value.trim(),
        role: $("tc-manager-role").value.trim(),
        phone: $("tc-manager-phone").value.trim(),
        email: $("tc-manager-email").value.trim(),
        avatar: $("tc-manager-avatar").value.trim(),
      },
      mongoliaGuide: $("tc-mongolia-guide").value,
      quotation: {
        rows: readQuoteRows(),
        note: $("tc-quote-note").value,
      },
    };
  }

  async function save() {
    setStatus("Publishing…");
    saveBtn.disabled = true;
    try {
      const res = await fetch(`/api/trip-creators/${encodeURIComponent(tripId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(readPayload()),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Publish failed");
      setStatus("✓ Published.", "ok");
      setPublishedState(true);
      setTimeout(() => setStatus(""), 1800);
    } catch (err) {
      setStatus(err.message || "Publish failed.", "error");
    } finally {
      saveBtn.disabled = false;
    }
  }

  saveBtn.addEventListener("click", save);

  // ── Preview link + copy-to-clipboard ────────────────────────────
  const previewLink = document.getElementById("tc-preview-link");
  const copyBtn = document.getElementById("tc-copy-link-btn");
  const publicUrl = `${window.location.origin}/trip/${encodeURIComponent(tripId)}`;
  if (previewLink) {
    previewLink.href = publicUrl;
    previewLink.addEventListener("click", (event) => {
      if (!isPublished) {
        event.preventDefault();
        setStatus("Click Publish first so the page exists.", "error");
        setTimeout(() => setStatus(""), 2400);
      }
    });
  }
  if (copyBtn) {
    copyBtn.addEventListener("click", async () => {
      if (!isPublished) return;
      try {
        await navigator.clipboard.writeText(publicUrl);
        const prev = copyBtn.textContent;
        copyBtn.textContent = "✓ Copied";
        setTimeout(() => { copyBtn.textContent = prev; }, 1500);
      } catch {
        window.prompt("Copy this link to share with the client:", publicUrl);
      }
    });
  }

  // Cmd/Ctrl-S also saves so users typing into long textareas don't have
  // to mouse over to the button.
  document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "s") {
      event.preventDefault();
      save();
    }
  });

  // Meal-templates combobox: replaces the native <datalist> (which
  // doesn't open on click in Safari) with a click-to-open dropdown
  // that also filters as the user types. Uncategorized templates
  // surface in all three buckets while the user migrates them.
  const mealTemplateCache = { breakfast: [], lunch: [], dinner: [] };

  async function loadMealTemplates() {
    try {
      const res = await fetch("/api/meal-templates");
      if (!res.ok) return;
      const data = await res.json();
      const entries = data.entries || [];
      const buckets = { breakfast: [], lunch: [], dinner: [] };
      entries.forEach((t) => {
        const cat = (t.category || "").toLowerCase();
        if (cat === "breakfast" || cat === "lunch" || cat === "dinner") {
          buckets[cat].push(t.name || "");
        } else {
          buckets.breakfast.push(t.name || "");
          buckets.lunch.push(t.name || "");
          buckets.dinner.push(t.name || "");
        }
      });
      ["breakfast", "lunch", "dinner"].forEach((cat) => {
        mealTemplateCache[cat] = buckets[cat].filter(Boolean);
      });
    } catch (_err) {
      // Suggestions are optional — silent fail.
    }
  }

  function renderMealComboList(combo) {
    const cat = combo.dataset.mealCat;
    const input = combo.querySelector(".tc-meal-combo-input");
    const list = combo.querySelector(".tc-meal-combo-list");
    if (!list || !input) return;
    const filter = (input.value || "").trim().toLowerCase();
    const items = (mealTemplateCache[cat] || []).filter((name) =>
      !filter || name.toLowerCase().includes(filter)
    );
    if (!items.length) {
      list.innerHTML = `<div class="tc-meal-combo-empty">No saved templates. Add some on /templates.</div>`;
      return;
    }
    list.innerHTML = items
      .map((name) => `<button type="button" class="tc-meal-combo-item" data-value="${escapeHtml(name)}">${escapeHtml(name)}</button>`)
      .join("");
  }

  function openMealCombo(combo) {
    document.querySelectorAll(".tc-meal-combo .tc-meal-combo-list:not([hidden])").forEach((l) => {
      if (l !== combo.querySelector(".tc-meal-combo-list")) l.hidden = true;
    });
    renderMealComboList(combo);
    combo.querySelector(".tc-meal-combo-list").hidden = false;
    combo.classList.add("is-open");
  }

  function closeMealCombo(combo) {
    const list = combo.querySelector(".tc-meal-combo-list");
    if (list) list.hidden = true;
    combo.classList.remove("is-open");
  }

  // Event delegation — works for both initial render and any rows
  // added after load (e.g. + Add day).
  document.addEventListener("click", (event) => {
    const item = event.target.closest(".tc-meal-combo-item");
    if (item) {
      const combo = item.closest(".tc-meal-combo");
      const input = combo.querySelector(".tc-meal-combo-input");
      input.value = item.dataset.value || "";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      closeMealCombo(combo);
      return;
    }
    const toggle = event.target.closest(".tc-meal-combo-toggle");
    if (toggle) {
      const combo = toggle.closest(".tc-meal-combo");
      const list = combo.querySelector(".tc-meal-combo-list");
      if (list.hidden) openMealCombo(combo);
      else closeMealCombo(combo);
      return;
    }
    // Outside-click close.
    if (!event.target.closest(".tc-meal-combo")) {
      document.querySelectorAll(".tc-meal-combo.is-open").forEach(closeMealCombo);
    }
  });
  document.addEventListener("focusin", (event) => {
    const combo = event.target.closest(".tc-meal-combo");
    if (combo && event.target.matches(".tc-meal-combo-input")) {
      openMealCombo(combo);
    }
  });
  document.addEventListener("input", (event) => {
    const combo = event.target.closest(".tc-meal-combo");
    if (combo && event.target.matches(".tc-meal-combo-input")) {
      renderMealComboList(combo);
      combo.querySelector(".tc-meal-combo-list").hidden = false;
    }
  });

  loadMealTemplates();
  loadDoc();
})();
