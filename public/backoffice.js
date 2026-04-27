const taskForm = document.querySelector("#task-form");
const contactForm = document.querySelector("#contact-form");
const taskFormPanel = document.querySelector("#task-form-panel");
const contactFormPanel = document.querySelector("#contact-form-panel");
const taskToggleForm = document.querySelector("#task-toggle-form");
const contactToggleForm = document.querySelector("#contact-toggle-form");
const taskManagerSelect = document.querySelector("#task-manager-select");
const taskSubmitButton = document.querySelector("#task-submit-button");
const contactSubmitButton = document.querySelector("#contact-submit-button");
const taskCancelButton = document.querySelector("#task-cancel-button");
const contactCancelButton = document.querySelector("#contact-cancel-button");

const todoList = document.querySelector("#todo-list");
const todoCount = document.querySelector("#todo-count");
const todoSearch = document.querySelector("#todo-search");
const todoTypeFilter = document.querySelector("#todo-type-filter");
const todoPriorityFilter = document.querySelector("#todo-priority-filter");
const todoStatusPills = document.querySelector("#todo-status-pills");

const taskStatusNode = document.querySelector("#task-status");
const contactStatusNode = document.querySelector("#contact-status");

const state = {
  tasks: [],
  contacts: [],
  teamMembers: [],
  editingTaskId: "",
  editingContactId: "",
  activeStatus: "all",
};

const STATUS_LABEL = {
  todo: "Pending",
  pending: "Pending",
  "in-progress": "In progress",
  done: "Done",
  cancelled: "Cancelled",
  overdue: "Overdue",
};

function setStatus(node, message, isError = false) {
  if (!node) return;
  node.textContent = message;
  node.dataset.tone = isError ? "error" : "ok";
}

