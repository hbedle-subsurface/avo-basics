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
const orphans = FILES.filter((f) => !referenced.has(f) && !DEV_ONLY.test(f) && !isIgnored(f));
if (orphans.length) {
  warn++;
  console.log('  note  files nothing links to (harmless, but check they are wanted):\n         ' +
    orphans.join('\n         '));
}

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
