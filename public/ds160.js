const sendForm = document.querySelector("#ds160-send-form");
const sendStatus = document.querySelector("#ds160-send-status");
const listNode = document.querySelector("#ds160-list");
const modalNode = document.querySelector("#ds160-create-modal");
const answersModalNode = document.querySelector("#ds160-answers-modal");
const appointmentModalNode = document.querySelector("#ds160-appointment-modal");
const editModalNode = document.querySelector("#ds160-edit-modal");
const answersContentNode = document.querySelector("#ds160-answers-content");
const openCreateButton = document.querySelector("#ds160-open-create");
const appointmentForm = document.querySelector("#ds160-appointment-form");
const appointmentStatus = document.querySelector("#ds160-appointment-status");
const editForm = document.querySelector("#ds160-edit-form");
const editStatus = document.querySelector("#ds160-edit-status");
const latestLinkCard = document.querySelector("#ds160-latest-link");
const shareLinkNode = document.querySelector("#ds160-share-link");
const copyLinkButton = document.querySelector("#ds160-copy-link");
const emailLinkButton = document.querySelector("#ds160-email-link");
const openLinkButton = document.querySelector("#ds160-open-link");
const managerSelect = document.querySelector("#ds160-manager-select");
const editManagerSelect = document.querySelector("#ds160-edit-manager-select");
const managerFilter = document.querySelector("#ds160-manager-filter");
const searchInput = document.querySelector("#ds160-search");
const statusFilter = document.querySelector("#ds160-status-filter");
const dateFromInput = document.querySelector("#ds160-date-from");
const dateToInput = document.querySelector("#ds160-date-to");

const TEAM_PHONE = "72007722";
const TEAM_COMPANY = "Дэлхий Трэвел Икс";
const TEAM_WEBSITE = "www.travelx.mn";
const PAGE_SIZE = 15;

