// Content library: reusable attractions / hotels / activities / etc.
// Linked from trip programs by slug. Photos are referenced by gallery
// image ID — uploads happen on the Gallery page and IDs are pasted here.

(function () {
  const list = document.getElementById("ct-list");
  const count = document.getElementById("ct-count");
  const searchInput = document.getElementById("ct-search");
  const typeFilter = document.getElementById("ct-type");
  const countryFilter = document.getElementById("ct-country");
  const publishFilter = document.getElementById("ct-publish");
  const addBtn = document.getElementById("ct-add-btn");
  const modal = document.getElementById("ct-modal");
  const form = document.getElementById("ct-form");
  const statusNode = document.getElementById("ct-status");
  const deleteBtn = document.getElementById("ct-delete-btn");
  const groupsNode = document.getElementById("ct-groups");
  const imageIdsInput = document.getElementById("ct-image-ids");
  const imagePreview = document.getElementById("ct-image-preview");
  const pickImagesBtn = document.getElementById("ct-pick-images-btn");
  const viewLink = document.getElementById("ct-view-link");

  // Keep the View link's href in sync with the slug field, but only enable
  // it once the item has been saved (otherwise /c/<slug> 404s).
  function setViewLink(slug, enabled) {
    if (!viewLink) return;
    viewLink.href = slug ? `/c/${encodeURIComponent(slug)}` : "#";
    viewLink.classList.toggle("is-disabled", !enabled || !slug);
    viewLink.setAttribute("aria-disabled", (!enabled || !slug) ? "true" : "false");
  }
  const modalTitle = document.getElementById("ct-modal-title");
  const langBar = document.getElementById("ct-lang-bar");
  const rtEditor = document.getElementById("ct-rt-editor");
  const rtToolbar = document.getElementById("ct-rt-toolbar");
  const translateAllBtn = document.getElementById("ct-translate-all");
  const translateStatus = document.getElementById("ct-translate-status");
  const translatePickNode = document.getElementById("ct-translate-pick");

  // Per-user selection of which languages to auto-translate. Default
  // reflects the user's actual preference: English-derived European
  // languages (fr/it/es) translate well; Mongolian they author by
  // hand; CJK + Russian go untranslated unless the user opts in.
  const TRANSLATE_PICK_KEY = "ct_translate_pick";
  const DEFAULT_PICK = ["fr", "it", "es"];
  function readTranslatePick() {
    try {
      const raw = localStorage.getItem(TRANSLATE_PICK_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return DEFAULT_PICK.slice();
  }
  function writeTranslatePick(codes) {
    try { localStorage.setItem(TRANSLATE_PICK_KEY, JSON.stringify(codes)); } catch {}
  }

  // Languages mirror gallery.js ALT_LANGS so a content entry's
  // translations match the alt-text language set on its photos.
  const LANGS = [
    { code: "en", label: "English" },
    { code: "mn", label: "Монгол" },
    { code: "fr", label: "Français" },
    { code: "it", label: "Italiano" },
    { code: "es", label: "Español" },
    { code: "ko", label: "한국어" },
    { code: "zh", label: "中文" },
    { code: "ja", label: "日本語" },
    { code: "ru", label: "Русский" },
  ];

  // In-memory map of all 9 language versions for the current edit
  // session. activeLang controls which one the form inputs are bound
  // to right now.
  const i18n = { title: {}, summary: {} };
  let activeLang = "en";

  const state = { entries: [], editingId: "" };

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function setStatus(message, tone) {
    if (!statusNode) return;
    statusNode.textContent = message || "";
    statusNode.dataset.tone = tone || "";
  }

  // ── Translation + rich text plumbing ───────────────────────────────
  function renderLangBar() {
    if (!langBar) return;
    langBar.innerHTML = LANGS.map((l) => {
      const filled = (i18n.title[l.code] || "").trim() || (i18n.summary[l.code] || "").trim();
      const cls = `ct-lang-tab${l.code === activeLang ? " is-active" : ""} ${filled ? "is-filled" : "is-empty"}`;
      return `<button type="button" class="${cls}" data-lang="${l.code}">${escapeHtml(l.label)}</button>`;
    }).join("");
    document.querySelectorAll("[data-active-lang-label]").forEach((el) => {
      const label = (LANGS.find((l) => l.code === activeLang) || {}).label || "";
      el.textContent = `(${label})`;
    });
  }

  // Per-language auto-translate checkboxes. English is excluded — it's
  // the source. Saved selection lives in localStorage; defaults are the
  // languages where machine translation is reliable (fr/it/es).
  function renderTranslatePick() {
    if (!translatePickNode) return;
    const picked = new Set(readTranslatePick());
    translatePickNode.innerHTML = LANGS
      .filter((l) => l.code !== "en")
      .map((l) => `
        <label class="ct-translate-pick-item">
          <input type="checkbox" data-translate-pick="${l.code}" ${picked.has(l.code) ? "checked" : ""} />
          <span>${escapeHtml(l.label)}</span>
        </label>
      `).join("");
  }
  translatePickNode?.addEventListener("change", (e) => {
    const cb = e.target.closest('[data-translate-pick]');
    if (!cb) return;
    const codes = Array.from(translatePickNode.querySelectorAll('[data-translate-pick]:checked'))
      .map((n) => n.dataset.translatePick);
    writeTranslatePick(codes);
  });

  // Persist whatever the user has typed in the form for the currently
  // active language, then swap inputs to show the next language.
  function captureActive() {
    i18n.title[activeLang] = (form.elements.title.value || "").trim();
    i18n.summary[activeLang] = rtEditor ? rtEditor.innerHTML.trim() : "";
  }
  function loadActive() {
    form.elements.title.value = i18n.title[activeLang] || "";
    if (rtEditor) rtEditor.innerHTML = i18n.summary[activeLang] || "";
  }
  function switchLang(code) {
    if (code === activeLang) return;
    captureActive();
    activeLang = code;
    loadActive();
    renderLangBar();
  }
  langBar?.addEventListener("click", (e) => {
    const btn = e.target.closest(".ct-lang-tab");
    if (btn) switchLang(btn.dataset.lang);
  });

  // Rich text editor: thin wrapper over execCommand. Keeps storage as
  // HTML so the public popup renders the same markup the manager sees.
  rtToolbar?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-rt-cmd]");
    if (!btn) return;
    e.preventDefault();
    rtEditor.focus();
    const cmd = btn.dataset.rtCmd;
    let arg = btn.dataset.rtArg || null;
    if (cmd === "createLink") {
      const url = window.prompt("Enter URL (https://…)");
      if (!url) return;
      arg = url;
    }
    document.execCommand(cmd, false, arg);
  });

  // Server-side translation via /api/translate, which uses the
  // Anthropic API (Claude). Quality is dramatically better than the
  // old MyMemory fallback, and there's no 500-char limit, so full
  // descriptions go through in one call. The html flag tells the
  // server to preserve <p>/<h2>/<ul>/etc. so headings + lists
  // survive into every language version.
  async function translateText(text, targetLang, isHtml) {
    if (!text || targetLang === "en") return text;
    const res = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, from: "en", to: targetLang, html: !!isHtml }),
    });
    // The proxy can return an HTML error page (Render 502 / 504) when
    // a request runs too long. Parsing that as JSON throws "Unexpected
    // token '<'..." — read text once and decide based on content-type.
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Translation failed (${res.status})`);
      return data.text || "";
    }
    const body = await res.text();
    if (res.status === 502 || res.status === 504 || /timeout/i.test(body)) {
      throw new Error("Server timed out — try fewer languages at once or shorter sections.");
    }
    throw new Error(`Translation failed (${res.status})`);
  }

  // Throttle concurrent requests so the WSGI server isn't slammed
  // with 16 long-running Anthropic calls at once (which causes the
  // proxy to time out and return HTML instead of JSON). 4 in flight
  // is roughly the sweet spot — fast enough that wall time is ≈ 2x
  // a single call, slow enough that the server keeps up.
  async function poolMap(items, limit, fn) {
    const results = new Array(items.length);
    let cursor = 0;
    async function worker() {
      while (true) {
        const i = cursor++;
        if (i >= items.length) return;
        try { results[i] = await fn(items[i], i); }
        catch (err) { results[i] = { __error: err }; }
      }
    }
    const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
    await Promise.all(workers);
    return results;
  }

  // Translate the English title + summary into every other language
  // that's currently empty. Fills the in-memory map and re-renders the
  // tabs. Skips any language the user already filled in by hand.
  translateAllBtn?.addEventListener("click", async () => {
    captureActive();
    const sourceTitle = (i18n.title.en || "").trim();
    const sourceSummary = (i18n.summary.en || "").trim();
    if (!sourceTitle && !sourceSummary) {
      translateStatus.textContent = "Write the English title + description first.";
      translateStatus.style.color = "#b91c1c";
      return;
    }
    translateAllBtn.disabled = true;
    translateStatus.textContent = "Translating…";
    translateStatus.style.color = "#5d6b87";
    // Treat MyMemory's known error strings as empty so the next
    // pass overwrites them — they got stored as actual translations
    // before the Claude switchover.
    const isJunk = (s) => /QUERY LENGTH LIMIT EXCEEDED|MAX ALLOWED QUERY|YOU USED ALL AVAILABLE FREE TRANSLATIONS/i.test(s || "");
    LANGS.forEach((l) => {
      if (l.code === "en") return;
      if (isJunk(i18n.title[l.code]))   i18n.title[l.code]   = "";
      if (isJunk(i18n.summary[l.code])) i18n.summary[l.code] = "";
    });
    // Title is short (~50 chars × 8 ≈ 800 chars output) so the batch
    // call is well under the proxy timeout. Description is long, and
    // 8 languages × full HTML body = 30K+ output chars which exceeds
    // Render's ~120s idle limit on a single response. So we batch
    // titles in one call but translate descriptions ONE LANGUAGE AT
    // A TIME — each per-language request is short (~15-25s) and the
    // proxy never has reason to drop the connection.
    // Only translate languages the user has ticked in the picker —
    // they can manually fill the rest (Mongolian native authoring,
    // CJK/Russian where machine translation is unreliable, etc.).
    const picked = new Set(readTranslatePick());
    if (!picked.size) {
      translateAllBtn.disabled = false;
      translateStatus.textContent = "Pick at least one language to translate to.";
      translateStatus.style.color = "#b91c1c";
      return;
    }
    const titleTargets = LANGS.filter((l) => l.code !== "en" && picked.has(l.code) && !(i18n.title[l.code] || "").trim()).map((l) => l.code);
    const summaryTargets = LANGS.filter((l) => l.code !== "en" && picked.has(l.code) && !(i18n.summary[l.code] || "").trim()).map((l) => l.code);
    if (!titleTargets.length && !summaryTargets.length) {
      translateAllBtn.disabled = false;
      translateStatus.textContent = "Selected languages are already filled.";
      translateStatus.style.color = "#16a34a";
      return;
    }
    async function callBatch(text, html, targets) {
      if (!text || !targets.length) return {};
      const res = await fetch("/api/translate-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, from: "en", html, targets }),
      });
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("application/json")) {
        if (res.status === 502 || res.status === 504) throw new Error("Server timed out — try shorter sections.");
        throw new Error(`Translation failed (${res.status})`);
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Translation failed (${res.status})`);
      return data.translations || {};
    }
    const totalSteps = (sourceTitle && titleTargets.length ? 1 : 0) + (summaryTargets.length || 0);
    let step = 0;
    let firstError = "";
    let succeeded = 0;
    try {
      // 1) All titles in one batch.
      if (sourceTitle && titleTargets.length) {
        step += 1;
        translateStatus.textContent = `Translating titles (${step}/${totalSteps})…`;
        const out = await callBatch(sourceTitle, false, titleTargets);
        Object.entries(out).forEach(([code, val]) => {
          if (val && !(i18n.title[code] || "").trim()) i18n.title[code] = val;
        });
        renderLangBar();
        succeeded += 1;
      }
      // 2) Description: one language at a time. Each call is short, so
      // the proxy never times out. Wall time is ~2-3 min for 8 langs.
      if (sourceSummary && summaryTargets.length) {
        for (const code of summaryTargets) {
          step += 1;
          const langLabel = (LANGS.find((l) => l.code === code) || {}).label || code;
          translateStatus.textContent = `Translating description → ${langLabel} (${step}/${totalSteps})…`;
          try {
            const t = await translateText(sourceSummary, code, true);
            if (t) i18n.summary[code] = t;
            renderLangBar();
            succeeded += 1;
          } catch (err) {
            // One language failing shouldn't kill the whole run.
            if (!firstError) firstError = err?.message || String(err);
          }
        }
      }
    } catch (err) {
      if (!firstError) firstError = err?.message || String(err);
    }
    translateAllBtn.disabled = false;
    if (firstError && succeeded === 0) {
      translateStatus.textContent = "Translation failed: " + firstError;
      translateStatus.style.color = "#b91c1c";
    } else if (firstError) {
      translateStatus.textContent = `✓ Done with errors — ${firstError}`;
      translateStatus.style.color = "#b91c1c";
    } else {
      const filledCount = Math.max(titleTargets.length, summaryTargets.length);
      translateStatus.textContent = `✓ All ${filledCount} language${filledCount === 1 ? "" : "s"} translated. Switch tabs to review.`;
      translateStatus.style.color = "#16a34a";
    }
    renderLangBar();
    loadActive();
  });

  // ── List ─────────────────────────────────────────────────────────
  function render() {
    if (!state.entries.length) {
      list.innerHTML = `<p class="empty">No content yet. Click "+ Add content" to create your first item.</p>`;
      count.textContent = "0 items";
      return;
    }
    count.textContent = `${state.entries.length} item${state.entries.length === 1 ? "" : "s"}`;
    list.innerHTML = `
      <div class="invoices-table-wrap">
        <table class="invoices-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Title</th>
              <th>Type</th>
              <th>Country</th>
              <th>Photos</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${state.entries.map((e, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td>
                  <strong>${escapeHtml(e.title)}</strong>
                  <div class="muted" style="font-size:11px;"><code>${escapeHtml(e.slug)}</code></div>
                </td>
                <td>${escapeHtml(e.type)}</td>
                <td>${escapeHtml(e.country || "-")}</td>
                <td>${(e.imageIds || []).length}</td>
                <td>
                  ${e.publishStatus === "published"
                    ? `<span class="ct-pill ct-pill-pub">Published</span>`
                    : `<span class="ct-pill ct-pill-draft">Draft</span>`}
                </td>
                <td>
                  <details class="row-menu">
                    <summary class="row-menu-trigger" aria-label="Actions">⋯</summary>
                    <div class="row-menu-popover">
                      <button type="button" class="row-menu-item" data-action="edit" data-id="${escapeHtml(e.id)}">Edit</button>
                      <button type="button" class="row-menu-item is-danger" data-action="delete" data-id="${escapeHtml(e.id)}" data-title="${escapeHtml(e.title)}">Delete</button>
                    </div>
                  </details>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  async function load() {
    list.innerHTML = `<p class="empty">Loading…</p>`;
    try {
      const params = new URLSearchParams();
      if (searchInput.value.trim()) params.set("q", searchInput.value.trim());
      if (typeFilter.value) params.set("type", typeFilter.value);
      if (countryFilter.value.trim()) params.set("country", countryFilter.value.trim());
      if (publishFilter.value) params.set("publish", publishFilter.value);
      const res = await fetch(`/api/content?${params.toString()}`);
      const data = await res.json();
      state.entries = data.entries || [];
      render();
    } catch (err) {
      list.innerHTML = `<p class="empty">${escapeHtml(err.message || "Could not load.")}</p>`;
    }
  }

  // ── Modal open/close + bullet groups + image preview ─────────────
  function openModal(rec) {
    state.editingId = rec ? rec.id : "";
    modalTitle.textContent = rec ? "Edit content" : "Add content";
    form.elements.id.value = state.editingId;
    form.elements.title.value = rec ? rec.title || "" : "";
    form.elements.slug.value = rec ? rec.slug || "" : "";
    // After load, treat the existing slug as "auto" so a follow-up
    // title edit still updates it. If the user manually retypes the
    // slug, it diverges from lastAutoSlug and stays sticky.
    lastAutoSlug = rec ? rec.slug || "" : "";
    form.elements.type.value = rec ? rec.type || "attraction" : "attraction";
    form.elements.country.value = rec ? rec.country || "" : "";
    // Notify the country picker so its trigger label updates
    // when the modal opens with an existing record.
    form.elements.country.dispatchEvent(new Event("country-picker:set"));
    form.elements.publishStatus.value = rec ? rec.publishStatus || "published" : "published";
    form.elements.videoUrl.value = rec ? rec.videoUrl || "" : "";
    // Reset the optional uploaded-video file picker each time the
    // modal opens. If the record already has an uploaded videoFile,
    // surface its filename + a Remove button so the manager can swap
    // or clear it.
    const videoFileInput = document.getElementById("ct-video-file");
    const videoCurrent = document.getElementById("ct-video-current");
    if (videoFileInput) videoFileInput.value = "";
    if (videoCurrent) {
      const vf = rec && rec.videoFile;
      videoCurrent.innerHTML = vf
        ? `<span class="ct-video-current-row">📹 <a href="/content-videos/${escapeHtml(vf)}" target="_blank" rel="noopener">${escapeHtml(vf)}</a> <button type="button" class="ct-video-remove" data-action="remove-video">Remove</button></span>`
        : "";
    }
    form.elements.location.value = rec ? rec.location || "" : "";
    // Seed the per-language map. The record's source title/summary
    // become the English version; rec.translations holds the rest.
    // Legacy records that authored in Mongolian get their text
    // exposed under whichever lang slot they originally lived in.
    LANGS.forEach((l) => { i18n.title[l.code] = ""; i18n.summary[l.code] = ""; });
    if (rec) {
      i18n.title.en = rec.title || "";
      i18n.summary.en = rec.summary || "";
      const tr = rec.translations || {};
      LANGS.forEach((l) => {
        if (l.code === "en") return;
        if (tr[l.code]) {
          i18n.title[l.code] = tr[l.code].title || "";
          i18n.summary[l.code] = tr[l.code].summary || "";
        }
      });
    }
    // Default tab = workspace's primary language. DTX is a Mongolian
    // outbound brand → default to Mongolian. USM (Unlock Steppe
    // Mongolia) targets foreigners → default to English. The user
    // can still switch tabs.
    const ws = (typeof window.readWorkspace === "function" ? window.readWorkspace() : "") || "";
    activeLang = (ws === "DTX") ? "mn" : "en";
    renderLangBar();
    renderTranslatePick();
    loadActive();
    if (translateStatus) translateStatus.textContent = "";
    renderGroups((rec && rec.bulletGroups) || []);
    setImageIds((rec && rec.imageIds) || []);
    deleteBtn.hidden = !state.editingId;
    setViewLink(rec ? rec.slug : "", !!state.editingId);
    setStatus("");
    modal.classList.remove("is-hidden");
    modal.removeAttribute("hidden");
    document.body.classList.add("modal-open");
  }

  function closeModal() {
    modal.classList.add("is-hidden");
    modal.setAttribute("hidden", "");
    document.body.classList.remove("modal-open");
    state.editingId = "";
  }

  modal.addEventListener("click", (event) => {
    if (event.target.dataset.action === "close-modal") closeModal();
  });

  // Auto-generate slug from the title — only when slug is empty or
  // still equal to the previous auto-generated value, so a manually
  // edited slug is preserved.
  function slugify(text) {
    return String(text || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 80);
  }
  let lastAutoSlug = "";
  form.elements.title.addEventListener("input", () => {
    const slugInput = form.elements.slug;
    if (!slugInput.value || slugInput.value === lastAutoSlug) {
      const next = slugify(form.elements.title.value);
      slugInput.value = next;
      lastAutoSlug = next;
    }
  });

  // Feed existing-entry countries into the searchable popup as
  // additional options. The picker reads dataset.options on each
  // open (no re-attach needed), so we just update the JSON and the
  // next click sees the fresh list.
  function refreshCountryOptions() {
    const extra = Array.from(new Set(
      (state.entries || []).map((e) => (e.country || "").trim()).filter(Boolean)
    ));
    const input = form?.elements?.country;
    if (input) input.dataset.options = JSON.stringify(extra);
  }
  // Initial attach happens on first load (before the modal opens).
  document.addEventListener("DOMContentLoaded", () => {
    window.CountryPicker?.attachAll(document);
  });
  if (document.readyState !== "loading") {
    window.CountryPicker?.attachAll(document);
  }

  addBtn.addEventListener("click", () => { refreshCountryOptions(); openModal(null); });
  list.addEventListener("click", async (event) => {
    // Close any open row-menu <details> as soon as the user picks an
    // action — otherwise the popover sticks around floating over the
    // page after the modal opens.
    const actionBtn = event.target.closest('[data-action]');
    if (actionBtn) {
      const det = actionBtn.closest("details.row-menu");
      if (det) det.removeAttribute("open");
    }
    const editBtn = event.target.closest('[data-action="edit"]');
    if (editBtn) {
      const id = editBtn.dataset.id;
      try {
        const res = await fetch(`/api/content/${encodeURIComponent(id)}`);
        const rec = await res.json();
        if (!res.ok) throw new Error(rec.error || "Could not load");
        refreshCountryOptions();
        openModal(rec);
      } catch (err) {
        alert(err.message || "Could not load");
      }
      return;
    }
    const deleteBtn = event.target.closest('[data-action="delete"]');
    if (deleteBtn) {
      const id = deleteBtn.dataset.id;
      const title = deleteBtn.dataset.title || "this content";
      const ok = window.UI?.confirm
        ? await window.UI.confirm(`Delete "${title}"? This removes the popup and unlinks it from any trip programs that referenced its slug.`, { dangerous: true })
        : window.confirm(`Delete "${title}"?`);
      if (!ok) return;
      try {
        const res = await fetch(`/api/content/${encodeURIComponent(id)}`, { method: "DELETE" });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Could not delete");
        }
        await load();
      } catch (err) {
        alert(err.message || "Could not delete");
      }
    }
  });

  function renderGroups(groups) {
    groupsNode.innerHTML = (groups || [])
      .map((g, gi) => `
        <div class="ct-group" data-gi="${gi}">
          <div class="ct-group-head">
            <input type="text" class="ct-group-heading" placeholder="Heading e.g. Ерөнхий мэдээлэл" value="${escapeHtml(g.heading || "")}" />
            <button type="button" class="ct-group-delete" data-action="delete-group" data-gi="${gi}">✕</button>
          </div>
          <div class="ct-group-items" data-gi="${gi}">
            ${(g.items || []).map((item, ii) => `
              <div class="ct-item-row">
                <input type="text" class="ct-item" placeholder="Bullet text" value="${escapeHtml(item)}" />
                <button type="button" class="ct-item-delete" data-action="delete-item" data-gi="${gi}" data-ii="${ii}">✕</button>
              </div>
            `).join("")}
          </div>
          <button type="button" class="ct-add-item-btn" data-action="add-item" data-gi="${gi}">+ Add bullet</button>
        </div>
      `)
      .join("");
  }

  function readGroups() {
    return Array.from(groupsNode.querySelectorAll(".ct-group")).map((groupEl) => ({
      heading: groupEl.querySelector(".ct-group-heading")?.value || "",
      items: Array.from(groupEl.querySelectorAll(".ct-item")).map((i) => i.value).filter((s) => s.trim()),
    }));
  }

  groupsNode.addEventListener("click", (event) => {
    const target = event.target.closest("[data-action]");
    if (!target) return;
    const groups = readGroups();
    const gi = Number(target.dataset.gi);
    if (target.dataset.action === "delete-group") {
      groups.splice(gi, 1);
      renderGroups(groups);
    } else if (target.dataset.action === "add-item") {
      groups[gi].items = (groups[gi].items || []).concat([""]);
      renderGroups(groups);
    } else if (target.dataset.action === "delete-item") {
      const ii = Number(target.dataset.ii);
      groups[gi].items.splice(ii, 1);
      renderGroups(groups);
    }
  });

  form.addEventListener("click", (event) => {
    if (event.target.dataset.action === "add-group") {
      const groups = readGroups();
      groups.push({ heading: "", items: [""] });
      renderGroups(groups);
    }
  });

  function getImageIds() {
    return (imageIdsInput.value || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function setImageIds(ids) {
    const cleaned = (ids || []).filter(Boolean);
    imageIdsInput.value = cleaned.join(",");
    refreshImagePreview();
  }

  function refreshImagePreview() {
    const ids = getImageIds();
    if (!ids.length) {
      imagePreview.innerHTML = `<p class="ct-hint">No photos yet. Click "+ Add photos from gallery".</p>`;
      return;
    }
    imagePreview.innerHTML = ids
      .map((id) => `
        <div class="ct-image-thumb" title="${escapeHtml(id)}">
          <img src="/api/gallery/${encodeURIComponent(id)}/file?size=thumb" alt="" loading="lazy" />
          <button type="button" class="ct-image-remove" data-action="remove-image" data-id="${escapeHtml(id)}" aria-label="Remove">×</button>
        </div>
      `)
      .join("");
  }

  imagePreview.addEventListener("click", (event) => {
    const target = event.target.closest('[data-action="remove-image"]');
    if (!target) return;
    setImageIds(getImageIds().filter((id) => id !== target.dataset.id));
  });

  // Remove uploaded video file (server-side delete + UI clear).
  document.getElementById("ct-video-current")?.addEventListener("click", async (event) => {
    const btn = event.target.closest('[data-action="remove-video"]');
    if (!btn) return;
    const id = state.editingId;
    if (!id) return;
    if (!window.confirm("Remove the uploaded video?")) return;
    try {
      const res = await fetch(`/api/content/${encodeURIComponent(id)}/video`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Delete failed");
      }
      const cur = document.getElementById("ct-video-current");
      if (cur) cur.innerHTML = "";
    } catch (err) {
      alert(err.message || "Delete failed");
    }
  });

  viewLink?.addEventListener("click", (event) => {
    if (viewLink.classList.contains("is-disabled")) {
      event.preventDefault();
      setStatus("Save first, then click View.", "error");
      setTimeout(() => setStatus(""), 2000);
    }
  });

  pickImagesBtn?.addEventListener("click", async () => {
    if (!window.ImagePicker) return;
    const picked = await window.ImagePicker.open({
      selected: getImageIds(),
      multiple: true,
      title: "Choose photos for this content",
    });
    if (Array.isArray(picked)) setImageIds(picked);
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus("Saving…");
    captureActive(); // commit whatever's in the form to the active lang slot
    const id = state.editingId;
    // Source title/summary = the English entry. Other languages live
    // under translations: { mn: {title, summary}, fr: {...}, ... }.
    const translations = {};
    LANGS.forEach((l) => {
      if (l.code === "en") return;
      const t = (i18n.title[l.code] || "").trim();
      const s = (i18n.summary[l.code] || "").trim();
      if (t || s) translations[l.code] = { title: t, summary: s };
    });
    const payload = {
      title: (i18n.title.en || "").trim(),
      slug: form.elements.slug.value.trim(),
      type: form.elements.type.value,
      country: form.elements.country.value.trim(),
      publishStatus: form.elements.publishStatus.value,
      videoUrl: form.elements.videoUrl.value.trim(),
      location: form.elements.location.value.trim(),
      summary: i18n.summary.en || "",
      translations,
      bulletGroups: readGroups(),
      imageIds: getImageIds(),
    };
    try {
      const url = id ? `/api/content/${encodeURIComponent(id)}` : "/api/content";
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      const savedId = data.entry?.id || state.editingId;
      // If the user picked a video file in this session, upload it
      // now that we have an id. The upload endpoint stores it under
      // /content-videos/<id>.<ext> and patches the record's
      // videoFile field so the public popup picks it up.
      const videoFileInput = document.getElementById("ct-video-file");
      const file = videoFileInput?.files?.[0];
      if (file && savedId) {
        setStatus("Uploading video…", "");
        const fd = new FormData();
        fd.append("file", file);
        const vr = await fetch(`/api/content/${encodeURIComponent(savedId)}/video`, { method: "POST", body: fd });
        const vd = await vr.json().catch(() => ({}));
        if (!vr.ok) throw new Error(vd.error || "Video upload failed");
      }
      setStatus("Saved.", "ok");
      // Activate View link with the saved slug (slug may have been auto-
      // generated from the title or de-duped server-side).
      if (data.entry && data.entry.slug) {
        state.editingId = savedId;
        setViewLink(data.entry.slug, true);
      }
      closeModal();
      load();
    } catch (err) {
      setStatus(err.message || "Save failed.", "error");
    }
  });

  deleteBtn.addEventListener("click", async () => {
    if (!state.editingId) return;
    if (!window.confirm("Delete this content item?")) return;
    try {
      const res = await fetch(`/api/content/${encodeURIComponent(state.editingId)}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Delete failed");
      }
      closeModal();
      load();
    } catch (err) {
      setStatus(err.message || "Delete failed.", "error");
    }
  });

  [searchInput, typeFilter, countryFilter, publishFilter].forEach((node) => {
    node?.addEventListener("input", load);
    node?.addEventListener("change", load);
  });

  load();
})();
