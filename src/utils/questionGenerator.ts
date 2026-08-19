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
// Only curly double quotes “…” / 『…』 wrap *defined terms* ("전자기록물"이라
// 함은…). The angle brackets 「…」/｢…｣ almost always wrap the name of another
// statute or standard being cited — testing those is rote citation trivia, so
// they are deliberately excluded from blanking.
const DEFINED_TERM_RE = /[“『]([^”』]{2,20})[”』]/;
// A term that is itself the name of a law/regulation/standard — never blank it.
const LAW_NAME_RE = /(?:법|법률|령|규칙|규정|조례|훈령|예규|준칙|지침|표준|고시)$/;

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
    // Drop the source metadata blockquote ("> NAK 4 · 2025 · v2.3 · …",
    // "> 법령 · 시행 2025 …") entirely — it's citation info, not study
    // material. Guideline lines read "NAK <num> ·" and law lines "법령 ·".
    .replace(/^> ?(?:NAK|법령)[ \d].*$/gm, ' ')
    .replace(/^> ?/gm, '')
    .replace(/^- /gm, '')
    .replace(/\*\*/g, '');
}

// Illustrative example content — "<예시1> 박정희의장 …", "보기 올바른 예)",
// sample record listings — is concrete filler, not a rule worth memorizing.
// A whole sentence carrying one of these markers is dropped; the softer
// parenthetical clarifier "(예: 일반공공행정)" is merely stripped so the
// surrounding definition survives.
const EXAMPLE_MARKER = /예시|예제|＜예|<예|예＞|예>|(?:^|\s)보기(?:\s|\d)|올바른 예|잘못된 예|예\)/;

// A standard designation ("NAK 3:2021(v2.4)") in a sentence means it's either
// a leaked running header or an 인용표준 cross-reference list — citation noise,
// not study content.
const STANDARD_DESIGNATION = /NAK\s*[\d-]+\s*[: ]\s*(?:19|20)\d\d\s*\(v/;

// A sentence that only *introduces* a list or a 별표/그림 ("…은 다음과 같다",
// "…은 별표 11과 같다") carries no judgeable claim on its own — the content is
// in the list that follows. Fine as a fill-blank host if it has a blankable
// number/term, but never as a bare OX ("~는 다음과 같다" → O tests nothing).
const LIST_INTRO_END =
  /(?:(?:다음|아래|위)(?:\s*각\s*호)?[과와에]?\s*(?:같다|같음|같습니다|따른다)|(?:별표|별지|서식|표|그림)\s*[\dA-Za-z가-힣.\-]*\s*[과와을를에]?\s*(?:같다|같음|따른다)|각\s*호와\s*같다)\s*[.]?\s*$/;

function stripParentheticalExamples(text: string): string {
  return text
    .replace(/[(（]\s*예(?:시)?\s*[:：][^)）]*[)）]/g, '')
    .replace(/[(（]\s*보기\s*\d*\s*[)）]/g, '');
}

function splitSentences(text: string): string[] {
  let flattened = stripParentheticalExamples(stripMarkdown(text))
    .replace(/\n+/g, ' ')
    .replace(/\s{2,}/g, ' ');
  // Some sentences run together with no space after the period ("있다.재난…").
  // Insert one after a period that follows a sentence-ending syllable and is
  // immediately followed by Hangul, so the split below catches it. The
  // syllable guard keeps "3.7" / "제2.1항" intact.
  flattened = flattened.replace(/(?<=[다음됨함임략])\.(?=[가-힣])/g, '. ');
  return flattened
    .split(/(?<=[가-힣)”」])\.\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// Sentences that open with a reference to something in the previous sentence
// ("여기에는…", "이는…", "위의…") are meaningless once pulled out on their own,
// so they make unanswerable quiz prompts. Reject them as candidates.
const ANAPHORA_START =
  /^(?:여기|이는|이것|그것|이러한|그러한|이와|그와|이에|그에|이때|이 경우|그 경우|이 때|위\s|위의|위에서|앞서|앞의|아래|상기|해당\s|동\s|그러나|그러므로|따라서|또한|또,|반면|한편|다만,?\s|이를|그를|이러|그리고)/;

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
  if (ANAPHORA_START.test(sentence)) return false;
  if (EXAMPLE_MARKER.test(sentence)) return false;
  if (STANDARD_DESIGNATION.test(sentence)) return false;
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

  const quotedMatch = sentence.match(DEFINED_TERM_RE);
  if (quotedMatch && !LAW_NAME_RE.test(quotedMatch[1])) {
    const token = quotedMatch[1];
    const full = quotedMatch[0];
    const idx = sentence.indexOf(full);
    const prompt = sentence.slice(0, idx) + '“___”' + sentence.slice(idx + full.length);
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

    // List/table-introducer sentences make no sense as a standalone OX, but a
    // fill-blank on a real number/term inside them is still fair.
    if (LIST_INTRO_END.test(sentence)) continue;

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
