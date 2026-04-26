(function () {
  const tbody = document.getElementById("inv-tbody");
  const countNode = document.getElementById("inv-count");
  const filterSerial = document.getElementById("inv-filter-serial");
  const filterDossier = document.getElementById("inv-filter-dossier");
  const filterGroup = document.getElementById("inv-filter-group");
  const filterPayer = document.getElementById("inv-filter-payer");
  const statusPills = document.getElementById("inv-status-pills");
  const resetBtn = document.getElementById("inv-reset");
  if (!tbody) return;

  let invoices = [];
  let trips = [];
  let groups = [];
  const tripById = new Map();
  const groupById = new Map();
  const activeStatuses = new Set();

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function fmtMoney(amount, currency) {
    const num = Number(amount || 0);
    const sym = currency === "USD" ? "$" : currency === "EUR" ? "€" : "₮";
    if (!num) return "-";
    return num.toLocaleString("en-US") + " " + sym;
  }

  function fmtDate(value) {
    if (!value) return "-";
    const d = String(value).split("T")[0];
    const parts = d.split("-");
    if (parts.length !== 3) return d;
    return parts[2] + "/" + parts[1] + "/" + parts[0];
  }

  function todayIso() {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  }

  // Per-invoice derived values: total paid, next due date, last paid date,
  // and overall status (paid / overdue / pending). Status logic mirrors what
  // the trip-detail invoice card shows so this list stays in sync.
  function deriveInvoice(inv) {
    const installments = Array.isArray(inv.installments) ? inv.installments : [];
    const total = Number(inv.total || 0);
    let totalPaid = 0;
    const pendingDueDates = [];
    const paidDates = [];
    installments.forEach((i) => {
      const amt = Number(i.amount || 0);
      const isPaid = String(i.status || "").toLowerCase() === "paid";
      if (isPaid) {
        totalPaid += amt;
        if (i.paidAt || i.dueDate || i.issueDate) {
          paidDates.push(String(i.paidAt || i.dueDate || i.issueDate).slice(0, 10));
        }
      } else if (i.dueDate) {
        pendingDueDates.push(String(i.dueDate).slice(0, 10));
      }
    });
    pendingDueDates.sort();
    paidDates.sort();
    let status;
    if (total > 0 && totalPaid >= total) status = "paid";
    else if (pendingDueDates.length && pendingDueDates[0] < todayIso()) status = "overdue";
    else status = "pending";
    return {
      totalPaid,
      nextDue: pendingDueDates[0] || "",
      lastPaid: paidDates.length ? paidDates[paidDates.length - 1] : "",
      status,
    };
  }

  async function fetchJson(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Request failed: " + url);
    return res.json();
  }

  async function loadAll() {
    try {
      const [invoiceData, tripData, groupData] = await Promise.all([
        fetchJson("/api/invoices"),
        fetchJson("/api/camp-trips").catch(() => ({ entries: [] })),
        fetchJson("/api/tourist-groups").catch(() => ({ entries: [] })),
      ]);
      invoices = (invoiceData.entries || []).map((inv) => ({ ...inv, _derived: deriveInvoice(inv) }));
      trips = tripData.entries || tripData || [];
      groups = groupData.entries || groupData || [];
      tripById.clear();
      groupById.clear();
      trips.forEach((t) => tripById.set(t.id, t));
      groups.forEach((g) => groupById.set(g.id, g));
      render();
    } catch (err) {
      tbody.innerHTML = '<tr><td colspan="10" class="empty">Could not load invoices: ' + escapeHtml(err.message) + "</td></tr>";
    }
  }

  function dossierLabel(inv) {
    const trip = tripById.get(inv.tripId);
    if (!trip) return "-";
    return (trip.tripName || trip.serial || "").trim() || trip.id;
  }

  function groupLabel(inv) {
    const grp = groupById.get(inv.groupId);
    if (!grp) return "";
    const serial = grp.serial ? grp.serial + " - " : "";
    return serial + (grp.name || "");
  }

  function getFiltered() {
    const sSerial = filterSerial.value.trim().toLowerCase();
    const sDossier = filterDossier.value.trim().toLowerCase();
    const sGroup = filterGroup.value.trim().toLowerCase();
    const sPayer = filterPayer.value.trim().toLowerCase();
    return invoices.filter((inv) => {
      if (sSerial && !(inv.serial || "").toLowerCase().includes(sSerial)) return false;
      if (sDossier && !dossierLabel(inv).toLowerCase().includes(sDossier)) return false;
      if (sGroup && !groupLabel(inv).toLowerCase().includes(sGroup)) return false;
      if (sPayer && !(inv.payerName || "").toLowerCase().includes(sPayer)) return false;
      if (activeStatuses.size && !activeStatuses.has(inv._derived.status)) return false;
      return true;
    });
  }

  function statusPill(status) {
    const label = status === "paid" ? "Paid" : status === "overdue" ? "Overdue" : "Pending";
    return '<span class="invoices-pill invoices-pill-' + status + '">' + label + "</span>";
  }

  function render() {
    const list = getFiltered();
    countNode.textContent = list.length + " invoice" + (list.length === 1 ? "" : "s");
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="10" class="empty">No invoices match the current filters.</td></tr>';
      return;
    }
    tbody.innerHTML = list.map((inv, i) => {
      const trip = tripById.get(inv.tripId);
      const group = groupById.get(inv.groupId);
      const dossier = dossierLabel(inv);
      const grp = groupLabel(inv);
      const dossierCell = trip
        ? '<a href="/trip-detail?tripId=' + encodeURIComponent(inv.tripId) + '">' + escapeHtml(dossier) + "</a>"
        : "-";
      const groupCell = group
        ? '<a href="/group?tripId=' + encodeURIComponent(inv.tripId) + "&groupId=" + encodeURIComponent(inv.groupId) + '">' + escapeHtml(grp) + "</a>"
        : "-";
      const serialCell = '<a href="/invoice-view?invoiceId=' + encodeURIComponent(inv.id) + '">' + escapeHtml(inv.serial || inv.id) + "</a>";
      const d = inv._derived;
      return (
        "<tr>" +
        "<td>" + (i + 1) + "</td>" +
        "<td>" + serialCell + "</td>" +
        "<td>" + dossierCell + "</td>" +
        "<td>" + groupCell + "</td>" +
        "<td>" + escapeHtml(inv.payerName || "-") + "</td>" +
        "<td>" + fmtMoney(inv.total, inv.currency) + "</td>" +
        "<td>" + fmtMoney(d.totalPaid, inv.currency) + "</td>" +
        "<td>" + statusPill(d.status) + "</td>" +
        "<td>" + fmtDate(d.nextDue) + "</td>" +
        "<td>" + fmtDate(d.lastPaid) + "</td>" +
        "</tr>"
      );
    }).join("");
  }

  [filterSerial, filterDossier, filterGroup, filterPayer].forEach((el) => {
    el.addEventListener("input", render);
  });

  statusPills.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-status]");
    if (!btn) return;
    const status = btn.dataset.status;
    if (activeStatuses.has(status)) activeStatuses.delete(status);
    else activeStatuses.add(status);
    btn.classList.toggle("is-active");
    render();
  });

  resetBtn.addEventListener("click", () => {
    filterSerial.value = "";
    filterDossier.value = "";
    filterGroup.value = "";
    filterPayer.value = "";
    activeStatuses.clear();
    statusPills.querySelectorAll(".invoices-status-pill").forEach((p) => p.classList.remove("is-active"));
    render();
  });

  loadAll();
})();
