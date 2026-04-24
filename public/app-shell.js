const WORKSPACE_KEY = "activeWorkspace";
const COMPANIES = {
  DTX: {
    name: "Delkhii Travel X",
    short: "DTX",
    logoFull: "/assets/dtx-logo-blue-yellow.png",
    logoSquare: "/assets/dtx-logo-blue-yellow.png",
  },
  USM: {
    name: "Unlock Steppe Mongolia",
    short: "USM",
    logoFull: "/assets/usm-logo.png",
    logoSquare: "/assets/usm-logo-square.png",
  },
};
const DTX_ONLY_PAGES = new Set(["ds160", "fifa"]);

function readCookie(name) {
  return document.cookie.split(";").map((c) => c.trim()).find((c) => c.startsWith(`${name}=`))?.split("=")[1] || "";
}

function readWorkspace() {
  let value = "";
  try { value = localStorage.getItem(WORKSPACE_KEY) || ""; } catch {}
  if (!value) value = readCookie(WORKSPACE_KEY);
  return COMPANIES[value] ? value : "";
}

function setWorkspace(company) {
  if (!COMPANIES[company]) return;
  try { localStorage.setItem(WORKSPACE_KEY, company); } catch {}
  const oneYear = 60 * 60 * 24 * 365;
  document.cookie = `${WORKSPACE_KEY}=${company}; Path=/; Max-Age=${oneYear}; SameSite=Lax`;
}

const profileNameNode = document.querySelector("[data-profile-name]");
const profileEmailNode = document.querySelector("[data-profile-email]");
const profileCard = profileNameNode?.closest(".workspace-profile");
let currentProfile = null;
let profileModal = null;

function renderSidebar(user) {
  const sidebar = document.querySelector("[data-workspace-sidebar]");
  if (!sidebar) return;
  const workspace = readWorkspace();
  if (!workspace) return;
  const active = document.body.dataset.page || "";
  const company = COMPANIES[workspace];
  const other = workspace === "DTX" ? COMPANIES.USM : COMPANIES.DTX;
  const otherKey = workspace === "DTX" ? "USM" : "DTX";
  const isAdmin = (user?.role || "").toLowerCase() === "admin";
  const isDtx = workspace === "DTX";

  const link = (page, href, label, extraClass = "") => {
    const activeClass = page && active === page ? " is-active" : "";
    return `<a class="sidebar-link${activeClass}${extraClass ? ` ${extraClass}` : ""}" href="${href}">${label}</a>`;
  };

  const dtxBlock = isDtx
    ? `
        <div class="sidebar-tree">
          <div class="sidebar-branch">
            <a class="sidebar-link${active === "fifa" ? " is-active" : ""}" href="/fifa2026-admin">FIFA 2026</a>
            <div class="sidebar-children">
              <a class="sidebar-sublink" href="/fifa2026-admin#inventory-section">Inventory</a>
              <a class="sidebar-sublink" href="/fifa2026-admin#sales-section">Sales</a>
              <a class="sidebar-sublink" href="/fifa2026" target="_blank" rel="noreferrer">Public Page</a>
            </div>
          </div>
        </div>
        ${link("ds160", "/ds160", "DS-160")}
      `
    : "";

  sidebar.innerHTML = `
    <a class="sidebar-brand" href="/backoffice" aria-label="${company.name}">
      <img src="${company.logoSquare}" alt="${company.name}" />
    </a>
    <p class="sidebar-workspace-label">${company.name}</p>
    <div class="sidebar-group">
      <p class="sidebar-label">Backoffice</p>
      ${link("home", "/backoffice", "Home")}
      ${link("camp-reservations", "/camp-reservations", "Camp Reservations")}
      ${link("flight-reservations", "/flight-reservations", "Flight Reservations")}
      ${link("transfer-reservations", "/transfer-reservations", "Transfer Reservations")}
      ${dtxBlock}
      ${link("contracts", "/contracts", "Contracts")}
      <a class="sidebar-link" href="https://app.ninepax.com/mn2/dossier" target="_blank" rel="noreferrer">Ninepax</a>
      ${link("todo", "/todo", "To Do")}
      ${isAdmin ? link("admin", "/admin", "Team / Admin") : ""}
    </div>
    <div class="sidebar-switch">
      <p class="sidebar-label">Switch workspace</p>
      <button type="button" class="sidebar-switch-button" data-switch="${otherKey}" aria-label="Switch to ${other.name}">
        <img src="${other.logoSquare}" alt="${other.name}" />
        <span>${other.name}</span>
      </button>
    </div>
  `;

  sidebar.querySelector("[data-switch]")?.addEventListener("click", () => {
    setWorkspace(otherKey);
    window.location.href = "/backoffice";
  });
}

function ensureWorkspaceOrRedirect() {
  const page = document.body.dataset.page || "";
  if (page === "workspace" || page === "login" || !page) return true;
  const workspace = readWorkspace();
  if (!workspace) {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.replace(`/workspace?next=${next}`);
    return false;
  }
  if (workspace === "USM" && DTX_ONLY_PAGES.has(page)) {
    window.location.replace("/backoffice");
    return false;
  }
  return true;
}