function clearStatus(node) {
  if (!node) return;
  node.textContent = "";
  delete node.dataset.tone;
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatDate(value) {
  if (!value) return "-";
  const iso = String(value).split("T")[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, "0");
  const d = String(parsed.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Compose dueDate (YYYY-MM-DD) + optional dueTime (HH:MM, default 09:00) into a Date.
function taskDueDateObj(task) {
  if (!task.dueDate) return null;
  const iso = String(task.dueDate).split("T")[0];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const time = /^\d{2}:\d{2}$/.test(task.dueTime || "") ? task.dueTime : "09:00";
  const dt = new Date(`${iso}T${time}:00`);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

// Returns {label, tone}: tone is "overdue" (past), "soon" (≤24h), or "ok".
function dueState(task) {
  if (!task.dueDate || ["done", "cancelled"].includes(task.status)) {
    return { label: task.dueDate ? formatDate(task.dueDate) : "—", tone: "ok" };
  }
  const due = taskDueDateObj(task);
  if (!due) return { label: formatDate(task.dueDate), tone: "ok" };

  const now = new Date();
  const diffMs = due.getTime() - now.getTime();
  const oneDay = 24 * 60 * 60 * 1000;

  if (diffMs < 0) {
    const days = Math.floor(-diffMs / oneDay);
    if (days >= 1) return { label: `-${days} day${days === 1 ? "" : "s"}`, tone: "overdue" };
    const hours = Math.max(1, Math.floor(-diffMs / (60 * 60 * 1000)));
    return { label: `-${hours}h`, tone: "overdue" };
  }
  if (diffMs <= oneDay) {
    const hours = Math.max(1, Math.round(diffMs / (60 * 60 * 1000)));
    return { label: `${hours}h left`, tone: "soon" };
  }
  return { label: formatDate(task.dueDate), tone: "ok" };
}

function isTaskOverdue(task) {
  if (["done", "cancelled"].includes(task.status)) return false;
  const due = taskDueDateObj(task);
  return !!(due && due.getTime() < Date.now());
}

function renderManagerOptions() {
  if (!taskManagerSelect) return;
  const currentValue = taskManagerSelect.value;
  const options = state.teamMembers.length
    ? state.teamMembers
        .map(
          (member) =>
            `<option value="${escapeHtml(member.fullName)}">${escapeHtml(member.fullName)}</option>`
        )
        .join("")
    : '<option value="">No registered managers found</option>';

  taskManagerSelect.innerHTML = `
    <option value="">Choose registered manager</option>
    ${options}
  `;
  if (state.teamMembers.some((member) => member.fullName === currentValue)) {
    taskManagerSelect.value = currentValue;
  }
}

function resetTaskForm() {
  taskForm.reset();
  taskForm.elements.id.value = "";
  state.editingTaskId = "";
  taskSubmitButton.textContent = "Add task";
  clearStatus(taskStatusNode);
}

function resetContactForm() {
  contactForm.reset();
  contactForm.elements.id.value = "";
  state.editingContactId = "";
  if (contactForm.elements.destinations) {
    contactForm.elements.destinations.value = "";
    contactForm.elements.destinations.dispatchEvent(new CustomEvent("destinations:set"));
  }
  contactSubmitButton.textContent = "Save contact";
  clearStatus(contactStatusNode);
}

function syncBodyModalState() {
  const hasOpenPanel = [taskFormPanel, contactFormPanel].some(
    (panel) => panel && !panel.classList.contains("is-hidden")
  );
  document.body.classList.toggle("modal-open", hasOpenPanel);
}

function openPanel(panel) {
  if (!panel) return;
  panel.classList.remove("is-hidden");
  panel.removeAttribute("hidden");
  syncBodyModalState();
  panel.scrollTop = 0;
  const dialog = panel.querySelector(".camp-modal-dialog");
  if (dialog) dialog.scrollTop = 0;
}

function closePanel(panel) {
  if (!panel) return;
  panel.classList.add("is-hidden");
  panel.setAttribute("hidden", "");
  syncBodyModalState();
}

function startTaskEdit(taskId) {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) return;
  state.editingTaskId = taskId;
  taskForm.elements.id.value = task.id;
  taskForm.elements.title.value = task.title || "";
  taskForm.elements.owner.value = task.owner || "";
  taskForm.elements.priority.value = task.priority || "medium";
  taskForm.elements.status.value = task.status || "todo";
  taskForm.elements.dueDate.value = task.dueDate || "";
  taskForm.elements.dueTime.value = task.dueTime || "";
  taskForm.elements.note.value = task.note || "";
  taskSubmitButton.textContent = "Update task";
  setStatus(taskStatusNode, "Editing task.");
  openPanel(taskFormPanel);
}

function startContactEdit(contactId) {
  const contact = state.contacts.find((item) => item.id === contactId);
  if (!contact) return;
  state.editingContactId = contactId;
  contactForm.elements.id.value = contact.id;
  contactForm.elements.name.value = contact.name || "";
  contactForm.elements.phone.value = contact.phone || "";
  contactForm.elements.type.value = contact.type || "client";
  contactForm.elements.status.value = contact.status || "priority";
  contactForm.elements.lastContacted.value = contact.lastContacted || "";
  if (contactForm.elements.destinations) {
    const dests = Array.isArray(contact.destinations) ? contact.destinations : [];
    contactForm.elements.destinations.value = dests.join(", ");
    contactForm.elements.destinations.dispatchEvent(new CustomEvent("destinations:set"));
  }
  contactForm.elements.note.value = contact.note || "";
  contactSubmitButton.textContent = "Update contact";
  setStatus(contactStatusNode, "Editing contact.");
  openPanel(contactFormPanel);
}

function statusKey(task) {
  // Map "todo" → "pending" for display/filter purposes; overdue is computed.
  if (isTaskOverdue(task)) return "overdue";
  if (task.status === "todo") return "pending";
  return task.status || "pending";
}

function buildItems() {
  const tasks = state.tasks.map((t) => ({ kind: "task", data: t }));
  const contacts = state.contacts.map((c) => ({ kind: "contact", data: c }));
  return [...tasks, ...contacts];
}

function applyFilters(items) {
  const query = (todoSearch?.value || "").trim().toLowerCase();
  const typeFilter = todoTypeFilter?.value || "all";
  const priority = todoPriorityFilter?.value || "all";
  const status = state.activeStatus;

  return items.filter((item) => {
    if (typeFilter === "task" && item.kind !== "task") return false;
    if (typeFilter === "contact" && item.kind !== "contact") return false;

    if (item.kind === "task") {
      if (priority !== "all" && item.data.priority !== priority) return false;
      if (status !== "all" && statusKey(item.data) !== status) return false;
    } else {
      // Contacts don't have task-statuses; hide them when a task-only status pill is active.
      if (status !== "all") return false;
      if (priority !== "all") return false;
    }

    if (!query) return true;
    if (item.kind === "task") {
      return [item.data.title, item.data.owner, item.data.note].some((v) =>
        String(v || "").toLowerCase().includes(query)
      );
    }
    const dests = Array.isArray(item.data.destinations) ? item.data.destinations.join(" ") : "";
    return [item.data.name, item.data.phone, item.data.note, dests].some((v) =>
      String(v || "").toLowerCase().includes(query)
    );
  });
}

function sortItems(items) {
  // Tasks first, sorted: overdue → soon → pending → in-progress → done/cancelled, then by due asc.
  const rank = (it) => {
    if (it.kind !== "task") return 100;
    const s = statusKey(it.data);
    const map = { overdue: 0, "in-progress": 1, pending: 2, done: 9, cancelled: 9 };
    return map[s] ?? 5;
  };
  return [...items].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "task" ? -1 : 1;
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;
    if (a.kind === "task") {
      return String(a.data.dueDate || "").localeCompare(String(b.data.dueDate || ""));
    }
    return String(a.data.name || "").localeCompare(String(b.data.name || ""));
  });
}

function renderTaskRow(task) {
  const due = dueState(task);
  const sKey = statusKey(task);
  const sLabel = STATUS_LABEL[sKey] || sKey;
  return `
    <div class="todo-row todo-row--task" data-task-id="${escapeHtml(task.id)}">
      <div class="todo-row-main">
        <div class="todo-row-title">
          <span class="todo-row-kind">Task</span>
          <strong>${escapeHtml(task.title)}</strong>
        </div>
        <div class="todo-row-meta">
          <span>👤 ${escapeHtml(task.owner || "Unassigned")}</span>
          <span class="todo-badge priority-${escapeHtml(task.priority || "medium")}">${escapeHtml(task.priority || "medium")}</span>
          <span class="todo-badge status-${escapeHtml(sKey)}">${escapeHtml(sLabel)}</span>
          <span class="todo-due todo-due--${due.tone}">📅 ${escapeHtml(due.label)}${task.dueTime ? ` ${escapeHtml(task.dueTime)}` : ""}</span>
          ${task.note ? `<span class="todo-note">📝 ${escapeHtml(task.note)}</span>` : ""}
        </div>
      </div>
      <div class="todo-row-actions">
        <button type="button" data-task-edit="${escapeHtml(task.id)}">Edit</button>
        ${task.status !== "in-progress" && task.status !== "done" ? `<button type="button" data-task-progress="${escapeHtml(task.id)}">Start</button>` : ""}
        ${task.status !== "done" ? `<button type="button" data-task-done="${escapeHtml(task.id)}">Done</button>` : ""}
        <button type="button" data-task-delete="${escapeHtml(task.id)}" class="button-secondary">Delete</button>
      </div>
    </div>
  `;
}

function renderContactRow(contact) {
  const dests = Array.isArray(contact.destinations) ? contact.destinations : [];
  return `
    <div class="todo-row todo-row--contact" data-contact-id="${escapeHtml(contact.id)}">
      <div class="todo-row-main">
        <div class="todo-row-title">
          <span class="todo-row-kind todo-row-kind--contact">Contact</span>
          <strong>${escapeHtml(contact.name)}</strong>
        </div>
        <div class="todo-row-meta">
          <span>📞 <a href="tel:${escapeHtml(contact.phone)}">${escapeHtml(contact.phone)}</a></span>
          <span class="todo-badge contact-${escapeHtml(contact.type || "client")}">${escapeHtml(contact.type || "client")}</span>
          <span class="todo-badge status-${escapeHtml(contact.status || "new")}">${escapeHtml(contact.status || "new")}</span>
          ${contact.lastContacted ? `<span>🕒 ${escapeHtml(formatDate(contact.lastContacted))}</span>` : ""}
          ${dests.length ? dests.map((d) => `<span class="tourist-tag-chip">${escapeHtml(d)}</span>`).join("") : ""}
          ${contact.note ? `<span class="todo-note">📝 ${escapeHtml(contact.note)}</span>` : ""}
        </div>
      </div>
      <div class="todo-row-actions">
        <button type="button" data-contact-edit="${escapeHtml(contact.id)}">Edit</button>
        <button type="button" data-contact-priority="${escapeHtml(contact.id)}">${contact.status === "priority" ? "Warm" : "Priority"}</button>
        <button type="button" data-contact-delete="${escapeHtml(contact.id)}" class="button-secondary">Delete</button>
      </div>
    </div>
  `;
}

function renderList() {
  const items = sortItems(applyFilters(buildItems()));
  if (!items.length) {
    todoList.innerHTML = `<p class="empty">No items match these filters yet.</p>`;
    if (todoCount) todoCount.textContent = "0 items";
    return;
  }

  const taskCount = items.filter((i) => i.kind === "task").length;
  const contactCount = items.filter((i) => i.kind === "contact").length;
  if (todoCount) {
    todoCount.textContent = `${items.length} item${items.length === 1 ? "" : "s"} · ${taskCount} task${taskCount === 1 ? "" : "s"}, ${contactCount} contact${contactCount === 1 ? "" : "s"}`;
  }

  todoList.innerHTML = items
    .map((item) => (item.kind === "task" ? renderTaskRow(item.data) : renderContactRow(item.data)))
    .join("");
}

function renderStatusPills() {
  if (!todoStatusPills) return;
  todoStatusPills.querySelectorAll(".invoices-status-pill").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.status === state.activeStatus);
  });
}

