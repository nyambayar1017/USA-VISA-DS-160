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

  function renderList() {
    const rows = getFiltered();
    countNode.textContent = `${rows.length} message${rows.length === 1 ? "" : "s"}`;
    updateBulkBar();
    if (!rows.length) {
      listNode.innerHTML = '<p class="empty">No messages match.</p>';
      return;
    }
    listNode.innerHTML = rows.map((m) => {
      const key = getKey(m);
      const isActive = key === selectedKey;
      const isUnread = !m.isRead;
      const isChecked = checkedKeys.has(key);
      const ini = initials(m.fromName, m.fromEmail);
      const color = colorFor(m.fromEmail || m.from);
      const accountTag = m.accountAddress
        ? `<span class="mail-list-account-tag mail-list-account-tag--${(m.workspace || "DTX").toLowerCase()}">${escapeHtml(m.accountAddress)}</span>`
        : "";
      return `
        <div class="mail-list-row-wrap${isActive ? " is-active" : ""}${isUnread ? " is-unread" : " is-read"}${isChecked ? " is-checked" : ""}" data-key="${escapeHtml(key)}">
          <label class="mail-list-check">
            <input type="checkbox" data-bulk-key="${escapeHtml(key)}" ${isChecked ? "checked" : ""}>
          </label>
          <button type="button" class="mail-list-row" data-key="${escapeHtml(key)}">
            <span class="mail-list-avatar" style="background:${color}">${escapeHtml(ini)}</span>
            <div class="mail-list-body">
              <div class="mail-list-row-top">
                <strong>${escapeHtml(m.fromName || m.fromEmail || "(no sender)")}</strong>
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

  async function bulkDelete() {
    if (checkedKeys.size === 0) return;
    const ok = await UI.confirm(`Move ${checkedKeys.size} message${checkedKeys.size === 1 ? "" : "s"} to Trash?`, { dangerous: true });
    if (!ok) return;
    const keys = Array.from(checkedKeys);
    let okCount = 0, failCount = 0;
    for (const key of keys) {
      const [accountId, uid] = key.split(":");
      try {
        const r = await fetch(`/api/mail/messages/${encodeURIComponent(accountId)}/${encodeURIComponent(uid)}`, { method: "DELETE" });
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
      const r = await fetch(`/api/mail/messages/${encodeURIComponent(accountId)}/${encodeURIComponent(uid)}`);
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Could not load");
      renderViewer(data.entry);
    } catch (err) {
      viewerNode.innerHTML = `<div class="mail-viewer-empty"><p>Error: ${escapeHtml(err.message)}</p></div>`;
    }
  }

  let currentMessage = null;

  function renderViewer(m) {
    currentMessage = m;
    const ini = initials(m.fromName, m.fromEmail);
    const color = colorFor(m.fromEmail || m.from);
    const bodyHtml = m.bodyHtml
      ? `<iframe class="mail-body-iframe" sandbox="" srcdoc="${escapeHtml(m.bodyHtml)}"></iframe>`
      : `<pre class="mail-body-text">${escapeHtml(m.bodyText || "(empty message)")}</pre>`;
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
        <div class="mail-viewer-actions">
          <button type="button" class="secondary-button" data-action="reply">↩ Reply</button>
          <button type="button" class="secondary-button" data-action="reply-all">↩↩ Reply all</button>
          <button type="button" class="secondary-button" data-action="forward">→ Forward</button>
          <button type="button" class="secondary-button danger-button" data-action="delete-msg">Delete</button>
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
    } else if (btn.dataset.action === "delete-msg") {
      const ok = await UI.confirm("Move this message to Trash?", { dangerous: true });
      if (!ok) return;
      try {
        const r = await fetch(`/api/mail/messages/${encodeURIComponent(m.accountId)}/${encodeURIComponent(m.uid)}`, { method: "DELETE" });
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
      // Optimistically mark read locally
      const [accountId, uid] = key.split(":");
      const m = messages.find((x) => x.accountId === accountId && String(x.uid) === uid);
      if (m && !m.isRead) {
        m.isRead = true;
        // Fire-and-forget mark-read on server (also flags it \Seen on Gmail)
        fetch(`/api/mail/messages/${encodeURIComponent(accountId)}/${encodeURIComponent(uid)}/read`, { method: "POST" }).catch(() => {});
      }
      loadMessage(key);
    }
    renderList();
    document.querySelector(".mail-layout")?.classList.toggle("is-viewing", !!key);
  }

  async function loadInbox(showSpinner) {
    if (showSpinner) listNode.innerHTML = '<p class="empty">Syncing mailbox...</p>';
    try {
      const r = await fetch("/api/mail/messages?sync=1");
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
    document.getElementById("mail-bulk-clear")?.addEventListener("click", () => {
      checkedKeys.clear();
      renderList();
    });
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
