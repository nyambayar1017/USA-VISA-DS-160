// Shared "Trip Documents" widget — same UI used on both /trip-detail and
// /group pages. Mount with `window.TripDocuments.mount(tripId, containerEl)`.
// Handles upload (drop + browse), category filter tabs, select-all,
// per-row tourist link, rename/delete, and email-to-client.

(function () {
  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
  }

  function fileIcon(mimeType, name) {
    const ext = (name || "").split(".").pop().toLowerCase();
    const mime = mimeType || "";
    if (mime.includes("pdf") || ext === "pdf") return "📄";
    if (["doc", "docx"].includes(ext)) return "📝";
    if (["xls", "xlsx"].includes(ext)) return "📊";
    if (["jpg", "jpeg", "png", "gif"].includes(ext)) return "🖼️";
    return "📎";
  }
  function fmtSize(b) {
    if (!b) return "0 B";
    if (b < 1024) return b + " B";
    if (b < 1024 * 1024) return (b / 1024).toFixed(1) + " KB";
    return (b / 1024 / 1024).toFixed(1) + " MB";
  }
  function viewUrl(doc, tripId) {
    const src = "/trip-uploads/" + tripId + "/" + doc.storedName;
    if ((doc.mimeType || "").includes("pdf") || (doc.storedName || "").endsWith(".pdf")) {
      return "/pdf-viewer?src=" + encodeURIComponent(src) + "&title=" + encodeURIComponent(doc.originalName || "");
    }
    return src;
  }

  const CATEGORY_ORDER = ["Invoices", "Flight Tickets", "Passports & Visas", "Hotel Vouchers", "Insurance", "Contracts", "Paid documents", "Other"];
  const FILTER_KEYS    = ["all", "Invoices", "Flight Tickets", "Passports & Visas", "Insurance", "Contracts", "Paid documents", "Other"];
  const CATEGORY_OPTIONS = ["Other", "Invoices", "Flight Tickets", "Passports & Visas", "Insurance", "Contracts", "Paid documents"];

  function buildShellHtml() {
    return `
      <div class="card">
        <div class="section-head">
          <div>
            <h2>Trip Documents</h2>
            <p>Upload invoices, flight tickets, contracts, passports, and any trip-related files.</p>
          </div>
        </div>
        <div class="doc-upload-row">
          <div class="doc-category-row">
            <label data-td="category-label">Category:</label>
            <select class="doc-category-select" data-td="category">
              ${CATEGORY_OPTIONS.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("")}
            </select>
            <label style="margin-left:14px">Related tourist:</label>
            <select class="doc-category-select" data-td="tourist">
              <option value="">— None —</option>
            </select>
          </div>
          <div class="doc-drop-zone" data-td="drop">
            <input type="file" data-td="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.txt" style="display:none" />
            <div class="doc-drop-inner">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              <p>Drop files here or <span class="doc-browse-btn" data-td="browse">browse</span></p>
              <p class="doc-hint">PDF, Word, Excel, JPG, PNG — max 10 MB per file</p>
            </div>
            <p class="status" data-td="upload-status"></p>
          </div>
        </div>
        <nav class="doc-filter-tabs" data-td="filter-tabs">
          ${FILTER_KEYS.map((k, i) => `<button class="doc-filter-tab${i === 0 ? " is-active" : ""}" data-filter="${escapeHtml(k)}">${k === "all" ? "All" : escapeHtml(k)}</button>`).join("")}
        </nav>
        <label class="doc-select-all">
          <input type="checkbox" data-td="select-all" />
          <span>Select all</span>
        </label>
        <div class="doc-email-bar is-hidden" data-td="email-bar">
          <div class="doc-email-bar-row">
            <span data-td="email-count">0 selected</span>
            <input type="email" data-td="email-recipient" placeholder="client@example.com" autocomplete="email" />
            <input type="text" data-td="email-name" placeholder="Аялагчийн нэр" autocomplete="off" />
            <button type="button" class="secondary-button" data-td="email-send">Send to client</button>
            <button type="button" class="secondary-button" data-td="email-clear" aria-label="Clear selection">Clear</button>
          </div>
          <p class="status" data-td="email-status"></p>
        </div>
        <div class="doc-list" data-td="list"></div>
      </div>
    `;
  }

  function mount(tripId, container) {
    if (!tripId || !container) return;
    container.innerHTML = buildShellHtml();
    // Internal state for this mounted instance.
    const state = {
      tripId,
      activeFilter: "all",
      selected: new Set(),
      tourists: [],
      docs: [],
    };
    const $ = (key) => container.querySelector(`[data-td="${key}"]`);

    function touristOptions(selectedId) {
      const opts = ['<option value="">— None —</option>'].concat(
        state.tourists.map((t) => {
          const label = ((t.lastName || "") + " " + (t.firstName || "")).trim() || "(unnamed)";
          const sel = t.id === selectedId ? " selected" : "";
          return `<option value="${escapeHtml(t.id)}"${sel}>${escapeHtml(label)}</option>`;
        })
      );
      return opts.join("");
    }

    function renderFilterCounts(visible) {
      const counts = { all: visible.length };
      visible.forEach((d) => {
        const cat = d.category || "Other";
        counts[cat] = (counts[cat] || 0) + 1;
      });
      $("filter-tabs").querySelectorAll(".doc-filter-tab").forEach((btn) => {
        const filter = btn.dataset.filter;
        const count = counts[filter] || 0;
        const label = filter === "all" ? "All" : filter;
        btn.textContent = count > 0 ? `${label} (${count})` : label;
        btn.classList.toggle("is-active", filter === state.activeFilter);
      });
    }

    function renderItem(doc, num) {
      const icon = fileIcon(doc.mimeType, doc.originalName);
      const size = fmtSize(doc.size);
      const at = doc.uploadedAt ? String(doc.uploadedAt).split("T")[0] : "";
      const uploader = doc.uploadedBy ? (doc.uploadedBy.name || doc.uploadedBy.email || "") : "";
      const url = viewUrl(doc, state.tripId);
      const dl  = "/trip-uploads/" + state.tripId + "/" + doc.storedName + "?download=1";
      const ck  = state.selected.has(doc.id) ? " checked" : "";
      return `
        <div class="doc-item">
          <label class="doc-select" aria-label="Select for email">
            <input type="checkbox" data-doc-select="${escapeHtml(doc.id)}"${ck} />
          </label>
          <div class="doc-num">${num}</div>
          <div class="doc-icon">${icon}</div>
          <div class="doc-meta">
            <div class="doc-name" title="${escapeHtml(doc.originalName)}">${escapeHtml(doc.originalName)}</div>
            <div class="doc-info">${escapeHtml(size)}${at ? " · " + at : ""}${uploader ? " · " + escapeHtml(uploader) : ""}</div>
            <div class="doc-tourist-row">
              <span class="doc-tourist-label">Tourist:</span>
              <select class="doc-tourist-select" data-doc-tourist="${escapeHtml(doc.id)}">
                ${touristOptions(doc.touristId || "")}
              </select>
            </div>
          </div>
          <details class="doc-menu">
            <summary class="doc-menu-trigger" aria-label="Document actions">⋯</summary>
            <div class="doc-menu-popover">
              <a class="doc-menu-item" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">View</a>
              <a class="doc-menu-item" href="${escapeHtml(dl)}" download>Download</a>
              <button type="button" class="doc-menu-item" data-doc-rename="${escapeHtml(doc.id)}" data-doc-name="${escapeHtml(doc.originalName)}">Rename</button>
              <button type="button" class="doc-menu-item is-danger" data-doc-delete="${escapeHtml(doc.id)}" data-doc-name="${escapeHtml(doc.originalName)}">Delete</button>
            </div>
          </details>
        </div>
      `;
    }

    function syncSelectAll() {
      const all = $("list").querySelectorAll("[data-doc-select]");
      const checked = $("list").querySelectorAll("[data-doc-select]:checked");
      const sa = $("select-all");
      if (!all.length || checked.length === 0) { sa.checked = false; sa.indeterminate = false; }
      else if (checked.length === all.length) { sa.checked = true;  sa.indeterminate = false; }
      else                                     { sa.checked = false; sa.indeterminate = true;  }
    }

    function renderList() {
      const visible = (state.docs || []).filter((d) => !d.touristRemovedAt);
      renderFilterCounts(visible);
      const filtered = state.activeFilter === "all"
        ? visible
        : visible.filter((d) => (d.category || "Other") === state.activeFilter);
      if (!filtered.length) {
        $("list").innerHTML = `<p class="muted" style="padding:8px 0">${state.activeFilter === "all" ? "No documents uploaded yet." : `No documents in "${escapeHtml(state.activeFilter)}".`}</p>`;
        return;
      }
      if (state.activeFilter !== "all") {
        $("list").innerHTML = filtered.map((d, i) => renderItem(d, i + 1)).join("");
        syncSelectAll();
        return;
      }
      const groups = {};
      filtered.forEach((d) => {
        const cat = d.category || "Other";
        (groups[cat] = groups[cat] || []).push(d);
      });
      const order = CATEGORY_ORDER.concat(Object.keys(groups).filter((c) => CATEGORY_ORDER.indexOf(c) === -1));
      let html = "";
      let n = 1;
      order.forEach((cat) => {
        const list = groups[cat];
        if (!list || !list.length) return;
        html += `<div class="doc-group"><div class="doc-group-header">${escapeHtml(cat)} <span class="doc-group-count">(${list.length})</span></div>`;
        list.forEach((d) => { html += renderItem(d, n++); });
        html += `</div>`;
      });
      $("list").innerHTML = html;
      syncSelectAll();
    }

    async function reload() {
      try {
        const [tripsRes, touristsRes] = await Promise.all([
          fetch("/api/camp-trips").then((r) => r.json()),
          fetch("/api/tourists").then((r) => r.json()),
        ]);
        const trips = tripsRes.entries || tripsRes;
        const trip = (trips || []).find((t) => t.id === state.tripId);
        state.tourists = (touristsRes.entries || []).filter((t) => t.tripId === state.tripId);
        state.docs = trip ? (trip.documents || []) : [];
        $("tourist").innerHTML = touristOptions("");
        renderList();
      } catch (_) {
        // non-critical
      }
    }

    async function uploadFiles(files) {
      if (!files.length) return;
      const cat = $("category").value || "Other";
      const tid = $("tourist").value || "";
      for (let file of files) {
        if (window.CompressUpload && file.type && file.type.startsWith("image/")) {
          try { file = await window.CompressUpload.file(file); } catch {}
        }
        $("upload-status").textContent = "Uploading " + file.name + "…";
        const fd = new FormData();
        fd.append("file", file);
        fd.append("category", cat);
        if (tid) fd.append("touristId", tid);
        try {
          const resp = await fetch("/api/camp-trips/" + state.tripId + "/documents", { method: "POST", body: fd });
          const data = await resp.json();
          if (!resp.ok) throw new Error(data.error || "Upload failed");
        } catch (err) {
          $("upload-status").textContent = "Error: " + err.message;
          return;
        }
      }
      $("upload-status").textContent = files.length + " file(s) uploaded.";
      await reload();
    }

    function updateEmailBar() {
      const n = state.selected.size;
      $("email-count").textContent = n + " selected";
      $("email-bar").classList.toggle("is-hidden", n === 0);
      syncSelectAll();
    }

    // Wire interactions.
    $("drop").addEventListener("dragover", (e) => { e.preventDefault(); $("drop").classList.add("drag-over"); });
    $("drop").addEventListener("dragleave", () => $("drop").classList.remove("drag-over"));
    $("drop").addEventListener("drop", (e) => {
      e.preventDefault();
      $("drop").classList.remove("drag-over");
      uploadFiles(Array.from(e.dataTransfer.files));
    });
    $("browse").addEventListener("click", () => $("file").click());
    $("file").addEventListener("change", () => {
      if ($("file").files.length) uploadFiles(Array.from($("file").files));
      $("file").value = "";
    });
    $("filter-tabs").addEventListener("click", (e) => {
      const tab = e.target.closest(".doc-filter-tab");
      if (!tab) return;
      state.activeFilter = tab.dataset.filter;
      renderList();
    });
    $("select-all").addEventListener("change", () => {
      const want = $("select-all").checked;
      $("list").querySelectorAll("[data-doc-select]").forEach((cb) => {
        cb.checked = want;
        const id = cb.getAttribute("data-doc-select");
        if (want) state.selected.add(id); else state.selected.delete(id);
      });
      updateEmailBar();
    });
    $("list").addEventListener("change", async (e) => {
      const cb = e.target.closest("[data-doc-select]");
      if (cb) {
        const id = cb.getAttribute("data-doc-select");
        if (cb.checked) state.selected.add(id); else state.selected.delete(id);
        updateEmailBar();
        return;
      }
      const ts = e.target.closest("[data-doc-tourist]");
      if (ts) {
        ts.disabled = true;
        try {
          const resp = await fetch(`/api/camp-trips/${state.tripId}/documents/${ts.getAttribute("data-doc-tourist")}`, {
            method: "PATCH", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ touristId: ts.value }),
          });
          if (!resp.ok) {
            const d = await resp.json();
            throw new Error(d.error || "Update failed");
          }
          await reload();
        } catch (err) {
          alert("Алдаа: " + err.message);
          ts.disabled = false;
        }
      }
    });
    $("list").addEventListener("click", async (e) => {
      const del = e.target.closest("[data-doc-delete]");
      if (del) {
        const id = del.dataset.docDelete;
        const name = del.dataset.docName || "this file";
        const ok = window.UI?.confirm
          ? await window.UI.confirm(`Delete "${name}"?`, { dangerous: true })
          : window.confirm(`Delete "${name}"?`);
        if (!ok) return;
        try {
          const resp = await fetch(`/api/camp-trips/${state.tripId}/documents/${id}`, { method: "DELETE" });
          if (!resp.ok) { const d = await resp.json(); throw new Error(d.error || "Delete failed"); }
          await reload();
        } catch (err) { alert("Could not delete: " + err.message); }
        return;
      }
      const ren = e.target.closest("[data-doc-rename]");
      if (ren) {
        const id = ren.dataset.docRename;
        const cur = ren.dataset.docName || "";
        const name = window.UI?.prompt
          ? await window.UI.prompt("New file name:", { defaultValue: cur })
          : window.prompt("New file name:", cur);
        if (!name || name.trim() === cur.trim()) return;
        try {
          const resp = await fetch(`/api/camp-trips/${state.tripId}/documents/${id}`, {
            method: "PATCH", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: name.trim() }),
          });
          if (!resp.ok) { const d = await resp.json(); throw new Error(d.error || "Rename failed"); }
          await reload();
        } catch (err) { alert("Could not rename: " + err.message); }
      }
    });
    $("email-clear").addEventListener("click", () => {
      state.selected.clear();
      $("list").querySelectorAll("[data-doc-select]").forEach((cb) => { cb.checked = false; });
      updateEmailBar();
      $("email-status").textContent = "";
    });
    $("email-send").addEventListener("click", async () => {
      if (!state.selected.size) { $("email-status").textContent = "Select at least one file."; return; }
      const recipient = ($("email-recipient").value || "").trim();
      if (!recipient || !recipient.includes("@")) {
        $("email-status").textContent = "Enter a valid client email.";
        $("email-recipient").focus();
        return;
      }
      const name = ($("email-name").value || "").trim();
      $("email-send").disabled = true;
      $("email-status").textContent = "Илгээж байна...";
      try {
        const resp = await fetch(`/api/camp-trips/${state.tripId}/documents/email`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipientEmail: recipient,
            recipientName: name,
            docIds: [...state.selected],
            workspace: typeof window.readWorkspace === "function" ? window.readWorkspace() : "",
          }),
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || "Send failed");
        const successMsg = "✔ Амжилттай илгээгдлээ! " + data.sent + " файл → " + recipient;
        $("email-status").textContent = successMsg;
        $("email-status").style.color = "#1a7f3a";
        $("email-status").style.fontWeight = "600";
        state.selected.clear();
        $("list").querySelectorAll("[data-doc-select]").forEach((cb) => { cb.checked = false; });
        updateEmailBar();
        $("email-recipient").value = "";
        $("email-name").value = "";
      } catch (err) {
        $("email-status").textContent = "Алдаа: " + err.message;
      } finally {
        $("email-send").disabled = false;
      }
    });

    reload();
    return { reload };
  }

  window.TripDocuments = { mount };
})();
