const profileNameNode = document.querySelector("[data-profile-name]");
const profileEmailNode = document.querySelector("[data-profile-email]");
const profileCard = profileNameNode?.closest(".workspace-profile");
let currentProfile = null;
let profileModal = null;

function renderProfile(user) {
  currentProfile = user;
  profileNameNode.textContent = user.fullName || user.email;
  const contractName = [user.contractLastName, user.contractFirstName].filter(Boolean).join(" ");
  profileEmailNode.textContent = contractName
    ? `${user.email} · ${user.role} · Гэрээ: ${contractName}`
    : `${user.email} · ${user.role}`;
}

function ensureProfileModal() {
  if (profileModal) return profileModal;

  const wrapper = document.createElement("div");
  wrapper.className = "camp-modal is-hidden profile-edit-modal";
  wrapper.setAttribute("hidden", "");
  wrapper.innerHTML = `
    <div class="camp-modal-backdrop" data-action="close-profile-modal"></div>
    <div class="camp-modal-dialog">
      <div class="camp-modal-header">
        <div>
          <h2>Profile Details</h2>
          <p class="camp-modal-copy">Бүх мэдээллээ нэг цонхон дээрээс шинэчилнэ.</p>
        </div>
        <button type="button" class="camp-modal-close" data-action="close-profile-modal" aria-label="Close profile window">×</button>
      </div>
      <form id="profile-edit-form" class="field-grid">
        <label>
          Registered Name
          <input name="fullName" />
        </label>
        <label>
          Гэрээнд зориулсан Овог
          <input name="contractLastName" />
        </label>
        <label>
          Гэрээнд зориулсан Нэр
          <input name="contractFirstName" />
        </label>
        <label>
          Гэрээнд зориулсан И-мэйл
          <input name="contractEmail" type="email" />
        </label>
        <label>
          Гэрээнд зориулсан Гар утас
          <input name="contractPhone" />
        </label>
        <div class="actions full-span">
          <button type="submit">Save profile</button>
          <button type="button" class="secondary-button" data-action="close-profile-modal">Cancel</button>
          <p id="profile-edit-status" class="status"></p>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(wrapper);

  const closeModal = () => {
    wrapper.classList.add("is-hidden");
    wrapper.setAttribute("hidden", "");
    document.body.classList.remove("modal-open");
  };

  wrapper.addEventListener("click", (event) => {
    if (event.target.dataset.action === "close-profile-modal") {
      closeModal();
    }
  });

  const form = wrapper.querySelector("#profile-edit-form");
  const statusNode = wrapper.querySelector("#profile-edit-status");
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());
    const fullName = String(payload.fullName || "").trim();
    if (fullName.length < 2) {
      statusNode.textContent = "Please enter at least 2 characters.";
      return;
    }

    statusNode.textContent = "Saving...";
    try {
      const response = await fetch("/api/auth/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok || !data.user) {
        throw new Error(data.error || "Could not update profile.");
      }
      renderProfile(data.user);
      statusNode.textContent = "Saved.";
      setTimeout(() => {
        statusNode.textContent = "";
        closeModal();
      }, 300);
    } catch (error) {
      statusNode.textContent = error.message || "Could not update profile.";
    }
  });

  profileModal = wrapper;
  return wrapper;
}

function openProfileModal() {
  if (!currentProfile) return;
  const modal = ensureProfileModal();
  const form = modal.querySelector("#profile-edit-form");
  const statusNode = modal.querySelector("#profile-edit-status");
  if (form) {
    form.elements.fullName.value = currentProfile.fullName || currentProfile.email || "";
    form.elements.contractLastName.value = currentProfile.contractLastName || "";
    form.elements.contractFirstName.value = currentProfile.contractFirstName || currentProfile.fullName || "";
    form.elements.contractEmail.value = currentProfile.contractEmail || currentProfile.email || "";
    form.elements.contractPhone.value = currentProfile.contractPhone || "";
  }
  if (statusNode) statusNode.textContent = "";
  modal.classList.remove("is-hidden");
  modal.removeAttribute("hidden");
  document.body.classList.add("modal-open");
}

function handleProfileEdit() {
  if (!currentProfile) {
    return;
  }
  openProfileModal();
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
