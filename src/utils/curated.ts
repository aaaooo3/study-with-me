import type { CuratedBank, CuratedQuestion } from '../types/curated';

export interface CuratedSource {
  sourceId: string;
  title: string;
  file: string;
}

const base = import.meta.env.BASE_URL;

export async function loadCuratedSources(): Promise<CuratedSource[]> {
  const res = await fetch(`${base}curated/index.json`);
  if (!res.ok) throw new Error('failed to load curated index');
  return res.json();
}

export async function loadCuratedQuestions(sources: CuratedSource[]): Promise<CuratedQuestion[]> {
  const banks = await Promise.all(
    sources.map(async (s) => {
      const res = await fetch(`${base}curated/${s.file}`);
      if (!res.ok) return { version: 1, questions: [] } as CuratedBank;
      return (await res.json()) as CuratedBank;
    }),
  );
  return banks.flatMap((b) => b.questions ?? []);
}
