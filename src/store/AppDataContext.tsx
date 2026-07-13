import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { AppData, Category, NewQuestion, Question, QuizStats } from '../types/quiz';
import { loadData, saveData } from './storage';

interface AppDataContextValue {
  data: AppData;
  addCategory: (name: string, description?: string) => Category;
  updateCategory: (id: string, patch: Partial<Pick<Category, 'name' | 'description'>>) => void;
  deleteCategory: (id: string) => void;
  addQuestion: (question: NewQuestion) => Question;
  updateQuestion: (id: string, patch: Partial<Question>) => void;
  deleteQuestion: (id: string) => void;
  recordAnswer: (questionId: string, correct: boolean) => void;
  replaceAll: (next: AppData) => void;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);

function uid(): string {
  return crypto.randomUUID();
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(() => loadData());

  const persist = useCallback((next: AppData) => {
    setData(next);
    saveData(next);
  }, []);

  const addCategory = useCallback(
    (name: string, description?: string) => {
      const category: Category = { id: uid(), name, description, createdAt: Date.now() };
      persist({ ...data, categories: [...data.categories, category] });
      return category;
    },
    [data, persist],
  );

  const updateCategory = useCallback(
    (id: string, patch: Partial<Pick<Category, 'name' | 'description'>>) => {
      persist({
        ...data,
        categories: data.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      });
    },
    [data, persist],
  );

  const deleteCategory = useCallback(
    (id: string) => {
      persist({
        ...data,
        categories: data.categories.filter((c) => c.id !== id),
        questions: data.questions.filter((q) => q.categoryId !== id),
      });
    },
    [data, persist],
  );

  const addQuestion = useCallback(
    (question: NewQuestion) => {
      const full = { ...question, id: uid(), createdAt: Date.now() } as Question;
      persist({ ...data, questions: [...data.questions, full] });
      return full;
    },
    [data, persist],
  );

  const updateQuestion = useCallback(
    (id: string, patch: Partial<Question>) => {
      persist({
        ...data,
        questions: data.questions.map((q) => (q.id === id ? ({ ...q, ...patch } as Question) : q)),
      });
    },
    [data, persist],
  );

  const deleteQuestion = useCallback(
    (id: string) => {
      persist({ ...data, questions: data.questions.filter((q) => q.id !== id) });
    },
    [data, persist],
  );

  const recordAnswer = useCallback(
    (questionId: string, correct: boolean) => {
      const prev: QuizStats = data.stats[questionId] ?? {
        questionId,
        correctCount: 0,
        wrongCount: 0,
        lastAnsweredAt: 0,
      };
      const nextStat: QuizStats = {
        ...prev,
        correctCount: prev.correctCount + (correct ? 1 : 0),
        wrongCount: prev.wrongCount + (correct ? 0 : 1),
        lastAnsweredAt: Date.now(),
      };
      persist({ ...data, stats: { ...data.stats, [questionId]: nextStat } });
    },
    [data, persist],
  );

  const replaceAll = useCallback(
    (next: AppData) => {
      persist(next);
    },
    [persist],
  );

  const value = useMemo<AppDataContextValue>(
    () => ({
      data,
      addCategory,
      updateCategory,
      deleteCategory,
      addQuestion,
      updateQuestion,
      deleteQuestion,
      recordAnswer,
      replaceAll,
    }),
    [data, addCategory, updateCategory, deleteCategory, addQuestion, updateQuestion, deleteQuestion, recordAnswer, replaceAll],
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData(): AppDataContextValue {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used within AppDataProvider');
  return ctx;
}
