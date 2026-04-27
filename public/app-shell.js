const WORKSPACE_KEY = "activeWorkspace";
const COMPANIES = {
  DTX: {
    name: "Дэлхий Трэвел Икс",
    short: "DTX",
    logoBrand: "/assets/dtx-logo-blue-yellow.png",
    logoIcon: "/assets/favicon-dtx-x.png",
  },
  USM: {
    name: "Unlock Steppe Mongolia",
    short: "USM",
    logoBrand: "/assets/usm-logo-horizontal.png",
    logoIcon: "/assets/usm-logo-square.png",
  },
};

function applyWorkspaceBranding() {
  const ws = readWorkspace();
  if (!ws) return;
  const company = COMPANIES[ws];
  if (!company) return;
  document.title = company.name;
  let icon = document.querySelector('link[rel="icon"]');
  if (!icon) {
    icon = document.createElement("link");
    icon.rel = "icon";
    document.head.appendChild(icon);
  }
  icon.type = "image/png";
  icon.href = company.logoIcon;
}
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

function escapeHtml(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getInitials(name, email) {
  const source = (name || email || "").trim();
  if (!source) return "?";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const profileCard = document.querySelector(".workspace-profile");
let profileNameNode = null;
let profileEmailNode = null;
let profileAvatarNode = null;
let profileMenuWrapper = null;
let currentProfile = null;
let profileModal = null;
let notificationBellNode = null;
let notificationDotNode = null;
let notificationCountNode = null;
let notificationPopoverNode = null;
let notificationsCache = [];
let notificationsLastReadAt = "";
let notificationsPollTimer = null;
let mailIconNode = null;
let mailCountNode = null;
let mailPopoverNode = null;
let mailUnreadCache = [];
let mailUnreadPollTimer = null;
let sidebarBackdrop = null;
let mobileBar = null;

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

  const ICONS = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20 L4 11 C8 7 16 7 20 11 L21 20"/><line x1="3" y1="20" x2="21" y2="20"/><rect x="10" y="14" width="4" height="6"/><line x1="12" y1="7" x2="12" y2="10"/></svg>',
    tourist: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.5 3.6-7 8-7s8 2.5 8 7"/></svg>',
    contracts: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/><line x1="9" y1="13" x2="17" y2="13"/><line x1="9" y1="17" x2="14" y2="17"/></svg>',
    invoices: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3h14v18l-3-2-3 2-3-2-2 2-3-2z"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="13" x2="15" y2="13"/></svg>',
    documents: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><polyline points="3,7 12,13 21,7"/></svg>',
    todo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><polyline points="8,12 11,15 16,9"/></svg>',
    contacts: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16v12H4z"/><circle cx="9" cy="11" r="2.5"/><path d="M5.5 17c.6-2 2-3 3.5-3s2.9 1 3.5 3"/><line x1="14" y1="9" x2="18" y2="9"/><line x1="14" y1="12" x2="18" y2="12"/><line x1="14" y1="15" x2="17" y2="15"/></svg>',
    notes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h11l3 3v13H5z"/><line x1="9" y1="10" x2="15" y2="10"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="16" x2="13" y2="16"/></svg>',
    "flight-reservations": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l8-2 1-6h2l-1 6 8 2v2l-8-2-2 6 2 1v2l-3-1-3 1v-2l2-1-2-6-7 2z"/></svg>',
    "transfer-reservations": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,7 4,9 6,11"/><line x1="4" y1="9" x2="20" y2="9"/><polyline points="18,17 20,15 18,13"/><line x1="20" y1="15" x2="4" y2="15"/></svg>',
    "camp-reservations": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4 L4 20 H20 Z"/><line x1="12" y1="4" x2="12" y2="20"/></svg>',
    ds160: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="2"/><circle cx="12" cy="11" r="3"/><line x1="9" y1="17" x2="15" y2="17"/></svg>',
    fifa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 3v6M12 15v6M3 12h6M15 12h6M7 7l3 3M14 14l3 3M17 7l-3 3M10 14l-3 3"/></svg>',
    admin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M14 18c0-2.5 1.8-4 3-4s3 1.5 3 4"/></svg>',
    settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  };

  const link = (page, href, label, extraClass = "") => {
    const activeClass = page && active === page ? " is-active" : "";
    const icon = ICONS[page] || "";
    return `<a class="sidebar-link${activeClass}${extraClass ? ` ${extraClass}` : ""}" href="${href}"><span class="sidebar-icon" aria-hidden="true">${icon}</span><span class="sidebar-link-label">${label}</span></a>`;
  };

  const fifaBlock = isDtx
    ? `
        <div class="sidebar-tree">
          <div class="sidebar-branch">
            <a class="sidebar-link${active === "fifa" ? " is-active" : ""}" href="/fifa2026-admin">FIFA 2026</a>
            <div class="sidebar-children">
              <a class="sidebar-sublink" href="/fifa2026" target="_blank" rel="noreferrer">Public Page</a>
            </div>
          </div>
        </div>
      `
    : "";

  // DTX order requested by Bataa: Trip, Tourist, Contracts, Invoices,
  // Documents, To-Do, Flights, Transfer, Camp, DS-160, FIFA, Team/Admin.
  // USM keeps the existing reservation-first ordering.
  const dtxLinks = `
    ${link("home", "/backoffice", "Home / Trip")}
    ${link("tourist", "/tourist", "Tourist")}
    ${link("contracts", "/contracts", "Contracts")}
    ${link("invoices", "/invoices", "Invoices")}
    ${link("documents", "/documents", "Documents")}
    ${link("mail", "/mail", "Mail")}
    ${link("todo", "/todo", "To Do")}
    ${link("contacts", "/contacts", "Contacts")}
    ${link("notes", "/notes", "Notes")}
    ${link("flight-reservations", "/flight-reservations", "Flight Reservations")}
    ${link("transfer-reservations", "/transfer-reservations", "Transfer Reservations")}
    ${link("camp-reservations", "/camp-reservations", "Camp Reservations")}
    ${link("ds160", "/ds160", "DS-160")}
    ${fifaBlock}
    ${isAdmin ? link("admin", "/admin", "Team / Admin") : ""}
    ${link("settings", "/settings", "Settings")}
  `;
  const usmLinks = `
    ${link("home", "/backoffice", "Home / Trip")}
    ${link("tourist", "/tourist", "Tourist")}
    ${link("camp-reservations", "/camp-reservations", "Camp Reservations")}
    ${link("flight-reservations", "/flight-reservations", "Flight Reservations")}
    ${link("transfer-reservations", "/transfer-reservations", "Transfer Reservations")}
    ${link("contracts", "/contracts", "Contracts")}
    ${link("invoices", "/invoices", "Invoices")}
    ${link("documents", "/documents", "Documents")}
    ${link("mail", "/mail", "Mail")}
    ${link("todo", "/todo", "To Do")}
    ${link("contacts", "/contacts", "Contacts")}
    ${link("notes", "/notes", "Notes")}
    ${isAdmin ? link("admin", "/admin", "Team / Admin") : ""}
    ${link("settings", "/settings", "Settings")}
  `;

  sidebar.innerHTML = `
    <button type="button" class="sidebar-close" data-action="close-sidebar" aria-label="Close menu">×</button>
    <a class="sidebar-brand" href="/backoffice" aria-label="${company.name}">
      <img src="${company.logoBrand}" alt="${company.name}" />
    </a>
    <p class="sidebar-workspace-label">${company.name}</p>
    <div class="sidebar-group">
      <p class="sidebar-label">Backoffice</p>
      ${isDtx ? dtxLinks : usmLinks}
    </div>
    <div class="sidebar-switch">
      <p class="sidebar-label">Switch workspace</p>
      <button type="button" class="sidebar-switch-button" data-switch="${otherKey}" aria-label="Switch to ${other.name}">
        <img src="${other.logoIcon}" alt="${other.name}" />
        <span>${other.name}</span>
      </button>
    </div>
  `;

  sidebar.querySelector("[data-switch]")?.addEventListener("click", () => {
    setWorkspace(otherKey);
    window.location.href = "/backoffice";
  });
  sidebar.querySelector('[data-action="close-sidebar"]')?.addEventListener("click", () => {
    closeMobileSidebar();
  });
  sidebar.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => closeMobileSidebar());
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

