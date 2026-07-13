import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(__dirname, '..', 'docs', 'guidelines');
const outDir = path.join(__dirname, '..', 'public', 'guideline-texts');

fs.mkdirSync(outDir, { recursive: true });

// "NAK 19-1 2012(v1.0) 전자기록생산시스템 ....pdf" -> { id: "19-1", year, version, title }
const NAME_RE = /^NAK\s+([\d-]+)\s+(\d{4})\(v([\d.]+)\)\s+(.+?)(?:\s*\(\d+\))?\.pdf$/i;

// From archives.go.kr 기록물관리 표준 현황 페이지 분류 (2026-07 기준, 사용자 제공).
const CATEGORY_MAP = {
  'NAK-1': '서식',
  'NAK-9': '관리주체별',
  'NAK-10': '관리주체별',
  'NAK-15': '관리주체별',
  'NAK-18': '관리주체별',
  'NAK-17': '기록유형별',
  'NAK-35': '기록유형별',
  'NAK-8': '업무절차별 · 메타데이터',
  'NAK-4': '업무절차별 · 기록관리기준표/보존기간',
  'NAK-16-1': '업무절차별 · 공개활용',
  'NAK-16-2': '업무절차별 · 공개활용',
  'NAK-21': '업무절차별 · 공개활용',
  'NAK-13': '업무절차별 · 정리기술/디지털화',
  'NAK-26': '업무절차별 · 정리기술/디지털화',
  'NAK-5-1': '업무절차별 · 평가폐기',
  'NAK-5-2': '업무절차별 · 평가폐기',
  'NAK-2-1': '재난관리',
  'NAK-2-2': '재난관리',
  'NAK-38': '재난관리',
  'NAK-11': '보존환경',
  'NAK-24': '보존환경',
  'NAK-25': '복원/상태검사',
  'NAK-12': '매체/포맷',
  'NAK-30': '매체/포맷',
  'NAK-31-1': '매체/포맷',
  'NAK-31-2': '매체/포맷',
  'NAK-37': '매체/포맷',
  'NAK-6': '시스템 · 기능요건',
  'NAK-7': '시스템 · 기능요건',
  'NAK-19-1': '시스템 · 기능요건',
  'NAK-19-2': '시스템 · 기능요건',
  'NAK-19-3': '시스템 · 기능요건',
  'NAK-20': '시스템 · 기능요건',
  'NAK-32-1': '시스템 · 기술규격',
};
const UNCATEGORIZED = '미분류';

function collapseSpacedLatin(text) {
  // PDF extraction sometimes emits "N a t i o n a l" for Latin runs (per-glyph
  // positioning). Squeeze 3+ single-letter tokens back into one word.
  return text.replace(/\b(?:[A-Za-z]\s+){2,}[A-Za-z]\b/g, (m) => m.replace(/\s+/g, ''));
}

function stripDotLeaders(text) {
  // Table-of-contents leader dots: "머리말 ······· ⅲ"
  return text.replace(/[·․.]{3,}/g, ' ');
}

function cleanText(rawPages) {
  // Drop lines that repeat identically across many pages (running headers/footers).
  const lineCounts = new Map();
  const pagesLines = rawPages.map((p) =>
    p
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean),
  );
  for (const lines of pagesLines) {
    const seen = new Set(lines);
    for (const l of seen) lineCounts.set(l, (lineCounts.get(l) ?? 0) + 1);
  }
  const pageThreshold = Math.max(3, Math.floor(rawPages.length * 0.4));
  const isRepeatedNoise = (line) =>
    line.length < 60 && (lineCounts.get(line) ?? 0) >= pageThreshold;

  const cleanedPages = pagesLines.map((lines) =>
    lines.filter((l) => !isRepeatedNoise(l)).join('\n'),
  );

  let text = cleanedPages.join('\n\n');
  text = stripDotLeaders(text);
  text = collapseSpacedLatin(text);
  text = text
    .split('\n')
    .map((l) => l.replace(/[ \t]{2,}/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
  return text;
}

async function extractPdf(filePath) {
  const data = new Uint8Array(fs.readFileSync(filePath));
  const doc = await pdfjsLib.getDocument({ data }).promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    pages.push(content.items.map((it) => ('str' in it ? it.str : '')).join(' '));
  }
  return pages;
}

const files = fs.readdirSync(srcDir).filter((f) => f.toLowerCase().endsWith('.pdf'));
const manifest = [];

for (const file of files) {
  const match = file.match(NAME_RE);
  const id = match ? `NAK-${match[1]}` : file.replace(/\.pdf$/i, '');
  const title = match ? match[4].trim() : file.replace(/\.pdf$/i, '');
  const year = match ? match[2] : undefined;
  const version = match ? match[3] : undefined;

  process.stdout.write(`extracting ${file} ... `);
  const pages = await extractPdf(path.join(srcDir, file));
  const text = cleanText(pages);
  const outFile = `${id}.md`;
  fs.writeFileSync(
    path.join(outDir, outFile),
    `# ${title}\n\nNAK ${match ? match[1] : ''} · ${year ?? ''} · v${version ?? ''}\n\n${text}\n`,
  );
  const category = CATEGORY_MAP[id] ?? UNCATEGORIZED;
  manifest.push({ id, title, year, version, category, sourceFile: file, textFile: outFile, pages: pages.length });
  console.log(`${pages.length} pages, ${text.length} chars`);
}

manifest.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
fs.writeFileSync(path.join(outDir, 'index.json'), JSON.stringify(manifest, null, 2));
console.log(`\nWrote ${manifest.length} text files + index.json to ${outDir}`);
