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
  const checkedKeys = new Set();

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

  function getFiltered() {
    const q = (searchInput.value || "").trim().toLowerCase();
    const acc = accountFilter.value || "";
    return messages.filter((m) => {
      if (acc && m.accountId !== acc) return false;
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
      const accountTag = m.accountAddress
        ? `<span class="mail-list-account-tag mail-list-account-tag--${workspace.toLowerCase()}">${escapeHtml(m.accountAddress)}</span>`
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
                <time>${escapeHtml(timeFmt(m.date))}</time>
              </div>
              <div class="mail-list-row-mid">
                <span class="mail-list-subject">${escapeHtml(m.subject || "(no subject)")}</span>
                ${m.hasAttachment ? '<span class="mail-list-attach" title="Has attachment">📎</span>' : ""}
              </div>
              <div class="mail-list-row-bottom">
                <span class="mail-list-snippet">${escapeHtml((m.snippet || "").slice(0, 140))}</span>
                ${accountTag}
              </div>
            </div>
          </button>
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
      renderViewer(data.entry);
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

  function renderAttachments(m) {
    const list = m.attachments || [];
    if (!list.length) return "";
    const items = list.map((a) => {
      const url = `/api/mail/messages/${encodeURIComponent(m.accountId)}/${encodeURIComponent(m.uid)}/attachments/${encodeURIComponent(a.idx)}?folder=${encodeURIComponent(currentFolder)}`;
      return `<a class="mail-attachment" href="${url}" target="_blank" rel="noopener" download="${escapeHtml(a.filename || '')}">
        <span class="mail-attachment-icon">${attachmentIcon(a.contentType)}</span>
        <span class="mail-attachment-name">${escapeHtml(a.filename || 'attachment')}</span>
        <span class="mail-attachment-size">${escapeHtml(fmtSize(a.size))}</span>
      </a>`;
    }).join("");
    return `<div class="mail-attachments">${items}</div>`;
  }

  let currentMessage = null;

  function renderViewer(m) {
    currentMessage = m;
    const ini = initials(m.fromName, m.fromEmail);
    const color = colorFor(m.fromEmail || m.from);
    const bodyHtml = m.bodyHtml
      ? `<iframe class="mail-body-iframe" sandbox="" srcdoc="${escapeHtml(m.bodyHtml)}"></iframe>`
      : `<pre class="mail-body-text">${escapeHtml(m.bodyText || "(empty message)")}</pre>`;
    const attachmentsHtml = renderAttachments(m);
    const isSent = (m.folder || currentFolder) === "sent";
    const actionsHtml = isSent
      ? `<button type="button" class="secondary-button" data-action="forward">→ Forward</button>
         <button type="button" class="secondary-button danger-button" data-action="delete-msg">Delete</button>`
      : `<button type="button" class="secondary-button" data-action="reply">↩ Reply</button>
         <button type="button" class="secondary-button" data-action="reply-all">↩↩ Reply all</button>
         <button type="button" class="secondary-button" data-action="forward">→ Forward</button>
         <button type="button" class="secondary-button" data-action="mark-unread">◉ Mark unread</button>
         <button type="button" class="secondary-button danger-button" data-action="delete-msg">Delete</button>`;
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
          ${actionsHtml}
        </div>
      </div>
      <div class="mail-viewer-body">${bodyHtml}</div>
    `;
  }

  // ── Compose modal ─────────────────────────────────────────────
  const composeModal = document.getElementById("mail-compose-modal");
  const composeForm = document.getElementById("mail-compose-form");
  const composeStatus = document.getElementById("mail-compose-status");
  const composeBtn = document.getElementById("mail-compose");
  const composeTitle = document.getElementById("mail-compose-title");

  function openCompose(prefill, title) {
    if (!accounts.length) {
      UI?.toast?.("Connect a mailbox first in /mail-settings.", "warning");
      return;
    }
    composeForm.reset();
    composeTitle.textContent = title || "New message";
    const fromSel = composeForm.elements.fromAccountId;
    fromSel.innerHTML = accounts.map((a) =>
      `<option value="${escapeHtml(a.id)}">${escapeHtml(a.displayName || a.address)} &lt;${escapeHtml(a.address)}&gt;</option>`
    ).join("");
    if (prefill) {
      if (prefill.fromAccountId) fromSel.value = prefill.fromAccountId;
      if (prefill.to) composeForm.elements.to.value = prefill.to;
      if (prefill.cc) composeForm.elements.cc.value = prefill.cc;
      if (prefill.subject) composeForm.elements.subject.value = prefill.subject;
      if (prefill.body) composeForm.elements.body.value = prefill.body;
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
  }

  composeBtn?.addEventListener("click", () => openCompose(null, "New message"));
  composeModal?.addEventListener("click", (e) => {
    if (e.target.dataset.action === "close-compose") closeCompose();
  });

  composeForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(composeForm);
    const payload = {
      fromAccountId: fd.get("fromAccountId"),
      to: fd.get("to"),
      cc: fd.get("cc"),
      bcc: fd.get("bcc"),
      subject: fd.get("subject"),
      body: fd.get("body"),
      replyToMessageId: fd.get("replyToMessageId"),
    };
    composeStatus.textContent = "Sending...";
    try {
      const r = await fetch("/api/mail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Send failed");
      UI?.toast?.("Sent.", "success");
      closeCompose();
    } catch (err) {
      composeStatus.textContent = err.message;
    }
  });

  // ── Reply / Forward / Delete from viewer ──────────────────────
  viewerNode?.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn || !currentMessage) return;
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
      messages = data.entries || [];
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
      const r = await fetch("/api/mail/accounts");
      const data = await r.json();
      accounts = data.entries || [];
    } catch {
      accounts = [];
    }
    if (!accounts.length) {
      notConfiguredNode.removeAttribute("hidden");
      return;
    }
    shellNode.removeAttribute("hidden");
    accountFilter.innerHTML = '<option value="">All mailboxes</option>' +
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
      const btn = e.target.closest("button.mail-list-row");
      if (btn) selectKey(btn.dataset.key);
    });
    document.getElementById("mail-bulk-delete")?.addEventListener("click", bulkDelete);
    document.getElementById("mail-bulk-unread")?.addEventListener("click", bulkMarkUnread);
    document.getElementById("mail-bulk-clear")?.addEventListener("click", () => {
      checkedKeys.clear();
      renderList();
    });
    document.querySelectorAll(".mail-folder-tab").forEach((t) => {
      t.addEventListener("click", () => setFolder(t.dataset.folder));
    });
    setupSwipeGestures();
    await loadInbox(true);

    // Auto-poll every 20s while the page is visible. Pause when hidden
    // so we don't burn cycles on a backgrounded tab.
    setInterval(() => {
      if (document.visibilityState === "visible") {
        loadInbox(false);
      }
    }, 20000);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") loadInbox(false);
    });
  }

  bootstrap();
})();