function buildProfileChrome() {
  if (!profileCard) return;
  profileCard.classList.add("workspace-profile-compact");
  profileCard.innerHTML = `
    <button type="button" class="workspace-bell workspace-mail-icon" data-action="toggle-mail" aria-label="Mail">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="3" y="5" width="18" height="14" rx="2"></rect>
        <path d="M3 7l9 6 9-6"></path>
      </svg>
      <span class="workspace-bell-count" data-mail-count hidden>0</span>
    </button>
    <button type="button" class="workspace-bell workspace-reminder-icon" data-action="toggle-reminders" aria-label="Reminders &amp; mentions">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="13" r="8"></circle>
        <path d="M12 9v4l2.5 2.5"></path>
        <path d="M5 4l3.5-2"></path>
        <path d="M19 4l-3.5-2"></path>
      </svg>
      <span class="workspace-bell-count" data-reminder-count hidden>0</span>
    </button>
    <button type="button" class="workspace-bell" data-action="toggle-notifications" aria-label="Notifications">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M6 8a6 6 0 1 1 12 0c0 5.5 2 7 2 7H4s2-1.5 2-7Z"></path>
        <path d="M10 19a2 2 0 0 0 4 0"></path>
      </svg>
      <span class="workspace-bell-count" data-notif-count hidden>0</span>
    </button>
    <button type="button" class="workspace-profile-trigger" data-action="toggle-profile-menu" aria-haspopup="menu" aria-expanded="false">
      <span class="workspace-profile-avatar" data-profile-avatar>
        <span class="workspace-profile-avatar-fallback">?</span>
      </span>
      <span class="workspace-profile-text">
        <strong data-profile-name>Loading…</strong>
        <span data-profile-email></span>
      </span>
    </button>
    <div class="workspace-profile-menu" data-profile-menu hidden>
      <p class="workspace-profile-menu-label">My Account</p>
      <button type="button" class="workspace-profile-menu-item" data-action="edit-profile">Edit profile</button>
      <button type="button" class="workspace-profile-menu-item is-danger" data-action="logout">Sign out</button>
    </div>
    <div class="notifications-popover" data-notifications-popover hidden>
      <header>
        <h3>Notifications</h3>
        <button type="button" class="notifications-close" data-action="close-notifications" aria-label="Close">×</button>
      </header>
      <div class="notifications-list" data-notifications-list>
        <p class="notifications-empty">Loading…</p>
      </div>
    </div>
    <div class="notifications-popover mail-popover" data-mail-popover hidden>
      <header>
        <h3>Unread mail</h3>
        <button type="button" class="notifications-close" data-action="close-mail" aria-label="Close">×</button>
      </header>
      <div class="notifications-list" data-mail-list>
        <p class="notifications-empty">Loading…</p>
      </div>
      <footer class="mail-popover-footer">
        <a class="mail-popover-see-all" href="/mail">See all emails →</a>
      </footer>
    </div>
    <div class="notifications-popover" data-reminder-popover hidden>
      <header>
        <h3>Reminders &amp; mentions</h3>
        <button type="button" class="notifications-close" data-action="close-reminders" aria-label="Close">×</button>
      </header>
      <div class="notifications-list" data-reminder-list>
        <p class="notifications-empty">Loading…</p>
      </div>
      <footer class="mail-popover-footer">
        <a class="mail-popover-see-all" href="/notes">See all notes →</a>
      </footer>
    </div>
  `;
  profileNameNode = profileCard.querySelector("[data-profile-name]");
  profileEmailNode = profileCard.querySelector("[data-profile-email]");
  profileAvatarNode = profileCard.querySelector("[data-profile-avatar]");
  profileMenuWrapper = profileCard.querySelector("[data-profile-menu]");
  notificationBellNode = profileCard.querySelector('[data-action="toggle-notifications"]');
  notificationDotNode = profileCard.querySelector("[data-notif-dot]");
  notificationCountNode = profileCard.querySelector("[data-notif-count]");
  notificationPopoverNode = profileCard.querySelector("[data-notifications-popover]");
  mailIconNode = profileCard.querySelector('[data-action="toggle-mail"]');
  mailCountNode = profileCard.querySelector("[data-mail-count]");
  mailPopoverNode = profileCard.querySelector("[data-mail-popover]");

  profileCard.querySelector('[data-action="toggle-profile-menu"]').addEventListener("click", (event) => {
    event.stopPropagation();
    toggleProfileMenu();
  });
  profileCard.querySelector('[data-action="edit-profile"]').addEventListener("click", () => {
    closeProfileMenu();
    handleProfileEdit();
  });
  profileCard.querySelector('[data-action="logout"]').addEventListener("click", () => {
    closeProfileMenu();
    handleLogout();
  });
  notificationBellNode.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleNotifications();
  });
  profileCard.querySelector('[data-action="close-notifications"]')?.addEventListener("click", () => {
    closeNotifications();
  });
  mailIconNode?.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleMailPopover();
  });
  profileCard.querySelector('[data-action="close-mail"]')?.addEventListener("click", () => {
    closeMailPopover();
  });
  profileCard.querySelector('[data-action="toggle-reminders"]')?.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleReminderPopover();
  });
  profileCard.querySelector('[data-action="close-reminders"]')?.addEventListener("click", () => {
    closeReminderPopover();
  });
  document.addEventListener("click", (event) => {
    const inProfile = profileCard.contains(event.target);
    const inMobileBar = mobileBar?.contains(event.target);
    if (!inProfile && !inMobileBar) {
      closeProfileMenu();
      closeNotifications();
      closeMailPopover();
      closeReminderPopover();
    }
  });
}

