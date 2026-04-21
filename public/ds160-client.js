const form = document.querySelector("#ds160-client-form");
const statusNode = document.querySelector("#ds160-client-status");
const summaryNode = document.querySelector("#ds160-client-summary");
const mobileMenuToggle = document.querySelector("#travelx-mobile-menu-toggle");
const mobileMenu = document.querySelector("#travelx-mobile-menu");

const state = {
  mobileMenuOpen: false,
};

const COUNTRIES = [
  "AFGHANISTAN", "ALBANIA", "ALGERIA", "ANDORRA", "ANGOLA", "ANTIGUA AND BARBUDA", "ARGENTINA",
  "ARMENIA", "AUSTRALIA", "AUSTRIA", "AZERBAIJAN", "BAHAMAS", "BAHRAIN", "BANGLADESH", "BARBADOS",
  "BELARUS", "BELGIUM", "BELIZE", "BENIN", "BHUTAN", "BOLIVIA", "BOSNIA AND HERZEGOVINA", "BOTSWANA",
  "BRAZIL", "BRUNEI", "BULGARIA", "BURKINA FASO", "BURUNDI", "CABO VERDE", "CAMBODIA", "CAMEROON",
  "CANADA", "CENTRAL AFRICAN REPUBLIC", "CHAD", "CHILE", "CHINA", "COLOMBIA", "COMOROS", "CONGO",
  "COSTA RICA", "COTE D'IVOIRE", "CROATIA", "CUBA", "CYPRUS", "CZECH REPUBLIC", "DENMARK", "DJIBOUTI",
  "DOMINICA", "DOMINICAN REPUBLIC", "ECUADOR", "EGYPT", "EL SALVADOR", "EQUATORIAL GUINEA", "ERITREA",
  "ESTONIA", "ESWATINI", "ETHIOPIA", "FIJI", "FINLAND", "FRANCE", "GABON", "GAMBIA", "GEORGIA",
  "GERMANY", "GHANA", "GREECE", "GRENADA", "GUATEMALA", "GUINEA", "GUINEA-BISSAU", "GUYANA", "HAITI",
  "HONDURAS", "HUNGARY", "ICELAND", "INDIA", "INDONESIA", "IRAN", "IRAQ", "IRELAND", "ISRAEL", "ITALY",
  "JAMAICA", "JAPAN", "JORDAN", "KAZAKHSTAN", "KENYA", "KIRIBATI", "KOREA, NORTH", "KOREA, SOUTH",
  "KOSOVO", "KUWAIT", "KYRGYZSTAN", "LAOS", "LATVIA", "LEBANON", "LESOTHO", "LIBERIA", "LIBYA",
  "LIECHTENSTEIN", "LITHUANIA", "LUXEMBOURG", "MADAGASCAR", "MALAWI", "MALAYSIA", "MALDIVES", "MALI",
  "MALTA", "MARSHALL ISLANDS", "MAURITANIA", "MAURITIUS", "MEXICO", "MICRONESIA", "MOLDOVA", "MONACO",
  "MONGOLIA", "MONTENEGRO", "MOROCCO", "MOZAMBIQUE", "MYANMAR", "NAMIBIA", "NAURU", "NEPAL", "NETHERLANDS",
  "NEW ZEALAND", "NICARAGUA", "NIGER", "NIGERIA", "NORTH MACEDONIA", "NORWAY", "OMAN", "PAKISTAN",
  "PALAU", "PALESTINE", "PANAMA", "PAPUA NEW GUINEA", "PARAGUAY", "PERU", "PHILIPPINES", "POLAND",
  "PORTUGAL", "QATAR", "ROMANIA", "RUSSIA", "RWANDA", "SAINT KITTS AND NEVIS", "SAINT LUCIA",
  "SAINT VINCENT AND THE GRENADINES", "SAMOA", "SAN MARINO", "SAO TOME AND PRINCIPE", "SAUDI ARABIA",
  "SENEGAL", "SERBIA", "SEYCHELLES", "SIERRA LEONE", "SINGAPORE", "SLOVAKIA", "SLOVENIA", "SOLOMON ISLANDS",
  "SOMALIA", "SOUTH AFRICA", "SOUTH SUDAN", "SPAIN", "SRI LANKA", "SUDAN", "SURINAME", "SWEDEN",
  "SWITZERLAND", "SYRIA", "TAIWAN", "TAJIKISTAN", "TANZANIA", "THAILAND", "TIMOR-LESTE", "TOGO", "TONGA",
  "TRINIDAD AND TOBAGO", "TUNISIA", "TURKEY", "TURKMENISTAN", "TUVALU", "UGANDA", "UKRAINE",
  "UNITED ARAB EMIRATES", "UNITED KINGDOM", "UNITED STATES", "URUGUAY", "UZBEKISTAN", "VANUATU",
  "VATICAN CITY", "VENEZUELA", "VIETNAM", "YEMEN", "ZAMBIA", "ZIMBABWE"
];

