// Localization fix for non-default locale pages.
// Handles: html lang attribute, nav link URLs, and nav label translations.
(function () {
  var locales = {
    ja: {
      nav: {
        "Home": "ホーム",
        "Getting Started": "はじめに",
        "Beginner Resources": "初心者向けリソース",
        "Development": "開発",
        "Tech Stack": "技術スタック",
        "Running the Code": "コードの実行",
        "Architecture": "アーキテクチャ",
        "Troubleshooting": "トラブルシューティング",
        "Contributing": "コントリビュート",
        "Contribution Workflow": "ワークフロー",
        "Standups": "スタンドアップ",
        "Code of Conduct": "行動規範"
      }
    }
  };

  var match = window.location.pathname.match(/^\/([a-z]{2})\//);
  if (!match) return;

  var lang = match[1];
  var locale = locales[lang];
  if (!locale) return;

  var prefix = "/" + lang;

  // Set correct lang attribute
  document.documentElement.lang = lang;

  // Fix nav link URLs and translate labels
  document.querySelectorAll(".md-tabs__link, .md-nav__link, label.md-nav__link").forEach(function (el) {
    // Fix href to stay within locale prefix
    var href = el.getAttribute("href");
    if (href && !href.startsWith("#") && !href.startsWith("http")) {
      var resolved = new URL(href, window.location.href).pathname;
      if (!resolved.startsWith(prefix + "/") && resolved !== prefix) {
        el.setAttribute("href", prefix + resolved);
      }
    }

    // Translate text content
    el.childNodes.forEach(function (node) {
      if (node.nodeType === Node.TEXT_NODE) {
        var text = node.textContent.trim();
        if (locale.nav[text]) {
          node.textContent = node.textContent.replace(text, locale.nav[text]);
        }
      }
    });
  });
})();
