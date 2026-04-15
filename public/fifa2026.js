const publicList = document.querySelector("#fifa-public-list");
const publicSummaryLots = document.querySelector("#public-summary-lots");
const publicSummaryUnits = document.querySelector("#public-summary-units");
const publicListCount = document.querySelector("#public-list-count");
const publicListMeta = document.querySelector("#public-list-meta");

const filters = {
  search: document.querySelector("#public-filter-search"),
  stage: document.querySelector("#public-filter-stage"),
  city: document.querySelector("#public-filter-city"),
  category: document.querySelector("#public-filter-category"),
  dateFrom: document.querySelector("#public-filter-date-from"),
  dateTo: document.querySelector("#public-filter-date-to"),
};

const state = {
  tickets: [],
};

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function fillSelect(node, values, placeholder) {
  if (!node) return;
  node.innerHTML = [`<option value="">${placeholder}</option>`]
    .concat(values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`))
    .join("");
}

function formatDate(value) {
  if (!value) return "-";
  const normalized = String(value).slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString().slice(0, 10);
}

function normalizedCategory(ticket) {
  const code = String(ticket.categoryCode || "").trim();
  if (["1", "2", "3"].includes(code)) return code;
  const digits = code.replace(/\D+/g, "");
  return ["1", "2", "3"].includes(digits) ? digits : "";
}

function buildLiveRows() {
  const groups = new Map();
  for (const ticket of state.tickets) {
    const key = ticket.matchNumber || `${ticket.matchLabel}|${ticket.city}|${ticket.matchDate}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        matchNumber: ticket.matchNumber || "",
        matchDate: ticket.matchDate || "",
        matchLabel: ticket.matchLabel || "",
        city: ticket.city || "",
        stage: ticket.stage || "",
        venue: ticket.venue || "",
        categoryBreakdown: {
          "1": { available: 0, total: 0, seatDetails: [] },
          "2": { available: 0, total: 0, seatDetails: [] },
          "3": { available: 0, total: 0, seatDetails: [] },
        },
      });
    }
    const group = groups.get(key);
    const category = normalizedCategory(ticket);
    if (!category) continue;
    group.categoryBreakdown[category].available += Number(ticket.availableQuantity || 0);
    group.categoryBreakdown[category].total += Number(ticket.totalQuantity || 0);
    if (ticket.seatDetails) {
      group.categoryBreakdown[category].seatDetails.push(ticket.seatDetails);
    }
  }
  return [...groups.values()]
    .map((row, index) => {
      const breakdown = ["1", "2", "3"].map((categoryCode) => ({
        categoryCode,
        ...row.categoryBreakdown[categoryCode],
      }));
      return {
        n: index + 1,
        d: row.matchDate,
        s: row.stage,
        m: row.matchNumber,
        t: row.matchLabel,
        c: row.city,
        venue: row.venue,
        categoryBreakdown: breakdown,
      };
    })
    .sort((left, right) => {
      const dateDiff = String(left.d || "").localeCompare(String(right.d || ""));
      if (dateDiff !== 0) return dateDiff;
      return String(left.m || "").localeCompare(String(right.m || ""), undefined, { numeric: true });
    })
    .map((row, index) => ({ ...row, n: index + 1 }));
}

function filteredRows() {
  const query = filters.search.value.trim().toLowerCase();
  return buildLiveRows().filter((row) => {
    if (filters.stage.value && row.s !== filters.stage.value) return false;
    if (filters.city.value && row.c !== filters.city.value) return false;
    if (filters.category.value && !Number(row.categoryBreakdown.find((item) => item.categoryCode === filters.category.value)?.available || 0)) return false;
    if (filters.dateFrom.value && row.d < filters.dateFrom.value) return false;
    if (filters.dateTo.value && row.d > filters.dateTo.value) return false;
    if (!query) return true;
    return [row.m, row.t, row.c, row.s, row.venue, ...row.categoryBreakdown.flatMap((item) => item.seatDetails)].some((value) =>
      String(value || "").toLowerCase().includes(query)
    );
  });
}

