// Standalone public view of a single content item — clients reach
// this via /c/<slug>. Renders the same shape as the trip-public popup
// but as a full page, so a manager can preview a content item before
// embedding it in a trip program.

(function () {
  const root = document.getElementById("content-view-root");
  const match = window.location.pathname.match(/^\/c\/([^/?#]+)/);
  const slug = match ? decodeURIComponent(match[1]) : "";

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }
  function nl2br(value) {
    return escapeHtml(value).replace(/\n/g, "<br>");
  }
  function youtubeEmbedUrl(url) {
    if (!url) return "";
    const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{6,})/);
    return m ? `https://www.youtube.com/embed/${m[1]}` : "";
  }

  // Accepts a place name, lat/lng pair, full Google Maps share URL, or
  // an <iframe …> snippet pasted from Google's "Embed a map" panel.
  function mapEmbedUrl(value) {
    if (!value) return "";
    const v = String(value).trim();
    const iframeMatch = v.match(/<iframe[^>]+src=["']([^"']+)["']/i);
    if (iframeMatch) return iframeMatch[1];
    if (/^https:\/\/(www\.)?google\.com\/maps\/embed/.test(v)) return v;
    return `https://maps.google.com/maps?q=${encodeURIComponent(v)}&output=embed`;
  }

  function applySeoTags(content) {
    const title = content.title || content.slug || "TravelX";
    document.title = `${title} · TravelX`;
    const lang = content.lang || "en";
    document.documentElement.setAttribute("lang", lang);
    const head = document.head;
    // Wipe any tags we own so re-renders don't double-up.
    head.querySelectorAll('link[rel="alternate"][hreflang]').forEach((n) => n.remove());
    head.querySelectorAll('meta[data-seo="content-view"]').forEach((n) => n.remove());
    head.querySelectorAll('link[rel="canonical"][data-seo="content-view"]').forEach((n) => n.remove());
    head.querySelectorAll('script[type="application/ld+json"][data-seo="content-view"]').forEach((n) => n.remove());

    const origin = window.location.origin;
    const canonicalHref = origin + (window.location.pathname + (lang === "en" ? "" : `?lang=${lang}`));

    // hreflang siblings — Google uses these to serve the right language
    // version to each user. x-default → English fallback.
    (content.hreflangs || []).forEach((h) => {
      const link = document.createElement("link");
      link.rel = "alternate";
      link.setAttribute("hreflang", h.lang);
      link.href = origin + h.href;
      head.appendChild(link);
    });
    const xDefault = (content.hreflangs || []).find((h) => h.lang === "en");
    if (xDefault) {
      const link = document.createElement("link");
      link.rel = "alternate";
      link.setAttribute("hreflang", "x-default");
      link.href = origin + xDefault.href;
      head.appendChild(link);
    }

    // Canonical URL for this language version.
    const canonical = document.createElement("link");
    canonical.rel = "canonical";
    canonical.dataset.seo = "content-view";
    canonical.href = canonicalHref;
    head.appendChild(canonical);

    // Meta description — strip HTML, cap at 160 chars (safe for SERP).
    const desc = String(content.summary || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 160);
    function metaTag(name, value, attr) {
      if (!value) return;
      const m = document.createElement("meta");
      m.dataset.seo = "content-view";
      if (attr === "property") m.setAttribute("property", name);
      else m.name = name;
      m.content = value;
      head.appendChild(m);
    }
    if (desc) metaTag("description", desc);

    // OpenGraph + Twitter card so Facebook / WhatsApp / Twitter
    // previews show the right title, description, and lead image.
    const firstImage = (content.images || [])[0]?.url || "";
    const absImage = firstImage ? (firstImage.startsWith("http") ? firstImage : origin + firstImage) : "";
    metaTag("og:title", title, "property");
    metaTag("og:description", desc, "property");
    metaTag("og:type", "article", "property");
    metaTag("og:url", canonicalHref, "property");
    metaTag("og:locale", lang === "en" ? "en_US" : (lang === "mn" ? "mn_MN" : `${lang}_${lang.toUpperCase()}`), "property");
    metaTag("og:site_name", "TravelX", "property");
    if (absImage) metaTag("og:image", absImage, "property");
    metaTag("twitter:card", absImage ? "summary_large_image" : "summary");
    metaTag("twitter:title", title);
    metaTag("twitter:description", desc);
    if (absImage) metaTag("twitter:image", absImage);

    // Schema.org JSON-LD — TouristAttraction is the most common content
    // type here; falls back to generic Place for others. Helps Google
    // build rich-result cards (knowledge panels, image carousels).
    const schemaType = (content.type || "").toLowerCase() === "accommodation" ? "LodgingBusiness"
      : ((content.type || "").toLowerCase() === "activity" ? "TouristTrip" : "TouristAttraction");
    const ld = {
      "@context": "https://schema.org",
      "@type": schemaType,
      "name": title,
      "description": desc || undefined,
      "url": canonicalHref,
      "image": absImage || undefined,
      "address": content.country ? { "@type": "PostalAddress", "addressCountry": content.country } : undefined,
    };
    const ldScript = document.createElement("script");
    ldScript.type = "application/ld+json";
    ldScript.dataset.seo = "content-view";
    ldScript.textContent = JSON.stringify(ld, (_, v) => v === undefined ? undefined : v);
    head.appendChild(ldScript);
  }

  function langSwitcherHtml(content) {
    const list = content.hreflangs || [];
    if (list.length <= 1) return "";
    const labels = {
      en: "EN", mn: "MN", fr: "FR", it: "IT", es: "ES",
      ko: "KO", zh: "ZH", ja: "JA", ru: "RU",
    };
    const active = content.lang || "en";
    return `
      <div class="content-lang-switcher" role="navigation" aria-label="Language">
        ${list.map((h) => {
          const cls = h.lang === active ? "is-active" : "";
          return `<a class="${cls}" hreflang="${h.lang}" href="${escapeHtml(h.href)}">${labels[h.lang] || h.lang.toUpperCase()}</a>`;
        }).join("")}
      </div>
    `;
  }

  function render(content) {
    applySeoTags(content);
    const images = (content.images || []).map((img) => img.url).filter(Boolean);
    // Lightbox always opens the full-resolution version; grid tiles use
    // smaller variants (medium for the 2x2 hero, thumb for the side tiles)
    // so the page paints fast.
    const urlsAttr = escapeHtml(JSON.stringify(images));
    const sizedThumb = (url, size) => url + (url.includes("?") ? "&" : "?") + "size=" + size;
    // Mosaic that's literally the trip-public ContentModal layout:
    // 4 fixed tile slots (featured + 2 small right + bottom-right
    // span) at 2fr / 1fr / 1fr × 200px × 200px. The 4th slot
    // carries the "+N more" overlay when there are more photos
    // than the 4 visible tiles.
    const moreCount = Math.max(0, images.length - 4);
    function tileImage(idx) {
      return images[idx] || images[1] || images[0] || "";
    }
    const galleryHtml = images.length
      ? `
        <div class="content-gallery${images.length === 1 ? " is-single" : ""}">
          <button type="button" class="content-gallery-tile is-featured" data-lightbox-urls="${urlsAttr}" data-lightbox-index="0">
            <img src="${escapeHtml(sizedThumb(images[0], "medium"))}" alt="" loading="lazy" />
          </button>
          ${images.length > 1 ? `
            <button type="button" class="content-gallery-tile" data-lightbox-urls="${urlsAttr}" data-lightbox-index="1">
              <img src="${escapeHtml(sizedThumb(tileImage(1), "thumb"))}" alt="" loading="lazy" />
            </button>
            <button type="button" class="content-gallery-tile" data-lightbox-urls="${urlsAttr}" data-lightbox-index="2">
              <img src="${escapeHtml(sizedThumb(tileImage(2), "thumb"))}" alt="" loading="lazy" />
            </button>
            <button type="button" class="content-gallery-tile is-bottom" data-lightbox-urls="${urlsAttr}" data-lightbox-index="${moreCount > 0 ? 3 : 1}">
              <img src="${escapeHtml(sizedThumb(tileImage(3), "thumb"))}" alt="" loading="lazy" />
              ${moreCount > 0 ? `<span class="content-gallery-more"><span class="content-gallery-more-icon">🖼</span> +${moreCount} more</span>` : ""}
            </button>
          ` : ""}
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
    // Prefer a manager-uploaded MP4/WebM video over the YouTube URL
    // when both are set, so the user sees their own footage first.
    let video = "";
    if (content.videoFile) {
      video = `<div class="trip-popup-video"><video src="${escapeHtml(content.videoFile)}" controls preload="metadata" playsinline></video></div>`;
    } else {
      const embed = youtubeEmbedUrl(content.videoUrl);
      video = embed
        ? `<div class="trip-popup-video"><iframe src="${escapeHtml(embed)}" loading="lazy" allowfullscreen></iframe></div>`
        : (content.videoUrl
          ? `<div class="trip-popup-video-link"><a href="${escapeHtml(content.videoUrl)}" target="_blank" rel="noopener">▶ Watch video</a></div>`
          : "");
    }
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

    // Summary is now authored as rich-text HTML in the content
     // editor. Detect HTML by looking for tag markers; legacy plain-
     // text summaries still pass through nl2br for line breaks.
    const summaryIsHtml = /<\/?(p|h[1-6]|ul|ol|li|br|strong|em|a)\b/i.test(content.summary || "");
    const summaryHtml = content.summary
      ? (summaryIsHtml
          ? `<div class="trip-popup-summary content-rich">${content.summary}</div>`
          : `<p class="trip-popup-summary">${nl2br(content.summary)}</p>`)
      : "";
    root.innerHTML = `
      ${langSwitcherHtml(content)}
      <div class="trip-popup-dialog content-view-dialog">
        ${galleryHtml}
        <div class="trip-popup-body">
          <p class="trip-public-kicker">${escapeHtml(content.type || "")}${content.country ? ` · ${escapeHtml(content.country)}` : ""}</p>
          <h2>${escapeHtml(content.title || content.slug || "")}</h2>
          ${summaryHtml}
          ${groups}
          ${video}
          ${map}
        </div>
      </div>
      <footer class="trip-public-footer">
        <p>TravelX · backoffice.travelx.mn</p>
      </footer>
    `;

    // Map fullscreen — call requestFullscreen on the iframe wrapper.
    root.addEventListener("click", (event) => {
      if (event.target.closest('[data-action="map-fullscreen"]')) {
        const frame = root.querySelector("[data-map-frame] iframe");
        if (!frame) return;
        const target = frame;
        if (target.requestFullscreen) target.requestFullscreen();
        else if (target.webkitRequestFullscreen) target.webkitRequestFullscreen();
      }
    });
  }

  async function load() {
    if (!slug) {
      root.innerHTML = `<p class="trip-public-empty">Content not found.</p>`;
      return;
    }
    const inline = document.getElementById("__initial_data");
    if (inline && inline.textContent.trim()) {
      try {
        const content = JSON.parse(inline.textContent);
        if (content) {
          render(content);
          return;
        }
      } catch {
        /* fall through to fetch */
      }
    }
    try {
      const res = await fetch(`/api/public/content/${encodeURIComponent(slug)}`);
      if (res.status === 404) {
        root.innerHTML = `
          <p class="trip-public-empty">
            This content isn't published yet.<br>
            <small>Open it in the Content editor and switch publish status to "Published".</small>
          </p>
        `;
        return;
      }
      if (!res.ok) throw new Error("Failed to load");
      const content = await res.json();
      render(content);
    } catch (err) {
      root.innerHTML = `<p class="trip-public-empty">${escapeHtml(err.message || "Could not load.")}</p>`;
    }
  }

  load();
})();
