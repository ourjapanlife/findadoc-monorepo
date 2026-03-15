// Fix nav links on non-default locale pages.
// The mkdocs-static-i18n plugin generates relative URLs that escape
// the locale prefix (e.g., /ja/). This rewrites them to stay within it.
(function () {
  var match = window.location.pathname.match(/^\/([a-z]{2})\//);
  if (!match) return;

  var prefix = "/" + match[1];

  document.querySelectorAll(".md-tabs__link, .md-nav__link").forEach(function (el) {
    var href = el.getAttribute("href");
    if (!href || href.startsWith("#") || href.startsWith("http")) return;
    var resolved = new URL(href, window.location.href).pathname;
    if (!resolved.startsWith(prefix + "/") && resolved !== prefix) {
      el.setAttribute("href", prefix + resolved);
    }
  });
})();
