// Trip-scoped notes panel on /trip-detail.
// Uses the same /api/notes endpoint, scoped to the current tripId.
(function () {
  const form = document.getElementById("trip-note-form");
  const body = document.getElementById("trip-note-body");
  const status = document.getElementById("trip-note-status");
  const mentionPopover = document.getElementById("trip-note-mention-popover");
  const list = document.getElementById("trip-notes-list");
  const fab = document.getElementById("trip-notes-fab");
  const fabCount = document.getElementById("trip-notes-fab-count");
  const drawer = document.getElementById("trip-notes-drawer");
  const drawerClose = document.getElementById("trip-notes-drawer-close");
  const backdrop = document.getElementById("trip-notes-backdrop");
  if (!form || !list || !drawer || !fab) return;

  function openDrawer() {
    drawer.classList.add("is-open");
    drawer.setAttribute("aria-hidden", "false");
    if (backdrop) backdrop.hidden = false;
    document.body.classList.add("trip-notes-drawer-open");
  }
  function closeDrawer() {
    drawer.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
    if (backdrop) backdrop.hidden = true;
    document.body.classList.remove("trip-notes-drawer-open");
  }
  fab.addEventListener("click", () => {
    if (drawer.classList.contains("is-open")) closeDrawer();
    else openDrawer();
  });

  // Relocate NOTE button into the trip-summary actions row, next to Edit.
  // The actions div is rendered by camp.js once trip data loads, so watch
  // for it via MutationObserver and move the button when it appears.
  function tryAttachFab() {
    const actions = document.querySelector("#active-trip .trip-summary-actions");
    if (!actions) return false;
    if (actions.contains(fab)) return true;
    actions.insertBefore(fab, actions.firstChild);
    fab.hidden = false;
    return true;
  }
  if (!tryAttachFab()) {
    const activeTrip = document.getElementById("active-trip");
    if (activeTrip) {
      const obs = new MutationObserver(() => { if (tryAttachFab()) obs.disconnect(); });
      obs.observe(activeTrip, { childList: true, subtree: true });
    }
  }
  drawerClose?.addEventListener("click", closeDrawer);
  backdrop?.addEventListener("click", closeDrawer);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && drawer.classList.contains("is-open")) closeDrawer();
  });

  function updateBadge() {
    if (!fabCount) return;
    const n = notes.filter((x) => !x.parentId).length;
    if (!n) {
      fabCount.hidden = true;
      fabCount.textContent = "0";
    } else {
      fabCount.hidden = false;
      fabCount.textContent = n > 99 ? "99+" : String(n);
    }
  }

  function tripId() {
    return new URLSearchParams(window.location.search).get("tripId") || "";
  }

  let teamMembers = [];
  let notes = [];
  let me = null;

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function fmt(iso) { try { return new Date(iso).toLocaleString(); } catch { return iso || ""; } }
  function bodyToHtml(t) {
    return escapeHtml(t).replace(/@\[([^\]]+)\]/g, '<span class="notes-mention">@$1</span>');
  }

  // Mention picker — Up/Down navigates, Enter/Tab inserts, Esc dismisses.
  let mentionStart = -1;
  let mentionActiveIdx = 0;

  function setMentionActive(next) {
    const items = mentionPopover.querySelectorAll(".notes-mention-item");
    if (!items.length) return;
    mentionActiveIdx = (next + items.length) % items.length;
    items.forEach((el, i) => el.classList.toggle("is-active", i === mentionActiveIdx));
    items[mentionActiveIdx]?.scrollIntoView({ block: "nearest" });
  }

  function insertMentionAtActive() {
    const items = mentionPopover.querySelectorAll(".notes-mention-item");
    const btn = items[mentionActiveIdx];
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
    mentionActiveIdx = 0;
  }

  body.addEventListener("keydown", (e) => {
    if (mentionPopover.hidden) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setMentionActive(mentionActiveIdx + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setMentionActive(mentionActiveIdx - 1); }
    else if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); insertMentionAtActive(); }
    else if (e.key === "Escape") { e.preventDefault(); mentionPopover.hidden = true; mentionStart = -1; }
  });

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
        mentionPopover.innerHTML = matches.map((m, idx) =>
          `<button type="button" class="notes-mention-item${idx === 0 ? " is-active" : ""}" data-name="${escapeHtml(m.fullName || m.email)}">${escapeHtml(m.fullName || m.email)}</button>`
        ).join("");
        mentionActiveIdx = 0;
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
      const [teamRes, notesRes, meRes] = await Promise.all([
        fetch("/api/team-members").then((r) => r.json()).catch(() => ({})),
        fetch(`/api/notes?tripId=${encodeURIComponent(tid)}`).then((r) => r.json()).catch(() => ({})),
        fetch("/api/auth/me").then((r) => r.json()).catch(() => ({})),
      ]);
      teamMembers = teamRes.entries || [];
      notes = notesRes.entries || [];
      me = meRes.user || meRes;
      render();
    } catch {}
  }

  function renderNoteArticle(n, opts = {}) {
    const isReply = !!opts.isReply;
    const author = n.createdBy?.name || n.createdBy?.email || "—";
    const avatar = n.createdByAvatar
      ? `<img src="${escapeHtml(n.createdByAvatar)}" alt="" class="notes-avatar">`
      : `<span class="notes-avatar notes-avatar-fallback">${escapeHtml((author[0] || "?").toUpperCase())}</span>`;
    const isAdmin = (me?.role || "").toLowerCase() === "admin";
    const canEdit = isAdmin || (me?.id && n.createdBy?.id === me.id);
    const menu = canEdit ? `
      <details class="row-menu notes-item-menu">
        <summary class="row-menu-trigger" aria-label="Actions">⋯</summary>
        <div class="row-menu-popover">
          <button type="button" class="row-menu-item" data-note-edit="${escapeHtml(n.id)}">Edit</button>
          <button type="button" class="row-menu-item is-danger" data-note-delete="${escapeHtml(n.id)}">Delete</button>
        </div>
      </details>` : "";
    const replyBtn = isReply ? "" : `<button type="button" class="notes-reply-trigger" data-note-reply="${escapeHtml(n.id)}">Reply</button>`;
    const replies = isReply ? "" : (notesByParent.get(n.id) || [])
      .map((r) => renderNoteArticle(r, { isReply: true })).join("");
    const repliesBlock = isReply ? "" : `
      <div class="notes-replies" data-replies-for="${escapeHtml(n.id)}">${replies}</div>
      <div class="notes-reply-form-host" data-reply-host="${escapeHtml(n.id)}"></div>`;
    return `
      <article class="notes-item${isReply ? " notes-item--reply" : ""}" data-note-id="${escapeHtml(n.id)}">
        <header class="notes-item-head">
          ${avatar}
          <div class="notes-item-meta">
            <strong>${escapeHtml(author)}</strong>
            <time>${escapeHtml(fmt(n.createdAt))}</time>
          </div>
          ${replyBtn}
          ${menu}
        </header>
        <p class="notes-item-body">${bodyToHtml(n.body || "")}</p>
        ${repliesBlock}
      </article>
    `;
  }

  let notesByParent = new Map();

  function indexReplies() {
    notesByParent = new Map();
    for (const n of notes) {
      const pid = n.parentId || "";
      if (!pid) continue;
      if (!notesByParent.has(pid)) notesByParent.set(pid, []);
      notesByParent.get(pid).push(n);
    }
    // Sort replies oldest → newest so the thread reads top-down like a chat.
    for (const arr of notesByParent.values()) {
      arr.sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")));
    }
  }

  function render() {
    updateBadge();
    indexReplies();
    const topLevel = notes.filter((n) => !n.parentId);
    if (!topLevel.length) {
      list.innerHTML = '<p class="empty">No notes for this trip yet.</p>';
      return;
    }
    list.innerHTML = topLevel.map((n) => renderNoteArticle(n)).join("");
  }

  function closeRowMenu(target) {
    const det = target?.closest("details.row-menu");
    if (det) det.removeAttribute("open");
  }

  function buildBodyEl(text) {
    const p = document.createElement("p");
    p.className = "notes-item-body";
    p.innerHTML = bodyToHtml(text);
    return p;
  }

  function startInlineEdit(noteId) {
    const article = list.querySelector(`[data-note-id="${CSS.escape(noteId)}"]`);
    if (!article) return;
    const note = notes.find((n) => n.id === noteId);
    if (!note) return;
    const bodyEl = article.querySelector(".notes-item-body");
    if (!bodyEl || article.querySelector(".notes-edit-form")) return;
    const editor = document.createElement("form");
    editor.className = "notes-edit-form";
    editor.innerHTML = `
      <textarea class="notes-edit-textarea">${escapeHtml(note.body || "")}</textarea>
      <div class="notes-edit-actions">
        <button type="button" class="notes-edit-cancel">Cancel</button>
        <button type="submit" class="notes-edit-save">Save</button>
      </div>
    `;
    bodyEl.replaceWith(editor);
    const ta = editor.querySelector("textarea");
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
    editor.querySelector(".notes-edit-cancel").addEventListener("click", () => {
      editor.replaceWith(buildBodyEl(note.body || ""));
    });
    editor.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const text = ta.value.trim();
      if (!text) return;
      try {
        const r = await fetch("/api/notes/" + encodeURIComponent(noteId), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: text }),
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Save failed");
        const idx = notes.findIndex((n) => n.id === noteId);
        if (idx >= 0) notes[idx] = data.entry;
        render();
      } catch (err) {
        if (window.UI?.toast) window.UI.toast(err.message || "Could not save", "error");
        else alert(err.message || "Could not save");
      }
    });
  }

  function openReplyForm(parentId) {
    const host = list.querySelector(`[data-reply-host="${CSS.escape(parentId)}"]`);
    if (!host || host.querySelector(".notes-reply-form")) return;
    const formEl = document.createElement("form");
    formEl.className = "notes-reply-form";
    formEl.innerHTML = `
      <textarea class="notes-reply-textarea" placeholder="Reply…" rows="2"></textarea>
      <div class="notes-edit-actions">
        <button type="button" class="notes-edit-cancel">Cancel</button>
        <button type="submit" class="notes-edit-save">Send</button>
      </div>
    `;
    host.appendChild(formEl);
    const ta = formEl.querySelector("textarea");
    ta.focus();
    formEl.querySelector(".notes-edit-cancel").addEventListener("click", () => formEl.remove());
    formEl.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const text = ta.value.trim();
      if (!text) return;
      try {
        const r = await fetch("/api/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: text, parentId, tripId: tripId() }),
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Send failed");
        notes.push(data.entry);
        render();
      } catch (err) {
        if (window.UI?.toast) window.UI.toast(err.message || "Could not send", "error");
        else alert(err.message || "Could not send");
      }
    });
  }

  list.addEventListener("click", async (e) => {
    const editBtn = e.target.closest("[data-note-edit]");
    if (editBtn) {
      e.preventDefault();
      closeRowMenu(editBtn);
      startInlineEdit(editBtn.dataset.noteEdit);
      return;
    }
    const replyBtn = e.target.closest("[data-note-reply]");
    if (replyBtn) {
      e.preventDefault();
      openReplyForm(replyBtn.dataset.noteReply);
      return;
    }
    const delBtn = e.target.closest("[data-note-delete]");
    if (!delBtn) return;
    e.preventDefault();
    closeRowMenu(delBtn);
    const ok = window.UI?.confirm
      ? await window.UI.confirm("Delete this note?", { dangerous: true })
      : window.confirm("Delete this note?");
    if (!ok) return;
    try {
      const r = await fetch("/api/notes/" + encodeURIComponent(delBtn.dataset.noteDelete), { method: "DELETE" });
      if (!r.ok) throw new Error("Delete failed");
      notes = notes.filter((n) => n.id !== delBtn.dataset.noteDelete);
      render();
    } catch (err) {
      if (window.UI?.toast) window.UI.toast(err.message || "Could not delete", "error");
      else alert(err.message || "Could not delete");
    }
  });

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

  document.addEventListener("click", (e) => {
    list.querySelectorAll("details.row-menu[open]").forEach((det) => {
      if (!det.contains(e.target)) det.removeAttribute("open");
    });
  });

  // The trip-notes drawer is `transform`-animated, which turns it into the
  // containing block for any `position: fixed` descendant. Computing viewport
  // coords in JS sends the popover off-screen. Pin via CSS (position:absolute
  // relative to the <details>) instead — see .trip-notes-drawer .row-menu-popover
  // in styles.css.

  load();
})();
