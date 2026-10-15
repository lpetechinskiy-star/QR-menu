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

  /* ---------- «Мой выбор»: корзина без сервера ---------- */
  var cfgEl = doc.getElementById('cart-cfg');
  if (cfgEl) initCart(JSON.parse(cfgEl.textContent));

  function initCart(C) {
    var KEY = 'qrmenu-cart:' + C.slug;
    var TABLE_KEY = 'qrmenu-table:' + C.slug;

    function store(kind, key, value) {
      try {
        var s = kind === 'session' ? sessionStorage : localStorage;
        if (value === undefined) return s.getItem(key);
        if (value === null) s.removeItem(key); else s.setItem(key, value);
      } catch (e) {}
      return null;
    }

    function esc(text) {
      return String(text).replace(/[&<>"']/g, function (ch) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
      });
    }
    function both(ru, en) {
      return '<span class="t-ru">' + ru + '</span><span class="t-en" lang="en">' + (en || ru) + '</span>';
    }
    function isEn() { return root.getAttribute('data-lang') === 'en'; }
    function money(n) {
      var num = String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
      if (!C.cur) return num;
      return C.curBefore ? C.cur + num : num + ' ' + C.cur;
    }

    /* Блюда на странице — источник правды для названий и цен */
    var dishes = {};
    doc.querySelectorAll('.dish[data-id]').forEach(function (el) {
      var variants = null;
      try { variants = el.getAttribute('data-variants') ? JSON.parse(el.getAttribute('data-variants')) : null; } catch (e) {}
      dishes[el.getAttribute('data-id')] = {
        el: el,
        name: el.getAttribute('data-name'),
        nameEn: el.getAttribute('data-name-en') || el.getAttribute('data-name'),
        price: Number(el.getAttribute('data-price')),
        variants: variants
      };
    });

    /* Стол: ?table=N, запоминаем на время сессии */
    var table = null;
    var param = /[?&]table=([^&#]+)/.exec(location.search);
    if (param) {
      table = decodeURIComponent(param[1]).replace(/[^\w-]/g, '').slice(0, 10) || null;
      store('session', TABLE_KEY, table);
    } else {
      table = store('session', TABLE_KEY);
    }

    /* Состояние: строки по порядку добавления; ключ строки = id блюда + номер варианта */
    var state = { lines: [], comment: '' };
    try {
      var saved = JSON.parse(store('local', KEY) || 'null');
      if (saved && Array.isArray(saved.lines)) {
        state.comment = typeof saved.comment === 'string' ? saved.comment.slice(0, 500) : '';
        saved.lines.forEach(function (l) {
          var d = dishes[l.id];
          var vOk = l.v === null ? !d || !d.variants : d && d.variants && d.variants[l.v];
          if (d && vOk && l.q > 0) state.lines.push({ id: l.id, v: l.v, q: Math.min(99, Math.floor(l.q)) });
        });
      }
    } catch (e) {}

    function save() {
      store('local', KEY, JSON.stringify(state));
    }

    function lineInfo(l) {
      var d = dishes[l.id];
      var v = l.v !== null ? d.variants[l.v] : null;
      return {
        name: d.name, nameEn: d.nameEn,
        variant: v ? v.n : '', variantEn: v ? (v.ne || v.n) : '',
        price: v ? v.p : d.price
      };
    }
    function findLine(id, v) {
      for (var i = 0; i < state.lines.length; i++) {
        if (state.lines[i].id === id && state.lines[i].v === v) return state.lines[i];
      }
      return null;
    }
    function totals() {
      var count = 0, sum = 0;
      state.lines.forEach(function (l) { count += l.q; sum += l.q * lineInfo(l).price; });
      return { count: count, sum: sum };
    }
    function dishQty(id) {
      var q = 0;
      state.lines.forEach(function (l) { if (l.id === id) q += l.q; });
      return q;
    }

    function add(id, v) {
      var l = findLine(id, v);
      if (l) l.q = Math.min(99, l.q + 1);
      else state.lines.push({ id: id, v: v, q: 1 });
      changed(id);
    }
    function dec(id, v) {
      var l = findLine(id, v);
      if (!l) return;
      l.q -= 1;
      if (l.q <= 0) state.lines.splice(state.lines.indexOf(l), 1);
      changed(id);
    }
    function decDish(id) {
      // «−» на карточке блюда с вариантами убирает последний добавленный вариант
      for (var i = state.lines.length - 1; i >= 0; i--) {
        if (state.lines[i].id === id) return dec(id, state.lines[i].v);
      }
    }
    function changed(id) {
      save();
      if (id) renderDish(id, true); else Object.keys(dishes).forEach(function (k) { renderDish(k); });
      renderBar();
      if (sheetMode === 'cart') renderCart();
    }

    /* ---- Кнопки на карточках ---- */
    function renderDish(id, animate) {
      var box = dishes[id].el.querySelector('[data-qty]');
      if (!box) return;
      var q = dishQty(id);
      box.innerHTML = q
        ? '<span class="stepper' + (animate ? ' is-bump' : '') + '"><button type="button" data-dec aria-label="−">−</button>' +
          '<span aria-live="polite">' + q + '</span><button type="button" data-inc aria-label="+">+</button></span>'
        : '<button type="button" class="add" data-add aria-label="+">+</button>';
    }
    Object.keys(dishes).forEach(function (id) { renderDish(id); });

    doc.addEventListener('click', function (e) {
      var btn = e.target.closest && e.target.closest('[data-add],[data-inc],[data-dec]');
      if (!btn) return;
      var dishEl = btn.closest('.dish[data-id]');
      if (!dishEl) return;
      var id = dishEl.getAttribute('data-id');
      if (btn.hasAttribute('data-dec')) return decDish(id);
      if (dishes[id].variants) return openPicker(id);
      add(id, null);
    });

    /* ---- Плавающая кнопка ---- */
    var bar = doc.createElement('button');
    bar.type = 'button';
    bar.className = 'cart-bar';
    bar.setAttribute('aria-haspopup', 'dialog');
    doc.body.appendChild(bar);
    bar.addEventListener('click', function () { openSheet('cart'); });
    var guard = doc.createElement('div');
    guard.className = 'edge-guard';
    guard.setAttribute('aria-hidden', 'true');
    doc.body.appendChild(guard);

    function renderBar() {
      var t = totals();
      bar.innerHTML = '<span>' + both('Мой выбор', 'My order') + ' · <b>' + t.count + '</b></span><span>' + esc(money(t.sum)) + '</span>';
      var visible = t.count > 0 && !sheetMode;
      bar.classList.toggle('is-visible', visible);
      bar.tabIndex = visible ? 0 : -1;
      doc.body.classList.toggle('has-cart', t.count > 0);
    }

    /* ---- Нижний лист ---- */
    var backdrop = doc.createElement('div');
    backdrop.className = 'sheet-backdrop';
    var sheet = doc.createElement('div');
    sheet.className = 'sheet';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.setAttribute('aria-hidden', 'true');
    doc.body.appendChild(backdrop);
    doc.body.appendChild(sheet);
    var sheetMode = null;
    var pickerId = null;
    var lastFocus = null;

    function openSheet(mode, id) {
      lastFocus = doc.activeElement;
      if (mode === 'cart' && view !== 'sent') view = 'list';
      sheetMode = mode;
      pickerId = id || null;
      if (mode === 'cart') renderCart(); else renderPicker();
      root.classList.add('is-locked');
      backdrop.classList.add('is-open');
      sheet.classList.add('is-open');
      sheet.setAttribute('aria-hidden', 'false');
      renderBar();
      setTimeout(function () {
        var f = sheet.querySelector('[data-close]');
        if (f) f.focus({ preventScroll: true });
      }, 50);
    }
    function openPicker(id) { openSheet('picker', id); }
    function closeSheet() {
      if (!sheetMode) return;
      sheetMode = null;
      root.classList.remove('is-locked');
      backdrop.classList.remove('is-open');
      sheet.classList.remove('is-open');
      sheet.setAttribute('aria-hidden', 'true');
      renderBar();
      if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    }
    backdrop.addEventListener('click', closeSheet);
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSheet(); });
    // Смена языка при открытом листе — перерисовать (плейсхолдеры)
    doc.querySelectorAll('[data-set]').forEach(function (b) {
      b.addEventListener('click', function () { if (sheetMode === 'cart') renderCart(); });
    });

    function head(ru, en) {
      return '<div class="sheet__grab"></div><div class="sheet__head"><h2 class="sheet__title">' + both(ru, en) +
        '</h2><button type="button" class="sheet__close" data-close aria-label="Закрыть">×</button></div>';
    }

    /* Выбор варианта (250 / 350 мл) */
    function renderPicker() {
      var d = dishes[pickerId];
      var rows = d.variants.map(function (v, i) {
        return '<button type="button" class="pick" data-pick="' + i + '"><span>' + both(esc(v.n), esc(v.ne || v.n)) +
          '</span><b>' + esc(money(v.p)) + '</b></button>';
      }).join('');
      sheet.innerHTML = head(esc(d.name), esc(d.nameEn)) +
        '<div class="sheet__body"><p class="sheet__hint">' + both('Выберите вариант', 'Choose a size') + '</p><div class="picks">' + rows + '</div></div>';
    }

    /* Корзина и оформление */
    var view = 'list'; // list | sent | waiter | error
    function renderCart() {
      var t = totals();
      if (!t.count && view === 'list') {
        sheet.innerHTML = head('Мой выбор', 'My order') +
          '<div class="sheet__body"><p class="sheet__empty">' + both('Пока ничего не выбрано', 'Nothing here yet') + '</p></div>';
        return;
      }
      if (view === 'waiter') return renderWaiter();
      if (view === 'sent') return renderSent();

      var lines = state.lines.map(function (l) {
        var info = lineInfo(l);
        var key = esc(l.id) + '" data-v="' + (l.v === null ? '' : l.v);
        return '<li class="line"><div><div class="line__name">' + both(esc(info.name), esc(info.nameEn)) +
          (info.variant ? ' <span class="line__variant">' + both(esc(info.variant), esc(info.variantEn)) + '</span>' : '') +
          '</div><div class="line__sub">' + esc(money(info.price)) + ' × ' + l.q + ' = <b>' + esc(money(info.price * l.q)) + '</b></div></div>' +
          '<span class="stepper stepper--soft"><button type="button" data-line-dec="' + key + '" aria-label="−">−</button><span>' + l.q +
          '</span><button type="button" data-line-inc="' + key + '" aria-label="+">+</button></span></li>';
      }).join('');

      var where = table
        ? '<div class="field-label">' + both('Где вы', 'Where you are') + '</div><div class="table-chip">' + both('Стол ' + esc(table), 'Table ' + esc(table)) + '</div>'
        : '';

      sheet.innerHTML = head('Мой выбор', 'My order') +
        '<div class="sheet__body"><ul class="lines">' + lines + '</ul>' +
        '<div class="total"><span>' + both('Итого', 'Total') + '</span><span>' + esc(money(t.sum)) + '</span></div>' +
        where +
        '<label class="field-label" for="cart-comment">' + both('Комментарий', 'Comment') + '</label>' +
        '<textarea id="cart-comment" class="comment" maxlength="500" rows="2" placeholder="' +
        esc(isEn() ? C.hintEn || 'E.g. no sugar, oat milk' : C.hint || 'Например: без сахара, на овсяном молоке') + '">' + esc(state.comment) + '</textarea>' +
        (view === 'error' ? '<p class="hint-error">' + both('Не удалось отправить заказ. Покажите этот экран официанту.', 'Couldn’t send the order. Please show this screen to the staff.') + '</p>' : '') +
        '</div><div class="sheet__foot"><button type="button" class="btn-wide" data-checkout>' + both('Оформить заказ', 'Place order') +
        ' · ' + esc(money(t.sum)) + '</button><button type="button" class="btn-ghost" data-clear>' + both('Очистить', 'Clear all') + '</button></div>';
    }

    function summaryHtml() {
      var t = totals();
      var rows = state.lines.map(function (l) {
        var info = lineInfo(l);
        return '<li><span>' + esc(info.name) + (info.variant ? ', ' + esc(info.variant) : '') + ' × ' + l.q + '</span><b>' + esc(money(info.price * l.q)) + '</b></li>';
      }).join('');
      return '<div class="receipt">' + (table ? '<div class="receipt__where">' + esc(whereText()) + '</div>' : '') + '<ul>' + rows + '</ul>' +
        '<div class="receipt__total"><span>Итого</span><b>' + esc(money(t.sum)) + '</b></div>' +
        (state.comment ? '<p class="receipt__comment">' + esc(state.comment) + '</p>' : '') + '</div>';
    }
    function renderWaiter() {
      sheet.innerHTML = head('Ваш заказ', 'Your order') +
        '<div class="sheet__body"><p class="waiter-note">' + both('Покажите этот экран официанту', 'Show this screen to the staff') + '</p>' + summaryHtml() + '</div>' +
        '<div class="sheet__foot"><button type="button" class="btn-ghost" data-back>' + both('← Изменить заказ', '← Edit order') + '</button></div>';
    }
    function renderSent() {
      var chat = C.via === 'whatsapp' ? 'WhatsApp' : 'Telegram';
      var msg = C.endpoint
        ? both('Заказ отправлен ✓', 'Order sent ✓')
        : both('Заказ открыт в ' + chat + ' — нажмите «Отправить» в чате', 'Your order is ready in ' + chat + ' — tap Send in the chat');
      sheet.innerHTML = head('Готово', 'Done') +
        '<div class="sheet__body"><p class="sent-note">' + msg + '</p>' + summaryHtml() + '</div>' +
        '<div class="sheet__foot">' + (C.endpoint ? '' : '<button type="button" class="btn-wide" data-reopen>' + both('Открыть ' + chat + ' ещё раз', 'Open ' + chat + ' again') + '</button>') +
        '<button type="button" class="btn-ghost" data-done>' + both('Новый заказ', 'New order') + '</button></div>';
    }

    function whereText() {
      if (table) return 'Стол ' + table;
      return '';
    }
    function orderText() {
      var t = totals();
      var out = ['Заказ — ' + C.name];
      if (whereText()) out.push(whereText());
      out.push('');
      state.lines.forEach(function (l) {
        var info = lineInfo(l);
        out.push('• ' + info.name + (info.variant ? ' (' + info.variant + ')' : '') + ' × ' + l.q + ' — ' + money(info.price * l.q));
      });
      out.push('', 'Итого: ' + money(t.sum));
      if (state.comment) out.push('Комментарий: ' + state.comment);
      return out.join('\n');
    }
    function orderJson() {
      return {
        cafe: C.slug,
        table: table,
        items: state.lines.map(function (l) {
          var info = lineInfo(l);
          return { id: l.id, name: info.name, variant: info.variant || null, price: info.price, qty: l.q, sum: info.price * l.q };
        }),
        total: totals().sum,
        comment: state.comment,
        lang: isEn() ? 'en' : 'ru',
        createdAt: new Date().toISOString()
      };
    }
    function chatUrl() {
      var text = encodeURIComponent(orderText());
      if (C.via === 'whatsapp') return 'https://wa.me/' + C.contact.replace(/\D/g, '') + '?text=' + text;
      var user = C.contact.replace(/^@/, '').replace(/^https?:\/\/t\.me\//, '');
      return 'https://t.me/' + user + '?text=' + text;
    }
    function openChat() {
      var w = window.open(chatUrl(), '_blank', 'noopener');
      if (!w) location.href = chatUrl();
    }

    function checkout() {
      if (C.endpoint) {
        var btn = sheet.querySelector('[data-checkout]');
        if (btn) { btn.disabled = true; btn.innerHTML = both('Отправляем…', 'Sending…'); }
        fetch(C.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(orderJson()) })
          .then(function (r) { if (!r.ok) throw new Error(r.status); view = 'sent'; renderCart(); })
          .catch(function () { view = 'error'; renderCart(); });
        return;
      }
      if (C.via && C.contact) {
        openChat();
        view = 'sent';
        return renderCart();
      }
      view = 'waiter';
      renderCart();
    }

    sheet.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      if (b.hasAttribute('data-close')) return closeSheet();
      if (b.hasAttribute('data-pick')) {
        add(pickerId, Number(b.getAttribute('data-pick')));
        return closeSheet();
      }
      if (b.hasAttribute('data-line-inc') || b.hasAttribute('data-line-dec')) {
        var id = b.getAttribute(b.hasAttribute('data-line-inc') ? 'data-line-inc' : 'data-line-dec');
        var v = b.getAttribute('data-v') === '' ? null : Number(b.getAttribute('data-v'));
        if (b.hasAttribute('data-line-inc')) add(id, v); else dec(id, v);
        if (!totals().count) closeSheet();
        return;
      }
      if (b.hasAttribute('data-clear')) {
        state.lines = []; state.comment = ''; view = 'list';
        changed(null);
        return closeSheet();
      }
      if (b.hasAttribute('data-checkout')) return checkout();
      if (b.hasAttribute('data-back')) { view = 'list'; return renderCart(); }
      if (b.hasAttribute('data-reopen')) return openChat();
      if (b.hasAttribute('data-done')) {
        state.lines = []; state.comment = ''; view = 'list';
        changed(null);
        return closeSheet();
      }
    });
    sheet.addEventListener('input', function (e) {
      if (e.target.id === 'cart-comment') { state.comment = e.target.value.slice(0, 500); save(); }
    });

    renderBar();
  }
})();
