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

  function render(content) {
    document.title = content.title ? `${content.title} · TravelX` : "TravelX";
    const images = (content.images || []).map((img) => img.url).filter(Boolean);
    // Lightbox always opens the full-resolution version; grid tiles use
    // smaller variants (medium for the 2x2 hero, thumb for the side tiles)
    // so the page paints fast.
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

    root.innerHTML = `
      <div class="trip-popup-dialog content-view-dialog">
        ${galleryHtml}
        <div class="trip-popup-body">
          <p class="trip-public-kicker">${escapeHtml(content.type || "")}${content.country ? ` · ${escapeHtml(content.country)}` : ""}</p>
          <h2>${escapeHtml(content.title || content.slug || "")}</h2>
          ${content.summary ? `<p class="trip-popup-summary">${nl2br(content.summary)}</p>` : ""}
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
