export type SourceType = '지침' | '법령';

export interface GuidelineTextEntry {
  id: string;
  title: string;
  type: SourceType;
  category: string;
  textFile: string;
  sourceFile: string;
  year?: string;
  version?: string;
  pages?: number;
  articles?: number;
}
