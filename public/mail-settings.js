// Mail Settings: list / add / test / remove mailboxes
(function () {
  const listNode = document.getElementById("mail-account-list");
  const addForm = document.getElementById("mail-add-form");
  const addToggle = document.getElementById("mail-add-toggle");
  const addStatus = document.getElementById("mail-add-status");

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

  function statusBadge(account) {
    if (account.status === "ok") return '<span class="mail-status-pill mail-status-pill--ok">Connected</span>';
    if (account.status === "error") return `<span class="mail-status-pill mail-status-pill--err" title="${escapeHtml(account.lastError || "")}">Error</span>`;
    return '<span class="mail-status-pill mail-status-pill--idle">Untested</span>';
  }

  function render(accounts) {
    if (!accounts || !accounts.length) {
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
          <footer>
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
      render(data.entries || []);
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
    }
  });

  load();
})();
