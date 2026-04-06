const profileNameNode = document.querySelector("[data-profile-name]");
const profileEmailNode = document.querySelector("[data-profile-email]");
const profileCard = profileNameNode?.closest(".workspace-profile");
let currentProfile = null;

function renderProfile(user) {
  currentProfile = user;
  profileNameNode.textContent = user.fullName || user.email;
  const contractName = [user.contractLastName, user.contractFirstName].filter(Boolean).join(" ");
  profileEmailNode.textContent = contractName
    ? `${user.email} · ${user.role} · Гэрээ: ${contractName}`
    : `${user.email} · ${user.role}`;
}

async function handleProfileEdit() {
  if (!currentProfile) {
    return;
  }
  const nextName = window.prompt("Registered Name", currentProfile.fullName || currentProfile.email);
  if (nextName === null) {
    return;
  }
  const nextContractLastName = window.prompt("Гэрээнд зориулсан Овог", currentProfile.contractLastName || "");
  if (nextContractLastName === null) {
    return;
  }
  const nextContractFirstName = window.prompt("Гэрээнд зориулсан Нэр", currentProfile.contractFirstName || currentProfile.fullName || "");
  if (nextContractFirstName === null) {
    return;
  }
  const fullName = nextName.trim();
  const contractLastName = nextContractLastName.trim();
  const contractFirstName = nextContractFirstName.trim();
  if (fullName.length < 2) {
    window.alert("Please enter at least 2 characters.");
    return;
  }

  try {
    const response = await fetch("/api/auth/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, contractLastName, contractFirstName }),
    });
    const data = await response.json();
    if (!response.ok || !data.user) {
      throw new Error(data.error || "Could not update profile.");
    }
    renderProfile(data.user);
  } catch (error) {
    window.alert(error.message || "Could not update profile.");
  }
}

function ensureProfileControls() {
  if (!profileCard || profileCard.querySelector(".workspace-profile-actions")) {
    return;
  }

  const actions = document.createElement("div");
  actions.className = "workspace-profile-actions";

  const editButton = document.createElement("button");
  editButton.type = "button";
  editButton.className = "workspace-profile-button";
  editButton.textContent = "Edit profile";
  editButton.addEventListener("click", handleProfileEdit);

  actions.appendChild(editButton);
  profileCard.appendChild(actions);
}

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
    renderProfile(data.user);
    ensureProfileControls();
  } catch {
    profileNameNode.textContent = "TravelX Staff";
    profileEmailNode.textContent = "Profile unavailable";
  }
}

loadProfile();