function renderPublicTickets() {
  const rows = filteredRows();
  if (publicSummaryLots) publicSummaryLots.textContent = String(rows.length);
  if (publicSummaryUnits) {
    publicSummaryUnits.textContent = String(
      rows.reduce((sum, row) => sum + row.categoryBreakdown.reduce((categorySum, item) => categorySum + Number(item.available || 0), 0), 0)
    );
  }
  if (publicListCount) publicListCount.textContent = `${rows.length} matches`;
  if (publicListMeta) publicListMeta.textContent = "Live match availability without prices.";

  if (!rows.length) {
    publicList.innerHTML = '<p class="empty">No matches match the current filters.</p>';
    return;
  }

  publicList.innerHTML = `
    <div class="fifa-match-accordion fifa-match-accordion--table fifa-public-match-list">
      <div class="fifa-match-table-head">
        <span>#</span>
        <span>Date</span>
        <span>Team vs Team</span>
        <span>Availability</span>
        <span>City</span>
        <span>Stage</span>
      </div>
      ${rows
        .map((row) => {
          const availabilitySummary = row.categoryBreakdown
            .filter((item) => Number(item.available || 0) > 0)
            .map((item) => `CAT ${item.categoryCode}: ${item.available}`)
            .filter(Boolean)
            .join(" · ");
          const totalAvailable = row.categoryBreakdown.reduce((sum, item) => sum + Number(item.available || 0), 0);
          const seatBreakdown = row.categoryBreakdown
            .filter((item) => item.seatDetails.length)
            .map(
              (item) => `
                <div class="fifa-public-seat-group">
                  <strong>CAT ${item.categoryCode}</strong>
                  <span>${escapeHtml(item.seatDetails.join(" | "))}</span>
                </div>
              `
            )
            .join("");
          return `
            <article class="fifa-match-card is-open">
              <div class="fifa-match-toggle fifa-match-toggle--static">
                <div class="fifa-match-col fifa-match-col--number">
                  <strong>${row.n}</strong>
                </div>
                <div class="fifa-match-col">
                  <strong>${escapeHtml(formatDate(row.d))}</strong>
                  <span class="fifa-table-sub">${escapeHtml(row.m)}</span>
                </div>
                <div class="fifa-match-col fifa-match-col--teams">
                  <strong>${escapeHtml(row.t)}</strong>
                  <span class="fifa-table-sub">${escapeHtml(row.venue || "")}</span>
                </div>
                <div class="fifa-match-col fifa-match-col--availability">
                  <strong>${escapeHtml(availabilitySummary || "No tickets yet")}</strong>
                  <span class="fifa-table-sub">${totalAvailable} available tickets</span>
                </div>
                <div class="fifa-match-col">
                  <strong>${escapeHtml(row.c)}</strong>
                </div>
                <div class="fifa-match-col">
                  <strong>${escapeHtml(row.s)}</strong>
                </div>
              </div>
              <div class="fifa-match-details">
                ${
                  seatBreakdown
                    ? `<div class="fifa-public-seat-grid">${seatBreakdown}</div>`
                    : '<p class="empty">No seat numbers published yet for this match.</p>'
                }
              </div>
            </article>
          `;
        })
        .join("")}
    </div>
  `;
}

async function fetchPublicTickets() {
  const response = await fetch("/api/fifa2026/public", { cache: "no-store" });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Could not load tickets");
  }
  state.tickets = data.tickets || [];
  fillSelect(filters.stage, [...new Set(state.tickets.map((ticket) => ticket.stage).filter(Boolean))], "All stages");
  fillSelect(filters.city, [...new Set(state.tickets.map((ticket) => ticket.city).filter(Boolean))], "All cities");
  fillSelect(filters.category, ["1", "2", "3"], "All categories");
  renderPublicTickets();
}

Object.values(filters).forEach((node) => {
  node?.addEventListener("input", renderPublicTickets);
  node?.addEventListener("change", renderPublicTickets);
});

fetchPublicTickets().catch((error) => {
  publicList.innerHTML = `<p class="empty">${escapeHtml(error.message)}</p>`;
});
