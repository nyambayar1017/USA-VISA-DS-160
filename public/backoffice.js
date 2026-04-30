const taskForm = document.querySelector("#task-form");
const contactForm = document.querySelector("#contact-form");
const taskFormPanel = document.querySelector("#task-form-panel");
const contactFormPanel = document.querySelector("#contact-form-panel");
const taskToggleForm = document.querySelector("#task-toggle-form");
const contactToggleForm = document.querySelector("#contact-toggle-form");
const taskManagerPicker = document.querySelector("#task-manager-picker");
const taskSubmitButton = document.querySelector("#task-submit-button");
const contactSubmitButton = document.querySelector("#contact-submit-button");
const taskCancelButton = document.querySelector("#task-cancel-button");
const contactCancelButton = document.querySelector("#contact-cancel-button");

const todoList = document.querySelector("#todo-list");
const todoCount = document.querySelector("#todo-count");
const todoSearch = document.querySelector("#todo-search");
const todoTypeFilter = document.querySelector("#todo-type-filter");
const todoManagerFilter = document.querySelector("#todo-manager-filter");
const todoPriorityFilter = document.querySelector("#todo-priority-filter");
const todoStatusPills = document.querySelector("#todo-status-pills");

// Same backoffice.html backs both /todo and /contacts. On /contacts we
// default-filter to contacts and hide the type toggle so the page reads
// like its own "Contacts saver" view per the user's split-into-2 ask.
// On /todo we mirror the inverse: default to tasks-only.
(function applyRouteDefault() {
  if (!todoTypeFilter) return;
  const wsShort = window.WORKSPACE_SHORT || "TravelX";
  if (window.location.pathname === "/contacts") {
    todoTypeFilter.value = "contact";
    todoTypeFilter.style.display = "none";
    document.title = `${wsShort} Contacts`;
    const head = document.querySelector("#todo-section .section-head h2");
    if (head) head.textContent = "Contacts";
    const sub = document.querySelector("#todo-section .section-head p");
    if (sub) sub.textContent = "All saved contacts. Add a new one with + Add contact.";
    const taskBtn = document.querySelector("#task-toggle-form");
    if (taskBtn) taskBtn.style.display = "none";
  } else if (window.location.pathname === "/todo") {
    todoTypeFilter.value = "task";
    todoTypeFilter.style.display = "none";
    document.title = `${wsShort} To Do`;
    const head = document.querySelector("#todo-section .section-head h2");
    if (head) head.textContent = "To-Do tasks";
    const sub = document.querySelector("#todo-section .section-head p");
    if (sub) sub.textContent = "Tasks turn red when overdue and remind the assignee 6 hours before due.";
    const contactBtn = document.querySelector("#contact-toggle-form");
    if (contactBtn) contactBtn.style.display = "none";
  }
})();

const taskStatusNode = document.querySelector("#task-status");
const contactStatusNode = document.querySelector("#contact-status");

const state = {
  tasks: [],
  contacts: [],
  teamMembers: [],
  currentUser: null,
  editingTaskId: "",
  editingContactId: "",
  activeStatus: "all",
  taskImageDirty: false,   // a new file has been picked but not yet uploaded
  taskImageRemoved: false, // user clicked "Remove image" while editing
};

// Tasks used to store a single `owner` string. Newer ones use `owners` (list).
// This helper returns the canonical list either way so filters and display
// don't have to branch.
function taskOwnerList(task) {
  if (!task) return [];
  if (Array.isArray(task.owners) && task.owners.length) {
    return task.owners.filter(Boolean);
  }
  if (task.owner) return [task.owner];
  return [];
}

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

function setTaskManagerSelection(names) {
  if (!taskManagerPicker) return;
  const wanted = new Set((names || []).filter(Boolean));
  taskManagerPicker.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
    cb.checked = wanted.has(cb.value);
  });
}

function getTaskManagerSelection() {
  if (!taskManagerPicker) return [];
  return Array.from(taskManagerPicker.querySelectorAll('input[type="checkbox"]:checked')).map(
    (cb) => cb.value
  );
}

