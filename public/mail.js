// Mail page: list + viewer for connected mailboxes.
(function () {
  const notConfiguredNode = document.getElementById("mail-not-configured");
  const shellNode = document.getElementById("mail-shell");
  const listNode = document.getElementById("mail-list");
  const viewerNode = document.getElementById("mail-viewer");
  const accountFilter = document.getElementById("mail-account-filter");
  const searchInput = document.getElementById("mail-search");
  const refreshBtn = document.getElementById("mail-refresh");
  const countNode = document.getElementById("mail-count");

  let accounts = [];
  let messages = [];
  let selectedKey = "";
  let currentFolder = "inbox"; // "inbox" or "sent"
  let unreadOnly = false;
  const checkedKeys = new Set();

  // Read the current workspace (DTX/USM). App-shell stores it in localStorage
  // AND a cookie — Safari sometimes clears localStorage between visits while
  // keeping the cookie, so we have to read both like app-shell.js does.
  function readCookie(name) {
    const m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
    return m ? decodeURIComponent(m[1]) : "";
  }
  function currentWorkspace() {
    let v = "";
    try { v = localStorage.getItem("travelx_workspace") || ""; } catch {}
    if (!v) v = readCookie("travelx_workspace");
    v = (v || "").toUpperCase();
    return v === "DTX" || v === "USM" ? v : "";
  }
  function workspaceMatches(account) {
    const ws = currentWorkspace();
    if (!ws) return true; // fall through if no workspace set
    return (account.workspace || "DTX").toUpperCase() === ws;
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  }

  function initials(name, email) {
    const src = (name || email || "?").trim();
    if (!src) return "?";
    const parts = src.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return src.slice(0, 2).toUpperCase();
  }

  function colorFor(s) {
    let h = 0;
    for (let i = 0; i < (s || "").length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
    return `hsl(${h}, 60%, 55%)`;
  }

  function timeFmt(iso) {
    if (!iso) return "";
    try {
      const d = new Date(iso);
      const now = new Date();
      const same = d.toDateString() === now.toDateString();
      if (same) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const yr = now.getFullYear() === d.getFullYear() ? "" : ` ${d.getFullYear()}`;
      return d.toLocaleDateString([], { month: "short", day: "numeric" }) + yr;
    } catch { return ""; }
  }

  function fullTimeFmt(iso) {
    if (!iso) return "";
    try {
      const d = new Date(iso);
      return d.toLocaleString([], { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch { return iso; }
  }

  function getKey(m) { return `${m.accountId}:${m.uid}`; }

  // ── Follow-up state ─────────────────────────────────────────────────
  const SUBJECT_PREFIX_RE = /^\s*(re|fw|fwd|sv|aw|tr|ynt|rv|вн|нэ|fyi)\s*[:\-]\s*/i;
  function normalizeSubject(s) {
    let t = (s || "").trim().toLowerCase();
    while (true) {
      const next = t.replace(SUBJECT_PREFIX_RE, "").trim();
      if (next === t) break;
      t = next;
    }
    return t.replace(/\s+/g, " ");
  }
  function threadKey(accountId, subject) { return `${accountId}::${normalizeSubject(subject)}`; }

  let followups = {}; // threadKey → record (active only: waiting | urgent)
  async function loadFollowups() {
    try {
      const r = await fetch("/api/mail/followups");
      if (!r.ok) return;
      const data = await r.json();
      followups = {};
      for (const e of data.entries || []) {
        if (e.status === "waiting" || e.status === "urgent") {
          followups[e.threadKey] = e;
        }
      }
    } catch {}
  }
  function followupFor(m) {
    return followups[threadKey(m.accountId, m.subject)] || null;
  }
  function fmtDaysLeft(dueIso) {
    if (!dueIso) return "";
    const due = new Date(dueIso);
    if (Number.isNaN(due.getTime())) return "";
    const ms = due.getTime() - Date.now();
    if (ms <= 0) return "overdue";
    const days = Math.ceil(ms / (24 * 60 * 60 * 1000));
    return `${days}d`;
  }
  function bellSvg() {
    return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 1 1 12 0c0 5.5 2 7 2 7H4s2-1.5 2-7Z"/><path d="M10 19a2 2 0 0 0 4 0"/></svg>';
  }
  function renderFollowupBadge(m) {
    const f = followupFor(m);
    const tk = threadKey(m.accountId, m.subject);
    if (!f) {
      return `<button type="button" class="mail-followup-btn mail-followup-btn--off" data-followup-key="${escapeHtml(tk)}" data-followup-account="${escapeHtml(m.accountId)}" data-followup-subject="${escapeHtml(m.subject || "")}" title="Set follow-up">${bellSvg()}</button>`;
    }
    const cls = f.status === "urgent" ? "mail-followup-btn--urgent" : "mail-followup-btn--on";
    const label = f.status === "urgent" ? "overdue" : fmtDaysLeft(f.dueAt);
    return `<button type="button" class="mail-followup-btn ${cls}" data-followup-key="${escapeHtml(tk)}" data-followup-id="${escapeHtml(f.id)}" data-followup-account="${escapeHtml(m.accountId)}" data-followup-subject="${escapeHtml(m.subject || "")}" title="Follow-up: ${escapeHtml(label)}">${bellSvg()}<span>${escapeHtml(label)}</span></button>`;
  }

  // Picker popover wired below; this opens it for the clicked row.
  let activePickerHost = null;
  function closeFollowupPicker() {
    if (activePickerHost) {
      activePickerHost.remove();
      activePickerHost = null;
    }
  }
  function openFollowupPicker(triggerEl) {
    closeFollowupPicker();
    const accountId = triggerEl.dataset.followupAccount;
    const subject = triggerEl.dataset.followupSubject;
    const existingId = triggerEl.dataset.followupId || "";
    const host = document.createElement("div");
    host.className = "mail-followup-picker";
    host.innerHTML = `
      <p class="mail-followup-picker-label">Follow up in…</p>
      ${[1, 3, 5, 7].map((d) => `<button type="button" data-days="${d}">${d} day${d === 1 ? "" : "s"}</button>`).join("")}
      <button type="button" data-action="custom">Custom…</button>
      ${existingId ? `<button type="button" class="is-danger" data-action="clear" data-id="${escapeHtml(existingId)}">Clear follow-up</button>` : ""}
    `;
    document.body.appendChild(host);
    activePickerHost = host;
    const r = triggerEl.getBoundingClientRect();
    host.style.position = "fixed";
    host.style.top = `${r.bottom + 6}px`;
    host.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - 220))}px`;
    host.addEventListener("click", async (event) => {
      const btn = event.target.closest("button");
      if (!btn) return;
      if (btn.dataset.action === "clear") {
        await fetch(`/api/mail/followups/${encodeURIComponent(btn.dataset.id)}`, { method: "DELETE" });
        await refreshFollowups();
        closeFollowupPicker();
        return;
      }
      if (btn.dataset.action === "custom") {
        const v = window.prompt("Days (1–60):", "5");
        const days = parseInt(v, 10);
        if (!days || days < 1 || days > 60) { closeFollowupPicker(); return; }
        await postFollowup(accountId, subject, days);
        closeFollowupPicker();
        return;
      }
      const days = parseInt(btn.dataset.days, 10);
      if (!days) return;
      await postFollowup(accountId, subject, days);
      closeFollowupPicker();
    });
  }
  document.addEventListener("click", (event) => {
    if (activePickerHost && !activePickerHost.contains(event.target) && !event.target.closest(".mail-followup-btn")) {
      closeFollowupPicker();
    }
  });
  async function postFollowup(accountId, subject, days) {
    try {
      const r = await fetch("/api/mail/followups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, subject, days }),
      });
      if (!r.ok) {
        UI?.toast?.("Could not set follow-up.", "error");
        return;
      }
      await refreshFollowups();
    } catch {
      UI?.toast?.("Could not set follow-up.", "error");
    }
  }
  async function refreshFollowups() {
    await loadFollowups();
    renderList();
    if (currentMessage) {
      const host = document.querySelector("[data-followup-host]");
      if (host) host.innerHTML = renderFollowupBadge(currentMessage);
    }
  }

  function getFiltered() {
    const q = (searchInput.value || "").trim().toLowerCase();
    const acc = accountFilter.value || "";
    return messages.filter((m) => {
      if (acc && m.accountId !== acc) return false;
      // The unread toggle only applies to inbox; sent has no read/unread.
      if (unreadOnly && currentFolder === "inbox" && m.isRead) return false;
      if (q) {
        const hay = (m.fromName + " " + m.fromEmail + " " + m.subject + " " + m.snippet).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  function shortAddr(s) {
    // For the Sent view, "to" header may have multiple recipients; show
    // the first one + "+N more" hint.
    if (!s) return "";
    const list = String(s).split(/[,;]/).map((x) => x.trim()).filter(Boolean);
    if (!list.length) return "";
    const first = list[0].replace(/^"?([^"<]+?)"?\s*<.*>$/, "$1").trim() || list[0];
    return list.length > 1 ? `${first} +${list.length - 1}` : first;
  }

  function renderList() {
    const rows = getFiltered();
    countNode.textContent = `${rows.length} message${rows.length === 1 ? "" : "s"}`;
    updateBulkBar();
    if (!rows.length) {
      const emptyMsg = currentFolder === "sent"
        ? "No sent messages match."
        : "No messages match.";
      listNode.innerHTML = `<p class="empty">${emptyMsg}</p>`;
      return;
    }
    const isSent = currentFolder === "sent";
    listNode.innerHTML = rows.map((m) => {
      const key = getKey(m);
      const isActive = key === selectedKey;
      const isUnread = !m.isRead && !isSent; // sent items are always "read" visually
      const isChecked = checkedKeys.has(key);
      // For Sent: show recipients on the prominent line (prefixed "To:")
      const headlineRaw = isSent
        ? (shortAddr(m.to) || "(no recipient)")
        : (m.fromName || m.fromEmail || "(no sender)");
      const headline = isSent ? `To: ${headlineRaw}` : headlineRaw;
      const avatarSeed = isSent ? (m.to || "") : (m.fromEmail || m.from || "");
      const ini = isSent
        ? (initials("", (m.to || "").split(/[,;]/)[0]?.trim().replace(/^"?([^"<]+?)"?\s*<.*>$/, "$1")) || "→")
        : initials(m.fromName, m.fromEmail);
      const color = colorFor(avatarSeed);
      const workspace = (m.workspace || "DTX").toUpperCase();
      const accountFull = m.accountAddress || "";
      const dateStr = timeFmt(m.date);
      // Date stays alone in the top-right; the full account address rides
      // as a colored chip in the bottom-right next to the snippet, with
      // room to show the full email and workspace-tinted background.
      const accountChip = accountFull
        ? `<span class="mail-list-chip mail-list-chip--${workspace.toLowerCase()}" title="${escapeHtml(accountFull)}">${escapeHtml(accountFull)}</span>`
        : "";
      return `
        <div class="mail-list-row-wrap${isActive ? " is-active" : ""}${isUnread ? " is-unread" : " is-read"}${isChecked ? " is-checked" : ""}" data-key="${escapeHtml(key)}" data-workspace="${escapeHtml(workspace)}">
          <label class="mail-list-check">
            <input type="checkbox" data-bulk-key="${escapeHtml(key)}" ${isChecked ? "checked" : ""}>
          </label>
          <button type="button" class="mail-list-row" data-key="${escapeHtml(key)}">
            <span class="mail-list-avatar" style="background:${color}">${escapeHtml(ini)}</span>
            <div class="mail-list-body">
              <div class="mail-list-row-top">
                <strong>${escapeHtml(headline)}</strong>
                <time>${escapeHtml(dateStr)}</time>
              </div>
              <div class="mail-list-row-mid">
                <span class="mail-list-subject">${escapeHtml(m.subject || "(no subject)")}</span>
                ${m.hasAttachment ? '<span class="mail-list-attach" title="Has attachment">📎</span>' : ""}
              </div>
              <div class="mail-list-row-bottom">
                <span class="mail-list-snippet">${escapeHtml((m.snippet || "").slice(0, 140))}</span>
                ${accountChip}
              </div>
            </div>
          </button>
          <span class="mail-list-followup">${renderFollowupBadge(m)}</span>
        </div>
      `;
    }).join("");
  }

  function updateBulkBar() {
    const bar = document.getElementById("mail-bulk-bar");
    if (!bar) return;
    if (checkedKeys.size === 0) {
      bar.setAttribute("hidden", "");
    } else {
      bar.removeAttribute("hidden");
      const lbl = bar.querySelector("[data-bulk-count]");
      if (lbl) lbl.textContent = `${checkedKeys.size} selected`;
    }
  }

  async function markUnread(key) {
    const [accountId, uid] = key.split(":");
    const m = messages.find((x) => x.accountId === accountId && String(x.uid) === uid);
    if (m) m.isRead = false;
    renderList();
    try {
      const r = await fetch(`/api/mail/messages/${encodeURIComponent(accountId)}/${encodeURIComponent(uid)}/unread?folder=${encodeURIComponent(currentFolder)}`, { method: "POST" });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.error || "Mark unread failed");
      }
      return true;
    } catch (err) {
      UI?.toast?.(err.message || "Mark unread failed", "error");
      return false;
    }
  }

  async function bulkMarkUnread() {
    if (checkedKeys.size === 0) return;
    const keys = Array.from(checkedKeys);
    let okCount = 0, failCount = 0;
    for (const key of keys) {
      const ok = await markUnread(key);
      if (ok) okCount++; else failCount++;
    }
    checkedKeys.clear();
    renderList();
    if (failCount) UI?.toast?.(`${okCount} marked unread, ${failCount} failed.`, "warning");
    else UI?.toast?.(`${okCount} marked unread.`, "success");
  }

  async function bulkDelete() {
    if (checkedKeys.size === 0) return;
    const ok = await UI.confirm(`Move ${checkedKeys.size} message${checkedKeys.size === 1 ? "" : "s"} to Trash?`, { dangerous: true });
    if (!ok) return;
    const keys = Array.from(checkedKeys);
    let okCount = 0, failCount = 0;
    for (const key of keys) {
      const [accountId, uid] = key.split(":");
      try {
        const r = await fetch(`/api/mail/messages/${encodeURIComponent(accountId)}/${encodeURIComponent(uid)}?folder=${encodeURIComponent(currentFolder)}`, { method: "DELETE" });
        if (r.ok) okCount++;
        else failCount++;
      } catch {
        failCount++;
      }
    }
    messages = messages.filter((m) => !checkedKeys.has(getKey(m)));
    checkedKeys.clear();
    if (selectedKey && !messages.find((m) => getKey(m) === selectedKey)) {
      selectedKey = "";
      currentMessage = null;
      viewerNode.innerHTML = '<div class="mail-viewer-empty"><div class="mail-empty-illustration mail-empty-illustration--small">✉</div><p>Select a message to read it.</p></div>';
    }
    renderList();
    if (failCount) UI?.toast?.(`${okCount} moved, ${failCount} failed.`, "warning");
    else UI?.toast?.(`${okCount} moved to Trash.`, "success");
  }

  async function loadMessage(key) {
    const [accountId, uid] = key.split(":");
    viewerNode.innerHTML = '<div class="mail-viewer-empty"><p>Loading...</p></div>';
    try {
      const r = await fetch(`/api/mail/messages/${encodeURIComponent(accountId)}/${encodeURIComponent(uid)}?folder=${encodeURIComponent(currentFolder)}`);
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Could not load");
      await renderViewer(data.entry);
    } catch (err) {
      viewerNode.innerHTML = `<div class="mail-viewer-empty"><p>Error: ${escapeHtml(err.message)}</p></div>`;
    }
  }

  function fmtSize(bytes) {
    if (!bytes && bytes !== 0) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function attachmentIcon(ctype) {
    const t = (ctype || "").toLowerCase();
    if (t.startsWith("image/")) return "🖼";
    if (t === "application/pdf") return "📄";
    if (t.includes("zip") || t.includes("compressed")) return "🗜";
    if (t.includes("word") || t.includes("officedocument")) return "📝";
    if (t.includes("sheet") || t.includes("excel") || t.includes("csv")) return "📊";
    if (t.startsWith("audio/")) return "🎵";
    if (t.startsWith("video/")) return "🎬";
    return "📎";
  }

  function attachmentUrl(m, idx, inline) {
    const base = `/api/mail/messages/${encodeURIComponent(m.accountId)}/${encodeURIComponent(m.uid)}/attachments/${encodeURIComponent(idx)}`;
    const qs = `folder=${encodeURIComponent(currentFolder)}${inline ? "&inline=1" : ""}`;
    return `${base}?${qs}`;
  }

  function isPreviewable(ctype) {
    const t = (ctype || "").toLowerCase();
    return t.startsWith("image/") || t === "application/pdf" || t.startsWith("text/") || t === "application/json";
  }

  function renderAttachments(m) {
    const list = m.attachments || [];
    if (!list.length) return "";
    const items = list.map((a) => {
      const previewable = isPreviewable(a.contentType);
      const downloadUrl = attachmentUrl(m, a.idx, false);
      const previewUrl = attachmentUrl(m, a.idx, true);
      return `<div class="mail-attachment" data-idx="${escapeHtml(String(a.idx))}">
        <button type="button" class="mail-attachment-main"
                data-action="${previewable ? 'preview-attachment' : 'download-attachment'}"
                data-preview-url="${escapeHtml(previewUrl)}"
                data-download-url="${escapeHtml(downloadUrl)}"
                data-filename="${escapeHtml(a.filename || 'attachment')}"
                data-ctype="${escapeHtml(a.contentType || '')}"
                title="${previewable ? 'Click to preview' : 'Click to download'}">
          <span class="mail-attachment-icon">${attachmentIcon(a.contentType)}</span>
          <span class="mail-attachment-name">${escapeHtml(a.filename || 'attachment')}</span>
          <span class="mail-attachment-size">${escapeHtml(fmtSize(a.size))}</span>
        </button>
        <a class="mail-attachment-dl" href="${downloadUrl}" download="${escapeHtml(a.filename || '')}" title="Download">⬇</a>
      </div>`;
    }).join("");
    return `<div class="mail-attachments">${items}</div>`;
  }

  // ── Attachment preview modal ───────────────────────────────────
  function openAttachmentPreview({ previewUrl, downloadUrl, filename, ctype }) {
    let modal = document.getElementById("mail-attachment-preview");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "mail-attachment-preview";
      modal.className = "mail-preview-modal";
      modal.innerHTML = `
        <div class="mail-preview-backdrop" data-action="close-preview"></div>
        <div class="mail-preview-card">
          <header>
            <strong class="mail-preview-name"></strong>
            <span class="mail-preview-actions">
              <a class="primary-pill mail-preview-download" download>⬇ Download</a>
              <button type="button" class="mail-preview-close" data-action="close-preview" aria-label="Close">×</button>
            </span>
          </header>
          <div class="mail-preview-body"></div>
        </div>
      `;
      document.body.appendChild(modal);
      modal.addEventListener("click", (e) => {
        if (e.target.dataset.action === "close-preview") closeAttachmentPreview();
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && !modal.hasAttribute("hidden")) closeAttachmentPreview();
      });
    }
    modal.querySelector(".mail-preview-name").textContent = filename || "Attachment";
    const dl = modal.querySelector(".mail-preview-download");
    dl.href = downloadUrl;
    dl.setAttribute("download", filename || "attachment");
    const body = modal.querySelector(".mail-preview-body");
    const t = (ctype || "").toLowerCase();
    if (t.startsWith("image/")) {
      body.innerHTML = `<img class="mail-preview-img" src="${previewUrl}" alt="${escapeHtml(filename || '')}"/>`;
    } else if (t === "application/pdf") {
      body.innerHTML = `<iframe class="mail-preview-iframe" src="${previewUrl}"></iframe>`;
    } else if (t === "text/html") {
      // Sandbox HTML attachments so they can't run scripts or break out
      body.innerHTML = `<iframe class="mail-preview-iframe" sandbox="" src="${previewUrl}"></iframe>`;
    } else if (t.startsWith("text/") || t === "application/json") {
      body.innerHTML = `<iframe class="mail-preview-iframe" src="${previewUrl}"></iframe>`;
    } else {
      body.innerHTML = `<p class="mail-preview-empty">No preview available for this file type. <a href="${downloadUrl}" download="${escapeHtml(filename || '')}">Download</a> to view it.</p>`;
    }
    modal.removeAttribute("hidden");
  }

  function closeAttachmentPreview() {
    const modal = document.getElementById("mail-attachment-preview");
    if (modal) modal.setAttribute("hidden", "");
  }

  let currentMessage = null;

  // Strip "Re:" / "Fwd:" / "Fw:" prefixes (one or more) plus locale variants
  // so we can group a thread by its base subject.
  function normalizeSubject(s) {
    let t = (s || "").trim().toLowerCase();
    let prev = "";
    while (t !== prev) {
      prev = t;
      t = t.replace(/^(re|fw|fwd|sv|aw|tr|ynt|rv|вн|нэ|fyi)\s*[:\-]\s*/i, "").trim();
    }
    return t.replace(/\s+/g, " ");
  }

  // Fetch the full thread for a message (inbox + sent merged, oldest-first).
  // Returns Promise<entry[]>. Falls back to [m] if request fails.
  async function fetchThread(m) {
    if (!m) return [];
    try {
      const r = await fetch(`/api/mail/messages/${encodeURIComponent(m.accountId)}/${encodeURIComponent(m.uid)}/thread`);
      if (!r.ok) return [m];
      const data = await r.json();
      const entries = Array.isArray(data.entries) ? data.entries : [];
      return entries.length ? entries : [m];
    } catch {
      return [m];
    }
  }

  function isFromMe(entry) {
    if (!entry) return false;
    const acc = accounts.find((a) => a.id === entry.accountId);
    if (!acc) return false;
    const me = (acc.address || "").toLowerCase();
    const from = (entry.fromEmail || "").toLowerCase();
    return !!me && me === from;
  }

  // Cut the quoted reply chain ("On X wrote:" / <blockquote> / Outlook
  // headers) out of an email body and stash it behind a "Show quoted
  // history" toggle. Each bubble already shows the previous message, so
  // re-rendering the quoted copy underneath doubles up and confuses
  // Bataa. Pure HTML transform — no DOM, no parser dependency.
  function splitQuotedHtml(html) {
    if (!html || typeof html !== "string") return { visible: html || "", quoted: "" };
    const candidates = [
      /<blockquote\b/i,
      /<div[^>]*class=["'][^"']*\b(gmail_quote|gmail_attr|OutlookMessageHeader|moz-cite-prefix)\b/i,
      // "On Mon, Apr 9, 2026 at 6:41 PM ... wrote:" — many languages.
      /(<[^>]+>\s*)?\bOn\s+[A-Z][a-z]+,?\s+\d{1,2}\s+[A-Z][a-z]+,?\s+\d{4}[\s\S]{0,200}?\bwrote:/i,
      /(<[^>]+>\s*)?\bOn\s+\w+\s*\d{1,2}[,]?\s+\d{4}[\s\S]{0,200}?\bwrote:/i,
      // Outlook reply header.
      /(<[^>]+>\s*)?(From|От|Жонагч):\s*[\s\S]{0,400}?(Sent|Отправлено|Илгээсэн):/i,
      // Mongolian + generic "Re:" preamble lines from forwarded mail.
      /-{2,}\s*Original Message\s*-{2,}/i,
      /-{2,}\s*Forwarded message\s*-{2,}/i,
    ];
    let cut = -1;
    for (const re of candidates) {
      const m = html.match(re);
      if (m && m.index >= 0) {
        if (cut === -1 || m.index < cut) cut = m.index;
      }
    }
    if (cut === -1 || cut < 30) return { visible: html, quoted: "" };
    return { visible: html.slice(0, cut), quoted: html.slice(cut) };
  }

  // Build the iframe srcdoc with the visible part on top and the quoted
  // history wrapped in a <details> toggle. CSS is inlined so the iframe
  // matches the bubble background.
  function bubbleSrcdoc(bodyHtml) {
    const { visible, quoted } = splitQuotedHtml(bodyHtml);
    const css = `
      <style>
        body { font: 14px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; margin: 0; padding: 4px 0; word-wrap: break-word; overflow-wrap: anywhere; }
        img { max-width: 100%; height: auto; }
        pre, code { white-space: pre-wrap; word-wrap: break-word; }
        details.mail-quoted-block { margin-top: 14px; border-top: 1px dashed #cbd5e1; padding-top: 10px; }
        details.mail-quoted-block summary { cursor: pointer; color: #475569; font-size: 12px; font-style: italic; list-style: none; padding: 4px 0; }
        details.mail-quoted-block summary::-webkit-details-marker { display: none; }
        details.mail-quoted-block summary::before { content: "▸ "; }
        details.mail-quoted-block[open] summary::before { content: "▾ "; }
        details.mail-quoted-block .mail-quoted-body { color: #64748b; opacity: 0.85; }
      </style>
    `;
    const quotedBlock = quoted
      ? `<details class="mail-quoted-block"><summary>Show earlier messages</summary><div class="mail-quoted-body">${quoted}</div></details>`
      : "";
    return `<!doctype html><html><head><meta charset="utf-8">${css}</head><body>${visible}${quotedBlock}</body></html>`;
  }

  function renderConversationBubbles(entries, current) {
    const currentKey = `${current.accountId}:${current.uid}`;
    return entries.map((e) => {
      const mine = isFromMe(e);
      const sender = e.fromName || e.fromEmail || "(unknown)";
      const ini = initials(e.fromName, e.fromEmail);
      const color = colorFor(e.fromEmail || e.from);
      const body = e.bodyHtml
        ? `<iframe class="mail-bubble-iframe" sandbox="allow-same-origin" srcdoc="${escapeHtml(bubbleSrcdoc(e.bodyHtml))}"></iframe>`
        : `<pre class="mail-bubble-text">${escapeHtml(e.bodyText || "(empty message)")}</pre>`;
      const atts = renderAttachments(e);
      const key = `${e.accountId}:${e.uid}`;
      const isCurrent = key === currentKey;
      return `
        <div class="mail-bubble ${mine ? "mail-bubble--mine" : "mail-bubble--theirs"} ${isCurrent ? "is-current" : ""}">
          <div class="mail-bubble-meta">
            ${mine ? "" : `<span class="mail-bubble-avatar" style="background:${color}">${escapeHtml(ini)}</span>`}
            <div>
              <p><strong>${escapeHtml(sender)}</strong> ${mine ? `<span class="mail-bubble-tag">me</span>` : ""}</p>
              <small>${escapeHtml(fullTimeFmt(e.date))}</small>
            </div>
          </div>
          <div class="mail-bubble-body">${body}</div>
          ${atts}
        </div>
      `;
    }).join("");
  }

  async function renderViewer(m) {
    currentMessage = m;
    const isSent = (m.folder || currentFolder) === "sent";
    const actionsHtml = isSent
      ? `<button type="button" class="secondary-button" data-action="forward">→ Forward</button>
         <button type="button" class="secondary-button danger-button" data-action="delete-msg">Delete</button>`
      : `<button type="button" class="secondary-button" data-action="reply">↩ Reply</button>
         <button type="button" class="secondary-button" data-action="reply-all">↩↩ Reply all</button>
         <button type="button" class="secondary-button" data-action="forward">→ Forward</button>
         <button type="button" class="secondary-button" data-action="mark-unread">◉ Mark unread</button>
         <button type="button" class="secondary-button danger-button" data-action="delete-msg">Delete</button>`;

    // Ask the server for the merged inbox+sent thread for this message.
    // The endpoint also syncs the Sent folder first so our outbound replies
    // appear inline next to the inbound side, WhatsApp-style.
    const entries = await fetchThread(m);
    if (entries.length <= 1) {
      // Single-message render — same layout as before.
      const ini = initials(m.fromName, m.fromEmail);
      const color = colorFor(m.fromEmail || m.from);
      const bodyHtml = m.bodyHtml
        ? `<iframe class="mail-body-iframe" sandbox="allow-same-origin" srcdoc="${escapeHtml(bubbleSrcdoc(m.bodyHtml))}"></iframe>`
        : `<pre class="mail-body-text">${escapeHtml(m.bodyText || "(empty message)")}</pre>`;
      const attachmentsHtml = renderAttachments(m);
      viewerNode.innerHTML = `
        <div class="mail-viewer-head">
          <h2>${escapeHtml(m.subject || "(no subject)")}</h2>
          <p class="mail-viewer-meta">
            <span class="mail-viewer-avatar" style="background:${color}">${escapeHtml(ini)}</span>
            <span>
              <strong>${escapeHtml(m.fromName || m.fromEmail || "(no sender)")}</strong>
              <span class="mail-viewer-from-email">&lt;${escapeHtml(m.fromEmail || "")}&gt;</span><br>
              <small>to ${escapeHtml(m.to || "")}${m.cc ? ` · cc ${escapeHtml(m.cc)}` : ""}</small><br>
              <small>${escapeHtml(fullTimeFmt(m.date))} · via ${escapeHtml(m.accountAddress || "")}</small>
            </span>
          </p>
          ${attachmentsHtml}
          <div class="mail-viewer-actions">
            <span data-followup-host>${renderFollowupBadge(m)}</span>
            ${actionsHtml}
          </div>
        </div>
        <div class="mail-viewer-body">${bodyHtml}</div>
      `;
      return;
    }

    // Conversation render — title + bubbles (oldest → newest), with the
    // existing actions row pinned beneath the latest message.
    const cleanSubject = (m.subject || "(no subject)").replace(/^((re|fw|fwd|sv|aw|tr|ynt|rv|вн|нэ|fyi)\s*[:\-]\s*)+/i, "") || (m.subject || "(no subject)");
    viewerNode.innerHTML = `
      <div class="mail-viewer-head">
        <h2>${escapeHtml(cleanSubject)}</h2>
        <p class="mail-viewer-meta">
          <small>${entries.length} messages · via ${escapeHtml(m.accountAddress || "")}</small>
        </p>
        <div class="mail-viewer-actions">
          <span data-followup-host>${renderFollowupBadge(m)}</span>
          ${actionsHtml}
        </div>
      </div>
      <div class="mail-conversation">${renderConversationBubbles(entries, m)}</div>
    `;
    // Scroll the most recent bubble into view by default.
    const conv = viewerNode.querySelector(".mail-conversation");
    const last = conv?.querySelector(".mail-bubble:last-child");
    if (last) last.scrollIntoView({ block: "start", behavior: "auto" });
  }

  // ── Compose modal ─────────────────────────────────────────────
  const composeModal = document.getElementById("mail-compose-modal");
  const composeForm = document.getElementById("mail-compose-form");
  const composeStatus = document.getElementById("mail-compose-status");
  const composeBtn = document.getElementById("mail-compose");
  const composeTitle = document.getElementById("mail-compose-title");
  const composeBodyHost = document.getElementById("mail-compose-body-host");
  const composeSignatureSel = document.getElementById("mail-compose-signature");
  const loadTemplateBtn = document.getElementById("mail-compose-load-template");
  const manageSigsBtn = document.getElementById("mail-compose-manage-sigs");
  let templates = [];
  let signatures = [];
  let composeEditor = null;

  async function loadTemplates() {
    try {
      const r = await fetch("/api/mail/templates");
      const data = await r.json();
      if (r.ok) templates = data.entries || [];
    } catch {
      templates = [];
    }
  }

  async function loadSignatures() {
    try {
      const r = await fetch("/api/mail/my-signatures");
      const data = await r.json();
      if (r.ok) signatures = data.entries || [];
    } catch {
      signatures = [];
    }
    if (!composeSignatureSel) return;
    const opts = ['<option value="">— No signature —</option>']
      .concat(signatures.map((s) => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)}</option>`));
    composeSignatureSel.innerHTML = opts.join("");
  }

  // ── Template picker modal ────────────────────────────────────
  const tplPickerModal = document.getElementById("mail-template-picker");
  const tplPickerListNode = document.getElementById("mail-template-picker-list");
  const tplPickerSearch = document.getElementById("mail-template-search");

  function renderTemplatePickerList() {
    const q = (tplPickerSearch?.value || "").trim().toLowerCase();
    const rows = templates.filter((t) =>
      !q || (t.name || "").toLowerCase().includes(q) || (t.subject || "").toLowerCase().includes(q)
    );
    if (!rows.length) {
      tplPickerListNode.innerHTML = '<p class="empty">No templates. Create one in /mail-settings.</p>';
      return;
    }
    tplPickerListNode.innerHTML = rows.map((t) => `
      <button type="button" class="mail-pick-row" data-tpl-id="${escapeHtml(t.id)}">
        <div class="mail-pick-row-main">
          <strong>${escapeHtml(t.name)}</strong>
          <span>${escapeHtml(t.subject || "(no subject)")}</span>
        </div>
        <span class="mail-pick-row-arrow">→</span>
      </button>
    `).join("");
  }

  async function openTemplatePicker() {
    await loadTemplates();
    if (tplPickerSearch) tplPickerSearch.value = "";
    renderTemplatePickerList();
    tplPickerModal.removeAttribute("hidden");
    setTimeout(() => tplPickerSearch?.focus(), 50);
  }
  function closeTemplatePicker() { tplPickerModal.setAttribute("hidden", ""); }

  tplPickerSearch?.addEventListener("input", renderTemplatePickerList);
  tplPickerModal?.addEventListener("click", (e) => {
    if (e.target.dataset.action === "close-picker") closeTemplatePicker();
    const row = e.target.closest("[data-tpl-id]");
    if (row) {
      const id = row.dataset.tplId;
      const tpl = templates.find((t) => t.id === id);
      if (tpl) {
        if (tpl.subject) composeForm.elements.subject.value = tpl.subject;
        composeEditor?.setHtml(tpl.bodyHtml || "");
        UI?.toast?.(`Applied template: ${tpl.name}`, "info");
      }
      closeTemplatePicker();
    }
  });
  loadTemplateBtn?.addEventListener("click", openTemplatePicker);

  // ── Signatures manager + sub-editor ──────────────────────────
  const sigsModal = document.getElementById("mail-signatures-modal");
  const sigListHost = document.getElementById("mail-sig-list-host");
  const sigEditorModal = document.getElementById("mail-sig-editor-modal");
  const sigEditorTitle = document.getElementById("mail-sig-editor-title");
  const sigEditorName = document.getElementById("mail-sig-editor-name");
  const sigEditorHost = document.getElementById("mail-sig-editor-host");
  const sigEditorStatus = document.getElementById("mail-sig-editor-status");
  const sigEditorSaveBtn = document.getElementById("mail-sig-editor-save");
  const sigsOpenBtn = document.getElementById("mail-signatures-open");
  const sigNewBtn = document.getElementById("mail-sig-new");
  let sigEditor = null;
  let sigEditingId = null;

  function renderSigList() {
    if (!signatures.length) {
      sigListHost.innerHTML = '<p class="empty">No signatures yet. Click "+ New signature" to create one.</p>';
      return;
    }
    sigListHost.innerHTML = signatures.map((s) => `
      <article class="mail-sig-card" data-sig-id="${escapeHtml(s.id)}">
        <header>
          <strong>${escapeHtml(s.name)}</strong>
          <span class="mail-sig-actions">
            <button type="button" class="secondary-button" data-sig-action="edit">Edit</button>
            <button type="button" class="secondary-button danger-button" data-sig-action="delete">Delete</button>
          </span>
        </header>
        <div class="mail-sig-preview">${s.html || '<em>(empty)</em>'}</div>
      </article>
    `).join("");
  }

  async function openSignaturesModal() {
    await loadSignatures();
    renderSigList();
    sigsModal.removeAttribute("hidden");
  }
  function closeSignaturesModal() { sigsModal.setAttribute("hidden", ""); }

  function openSigEditor(sig) {
    sigEditingId = sig?.id || null;
    sigEditorTitle.textContent = sig ? `Edit: ${sig.name}` : "New signature";
    sigEditorName.value = sig?.name || "";
    sigEditor = window.RichEditor.create(sigEditorHost, { initialHtml: sig?.html || "", minHeight: 220 });
    sigEditorStatus.textContent = "";
    sigEditorModal.removeAttribute("hidden");
    setTimeout(() => sigEditorName.focus(), 50);
  }
  function closeSigEditor() {
    sigEditorModal.setAttribute("hidden", "");
    sigEditorHost.innerHTML = "";
    sigEditor = null;
    sigEditingId = null;
  }

  sigsOpenBtn?.addEventListener("click", openSignaturesModal);
  manageSigsBtn?.addEventListener("click", openSignaturesModal);
  sigNewBtn?.addEventListener("click", () => openSigEditor(null));
  sigsModal?.addEventListener("click", async (e) => {
    if (e.target.dataset.action === "close-sigs") return closeSignaturesModal();
    const btn = e.target.closest("[data-sig-action]");
    if (!btn) return;
    const card = btn.closest("[data-sig-id]");
    const id = card?.dataset.sigId;
    const sig = signatures.find((s) => s.id === id);
    if (!sig) return;
    if (btn.dataset.sigAction === "edit") {
      openSigEditor(sig);
    } else if (btn.dataset.sigAction === "delete") {
      const ok = await UI.confirm(`Delete signature "${sig.name}"?`, { dangerous: true });
      if (!ok) return;
      try {
        const r = await fetch(`/api/mail/my-signatures/${encodeURIComponent(id)}`, { method: "DELETE" });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Delete failed");
        UI?.toast?.("Deleted.", "success");
        await loadSignatures();
        renderSigList();
      } catch (err) {
        UI?.toast?.(err.message || "Delete failed", "error");
      }
    }
  });

  sigEditorModal?.addEventListener("click", (e) => {
    if (e.target.dataset.action === "close-sig-editor") closeSigEditor();
  });

  sigEditorSaveBtn?.addEventListener("click", async () => {
    const name = (sigEditorName.value || "").trim();
    if (!name) {
      sigEditorStatus.textContent = "Name is required";
      return;
    }
    const html = sigEditor?.getHtml() || "";
    sigEditorStatus.textContent = "Saving...";
    sigEditorSaveBtn.disabled = true;
    try {
      const url = sigEditingId
        ? `/api/mail/my-signatures/${encodeURIComponent(sigEditingId)}`
        : "/api/mail/my-signatures";
      const method = sigEditingId ? "PATCH" : "POST";
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, html }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Save failed");
      UI?.toast?.("Saved.", "success");
      closeSigEditor();
      await loadSignatures();
      renderSigList();
    } catch (err) {
      sigEditorStatus.textContent = err.message || "Save failed";
    } finally {
      sigEditorSaveBtn.disabled = false;
    }
  });

  // ── Templates manager + sub-editor ───────────────────────────
  const tplsModal = document.getElementById("mail-templates-modal");
  const tplListHost = document.getElementById("mail-tpl-list-host");
  const tplsOpenBtn = document.getElementById("mail-templates-open");
  const tplNewBtn = document.getElementById("mail-tpl-new");
  const tplEditorModal = document.getElementById("mail-tpl-editor-modal");
  const tplEditorTitle = document.getElementById("mail-tpl-editor-title");
  const tplEditorName = document.getElementById("mail-tpl-editor-name");
  const tplEditorSubject = document.getElementById("mail-tpl-editor-subject");
  const tplEditorHost = document.getElementById("mail-tpl-editor-host");
  const tplEditorStatus = document.getElementById("mail-tpl-editor-status");
  const tplEditorSaveBtn = document.getElementById("mail-tpl-editor-save");
  let tplEditor = null;
  let tplEditingId = null;

  function renderTplList() {
    if (!templates.length) {
      tplListHost.innerHTML = '<p class="empty">No templates yet. Click "+ New template" to create one.</p>';
      return;
    }
    tplListHost.innerHTML = templates.map((t) => `
      <article class="mail-sig-card" data-tpl-id="${escapeHtml(t.id)}">
        <header>
          <strong>${escapeHtml(t.name)}</strong>
          <span class="mail-sig-actions">
            <button type="button" class="secondary-button" data-tpl-action="edit">Edit</button>
            <button type="button" class="secondary-button danger-button" data-tpl-action="delete">Delete</button>
          </span>
        </header>
        <p style="margin: 0 0 6px; color: #64748b; font-size: 0.82rem;">${escapeHtml(t.subject || "(no subject)")}</p>
        <div class="mail-sig-preview">${t.bodyHtml || '<em>(empty)</em>'}</div>
      </article>
    `).join("");
  }

  async function openTemplatesModal() {
    await loadTemplates();
    renderTplList();
    tplsModal.removeAttribute("hidden");
  }
  function closeTemplatesModal() { tplsModal.setAttribute("hidden", ""); }

  function openTplEditor(tpl) {
    tplEditingId = tpl?.id || null;
    tplEditorTitle.textContent = tpl ? `Edit: ${tpl.name}` : "New template";
    tplEditorName.value = tpl?.name || "";
    tplEditorSubject.value = tpl?.subject || "";
    tplEditor = window.RichEditor.create(tplEditorHost, { initialHtml: tpl?.bodyHtml || "", minHeight: 240 });
    tplEditorStatus.textContent = "";
    tplEditorModal.removeAttribute("hidden");
    setTimeout(() => tplEditorName.focus(), 50);
  }
  function closeTplEditor() {
    tplEditorModal.setAttribute("hidden", "");
    tplEditorHost.innerHTML = "";
    tplEditor = null;
    tplEditingId = null;
  }

  tplsOpenBtn?.addEventListener("click", openTemplatesModal);
  tplNewBtn?.addEventListener("click", () => openTplEditor(null));
  tplsModal?.addEventListener("click", async (e) => {
    if (e.target.dataset.action === "close-tpls") return closeTemplatesModal();
    const btn = e.target.closest("[data-tpl-action]");
    if (!btn) return;
    const card = btn.closest("[data-tpl-id]");
    const id = card?.dataset.tplId;
    const tpl = templates.find((t) => t.id === id);
    if (!tpl) return;
    if (btn.dataset.tplAction === "edit") {
      openTplEditor(tpl);
    } else if (btn.dataset.tplAction === "delete") {
      const ok = await UI.confirm(`Delete template "${tpl.name}"?`, { dangerous: true });
      if (!ok) return;
      try {
        const r = await fetch(`/api/mail/templates/${encodeURIComponent(id)}`, { method: "DELETE" });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Delete failed");
        UI?.toast?.("Deleted.", "success");
        await loadTemplates();
        renderTplList();
      } catch (err) {
        UI?.toast?.(err.message || "Delete failed", "error");
      }
    }
  });

  tplEditorModal?.addEventListener("click", (e) => {
    if (e.target.dataset.action === "close-tpl-editor") closeTplEditor();
  });

  tplEditorSaveBtn?.addEventListener("click", async () => {
    const name = (tplEditorName.value || "").trim();
    if (!name) {
      tplEditorStatus.textContent = "Name is required";
      return;
    }
    const subject = (tplEditorSubject.value || "").trim();
    const bodyHtml = tplEditor?.getHtml() || "";
    tplEditorStatus.textContent = "Saving...";
    tplEditorSaveBtn.disabled = true;
    try {
      const url = tplEditingId
        ? `/api/mail/templates/${encodeURIComponent(tplEditingId)}`
        : "/api/mail/templates";
      const method = tplEditingId ? "PATCH" : "POST";
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, subject, bodyHtml }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Save failed");
      UI?.toast?.("Saved.", "success");
      closeTplEditor();
      await loadTemplates();
      renderTplList();
    } catch (err) {
      tplEditorStatus.textContent = err.message || "Save failed";
    } finally {
      tplEditorSaveBtn.disabled = false;
    }
  });

  function openCompose(prefill, title) {
    if (!accounts.length) {
      UI?.toast?.("Connect a mailbox first in /mail-settings.", "warning");
      return;
    }
    composeForm.reset();
    composeTitle.textContent = title || "New message";
    // Refresh templates and signatures so any edits in another tab show up
    loadTemplates();
    loadSignatures();
    const fromSel = composeForm.elements.fromAccountId;
    fromSel.innerHTML = accounts.map((a) =>
      `<option value="${escapeHtml(a.id)}">${escapeHtml(a.displayName || a.address)} &lt;${escapeHtml(a.address)}&gt;</option>`
    ).join("");
    // Mount the rich editor for the body
    composeEditor = window.RichEditor.create(composeBodyHost, {
      initialHtml: prefill?.bodyHtml || "",
      minHeight: 240,
      placeholder: "Write your message...",
    });
    if (prefill) {
      if (prefill.fromAccountId) fromSel.value = prefill.fromAccountId;
      if (prefill.to) composeForm.elements.to.value = prefill.to;
      if (prefill.cc) composeForm.elements.cc.value = prefill.cc;
      if (prefill.subject) composeForm.elements.subject.value = prefill.subject;
      if (prefill.replyToMessageId) composeForm.elements.replyToMessageId.value = prefill.replyToMessageId;
      if (prefill.cc || prefill.bcc) composeForm.querySelector(".mail-compose-extra")?.setAttribute("open", "");
    } else {
      composeForm.elements.replyToMessageId.value = "";
    }
    composeStatus.textContent = "";
    composeModal.removeAttribute("hidden");
    setTimeout(() => composeForm.elements.to?.focus(), 50);
  }

  function closeCompose() {
    composeModal.setAttribute("hidden", "");
    if (composeBodyHost) composeBodyHost.innerHTML = "";
    composeEditor = null;
  }

  composeBtn?.addEventListener("click", () => openCompose(null, "New message"));
  composeModal?.addEventListener("click", (e) => {
    if (e.target.dataset.action === "close-compose") closeCompose();
  });

  composeForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(composeForm);
    const bodyHtml = composeEditor?.getHtml() || "";
    // Derive a plain-text version locally as a fallback for the server
    const plainBody = (() => {
      const tmp = document.createElement("div");
      tmp.innerHTML = bodyHtml
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p\s*>/gi, "\n\n")
        .replace(/<\/div\s*>/gi, "\n");
      return (tmp.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
    })();
    const payload = {
      fromAccountId: fd.get("fromAccountId"),
      to: fd.get("to"),
      cc: fd.get("cc"),
      bcc: fd.get("bcc"),
      subject: fd.get("subject"),
      body: plainBody,
      bodyHtml,
      replyToMessageId: fd.get("replyToMessageId"),
      signatureId: fd.get("signatureId") || "",
    };
    composeStatus.textContent = "Sending...";
    try {
      const r = await fetch("/api/mail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await r.json();
      if (!r.ok) {
        if (data.refused && data.refused.length) {
          const list = data.refused.map((x) => `${x.address} (${x.code})`).join(", ");
          throw new Error(`${data.error || "Send failed"} — refused: ${list}`);
        }
        throw new Error(data.error || "Send failed");
      }
      if (data.refused && data.refused.length) {
        // Some addresses were refused but the message went out to the rest.
        const list = data.refused.map((x) => x.address).join(", ");
        UI?.toast?.(`Sent — but Gmail refused these addresses: ${list}. Check for typos.`, "warning");
      } else {
        UI?.toast?.("Sent.", "success");
      }
      closeCompose();
    } catch (err) {
      composeStatus.textContent = err.message;
    }
  });

  // ── Reply / Forward / Delete / Attachment from viewer ─────────
  viewerNode?.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn || !currentMessage) return;
    if (btn.dataset.action === "preview-attachment") {
      e.preventDefault();
      openAttachmentPreview({
        previewUrl: btn.dataset.previewUrl,
        downloadUrl: btn.dataset.downloadUrl,
        filename: btn.dataset.filename,
        ctype: btn.dataset.ctype,
      });
      return;
    }
    if (btn.dataset.action === "download-attachment") {
      // Let the inline <a class="mail-attachment-dl"> handle the actual
      // download — the chip click on a non-previewable type just opens
      // the download via a programmatic anchor for parity.
      e.preventDefault();
      const a = document.createElement("a");
      a.href = btn.dataset.downloadUrl;
      a.download = btn.dataset.filename || "attachment";
      a.click();
      return;
    }
    const m = currentMessage;
    if (btn.dataset.action === "reply") {
      openCompose({
        fromAccountId: m.accountId,
        to: m.fromEmail || m.from,
        subject: m.subject?.toLowerCase().startsWith("re:") ? m.subject : `Re: ${m.subject || ""}`,
        body: "",
        replyToMessageId: m.messageId,
      }, "Reply");
    } else if (btn.dataset.action === "reply-all") {
      const cc = [m.to, m.cc].filter(Boolean).join(", ");
      openCompose({
        fromAccountId: m.accountId,
        to: m.fromEmail || m.from,
        cc: cc,
        subject: m.subject?.toLowerCase().startsWith("re:") ? m.subject : `Re: ${m.subject || ""}`,
        body: "",
        replyToMessageId: m.messageId,
      }, "Reply all");
    } else if (btn.dataset.action === "forward") {
      openCompose({
        fromAccountId: m.accountId,
        subject: m.subject?.toLowerCase().startsWith("fwd:") ? m.subject : `Fwd: ${m.subject || ""}`,
        body: "",
      }, "Forward");
    } else if (btn.dataset.action === "mark-unread") {
      const ok = await markUnread(getKey(m));
      if (ok) {
        UI?.toast?.("Marked unread.", "success");
        // Close the viewer so the unread state is obvious in the list
        selectedKey = "";
        currentMessage = null;
        viewerNode.innerHTML = '<div class="mail-viewer-empty"><div class="mail-empty-illustration mail-empty-illustration--small">✉</div><p>Select a message to read it.</p></div>';
        document.querySelector(".mail-layout")?.classList.remove("is-viewing");
      }
    } else if (btn.dataset.action === "delete-msg") {
      const ok = await UI.confirm("Move this message to Trash?", { dangerous: true });
      if (!ok) return;
      try {
        const r = await fetch(`/api/mail/messages/${encodeURIComponent(m.accountId)}/${encodeURIComponent(m.uid)}?folder=${encodeURIComponent(currentFolder)}`, { method: "DELETE" });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Delete failed");
        UI?.toast?.("Moved to Trash.", "success");
        messages = messages.filter((x) => !(x.accountId === m.accountId && x.uid === m.uid));
        selectedKey = "";
        currentMessage = null;
        viewerNode.innerHTML = '<div class="mail-viewer-empty"><div class="mail-empty-illustration mail-empty-illustration--small">✉</div><p>Select a message to read it.</p></div>';
        renderList();
      } catch (err) {
        UI?.toast?.(err.message || "Delete failed", "error");
      }
    }
  });

  function openViewerModal() {
    const modal = document.getElementById("mail-viewer-modal");
    if (!modal) return;
    modal.classList.remove("is-hidden");
    modal.removeAttribute("hidden");
    document.body.classList.add("modal-open");
  }
  function closeViewerModal() {
    const modal = document.getElementById("mail-viewer-modal");
    if (!modal) return;
    modal.classList.add("is-hidden");
    modal.setAttribute("hidden", "");
    document.body.classList.remove("modal-open");
    selectedKey = "";
    currentMessage = null;
    renderList();
  }
  document.getElementById("mail-viewer-modal")?.addEventListener("click", (event) => {
    if (event.target?.dataset?.action === "close-viewer") closeViewerModal();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      const modal = document.getElementById("mail-viewer-modal");
      if (modal && !modal.hasAttribute("hidden")) closeViewerModal();
    }
  });

  function selectKey(key) {
    selectedKey = key;
    if (key) {
      const [accountId, uid] = key.split(":");
      const m = messages.find((x) => x.accountId === accountId && String(x.uid) === uid);
      if (m && !m.isRead && currentFolder === "inbox") {
        m.isRead = true;
        fetch(`/api/mail/messages/${encodeURIComponent(accountId)}/${encodeURIComponent(uid)}/read?folder=${encodeURIComponent(currentFolder)}`, { method: "POST" }).catch(() => {});
      }
      loadMessage(key);
      openViewerModal();
    }
    renderList();
    document.querySelector(".mail-layout")?.classList.toggle("is-viewing", !!key);
  }

  async function loadInbox(showSpinner) {
    if (showSpinner) {
      const label = currentFolder === "sent" ? "Loading sent mail..." : "Syncing mailbox...";
      listNode.innerHTML = `<p class="empty">${label}</p>`;
    }
    try {
      const r = await fetch(`/api/mail/messages?sync=1&folder=${encodeURIComponent(currentFolder)}`);
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Failed to load");
      // Only show messages from accounts in the current workspace
      const visibleAccountIds = new Set(accounts.map((a) => a.id));
      messages = (data.entries || []).filter((m) => visibleAccountIds.has(m.accountId));
      if (data.syncErrors && data.syncErrors.length) {
        UI?.toast?.(`Sync issue: ${data.syncErrors[0].error}`, "error");
      }
      renderList();
    } catch (err) {
      listNode.innerHTML = `<p class="empty">Could not load: ${escapeHtml(err.message)}</p>`;
    }
  }

  function setFolder(folder) {
    if (folder !== "inbox" && folder !== "sent") return;
    if (folder === currentFolder) return;
    currentFolder = folder;
    selectedKey = "";
    currentMessage = null;
    checkedKeys.clear();
    document.querySelectorAll(".mail-folder-tab").forEach((t) => {
      t.classList.toggle("is-active", t.dataset.folder === folder);
    });
    viewerNode.innerHTML = '<div class="mail-viewer-empty"><div class="mail-empty-illustration mail-empty-illustration--small">✉</div><p>Select a message to read it.</p></div>';
    document.querySelector(".mail-layout")?.classList.remove("is-viewing");
    loadInbox(true);
  }

  function setupSwipeGestures() {
    // Touch-only gestures: enabled when the device supports touch (we still
    // listen on desktop too, but mouse drag is intentionally not bound).
    let active = null; // { wrap, key, startX, startY, dx, started, contentEls, overlayEl }
    const SWIPE_THRESHOLD = 80; // px before an action commits
    const MAX_TRAVEL = 140;     // px the row can be dragged

    function getTargetWrap(target) {
      const wrap = target.closest(".mail-list-row-wrap");
      if (!wrap) return null;
      // Don't start swipe if the touch began on the checkbox label
      if (target.closest(".mail-list-check")) return null;
      return wrap;
    }

    function ensureOverlay(wrap) {
      let overlay = wrap.querySelector(".mail-swipe-actions");
      if (!overlay) {
        overlay = document.createElement("div");
        overlay.className = "mail-swipe-actions";
        overlay.innerHTML = `
          <span class="swipe-left">◉ Mark unread</span>
          <span class="swipe-right">🗑 Delete</span>
        `;
        wrap.insertBefore(overlay, wrap.firstChild);
      }
      return overlay;
    }

    function onTouchStart(e) {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      const wrap = getTargetWrap(t.target);
      if (!wrap) return;
      const key = wrap.dataset.key;
      if (!key) return;
      active = {
        wrap,
        key,
        startX: t.clientX,
        startY: t.clientY,
        dx: 0,
        started: false,
        overlayEl: null,
        contentEls: Array.from(wrap.querySelectorAll(".mail-list-check, .mail-list-row")),
      };
    }

    function onTouchMove(e) {
      if (!active) return;
      const t = e.touches[0];
      const dx = t.clientX - active.startX;
      const dy = t.clientY - active.startY;
      if (!active.started) {
        // Only commit to a horizontal swipe once it's clearly horizontal
        if (Math.abs(dx) < 10) return;
        if (Math.abs(dy) > Math.abs(dx)) {
          // Vertical scroll wins — abort the swipe
          active = null;
          return;
        }
        active.started = true;
        active.overlayEl = ensureOverlay(active.wrap);
        active.wrap.classList.add("is-swiping");
      }
      e.preventDefault(); // we own the gesture now
      const clamped = Math.max(-MAX_TRAVEL, Math.min(MAX_TRAVEL, dx));
      active.dx = clamped;
      const t3d = `translateX(${clamped}px)`;
      active.contentEls.forEach((el) => { el.style.transform = t3d; });
    }

    function snapBack(wrap, contentEls) {
      // Animate the row's content back to translateX(0), then strip the
      // swipe overlay + classes.
      wrap.classList.remove("is-swiping");
      wrap.classList.add("is-snapping");
      contentEls.forEach((el) => { el.style.transform = ""; });
      setTimeout(() => {
        wrap.classList.remove("is-snapping");
        contentEls.forEach((el) => { el.style.transform = ""; });
        wrap.querySelector(".mail-swipe-actions")?.remove();
      }, 240);
    }

    async function onTouchEnd() {
      if (!active) return;
      const a = active;
      active = null;
      if (!a.started) return;
      const dx = a.dx;
      snapBack(a.wrap, a.contentEls);
      if (Math.abs(dx) < SWIPE_THRESHOLD) return;
      if (dx < 0) {
        // Swipe left → Delete (always confirm)
        const ok = await UI.confirm("Move this message to Trash?", { dangerous: true });
        if (!ok) return;
        const [accountId, uid] = a.key.split(":");
        try {
          const r = await fetch(`/api/mail/messages/${encodeURIComponent(accountId)}/${encodeURIComponent(uid)}?folder=${encodeURIComponent(currentFolder)}`, { method: "DELETE" });
          const data = await r.json();
          if (!r.ok) throw new Error(data.error || "Delete failed");
          UI?.toast?.("Moved to Trash.", "success");
          messages = messages.filter((x) => !(x.accountId === accountId && String(x.uid) === uid));
          if (selectedKey === a.key) {
            selectedKey = "";
            currentMessage = null;
            viewerNode.innerHTML = '<div class="mail-viewer-empty"><div class="mail-empty-illustration mail-empty-illustration--small">✉</div><p>Select a message to read it.</p></div>';
            document.querySelector(".mail-layout")?.classList.remove("is-viewing");
          }
          renderList();
        } catch (err) {
          UI?.toast?.(err.message || "Delete failed", "error");
        }
      } else {
        // Swipe right → Mark unread
        if (currentFolder === "sent") {
          UI?.toast?.("Sent items are always read.", "info");
          return;
        }
        const ok = await markUnread(a.key);
        if (ok) UI?.toast?.("Marked unread.", "success");
      }
    }

    listNode.addEventListener("touchstart", onTouchStart, { passive: true });
    listNode.addEventListener("touchmove", onTouchMove, { passive: false });
    listNode.addEventListener("touchend", onTouchEnd, { passive: true });
    listNode.addEventListener("touchcancel", () => {
      if (!active) return;
      const a = active;
      active = null;
      if (a.started) snapBack(a.wrap, a.contentEls);
    }, { passive: true });
  }

  async function bootstrap() {
    try {
      // ?scope=workspace tells the server to filter mailboxes to the active
      // workspace too — defense in depth in case localStorage was cleared.
      const r = await fetch("/api/mail/accounts?scope=workspace");
      const data = await r.json();
      accounts = (data.entries || []).filter(workspaceMatches);
    } catch {
      accounts = [];
    }
    if (!accounts.length) {
      notConfiguredNode.removeAttribute("hidden");
      return;
    }
    shellNode.removeAttribute("hidden");
    // Pick the workspace label off the data so it can't drift from what's
    // actually in the dropdown — if every visible account is USM, label is
    // "All USM mailboxes"; otherwise default to DTX.
    const distinctWs = new Set(accounts.map((a) => (a.workspace || "DTX").toUpperCase()));
    let wsLabel = "All mailboxes";
    if (distinctWs.size === 1) {
      const only = [...distinctWs][0];
      wsLabel = only === "USM" ? "All USM mailboxes" : "All DTX mailboxes";
    }
    accountFilter.innerHTML = `<option value="">${escapeHtml(wsLabel)}</option>` +
      accounts.map((a) => `<option value="${escapeHtml(a.id)}">${escapeHtml(a.address)}</option>`).join("");
    accountFilter.addEventListener("change", renderList);
    searchInput.addEventListener("input", renderList);
    refreshBtn.addEventListener("click", () => loadInbox(true));
    listNode.addEventListener("click", (e) => {
      const cb = e.target.closest("[data-bulk-key]");
      if (cb) {
        e.stopPropagation();
        const key = cb.dataset.bulkKey;
        if (cb.checked) checkedKeys.add(key);
        else checkedKeys.delete(key);
        const wrap = cb.closest("[data-key]");
        wrap?.classList.toggle("is-checked", cb.checked);
        updateBulkBar();
        return;
      }
      const fbtn = e.target.closest(".mail-followup-btn");
      if (fbtn) {
        e.stopPropagation();
        e.preventDefault();
        openFollowupPicker(fbtn);
        return;
      }
      const btn = e.target.closest("button.mail-list-row");
      if (btn) selectKey(btn.dataset.key);
    });
    // Bell clicks inside the modal viewer use the same picker.
    document.getElementById("mail-viewer-modal")?.addEventListener("click", (e) => {
      const fbtn = e.target.closest(".mail-followup-btn");
      if (fbtn) {
        e.stopPropagation();
        e.preventDefault();
        openFollowupPicker(fbtn);
      }
    });
    loadFollowups();
    document.getElementById("mail-bulk-delete")?.addEventListener("click", bulkDelete);
    document.getElementById("mail-bulk-unread")?.addEventListener("click", bulkMarkUnread);
    document.getElementById("mail-bulk-clear")?.addEventListener("click", () => {
      checkedKeys.clear();
      renderList();
    });
    document.querySelectorAll(".mail-folder-tab").forEach((t) => {
      t.addEventListener("click", () => setFolder(t.dataset.folder));
    });
    const unreadBtn = document.getElementById("mail-unread-toggle");
    unreadBtn?.addEventListener("click", () => {
      unreadOnly = !unreadOnly;
      unreadBtn.classList.toggle("is-active", unreadOnly);
      unreadBtn.setAttribute("aria-pressed", unreadOnly ? "true" : "false");
      renderList();
    });
    setupSwipeGestures();
    loadTemplates();
    loadSignatures();
    await loadInbox(true);

    // If routed from the topbar mail icon (e.g. /mail?key=accountId:uid),
    // open the targeted message after the inbox finishes loading.
    try {
      const params = new URLSearchParams(window.location.search);
      const key = params.get("key");
      if (key && messages.find((m) => getKey(m) === key)) {
        selectKey(key);
      }
    } catch {}

    // Auto-poll every 30s while the page is visible. Pause when hidden
    // so we don't burn cycles on a backgrounded tab.
    setInterval(() => {
      if (document.visibilityState === "visible") {
        loadInbox(false);
      }
    }, 30000);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") loadInbox(false);
    });
  }

  bootstrap();
})();