const US_STATES = [
  "", "ALABAMA", "ALASKA", "ARIZONA", "ARKANSAS", "CALIFORNIA", "COLORADO", "CONNECTICUT", "DELAWARE",
  "DISTRICT OF COLUMBIA", "FLORIDA", "GEORGIA", "HAWAII", "IDAHO", "ILLINOIS", "INDIANA", "IOWA", "KANSAS",
  "KENTUCKY", "LOUISIANA", "MAINE", "MARYLAND", "MASSACHUSETTS", "MICHIGAN", "MINNESOTA", "MISSISSIPPI",
  "MISSOURI", "MONTANA", "NEBRASKA", "NEVADA", "NEW HAMPSHIRE", "NEW JERSEY", "NEW MEXICO", "NEW YORK",
  "NORTH CAROLINA", "NORTH DAKOTA", "OHIO", "OKLAHOMA", "OREGON", "PENNSYLVANIA", "RHODE ISLAND",
  "SOUTH CAROLINA", "SOUTH DAKOTA", "TENNESSEE", "TEXAS", "UTAH", "VERMONT", "VIRGINIA", "WASHINGTON",
  "WEST VIRGINIA", "WISCONSIN", "WYOMING"
];

const MONTHS = [
  ["01", "01"], ["02", "02"], ["03", "03"], ["04", "04"], ["05", "05"], ["06", "06"],
  ["07", "07"], ["08", "08"], ["09", "09"], ["10", "10"], ["11", "11"], ["12", "12"]
];

function setMobileMenuOpen(isOpen) {
  state.mobileMenuOpen = Boolean(isOpen);
  if (mobileMenu) mobileMenu.hidden = !state.mobileMenuOpen;
  if (mobileMenuToggle) mobileMenuToggle.setAttribute("aria-expanded", state.mobileMenuOpen ? "true" : "false");
  document.body.classList.toggle("travelx-menu-open", state.mobileMenuOpen);
}

function normalizeValue(value) {
  if (typeof value !== "string") return value;
  return value.trim();
}

function normalizeUppercase(value) {
  return typeof value === "string" ? value.toLocaleUpperCase("mn-MN") : value;
}

function tokenFromPath() {
  const parts = location.pathname.split("/").filter(Boolean);
  return parts[parts.length - 1] || "";
}

function fieldValue(name) {
  return normalizeValue(form.elements[name]?.value || "");
}

function formatDateParts(year, month, day) {
  if (!year || !month || !day) return "";
  return `${year}-${month}-${day}`;
}

function splitIsoDate(value) {
  const normalized = typeof value === "string" ? value.trim() : "";
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return { year: "", month: "", day: "" };
  return { year: match[1], month: match[2], day: match[3] };
}

function setSelectOptions(select, options, placeholder = "Сонгох") {
  if (!select) return;
  select.innerHTML = `<option value="">${placeholder}</option>${options
    .map((option) => `<option value="${option}">${option}</option>`)
    .join("")}`;
}

