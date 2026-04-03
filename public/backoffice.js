const taskForm = document.querySelector("#task-form");
const reminderForm = document.querySelector("#reminder-form");
const contactForm = document.querySelector("#contact-form");

const taskList = document.querySelector("#task-list");
const reminderList = document.querySelector("#reminder-list");
const contactList = document.querySelector("#contact-list");

const taskStatusNode = document.querySelector("#task-status");
const reminderStatusNode = document.querySelector("#reminder-status");
const contactStatusNode = document.querySelector("#contact-status");

const summaryOpenTasks = document.querySelector("#summary-open-tasks");
const summaryTodayReminders = document.querySelector("#summary-today-reminders");
const summaryPriorityContacts = document.querySelector("#summary-priority-contacts");
const summaryDoneTasks = document.querySelector("#summary-done-tasks");

const filters = {
  taskSearch: document.querySelector("#task-search"),
  taskStatus: document.querySelector("#task-status-filter"),
  taskPriority: document.querySelector("#task-priority-filter"),
  reminderSearch: document.querySelector("#reminder-search"),
  reminderTiming: document.querySelector("#reminder-timing-filter"),
  reminderStatus: document.querySelector("#reminder-status-filter"),
  contactSearch: document.querySelector("#contact-search"),
  contactType: document.querySelector("#contact-type-filter"),
  contactStatus: document.querySelector("#contact-status-filter"),
};

const state = {
  tasks: [],
  reminders: [],
  contacts: [],
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
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString();
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
  summaryTodayReminders.textContent = state.summary.reminders?.today ?? 0;
  summaryPriorityContacts.textContent = state.summary.contacts?.priority ?? 0;
  summaryDoneTasks.textContent = state.summary.tasks?.done ?? 0;
}

function renderEmpty(node, message) {
  node.innerHTML = `<p class="empty">${message}</p>`;
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

function filteredReminders() {
  const query = filters.reminderSearch.value.trim().toLowerCase();
  const timing = filters.reminderTiming.value;
  const status = filters.reminderStatus.value;

  return [...state.reminders]
    .filter((reminder) => {
      if (status !== "all" && reminder.status !== status) {
        return false;
      }
      if (timing !== "all" && reminderTiming(reminder) !== timing) {
        return false;
      }
      if (!query) {
        return true;
      }
      return [reminder.title, reminder.audience, reminder.note].some((value) =>
        String(value || "").toLowerCase().includes(query)
      );
    })
    .sort((a, b) => String(a.reminderDate || "").localeCompare(String(b.reminderDate || "")));
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
      return [contact.name, contact.company, contact.phone, contact.note].some((value) =>
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
          <th>Owner</th>
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

function renderReminders() {
  const reminders = filteredReminders();
  if (!reminders.length) {
    renderEmpty(reminderList, "No reminders match these filters yet.");
    return;
  }

  reminderList.innerHTML = `
    <table class="manager-table">
      <thead>
        <tr>
          <th>Reminder</th>
          <th>Audience</th>
          <th>Status</th>
          <th>Timing</th>
          <th>Date</th>
          <th>Note</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        ${reminders
          .map(
            (reminder) => `
              <tr>
                <td>${escapeHtml(reminder.title)}</td>
                <td>${escapeHtml(reminder.audience || "-")}</td>
                <td><span class="manager-badge status-${escapeHtml(reminder.status)}">${escapeHtml(reminder.status)}</span></td>
                <td><span class="manager-badge timing-${escapeHtml(reminderTiming(reminder))}">${escapeHtml(reminderTiming(reminder))}</span></td>
                <td>${escapeHtml(formatDateTime(reminder.reminderDate))}</td>
                <td>${escapeHtml(reminder.note || "-")}</td>
                <td>
                  <div class="manager-inline-actions manager-inline-actions-compact">
                    <button type="button" data-reminder-toggle="${reminder.id}">
                      ${reminder.status === "done" ? "Reopen" : "Done"}
                    </button>
                    <button type="button" data-reminder-delete="${reminder.id}" class="button-secondary">Delete</button>
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
          <th>Company</th>
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
                <td>${escapeHtml(contact.company || "-")}</td>
                <td><span class="manager-badge contact-${escapeHtml(contact.type)}">${escapeHtml(contact.type)}</span></td>
                <td><span class="manager-badge status-${escapeHtml(contact.status)}">${escapeHtml(contact.status)}</span></td>
                <td>${escapeHtml(formatDate(contact.lastContacted))}</td>
                <td>${escapeHtml(contact.note || "-")}</td>
                <td>
                  <div class="manager-inline-actions manager-inline-actions-compact">
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
  renderReminders();
  renderContacts();
}

async function loadDashboard() {
  taskList.innerHTML = '<p class="empty">Loading tasks...</p>';
  reminderList.innerHTML = '<p class="empty">Loading reminders...</p>';
  contactList.innerHTML = '<p class="empty">Loading contacts...</p>';

  try {
    const payload = await fetchJson("/api/manager-dashboard");
    state.tasks = payload.tasks || [];
    state.reminders = payload.reminders || [];
    state.contacts = payload.contacts || [];
    applySummary(payload.summary || {});
    renderAll();
  } catch (error) {
    renderEmpty(taskList, error.message);
    renderEmpty(reminderList, error.message);
    renderEmpty(contactList, error.message);
  }
}

async function submitForm(form, url, statusNode) {
  clearStatus(statusNode);
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());
  try {
    await fetchJson(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    form.reset();
    setStatus(statusNode, "Saved.");
    await loadDashboard();
  } catch (error) {
    setStatus(statusNode, error.message, true);
  }
}

taskForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await submitForm(taskForm, "/api/manager-dashboard/tasks", taskStatusNode);
});

reminderForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await submitForm(reminderForm, "/api/manager-dashboard/reminders", reminderStatusNode);
});

contactForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await submitForm(contactForm, "/api/manager-dashboard/contacts", contactStatusNode);
});

taskList.addEventListener("click", async (event) => {
  const taskProgressButton = event.target.closest("[data-task-progress]");
  const taskDoneButton = event.target.closest("[data-task-done]");
  const taskDeleteButton = event.target.closest("[data-task-delete]");

  try {
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

reminderList.addEventListener("click", async (event) => {
  const toggleButton = event.target.closest("[data-reminder-toggle]");
  const deleteButton = event.target.closest("[data-reminder-delete]");

  try {
    if (toggleButton) {
      const reminder = state.reminders.find((item) => item.id === toggleButton.dataset.reminderToggle);
      const nextStatus = reminder?.status === "done" ? "active" : "done";
      await fetchJson(`/api/manager-dashboard/reminders/${toggleButton.dataset.reminderToggle}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      await loadDashboard();
      return;
    }
    if (deleteButton) {
      await fetchJson(`/api/manager-dashboard/reminders/${deleteButton.dataset.reminderDelete}`, {
        method: "DELETE",
      });
      await loadDashboard();
    }
  } catch (error) {
    setStatus(reminderStatusNode, error.message, true);
  }
});

contactList.addEventListener("click", async (event) => {
  const priorityButton = event.target.closest("[data-contact-priority]");
  const deleteButton = event.target.closest("[data-contact-delete]");

  try {
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

Object.values(filters).forEach((node) => {
  node.addEventListener("input", renderAll);
  node.addEventListener("change", renderAll);
});

loadDashboard();