function renderManagerOptions() {
  if (taskManagerPicker) {
    const currentSelection = getTaskManagerSelection();
    if (!state.teamMembers.length) {
      taskManagerPicker.innerHTML = '<p class="task-manager-empty">No registered managers found.</p>';
    } else {
      taskManagerPicker.innerHTML = state.teamMembers
        .map(
          (member) => `
            <label class="task-manager-chip">
              <input type="checkbox" name="owners" value="${escapeHtml(member.fullName)}" />
              <span>${escapeHtml(member.fullName)}</span>
            </label>
          `
        )
        .join("");
    }
    if (currentSelection.length) setTaskManagerSelection(currentSelection);
  }

  if (todoManagerFilter) {
    const prevValue = todoManagerFilter.value || "all";
    const optionsHtml = state.teamMembers
      .map(
        (member) =>
          `<option value="${escapeHtml(member.fullName)}">${escapeHtml(member.fullName)}</option>`
      )
      .join("");
    todoManagerFilter.innerHTML = `
      <option value="all">All managers</option>
      <option value="__me__">Assigned to me</option>
      ${optionsHtml}
    `;
    const stillValid =
      prevValue === "all" ||
      prevValue === "__me__" ||
      state.teamMembers.some((m) => m.fullName === prevValue);
    todoManagerFilter.value = stillValid ? prevValue : "all";
  }
}

function resetTaskForm() {
  taskForm.reset();
  taskForm.elements.id.value = "";
  state.editingTaskId = "";
  state.taskImageDirty = false;
  state.taskImageRemoved = false;
  setTaskManagerSelection([]);
  hideTaskImagePreview();
  taskSubmitButton.textContent = "Add task";
  clearStatus(taskStatusNode);
}

const taskImageInput = document.getElementById("task-image-input");
const taskImagePreview = document.getElementById("task-image-preview");
const taskImagePreviewImg = document.getElementById("task-image-preview-img");
const taskImageRemoveBtn = document.getElementById("task-image-remove");

