import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { AppData, BookmarkedQuestion, Category, NewQuestion, Question, QuizStats } from '../types/quiz';
import { loadData, saveData } from './storage';

interface AppDataContextValue {
  data: AppData;
  addCategory: (name: string, description?: string) => Category;
  updateCategory: (id: string, patch: Partial<Pick<Category, 'name' | 'description'>>) => void;
  deleteCategory: (id: string) => void;
  addQuestion: (question: NewQuestion) => Question;
  addQuestions: (questions: NewQuestion[]) => Question[];
  updateQuestion: (id: string, patch: Partial<Question>) => void;
  deleteQuestion: (id: string) => void;
  recordAnswer: (questionId: string, correct: boolean) => void;
  replaceAll: (next: AppData) => void;
  addBookmark: (bookmark: Omit<BookmarkedQuestion, 'id' | 'savedAt'>) => BookmarkedQuestion;
  removeBookmark: (id: string) => void;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);

function uid(): string {
  return crypto.randomUUID();
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(() => loadData());

  const update = useCallback((updater: (prev: AppData) => AppData) => {
    setData((prev) => {
      const next = updater(prev);
      saveData(next);
      return next;
    });
  }, []);

  const addCategory = useCallback(
    (name: string, description?: string) => {
      const category: Category = { id: uid(), name, description, createdAt: Date.now() };
      update((prev) => ({ ...prev, categories: [...prev.categories, category] }));
      return category;
    },
    [update],
  );

  const updateCategory = useCallback(
    (id: string, patch: Partial<Pick<Category, 'name' | 'description'>>) => {
      update((prev) => ({
        ...prev,
        categories: prev.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      }));
    },
    [update],
  );

  const deleteCategory = useCallback(
    (id: string) => {
      update((prev) => ({
        ...prev,
        categories: prev.categories.filter((c) => c.id !== id),
        questions: prev.questions.filter((q) => q.categoryId !== id),
      }));
    },
    [update],
  );

  const addQuestion = useCallback(
    (question: NewQuestion) => {
      const full = { ...question, id: uid(), createdAt: Date.now() } as Question;
      update((prev) => ({ ...prev, questions: [...prev.questions, full] }));
      return full;
    },
    [update],
  );

  const addQuestions = useCallback(
    (questions: NewQuestion[]) => {
      const fulls = questions.map((q) => ({ ...q, id: uid(), createdAt: Date.now() }) as Question);
      update((prev) => ({ ...prev, questions: [...prev.questions, ...fulls] }));
      return fulls;
    },
    [update],
  );

  const updateQuestion = useCallback(
    (id: string, patch: Partial<Question>) => {
      update((prev) => ({
        ...prev,
        questions: prev.questions.map((q) => (q.id === id ? ({ ...q, ...patch } as Question) : q)),
      }));
    },
    [update],
  );

  const deleteQuestion = useCallback(
    (id: string) => {
      update((prev) => ({ ...prev, questions: prev.questions.filter((q) => q.id !== id) }));
    },
    [update],
  );

  const recordAnswer = useCallback(
    (questionId: string, correct: boolean) => {
      update((prev) => {
        const prevStat: QuizStats = prev.stats[questionId] ?? {
          questionId,
          correctCount: 0,
          wrongCount: 0,
          lastAnsweredAt: 0,
        };
        const nextStat: QuizStats = {
          ...prevStat,
          correctCount: prevStat.correctCount + (correct ? 1 : 0),
          wrongCount: prevStat.wrongCount + (correct ? 0 : 1),
          lastAnsweredAt: Date.now(),
        };
        return { ...prev, stats: { ...prev.stats, [questionId]: nextStat } };
      });
    },
    [update],
  );

  const replaceAll = useCallback(
    (next: AppData) => {
      update(() => next);
    },
    [update],
  );

  const addBookmark = useCallback(
    (bookmark: Omit<BookmarkedQuestion, 'id' | 'savedAt'>) => {
      const full: BookmarkedQuestion = { ...bookmark, id: uid(), savedAt: Date.now() };
      update((prev) => ({ ...prev, bookmarks: [...prev.bookmarks, full] }));
      return full;
    },
    [update],
  );

  const removeBookmark = useCallback(
    (id: string) => {
      update((prev) => ({ ...prev, bookmarks: prev.bookmarks.filter((b) => b.id !== id) }));
    },
    [update],
  );

  const value = useMemo<AppDataContextValue>(
    () => ({
      data,
      addCategory,
      updateCategory,
      deleteCategory,
      addQuestion,
      addQuestions,
      updateQuestion,
      deleteQuestion,
      recordAnswer,
      replaceAll,
      addBookmark,
      removeBookmark,
    }),
    [
      data,
      addCategory,
      updateCategory,
      deleteCategory,
      addQuestion,
      addQuestions,
      updateQuestion,
      deleteQuestion,
      recordAnswer,
      replaceAll,
      addBookmark,
      removeBookmark,
    ],
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData(): AppDataContextValue {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used within AppDataProvider');
  return ctx;
}
