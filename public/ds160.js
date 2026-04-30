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
const PAGE_SIZE = 20;

// Mirrors public/ds160-client.html section-by-section. `lists` names a
// REPEAT_LIST_CONFIG key whose rows belong inside that section so the
// see-answers view and PDF read top-to-bottom in form-fill order.
const ANSWER_SECTIONS = [
  {
    title: "1. Хувийн мэдээлэл",
    fields: [
      ["Овог", "surname"],
      ["Нэр", "givenName"],
      ["Төрсөн хэлээрх бүтэн нэр", "nativeFullName"],
      ["Бусад нэр хэрэглэж байсан эсэх", "usedOtherNames"],
      ["Нэрийг илэрхийлэх ханз байгаа эсэх", "hasTelecode"],
      ["Овгийн ханз", "telecodeSurname"],
      ["Нэрийн ханз", "telecodeGivenName"],
      ["Хүйс", "sex"],
      ["Гэрлэлтийн байдал", "maritalStatus"],
      ["Гэрлэлтийн байдлын тайлбар", "maritalStatusOther"],
      ["Төрсөн өдөр", "dateOfBirth"],
      ["Төрсөн хот / аймаг", "birthCity"],
      ["Төрсөн дүүрэг / сум", "birthProvince"],
      ["Төрсөн улс", "birthCountry"],
    ],
    lists: ["otherNameList"],
  },
  {
    title: "2. Хувийн мэдээлэл",
    fields: [
      ["Одоогийн иргэншил", "nationality"],
      ["Өөр улсын иргэншил эзэмшиж байсан эсэх", "hadOtherNationality"],
      ["Өөр улсад байнгын оршин суудаг эсэх", "permanentResidentOther"],
      ["Байнга оршин суудаг улс", "permanentResidentCountry"],
      ["Регистрийн дугаар", "registerNumber"],
      ["АНУ-ын SSN дугаартай эсэх", "hasUsSsn"],
      ["АНУ-ын SSN дугаар", "usSsn"],
      ["АНУ-ын ITIN дугаартай эсэх", "hasUsTaxId"],
      ["АНУ-ын ITIN дугаар", "usTaxId"],
    ],
    lists: ["otherNatList"],
  },
  {
    title: "3. Аяллын мэдээлэл",
    fields: [
      ["Аяллын зорилго", "tripPurposeCategory"],
      ["Дэлгэрэнгүй төрөл", "tripPurposeDetail"],
      ["Тодорхой маршрут гаргасан эсэх", "hasSpecificTravelPlans"],
      ["АНУ-д очих огноо", "intendedArrivalDate"],
      ["АНУ-аас гарах огноо", "intendedDepartureDate"],
      ["Ирэх нислэг", "arrivalFlight"],
      ["Ирэх хот", "arrivalCity"],
      ["Гарах нислэг", "departureFlight"],
      ["Гарах хот", "departureCity"],
      ["АНУ-д очих газрууд", "usLocations"],
      ["Байх хугацаа", "intendedStayLength"],
      ["Хугацааны нэгж", "intendedStayUnit"],
      ["АНУ-д байрлах хаяг 1-р мөр", "usStayAddressLine1"],
      ["АНУ-д байрлах хаяг 2-р мөр", "usStayAddressLine2"],
      ["АНУ-д байрлах хот", "usStayCity"],
      ["АНУ-д байрлах муж", "usStayState"],
      ["АНУ-д байрлах ZIP", "usStayZip"],
      ["Зардал төлөгч", "tripPayer"],
      ["Зардал төлөгчийн овог", "tripPayerSurname"],
      ["Зардал төлөгчийн нэр", "tripPayerGivenName"],
      ["Зардал төлөгчийн утас", "tripPayerPhone"],
      ["Зардал төлөгчийн имэйл", "tripPayerEmail"],
      ["Зардал төлөгчийн хамаарал", "tripPayerRelationship"],
      ["Зардал төлөгчийн хаяг ижил эсэх", "tripPayerSameAddress"],
      ["Зардал төлөгчийн хаяг", "tripPayerAddress"],
      ["Зардал төлөгч байгууллагын нэр", "tripPayerOrgName"],
      ["Зардал төлөгч байгууллагын утас", "tripPayerOrgPhone"],
      ["Зардал төлөгч байгууллагын хамаарал", "tripPayerOrgRelationship"],
      ["Зардал төлөгч байгууллагын хаяг", "tripPayerOrgAddress"],
    ],
  },
  {
    title: "4. Хамт явах хүмүүс",
    fields: [
      ["Хамт хүнтэй явах эсэх", "travelingWithOthers"],
      ["Бүлгээр явах эсэх", "travelingAsGroup"],
      ["Бүлгийн нэр", "travelGroupName"],
    ],
    lists: ["companionList"],
  },
  {
    title: "5. Өмнөх АНУ-ын аялал",
    fields: [
      ["АНУ-д очиж байсан эсэх", "beenInUs"],
    ],
    lists: ["prevVisitList"],
    fieldsAfter: [
      ["АНУ-ын жолооны үнэмлэхтэй эсэх", "hasUsDriverLicense"],
      ["АНУ-ын жолооны үнэмлэх дугаар", "usDriverLicenseNumber"],
      ["АНУ-ын жолооны үнэмлэх олгосон муж", "usDriverLicenseState"],
      ["АНУ-ын виз авч байсан эсэх", "hadUsVisa"],
      ["Сүүлийн виз олгосон огноо", "lastVisaIssuedDate"],
      ["Сүүлийн визний дугаар", "lastVisaNumber"],
      ["Ижил төрлийн виз эсэх", "sameVisaType"],
      ["Ижил улс / газар эсэх", "sameCountryLocation"],
      ["10 хурууны хээ авсан эсэх", "tenPrinted"],
      ["Виз үрэгдсэн / хулгайлагдсан эсэх", "visaLostStolen"],
      ["Виз цуцалсан эсэх", "visaCancelled"],
      ["Визээс татгалзаж байсан эсэх", "visaRefused"],
      ["Татгалзсан тайлбар", "visaRefusedExplain"],
      ["Цагаачлалын өргөдөл гаргасан эсэх", "immigrantPetitionFiled"],
      ["Цагаачлалын тайлбар", "immigrantPetitionExplain"],
    ],
  },
  {
    title: "6. Хаяг ба утас",
    fields: [
      ["Гэрийн хаяг 1-р мөр", "homeAddressLine1"],
      ["Гэрийн хаяг 2-р мөр", "homeAddressLine2"],
      ["Хот / сум / дүүрэг", "homeCity"],
      ["Аймаг / муж", "homeProvince"],
      ["Шуудангийн код", "homePostalCode"],
      ["Улс", "homeCountry"],
      ["Шуудангийн хаяг гэртэйгээ ижил эсэх", "mailingSameAsHome"],
      ["Шуудангийн хаяг 1-р мөр", "mailingAddressLine1"],
      ["Шуудангийн хаяг 2-р мөр", "mailingAddressLine2"],
      ["Шуудангийн хот", "mailingCity"],
      ["Шуудангийн муж", "mailingProvince"],
      ["Шуудангийн код", "mailingPostalCode"],
      ["Шуудангийн улс", "mailingCountry"],
      ["Үндсэн утас", "primaryPhone"],
      ["Нэмэлт утас", "secondaryPhone"],
      ["Ажлын утас", "workPhone"],
      ["Өөр утас хэрэглэж байсан эсэх", "usedOtherPhones"],
    ],
    lists: ["otherPhoneList"],
    fieldsAfter: [
      ["Имэйл", "email"],
      ["Өөр имэйл хэрэглэж байсан эсэх", "usedOtherEmails"],
    ],
    listsAfter: ["otherEmailList"],
    extras: [
      ["Сошиал медиа ашигладаг эсэх", "usesSocialMedia"],
    ],
    extrasLists: ["socialList"],
    extras2: [
      ["Бусад вэб / апп идэвхтэй эсэх", "hasOtherWebPresence"],
    ],
    extras2Lists: ["otherWebList"],
  },
  {
    title: "7. Паспорт",
    fields: [
      ["Паспортын төрөл", "passportType"],
      ["Паспортын төрлийн тайлбар", "passportTypeOther"],
      ["Паспортын дугаар", "passportNumber"],
      ["Паспорт олгосон улс / байгууллага", "passportIssuingCountry"],
      ["Паспорт олгосон хот", "passportIssueCity"],
      ["Паспорт олгосон улс", "passportIssueCountry"],
      ["Паспорт олгосон огноо", "passportIssueDate"],
      ["Паспортын хүчинтэй хугацаа", "passportExpiryDate"],
      ["Паспорт үрэгдсэн / хулгайлагдсан эсэх", "lostPassport"],
    ],
    lists: ["lostPassportList"],
  },
  {
    title: "8. АНУ дахь холбоо барих хүн / байгууллага",
    fields: [
      ["Холбоо барих хүн байгаа эсэх", "hasUsContactPerson"],
      ["Холбоо барих хүний овог", "usContactSurname"],
      ["Холбоо барих хүний нэр", "usContactGivenName"],
      ["Холбоо барих байгууллага байгаа эсэх", "hasUsContactOrg"],
      ["Байгууллагын нэр", "usOrganizationName"],
      ["Хамаарал", "usContactRelationship"],
      ["Хот", "usContactCity"],
      ["Муж", "usContactState"],
      ["ZIP", "usContactZip"],
      ["Утас", "usContactPhone"],
      ["Имэйл", "usContactEmail"],
    ],
  },
  {
    title: "9. Гэр бүлийн мэдээлэл",
    fields: [
      ["Эцгийн мэдээлэл мэдэх эсэх", "knowsFatherInfo"],
      ["Эцгийн овог", "fatherSurname"],
      ["Эцгийн нэр", "fatherGivenName"],
      ["Эцгийн төрсөн огноо", "fatherDateOfBirth"],
      ["Эцэг АНУ-д байгаа эсэх", "fatherInUs"],
      ["Эцгийн АНУ дахь статус", "fatherStatus"],
      ["Эхийн мэдээлэл мэдэх эсэх", "knowsMotherInfo"],
      ["Эхийн овог", "motherSurname"],
      ["Эхийн нэр", "motherGivenName"],
      ["Эхийн төрсөн огноо", "motherDateOfBirth"],
      ["Эх АНУ-д байгаа эсэх", "motherInUs"],
      ["Эхийн АНУ дахь статус", "motherStatus"],
      ["АНУ-д ойрын төрөл садан байгаа эсэх", "hasImmediateRelativesInUs"],
    ],
    lists: ["immRelativeList"],
  },
  {
    title: "10. Эхнэр / Нөхрийн мэдээлэл",
    fields: [
      ["Эхнэр / нөхрийн овог", "spouseSurname"],
      ["Эхнэр / нөхрийн нэр", "spouseGivenName"],
      ["Эхнэр / нөхрийн төрсөн огноо", "spouseDateOfBirth"],
      ["Иргэншил", "spouseNationality"],
      ["Төрсөн хот", "spouseBirthCity"],
      ["Төрсөн улс", "spouseBirthCountry"],
      ["Гэрлэсэн огноо", "spouseMarriageDate"],
      ["Салсан / нас барсан огноо", "spouseMarriageEndDate"],
      ["Хаягийн төрөл", "spouseAddressType"],
      ["Хаяг — хот", "spouseAddressCity"],
      ["Хаяг — муж", "spouseAddressProvince"],
      ["Шуудангийн код", "spouseAddressPostalCode"],
      ["Хаяг — улс", "spouseAddressCountry"],
    ],
  },
  {
    title: "11. Одоогийн ажил / боловсрол",
    fields: [
      ["Үндсэн ажил мэргэжил", "primaryOccupation"],
      ["Мэргэжлийн тайлбар", "primaryOccupationOther"],
      ["Байгууллага / сургуулийн нэр", "presentEmployerOrSchool"],
      ["Хот", "presentEmployerCity"],
      ["Аймаг / муж", "presentEmployerProvince"],
      ["Шуудангийн код", "presentEmployerPostalCode"],
      ["Улс", "presentEmployerCountry"],
      ["Утас", "presentEmployerPhone"],
      ["Эхэлсэн огноо", "presentEmploymentStartDate"],
      ["Сарын орлого", "monthlyIncome"],
      ["Ажил үүрэг", "jobDuties"],
    ],
  },
  {
    title: "12. Өмнөх ажил",
    fields: [
      ["Өмнө ажиллаж байсан эсэх", "wasPreviouslyEmployed"],
    ],
    lists: ["prevEmpList"],
  },
  {
    title: "13. Боловсрол",
    fields: [
      ["Дээд боловсрол эзэмшсэн эсэх", "attendedHigherEducation"],
    ],
    lists: ["educationList"],
  },
  {
    title: "14. Нэмэлт мэдээлэл",
    fields: [
      ["Овог, аймаг, ястанд харьяалагддаг эсэх", "belongsToClan"],
      ["Овог / аймаг / омогийн нэр", "clanName"],
    ],
    lists: ["languageList"],
    fieldsAfter: [
      ["Сүүлийн 5 жилд гадаад зорчсон эсэх", "traveledOtherCountriesLastFiveYears"],
    ],
    listsAfter: ["countryList"],
    extras: [
      ["Байгууллагад харьяалагддаг эсэх", "belongsToOrganizations"],
    ],
    extrasLists: ["orgList"],
    extras2: [
      ["Тусгай ур чадвартай эсэх", "hasSpecialSkills"],
      ["Тусгай ур чадварын тайлбар", "specialSkillsDetails"],
      ["Цэрэгт алба хааж байсан эсэх", "servedMilitary"],
    ],
    extras2Lists: ["militaryList"],
    extras3: [
      ["Зэвсэгт бүлэгтэй холбоотой эсэх", "involvedWithParamilitary"],
      ["Тайлбар", "paramilitaryExplain"],
    ],
  },
  {
    title: "15. Аюулгүй байдал — Эрүүл мэнд",
    fields: [
      ["Халдварт өвчтэй эсэх", "securityCommunicableDisease"],
      ["Тайлбар", "securityCommunicableDiseaseExplain"],
      ["Сэтгэцийн / биеийн эмгэгтэй эсэх", "securityMentalDisorder"],
      ["Тайлбар", "securityMentalDisorderExplain"],
      ["Хар тамхи хэрэглэдэг эсэх", "securityDrugAbuse"],
      ["Тайлбар", "securityDrugAbuseExplain"],
    ],
  },
  {
    title: "16. Аюулгүй байдал — Эрүүгийн асуудал",
    fields: [
      ["Баривчлагдаж байсан эсэх", "securityArrested"],
      ["Хар тамхитай холбоотой зөрчил", "securityControlledSubstances"],
      ["Биеэ үнэлэлттэй холбоотой эсэх", "securityProstitution"],
      ["Мөнгө угаах ажиллагаанд оролцсон эсэх", "securityMoneyLaundering"],
      ["Хүн худалдаалах гэмт хэрэг", "securityHumanTrafficking"],
      ["Хүн худалдаалахад туслалцаа", "securityHumanTraffickingAid"],
      ["Хүн худалдаанаас ашиг хүртсэн эсэх", "securityTraffickingBenefit"],
      ["Эрүүгийн тайлбар", "securityCriminalExplain"],
    ],
  },
  {
    title: "17. Аюулгүй байдал — Терроризм ба хүний эрх",
    fields: [
      ["Тагнуултай холбоотой эсэх", "securityEspionage"],
      ["Терроризмтай холбоотой эсэх", "securityTerrorism"],
      ["Терроризмыг дэмжсэн эсэх", "securityTerrorismSupport"],
      ["Террор бүлгийн гишүүн эсэх", "securityTerrorismMember"],
      ["Гэр бүлийн гишүүн террор бүлэгтэй эсэх", "securityTerrorismFamily"],
      ["Хүчирхийлэл / геноцидтай холбоотой эсэх", "securityViolence"],
      ["Хүний эрхийн ноцтой зөрчил", "securityHumanRights"],
    ],
  },
  {
    title: "18. Аюулгүй байдал — Цагаачлалын хууль зөрчил",
    fields: [
      ["Визний залилан хийсэн эсэх", "securityVisaFraudSelf"],
      ["Визний залиланд туслалцаа", "securityVisaFraudAid"],
      ["Хуурамч баримт ашигласан эсэх", "securityFakeDocuments"],
      ["Визний залилангийн тайлбар", "securityVisaFraudExplain"],
      ["АНУ-аас албадан гаргуулсан эсэх", "securityDeported"],
      ["Виз зөрчиж албадан гаргуулсан эсэх", "securityVisaViolationDeported"],
      ["Албадан гаргуулсан тайлбар", "securityDeportedExplain"],
    ],
  },
  {
    title: "19. Аюулгүй байдал — Бусад",
    fields: [
      ["Хүүхдийн асрамжийн маргаан", "securityChildCustody"],
      ["Тайлбар", "securityChildCustodyExplain"],
      ["Хууль бусаар санал өгсөн эсэх", "securityIllegalVoting"],
      ["Тайлбар", "securityIllegalVotingExplain"],
      ["АНУ-ын иргэншлээс татгалзсан эсэх", "securityRenouncedCitizenship"],
      ["Тайлбар", "securityRenouncedCitizenshipExplain"],
    ],
  },
  {
    title: "20. Зураг ба паспорт",
    fields: [],
  },
  {
    title: "21. Нэмэлт тэмдэглэл",
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
  editForm.elements.appId.value = entry.appId || "";
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

function setLatestLink(url, email = "", name = "", id = "") {
  state.latestLink = url || "";
  state.latestEmail = email || "";
  state.latestName = name || "";
  state.latestId = id || "";
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

// Each entry covers one repeat group from the client form. `key` is the
// `${name}List` field, `title` is the section heading, and `summarize(row)`
// returns {primary, secondary} that the renderers turn into list items
// (modal) or table rows (PDF). Order matches the form's section order.
const REPEAT_LIST_CONFIG = [
  { key: "otherNameList", title: "Өмнө хэрэглэж байсан нэрс",
    summarize: (r) => ({
      primary: [r.surname, r.givenName].filter(Boolean).join(" "),
      secondary: "",
    }) },
  { key: "otherNatList", title: "Бусад иргэншил",
    summarize: (r) => ({
      primary: r.country || "",
      secondary: r.hasPassport === "ТИЙМ"
        ? `Паспорттой${r.passportNumber ? ` · ${r.passportNumber}` : ""}`
        : (r.hasPassport ? "Паспортгүй" : ""),
    }) },
  { key: "companionList", title: "Хамт явах хүмүүс",
    summarize: (r) => ({
      primary: [r.surname, r.givenName].filter(Boolean).join(" "),
      secondary: r.relationship || "",
    }) },
  { key: "prevVisitList", title: "Өмнөх АНУ-ын аяллууд",
    summarize: (r) => ({
      primary: r.arrivedDate || "",
      secondary: [r.lengthNumber, r.lengthUnit].filter(Boolean).join(" "),
    }) },
  { key: "otherPhoneList", title: "Бусад утасны дугаарууд",
    summarize: (r) => ({ primary: r.number || "", secondary: "" }) },
  { key: "otherEmailList", title: "Бусад и-мэйл хаягууд",
    summarize: (r) => ({ primary: r.email || "", secondary: "" }) },
  { key: "socialList", title: "Сошиал медиа хаягууд",
    summarize: (r) => ({ primary: r.platform || "", secondary: r.handle || "" }) },
  { key: "otherWebList", title: "Бусад вэб / апп платформ",
    summarize: (r) => ({ primary: r.platform || "", secondary: r.handle || "" }) },
  { key: "lostPassportList", title: "Үрэгдсэн / хулгайлагдсан паспорт",
    summarize: (r) => ({
      primary: r.number || "",
      secondary: [r.country, r.explain].filter(Boolean).join(" · "),
    }) },
  { key: "immRelativeList", title: "АНУ дахь ойрын төрөл садан",
    summarize: (r) => ({
      primary: [r.surname, r.givenName].filter(Boolean).join(" "),
      secondary: [r.relationship, r.status].filter(Boolean).join(" · "),
    }) },
  { key: "prevEmpList", title: "Өмнөх ажил байдлууд",
    summarize: (r) => ({
      primary: r.employerName || "",
      secondary: [
        r.jobTitle,
        [r.city, r.province, r.country].filter(Boolean).join(", "),
        [r.startDate, r.endDate].filter(Boolean).join(" → "),
      ].filter(Boolean).join(" · "),
    }) },
  { key: "educationList", title: "Боловсролын мэдээлэл",
    summarize: (r) => ({
      primary: r.institutionName || "",
      secondary: [
        r.courseOfStudy,
        [r.city, r.province, r.country].filter(Boolean).join(", "),
        [r.startDate, r.endDate].filter(Boolean).join(" → "),
      ].filter(Boolean).join(" · "),
    }) },
  { key: "languageList", title: "Ярьдаг хэлнүүд",
    summarize: (r) => ({ primary: r.name || "", secondary: "" }) },
  { key: "countryList", title: "Сүүлийн 5 жилд зорчсон улсууд",
    summarize: (r) => ({ primary: r.name || "", secondary: "" }) },
  { key: "orgList", title: "Харьяалагддаг байгууллагууд",
    summarize: (r) => ({ primary: r.name || "", secondary: "" }) },
  { key: "militaryList", title: "Цэргийн алба",
    summarize: (r) => ({
      primary: r.country || "",
      secondary: [
        r.branch, r.rank, r.specialty,
        [r.startDate, r.endDate].filter(Boolean).join(" → "),
      ].filter(Boolean).join(" · "),
    }) },
];

function repeatListRowsFor(entry, cfg) {
  const rows = pickList(entry, cfg.key);
  return rows
    .map((row) => ({ row, summary: cfg.summarize(row || {}) }))
    .filter(({ summary }) => (summary.primary || "").trim() || (summary.secondary || "").trim());
}

function getRepeatConfig(listKey) {
  return REPEAT_LIST_CONFIG.find((c) => c.key === listKey);
}

function renderModalListGroup(entry, listKey) {
  const cfg = getRepeatConfig(listKey);
  if (!cfg) return "";
  const rows = repeatListRowsFor(entry, cfg);
  if (!rows.length) return "";
  const items = rows.map(({ summary }, i) => `
    <div class="ds160-answer-item" style="grid-column: 1 / -1; padding-left: 12px;">
      <span>${i + 1}. ${escapeHtml(summary.primary || "-")}</span>
      <strong>${escapeHtml(summary.secondary || "")}</strong>
    </div>
  `).join("");
  return `
    <div class="ds160-answer-item" style="grid-column: 1 / -1; font-weight:600; color:#253a77;">
      <span>${escapeHtml(cfg.title)}</span>
      <strong></strong>
    </div>
    ${items}
  `;
}

function renderModalFieldRows(entry, fields) {
  return (fields || []).map(([label, key]) => `
    <div class="ds160-answer-item">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(entry[key] || "-")}</strong>
    </div>
  `).join("");
}

function renderModalSection(entry, section) {
  const blocks = [];
  blocks.push(renderModalFieldRows(entry, section.fields));
  (section.lists || []).forEach((k) => blocks.push(renderModalListGroup(entry, k)));
  blocks.push(renderModalFieldRows(entry, section.fieldsAfter));
  (section.listsAfter || []).forEach((k) => blocks.push(renderModalListGroup(entry, k)));
  blocks.push(renderModalFieldRows(entry, section.extras));
  (section.extrasLists || []).forEach((k) => blocks.push(renderModalListGroup(entry, k)));
  blocks.push(renderModalFieldRows(entry, section.extras2));
  (section.extras2Lists || []).forEach((k) => blocks.push(renderModalListGroup(entry, k)));
  blocks.push(renderModalFieldRows(entry, section.extras3));
  const inner = blocks.filter((b) => (b || "").trim()).join("");
  if (!inner) return "";
  return `<section class="ds160-answer-section">
    <h4>${escapeHtml(section.title)}</h4>
    <div class="ds160-answer-grid">${inner}</div>
  </section>`;
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
  const fullName = [surname, givenName].filter(Boolean).join(" ") || entry.clientName || "applicant";
  const photo = entry.photo || entry.payload?.photo || "";
  const photoHtml = typeof photo === "string" && photo.startsWith("data:image/")
    ? `
        <section class="ds160-answer-section">
          <h4>Photo</h4>
          <div class="ds160-answer-photo">
            <img src="${photo}" alt="DS-160 photo" style="max-width: 280px; border-radius: 8px; border: 1px solid var(--border,#d0d7e8);" />
            <div style="margin-top: 10px;">
              <a href="${photo}" download="ds160-photo-${encodeURIComponent(fullName)}.jpg" class="button-secondary" style="display:inline-block;padding:8px 14px;border-radius:8px;text-decoration:none;background:#253a77;color:#fff;font-weight:600;">Download photo</a>
            </div>
          </div>
        </section>
      `
    : "";
  answersContentNode.innerHTML = `
    <div class="ds160-answer-head">
      <h3>${escapeHtml(fullName)}</h3>
      <p>${escapeHtml(entry.clientEmail || "-")} · ${escapeHtml(entry.clientPhone || entry.primaryPhone || "-")}</p>
    </div>
    <div class="ds160-answer-sections">
      ${photoHtml}
      ${ANSWER_SECTIONS.map((section) => renderModalSection(entry, section)).join("")}
    </div>
  `;
  openAnswersModal();
}

function formatDs160Status(status) {
  switch ((status || "").toLowerCase()) {
    case "draft": return "Draft";
    case "sent": return "Sent";
    case "submitted": return "Submitted";
    case "reviewed": return "Reviewed";
    default: return status ? status : "Sent";
  }
}

function pickList(entry, key) {
  // The client form posts repeat groups as `${name}List` (e.g.
  // countryList, educationList, languageList). Server flatten preserves
  // those keys on the entry; older records keep them nested under
  // entry.payload — check both.
  const direct = entry && entry[key];
  if (Array.isArray(direct)) return direct;
  const nested = entry && entry.payload && entry.payload[key];
  if (Array.isArray(nested)) return nested;
  return [];
}

function renderPrintListGroup(entry, listKey) {
  const cfg = getRepeatConfig(listKey);
  if (!cfg) return "";
  const rows = repeatListRowsFor(entry, cfg);
  if (!rows.length) return "";
  const hasSecondary = rows.some(({ summary }) => (summary.secondary || "").trim());
  const headerCells = hasSecondary
    ? `<th style="padding:6px 10px;background:#f1f5f9;border:1px solid #e5e7eb;text-align:left;">#</th>
       <th style="padding:6px 10px;background:#f1f5f9;border:1px solid #e5e7eb;text-align:left;">Үндсэн</th>
       <th style="padding:6px 10px;background:#f1f5f9;border:1px solid #e5e7eb;text-align:left;">Дэлгэрэнгүй</th>`
    : `<th style="padding:6px 10px;background:#f1f5f9;border:1px solid #e5e7eb;text-align:left;">#</th>
       <th style="padding:6px 10px;background:#f1f5f9;border:1px solid #e5e7eb;text-align:left;">Утга</th>`;
  const body = rows.map(({ summary }, i) => hasSecondary
    ? `<tr>
        <td style="padding:6px 10px;border:1px solid #e5e7eb;width:40px;color:#475569;">${i + 1}</td>
        <td style="padding:6px 10px;border:1px solid #e5e7eb;">${escapeHtml(summary.primary || "-")}</td>
        <td style="padding:6px 10px;border:1px solid #e5e7eb;">${escapeHtml(summary.secondary || "-")}</td>
      </tr>`
    : `<tr>
        <td style="padding:6px 10px;border:1px solid #e5e7eb;width:40px;color:#475569;">${i + 1}</td>
        <td style="padding:6px 10px;border:1px solid #e5e7eb;">${escapeHtml(summary.primary || "-")}</td>
      </tr>`
  ).join("");
  return `<div style="margin:10px 0 14px;">
    <h4 style="font-size:13px;color:#253a77;margin:0 0 6px;">${escapeHtml(cfg.title)}</h4>
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <thead><tr>${headerCells}</tr></thead>
      <tbody>${body}</tbody>
    </table>
  </div>`;
}

function renderPrintFieldRows(entry, fields) {
  return (fields || [])
    .map(([label, key]) => `<tr><td style="padding:6px 10px;border:1px solid #e5e7eb;width:40%;color:#475569;">${escapeHtml(label)}</td><td style="padding:6px 10px;border:1px solid #e5e7eb;">${escapeHtml(entry[key] || "-")}</td></tr>`)
    .join("");
}

function renderPrintSection(entry, section) {
  const fieldsTable = (rows) => rows ? `<table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:8px;">${rows}</table>` : "";
  const blocks = [];
  blocks.push(fieldsTable(renderPrintFieldRows(entry, section.fields)));
  (section.lists || []).forEach((k) => blocks.push(renderPrintListGroup(entry, k)));
  blocks.push(fieldsTable(renderPrintFieldRows(entry, section.fieldsAfter)));
  (section.listsAfter || []).forEach((k) => blocks.push(renderPrintListGroup(entry, k)));
  blocks.push(fieldsTable(renderPrintFieldRows(entry, section.extras)));
  (section.extrasLists || []).forEach((k) => blocks.push(renderPrintListGroup(entry, k)));
  blocks.push(fieldsTable(renderPrintFieldRows(entry, section.extras2)));
  (section.extras2Lists || []).forEach((k) => blocks.push(renderPrintListGroup(entry, k)));
  blocks.push(fieldsTable(renderPrintFieldRows(entry, section.extras3)));
  const inner = blocks.filter((b) => (b || "").trim()).join("");
  if (!inner) return "";
  return `<section style="margin-bottom:18px;page-break-inside:avoid;">
    <h3 style="font-size:14px;color:#253a77;border-bottom:2px solid #253a77;padding-bottom:4px;margin:0 0 8px;">${escapeHtml(section.title)}</h3>
    ${inner}
  </section>`;
}

function openPrintWindow(entry) {
  const { surname, givenName } = splitClientName(entry);
  const fullName = [surname, givenName].filter(Boolean).join(" ") || entry.clientName || "applicant";
  const photo = entry.photo || entry.payload?.photo || "";
  const photoImg = typeof photo === "string" && photo.startsWith("data:image/")
    ? `<img src="${photo}" alt="Photo" style="max-width: 200px; border: 1px solid #d0d7e8; border-radius: 6px;" />` : "";
  const sections = ANSWER_SECTIONS
    .map((section) => renderPrintSection(entry, section))
    .join("");
  const html = `
    <!DOCTYPE html>
    <html><head><meta charset="UTF-8"><title>DS-160 — ${escapeHtml(fullName)}</title>
    <style>
      body { font-family: "Montserrat", Arial, sans-serif; color: #111827; margin: 24px; }
      h1 { font-size: 20px; color: #253a77; margin: 0 0 6px; }
      p.sub { color: #475569; margin: 0 0 20px; font-size: 13px; }
      .head { display: flex; gap: 20px; align-items: flex-start; margin-bottom: 20px; }
      @media print { body { margin: 12mm; } }
    </style></head><body>
      <div class="head">
        ${photoImg}
        <div>
          <h1>DS-160 — ${escapeHtml(fullName)}</h1>
          <p class="sub">${escapeHtml(entry.clientEmail || "")} · ${escapeHtml(entry.clientPhone || entry.primaryPhone || "")}<br/>Status: ${escapeHtml(formatDs160Status(entry.status))} · Submitted: ${escapeHtml(formatDateTime(entry.submittedAt || entry.createdAt))}</p>
        </div>
      </div>
      ${sections}
      <script>window.onload = function() { setTimeout(function(){ window.print(); }, 400); };<\/script>
    </body></html>
  `;
  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) { alert("Please allow pop-ups to download the PDF."); return; }
  w.document.open();
  w.document.write(html);
  w.document.close();
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
          <th>APP ID</th>
          <th>Status</th>
          <th>Date</th>
          <th>Appointment</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${pagination.items
          .map((entry) => {
            const nameParts = splitClientName(entry);
            const status = (entry.status || "sent").toLowerCase();
            return `
              <tr>
                <td>${escapeHtml(nameParts.surname || "-")}</td>
                <td>${escapeHtml(nameParts.givenName || "-")}</td>
                <td>${escapeHtml(entry.clientEmail || "-")}</td>
                <td>${escapeHtml(entry.clientPhone || entry.primaryPhone || "-")}</td>
                <td>${escapeHtml(entry.appId || "-")}</td>
                <td><span class="ds160-status-pill is-${escapeHtml(status)}">${escapeHtml(formatDs160Status(status))}</span></td>
                <td>${escapeHtml(formatDateTime(entry.submittedAt || entry.createdAt))}</td>
                <td>${escapeHtml(formatAppointment(entry.appointmentDate, entry.appointmentTime))}</td>
                <td class="ds160-actions-cell">
                  <details class="trip-menu row-action-menu ds160-action-menu">
                    <summary class="trip-menu-trigger" aria-label="DS-160 actions">⋯</summary>
                    <div class="trip-menu-popover">
                      <button type="button" class="trip-menu-item" data-action="see-answers" data-id="${escapeHtml(entry.id)}">See Answers</button>
                      <button type="button" class="trip-menu-item" data-action="download-pdf" data-id="${escapeHtml(entry.id)}">Download PDF</button>
                      <button type="button" class="trip-menu-item" data-action="copy-link" data-link="${escapeHtml(entry.shareUrl || "")}">Copy link</button>
                      <button type="button" class="trip-menu-item" data-action="edit-info" data-id="${escapeHtml(entry.id)}">Edit info</button>
                      <button type="button" class="trip-menu-item" data-action="set-appointment" data-id="${escapeHtml(entry.id)}">Set appointment</button>
                      <button type="button" class="trip-menu-item" data-action="server-send" data-id="${escapeHtml(entry.id)}">Send via TravelX</button>
                      <a class="trip-menu-item" href="${escapeHtml(buildMailtoLink(entry))}">Open in mail app</a>
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

  listNode.querySelectorAll('[data-action="server-send"]').forEach((button) => {
    button.addEventListener("click", async () => {
      const entry = state.entries.find((item) => item.id === button.dataset.id);
      if (!entry) return;
      if (!entry.clientEmail) {
        alert("Client email missing — open Edit info, fill the email, save, then send.");
        return;
      }
      button.disabled = true;
      const originalLabel = button.textContent;
      button.textContent = "Sending…";
      try {
        await fetchJson(`/api/ds160/${encodeURIComponent(entry.id)}/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        button.textContent = "Sent ✓";
        window.setTimeout(() => { button.textContent = originalLabel; button.disabled = false; }, 2200);
      } catch (err) {
        alert(err.message || "Could not send");
        button.textContent = originalLabel;
        button.disabled = false;
      }
    });
  });

  listNode.querySelectorAll('[data-action="see-answers"]').forEach((button) => {
    button.addEventListener("click", () => {
      const entry = state.entries.find((item) => item.id === button.dataset.id);
      if (!entry) return;
      renderAnswers(entry);
    });
  });

  listNode.querySelectorAll('[data-action="download-pdf"]').forEach((button) => {
    button.addEventListener("click", () => {
      const entry = state.entries.find((item) => item.id === button.dataset.id);
      if (!entry) return;
      openPrintWindow(entry);
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
      const confirmed = await UI.confirm(`Delete DS-160 record for ${entry.clientName || entry.clientEmail || "this client"}?`, { dangerous: true });
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

let entriesController = null;

function applyEntries(entries) {
  state.entries = Array.isArray(entries) ? entries : [];
  renderSummary();
  renderManagerOptions();
  renderList();
}

async function loadEntries() {
  if (entriesController) {
    entriesController.invalidate();
    return entriesController.refresh();
  }
  if (window.LiveList) {
    entriesController = window.LiveList.subscribe("/api/ds160", {
      cacheKey: "livelist:ds160",
      onData: applyEntries,
    });
    return;
  }
  const entries = await fetchJson("/api/ds160");
  applyEntries(entries);
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
    setLatestLink(entry.shareUrl || "", entry.clientEmail || "", entry.clientName || "", entry.id || "");
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

// Server-side "Send via TravelX" — uses Resend so any manager (and any
// device, even one without a desktop mail client) can actually deliver
// the share link without falling back to mailto:.
const serverSendButton = document.querySelector("#ds160-server-send");
serverSendButton?.addEventListener("click", async () => {
  if (!state.latestId) {
    setStatus("Create the link first, then send it.", true);
    return;
  }
  if (!state.latestEmail) {
    setStatus("Client email missing — open the entry, fill the email, save, then send.", true);
    return;
  }
  serverSendButton.disabled = true;
  serverSendButton.textContent = "Sending…";
  try {
    await fetchJson(`/api/ds160/${encodeURIComponent(state.latestId)}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    setStatus(`Sent to ${state.latestEmail}.`);
    serverSendButton.textContent = "Sent ✓";
    setTimeout(() => { serverSendButton.textContent = "Send via TravelX"; }, 2200);
  } catch (err) {
    setStatus(err.message || "Could not send.", true);
    serverSendButton.textContent = "Send via TravelX";
  } finally {
    serverSendButton.disabled = false;
  }
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
        appId: payload.appId,
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

// Close the row-action <details> popovers when clicking anywhere outside them
document.addEventListener("click", (event) => {
  document.querySelectorAll("details.ds160-action-menu[open]").forEach((details) => {
    if (!details.contains(event.target)) details.removeAttribute("open");
  });
});

async function init() {
  loadEntries();
  await loadTeamMembers();
  renderManagerOptions();
  renderSummary();
}

init();
