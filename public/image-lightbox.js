// Tiny image lightbox.
//   window.Lightbox.open(["url1", "url2", ...], startIndex);
// Esc closes, ←/→ navigate, click backdrop closes, prev/next buttons.

(function () {
  let overlay = null;
  let urls = [];
  let idx = 0;

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function show() {
    if (!overlay) return;
    const img = overlay.querySelector(".lightbox-img");
    img.src = urls[idx];
    const counter = overlay.querySelector(".lightbox-counter");
    counter.textContent = urls.length > 1 ? `${idx + 1} / ${urls.length}` : "";
    overlay.querySelector(".lightbox-prev").style.visibility = urls.length > 1 ? "visible" : "hidden";
    overlay.querySelector(".lightbox-next").style.visibility = urls.length > 1 ? "visible" : "hidden";
  }

  function close() {
    if (!overlay) return;
    overlay.remove();
    overlay = null;
    document.body.classList.remove("lightbox-open");
    document.removeEventListener("keydown", onKey);
  }

  function navigate(delta) {
    if (!urls.length) return;
    idx = (idx + delta + urls.length) % urls.length;
    show();
  }

  function onKey(event) {
    if (!overlay) return;
    if (event.key === "Escape") close();
    else if (event.key === "ArrowLeft") navigate(-1);
    else if (event.key === "ArrowRight") navigate(1);
  }

  function open(allUrls, startIdx) {
    if (!Array.isArray(allUrls) || !allUrls.length) return;
    if (overlay) close();
    urls = allUrls.slice();
    idx = Math.max(0, Math.min(Number(startIdx) || 0, urls.length - 1));
    overlay = document.createElement("div");
    overlay.className = "lightbox-overlay";
    overlay.innerHTML = `
      <button type="button" class="lightbox-close" aria-label="Close">×</button>
      <button type="button" class="lightbox-prev" aria-label="Previous">‹</button>
      <img class="lightbox-img" src="" alt="" />
      <button type="button" class="lightbox-next" aria-label="Next">›</button>
      <span class="lightbox-counter"></span>
    `;
    document.body.appendChild(overlay);
    document.body.classList.add("lightbox-open");
    show();
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay || event.target.closest(".lightbox-close")) {
        close();
        return;
      }
      if (event.target.closest(".lightbox-prev")) navigate(-1);
      if (event.target.closest(".lightbox-next")) navigate(1);
    });
    document.addEventListener("keydown", onKey);
  }

  window.Lightbox = { open };
  // Auto-bind: any element with [data-lightbox] uses the data-urls attr or
  // a JSON list to open the lightbox at data-lightbox-index.
  document.addEventListener("click", (event) => {
    const el = event.target.closest("[data-lightbox-urls]");
    if (!el) return;
    event.preventDefault();
    let parsed = [];
    try {
      parsed = JSON.parse(el.getAttribute("data-lightbox-urls") || "[]");
    } catch {
      parsed = [];
    }
    const startIdx = Number(el.getAttribute("data-lightbox-index") || 0);
    open(parsed, startIdx);
  });
})();
