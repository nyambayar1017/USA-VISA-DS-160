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
  // Keep each page's own <title> (e.g. "TravelX Gallery") but swap the
  // shared "TravelX" prefix for the active workspace's short code so the
  // browser tab reads "DTX Gallery" / "USM Gallery". Pages without
  // "TravelX" in their <title> are left alone.
  document.title = document.title.replace(/TravelX/g, company.short);
  // Expose the short code so dynamic title-setters (backoffice.js etc.)
  // can match the same prefix without re-reading workspace state.
  window.WORKSPACE_SHORT = company.short;
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
  return source.charAt(0).toUpperCase();
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
let paymentIconNode = null;
let paymentCountNode = null;
let paymentPopoverNode = null;
let paymentRequestsCache = [];
let paymentRequestsPollTimer = null;
let sidebarBackdrop = null;
let mobileBar = null;

function renderSidebar(user) {
  const sidebar = document.querySelector("[data-workspace-sidebar]");
  if (!sidebar) return;
  const workspace = readWorkspace();
  if (!workspace) return;
  // /todo and /contacts both serve backoffice.html (data-page="todo"), so
  // fall back to the URL when the body tag can't tell them apart.
  const path = window.location.pathname || "";
  const active = path === "/contacts" ? "contacts" : (document.body.dataset.page || "");
  const company = COMPANIES[workspace];
  const other = workspace === "DTX" ? COMPANIES.USM : COMPANIES.DTX;
  const otherKey = workspace === "DTX" ? "USM" : "DTX";
  const role = (user?.role || "").toLowerCase();
  const isAdmin = role === "admin";
  const isAccountant = role === "accountant";
  // Accountant page is read-only for non-accountants; show for all.
  const showAccountant = !!user;
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
    gallery: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="1.6"/><polyline points="21,16 16,11 8,19"/></svg>',
    content: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v14H4z"/><line x1="8" y1="9" x2="16" y2="9"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></svg>',
    templates: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="7" height="7" rx="1.2"/><rect x="13" y="4" width="7" height="7" rx="1.2"/><rect x="4" y="13" width="7" height="7" rx="1.2"/><rect x="13" y="13" width="7" height="7" rx="1.2"/></svg>',
    accountant: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3h11l4 4v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"/><path d="M16 3v4h4"/><text x="12" y="17" text-anchor="middle" font-size="9" font-family="Arial" fill="currentColor" stroke="none">₮</text></svg>',
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
    ${link("content", "/content", "Content")}
    ${link("templates", "/templates", "Templates")}
    ${link("gallery", "/gallery", "Gallery")}
    ${link("flight-reservations", "/flight-reservations", "Flight Reservations")}
    ${link("transfer-reservations", "/transfer-reservations", "Transfer Reservations")}
    ${link("camp-reservations", "/camp-reservations", "Camp Reservations")}
    ${link("ds160", "/ds160", "DS-160")}
    ${fifaBlock}
    ${showAccountant ? link("accountant", "/accountant", "Accountant") : ""}
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
    ${link("content", "/content", "Content")}
    ${link("templates", "/templates", "Templates")}
    ${link("gallery", "/gallery", "Gallery")}
    ${showAccountant ? link("accountant", "/accountant", "Accountant") : ""}
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
    <button type="button" class="workspace-bell workspace-payment-icon" data-action="toggle-payment-requests" aria-label="Payment requests" hidden>
      <span class="workspace-bell-tugrik" aria-hidden="true">₮</span>
      <span class="workspace-bell-count" data-payment-request-count hidden>0</span>
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
    <div class="notifications-popover" data-payment-request-popover hidden>
      <header>
        <h3>Pending payment requests</h3>
        <button type="button" class="notifications-close" data-action="close-payment-requests" aria-label="Close">×</button>
      </header>
      <div class="notifications-list" data-payment-request-list>
        <p class="notifications-empty">Loading…</p>
      </div>
      <footer class="mail-popover-footer">
        <a class="mail-popover-see-all" href="/accountant?status=pending">Open Accountant →</a>
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
  // Per-item Read / Delete buttons inside the unread mail dropdown.
  mailPopoverNode?.querySelector("[data-mail-list]")?.addEventListener("click", handleMailItemAction);
  profileCard.querySelector('[data-action="toggle-reminders"]')?.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleReminderPopover();
  });
  profileCard.querySelector('[data-action="close-reminders"]')?.addEventListener("click", () => {
    closeReminderPopover();
  });
  // ₮ icon — only mounted for users with role admin/accountant. The
  // icon stays hidden until applyPaymentIconVisibility() flips it in
  // based on /api/auth/me.
  paymentIconNode = profileCard.querySelector('[data-action="toggle-payment-requests"]');
  paymentCountNode = profileCard.querySelector("[data-payment-request-count]");
  paymentPopoverNode = profileCard.querySelector("[data-payment-request-popover]");
  paymentIconNode?.addEventListener("click", (event) => {
    event.stopPropagation();
    togglePaymentRequestPopover();
  });
  // Generic close-on-outside-click for every <details> popover on the
  // page (view dropdowns, kebab menus, filter pills, etc). Browsers
  // don't auto-close <details>; this matches the workspace bell /
  // mail / reminder behavior we already have.
  document.addEventListener("click", (event) => {
    document.querySelectorAll("details[open]").forEach((d) => {
      // Skip the trip-card menus that have their own close-on-outside
      // handler (they reposition before close).
      if (!d.contains(event.target)) d.removeAttribute("open");
    });
  });
  profileCard.querySelector('[data-action="close-payment-requests"]')?.addEventListener("click", () => {
    closePaymentRequestPopover();
  });
  document.addEventListener("click", (event) => {
    const inProfile = profileCard.contains(event.target);
    const inMobileBar = mobileBar?.contains(event.target);
    if (!inProfile && !inMobileBar) {
      closeProfileMenu();
      closeNotifications();
      closeMailPopover();
      closeReminderPopover();
      closePaymentRequestPopover();
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

// Per-user dismissed list lives in localStorage. "Delete from notification"
// removes the email from the unread popup only — the message itself stays
// untouched in the inbox. Re-syncs server state on next mark-read action.
const DISMISSED_MAIL_KEY = "dismissedMailKeys";
function readDismissedMail() {
  try { return new Set(JSON.parse(localStorage.getItem(DISMISSED_MAIL_KEY) || "[]")); }
  catch { return new Set(); }
}
function writeDismissedMail(set) {
  try {
    const arr = Array.from(set);
    // Cap so a heavy mailbox doesn't bloat localStorage forever.
    const trimmed = arr.length > 500 ? arr.slice(arr.length - 500) : arr;
    localStorage.setItem(DISMISSED_MAIL_KEY, JSON.stringify(trimmed));
  } catch {}
}
function mailKey(m) { return `${m.accountId}:${m.uid}`; }

function renderMailUnreadList() {
  if (!mailPopoverNode) return;
  const list = mailPopoverNode.querySelector("[data-mail-list]");
  if (!list) return;
  const dismissed = readDismissedMail();
  const visible = mailUnreadCache.filter((m) => !dismissed.has(mailKey(m)));
  if (!visible.length) {
    list.innerHTML = `<p class="notifications-empty">No unread mail.</p>`;
    return;
  }
  list.innerHTML = visible
    .map((m) => {
      const sender = m.fromName || m.fromEmail || "(unknown)";
      const subject = m.subject || "(no subject)";
      const snippet = (m.snippet || "").trim();
      const url = `/mail?key=${encodeURIComponent(m.accountId)}:${encodeURIComponent(m.uid)}`;
      const tag = (m.workspace || "DTX").toUpperCase();
      const tagClass = tag === "USM" ? "mail-pop-tag mail-pop-tag--usm" : "mail-pop-tag mail-pop-tag--dtx";
      const key = mailKey(m);
      return `
        <div class="notifications-item mail-pop-item" data-mail-key="${escapeHtml(key)}">
          <a class="mail-pop-item-link" href="${escapeHtml(url)}">
            <span class="notification-avatar notification-avatar-icon">✉</span>
            <div class="notifications-item-body">
              <p><strong>${escapeHtml(sender)}</strong> <span class="${tagClass}">${escapeHtml(tag)}</span></p>
              <p class="mail-pop-subject">${escapeHtml(subject)}</p>
              ${snippet ? `<p class="mail-pop-snippet">${escapeHtml(snippet.slice(0, 110))}</p>` : ""}
              <time>${escapeHtml(formatRelativeTime(m.date))} · ${escapeHtml(m.accountAddress || "")}</time>
            </div>
          </a>
          <div class="mail-pop-item-actions">
            <button type="button" class="mail-pop-action mail-pop-action--read"
              data-mail-action="read"
              data-account="${escapeHtml(m.accountId)}"
              data-uid="${escapeHtml(String(m.uid))}"
              title="Mark as read">Read</button>
            <button type="button" class="mail-pop-action mail-pop-action--dismiss"
              data-mail-action="delete"
              data-key="${escapeHtml(key)}"
              data-account="${escapeHtml(m.accountId)}"
              data-uid="${escapeHtml(String(m.uid))}"
              title="Move this email to trash">Delete</button>
          </div>
        </div>
      `;
    })
    .join("");
}

async function handleMailItemAction(event) {
  const btn = event.target.closest("[data-mail-action]");
  if (!btn) return;
  event.preventDefault();
  event.stopPropagation();
  const action = btn.dataset.mailAction;
  if (action === "delete") {
    const key = btn.dataset.key;
    const accountId = btn.dataset.account;
    const uid = btn.dataset.uid;
    btn.disabled = true;
    try {
      const res = await fetch(
        `/api/mail/messages/${encodeURIComponent(accountId)}/${encodeURIComponent(uid)}?folder=inbox`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("delete failed");
      // Also remember the dismissal locally so a stale poll doesn't pop
      // it back into the dropdown before the next refresh.
      const dismissed = readDismissedMail();
      dismissed.add(key);
      writeDismissedMail(dismissed);
      mailUnreadCache = mailUnreadCache.filter((m) => mailKey(m) !== key);
      updateMailCount(mailUnreadCache.length);
      renderMailUnreadList();
    } catch (_) {
      btn.disabled = false;
      window.UI?.toast?.("Could not delete email.", "error");
    }
    return;
  }
  if (action === "read") {
    const accountId = btn.dataset.account;
    const uid = btn.dataset.uid;
    btn.disabled = true;
    try {
      const res = await fetch(`/api/mail/messages/${encodeURIComponent(accountId)}/${encodeURIComponent(uid)}/read`, { method: "POST" });
      if (!res.ok) throw new Error("mark read failed");
      mailUnreadCache = mailUnreadCache.filter((m) => !(m.accountId === accountId && String(m.uid) === String(uid)));
      updateMailCount(mailUnreadCache.length);
      renderMailUnreadList();
    } catch (_) {
      btn.disabled = false;
      window.UI?.toast?.("Could not mark as read.", "error");
    }
    return;
  }
}

function updateMailCount(unread) {
  const display = String(unread || 0);
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

// ── ₮ Payment-request queue (admin / accountant only) ───────────────
function togglePaymentRequestPopover(forceState) {
  if (!paymentPopoverNode) return;
  const isOpen = typeof forceState === "boolean" ? forceState : paymentPopoverNode.hasAttribute("hidden");
  if (isOpen) {
    paymentPopoverNode.removeAttribute("hidden");
    closeProfileMenu();
    closeNotifications();
    closeMailPopover();
    closeReminderPopover();
    fetchPaymentRequests();
  } else {
    paymentPopoverNode.setAttribute("hidden", "");
  }
}

function closePaymentRequestPopover() {
  togglePaymentRequestPopover(false);
}

function applyPaymentIconVisibility(user) {
  // ₮ icon now visible to every logged-in user — managers can watch
  // their own requests get approved, accountants/admins act on them.
  const visible = !!user;
  if (paymentIconNode) {
    if (visible) paymentIconNode.removeAttribute("hidden");
    else paymentIconNode.setAttribute("hidden", "");
  }
  const mobileBtn = mobileBar?.querySelector('[data-action="toggle-payment-requests-mobile"]');
  if (mobileBtn) {
    if (visible) mobileBtn.removeAttribute("hidden");
    else mobileBtn.setAttribute("hidden", "");
  }
}

function updatePaymentRequestCount(count) {
  const display = String(count || 0);
  if (paymentCountNode) {
    paymentCountNode.textContent = display;
    if (count > 0) paymentCountNode.removeAttribute("hidden");
    else paymentCountNode.setAttribute("hidden", "");
  }
  const mobileCount = mobileBar?.querySelector("[data-payment-request-count-mobile]");
  if (mobileCount) {
    mobileCount.textContent = display;
    if (count > 0) mobileCount.removeAttribute("hidden");
    else mobileCount.setAttribute("hidden", "");
  }
}

function renderPaymentRequestList() {
  if (!paymentPopoverNode) return;
  const list = paymentPopoverNode.querySelector("[data-payment-request-list]");
  if (!list) return;
  if (!paymentRequestsCache.length) {
    list.innerHTML = `<p class="notifications-empty">No pending payment requests.</p>`;
    return;
  }
  list.innerHTML = paymentRequestsCache.map((r) => {
    const amount = `${(r.currency || "MNT")} ${Number(r.paidAmount || 0).toLocaleString()}`;
    const requester = (r.requestedBy && (r.requestedBy.name || r.requestedBy.email)) || "Unknown";
    const status = (r.status || "pending").toLowerCase();
    let statusPill = "";
    let footer = "";
    if (status === "approved") {
      const approver = (r.approvedBy && (r.approvedBy.name || r.approvedBy.email)) || "an accountant";
      statusPill = `<span class="payment-pop-status is-approved">Approved</span>`;
      footer = `<span>${escapeHtml(formatRelativeTime(r.approvedAt))}</span><span class="payment-pop-dot">·</span><span>by ${escapeHtml(approver)}</span>`;
    } else if (status === "rejected") {
      const rejecter = (r.rejectedBy && (r.rejectedBy.name || r.rejectedBy.email)) || "an accountant";
      statusPill = `<span class="payment-pop-status is-rejected">Rejected</span>`;
      footer = `<span>${escapeHtml(formatRelativeTime(r.rejectedAt))}</span><span class="payment-pop-dot">·</span><span>by ${escapeHtml(rejecter)}</span>`;
    } else {
      statusPill = `<span class="payment-pop-status is-pending">Pending</span>`;
      footer = `<span>${escapeHtml(formatRelativeTime(r.requestedAt))}</span><span class="payment-pop-dot">·</span><span>by ${escapeHtml(requester)}</span>`;
    }
    const reasonRow = (status === "rejected" && r.rejectReason)
      ? `<div class="payment-pop-reason">"${escapeHtml(r.rejectReason)}"</div>`
      : "";
    return `
      <button type="button" class="payment-pop-item is-${status}" data-payment-request-open="${escapeHtml(r.id)}">
        <div class="payment-pop-row">
          <strong class="payment-pop-serial">${escapeHtml(r.invoiceSerial || "Invoice")}</strong>
          ${statusPill}
          <span class="payment-pop-amount">${escapeHtml(amount)}</span>
        </div>
        <div class="payment-pop-meta">
          <span>${escapeHtml(r.payerName || "—")}</span>
          <span class="payment-pop-dot">·</span>
          <span>${escapeHtml(r.installmentDescription || "Installment")}</span>
        </div>
        ${reasonRow}
        <div class="payment-pop-foot">${footer}</div>
      </button>
    `;
  }).join("");
  list.querySelectorAll("[data-payment-request-open]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.paymentRequestOpen;
      const entry = paymentRequestsCache.find((r) => r.id === id);
      // Resolved rows are notifications, not actions — clicking does
      // nothing for them.
      if (!entry || (entry.status || "pending") !== "pending") return;
      openPaymentRequestApproveModal(id);
    });
  });
}

function isAccountantOrAdmin() {
  const role = (window.currentUser?.role || "").toLowerCase();
  return role === "admin" || role === "accountant";
}

// "+ Request expense" — outgoing payment request that managers create
// from the Accountant page topbar (and, in a follow-up, trip / group
// pages). The form lets the user pick a category from a workspace
// settings list, type a payee, amount, currency, bank account, due
// date, and an optional note. On submit it POSTs to
// /api/payment-requests with direction=outgoing.
let expenseModalNode = null;
let expenseSettings = { expenseCategories: [], expensePayees: [], bankAccounts: [] };
let expenseTrips = [];

async function loadExpenseSettings() {
  try {
    const [settingsRes, tripsRes] = await Promise.all([
      fetch("/api/settings").then((r) => r.ok ? r.json() : null),
      fetch("/api/camp-trips").then((r) => r.ok ? r.json() : { entries: [] }),
    ]);
    expenseSettings = settingsRes || expenseSettings;
    expenseTrips = (tripsRes?.entries || []).map((t) => ({ id: t.id, name: t.tripName || t.serial || t.id, serial: t.serial || "" }));
  } catch {}
}

function buildExpenseModal() {
  if (expenseModalNode) return expenseModalNode;
  expenseModalNode = document.createElement("div");
  expenseModalNode.className = "payment-approve-modal expense-request-modal is-hidden";
  expenseModalNode.innerHTML = `
    <div class="payment-approve-backdrop" data-action="close-expense"></div>
    <div class="payment-approve-dialog">
      <button type="button" class="payment-approve-close" data-action="close-expense" aria-label="Close">×</button>
      <header>
        <h2>Request expense payment</h2>
        <p class="payment-approve-sub">Ask the accountant to pay this from one of our bank accounts. They will attach the bank-transfer receipt when they pay.</p>
      </header>
      <form class="expense-form" data-expense-form enctype="multipart/form-data">
        <div class="payment-approve-file-label">
          Vendor invoice / quote
          <div class="payment-approve-drop" data-expense-drop>
            <input type="file" name="vendorInvoice" accept=".pdf,.png,.jpg,.jpeg,.gif" hidden data-expense-file />
            <p class="payment-approve-drop-msg" data-expense-drop-msg>
              <strong>Drag the vendor's bill here</strong> or <button type="button" class="link-btn" data-action="expense-pick-file">click to pick a file</button>.
            </p>
            <small class="form-hint">Bill, quote, or contract from the vendor. The accountant will pay it and attach the bank receipt at approval time.</small>
          </div>
        </div>
        <label class="payment-approve-file-label" data-expense-scope-row>
          Scope
          <select name="scope">
            <option value="office">Office / overhead (rent, ads, salary…)</option>
            <option value="trip">Tied to a trip (driver, hotel, etc.)</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label class="payment-approve-file-label" data-expense-trip-row hidden>
          Trip
          <select name="tripId" data-expense-trip-select>
            <option value="">— Pick a trip —</option>
          </select>
        </label>
        <label class="payment-approve-file-label">
          Category <span class="inv-required" style="color:#c44747">*</span>
          <select name="category" data-expense-category-select required></select>
        </label>
        <label class="payment-approve-file-label" data-expense-category-other-row hidden>
          New category name
          <input type="text" name="categoryOther" placeholder="e.g. Garage rent" />
        </label>
        <label class="payment-approve-file-label">
          Payee <span class="inv-required" style="color:#c44747">*</span>
          <input type="text" name="payeeName" placeholder="Who gets paid (vendor / employee / hotel)" required list="expense-payee-suggestions" />
          <datalist id="expense-payee-suggestions"></datalist>
        </label>
        <div class="expense-form-row">
          <label class="payment-approve-file-label">
            Amount <span class="inv-required" style="color:#c44747">*</span>
            <input type="number" name="paidAmount" min="0" step="1" inputmode="numeric" pattern="[0-9]*" required />
          </label>
          <label class="payment-approve-file-label">
            Currency
            <select name="currency">
              <option value="MNT">MNT</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </label>
        </div>
        <label class="payment-approve-file-label">
          Pay from (optional)
          <select name="bankAccountId" data-expense-bank-select>
            <option value="">— Accountant will pick —</option>
          </select>
        </label>
        <label class="payment-approve-file-label">
          Due by (optional)
          <input type="date" name="dueDate" />
        </label>
        <label class="payment-approve-file-label">
          Note
          <textarea name="note" rows="2" placeholder="Reference, urgency, account number, etc."></textarea>
        </label>
        <footer style="display:flex;justify-content:flex-end;gap:8px;margin-top:18px;">
          <p class="status" data-expense-status style="margin-right:auto;font-size:13px;color:#5d6b87;"></p>
          <button type="button" class="button-secondary" data-action="close-expense">Cancel</button>
          <button type="submit" class="primary-pill">Send request</button>
        </footer>
      </form>
    </div>
  `;
  document.body.appendChild(expenseModalNode);
  expenseModalNode.addEventListener("click", (e) => {
    const a = e.target.closest("[data-action]")?.dataset?.action;
    if (a === "close-expense") closeExpenseRequestModal();
  });
  expenseModalNode.querySelector("[data-expense-form]").addEventListener("submit", submitExpenseRequest);
  // Vendor-invoice dropzone wiring (matches the approve-modal one).
  const drop = expenseModalNode.querySelector("[data-expense-drop]");
  const fileInput = expenseModalNode.querySelector("[data-expense-file]");
  const dropMsg = expenseModalNode.querySelector("[data-expense-drop-msg]");
  const showFile = (file) => {
    if (!file || !dropMsg) return;
    dropMsg.innerHTML = `<strong>📎 ${escapeHtml(file.name)}</strong> <button type="button" class="link-btn" data-action="expense-pick-file">change</button>`;
  };
  drop?.addEventListener("click", (e) => {
    if (e.target.dataset?.action === "expense-pick-file") fileInput.click();
  });
  drop?.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("is-drag"); });
  drop?.addEventListener("dragleave", () => drop.classList.remove("is-drag"));
  drop?.addEventListener("drop", (e) => {
    e.preventDefault();
    drop.classList.remove("is-drag");
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    const dt = new DataTransfer();
    dt.items.add(file);
    fileInput.files = dt.files;
    showFile(file);
  });
  fileInput?.addEventListener("change", () => showFile(fileInput.files?.[0]));
  // Strip decimals from the amount input so users can't enter
  // 38393999.99 — the field is integer-only per the user's ask.
  const amtInput = expenseModalNode.querySelector("input[name='paidAmount']");
  amtInput?.addEventListener("input", () => {
    const cleaned = String(amtInput.value || "").replace(/[^\d]/g, "");
    if (cleaned !== amtInput.value) amtInput.value = cleaned;
  });
  expenseModalNode.querySelector("select[name='scope']").addEventListener("change", (e) => {
    const tripRow = expenseModalNode.querySelector("[data-expense-trip-row]");
    if (e.target.value === "trip") tripRow.removeAttribute("hidden");
    else tripRow.setAttribute("hidden", "");
  });
  expenseModalNode.querySelector("[data-expense-category-select]").addEventListener("change", (e) => {
    const otherRow = expenseModalNode.querySelector("[data-expense-category-other-row]");
    if (e.target.value === "__other__") otherRow.removeAttribute("hidden");
    else otherRow.setAttribute("hidden", "");
  });
  return expenseModalNode;
}

