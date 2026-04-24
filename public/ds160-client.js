const form = document.querySelector("#ds160-client-form");
const statusNode = document.querySelector("#ds160-client-status");
const summaryNode = document.querySelector("#ds160-client-summary");
const mobileMenuToggle = document.querySelector("#travelx-mobile-menu-toggle");
const mobileMenu = document.querySelector("#travelx-mobile-menu");

const state = { mobileMenuOpen: false };

const COUNTRIES = [
  "AFGHANISTAN","ALBANIA","ALGERIA","ANDORRA","ANGOLA","ANTIGUA AND BARBUDA","ARGENTINA",
  "ARMENIA","AUSTRALIA","AUSTRIA","AZERBAIJAN","BAHAMAS","BAHRAIN","BANGLADESH","BARBADOS",
  "BELARUS","BELGIUM","BELIZE","BENIN","BHUTAN","BOLIVIA","BOSNIA AND HERZEGOVINA","BOTSWANA",
  "BRAZIL","BRUNEI","BULGARIA","BURKINA FASO","BURUNDI","CABO VERDE","CAMBODIA","CAMEROON",
  "CANADA","CENTRAL AFRICAN REPUBLIC","CHAD","CHILE","CHINA","COLOMBIA","COMOROS","CONGO",
  "COSTA RICA","COTE D'IVOIRE","CROATIA","CUBA","CYPRUS","CZECH REPUBLIC","DENMARK","DJIBOUTI",
  "DOMINICA","DOMINICAN REPUBLIC","ECUADOR","EGYPT","EL SALVADOR","EQUATORIAL GUINEA","ERITREA",
  "ESTONIA","ESWATINI","ETHIOPIA","FIJI","FINLAND","FRANCE","GABON","GAMBIA","GEORGIA",
  "GERMANY","GHANA","GREECE","GRENADA","GUATEMALA","GUINEA","GUINEA-BISSAU","GUYANA","HAITI",
  "HONDURAS","HUNGARY","ICELAND","INDIA","INDONESIA","IRAN","IRAQ","IRELAND","ISRAEL","ITALY",
  "JAMAICA","JAPAN","JORDAN","KAZAKHSTAN","KENYA","KIRIBATI","KOREA, NORTH","KOREA, SOUTH",
  "KOSOVO","KUWAIT","KYRGYZSTAN","LAOS","LATVIA","LEBANON","LESOTHO","LIBERIA","LIBYA",
  "LIECHTENSTEIN","LITHUANIA","LUXEMBOURG","MADAGASCAR","MALAWI","MALAYSIA","MALDIVES","MALI",
  "MALTA","MARSHALL ISLANDS","MAURITANIA","MAURITIUS","MEXICO","MICRONESIA","MOLDOVA","MONACO",
  "MONGOLIA","MONTENEGRO","MOROCCO","MOZAMBIQUE","MYANMAR","NAMIBIA","NAURU","NEPAL","NETHERLANDS",
  "NEW ZEALAND","NICARAGUA","NIGER","NIGERIA","NORTH MACEDONIA","NORWAY","OMAN","PAKISTAN",
  "PALAU","PALESTINE","PANAMA","PAPUA NEW GUINEA","PARAGUAY","PERU","PHILIPPINES","POLAND",
  "PORTUGAL","QATAR","ROMANIA","RUSSIA","RWANDA","SAINT KITTS AND NEVIS","SAINT LUCIA",
  "SAINT VINCENT AND THE GRENADINES","SAMOA","SAN MARINO","SAO TOME AND PRINCIPE","SAUDI ARABIA",
  "SENEGAL","SERBIA","SEYCHELLES","SIERRA LEONE","SINGAPORE","SLOVAKIA","SLOVENIA","SOLOMON ISLANDS",
  "SOMALIA","SOUTH AFRICA","SOUTH SUDAN","SPAIN","SRI LANKA","SUDAN","SURINAME","SWEDEN",
  "SWITZERLAND","SYRIA","TAIWAN","TAJIKISTAN","TANZANIA","THAILAND","TIMOR-LESTE","TOGO","TONGA",
  "TRINIDAD AND TOBAGO","TUNISIA","TURKEY","TURKMENISTAN","TUVALU","UGANDA","UKRAINE",
  "UNITED ARAB EMIRATES","UNITED KINGDOM","UNITED STATES","URUGUAY","UZBEKISTAN","VANUATU",
  "VATICAN CITY","VENEZUELA","VIETNAM","YEMEN","ZAMBIA","ZIMBABWE"
];

