// Mail Settings: list / add / test / remove mailboxes + signatures + templates
(function () {
  const listNode = document.getElementById("mail-account-list");
  const addForm = document.getElementById("mail-add-form");
  const addToggle = document.getElementById("mail-add-toggle");
  const addStatus = document.getElementById("mail-add-status");
  const tplListNode = document.getElementById("mail-templates-list");
  const tplAddToggle = document.getElementById("tpl-add-toggle");
  const editorModal = document.getElementById("mail-editor-modal");
  const editorTitle = document.getElementById("mail-editor-title");
  const editorHost = document.getElementById("mail-editor-host");
  const editorExtra = document.getElementById("mail-editor-extra");
  const editorStatus = document.getElementById("mail-editor-status");
  const editorSaveBtn = document.getElementById("mail-editor-save");

  let accounts = [];
  let templates = [];
  let currentEditor = null;
  let currentSaveHandler = null;

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  }

  async function fetchJson(url, opts) {
    const res = await fetch(url, opts);
    let data = {};
    try { data = await res.json(); } catch {}
    if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
    return data;
  }

  // ── Rich text editor (contenteditable + toolbar) ──────────────
  function createRichEditor(container, initialHtml = "") {
    const wrap = document.createElement("div");
    wrap.className = "rich-editor";
    wrap.innerHTML = `
      <div class="rich-toolbar" data-toolbar>
        <button type="button" data-cmd="bold" title="Bold (Ctrl+B)"><b>B</b></button>
        <button type="button" data-cmd="italic" title="Italic (Ctrl+I)"><i>I</i></button>
        <button type="button" data-cmd="underline" title="Underline"><u>U</u></button>
        <span class="rich-sep"></span>
        <button type="button" data-cmd="insertUnorderedList" title="Bullet list">• List</button>
        <button type="button" data-cmd="insertOrderedList" title="Numbered list">1.</button>
        <span class="rich-sep"></span>
        <button type="button" data-cmd="justifyLeft" title="Align left">⇤</button>
        <button type="button" data-cmd="justifyCenter" title="Align center">↔</button>
        <button type="button" data-cmd="justifyRight" title="Align right">⇥</button>
        <span class="rich-sep"></span>
        <button type="button" data-cmd="createLink" title="Link">🔗</button>
        <button type="button" data-cmd="image-upload" title="Insert image">📷</button>
        <label class="rich-color" title="Text color">
          <input type="color" data-cmd="foreColor" value="#0f172a"/>
          <span>A</span>
        </label>
        <select data-cmd="fontSize" title="Font size">
          <option value="2">Small</option>
          <option value="3" selected>Normal</option>
          <option value="4">Large</option>
          <option value="5">Larger</option>
          <option value="6">Huge</option>
        </select>
        <span class="rich-sep"></span>
        <button type="button" data-cmd="removeFormat" title="Clear formatting">⌫</button>
        <input type="file" accept="image/*" data-img-input hidden/>
      </div>
      <div class="rich-content" contenteditable="true" data-content></div>
    `;
    const content = wrap.querySelector("[data-content]");
    const toolbar = wrap.querySelector("[data-toolbar]");
    const fileInput = wrap.querySelector("[data-img-input]");
    content.innerHTML = initialHtml || "";

    toolbar.addEventListener("mousedown", (e) => {
      // Prevent the toolbar from stealing focus from the editor
      const ctrl = e.target.closest("[data-cmd]");
      if (ctrl && ctrl.tagName !== "INPUT" && ctrl.tagName !== "SELECT") {
        e.preventDefault();
      }
    });

    toolbar.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-cmd]");
      if (!btn) return;
      if (btn.tagName === "INPUT" || btn.tagName === "SELECT") return;
      e.preventDefault();
      const cmd = btn.dataset.cmd;
      content.focus();
      if (cmd === "createLink") {
        const url = await UI.prompt("Link URL", { defaultValue: "https://", confirmLabel: "Insert" });
        if (url) document.execCommand("createLink", false, url);
      } else if (cmd === "image-upload") {
        fileInput.click();
      } else {
        document.execCommand(cmd, false, null);
      }
    });

    toolbar.addEventListener("change", (e) => {
      const ctrl = e.target.closest("[data-cmd]");
      if (!ctrl) return;
      content.focus();
      const cmd = ctrl.dataset.cmd;
      document.execCommand(cmd, false, ctrl.value);
    });

    fileInput.addEventListener("change", async () => {
      const f = fileInput.files[0];
      if (!f) return;
      const fd = new FormData();
      fd.append("image", f);
      try {
        const r = await fetch("/api/mail/signature-image", { method: "POST", body: fd });
        const data = await r.json();
        if (r.ok && data.url) {
          content.focus();
          document.execCommand("insertImage", false, data.url);
        } else {
          UI?.toast?.(data.error || "Upload failed", "error");
        }
      } catch (err) {
        UI?.toast?.("Upload failed", "error");
      }
      fileInput.value = "";
    });

    container.innerHTML = "";
    container.appendChild(wrap);
    return {
      getHtml: () => content.innerHTML,
      setHtml: (html) => { content.innerHTML = html || ""; },
      focus: () => content.focus(),
    };
  }

  // ── Editor modal helpers ──────────────────────────────────────
  function openEditor({ title, initialHtml, extraHtml, onSave }) {
    editorTitle.textContent = title;
    editorExtra.innerHTML = extraHtml || "";
    currentEditor = createRichEditor(editorHost, initialHtml || "");
    currentSaveHandler = onSave;
    editorStatus.textContent = "";
    editorModal.removeAttribute("hidden");
    setTimeout(() => currentEditor?.focus(), 100);
  }

  function closeEditor() {
    editorModal.setAttribute("hidden", "");
    editorHost.innerHTML = "";
    editorExtra.innerHTML = "";
    currentEditor = null;
    currentSaveHandler = null;
    editorStatus.textContent = "";
  }

  editorModal?.addEventListener("click", (e) => {
    if (e.target.dataset.action === "close-editor") closeEditor();
  });

  editorSaveBtn?.addEventListener("click", async () => {
    if (!currentSaveHandler || !currentEditor) return;
    const html = currentEditor.getHtml();
    const extraData = {};
    editorExtra.querySelectorAll("[data-extra]").forEach((el) => {
      extraData[el.dataset.extra] = el.value;
    });
    editorStatus.textContent = "Saving...";
    editorSaveBtn.disabled = true;
    try {
      await currentSaveHandler(html, extraData);
      closeEditor();
    } catch (err) {
      editorStatus.textContent = err.message || "Save failed";
    } finally {
      editorSaveBtn.disabled = false;
    }
  });

  // ── Mail accounts ─────────────────────────────────────────────
  function statusBadge(account) {
    if (account.status === "ok") return '<span class="mail-status-pill mail-status-pill--ok">Connected</span>';
    if (account.status === "error") return `<span class="mail-status-pill mail-status-pill--err" title="${escapeHtml(account.lastError || "")}">Error</span>`;
    return '<span class="mail-status-pill mail-status-pill--idle">Untested</span>';
  }

  function render() {
    if (!accounts.length) {
      listNode.innerHTML = '<p class="empty">No mailboxes connected yet. Click "+ Add mailbox" to get started.</p>';
      return;
    }
    listNode.innerHTML = accounts
      .map((a) => `
        <article class="mail-account-card" data-id="${escapeHtml(a.id)}">
          <header>
            <div>
              <strong>${escapeHtml(a.displayName || a.address)}</strong>
              <span>${escapeHtml(a.address)}</span>
            </div>
            <div class="mail-account-card-meta">
              <span class="mail-workspace-pill mail-workspace-pill--${a.workspace === "USM" ? "usm" : "dtx"}">${escapeHtml(a.workspace || "DTX")}</span>
              ${statusBadge(a)}
            </div>
          </header>
          ${a.lastError ? `<p class="mail-account-error">${escapeHtml(a.lastError)}</p>` : ""}
          ${a.signatureHtml ? '<p class="mail-account-sig-hint">✍ Signature configured</p>' : ""}
          <footer>
            <button type="button" class="secondary-button" data-action="signature">✍ Signature</button>
            <button type="button" class="secondary-button" data-action="test">Test connection</button>
            <button type="button" class="secondary-button" data-action="rotate">Update password</button>
            <button type="button" class="secondary-button danger-button" data-action="delete">Remove</button>
          </footer>
        </article>
      `)
      .join("");
  }

  async function load() {
    try {
      const data = await fetchJson("/api/mail/accounts");
      accounts = data.entries || [];
      render();
    } catch (err) {
      listNode.innerHTML = `<p class="empty">Could not load: ${escapeHtml(err.message)}</p>`;
    }
  }

  addToggle?.addEventListener("click", () => {
    addForm.classList.toggle("is-hidden");
    if (!addForm.classList.contains("is-hidden")) {
      addForm.elements.address?.focus();
    }
  });

  addForm?.addEventListener("click", (e) => {
    if (e.target.dataset.action === "cancel-add") {
      addForm.classList.add("is-hidden");
      addForm.reset();
      addStatus.textContent = "";
    }
  });

  addForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(addForm);
    const payload = {
      address: (fd.get("address") || "").toString().trim().toLowerCase(),
      displayName: (fd.get("displayName") || "").toString().trim(),
      workspace: (fd.get("workspace") || "DTX").toString(),
      appPassword: (fd.get("appPassword") || "").toString(),
    };
    addStatus.textContent = "Saving...";
    try {
      const created = await fetchJson("/api/mail/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      addStatus.textContent = "Saved. Testing connection...";
      const test = await fetchJson(`/api/mail/accounts/${created.entry.id}/test`, { method: "POST" });
      if (test.ok) {
        UI?.toast?.(`${payload.address} connected.`, "success");
        addStatus.textContent = "";
      } else {
        UI?.toast?.(`Connection test failed: ${test.error || "unknown error"}`, "error");
        addStatus.textContent = "Saved, but connection test failed — see card below.";
      }
      addForm.reset();
      addForm.classList.add("is-hidden");
      await load();
    } catch (err) {
      addStatus.textContent = err.message;
    }
  });

  listNode?.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const card = btn.closest("[data-id]");
    const id = card?.dataset.id;
    if (!id) return;
    const account = accounts.find((a) => a.id === id);
    if (btn.dataset.action === "test") {
      btn.disabled = true;
      btn.textContent = "Testing...";
      try {
        const r = await fetchJson(`/api/mail/accounts/${id}/test`, { method: "POST" });
        if (r.ok) UI?.toast?.("Connection OK.", "success");
        else UI?.toast?.(`Failed: ${r.error || "unknown"}`, "error");
      } catch (err) {
        UI?.toast?.(err.message || "Test failed", "error");
      } finally {
        btn.disabled = false;
        btn.textContent = "Test connection";
        await load();
      }
    } else if (btn.dataset.action === "rotate") {
      const newPw = await UI.prompt("Paste new app password:", { confirmLabel: "Update" });
      if (!newPw) return;
      try {
        await fetchJson(`/api/mail/accounts/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ appPassword: newPw }),
        });
        UI?.toast?.("Password updated.", "success");
        await load();
      } catch (err) {
        UI?.toast?.(err.message || "Update failed", "error");
      }
    } else if (btn.dataset.action === "delete") {
      const ok = await UI.confirm("Remove this mailbox? Stored messages will be deleted; the actual Gmail account is not touched.", { dangerous: true });
      if (!ok) return;
      try {
        await fetchJson(`/api/mail/accounts/${id}`, { method: "DELETE" });
        UI?.toast?.("Mailbox removed.", "success");
        await load();
      } catch (err) {
        UI?.toast?.(err.message || "Delete failed", "error");
      }
    } else if (btn.dataset.action === "signature") {
      openEditor({
        title: `Signature for ${account.address}`,
        initialHtml: account.signatureHtml || "",
        extraHtml: '<p class="rich-helper">Use the toolbar to format text, insert links and images. The signature is appended to outgoing messages from this mailbox.</p>',
        onSave: async (html) => {
          await fetchJson(`/api/mail/accounts/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ signatureHtml: html }),
          });
          UI?.toast?.("Signature saved.", "success");
          await load();
        },
      });
    }
  });

  // ── Templates ─────────────────────────────────────────────────
  function renderTemplates() {
    if (!templates.length) {
      tplListNode.innerHTML = '<p class="empty">No templates yet. Click "+ New template" to add one.</p>';
      return;
    }
    tplListNode.innerHTML = templates
      .map((t) => `
        <article class="mail-template-card" data-tpl-id="${escapeHtml(t.id)}">
          <header>
            <div>
              <strong>${escapeHtml(t.name)}</strong>
              <span>${escapeHtml(t.subject || "(no subject)")}</span>
            </div>
            <div class="mail-template-actions">
              <button type="button" class="secondary-button" data-tpl-action="edit">Edit</button>
              <button type="button" class="secondary-button danger-button" data-tpl-action="delete">Delete</button>
            </div>
          </header>
          <div class="mail-template-preview">${t.bodyHtml || '<em>(empty body)</em>'}</div>
        </article>
      `)
      .join("");
  }

  async function loadTemplates() {
    try {
      const data = await fetchJson("/api/mail/templates");
      templates = data.entries || [];
      renderTemplates();
    } catch (err) {
      tplListNode.innerHTML = `<p class="empty">Could not load: ${escapeHtml(err.message)}</p>`;
    }
  }

  function templateExtraInputs(tpl) {
    return `
      <label class="rich-extra-row">
        <span>Name</span>
        <input type="text" data-extra="name" value="${escapeHtml(tpl?.name || '')}" placeholder="e.g. Booking confirmation" required/>
      </label>
      <label class="rich-extra-row">
        <span>Subject</span>
        <input type="text" data-extra="subject" value="${escapeHtml(tpl?.subject || '')}" placeholder="Email subject"/>
      </label>
    `;
  }

  tplAddToggle?.addEventListener("click", () => {
    openEditor({
      title: "New template",
      initialHtml: "",
      extraHtml: templateExtraInputs(null),
      onSave: async (html, extra) => {
        if (!extra.name?.trim()) throw new Error("Name is required");
        await fetchJson("/api/mail/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: extra.name.trim(),
            subject: extra.subject || "",
            bodyHtml: html,
          }),
        });
        UI?.toast?.("Template saved.", "success");
        await loadTemplates();
      },
    });
  });

  tplListNode?.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-tpl-action]");
    if (!btn) return;
    const card = btn.closest("[data-tpl-id]");
    const id = card?.dataset.tplId;
    if (!id) return;
    const tpl = templates.find((t) => t.id === id);
    if (!tpl) return;
    if (btn.dataset.tplAction === "edit") {
      openEditor({
        title: `Edit: ${tpl.name}`,
        initialHtml: tpl.bodyHtml || "",
        extraHtml: templateExtraInputs(tpl),
        onSave: async (html, extra) => {
          if (!extra.name?.trim()) throw new Error("Name is required");
          await fetchJson(`/api/mail/templates/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: extra.name.trim(),
              subject: extra.subject || "",
              bodyHtml: html,
            }),
          });
          UI?.toast?.("Template updated.", "success");
          await loadTemplates();
        },
      });
    } else if (btn.dataset.tplAction === "delete") {
      const ok = await UI.confirm(`Delete template "${tpl.name}"?`, { dangerous: true });
      if (!ok) return;
      try {
        await fetchJson(`/api/mail/templates/${id}`, { method: "DELETE" });
        UI?.toast?.("Template deleted.", "success");
        await loadTemplates();
      } catch (err) {
        UI?.toast?.(err.message || "Delete failed", "error");
      }
    }
  });

  load();
  loadTemplates();
})();
