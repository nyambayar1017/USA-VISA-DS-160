const form = document.querySelector("#ds160-form");
const statusNode = document.querySelector("#form-status");

const MONGOLIAN_DATE_FORMAT = new Intl.DateTimeFormat("mn-MN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function normalizeValue(value) {
  if (typeof value !== "string") {
    return value;
  }

  return value.trim();
}

function buildPayload(formNode) {
  const formData = new FormData(formNode);
  const payload = {};

  for (const [key, value] of formData.entries()) {
    payload[key] = normalizeValue(value);
  }

  payload.submittedFrom = "mn-ds160-client-intake";
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

  const missing = requiredFields.filter(([field]) => !payload[field]).map(([, label]) => label);
  return missing;
}

function setSubmittingState(isSubmitting) {
  const button = form.querySelector('button[type="submit"]');
  button.disabled = isSubmitting;
  button.textContent = isSubmitting ? "Илгээж байна..." : "Мэдээлэл илгээх";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const payload = buildPayload(form);
  const missing = validatePayload(payload);

  if (missing.length) {
    statusNode.textContent = `Дутуу талбарууд: ${missing.join(", ")}`;
    return;
  }

  setSubmittingState(true);
  statusNode.textContent = "Мэдээлэл хадгалж байна...";

  try {
    const response = await fetch("/api/ds160", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || "Мэдээлэл илгээх үед алдаа гарлаа.");
    }

    const submittedAt = result.application?.createdAt
      ? MONGOLIAN_DATE_FORMAT.format(new Date(result.application.createdAt))
      : "саяхан";

    form.reset();
    statusNode.textContent = `Амжилттай. Таны мэдээлэл ${submittedAt} өдөр хадгалагдлаа.`;
  } catch (error) {
    statusNode.textContent = error.message;
  } finally {
    setSubmittingState(false);
  }
});
