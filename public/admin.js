const submissionList = document.querySelector("#submission-list");
const refreshButton = document.querySelector("#refresh-button");
const exportButton = document.querySelector("#export-button");
const tokenInput = document.querySelector("#admin-token");

let currentSubmissions = [];

const SUMMARY_COLUMNS = [
  "createdAt",
  "applicantName",
  "surname",
  "givenName",
  "passportNumber",
  "email",
  "primaryPhone",
  "nationality",
  "tripPurposeCategory",
  "intendedArrivalDate",
  "visaRefused",
  "notes",
];

const FIELD_LABELS = {
  surname: "Овог",
  givenName: "Нэр",
  nativeFullName: "Төрсөн хэлээрх бүтэн нэр",
  sex: "Хүйс",
  maritalStatus: "Гэр бүлийн байдал",
  dateOfBirth: "Төрсөн өдөр",
  birthCity: "Төрсөн хот",
  birthProvince: "Төрсөн аймаг / муж",
  birthCountry: "Төрсөн улс",
  nationality: "Иргэншил",
  usedOtherNames: "Өөр нэр хэрэглэж байсан эсэх",
  otherNamesDetails: "Өөр нэрс",
  hasTelecode: "Зип кодтой эсэх",
  telecode: "Зип код",
  homeAddressLine1: "Гэрийн хаяг 1",
  homeAddressLine2: "Гэрийн хаяг 2",
  homeCity: "Гэрийн хот",
  homeProvince: "Гэрийн аймаг / муж",
  homePostalCode: "Шуудангийн код",
  homeCountry: "Гэрийн улс",
  mailingSameAsHome: "Шуудангийн хаяг ижил эсэх",
  mailingAddress: "Шуудангийн хаяг",
  primaryPhone: "Үндсэн утас",
  secondaryPhone: "Нэмэлт утас",
  workPhone: "Ажлын утас",
  usedOtherPhones: "Өөр утас хэрэглэж байсан эсэх",
  otherPhoneDetails: "Өөр утаснууд",
  email: "Имэйл",
  usedOtherEmails: "Өөр имэйл хэрэглэж байсан эсэх",
  otherEmailDetails: "Өөр имэйлүүд",
  passportType: "Паспортын төрөл",
  passportNumber: "Паспортын дугаар",
  passportBookNumberNotApplicable: "Паспортын дэвтрийн дугаар байхгүй эсэх",
  passportBookNumber: "Паспортын дэвтрийн дугаар",
  passportIssuingCountry: "Паспорт олгосон улс / байгууллага",
  passportIssueCity: "Паспорт олгосон хот",
  passportIssueProvince: "Паспорт олгосон аймаг / муж",
  passportIssueCountry: "Паспорт олгосон улс",
  passportIssueDate: "Паспорт олгосон өдөр",
  passportExpiryDate: "Паспортын дуусах өдөр",
  lostPassport: "Паспорт үрэгдүүлж байсан эсэх",
  lostPassportDetails: "Паспортын тайлбар",
  tripPurposeCategory: "Аяллын зорилго",
  tripPurposeDetail: "Дэлгэрэнгүй төрөл",
  hasSpecificTravelPlans: "Тодорхой төлөвлөгөөтэй эсэх",
  intendedArrivalDate: "АНУ-д очих өдөр",
  lengthOfStayValue: "Байх хугацаа",
  lengthOfStayUnit: "Хугацааны нэгж",
  usStayAddress: "АНУ-д байрлах хаяг",
  tripPayer: "Аяллын зардал төлөгч",
  arrivalCity: "Очих хот",
  travelingWithOthers: "Хамт явах хүнтэй эсэх",
  travelingWithGroup: "Баг / байгууллагатай явах эсэх",
  travelCompanions: "Хамт явах хүмүүс",
  beenInUs: "Өмнө нь АНУ-д очиж байсан эсэх",
  hadUsVisa: "Өмнө нь АНУ-ын виз авч байсан эсэх",
  visaRefused: "Визээс татгалзаж байсан эсэх",
  immigrantPetitionFiled: "Цагаачлалын өргөдөл гарч байсан эсэх",
  previousUsTravelDetails: "Өмнөх АНУ аяллын тайлбар",
  usContactSurname: "АНУ дахь холбоо барих хүний овог",
  usContactGivenName: "АНУ дахь холбоо барих хүний нэр",
  usOrganizationName: "АНУ дахь байгууллагын нэр",
  usContactRelationship: "АНУ дахь холбоо барих хүнтэй холбоо",
  usContactPhone: "АНУ дахь холбоо барих утас",
  usContactAddress: "АНУ дахь холбоо барих хаяг",
  usContactEmail: "АНУ дахь холбоо барих имэйл",
  fatherSurname: "Эцгийн овог",
  fatherGivenName: "Эцгийн нэр",
  fatherDateOfBirth: "Эцгийн төрсөн өдөр",
  fatherInUs: "Эцэг АНУ-д байгаа эсэх",
  motherSurname: "Эхийн овог",
  motherGivenName: "Эхийн нэр",
  motherDateOfBirth: "Эхийн төрсөн өдөр",
  motherInUs: "Эх АНУ-д байгаа эсэх",
  hasImmediateRelativesInUs: "АНУ-д ойрын хамаатан байгаа эсэх",
  hasOtherRelativesInUs: "АНУ-д бусад хамаатан байгаа эсэх",
  relativesInUsDetails: "Төрөл садангийн тайлбар",
  spouseSurname: "Эхнэр / нөхрийн овог",
  spouseGivenName: "Эхнэр / нөхрийн нэр",
  spouseDateOfBirth: "Эхнэр / нөхрийн төрсөн өдөр",
  spouseNationality: "Эхнэр / нөхрийн иргэншил",
  spouseBirthCity: "Эхнэр / нөхрийн төрсөн хот",
  spouseBirthCountry: "Эхнэр / нөхрийн төрсөн улс",
  spouseAddress: "Эхнэр / нөхрийн хаяг",
  primaryOccupation: "Үндсэн ажил мэргэжил",
  presentEmployerOrSchool: "Одоогийн байгууллага / сургууль",
  presentEmployerAddress: "Одоогийн байгууллагын хаяг",
  presentEmploymentStartDate: "Одоогийн ажлын эхэлсэн өдөр",
  monthlyIncome: "Сарын орлого",
  presentEmployerPhone: "Байгууллагын утас",
  jobTitle: "Албан тушаал",
  supervisorSurname: "Удирдлагын овог",
  supervisorGivenName: "Удирдлагын нэр",
  jobDuties: "Ажлын үүрэг",
  attendedHigherEducation: "Их, дээд сургуульд сурч байсан эсэх",
  previousEmploymentOrEducation: "Өмнөх ажил / сургуулийн мэдээлэл",
  socialMediaAccounts: "Сошиал хаягууд",
  hasOtherWebPresence: "Бусад вэбсайт / апп хэрэглэдэг эсэх",
  otherWebPresenceDetails: "Бусад вэб / апп",
  belongsToClan: "Овог аймагт харьяалагддаг эсэх",
  languagesSpoken: "Ярьдаг хэлнүүд",
  traveledOtherCountriesLastFiveYears: "Сүүлийн 5 жилд гадаадад явсан эсэх",
  countriesVisitedDetails: "Зорчсон улсууд",
  belongsToOrganizations: "Байгууллагад харьяалагддаг эсэх",
  organizationDetails: "Байгууллагын мэдээлэл",
  hasSpecialSkills: "Тусгай ур чадвартай эсэх",
  specialSkillsDetails: "Тусгай ур чадвар",
  servedMilitary: "Цэргийн алба хаасан эсэх",
  involvedWithParamilitary: "Зэвсэгт бүлэгтэй холбоотой эсэх",
  militaryOrSecurityDetails: "Цэрэг / аюулгүй байдлын тайлбар",
  securityCommunicableDisease: "Халдварт өвчин",
  securityMentalDisorder: "Сэтгэц / биеийн эмгэг",
  securityDrugAbuse: "Хар тамхи",
  securityArrested: "Баривчлагдаж байсан эсэх",
  securityControlledSubstances: "Хар тамхины хууль",
  securityProstitution: "Биеэ үнэлэлт",
  securityMoneyLaundering: "Мөнгө угаах",
  securityHumanTrafficking: "Хүн худалдаалах",
  securityTerrorism: "Терроризм",
  securityViolence: "Хүчирхийллийн гэмт хэрэг",
  securityHumanRights: "Хүний эрхийн ноцтой зөрчил",
  securityVisaFraud: "Визний луйвар",
  securityDeported: "Депортлуулж байсан эсэх",
  securityChildCustody: "Хүүхдийн асрамжийн асуудал",
  securityIllegalVoting: "Хууль бус санал өгөх",
  securityRenouncedCitizenship: "Иргэншлээс татгалзсан эсэх",
  securityBackgroundDetails: "Аюулгүй байдлын тайлбар",
  notes: "Нэмэлт тайлбар",
  createdAt: "Илгээсэн огноо",
  applicantName: "Өргөдөл гаргагчийн нэр",
};

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderValue(label, value) {
  return `
    <div class="detail">
      <span>${label}</span>
      <strong>${escapeHtml(value || "-")}</strong>
    </div>
  `;
}

