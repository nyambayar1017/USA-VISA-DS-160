const submissionList = document.querySelector("#submission-list");
const userList = document.querySelector("#user-list");
const refreshButton = document.querySelector("#refresh-button");
const usersRefreshButton = document.querySelector("#users-refresh-button");
const exportButton = document.querySelector("#export-button");
const logoutButton = document.querySelector("#logout-button");

const CSV_COLUMNS = [
  "createdAt",
  "surname",
  "givenName",
  "email",
  "primaryPhone",
  "dateOfBirth",
  "birthCity",
  "birthCountry",
  "nationality",
  "maritalStatus",
  "passportNumber",
  "passportIssueDate",
  "passportExpiryDate",
  "tripPurposeCategory",
  "intendedArrivalDate",
  "notes",
];

let currentSubmissions = [];
let currentUsers = [];
let userPage = 1;
let submissionPage = 1;
const PAGE_SIZE = 20;

function renderValue(label, value) {
  return `
    <div class="detail">
      <span>${label}</span>
      <strong>${value || "-"}</strong>
    </div>
  `;
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data;
}

function renderPagination(total, page, kind) {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const start = total ? (page - 1) * PAGE_SIZE + 1 : 0;
  const end = total ? Math.min(total, page * PAGE_SIZE) : 0;
  return `
    <div class="table-pagination mini-pagination">
      <p>Showing ${start}-${end} of ${total}</p>
      <div class="pagination-actions">
        <button type="button" data-action="${kind}-prev" ${page === 1 ? "disabled" : ""}>Previous</button>
        <button type="button" data-action="${kind}-next" ${page === totalPages ? "disabled" : ""}>Next</button>
      </div>
    </div>
  `;
}

function renderUsers(users) {
  currentUsers = users;
  if (!users.length) {
    userList.innerHTML = '<p class="empty">No users yet.</p>';
    return;
  }

  const totalPages = Math.max(1, Math.ceil(users.length / PAGE_SIZE));
  userPage = Math.min(userPage, totalPages);
  const startIndex = (userPage - 1) * PAGE_SIZE;
  const visibleUsers = users.slice(startIndex, startIndex + PAGE_SIZE);

  userList.innerHTML =
    visibleUsers
    .map(
      (user) => `
        <article class="submission-card">
          <div class="submission-top">
            <div>
              <h3>${user.fullName || user.email}</h3>
              <p>${user.email}</p>
            </div>
            <time>${user.status}</time>
          </div>
          <div class="details-grid">
            ${renderValue("Role", user.role)}
            ${renderValue("Status", user.status)}
            ${renderValue("Created", user.createdAt ? new Date(user.createdAt).toLocaleString() : "-")}
            ${renderValue("Approved", user.approvedAt ? new Date(user.approvedAt).toLocaleString() : "-")}
            ${renderValue("Reset request", user.resetRequestedAt ? new Date(user.resetRequestedAt).toLocaleString() : "-")}
          </div>
          <div class="dashboard-actions card-actions">
            <button type="button" data-status="approved" data-id="${user.id}">Approve</button>
            <button type="button" data-status="rejected" data-id="${user.id}">Reject</button>
            <button type="button" data-role="admin" data-id="${user.id}">Make Admin</button>
            <button type="button" data-reset-password="true" data-id="${user.id}">Set Password</button>
          </div>
        </article>
      `
    )
    .join("") + renderPagination(users.length, userPage, "users");
}

