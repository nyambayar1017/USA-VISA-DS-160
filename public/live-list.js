(function () {
  "use strict";

  function safeGet(key) {
    try {
      return sessionStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function safeSet(key, value) {
    try {
      sessionStorage.setItem(key, value);
    } catch (e) {}
  }

  function safeRemove(key) {
    try {
      sessionStorage.removeItem(key);
    } catch (e) {}
  }

  function subscribe(url, options) {
    options = options || {};
    var cacheKey = options.cacheKey || ("livelist:" + url);
    var intervalMs = options.intervalMs || 15000;
    var onData = typeof options.onData === "function" ? options.onData : function () {};
    var onError = typeof options.onError === "function" ? options.onError : function () {};
    var fetchOptions = options.fetchOptions || { credentials: "same-origin" };

    var lastHash = null;
    var stopped = false;
    var timer = null;
    var inFlight = null;

    var raw = safeGet(cacheKey);
    if (raw) {
      try {
        var parsed = JSON.parse(raw);
        lastHash = parsed.hash || null;
        onData(parsed.data, { fromCache: true });
      } catch (e) {}
    }

    function refresh() {
      if (stopped) return Promise.resolve();
      if (inFlight) return inFlight;
      inFlight = fetch(url, fetchOptions)
        .then(function (res) {
          if (!res.ok) throw new Error("HTTP " + res.status);
          return res.json();
        })
        .then(function (data) {
          var hash;
          try {
            hash = JSON.stringify(data);
          } catch (e) {
            hash = null;
          }
          if (hash && hash === lastHash) return data;
          lastHash = hash;
          if (hash) safeSet(cacheKey, JSON.stringify({ hash: hash, data: data }));
          onData(data, { fromCache: false });
          return data;
        })
        .catch(function (err) {
          onError(err);
        })
        .then(function (result) {
          inFlight = null;
          return result;
        });
      return inFlight;
    }

    function startTimer() {
      if (timer) clearInterval(timer);
      timer = setInterval(function () {
        if (!document.hidden) refresh();
      }, intervalMs);
    }

    function stopTimer() {
      if (timer) clearInterval(timer);
      timer = null;
    }

    function handleVisibility() {
      if (document.hidden) {
        stopTimer();
      } else {
        refresh();
        startTimer();
      }
    }

    refresh();
    startTimer();
    document.addEventListener("visibilitychange", handleVisibility);

    return {
      refresh: refresh,
      stop: function () {
        stopped = true;
        stopTimer();
        document.removeEventListener("visibilitychange", handleVisibility);
      },
      invalidate: function () {
        lastHash = null;
        safeRemove(cacheKey);
      },
    };
  }

  window.LiveList = { subscribe: subscribe };
})();
