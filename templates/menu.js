/* QR-меню: поведение страницы. Генератор встраивает этот файл в <script>. */
(function () {
  var doc = document;
  var root = doc.documentElement;

  /* ---------- RU / EN ---------- */
  function setLang(lang, save) {
    root.setAttribute('data-lang', lang);
    root.setAttribute('lang', lang);
    var title = root.getAttribute('data-title-' + lang);
    if (title) doc.title = title;
    if (save) {
      try { localStorage.setItem('qrmenu-lang', lang); } catch (e) {}
    }
  }

  doc.querySelectorAll('[data-set]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      setLang(btn.getAttribute('data-set'), true);
    });
  });

  /* ---------- Подсветка активного раздела в навигации ---------- */
  var nav = doc.querySelector('.nav__inner');
  var links = nav ? nav.querySelectorAll('a[href^="#"]') : [];
  var byId = {};
  links.forEach(function (a) { byId[a.getAttribute('href').slice(1)] = a; });

  function activate(id) {
    var link = byId[id];
    if (!link || link.getAttribute('aria-current') === 'true') return;
    links.forEach(function (a) { a.removeAttribute('aria-current'); });
    link.setAttribute('aria-current', 'true');
    // Прокручиваем саму ленту навигации так, чтобы активный пункт был виден.
    var left = link.offsetLeft - (nav.clientWidth - link.offsetWidth) / 2;
    if (nav.scrollTo) nav.scrollTo({ left: left, behavior: 'smooth' });
    else nav.scrollLeft = left;
  }

  // Активный раздел — последний, чей заголовок уже прошёл под навигацию.
  var targets = [];
  Object.keys(byId).forEach(function (id) {
    var el = doc.getElementById(id);
    if (el) targets.push(el);
  });
  var ticking = false;
  function update() {
    ticking = false;
    var current = targets[0];
    var line = nav.offsetHeight + 24;
    for (var i = 0; i < targets.length; i++) {
      if (targets[i].getBoundingClientRect().top <= line) current = targets[i];
    }
    // Долистали до конца страницы — активен последний раздел.
    if (window.innerHeight + window.scrollY >= doc.documentElement.scrollHeight - 4) {
      current = targets[targets.length - 1];
    }
    if (current) activate(current.id);
  }
  if (targets.length) {
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }

  /* ---------- Копирование пароля Wi-Fi ---------- */
  doc.querySelectorAll('[data-copy]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var text = btn.getAttribute('data-copy');
      function done() {
        btn.classList.add('is-copied');
        setTimeout(function () { btn.classList.remove('is-copied'); }, 1800);
      }
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(done, fallback);
      } else {
        fallback();
      }
      function fallback() {
        var ta = doc.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        doc.body.appendChild(ta);
        ta.select();
        try { doc.execCommand('copy'); done(); } catch (e) {}
        doc.body.removeChild(ta);
      }
    });
  });
})();
