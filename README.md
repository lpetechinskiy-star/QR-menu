# QR-меню для кафе и ресторанов

Генератор одностраничных меню: `menu.json` → готовая страница, QR-код и тейбл-тент для печати.
Без фреймворков: чистый HTML + CSS + немного JS, всё встроено в один файл (~35 КБ). Страница быстро открывается и рассчитана в первую очередь на телефон.

```
clients/<кафе>/menu.json    данные кафе (+ логотип и фото рядом)
templates/                  шаблон страницы (menu.html, menu.css, menu.js) и тейбл-тента
scripts/build.js            генератор
dist/<кафе>/                результат: index.html, qr.png, qr.svg, table-tent.html, table-tent.pdf
```

## Быстрый старт

```bash
npm install
npm run build -- demo-cafe --open   # собрать пример и открыть в браузере
```

## Новое кафе за 3 шага

```bash
npm run new -- coffee-point          # 1. копирует пример в clients/coffee-point/
#                                      2. правим clients/coffee-point/menu.json, кладём свой логотип
npm run build -- coffee-point        # 3. готово: dist/coffee-point/
```

`npm run build` без имени собирает все кафе из `clients/`.
`npm run preview` поднимает локальный сервер (http://localhost:8080), открыть можно и с телефона в той же сети.

Залейте папку `dist/<кафе>/` на хостинг (GitHub Pages, Netlify, любой статический) по адресу из поля `url` — на этот адрес и ведёт QR-код.

## menu.json

Полный пример: [`clients/demo-cafe/menu.json`](clients/demo-cafe/menu.json). Обязательны только `name` и `sections`.

| Поле | Что это |
|---|---|
| `name`, `tagline` | Название и подзаголовок |
| `logo` | Файл в папке кафе (`logo.svg`, `logo.png`) или ссылка |
| `url` | Публичный адрес страницы — для QR-кода. Можно не указывать, а передать `--base-url=https://menu.site.ru/` |
| `theme` | `light`, `dark` или `warm` |
| `accentColor` | Свой акцентный цвет, например `"#7a3cff"` (необязательно) |
| `noindex` | По умолчанию страница закрыта от поисковиков. `false` — открыть |
| `defaultLang` | `ru` или `en` |
| `currency` | По умолчанию `₽` |
| `phone`, `booking` | Телефон и ссылка для брони (Telegram, сайт). Без `booking` кнопка «Забронировать» звонит |
| `address`, `maps` | Адрес и ссылки `{"yandex": "...", "2gis": "..."}`. Без `maps` ссылка на Яндекс Карты строится по адресу |
| `hours` | `[{"days": "Пн–Пт", "time": "08:00–22:00"}]` |
| `wifi` | `{"network": "...", "password": "..."}` — на странице кнопка «Скопировать», на тейбл-тенте QR для подключения |
| `socials` | `{"telegram": "...", "vk": "...", "instagram": "...", "whatsapp": "...", "website": "..."}` |
| `footer` | Строка в подвале (необязательно) |
| `sections[]` | `title`, `note` (подпись под заголовком), `items[]` |

Блюдо (`items[]`): `name`, `description`, `price` (число или текст: `"от 300"`), `weight` (`"250 г"`), `photo` (`"images/syrniki.jpg"` — файл в папке кафе), `tags` (`hit`, `new`, `veg`, `vegan`, `spicy` или свой текст), `available: false` — «нет в наличии», `variants` — размеры: `[{"name": "250 мл", "price": 220}, ...]`.

**Английская версия.** Добавьте к любому текстовому полю пару с `_en`: `name_en`, `description_en`, `title_en`, `address_en`, `days_en`… Как только в файле есть хоть одно `_en`-поле, на странице появляется переключатель RU/EN. Чего нет в переводе — показывается по-русски; «г»/«мл» в весе переводятся автоматически. Гостям с не-русским языком телефона страница сразу открывается на английском.

**Превью тем:** допишите к адресу `?theme=dark` (или `light`, `warm`) — удобно показать клиенту варианты.

## Тейбл-тент

`dist/<кафе>/table-tent.html` — две одинаковые стороны A6 (105 × 148 мм): логотип, крупный QR на меню, Wi-Fi с QR для подключения. Откройте и распечатайте (Ctrl+P → A6, поля «нет», фон включить).

PDF (`table-tent.pdf`) создаётся автоматически, если установлен Playwright:

```bash
npm i -D playwright && npx playwright install chromium
```

Без него всё остальное собирается как обычно, PDF просто пропускается.