function fillExpenseModalSelects() {
  const cats = expenseSettings.expenseCategories || [];
  const catSel = expenseModalNode.querySelector("[data-expense-category-select]");
  catSel.innerHTML = '<option value="">— Pick a category —</option>'
    + cats.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("")
    + '<option value="__other__">+ New category…</option>';

  const tripSel = expenseModalNode.querySelector("[data-expense-trip-select]");
  tripSel.innerHTML = '<option value="">— Pick a trip —</option>'
    + expenseTrips.map((t) => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.name)}${t.serial ? ` (${escapeHtml(t.serial)})` : ""}</option>`).join("");

  const bankSel = expenseModalNode.querySelector("[data-expense-bank-select]");
  bankSel.innerHTML = '<option value="">— Accountant will pick —</option>'
    + (expenseSettings.bankAccounts || []).map((b) => {
        const label = b.label || `${b.bankName || ""} · ${b.accountNumber || ""}`;
        return `<option value="${escapeHtml(b.id)}">${escapeHtml(label)}</option>`;
      }).join("");

  const dlist = expenseModalNode.querySelector("#expense-payee-suggestions");
  dlist.innerHTML = (expenseSettings.expensePayees || [])
    .map((p) => `<option value="${escapeHtml(p)}"></option>`).join("");
}

let expenseOnSuccess = null;

window.openExpenseRequestModal = async function openExpenseRequestModal(opts = {}) {
  buildExpenseModal();
  await loadExpenseSettings();
  fillExpenseModalSelects();
  const form = expenseModalNode.querySelector("[data-expense-form]");
  form.reset();
  // When the modal is opened from a trip context (Trip P&L "+ Pay"
  // button), skip the Scope + Trip pickers entirely — scope is
  // obviously "trip" and the tripId is already known. Only the
  // generic Accountant-page entry point needs those fields.
  const scopeRow = expenseModalNode.querySelector("[data-expense-scope-row]");
  const tripRow  = expenseModalNode.querySelector("[data-expense-trip-row]");
  const fromTrip = !!opts.tripId;
  if (fromTrip) {
    form.scope.value = "trip";
    form.tripId.value = opts.tripId;
    scopeRow?.setAttribute("hidden", "");
    tripRow?.setAttribute("hidden", "");
  } else {
    scopeRow?.removeAttribute("hidden");
    if (opts.scope) {
      form.scope.value = opts.scope;
      form.scope.dispatchEvent(new Event("change"));
    } else {
      form.scope.value = "office";
      form.scope.dispatchEvent(new Event("change"));
    }
  }
  if (opts.category) form.category.value = opts.category;
  if (opts.payeeName) form.payeeName.value = opts.payeeName;
  if (opts.amount) form.paidAmount.value = opts.amount;
  if (opts.currency) form.currency.value = opts.currency;
  expenseOnSuccess = opts.onSuccess || null;
  expenseModalNode.classList.remove("is-hidden");
  document.body.classList.add("modal-open");
};

function closeExpenseRequestModal() {
  if (!expenseModalNode) return;
  expenseModalNode.classList.add("is-hidden");
  document.body.classList.remove("modal-open");
  expenseOnSuccess = null;
}

async function submitExpenseRequest(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const status = expenseModalNode.querySelector("[data-expense-status]");
  status.style.color = "";
  status.textContent = "Sending…";
  const fd = new FormData(form);
  let category = fd.get("category");
  if (category === "__other__") {
    category = (fd.get("categoryOther") || "").trim();
    if (!category) { status.style.color = "#c44747"; status.textContent = "Type the new category name."; return; }
  }
  const fields = {
    direction: "outgoing",
    scope: fd.get("scope") || "office",
    category,
    tripId: fd.get("scope") === "trip" ? (fd.get("tripId") || "") : "",
    payeeName: (fd.get("payeeName") || "").trim(),
    paidAmount: Number(fd.get("paidAmount") || 0),
    currency: fd.get("currency") || "MNT",
    bankAccountId: fd.get("bankAccountId") || "",
    dueDate: fd.get("dueDate") || "",
    note: fd.get("note") || "",
  };
  if (!fields.payeeName) { status.style.color = "#c44747"; status.textContent = "Payee is required."; return; }
  if (!(fields.paidAmount > 0)) { status.style.color = "#c44747"; status.textContent = "Amount must be greater than zero."; return; }
  // If the manager attached the vendor invoice, send multipart so the
  // server can store the file alongside the request. Otherwise stay
  // with the existing JSON path.
  const vendorFile = fd.get("vendorInvoice");
  const hasFile = vendorFile && vendorFile.size && vendorFile.name;
  let req;
  try {
    if (hasFile) {
      const out = new FormData();
      Object.entries(fields).forEach(([k, v]) => out.append(k, v == null ? "" : String(v)));
      out.append("vendorInvoice", vendorFile, vendorFile.name);
      req = fetch("/api/payment-requests", { method: "POST", body: out });
    } else {
      req = fetch("/api/payment-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
    }
    const r = await req;
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || "Could not send request");
    closeExpenseRequestModal();
    window.UI?.toast?.("Expense request sent.", "ok");
    fetchPaymentRequests();
    if (typeof expenseOnSuccess === "function") expenseOnSuccess();
  } catch (err) {
    status.style.color = "#c44747";
    status.textContent = err.message || "Could not send";
  }
}

// ── Approval modal ──────────────────────────────────────────────────
// Accountant clicks a pending request → modal shows the request details
// and asks for the proof file. Submit POSTs multipart to /approve which
// (a) attaches the file to the trip's Documents under "Paid documents"
// (b) flips the installment to paid, and (c) marks the request approved.
function escapeAttr(s) { return escapeHtml(s); }

function buildPaymentApproveModal() {
  let modal = document.getElementById("payment-approve-modal");
  if (modal) return modal;
  modal = document.createElement("div");
  modal.id = "payment-approve-modal";
  modal.className = "payment-approve-modal is-hidden";
  modal.innerHTML = `
    <div class="payment-approve-backdrop" data-action="close-approve"></div>
    <div class="payment-approve-dialog">
      <button type="button" class="payment-approve-close" data-action="close-approve" aria-label="Close">×</button>
      <header>
        <h2>Approve payment request</h2>
        <p class="payment-approve-sub">Upload the receipt — it auto-saves to the trip's Paid documents and the Accountant page.</p>
      </header>
      <div class="payment-approve-body" data-approve-body>
        <p class="notifications-empty">Loading…</p>
      </div>
      <footer>
        <p class="status" data-approve-status></p>
        <button type="button" class="button-secondary" data-action="reject-approve">Reject</button>
        <button type="button" class="button-secondary" data-action="close-approve">Cancel</button>
        <button type="button" class="button-secondary" data-action="approve-no-doc" title="Register the payment without uploading a receipt — useful when in a hurry; you can attach the receipt later.">Register without document</button>
        <button type="button" class="primary-pill" data-action="confirm-approve">Approve &amp; register</button>
      </footer>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener("click", (e) => {
    const a = e.target.closest("[data-action]")?.dataset?.action;
    if (a === "close-approve") closePaymentRequestApproveModal();
    if (a === "confirm-approve") submitPaymentApprove();
    if (a === "approve-no-doc") submitPaymentApproveNoDoc();
    if (a === "reject-approve") submitPaymentReject();
  });
  return modal;
}

