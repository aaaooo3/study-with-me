import fs from 'node:fs';
import path from 'node:path';

const distDir = 'dist';
const guidelineDir = path.join(distDir, 'guideline-texts');

function spliceReplace(source, target, replacement) {
  const idx = source.indexOf(target);
  if (idx === -1) throw new Error('not found: ' + target.slice(0, 80));
  return source.slice(0, idx) + replacement + source.slice(idx + target.length);
}

const html = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');

const jsMatch = html.match(/<script type="module"[^>]*src="([^"]+)"><\/script>/);
const cssMatch = html.match(/<link rel="stylesheet"[^>]*href="([^"]+)">/);
if (!jsMatch || !cssMatch) throw new Error('could not locate script/css tags');

const js = fs.readFileSync(path.join(distDir, jsMatch[1].replace(/^\//, '')), 'utf8');
const css = fs.readFileSync(path.join(distDir, cssMatch[1].replace(/^\//, '')), 'utf8');

// Embed guideline-texts so the "저장소에 저장된 지침" dropdown works inside a
// single-file preview (Artifacts can't serve a folder of static assets).
const files = fs.readdirSync(guidelineDir);
const embedded = {};
for (const f of files) {
  embedded[f] = fs.readFileSync(path.join(guidelineDir, f), 'utf8');
}
const embeddedJson = JSON.stringify(embedded);

const fetchShim = `
<script>
(function () {
  var GT = ${embeddedJson};
  var origFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : input.url;
    var m = url.match(/guideline-texts\\/([^/?]+)$/);
    if (m && Object.prototype.hasOwnProperty.call(GT, m[1])) {
      var isJson = m[1].endsWith('.json');
      return Promise.resolve(new Response(GT[m[1]], {
        status: 200,
        headers: { 'Content-Type': isJson ? 'application/json' : 'text/plain; charset=utf-8' },
      }));
    }
    return origFetch(input, init);
  };
})();
</script>
`;

let out = html;
out = spliceReplace(out, jsMatch[0], fetchShim + `<script type="module">\n${js}\n</script>`);
out = spliceReplace(out, cssMatch[0], `<style>\n${css}\n</style>`);
out = out.replace(/<link rel="manifest"[^>]*>/, '');
out = out.replace(/<script id="vite-plugin-pwa:register-sw"[^>]*><\/script>/, '');
out = out.replace(/<link rel="icon"[^>]*>/, '');
out = out.replace(/<link rel="apple-touch-icon"[^>]*>/, '');

const outPath = process.argv[2] || '/tmp/preview.html';
fs.writeFileSync(outPath, out);
console.log('wrote', out.length, 'bytes to', outPath);
console.log('embedded files:', Object.keys(embedded).length);