const US_STATES = [
  "ALABAMA","ALASKA","ARIZONA","ARKANSAS","CALIFORNIA","COLORADO","CONNECTICUT","DELAWARE",
  "DISTRICT OF COLUMBIA","FLORIDA","GEORGIA","HAWAII","IDAHO","ILLINOIS","INDIANA","IOWA","KANSAS",
  "KENTUCKY","LOUISIANA","MAINE","MARYLAND","MASSACHUSETTS","MICHIGAN","MINNESOTA","MISSISSIPPI",
  "MISSOURI","MONTANA","NEBRASKA","NEVADA","NEW HAMPSHIRE","NEW JERSEY","NEW MEXICO","NEW YORK",
  "NORTH CAROLINA","NORTH DAKOTA","OHIO","OKLAHOMA","OREGON","PENNSYLVANIA","RHODE ISLAND",
  "SOUTH CAROLINA","SOUTH DAKOTA","TENNESSEE","TEXAS","UTAH","VERMONT","VIRGINIA","WASHINGTON",
  "WEST VIRGINIA","WISCONSIN","WYOMING"
];

const MONTHS = [
  ["01","01"],["02","02"],["03","03"],["04","04"],["05","05"],["06","06"],
  ["07","07"],["08","08"],["09","09"],["10","10"],["11","11"],["12","12"]
];

// ==========================================================================
// Utilities
// ==========================================================================
function setMobileMenuOpen(isOpen) {
  state.mobileMenuOpen = Boolean(isOpen);
  if (mobileMenu) mobileMenu.hidden = !state.mobileMenuOpen;
  if (mobileMenuToggle) mobileMenuToggle.setAttribute("aria-expanded", state.mobileMenuOpen ? "true" : "false");
  document.body.classList.toggle("travelx-menu-open", state.mobileMenuOpen);
}

