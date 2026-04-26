// Mail page placeholder — checks whether any mailboxes are configured
// and shows the right empty-state. Inbox rendering ships next.
(async function () {
  const notConfigured = document.getElementById("mail-not-configured");
  const comingSoon = document.getElementById("mail-coming-soon");
  try {
    const res = await fetch("/api/mail/accounts");
    const data = await res.json().catch(() => ({}));
    const accounts = (data.entries || []);
    if (!accounts.length) {
      notConfigured.removeAttribute("hidden");
    } else {
      comingSoon.removeAttribute("hidden");
    }
  } catch {
    notConfigured.removeAttribute("hidden");
  }
})();
