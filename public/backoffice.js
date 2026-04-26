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

const taskList = document.querySelector("#task-list");
const contactList = document.querySelector("#contact-list");

const taskStatusNode = document.querySelector("#task-status");
const contactStatusNode = document.querySelector("#contact-status");

const summaryOpenTasks = document.querySelector("#summary-open-tasks");
const summaryPriorityContacts = document.querySelector("#summary-priority-contacts");
const summaryTotalContacts = document.querySelector("#summary-total-contacts");
const summaryDoneTasks = document.querySelector("#summary-done-tasks");

const filters = {
  taskSearch: document.querySelector("#task-search"),
  taskStatus: document.querySelector("#task-status-filter"),
  taskPriority: document.querySelector("#task-priority-filter"),
  contactSearch: document.querySelector("#contact-search"),
  contactType: document.querySelector("#contact-type-filter"),
  contactStatus: document.querySelector("#contact-status-filter"),
};

const state = {
  tasks: [],
  reminders: [],
  contacts: [],
  teamMembers: [],
  editingTaskId: "",
  editingContactId: "",
  summary: {
    tasks: { open: 0, done: 0 },
    reminders: { today: 0 },
    contacts: { priority: 0 },
  },
};

function setStatus(node, message, isError = false) {
  if (!node) {
    return;
  }
  node.textContent = message;
  node.dataset.tone = isError ? "error" : "ok";
}