const ANSWER_SECTIONS = [
  {
    title: "1. Хувийн үндсэн мэдээлэл",
    fields: [
      ["Овог", "surname"],
      ["Нэр", "givenName"],
      ["Төрсөн хэлээрх бүтэн нэр", "nativeFullName"],
      ["Хүйс", "sex"],
      ["Гэр бүлийн байдал", "maritalStatus"],
      ["Төрсөн өдөр", "dateOfBirth"],
      ["Төрсөн хот / сум / дүүрэг", "birthCity"],
      ["Төрсөн аймаг / муж", "birthProvince"],
      ["Төрсөн улс", "birthCountry"],
      ["Иргэншил", "nationality"],
      ["Бусад нэр хэрэглэж байсан эсэх", "usedOtherNames"],
      ["Өмнө хэрэглэж байсан нэрс", "otherNamesDetails"],
      ["Теле кодтой эсэх", "hasTelecode"],
      ["Теле код", "telecode"],
    ],
  },
  {
    title: "2. Хаяг болон холбоо барих мэдээлэл",
    fields: [
      ["Гэрийн хаяг 1-р мөр", "homeAddressLine1"],
      ["Гэрийн хаяг 2-р мөр", "homeAddressLine2"],
      ["Хот / сум / дүүрэг", "homeCity"],
      ["Аймаг / муж", "homeProvince"],
      ["Шуудангийн код", "homePostalCode"],
      ["Улс", "homeCountry"],
      ["Шуудангийн хаяг ижил эсэх", "mailingSameAsHome"],
      ["Шуудангийн хаяг", "mailingAddress"],
      ["Үндсэн утас", "primaryPhone"],
      ["Нэмэлт утас", "secondaryPhone"],
      ["Ажлын утас", "workPhone"],
      ["Өөр утас хэрэглэж байсан эсэх", "usedOtherPhones"],
      ["Өөр утаснууд", "otherPhoneDetails"],
      ["Имэйл", "email"],
      ["Өөр имэйл хэрэглэж байсан эсэх", "usedOtherEmails"],
      ["Өөр имэйлүүд", "otherEmailDetails"],
    ],
  },
  {
    title: "3. Паспортын мэдээлэл",
    fields: [
      ["Паспортын төрөл", "passportType"],
      ["Паспортын дугаар", "passportNumber"],
      ["Паспортын дэвтрийн дугаар байхгүй эсэх", "passportBookNumberNotApplicable"],
      ["Паспортын дэвтрийн дугаар", "passportBookNumber"],
      ["Паспорт олгосон улс / байгууллага", "passportIssuingCountry"],
      ["Паспорт олгосон хот", "passportIssueCity"],
      ["Паспорт олгосон аймаг / муж", "passportIssueProvince"],
      ["Паспорт олгосон улс", "passportIssueCountry"],
      ["Паспорт олгосон өдөр", "passportIssueDate"],
      ["Паспортын хүчинтэй хугацаа", "passportExpiryDate"],
      ["Паспорт үрэгдүүлсэн эсэх", "lostPassport"],
      ["Тайлбар", "lostPassportDetails"],
    ],
  },
  {
    title: "4. Аяллын мэдээлэл",
    fields: [
      ["Аяллын зорилго", "tripPurposeCategory"],
      ["Дэлгэрэнгүй төрөл", "tripPurposeDetail"],
      ["Тодорхой төлөвлөгөөтэй эсэх", "hasSpecificTravelPlans"],
      ["АНУ-д очих өдөр", "intendedArrivalDate"],
      ["Байх хугацаа", "lengthOfStayValue"],
      ["Хугацааны нэгж", "lengthOfStayUnit"],
      ["АНУ-д байрлах хаяг", "usStayAddress"],
      ["Зардал төлөгч", "tripPayer"],
      ["Очих муж / хот", "arrivalCity"],
    ],
  },
  {
    title: "5. Хамт явах хүмүүс",
    fields: [
      ["Хамт хүн явах эсэх", "travelingWithOthers"],
      ["Баг / байгууллагаар явах эсэх", "travelingWithGroup"],
      ["Хамт явах хүмүүсийн мэдээлэл", "travelCompanions"],
    ],
  },
  {
    title: "6. Өмнөх АНУ аялал ба виз",
    fields: [
      ["АНУ-д очиж байсан эсэх", "beenInUs"],
      ["АНУ-ын виз авч байсан эсэх", "hadUsVisa"],
      ["Визээс татгалзаж байсан эсэх", "visaRefused"],
      ["Цагаачлалын өргөдөл гаргаж байсан эсэх", "immigrantPetitionFiled"],
      ["Тайлбар", "previousUsTravelDetails"],
    ],
  },
  {
    title: "7. АНУ дахь холбоо барих хүн / байгууллага",
    fields: [
      ["Овог", "usContactSurname"],
      ["Нэр", "usContactGivenName"],
      ["Байгууллагын нэр", "usOrganizationName"],
      ["Хамаарал", "usContactRelationship"],
      ["Утас", "usContactPhone"],
      ["Хаяг", "usContactAddress"],
      ["Имэйл", "usContactEmail"],
    ],
  },
  {
    title: "8. Гэр бүлийн мэдээлэл",
    fields: [
      ["Эцгийн овог", "fatherSurname"],
      ["Эцгийн нэр", "fatherGivenName"],
      ["Эцгийн төрсөн өдөр", "fatherDateOfBirth"],
      ["Эцэг АНУ-д байгаа эсэх", "fatherInUs"],
      ["Эхийн овог", "motherSurname"],
      ["Эхийн нэр", "motherGivenName"],
      ["Эхийн төрсөн өдөр", "motherDateOfBirth"],
      ["Эх АНУ-д байгаа эсэх", "motherInUs"],
      ["Ойрын хамаатан байгаа эсэх", "hasImmediateRelativesInUs"],
      ["Бусад хамаатан байгаа эсэх", "hasOtherRelativesInUs"],
      ["АНУ дахь төрөл садангийн тайлбар", "relativesInUsDetails"],
      ["Эхнэр / нөхрийн овог", "spouseSurname"],
      ["Эхнэр / нөхрийн нэр", "spouseGivenName"],
      ["Эхнэр / нөхрийн төрсөн өдөр", "spouseDateOfBirth"],
      ["Иргэншил", "spouseNationality"],
      ["Төрсөн хот", "spouseBirthCity"],
      ["Төрсөн улс", "spouseBirthCountry"],
      ["Хаяг", "spouseAddress"],
    ],
  },
  {
    title: "9. Ажил, боловсрол, орлого",
    fields: [
      ["Үндсэн ажил мэргэжил", "primaryOccupation"],
      ["Байгууллага / сургуулийн нэр", "presentEmployerOrSchool"],
      ["Хаяг", "presentEmployerAddress"],
      ["Эхэлсэн өдөр", "presentEmploymentStartDate"],
      ["Сарын орлого", "monthlyIncome"],
      ["Ажлын утас", "presentEmployerPhone"],
      ["Албан тушаал", "jobTitle"],
      ["Удирдлагын овог", "supervisorSurname"],
      ["Удирдлагын нэр", "supervisorGivenName"],
      ["Ажил үүрэг", "jobDuties"],
      ["Дээд боловсрол эзэмшсэн эсэх", "attendedHigherEducation"],
      ["Өмнөх ажил / сургуулийн мэдээлэл", "previousEmploymentOrEducation"],
    ],
  },
  {
    title: "10. Нийгмийн сүлжээ, хэл, нэмэлт мэдээлэл",
    fields: [
      ["Сошиал хаягууд", "socialMediaAccounts"],
      ["Бусад вэб / апп идэвхтэй эсэх", "hasOtherWebPresence"],
      ["Бусад вэб / апп мэдээлэл", "otherWebPresenceDetails"],
      ["Овог, аймаг, ястангийн харьяалал", "belongsToClan"],
      ["Харьяаллын тайлбар", "clanDetails"],
      ["Ярьдаг хэлнүүд", "languagesSpoken"],
      ["Сүүлийн 5 жилд гадаад зорчсон эсэх", "traveledOtherCountriesLastFiveYears"],
      ["Зорчсон улсууд", "countriesVisitedDetails"],
      ["Байгууллагад харьяалагддаг эсэх", "belongsToOrganizations"],
      ["Байгууллагын мэдээлэл", "organizationDetails"],
      ["Тусгай ур чадвартай эсэх", "hasSpecialSkills"],
      ["Тусгай ур чадварын тайлбар", "specialSkillsDetails"],
      ["Цэргийн алба хаасан эсэх", "servedMilitary"],
      ["Цэргийн анги / нэгж", "militaryUnitName"],
      ["Зэвсэгт бүлэгтэй холбоотой эсэх", "involvedWithParamilitary"],
      ["Цэрэг / аюулгүй байдлын тайлбар", "militaryOrSecurityDetails"],
    ],
  },
  {
    title: "11. Аюулгүй байдал ба суурь шалгалт",
    fields: [
      ["Халдварт өвчтэй эсэх", "securityCommunicableDisease"],
      ["Сэтгэцийн / биеийн эмгэгтэй эсэх", "securityMentalDisorder"],
      ["Хар тамхи хэрэглэдэг эсэх", "securityDrugAbuse"],
      ["Баривчлагдаж байсан эсэх", "securityArrested"],
      ["Хар тамхитай холбоотой зөрчил", "securityControlledSubstances"],
      ["Биеэ үнэлэлттэй холбоотой эсэх", "securityProstitution"],
      ["Мөнгө угаах ажиллагаанд оролцсон эсэх", "securityMoneyLaundering"],
      ["Хүн худалдаалах гэмт хэрэг", "securityHumanTrafficking"],
      ["Терроризмтай холбоотой эсэх", "securityTerrorism"],
      ["Хүчирхийлэл / геноцидтай холбоотой эсэх", "securityViolence"],
      ["Хүний эрхийн ноцтой зөрчилтэй холбоотой эсэх", "securityHumanRights"],
      ["Визийн залилан", "securityVisaFraud"],
      ["Депортлуулж байсан эсэх", "securityDeported"],
      ["Хүүхдийн асрамжийн маргаан", "securityChildCustody"],
      ["Хууль бусаар санал өгсөн эсэх", "securityIllegalVoting"],
      ["АНУ-ын иргэншлээс татгалзсан эсэх", "securityRenouncedCitizenship"],
      ["Нэмэлт тайлбар", "securityBackgroundDetails"],
    ],
  },
  {
    title: "12. Нэмэлт тайлбар",
    fields: [["Нэмэлт тэмдэглэл", "notes"]],
  },
];

