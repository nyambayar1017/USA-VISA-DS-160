// Public client-facing brochure for one trip. Loaded at /trip/<tripId>;
// fetches /api/public/trips/<tripId> and renders a read-only layout.
// No login required.

(function () {
  const root = document.getElementById("trip-public-root");
  // Pull tripId from path: /trip/<id>
  const match = window.location.pathname.match(/^\/trip\/([^/?#]+)/);
  const tripId = match ? decodeURIComponent(match[1]) : "";

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function escAttr(value) {
    return escapeHtml(value);
  }

  function nl2br(value) {
    return escapeHtml(value).replace(/\n/g, "<br>");
  }

  function renderStars(value) {
    const v = Math.max(0, Math.min(5, Number(value) || 0));
    let out = "";
    for (let i = 1; i <= 5; i++) {
      out += `<span class="trip-public-star ${i <= v ? "is-on" : ""}">●</span>`;
    }
    return `${out}<span class="trip-public-star-text">${v}/5</span>`;
  }

  function renderQuote(quotation, currency) {
    const rows = (quotation && quotation.rows) || [];
    if (!rows.length && !(quotation && quotation.note)) return "";
    let total = 0;
    let curMix = "";
    const tbody = rows
      .map((row) => {
        const qty = parseFloat(row.qty || "0") || 0;
        const unit = parseFloat(row.unitPrice || "0") || 0;
        const sub = qty * unit;
        const cur = row.currency || currency || "";
        if (sub > 0) {
          if (!curMix) curMix = cur;
          else if (curMix !== cur) curMix = "";
        }
        total += sub;
        return `
          <tr>
            <td>${escapeHtml(row.label || "—")}</td>
            <td class="trip-public-num">${qty || "—"}</td>
            <td class="trip-public-num">${unit ? unit.toLocaleString() : "—"}</td>
            <td>${escapeHtml(cur || "")}</td>
            <td class="trip-public-num">${sub ? sub.toLocaleString() : "—"}</td>
          </tr>
        `;
      })
      .join("");
    const totalLabel = total
      ? `${total.toLocaleString()} ${curMix || currency || ""}`.trim()
      : "—";
    const note = quotation && quotation.note
      ? `<p class="trip-public-quote-note">${nl2br(quotation.note)}</p>`
      : "";
    if (!rows.length) return note;
    return `
      <section class="trip-public-section">
        <h2>Үнийн санал</h2>
        <div class="trip-public-quote-wrap">
          <table class="trip-public-quote">
            <thead>
              <tr>
                <th>Тайлбар</th>
                <th>Тоо</th>
                <th>Нэгж үнэ</th>
                <th>Валют</th>
                <th>Дүн</th>
              </tr>
            </thead>
            <tbody>${tbody}</tbody>
            <tfoot>
              <tr>
                <td colspan="4" class="trip-public-total-label">Нийт</td>
                <td class="trip-public-num trip-public-total">${escapeHtml(totalLabel)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        ${note}
      </section>
    `;
  }

  function render(doc) {
    const meta = [];
    if (doc.totalDays) meta.push(`${escapeHtml(doc.totalDays)} өдөр`);
    if (doc.totalKm) meta.push(`${escapeHtml(doc.totalKm)} km`);
    if (doc.tripType) meta.push(escapeHtml(doc.tripType));
    if (doc.trip && doc.trip.startDate) {
      const range = doc.trip.endDate
        ? `${doc.trip.startDate} → ${doc.trip.endDate}`
        : doc.trip.startDate;
      meta.push(escapeHtml(range));
    }
    const themes = (doc.themes || [])
      .map((t) => `<span class="trip-public-chip">${escapeHtml(t)}</span>`)
      .join(" ");
    const program = (doc.program || [])
      .map(
        (row) => `
          <article class="trip-public-day">
            <div class="trip-public-day-head">
              <span class="trip-public-day-pill">${escapeHtml(row.day || "")}</span>
              <h3>${escapeHtml(row.title || "")}</h3>
            </div>
            ${row.body ? `<p>${nl2br(row.body)}</p>` : ""}
          </article>
        `
      )
      .join("");

    document.title = doc.title ? `${doc.title} · TravelX` : "TravelX Trip";

    root.innerHTML = `
      <header class="trip-public-hero">
        <p class="trip-public-kicker">TravelX${doc.trip && doc.trip.serial ? ` · ${escapeHtml(doc.trip.serial)}` : ""}</p>
        <h1>${escapeHtml(doc.title || "Trip")}</h1>
        ${meta.length ? `<p class="trip-public-meta">${meta.join(" · ")}</p>` : ""}
        ${themes ? `<div class="trip-public-chips">${themes}</div>` : ""}
        <div class="trip-public-ratings">
          <div><span>Rate</span>${renderStars(doc.rate)}</div>
          <div><span>Comfort</span>${renderStars(doc.comfort)}</div>
          <div><span>Difficulty</span>${renderStars(doc.difficulty)}</div>
        </div>
        <p class="trip-public-flight-note">
          Олон улсын нислэг: <strong>${doc.internationalFlight === "excluded" ? "Багтаагүй" : "Багтсан"}</strong>
          · Үнэ: <strong>${doc.offerType === "fixed" ? "Тогтмол" : "Уян хатан"}</strong>
        </p>
      </header>

      ${doc.intro
        ? `<section class="trip-public-section trip-public-intro"><p>${nl2br(doc.intro)}</p></section>`
        : ""}

      ${program
        ? `<section class="trip-public-section">
            <h2>Хөтөлбөр</h2>
            <div class="trip-public-program">${program}</div>
          </section>`
        : ""}

      ${renderQuote(doc.quotation, doc.currency)}

      <footer class="trip-public-footer">
        <p>TravelX · backoffice.travelx.mn</p>
      </footer>
    `;
  }

  async function load() {
    if (!tripId) {
      root.innerHTML = `<p class="trip-public-empty">Trip not found.</p>`;
      return;
    }
    try {
      const res = await fetch(`/api/public/trips/${encodeURIComponent(tripId)}`);
      if (res.status === 404) {
        root.innerHTML = `
          <p class="trip-public-empty">
            This trip hasn't been published yet.<br>
            <small>Ask your travel manager to click <strong>Publish</strong> in the trip editor.</small>
          </p>
        `;
        return;
      }
      if (!res.ok) throw new Error("Failed to load");
      const doc = await res.json();
      render(doc);
    } catch (err) {
      root.innerHTML = `<p class="trip-public-empty">${escapeHtml(err.message || "Could not load.")}</p>`;
    }
  }

  load();
})();
