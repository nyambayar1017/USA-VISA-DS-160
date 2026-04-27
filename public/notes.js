(function () {
  const form = document.getElementById("note-form");
  const tripSelect = document.getElementById("note-trip");
  const body = document.getElementById("note-body");
  const status = document.getElementById("note-status");
  const mentionPopover = document.getElementById("note-mention-popover");
  const list = document.getElementById("notes-list");
  const countNode = document.getElementById("notes-count");
  const filterText = document.getElementById("notes-filter-text");
  const filterTrip = document.getElementById("notes-filter-trip");
  const filterAuthor = document.getElementById("notes-filter-author");
  const filterMentionedMe = document.getElementById("notes-filter-mentioned-me");
  const pgnHost = document.getElementById("notes-pagination");
  if (!list) return;

  let trips = [];
  let teamMembers = [];
  let notes = [];
  let me = null;

  const pgn = window.Paginator
    ? new window.Paginator({ pageSize: 20, onChange: () => render() })
    : null;
  if (pgn && pgnHost) pgn.attach(pgnHost);

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function fmtDate(iso) {
    if (!iso) return "";
    try {
      const d = new Date(iso);
      return d.toLocaleString();
    } catch { return iso; }
  }

  // ── Mention picker ───────────────────────────────────────────────────
  // The textarea uses @[Full Name] notation. Typing "@" opens the popover
  // with team members; "@partial" filters by name.
  let activeMentionStart = -1;

  function openMentionPopover(query, top, left) {
    const filter = (query || "").toLowerCase();
    const matches = teamMembers
      .filter((m) => (m.fullName || m.email || "").toLowerCase().includes(filter))
      .slice(0, 10);
    if (!matches.length) {
      mentionPopover.hidden = true;
      return;
    }
    mentionPopover.innerHTML = matches
      .map((m) => `<button type="button" class="notes-mention-item" data-mention-name="${escapeHtml(m.fullName || m.email || "")}">${escapeHtml(m.fullName || m.email || "")}</button>`)
      .join("");
    mentionPopover.style.top = top + "px";
    mentionPopover.style.left = left + "px";
    mentionPopover.hidden = false;
  }

  function closeMentionPopover() {
    mentionPopover.hidden = true;
    activeMentionStart = -1;
  }

  body.addEventListener("input", () => {
    const value = body.value;
    const caret = body.selectionStart;
    // Find @-trigger at or before caret.
    let i = caret - 1;
    while (i >= 0 && /[A-Za-zА-Яа-яЁё0-9_À-ɏḀ-ỿ\s]/.test(value[i])) {
      i -= 1;
    }
    if (i >= 0 && value[i] === "@" && (i === 0 || /\s/.test(value[i - 1]))) {
      const query = value.slice(i + 1, caret);
      // Only show popover when query has no closing bracket already
      if (!/[\]\n]/.test(query)) {
        activeMentionStart = i;
        // Approximate caret position with offsetTop/Left of textarea + small offset
        const rect = body.getBoundingClientRect();
        const wrapRect = body.parentElement.getBoundingClientRect();
        const top = rect.bottom - wrapRect.top + 4;
        const left = 12;
        openMentionPopover(query, top, left);
        return;
      }
    }
    closeMentionPopover();
  });

  body.addEventListener("blur", () => {
    // Defer so a popover click registers first.
    setTimeout(closeMentionPopover, 150);
  });

  mentionPopover.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-mention-name]");
    if (!btn) return;
    const name = btn.dataset.mentionName;
    if (activeMentionStart < 0) return;
    const before = body.value.slice(0, activeMentionStart);
    const after = body.value.slice(body.selectionStart);
    const insert = `@[${name}] `;
    body.value = before + insert + after;
    const newCaret = (before + insert).length;
    body.focus();
    body.setSelectionRange(newCaret, newCaret);
    closeMentionPopover();
  });

  // ── Load data ────────────────────────────────────────────────────────
  async function loadAll() {
    try {
      const [tripsRes, teamRes, meRes] = await Promise.all([
        fetch("/api/camp-trips").then((r) => r.json()).catch(() => ({})),
        fetch("/api/team-members").then((r) => r.json()).catch(() => ({})),
        fetch("/api/auth/me").then((r) => r.json()).catch(() => ({})),
      ]);
      trips = tripsRes.entries || [];
      teamMembers = teamRes.entries || [];
      me = meRes.user || meRes;
      renderTripOptions();
      renderAuthorOptions();
      await loadNotes();
    } catch (err) {
      list.innerHTML = `<p class="empty">Could not load: ${escapeHtml(err.message || "unknown")}</p>`;
    }
  }

  async function loadNotes() {
    try {
      const r = await fetch("/api/notes");
      if (!r.ok) throw new Error("HTTP " + r.status);
      const data = await r.json();
      notes = data.entries || [];
      render();
    } catch (err) {
      list.innerHTML = `<p class="empty">Could not load notes: ${escapeHtml(err.message)}</p>`;
    }
  }

  function renderTripOptions() {
    const opts = '<option value="">— Not linked to a trip —</option>'
      + trips.slice().sort((a, b) => (a.serial || "").localeCompare(b.serial || ""))
        .map((t) => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.serial || "-")} · ${escapeHtml(t.tripName || "")}</option>`).join("");
    tripSelect.innerHTML = opts;
    filterTrip.innerHTML = '<option value="">All trips</option>' + trips.slice().sort((a, b) => (a.serial || "").localeCompare(b.serial || ""))
      .map((t) => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.serial || "-")} · ${escapeHtml(t.tripName || "")}</option>`).join("");
  }

  function renderAuthorOptions() {
    const authors = new Map();
    teamMembers.forEach((m) => authors.set(m.id, m.fullName || m.email || m.id));
    filterAuthor.innerHTML = '<option value="">All authors</option>' +
      Array.from(authors.entries()).map(([id, name]) => `<option value="${escapeHtml(id)}">${escapeHtml(name)}</option>`).join("");
  }

  // ── List + filter render ─────────────────────────────────────────────
  function getFiltered() {
    const q = (filterText.value || "").trim().toLowerCase();
    const trip = filterTrip.value;
    const author = filterAuthor.value;
    const onlyMine = filterMentionedMe.checked;
    const myId = me?.id || "";
    return notes.filter((n) => {
      if (q && !(n.body || "").toLowerCase().includes(q)) return false;
      if (trip && n.tripId !== trip) return false;
      if (author && (n.createdBy?.id || "") !== author) return false;
      if (onlyMine) {
        const mentioned = (n.mentions || []).some((m) => (m.id || "") === myId);
        if (!mentioned) return false;
      }
      return true;
    });
  }

  function bodyToHtml(text) {
    const escaped = escapeHtml(text);
    // Highlight @[Name] mentions.
    return escaped.replace(/@\[([^\]]+)\]/g, '<span class="notes-mention">@$1</span>');
  }

  function render() {
    const all = getFiltered();
    countNode.textContent = `${all.length} note${all.length === 1 ? "" : "s"}`;
    if (!all.length) {
      list.innerHTML = '<p class="empty">No notes yet. Write one above.</p>';
      if (pgnHost) pgnHost.innerHTML = "";
      return;
    }
    const rows = pgn ? pgn.slice(all) : all;
    const tripById = Object.fromEntries(trips.map((t) => [t.id, t]));
    list.innerHTML = rows.map((n) => {
      const trip = tripById[n.tripId];
      const tripChip = trip
        ? `<a class="notes-trip-chip" href="/trip-detail?tripId=${encodeURIComponent(trip.id)}">${escapeHtml(trip.serial || "")} · ${escapeHtml(trip.tripName || "")}</a>`
        : "";
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
      return `
        <article class="notes-item" data-note-id="${escapeHtml(n.id)}">
          <header class="notes-item-head">
            ${avatar}
            <div class="notes-item-meta">
              <strong>${escapeHtml(author)}</strong>
              <time>${escapeHtml(fmtDate(n.createdAt))}</time>
            </div>
            ${tripChip}
            ${menu}
          </header>
          <p class="notes-item-body">${bodyToHtml(n.body || "")}</p>
        </article>
      `;
    }).join("");
    if (pgnHost && pgn) pgnHost.innerHTML = pgn.controlsHtml();
  }

  // ── Wiring ──────────────────────────────────────────────────────────
  function rerender() { if (pgn) pgn.reset(); render(); }
  filterText.addEventListener("input", rerender);
  filterTrip.addEventListener("change", rerender);
  filterAuthor.addEventListener("change", rerender);
  filterMentionedMe.addEventListener("change", rerender);

  function closeRowMenu(target) {
    const det = target?.closest("details.row-menu");
    if (det) det.removeAttribute("open");
  }

  function startInlineEdit(noteId) {
    const article = list.querySelector(`[data-note-id="${CSS.escape(noteId)}"]`);
    if (!article) return;
    const note = notes.find((n) => n.id === noteId);
    if (!note) return;
    const bodyEl = article.querySelector(".notes-item-body");
    if (!bodyEl) return;
    if (article.querySelector(".notes-edit-form")) return; // already editing
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

  function buildBodyEl(text) {
    const p = document.createElement("p");
    p.className = "notes-item-body";
    p.innerHTML = bodyToHtml(text);
    return p;
  }

  list.addEventListener("click", async (e) => {
    const editBtn = e.target.closest("[data-note-edit]");
    if (editBtn) {
      e.preventDefault();
      closeRowMenu(editBtn);
      startInlineEdit(editBtn.dataset.noteEdit);
      return;
    }
    const del = e.target.closest("[data-note-delete]");
    if (!del) return;
    e.preventDefault();
    closeRowMenu(del);
    const ok = window.UI?.confirm
      ? await window.UI.confirm("Delete this note?", { dangerous: true })
      : window.confirm("Delete this note?");
    if (!ok) return;
    try {
      const r = await fetch("/api/notes/" + encodeURIComponent(del.dataset.noteDelete), { method: "DELETE" });
      if (!r.ok) throw new Error("Delete failed");
      notes = notes.filter((n) => n.id !== del.dataset.noteDelete);
      render();
    } catch (err) {
      if (window.UI?.toast) window.UI.toast(err.message || "Could not delete", "error");
      else alert(err.message || "Could not delete");
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = body.value.trim();
    if (!text) return;
    status.textContent = "Saving…";
    try {
      const r = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text, tripId: tripSelect.value || "" }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Save failed");
      notes.unshift(data.entry);
      body.value = "";
      tripSelect.value = "";
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

  loadAll();
})();
