#!/usr/bin/env node
/*
 * Генератор QR-меню.
 *
 *   npm run build                      — собрать все кафе из clients/
 *   npm run build -- demo-cafe         — собрать одно кафе
 *   npm run build -- demo-cafe --open  — собрать и открыть в браузере
 *
 * Адрес страницы: <адрес сайта>/<папка-кафе>/ (от него строятся QR и og:url).
 * Адрес сайта: https://<customDomain>, если он задан в config.json, иначе baseUrl.
 *
 * Флаги:
 *   --base-url=https://...  — временно заменить адрес сайта из config.json
 *   --no-pdf                — не делать PDF тейбл-тентов
 *   --open                  — открыть готовую страницу в браузере
 *
 * Результат: dist/<папка-кафе>/
 *   index.html                        — страница меню (CSS и JS встроены, один запрос)
 *   qr.png, qr.svg                    — QR-код на страницу
 *   table-tent.html / .pdf            — тейбл-тент A6 для домашней печати (без вылетов)
 *   table-tent-print.html / .pdf      — для типографии: вылеты 3 мм и метки реза
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const QRCode = require('qrcode');

const ROOT = path.resolve(__dirname, '..');
const CONFIG_FILE = path.join(ROOT, 'config.json');
const CLIENTS_DIR = path.join(ROOT, 'clients');
const DIST_DIR = path.join(ROOT, 'dist');
const TEMPLATES_DIR = path.join(ROOT, 'templates');

const THEMES = ['light', 'dark', 'warm'];
const INLINE_LOGO_MAX_BYTES = 30 * 1024;

/* ------------------------------------------------------------------ */
/* Тексты интерфейса                                                   */
/* ------------------------------------------------------------------ */

const UI = {
  ru: {
    call: 'Позвонить',
    book: 'Забронировать',
    message: 'Написать',
    route: 'Маршрут',
    navInfo: 'Инфо',
    info: 'Информация',
    hours: 'Часы работы',
    address: 'Адрес',
    wifi: 'Wi-Fi',
    network: 'Сеть',
    password: 'Пароль',
    copy: 'Скопировать пароль',
    copied: 'Скопировано ✓',
    contacts: 'Контакты',
    yandex: 'Яндекс Карты',
    dgis: '2ГИС',
    google: 'Google Maps',
    out: 'Нет в наличии',
    website: 'Сайт',
    vk: 'ВКонтакте',
    menuTitle: 'меню',
    description: 'Меню, часы работы и контакты',
    tentMenu: 'Меню',
    tentScan: 'Наведите камеру телефона на QR-код',
    tentWifiHint: 'Отсканируйте, чтобы подключиться',
    credit: 'Сделано',
  },
  en: {
    call: 'Call',
    book: 'Book a table',
    message: 'Message us',
    route: 'Directions',
    navInfo: 'Info',
    info: 'Information',
    hours: 'Opening hours',
    address: 'Address',
    wifi: 'Wi-Fi',
    network: 'Network',
    password: 'Password',
    copy: 'Copy password',
    copied: 'Copied ✓',
    contacts: 'Contacts',
    yandex: 'Yandex Maps',
    dgis: '2GIS',
    google: 'Google Maps',
    out: 'Unavailable',
    website: 'Website',
    vk: 'VK',
    menuTitle: 'menu',
    description: 'Menu, opening hours and contacts',
    tentMenu: 'Menu',
    tentScan: 'Point your phone camera at the QR code',
    tentWifiHint: 'Scan to connect',
    credit: 'Made by',
  },
};

const TAGS = {
  hit: { ru: 'Хит', en: 'Bestseller' },
  new: { ru: 'Новинка', en: 'New' },
  veg: { ru: 'Вегетарианское', en: 'Vegetarian' },
  vegan: { ru: 'Веган', en: 'Vegan' },
  spicy: { ru: 'Острое', en: 'Spicy' },
};

const SOCIAL_LABELS = {
  telegram: 'Telegram',
  vk: { ru: 'ВКонтакте', en: 'VK' },
  instagram: 'Instagram',
  whatsapp: 'WhatsApp',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  dzen: 'Дзен',
  ok: 'Одноклассники',
  facebook: 'Facebook',
  website: { ru: 'Сайт', en: 'Website' },
};

/* Иконки (24×24, обводка). Подключаются один раз спрайтом. */
const ICONS = {
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>',
  route: '<path d="M3 11 22 2l-9 19-2-8-8-2z"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  wifi: '<path d="M5 12.6a11 11 0 0 1 14 0M1.4 9a16 16 0 0 1 21.2 0M8.5 16.1a6 6 0 0 1 7 0M12 20h.01"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
};

/* ------------------------------------------------------------------ */
/* Утилиты                                                             */
/* ------------------------------------------------------------------ */

const warnings = [];
function warn(slug, msg) {
  warnings.push(`[${slug}] ${msg}`);
}

class BuildError extends Error {}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isFilled(v) {
  return v !== undefined && v !== null && String(v).trim() !== '';
}

/** Пропускаем только безопасные схемы ссылок. */
function safeUrl(u) {
  if (!isFilled(u)) return null;
  const s = String(u).trim();
  if (/^(https?:|tel:|mailto:|tg:|viber:|whatsapp:)/i.test(s)) return s;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) return s; // относительная ссылка
  return null;
}

function telHref(phone) {
  return 'tel:' + String(phone).replace(/[^\d+]/g, '');
}

const TRANSLIT = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
  х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

