// Runs in <head> so the saved theme applies before first paint (no flash).
(function () {
  try {
    var t = localStorage.getItem('theme');
    if (t === 'dark' || t === 'light') {
      document.documentElement.dataset.theme = t;
    }
  } catch (e) {
    // localStorage unavailable — fall back to prefers-color-scheme.
  }
})();
