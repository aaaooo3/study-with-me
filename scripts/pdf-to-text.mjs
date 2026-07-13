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
  // Table-of-contents leader dots, both glued ("·······") and spaced
  // ("· · · · ·") variants.
  return text.replace(/(?:[·‧․.]\s+){2,}[·‧․.]?/g, ' ').replace(/[·․.]{3,}/g, ' ');
}

// Some PDFs print bare page numbers (no "- N -" dashes) that land as the
// first or last token of a page. A bare small integer at a page edge is only
// stripped when its offset against the PDF page index matches the dominant
// offset across the document — a real data value won't line up that way.
function stripBarePageNumbers(pages) {
  const candidates = []; // { pageIdx, edge: 'lead'|'trail', value }
  const edgeTokens = pages.map((p) => {
    const tokens = p.split(/\s+/).filter(Boolean);
    return { first: tokens[0], last: tokens[tokens.length - 1] };
  });
  edgeTokens.forEach(({ first, last }, i) => {
    if (/^\d{1,3}$/.test(first ?? '')) candidates.push({ pageIdx: i, edge: 'lead', value: Number(first) });
    if (/^\d{1,3}$/.test(last ?? '')) candidates.push({ pageIdx: i, edge: 'trail', value: Number(last) });
  });
  const offsetCounts = new Map();
  for (const c of candidates) {
    const off = c.value - c.pageIdx;
    offsetCounts.set(off, (offsetCounts.get(off) ?? 0) + 1);
  }
  let bestOffset = null;
  let bestCount = 0;
  for (const [off, count] of offsetCounts) {
    if (count > bestCount) {
      bestOffset = off;
      bestCount = count;
    }
  }
  if (bestOffset === null || bestCount < 3) return pages;
  return pages.map((p, i) => {
    let out = p;
    const { first, last } = edgeTokens[i];
    if (/^\d{1,3}$/.test(first ?? '') && Number(first) - i === bestOffset) {
      out = out.replace(/^\s*\d{1,3}(?=\s|$)/, '');
    }
    if (/^\d{1,3}$/.test(last ?? '') && Number(last) - i === bestOffset) {
      out = out.replace(/(?<=\s|^)\d{1,3}\s*$/, '');
    }
    return out;
  });
}