async function loadDashboard() {
  todoList.innerHTML = '<p class="empty">Loading...</p>';
  try {
    const [payload, teamMembersPayload] = await Promise.all([
      fetchJson("/api/manager-dashboard"),
      fetchJson("/api/team-members"),
    ]);
    state.tasks = payload.tasks || [];
    state.contacts = payload.contacts || [];
    state.teamMembers = teamMembersPayload.entries || [];
    renderManagerOptions();
    renderList();
  } catch (error) {
    todoList.innerHTML = `<p class="empty">${escapeHtml(error.message)}</p>`;
    setStatus(taskStatusNode, error.message, true);
  }
}

async function submitForm(form, url, statusNode, onSuccess) {
  clearStatus(statusNode);
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());
  try {
    await fetchJson(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    onSuccess();
    setStatus(statusNode, "Saved.");
    await loadDashboard();
    return true;
  } catch (error) {
    setStatus(statusNode, error.message, true);
    return false;
  }
}

taskForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const taskId = taskForm.elements.id.value;
  const url = taskId ? `/api/manager-dashboard/tasks/${taskId}` : "/api/manager-dashboard/tasks";
  const saved = await submitForm(taskForm, url, taskStatusNode, resetTaskForm);
  if (saved) closePanel(taskFormPanel);
});

contactForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const contactId = contactForm.elements.id.value;
  const url = contactId ? `/api/manager-dashboard/contacts/${contactId}` : "/api/manager-dashboard/contacts";
  const saved = await submitForm(contactForm, url, contactStatusNode, resetContactForm);
  if (saved) closePanel(contactFormPanel);
});

todoList.addEventListener("click", async (event) => {
  const target = event.target;
  const taskEdit = target.closest("[data-task-edit]");
  const taskProgress = target.closest("[data-task-progress]");
  const taskDone = target.closest("[data-task-done]");
  const taskDelete = target.closest("[data-task-delete]");
  const contactEdit = target.closest("[data-contact-edit]");
  const contactPriority = target.closest("[data-contact-priority]");
  const contactDelete = target.closest("[data-contact-delete]");

  try {
    if (taskEdit) {
      startTaskEdit(taskEdit.dataset.taskEdit);
      return;
    }
    if (taskProgress) {
      await fetchJson(`/api/manager-dashboard/tasks/${taskProgress.dataset.taskProgress}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "in-progress" }),
      });
      await loadDashboard();
      return;
    }
    if (taskDone) {
      await fetchJson(`/api/manager-dashboard/tasks/${taskDone.dataset.taskDone}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "done" }),
      });
      await loadDashboard();
      return;
    }
    if (taskDelete) {
      await fetchJson(`/api/manager-dashboard/tasks/${taskDelete.dataset.taskDelete}`, {
        method: "DELETE",
      });
      await loadDashboard();
      return;
    }
    if (contactEdit) {
      startContactEdit(contactEdit.dataset.contactEdit);
      return;
    }
    if (contactPriority) {
      const contact = state.contacts.find((item) => item.id === contactPriority.dataset.contactPriority);
      const nextStatus = contact?.status === "priority" ? "warm" : "priority";
      await fetchJson(`/api/manager-dashboard/contacts/${contactPriority.dataset.contactPriority}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      await loadDashboard();
      return;
    }
    if (contactDelete) {
      await fetchJson(`/api/manager-dashboard/contacts/${contactDelete.dataset.contactDelete}`, {
        method: "DELETE",
      });
      await loadDashboard();
    }
  } catch (error) {
    setStatus(taskStatusNode, error.message, true);
  }
});

taskCancelButton.addEventListener("click", () => {
  resetTaskForm();
  closePanel(taskFormPanel);
});
contactCancelButton.addEventListener("click", () => {
  resetContactForm();
  closePanel(contactFormPanel);
});

taskToggleForm?.addEventListener("click", () => {
  resetTaskForm();
  openPanel(taskFormPanel);
});

contactToggleForm?.addEventListener("click", () => {
  resetContactForm();
  openPanel(contactFormPanel);
});

[taskFormPanel, contactFormPanel].forEach((panel) => {
  panel?.addEventListener("click", (event) => {
    const action = event.target.dataset.action;
    if (action === "close-task-modal") {
      resetTaskForm();
      closePanel(taskFormPanel);
    }
    if (action === "close-contact-modal") {
      resetContactForm();
      closePanel(contactFormPanel);
    }
  });
});

[todoSearch, todoTypeFilter, todoPriorityFilter].forEach((node) => {
  node?.addEventListener("input", renderList);
  node?.addEventListener("change", renderList);
});

todoStatusPills?.addEventListener("click", (event) => {
  const pill = event.target.closest(".invoices-status-pill");
  if (!pill) return;
  const status = pill.dataset.status;
  state.activeStatus = state.activeStatus === status ? "all" : status;
  renderStatusPills();
  renderList();
});

renderStatusPills();
loadDashboard();
if (window.DestinationsMulti) window.DestinationsMulti.attachAll(document);

// Refresh overdue countdowns every minute.
setInterval(renderList, 60 * 1000);