let approveCurrentRequest = null;

async function openPaymentRequestApproveModal(requestId) {
  closePaymentRequestPopover();
  const modal = buildPaymentApproveModal();
  modal.classList.remove("is-hidden");
  document.body.classList.add("modal-open");
  const body = modal.querySelector("[data-approve-body]");
  body.innerHTML = `<p class="notifications-empty">Loading…</p>`;
  approveCurrentRequest = paymentRequestsCache.find((r) => r.id === requestId) || null;
  if (!approveCurrentRequest) {
    // Cache miss — refetch and try again.
    await fetchPaymentRequests();
    approveCurrentRequest = paymentRequestsCache.find((r) => r.id === requestId) || null;
  }
  if (!approveCurrentRequest) {
    body.innerHTML = `<p class="notifications-empty">This request is no longer available.</p>`;
    return;
  }
  const r = approveCurrentRequest;
  const amount = `${(r.currency || "MNT")} ${Number(r.paidAmount || 0).toLocaleString()}`;
  const canApprove = isAccountantOrAdmin();
  body.innerHTML = `
    <dl class="payment-approve-details">
      <div><dt>Invoice</dt><dd>${escapeHtml(r.invoiceSerial || "-")}</dd></div>
      <div><dt>Installment</dt><dd>${escapeHtml(r.installmentDescription || "-")}</dd></div>
      <div><dt>Payer</dt><dd>${escapeHtml(r.payerName || "-")}</dd></div>
      <div><dt>Amount</dt><dd>${escapeHtml(amount)}</dd></div>
      <div><dt>Paid date</dt><dd>${escapeHtml(r.paidDate || "-")}</dd></div>
      <div><dt>Bank</dt><dd>${escapeHtml(r.bankAccountId || "-")}</dd></div>
      <div><dt>Requested by</dt><dd>${escapeHtml((r.requestedBy && (r.requestedBy.name || r.requestedBy.email)) || "-")}</dd></div>
    </dl>
    ${canApprove ? `
      <div class="payment-approve-file-label">
        Receipt / proof
        <div class="payment-approve-drop" data-approve-drop>
          <input type="file" id="payment-approve-file" accept=".pdf,.png,.jpg,.jpeg,.gif" hidden />
          <p class="payment-approve-drop-msg" data-approve-drop-msg>
            <strong>Drag the receipt here</strong> or <button type="button" class="link-btn" data-action="approve-pick-file">click to pick a file</button>.
          </p>
          <small class="form-hint">PDF or image, max 10 MB. Auto-attached to the trip's "Paid documents".</small>
        </div>
      </div>
      <label class="payment-approve-file-label" style="margin-top:14px;">
        Note (optional)
        <textarea id="payment-approve-note" rows="2" placeholder="e.g. Bank fee deducted, partial payment, etc."></textarea>
      </label>
    ` : `
      <p class="form-hint" style="margin-top:8px;">An accountant or admin will register the payment and upload the receipt.</p>
    `}
  `;
  // Hide approve / reject buttons for users who can't act on the request.
  const approveBtn = document.querySelector('#payment-approve-modal [data-action="confirm-approve"]');
  const rejectBtn = document.querySelector('#payment-approve-modal [data-action="reject-approve"]');
  const skipBtn = document.querySelector('#payment-approve-modal [data-action="approve-no-doc"]');
  if (approveBtn) approveBtn.style.display = canApprove ? "" : "none";
  if (rejectBtn) rejectBtn.style.display = canApprove ? "" : "none";
  if (skipBtn) skipBtn.style.display = canApprove ? "" : "none";

  // Drag/drop + click-to-pick wiring (only when canApprove).
  if (canApprove) wireApproveFileDropzone();
}