function clearStatus(node) {
  if (!node) {
    return;
  }
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
  if (!value) {
    return "-";
  }
  // Standardize on ISO yyyy-mm-dd everywhere across DTX + USM.
  const iso = String(value).split("T")[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, "0");
  const d = String(parsed.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDateTime(value) {
  if (!value) {
    return "-";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value.replace("T", " ");
  }
  return parsed.toLocaleString();
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function reminderTiming(reminder) {
  const dateKey = String(reminder.reminderDate || "").slice(0, 10);
  if (!dateKey) {
    return "unscheduled";
  }
  if (dateKey === todayKey()) {
    return "today";
  }
  if (dateKey < todayKey()) {
    return "overdue";
  }
  return "upcoming";
}

function applySummary(summary) {
  state.summary = summary || state.summary;
  summaryOpenTasks.textContent = state.summary.tasks?.open ?? 0;
  summaryPriorityContacts.textContent = state.summary.contacts?.priority ?? 0;
  summaryTotalContacts.textContent = state.summary.contacts?.total ?? 0;
  summaryDoneTasks.textContent = state.summary.tasks?.done ?? 0;
}

function renderEmpty(node, message) {
  node.innerHTML = `<p class="empty">${message}</p>`;
}

function renderManagerOptions() {
  if (!taskManagerSelect) {
    return;
  }
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
  if (!panel) {
    return;
  }
  panel.classList.remove("is-hidden");
  panel.removeAttribute("hidden");
  syncBodyModalState();
  panel.scrollTop = 0;
  const dialog = panel.querySelector(".camp-modal-dialog");
  if (dialog) {
    dialog.scrollTop = 0;
  }
}

function closePanel(panel) {
  if (!panel) {
    return;
  }
  panel.classList.add("is-hidden");
  panel.setAttribute("hidden", "");
  syncBodyModalState();
}

function startTaskEdit(taskId) {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) {
    return;
  }
  state.editingTaskId = taskId;
  taskForm.elements.id.value = task.id;
  taskForm.elements.title.value = task.title || "";
  taskForm.elements.owner.value = task.owner || "";
  taskForm.elements.priority.value = task.priority || "medium";
  taskForm.elements.dueDate.value = task.dueDate || "";
  taskForm.elements.note.value = task.note || "";
  taskSubmitButton.textContent = "Update task";
  setStatus(taskStatusNode, "Editing task.");
  openPanel(taskFormPanel);
}

function startContactEdit(contactId) {
  const contact = state.contacts.find((item) => item.id === contactId);
  if (!contact) {
    return;
  }
  state.editingContactId = contactId;
  contactForm.elements.id.value = contact.id;
  contactForm.elements.name.value = contact.name || "";
  contactForm.elements.phone.value = contact.phone || "";
  contactForm.elements.type.value = contact.type || "client";
  contactForm.elements.status.value = contact.status || "priority";
  contactForm.elements.lastContacted.value = contact.lastContacted || "";
  contactForm.elements.note.value = contact.note || "";
  contactSubmitButton.textContent = "Update contact";
  setStatus(contactStatusNode, "Editing contact.");
  openPanel(contactFormPanel);
}

function filteredTasks() {
  const query = filters.taskSearch.value.trim().toLowerCase();
  const status = filters.taskStatus.value;
  const priority = filters.taskPriority.value;

  return [...state.tasks]
    .filter((task) => {
      if (status !== "all" && task.status !== status) {
        return false;
      }
      if (priority !== "all" && task.priority !== priority) {
        return false;
      }
      if (!query) {
        return true;
      }
      return [task.title, task.owner, task.note].some((value) =>
        String(value || "").toLowerCase().includes(query)
      );
    })
    .sort((a, b) => {
      if (a.status === "done" && b.status !== "done") {
        return 1;
      }
      if (a.status !== "done" && b.status === "done") {
        return -1;
      }
      return String(a.dueDate || "").localeCompare(String(b.dueDate || ""));
    });
}

function filteredContacts() {
  const query = filters.contactSearch.value.trim().toLowerCase();
  const type = filters.contactType.value;
  const status = filters.contactStatus.value;

  return [...state.contacts]
    .filter((contact) => {
      if (type !== "all" && contact.type !== type) {
        return false;
      }
      if (status !== "all" && contact.status !== status) {
        return false;
      }
      if (!query) {
      return true;
      }
      return [contact.name, contact.phone, contact.note].some((value) =>
        String(value || "").toLowerCase().includes(query)
      );
    })
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
}

function renderTasks() {
  const tasks = filteredTasks();
  if (!tasks.length) {
    renderEmpty(taskList, "No tasks match these filters yet.");
    return;
  }

  taskList.innerHTML = `
    <table class="manager-table">
      <thead>
        <tr>
          <th>Task</th>
          <th>Manager</th>
          <th>Priority</th>
          <th>Status</th>
          <th>Due</th>
          <th>Note</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        ${tasks
          .map(
            (task) => `
              <tr>
                <td>${escapeHtml(task.title)}</td>
                <td>${escapeHtml(task.owner || "-")}</td>
                <td><span class="manager-badge priority-${escapeHtml(task.priority)}">${escapeHtml(task.priority)}</span></td>
                <td><span class="manager-badge status-${escapeHtml(task.status)}">${escapeHtml(task.status)}</span></td>
                <td>${escapeHtml(formatDate(task.dueDate))}</td>
                <td>${escapeHtml(task.note || "-")}</td>
                <td>
                  <div class="manager-inline-actions manager-inline-actions-compact">
                    <button type="button" data-task-edit="${task.id}">Edit</button>
                    <button type="button" data-task-progress="${task.id}">Start</button>
                    <button type="button" data-task-done="${task.id}">Done</button>
                    <button type="button" data-task-delete="${task.id}" class="button-secondary">Delete</button>
                  </div>
                </td>
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function renderContacts() {
  const contacts = filteredContacts();
  if (!contacts.length) {
    renderEmpty(contactList, "No contacts match these filters yet.");
    return;
  }

  contactList.innerHTML = `
    <table class="manager-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Phone</th>
          <th>Type</th>
          <th>Status</th>
          <th>Last Contacted</th>
          <th>Note</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        ${contacts
          .map(
            (contact) => `
              <tr>
                <td>${escapeHtml(contact.name)}</td>
                <td><a href="tel:${escapeHtml(contact.phone)}">${escapeHtml(contact.phone)}</a></td>
                <td><span class="manager-badge contact-${escapeHtml(contact.type)}">${escapeHtml(contact.type)}</span></td>
                <td><span class="manager-badge status-${escapeHtml(contact.status)}">${escapeHtml(contact.status)}</span></td>
                <td>${escapeHtml(formatDate(contact.lastContacted))}</td>
                <td>${escapeHtml(contact.note || "-")}</td>
                <td>
                  <div class="manager-inline-actions manager-inline-actions-compact">
                    <button type="button" data-contact-edit="${contact.id}">Edit</button>
                    <button type="button" data-contact-priority="${contact.id}">
                      ${contact.status === "priority" ? "Warm" : "Priority"}
                    </button>
                    <button type="button" data-contact-delete="${contact.id}" class="button-secondary">Delete</button>
                  </div>
                </td>
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function renderAll() {
  renderTasks();
  renderContacts();
}

async function loadDashboard() {
  taskList.innerHTML = '<p class="empty">Loading tasks...</p>';
  contactList.innerHTML = '<p class="empty">Loading contacts...</p>';

  try {
    const [payload, teamMembersPayload] = await Promise.all([
      fetchJson("/api/manager-dashboard"),
      fetchJson("/api/team-members"),
    ]);
    state.tasks = payload.tasks || [];
    state.reminders = payload.reminders || [];
    state.contacts = payload.contacts || [];
    state.teamMembers = teamMembersPayload.entries || [];
    applySummary(payload.summary || {});
    renderManagerOptions();
    renderAll();
  } catch (error) {
    renderEmpty(taskList, error.message);
    renderEmpty(contactList, error.message);
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
  if (saved) {
    closePanel(taskFormPanel);
  }
});

contactForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const contactId = contactForm.elements.id.value;
  const url = contactId ? `/api/manager-dashboard/contacts/${contactId}` : "/api/manager-dashboard/contacts";
  const saved = await submitForm(contactForm, url, contactStatusNode, resetContactForm);
  if (saved) {
    closePanel(contactFormPanel);
  }
});

taskList.addEventListener("click", async (event) => {
  const taskEditButton = event.target.closest("[data-task-edit]");
  const taskProgressButton = event.target.closest("[data-task-progress]");
  const taskDoneButton = event.target.closest("[data-task-done]");
  const taskDeleteButton = event.target.closest("[data-task-delete]");

  try {
    if (taskEditButton) {
      startTaskEdit(taskEditButton.dataset.taskEdit);
      return;
    }
    if (taskProgressButton) {
      await fetchJson(`/api/manager-dashboard/tasks/${taskProgressButton.dataset.taskProgress}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "in-progress" }),
      });
      await loadDashboard();
      return;
    }
    if (taskDoneButton) {
      await fetchJson(`/api/manager-dashboard/tasks/${taskDoneButton.dataset.taskDone}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "done" }),
      });
      await loadDashboard();
      return;
    }
    if (taskDeleteButton) {
      await fetchJson(`/api/manager-dashboard/tasks/${taskDeleteButton.dataset.taskDelete}`, {
        method: "DELETE",
      });
      await loadDashboard();
    }
  } catch (error) {
    setStatus(taskStatusNode, error.message, true);
  }
});

contactList.addEventListener("click", async (event) => {
  const editButton = event.target.closest("[data-contact-edit]");
  const priorityButton = event.target.closest("[data-contact-priority]");
  const deleteButton = event.target.closest("[data-contact-delete]");

  try {
    if (editButton) {
      startContactEdit(editButton.dataset.contactEdit);
      return;
    }
    if (priorityButton) {
      const contact = state.contacts.find((item) => item.id === priorityButton.dataset.contactPriority);
      const nextStatus = contact?.status === "priority" ? "warm" : "priority";
      await fetchJson(`/api/manager-dashboard/contacts/${priorityButton.dataset.contactPriority}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      await loadDashboard();
      return;
    }
    if (deleteButton) {
      await fetchJson(`/api/manager-dashboard/contacts/${deleteButton.dataset.contactDelete}`, {
        method: "DELETE",
      });
      await loadDashboard();
    }
  } catch (error) {
    setStatus(contactStatusNode, error.message, true);
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

Object.values(filters).forEach((node) => {
  node.addEventListener("input", renderAll);
  node.addEventListener("change", renderAll);
});

loadDashboard();