function populateStaticOptions() {
  document.querySelectorAll("[data-country-select]").forEach((select) => {
    setSelectOptions(select, COUNTRIES, "Сонгох");
  });
  document.querySelectorAll("[data-us-state-select]").forEach((select) => {
    setSelectOptions(select, US_STATES.filter(Boolean), "- SELECT ONE -");
  });
  document.querySelectorAll("[data-day-select]").forEach((select) => {
    setSelectOptions(
      select,
      Array.from({ length: 31 }, (_, index) => String(index + 1).padStart(2, "0")),
      "Өдөр"
    );
  });
  document.querySelectorAll("[data-month-select]").forEach((select) => {
    select.innerHTML = `<option value="">Сар</option>${MONTHS.map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}`;
  });
  document.querySelectorAll("[data-birth-year-select]").forEach((select) => {
    const currentYear = new Date().getFullYear();
    setSelectOptions(
      select,
      Array.from({ length: currentYear - 1899 }, (_, index) => String(currentYear - index)),
      "Жил"
    );
  });
  document.querySelectorAll("[data-future-year-select]").forEach((select) => {
    const currentYear = new Date().getFullYear();
    setSelectOptions(
      select,
      Array.from({ length: 15 }, (_, index) => String(currentYear + index)),
      "Жил"
    );
  });
}

function setFieldValue(name, value) {
  const field = form.elements[name];
  if (!field) return;
  field.value = value || "";
}

function setDateSplit(prefix, value) {
  const parts = splitIsoDate(value);
  setFieldValue(`${prefix}Year`, parts.year);
  setFieldValue(`${prefix}Month`, parts.month);
  setFieldValue(`${prefix}Day`, parts.day);
}

function toggleElement(id, visible) {
  const element = document.getElementById(id);
  if (!element) return;
  element.hidden = !visible;
  element.setAttribute("aria-hidden", visible ? "false" : "true");
  element.classList.toggle("is-hidden", !visible);
  element.style.display = visible ? "" : "none";
}

function syncConditionalFields() {
  const usedOtherNames = fieldValue("usedOtherNames") === "ТИЙМ";
  toggleElement("previous-surname-field", usedOtherNames);
  toggleElement("previous-given-name-field", usedOtherNames);

  const hasTelecode = fieldValue("hasTelecode") === "ТИЙМ";
  toggleElement("telecode-field", hasTelecode);

  const hadOtherNationality = fieldValue("hadOtherNationality") === "ТИЙМ";
  toggleElement("other-nationality-field", hadOtherNationality);

  const hasUsSsn = fieldValue("hasUsSsn") === "ТИЙМ";
  toggleElement("us-ssn-field", hasUsSsn);

  const hasUsTaxId = fieldValue("hasUsTaxId") === "ТИЙМ";
  toggleElement("us-tax-id-field", hasUsTaxId);

  const purposeCategory = fieldValue("tripPurposeCategory");
  toggleElement("trip-purpose-detail-field", purposeCategory === "B");

  const hasSpecificTravelPlans = fieldValue("hasSpecificTravelPlans") === "ТИЙМ";
  toggleElement("travel-itinerary-fields", hasSpecificTravelPlans);

  const tripPayer = fieldValue("tripPayer");
  toggleElement("trip-payer-fields", Boolean(tripPayer) && tripPayer !== "SELF");

  const travelingWithOthers = fieldValue("travelingWithOthers") === "ТИЙМ";
  const travelingWithGroup = fieldValue("travelingWithGroup") === "ТИЙМ";
  toggleElement("travel-companions-field", travelingWithOthers || travelingWithGroup);

  toggleElement("previous-us-travel-details-field", [
    fieldValue("beenInUs"),
    fieldValue("hadUsVisa"),
    fieldValue("visaRefused"),
    fieldValue("immigrantPetitionFiled"),
  ].includes("ТИЙМ"));

  toggleElement("mailing-address-field", fieldValue("mailingSameAsHome") === "ҮГҮЙ");
  toggleElement("other-phone-details-field", fieldValue("usedOtherPhones") === "ТИЙМ");
  toggleElement("other-email-details-field", fieldValue("usedOtherEmails") === "ТИЙМ");
  toggleElement("passport-book-number-field", fieldValue("passportBookNumberNotApplicable") === "ҮГҮЙ");
  toggleElement("lost-passport-details-field", fieldValue("lostPassport") === "ТИЙМ");
  toggleElement("relatives-in-us-details-field", [fieldValue("hasImmediateRelativesInUs"), fieldValue("hasOtherRelativesInUs")].includes("ТИЙМ"));

  toggleElement("other-web-presence-field", fieldValue("hasOtherWebPresence") === "ТИЙМ");
  toggleElement("clan-details-field", fieldValue("belongsToClan") === "ТИЙМ");
  toggleElement("countries-visited-field", fieldValue("traveledOtherCountriesLastFiveYears") === "ТИЙМ");
  toggleElement("organization-details-field", fieldValue("belongsToOrganizations") === "ТИЙМ");
  toggleElement("special-skills-field", fieldValue("hasSpecialSkills") === "ТИЙМ");
  toggleElement("military-unit-field", fieldValue("servedMilitary") === "ТИЙМ");
  toggleElement(
    "military-security-details-field",
    fieldValue("servedMilitary") === "ТИЙМ" || fieldValue("hasSpecialSkills") === "ТИЙМ" || fieldValue("involvedWithParamilitary") === "ТИЙМ"
  );

  const anySecurityYes = [
    "securityCommunicableDisease", "securityMentalDisorder", "securityDrugAbuse", "securityArrested",
    "securityControlledSubstances", "securityProstitution", "securityMoneyLaundering", "securityHumanTrafficking",
    "securityTerrorism", "securityViolence", "securityHumanRights", "securityVisaFraud", "securityDeported",
    "securityChildCustody", "securityIllegalVoting", "securityRenouncedCitizenship",
  ].some((name) => fieldValue(name) === "ТИЙМ");
  toggleElement("security-background-details-field", anySecurityYes);
}

