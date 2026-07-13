import type { AppData } from '../types/quiz';

const STORAGE_KEY = 'archives-quiz-data-v1';

function emptyData(): AppData {
  return { version: 1, categories: [], questions: [], stats: {}, bookmarks: [] };
}

export function loadData(): AppData {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return emptyData();
  try {
    const parsed = JSON.parse(raw) as AppData;
    return {
      version: 1,
      categories: parsed.categories ?? [],
      questions: parsed.questions ?? [],
      stats: parsed.stats ?? {},
      bookmarks: parsed.bookmarks ?? [],
    };
  } catch {
    return emptyData();
  }
}

export function saveData(data: AppData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function exportDataAsFile(data: AppData): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `archives-quiz-backup-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function parseImportedFile(text: string): AppData {
  const parsed = JSON.parse(text) as Partial<AppData>;
  if (!Array.isArray(parsed.categories) || !Array.isArray(parsed.questions)) {
    throw new Error('올바른 백업 파일 형식이 아닙니다.');
  }
  return {
    version: 1,
    categories: parsed.categories,
    questions: parsed.questions,
    stats: parsed.stats ?? {},
    bookmarks: parsed.bookmarks ?? [],
  };
}