function normalizeValue(v) { return typeof v === "string" ? v.trim() : v; }
function normalizeUppercase(v) { return typeof v === "string" ? v.toLocaleUpperCase("mn-MN") : v; }
function tokenFromPath() {
  const parts = location.pathname.split("/").filter(Boolean);
  return parts[parts.length - 1] || "";
}
function fieldValue(name) { return normalizeValue(form.elements[name]?.value || ""); }
function formatDateParts(y, m, d) { return (!y || !m || !d) ? "" : `${y}-${m}-${d}`; }
function splitIsoDate(v) {
  const m = (typeof v === "string" ? v.trim() : "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? { year: m[1], month: m[2], day: m[3] } : { year: "", month: "", day: "" };
}

function setSelectOptions(select, options, placeholder = "Сонгох") {
  if (!select) return;
  select.innerHTML = `<option value="">${placeholder}</option>${options
    .map((o) => `<option value="${o}">${o}</option>`)
    .join("")}`;
}

function populateStaticOptions(root = document) {
  root.querySelectorAll("[data-country-select]").forEach((s) => {
    if (!s.dataset.populated) { setSelectOptions(s, COUNTRIES); s.dataset.populated = "1"; }
  });
  root.querySelectorAll("[data-us-state-select]").forEach((s) => {
    if (!s.dataset.populated) { setSelectOptions(s, US_STATES, "- SELECT ONE -"); s.dataset.populated = "1"; }
  });
  root.querySelectorAll("[data-day-select]").forEach((s) => {
    if (!s.dataset.populated) {
      setSelectOptions(s, Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0")), "Өдөр");
      s.dataset.populated = "1";
    }
  });
  root.querySelectorAll("[data-month-select]").forEach((s) => {
    if (!s.dataset.populated) {
      s.innerHTML = `<option value="">Сар</option>${MONTHS.map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}`;
      s.dataset.populated = "1";
    }
  });
  root.querySelectorAll("[data-birth-year-select]").forEach((s) => {
    if (!s.dataset.populated) {
      const y = new Date().getFullYear();
      setSelectOptions(s, Array.from({ length: y - 1899 }, (_, i) => String(y - i)), "Жил");
      s.dataset.populated = "1";
    }
  });
  root.querySelectorAll("[data-future-year-select]").forEach((s) => {
    if (!s.dataset.populated) {
      const y = new Date().getFullYear();
      setSelectOptions(s, Array.from({ length: 15 }, (_, i) => String(y + i)), "Жил");
      s.dataset.populated = "1";
    }
  });
}

function setFieldValue(name, value) {
  const f = form.elements[name];
  if (!f) return;
  if (f.type === "checkbox") { f.checked = Boolean(value); return; }
  f.value = value || "";
}

function setDateSplit(prefix, value) {
  const p = splitIsoDate(value);
  setFieldValue(`${prefix}Year`, p.year);
  setFieldValue(`${prefix}Month`, p.month);
  setFieldValue(`${prefix}Day`, p.day);
}

function toggleElement(id, visible) {
  const el = document.getElementById(id);
  if (!el) return;
  el.hidden = !visible;
  el.setAttribute("aria-hidden", visible ? "false" : "true");
  el.classList.toggle("is-hidden", !visible);
  el.style.display = visible ? "" : "none";
}

// ==========================================================================
// NA (Does Not Apply) checkboxes
// ==========================================================================
function wireNaCheckbox(checkbox) {
  const targetName = checkbox.dataset.naFor;
  if (!targetName) return;
  const target = form.elements[targetName];
  if (!target) return;
  const apply = () => {
    if (checkbox.checked) {
      if (target.tagName === "SELECT") target.value = "";
      else target.value = "";
      target.disabled = true;
      target.classList.add("is-na");
    } else {
      target.disabled = false;
      target.classList.remove("is-na");
    }
  };
  checkbox.addEventListener("change", apply);
  apply();
}

function wireRepeatNaCheckbox(checkbox) {
  const targetField = checkbox.dataset.repeatNaFor;
  if (!targetField) return;
  const row = checkbox.closest("[data-repeat-row]");
  if (!row) return;
  const target = row.querySelector(`[data-repeat-field="${targetField}"]`);
  if (!target) return;
  const apply = () => {
    if (checkbox.checked) {
      target.value = "";
      target.disabled = true;
      target.classList.add("is-na");
    } else {
      target.disabled = false;
      target.classList.remove("is-na");
    }
  };
  checkbox.addEventListener("change", apply);
}

// ==========================================================================
// Repeatable rows
// ==========================================================================
function getRepeatConfig(targetName) {
  const container = document.querySelector(`[data-repeat="${targetName}"]`);
  if (!container) return null;
  const template = document.querySelector(`template[data-repeat-template="${targetName}"]`);
  const body = container.querySelector("[data-repeat-body]");
  const max = parseInt(container.dataset.max || "10", 10);
  return { container, template, body, max };
}

function addRepeatRow(targetName) {
  const cfg = getRepeatConfig(targetName);
  if (!cfg || !cfg.template || !cfg.body) return null;
  const existing = cfg.body.querySelectorAll("[data-repeat-row]").length;
  if (existing >= cfg.max) return null;
  const clone = cfg.template.content.cloneNode(true);
  cfg.body.appendChild(clone);
  const newRow = cfg.body.lastElementChild;
  populateStaticOptions(newRow);
  newRow.querySelectorAll("[data-repeat-na-for]").forEach(wireRepeatNaCheckbox);
  bindUppercaseFieldsIn(newRow);
  return newRow;
}

function removeRepeatRow(button) {
  const row = button.closest("[data-repeat-row]");
  if (row) row.remove();
}

function collectRepeatData(targetName) {
  const cfg = getRepeatConfig(targetName);
  if (!cfg || !cfg.body) return [];
  const rows = cfg.body.querySelectorAll("[data-repeat-row]");
  const result = [];
  rows.forEach((row) => {
    const obj = {};
    row.querySelectorAll("[data-repeat-field]").forEach((input) => {
      const key = input.dataset.repeatField;
      const val = normalizeUppercase(normalizeValue(input.value || ""));
      if (val) obj[key] = val;
    });
    if (Object.keys(obj).length) result.push(obj);
  });
  return result;
}

function applyRepeatData(targetName, rows) {
  if (!Array.isArray(rows) || !rows.length) return;
  const cfg = getRepeatConfig(targetName);
  if (!cfg || !cfg.body) return;
  cfg.body.innerHTML = "";
  rows.forEach((rowData) => {
    const row = addRepeatRow(targetName);
    if (!row) return;
    Object.entries(rowData).forEach(([key, val]) => {
      const input = row.querySelector(`[data-repeat-field="${key}"]`);
      if (input) input.value = val || "";
    });
  });
}

const REPEAT_TARGETS = [
  "otherName","otherNat","companion","prevVisit","otherPhone","otherEmail",
  "social","otherWeb","lostPassport","immRelative","otherRelative",
  "prevEmp","education","language","country","org","military"
];

// ==========================================================================
// Conditional fields
// ==========================================================================
function syncConditionalFields() {
  const anyYes = (...names) => names.some((n) => fieldValue(n) === "ТИЙМ");

  toggleElement("other-names-block", fieldValue("usedOtherNames") === "ТИЙМ");
  toggleElement("telecode-surname-field", fieldValue("hasTelecode") === "ТИЙМ");
  toggleElement("telecode-given-field", fieldValue("hasTelecode") === "ТИЙМ");
  toggleElement("marital-other-field", fieldValue("maritalStatus") === "БУСАД");

  toggleElement("other-nationality-block", fieldValue("hadOtherNationality") === "ТИЙМ");
  toggleElement("permanent-resident-country-field", fieldValue("permanentResidentOther") === "ТИЙМ");

  toggleElement("trip-purpose-detail-field", fieldValue("tripPurposeCategory") === "B");
  toggleElement("travel-itinerary-fields", fieldValue("hasSpecificTravelPlans") === "ТИЙМ");
  const payer = fieldValue("tripPayer");
  toggleElement("trip-payer-person-fields", payer === "OTHER PERSON");
  toggleElement("trip-payer-org-fields", payer === "PRESENT EMPLOYER" || payer === "EMPLOYER IN THE U.S." || payer === "OTHER COMPANY/ORGANIZATION");
  toggleElement("trip-payer-address-field", fieldValue("tripPayerSameAddress") === "ҮГҮЙ");

  const withOthers = fieldValue("travelingWithOthers") === "ТИЙМ";
  toggleElement("companions-root", withOthers);
  const asGroup = fieldValue("travelingAsGroup");
  toggleElement("group-name-field", withOthers && asGroup === "ТИЙМ");
  toggleElement("companions-individual-block", withOthers && asGroup === "ҮГҮЙ");

  const beenInUs = fieldValue("beenInUs") === "ТИЙМ";
  toggleElement("previous-visits-block", beenInUs);
  toggleElement("us-driver-license-fields", beenInUs && fieldValue("hasUsDriverLicense") === "ТИЙМ");
  toggleElement("previous-visa-fields", fieldValue("hadUsVisa") === "ТИЙМ");

  toggleElement("mailing-address-fields", fieldValue("mailingSameAsHome") === "ҮГҮЙ");
  toggleElement("other-phones-block", fieldValue("usedOtherPhones") === "ТИЙМ");
  toggleElement("other-emails-block", fieldValue("usedOtherEmails") === "ТИЙМ");
  toggleElement("social-media-block", fieldValue("usesSocialMedia") === "ТИЙМ");
  toggleElement("other-web-presence-block", fieldValue("hasOtherWebPresence") === "ТИЙМ");

  toggleElement("passport-type-other-field", fieldValue("passportType") === "OTHER");
  toggleElement("lost-passport-block", fieldValue("lostPassport") === "ТИЙМ");

  toggleElement("immediate-relatives-block", fieldValue("hasImmediateRelativesInUs") === "ТИЙМ");
  toggleElement("other-relatives-block", fieldValue("hasOtherRelativesInUs") === "ТИЙМ");

  // Spouse section visibility
  const maritalSpouseNeeded = ["ГЭРЛЭСЭН","ИРГЭНИЙ ХАМТРАЛ","ХУУЛИЙН САЛАЛТ","САЛСАН","БЭЛЭВСЭН"].includes(fieldValue("maritalStatus"));
  toggleElement("section-spouse", maritalSpouseNeeded);
  toggleElement("spouse-marriage-end-field", ["САЛСАН","БЭЛЭВСЭН","ХУУЛИЙН САЛАЛТ"].includes(fieldValue("maritalStatus")));
  toggleElement("spouse-address-fields", fieldValue("spouseAddressType") === "OTHER");

  toggleElement("occupation-other-field", fieldValue("primaryOccupation") === "OTHER");

  toggleElement("previous-employers-block", fieldValue("wasPreviouslyEmployed") === "ТИЙМ");
  toggleElement("education-block", fieldValue("attendedHigherEducation") === "ТИЙМ");

  toggleElement("clan-name-field", fieldValue("belongsToClan") === "ТИЙМ");
  toggleElement("countries-visited-block", fieldValue("traveledOtherCountriesLastFiveYears") === "ТИЙМ");
  toggleElement("organizations-block", fieldValue("belongsToOrganizations") === "ТИЙМ");
  toggleElement("special-skills-field", fieldValue("hasSpecialSkills") === "ТИЙМ");
  toggleElement("military-block", fieldValue("servedMilitary") === "ТИЙМ");
  toggleElement("paramilitary-explain-field", fieldValue("involvedWithParamilitary") === "ТИЙМ");

  // Security group explain boxes
  toggleElement("security-medical-explain-field",
    anyYes("securityCommunicableDisease","securityMentalDisorder","securityDrugAbuse"));
  toggleElement("security-criminal-explain-field",
    anyYes("securityArrested","securityControlledSubstances","securityProstitution","securityMoneyLaundering",
           "securityHumanTrafficking","securityHumanTraffickingAid","securityTraffickingBenefit"));
  toggleElement("security-part3-explain-field",
    anyYes("securityEspionage","securityTerrorism","securityTerrorismSupport","securityTerrorismMember",
           "securityTerrorismFamily","securityViolence","securityHumanRights"));
  toggleElement("security-visa-fraud-explain-field",
    anyYes("securityVisaFraudSelf","securityVisaFraudAid","securityFakeDocuments"));
  toggleElement("security-deported-explain-field",
    anyYes("securityDeported","securityVisaViolationDeported"));
  toggleElement("securityChildCustody-explain", fieldValue("securityChildCustody") === "ТИЙМ");
  toggleElement("securityIllegalVoting-explain", fieldValue("securityIllegalVoting") === "ТИЙМ");
  toggleElement("securityRenouncedCitizenship-explain", fieldValue("securityRenouncedCitizenship") === "ТИЙМ");
}

const CONDITIONAL_TRIGGERS = [
  "usedOtherNames","hasTelecode","maritalStatus",
  "hadOtherNationality","permanentResidentOther",
  "tripPurposeCategory","hasSpecificTravelPlans","tripPayer","tripPayerSameAddress",
  "travelingWithOthers","travelingAsGroup",
  "beenInUs","hasUsDriverLicense","hadUsVisa",
  "mailingSameAsHome","usedOtherPhones","usedOtherEmails","usesSocialMedia","hasOtherWebPresence",
  "passportType","lostPassport",
  "hasImmediateRelativesInUs","hasOtherRelativesInUs",
  "spouseAddressType",
  "primaryOccupation","wasPreviouslyEmployed","attendedHigherEducation",
  "belongsToClan","traveledOtherCountriesLastFiveYears","belongsToOrganizations",
  "hasSpecialSkills","servedMilitary","involvedWithParamilitary",
  "securityCommunicableDisease","securityMentalDisorder","securityDrugAbuse",
  "securityArrested","securityControlledSubstances","securityProstitution","securityMoneyLaundering",
  "securityHumanTrafficking","securityHumanTraffickingAid","securityTraffickingBenefit",
  "securityEspionage","securityTerrorism","securityTerrorismSupport","securityTerrorismMember",
  "securityTerrorismFamily","securityViolence","securityHumanRights",
  "securityVisaFraudSelf","securityVisaFraudAid","securityFakeDocuments",
  "securityDeported","securityVisaViolationDeported",
  "securityChildCustody","securityIllegalVoting","securityRenouncedCitizenship"
];

function bindConditionalFields() {
  CONDITIONAL_TRIGGERS.forEach((n) => {
    form.elements[n]?.addEventListener("change", syncConditionalFields);
  });
  syncConditionalFields();
}

// ==========================================================================
// Uppercase normalization
// ==========================================================================
function bindUppercaseFieldsIn(root) {
  root.querySelectorAll('input:not([type="date"]):not([type="time"]):not([type="checkbox"]):not([type="file"]):not([type="hidden"]), textarea').forEach((field) => {
    if (field.dataset.uppercaseBound) return;
    field.dataset.uppercaseBound = "1";
    field.addEventListener("input", () => {
      const start = field.selectionStart;
      const end = field.selectionEnd;
      field.value = normalizeUppercase(field.value);
      if (typeof start === "number" && typeof end === "number") {
        try { field.setSelectionRange(start, end); } catch (_) {}
      }
    });
  });
}

// ==========================================================================
// Repeat + NA wiring
// ==========================================================================
function bindRepeatButtons() {
  document.addEventListener("click", (ev) => {
    const btn = ev.target.closest("[data-action]");
    if (!btn) return;
    if (btn.dataset.action === "add-repeat") {
      ev.preventDefault();
      addRepeatRow(btn.dataset.repeatTarget);
    } else if (btn.dataset.action === "remove-repeat") {
      ev.preventDefault();
      removeRepeatRow(btn);
    }
  });
}

function bindNaCheckboxes() {
  document.querySelectorAll("[data-na-for]").forEach(wireNaCheckbox);
}

// ==========================================================================
// Photo upload
// ==========================================================================
function bindPhotoUpload() {
  const input = document.getElementById("photo-file-input");
  const hidden = document.getElementById("photo-data-field");
  const previewWrap = document.getElementById("photo-preview-wrap");
  const previewImg = document.getElementById("photo-preview");
  const clearBtn = document.getElementById("photo-clear-btn");
  if (!input || !hidden) return;

  input.addEventListener("change", () => {
    const file = input.files && input.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("Зураг 5MB-ээс хэтрэхгүй байх ёстой.");
      input.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      hidden.value = reader.result;
      if (previewImg) previewImg.src = reader.result;
      toggleElement("photo-preview-wrap", true);
    };
    reader.readAsDataURL(file);
  });

  clearBtn?.addEventListener("click", () => {
    hidden.value = "";
    if (input) input.value = "";
    if (previewImg) previewImg.src = "";
    toggleElement("photo-preview-wrap", false);
  });
}

// ==========================================================================
// Build payload
// ==========================================================================
function buildPayload(formNode) {
  const formData = new FormData(formNode);
  const payload = {};
  const skipKeys = new Set([
    "birthDay","birthMonth","birthYear",
    "arrivalDay","arrivalMonth","arrivalYear",
    "departureDay","departureMonth","departureYear"
  ]);
  for (const [key, value] of formData.entries()) {
    if (skipKeys.has(key)) continue;
    if (key === "photo") { payload.photo = value; continue; }
    payload[key] = normalizeUppercase(normalizeValue(value));
  }

  payload.dateOfBirth = formatDateParts(fieldValue("birthYear"), fieldValue("birthMonth"), fieldValue("birthDay"));
  payload.intendedArrivalDate = formatDateParts(fieldValue("arrivalYear"), fieldValue("arrivalMonth"), fieldValue("arrivalDay"));
  payload.intendedDepartureDate = formatDateParts(fieldValue("departureYear"), fieldValue("departureMonth"), fieldValue("departureDay"));

  payload.usStayAddress = [
    fieldValue("usStayAddressLine1"),
    fieldValue("usStayAddressLine2"),
    fieldValue("usStayCity"),
    fieldValue("usStayState"),
    fieldValue("usStayZip"),
  ].filter(Boolean).join(", ");

  REPEAT_TARGETS.forEach((name) => {
    payload[`${name}List`] = collectRepeatData(name);
  });

  payload.submittedFrom = "travelx-ds160-client-link";
  return payload;
}

// ==========================================================================
// Validation
// ==========================================================================
function validatePayload(payload) {
  const required = [
    ["surname","Овог"],
    ["givenName","Нэр"],
    ["nativeFullName","Криллээр өөрийн нэр"],
    ["sex","Хүйс"],
    ["maritalStatus","Гэрлэлтийн байдал"],
    ["dateOfBirth","Төрсөн өдөр"],
    ["birthCity","Төрсөн хот"],
    ["birthCountry","Төрсөн улс"],
    ["nationality","Иргэншил"],
    ["email","И-мэйл"],
    ["primaryPhone","Үндсэн утас"],
    ["homeAddressLine1","Гэрийн хаяг"],
    ["homeCity","Хот"],
    ["homeCountry","Улс"],
    ["passportNumber","Паспортын дугаар"],
    ["passportType","Паспортын төрөл"],
    ["passportIssuingCountry","Паспорт олгосон улс"],
    ["passportIssueDate","Паспорт олгосон өдөр"],
    ["passportExpiryDate","Паспортын хүчинтэй хугацаа"],
    ["tripPurposeCategory","Аяллын зорилго"],
    ["primaryOccupation","Үндсэн мэргэжил"],
  ];
  const missing = required.filter(([f]) => !payload[f]).map(([, l]) => l);
  return missing;
}

function setSubmittingState(isSubmitting) {
  const button = form.querySelector('button[type="submit"]');
  button.disabled = isSubmitting;
  button.textContent = isSubmitting ? "Илгээж байна..." : "Мэдээлэл илгээх";
}

// ==========================================================================
// Apply saved payload (for prefill)
// ==========================================================================
function applyPayload(payload) {
  Object.entries(payload || {}).forEach(([key, value]) => {
    if (key.endsWith("List")) return;
    if (!form.elements[key]) return;
    if (key === "photo") {
      const hidden = document.getElementById("photo-data-field");
      if (hidden && typeof value === "string" && value.startsWith("data:")) {
        hidden.value = value;
        const previewImg = document.getElementById("photo-preview");
        if (previewImg) previewImg.src = value;
        toggleElement("photo-preview-wrap", true);
      }
      return;
    }
    setFieldValue(key, value);
  });

  setDateSplit("birth", payload?.dateOfBirth);
  setDateSplit("arrival", payload?.intendedArrivalDate);
  setDateSplit("departure", payload?.intendedDepartureDate);

  REPEAT_TARGETS.forEach((name) => {
    const list = payload?.[`${name}List`];
    if (Array.isArray(list) && list.length) applyRepeatData(name, list);
  });
}

// ==========================================================================
// Load form
// ==========================================================================
async function loadForm() {
  const token = tokenFromPath();
  const response = await fetch(`/api/ds160/public/${encodeURIComponent(token)}`);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Form not found");
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
  if (!fieldValue("homeCountry")) setFieldValue("homeCountry", "MONGOLIA");
  if (!fieldValue("passportIssuingCountry")) setFieldValue("passportIssuingCountry", "MONGOLIA");
  if (!fieldValue("passportIssueCountry")) setFieldValue("passportIssueCountry", "MONGOLIA");
  syncConditionalFields();
  if (entry.submittedAt) {
    statusNode.textContent = "Өмнөх хадгалсан хариулт ачааллаа.";
    statusNode.dataset.tone = "ok";
  }
}

// ==========================================================================
// Submit
// ==========================================================================
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const token = tokenFromPath();
  const payload = buildPayload(form);
  const missing = validatePayload(payload);
  if (missing.length) {
    statusNode.textContent = `Дутуу талбарууд: ${missing.join(", ")}`;
    statusNode.dataset.tone = "error";
    window.scrollTo({ top: 0, behavior: "smooth" });
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
    if (!response.ok) throw new Error(result.error || "Мэдээлэл илгээх үед алдаа гарлаа.");
    statusNode.textContent = "Амжилттай. Таны мэдээлэл хадгалагдлаа.";
    statusNode.dataset.tone = "ok";
  } catch (error) {
    statusNode.textContent = error.message;
    statusNode.dataset.tone = "error";
  } finally {
    setSubmittingState(false);
  }
});

// ==========================================================================
// Init
// ==========================================================================
populateStaticOptions(document);
bindRepeatButtons();
bindNaCheckboxes();
bindPhotoUpload();
bindUppercaseFieldsIn(form);
bindConditionalFields();

// Seed one empty row in each repeatable so the UI isn't empty
REPEAT_TARGETS.forEach((name) => {
  const cfg = getRepeatConfig(name);
  if (cfg && cfg.body && cfg.body.children.length === 0) addRepeatRow(name);
});

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