function bindConditionalFields() {
  [
    "usedOtherNames", "hasTelecode", "hadOtherNationality", "hasUsSsn", "hasUsTaxId",
    "tripPurposeCategory", "hasSpecificTravelPlans", "tripPayer", "travelingWithOthers",
    "travelingWithGroup", "beenInUs", "hadUsVisa", "visaRefused", "immigrantPetitionFiled",
    "mailingSameAsHome", "usedOtherPhones", "usedOtherEmails", "passportBookNumberNotApplicable",
    "lostPassport", "hasImmediateRelativesInUs", "hasOtherRelativesInUs", "hasOtherWebPresence",
    "belongsToClan", "traveledOtherCountriesLastFiveYears", "belongsToOrganizations",
    "hasSpecialSkills", "servedMilitary", "involvedWithParamilitary",
    "securityCommunicableDisease", "securityMentalDisorder", "securityDrugAbuse", "securityArrested",
    "securityControlledSubstances", "securityProstitution", "securityMoneyLaundering", "securityHumanTrafficking",
    "securityTerrorism", "securityViolence", "securityHumanRights", "securityVisaFraud",
    "securityDeported", "securityChildCustody", "securityIllegalVoting", "securityRenouncedCitizenship",
  ].forEach((name) => {
    form.elements[name]?.addEventListener("change", syncConditionalFields);
  });
  syncConditionalFields();
}

function bindUppercaseFields() {
  form.querySelectorAll('input:not([type="date"]):not([type="time"]), textarea').forEach((field) => {
    field.addEventListener("input", () => {
      const start = field.selectionStart;
      const end = field.selectionEnd;
      field.value = normalizeUppercase(field.value);
      if (typeof start === "number" && typeof end === "number") {
        field.setSelectionRange(start, end);
      }
    });
  });
}

