#!/usr/bin/env node
/*
 * Деплой меню кафе на хостинг:
 *   npm run deploy -- demo-cafe
 *
 * Перед деплоем кафе пересобирается. Хостинг задаётся в config.json → deploy.provider:
 *   github-pages — кладёт dist/<кафе>/ в ветку gh-pages (остальные кафе в ветке не трогает),
 *                  добавляет CNAME из baseUrl. Нужен доступ на push в репозиторий.
 *   netlify      — публикует весь dist/ (Netlify заменяет сайт целиком).
 *                  Нужны NETLIFY_AUTH_TOKEN и siteId (в config.json или NETLIFY_SITE_ID).
 *
 * Флаги:
 *   --provider=github-pages|netlify  — переопределить провайдера из config.json
 *   --remote=<имя или URL>           — куда пушить gh-pages (по умолчанию origin)
 *   --no-build                       — не пересобирать перед деплоем
 *   --dry-run                        — всё подготовить, но ничего не публиковать
 *
 * Файлы для печати (table-tent*) на хостинг не попадают — они нужны только локально.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { loadConfig, BuildError } = require('./build');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const CLIENTS = path.join(ROOT, 'clients');

/** Файлы, которые не публикуем: макеты для печати. */
const isPrintFile = (name) => /^table-tent/.test(name);

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { encoding: 'utf8', ...opts });
  if (res.error) throw new BuildError(`не удалось запустить ${cmd}: ${res.error.message}`);
  if (res.status !== 0 && !opts.allowFail) {
    const out = `${res.stderr || ''}${res.stdout || ''}`.trim();
    throw new BuildError(`${cmd} ${args.join(' ')}\n${out}`);
  }
  return res;
}

const git = (cwd, args, opts) => run('git', args, { cwd, ...opts });

function copyDir(src, dest) {
  fs.cpSync(src, dest, { recursive: true, filter: (p) => !isPrintFile(path.basename(p)) });
}

/** Корневая страница домена: если её нет — просто редирект на сайт студии. */
function rootIndex(config) {
  const target = (config.credit && config.credit.url) || 'https://saintsites.ru';
  return `<!doctype html>
<html lang="ru"><head><meta charset="utf-8">
<meta name="robots" content="noindex">
<meta http-equiv="refresh" content="0; url=${target}">
<title>QR-меню</title></head>
<body><a href="${target}">${target}</a></body></html>
`;
}

function parseArgs(argv) {
  const opts = { slug: null, build: true, dryRun: false, provider: null, remote: null };
  for (const a of argv) {
    if (a === '--no-build') opts.build = false;
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a.startsWith('--provider=')) opts.provider = a.slice(11);
    else if (a.startsWith('--remote=')) opts.remote = a.slice(9);
    else if (a.startsWith('--')) throw new BuildError(`неизвестный флаг ${a}`);
    else if (!opts.slug) opts.slug = a.replace(/[\\/]+$/, '').replace(/^(clients|dist)[\\/]/, '');
    else throw new BuildError('за один раз деплоится одно кафе');
  }
  if (!opts.slug) throw new BuildError('укажите кафе: npm run deploy -- demo-cafe');
  return opts;
}

/* ---------------- GitHub Pages ---------------- */