const state = {
  entries: [],
  teamMembers: [],
  latestLink: "",
  latestEmail: "",
  latestName: "",
  currentPage: 1,
};

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function normalizeText(value) {
  return String(value || "").trim();
}

function splitClientName(entry) {
  const surname = normalizeText(entry.surname || "");
  const givenName = normalizeText(entry.givenName || "");
  if (surname || givenName) {
    return { surname, givenName };
  }
  const parts = normalizeText(entry.clientName || entry.applicantName || "").split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return { surname: parts[0] || "", givenName: "" };
  }
  return { surname: parts[0], givenName: parts.slice(1).join(" ") };
}

function formatDateTime(value) {
  if (!value) return "-";
  const normalized = normalizeText(value);
  const matched = normalized.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (matched) return `${matched[1]}-${matched[2]}-${matched[3]}`;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toISOString().slice(0, 10);
}

function formatAppointment(dateValue, timeValue) {
  const datePart = normalizeText(dateValue);
  const timePart = normalizeText(timeValue);
  if (!datePart && !timePart) return "-";
  if (!datePart) return timePart;
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    return timePart ? `${datePart} ${timePart}` : datePart;
  }
  const parsed = new Date(`${datePart}T${timePart || "00:00"}`);
  if (Number.isNaN(parsed.getTime())) return [datePart, timePart].filter(Boolean).join(" ");
  return `${parsed.toISOString().slice(0, 10)}${timePart ? ` ${timePart}` : ""}`;
}