function buildPayload(formNode) {
  const formData = new FormData(formNode);
  const payload = {};
  for (const [key, value] of formData.entries()) {
    if (
      [
        "birthDay", "birthMonth", "birthYear",
        "arrivalDay", "arrivalMonth", "arrivalYear",
        "departureDay", "departureMonth", "departureYear",
      ].includes(key)
    ) {
      continue;
    }
    payload[key] = normalizeUppercase(normalizeValue(value));
  }

  payload.dateOfBirth = formatDateParts(fieldValue("birthYear"), fieldValue("birthMonth"), fieldValue("birthDay"));
  payload.intendedArrivalDate = formatDateParts(fieldValue("arrivalYear"), fieldValue("arrivalMonth"), fieldValue("arrivalDay"));
  payload.intendedDepartureDate = formatDateParts(fieldValue("departureYear"), fieldValue("departureMonth"), fieldValue("departureDay"));
  payload.otherNamesDetails = [fieldValue("previousSurname"), fieldValue("previousGivenName")].filter(Boolean).join(" ");
  payload.usStayAddress = [
    fieldValue("usStayAddressLine1"),
    fieldValue("usStayAddressLine2"),
    fieldValue("usStayCity"),
    fieldValue("usStayState"),
    fieldValue("usStayZip"),
  ].filter(Boolean).join(", ");
  payload.submittedFrom = "travelx-ds160-client-link";
  return payload;
}

function validatePayload(payload) {
  const required = [
    ["surname", "Овог"],
    ["givenName", "Нэр"],
    ["nativeFullName", "Криллээр өөрийн нэр"],
    ["sex", "Хүйс"],
    ["maritalStatus", "Гэрлэлтийн лавлагаа"],
    ["dateOfBirth", "Төрсөн өдөр"],
    ["birthCountry", "Төрсөн улс"],
    ["nationality", "Одоогийн иргэншил"],
    ["registerNumber", "Регистрийн дугаар"],
    ["email", "Имэйл"],
    ["primaryPhone", "Үндсэн утас"],
    ["passportNumber", "Паспортын дугаар"],
    ["passportIssueDate", "Паспорт олгосон өдөр"],
    ["passportExpiryDate", "Паспортын хүчинтэй хугацаа"],
    ["tripPurposeCategory", "Аяллын зорилго"],
  ];

  const missing = required.filter(([field]) => !payload[field]).map(([, label]) => label);
  if (payload.usedOtherNames === "ТИЙМ") {
    if (!payload.previousSurname) missing.push("Өмнөх овог");
    if (!payload.previousGivenName) missing.push("Өмнөх нэр");
  }
  if (payload.hasTelecode === "ТИЙМ" && !payload.telecode) missing.push("Теле код");
  if (payload.hadOtherNationality === "ТИЙМ" && !payload.otherNationalityCountry) missing.push("Өөр улсын иргэншил");
  if (payload.hasUsSsn === "ТИЙМ" && !payload.usSsn) missing.push("US нийгмийн даатгалын дугаар");
  if (payload.hasUsTaxId === "ТИЙМ" && !payload.usTaxId) missing.push("US татвар төлөгчийн дугаар");
  if (payload.tripPurposeCategory === "B" && !payload.tripPurposeDetail) missing.push("Аяллын зорилгын тодруулга");
  if (payload.hasSpecificTravelPlans === "ТИЙМ") {
    [
      ["intendedArrivalDate", "АНУ-д очих өдөр"],
      ["arrivalCity", "Очих хот"],
      ["intendedDepartureDate", "АНУ-аас гарах өдөр"],
      ["departureCity", "Гарах хот"],
      ["usLocations", "АНУ-д очих газрууд"],
      ["usStayAddressLine1", "АНУ-д байрлах хаяг"],
      ["usStayCity", "АНУ-д байрлах хот"],
      ["usStayState", "АНУ-д байрлах муж"],
    ].forEach(([field, label]) => {
      if (!payload[field]) missing.push(label);
    });
  }
  if (payload.tripPayer && payload.tripPayer !== "SELF") {
    [
      ["tripPayerSurname", "Төлбөр төлж буй хүний овог"],
      ["tripPayerGivenName", "Төлбөр төлж буй хүний нэр"],
      ["tripPayerPhone", "Төлбөр төлж буй хүний утас"],
      ["tripPayerRelationship", "Төлбөр төлж буй талын харилцаа"],
    ].forEach(([field, label]) => {
      if (!payload[field]) missing.push(label);
    });
  }
  if ((payload.travelingWithOthers === "ТИЙМ" || payload.travelingWithGroup === "ТИЙМ") && !payload.travelCompanions) {
    missing.push("Хамт явах хүмүүсийн мэдээлэл");
  }
  return missing;
}