function toggleProfileMenu(forceState) {
  if (!profileMenuWrapper) return;
  const trigger = profileCard?.querySelector('[data-action="toggle-profile-menu"]');
  const isOpen = typeof forceState === "boolean" ? forceState : profileMenuWrapper.hasAttribute("hidden");
  if (isOpen) {
    profileMenuWrapper.removeAttribute("hidden");
    trigger?.setAttribute("aria-expanded", "true");
    closeNotifications();
  } else {
    profileMenuWrapper.setAttribute("hidden", "");
    trigger?.setAttribute("aria-expanded", "false");
  }
}

function closeProfileMenu() {
  toggleProfileMenu(false);
}

function toggleNotifications(forceState) {
  if (!notificationPopoverNode) return;
  const isOpen = typeof forceState === "boolean" ? forceState : notificationPopoverNode.hasAttribute("hidden");
  if (isOpen) {
    notificationPopoverNode.removeAttribute("hidden");
    closeProfileMenu();
    closeMailPopover();
    markNotificationsRead();
  } else {
    notificationPopoverNode.setAttribute("hidden", "");
  }
}

function closeNotifications() {
  toggleNotifications(false);
}

function toggleMailPopover(forceState) {
  if (!mailPopoverNode) return;
  const isOpen = typeof forceState === "boolean" ? forceState : mailPopoverNode.hasAttribute("hidden");
  if (isOpen) {
    mailPopoverNode.removeAttribute("hidden");
    closeProfileMenu();
    closeNotifications();
    fetchMailUnread();
  } else {
    mailPopoverNode.setAttribute("hidden", "");
  }
}

function closeMailPopover() {
  toggleMailPopover(false);
}

function renderMailUnreadList() {
  if (!mailPopoverNode) return;
  const list = mailPopoverNode.querySelector("[data-mail-list]");
  if (!list) return;
  if (!mailUnreadCache.length) {
    list.innerHTML = `<p class="notifications-empty">No unread mail.</p>`;
    return;
  }
  list.innerHTML = mailUnreadCache
    .map((m) => {
      const sender = m.fromName || m.fromEmail || "(unknown)";
      const subject = m.subject || "(no subject)";
      const snippet = (m.snippet || "").trim();
      const url = `/mail?key=${encodeURIComponent(m.accountId)}:${encodeURIComponent(m.uid)}`;
      const tag = (m.workspace || "DTX").toUpperCase();
      const tagClass = tag === "USM" ? "mail-pop-tag mail-pop-tag--usm" : "mail-pop-tag mail-pop-tag--dtx";
      return `
        <a class="notifications-item notifications-item--link mail-pop-item" href="${escapeHtml(url)}">
          <span class="notification-avatar notification-avatar-icon">✉</span>
          <div class="notifications-item-body">
            <p><strong>${escapeHtml(sender)}</strong> <span class="${tagClass}">${escapeHtml(tag)}</span></p>
            <p class="mail-pop-subject">${escapeHtml(subject)}</p>
            ${snippet ? `<p class="mail-pop-snippet">${escapeHtml(snippet.slice(0, 110))}</p>` : ""}
            <time>${escapeHtml(formatRelativeTime(m.date))} · ${escapeHtml(m.accountAddress || "")}</time>
          </div>
        </a>
      `;
    })
    .join("");
}