function dateKey(value) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value).slice(0, 10);
  return parsed.toISOString().slice(0, 10);
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data;
}

function buildMailtoLink(entry) {
  const recipientEmail = normalizeText(entry.clientEmail || entry.email);
  const clientDisplayName = normalizeText(entry.givenName || splitClientName(entry).givenName || entry.clientName || "");
  const managerName = normalizeText(entry.managerName || "TravelX");
  const subject = encodeURIComponent("TravelX DS-160 form");
  const cc = encodeURIComponent("info@travelx.mn");
  const body = encodeURIComponent(
    `Сайн байна уу, ${clientDisplayName || "харилцагч"}.\n\nТа доорх холбоосоор DS-160 маягтаа бөглөнө үү.\n\n${entry.shareUrl || ""}\n\nХүндэтгэсэн,\n${managerName}\nУтас: ${TEAM_PHONE}\n${TEAM_COMPANY}\n${TEAM_WEBSITE}`
  );
  return recipientEmail ? `mailto:${encodeURIComponent(recipientEmail)}?cc=${cc}&subject=${subject}&body=${body}` : "#";
}

function setStatus(message, isError = false) {
  sendStatus.textContent = message;
  sendStatus.dataset.tone = isError ? "error" : "ok";
}

function openModal() {
  modalNode.classList.remove("is-hidden");
  modalNode.removeAttribute("hidden");
  document.body.classList.add("modal-open");
}

