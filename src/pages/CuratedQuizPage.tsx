import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { CuratedQuestion } from '../types/curated';
import { loadCuratedQuestions, loadCuratedSources, type CuratedSource } from '../utils/curated';
import { shuffle } from '../utils/shuffle';
import { useAppData } from '../store/AppDataContext';

const ALL = '전체';

function isCorrect(q: CuratedQuestion, response: unknown): boolean {
  if (q.type === 'OX') return response === q.answer;
  if (q.type === 'MCQ') return response === q.answerIndex;
  const text = typeof response === 'string' ? response : '';
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, '');
  return (q.answers ?? []).some((a) => norm(a) === norm(text));
}

export default function CuratedQuizPage() {
  const { data, addBookmark, removeBookmark } = useAppData();
  const [sources, setSources] = useState<CuratedSource[]>([]);
  const [all, setAll] = useState<CuratedQuestion[]>([]);
  const [sourceId, setSourceId] = useState(ALL);
  const [queue, setQueue] = useState<CuratedQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [response, setResponse] = useState<unknown>(undefined);
  const [revealed, setRevealed] = useState(false);
  const [fillInput, setFillInput] = useState('');
  const [score, setScore] = useState({ correct: 0, wrong: 0 });
  const [error, setError] = useState('');

  useEffect(() => {
    loadCuratedSources()
      .then(async (list) => {
        setSources(list);
        const qs = await loadCuratedQuestions(list);
        setAll(qs);
        setQueue(shuffle(qs));
      })
      .catch(() => setError('엄선 문제를 불러오지 못했어요.'));
  }, []);

  const sourceTitle = useMemo(() => {
    const map = new Map(sources.map((s) => [s.sourceId, s.title]));
    return (id: string) => map.get(id) ?? id;
  }, [sources]);

  const restart = (nextSourceId: string) => {
    const pool = nextSourceId === ALL ? all : all.filter((q) => q.sourceId === nextSourceId);
    setQueue(shuffle(pool));
    setIndex(0);
    setResponse(undefined);
    setRevealed(false);
    setFillInput('');
    setScore({ correct: 0, wrong: 0 });
  };

  const handleSourceChange = (next: string) => {
    setSourceId(next);
    restart(next);
  };

  const current = queue[index];
  const bookmarked = current ? data.bookmarks.find((b) => b.prompt === current.prompt) : undefined;

  const toggleBookmark = () => {
    if (!current) return;
    if (bookmarked) {
      removeBookmark(bookmarked.id);
      return;
    }
    // The bookmark store predates MCQ; keep an MCQ reviewable by saving it as a
    // fill-blank whose accepted answer is the correct choice text.
    if (current.type === 'MCQ') {
      const answerText = (current.choices ?? [])[current.answerIndex ?? 0] ?? '';
      addBookmark({
        type: 'FILL_BLANK',
        prompt: `${current.prompt}\n(보기: ${(current.choices ?? []).join(' / ')})`,
        answers: [answerText],
        explanation: current.explanation,
        sourceLabel: sourceTitle(current.sourceId),
      });
      return;
    }
    addBookmark({
      type: current.type,
      prompt: current.prompt,
      answer: current.answer,
      answers: current.answers,
      explanation: current.explanation,
      sourceLabel: sourceTitle(current.sourceId),
    });
  };

  const answer = (value: unknown) => {
    if (!current || revealed) return;
    setResponse(value);
    setRevealed(true);
    setScore((s) =>
      isCorrect(current, value) ? { ...s, correct: s.correct + 1 } : { ...s, wrong: s.wrong + 1 },
    );
  };

  const goNext = () => {
    setResponse(undefined);
    setRevealed(false);
    setFillInput('');
    if (index + 1 < queue.length) setIndex(index + 1);
    else restart(sourceId);
  };

  if (error) {
    return (
      <div className="page">
        <div className="page-header">
          <h1>엄선 문제</h1>
          <Link to="/" className="back-link">홈</Link>
        </div>
        <div className="empty-state"><p>{error}</p></div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>엄선 문제</h1>
        <Link to="/" className="back-link">홈</Link>
      </div>

      <div className="field">
        <label>범위</label>
        <select value={sourceId} onChange={(e) => handleSourceChange(e.target.value)}>
          <option value={ALL}>전체 ({all.length}문제)</option>
          {sources.map((s) => (
            <option key={s.sourceId} value={s.sourceId}>
              {s.sourceId} · {s.title}
            </option>
          ))}
        </select>
      </div>

      {!current ? (
        <div className="empty-state"><p>문제를 불러오는 중...</p></div>
      ) : (
        <>
          <div className="category-meta">
            {index + 1} / {queue.length} · {sourceTitle(current.sourceId)}
            {current.reference ? ` · ${current.reference}` : ''} · 맞음 {score.correct} / 틀림 {score.wrong}
          </div>

          <div className="card-row">
            <div className="quiz-prompt" style={{ flex: 1 }}>{current.prompt}</div>
            <button
              className={`btn btn-sm ${bookmarked ? 'btn-primary' : ''}`}
              onClick={toggleBookmark}
              title="나중에 다시보기"
            >
              {bookmarked ? '★ 저장됨' : '☆ 저장'}
            </button>
          </div>

          {current.type === 'OX' && (
            <div className="quiz-ox-row">
              {[true, false].map((val) => {
                const label = val ? 'O' : 'X';
                const cls = !revealed
                  ? ''
                  : val === current.answer
                    ? 'correct'
                    : response === val
                      ? 'wrong'
                      : '';
                return (
                  <button key={label} className={`quiz-choice-btn ${cls}`} disabled={revealed} onClick={() => answer(val)}>
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          {current.type === 'MCQ' && (
            <div className="quiz-choices">
              {(current.choices ?? []).map((choice, i) => {
                const cls = !revealed
                  ? ''
                  : i === current.answerIndex
                    ? 'correct'
                    : response === i
                      ? 'wrong'
                      : '';
                return (
                  <button key={i} className={`quiz-choice-btn ${cls}`} disabled={revealed} onClick={() => answer(i)}>
                    {`${i + 1}. ${choice}`}
                  </button>
                );
              })}
            </div>
          )}

          {current.type === 'FILL_BLANK' && (
            <div className="field">
              <input
                type="text"
                value={fillInput}
                disabled={revealed}
                placeholder="정답 입력"
                onChange={(e) => setFillInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !revealed && answer(fillInput)}
              />
              {!revealed && (
                <button className="btn btn-primary" onClick={() => answer(fillInput)}>제출</button>
              )}
            </div>
          )}

          {revealed && (
            <div className={`quiz-feedback ${isCorrect(current, response) ? 'correct' : 'wrong'}`}>
              {isCorrect(current, response) ? '정답이에요!' : '오답이에요.'}
              {!isCorrect(current, response) && current.type === 'FILL_BLANK' && (
                <div>정답: {(current.answers ?? []).join(' / ')}</div>
              )}
              {!isCorrect(current, response) && current.type === 'MCQ' && (
                <div>정답: {(current.answerIndex ?? 0) + 1}번</div>
              )}
              <div className="quiz-explanation">{current.explanation}</div>
              {current.reference && (
                <div className="quiz-explanation">근거: {sourceTitle(current.sourceId)} {current.reference}</div>
              )}
            </div>
          )}

          {revealed ? (
            <button className="btn btn-primary btn-block" onClick={goNext}>
              {index + 1 < queue.length ? '다음 문제' : '처음부터 다시'}
            </button>
          ) : (
            <button className="btn btn-block" onClick={goNext}>
              모르겠어요 · 건너뛰기 →
            </button>
          )}
        </>
      )}
    </div>
  );
}
