import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { generateDrafts, type DraftQuestion } from '../utils/questionGenerator';
import type { GuidelineTextEntry } from '../types/guideline';
import { shuffle } from '../utils/shuffle';
import { useAppData } from '../store/AppDataContext';

const BATCH_SIZE = 25;
const LOW_WATER_MARK = 5;
const ALL_CATEGORIES = '전체';

function isCorrectAnswer(draft: DraftQuestion, response: unknown): boolean {
  if (draft.type === 'OX') return response === draft.answer;
  const text = typeof response === 'string' ? response : '';
  return (draft.answers ?? []).some((a) => a.trim().toLowerCase() === text.trim().toLowerCase());
}

export default function RandomQuizPage() {
  const { data, addBookmark, removeBookmark } = useAppData();
  const [manifest, setManifest] = useState<GuidelineTextEntry[]>([]);
  const [category, setCategory] = useState(ALL_CATEGORIES);
  const [queue, setQueue] = useState<DraftQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [response, setResponse] = useState<unknown>(undefined);
  const [revealed, setRevealed] = useState(false);
  const [fillInput, setFillInput] = useState('');
  const [score, setScore] = useState({ correct: 0, wrong: 0 });
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const recentIds = useRef<string[]>([]);
  const fetchingRef = useRef(false);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}guideline-texts/index.json`)
      .then((r) => r.json())
      .then((list: GuidelineTextEntry[]) => setManifest(list))
      .catch(() => setError('지침 목록을 불러오지 못했어요.'));
  }, []);

  const categories = useMemo(() => {
    const set = new Set(manifest.map((e) => e.category));
    return [ALL_CATEGORIES, ...Array.from(set).sort()];
  }, [manifest]);

  const eligible = useMemo(
    () => (category === ALL_CATEGORIES ? manifest : manifest.filter((e) => e.category === category)),
    [manifest, category],
  );

  const appendMore = async (list: GuidelineTextEntry[]) => {
    if (fetchingRef.current || list.length === 0) return;
    fetchingRef.current = true;
    setLoadingMore(true);
    try {
      const avoid = new Set(recentIds.current);
      const pool = list.filter((e) => !avoid.has(e.id));
      const entry = (pool.length > 0 ? pool : list)[Math.floor(Math.random() * (pool.length > 0 ? pool.length : list.length))];
      recentIds.current = [...recentIds.current, entry.id].slice(-5);

      const res = await fetch(`${import.meta.env.BASE_URL}guideline-texts/${entry.textFile}`);
      const text = await res.text();
      const drafts = shuffle(generateDrafts(text, BATCH_SIZE, `${entry.id} · ${entry.title}`));
      setQueue((prev) => [...prev, ...drafts]);
    } catch {
      setError('문제를 생성하지 못했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      fetchingRef.current = false;
      setLoadingMore(false);
    }
  };

  const resetAndReload = (list: GuidelineTextEntry[]) => {
    recentIds.current = [];
    setQueue([]);
    setIndex(0);
    setResponse(undefined);
    setRevealed(false);
    setFillInput('');
    setScore({ correct: 0, wrong: 0 });
    setError('');
    if (list.length > 0) appendMore(list);
  };

  useEffect(() => {
    if (manifest.length > 0 && queue.length === 0) {
      appendMore(eligible);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manifest]);

  useEffect(() => {
    if (eligible.length > 0 && queue.length - index < LOW_WATER_MARK) {
      appendMore(eligible);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, queue.length, eligible]);

  const handleCategoryChange = (next: string) => {
    setCategory(next);
    const list = next === ALL_CATEGORIES ? manifest : manifest.filter((e) => e.category === next);
    resetAndReload(list);
  };

  const current = queue[index];
  const bookmarked = current ? data.bookmarks.find((b) => b.prompt === current.prompt) : undefined;

  const toggleBookmark = () => {
    if (!current) return;
    if (bookmarked) {
      removeBookmark(bookmarked.id);
    } else {
      addBookmark({
        type: current.type,
        prompt: current.prompt,
        answer: current.answer,
        answers: current.answers,
        explanation: current.explanation,
        sourceLabel: current.sourceLabel,
      });
    }
  };

  const handleAnswer = (value: unknown) => {
    if (!current || revealed) return;
    const correct = isCorrectAnswer(current, value);
    setResponse(value);
    setRevealed(true);
    setScore((s) => (correct ? { ...s, correct: s.correct + 1 } : { ...s, wrong: s.wrong + 1 }));
  };

  const handleSubmitFill = () => handleAnswer(fillInput);

  const goNext = () => {
    setResponse(undefined);
    setRevealed(false);
    setFillInput('');
    setIndex((i) => i + 1);
  };

  if (error && queue.length === 0) {
    return (
      <div className="page">
        <div className="page-header">
          <h1>랜덤 퀴즈</h1>
          <Link to="/" className="back-link">
            홈
          </Link>
        </div>
        <div className="empty-state">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>랜덤 퀴즈</h1>
        <Link to="/" className="back-link">
          홈
        </Link>
      </div>

      <div className="field">
        <label>카테고리</label>
        <select value={category} onChange={(e) => handleCategoryChange(e.target.value)}>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {!current ? (
        <div className="empty-state">
          <p>문제를 불러오는 중...</p>
        </div>
      ) : (
        <>
          <div className="category-meta">
            {current.sourceLabel} · 맞음 {score.correct} / 틀림 {score.wrong}
            {loadingMore && ' · 다음 문제 준비 중...'}
          </div>

          <div className="card-row">
            <div className="quiz-prompt" style={{ flex: 1 }}>
              {current.prompt}
            </div>
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
                const cls =
                  revealed && response === val
                    ? val === current.answer
                      ? 'correct'
                      : 'wrong'
                    : revealed && val === current.answer
                      ? 'correct'
                      : '';
                return (
                  <button
                    key={label}
                    className={`quiz-choice-btn ${cls}`}
                    disabled={revealed}
                    onClick={() => handleAnswer(val)}
                  >
                    {label}
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
                onKeyDown={(e) => e.key === 'Enter' && !revealed && handleSubmitFill()}
              />
              {!revealed && (
                <button className="btn btn-primary" onClick={handleSubmitFill}>
                  제출
                </button>
              )}
            </div>
          )}

          {revealed && (
            <div className={`quiz-feedback ${isCorrectAnswer(current, response) ? 'correct' : 'wrong'}`}>
              {isCorrectAnswer(current, response) ? '정답이에요!' : '오답이에요.'}
              {current.type === 'FILL_BLANK' && !isCorrectAnswer(current, response) && (
                <div>정답: {(current.answers ?? []).join(' / ')}</div>
              )}
              {current.explanation && <div className="quiz-explanation">{current.explanation}</div>}
            </div>
          )}

          {revealed && (
            <button className="btn btn-primary btn-block" onClick={goNext}>
              다음 문제
            </button>
          )}

          <div className="category-meta" style={{ textAlign: 'center', marginTop: 8 }}>
            규칙 기반 자동 생성 문제라 가끔 어색할 수 있어요.
          </div>
        </>
      )}

      <Link to="/saved" className="btn btn-block">
        저장한 문제 다시보기 ({data.bookmarks.length})
      </Link>
    </div>
  );
}