function updateMailCount(unread) {
  const display = unread > 99 ? "99+" : String(unread || 0);
  if (mailCountNode) {
    mailCountNode.textContent = display;
    if (unread > 0) mailCountNode.removeAttribute("hidden");
    else mailCountNode.setAttribute("hidden", "");
  }
  if (mobileBar) {
    const count = mobileBar.querySelector("[data-mail-count-mobile]");
    if (count) {
      count.textContent = display;
      if (unread > 0) count.removeAttribute("hidden");
      else count.setAttribute("hidden", "");
    }
  }
}

async function fetchMailUnread() {
  try {
    const ws = readWorkspace();
    const qs = ws ? `?workspace=${encodeURIComponent(ws)}` : "";
    const response = await fetch(`/api/mail/unread-summary${qs}`);
    if (!response.ok) return;
    const data = await response.json();
    mailUnreadCache = Array.isArray(data.entries) ? data.entries : [];
    updateMailCount(data.count || 0);
    renderMailUnreadList();
  } catch {}
}

function startMailUnreadPolling() {
  if (mailUnreadPollTimer) clearInterval(mailUnreadPollTimer);
  fetchMailUnread();
  mailUnreadPollTimer = setInterval(fetchMailUnread, 60000);
}

// ── Reminder bell (between mail + notification) ─────────────────────
let reminderCache = [];
let reminderPopoverNode = null;
let reminderCountNode = null;
let reminderPollTimer = null;

function toggleReminderPopover(forceState) {
  if (!reminderPopoverNode) reminderPopoverNode = profileCard?.querySelector("[data-reminder-popover]");
  if (!reminderPopoverNode) return;
  const isOpen = typeof forceState === "boolean" ? forceState : reminderPopoverNode.hasAttribute("hidden");
  if (isOpen) {
    reminderPopoverNode.removeAttribute("hidden");
    closeProfileMenu();
    closeNotifications();
    if (mailPopoverNode) mailPopoverNode.setAttribute("hidden", "");
    fetchReminders().then(() => {
      // Mark as read on the server so the badge clears on the next poll
      // and stays cleared across reloads (until a new mention arrives).
      fetch("/api/reminders/mark-read", { method: "POST" }).catch(() => {});
      // Clear the badge immediately for snappy feedback.
      updateReminderCount(0);
    });
  } else {
    reminderPopoverNode.setAttribute("hidden", "");
  }
}
function closeReminderPopover() { toggleReminderPopover(false); }

function renderReminderList() {
  if (!reminderPopoverNode) return;
  const list = reminderPopoverNode.querySelector("[data-reminder-list]");
  if (!list) return;
  if (!reminderCache.length) {
    list.innerHTML = `<p class="notifications-empty">No reminders or mentions yet.</p>`;
    return;
  }
  list.innerHTML = reminderCache.map((item) => {
    if (item.kind === "task") {
      const due = item.dueDate ? `${item.dueDate}${item.dueTime ? " " + item.dueTime : ""}` : "no due date";
      const note = item.note ? `<p class="mail-pop-snippet">${escapeHtml(item.note)}</p>` : "";
      return `
        <a class="notifications-item notifications-item--link" href="/todo">
          <span class="notification-avatar notification-avatar-icon">◎</span>
          <div class="notifications-item-body">
            <p><strong>Task</strong> ${escapeHtml(item.title || "")}</p>
            ${note}
            <time>${escapeHtml(due)} · ${escapeHtml((item.createdBy?.name || "—"))}</time>
          </div>
        </a>
      `;
    }
    const trip = item.tripId ? `?tripId=${encodeURIComponent(item.tripId)}` : "";
    const url = item.tripId ? `/trip-detail${trip}` : "/notes";
    const author = item.createdBy?.name || item.createdBy?.email || "—";
    const avatar = item.createdByAvatar
      ? `<img src="${escapeHtml(item.createdByAvatar)}" alt="" class="notification-avatar"/>`
      : `<span class="notification-avatar notification-avatar-icon">@</span>`;
    return `
      <a class="notifications-item notifications-item--link" href="${escapeHtml(url)}">
        ${avatar}
        <div class="notifications-item-body">
          <p><strong>${escapeHtml(author)}</strong> mentioned you</p>
          <p class="mail-pop-snippet">${escapeHtml((item.body || "").slice(0, 140))}</p>
          <time>${escapeHtml(formatRelativeTime(item.createdAt))}</time>
        </div>
      </a>
    `;
  }).join("");
}

function updateReminderCount(n) {
  if (!reminderCountNode) reminderCountNode = profileCard?.querySelector("[data-reminder-count]");
  if (!reminderCountNode) return;
  const display = n > 99 ? "99+" : String(n || 0);
  reminderCountNode.textContent = display;
  if (n > 0) reminderCountNode.removeAttribute("hidden");
  else reminderCountNode.setAttribute("hidden", "");
}

