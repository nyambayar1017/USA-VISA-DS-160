const profileNameNode = document.querySelector("[data-profile-name]");
const profileEmailNode = document.querySelector("[data-profile-email]");

async function loadProfile() {
  if (!profileNameNode || !profileEmailNode) {
    return;
  }
  try {
    const response = await fetch("/api/auth/me");
    const data = await response.json();
    if (!response.ok || !data.user) {
      throw new Error();
    }
    profileNameNode.textContent = data.user.fullName || data.user.email;
    profileEmailNode.textContent = `${data.user.email} · ${data.user.role}`;
  } catch {
    profileNameNode.textContent = "TravelX Staff";
    profileEmailNode.textContent = "Profile unavailable";
  }
}

loadProfile();
