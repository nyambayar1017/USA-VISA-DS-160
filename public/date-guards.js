// Tiny date-input guard. Walks the page once and re-walks when the DOM
// changes (passport scan, modal opens, etc.) to keep the constraints fresh.
//
// Rules:
//   • dob and passportIssueDate cannot be after today.
//   • passportExpiry cannot be earlier than tomorrow.
//
// Implemented as input attributes (max/min) so the native date picker greys
// out the invalid days, plus a submit-time guard via the input "invalid"
// event so a manually-typed bad value also gets caught.
(function () {
  if (window.__dateGuardsInstalled) return;
  window.__dateGuardsInstalled = true;

  function todayIso() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  function tomorrowIso() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  const RULES = [
    { name: "dob", attr: "max", value: todayIso, msg: "Date of birth cannot be in the future." },
    { name: "passportIssueDate", attr: "max", value: todayIso, msg: "Passport issue date cannot be in the future." },
    { name: "passportExpiry", attr: "min", value: tomorrowIso, msg: "Passport expiry must be after today." },
  ];

  function apply(root) {
    RULES.forEach((r) => {
      const v = r.value();
      root.querySelectorAll(`input[type="date"][name="${r.name}"]`).forEach((el) => {
        if (el.dataset.dgApplied === r.attr) return;
        el.setAttribute(r.attr, v);
        el.dataset.dgApplied = r.attr;
        el.addEventListener("invalid", () => el.setCustomValidity(r.msg));
        el.addEventListener("input", () => el.setCustomValidity(""));
      });
    });
  }

  function start() {
    apply(document);
    const obs = new MutationObserver((muts) => {
      for (const m of muts) {
        m.addedNodes.forEach((node) => {
          if (node.nodeType === 1) apply(node);
        });
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
