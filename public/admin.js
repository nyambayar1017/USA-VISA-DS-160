const submissionList = document.querySelector("#submission-list");
const refreshButton = document.querySelector("#refresh-button");
const exportButton = document.querySelector("#export-button");
const tokenInput = document.querySelector("#admin-token");

const CSV_COLUMNS = [
  "createdAt",
  "fullName",
  "email",
  "phone",
  "dateOfBirth",
  "placeOfBirth",
  "nationality",
  "maritalStatus",
  "homeAddress",
  "passportNumber",
  "passportCountry",
  "passportIssueDate",
  "passportExpiryDate",
  "visaType",
  "travelDate",
  "arrivalCity",
  "lengthOfStay",
  "usStayAddress",
  "tripPurpose",
  "usContactName",
  "usContactPhone",
  "usContactAddress",
  "employerOrSchool",
  "jobTitle",
  "workAddress",
  "workDescription",
  "notes",
];

let currentSubmissions = [];

function renderValue(label, value) {
  return `
    <div class="detail">
      <span>${label}</span>
      <strong>${value || "-"}</strong>
    </div>
  `;
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
              <h3>${entry.fullName}</h3>
              <p>${entry.email}</p>
            </div>
            <time>${new Date(entry.createdAt).toLocaleString()}</time>
          </div>
          <div class="details-grid">
            ${renderValue("Phone", entry.phone)}
            ${renderValue("DOB", entry.dateOfBirth)}
            ${renderValue("Birth place", entry.placeOfBirth)}
            ${renderValue("Nationality", entry.nationality)}
            ${renderValue("Marital status", entry.maritalStatus)}
            ${renderValue("Home address", entry.homeAddress)}
            ${renderValue("Passport no.", entry.passportNumber)}
            ${renderValue("Passport country", entry.passportCountry)}
            ${renderValue("Issue date", entry.passportIssueDate)}
            ${renderValue("Expiry date", entry.passportExpiryDate)}
            ${renderValue("Visa type", entry.visaType)}
            ${renderValue("Travel date", entry.travelDate)}
            ${renderValue("Arrival city", entry.arrivalCity)}
            ${renderValue("Length of stay", entry.lengthOfStay)}
            ${renderValue("U.S. stay address", entry.usStayAddress)}
            ${renderValue("Trip purpose", entry.tripPurpose)}
            ${renderValue("U.S. contact", entry.usContactName)}
            ${renderValue("U.S. contact phone", entry.usContactPhone)}
            ${renderValue("U.S. contact address", entry.usContactAddress)}
            ${renderValue("Employer or school", entry.employerOrSchool)}
            ${renderValue("Job title", entry.jobTitle)}
            ${renderValue("Work address", entry.workAddress)}
            ${renderValue("Work details", entry.workDescription)}
            ${renderValue("Notes", entry.notes)}
          </div>
        </article>
      `
    )
    .join("");
}

async function loadSubmissions() {
  submissionList.innerHTML = '<p class="empty">Loading submissions...</p>';
  const token = tokenInput.value.trim();

  if (!token) {
    submissionList.innerHTML = '<p class="empty">Enter your admin token first.</p>';
    return;
  }

  try {
    const response = await fetch(`/api/submissions?token=${encodeURIComponent(token)}`);

    if (response.status === 401) {
      submissionList.innerHTML = '<p class="empty">Incorrect admin token.</p>';
      return;
    }

    const submissions = await response.json();
    renderSubmissions(submissions);
  } catch (error) {
    submissionList.innerHTML = '<p class="empty">Could not load submissions.</p>';
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

refreshButton.addEventListener("click", loadSubmissions);
exportButton.addEventListener("click", exportCsv);
tokenInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    loadSubmissions();
  }
});
