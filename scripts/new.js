#!/usr/bin/env node
/*
 * Создать новое кафе из примера:
 *   npm run new -- my-cafe
 * Копирует clients/demo-cafe в clients/my-cafe — останется поправить menu.json и логотип.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const slug = process.argv[2];

if (!slug || !/^[a-z0-9][a-z0-9_-]*$/.test(slug)) {
  console.error('Укажите имя папки латиницей, например: npm run new -- coffee-point');
  process.exit(1);
}

const src = path.join(ROOT, 'clients', 'demo-cafe');
const dest = path.join(ROOT, 'clients', slug);

if (fs.existsSync(dest)) {
  console.error(`Папка clients/${slug} уже существует.`);
  process.exit(1);
}

fs.cpSync(src, dest, { recursive: true });

console.log(`✓ Создано: clients/${slug}/`);
console.log('  1. Отредактируйте clients/' + slug + '/menu.json и замените logo.svg');
console.log('  2. Соберите: npm run build -- ' + slug);
