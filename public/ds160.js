const sendForm = document.querySelector("#ds160-send-form");
const sendStatus = document.querySelector("#ds160-send-status");
const listNode = document.querySelector("#ds160-list");
const detailNode = document.querySelector("#ds160-detail");
const latestLinkCard = document.querySelector("#ds160-latest-link");
const shareLinkNode = document.querySelector("#ds160-share-link");
const copyLinkButton = document.querySelector("#ds160-copy-link");
const emailLinkButton = document.querySelector("#ds160-email-link");
const openLinkButton = document.querySelector("#ds160-open-link");
const managerSelect = document.querySelector("#ds160-manager-select");
const managerFilter = document.querySelector("#ds160-manager-filter");
const searchInput = document.querySelector("#ds160-search");
const statusFilter = document.querySelector("#ds160-status-filter");

const summaryTotal = document.querySelector("#ds160-summary-total");
const summarySent = document.querySelector("#ds160-summary-sent");
const summarySubmitted = document.querySelector("#ds160-summary-submitted");
const summaryManagers = document.querySelector("#ds160-summary-managers");

const state = {
  entries: [],
  teamMembers: [],
  selectedId: "",
  latestLink: "",
  latestEmail: "",
  latestName: "",
};

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatDateTime(value) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data;
}

function setStatus(message, isError = false) {
  sendStatus.textContent = message;
  sendStatus.dataset.tone = isError ? "error" : "ok";
}

function buildMailtoLink(email, name, url) {
  const subject = encodeURIComponent("TravelX DS-160 form");
  const body = encodeURIComponent(
    `Сайн байна уу${name ? ` ${name}` : ""},\n\nТа доорх холбоосоор DS-160 маягтаа бөглөнө үү.\n\n${url}\n\nБаярлалаа.\nTravelX`
  );
  return email ? `mailto:${encodeURIComponent(email)}?subject=${subject}&body=${body}` : "#";
}

function setLatestLink(url, email = "", name = "") {
  state.latestLink = url || "";
  state.latestEmail = email || "";
  state.latestName = name || "";
  if (!url) {
    latestLinkCard.classList.add("is-hidden");
    latestLinkCard.setAttribute("hidden", "");
    shareLinkNode.removeAttribute("href");
    shareLinkNode.textContent = "";
    emailLinkButton?.setAttribute("href", "#");
    return;
  }
  latestLinkCard.classList.remove("is-hidden");
  latestLinkCard.removeAttribute("hidden");
  shareLinkNode.href = url;
  shareLinkNode.textContent = url;
  if (emailLinkButton) {
    emailLinkButton.href = buildMailtoLink(email, name, url);
  }
}

function statusLabel(status) {
  if (status === "submitted") return "Submitted";
  return "Sent";
}

function statusClass(status) {
  return status === "submitted" ? "is-confirmed" : "is-pending";
}

function filteredEntries() {
  const query = String(searchInput.value || "").trim().toLowerCase();
  const status = statusFilter.value;
  const manager = managerFilter.value;

  return state.entries.filter((entry) => {
    if (status !== "all" && entry.status !== status) return false;
    if (manager && entry.managerName !== manager) return false;
    if (!query) return true;
    return [
      entry.clientName,
      entry.clientEmail,
      entry.clientPhone,
      entry.managerName,
      entry.passportNumber,
      entry.applicantName,
    ].some((value) => String(value || "").toLowerCase().includes(query));
  });
}

function renderSummary() {
  summaryTotal.textContent = String(state.entries.length);
  summarySent.textContent = String(state.entries.filter((entry) => entry.status === "sent").length);
  summarySubmitted.textContent = String(state.entries.filter((entry) => entry.status === "submitted").length);
  summaryManagers.textContent = String(state.teamMembers.length);
}

