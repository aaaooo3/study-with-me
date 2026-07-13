import { useEffect, useState } from 'react';
import { useAppData } from '../store/AppDataContext';
import { generateDrafts, type DraftQuestion } from '../utils/questionGenerator';
import type { GuidelineTextEntry } from '../types/guideline';
import type { NewQuestion } from '../types/quiz';

interface Props {
  categoryId: string;
  onDone: () => void;
}

const typeLabel: Record<DraftQuestion['type'], string> = { OX: 'OX', FILL_BLANK: '빈칸' };

export default function AutoGenerate({ categoryId, onDone }: Props) {
  const { addQuestions } = useAppData();
  const [entries, setEntries] = useState<GuidelineTextEntry[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [pastedText, setPastedText] = useState('');
  const [drafts, setDrafts] = useState<DraftQuestion[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}guideline-texts/index.json`)
      .then((r) => r.json())
      .then((list: GuidelineTextEntry[]) => setEntries(list))
      .catch(() => setEntries([]));
  }, []);

  const handleGenerate = async () => {
    setError('');
    setLoading(true);
    try {
      let text = pastedText;
      if (selectedId) {
        const entry = entries.find((e) => e.id === selectedId);
        if (entry) {
          const res = await fetch(`${import.meta.env.BASE_URL}guideline-texts/${entry.textFile}`);
          text = await res.text();
        }
      }
      if (!text.trim()) {
        setError('저장된 지침을 선택하거나 텍스트를 붙여넣어주세요.');
        setLoading(false);
        return;
      }
      const result = generateDrafts(text);
      setDrafts(result);
      setSelected(new Set(result.map((d) => d.draftId)));
    } finally {
      setLoading(false);
    }
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const updateDraft = (id: string, patch: Partial<DraftQuestion>) => {
    setDrafts((prev) => prev.map((d) => (d.draftId === id ? { ...d, ...patch } : d)));
  };

  const handleAddSelected = () => {
    const toAdd = drafts.filter((d) => selected.has(d.draftId));
    const payloads: NewQuestion[] = toAdd.map((d) =>
      d.type === 'OX'
        ? { categoryId, type: 'OX', prompt: d.prompt, answer: Boolean(d.answer), explanation: d.explanation }
        : { categoryId, type: 'FILL_BLANK', prompt: d.prompt, answers: d.answers ?? [], explanation: d.explanation },
    );
    addQuestions(payloads);
    onDone();
  };

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="field">
        <label>저장소에 저장된 지침에서 생성</label>
        <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
          <option value="">직접 텍스트 붙여넣기</option>
          {entries.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.id} · {entry.title}
            </option>
          ))}
        </select>
      </div>

      {!selectedId && (
        <div className="field">
          <label>지침 원문 텍스트 붙여넣기</label>
          <textarea
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            placeholder="지침 원문 텍스트를 붙여넣으세요"
            style={{ minHeight: 120 }}
          />
        </div>
      )}

      {error && <div className="quiz-feedback wrong">{error}</div>}

      <div className="button-row">
        <button className="btn btn-primary" onClick={handleGenerate} disabled={loading}>
          {loading ? '생성 중...' : '문제 후보 생성'}
        </button>
        <button className="btn" onClick={onDone}>
          취소
        </button>
      </div>

      {drafts.length > 0 && (
        <>
          <div className="category-meta">
            규칙 기반 자동 생성이라 품질이 낮을 수 있어요. 이상한 문제는 체크 해제하거나
            내용을 고친 뒤 추가하세요. ({selected.size}/{drafts.length}개 선택됨)
          </div>
          <div className="question-list">
            {drafts.map((d) => (
              <div key={d.draftId} className="question-card">
                <div className="card-row">
                  <span className="question-type-badge">{typeLabel[d.type]}</span>
                  <input
                    type="checkbox"
                    checked={selected.has(d.draftId)}
                    onChange={() => toggle(d.draftId)}
                  />
                </div>
                <textarea
                  value={d.prompt}
                  onChange={(e) => updateDraft(d.draftId, { prompt: e.target.value })}
                />
                {d.type === 'OX' ? (
                  <div className="type-tabs">
                    <div
                      className={`type-tab ${d.answer ? 'active' : ''}`}
                      onClick={() => updateDraft(d.draftId, { answer: true })}
                    >
                      O
                    </div>
                    <div
                      className={`type-tab ${!d.answer ? 'active' : ''}`}
                      onClick={() => updateDraft(d.draftId, { answer: false })}
                    >
                      X
                    </div>
                  </div>
                ) : (
                  <input
                    type="text"
                    value={d.answers?.join(', ') ?? ''}
                    onChange={(e) =>
                      updateDraft(d.draftId, {
                        answers: e.target.value.split(',').map((a) => a.trim()).filter(Boolean),
                      })
                    }
                  />
                )}
                {d.explanation && <div className="quiz-explanation">{d.explanation}</div>}
              </div>
            ))}
          </div>
          <button className="btn btn-primary btn-block" onClick={handleAddSelected} disabled={selected.size === 0}>
            선택한 {selected.size}개 문제 추가
          </button>
        </>
      )}
    </div>
  );
}
