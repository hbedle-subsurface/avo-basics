/* Does the counter behave the way assets/count.js and ADD-COUNTING.md say?
   Run: node tools/verify-count.js */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'assets', 'count.js'), 'utf8');

let bad = 0;
function run(url, opts) {
  const o = opts || {};
  let src = SRC;
  if (o.code !== undefined) {
    src = src.replace(/var COUNT_CODE = '[^']*';/, "var COUNT_CODE = '" + o.code + "';");
  }
  const dom = new JSDOM('<!doctype html><head></head><body></body>',
    { url, virtualConsole: new VirtualConsole(), runScripts: 'outside-only' });
  const w = dom.window;
  if (o.dnt) Object.defineProperty(w.navigator, 'doNotTrack', { value: '1', configurable: true });
  w.eval(src);
  const tag = w.document.head.querySelector('script[data-goatcounter]');
  return {
    loaded: !!tag,
    endpoint: tag ? tag.getAttribute('data-goatcounter') : null,
    async: tag ? tag.async : null,
    src: tag ? tag.src : null,
    // what GoatCounter would actually report, given the page's own URL
    reported: (w.goatcounter && typeof w.goatcounter.path === 'function')
      ? w.goatcounter.path(w.location.pathname + w.location.search) : null,
  };
}
function chk(label, ok, detail) {
  if (!ok) bad++;
  console.log('  ' + (ok ? 'ok  ' : 'FAIL') + ' ' + label.padEnd(52) + (detail || ''));
}

const LIVE = 'https://hbedle-subsurface.github.io/avo-basics';
const CODE = (SRC.match(/var COUNT_CODE = '([^']*)';/) || [])[1];

console.log('\nUSAGE COUNTER\n');
console.log('  account code in this file: ' + (CODE || '(none — counting is off)') + '\n');

let r = run(LIVE + '/modules/add-offset.html');
chk('the GoatCounter script is loaded', r.loaded, r.src || '');
chk('it points at the right account', r.endpoint === 'https://hbedle.goatcounter.com/count',
    r.endpoint || '');
chk('it is async, so it can never block the page', r.async === true);
chk('it goes in the head, appended at runtime',
    /document\.head\.appendChild/.test(SRC));

/* The one that matters. Every control writes itself into the query string, and
   without the path setting each visit files under its own dashboard row. */
const stateful = LIVE +
  '/modules/add-offset.html?phi=32&vcl=5&shvp=2900&fl=gas&sat=90&dep=2000&xmax=4400&nz=2&tab=p4';
r = run(stateful);
chk('slider settings are dropped from the reported path',
    r.reported === '/avo-basics/modules/add-offset.html', r.reported || '');
chk('the module is still identified', /add-offset/.test(r.reported || ''));

r = run(LIVE + '/index.html');
chk('the landing page reports separately',
    r.reported === '/avo-basics/index.html', r.reported || '');

chk('a local file:// copy is not counted', !run('file:///Users/hb/avo/index.html').loaded);
chk('a localhost preview is not counted', !run('http://localhost:8000/index.html').loaded);
chk('a 127.0.0.1 preview is not counted', !run('http://127.0.0.1:8080/index.html').loaded);
chk('Do Not Track is honoured', !run(LIVE + '/index.html', { dnt: true }).loaded);
chk('emptying the code switches it off', !run(LIVE + '/index.html', { code: '' }).loaded);

chk('no cookie or storage is used',
    !/document\.cookie|localStorage|sessionStorage/.test(SRC));
chk('no event tracking (page loads only)',
    !/addEventListener|goatcounter\.count\(/.test(SRC));

/* every page must load it, at the right depth, or a module is invisible */
const pages = ['index.html'].concat(
  fs.readdirSync(path.join(ROOT, 'modules')).map((f) => 'modules/' + f));
const problems = [];
for (const p of pages) {
  const html = fs.readFileSync(path.join(ROOT, p), 'utf8');
  const m = html.match(/<script src="([^"]*count\.js)"><\/script>/);
  const want = p.includes('/') ? '../assets/count.js' : 'assets/count.js';
  if (!m) problems.push(p + ': not loaded');
  else if (m[1] !== want) problems.push(p + ': loads "' + m[1] + '", expected "' + want + '"');
  else {
    // only meaningful on a page that has an inline script block of its own
    const inline = html.lastIndexOf('<script>');
    if (inline !== -1 && html.indexOf(m[0]) > inline) problems.push(p + ': loaded after the page script');
  }
}
chk('every page loads it, at the right relative depth', problems.length === 0,
    problems.length ? problems.join('; ') : pages.length + ' pages');

/* the site must say what it records, or the disclosure is a lie of omission */
const missingNotice = pages.filter((p) =>
  !/The only thing recorded is that/.test(fs.readFileSync(path.join(ROOT, p), 'utf8')));
chk('every page discloses what is recorded', missingNotice.length === 0,
    missingNotice.length ? missingNotice.join(', ') : pages.length + ' pages');
const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
chk('the landing page no longer claims "no analytics"',
    !/no analytics|no data (is )?transmitted/i.test(idx));

console.log('\n' + (bad ? bad + ' FAILURES' : 'the counter behaves as documented') + '\n');
process.exit(bad ? 1 : 0);
