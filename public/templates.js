(function () {
  "use strict";

  const listNode = document.getElementById("tpl-meal-list");

  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  // Three meal categories the trip-creator filters on. "" (empty) is
  // for legacy templates created before category was a field; they get
  // an extra "Uncategorized" section with a category dropdown.
  const CATEGORIES = [
    { key: "breakfast", title: "Breakfast", placeholder: "e.g. Hotel" },
    { key: "lunch",     title: "Lunch",     placeholder: "e.g. Local restaurant" },
    { key: "dinner",    title: "Dinner",    placeholder: "e.g. Hotel" },
  ];

  let templates = [];

  async function load() {
    listNode.innerHTML = `<p class="tpl-empty">Loading…</p>`;
    try {
      const res = await fetch("/api/meal-templates");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      templates = data.entries || [];
      render();
    } catch (err) {
      listNode.innerHTML = `<p class="tpl-empty">Could not load templates: ${escapeHtml(err.message)}</p>`;
    }
  }

  function rowHtml(t, opts) {
    const showCategoryPicker = !!(opts && opts.showCategoryPicker);
    const catOptions = ["breakfast", "lunch", "dinner"]
      .map((c) => `<option value="${c}"${c === t.category ? " selected" : ""}>${c[0].toUpperCase() + c.slice(1)}</option>`)
      .join("");
    return `
      <div class="tpl-meal-row" data-id="${escapeHtml(t.id)}" data-category="${escapeHtml(t.category || "")}">
        <input type="text" class="tpl-meal-name" value="${escapeHtml(t.name || "")}" />
        ${showCategoryPicker ? `<select class="tpl-meal-cat">
          <option value="">— Pick category —</option>
          ${catOptions}
        </select>` : ""}
        <button type="button" class="tpl-meal-save" data-action="save">Save</button>
        <button type="button" class="tpl-meal-delete" data-action="delete" aria-label="Delete">×</button>
      </div>
    `;
  }

  function sectionHtml(cat) {
    const items = templates.filter((t) => (t.category || "") === cat.key);
    const rows = items.length
      ? items.map((t) => rowHtml(t, { showCategoryPicker: false })).join("")
      : `<p class="tpl-section-empty">No ${cat.title.toLowerCase()} templates yet.</p>`;
    return `
      <div class="tpl-section" data-section="${cat.key}">
        <div class="tpl-section-head">
          <h3>${cat.title}</h3>
          <button type="button" class="tpl-section-add" data-action="add" data-cat="${cat.key}">+ Add ${cat.title.toLowerCase()}</button>
        </div>
        <div class="tpl-section-rows">${rows}</div>
      </div>
    `;
  }

  function uncategorizedSection() {
    const items = templates.filter((t) => !t.category);
    if (!items.length) return "";
    return `
      <div class="tpl-section tpl-section--legacy">
        <div class="tpl-section-head">
          <h3>Uncategorized</h3>
          <span class="tpl-section-hint">Pick a category and click Save.</span>
        </div>
        <div class="tpl-section-rows">
          ${items.map((t) => rowHtml(t, { showCategoryPicker: true })).join("")}
        </div>
      </div>
    `;
  }

  function render() {
    listNode.innerHTML = `
      ${uncategorizedSection()}
      ${CATEGORIES.map(sectionHtml).join("")}
    `;
  }

  async function createTemplate(category) {
    const ui = window.UI;
    const cat = CATEGORIES.find((c) => c.key === category);
    if (!cat) return;
    const raw = ui && ui.prompt
      ? await ui.prompt(`Reusable venue string the trip-creator suggests on ${cat.title} inputs.`, {
          title: `New ${cat.title.toLowerCase()} template`,
          confirmLabel: "Add",
          defaultValue: "",
        })
      : window.prompt(`${cat.title} template name`);
    const name = (raw || "").trim();
    if (!name) return;
    try {
      const res = await fetch("/api/meal-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, category }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      await load();
    } catch (err) {
      alert(`Could not create: ${err.message}`);
    }
  }

  async function saveTemplate(id, name, category) {
    try {
      const body = { name };
      if (category !== undefined) body.category = category;
      const res = await fetch(`/api/meal-templates/${encodeURIComponent(id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      await load();
    } catch (err) {
      alert(`Could not save: ${err.message}`);
    }
  }

  async function deleteTemplate(id, name) {
    const ui = window.UI;
    const ok = ui && ui.confirm
      ? await ui.confirm(`Delete meal template "${name}"?`, {
          title: "Delete template",
          confirmLabel: "Delete",
          cancelLabel: "Cancel",
        })
      : window.confirm(`Delete meal template "${name}"?`);
    if (!ok) return;
    try {
      const res = await fetch(`/api/meal-templates/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      await load();
    } catch (err) {
      alert(`Could not delete: ${err.message}`);
    }
  }

  listNode.addEventListener("click", (event) => {
    const addBtn = event.target.closest('[data-action="add"]');
    if (addBtn) {
      createTemplate(addBtn.dataset.cat);
      return;
    }
    const row = event.target.closest(".tpl-meal-row");
    if (!row) return;
    const id = row.dataset.id;
    const nameInput = row.querySelector(".tpl-meal-name");
    const catSelect = row.querySelector(".tpl-meal-cat");
    if (event.target.closest('[data-action="save"]')) {
      const value = (nameInput.value || "").trim();
      if (!value) return;
      const category = catSelect ? (catSelect.value || "") : undefined;
      saveTemplate(id, value, category);
      return;
    }
    if (event.target.closest('[data-action="delete"]')) {
      deleteTemplate(id, nameInput.value || id);
      return;
    }
  });

  load();
})();
