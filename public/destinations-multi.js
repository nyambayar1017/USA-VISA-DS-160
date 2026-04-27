// Tiny multi-select dropdown for destinations. Backed by /api/settings.
// Usage:
//   <input type="hidden" name="destinations" data-destinations-multi />
// Then call: window.DestinationsMulti.attachAll(rootElement)
// The hidden input will hold a comma-separated string for normal form submission.

(function () {
  let cachedList = null;
  let inflight = null;

  async function loadDestinations() {
    if (cachedList) return cachedList;
    if (inflight) return inflight;
    inflight = fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        cachedList = (d.entry?.destinations) || [];
        inflight = null;
        return cachedList;
      })
      .catch(() => {
        inflight = null;
        return [];
      });
    return inflight;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function attachOne(hiddenInput) {
    if (!hiddenInput || hiddenInput.dataset.destinationsAttached === "1") return;
    hiddenInput.dataset.destinationsAttached = "1";
    hiddenInput.type = "hidden";

    const wrap = document.createElement("div");
    wrap.className = "destinations-multi";
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "destinations-multi-trigger";
    trigger.innerHTML = '<span class="destinations-multi-placeholder">Choose destinations…</span>';
    const popover = document.createElement("div");
    popover.className = "destinations-multi-popover";
    wrap.appendChild(trigger);
    wrap.appendChild(popover);
    hiddenInput.parentNode.insertBefore(wrap, hiddenInput);

    let selected = (hiddenInput.value || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    function syncHidden() {
      hiddenInput.value = selected.join(", ");
    }

    function render(options) {
      // Trigger chips.
      if (!selected.length) {
        trigger.innerHTML = '<span class="destinations-multi-placeholder">Choose destinations…</span>';
      } else {
        trigger.innerHTML = selected
          .map((s) => `<span class="tourist-tag-chip">${escapeHtml(s)}</span>`)
          .join("");
      }
      // Popover items.
      const known = new Set(options);
      // Include any selected items that aren't in the global list (legacy free-text).
      const allItems = [...options, ...selected.filter((s) => !known.has(s))];
      popover.innerHTML = allItems
        .map(
          (name) => `
            <label class="destinations-multi-item">
              <input type="checkbox" value="${escapeHtml(name)}" ${selected.includes(name) ? "checked" : ""} />
              <span>${escapeHtml(name)}</span>
            </label>
          `
        )
        .join("");
    }

    // Open/close.
    trigger.addEventListener("click", async (event) => {
      event.preventDefault();
      const isOpen = wrap.classList.toggle("is-open");
      if (isOpen) {
        const options = await loadDestinations();
        render(options);
      }
    });

    // Click-away close.
    document.addEventListener("click", (event) => {
      if (!wrap.contains(event.target)) wrap.classList.remove("is-open");
    });

    // Item toggle.
    popover.addEventListener("change", async (event) => {
      const cb = event.target.closest('input[type="checkbox"]');
      if (!cb) return;
      const value = cb.value;
      if (cb.checked && !selected.includes(value)) selected.push(value);
      if (!cb.checked) selected = selected.filter((s) => s !== value);
      syncHidden();
      const options = await loadDestinations();
      render(options);
    });

    // External programmatic set (hidden input value changed by code).
    hiddenInput.addEventListener("destinations:set", async () => {
      selected = (hiddenInput.value || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const options = await loadDestinations();
      render(options);
    });

    // Initial render.
    loadDestinations().then(render);
  }

  function attachAll(root) {
    (root || document).querySelectorAll("[data-destinations-multi]").forEach(attachOne);
  }

  window.DestinationsMulti = { attachAll, attachOne, loadDestinations };
})();
