// Hand-authored questions, in contrast to the rule-generated drafts. These are
// written against the guideline/law text by a person (or by Claude reading the
// source), so they can carry real distractors, traps and explanations that
// pattern matching can't produce.
export type CuratedType = 'OX' | 'MCQ' | 'FILL_BLANK';

export interface CuratedQuestion {
  id: string;
  /** Manifest id of the source document, e.g. "NAK-4" or "LAW-시행령". */
  sourceId: string;
  type: CuratedType;
  prompt: string;
  /** OX only. */
  answer?: boolean;
  /** MCQ only: choices in display order, and the 0-based index of the answer. */
  choices?: string[];
  answerIndex?: number;
  /** FILL_BLANK only: accepted answers (first one is shown as canonical). */
  answers?: string[];
  /** Why the answer is what it is — shown after answering, right or wrong. */
  explanation: string;
  /** Article/section the question comes from, e.g. "4.3.4 보존장소". */
  reference?: string;
}

export interface CuratedBank {
  version: 1;
  questions: CuratedQuestion[];
}