function slugify(text) {
  return String(text)
    .toLowerCase()
    .split('')
    .map((ch) => (ch in TRANSLIT ? TRANSLIT[ch] : ch))
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** «250 г» → «250 g» для английской версии, если weight_en не задан. */
function unitsToEn(text) {
  const units = { г: 'g', гр: 'g', кг: 'kg', мл: 'ml', л: 'l', шт: 'pcs', см: 'cm' };
  return String(text).replace(/(\d)\s*(кг|гр|г|мл|л|шт|см)\.?(?![а-яё])/gi, (_, d, u) => `${d} ${units[u.toLowerCase()]}`);
}

function hasEnglish(node) {
  if (Array.isArray(node)) return node.some(hasEnglish);
  if (node && typeof node === 'object') {
    return Object.entries(node).some(([k, v]) => (k.endsWith('_en') && isFilled(v)) || hasEnglish(v));
  }
  return false;
}

/** Читает переменные тем из menu.css — палитра хранится в одном месте. */
function parseThemes(css) {
  const themes = {};
  const re = /\[data-theme="(\w+)"\]\s*\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(css))) {
    const vars = {};
    for (const decl of m[2].split(';')) {
      const mm = /^\s*(--[\w-]+)\s*:\s*(.+?)\s*$/.exec(decl);
      if (mm) vars[mm[1]] = mm[2];
    }
    themes[m[1]] = vars;
  }
  return themes;
}

function minifyCss(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}:;,>])\s*/g, '$1')
    .replace(/;}/g, '}')
    .trim();
}

function minifyJs(js) {
  // Безопасная «лёгкая» минификация: убираем блочные комментарии и пустые строки.
  return js
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('//'))
    .join('\n');
}

function fill(template, values) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => (key in values ? values[key] : ''));
}

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

/** Чёрный или белый текст поверх акцентного цвета — что контрастнее. */
function inkFor(hex) {
  const rgb = hexToRgb(hex);
  const lum = rgb
    .map((c) => {
      c /= 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    })
    .reduce((acc, c, i) => acc + c * [0.2126, 0.7152, 0.0722][i], 0);
  const white = 1.05 / (lum + 0.05);
  const black = (lum + 0.05) / 0.05;
  // Белый — если он проходит WCAG AA (4.5:1), даже когда чёрный чуть контрастнее:
  // на насыщенных красных и розовых белый текст смотрится естественнее.
  return white >= 4.5 || white >= black ? '#ffffff' : '#111111';
}

function fileSize(p) {
  const b = fs.statSync(p).size;
  return b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} МБ` : `${Math.max(1, Math.round(b / 1024))} КБ`;
}

/** Общие настройки всех кафе: config.json в корне проекта. */
function loadConfig() {
  if (!fs.existsSync(CONFIG_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch (e) {
    throw new BuildError(`ошибка в config.json: ${e.message}`);
  }
}

/** Свой домен из config.json ("menu.site.ru" или "https://menu.site.ru") → "menu.site.ru" или null. */
function customDomain(config) {
  if (!isFilled(config.customDomain)) return null;
  const raw = String(config.customDomain).trim();
  try {
    return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).hostname;
  } catch (e) {
    throw new BuildError(`customDomain "${raw}" — нужен домен вида menu.site.ru`);
  }
}

/** Адрес сайта: https://<customDomain>, если задан, иначе baseUrl. */
function siteBaseUrl(config) {
  const domain = customDomain(config);
  if (domain) return `https://${domain}`;
  return isFilled(config.baseUrl) ? String(config.baseUrl).trim().replace(/\/+$/, '') : null;
}

