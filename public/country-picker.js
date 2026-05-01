// Single-select searchable country popup. Mirrors destinations-multi
// in look but with one chosen value at a time. Mount with:
//   <input type="hidden" name="country" data-country-picker value="" />
// then call window.CountryPicker.attachAll(rootEl).
//
// Options are built from the page's known list (caller can pass via
// data-options="['UAE','Singapore',...]") plus a built-in fallback so
// brand-new installs still get suggestions.

(function () {
  const FALLBACK_COUNTRIES = [
    "Mongolia", "China", "Japan", "South Korea", "Taiwan", "Hong Kong",
    "Singapore", "Malaysia", "Thailand", "Indonesia", "Vietnam",
    "Philippines", "Cambodia", "Laos", "Myanmar", "India", "Sri Lanka",
    "Nepal", "Bhutan", "Bangladesh", "Pakistan", "Maldives",
    "UAE", "Saudi Arabia", "Qatar", "Oman", "Bahrain", "Kuwait",
    "Israel", "Jordan", "Turkey", "Egypt", "Morocco",
    "Russia", "Kazakhstan", "Uzbekistan", "Kyrgyzstan", "Georgia", "Armenia",
    "France", "Italy", "Spain", "Portugal", "Germany", "Netherlands",
    "Belgium", "Switzerland", "Austria", "Czech Republic", "Hungary",
    "Greece", "Croatia", "Norway", "Sweden", "Finland", "Denmark", "Iceland",
    "United Kingdom", "Ireland", "Poland", "Romania", "Bulgaria", "Serbia",
    "USA", "Canada", "Mexico", "Cuba",
    "Brazil", "Argentina", "Chile", "Peru", "Colombia",
    "Australia", "New Zealand", "Fiji",
    "South Africa", "Kenya", "Tanzania", "Madagascar",
  ];

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function attachOne(hiddenInput) {
    if (!hiddenInput || hiddenInput.dataset.countryAttached === "1") return;
    hiddenInput.dataset.countryAttached = "1";
    hiddenInput.type = "hidden";

    const extra = hiddenInput.dataset.options
      ? (() => { try { return JSON.parse(hiddenInput.dataset.options); } catch { return []; } })()
      : [];
    const allOptions = Array.from(new Set([...FALLBACK_COUNTRIES, ...extra]))
      .sort((a, b) => a.localeCompare(b));

    const wrap = document.createElement("div");
    wrap.className = "country-picker";
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "country-picker-trigger";
    const popover = document.createElement("div");
    popover.className = "country-picker-popover";
    popover.innerHTML = `
      <input type="search" class="country-picker-search" placeholder="Search countries…" autocomplete="off" />
      <div class="country-picker-list"></div>
    `;
    wrap.appendChild(trigger);
    wrap.appendChild(popover);
    hiddenInput.parentNode.insertBefore(wrap, hiddenInput);

    const searchInput = popover.querySelector(".country-picker-search");
    const listNode = popover.querySelector(".country-picker-list");

    let current = (hiddenInput.value || "").trim();

    function paintTrigger() {
      trigger.innerHTML = current
        ? `<span class="country-picker-chip">${escapeHtml(current)}</span><span class="country-picker-caret" aria-hidden="true">▾</span>`
        : `<span class="country-picker-placeholder">Search country…</span><span class="country-picker-caret" aria-hidden="true">▾</span>`;
    }

    function renderList(filter) {
      const q = (filter || "").trim().toLowerCase();
      let opts = q ? allOptions.filter((c) => c.toLowerCase().includes(q)) : allOptions;
      // If the typed query matches nothing, offer it as a custom value.
      const customAvailable = q && !allOptions.some((c) => c.toLowerCase() === q);
      const items = opts.map((name) => {
        const sel = name === current ? " is-selected" : "";
        return `<button type="button" class="country-picker-item${sel}" data-value="${escapeHtml(name)}">${escapeHtml(name)}</button>`;
      });
      if (customAvailable) {
        items.unshift(`<button type="button" class="country-picker-item is-custom" data-value="${escapeHtml(filter.trim())}">+ Use "${escapeHtml(filter.trim())}"</button>`);
      }
      listNode.innerHTML = items.join("") || `<p class="country-picker-empty">No matches.</p>`;
    }

    function setValue(value) {
      current = String(value || "").trim();
      hiddenInput.value = current;
      hiddenInput.dispatchEvent(new Event("change", { bubbles: true }));
      paintTrigger();
    }

    trigger.addEventListener("click", (e) => {
      e.preventDefault();
      const isOpen = wrap.classList.toggle("is-open");
      if (isOpen) {
        searchInput.value = "";
        renderList("");
        setTimeout(() => searchInput.focus(), 30);
      }
    });
    document.addEventListener("click", (e) => {
      if (!wrap.contains(e.target)) wrap.classList.remove("is-open");
    });
    searchInput.addEventListener("input", () => renderList(searchInput.value));
    listNode.addEventListener("click", (e) => {
      const btn = e.target.closest(".country-picker-item");
      if (!btn) return;
      setValue(btn.dataset.value);
      wrap.classList.remove("is-open");
    });

    // Allow programmatic value updates from the form (e.g. when the
    // edit modal loads an existing record).
    hiddenInput.addEventListener("country-picker:set", () => {
      current = (hiddenInput.value || "").trim();
      paintTrigger();
    });

    paintTrigger();
  }

  function attachAll(root) {
    (root || document).querySelectorAll("[data-country-picker]").forEach(attachOne);
  }

  window.CountryPicker = { attachAll, attachOne };
})();