function initProfileSignatureCanvas(canvas, existingSignatureUrl = "") {
  const ctx = canvas.getContext("2d");
  let drawing = false;
  let hasInk = false;
  let hasExistingImage = false;
  const baseWidth = 640;
  const baseHeight = 180;
  const pixelRatio = Math.max(window.devicePixelRatio || 1, 1);

  const setupCanvas = () => {
    canvas.width = Math.floor(baseWidth * pixelRatio);
    canvas.height = Math.floor(baseHeight * pixelRatio);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(pixelRatio, pixelRatio);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, baseWidth, baseHeight);
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.imageSmoothingEnabled = true;
    ctx.setLineDash([8, 8]);
    ctx.strokeStyle = "rgba(37, 58, 119, 0.24)";
    ctx.beginPath();
    ctx.moveTo(24, 146);
    ctx.lineTo(baseWidth - 24, 146);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = "#1b2a6b";
    hasInk = false;
    hasExistingImage = false;
  };

  const loadExisting = (url) => {
    setupCanvas();
    if (!url) return;
    const image = new Image();
    image.onload = () => {
      ctx.drawImage(image, 20, 20, baseWidth - 40, 110);
      hasExistingImage = true;
    };
    image.src = url;
  };

  setupCanvas();
  if (existingSignatureUrl) loadExisting(existingSignatureUrl);

  const getPos = (event) => {
    const rect = canvas.getBoundingClientRect();
    const touch = event.touches ? event.touches[0] : null;
    return {
      x: ((touch ? touch.clientX : event.clientX) - rect.left) * (baseWidth / rect.width),
      y: ((touch ? touch.clientY : event.clientY) - rect.top) * (baseHeight / rect.height),
    };
  };

  const startDraw = (event) => {
    event.preventDefault();
    if (hasExistingImage && !hasInk) {
      setupCanvas();
    }
    drawing = true;
    const pos = getPos(event);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (event) => {
    if (!drawing) return;
    event.preventDefault();
    const pos = getPos(event);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    hasInk = true;
  };

  const endDraw = () => {
    drawing = false;
  };

  canvas.addEventListener("mousedown", startDraw);
  canvas.addEventListener("mousemove", draw);
  canvas.addEventListener("mouseup", endDraw);
  canvas.addEventListener("mouseleave", endDraw);
  canvas.addEventListener("touchstart", startDraw, { passive: false });
  canvas.addEventListener("touchmove", draw, { passive: false });
  canvas.addEventListener("touchend", endDraw);

  return {
    clear: setupCanvas,
    hasInk: () => hasInk,
    loadExisting,
  };
}

function renderProfile(user) {
  currentProfile = user;
  if (profileNameNode) profileNameNode.textContent = user.fullName || user.email;
  if (profileEmailNode) profileEmailNode.textContent = `${user.email} · ${user.role}`;
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
        <div class="full-span">
          <label style="display:block; margin-bottom:8px;">
            Гэрээнд зориулсан гарын үсэг
          </label>
          <div class="signature-box" style="border:1px solid #d8ddea; border-radius:18px; background:#fff; padding:12px;">
            <canvas id="profile-signature-canvas" width="640" height="180" style="width:100%; height:180px; display:block; background:#fff; border-radius:12px;"></canvas>
          </div>
          <div class="actions" style="margin-top:10px;">
            <button type="button" class="secondary-button" id="profile-signature-clear">Clear signature</button>
          </div>
        </div>
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
  const signatureCanvas = wrapper.querySelector("#profile-signature-canvas");
  const signaturePad = signatureCanvas ? initProfileSignatureCanvas(signatureCanvas) : null;
  wrapper._signaturePad = signaturePad;
  wrapper.querySelector("#profile-signature-clear")?.addEventListener("click", () => {
    signaturePad?.clear();
  });
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());
    const fullName = String(payload.fullName || "").trim();
    if (signaturePad?.hasInk()) {
      payload.contractSignatureData = signatureCanvas.toDataURL("image/png");
    }
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
  const signaturePad = modal._signaturePad;
  if (form) {
    form.elements.fullName.value = currentProfile.fullName || currentProfile.email || "";
    form.elements.contractLastName.value = currentProfile.contractLastName || "";
    form.elements.contractFirstName.value = currentProfile.contractFirstName || currentProfile.fullName || "";
    form.elements.contractEmail.value = currentProfile.contractEmail || currentProfile.email || "";
    form.elements.contractPhone.value = currentProfile.contractPhone || "";
    signaturePad?.loadExisting(currentProfile.contractSignaturePath || "");
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

async function handleLogout() {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } finally {
    window.location.href = "/login";
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

  const logoutButton = document.createElement("button");
  logoutButton.type = "button";
  logoutButton.className = "workspace-profile-button workspace-profile-button-logout";
  logoutButton.textContent = "Logout";
  logoutButton.addEventListener("click", handleLogout);

  actions.appendChild(editButton);
  actions.appendChild(logoutButton);
  profileCard.appendChild(actions);
}

async function loadProfile() {
  if (!ensureWorkspaceOrRedirect()) return;
  if (!profileNameNode || !profileEmailNode) {
    renderSidebar(null);
    return;
  }
  try {
    const response = await fetch("/api/auth/me");
    const data = await response.json();
    if (!response.ok || !data.user) {
      throw new Error();
    }
    renderProfile(data.user);
    renderSidebar(data.user);
    ensureProfileControls();
  } catch {
    profileNameNode.textContent = "TravelX Staff";
    profileEmailNode.textContent = "Profile unavailable";
    renderSidebar(null);
  }
}

loadProfile();