/** Публичный адрес страницы кафе: <адрес сайта>/<папка>/ (или явный "url" в menu.json). */
function pageUrl(slug, cfg, baseUrl) {
  if (isFilled(cfg.url)) return String(cfg.url).trim();
  if (!isFilled(baseUrl)) return null;
  return String(baseUrl).trim().replace(/\/*$/, '/') + encodeURIComponent(slug) + '/';
}

/** booking: { type: phone|whatsapp|telegram|url, value } → ссылка для кнопки. */
function bookingHref(slug, booking) {
  if (!booking) return null;
  if (typeof booking === 'string') return safeUrl(booking);
  if (!isFilled(booking.type) && !isFilled(booking.value)) return null;
  const value = String(booking.value ?? '').trim();
  if (!value) {
    return null;
  }
  const isUrl = /^https?:\/\//i.test(value);
  switch (booking.type) {
    case 'phone':
      return telHref(value);
    case 'whatsapp': {
      if (isUrl) return value;
      let digits = value.replace(/\D/g, '');
      if (digits.length === 11 && digits.startsWith('8')) digits = '7' + digits.slice(1);
      return `https://wa.me/${digits}`;
    }
    case 'telegram':
      return isUrl ? value : `https://t.me/${value.replace(/^@/, '')}`;
    case 'url':
      return safeUrl(value);
    default:
      warn(slug, `booking: неизвестный type "${booking.type}" (нужно phone, whatsapp, telegram или url)`);
      return null;
  }
}

/* ---- Разбор часов работы для бейджа «Открыто сейчас» ---- */

const DAY_NAMES = [
  ['пн', 'пон', 'понедельник', 'mon', 'monday'],
  ['вт', 'вто', 'вторник', 'tue', 'tues', 'tuesday'],
  ['ср', 'сре', 'среда', 'wed', 'wednesday'],
  ['чт', 'чет', 'четверг', 'thu', 'thur', 'thurs', 'thursday'],
  ['пт', 'пят', 'пятница', 'fri', 'friday'],
  ['сб', 'суб', 'суббота', 'sat', 'saturday'],
  ['вс', 'вос', 'воскресенье', 'sun', 'sunday'],
];
const EVERY_DAY = /ежедневно|каждый день|без выходных|все дни|daily|every ?day/i;

function parseDay(token) {
  const t = token.trim().toLowerCase().replace(/\.$/, '');
  return DAY_NAMES.findIndex((names) => names.includes(t));
}

/** «Пн–Пт», «Сб, Вс», «Ежедневно» → [0..6] (0 — понедельник) или null. */
function parseDays(text) {
  if (!isFilled(text) || EVERY_DAY.test(text)) return [0, 1, 2, 3, 4, 5, 6];
  const days = new Set();
  for (const part of String(text).split(/\s*(?:,|;|\sи\s|&)\s*/)) {
    if (!part.trim()) continue;
    const range = part.split(/\s*[–—-]\s*/);
    const group = /^(будни|по будням|weekdays)$/i.test(part.trim())
      ? [0, 1, 2, 3, 4]
      : /^(выходные|по выходным|weekends?)$/i.test(part.trim())
        ? [5, 6]
        : null;
    if (group) {
      group.forEach((d) => days.add(d));
    } else if (range.length === 1) {
      const d = parseDay(range[0]);
      if (d < 0) return null;
      days.add(d);
    } else if (range.length === 2) {
      const a = parseDay(range[0]);
      const b = parseDay(range[1]);
      if (a < 0 || b < 0) return null;
      for (let d = a; ; d = (d + 1) % 7) {
        days.add(d);
        if (d === b) break;
      }
    } else return null;
  }
  return days.size ? [...days] : null;
}

/** «08:00–22:00» → [480, 1320]; через полночь «18:00–02:00» → [1080, 1560]. */
function parseTime(text) {
  const s = String(text ?? '').toLowerCase();
  if (/круглосуточно|24\s*\/\s*7|24 часа|24 hours|around the clock/.test(s)) return [0, 1440];
  if (/выходной|закрыто|closed|day off/.test(s)) return 'closed';
  const m = /(\d{1,2})[:.](\d{2})\s*[–—-]\s*(\d{1,2})[:.](\d{2})/.exec(s);
  if (!m) return null;
  const open = +m[1] * 60 + +m[2];
  let close = +m[3] * 60 + +m[4];
  if (close <= open) close += 1440;
  return [open, close];
}

/** Расписание по дням недели: [[ [open, close], ... ], ...×7] или null, если не разобрали. */
function parseSchedule(slug, hours) {
  const week = [[], [], [], [], [], [], []];
  for (const h of hours) {
    let daysText;
    let timeText;
    if (typeof h === 'string') {
      const idx = h.search(/\d|круглосуточно|выходной|closed/i);
      daysText = idx > 0 ? h.slice(0, idx) : '';
      timeText = idx >= 0 ? h.slice(idx) : h;
    } else {
      daysText = h.days;
      timeText = h.time;
    }
    const days = parseDays(daysText);
    const time = parseTime(timeText);
    if (!days || !time) {
      const shown = typeof h === 'string' ? h : `${h.days ?? ''} ${h.time ?? ''}`.trim();
      warn(slug, `не удалось разобрать часы «${shown}» — бейдж «Открыто/Закрыто» не показан`);
      return null;
    }
    if (time === 'closed') continue;
    for (const d of days) week[d].push(time);
  }
  return week;
}

/** Метки реза для листа: обрезной формат 105×148 мм, поле slug мм, вылеты bleed мм. */
function cropMarks(slug, bleed) {
  const W = 105 + 2 * slug;
  const H = 148 + 2 * slug;
  const xs = [slug, slug + 105];
  const ys = [slug, slug + 148];
  const lines = [];
  for (const x of xs) {
    lines.push([x, 0, x, slug - bleed], [x, H - slug + bleed, x, H]);
  }
  for (const y of ys) {
    lines.push([0, y, slug - bleed, y], [W - slug + bleed, y, W, y]);
  }
  const d = lines.map(([x1, y1, x2, y2]) => `M${x1} ${y1}L${x2} ${y2}`).join('');
  // 0.25 pt ≈ 0.088 мм — стандартная толщина меток реза
  return `<svg class="marks" viewBox="0 0 ${W} ${H}" aria-hidden="true"><path d="${d}" stroke="#000" stroke-width="0.088" fill="none"/></svg>`;
}

/** @font-face для тейбл-тента со шрифтами, встроенными в HTML (data: URI). */
let fontsCss = null;
function inlineFonts() {
  if (fontsCss !== null) return fontsCss;
  const dir = path.join(TEMPLATES_DIR, 'fonts');
  const file = path.join(dir, 'fonts.css');
  fontsCss = fs.existsSync(file)
    ? fs.readFileSync(file, 'utf8').replace(/url\(([^)]+\.woff2)\)/g, (_, name) => {
        const data = fs.readFileSync(path.join(dir, name)).toString('base64');
        return `url(data:font/woff2;base64,${data})`;
      })
    : '';
  return fontsCss;
}

/** Метка сборки: время (МСК) и коммит исходников — чтобы сверить, какая версия на сайте. */
let buildInfoCache = null;
function buildInfo() {
  if (buildInfoCache) return buildInfoCache;
  const now = new Date(Date.now() + 3 * 3600000); // Москва, UTC+3
  const pad = (n) => String(n).padStart(2, '0');
  const date = `${pad(now.getUTCDate())}.${pad(now.getUTCMonth() + 1)}.${now.getUTCFullYear()}`;
  const time = `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}`;
  let commit = '';
  try {
    commit = require('child_process')
      .execSync('git rev-parse --short HEAD', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch (e) {
    /* не git-репозиторий — без коммита */
  }
  buildInfoCache = { date, stamp: `${date} ${time} МСК${commit ? ` · ${commit}` : ''}` };
  return buildInfoCache;
}

/* ------------------------------------------------------------------ */
/* Сборка одного кафе                                                  */
/* ------------------------------------------------------------------ */

function loadClient(slug) {
  const dir = path.join(CLIENTS_DIR, slug);
  const file = path.join(dir, 'menu.json');
  if (!fs.existsSync(file)) throw new BuildError(`нет файла ${path.relative(ROOT, file)}`);
  let cfg;
  try {
    cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    throw new BuildError(`ошибка в menu.json: ${e.message}`);
  }

  if (!isFilled(cfg.name)) throw new BuildError('не заполнено поле "name"');
  if (!Array.isArray(cfg.sections) || cfg.sections.length === 0) {
    throw new BuildError('нужен хотя бы один раздел в "sections"');
  }
  cfg.sections.forEach((s, i) => {
    if (!isFilled(s.title)) throw new BuildError(`у раздела №${i + 1} нет "title"`);
    if (!Array.isArray(s.items)) throw new BuildError(`у раздела «${s.title}» нет списка "items"`);
    s.items.forEach((it, j) => {
      if (!isFilled(it.name)) throw new BuildError(`раздел «${s.title}», блюдо №${j + 1}: нет "name"`);
      if (!isFilled(it.price) && !Array.isArray(it.variants)) {
        warn(slug, `«${it.name}»: не указана цена`);
      }
    });
  });
  if (cfg.theme && !THEMES.includes(cfg.theme)) {
    warn(slug, `неизвестная тема "${cfg.theme}", использую "light". Доступны: ${THEMES.join(', ')}`);
    cfg.theme = 'light';
  }
  if (!/^[a-z0-9_-]+$/.test(slug)) {
    warn(slug, 'имя папки лучше писать латиницей без пробелов — оно станет частью адреса страницы');
  }
  return { dir, cfg };
}

/** Копирует локальный файл клиента в dist и возвращает путь для HTML. */
function useAsset(slug, clientDir, outDir, ref, { inlineSvg = false } = {}) {
  if (!isFilled(ref)) return null;
  const s = String(ref).trim();
  if (/^https?:\/\//i.test(s)) return s;

  const rel = path.normalize(s);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    warn(slug, `файл "${s}" должен лежать внутри папки кафе`);
    return null;
  }
  const src = path.join(clientDir, rel);
  if (!fs.existsSync(src)) {
    warn(slug, `файл не найден: ${path.relative(ROOT, src)}`);
    return null;
  }
  if (inlineSvg && /\.svg$/i.test(src) && fs.statSync(src).size <= INLINE_LOGO_MAX_BYTES) {
    return 'data:image/svg+xml;base64,' + fs.readFileSync(src).toString('base64');
  }
  const dest = path.join(outDir, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  return rel.split(path.sep).map(encodeURIComponent).join('/');
}

function createRenderer(cfg) {
  const bilingual = hasEnglish(cfg);
  const lang = bilingual ? (cfg.defaultLang === 'en' ? 'en' : 'ru') : cfg.defaultLang === 'en' ? 'en' : 'ru';
  const uiLang = bilingual ? null : lang;

  /** Текст на двух языках: оба варианта в разметке, CSS показывает нужный. */
  function tx(ru, en) {
    if (!isFilled(ru) && !isFilled(en)) return '';
    if (!bilingual || !isFilled(en) || en === ru) return esc(isFilled(ru) ? ru : en);
    if (!isFilled(ru)) ru = en;
    return `<span class="t-ru">${esc(ru)}</span><span class="t-en" lang="en">${esc(en)}</span>`;
  }

  /** Поле объекта с переводом: field + field_en. */
  function f(obj, key) {
    return tx(obj[key], obj[key + '_en']);
  }

  function ui(key) {
    if (uiLang) return esc(UI[uiLang][key]);
    return tx(UI.ru[key], UI.en[key]);
  }

  function label(value) {
    if (value && typeof value === 'object') return tx(value.ru, value.en);
    return esc(value);
  }

  function plain(obj, key) {
    // Текст без разметки (для атрибутов, <title>) на основном языке.
    if (lang === 'en' && isFilled(obj[key + '_en'])) return obj[key + '_en'];
    return obj[key] ?? '';
  }

  return { bilingual, lang, tx, f, ui, label, plain };
}

function icon(name) {
  return `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
}

function iconSprite() {
  const symbols = Object.entries(ICONS)
    .map(([name, body]) => `<symbol id="i-${name}" viewBox="0 0 24 24">${body}</symbol>`)
    .join('');
  return `<svg width="0" height="0" style="position:absolute" aria-hidden="true">${symbols}</svg>`;
}

function formatMoney(value, currency) {
  if (typeof value === 'number') {
    const num = value.toLocaleString('ru-RU').replace(/\s/g, ' ');
    if (!currency) return num;
    return /^[$€£]$/.test(currency) ? `${currency}${num}` : `${num} ${currency}`;
  }
  return String(value ?? '');
}

function mapLinks(cfg) {
  const maps = cfg.maps || {};
  const links = [];
  if (safeUrl(maps.yandex)) links.push({ key: 'yandex', url: safeUrl(maps.yandex) });
  const dgis = maps['2gis'] || maps['2GIS'] || maps.dgis;
  if (safeUrl(dgis)) links.push({ key: 'dgis', url: safeUrl(dgis) });
  if (safeUrl(maps.google)) links.push({ key: 'google', url: safeUrl(maps.google) });
  if (!links.length && isFilled(cfg.address)) {
    links.push({ key: 'yandex', url: 'https://yandex.ru/maps/?text=' + encodeURIComponent(cfg.address) });
  }
  return links;
}

function linkAttrs(url) {
  return /^https?:/i.test(url) ? ' target="_blank" rel="noopener"' : '';
}

function renderPage({ slug, cfg, url, config, clientDir, outDir, templates, themes }) {
  const r = createRenderer(cfg);
  const { tx, f, ui, label } = r;
  const theme = cfg.theme || 'light';
  const currency = cfg.currency ?? '₽';

  /* ---- Логотип ---- */
  const logoSrc = useAsset(slug, clientDir, outDir, cfg.logo, { inlineSvg: true });
  const logo = logoSrc
    ? cfg.logoStyle === 'wide'
      ? `<img class="hero__logo hero__logo--wide" src="${esc(logoSrc)}" alt="${esc(cfg.name)}" decoding="async">`
      : `<img class="hero__logo" src="${esc(logoSrc)}" alt="" width="96" height="96" decoding="async">`
    : '';

  /* ---- Кнопки действий ---- */
  const actions = [];
  if (isFilled(cfg.phone)) {
    actions.push(`<a class="btn" href="${esc(telHref(cfg.phone))}">${icon('phone')}${ui('call')}</a>`);
  }
  const booking = bookingHref(slug, cfg.booking);
  if (cfg.booking && !booking) warn(slug, 'booking: не заполнено или неверно — кнопка «Забронировать» скрыта');
  if (booking) {
    actions.push(
      `<a class="btn btn--primary" href="${esc(booking)}"${linkAttrs(booking)}>${icon('calendar')}${ui('book')}</a>`
    );
  }
  // contact: { type, value } — кнопка «Написать» (например, Telegram), если брони нет.
  const contact = bookingHref(slug, cfg.contact);
  if (contact) {
    actions.push(
      `<a class="btn${booking ? '' : ' btn--primary'}" href="${esc(contact)}"${linkAttrs(contact)}>${icon('chat')}${ui('message')}</a>`
    );
  }
  const maps = mapLinks(cfg);
  if (maps.length) {
    actions.push(
      `<a class="btn" href="${esc(maps[0].url)}"${linkAttrs(maps[0].url)}>${icon('route')}${ui('route')}</a>`
    );
  }

  /* ---- Разделы меню ---- */
  const usedIds = new Set(['info']);
  const sections = cfg.sections.map((section, i) => {
    let id = slugify(section.title_en || section.title) || `section-${i + 1}`;
    while (usedIds.has(id)) id += '-' + (i + 1);
    usedIds.add(id);
    return { section, id };
  });

  const nav = sections
    .map(({ section, id }) => `<a href="#${id}">${f(section, 'title')}</a>`)
    .concat(`<a href="#info">${ui('navInfo')}</a>`)
    .join('');

  const sectionsHtml = sections
    .map(({ section, id }) => {
      const items = section.items.map((item) => renderDish(item)).join('\n');
      const note = isFilled(section.note) ? `<p class="section__note">${f(section, 'note')}</p>` : '';
      // action: { label, label_en, type, value } — кнопка под разделом («Заказать в Telegram»).
      let action = '';
      if (section.action) {
        const href = bookingHref(slug, section.action);
        if (href) {
          const text = isFilled(section.action.label) ? f(section.action, 'label') : ui('book');
          action = `<a class="section__action btn btn--primary" href="${esc(href)}"${linkAttrs(href)}>${icon('chat')}${text}</a>`;
        } else {
          warn(slug, `раздел «${section.title}»: у кнопки не задан value — кнопка скрыта до заполнения`);
        }
      }
      return `<section class="section" id="${id}">
<h2 class="section__title">${f(section, 'title')}</h2>
${note}
<ul class="list">
${items}
</ul>
${action}
</section>`;
    })
    .join('\n');

  function renderDish(item) {
    const out = item.available === false;
    const meta = [];
    if (isFilled(item.weight)) {
      meta.push(`<span>${tx(item.weight, item.weight_en || unitsToEn(item.weight))}</span>`);
    }
    for (const tag of item.tags || []) {
      const known = TAGS[tag];
      meta.push(`<span class="tag tag--${esc(slugify(tag))}">${known ? tx(known.ru, known.en) : esc(tag)}</span>`);
    }
    if (out) meta.push(`<span class="tag">${ui('out')}</span>`);

    let price = '';
    if (Array.isArray(item.variants) && item.variants.length) {
      price = `<dl class="variants">${item.variants
        .map((v) => `<div><dt>${tx(v.name, v.name_en || (isFilled(v.name) ? unitsToEn(v.name) : ''))}</dt><dd class="price">${esc(formatMoney(v.price, currency))}</dd></div>`)
        .join('')}</dl>`;
    } else if (isFilled(item.price)) {
      price = `<div class="price">${typeof item.price === 'number' ? esc(formatMoney(item.price, currency)) : f(item, 'price')}</div>`;
    }

    const photoSrc = useAsset(slug, clientDir, outDir, item.photo);
    const photo = photoSrc
      ? `<img class="dish__photo" src="${esc(photoSrc)}" alt="${esc(r.plain(item, 'name'))}" width="96" height="96" loading="lazy" decoding="async">`
      : '';

    return `<li class="dish${out ? ' is-out' : ''}">
<div class="dish__body">
<h3 class="dish__name">${f(item, 'name')}</h3>
${isFilled(item.description) ? `<p class="dish__desc">${f(item, 'description')}</p>` : ''}
<div class="dish__meta">${meta.join('')}</div>
</div>
<div class="dish__side">${photo}${price}</div>
</li>`;
  }

  /* ---- Блок «Информация» ---- */
  const cards = [];

  const hours = Array.isArray(cfg.hours) ? cfg.hours : isFilled(cfg.hours) ? [cfg.hours] : [];
  if (hours.length) {
    const rows = hours
      .map((h) =>
        typeof h === 'string'
          ? `<dt></dt><dd>${esc(h)}</dd>`
          : `<dt>${f(h, 'days')}</dt><dd>${f(h, 'time')}</dd>`
      )
      .join('');
    // Бейдж «Открыто сейчас / Закрыто» считается в браузере по времени кафе (по умолчанию — московскому).
    const schedule = parseSchedule(slug, hours);
    const offset = Number.isFinite(cfg.utcOffset) ? cfg.utcOffset : 3;
    const badge = schedule
      ? `<p class="status" data-schedule="${esc(JSON.stringify({ o: offset, w: schedule }))}" hidden></p>`
      : '';
    cards.push(`<div class="card"><h3 class="card__title">${icon('clock')}${ui('hours')}</h3>${badge}<dl class="hours">${rows}</dl></div>`);
  }

  if (isFilled(cfg.address)) {
    const pills = maps
      .map((m) => `<a class="pill" href="${esc(m.url)}"${linkAttrs(m.url)}>${icon('route')}${ui(m.key)}</a>`)
      .join('');
    const addressNote = isFilled(cfg.addressNote) ? `<p class="card__note">${f(cfg, 'addressNote')}</p>` : '';
    cards.push(
      `<div class="card"><h3 class="card__title">${icon('pin')}${ui('address')}</h3><p>${f(cfg, 'address')}</p>${addressNote}${pills ? `<div class="pills">${pills}</div>` : ''}</div>`
    );
  }

  const wifi = cfg.wifi || {};
  if (isFilled(wifi.network)) {
    const rows = [`<dt>${ui('network')}</dt><dd>${esc(wifi.network)}</dd>`];
    if (isFilled(wifi.password)) rows.push(`<dt>${ui('password')}</dt><dd>${esc(wifi.password)}</dd>`);
    const copyBtn = isFilled(wifi.password)
      ? `<button type="button" class="pill pill--accent" data-copy="${esc(wifi.password)}">${icon('copy')}<span class="copy-label">${ui('copy')}</span><span class="copy-done">${ui('copied')}</span></button>`
      : '';
    cards.push(
      `<div class="card"><h3 class="card__title">${icon('wifi')}${ui('wifi')}</h3><dl class="kv">${rows.join('')}</dl>${copyBtn}</div>`
    );
  }

  const contactPills = [];
  if (isFilled(cfg.phone)) {
    contactPills.push(`<a class="pill" href="${esc(telHref(cfg.phone))}">${icon('phone')}${esc(cfg.phone)}</a>`);
  }
  const socials = Array.isArray(cfg.socials)
    ? cfg.socials.map((s) => [s.name, s.url])
    : Object.entries(cfg.socials || {});
  for (const [key, link] of socials) {
    const href = safeUrl(link);
    if (!href) continue;
    const name = SOCIAL_LABELS[String(key).toLowerCase()] || key;
    contactPills.push(`<a class="pill" href="${esc(href)}"${linkAttrs(href)}>${label(name)}</a>`);
  }
  if (contactPills.length) {
    cards.push(
      `<div class="card"><h3 class="card__title">${icon('chat')}${ui('contacts')}</h3><div class="pills" style="margin-top:0">${contactPills.join('')}</div></div>`
    );
  }

  if (cards.length % 2 === 1) {
    cards[cards.length - 1] = cards[cards.length - 1].replace('class="card"', 'class="card card--wide"');
  }

  const info = `<section class="section" id="info">
<h2 class="section__title">${ui('info')}</h2>
<div class="info">
${cards.join('\n')}
</div>
</section>`;

  /* ---- Подвал ---- */
  const footer = [`<p>${f(cfg, 'name')}</p>`];
  footer.push(`<p class="build">${tx(`Меню обновлено ${buildInfo().date}`, `Menu updated ${buildInfo().date}`)}</p>`);
  if (isFilled(cfg.footer)) footer.push(`<p>${f(cfg, 'footer')}</p>`);
  const credit = config.credit || {};
  if (cfg.showCredit !== false && safeUrl(credit.url)) {
    const text = credit.name ? `${ui('credit')} ${esc(credit.name)}` : ui('credit');
    footer.push(`<p class="credit"><a href="${esc(safeUrl(credit.url))}" target="_blank" rel="noopener">${text}</a></p>`);
  }

  /* ---- <head> ---- */
  const nameRu = cfg.name;
  const nameEn = cfg.name_en || cfg.name;
  const titleRu = `${nameRu} — ${UI.ru.menuTitle}`;
  const titleEn = `${nameEn} — ${UI.en.menuTitle}`;
  const title = r.lang === 'en' ? titleEn : titleRu;
  const description = r.plain(cfg, 'tagline') || UI[r.lang].description;

  const htmlAttrs = r.bilingual
    ? ` data-bilingual data-title-ru="${esc(titleRu)}" data-title-en="${esc(titleEn)}"`
    : '';

  const indexable = cfg.noindex === false;
  const robots = indexable ? '' : '<meta name="robots" content="noindex, nofollow">';
  const ogExtra = [];
  if (url) {
    ogExtra.push(`<meta property="og:url" content="${esc(url)}">`);
    if (indexable) ogExtra.push(`<link rel="canonical" href="${esc(url)}">`);
  }

  let css = templates.css;
  if (isFilled(cfg.accentColor)) {
    if (hexToRgb(cfg.accentColor)) {
      css += `\n[data-theme]{--accent:${cfg.accentColor};--accent-ink:${inkFor(cfg.accentColor)}}`;
    } else {
      warn(slug, `accentColor "${cfg.accentColor}" — нужен цвет в формате #RRGGBB`);
    }
  }

  const langSwitch = r.bilingual
    ? `<div class="lang" role="group" aria-label="Language"><button type="button" data-set="ru">RU</button><button type="button" data-set="en">EN</button></div>`
    : '';

  return fill(templates.page, {
    lang: r.lang,
    theme,
    htmlAttrs,
    title: esc(title),
    description: esc(description),
    robots,
    buildMeta: `<meta name="qr-menu-build" content="${esc(buildInfo().stamp)}">`,
    themeColor: esc((themes[theme] || {})['--bg'] || '#ffffff'),
    ogExtra: ogExtra.join('\n'),
    favicon: logoSrc ? `<link rel="icon" href="${esc(logoSrc)}">` : '',
    css: minifyCss(css),
    js: minifyJs(templates.js),
    icons: iconSprite(),
    langSwitch,
    logo,
    name: f(cfg, 'name'),
    nameClass: cfg.logoStyle === 'wide' && logoSrc ? ' visually-hidden' : '',
    tagline: isFilled(cfg.tagline) ? `<p class="hero__tagline">${f(cfg, 'tagline')}</p>` : '',
    actions: actions.length ? `<div class="actions">${actions.join('')}</div>` : '',
    nav,
    sections: sectionsHtml,
    info,
    footer: footer.join(''),
  });
}

/* ------------------------------------------------------------------ */
/* QR-код и тейбл-тент                                                 */
/* ------------------------------------------------------------------ */

function wifiQrPayload(wifi) {
  const e = (s) => String(s).replace(/([\\;,:"])/g, '\\$1');
  const type = isFilled(wifi.password) ? wifi.security || 'WPA' : 'nopass';
  return `WIFI:T:${type};S:${e(wifi.network)};${isFilled(wifi.password) ? `P:${e(wifi.password)};` : ''};`;
}

const TENT_MODES = {
  home: { slug: 0, bleed: 0, label: 'Тейбл-тент A6 · 2 стороны · для домашней печати (A6, поля «нет», фон включить)' },
  press: { slug: 10, bleed: 3, label: 'Для типографии: обрез A6 105 × 148 мм · вылеты 3 мм · метки реза' },
};

async function renderTent({ slug, cfg, url, clientDir, outDir, templates, themes }, mode) {
  const m = TENT_MODES[mode];
  const r = createRenderer(cfg);
  const themeVars = themes[cfg.theme || 'light'] || themes.light;
  const vars = Object.entries(themeVars)
    .filter(([k]) => ['--surface', '--text', '--muted', '--line', '--chip', '--accent'].includes(k))
    .map(([k, v]) => `${k}: ${v};`)
    .join(' ');
  const accent = isFilled(cfg.accentColor) && hexToRgb(cfg.accentColor) ? `--accent: ${cfg.accentColor};` : '';

  const qrSvg = await QRCode.toString(url, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' });
  const logoSrc = useAsset(slug, clientDir, outDir, cfg.logo, { inlineSvg: true });

  const t = (key) => esc(UI[r.lang][key]);
  const tEn = (key) => esc(UI.en[key]);
  const shortUrl = url.replace(/^https?:\/\//, '').replace(/\/$/, '');

  let wifiHtml = '';
  const wifi = cfg.wifi || {};
  if (isFilled(wifi.network)) {
    const wifiSvg = await QRCode.toString(wifiQrPayload(wifi), { type: 'svg', margin: 0, errorCorrectionLevel: 'M' });
    const both = (key) => (r.bilingual ? `${esc(UI.ru[key])} / ${tEn(key)}` : t(key));
    wifiHtml = `<div class="wifi">
  <div class="wifi__qr">${wifiSvg}</div>
  <div>
    <div class="wifi__title">Wi-Fi</div>
    <div class="wifi__row"><span>${both('network')}:</span> <b>${esc(wifi.network)}</b></div>
    ${isFilled(wifi.password) ? `<div class="wifi__row"><span>${both('password')}:</span> <b>${esc(wifi.password)}</b></div>` : ''}
    <div class="wifi__hint">${both('tentWifiHint')}</div>
  </div>
</div>`;
  }

  const name = r.plain(cfg, 'name');
  const page = `
  <div class="brand">
    ${logoSrc ? `<img${cfg.logoStyle === 'wide' ? ' class="brand__wide"' : ''} src="${esc(logoSrc)}" alt="">` : ''}
    ${cfg.logoStyle === 'wide' && logoSrc ? '' : `<div class="brand__name">${esc(name)}</div>`}
  </div>
  <div class="cta">
    <div class="cta__title">${t('tentMenu')}</div>
    <div class="cta__sub">${t('tentScan')}</div>
    ${r.bilingual && r.lang === 'ru' ? `<div class="cta__en">Menu · ${tEn('tentScan')}</div>` : ''}
  </div>
  <div class="qr">${qrSvg}</div>
  <div class="url">${esc(shortUrl)}</div>
  ${wifiHtml}
`;

  return fill(templates.tent, {
    lang: r.lang,
    title: esc(`${name} — тейбл-тент A6${mode === 'press' ? ' (для типографии)' : ''}`),
    pageW: `${105 + 2 * m.slug}mm`,
    pageH: `${148 + 2 * m.slug}mm`,
    slug: `${m.slug}mm`,
    bleed: `${m.bleed}mm`,
    marks: m.slug ? cropMarks(m.slug, m.bleed) : '',
    modeLabel: esc(m.label),
    fonts: inlineFonts(),
    vars: vars + ' ' + accent,
    page,
  });
}

async function writeQr(url, outDir) {
  await QRCode.toFile(path.join(outDir, 'qr.png'), url, {
    type: 'png',
    width: 1024,
    margin: 4,
    errorCorrectionLevel: 'M',
    color: { dark: '#000000', light: '#ffffff' },
  });
  const svg = await QRCode.toString(url, { type: 'svg', margin: 4, errorCorrectionLevel: 'M' });
  fs.writeFileSync(path.join(outDir, 'qr.svg'), svg);
}

/* PDF — опционально, через playwright (если установлен). */
let browserPromise = null;
function loadPlaywright() {
  for (const name of ['playwright', 'playwright-core']) {
    try {
      return require(name);
    } catch (e) {
      /* пробуем следующий */
    }
  }
  return null;
}

async function writePdf(htmlPath, pdfPath) {
  const pw = loadPlaywright();
  if (!pw) return 'playwright не установлен';
  try {
    if (!browserPromise) browserPromise = pw.chromium.launch();
    const browser = await browserPromise;
    const page = await browser.newPage();
    await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready.then(() => true));
    await page.pdf({ path: pdfPath, preferCSSPageSize: true, printBackground: true });
    await page.close();
    return null;
  } catch (e) {
    return e.message.split('\n')[0];
  }
}

/**
 * Chromium округляет размер страницы до целых пикселей (105 мм → 105,2 мм).
 * Выставляем точные MediaBox/TrimBox/BleedBox — их проверяют в типографии.
 */
async function setPdfBoxes(pdfPath, m) {
  const { PDFDocument } = require('pdf-lib');
  const pt = (mm) => (mm * 72) / 25.4;
  const doc = await PDFDocument.load(fs.readFileSync(pdfPath));
  const W = pt(105 + 2 * m.slug);
  const H = pt(148 + 2 * m.slug);
  for (const page of doc.getPages()) {
    // Вёрстка идёт от верхнего левого угла, поэтому лишнее срезаем снизу и справа.
    const y0 = page.getMediaBox().height - H;
    page.setMediaBox(0, y0, W, H);
    page.setCropBox(0, y0, W, H);
    page.setBleedBox(pt(m.slug - m.bleed), y0 + pt(m.slug - m.bleed), pt(105 + 2 * m.bleed), pt(148 + 2 * m.bleed));
    page.setTrimBox(pt(m.slug), y0 + pt(m.slug), pt(105), pt(148));
  }
  fs.writeFileSync(pdfPath, await doc.save());
}

/* ------------------------------------------------------------------ */
/* CLI                                                                 */
/* ------------------------------------------------------------------ */

function parseArgs(argv) {
  const opts = { slugs: [], open: false, pdf: true, baseUrl: null };
  for (const a of argv) {
    if (a === '--open') opts.open = true;
    else if (a === '--no-pdf') opts.pdf = false;
    else if (a.startsWith('--base-url=')) opts.baseUrl = a.slice('--base-url='.length);
    else if (a === '-h' || a === '--help') opts.help = true;
    else if (a.startsWith('--')) throw new BuildError(`неизвестный флаг ${a}`);
    else opts.slugs.push(a.replace(/[\\/]+$/, '').replace(/^clients[\\/]/, ''));
  }
  return opts;
}

function openInBrowser(file) {
  const { spawn } = require('child_process');
  const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', file] : [file];
  try {
    spawn(cmd, args, { detached: true, stdio: 'ignore' }).on('error', () => {}).unref();
  } catch (e) {
    /* нет браузера — не страшно */
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0].replace(/^#!.*\n\/\*/, '').replace(/^ \* ?/gm, ''));
    return;
  }

  const templates = {
    page: fs.readFileSync(path.join(TEMPLATES_DIR, 'menu.html'), 'utf8'),
    css: fs.readFileSync(path.join(TEMPLATES_DIR, 'menu.css'), 'utf8'),
    js: fs.readFileSync(path.join(TEMPLATES_DIR, 'menu.js'), 'utf8'),
    tent: fs.readFileSync(path.join(TEMPLATES_DIR, 'table-tent.html'), 'utf8'),
  };
  const themes = parseThemes(templates.css);
  const config = loadConfig();
  const baseUrl = opts.baseUrl || siteBaseUrl(config);

  const slugs = opts.slugs.length
    ? opts.slugs
    : fs
        .readdirSync(CLIENTS_DIR, { withFileTypes: true })
        .filter((d) => d.isDirectory() && fs.existsSync(path.join(CLIENTS_DIR, d.name, 'menu.json')))
        .map((d) => d.name);

  if (!slugs.length) {
    console.log('В clients/ нет ни одного кафе. Создайте: npm run new -- my-cafe');
    return;
  }

  let failed = 0;
  const built = [];
  for (const slug of slugs) {
    try {
      const { dir, cfg } = loadClient(slug);
      const outDir = path.join(DIST_DIR, slug);
      fs.rmSync(outDir, { recursive: true, force: true });
      fs.mkdirSync(outDir, { recursive: true });

      const url = pageUrl(slug, cfg, baseUrl);
      const ctx = { slug, cfg, url, config, clientDir: dir, outDir, templates, themes };
      fs.writeFileSync(path.join(outDir, 'index.html'), renderPage(ctx));
      const files = ['index.html'];

      if (url) {
        if (!/^https?:\/\//i.test(url)) warn(slug, `адрес "${url}" должен начинаться с https://`);
        await writeQr(url, outDir);
        files.push('qr.png', 'qr.svg');
        for (const [mode, name] of [['home', 'table-tent'], ['press', 'table-tent-print']]) {
          const htmlPath = path.join(outDir, `${name}.html`);
          fs.writeFileSync(htmlPath, await renderTent(ctx, mode));
          files.push(`${name}.html`);
          if (!opts.pdf) continue;
          const pdfPath = path.join(outDir, `${name}.pdf`);
          const err = await writePdf(htmlPath, pdfPath);
          if (err) {
            warn(slug, `${name}.pdf не создан (${err}). Откройте ${name}.html и распечатайте (Ctrl+P)`);
          } else {
            await setPdfBoxes(pdfPath, TENT_MODES[mode]);
            files.push(`${name}.pdf`);
          }
        }
      } else {
        warn(slug, 'не задан baseUrl в config.json (или --base-url) — QR-код и тейбл-тент не созданы');
      }

      console.log(`✓ ${slug} → ${path.relative(ROOT, outDir)}/`);
      for (const file of files) console.log(`    ${file.padEnd(22)} ${fileSize(path.join(outDir, file))}`);
      if (url) console.log(`    QR ведёт на: ${url}`);
      built.push(outDir);
    } catch (e) {
      failed++;
      if (e instanceof BuildError) console.error(`✗ ${slug}: ${e.message}`);
      else console.error(`✗ ${slug}:`, e);
    }
  }

  if (browserPromise) await (await browserPromise.catch(() => null))?.close();

  if (warnings.length) {
    console.log('\nПредупреждения:');
    for (const w of warnings) console.log('  ! ' + w);
  }

  if (opts.open && built.length) openInBrowser(path.join(built[0], 'index.html'));
  if (failed) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e instanceof BuildError ? `Ошибка: ${e.message}` : e);
    process.exitCode = 1;
  });
}

module.exports = { loadConfig, customDomain, siteBaseUrl, pageUrl, parseDays, parseTime, parseSchedule, bookingHref, BuildError };
