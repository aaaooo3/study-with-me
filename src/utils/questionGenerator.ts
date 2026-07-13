export interface DraftQuestion {
  draftId: string;
  type: 'OX' | 'FILL_BLANK';
  prompt: string;
  answer?: boolean;
  answers?: string[];
  explanation?: string;
  source: string;
  score: number;
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

const NUMBER_UNIT_RE = /\d+\s?(?:년|개월|일|시간|건|부|점|퍼센트|%|차)/;
const QUOTED_TERM_RE = /[“「『]([^”」』]{2,20})[”」』]/;

const ANTONYM_PAIRS: [string, string][] = [
  ['이상', '이하'],
  ['이하', '이상'],
  ['초과', '미만'],
  ['미만', '초과'],
  ['포함한다', '제외한다'],
  ['제외한다', '포함한다'],
  ['가능하다', '불가능하다'],
  ['불가능하다', '가능하다'],
  ['해야 한다', '하지 않아도 된다'],
  ['금지한다', '허용한다'],
  ['허용한다', '금지한다'],
  ['있다', '없다'],
  ['없다', '있다'],
  ['증가', '감소'],
  ['감소', '증가'],
  ['연장', '단축'],
  ['단축', '연장'],
  ['공개', '비공개'],
  ['비공개', '공개'],
  ['원본', '사본'],
];

function splitSentences(text: string): string[] {
  const flattened = text.replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ');
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
  for (const [word, opposite] of ANTONYM_PAIRS) {
    if (sentence.includes(word)) {
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
      const idx = sentence.indexOf(word);
      const altered = sentence.slice(0, idx) + opposite + sentence.slice(idx + word.length);
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

export function generateDrafts(text: string, maxDrafts = 80): DraftQuestion[] {
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
  return drafts.slice(0, maxDrafts);
}
