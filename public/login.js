const loginForm = document.querySelector("#login-form");
const registerForm = document.querySelector("#register-form");
const bootstrapForm = document.querySelector("#bootstrap-form");
const loginStatus = document.querySelector("#login-status");
const registerStatus = document.querySelector("#register-status");
const bootstrapStatus = document.querySelector("#bootstrap-status");

function buildPayload(formNode) {
  return Object.fromEntries(new FormData(formNode).entries());
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data;
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginStatus.textContent = "Logging in...";
  try {
    const payload = buildPayload(loginForm);
    await fetchJson("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    window.location.href = "/backoffice";
  } catch (error) {
    loginStatus.textContent = error.message;
  }
});

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  registerStatus.textContent = "Sending request...";
  try {
    await fetchJson("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPayload(registerForm)),
    });
    registerStatus.textContent = "Request sent. Wait for admin approval.";
    registerForm.reset();
  } catch (error) {
    registerStatus.textContent = error.message;
  }
});

bootstrapForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  bootstrapStatus.textContent = "Creating admin...";
  try {
    await fetchJson("/api/auth/bootstrap-admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPayload(bootstrapForm)),
    });
    window.location.href = "/admin";
  } catch (error) {
    bootstrapStatus.textContent = error.message;
  }
});
