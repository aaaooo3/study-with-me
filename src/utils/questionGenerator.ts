export interface DraftQuestion {
  draftId: string;
  type: 'OX' | 'FILL_BLANK';
  prompt: string;
  answer?: boolean;
  answers?: string[];
  explanation?: string;
  source: string;
  score: number;
  sourceLabel?: string;
}

const NOISE_KEYWORDS = [
  'Copyright',
  'National Archives',
  '표준열람',
  '총괄부서',
  '소관부서',
  '제 정 자',
  '개정일',
  '심의사업',
];

// Document-history narrative ("2013년 2차 개정 시에는…", "…심의를 거쳐
// 제정되었다") — real body text in some standards (especially NAK-1's 서식
// examples) but useless as study material.
const META_NARRATIVE_RE =
  /\d\s*차\s*개정|제정\s*시에는|개정\s*시에는|개정에서는|제정되었|개정되었|고시\s*제\s*\d|이\s*표준의\s*열람|의견\s*또는\s*질|심의를\s*거쳐|유지[․‧·\s]*관리한다/;

// 1–3 digit numbers only: 4-digit years ("2009년") are announcement dates,
// not the retention periods (30년, 5년…) worth memorizing. 차 (1차/2차) is
// likewise revision-history vocabulary.
const NUMBER_UNIT_RE = /(?<!\d)\d{1,3}\s?(?:년|개월|일|시간|건|부|점|퍼센트|%)/;
const QUOTED_TERM_RE = /[“「『]([^”」』]{2,20})[”」』]/;

// Each rule: `re` locates a flippable span (capture group 1 is what gets
// replaced by `to`, which may reference $1…). Rules are context-guarded so an
// OX flip only fires where reversing the word genuinely changes a testable
// fact — never on drafting conventions like "(이하 …라 한다)" or inside a word
// that merely contains the target ("비공개" contains "공개").
const NUM_UNIT = String.raw`\d[\d,]*\s*(?:년|개월|일|시간|건|호|명|점|퍼센트|%|장|매|권|부|회|급|종|개|배|㎜|㎝|㎏|㎡|℃)\s*`;

interface AntonymRule {
  re: RegExp;
  to: string;
}

const ANTONYM_RULES: AntonymRule[] = [
  // Size comparisons — only meaningful right after a number + unit, which is
  // what excludes "이하 …라 한다" (hereinafter) and "이상에서 …" (as above).
  { re: new RegExp(`(${NUM_UNIT})이상`), to: '$1이하' },
  { re: new RegExp(`(${NUM_UNIT})이하`), to: '$1이상' },
  { re: new RegExp(`(${NUM_UNIT})초과`), to: '$1미만' },
  { re: new RegExp(`(${NUM_UNIT})미만`), to: '$1초과' },
  // Clear verb/state polarity.
  { re: /(포함한다)/, to: '제외한다' },
  { re: /(제외한다)/, to: '포함한다' },
  { re: /(?<!불)(가능하다)/, to: '불가능하다' },
  { re: /(불가능하다)/, to: '가능하다' },
  { re: /(금지(?:한다|된다|하여야|해야))/, to: '허용한다' },
  { re: /(허용(?:한다|된다|하여야|해야))/, to: '금지한다' },
  { re: /(수\s*)있(다|으며|고|음)/, to: '$1없$2' },
  { re: /(수\s*)없(다|으며|고|음)/, to: '$1있$2' },
  { re: /(증가)(?!율)/, to: '감소' },
  { re: /(감소)(?!율)/, to: '증가' },
  { re: /(연장)/, to: '단축' },
  { re: /(단축)/, to: '연장' },
  // 공개 ↔ 비공개 — a genuinely important records-management distinction, but
  // "공개" is highly productive in compounds (정보공개, 공개업무, 공개관리…),
  // so only flip when it's used as a classification VALUE: a standalone word
  // (not glued to a preceding Hangul syllable) that a record is classified as.
  { re: /(?<![가-힣])공개(?=\s?기록물|\s?대상|으?로 구분|으?로 분류|으?로 재분류)/, to: '비공개' },
  { re: /비공개(?=\s?기록물|\s?대상|으?로 구분|으?로 분류|으?로 재분류)/, to: '공개' },
];

