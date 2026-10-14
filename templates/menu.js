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

  /* ---------- «Открыто сейчас» / «Закрыто» по времени кафе ---------- */
  var badge = doc.querySelector('[data-schedule]');
  if (badge) {
    var sched = JSON.parse(badge.getAttribute('data-schedule')); // { o: UTC-смещение, w: [[[откр, закр], ...] × 7] }
    var DAYS_RU = ['в понедельник', 'во вторник', 'в среду', 'в четверг', 'в пятницу', 'в субботу', 'в воскресенье'];
    var DAYS_EN = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    var hm = function (m) {
      m = m % 1440;
      var h = Math.floor(m / 60), mm = m % 60;
      return (h < 10 ? '0' : '') + h + ':' + (mm < 10 ? '0' : '') + mm;
    };
    var both = function (ru, en) {
      return '<span class="t-ru">' + ru + '</span><span class="t-en" lang="en">' + en + '</span>';
    };

    var renderStatus = function () {
      // «Сейчас» в часовом поясе кафе (по умолчанию Москва, UTC+3), неделя с понедельника.
      var now = new Date(Date.now() + sched.o * 3600000);
      var day = (now.getUTCDay() + 6) % 7;
      var min = now.getUTCHours() * 60 + now.getUTCMinutes();
      var w = sched.w, i, iv;

      var closeAt = null, allDay = false;
      for (i = 0; i < w[day].length; i++) {
        iv = w[day][i];
        if (min >= iv[0] && min < iv[1]) { closeAt = iv[1]; allDay = iv[1] - iv[0] >= 1440; }
      }
      var prev = w[(day + 6) % 7];
      for (i = 0; i < prev.length && closeAt === null; i++) {
        iv = prev[i]; // интервал вчерашнего дня, заходящий за полночь
        if (iv[1] > 1440 && min < iv[1] - 1440) closeAt = iv[1] - 1440;
      }

      var html;
      if (closeAt !== null) {
        badge.className = 'status status--open';
        html = both('Открыто сейчас', 'Open now') + '<small>' +
          (allDay ? both('круглосуточно', '24 hours') : both('до ' + hm(closeAt), 'until ' + hm(closeAt))) + '</small>';
      } else {
        badge.className = 'status status--closed';
        html = both('Закрыто', 'Closed');
        for (var k = 0; k < 8; k++) {
          var d = (day + k) % 7, next = null;
          for (i = 0; i < w[d].length; i++) {
            iv = w[d][i];
            if ((k > 0 || iv[0] > min) && (next === null || iv[0] < next)) next = iv[0];
          }
          if (next === null) continue;
          var at = hm(next);
          html += '<small>' + (k === 0 ? both('откроется в ' + at, 'opens at ' + at)
            : k === 1 ? both('откроется завтра в ' + at, 'opens tomorrow at ' + at)
            : both('откроется ' + DAYS_RU[d] + ' в ' + at, 'opens ' + DAYS_EN[d] + ' at ' + at)) + '</small>';
          break;
        }
      }
      badge.innerHTML = html;
      badge.hidden = false;
    };
    renderStatus();
    setInterval(renderStatus, 60000);
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