function closeModal() {
  modalNode.classList.add("is-hidden");
  modalNode.setAttribute("hidden", "");
  document.body.classList.remove("modal-open");
}

function openAnswersModal() {
  answersModalNode.classList.remove("is-hidden");
  answersModalNode.removeAttribute("hidden");
  document.body.classList.add("modal-open");
}

function closeAnswersModal() {
  answersModalNode.classList.add("is-hidden");
  answersModalNode.setAttribute("hidden", "");
  if (modalNode.classList.contains("is-hidden") && appointmentModalNode.classList.contains("is-hidden") && editModalNode.classList.contains("is-hidden")) {
    document.body.classList.remove("modal-open");
  }
}

function setAppointmentStatus(message, isError = false) {
  appointmentStatus.textContent = message;
  appointmentStatus.dataset.tone = isError ? "error" : "ok";
}

function openAppointmentModal(entry) {
  appointmentForm.elements.id.value = entry.id || "";
  appointmentForm.elements.appointmentDate.value = entry.appointmentDate || "";
  appointmentForm.elements.appointmentTime.value = entry.appointmentTime || "";
  setAppointmentStatus("");
  appointmentModalNode.classList.remove("is-hidden");
  appointmentModalNode.removeAttribute("hidden");
  document.body.classList.add("modal-open");
}

function closeAppointmentModal() {
  appointmentModalNode.classList.add("is-hidden");
  appointmentModalNode.setAttribute("hidden", "");
  if (modalNode.classList.contains("is-hidden") && answersModalNode.classList.contains("is-hidden") && editModalNode.classList.contains("is-hidden")) {
    document.body.classList.remove("modal-open");
  }
}

function setEditStatus(message, isError = false) {
  editStatus.textContent = message;
  editStatus.dataset.tone = isError ? "error" : "ok";
}

function openEditModal(entry) {
  editForm.elements.id.value = entry.id || "";
  editForm.elements.clientName.value = entry.clientName || "";
  editForm.elements.clientEmail.value = entry.clientEmail || "";
  editForm.elements.clientPhone.value = entry.clientPhone || entry.primaryPhone || "";
  editForm.elements.managerName.value = entry.managerName || managerSelect.value || "";
  editForm.elements.internalNotes.value = entry.internalNotes || "";
  setEditStatus("");
  editModalNode.classList.remove("is-hidden");
  editModalNode.removeAttribute("hidden");
  document.body.classList.add("modal-open");
}

function closeEditModal() {
  editModalNode.classList.add("is-hidden");
  editModalNode.setAttribute("hidden", "");
  if (modalNode.classList.contains("is-hidden") && answersModalNode.classList.contains("is-hidden") && appointmentModalNode.classList.contains("is-hidden")) {
    document.body.classList.remove("modal-open");
  }
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
    emailLinkButton.href = email
      ? buildMailtoLink({ clientEmail: email, givenName: name, managerName: managerSelect?.value || "", shareUrl: url })
      : "#";
  }
}

function statusLabel(status) {
  return status === "submitted" ? "Submitted" : "Sent";
}

function statusClass(status) {
  return status === "submitted" ? "is-confirmed" : "is-pending";
}

function sortEntries(entries) {
  return [...entries].sort((a, b) => {
    const left = b.submittedAt || b.updatedAt || b.createdAt || "";
    const right = a.submittedAt || a.updatedAt || a.createdAt || "";
    return String(left).localeCompare(String(right));
  });
}