function renderSubmission(entry) {
  const visibleEntries = Object.entries(entry).filter(
    ([key, value]) =>
      !["id", "wordPath", "pdfViewPath"].includes(key) &&
      value !== "" &&
      value !== null &&
      value !== undefined
  );

  return `
    <article class="submission-card">
      <div class="submission-top">
        <div>
          <h3>${escapeHtml(entry.applicantName || `${entry.surname || ""} ${entry.givenName || ""}`.trim() || "Нэргүй")}</h3>
          <p>${escapeHtml(entry.passportNumber || "-")} · ${escapeHtml(entry.email || "-")}</p>
        </div>
        <time>${new Date(entry.createdAt).toLocaleString("mn-MN")}</time>
      </div>
      <div class="details-grid">
        ${visibleEntries
          .map(([key, value]) => renderValue(FIELD_LABELS[key] || key, value))
          .join("")}
      </div>
    </article>
  `;
}

function renderSubmissions(submissions) {
  currentSubmissions = submissions;

  if (!submissions.length) {
    submissionList.innerHTML = '<p class="empty">Одоогоор илгээсэн мэдээлэл алга.</p>';
    return;
  }

  submissionList.innerHTML = submissions.map(renderSubmission).join("");
}

async function loadSubmissions() {
  submissionList.innerHTML = '<p class="empty">Мэдээлэл ачаалж байна...</p>';
  const token = tokenInput.value.trim();

  if (!token) {
    submissionList.innerHTML = '<p class="empty">Эхлээд админ токеноо оруулна уу.</p>';
    return;
  }

  try {
    const response = await fetch(`/api/ds160?token=${encodeURIComponent(token)}`);

    if (response.status === 401) {
      submissionList.innerHTML = '<p class="empty">Админ токен буруу байна.</p>';
      return;
    }

    const submissions = await response.json();
    renderSubmissions(submissions);
  } catch (error) {
    submissionList.innerHTML = '<p class="empty">Мэдээлэл ачаалж чадсангүй.</p>';
  }
}

function exportCsv() {
  if (!currentSubmissions.length) {
    submissionList.innerHTML = '<p class="empty">CSV татах мэдээлэл алга.</p>';
    return;
  }

  const rows = [
    SUMMARY_COLUMNS.join(","),
    ...currentSubmissions.map((entry) =>
      SUMMARY_COLUMNS.map((column) => {
        const value = String(entry[column] || "").replaceAll('"', '""');
        return `"${value}"`;
      }).join(",")
    ),
  ];

  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "ds160-mn-submissions.csv";
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
