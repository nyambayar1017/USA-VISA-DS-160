// Two-step picker for "+ Add tourist" on the GIT group page and the FIT
// trip-detail page. First a small chooser asks "new" or "existing"; if
// "existing", we open a search modal over /api/tourists and let the
// manager pick a previously-saved person to copy onto this trip.
(function () {
  if (window.ParticipantChooser) return;

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function buildBackdrop() {
    const b = document.createElement("div");
    b.className = "ui-modal-back";
    return b;
  }

  function close(back) {
    back.classList.remove("is-shown");
    back.classList.add("is-leaving");
    setTimeout(() => { if (back.parentNode) back.parentNode.removeChild(back); }, 180);
  }

  function showChooser({ onNew, onExisting }) {
    const back = buildBackdrop();
    const card = document.createElement("div");
    card.className = "ui-modal-card participant-chooser-card";
    card.innerHTML = `
      <div class="ui-modal-head">Add participant</div>
      <div class="ui-modal-body">
        <p class="ui-modal-msg">Are they a brand-new traveller, or already in your tourist list?</p>
        <div class="participant-chooser-options">
          <button type="button" class="participant-chooser-option" data-pick="new">
            <strong>+ New tourist</strong>
            <span>Type or scan a passport.</span>
          </button>
          <button type="button" class="participant-chooser-option" data-pick="existing">
            <strong>🔎 Existing tourist</strong>
            <span>Pick from previous trips.</span>
          </button>
        </div>
      </div>
      <div class="ui-modal-foot">
        <button type="button" class="ui-modal-btn ui-modal-btn--ghost" data-pick="cancel">Cancel</button>
      </div>
    `;
    back.appendChild(card);
    document.body.appendChild(back);
    requestAnimationFrame(() => back.classList.add("is-shown"));
    card.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-pick]");
      if (!btn) return;
      const pick = btn.dataset.pick;
      close(back);
      if (pick === "new") setTimeout(() => onNew?.(), 200);
      else if (pick === "existing") setTimeout(() => showSearch({ onExisting }), 200);
    });
    back.addEventListener("click", (e) => { if (e.target === back) close(back); });
  }

  let searchCache = null;

  async function loadAllTourists() {
    if (searchCache) return searchCache;
    const r = await fetch("/api/tourists");
    if (!r.ok) throw new Error("Could not load tourists");
    const data = await r.json();
    searchCache = data.entries || [];
    return searchCache;
  }

  function showSearch({ onExisting }) {
    const back = buildBackdrop();
    const card = document.createElement("div");
    card.className = "ui-modal-card participant-search-card";
    card.innerHTML = `
      <div class="ui-modal-head">
        Pick an existing tourist
        <button type="button" class="participant-search-close" aria-label="Close" data-close>×</button>
      </div>
      <div class="ui-modal-body">
        <input type="search" class="participant-search-input" placeholder="Search by last name, first name, passport, nationality…" autocomplete="off" />
        <div class="participant-search-list" data-results>
          <p class="empty">Loading tourists…</p>
        </div>
      </div>
    `;
    back.appendChild(card);
    document.body.appendChild(back);
    requestAnimationFrame(() => back.classList.add("is-shown"));

    const input = card.querySelector(".participant-search-input");
    const list = card.querySelector("[data-results]");
    let allTourists = [];

    function render() {
      const q = (input.value || "").trim().toLowerCase();
      let rows = allTourists;
      if (q) {
        rows = allTourists.filter((t) => {
          const blob = [
            t.lastName, t.firstName, t.passportNumber, t.nationality,
            t.registrationNumber, t.tripSerial, t.groupName,
            ...(Array.isArray(t.tags) ? t.tags : []),
          ].map((v) => String(v || "").toLowerCase()).join(" ");
          return blob.includes(q);
        });
      }
      // Dedup by passportNumber so the same person doesn't appear once per trip.
      const seen = new Set();
      const deduped = [];
      for (const t of rows) {
        const k = (t.passportNumber || t.id || "").toUpperCase();
        if (k && seen.has(k)) continue;
        seen.add(k);
        deduped.push(t);
      }
      if (!deduped.length) {
        list.innerHTML = '<p class="empty">No tourists found.</p>';
        return;
      }
      list.innerHTML = deduped.slice(0, 40).map((t) => `
        <button type="button" class="participant-search-row" data-id="${escapeHtml(t.id)}">
          <span class="participant-search-name">
            <strong>${escapeHtml(t.lastName || "")} ${escapeHtml(t.firstName || "")}</strong>
            <span class="participant-search-meta">${escapeHtml(t.nationality || "—")} · ${escapeHtml(t.passportNumber || "—")}</span>
          </span>
          <span class="participant-search-side">
            ${escapeHtml(t.tripSerial || "")}${t.groupName ? " · " + escapeHtml(t.groupName) : ""}
          </span>
        </button>
      `).join("");
    }

    input.addEventListener("input", render);
    list.addEventListener("click", (e) => {
      const row = e.target.closest(".participant-search-row");
      if (!row) return;
      const id = row.dataset.id;
      const picked = allTourists.find((t) => t.id === id);
      if (!picked) return;
      close(back);
      setTimeout(() => onExisting?.(picked), 200);
    });
    card.querySelector("[data-close]")?.addEventListener("click", () => close(back));
    back.addEventListener("click", (e) => { if (e.target === back) close(back); });

    loadAllTourists().then((rows) => {
      allTourists = rows;
      render();
      input.focus();
    }).catch((err) => {
      list.innerHTML = '<p class="empty">' + escapeHtml(err.message || "Load failed") + "</p>";
    });
  }

  // Reset the cache so the next open re-fetches (after a new tourist is saved).
  function invalidateCache() { searchCache = null; }

  window.ParticipantChooser = {
    open: showChooser,
    invalidateCache,
  };
})();
