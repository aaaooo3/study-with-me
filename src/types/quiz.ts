export type QuestionType = 'OX' | 'MCQ' | 'FILL_BLANK';

export interface BaseQuestion {
  id: string;
  categoryId: string;
  type: QuestionType;
  prompt: string;
  explanation?: string;
  source?: string;
  createdAt: number;
}

export interface OXQuestion extends BaseQuestion {
  type: 'OX';
  answer: boolean;
}

export interface MCQQuestion extends BaseQuestion {
  type: 'MCQ';
  choices: string[];
  answerIndex: number;
}

export interface FillBlankQuestion extends BaseQuestion {
  type: 'FILL_BLANK';
  answers: string[];
}

export type Question = OXQuestion | MCQQuestion | FillBlankQuestion;

export type DistributiveOmit<T, K extends keyof any> = T extends unknown ? Omit<T, K> : never;

export type NewQuestion = DistributiveOmit<Question, 'id' | 'createdAt'>;

export interface Category {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
}

export interface QuizStats {
  questionId: string;
  correctCount: number;
  wrongCount: number;
  lastAnsweredAt: number;
}

export interface AppData {
  version: 1;
  categories: Category[];
  questions: Question[];
  stats: Record<string, QuizStats>;
}
