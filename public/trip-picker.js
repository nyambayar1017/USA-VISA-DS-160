// Searchable picker that upgrades a native <select> of trips into a
// click-to-open modal with a search input — same UX as the existing-tourist
// chooser (participant-chooser.js). Keeps the underlying <select> in the DOM
// so all existing form code keeps reading .value and listening for "change".
(function () {
  if (window.TripPicker) return;

  const upgraded = new WeakSet();

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

  function collectOptions(selectEl) {
    const out = [];
    Array.from(selectEl.options).forEach((opt) => {
      if (!opt.value) return;
      out.push({
        value: opt.value,
        label: opt.textContent || opt.value,
      });
    });
    return out;
  }

  function getDisplayLabel(selectEl, placeholder) {
    if (!selectEl.value) return placeholder;
    const opt = Array.from(selectEl.options).find((o) => o.value === selectEl.value);
    return opt ? (opt.textContent || opt.value) : placeholder;
  }

  function showSearch(selectEl, trigger, placeholder) {
    const back = buildBackdrop();
    const card = document.createElement("div");
    card.className = "ui-modal-card participant-search-card trip-picker-card";
    card.innerHTML = `
      <div class="ui-modal-head">
        Pick a trip
        <button type="button" class="participant-search-close" aria-label="Close" data-close>×</button>
      </div>
      <div class="ui-modal-body">
        <input type="search" class="participant-search-input" placeholder="Search by trip name or serial…" autocomplete="off" />
        <div class="participant-search-list" data-results>
          <p class="empty">No trips available.</p>
        </div>
      </div>
    `;
    back.appendChild(card);
    document.body.appendChild(back);
    requestAnimationFrame(() => back.classList.add("is-shown"));

    const input = card.querySelector(".participant-search-input");
    const list = card.querySelector("[data-results]");
    const trips = collectOptions(selectEl);

    function render() {
      const q = (input.value || "").trim().toLowerCase();
      const rows = q
        ? trips.filter((t) => t.label.toLowerCase().includes(q) || t.value.toLowerCase().includes(q))
        : trips;
      if (!rows.length) {
        list.innerHTML = '<p class="empty">No trips found.</p>';
        return;
      }
      list.innerHTML = rows.slice(0, 80).map((t) => `
        <button type="button" class="participant-search-row trip-picker-row${selectEl.value === t.value ? " is-current" : ""}" data-value="${escapeHtml(t.value)}">
          <span class="participant-search-name">
            <strong>${escapeHtml(t.label)}</strong>
          </span>
        </button>
      `).join("");
    }

    input.addEventListener("input", render);
    list.addEventListener("click", (e) => {
      const row = e.target.closest(".participant-search-row");
      if (!row) return;
      const value = row.dataset.value;
      selectEl.value = value;
      selectEl.dispatchEvent(new Event("change", { bubbles: true }));
      trigger.querySelector("[data-trip-picker-label]").textContent = getDisplayLabel(selectEl, placeholder);
      trigger.classList.toggle("is-empty", !selectEl.value);
      close(back);
    });
    card.querySelector("[data-close]")?.addEventListener("click", () => close(back));
    back.addEventListener("click", (e) => { if (e.target === back) close(back); });

    render();
    setTimeout(() => input.focus(), 50);
  }

  function upgrade(selectEl, options = {}) {
    if (!selectEl || upgraded.has(selectEl)) return;
    upgraded.add(selectEl);

    const placeholder = options.placeholder || "Choose trip…";

    selectEl.classList.add("trip-picker-hidden-select");
    // Keep it focusable for form validation messages but visually hidden.
    selectEl.setAttribute("tabindex", "-1");
    selectEl.setAttribute("aria-hidden", "true");
    // Drop HTML5 `required` so the browser doesn't try to focus an invisible
    // field. Existing form submit handlers already check the value manually
    // and surface a friendly status message.
    selectEl.removeAttribute("required");

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "trip-picker-trigger";
    trigger.innerHTML = `
      <span data-trip-picker-label>${escapeHtml(getDisplayLabel(selectEl, placeholder))}</span>
      <span class="trip-picker-caret" aria-hidden="true">▾</span>
    `;
    if (!selectEl.value) trigger.classList.add("is-empty");

    selectEl.parentNode.insertBefore(trigger, selectEl.nextSibling);

    trigger.addEventListener("click", (e) => {
      e.preventDefault();
      showSearch(selectEl, trigger, placeholder);
    });

    // If outside code rewrites the <select>'s options or value, refresh the
    // visible label so it stays in sync. MutationObserver catches innerHTML
    // rewrites; the periodic poll catches `.value = "..."` assignments that
    // don't fire any event.
    const observer = new MutationObserver(() => {
      refreshLabel(selectEl, trigger, placeholder);
      setTimeout(() => refreshLabel(selectEl, trigger, placeholder), 0);
    });
    observer.observe(selectEl, { childList: true, attributes: true, attributeFilter: ["value"] });
    selectEl.addEventListener("change", () => refreshLabel(selectEl, trigger, placeholder));
    let lastSeenValue = selectEl.value;
    setInterval(() => {
      if (selectEl.value !== lastSeenValue) {
        lastSeenValue = selectEl.value;
        refreshLabel(selectEl, trigger, placeholder);
      }
    }, 500);
  }

  function refreshLabel(selectEl, trigger, placeholder) {
    const label = trigger.querySelector("[data-trip-picker-label]");
    if (!label) return;
    label.textContent = getDisplayLabel(selectEl, placeholder);
    trigger.classList.toggle("is-empty", !selectEl.value);
  }

  window.TripPicker = { upgrade };
})();