function cleanText(rawPages, designationRe) {
  // pdf.js hands us each page as one long line, so running headers can't be
  // caught line-wise — instead strip the document's own designation string
  // ("NAK 19-3:2015(v1.0)"), which is what these standards use as a header.
  let cleanedPages = rawPages.map((p) => (designationRe ? p.replace(designationRe, ' ') : p));
  cleanedPages = stripBarePageNumbers(cleanedPages);

  let text = cleanedPages.join('\n\n');
  text = stripDotLeaders(text);
  text = collapseSpacedLatin(text);
  // Page-number remnants between pages: "- 3 -", "- ii -", "- Ⅲ -"
  text = text.replace(/-\s*[0-9]{1,3}\s*-/g, ' ').replace(/-\s*[ivxIVXⅰ-ⅻⅠ-Ⅻ]{1,5}\s*-/g, ' ');
  text = text
    .split('\n')
    .map((l) => l.replace(/[ \t]{2,}/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
  return text;
}

const SCOPE_RE = /1\s*적\s*용\s*범\s*위/g;

// Locate the real body start: "1 적용범위" appears first in the TOC, then as
// the actual section heading. Everything before the second occurrence is
// cover page / revision history / copyright / TOC / preface — noise for both
// reading and quiz generation.
function findBodyBounds(flat) {
  SCOPE_RE.lastIndex = 0;
  const first = SCOPE_RE.exec(flat);
  if (!first) return null;
  const second = SCOPE_RE.exec(flat);
  if (!second) return null;
  return { tocEntryStart: first.index, bodyStart: second.index };
}

// Parse "번호 제목 쪽번호" runs out of the TOC region. Titles containing
// digits (제1부, PDF/A-1b…) can confuse the split; entries that parse wrong
// simply won't match the body later, which is a safe failure.
function parseTocEntries(tocText) {
  const entries = [];
  const re = /(?:^|\s)(\d{1,2}(?:\.\d{1,2}){0,3})\s+([가-힣(][^\n]*?)\s+\d{1,3}(?=\s+(?:\d{1,2}(?:\.\d{1,2}){0,3}\s+[가-힣(]|부\s*속\s*서|$))/g;
  let m;
  while ((m = re.exec(tocText)) !== null) {
    const num = m[1];
    const title = m[2].replace(/\s{2,}/g, ' ').trim();
    if (title.length >= 2 && title.length <= 60) entries.push({ num, title });
  }
  return entries;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Insert markdown headings at each TOC entry's position in the body,
// scanning forward so repeated strings (cross-references) don't misfire.
function insertHeadings(body, entries) {
  let out = '';
  let cursor = 0;
  for (const { num, title } of entries) {
    // Char-level whitespace flexibility: TOC may say "적용근거" while the
    // body heading is spaced out as "적용 근거".
    const flexTitle = title
      .replace(/\s+/g, '')
      .split('')
      .map(escapeRegex)
      .join('\\s*');
    const re = new RegExp(escapeRegex(num) + '\\s+' + flexTitle);
    const rest = body.slice(cursor);
    const m = rest.match(re);
    if (!m || m.index === undefined) continue;
    const depth = Math.min(num.split('.').length + 1, 4);
    out += rest.slice(0, m.index).trimEnd();
    out += `\n\n${'#'.repeat(depth)} ${num} ${title}\n\n`;
    cursor += m.index + m[0].length;
  }
  out += body.slice(cursor);
  return out;
}

// Make the running prose readable: one sentence per line, bullets for the
// PDF's list markers, callout lines for 비고/표/그림.
function formatProse(text) {
  return text
    .split('\n')
    .map((line) => {
      if (line.startsWith('#')) return line;
      let l = line;
      // PDF tokenization leaves orphan punctuation ("한다 ." / "다만 ,").
      l = l.replace(/(?<=[가-힣)”」]) ([.,])(?=\s|$)/g, '$1');
      l = l.replace(/ [○∙•‧] ?/g, '\n- ');
      // ·/․ double as inline enumeration glue ("보존 ․ 활용"), so only treat
      // them as list markers when a quoted law or standard reference follows.
      l = l.replace(/ [·․]\s*(?=[「｢]|NAK\s?\d)/g, '\n- ');
      // Sentence-per-line. Digits are excluded from the lookbehind so dates
      // ("2012. 8. 9.") and numbered table cells don't get torn apart.
      l = l.replace(/(?<=[가-힣)”」])\.\s+(?=[^\s])/g, '.\n');
      l = l.replace(/(?<=\s|^)비고\s+(?=[가-힣｢「①-⑩0-9])/g, '\n\n> **비고** ');
      l = l.replace(/(^|\n)\s*(표|그림)\s+(\d{1,2})\s*[–—-]\s*/g, '$1\n**$2 $3** — ');
      l = l.replace(/(^|\n)\s*※\s*/g, '$1\n> ※ ');
      return l;
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((l) => l.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Term definitions (3.1, 3.2 …) usually aren't listed in the TOC, so give
// them paragraph breaks + bold numbers within the 용어정의 section.
function splitTermDefinitions(body) {
  const headingMatch = body.match(/\n## (\d{1,2}) 용\s*어\s*정\s*의\n/);
  if (!headingMatch || headingMatch.index === undefined) return body;
  const sectionStart = headingMatch.index + headingMatch[0].length;
  const nextHeading = body.slice(sectionStart).search(/\n#{2,4} /);
  const sectionEnd = nextHeading === -1 ? body.length : sectionStart + nextHeading;
  const n = headingMatch[1];
  const section = body
    .slice(sectionStart, sectionEnd)
    .replace(new RegExp(`(?<=\\s|^)(${n}\\.\\d{1,2})\\s+`, 'g'), '\n\n**$1** ');
  return body.slice(0, sectionStart) + section + body.slice(sectionEnd);
}

function structureMarkdown(cleaned) {
  const flat = cleaned.replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ');
  const bounds = findBodyBounds(flat);
  if (!bounds) return formatProse(cleaned); // fallback: keep everything, still sentence-split

  const tocText = flat.slice(bounds.tocEntryStart, bounds.bodyStart);
  let body = flat.slice(bounds.bodyStart);

  const entries = [{ num: '1', title: '적용범위' }, ...parseTocEntries(tocText).filter((e) => e.num !== '1')];
  // 부속서 gets a heading too if present
  body = insertHeadings(body, entries);
  body = body.replace(/(^|\s)부\s*속\s*서\s*\(\s*(참고|규정)\s*\)\s*/g, '$1\n\n## 부속서 ($2) ');
  body = splitTermDefinitions(body);
  return formatProse(body);
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
  const designationRe = match
    ? new RegExp(`NAK\\s*${escapeRegex(match[1])}\\s*:\\s*${match[2]}\\s*\\(\\s*v${escapeRegex(match[3])}\\s*\\)`, 'g')
    : null;
  const text = structureMarkdown(cleanText(pages, designationRe));
  const outFile = `${id}.md`;
  const category = CATEGORY_MAP[id] ?? UNCATEGORIZED;
  fs.writeFileSync(
    path.join(outDir, outFile),
    `# ${title}\n\n> NAK ${match ? match[1] : ''} · ${year ?? ''} · v${version ?? ''} · ${category}\n\n${text}\n`,
  );
  manifest.push({ id, title, year, version, category, sourceFile: file, textFile: outFile, pages: pages.length });
  console.log(`${pages.length} pages, ${text.length} chars`);
}

manifest.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
fs.writeFileSync(path.join(outDir, 'index.json'), JSON.stringify(manifest, null, 2));
console.log(`\nWrote ${manifest.length} text files + index.json to ${outDir}`);