function deployGithubPages(slug, config, opts) {
  const settings = (config.deploy && config.deploy.githubPages) || {};
  const remote = opts.remote || settings.remote || 'origin';
  const branch = settings.branch || 'gh-pages';
  const remoteUrl = /[/:]/.test(remote) ? remote : git(ROOT, ['remote', 'get-url', remote]).stdout.trim();

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'qr-menu-pages-'));
  try {
    console.log(`→ Забираю ветку ${branch}…`);
    const cloned = git(ROOT, ['clone', '--quiet', '--depth', '1', '--branch', branch, '--single-branch', remoteUrl, tmp], {
      allowFail: true,
    });
    if (cloned.status !== 0) {
      console.log(`  ветки ${branch} ещё нет — создаю`);
      fs.rmSync(tmp, { recursive: true, force: true });
      fs.mkdirSync(tmp);
      git(tmp, ['init', '--quiet']);
      git(tmp, ['checkout', '--quiet', '--orphan', branch]);
      git(tmp, ['remote', 'add', 'origin', remoteUrl]);
    }

    fs.rmSync(path.join(tmp, slug), { recursive: true, force: true });
    copyDir(path.join(DIST, slug), path.join(tmp, slug));
    fs.writeFileSync(path.join(tmp, '.nojekyll'), '');

    const host = config.baseUrl ? new URL(config.baseUrl).hostname : null;
    if (host && !host.endsWith('github.io')) fs.writeFileSync(path.join(tmp, 'CNAME'), host + '\n');
    if (!fs.existsSync(path.join(tmp, 'index.html'))) fs.writeFileSync(path.join(tmp, 'index.html'), rootIndex(config));

    git(tmp, ['add', '--all']);
    if (git(tmp, ['diff', '--cached', '--quiet'], { allowFail: true }).status === 0) {
      console.log('✓ Изменений нет — на хостинге уже актуальная версия');
      return;
    }

    // Автор коммита — как в основном репозитории (или нейтральный, если не настроен).
    const name = git(ROOT, ['config', 'user.name'], { allowFail: true }).stdout.trim() || 'QR-menu deploy';
    const email = git(ROOT, ['config', 'user.email'], { allowFail: true }).stdout.trim() || 'deploy@localhost';
    git(tmp, ['-c', `user.name=${name}`, '-c', `user.email=${email}`, 'commit', '--quiet', '-m', `Deploy ${slug}`]);

    if (opts.dryRun) {
      console.log(`✓ Dry run: коммит подготовлен в ${tmp}, push пропущен`);
      return;
    }
    console.log(`→ Публикую в ${branch}…`);
    git(tmp, ['push', '--quiet', 'origin', `HEAD:${branch}`]);
    console.log('✓ Опубликовано на GitHub Pages (обновление занимает ~1 минуту)');
  } finally {
    if (!opts.dryRun) fs.rmSync(tmp, { recursive: true, force: true });
  }
}

/* ---------------- Netlify ---------------- */

function deployNetlify(slug, config, opts) {
  const settings = (config.deploy && config.deploy.netlify) || {};
  const siteId = process.env.NETLIFY_SITE_ID || settings.siteId;
  if (!siteId) throw new BuildError('не задан Netlify siteId (config.json → deploy.netlify.siteId или NETLIFY_SITE_ID)');
  if (!process.env.NETLIFY_AUTH_TOKEN && !opts.dryRun) {
    throw new BuildError('нет NETLIFY_AUTH_TOKEN — создайте токен в Netlify: User settings → Applications');
  }

  // Netlify заменяет сайт целиком, поэтому публикуем все собранные кафе.
  const missing = fs
    .readdirSync(CLIENTS, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !fs.existsSync(path.join(DIST, d.name, 'index.html')))
    .map((d) => d.name);
  if (missing.length) {
    console.warn(`! Не собраны и пропадут с сайта: ${missing.join(', ')} (соберите: npm run build)`);
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'qr-menu-netlify-'));
  try {
    copyDir(DIST, tmp);
    if (!fs.existsSync(path.join(tmp, 'index.html'))) fs.writeFileSync(path.join(tmp, 'index.html'), rootIndex(config));

    const args = ['--yes', 'netlify-cli@27', 'deploy', '--dir', tmp, '--prod', '--site', siteId, '--message', `Deploy ${slug}`];
    if (opts.dryRun) {
      console.log(`✓ Dry run: подготовлено в ${tmp}\n  npx ${args.join(' ')}`);
      return;
    }
    console.log('→ Публикую на Netlify…');
    const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    run(npx, args, { stdio: 'inherit' });
    console.log('✓ Опубликовано на Netlify');
  } finally {
    if (!opts.dryRun) fs.rmSync(tmp, { recursive: true, force: true });
  }
}

/* ---------------- main ---------------- */

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const config = loadConfig();
  const provider = opts.provider || (config.deploy && config.deploy.provider) || 'github-pages';

  if (opts.build) {
    const res = spawnSync(process.execPath, [path.join(__dirname, 'build.js'), opts.slug], { stdio: 'inherit' });
    if (res.status !== 0) throw new BuildError('сборка не удалась — деплой отменён');
  }
  if (!fs.existsSync(path.join(DIST, opts.slug, 'index.html'))) {
    throw new BuildError(`нет dist/${opts.slug}/index.html — сначала соберите: npm run build -- ${opts.slug}`);
  }

  console.log(`\nДеплой ${opts.slug} → ${provider}`);
  if (provider === 'github-pages') deployGithubPages(opts.slug, config, opts);
  else if (provider === 'netlify') deployNetlify(opts.slug, config, opts);
  else throw new BuildError(`неизвестный provider "${provider}" (github-pages или netlify)`);

  if (config.baseUrl && !opts.dryRun) {
    console.log(`  ${String(config.baseUrl).replace(/\/*$/, '/')}${encodeURIComponent(opts.slug)}/`);
  }
}

try {
  main();
} catch (e) {
  console.error(e instanceof BuildError ? `✗ ${e.message}` : e);
  process.exitCode = 1;
}