async function fetchReminders() {
  try {
    const r = await fetch("/api/reminders");
    if (!r.ok) return;
    const data = await r.json();
    reminderCache = Array.isArray(data.items) ? data.items : [];
    updateReminderCount(data.count || 0);
    renderReminderList();
  } catch {}
}

function startReminderPolling() {
  if (reminderPollTimer) clearInterval(reminderPollTimer);
  fetchReminders();
  reminderPollTimer = setInterval(fetchReminders, 60000);
}

function renderProfile(user) {
  currentProfile = user;
  if (!profileCard) return;
  const displayName = user.fullName || user.email || "TravelX";
  const displayEmail = user.email || "";
  if (profileNameNode) profileNameNode.textContent = displayName;
  if (profileEmailNode) profileEmailNode.textContent = displayEmail;
  if (profileAvatarNode) {
    if (user.avatarPath) {
      profileAvatarNode.innerHTML = `<img src="${escapeHtml(user.avatarPath)}?v=${Date.now()}" alt="${escapeHtml(displayName)}" />`;
    } else {
      profileAvatarNode.innerHTML = `<span class="workspace-profile-avatar-fallback">${escapeHtml(getInitials(user.fullName, user.email))}</span>`;
    }
  }
  if (mobileBar) {
    const mobileAvatar = mobileBar.querySelector("[data-mobile-avatar]");
    if (mobileAvatar) {
      if (user.avatarPath) {
        mobileAvatar.innerHTML = `<img src="${escapeHtml(user.avatarPath)}?v=${Date.now()}" alt="${escapeHtml(displayName)}" />`;
      } else {
        mobileAvatar.innerHTML = `<span class="workspace-profile-avatar-fallback">${escapeHtml(getInitials(user.fullName, user.email))}</span>`;
      }
    }
  }
}