function filteredEntries() {
  const query = String(searchInput.value || "").trim().toLowerCase();
  const status = statusFilter.value;
  const manager = managerFilter.value;
  const dateFrom = dateFromInput.value;
  const dateTo = dateToInput.value;

  return sortEntries(state.entries).filter((entry) => {
    if (status !== "all" && entry.status !== status) return false;
    if (manager && entry.managerName !== manager) return false;

    const recordDate = dateKey(entry.submittedAt || entry.createdAt);
    if (dateFrom && recordDate && recordDate < dateFrom) return false;
    if (dateTo && recordDate && recordDate > dateTo) return false;

    if (!query) return true;
    return [
      entry.surname,
      entry.givenName,
      entry.clientName,
      entry.clientEmail,
      entry.clientPhone,
      entry.primaryPhone,
      entry.managerName,
      entry.passportNumber,
    ].some((value) => String(value || "").toLowerCase().includes(query));
  });
}

function renderSummary() {
  return;
}

function paginatedEntries(entries) {
  const pageCount = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  if (state.currentPage > pageCount) state.currentPage = pageCount;
  if (state.currentPage < 1) state.currentPage = 1;
  const start = (state.currentPage - 1) * PAGE_SIZE;
  return {
    items: entries.slice(start, start + PAGE_SIZE),
    pageCount,
    total: entries.length,
    start: totalOrZero(entries.length) ? start + 1 : 0,
    end: Math.min(start + PAGE_SIZE, entries.length),
  };
}

function totalOrZero(value) {
  return Number(value) > 0;
}