function renderSubmissions(submissions) {
  currentSubmissions = submissions;
  if (!submissions.length) {
    submissionList.innerHTML = '<p class="empty">No submissions yet.</p>';
    return;
  }

  const totalPages = Math.max(1, Math.ceil(submissions.length / PAGE_SIZE));
  submissionPage = Math.min(submissionPage, totalPages);
  const startIndex = (submissionPage - 1) * PAGE_SIZE;
  const visibleSubmissions = submissions.slice(startIndex, startIndex + PAGE_SIZE);

  submissionList.innerHTML =
    visibleSubmissions
    .map(
      (entry) => `
        <article class="submission-card">
          <div class="submission-top">
            <div>
              <h3>${entry.surname || ""} ${entry.givenName || ""}</h3>
              <p>${entry.email || "-"}</p>
            </div>
            <time>${new Date(entry.createdAt).toLocaleString()}</time>
          </div>
          <div class="details-grid">
            ${renderValue("Phone", entry.primaryPhone)}
            ${renderValue("DOB", entry.dateOfBirth)}
            ${renderValue("Birth city", entry.birthCity)}
            ${renderValue("Birth country", entry.birthCountry)}
            ${renderValue("Nationality", entry.nationality)}
            ${renderValue("Marital status", entry.maritalStatus)}
            ${renderValue("Passport no.", entry.passportNumber)}
            ${renderValue("Issue date", entry.passportIssueDate)}
            ${renderValue("Expiry date", entry.passportExpiryDate)}
            ${renderValue("Visa category", entry.tripPurposeCategory)}
            ${renderValue("Arrival date", entry.intendedArrivalDate)}
            ${renderValue("Notes", entry.notes)}
          </div>
        </article>
      `
    )
    .join("") + renderPagination(submissions.length, submissionPage, "submissions");
}

async function loadUsers() {
  userList.innerHTML = '<p class="empty">Loading users...</p>';
  try {
    const payload = await fetchJson("/api/users");
    renderUsers(payload.entries);
  } catch (error) {
    userList.innerHTML = `<p class="empty">${error.message}</p>`;
  }
}

async function loadSubmissions() {
  submissionList.innerHTML = '<p class="empty">Loading submissions...</p>';
  try {
    const submissions = await fetchJson("/api/ds160");
    renderSubmissions(submissions);
  } catch (error) {
    submissionList.innerHTML = `<p class="empty">${error.message}</p>`;
  }
}

function exportCsv() {
  if (!currentSubmissions.length) {
    submissionList.innerHTML = '<p class="empty">No submissions to export yet.</p>';
    return;
  }

  const rows = [
    CSV_COLUMNS.join(","),
    ...currentSubmissions.map((entry) =>
      CSV_COLUMNS.map((column) => {
        const value = String(entry[column] || "").replaceAll('"', '""');
        return `"${value}"`;
      }).join(",")
    ),
  ];

  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "visa-submissions.csv";
  link.click();
  URL.revokeObjectURL(url);
}

userList.addEventListener("click", async (event) => {
  const paginationTarget = event.target.closest("[data-action]");
  if (paginationTarget?.dataset.action === "users-prev") {
    userPage = Math.max(1, userPage - 1);
    renderUsers(currentUsers);
    return;
  }
  if (paginationTarget?.dataset.action === "users-next") {
    const totalPages = Math.max(1, Math.ceil(currentUsers.length / PAGE_SIZE));
    userPage = Math.min(totalPages, userPage + 1);
    renderUsers(currentUsers);
    return;
  }

  const button = event.target.closest("button[data-id]");
  if (!button) {
    return;
  }
  const payload = {};
  if (button.dataset.resetPassword) {
    const nextPassword = window.prompt("Enter the new password for this user:");
    if (!nextPassword) {
      return;
    }
    payload.password = nextPassword;
  }
  if (button.dataset.status) {
    payload.status = button.dataset.status;
  }
  if (button.dataset.role) {
    payload.role = button.dataset.role;
    payload.status = "approved";
  }
  try {
    await fetchJson(`/api/users/${button.dataset.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    loadUsers();
  } catch (error) {
    userList.insertAdjacentHTML("afterbegin", `<p class="empty">${error.message}</p>`);
  }
});

submissionList.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) {
    return;
  }
  if (target.dataset.action === "submissions-prev") {
    submissionPage = Math.max(1, submissionPage - 1);
    renderSubmissions(currentSubmissions);
    return;
  }
  if (target.dataset.action === "submissions-next") {
    const totalPages = Math.max(1, Math.ceil(currentSubmissions.length / PAGE_SIZE));
    submissionPage = Math.min(totalPages, submissionPage + 1);
    renderSubmissions(currentSubmissions);
  }
});

logoutButton.addEventListener("click", async () => {
  await fetchJson("/api/auth/logout", { method: "POST" });
  window.location.href = "/login";
});

refreshButton.addEventListener("click", loadSubmissions);
usersRefreshButton.addEventListener("click", loadUsers);
exportButton.addEventListener("click", exportCsv);

loadUsers();
loadSubmissions();
