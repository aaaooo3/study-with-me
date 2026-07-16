import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rtfToText } from './rtf.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(__dirname, '..', 'docs', 'laws');
const outDir = path.join(__dirname, '..', 'public', 'guideline-texts');

fs.mkdirSync(outDir, { recursive: true });

// filename → { id, category } (category doubles as the law's short kind).
const LAW_META = [
  { match: /시행규칙/, id: 'LAW-시행규칙', category: '시행규칙' },
  { match: /시행령/, id: 'LAW-시행령', category: '시행령' },
  { match: /법률/, id: 'LAW-법률', category: '법률' },
];

function classify(file) {
  return LAW_META.find((m) => m.match.test(file));
}

function structureLaw(rawText) {
  const lines = rawText
    .split('\n')
    .map((l) => l.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean);

  const titleLine = lines.find((l) => /관리에 관한 법률/.test(l)) ?? lines[0];
  const enforceLine = lines.find((l) => /^\[시행/.test(l));
  const title = titleLine.replace(/\s*\(\s*약칭[^)]*\)\s*/, '').trim();

  const bodyStart = lines.findIndex((l) => /^제\d+장|^제\d+조(의\d+)?\(/.test(l));
  const bodyLines = bodyStart >= 0 ? lines.slice(bodyStart) : lines;

  const md = [];
  md.push(`# ${title}`);
  md.push('');
  md.push(`> 법령 · ${enforceLine ? enforceLine.replace(/[[\]]/g, '') : ''}`);
  md.push('');

  // Amendment annotations — "<개정 2020. 3. 31.>" inline and "[전문개정 …]" /
  // "[제목개정 …]" as their own trailing markers — are just dates; drop them.
  const AMEND = /(개정|신설|전문개정|본조신설|본항신설|제목개정|종전제목|종전|시행일|단서신설|전단개정|후단신설)/;
  const stripAmend = (s) =>
    s
      .replace(new RegExp(`<${AMEND.source}[^>]*>`, 'g'), '')
      .replace(new RegExp(`\\[${AMEND.source}[^\\]]*\\]`, 'g'), '')
      .replace(/\s{2,}/g, ' ')
      .trim();

  for (const line of bodyLines) {
    const chapter = /^(제\d+장(?:의\d+)?)\s*(.*)$/.exec(line);
    if (chapter) {
      md.push('');
      md.push(`## ${chapter[1]} ${stripAmend(chapter[2])}`.trim());
      md.push('');
      continue;
    }
    if (/^부칙/.test(line)) {
      md.push('');
      md.push(`## 부칙`);
      md.push('');
      continue;
    }
    const article = /^(제\d+조(?:의\d+)?)\(([^)]*)\)\s*(.*)$/.exec(line);
    if (article) {
      md.push('');
      md.push(`### ${article[1]}(${article[2]})`);
      md.push('');
      const body = stripAmend(article[3]);
      if (body) md.push(body);
      continue;
    }
    md.push(stripAmend(line));
  }

  return md.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

const files = fs.readdirSync(srcDir).filter((f) => /\.(doc|rtf)$/i.test(f));
const lawEntries = [];

for (const file of files) {
  const meta = classify(file);
  if (!meta) {
    console.warn(`skip (unclassified): ${file}`);
    continue;
  }
  process.stdout.write(`converting ${file} ... `);
  const raw = rtfToText(fs.readFileSync(path.join(srcDir, file)));
  const md = structureLaw(raw);
  const textFile = `${meta.id}.md`;
  const title = (md.match(/^# (.+)$/m) ?? [])[1] ?? meta.id;
  fs.writeFileSync(path.join(outDir, textFile), md);
  lawEntries.push({
    id: meta.id,
    title,
    type: '법령',
    category: meta.category,
    sourceFile: file,
    textFile,
    articles: (md.match(/^### 제/gm) ?? []).length,
  });
  console.log(`${(md.match(/^### 제/gm) ?? []).length} articles, ${md.length} chars`);
}

// Merge into the shared manifest, replacing only the 법령 rows so re-running
// pdf-to-text.mjs and this script in any order is safe.
const indexPath = path.join(outDir, 'index.json');
let manifest = [];
if (fs.existsSync(indexPath)) {
  try {
    manifest = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  } catch {
    manifest = [];
  }
}
manifest = manifest.filter((e) => e.type !== '법령');
manifest.push(...lawEntries);
manifest.sort((a, b) => {
  if ((a.type ?? '지침') !== (b.type ?? '지침')) return (a.type ?? '지침') < (b.type ?? '지침') ? -1 : 1;
  return a.id.localeCompare(b.id, undefined, { numeric: true });
});
fs.writeFileSync(indexPath, JSON.stringify(manifest, null, 2));
console.log(`\nWrote ${lawEntries.length} law files, merged into index.json (${manifest.length} total).`);