function renderManagerOptions() {
  const fallbackProfile =
    typeof currentProfile !== "undefined" && currentProfile
      ? { fullName: currentProfile.fullName || currentProfile.email || "Current user" }
      : { fullName: "Current user" };
  const members = state.teamMembers.length ? state.teamMembers : [fallbackProfile];

  managerSelect.innerHTML = members
    .map((member) => `<option value="${escapeHtml(member.fullName)}">${escapeHtml(member.fullName)}</option>`)
    .join("");
  editManagerSelect.innerHTML = managerSelect.innerHTML;

  if (
    typeof currentProfile !== "undefined" &&
    currentProfile?.fullName &&
    members.some((member) => member.fullName === currentProfile.fullName)
  ) {
    managerSelect.value = currentProfile.fullName;
    editManagerSelect.value = currentProfile.fullName;
  }

  const uniqueManagers = Array.from(new Set(state.entries.map((entry) => entry.managerName).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b)
  );
  const currentValue = managerFilter.value;
  managerFilter.innerHTML = `<option value="">All</option>${uniqueManagers
    .map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`)
    .join("")}`;
  managerFilter.value = uniqueManagers.includes(currentValue) ? currentValue : "";
}

function renderAnswers(entry) {
  if (entry.status !== "submitted") {
    answersContentNode.innerHTML = `
      <div class="empty-state">
        This client has not submitted the DS-160 form yet.
      </div>
    `;
    openAnswersModal();
    return;
  }

  const { surname, givenName } = splitClientName(entry);
  answersContentNode.innerHTML = `
    <div class="ds160-answer-head">
      <h3>${escapeHtml([surname, givenName].filter(Boolean).join(" ") || entry.clientName || "-")}</h3>
      <p>${escapeHtml(entry.clientEmail || "-")} · ${escapeHtml(entry.clientPhone || entry.primaryPhone || "-")}</p>
    </div>
    <div class="ds160-answer-sections">
      ${ANSWER_SECTIONS.map(
        (section) => `
          <section class="ds160-answer-section">
            <h4>${escapeHtml(section.title)}</h4>
            <div class="ds160-answer-grid">
              ${section.fields
                .map(
                  ([label, key]) => `
                    <div class="ds160-answer-item">
                      <span>${escapeHtml(label)}</span>
                      <strong>${escapeHtml(entry[key] || "-")}</strong>
                    </div>
                  `
                )
                .join("")}
            </div>
          </section>
        `
      ).join("")}
    </div>
  `;
  openAnswersModal();
}

function renderList() {
  const entries = filteredEntries();
  if (!entries.length) {
    listNode.innerHTML = '<p class="empty">No DS-160 forms match these filters yet.</p>';
    return;
  }

  const pagination = paginatedEntries(entries);

  listNode.innerHTML = `
    <table class="manager-table ds160-table">
      <thead>
        <tr>
          <th>Surname</th>
          <th>Name</th>
          <th>Client Email</th>
          <th>Client Number</th>
          <th>Date</th>
          <th>Appointment</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${pagination.items
          .map((entry) => {
            const nameParts = splitClientName(entry);
            return `
              <tr>
                <td>${escapeHtml(nameParts.surname || "-")}</td>
                <td>${escapeHtml(nameParts.givenName || "-")}</td>
                <td>${escapeHtml(entry.clientEmail || "-")}</td>
                <td>${escapeHtml(entry.clientPhone || entry.primaryPhone || "-")}</td>
                <td>${escapeHtml(formatDateTime(entry.submittedAt || entry.createdAt))}</td>
                <td>${escapeHtml(formatAppointment(entry.appointmentDate, entry.appointmentTime))}</td>
                <td class="ds160-actions-cell">
                  <details class="trip-menu row-action-menu ds160-action-menu">
                    <summary class="trip-menu-trigger" aria-label="DS-160 actions">⋮</summary>
                    <div class="trip-menu-popover">
                      <button type="button" class="trip-menu-item" data-action="see-answers" data-id="${escapeHtml(entry.id)}">See Answers</button>
                      <button type="button" class="trip-menu-item" data-action="copy-link" data-link="${escapeHtml(entry.shareUrl || "")}">Copy link</button>
                      <button type="button" class="trip-menu-item" data-action="edit-info" data-id="${escapeHtml(entry.id)}">Edit info</button>
                      <button type="button" class="trip-menu-item" data-action="set-appointment" data-id="${escapeHtml(entry.id)}">Set appointment</button>
                      <a class="trip-menu-item" href="${escapeHtml(buildMailtoLink(entry))}">Email client</a>
                      <a class="trip-menu-item" href="${escapeHtml(entry.shareUrl || "#")}" target="_blank" rel="noreferrer">Open form</a>
                      <button type="button" class="trip-menu-item is-danger" data-action="delete-entry" data-id="${escapeHtml(entry.id)}">Delete</button>
                    </div>
                  </details>
                </td>
              </tr>
            `;
          })
          .join("")}
      </tbody>
    </table>
    <div class="table-pagination ds160-pagination">
      <p>Showing ${pagination.start}-${pagination.end} of ${pagination.total}</p>
      <div class="pagination-actions">
        <button type="button" class="secondary-button" data-page-action="prev" ${state.currentPage <= 1 ? "disabled" : ""}>Previous</button>
        <button type="button" class="secondary-button" data-page-action="next" ${state.currentPage >= pagination.pageCount ? "disabled" : ""}>Next</button>
      </div>
    </div>
  `;

  listNode.querySelectorAll('[data-action="copy-link"]').forEach((button) => {
    button.addEventListener("click", async () => {
      const link = button.dataset.link;
      if (!link) return;
      await navigator.clipboard.writeText(link);
      button.textContent = "Copied";
      window.setTimeout(() => {
        button.textContent = "Copy link";
      }, 1500);
    });
  });

  listNode.querySelectorAll('[data-action="see-answers"]').forEach((button) => {
    button.addEventListener("click", () => {
      const entry = state.entries.find((item) => item.id === button.dataset.id);
      if (!entry) return;
      renderAnswers(entry);
    });
  });

  listNode.querySelectorAll('[data-action="set-appointment"]').forEach((button) => {
    button.addEventListener("click", () => {
      const entry = state.entries.find((item) => item.id === button.dataset.id);
      if (!entry) return;
      openAppointmentModal(entry);
    });
  });

  listNode.querySelectorAll('[data-action="edit-info"]').forEach((button) => {
    button.addEventListener("click", () => {
      const entry = state.entries.find((item) => item.id === button.dataset.id);
      if (!entry) return;
      openEditModal(entry);
    });
  });

  listNode.querySelectorAll('[data-action="delete-entry"]').forEach((button) => {
    button.addEventListener("click", async () => {
      const entry = state.entries.find((item) => item.id === button.dataset.id);
      if (!entry) return;
      const confirmed = window.confirm(`Delete DS-160 record for ${entry.clientName || entry.clientEmail || "this client"}?`);
      if (!confirmed) return;
      try {
        await fetchJson(`/api/ds160/${encodeURIComponent(entry.id)}`, {
          method: "DELETE",
        });
        await loadEntries();
      } catch (error) {
        window.alert(error.message);
      }
    });
  });

  listNode.querySelectorAll("[data-page-action]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.pageAction === "prev" && state.currentPage > 1) {
        state.currentPage -= 1;
      }
      if (button.dataset.pageAction === "next" && state.currentPage < pagination.pageCount) {
        state.currentPage += 1;
      }
      renderList();
    });
  });
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

openCreateButton?.addEventListener("click", () => {
  sendForm.reset();
  if (managerSelect.value) {
    sendForm.elements.managerName.value = managerSelect.value;
  }
  setLatestLink("");
  setStatus("");
  openModal();
});

modalNode?.addEventListener("click", (event) => {
  if (event.target.dataset.action === "close-ds160-modal") {
    closeModal();
  }
});

answersModalNode?.addEventListener("click", (event) => {
  if (event.target.dataset.action === "close-ds160-answers") {
    closeAnswersModal();
  }
});

appointmentModalNode?.addEventListener("click", (event) => {
  if (event.target.dataset.action === "close-ds160-appointment") {
    closeAppointmentModal();
  }
});

editModalNode?.addEventListener("click", (event) => {
  if (event.target.dataset.action === "close-ds160-edit") {
    closeEditModal();
  }
});

appointmentForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(appointmentForm);
  const payload = Object.fromEntries(formData.entries());
  const recordId = payload.id;
  const button = appointmentForm.querySelector('button[type="submit"]');
  if (!recordId) return;

  button.disabled = true;
  button.textContent = "Saving...";
  setAppointmentStatus("Saving appointment...");

  try {
    await fetchJson(`/api/ds160/${encodeURIComponent(recordId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appointmentDate: payload.appointmentDate,
        appointmentTime: payload.appointmentTime,
      }),
    });
    setAppointmentStatus("Appointment saved.");
    await loadEntries();
    window.setTimeout(() => {
      closeAppointmentModal();
    }, 400);
  } catch (error) {
    setAppointmentStatus(error.message, true);
  } finally {
    button.disabled = false;
    button.textContent = "Save appointment";
  }
});

editForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(editForm);
  const payload = Object.fromEntries(formData.entries());
  const recordId = payload.id;
  const button = editForm.querySelector('button[type="submit"]');
  if (!recordId) return;

  button.disabled = true;
  button.textContent = "Saving...";
  setEditStatus("Saving changes...");

  try {
    await fetchJson(`/api/ds160/${encodeURIComponent(recordId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientName: payload.clientName,
        clientEmail: payload.clientEmail,
        clientPhone: payload.clientPhone,
        managerName: payload.managerName,
        internalNotes: payload.internalNotes,
      }),
    });
    setEditStatus("Changes saved.");
    await loadEntries();
    window.setTimeout(() => {
      closeEditModal();
    }, 400);
  } catch (error) {
    setEditStatus(error.message, true);
  } finally {
    button.disabled = false;
    button.textContent = "Save changes";
  }
});

[searchInput, statusFilter, managerFilter, dateFromInput, dateToInput].forEach((node) => {
  node?.addEventListener("input", () => {
    state.currentPage = 1;
    renderList();
  });
  node?.addEventListener("change", () => {
    state.currentPage = 1;
    renderList();
  });
});

async function init() {
  await loadTeamMembers();
  await loadEntries();
  renderSummary();
}

init();
