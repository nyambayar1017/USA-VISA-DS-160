// Reusable content picker. Returns { slug, title, type } | null.
//
//   const item = await window.ContentPicker.open();
//   // → { slug: "kl_tower_kuala_lumpur", title: "...", type: "attraction" }

(function () {
  const STATE = { overlay: null, resolve: null, q: "", type: "", country: "", entries: [] };

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function buildOverlay(title) {
    const overlay = document.createElement("div");
    overlay.className = "img-picker-overlay";
    overlay.innerHTML = `
      <div class="img-picker-dialog">
        <div class="img-picker-head">
          <h2>${escapeHtml(title || "Choose content")}</h2>
          <button type="button" class="img-picker-close" data-action="cancel" aria-label="Close">×</button>
        </div>
        <div class="img-picker-toolbar">
          <select data-action="type">
            <option value="">All types</option>
            <option value="attraction">Attraction</option>
            <option value="accommodation">Accommodation</option>
            <option value="activity">Activity</option>
            <option value="destination">Destination</option>
            <option value="supplier">Supplier</option>
            <option value="location">Location</option>
          </select>
          <input type="search" placeholder="Country" data-action="country" />
          <input type="search" placeholder="Search slug, title" data-action="search" />
        </div>
        <div class="img-picker-grid ct-picker-list" data-picker-grid>
          <p class="empty">Loading…</p>
        </div>
        <div class="img-picker-foot">
          <a class="button-secondary" href="/content" target="_blank" rel="noopener">Open Content library ↗</a>
          <button type="button" class="button-secondary" data-action="cancel">Cancel</button>
        </div>
      </div>
    `;
    return overlay;
  }

  function refreshList() {
    const grid = STATE.overlay.querySelector("[data-picker-grid]");
    const filtered = STATE.entries.filter((e) => {
      if (STATE.type && (e.type || "") !== STATE.type) return false;
      if (STATE.country && (e.country || "").toLowerCase() !== STATE.country.toLowerCase()) return false;
      if (STATE.q) {
        const hay = `${e.slug} ${e.title} ${e.summary} ${e.country}`.toLowerCase();
        if (!hay.includes(STATE.q)) return false;
      }
      return true;
    });
    if (!filtered.length) {
      grid.innerHTML = `<p class="empty">No content matches. Add one in <a href="/content" target="_blank" rel="noopener">Content</a>.</p>`;
      return;
    }
    grid.innerHTML = filtered
      .map((e) => `
        <button type="button" class="ct-picker-card" data-slug="${escapeHtml(e.slug)}" data-id="${escapeHtml(e.id || "")}">
          <span class="ct-picker-card-title">${escapeHtml(e.title)}</span>
          <span class="ct-picker-card-meta">
            <code>[[${escapeHtml(e.slug)}]]</code>
            · ${escapeHtml(e.type || "")}${e.country ? ` · ${escapeHtml(e.country)}` : ""}
          </span>
          ${e.publishStatus === "draft" ? `<span class="ct-pill ct-pill-draft">Draft</span>` : ""}
        </button>
      `)
      .join("");
  }

  async function load() {
    try {
      const res = await fetch("/api/content");
      const data = await res.json();
      STATE.entries = data.entries || [];
      refreshList();
    } catch (err) {
      const grid = STATE.overlay.querySelector("[data-picker-grid]");
      grid.innerHTML = `<p class="empty">${escapeHtml(err.message || "Could not load.")}</p>`;
    }
  }

  function close(result) {
    if (!STATE.overlay) return;
    document.body.removeChild(STATE.overlay);
    STATE.overlay = null;
    document.body.classList.remove("img-picker-open");
    const r = STATE.resolve;
    STATE.resolve = null;
    if (r) r(result);
  }

  function open(opts = {}) {
    if (STATE.overlay) return Promise.resolve(null);
    STATE.q = "";
    STATE.type = "";
    STATE.country = "";
    STATE.overlay = buildOverlay(opts.title);
    document.body.appendChild(STATE.overlay);
    document.body.classList.add("img-picker-open");
    STATE.overlay.addEventListener("click", (event) => {
      const action = event.target.closest("[data-action]")?.dataset.action;
      if (action === "cancel") return close(null);
      const card = event.target.closest(".ct-picker-card");
      if (card) {
        const item = STATE.entries.find((e) => e.slug === card.dataset.slug);
        return close(item || { slug: card.dataset.slug });
      }
    });
    STATE.overlay.addEventListener("input", (event) => {
      if (event.target.dataset.action === "search") {
        STATE.q = (event.target.value || "").trim().toLowerCase();
        refreshList();
      }
      if (event.target.dataset.action === "country") {
        STATE.country = (event.target.value || "").trim();
        refreshList();
      }
    });
    STATE.overlay.addEventListener("change", (event) => {
      if (event.target.dataset.action === "type") {
        STATE.type = event.target.value;
        refreshList();
      }
    });
    return new Promise((resolve) => {
      STATE.resolve = resolve;
      load();
    });
  }

  window.ContentPicker = { open };
})();
