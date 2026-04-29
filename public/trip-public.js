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

  // Replace [[slug]] or [[slug|Display Text]] in already-escaped HTML with
  // a clickable link. We run this after escapeHtml because the brackets
  // survive (HTML doesn't escape them) — the regex still matches.
  function linkifyContent(html) {
    return html.replace(/\[\[([a-z0-9_\-]+)(?:\|([^\]]+))?\]\]/gi, (_match, slug, label) => {
      const text = (label || slug).trim();
      return `<a class="trip-public-content-link" href="#" data-slug="${slug}">${text}</a>`;
    });
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

  function renderDots(filled, total) {
    let out = "";
    for (let i = 0; i < total; i++) {
      out += `<span class="tp-dot${i < filled ? " is-on" : ""}"></span>`;
    }
    return out;
  }

  function renderHighlights(doc) {
    // Manual highlights[] from the editor wins. When empty, fall back to
    // day titles ("Day 1: Ulaanbaatar - Singapore", etc.) so every trip
    // shows a meaningful highlights list without manual data entry.
    const manual = (doc.highlights || []).filter((h) => (h || "").trim());
    const program = Array.isArray(doc.program) ? doc.program : [];
    const auto = manual.length
      ? []
      : program
          .map((row, i) => {
            const label = (row.day || `Day ${i + 1}`).trim();
            const title = (row.title || "").trim();
            if (!label && !title) return "";
            if (!title) return label;
            return `${label}: ${title}`;
          })
          .filter(Boolean);
    const highlights = manual.length ? manual : auto;
    const summary = doc.accommSummary || [];
    if (!highlights.length && !summary.length) return "";
    const bullets = highlights.length
      ? `<ul class="tp-highlights">
          ${highlights.map((h) => `<li><span class="tp-bullet"></span>${escapeHtml(h)}</li>`).join("")}
        </ul>`
      : "";
    const summaryRows = summary.length
      ? `<div class="tp-accomm-summary">
          ${summary.map((a) => `
            <div class="tp-accomm-summary-row">
              <span>${escapeHtml(a.label || "")}${a.label ? " — " : ""}</span>
              <span class="tp-accomm-summary-hotel">${escapeHtml(a.hotel || "")}</span>
            </div>
          `).join("")}
        </div>`
      : "";
    return `
      <section class="tp-card">
        <h2 class="tp-card-h"><span class="tp-bar"></span>Trip highlights</h2>
        ${bullets}
        ${summaryRows}
      </section>
    `;
  }

  function renderRouteBlock(row) {
    const fromName = row.fromName || "";
    const toName = row.toName || "";
    if (!fromName && !toName && !row.distance && !row.drive) return "";
    const middle = row.drive === "Free day"
      ? `<span class="tp-route-free">Free day</span>`
      : (row.distance || row.drive
          ? `<span class="tp-route-line">
              ${row.distance ? `<span>🚙 ${escapeHtml(row.distance)}</span>` : ""}
              ${row.distance && row.drive ? `<span class="tp-route-sep">·</span>` : ""}
              ${row.drive ? `<span>⏱ ${escapeHtml(row.drive)}</span>` : ""}
            </span>`
          : "");
    return `
      <div class="tp-route">
        ${fromName ? `<div class="tp-route-stop"><span>📍</span><span>${escapeHtml(fromName)}</span></div>` : ""}
        ${middle ? `<div class="tp-route-mid">${middle}</div>` : ""}
        ${toName ? `<div class="tp-route-stop"><span>📍</span><span>${escapeHtml(toName)}</span></div>` : ""}
      </div>
    `;
  }

  function renderAccommodation(row) {
    const accom = row.accommodation || "";
    const meals = row.meals || {};
    const hasMeals = meals.breakfast || meals.lunch || meals.dinner;
    if (!accom && !hasMeals) return "";
    const chip = (label, on) =>
      `<span class="tp-meal-chip${on ? " is-on" : ""}" title="${label === "B" ? "Breakfast" : label === "L" ? "Lunch" : "Dinner"}">${label}</span>`;
    return `
      <div class="tp-accomm">
        <span class="tp-accomm-icon">🛏</span>
        <span class="tp-accomm-name">${escapeHtml(accom || "—")}</span>
        <span class="tp-meal-chips">
          ${chip("B", meals.breakfast)}${chip("L", meals.lunch)}${chip("D", meals.dinner)}
        </span>
      </div>
    `;
  }

  function renderDayCard(row, idx) {
    const route = renderRouteBlock(row);
    const accomm = renderAccommodation(row);
    const body = row.body
      ? `<div class="tp-day-body">${linkifyContent(nl2br(row.body))}</div>`
      : "";
    const dayId = row.id || `day-${idx}`;
    return `
      <div class="tp-day-grid">
        <div class="tp-day-route-col">${route}</div>
        <article class="tp-day-card is-open" data-day-id="${escAttr(dayId)}">
          <button type="button" class="tp-day-head" data-action="toggle-day">
            <div>
              <span class="tp-day-pill">${escapeHtml(row.day || "")}</span>
              <span class="tp-day-title">${escapeHtml(row.title || "")}</span>
              ${row.date ? `<div class="tp-day-date">${escapeHtml(row.date)}</div>` : ""}
            </div>
            <span class="tp-day-chev" aria-hidden="true">⌄</span>
          </button>
          <div class="tp-day-collapse">
            ${body}
            ${accomm}
          </div>
        </article>
      </div>
    `;
  }

  function renderIncluded(doc) {
    const inc = doc.included || [];
    const not = doc.notIncluded || [];
    if (!inc.length && !not.length) return "";
    const list = (items, kind) => items.length
      ? `<ul class="tp-inc-list tp-inc-list--${kind}">
          ${items.map((i) => `
            <li><span class="tp-inc-mark">${kind === "yes" ? "✓" : "×"}</span><span>${escapeHtml(i)}</span></li>
          `).join("")}
        </ul>`
      : "";
    return `
      <section class="tp-card">
        <h2 class="tp-card-h"><span class="tp-bar"></span>What's included</h2>
        <div class="tp-inc-grid">
          ${inc.length ? `<div><div class="tp-inc-head tp-inc-head--yes">Included</div>${list(inc, "yes")}</div>` : ""}
          ${not.length ? `<div><div class="tp-inc-head tp-inc-head--no">Not included</div>${list(not, "no")}</div>` : ""}
        </div>
      </section>
    `;
  }

  function renderFlightTable(legs) {
    if (!legs || !legs.length) return "";
    return `
      <section class="tp-card tp-card--narrow">
        <h2 class="tp-card-h"><span class="tp-bar"></span>Flights</h2>
        <table class="tp-flights">
          <thead>
            <tr><th>#</th><th>Date</th><th>Dep</th><th>From</th><th>Arr</th><th>To</th><th>Flight</th></tr>
          </thead>
          <tbody>
            ${legs.map((l, i) => `
              <tr>
                <td>${escapeHtml(l.n || String(i + 1))}</td>
                <td>${escapeHtml(l.date || "")}</td>
                <td>${escapeHtml(l.dep || "")}</td>
                <td>${escapeHtml(l.depFrom || "")}</td>
                <td>${escapeHtml(l.arr || "")}</td>
                <td>${escapeHtml(l.arrTo || "")}</td>
                <td>${escapeHtml(l.flight || "")}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </section>
    `;
  }

  function renderInfoCard(doc) {
    const m = doc.manager || {};
    const totalDays = doc.totalDays || (doc.program || []).length || "";
    const dateLabel = doc.trip && doc.trip.startDate
      ? (doc.trip.endDate ? `${doc.trip.startDate} → ${doc.trip.endDate}` : doc.trip.startDate)
      : "";
    const priceLine = doc.priceFrom
      ? `<div class="tp-info-price"><span class="tp-info-price-num">$${escapeHtml(doc.priceFrom)}</span><span class="tp-info-price-label">Price from</span></div>`
      : "";
    const managerBlock = (m.name || m.phone || m.email)
      ? `
        <div class="tp-info-mgr">
          ${m.avatar ? `<img class="tp-info-mgr-avatar" src="${escAttr(m.avatar)}" alt="${escAttr(m.name || "")}" />` : `<div class="tp-info-mgr-avatar tp-info-mgr-avatar--blank">👤</div>`}
          <div>
            ${m.name ? `<div class="tp-info-mgr-name">${escapeHtml(m.name)}</div>` : ""}
            ${m.role ? `<div class="tp-info-mgr-role">${escapeHtml(m.role)}</div>` : ""}
          </div>
        </div>
        <div class="tp-info-contact">
          ${m.phone ? `<a href="tel:${escAttr(m.phone)}"><span>📞</span>${escapeHtml(m.phone)}</a>` : ""}
          ${m.email ? `<a href="mailto:${escAttr(m.email)}"><span>✉</span>${escapeHtml(m.email)}</a>` : ""}
        </div>
      `
      : "";
    return `
      <aside class="tp-info">
        <div class="tp-info-head">
          ${totalDays ? `<div class="tp-info-line"><strong>${escapeHtml(totalDays)} days</strong>${dateLabel ? ` <span>${escapeHtml(dateLabel)}</span>` : ""}</div>` : ""}
          ${priceLine}
          <div class="tp-info-row"><span class="tp-info-row-label">Difficulty:</span><span class="tp-info-dots">${renderDots(doc.difficulty || 0, 5)}</span><span class="tp-info-row-num">${doc.difficulty || 0}/5</span></div>
          <div class="tp-info-row"><span class="tp-info-row-label">Comfort:</span><span class="tp-info-dots">${renderDots(doc.comfort || 0, 5)}</span><span class="tp-info-row-num">${doc.comfort || 0}/5</span></div>
          <div class="tp-info-row"><span class="tp-info-row-label">Rate:</span><span class="tp-info-dots">${renderDots(doc.rate || 0, 5)}</span><span class="tp-info-row-num">${doc.rate || 0}/5</span></div>
        </div>
        ${managerBlock}
        <div class="tp-info-actions">
          ${m.email ? `<a class="tp-info-cta" href="mailto:${escAttr(m.email)}?subject=${encodeURIComponent("Quotation for " + (doc.title || "your trip"))}">Ask for quotation</a>` : `<button type="button" class="tp-info-cta" onclick="window.print()">Download itinerary</button>`}
          <button type="button" class="tp-info-cta tp-info-cta--ghost" onclick="window.print()">⤓ Download PDF</button>
        </div>
      </aside>
    `;
  }

  function render(doc) {
    const program = doc.program || [];
    const galleryUrl = (id, size) => `/api/gallery/${encodeURIComponent(id)}/file${size ? `?size=${size}` : ""}`;

    // All per-day photos collected (de-duped) for the top hero strip + gallery card.
    const allDayImageIds = [];
    const seenDayImageIds = new Set();
    program.forEach((row) => {
      (Array.isArray(row.imageIds) ? row.imageIds : []).forEach((id) => {
        if (id && !seenDayImageIds.has(id)) {
          seenDayImageIds.add(id);
          allDayImageIds.push(id);
        }
      });
    });
    const heroStripUrls = allDayImageIds.map((id) => galleryUrl(id));
    const heroStripUrlsAttr = escAttr(JSON.stringify(heroStripUrls));
    const heroStrip = allDayImageIds.length
      ? `
        <div class="trip-public-hero-strip">
          ${allDayImageIds.map((id, i) => `
            <button type="button" class="trip-public-hero-strip-tile"
              data-lightbox-urls="${heroStripUrlsAttr}" data-lightbox-index="${i}">
              <img src="${galleryUrl(id, "medium")}" alt="" loading="lazy" />
            </button>
          `).join("")}
        </div>
      `
      : "";

    // Smaller gallery card — one tile per day with a "D{n}" badge.
    const galleryCard = program.length && program.some((p) => (p.imageIds || []).length)
      ? `
        <section class="tp-card">
          <h2 class="tp-card-h"><span class="tp-bar"></span>Gallery</h2>
          <div class="tp-gallery">
            ${program.map((p, i) => {
              const id = (p.imageIds || [])[0];
              if (!id) return "";
              return `
                <button type="button" class="tp-gallery-tile"
                  data-lightbox-urls="${heroStripUrlsAttr}"
                  data-lightbox-index="${heroStripUrls.indexOf(galleryUrl(id))}">
                  <img src="${galleryUrl(id, "thumb")}" alt="" loading="lazy" />
                  <span class="tp-gallery-badge">${escapeHtml(p.day || `D${i + 1}`)}</span>
                </button>
              `;
            }).join("")}
          </div>
        </section>
      `
      : "";

    const company = (doc.trip || {}).company || "DTX";
    const brand = company === "USM" ? "STEPPE MONGOLIA" : "ДЭЛХИЙ ТРЭВЕЛ ИКС";
    const subtitleText = doc.subtitle
      || [
        doc.totalDays ? `${doc.totalDays} өдөр` : "",
        doc.tripType,
        doc.trip && doc.trip.serial ? doc.trip.serial : "",
      ].filter(Boolean).join(" · ");

    document.title = doc.title ? `${doc.title} · ${brand}` : brand;

    const programHtml = program.map((row, idx) => renderDayCard(row, idx)).join("");

    // Render the Mongolia/region guide as paragraphs; lines starting with
    // "##" become h3 headings (matches the editor textarea hint).
    const guideText = (doc.mongoliaGuide || "").trim();
    const guideHtml = guideText
      ? guideText.split(/\n{2,}/).map((block) => {
          const trimmed = block.trim();
          if (trimmed.startsWith("##")) {
            return `<h3>${escapeHtml(trimmed.replace(/^#+\s*/, ""))}</h3>`;
          }
          return `<p>${nl2br(trimmed)}</p>`;
        }).join("")
      : "";
    const hasGuide = !!guideText;

    root.innerHTML = `
      <header class="tp-head">
        <div class="tp-head-brand">
          <span class="tp-head-brand-dot"></span>${escapeHtml(brand)}
        </div>
        <button type="button" class="tp-head-print" onclick="window.print()">
          <span class="tp-head-print-icon">⤓</span> Download itinerary PDF
        </button>
      </header>

      ${heroStrip}

      <div class="tp-wrap">
        <main class="tp-main">
          <section class="tp-card tp-overview">
            ${subtitleText ? `<div class="tp-kicker">${escapeHtml(subtitleText)}</div>` : ""}
            <h1>${escapeHtml(doc.title || "Trip")}</h1>
            ${doc.intro ? `<div class="tp-intro">${linkifyContent(nl2br(doc.intro))}</div>` : ""}
          </section>

          ${galleryCard}

          ${hasGuide ? `
            <div class="tp-tabs" role="tablist">
              <button type="button" class="tp-tab is-active" data-tab="itinerary" role="tab">Itinerary</button>
              <button type="button" class="tp-tab" data-tab="guide" role="tab">Guide</button>
            </div>
          ` : ""}

          <div class="tp-tab-panel" data-tab-panel="itinerary">
            ${renderHighlights(doc)}

            ${program.length ? `
              <section class="tp-program">
                <div class="tp-section-head-row">
                  <h2 class="tp-section-h"><span class="tp-bar"></span>Day-by-day itinerary</h2>
                  <button type="button" class="tp-toggle-all" data-action="toggle-all">Collapse all</button>
                </div>
                ${programHtml}
              </section>
            ` : ""}

            ${renderIncluded(doc)}

            ${renderFlightTable(doc.flightLegs)}

            ${renderQuote(doc.quotation, doc.currency)}
          </div>

          ${hasGuide ? `
            <div class="tp-tab-panel" data-tab-panel="guide" hidden>
              <section class="tp-card">
                <h2 class="tp-card-h"><span class="tp-bar"></span>Travel guide</h2>
                <div class="tp-guide">${guideHtml}</div>
              </section>
            </div>
          ` : ""}
        </main>

        ${renderInfoCard(doc)}
      </div>

      <footer class="tp-foot">
        <p>${escapeHtml(brand)} · backoffice.travelx.mn</p>
      </footer>
    `;
  }

  async function load() {
    if (!tripId) {
      root.innerHTML = `<p class="trip-public-empty">Trip not found.</p>`;
      return;
    }
    // Server-rendered inline payload (instant first paint, no fetch round-trip).
    const inline = document.getElementById("__initial_data");
    if (inline && inline.textContent.trim()) {
      try {
        const doc = JSON.parse(inline.textContent);
        if (doc) {
          render(doc);
          return;
        }
      } catch {
        /* fall through to fetch */
      }
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

  // ── Content popup ─────────────────────────────────────────────
  // Click on a [[slug]] link → fetch /api/public/content/<slug> → modal
  // with title, photo gallery, summary, bullet groups, and YouTube embed.
  const popupCache = new Map();

  function youtubeEmbedUrl(url) {
    if (!url) return "";
    const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{6,})/);
    return m ? `https://www.youtube.com/embed/${m[1]}` : "";
  }

  function mapEmbedUrl(value) {
    if (!value) return "";
    const v = String(value).trim();
    const iframeMatch = v.match(/<iframe[^>]+src=["']([^"']+)["']/i);
    if (iframeMatch) return iframeMatch[1];
    if (/^https:\/\/(www\.)?google\.com\/maps\/embed/.test(v)) return v;
    return `https://maps.google.com/maps?q=${encodeURIComponent(v)}&output=embed`;
  }

  function renderPopup(content) {
    const overlay = document.createElement("div");
    overlay.className = "trip-popup-overlay";
    const images = (content.images || []).map((img) => img.url).filter(Boolean);
    const urlsAttr = escapeHtml(JSON.stringify(images));
    const sizedThumb = (url, size) => url + (url.includes("?") ? "&" : "?") + "size=" + size;
    const galleryHtml = images.length
      ? `
        <div class="content-gallery${images.length === 1 ? " is-single" : ""}">
          ${images.map((url, i) => {
            const variant = (i === 0 && images.length > 1) ? "medium" : "thumb";
            return `
              <button type="button" class="content-gallery-tile${i === 0 ? " is-featured" : ""}" data-lightbox-urls="${urlsAttr}" data-lightbox-index="${i}">
                <img src="${escapeHtml(sizedThumb(url, variant))}" alt="" loading="lazy" />
              </button>
            `;
          }).join("")}
        </div>
      `
      : "";
    const groups = (content.bulletGroups || [])
      .map((g) => `
        <div class="trip-popup-group">
          ${g.heading ? `<h3>${escapeHtml(g.heading)}</h3>` : ""}
          <ul>${(g.items || []).map((it) => `<li>${escapeHtml(it)}</li>`).join("")}</ul>
        </div>
      `)
      .join("");
    const embed = youtubeEmbedUrl(content.videoUrl);
    const video = embed
      ? `<div class="trip-popup-video"><iframe src="${escapeHtml(embed)}" loading="lazy" allowfullscreen></iframe></div>`
      : (content.videoUrl
        ? `<div class="trip-popup-video-link"><a href="${escapeHtml(content.videoUrl)}" target="_blank" rel="noopener">▶ Watch video</a></div>`
        : "");
    const mapSrc = mapEmbedUrl(content.location);
    const mapOpenUrl = content.location
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(content.location)}`
      : "";
    const map = mapSrc
      ? `
        <div class="trip-popup-map-section">
          <div class="trip-popup-map-head">
            <h3>📍 Байршил</h3>
            <div class="trip-popup-map-actions">
              <button type="button" class="trip-popup-map-fs" data-action="map-fullscreen" title="Fullscreen">⛶ Fullscreen</button>
              ${mapOpenUrl ? `<a class="trip-popup-map-link" href="${escapeHtml(mapOpenUrl)}" target="_blank" rel="noopener">Open in Google Maps ↗</a>` : ""}
            </div>
          </div>
          <div class="trip-popup-map" data-map-frame>
            <iframe src="${escapeHtml(mapSrc)}" loading="lazy" allowfullscreen referrerpolicy="no-referrer-when-downgrade"></iframe>
          </div>
        </div>
      `
      : "";
    overlay.innerHTML = `
      <div class="trip-popup-dialog" role="dialog" aria-modal="true">
        <button type="button" class="trip-popup-close" data-action="close-popup" aria-label="Close">×</button>
        ${galleryHtml}
        <div class="trip-popup-body">
          <h2>${escapeHtml(content.title || content.slug || "")}</h2>
          ${content.summary ? `<p class="trip-popup-summary">${nl2br(content.summary)}</p>` : ""}
          ${groups}
          ${video}
          ${map}
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    document.body.classList.add("trip-popup-open");
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay || event.target.closest('[data-action="close-popup"]')) {
        overlay.remove();
        document.body.classList.remove("trip-popup-open");
        return;
      }
      if (event.target.closest('[data-action="map-fullscreen"]')) {
        const frame = overlay.querySelector("[data-map-frame] iframe");
        if (!frame) return;
        if (frame.requestFullscreen) frame.requestFullscreen();
        else if (frame.webkitRequestFullscreen) frame.webkitRequestFullscreen();
      }
    });
  }

  async function openSlug(slug) {
    if (popupCache.has(slug)) {
      renderPopup(popupCache.get(slug));
      return;
    }
    try {
      const res = await fetch(`/api/public/content/${encodeURIComponent(slug)}`);
      if (res.status === 404) {
        alert("This content hasn't been published yet.");
        return;
      }
      if (!res.ok) throw new Error("Could not load content");
      const content = await res.json();
      popupCache.set(slug, content);
      renderPopup(content);
    } catch (err) {
      alert(err.message || "Could not open content.");
    }
  }

  document.addEventListener("click", (event) => {
    const link = event.target.closest(".trip-public-content-link");
    if (link) {
      event.preventDefault();
      const slug = link.dataset.slug;
      if (slug) openSlug(slug);
      return;
    }

    // Itinerary / Guide tab switch.
    const tabBtn = event.target.closest(".tp-tab");
    if (tabBtn) {
      const target = tabBtn.dataset.tab;
      document.querySelectorAll(".tp-tab").forEach((b) => b.classList.toggle("is-active", b === tabBtn));
      document.querySelectorAll("[data-tab-panel]").forEach((p) => {
        const match = p.dataset.tabPanel === target;
        if (match) p.removeAttribute("hidden");
        else p.setAttribute("hidden", "");
      });
      return;
    }

    // Toggle a single day card open/closed.
    const dayHead = event.target.closest('[data-action="toggle-day"]');
    if (dayHead) {
      dayHead.closest(".tp-day-card")?.classList.toggle("is-open");
      return;
    }

    // Expand all / Collapse all.
    const toggleAll = event.target.closest('[data-action="toggle-all"]');
    if (toggleAll) {
      const cards = document.querySelectorAll(".tp-day-card");
      const anyClosed = Array.from(cards).some((c) => !c.classList.contains("is-open"));
      cards.forEach((c) => c.classList.toggle("is-open", anyClosed));
      toggleAll.textContent = anyClosed ? "Collapse all" : "Expand all";
      return;
    }
  });

  load();
})();