// The converted guideline files are structured markdown; strip the markup so
// heading lines don't leak into prompts and bullets/callouts read as prose.
function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6} .*$/gm, ' ')
    .replace(/^> ?/gm, '')
    .replace(/^- /gm, '')
    .replace(/\*\*/g, '');
}

function splitSentences(text: string): string[] {
  const flattened = stripMarkdown(text).replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ');
  return flattened
    .split(/(?<=[가-힣])\.\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function isNoise(sentence: string): boolean {
  return NOISE_KEYWORDS.some((k) => sentence.includes(k));
}

function hangulRatio(sentence: string): number {
  const hangul = sentence.match(/[가-힣]/g)?.length ?? 0;
  return hangul / sentence.length;
}

function isCandidate(sentence: string): boolean {
  if (sentence.length < 20 || sentence.length > 220) return false;
  if (isNoise(sentence)) return false;
  if (META_NARRATIVE_RE.test(sentence)) return false;
  if (hangulRatio(sentence) < 0.4) return false;
  return true;
}

function tryFillBlank(sentence: string, source: string): DraftQuestion | null {
  const numberMatch = sentence.match(NUMBER_UNIT_RE);
  if (numberMatch) {
    const token = numberMatch[0];
    const idx = sentence.indexOf(token);
    const prompt = sentence.slice(0, idx) + '___' + sentence.slice(idx + token.length);
    return {
      draftId: crypto.randomUUID(),
      type: 'FILL_BLANK',
      prompt,
      answers: [token.replace(/\s/g, '')],
      source,
      score: 3,
    };
  }

  const quotedMatch = sentence.match(QUOTED_TERM_RE);
  if (quotedMatch) {
    const token = quotedMatch[1];
    const full = quotedMatch[0];
    const idx = sentence.indexOf(full);
    const prompt = sentence.slice(0, idx) + '「___」' + sentence.slice(idx + full.length);
    return {
      draftId: crypto.randomUUID(),
      type: 'FILL_BLANK',
      prompt,
      answers: [token],
      source,
      score: 2,
    };
  }

  return null;
}

function tryOx(sentence: string, source: string, usedForFillBlank: boolean): DraftQuestion | null {
  for (const { re, to } of ANTONYM_RULES) {
    if (!re.test(sentence)) continue;
    const flip = Math.random() < 0.5;
    if (!flip) {
      return {
        draftId: crypto.randomUUID(),
        type: 'OX',
        prompt: sentence,
        answer: true,
        source,
        score: 2,
      };
    }
    const altered = sentence.replace(re, to);
    if (altered === sentence) continue; // replacement was a no-op; try next rule
    return {
      draftId: crypto.randomUUID(),
      type: 'OX',
      prompt: altered,
      answer: false,
      explanation: `원문: ${sentence}`,
      source,
      score: 2,
    };
  }

  if (!usedForFillBlank) {
    return {
      draftId: crypto.randomUUID(),
      type: 'OX',
      prompt: sentence,
      answer: true,
      source,
      score: 1,
    };
  }

  return null;
}

export function generateDrafts(text: string, maxDrafts = 80, sourceLabel?: string): DraftQuestion[] {
  const sentences = splitSentences(text).filter(isCandidate);
  const seen = new Set<string>();
  const drafts: DraftQuestion[] = [];

  for (const sentence of sentences) {
    if (seen.has(sentence)) continue;
    seen.add(sentence);

    const fillBlank = tryFillBlank(sentence, sentence);
    if (fillBlank) drafts.push(fillBlank);

    const ox = tryOx(sentence, sentence, Boolean(fillBlank));
    if (ox) drafts.push(ox);
  }

  drafts.sort((a, b) => b.score - a.score);
  const picked = drafts.slice(0, maxDrafts);
  if (sourceLabel) {
    for (const d of picked) d.sourceLabel = sourceLabel;
  }
  return picked;
}