function showTaskImagePreview(src) {
  if (!taskImagePreview || !taskImagePreviewImg) return;
  taskImagePreviewImg.src = src;
  taskImagePreview.hidden = false;
}
function hideTaskImagePreview() {
  if (!taskImagePreview || !taskImagePreviewImg) return;
  taskImagePreviewImg.removeAttribute("src");
  taskImagePreview.hidden = true;
  if (taskImageInput) taskImageInput.value = "";
}
taskImageInput?.addEventListener("change", () => {
  const file = taskImageInput.files?.[0];
  if (!file) return;
  state.taskImageDirty = true;
  state.taskImageRemoved = false;
  const reader = new FileReader();
  reader.onload = () => showTaskImagePreview(reader.result);
  reader.readAsDataURL(file);
});
taskImageRemoveBtn?.addEventListener("click", () => {
  hideTaskImagePreview();
  state.taskImageDirty = false;
  state.taskImageRemoved = true;
});

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
  state.taskImageDirty = false;
  state.taskImageRemoved = false;
  taskForm.elements.id.value = task.id;
  taskForm.elements.title.value = task.title || "";
  setTaskManagerSelection(taskOwnerList(task));
  taskForm.elements.priority.value = task.priority || "medium";
  taskForm.elements.status.value = task.status || "todo";
  taskForm.elements.dueDate.value = task.dueDate || "";
  taskForm.elements.dueTime.value = task.dueTime || "";
  taskForm.elements.note.value = task.note || "";
  // Show the existing reference image if any. Cache-bust so the user
  // sees their last upload after replacing.
  if (task.imageExt) {
    showTaskImagePreview(`/api/manager-dashboard/tasks/${task.id}/image?ts=${Date.now()}`);
  } else {
    hideTaskImagePreview();
  }
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
  const managerFilter = todoManagerFilter?.value || "all";
  const status = state.activeStatus;
  const archiveMode = status === "archive";
  const meName = (state.currentUser?.fullName || "").toLowerCase();

  return items.filter((item) => {
    if (typeFilter === "task" && item.kind !== "task") return false;
    if (typeFilter === "contact" && item.kind !== "contact") return false;

    if (item.kind === "task") {
      if (archiveMode) {
        if (item.data.status !== "done") return false;
      } else {
        if (item.data.status === "done") return false;
        if (status !== "all" && statusKey(item.data) !== status) return false;
      }
      if (priority !== "all" && item.data.priority !== priority) return false;
      if (managerFilter !== "all") {
        const owners = taskOwnerList(item.data).map((o) => String(o).toLowerCase());
        if (managerFilter === "__me__") {
          if (!meName || !owners.includes(meName)) return false;
        } else {
          if (!owners.includes(managerFilter.toLowerCase())) return false;
        }
      }
    } else {
      // Contacts don't have task-statuses; hide them when a task-only status pill is active.
      if (status !== "all") return false;
      if (priority !== "all") return false;
      if (managerFilter !== "all") return false;
    }

    if (!query) return true;
    if (item.kind === "task") {
      const ownersJoined = taskOwnerList(item.data).join(" ");
      return [item.data.title, ownersJoined, item.data.note].some((v) =>
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

function renderTaskRow(task, idx) {
  const due = dueState(task);
  const sKey = statusKey(task);
  const sLabel = STATUS_LABEL[sKey] || sKey;
  const hasNote = !!(task.note && task.note.trim());
  const dests = Array.isArray(task.destinations) ? task.destinations : [];
  const owners = taskOwnerList(task);
  const ownerCell = owners.length
    ? owners.map((o) => `<span class="todo-owner-chip">${escapeHtml(o)}</span>`).join(" ")
    : "—";
  const createdLabel = task.createdAt ? formatDate(task.createdAt) : "—";
  const imgThumb = task.imageExt
    ? `<a class="todo-img-thumb" href="/api/manager-dashboard/tasks/${escapeHtml(task.id)}/image" target="_blank" rel="noreferrer" title="Open reference image">
         <img src="/api/manager-dashboard/tasks/${escapeHtml(task.id)}/image" alt="" />
       </a>`
    : "";
  return `
    <tr class="todo-tr todo-tr--task">
      <td>${idx + 1}</td>
      <td class="todo-cell-title"><strong>${escapeHtml(task.title)}</strong>${imgThumb}</td>
      <td class="todo-cell-assigner">${escapeHtml(task.createdBy?.name || task.createdBy?.email || "—")}</td>
      <td class="todo-cell-owner">${ownerCell}</td>
      <td><span class="todo-badge priority-${escapeHtml(task.priority || "medium")}">${escapeHtml(task.priority || "medium")}</span></td>
      <td><span class="todo-badge status-${escapeHtml(sKey)}">${escapeHtml(sLabel)}</span></td>
      <td><span class="todo-due todo-due--${due.tone}">${escapeHtml(due.label)}${task.dueTime ? ` ${escapeHtml(task.dueTime)}` : ""}</span></td>
      <td class="todo-cell-created">${escapeHtml(createdLabel)}</td>
      <td class="todo-cell-dests">${dests.length ? dests.map((d) => `<span class="tourist-tag-chip">${escapeHtml(d)}</span>`).join(" ") : "—"}</td>
      <td>${hasNote ? `<button type="button" class="todo-note-btn" data-note-view="${escapeHtml(task.id)}" data-note-kind="task">See note</button>` : "—"}</td>
      <td class="todo-cell-actions">
        <details class="row-menu">
          <summary class="row-menu-trigger" aria-label="Task actions">⋯</summary>
          <div class="row-menu-popover">
            <button type="button" class="row-menu-item" data-task-edit="${escapeHtml(task.id)}">Edit</button>
            ${task.status !== "in-progress" && task.status !== "done" ? `<button type="button" class="row-menu-item" data-task-progress="${escapeHtml(task.id)}">Start</button>` : ""}
            ${task.status !== "done" ? `<button type="button" class="row-menu-item" data-task-done="${escapeHtml(task.id)}">Done</button>` : ""}
            ${task.status === "done" ? `<button type="button" class="row-menu-item" data-task-restore="${escapeHtml(task.id)}">Restore</button>` : ""}
            <button type="button" class="row-menu-item is-danger" data-task-delete="${escapeHtml(task.id)}">Delete</button>
          </div>
        </details>
      </td>
    </tr>
  `;
}

function renderContactRow(contact, idx) {
  const dests = Array.isArray(contact.destinations) ? contact.destinations : [];
  const hasNote = !!(contact.note && contact.note.trim());
  const createdLabel = contact.createdAt ? formatDate(contact.createdAt) : "—";
  return `
    <tr class="todo-tr todo-tr--contact">
      <td>${idx + 1}</td>
      <td class="todo-cell-title"><strong>${escapeHtml(contact.name)}</strong></td>
      <td class="todo-cell-assigner">${escapeHtml(contact.createdBy?.name || contact.createdBy?.email || "—")}</td>
      <td class="todo-cell-owner"><a href="tel:${escapeHtml(contact.phone)}">${escapeHtml(contact.phone)}</a></td>
      <td><span class="todo-badge contact-${escapeHtml(contact.type || "client")}">${escapeHtml(contact.type || "client")}</span></td>
      <td><span class="todo-badge status-${escapeHtml(contact.status || "new")}">${escapeHtml(contact.status || "new")}</span></td>
      <td>${contact.lastContacted ? escapeHtml(formatDate(contact.lastContacted)) : "—"}</td>
      <td class="todo-cell-created">${escapeHtml(createdLabel)}</td>
      <td class="todo-cell-dests">${dests.length ? dests.map((d) => `<span class="tourist-tag-chip">${escapeHtml(d)}</span>`).join(" ") : "—"}</td>
      <td>${hasNote ? `<button type="button" class="todo-note-btn" data-note-view="${escapeHtml(contact.id)}" data-note-kind="contact">See note</button>` : "—"}</td>
      <td class="todo-cell-actions">
        <details class="row-menu">
          <summary class="row-menu-trigger" aria-label="Contact actions">⋯</summary>
          <div class="row-menu-popover">
            <button type="button" class="row-menu-item" data-contact-edit="${escapeHtml(contact.id)}">Edit</button>
            <button type="button" class="row-menu-item" data-contact-priority="${escapeHtml(contact.id)}">${contact.status === "priority" ? "Warm" : "Priority"}</button>
            <button type="button" class="row-menu-item is-danger" data-contact-delete="${escapeHtml(contact.id)}">Delete</button>
          </div>
        </details>
      </td>
    </tr>
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

  const rows = items
    .map((item, idx) => (item.kind === "task" ? renderTaskRow(item.data, idx) : renderContactRow(item.data, idx)))
    .join("");

  // /contacts and /todo render the same table component but the "what is
  // this row about" columns differ. Pick the matching header set so each
  // page reads naturally on its own (no shared "Title / Name" headers).
  const route = window.location.pathname;
  const isContacts = route === "/contacts";
  const headerCells = isContacts
    ? `
        <th>#</th>
        <th>Name</th>
        <th>Manager</th>
        <th>Phone</th>
        <th>Type</th>
        <th>Status</th>
        <th>Last contacted</th>
        <th>Created</th>
        <th>Destinations</th>
        <th>Note</th>
        <th>Actions</th>
      `
    : `
        <th>#</th>
        <th>Title</th>
        <th>Created by</th>
        <th>Assigned to</th>
        <th>Priority</th>
        <th>Status</th>
        <th>Due</th>
        <th>Created</th>
        <th>Destinations</th>
        <th>Note</th>
        <th>Actions</th>
      `;

  todoList.innerHTML = `
    <div class="invoices-table-wrap">
      <table class="invoices-table todo-table">
        <thead>
          <tr>${headerCells}</tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
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
    const [payload, teamMembersPayload, mePayload] = await Promise.all([
      fetchJson("/api/manager-dashboard"),
      fetchJson("/api/team-members"),
      fetchJson("/api/auth/me").catch(() => null),
    ]);
    state.tasks = payload.tasks || [];
    state.contacts = payload.contacts || [];
    state.teamMembers = teamMembersPayload.entries || [];
    state.currentUser = mePayload?.user || null;
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
  const owners = getTaskManagerSelection();
  if (!owners.length) {
    setStatus(taskStatusNode, "Choose at least one manager.", true);
    return;
  }
  const taskId = taskForm.elements.id.value;
  const url = taskId ? `/api/manager-dashboard/tasks/${taskId}` : "/api/manager-dashboard/tasks";
  clearStatus(taskStatusNode);
  const formData = new FormData(taskForm);
  const payload = Object.fromEntries(formData.entries());
  payload.owners = owners;
  delete payload.owner;
  // The reference image goes via a separate multipart endpoint after the
  // task itself is saved — drop it from the JSON payload (FormData turns
  // an empty file input into "" anyway, which would clobber imageExt).
  delete payload.image;
  try {
    const result = await fetchJson(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const savedId = taskId || result?.task?.id;
    // Image follow-ups: upload a new file, or delete if user clicked Remove.
    if (savedId) {
      const file = taskImageInput?.files?.[0];
      if (file && state.taskImageDirty) {
        const fd = new FormData();
        fd.append("file", file);
        await fetch(`/api/manager-dashboard/tasks/${savedId}/image`, {
          method: "POST",
          body: fd,
        });
      } else if (state.taskImageRemoved) {
        await fetch(`/api/manager-dashboard/tasks/${savedId}/image`, { method: "DELETE" });
      }
    }
    resetTaskForm();
    setStatus(taskStatusNode, "Saved.");
    await loadDashboard();
    closePanel(taskFormPanel);
  } catch (error) {
    setStatus(taskStatusNode, error.message, true);
  }
});

contactForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const contactId = contactForm.elements.id.value;
  const url = contactId ? `/api/manager-dashboard/contacts/${contactId}` : "/api/manager-dashboard/contacts";
  const saved = await submitForm(contactForm, url, contactStatusNode, resetContactForm);
  if (saved) closePanel(contactFormPanel);
});

function showNoteModal(title, body) {
  const modal = document.getElementById("note-view-modal");
  if (!modal) return;
  modal.querySelector("[data-note-modal-title]").textContent = title;
  modal.querySelector("[data-note-modal-body]").textContent = body;
  modal.classList.remove("is-hidden");
  modal.removeAttribute("hidden");
  document.body.classList.add("modal-open");
}

function hideNoteModal() {
  const modal = document.getElementById("note-view-modal");
  if (!modal) return;
  modal.classList.add("is-hidden");
  modal.setAttribute("hidden", "");
  if (![taskFormPanel, contactFormPanel].some((p) => p && !p.classList.contains("is-hidden"))) {
    document.body.classList.remove("modal-open");
  }
}

document.getElementById("note-view-modal")?.addEventListener("click", (event) => {
  if (event.target.dataset.action === "close-note-modal") hideNoteModal();
});

todoList.addEventListener("click", async (event) => {
  const target = event.target;
  const noteView = target.closest("[data-note-view]");
  if (noteView) {
    const id = noteView.dataset.noteView;
    const kind = noteView.dataset.noteKind;
    const item = kind === "task"
      ? state.tasks.find((t) => t.id === id)
      : state.contacts.find((c) => c.id === id);
    if (!item) return;
    showNoteModal(item.title || item.name || "Note", item.note || "");
    return;
  }
  const taskEdit = target.closest("[data-task-edit]");
  const taskProgress = target.closest("[data-task-progress]");
  const taskDone = target.closest("[data-task-done]");
  const taskRestore = target.closest("[data-task-restore]");
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
    if (taskRestore) {
      await fetchJson(`/api/manager-dashboard/tasks/${taskRestore.dataset.taskRestore}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "todo" }),
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

[todoSearch, todoTypeFilter, todoManagerFilter, todoPriorityFilter].forEach((node) => {
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

todoList.addEventListener("toggle", (e) => {
  const det = e.target;
  if (!(det instanceof HTMLDetailsElement) || !det.classList.contains("row-menu")) return;
  if (!det.open) return;
  const trigger = det.querySelector("summary");
  const popover = det.querySelector(".row-menu-popover");
  if (!trigger || !popover) return;
  const rect = trigger.getBoundingClientRect();
  popover.style.left = "-9999px";
  popover.style.top = "0px";
  requestAnimationFrame(() => {
    const ph = popover.offsetHeight;
    const pw = popover.offsetWidth;
    const margin = 6;
    let top = rect.bottom + margin;
    if (top + ph > window.innerHeight - 8) top = Math.max(8, rect.top - ph - margin);
    let left = rect.right - pw;
    if (left < 8) left = 8;
    popover.style.top = `${top}px`;
    popover.style.left = `${left}px`;
  });
}, true);
document.addEventListener("click", (e) => {
  todoList.querySelectorAll("details.row-menu[open]").forEach((det) => {
    if (!det.contains(e.target)) det.removeAttribute("open");
  });
});

renderStatusPills();
loadDashboard();
if (window.DestinationsMulti) window.DestinationsMulti.attachAll(document);

// Refresh overdue countdowns every minute.
setInterval(renderList, 60 * 1000);

// Multi-manager sync: poll the dashboard every 15s so a task assigned by
// another manager appears without a page reload. Pauses when the tab is
// hidden or a form modal is open so we don't blow away typing.
setInterval(() => {
  if (document.visibilityState !== "visible") return;
  if (document.body.classList.contains("modal-open")) return;
  if (taskFormPanel && !taskFormPanel.classList.contains("is-hidden")) return;
  if (contactFormPanel && !contactFormPanel.classList.contains("is-hidden")) return;
  loadDashboard();
}, 15000);
