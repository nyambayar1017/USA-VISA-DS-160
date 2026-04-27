(function () {
  "use strict";

  // Small client-side paginator. Each page already has a getFiltered() →
  // render() pipeline; the paginator just slices the filtered list and
  // renders compact controls into the same container so the bound delegated
  // click handler keeps working without extra DOM nodes outside.
  //
  // Usage:
  //   const pgn = new Paginator({ pageSize: 20, onChange: render });
  //   pgn.attach(listNode);  // delegated click for prev/next/page buttons
  //   function render() {
  //     const rows = getFiltered();
  //     const pageRows = pgn.slice(rows);
  //     listNode.innerHTML = renderTable(pageRows) + pgn.controlsHtml();
  //   }
  //   filterEl.addEventListener("input", () => { pgn.reset(); render(); });

  function Paginator(opts) {
    opts = opts || {};
    this.pageSize = Math.max(1, opts.pageSize || 20);
    this.page = 1;
    this.total = 0;
    this.onChange = typeof opts.onChange === "function" ? opts.onChange : null;
    this.scrollTargetSelector = opts.scrollTargetSelector || null;
  }

  Paginator.prototype.slice = function (rows) {
    rows = Array.isArray(rows) ? rows : [];
    this.total = rows.length;
    var totalPages = this.totalPages();
    if (this.page > totalPages) this.page = totalPages;
    if (this.page < 1) this.page = 1;
    var start = (this.page - 1) * this.pageSize;
    return rows.slice(start, start + this.pageSize);
  };

  Paginator.prototype.totalPages = function () {
    return Math.max(1, Math.ceil(this.total / this.pageSize));
  };

  Paginator.prototype.reset = function () { this.page = 1; };

  Paginator.prototype.controlsHtml = function () {
    var tp = this.totalPages();
    if (this.total <= this.pageSize) return "";
    var startRow = (this.page - 1) * this.pageSize + 1;
    var endRow = Math.min(this.page * this.pageSize, this.total);
    var lo = Math.max(1, this.page - 2);
    var hi = Math.min(tp, lo + 4);
    if (hi - lo < 4) lo = Math.max(1, hi - 4);
    var nums = [];
    for (var i = lo; i <= hi; i++) nums.push(i);
    var prevDisabled = this.page === 1 ? " disabled" : "";
    var nextDisabled = this.page === tp ? " disabled" : "";
    var pageButtons = nums
      .map(function (p) {
        var cls = p === this.page ? " is-active" : "";
        return '<button type="button" class="pgn-btn pgn-num' + cls + '" data-pgn-page="' + p + '">' + p + "</button>";
      }, this)
      .join("");
    return (
      '<div class="pgn-bar">' +
        '<span class="pgn-info">' + startRow + "–" + endRow + " of " + this.total + "</span>" +
        '<div class="pgn-buttons">' +
          '<button type="button" class="pgn-btn" data-pgn="first"' + prevDisabled + " title=\"First\">«</button>" +
          '<button type="button" class="pgn-btn" data-pgn="prev"' + prevDisabled + " title=\"Previous\">‹</button>" +
          pageButtons +
          '<button type="button" class="pgn-btn" data-pgn="next"' + nextDisabled + " title=\"Next\">›</button>" +
          '<button type="button" class="pgn-btn" data-pgn="last"' + nextDisabled + " title=\"Last\">»</button>" +
        "</div>" +
      "</div>"
    );
  };

  Paginator.prototype.attach = function (containerEl) {
    if (!containerEl || containerEl._pgnAttached) return;
    containerEl._pgnAttached = true;
    var self = this;
    containerEl.addEventListener("click", function (e) {
      var dir = e.target.closest && e.target.closest("[data-pgn]");
      if (dir) {
        var action = dir.getAttribute("data-pgn");
        var tp = self.totalPages();
        if (action === "first") self.page = 1;
        else if (action === "prev") self.page = Math.max(1, self.page - 1);
        else if (action === "next") self.page = Math.min(tp, self.page + 1);
        else if (action === "last") self.page = tp;
        if (self.onChange) self.onChange();
        scrollIntoViewIfNeeded(self);
        return;
      }
      var pageBtn = e.target.closest && e.target.closest("[data-pgn-page]");
      if (pageBtn) {
        var p = parseInt(pageBtn.getAttribute("data-pgn-page"), 10);
        if (!isNaN(p)) self.page = p;
        if (self.onChange) self.onChange();
        scrollIntoViewIfNeeded(self);
      }
    });
  };

  function scrollIntoViewIfNeeded(self) {
    if (!self.scrollTargetSelector) return;
    var el = document.querySelector(self.scrollTargetSelector);
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ block: "start", behavior: "auto" });
    }
  }

  window.Paginator = Paginator;
})();
