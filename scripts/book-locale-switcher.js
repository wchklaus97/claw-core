/**
 * Book locale switcher: same page in en, zh-Hans, zh-Hant.
 * Injected into mdBook pages; path pattern: /{base}/{locale}/book/...
 */
(function () {
  var pathname = window.location.pathname;
  var base = '';
  if (pathname.indexOf('/claw/') === 0) {
    base = '/claw';
    pathname = pathname.slice(5);
  }
  var parts = pathname.split('/').filter(Boolean);
  // parts: ["en", "book", "openclaw-integration.html"] or ["en", "book", "chapter", "index.html"]
  if (parts.length < 2 || (parts[0] !== 'en' && parts[0] !== 'zh-Hans' && parts[0] !== 'zh-Hant') || parts[1] !== 'book') {
    return;
  }
  var currentLocale = parts[0];
  var bookPath = parts.slice(2).join('/'); // e.g. "openclaw-integration.html" or "chapter/index.html"
  var locales = [
    { id: 'en', label: 'English' },
    { id: 'zh-Hans', label: '简体中文' },
    { id: 'zh-Hant', label: '繁體中文' }
  ];
  var href = function (loc) {
    return base + '/' + loc + '/book/' + (bookPath || '');
  };
  var root = document.getElementById('claw-locale-switcher');
  if (!root) return;
  root.innerHTML = '<div class="claw-locale-bar">' +
    locales.map(function (loc) {
      var isCurrent = loc.id === currentLocale;
      return '<a href="' + href(loc.id) + '" class="claw-locale-link' + (isCurrent ? ' current' : '') + '">' + loc.label + '</a>';
    }).join('') +
    '</div>';
  root.style.cssText = 'padding:0.5rem 0.75rem;background:#f5f5f5;border-radius:6px;font-size:0.9rem;';
  var style = document.createElement('style');
  style.textContent = '.claw-locale-bar{display:flex;gap:0.75rem;flex-wrap:wrap;align-items:center;}.claw-locale-link{color:#0066cc;text-decoration:none;}.claw-locale-link:hover{text-decoration:underline;}.claw-locale-link.current{font-weight:bold;color:#333;}';
  document.head.appendChild(style);
})();
