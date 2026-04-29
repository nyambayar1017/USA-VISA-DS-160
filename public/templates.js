(function () {
  "use strict";

  const listNode = document.getElementById("tpl-meal-list");
  const addBtn = document.getElementById("tpl-meal-add");

  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

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

  function render() {
    if (!templates.length) {
      listNode.innerHTML = `<p class="tpl-empty">No meal templates yet. Click <strong>+ Add meal</strong> to create one (e.g. "Hotel breakfast", "Local restaurant").</p>`;
      return;
    }
    listNode.innerHTML = templates.map((t) => `
      <div class="tpl-meal-row" data-id="${escapeHtml(t.id)}">
        <input type="text" class="tpl-meal-name" value="${escapeHtml(t.name || "")}" />
        <button type="button" class="tpl-meal-save" data-action="save">Save</button>
        <button type="button" class="tpl-meal-delete" data-action="delete" aria-label="Delete">×</button>
      </div>
    `).join("");
  }

  async function createTemplate() {
    const ui = window.UI;
    const raw = ui && ui.prompt
      ? await ui.prompt("Reusable venue string the trip-creator suggests on Breakfast/Lunch/Dinner inputs.", {
          title: "New meal template",
          confirmLabel: "Add",
          defaultValue: "",
        })
      : window.prompt("Meal template name (e.g. \"Hotel breakfast\")");
    const name = (raw || "").trim();
    if (!name) return;
    try {
      const res = await fetch("/api/meal-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      await load();
    } catch (err) {
      alert(`Could not create: ${err.message}`);
    }
  }

  async function saveTemplate(id, name) {
    try {
      const res = await fetch(`/api/meal-templates/${encodeURIComponent(id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
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

  addBtn.addEventListener("click", createTemplate);

  listNode.addEventListener("click", (event) => {
    const row = event.target.closest(".tpl-meal-row");
    if (!row) return;
    const id = row.dataset.id;
    const nameInput = row.querySelector(".tpl-meal-name");
    if (event.target.closest('[data-action="save"]')) {
      const value = (nameInput.value || "").trim();
      if (value) saveTemplate(id, value);
      return;
    }
    if (event.target.closest('[data-action="delete"]')) {
      deleteTemplate(id, nameInput.value || id);
      return;
    }
  });

  load();
})();
