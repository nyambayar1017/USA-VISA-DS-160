const form = document.querySelector("#ds160-client-form");
const statusNode = document.querySelector("#ds160-client-status");
const summaryNode = document.querySelector("#ds160-client-summary");

const MONGOLIAN_DATE_FORMAT = new Intl.DateTimeFormat("mn-MN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function normalizeValue(value) {
  if (typeof value !== "string") return value;
  return value.trim();
}

function tokenFromPath() {
  const parts = location.pathname.split("/").filter(Boolean);
  return parts[parts.length - 1] || "";
}

function buildPayload(formNode) {
  const formData = new FormData(formNode);
  const payload = {};
  for (const [key, value] of formData.entries()) {
    payload[key] = normalizeValue(value);
  }
  payload.submittedFrom = "travelx-ds160-client-link";
  return payload;
}

function validatePayload(payload) {
  const requiredFields = [
    ["surname", "Овог"],
    ["givenName", "Нэр"],
    ["dateOfBirth", "Төрсөн өдөр"],
    ["birthCity", "Төрсөн хот"],
    ["birthCountry", "Төрсөн улс"],
    ["nationality", "Иргэншил"],
    ["email", "Имэйл"],
    ["primaryPhone", "Үндсэн утас"],
    ["passportNumber", "Паспортын дугаар"],
    ["passportIssueDate", "Паспорт олгосон өдөр"],
    ["passportExpiryDate", "Паспортын хүчинтэй хугацаа"],
    ["tripPurposeCategory", "Аяллын зорилго"],
    ["intendedArrivalDate", "АНУ-д очих өдөр"],
  ];
  return requiredFields.filter(([field]) => !payload[field]).map(([, label]) => label);
}

function setSubmittingState(isSubmitting) {
  const button = form.querySelector('button[type="submit"]');
  button.disabled = isSubmitting;
  button.textContent = isSubmitting ? "Илгээж байна..." : "Мэдээлэл илгээх";
}

function setFieldValue(name, value) {
  const field = form.elements[name];
  if (!field) return;
  field.value = value || "";
}

function applyPayload(payload) {
  Object.entries(payload || {}).forEach(([key, value]) => setFieldValue(key, value));
}

function toggleField(name, visible) {
  const field = form.elements[name];
  const wrapper = field?.closest("label");
  if (!wrapper) return;
  wrapper.hidden = !visible;
}

function syncConditionalFields() {
  toggleField("otherNamesDetails", form.elements.usedOtherNames.value === "Тийм");
  toggleField("telecode", form.elements.hasTelecode.value === "Тийм");
  toggleField("mailingAddress", form.elements.mailingSameAsHome.value === "Үгүй");
  toggleField("otherPhoneDetails", form.elements.usedOtherPhones.value === "Тийм");
  toggleField("otherEmailDetails", form.elements.usedOtherEmails.value === "Тийм");
  toggleField("passportBookNumber", form.elements.passportBookNumberNotApplicable.value === "Үгүй");
  toggleField("lostPassportDetails", form.elements.lostPassport.value === "Тийм");
  toggleField("travelCompanions", form.elements.travelingWithOthers.value === "Тийм");
  toggleField(
    "previousUsTravelDetails",
    [
      form.elements.beenInUs.value,
      form.elements.hadUsVisa.value,
      form.elements.visaRefused.value,
      form.elements.immigrantPetitionFiled.value,
    ].includes("Тийм")
  );
  toggleField(
    "relativesInUsDetails",
    [form.elements.hasImmediateRelativesInUs.value, form.elements.hasOtherRelativesInUs.value].includes("Тийм")
  );
  toggleField("otherWebPresenceDetails", form.elements.hasOtherWebPresence.value === "Тийм");
  toggleField("clanDetails", form.elements.belongsToClan.value === "Тийм");
  toggleField("countriesVisitedDetails", form.elements.traveledOtherCountriesLastFiveYears.value === "Тийм");
  toggleField("organizationDetails", form.elements.belongsToOrganizations.value === "Тийм");
  toggleField("specialSkillsDetails", form.elements.hasSpecialSkills.value === "Тийм");
  toggleField("militaryUnitName", form.elements.servedMilitary.value === "Тийм");

  const anySecurityYes = [
    "securityCommunicableDisease",
    "securityMentalDisorder",
    "securityDrugAbuse",
    "securityArrested",
    "securityControlledSubstances",
    "securityProstitution",
    "securityMoneyLaundering",
    "securityHumanTrafficking",
    "securityTerrorism",
    "securityViolence",
    "securityHumanRights",
    "securityVisaFraud",
    "securityDeported",
    "securityChildCustody",
    "securityIllegalVoting",
    "securityRenouncedCitizenship",
  ].some((name) => form.elements[name].value === "Тийм");
  toggleField("securityBackgroundDetails", anySecurityYes);
}

function bindConditionalFields() {
  [
    "usedOtherNames",
    "hasTelecode",
    "mailingSameAsHome",
    "usedOtherPhones",
    "usedOtherEmails",
    "passportBookNumberNotApplicable",
    "lostPassport",
    "travelingWithOthers",
    "beenInUs",
    "hadUsVisa",
    "visaRefused",
    "immigrantPetitionFiled",
    "hasImmediateRelativesInUs",
    "hasOtherRelativesInUs",
    "hasOtherWebPresence",
    "belongsToClan",
    "traveledOtherCountriesLastFiveYears",
    "belongsToOrganizations",
    "hasSpecialSkills",
    "servedMilitary",
    "securityCommunicableDisease",
    "securityMentalDisorder",
    "securityDrugAbuse",
    "securityArrested",
    "securityControlledSubstances",
    "securityProstitution",
    "securityMoneyLaundering",
    "securityHumanTrafficking",
    "securityTerrorism",
    "securityViolence",
    "securityHumanRights",
    "securityVisaFraud",
    "securityDeported",
    "securityChildCustody",
    "securityIllegalVoting",
    "securityRenouncedCitizenship",
  ].forEach((name) => {
    form.elements[name]?.addEventListener("change", syncConditionalFields);
  });
  syncConditionalFields();
}

async function loadForm() {
  const token = tokenFromPath();
  const response = await fetch(`/api/ds160/public/${encodeURIComponent(token)}`);
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || "Form not found");
  }
  const entry = result.entry || {};
  summaryNode.textContent = `${entry.clientName || "Client"} • ${entry.clientEmail || "-"} • Менежер: ${entry.managerName || "-"}`;
  applyPayload(entry.payload || {});
  syncConditionalFields();
  if (entry.submittedAt) {
    const lastSaved = MONGOLIAN_DATE_FORMAT.format(new Date(entry.submittedAt));
    statusNode.textContent = `Өмнөх хариулт ${lastSaved} өдөр хадгалагдсан байна.`;
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
    const submittedAt = result.entry?.submittedAt
      ? MONGOLIAN_DATE_FORMAT.format(new Date(result.entry.submittedAt))
      : "саяхан";
    statusNode.textContent = `Амжилттай. Таны мэдээлэл ${submittedAt} өдөр хадгалагдлаа.`;
    statusNode.dataset.tone = "ok";
  } catch (error) {
    statusNode.textContent = error.message;
    statusNode.dataset.tone = "error";
  } finally {
    setSubmittingState(false);
  }
});

bindConditionalFields();
loadForm().catch((error) => {
  summaryNode.textContent = error.message;
  statusNode.textContent = error.message;
  statusNode.dataset.tone = "error";
  form.querySelectorAll("input, select, textarea, button").forEach((node) => {
    node.disabled = true;
  });
});
