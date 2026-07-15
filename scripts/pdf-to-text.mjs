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
  text = normalizeInlineSpacing(text);
  text = text
    .split('\n')
    .map((l) => l.replace(/[ \t]{2,}/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
  return text;
}

// These PDFs pad numbers with spaces inside a single glyph run ("제 26 조제 1
// 항", "30 년", "2009 년"). Geometry can't help — the spaces are inside one
// item's string — so squeeze the well-known law-citation and counter forms.
function normalizeInlineSpacing(text) {
  let t = text;
  // 제 26 조 / 제 1 항 / 제 3 호 … (run twice for chains like 조제 1 항)
  const article = /제\s*(\d+)\s*(조|항|호|관|장|절|편|목|권|류|급)/g;
  t = t.replace(article, '제$1$2').replace(article, '제$1$2');
  // 조 의 2 → 조의2 (제34조의2)
  t = t.replace(/(조|항|호)\s*의\s*(\d+)/g, '$1의$2');
  // number + counter/unit: "30 년" → "30년", "5 개월" → "5개월"
  t = t.replace(
    /(\d)\s+(년|개월|일|시간|분|초|주|차|회|개|권|매|건|급|종|호|명|쪽|장|부|배|퍼센트|%|℃|㎡|㎜|㎝|㎏)/g,
    '$1$2',
  );
  // A few dependent-noun / connective phrases the wrap-joiner glues together
  // ("다음과같다", "할때"). These merged forms are never valid Korean, so it's
  // safe to re-space them unconditionally.
  t = t
    .replace(/다음과같(?=[가-힣])/g, '다음과 같')
    .replace(/할(때|수|바|것|경우|줄)(?=\s|[가-힣])/g, '할 $1')
    .replace(/그밖에/g, '그 밖에');
  return t;
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

// Rebuild page text from glyph geometry instead of blindly joining items with
// spaces. pdf.js emits real word spaces as their own " " items, and these
// fully-justified government PDFs wrap mid-word — so the old space-join
// produced "공공기 관" (a word split across a line) while dropping nothing.
//
// First group items into visual lines by baseline (y), concatenating within a
// line directly (explicit " " items carry real spacing). Then join lines:
// a line whose right edge reaches the justified body margin is a forced wrap
// (word continues, join with no space); a short line is an intentional break
// (paragraph/heading/list, join with newline). The body margin is taken as
// the most common line-right value, so a stray wide table doesn't distort it.
function groupLines(items) {
  const toks = items.filter((it) => 'str' in it && it.str.length > 0);
  const lines = [];
  let cur = null;
  for (const it of toks) {
    const x = it.transform[4];
    const y = it.transform[5];
    const right = x + it.width;
    if (cur && Math.abs(y - cur.y) < 3) {
      const gap = x - cur.right;
      const needsSpace = gap > it.height * 0.5 && !/\s$/.test(cur.text) && !/^\s/.test(it.str);
      cur.text += (needsSpace ? ' ' : '') + it.str;
      cur.right = right;
    } else {
      if (cur) lines.push(cur);
      cur = { y, text: it.str, right };
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function dominantRight(lines) {
  const counts = new Map();
  for (const l of lines) {
    const key = Math.round(l.right);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let best = 0;
  let bestCount = 0;
  for (const [val, count] of counts) {
    if (count > bestCount || (count === bestCount && val > best)) {
      best = val;
      bestCount = count;
    }
  }
  return best;
}

function buildPageText(items) {
  const lines = groupLines(items);
  if (lines.length === 0) return '';
  const bodyRight = dominantRight(lines);
  let out = '';
  for (let i = 0; i < lines.length; i++) {
    if (i === 0) {
      out += lines[i].text;
      continue;
    }
    const forcedWrap = lines[i - 1].right >= bodyRight - 12;
    let sep = forcedWrap ? '' : '\n';
    // Never glue a digit to a digit across a wrap: that fuses a line-ending
    // page/list number with the next line's leading number ("적용범위 1" +
    // "2 …" → "12 …"), which wrecks TOC parsing.
    if (sep === '' && /\d$/.test(out) && /^\d/.test(lines[i].text)) sep = ' ';
    // A comma/enumerator at a line end always wants a space after it.
    else if (sep === '' && /[,·;]$/.test(out) && /^[가-힣(｢「“]/.test(lines[i].text)) sep = ' ';
    // A forced wrap loses no space when it lands mid-word ("공공기|관의"), but
    // Korean lines often break right at a word boundary too. Geometry can't
    // tell the two apart, so fall back to grammar: if the previous line ends
    // with a particle/ending, it was a word boundary → keep the space.
    else if (sep === '' && endsAtWordBoundary(out) && /^[가-힣(｢「“]/.test(lines[i].text)) sep = ' ';
    out += sep + lines[i].text;
  }
  return out;
}

// Heuristic: does this text end at a Korean 어절 (word) boundary? Only the
// single-syllable particles that almost never occur as a word's *final*
// syllable mid-word are trusted (를/을/는/은/의/로/에); high-frequency
// mid-word syllables like 기, 도, 과, 등, 중 are deliberately excluded so we
// don't re-split "공공기관" or "지방기능". Multi-char endings are safe.
const WORD_BOUNDARY_END =
  /(?:[를을는은의로에]|에서|으로|부터|까지|에게|에서의|라고|라는|이라|하고|하며|하여|되어|위해|따라|통해|대해|관한|관하여|또는|되었다|하였다|하였으며|한다|된다|이다|없다|있다|하는|되는|있는|없는|았다|었다|였다|다\.|음\.|함\.|임\.|됨\.)$/;

function endsAtWordBoundary(text) {
  const tail = text.slice(-6);
  if (!/[가-힣]$/.test(tail)) return false;
  return WORD_BOUNDARY_END.test(tail);
}

async function extractPdf(filePath) {
  const data = new Uint8Array(fs.readFileSync(filePath));
  const doc = await pdfjsLib.getDocument({ data }).promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    pages.push(buildPageText(content.items));
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