function wireApproveFileDropzone() {
  const drop = document.querySelector("#payment-approve-modal [data-approve-drop]");
  const input = document.querySelector("#payment-approve-modal #payment-approve-file");
  const msg = document.querySelector("#payment-approve-modal [data-approve-drop-msg]");
  if (!drop || !input || !msg) return;
  const showFile = (file) => {
    if (!file) return;
    const dot = file.name.lastIndexOf(".");
    const stem = dot >= 0 ? file.name.slice(0, dot) : file.name;
    const ext  = dot >= 0 ? file.name.slice(dot) : "";
    msg.innerHTML = `
      <span class="payment-approve-file-row">
        <span>📎</span>
        <input type="text" class="payment-approve-file-name" data-approve-rename value="${escapeHtml(stem)}" />
        <span class="muted">${escapeHtml(ext)}</span>
        <button type="button" class="link-btn" data-action="approve-pick-file">change</button>
      </span>
      <small class="form-hint">Rename the file inline before approving — the new name is what saves to the trip's Paid documents.</small>
    `;
  };
  drop.addEventListener("click", (e) => {
    if (e.target.dataset?.action === "approve-pick-file") {
      input.click();
    }
  });
  drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("is-drag"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("is-drag"));
  drop.addEventListener("drop", (e) => {
    e.preventDefault();
    drop.classList.remove("is-drag");
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    showFile(file);
  });
  input.addEventListener("change", () => showFile(input.files?.[0]));
}

