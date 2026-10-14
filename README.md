# QR-меню для кафе и ресторанов

Генератор одностраничных меню: `menu.json` → готовая страница, QR-код и тейбл-тент для печати.
Без фреймворков: чистый HTML + CSS + немного JS, всё встроено в один файл (~40 КБ). Страница быстро открывается и рассчитана в первую очередь на телефон.

```
config.json                 общие настройки: адрес сайта, ссылка «Сделано SaintSites», деплой
clients/<кафе>/menu.json    данные кафе (+ логотип и фото рядом)
templates/                  шаблоны страницы и тейбл-тента, шрифты для печати
scripts/                    build (сборка), new (новое кафе), preview (локальный сервер), deploy
dist/<кафе>/                результат сборки
```

## Быстрый старт

```bash
npm install
npx playwright install chromium     # один раз — нужен для PDF тейбл-тентов
npm run build -- demo-cafe --open   # собрать пример и открыть в браузере
```

## Новое кафе: от шаблона до публикации

```bash
npm run new -- coffee-point          # 1. копирует пример в clients/coffee-point/
#                                      2. правим clients/coffee-point/menu.json, кладём свой логотип
npm run build -- coffee-point        # 3. собираем → dist/coffee-point/
npm run deploy -- coffee-point       # 4. публикуем → https://menu.saintsites.ru/coffee-point/
```

`npm run build` без имени собирает все кафе. `npm run preview` поднимает локальный сервер (http://localhost:8080), открыть можно и с телефона в той же сети.

Что появится в `dist/<кафе>/`:

| Файл | Что это |
|---|---|
| `index.html` | Страница меню |
| `qr.png`, `qr.svg` | QR-код на страницу |
| `table-tent.html` / `.pdf` | Тейбл-тент A6 для домашней печати: ровно 105 × 148 мм, без вылетов |
| `table-tent-print.html` / `.pdf` | Для типографии: вылеты 3 мм, метки реза, TrimBox и BleedBox в PDF |

В обоих PDF шрифты (Inter и PT Serif, лицензия OFL) встроены как TrueType, а не Type 3.

## config.json

```json
{
  "baseUrl": "https://menu.saintsites.ru",
  "credit": { "name": "SaintSites", "url": "https://saintsites.ru" },
  "deploy": { "provider": "github-pages", "githubPages": { "remote": "origin", "branch": "gh-pages" }, "netlify": { "siteId": "" } }
}
```

Адрес кафе — `<baseUrl>/<папка-кафе>/`. От него строятся QR-код, `og:url` и canonical. Если у кафе свой домен, укажите в его `menu.json` поле `"url"`.

## menu.json

Полный пример: [`clients/demo-cafe/menu.json`](clients/demo-cafe/menu.json). Обязательны только `name` и `sections`.

| Поле | Что это |
|---|---|
| `name`, `tagline` | Название и подзаголовок |
| `logo` | Файл в папке кафе (`logo.svg`, `logo.png`) или ссылка |
| `theme` | `light`, `dark` или `warm` |
| `accentColor` | Свой акцентный цвет, например `"#7a3cff"` (необязательно) |
| `noindex` | По умолчанию страница закрыта от поисковиков. `false` — открыть |
| `showCredit` | `false` — убрать из подвала ссылку «Сделано SaintSites» |
| `defaultLang` | `ru` или `en` |
| `currency` | По умолчанию `₽` |
| `phone` | Телефон: кнопка «Позвонить» и контакты |
| `booking` | Кнопка «Забронировать»: `{"type": "telegram", "value": "@cafe"}`. Типы: `phone`, `whatsapp` (номер), `telegram` (@ник или ссылка), `url`. Если поля нет — кнопки нет |
| `address`, `maps` | Адрес и ссылки `{"yandex": "...", "2gis": "..."}`. Без `maps` ссылка на Яндекс Карты строится по адресу |
| `hours` | `[{"days": "Пн–Пт", "time": "08:00–22:00"}]` — см. ниже |
| `utcOffset` | Часовой пояс кафе для бейджа «Открыто», по умолчанию `3` (Москва) |
| `wifi` | `{"network": "...", "password": "..."}` — на странице кнопка «Скопировать», на тейбл-тенте QR для подключения |
| `socials` | `{"telegram": "...", "vk": "...", "instagram": "...", "whatsapp": "...", "website": "..."}` |
| `footer` | Строка в подвале (необязательно) |
| `sections[]` | `title`, `note` (подпись под заголовком), `items[]` |

Блюдо (`items[]`): `name`, `description`, `price` (число или текст: `"от 300"`), `weight` (`"250 г"`), `photo` (`"images/syrniki.jpg"` — файл в папке кафе), `tags` (`hit`, `new`, `veg`, `vegan`, `spicy` или свой текст), `available: false` — «нет в наличии», `variants` — размеры: `[{"name": "250 мл", "price": 220}, ...]`.

**Часы работы и бейдж «Открыто сейчас / Закрыто».** Бейдж считается в браузере гостя по московскому времени (или по `utcOffset`) и показывает, до скольки открыто или когда откроется. Дни: `Пн–Пт`, `Сб, Вс`, `Ежедневно`, `Будни`, `Выходные`, `Mon–Fri`. Время: `08:00–22:00`, `18:00–02:00` (через полночь), `Круглосуточно`, `Выходной`. Если строку разобрать не удалось, сборка предупредит, а бейдж просто не покажется.

**Английская версия.** Добавьте к любому текстовому полю пару с `_en`: `name_en`, `description_en`, `title_en`, `address_en`, `days_en`… Как только в файле есть хоть одно `_en`-поле, на странице появляется переключатель RU/EN. Чего нет в переводе — показывается по-русски; «г»/«мл» в весе переводятся автоматически. Гостям с не-русским языком телефона страница сразу открывается на английском.

**Превью тем:** допишите к адресу `?theme=dark` (или `light`, `warm`) — удобно показать клиенту варианты.

## Деплой

`npm run deploy -- <кафе>` пересобирает кафе и публикует его. Файлы для печати (`table-tent*`) на хостинг не попадают. Флаги: `--dry-run` (всё подготовить, но не публиковать), `--no-build`, `--provider=netlify`.

**GitHub Pages** (`"provider": "github-pages"`, по умолчанию). Скрипт кладёт `dist/<кафе>/` в ветку `gh-pages` того же репозитория — другие кафе в ветке не трогаются, — и добавляет `CNAME` с доменом из `baseUrl`. Один раз настроить:
1. Задеплоить первое кафе — появится ветка `gh-pages`.
2. GitHub → Settings → Pages → Source: *Deploy from a branch*, ветка `gh-pages`, папка `/ (root)`. Custom domain: `menu.saintsites.ru`, включить *Enforce HTTPS*.
3. В DNS домена `saintsites.ru`: запись `CNAME` `menu` → `<ваш-логин>.github.io`.

**Netlify** (`"provider": "netlify"`). Netlify заменяет сайт целиком, поэтому публикуется весь `dist/` — все собранные кафе сразу. Нужны `siteId` (в `config.json` или `NETLIFY_SITE_ID`) и токен в переменной `NETLIFY_AUTH_TOKEN` (Netlify → User settings → Applications → Personal access tokens). Домен `menu.saintsites.ru` подключается в настройках сайта на Netlify.
