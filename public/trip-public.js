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
    const coverIds = Array.isArray(doc.coverIds) ? doc.coverIds : [];
    const heroImage = coverIds[0]
      ? `<div class="trip-public-hero-photo" style="background-image:url('/api/gallery/${encodeURIComponent(coverIds[0])}/file');"></div>`
      : "";
    const coverGalleryThumbs = coverIds.length > 1
      ? `
        <div class="trip-public-cover-strip">
          ${coverIds.slice(1).map((id) => `
            <a class="trip-public-cover-thumb" href="/api/gallery/${encodeURIComponent(id)}/file" target="_blank" rel="noopener">
              <img src="/api/gallery/${encodeURIComponent(id)}/file" alt="" loading="lazy" />
            </a>
          `).join("")}
        </div>
      `
      : "";
    const program = (doc.program || [])
      .map((row) => {
        const ids = Array.isArray(row.imageIds) ? row.imageIds : [];
        const dayImages = ids.length
          ? `
            <div class="trip-public-day-photos">
              ${ids.map((id) => `
                <a class="trip-public-day-thumb" href="/api/gallery/${encodeURIComponent(id)}/file" target="_blank" rel="noopener">
                  <img src="/api/gallery/${encodeURIComponent(id)}/file" alt="" loading="lazy" />
                </a>
              `).join("")}
            </div>
          `
          : "";
        return `
          <article class="trip-public-day">
            <div class="trip-public-day-head">
              <span class="trip-public-day-pill">${escapeHtml(row.day || "")}</span>
              <h3>${escapeHtml(row.title || "")}</h3>
            </div>
            ${row.body ? `<p>${linkifyContent(nl2br(row.body))}</p>` : ""}
            ${dayImages}
          </article>
        `;
      })
      .join("");

    document.title = doc.title ? `${doc.title} · TravelX` : "TravelX Trip";

    root.innerHTML = `
      <header class="trip-public-hero${heroImage ? " has-photo" : ""}">
        ${heroImage}
        <div class="trip-public-hero-body">
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
        </div>
        ${coverGalleryThumbs}
      </header>

      ${doc.intro
        ? `<section class="trip-public-section trip-public-intro"><p>${linkifyContent(nl2br(doc.intro))}</p></section>`
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
    const heroImg = images[0]
      ? `<img class="trip-popup-hero-img" src="${escapeHtml(images[0])}" alt="${escapeHtml(content.title || "")}" />`
      : "";
    const galleryThumbs = images.length > 1
      ? images.map((url) => `<a class="trip-popup-thumb" href="${escapeHtml(url)}" target="_blank" rel="noopener"><img src="${escapeHtml(url)}" alt="" loading="lazy" /></a>`).join("")
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
    const map = mapSrc
      ? `
        <div class="trip-popup-map-section">
          <h3>📍 Байршил</h3>
          <div class="trip-popup-map">
            <iframe src="${escapeHtml(mapSrc)}" loading="lazy" allowfullscreen referrerpolicy="no-referrer-when-downgrade"></iframe>
          </div>
        </div>
      `
      : "";
    overlay.innerHTML = `
      <div class="trip-popup-dialog" role="dialog" aria-modal="true">
        <button type="button" class="trip-popup-close" data-action="close-popup" aria-label="Close">×</button>
        ${heroImg ? `<div class="trip-popup-hero">${heroImg}</div>` : ""}
        <div class="trip-popup-body">
          <h2>${escapeHtml(content.title || content.slug || "")}</h2>
          ${content.summary ? `<p class="trip-popup-summary">${nl2br(content.summary)}</p>` : ""}
          ${galleryThumbs ? `<div class="trip-popup-gallery">${galleryThumbs}</div>` : ""}
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
    if (!link) return;
    event.preventDefault();
    const slug = link.dataset.slug;
    if (slug) openSlug(slug);
  });

  load();
})();
