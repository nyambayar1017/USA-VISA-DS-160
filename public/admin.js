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

function renderUsers(users) {
  currentUsers = users;
  if (!users.length) {
    userList.innerHTML = '<p class="empty">No users yet.</p>';
    return;
  }

  userList.innerHTML = users
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
          </div>
          <div class="dashboard-actions card-actions">
            <button type="button" data-status="approved" data-id="${user.id}">Approve</button>
            <button type="button" data-status="rejected" data-id="${user.id}">Reject</button>
            <button type="button" data-role="admin" data-id="${user.id}">Make Admin</button>
          </div>
        </article>
      `
    )
    .join("");
}

function renderSubmissions(submissions) {
  currentSubmissions = submissions;
  if (!submissions.length) {
    submissionList.innerHTML = '<p class="empty">No submissions yet.</p>';
    return;
  }

  submissionList.innerHTML = submissions
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
    .join("");
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
  const button = event.target.closest("button[data-id]");
  if (!button) {
    return;
  }
  const payload = {};
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

logoutButton.addEventListener("click", async () => {
  await fetchJson("/api/auth/logout", { method: "POST" });
  window.location.href = "/login";
});

refreshButton.addEventListener("click", loadSubmissions);
usersRefreshButton.addEventListener("click", loadUsers);
exportButton.addEventListener("click", exportCsv);

loadUsers();
loadSubmissions();