// Read the user's renamed filename (if any) and return a File with
// that name + the original extension. Browsers don't let you mutate
// a File's name, so we wrap it in a fresh File using the same blob.
function getApproveFileWithName(originalFile) {
  if (!originalFile) return null;
  const renameInput = document.querySelector("#payment-approve-modal [data-approve-rename]");
  const newStem = (renameInput?.value || "").trim();
  if (!newStem) return originalFile;
  const dot = originalFile.name.lastIndexOf(".");
  const ext = dot >= 0 ? originalFile.name.slice(dot) : "";
  const finalName = newStem.endsWith(ext) ? newStem : newStem + ext;
  if (finalName === originalFile.name) return originalFile;
  try {
    return new File([originalFile], finalName, { type: originalFile.type });
  } catch {
    return originalFile;
  }
}

function closePaymentRequestApproveModal() {
  const modal = document.getElementById("payment-approve-modal");
  if (!modal) return;
  modal.classList.add("is-hidden");
  document.body.classList.remove("modal-open");
  approveCurrentRequest = null;
  const status = modal.querySelector("[data-approve-status]");
  if (status) status.textContent = "";
}

async function submitPaymentApprove() {
  if (!approveCurrentRequest) return;
  const modal = document.getElementById("payment-approve-modal");
  if (!modal) return;
  const status = modal.querySelector("[data-approve-status]");
  const fileInput = modal.querySelector("#payment-approve-file");
  const noteInput = modal.querySelector("#payment-approve-note");
  const rawFile = fileInput?.files?.[0];
  if (!rawFile) {
    status.textContent = "Pick the receipt file first, or use Register without document.";
    status.style.color = "#c44747";
    return;
  }
  const file = getApproveFileWithName(rawFile);
  status.style.color = "";
  status.textContent = "Uploading and registering payment…";
  const fd = new FormData();
  fd.append("file", file, file.name);
  fd.append("paidAmount", String(approveCurrentRequest.paidAmount || ""));
  fd.append("paidDate", approveCurrentRequest.paidDate || "");
  fd.append("bankAccountId", approveCurrentRequest.bankAccountId || "");
  fd.append("note", noteInput?.value || "");
  try {
    const r = await fetch(`/api/payment-requests/${encodeURIComponent(approveCurrentRequest.id)}/approve`, {
      method: "POST",
      body: fd,
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || "Approve failed");
    closePaymentRequestApproveModal();
    window.UI?.toast?.("Payment registered and receipt attached to the trip.", "ok");
    fetchPaymentRequests();
    // Pages like /accountant listen for this event to refresh their
    // table without polling.
    window.dispatchEvent(new CustomEvent("payment-request:resolved", { detail: { id: approveCurrentRequest?.id, action: "approved" } }));
  } catch (err) {
    status.textContent = err.message || "Approve failed";
    status.style.color = "#c44747";
  }
}

async function submitPaymentApproveNoDoc() {
  if (!approveCurrentRequest) return;
  const ok = window.UI?.confirm
    ? await window.UI.confirm("Register this payment without a receipt? You can attach the document later from the Accountant page.", { dangerous: false, confirmLabel: "Register without document" })
    : window.confirm("Register this payment without a receipt?");
  if (!ok) return;
  const modal = document.getElementById("payment-approve-modal");
  const status = modal?.querySelector("[data-approve-status]");
  const noteInput = modal?.querySelector("#payment-approve-note");
  if (status) { status.style.color = ""; status.textContent = "Registering payment…"; }
  try {
    const r = await fetch(`/api/payment-requests/${encodeURIComponent(approveCurrentRequest.id)}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        skipDocument: true,
        paidAmount: approveCurrentRequest.paidAmount || 0,
        paidDate: approveCurrentRequest.paidDate || "",
        bankAccountId: approveCurrentRequest.bankAccountId || "",
        note: noteInput?.value || "",
      }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || "Could not register");
    closePaymentRequestApproveModal();
    window.UI?.toast?.("Payment registered. Receipt can be uploaded later.", "ok");
    fetchPaymentRequests();
    window.dispatchEvent(new CustomEvent("payment-request:resolved", { detail: { id: approveCurrentRequest?.id, action: "approved" } }));
  } catch (err) {
    if (status) { status.textContent = err.message || "Could not register"; status.style.color = "#c44747"; }
  }
}

async function submitPaymentReject() {
  if (!approveCurrentRequest) return;
  const reason = window.UI?.prompt
    ? await window.UI.prompt("Reason for rejection (optional)?", { confirmLabel: "Reject", placeholder: "Optional" })
    : window.prompt("Reason for rejection (optional)?", "");
  if (reason === null || reason === undefined) return;
  try {
    const r = await fetch(`/api/payment-requests/${encodeURIComponent(approveCurrentRequest.id)}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || "Reject failed");
    closePaymentRequestApproveModal();
    window.UI?.toast?.("Payment request rejected.", "ok");
    fetchPaymentRequests();
    window.dispatchEvent(new CustomEvent("payment-request:resolved", { detail: { id: approveCurrentRequest?.id, action: "rejected" } }));
  } catch (err) {
    window.UI?.alert ? window.UI.alert(err.message || "Reject failed") : alert(err.message || "Reject failed");
  }
}

async function fetchPaymentRequests() {
  // Skip the request when neither the desktop nor the mobile ₮ button
  // is visible.
  const desktopVisible = paymentIconNode && !paymentIconNode.hasAttribute("hidden");
  const mobileBtn = mobileBar?.querySelector('[data-action="toggle-payment-requests-mobile"]');
  const mobileVisible = mobileBtn && !mobileBtn.hasAttribute("hidden");
  if (!desktopVisible && !mobileVisible) return;
  try {
    const ws = readWorkspace();
    const wsQs = ws ? `&workspace=${encodeURIComponent(ws)}` : "";
    // Two parallel fetches: pending visible to everyone, plus the
    // current user's own resolved (approved + rejected) requests, so
    // managers see in ₮ that their requests went through (or got
    // bounced back).
    const [pendingRes, mineRes] = await Promise.all([
      fetch(`/api/payment-requests?status=pending${wsQs}`),
      fetch(`/api/payment-requests?mine=1${wsQs}`),
    ]);
    const pending = pendingRes.ok ? ((await pendingRes.json()).entries || []) : [];
    const mine = mineRes.ok ? ((await mineRes.json()).entries || []) : [];
    // Merge — pending first, then the user's own resolved requests
    // (most recent first, capped at 10) so the popover doesn't grow
    // unbounded.
    const seen = new Set(pending.map((r) => r.id));
    const resolved = mine
      .filter((r) => !seen.has(r.id) && (r.status || "").toLowerCase() !== "pending")
      .sort((a, b) => String(b.approvedAt || b.rejectedAt || "").localeCompare(String(a.approvedAt || a.rejectedAt || "")))
      .slice(0, 10);
    paymentRequestsCache = pending.concat(resolved);
    // Badge count reflects pending + the user's *unread* resolved.
    // For now we just show pending count to avoid stale-counter
    // surprises; resolved entries still appear in the popover.
    updatePaymentRequestCount(pending.length);
    renderPaymentRequestList();
  } catch {}
}

function startPaymentRequestPolling() {
  if (paymentRequestsPollTimer) clearInterval(paymentRequestsPollTimer);
  fetchPaymentRequests();
  paymentRequestsPollTimer = setInterval(fetchPaymentRequests, 60000);
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
  const display = String(n || 0);
  if (reminderCountNode) {
    reminderCountNode.textContent = display;
    if (n > 0) reminderCountNode.removeAttribute("hidden");
    else reminderCountNode.setAttribute("hidden", "");
  }
  const mobileCount = mobileBar?.querySelector("[data-reminder-count-mobile]");
  if (mobileCount) {
    mobileCount.textContent = display;
    if (n > 0) mobileCount.removeAttribute("hidden");
    else mobileCount.setAttribute("hidden", "");
  }
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
  if (kind && kind.startsWith("invoice")) return tripId ? `/trip-detail?tripId=${encodeURIComponent(tripId)}` : "/invoices";
  if (kind === "trip.updated" && (meta.id || tripId)) return `/trip-detail?tripId=${encodeURIComponent(meta.id || tripId)}`;
  if (kind === "group.updated" && meta.id && (meta.tripId || tripId)) return `/group?groupId=${encodeURIComponent(meta.id)}&tripId=${encodeURIComponent(meta.tripId || tripId)}`;
  if (kind === "camp_reservation.updated" && tripId) return `/trip-detail?tripId=${encodeURIComponent(tripId)}`;
  if (kind && kind.startsWith("task")) return "/todo";
  // Note created / reply / mention — open the trip the note is attached to.
  if (kind === "note.created" || kind === "note.reply" || kind === "note.mention") {
    if (meta.groupId && tripId) return `/group?groupId=${encodeURIComponent(meta.groupId)}&tripId=${encodeURIComponent(tripId)}`;
    if (tripId) return `/trip-detail?tripId=${encodeURIComponent(tripId)}`;
    return "/notes";
  }
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
  const display = String(unread || 0);
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
    <button type="button" class="workspace-bell workspace-bell-mobile workspace-reminder-icon" data-action="toggle-reminders-mobile" aria-label="Reminders &amp; mentions">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="13" r="8"></circle>
        <path d="M12 9v4l2.5 2.5"></path>
        <path d="M5 4l3.5-2"></path>
        <path d="M19 4l-3.5-2"></path>
      </svg>
      <span class="workspace-bell-count" data-reminder-count-mobile hidden>0</span>
    </button>
    <button type="button" class="workspace-bell workspace-bell-mobile" data-action="toggle-notifications-mobile" aria-label="Notifications">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M6 8a6 6 0 1 1 12 0c0 5.5 2 7 2 7H4s2-1.5 2-7Z"></path>
        <path d="M10 19a2 2 0 0 0 4 0"></path>
      </svg>
      <span class="workspace-bell-count" data-notif-count-mobile hidden>0</span>
    </button>
    <button type="button" class="workspace-bell workspace-bell-mobile workspace-payment-icon" data-action="toggle-payment-requests-mobile" aria-label="Payment requests" hidden>
      <span class="workspace-bell-tugrik" aria-hidden="true">₮</span>
      <span class="workspace-bell-count" data-payment-request-count-mobile hidden>0</span>
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
  bar.querySelector('[data-action="toggle-reminders-mobile"]').addEventListener("click", (event) => {
    event.stopPropagation();
    toggleReminderPopover();
  });
  bar.querySelector('[data-action="toggle-payment-requests-mobile"]')?.addEventListener("click", (event) => {
    event.stopPropagation();
    togglePaymentRequestPopover();
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
    // Expose for pages that need to check role (e.g. invoice edit-paid
    // permissions). Read-only — page code must not mutate.
    window.currentUser = data.user;
    renderProfile(data.user);
    renderSidebar(data.user);
    fetchNotifications();
    startNotificationPolling();
    startMailUnreadPolling();
    startReminderPolling();
    applyPaymentIconVisibility(data.user);
    startPaymentRequestPolling();
    showActiveAnnouncements();
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

// ── Admin broadcast announcements ─────────────────────────────────
// On every page load, fetch the announcements the current user hasn't
// dismissed yet and show them as a centred modal one at a time. The
// "Got it" button posts to /dismiss so the message stops appearing
// for that user.
async function showActiveAnnouncements() {
  let entries = [];
  try {
    const res = await fetch("/api/announcements/active", { credentials: "same-origin" });
    if (!res.ok) return;
    const data = await res.json();
    entries = (data.entries || []).slice();
  } catch {
    return;
  }
  if (!entries.length) return;

  function nextOne() {
    const ann = entries.shift();
    if (!ann) return;
    showOneAnnouncement(ann, () => nextOne());
  }
  nextOne();
}

function showOneAnnouncement(ann, onClose) {
  const overlay = document.createElement("div");
  overlay.className = "announcement-modal-overlay";
  const created = ann.createdAt ? new Date(ann.createdAt).toLocaleString() : "";
  const author = ann.createdBy && ann.createdBy.name ? ann.createdBy.name : "";
  const bodyHtml = String(ann.body || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
  const titleSafe = String(ann.title || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const metaSafe = `${created}${author ? " · " + author.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") : ""}`;
  const escAttr = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const att = ann.attachment || null;
  let attachmentHtml = "";
  if (att) {
    const isImage = /^image\//.test(att.mimeType || "") || /\.(png|jpe?g|gif)$/i.test(att.originalName || "");
    const previewHtml = isImage
      ? `<img src="${escAttr(att.downloadUrl)}" alt="${escAttr(att.originalName)}" class="announcement-modal-image" />`
      : "";
    attachmentHtml = `
      <div class="announcement-modal-attachment">
        ${previewHtml}
        <a href="${escAttr(att.downloadUrl)}" target="_blank" rel="noopener" download>
          📎 ${escAttr(att.originalName)}
        </a>
      </div>
    `;
  }
  overlay.innerHTML = `
    <div class="announcement-modal-dialog" role="dialog" aria-modal="true">
      <div class="announcement-modal-kicker">Message from admin</div>
      <h2 class="announcement-modal-title">${titleSafe}</h2>
      <p class="announcement-modal-meta">${metaSafe}</p>
      <div class="announcement-modal-body">${bodyHtml}</div>
      ${attachmentHtml}
      <div class="announcement-modal-actions">
        <button type="button" class="primary-pill" data-action="ack">Got it</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  document.body.classList.add("announcement-modal-open");

  const close = async () => {
    overlay.remove();
    if (!document.querySelector(".announcement-modal-overlay")) {
      document.body.classList.remove("announcement-modal-open");
    }
    try {
      await fetch(`/api/announcements/${encodeURIComponent(ann.id)}/dismiss`, {
        method: "POST",
        credentials: "same-origin",
      });
    } catch {}
    if (onClose) onClose();
  };
  overlay.querySelector('[data-action="ack"]').addEventListener("click", close);
}