function renderManagerOptions() {
  const members = state.teamMembers.length
    ? state.teamMembers
    : [{ fullName: currentProfile?.fullName || currentProfile?.email || "Current user" }];

  managerSelect.innerHTML = members
    .map((member) => `<option value="${escapeHtml(member.fullName)}">${escapeHtml(member.fullName)}</option>`)
    .join("");
  if (currentProfile?.fullName && members.some((member) => member.fullName === currentProfile.fullName)) {
    managerSelect.value = currentProfile.fullName;
  }

  const uniqueManagers = Array.from(
    new Set(state.entries.map((entry) => entry.managerName).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));
  const currentValue = managerFilter.value;
  managerFilter.innerHTML = `<option value="">All</option>${uniqueManagers
    .map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`)
    .join("")}`;
  managerFilter.value = uniqueManagers.includes(currentValue) ? currentValue : "";
}

function renderList() {
  const entries = filteredEntries();
  if (!entries.length) {
    listNode.innerHTML = '<p class="empty">No DS-160 forms match these filters yet.</p>';
    detailNode.innerHTML = '<p class="empty">Choose a DS-160 record from the list to view it here.</p>';
    return;
  }

  if (!entries.some((entry) => entry.id === state.selectedId)) {
    state.selectedId = entries[0].id;
  }

  listNode.innerHTML = `
    <table class="manager-table ds160-table">
      <thead>
        <tr>
          <th>Client</th>
          <th>Manager</th>
          <th>Status</th>
          <th>Submitted</th>
          <th>Passport</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        ${entries
          .map(
            (entry) => `
              <tr data-open-id="${entry.id}" class="${entry.id === state.selectedId ? "is-selected" : ""}">
                <td>
                  <strong>${escapeHtml(entry.clientName || entry.applicantName || "-")}</strong>
                  <div class="table-subline">${escapeHtml(entry.clientEmail || "-")}</div>
                </td>
                <td>${escapeHtml(entry.managerName || "-")}</td>
                <td><span class="status-pill ${statusClass(entry.status)}">${statusLabel(entry.status)}</span></td>
                <td>${escapeHtml(formatDateTime(entry.submittedAt || entry.updatedAt || entry.createdAt))}</td>
                <td>${escapeHtml(entry.passportNumber || "-")}</td>
                <td>
                  <div class="manager-inline-actions manager-inline-actions-compact">
                    <button type="button" class="secondary-button" data-copy-link="${escapeHtml(entry.shareUrl || "")}">Copy link</button>
                      <a class="secondary-button" href="${escapeHtml(
                        buildMailtoLink(entry.clientEmail, entry.clientName || entry.applicantName, entry.shareUrl || "")
                      )}">Email</a>
                      <a class="secondary-button" href="${escapeHtml(entry.shareUrl || "#")}" target="_blank" rel="noreferrer">Open</a>
                  </div>
                </td>
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  `;

  listNode.querySelectorAll("[data-open-id]").forEach((row) => {
    row.addEventListener("click", (event) => {
      if (event.target.closest("[data-copy-link], a")) return;
      state.selectedId = row.dataset.openId;
      renderList();
      renderDetail();
    });
  });

  listNode.querySelectorAll("[data-copy-link]").forEach((button) => {
    button.addEventListener("click", async () => {
      const link = button.dataset.copyLink;
      if (!link) return;
      await navigator.clipboard.writeText(link);
      button.textContent = "Copied";
      setTimeout(() => {
        button.textContent = "Copy link";
      }, 1500);
    });
  });

  renderDetail();
}

function renderDetail() {
  const entry = state.entries.find((item) => item.id === state.selectedId);
  if (!entry) {
    detailNode.innerHTML = '<p class="empty">Choose a DS-160 record from the list to view it here.</p>';
    return;
  }

  detailNode.innerHTML = `
    <article class="manager-item-card ds160-detail-card">
      <div class="manager-item-head">
        <div>
          <h3>${escapeHtml(entry.clientName || entry.applicantName || "-")}</h3>
          <p>${escapeHtml(entry.clientEmail || "-")}</p>
        </div>
        <div class="manager-badges">
          <span class="status-pill ${statusClass(entry.status)}">${statusLabel(entry.status)}</span>
        </div>
      </div>
      <div class="manager-meta-grid">
        <div><span>Manager</span><strong>${escapeHtml(entry.managerName || "-")}</strong></div>
        <div><span>Phone</span><strong>${escapeHtml(entry.clientPhone || entry.primaryPhone || "-")}</strong></div>
        <div><span>Passport</span><strong>${escapeHtml(entry.passportNumber || "-")}</strong></div>
        <div><span>Visa type</span><strong>${escapeHtml(entry.tripPurposeCategory || "-")}</strong></div>
        <div><span>Created</span><strong>${escapeHtml(formatDateTime(entry.createdAt))}</strong></div>
        <div><span>Submitted</span><strong>${escapeHtml(formatDateTime(entry.submittedAt || ""))}</strong></div>
      </div>
      <div class="ds160-detail-stack">
        <div>
          <span class="manager-stat-label">Travel plan</span>
          <p>${escapeHtml(entry.tripPurposeDetail || entry.usStayAddress || entry.arrivalCity || entry.notes || "-")}</p>
        </div>
        <div>
          <span class="manager-stat-label">Internal note</span>
          <p>${escapeHtml(entry.internalNotes || "-")}</p>
        </div>
        <div>
          <span class="manager-stat-label">Key answers</span>
          <p>${escapeHtml(
            [
              entry.maritalStatus && `Marital: ${entry.maritalStatus}`,
              entry.primaryOccupation && `Occupation: ${entry.primaryOccupation}`,
              entry.languagesSpoken && `Languages: ${entry.languagesSpoken}`,
            ]
              .filter(Boolean)
              .join(" | ") || "-"
          )}</p>
        </div>
      </div>
    </article>
  `;
}

async function loadTeamMembers() {
  try {
    const payload = await fetchJson("/api/team-members");
    state.teamMembers = payload.entries || [];
  } catch {
    state.teamMembers = [];
  }
}

async function loadEntries() {
  const entries = await fetchJson("/api/ds160");
  state.entries = Array.isArray(entries) ? entries : [];
  renderSummary();
  renderManagerOptions();
  renderList();
}

sendForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(sendForm);
  const payload = Object.fromEntries(formData.entries());
  const button = sendForm.querySelector('button[type="submit"]');
  button.disabled = true;
  button.textContent = "Creating...";
  setStatus("Preparing the client form link...");

  try {
    const result = await fetchJson("/api/ds160/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const entry = result.entry;
    setLatestLink(entry.shareUrl || "", entry.clientEmail || "", entry.clientName || "");
    if (entry.shareUrl) {
      await navigator.clipboard.writeText(entry.shareUrl);
    }
    setStatus("DS-160 link created and copied.");
    sendForm.reset();
    if (managerSelect.value) {
      sendForm.elements.managerName.value = managerSelect.value;
    }
    await loadEntries();
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    button.disabled = false;
    button.textContent = "Create and copy link";
  }
});

copyLinkButton?.addEventListener("click", async () => {
  if (!state.latestLink) return;
  await navigator.clipboard.writeText(state.latestLink);
  copyLinkButton.textContent = "Copied";
  setTimeout(() => {
    copyLinkButton.textContent = "Copy link";
  }, 1500);
});

openLinkButton?.addEventListener("click", () => {
  if (!state.latestLink) return;
  window.open(state.latestLink, "_blank", "noopener");
});

[searchInput, statusFilter, managerFilter].forEach((node) => {
  node?.addEventListener("input", renderList);
  node?.addEventListener("change", renderList);
});

async function init() {
  await loadTeamMembers();
  await loadEntries();
  renderSummary();
}

init();
