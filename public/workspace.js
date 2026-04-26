const WORKSPACE_KEY = "activeWorkspace";
const COMPANIES = { DTX: "Дэлхий Трэвел Икс", USM: "Unlock Steppe Mongolia" };

function setWorkspace(company) {
  if (!COMPANIES[company]) return;
  try {
    localStorage.setItem(WORKSPACE_KEY, company);
  } catch {}
  const oneYear = 60 * 60 * 24 * 365;
  document.cookie = `${WORKSPACE_KEY}=${company}; Path=/; Max-Age=${oneYear}; SameSite=Lax`;
}

function chooseWorkspace(company) {
  setWorkspace(company);
  const next = new URLSearchParams(window.location.search).get("next") || "/backoffice";
  window.location.href = next;
}

document.querySelectorAll(".workspace-picker-card").forEach((card) => {
  card.addEventListener("click", () => {
    const company = card.dataset.company;
    if (company) chooseWorkspace(company);
  });
});

async function loadProfile() {
  const foot = document.querySelector("[data-profile-foot]");
  if (!foot) return;
  try {
    const response = await fetch("/api/auth/me");
    const data = await response.json();
    if (!response.ok || !data.user) throw new Error();
    foot.textContent = `${data.user.fullName || data.user.email} · ${data.user.role}`;
  } catch {
    foot.innerHTML = `<a href="/login">Sign in</a> to continue.`;
  }
}

loadProfile();
