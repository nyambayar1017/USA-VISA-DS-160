// Trip-scoped notes panel on /trip-detail.
// Uses the same /api/notes endpoint, scoped to the current tripId.
(function () {
  const form = document.getElementById("trip-note-form");
  const body = document.getElementById("trip-note-body");
  const status = document.getElementById("trip-note-status");
  const mentionPopover = document.getElementById("trip-note-mention-popover");
  const list = document.getElementById("trip-notes-list");
  if (!form || !list) return;

  function tripId() {
    return new URLSearchParams(window.location.search).get("tripId") || "";
  }

  let teamMembers = [];
  let notes = [];

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function fmt(iso) { try { return new Date(iso).toLocaleString(); } catch { return iso || ""; } }
  function bodyToHtml(t) {
    return escapeHtml(t).replace(/@\[([^\]]+)\]/g, '<span class="notes-mention">@$1</span>');
  }

  // Mention picker
  let mentionStart = -1;
  body.addEventListener("input", () => {
    const v = body.value;
    const c = body.selectionStart;
    let i = c - 1;
    while (i >= 0 && /[A-Za-zА-Яа-яЁё0-9_À-ɏḀ-ỿ\s]/.test(v[i])) i -= 1;
    if (i >= 0 && v[i] === "@" && (i === 0 || /\s/.test(v[i - 1]))) {
      const q = v.slice(i + 1, c);
      if (!/[\]\n]/.test(q)) {
        mentionStart = i;
        const filter = q.toLowerCase();
        const matches = teamMembers
          .filter((m) => (m.fullName || m.email || "").toLowerCase().includes(filter))
          .slice(0, 8);
        if (!matches.length) { mentionPopover.hidden = true; return; }
        mentionPopover.innerHTML = matches.map((m) =>
          `<button type="button" class="notes-mention-item" data-name="${escapeHtml(m.fullName || m.email)}">${escapeHtml(m.fullName || m.email)}</button>`
        ).join("");
        const wrapRect = body.parentElement.getBoundingClientRect();
        const rect = body.getBoundingClientRect();
        mentionPopover.style.top = (rect.bottom - wrapRect.top + 4) + "px";
        mentionPopover.style.left = "12px";
        mentionPopover.hidden = false;
        return;
      }
    }
    mentionPopover.hidden = true;
    mentionStart = -1;
  });
  body.addEventListener("blur", () => setTimeout(() => { mentionPopover.hidden = true; }, 150));
  mentionPopover.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-name]");
    if (!btn || mentionStart < 0) return;
    const name = btn.dataset.name;
    const before = body.value.slice(0, mentionStart);
    const after = body.value.slice(body.selectionStart);
    const insert = `@[${name}] `;
    body.value = before + insert + after;
    const caret = (before + insert).length;
    body.focus();
    body.setSelectionRange(caret, caret);
    mentionPopover.hidden = true;
    mentionStart = -1;
  });

  async function load() {
    const tid = tripId();
    if (!tid) return;
    try {
      const [teamRes, notesRes] = await Promise.all([
        fetch("/api/team-members").then((r) => r.json()).catch(() => ({})),
        fetch(`/api/notes?tripId=${encodeURIComponent(tid)}`).then((r) => r.json()).catch(() => ({})),
      ]);
      teamMembers = teamRes.entries || [];
      notes = notesRes.entries || [];
      render();
    } catch {}
  }

  function render() {
    if (!notes.length) {
      list.innerHTML = '<p class="empty">No notes for this trip yet.</p>';
      return;
    }
    list.innerHTML = notes.map((n) => {
      const author = n.createdBy?.name || n.createdBy?.email || "—";
      const avatar = n.createdByAvatar
        ? `<img src="${escapeHtml(n.createdByAvatar)}" alt="" class="notes-avatar">`
        : `<span class="notes-avatar notes-avatar-fallback">${escapeHtml((author[0] || "?").toUpperCase())}</span>`;
      return `
        <article class="notes-item">
          <header class="notes-item-head">
            ${avatar}
            <div class="notes-item-meta">
              <strong>${escapeHtml(author)}</strong>
              <time>${escapeHtml(fmt(n.createdAt))}</time>
            </div>
          </header>
          <p class="notes-item-body">${bodyToHtml(n.body || "")}</p>
        </article>
      `;
    }).join("");
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const tid = tripId();
    const text = body.value.trim();
    if (!text || !tid) return;
    status.textContent = "Saving…";
    try {
      const r = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text, tripId: tid }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Save failed");
      notes.unshift(data.entry);
      body.value = "";
      status.textContent = "Posted.";
      render();
      setTimeout(() => { status.textContent = ""; }, 1500);
    } catch (err) {
      status.textContent = err.message || "Could not post.";
    }
  });

  load();
})();
