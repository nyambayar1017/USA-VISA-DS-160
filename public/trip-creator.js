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
          <div class="tc-program-row" data-idx="${idx}">
            <div class="tc-program-row-head">
              <input type="text" class="tc-program-day" placeholder="Өдөр ${idx + 1}" value="${escapeHtml(row.day || `Өдөр ${idx + 1}`)}" />
              <input type="text" class="tc-program-title" placeholder="e.g. УБ - Истанбул нислэг" value="${escapeHtml(row.title || "")}" />
              <button type="button" class="tc-program-delete" data-action="delete-day" data-idx="${idx}" aria-label="Remove day">✕</button>
            </div>
            <textarea class="tc-program-body" rows="3" placeholder="Description. Use + Content link to embed [[slug]] markers that turn yellow on the public page.">${escapeHtml(row.body || "")}</textarea>
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
        day: row.querySelector(".tc-program-day")?.value || "",
        title: row.querySelector(".tc-program-title")?.value || "",
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
        setCoverIds(Array.isArray(doc.coverIds) ? doc.coverIds : []);
        renderQuote((doc.quotation && doc.quotation.rows) || []);
        $("tc-quote-note").value = (doc.quotation && doc.quotation.note) || "";
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
      coverIds: getCoverIds(),
      program: readProgram(),
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

  loadDoc();
})();
