/* Is this repository complete and internally consistent?
   Run: node tools/verify-deploy.js

   Catches the failures that only show up after a push: a page referencing an
   asset that was never committed, a link to a module that does not exist, a
   filename whose case differs from the reference (fine on a Mac, a 404 on
   GitHub Pages), and a page that forgot to load the usage counter. */

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let bad = 0, warn = 0;
const say = (ok, msg, detail) => {
  if (!ok) bad++;
  console.log('  ' + (ok ? 'ok  ' : 'FAIL') + ' ' + msg + (detail ? '\n         ' + detail : ''));
};

/* ---- what is in the repository ---- */
function walk(dir, base) {
  const out = [];
  for (const e of fs.readdirSync(path.join(ROOT, dir || '.'), { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git') continue;
    const rel = dir ? dir + '/' + e.name : e.name;
    if (e.isDirectory()) out.push(...walk(rel));
    else out.push(rel);
  }
  return out;
}
const FILES = walk('');
const gitignore = fs.existsSync(path.join(ROOT, '.gitignore'))
  ? fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8') : '';
const FILESET = new Set(FILES);
const LOWER = new Map(FILES.map((f) => [f.toLowerCase(), f]));

const PAGES = FILES.filter((f) => /\.html$/.test(f));

console.log('\nDEPLOYMENT CHECK\n');
console.log('  pages found: ' + PAGES.join(', ') + '\n');

/* ---- 1. every local reference resolves, with the right case ---- */
const missing = [], caseWrong = [], absolute = [];
for (const page of PAGES) {
  const src = fs.readFileSync(path.join(ROOT, page), 'utf8');
  const dir = path.dirname(page);
  const refs = [];
  for (const m of src.matchAll(/(?:src|href)="([^"#?]+)"/g)) refs.push(m[1]);
  for (const ref of refs) {
    if (/^(https?:)?\/\//.test(ref) || ref.startsWith('mailto:') || ref.startsWith('#')) continue;
    if (ref.startsWith('/')) { absolute.push(page + ' -> ' + ref); continue; }
    const resolved = path.posix.normalize(path.posix.join(dir === '.' ? '' : dir, ref));
    if (FILESET.has(resolved)) continue;
    if (LOWER.has(resolved.toLowerCase())) {
      caseWrong.push(page + ' -> ' + ref + '  (on disk: ' + LOWER.get(resolved.toLowerCase()) + ')');
    } else {
      missing.push(page + ' -> ' + ref);
    }
  }
}
say(missing.length === 0, 'every local file a page references exists',
    missing.join('\n         '));
say(caseWrong.length === 0, 'every reference matches the filename case on disk',
    caseWrong.join('\n         '));
say(absolute.length === 0, 'no absolute paths (they break under a project subpath)',
    absolute.join('\n         '));

/* ---- 2. the usage counter is on every page, at the right depth ---- */
const noCounter = [], wrongDepth = [];
for (const page of PAGES) {
  const src = fs.readFileSync(path.join(ROOT, page), 'utf8');
  const m = src.match(/<script src="([^"]*count\.js)"><\/script>/);
  if (!m) { noCounter.push(page); continue; }
  const want = page.includes('/') ? '../assets/count.js' : 'assets/count.js';
  if (m[1] !== want) wrongDepth.push(page + ' loads "' + m[1] + '", expected "' + want + '"');
}
say(noCounter.length === 0,
    'every page loads the usage counter (' + (PAGES.length - noCounter.length) +
    ' of ' + PAGES.length + ')', noCounter.join('\n         '));
say(wrongDepth.length === 0, 'the counter path is right for each page depth',
    wrongDepth.join('\n         '));

/* ---- 3. every page loads the libraries it needs ---- */
const libIssues = [];
for (const page of PAGES.filter((p) => p.startsWith('modules/'))) {
  const src = fs.readFileSync(path.join(ROOT, page), 'utf8');
  for (const lib of ['seismic.js', 'rockphysics.js']) {
    if (!src.includes('../assets/' + lib)) libIssues.push(page + ' does not load ' + lib);
  }
  // order matters: the module script must come after the libraries
  const iLib = Math.max(src.indexOf('rockphysics.js'), src.indexOf('seismic.js'));
  const iMod = src.lastIndexOf('<script>');
  if (iMod < iLib) libIssues.push(page + ' runs its own script before the libraries');
}
say(libIssues.length === 0, 'every module loads its libraries, in order',
    libIssues.join('\n         '));

/* ---- 4. every module is reachable from the landing page ---- */
const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const modules = FILES.filter((f) => f.startsWith('modules/'));
const unlinked = modules.filter((m) => !index.includes(m));
say(unlinked.length === 0, 'every module is linked from index.html',
    unlinked.join('\n         '));

/* ---- 5. the files GitHub Pages needs, and the ones it must not get ---- */
const needed = ['index.html', '.nojekyll', 'assets/style.css', 'assets/seismic.js',
                'assets/rockphysics.js', 'assets/count.js'];
const absent = needed.filter((f) => !FILESET.has(f));
say(absent.length === 0, 'the required top-level files are present', absent.join(', '));

say(/node_modules/.test(gitignore), 'node_modules is gitignored');
say(!FILESET.has('node_modules'), 'node_modules is not in the file listing');

/* ---- 6. anything on disk that nothing refers to ---- */
const referenced = new Set(needed.concat(PAGES));
for (const page of PAGES) {
  const src = fs.readFileSync(path.join(ROOT, page), 'utf8');
  const dir = path.dirname(page);
  for (const m of src.matchAll(/(?:src|href)="([^"#?]+)"/g)) {
    if (/^(https?:)?\/\//.test(m[1])) continue;
    referenced.add(path.posix.normalize(path.posix.join(dir === '.' ? '' : dir, m[1])));
  }
}
const DEV_ONLY = /^(tools\/|package\.json|README\.md|MAINTAINING\.md|ADD-COUNTING\.md|\.gitignore|\.nojekyll)/;
/* Anything .gitignore excludes is not part of the repository at all, so it must
   not appear in either manifest — it was listed in both, which is worse than
   listing it in neither. */
const IGNORED = gitignore.split('\n').map((l) => l.trim())
  .filter((l) => l && !l.startsWith('#')).map((l) => l.replace(/\/$/, ''));
const isIgnored = (f) => IGNORED.some((g) => f === g || f.startsWith(g + '/'));
/* LICENSE is deliberately shipped and deliberately unlinked — CC BY-SA asks for
   the text to travel with the work, and every page links to the deed instead. */
const orphans = FILES.filter((f) => !referenced.has(f) && !DEV_ONLY.test(f) &&
                                    !isIgnored(f) && f !== 'LICENSE');
if (orphans.length) {
  warn++;
  console.log('  note  files nothing links to (harmless, but check they are wanted):\n         ' +
    orphans.join('\n         '));
}

  /* Every live card needs its own picture. Thirteen cards once shared seven, which
   made the module list much harder to navigate than it needed to be. The three
   superseded pages deliberately share one muted mark, so they are excluded. */
(function checkThumbs() {
  const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const svgs = idx.match(/<svg viewBox="0 0 200 104"[\s\S]*?<\/svg>/g) || [];
  const counts = new Map();
  for (const v of svgs) counts.set(v, (counts.get(v) || 0) + 1);
  const dupes = [...counts.entries()].filter(([, n]) => n > 1);
  const retired = dupes.filter(([v]) => v.indexOf('superseded') >= 0);
  const wrong = dupes.filter(([v]) => v.indexOf('superseded') < 0);
  say(wrong.length === 0,
    wrong.length ? wrong.length + ' thumbnails are used on more than one live card'
      : 'every live card has its own thumbnail (' +
        (svgs.length - retired.reduce((a, [, n]) => a + n - 1, 0)) + ' distinct)');
})();

/* ---- the module numbering, which nothing else checks ----

   Re-levelling the set from seven modules to ten left a layer of stale numbering
   behind: prose pointing at "module 03" for something module 05 does, pages whose
   own title disagreed with the card that links to them, and nav items labelled
   for a module they did not lead to. The prose verifiers check numbers, not
   module numbers, so none of it failed anything. These three checks close that
   gap. The index is the reference: it decides what each module is called and
   what number it carries. */
const CARDS = (function () {
  const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const out = [];
  const re = /<a class="card"[^>]*href="(modules\/[^"]+)"[\s\S]*?<div class="card-no">(\d\d)[\s\S]*?<h3>([^<]+)<\/h3>/g;
  let m;
  while ((m = re.exec(idx))) out.push({ file: m[1], no: m[2], title: m[3].trim() });
  return out;
})();
const BY_NO = new Map(CARDS.map((c) => [c.no, c]));
const BY_FILE = new Map(CARDS.map((c) => [c.file, c]));

say(CARDS.length === PAGES.length - 1,
  'every module has a card the index numbers and names (' + CARDS.length + ')',
  CARDS.length === PAGES.length - 1 ? '' :
    'found ' + CARDS.length + ' cards for ' + (PAGES.length - 1) + ' modules');

/* 1. a page's own <title> and <h1> must match the card that links to it. */
(function checkTitles() {
  const wrong = [];
  for (const c of CARDS) {
    const src = fs.readFileSync(path.join(ROOT, c.file), 'utf8');
    const t = (src.match(/<title>([^<|]+)/) || [])[1];
    const h = (src.match(/<h1>([^<]+)<\/h1>/) || [])[1];
    if (!t || t.trim() !== c.title) wrong.push(c.file + ' <title> is "' + (t || '').trim() + '", card says "' + c.title + '"');
    if (!h || h.trim() !== c.title) wrong.push(c.file + ' <h1> is "' + (h || '').trim() + '", card says "' + c.title + '"');
  }
  say(wrong.length === 0,
    wrong.length ? 'a page disagrees with its own card about what it is called'
                 : 'every page is called what the index says it is called',
    wrong.join('\n         '));
})();

/* 2. every "module NN" mentioned in prose must exist, and must not be the page
      making the mention. A module referring to itself is always a leftover. */
(function checkCrossRefs() {
  const problems = [];
  for (const c of CARDS) {
    const src = fs.readFileSync(path.join(ROOT, c.file), 'utf8');
    /* The head (a meta description names its own module), the eyebrow, the pager
       and the Next-up block all carry module numbers as labelling rather than as
       prose. Only body text is a cross-reference. */
    const prose = src.replace(/<head>[\s\S]*?<\/head>/g, '')
                     .replace(/<script[\s\S]*?<\/script>/g, '')
                     .replace(/<style[\s\S]*?<\/style>/g, '')
                     .replace(/<p class="eyebrow">[\s\S]*?<\/p>/g, '')
                     .replace(/<section class="nextup"[\s\S]*?<\/section>/g, '')
                     .replace(/<div class="pager"[\s\S]*?<\/div>/g, '');
    const seen = new Set();
    let m;
    const re = /\b[Mm]odules? (\d\d)\b/g;
    while ((m = re.exec(prose))) seen.add(m[1]);
    for (const no of seen) {
      if (!BY_NO.has(no)) problems.push(c.file + ' points at module ' + no + ', which does not exist');
      else if (no === c.no) problems.push(c.file + ' (module ' + no + ') refers to itself by number');
    }
  }
  say(problems.length === 0,
    problems.length ? 'a module points at a module number that is wrong'
                    : 'every "module NN" in the prose resolves, and none is self-referential',
    problems.join('\n         '));
})();

/* 3. a nav item labelled "Module NN" is always stale: the bar is Exercises and
      Method, and a numbered label there once pointed two modules further on. */
(function checkNav() {
  const problems = [];
  for (const c of CARDS) {
    const src = fs.readFileSync(path.join(ROOT, c.file), 'utf8');
    const nav = (src.match(/<nav>([\s\S]*?)<\/nav>/) || ['', ''])[1];
    if (/>\s*Modules?\s*\d/.test(nav)) problems.push(c.file + ' has a numbered module link in its nav bar');
    if (!/href="#pe"/.test(nav)) problems.push(c.file + ' nav does not link to its exercises');
    if (!/href="#pm"/.test(nav)) problems.push(c.file + ' nav does not link to its method tab');
  }
  say(problems.length === 0,
    problems.length ? 'a nav bar is not the standard three items'
                    : 'every module nav is All modules / Exercises / Method',
    problems.join('\n         '));
})();

/* 4. the pop-out exercise window, which only half the set had. */
(function checkPopout() {
  const missing = CARDS.filter((c) => {
    const src = fs.readFileSync(path.join(ROOT, c.file), 'utf8');
    return !(src.includes('id="popEx"') && src.includes('id="exList"'));
  }).map((c) => c.file);
  say(missing.length === 0,
    missing.length ? 'a module cannot pop its exercises into a separate window'
                   : 'every module can pop its exercises out (' + CARDS.length + ')',
    missing.join('\n         '));
})();

/* 5. answer labels and the footer privacy line, which drifted between the
      re-levelled modules and the older ones. */
(function checkHouseStyle() {
  const problems = [];
  for (const c of CARDS) {
    const src = fs.readFileSync(path.join(ROOT, c.file), 'utf8');
    if (src.includes('<summary>Hint</summary>')) problems.push(c.file + ' labels a worked answer "Hint"');
    const n = (src.match(/<summary>Answer<\/summary>/g) || []).length;
    if (n !== 5) problems.push(c.file + ' has ' + n + ' answer blocks, expected 5');
  }
  say(problems.length === 0,
    problems.length ? 'an exercise block is not in house style'
                    : 'every module has five exercises, each with an Answer',
    problems.join('\n         '));
})();

/* The index says three things in the hero that it used to repeat at length in
   the About section: what the prerequisite is, that everything is computed, and
   that nothing leaves the browser. Each should be made once. */
(function checkRepeats() {
  const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const strip = idx.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const dupes = [];
  const once = [
    ['the prerequisite named as a link', /seismic_resolution\//g, 2],
    ['"nothing leaves your browser"', /leaves your (browser|machine)/gi, 1],
    ['the page-view disclosure', /thing recorded is that a page was opened/gi, 1],
  ];
  for (const [what, re_, limit] of once) {
    const n = (what === 'the prerequisite named as a link'
      ? (idx.match(re_) || []).length : (strip.match(re_) || []).length);
    if (n > limit) dupes.push(what + ' appears ' + n + ' times');
  }
  say(dupes.length === 0,
    dupes.length ? dupes.join('; ') : 'the index makes each of its standing points once');
})();

/* ---- 7. the manifest, so nothing is missed when uploading ---- */
console.log('\n  MUST BE IN THE REPOSITORY (the site will not work without these)');
FILES.filter((f) => (!DEV_ONLY.test(f) || f === '.nojekyll') && !isIgnored(f))
  .sort().forEach((f) => console.log('    ' + f));
console.log('\n  SHOULD BE, BUT THE SITE RUNS WITHOUT THEM (docs and tests)');
FILES.filter((f) => DEV_ONLY.test(f) && f !== '.nojekyll' && !isIgnored(f))
  .sort().forEach((f) => console.log('    ' + f));
console.log('\n  MUST NOT BE COMMITTED  (from .gitignore)');
IGNORED.forEach((g) => console.log('    ' + g));

console.log('\n' + (bad ? bad + ' PROBLEMS' :
  'the repository is complete and internally consistent') +
  (warn ? ' (' + warn + ' note)' : '') + '\n');
process.exit(bad ? 1 : 0);
