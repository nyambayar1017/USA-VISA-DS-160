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
    if (!rows.length) {
      listNode.innerHTML = '<p class="empty">No messages match.</p>';
      return;
    }
    listNode.innerHTML = rows.map((m) => {
      const key = getKey(m);
      const isActive = key === selectedKey;
      const ini = initials(m.fromName, m.fromEmail);
      const color = colorFor(m.fromEmail || m.from);
      const accountTag = m.accountAddress
        ? `<span class="mail-list-account-tag mail-list-account-tag--${(m.workspace || "DTX").toLowerCase()}">${escapeHtml(m.accountAddress)}</span>`
        : "";
      return `
        <button type="button" class="mail-list-row${isActive ? " is-active" : ""}" data-key="${escapeHtml(key)}">
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
      `;
    }).join("");
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

  function renderViewer(m) {
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
      </div>
      <div class="mail-viewer-body">${bodyHtml}</div>
    `;
  }

  function selectKey(key) {
    selectedKey = key;
    renderList();
    if (key) loadMessage(key);
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
      const btn = e.target.closest("[data-key]");
      if (btn) selectKey(btn.dataset.key);
    });
    await loadInbox(true);
  }

  bootstrap();
})();