function setSubmittingState(isSubmitting) {
  const button = form.querySelector('button[type="submit"]');
  button.disabled = isSubmitting;
  button.textContent = isSubmitting ? "Илгээж байна..." : "Мэдээлэл илгээх";
}

function applyPayload(payload) {
  Object.entries(payload || {}).forEach(([key, value]) => {
    if (!form.elements[key]) return;
    setFieldValue(key, value);
  });

  setDateSplit("birth", payload?.dateOfBirth);
  setDateSplit("arrival", payload?.intendedArrivalDate);
  setDateSplit("departure", payload?.intendedDepartureDate);

  if (payload?.otherNamesDetails && !fieldValue("previousSurname") && !fieldValue("previousGivenName")) {
    const parts = normalizeValue(payload.otherNamesDetails).split(/\s+/).filter(Boolean);
    if (parts.length) {
      setFieldValue("previousSurname", parts[0]);
      setFieldValue("previousGivenName", parts.slice(1).join(" "));
    }
  }
}

async function loadForm() {
  const token = tokenFromPath();
  const response = await fetch(`/api/ds160/public/${encodeURIComponent(token)}`);
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || "Form not found");
  }
  const entry = result.entry || {};
  summaryNode.textContent = `${entry.clientName || "Харилцагч"} • ${entry.clientEmail || "-"} • Менежер: ${entry.managerName || "-"}`;
  try {
    applyPayload(entry.payload || {});
  } catch (error) {
    console.error(error);
    statusNode.textContent = "Өмнөх мэдээллийг бүрэн ачаалж чадсангүй. Шинээр бөглөж болно.";
    statusNode.dataset.tone = "error";
  }
  if (!fieldValue("nationality")) setFieldValue("nationality", "MONGOLIA");
  if (!fieldValue("birthCountry")) setFieldValue("birthCountry", "MONGOLIA");
  syncConditionalFields();
  if (entry.submittedAt) {
    statusNode.textContent = "Өмнөх хадгалсан хариулт ачааллаа.";
    statusNode.dataset.tone = "ok";
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const token = tokenFromPath();
  const payload = buildPayload(form);
  const missing = validatePayload(payload);

  if (missing.length) {
    statusNode.textContent = `Дутуу талбарууд: ${missing.join(", ")}`;
    statusNode.dataset.tone = "error";
    return;
  }

  setSubmittingState(true);
  statusNode.textContent = "Мэдээлэл хадгалж байна...";
  delete statusNode.dataset.tone;

  try {
    const response = await fetch(`/api/ds160/public/${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || "Мэдээлэл илгээх үед алдаа гарлаа.");
    }
    statusNode.textContent = "Амжилттай. Таны мэдээлэл хадгалагдлаа.";
    statusNode.dataset.tone = "ok";
  } catch (error) {
    statusNode.textContent = error.message;
    statusNode.dataset.tone = "error";
  } finally {
    setSubmittingState(false);
  }
});

populateStaticOptions();
bindConditionalFields();
bindUppercaseFields();

mobileMenuToggle?.addEventListener("click", () => setMobileMenuOpen(!state.mobileMenuOpen));
mobileMenu?.addEventListener("click", (event) => {
  if (event.target === mobileMenu) setMobileMenuOpen(false);
});

loadForm().catch((error) => {
  console.error(error);
  summaryNode.textContent = error.message;
  statusNode.textContent = error.message;
  statusNode.dataset.tone = "error";
});
