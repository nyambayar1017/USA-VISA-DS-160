const loginForm = document.querySelector("#login-form");
const registerForm = document.querySelector("#register-form");
const resetForm = document.querySelector("#reset-form");
const loginStatus = document.querySelector("#login-status");
const registerStatus = document.querySelector("#register-status");
const resetStatus = document.querySelector("#reset-status");

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
  registerStatus.textContent = "Creating account request...";
  try {
    const payload = buildPayload(registerForm);
    if (payload.password !== payload.confirmPassword) {
      registerStatus.textContent = "Passwords do not match.";
      return;
    }
    await fetchJson("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    registerStatus.textContent = "Sign up submitted. Wait for admin approval.";
    registerForm.reset();
  } catch (error) {
    registerStatus.textContent = error.message;
  }
});

resetForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  resetStatus.textContent = "Sending reset request...";
  try {
    await fetchJson("/api/auth/request-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPayload(resetForm)),
    });
    resetStatus.textContent = "Reset request sent. Admin will help you set a new password.";
    resetForm.reset();
  } catch (error) {
    resetStatus.textContent = error.message;
  }
});