function formatRelativeTime(iso) {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} mo ago`;
  return `${Math.round(months / 12)} yr ago`;
}

function notificationIcon(kind) {
  if (kind && kind.startsWith("task")) return "◎";
  if (kind && kind.startsWith("contact")) return "☎";
  if (kind && kind.startsWith("camp_reservation")) return "⛺";
  if (kind && kind.startsWith("flight_reservation")) return "✈";
  if (kind && kind.startsWith("transfer_reservation")) return "🚐";
  if (kind && kind.startsWith("contract")) return "▤";
  if (kind && kind.startsWith("trip")) return "◉";
  return "•";
}

function notificationTargetUrl(entry) {
  const kind = entry?.kind || "";
  const meta = entry?.meta || {};
  const tripId = meta.tripId || (kind.startsWith("trip") ? meta.id : "");
  if (kind === "tourist.created") {
    if (meta.groupId && tripId) return `/group?groupId=${encodeURIComponent(meta.groupId)}&tripId=${encodeURIComponent(tripId)}`;
    if (tripId) return `/trip-detail?tripId=${encodeURIComponent(tripId)}`;
  }
  if (kind === "group.created") {
    if (meta.id && tripId) return `/group?groupId=${encodeURIComponent(meta.id)}&tripId=${encodeURIComponent(tripId)}`;
    if (tripId) return `/trip-detail?tripId=${encodeURIComponent(tripId)}`;
  }
  if (kind === "trip.created" && meta.id) return `/trip-detail?tripId=${encodeURIComponent(meta.id)}`;
  if (kind === "camp_reservation.created" && tripId) return `/trip-detail?tripId=${encodeURIComponent(tripId)}`;
  if (kind === "flight_reservation.created") return tripId ? `/trip-detail?tripId=${encodeURIComponent(tripId)}` : "/flight-reservations";
  if (kind === "transfer_reservation.created") return tripId ? `/trip-detail?tripId=${encodeURIComponent(tripId)}` : "/transfer-reservations";
  if (kind && kind.startsWith("contract")) return meta.id ? `/contracts?editId=${encodeURIComponent(meta.id)}` : "/contracts";
  if (kind && kind.startsWith("task")) return "/todo";
  return "";
}

// Click interceptor: when a notification's destination trip lives in the
// other workspace, set that workspace cookie before navigating so the page
// renders the trip immediately instead of flashing a "deleted" banner.
function attachNotificationClickHandler() {
  const list = notificationPopoverNode?.querySelector("[data-notifications-list]");
  if (!list || list._notifClickAttached) return;
  list._notifClickAttached = true;
  list.addEventListener("click", async (e) => {
    const link = e.target.closest("a.notifications-item--link[href]");
    if (!link) return;
    const url = link.getAttribute("href") || "";
    const tripIdMatch = url.match(/[?&]tripId=([^&]+)/);
    if (!tripIdMatch) return;
    const tripId = decodeURIComponent(tripIdMatch[1]);
    const currentWs = readWorkspace();
    if (!currentWs) return;
    e.preventDefault();
    try {
      const r = await fetch(`/api/camp-trips/${encodeURIComponent(tripId)}/info`);
      if (r.ok) {
        const data = await r.json();
        const tripWs = (data.company || "").toUpperCase();
        if (tripWs && tripWs !== currentWs) {
          setWorkspace(tripWs);
          try { sessionStorage.clear(); } catch {}
        }
      }
    } catch {}
    window.location.href = url;
  });
}

function renderNotificationsList() {
  if (!notificationPopoverNode) return;
  const list = notificationPopoverNode.querySelector("[data-notifications-list]");
  if (!list) return;
  attachNotificationClickHandler();
  if (!notificationsCache.length) {
    list.innerHTML = `<p class="notifications-empty">No activity yet.</p>`;
    return;
  }
  list.innerHTML = notificationsCache
    .map((entry) => {
      const actorName = entry.actor?.name || entry.actor?.email || "Someone";
      const detail = entry.detail ? ` — ${escapeHtml(entry.detail)}` : "";
      const avatarBlock = entry.actorAvatar
        ? `<span class="notification-avatar"><img src="${escapeHtml(entry.actorAvatar)}" alt=""></span>`
        : `<span class="notification-avatar notification-avatar-icon">${notificationIcon(entry.kind)}</span>`;
      const url = notificationTargetUrl(entry);
      const tag = url ? "a" : "article";
      const attrs = url ? ` class="notifications-item notifications-item--link" href="${escapeHtml(url)}"` : ` class="notifications-item"`;
      return `
        <${tag}${attrs}>
          ${avatarBlock}
          <div class="notifications-item-body">
            <p><strong>${escapeHtml(actorName)}</strong> ${escapeHtml(entry.title || "updated something")}${detail}</p>
            <time>${escapeHtml(formatRelativeTime(entry.createdAt))}</time>
          </div>
        </${tag}>
      `;
    })
    .join("");
}

function updateBellDot(unread) {
  const display = unread > 99 ? "99+" : String(unread || 0);
  if (notificationCountNode) {
    notificationCountNode.textContent = display;
    if (unread > 0) notificationCountNode.removeAttribute("hidden");
    else notificationCountNode.setAttribute("hidden", "");
  }
  if (notificationDotNode) {
    if (unread > 0) notificationDotNode.removeAttribute("hidden");
    else notificationDotNode.setAttribute("hidden", "");
  }
  if (mobileBar) {
    const count = mobileBar.querySelector("[data-notif-count-mobile]");
    if (count) {
      count.textContent = display;
      if (unread > 0) count.removeAttribute("hidden");
      else count.setAttribute("hidden", "");
    }
    const dot = mobileBar.querySelector("[data-notif-dot-mobile]");
    if (dot) {
      if (unread > 0) dot.removeAttribute("hidden");
      else dot.setAttribute("hidden", "");
    }
  }
}

async function fetchNotifications() {
  try {
    const response = await fetch("/api/notifications?limit=50");
    if (!response.ok) return;
    const data = await response.json();
    notificationsCache = Array.isArray(data.entries) ? data.entries : [];
    notificationsLastReadAt = data.lastReadAt || "";
    renderNotificationsList();
    updateBellDot(data.unread || 0);
  } catch {}
}

async function markNotificationsRead() {
  try {
    const response = await fetch("/api/notifications/read", { method: "POST" });
    if (!response.ok) return;
    const data = await response.json();
    notificationsLastReadAt = data.lastReadAt || notificationsLastReadAt;
    updateBellDot(0);
  } catch {}
}

function startNotificationPolling() {
  if (notificationsPollTimer) clearInterval(notificationsPollTimer);
  notificationsPollTimer = setInterval(fetchNotifications, 45000);
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
        <div class="full-span profile-avatar-row">
          <div class="profile-avatar-preview" data-avatar-preview>
            <span class="workspace-profile-avatar-fallback">?</span>
          </div>
          <div class="profile-avatar-actions">
            <label class="secondary-button profile-avatar-upload">
              Upload photo
              <input type="file" accept="image/png,image/jpeg,image/webp" id="profile-avatar-input" hidden />
            </label>
            <button type="button" class="secondary-button" id="profile-avatar-remove">Remove</button>
            <p class="profile-avatar-hint">PNG, JPG or WEBP. Max 4 MB.</p>
          </div>
        </div>
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
  const avatarPreview = wrapper.querySelector("[data-avatar-preview]");
  const avatarInput = wrapper.querySelector("#profile-avatar-input");
  const avatarRemoveButton = wrapper.querySelector("#profile-avatar-remove");
  wrapper._signaturePad = signaturePad;
  wrapper._state = { avatarData: "", removeAvatar: false };

  const renderAvatarPreview = () => {
    if (!avatarPreview) return;
    if (wrapper._state.avatarData) {
      avatarPreview.innerHTML = `<img src="${wrapper._state.avatarData}" alt="Profile preview" />`;
    } else if (!wrapper._state.removeAvatar && currentProfile?.avatarPath) {
      avatarPreview.innerHTML = `<img src="${currentProfile.avatarPath}?v=${Date.now()}" alt="Profile" />`;
    } else {
      avatarPreview.innerHTML = `<span class="workspace-profile-avatar-fallback">${escapeHtml(getInitials(currentProfile?.fullName, currentProfile?.email))}</span>`;
    }
  };

  avatarInput?.addEventListener("change", () => {
    const file = avatarInput.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      statusNode.textContent = "Image must be smaller than 4 MB.";
      avatarInput.value = "";
      return;
    }
    (async () => {
      try {
        const dataUrl = window.CompressUpload
          ? await window.CompressUpload.image(file)
          : await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result);
              reader.onerror = () => reject(new Error("read failed"));
              reader.readAsDataURL(file);
            });
        wrapper._state.avatarData = dataUrl;
        wrapper._state.removeAvatar = false;
        renderAvatarPreview();
      } catch {
        statusNode.textContent = "Could not read image.";
      }
    })();
  });
  avatarRemoveButton?.addEventListener("click", () => {
    wrapper._state.avatarData = "";
    wrapper._state.removeAvatar = true;
    avatarInput.value = "";
    renderAvatarPreview();
  });

  wrapper.querySelector("#profile-signature-clear")?.addEventListener("click", () => {
    signaturePad?.clear();
  });
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());
    delete payload["profile-avatar-input"];
    const fullName = String(payload.fullName || "").trim();
    if (signaturePad?.hasInk()) {
      payload.contractSignatureData = signatureCanvas.toDataURL("image/png");
    }
    if (wrapper._state.avatarData) {
      payload.avatarData = wrapper._state.avatarData;
    }
    if (wrapper._state.removeAvatar) {
      payload.removeAvatar = true;
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
      wrapper._state.avatarData = "";
      wrapper._state.removeAvatar = false;
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
  profileModal._renderAvatarPreview = renderAvatarPreview;
  return wrapper;
}

function openProfileModal() {
  if (!currentProfile) return;
  const modal = ensureProfileModal();
  const form = modal.querySelector("#profile-edit-form");
  const statusNode = modal.querySelector("#profile-edit-status");
  const signaturePad = modal._signaturePad;
  modal._state.avatarData = "";
  modal._state.removeAvatar = false;
  if (form) {
    form.elements.fullName.value = currentProfile.fullName || currentProfile.email || "";
    form.elements.contractLastName.value = currentProfile.contractLastName || "";
    form.elements.contractFirstName.value = currentProfile.contractFirstName || currentProfile.fullName || "";
    form.elements.contractEmail.value = currentProfile.contractEmail || currentProfile.email || "";
    form.elements.contractPhone.value = currentProfile.contractPhone || "";
    signaturePad?.loadExisting(currentProfile.contractSignaturePath || "");
  }
  modal._renderAvatarPreview?.();
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

// On mobile (≤900px), pull each .section-head .camp-toolbar out
// and place it as a .list-toolbar right above its sibling list/table.
// On desktop, restore the buttons back into their original section-head.
const MOBILE_TOOLBAR_QUERY = window.matchMedia("(max-width: 900px)");

function applySectionHeadToolbarPlacement() {
  try {
    const isMobile = MOBILE_TOOLBAR_QUERY.matches;
    if (isMobile) {
      document.querySelectorAll(".section-head .camp-toolbar").forEach((toolbar) => {
        if (toolbar.dataset.movedToList === "true") return;
        if (!toolbar.children.length) return;
        const card = toolbar.closest(".card, section");
        if (!card) return;
        const list = card.querySelector(".submission-list, .manager-table-wrap");
        if (!list) return;
        const wrapper = document.createElement("div");
        wrapper.className = "list-toolbar list-toolbar-mobile";
        while (toolbar.firstChild) wrapper.appendChild(toolbar.firstChild);
        toolbar.style.display = "none";
        toolbar.dataset.movedToList = "true";
        list.parentNode.insertBefore(wrapper, list);
      });
    } else {
      document.querySelectorAll(".list-toolbar-mobile").forEach((wrapper) => {
        const card = wrapper.closest(".card, section");
        if (!card) {
          wrapper.remove();
          return;
        }
        const toolbar = card.querySelector('.section-head .camp-toolbar[data-moved-to-list="true"]');
        if (toolbar) {
          while (wrapper.firstChild) toolbar.appendChild(wrapper.firstChild);
          toolbar.style.display = "";
          delete toolbar.dataset.movedToList;
        }
        wrapper.remove();
      });
    }
  } catch (err) {
    console.warn("applySectionHeadToolbarPlacement failed:", err);
  }
}

function ensureMobileBar() {
  const shell = document.querySelector(".workspace-shell");
  const main = document.querySelector(".workspace-main");
  if (!shell || !main || mobileBar) return;
  const workspace = readWorkspace();
  const company = workspace ? COMPANIES[workspace] : null;
  const logoSrc = company?.logoIcon || "/assets/favicon-dtx-x.png";
  const bar = document.createElement("div");
  bar.className = "workspace-mobile-bar";
  bar.innerHTML = `
    <button type="button" class="workspace-hamburger" data-action="open-sidebar" aria-label="Open menu">
      <span></span><span></span><span></span>
    </button>
    <a class="workspace-mobile-logo" href="/backoffice" aria-label="Home">
      <img src="${logoSrc}" alt="" />
    </a>
    <div class="workspace-mobile-spacer"></div>
    <button type="button" class="workspace-bell workspace-bell-mobile workspace-mail-icon" data-action="toggle-mail-mobile" aria-label="Mail">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="3" y="5" width="18" height="14" rx="2"></rect>
        <path d="M3 7l9 6 9-6"></path>
      </svg>
      <span class="workspace-bell-count" data-mail-count-mobile hidden>0</span>
    </button>
    <button type="button" class="workspace-bell workspace-bell-mobile" data-action="toggle-notifications-mobile" aria-label="Notifications">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M6 8a6 6 0 1 1 12 0c0 5.5 2 7 2 7H4s2-1.5 2-7Z"></path>
        <path d="M10 19a2 2 0 0 0 4 0"></path>
      </svg>
      <span class="workspace-bell-count" data-notif-count-mobile hidden>0</span>
    </button>
    <button type="button" class="workspace-mobile-avatar-btn" data-action="toggle-profile-menu-mobile" aria-label="Profile">
      <span class="workspace-profile-avatar" data-mobile-avatar>
        <span class="workspace-profile-avatar-fallback">?</span>
      </span>
    </button>
  `;
  main.insertBefore(bar, main.firstChild);
  mobileBar = bar;

  bar.querySelector('[data-action="open-sidebar"]').addEventListener("click", () => {
    openMobileSidebar();
  });
  bar.querySelector('[data-action="toggle-notifications-mobile"]').addEventListener("click", (event) => {
    event.stopPropagation();
    toggleNotifications();
    const dot = bar.querySelector("[data-notif-dot-mobile]");
    if (dot) dot.setAttribute("hidden", "");
  });
  bar.querySelector('[data-action="toggle-mail-mobile"]').addEventListener("click", (event) => {
    event.stopPropagation();
    toggleMailPopover();
  });
  bar.querySelector('[data-action="toggle-profile-menu-mobile"]').addEventListener("click", (event) => {
    event.stopPropagation();
    toggleProfileMenu();
  });

  if (!sidebarBackdrop) {
    sidebarBackdrop = document.createElement("div");
    sidebarBackdrop.className = "workspace-sidebar-backdrop";
    sidebarBackdrop.setAttribute("hidden", "");
    sidebarBackdrop.addEventListener("click", () => closeMobileSidebar());
    document.body.appendChild(sidebarBackdrop);
  }
}

function openMobileSidebar() {
  document.body.classList.add("sidebar-open");
  sidebarBackdrop?.removeAttribute("hidden");
}

function closeMobileSidebar() {
  document.body.classList.remove("sidebar-open");
  sidebarBackdrop?.setAttribute("hidden", "");
}

function findClippingAncestor(el) {
  let node = el.parentElement;
  while (node && node !== document.body && node !== document.documentElement) {
    const style = getComputedStyle(node);
    if (/(auto|scroll|hidden|clip)/.test(style.overflowX + " " + style.overflowY)) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

function resetPopoverInlineStyle(popover) {
  popover.style.position = "";
  popover.style.top = "";
  popover.style.bottom = "";
  popover.style.left = "";
  popover.style.right = "";
  popover.style.width = "";
  popover.style.minWidth = "";
  popover.style.zIndex = "";
}

document.addEventListener(
  "toggle",
  (event) => {
    const details = event.target;
    if (!details.matches || !details.matches("details.trip-menu")) return;
    const popover = details.querySelector(".trip-menu-popover");
    if (!popover) return;
    if (!details.open) {
      resetPopoverInlineStyle(popover);
      details.classList.remove("is-upward");
      return;
    }
    const summary = details.querySelector("summary");
    if (!summary) return;
    const triggerRect = summary.getBoundingClientRect();
    const popRect = popover.getBoundingClientRect();
    const popHeight = popRect.height || Math.max(180, popover.querySelectorAll("button, a, .trip-menu-item").length * 44 + 24);
    const popWidth = popRect.width || 220;
    const clipAncestor = findClippingAncestor(details);
    const clipRect = clipAncestor?.getBoundingClientRect();
    const clipTop = clipRect ? Math.max(0, clipRect.top) : 0;
    const clipBottom = clipRect ? Math.min(window.innerHeight, clipRect.bottom) : window.innerHeight;
    const fitsBelowClip = clipBottom - triggerRect.bottom >= popHeight + 16;
    const fitsAboveClip = triggerRect.top - clipTop >= popHeight + 16;

    resetPopoverInlineStyle(popover);
    details.classList.remove("is-upward");

    if (fitsBelowClip) {
      return;
    }
    if (fitsAboveClip) {
      popover.style.top = "auto";
      popover.style.bottom = "calc(100% + 8px)";
      details.classList.add("is-upward");
      return;
    }
    const viewSpaceBelow = window.innerHeight - triggerRect.bottom;
    const fixedUpward = viewSpaceBelow < popHeight + 16 && triggerRect.top > popHeight + 16;
    const clampedLeft = Math.max(8, Math.min(window.innerWidth - popWidth - 8, triggerRect.right - popWidth));
    popover.style.position = "fixed";
    popover.style.zIndex = "1000";
    popover.style.left = `${clampedLeft}px`;
    popover.style.right = "auto";
    if (fixedUpward) {
      popover.style.bottom = `${Math.max(8, window.innerHeight - triggerRect.top + 8)}px`;
      popover.style.top = "auto";
      details.classList.add("is-upward");
    } else {
      popover.style.top = `${triggerRect.bottom + 8}px`;
      popover.style.bottom = "auto";
    }
  },
  true,
);

async function loadProfile() {
  if (!ensureWorkspaceOrRedirect()) return;
  applyWorkspaceBranding();
  ensureMobileBar();
  applySectionHeadToolbarPlacement();
  MOBILE_TOOLBAR_QUERY.addEventListener?.("change", applySectionHeadToolbarPlacement);
  if (!profileCard) {
    renderSidebar(null);
    return;
  }
  buildProfileChrome();
  try {
    const response = await fetch("/api/auth/me");
    const data = await response.json();
    if (!response.ok || !data.user) {
      throw new Error();
    }
    renderProfile(data.user);
    renderSidebar(data.user);
    fetchNotifications();
    startNotificationPolling();
    startMailUnreadPolling();
    startReminderPolling();
  } catch {
    if (profileNameNode) profileNameNode.textContent = "TravelX Staff";
    if (profileEmailNode) profileEmailNode.textContent = "Profile unavailable";
    renderSidebar(null);
  }
}

loadProfile();

// Inject AI agent widget on every page; the widget itself only mounts for admins.
(function injectAgentWidget() {
  if (document.querySelector('script[data-agent-widget]')) return;
  const s = document.createElement("script");
  // Per-page-load timestamp so the widget always re-fetches; avoids stale
  // browser cache (Atlas, Safari, Chrome) when we ship widget changes
  // in quick succession.
  s.src = "/agent-widget.js?t=" + Date.now();
  s.defer = true;
  s.setAttribute("data-agent-widget", "1");
  document.head.appendChild(s);
})();
