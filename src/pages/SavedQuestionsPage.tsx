import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppData } from '../store/AppDataContext';
import type { BookmarkedQuestion } from '../types/quiz';
import { shuffle } from '../utils/shuffle';

function isCorrectAnswer(q: BookmarkedQuestion, response: unknown): boolean {
  if (q.type === 'OX') return response === q.answer;
  const text = typeof response === 'string' ? response : '';
  return (q.answers ?? []).some((a) => a.trim().toLowerCase() === text.trim().toLowerCase());
}

export default function SavedQuestionsPage() {
  const { data, removeBookmark } = useAppData();
  const [mode, setMode] = useState<'quiz' | 'list'>('quiz');
  const [queue, setQueue] = useState<BookmarkedQuestion[]>(() => shuffle(data.bookmarks));
  const [index, setIndex] = useState(0);
  const [response, setResponse] = useState<unknown>(undefined);
  const [revealed, setRevealed] = useState(false);
  const [fillInput, setFillInput] = useState('');
  const [score, setScore] = useState({ correct: 0, wrong: 0 });

  const reshuffle = () => {
    setQueue(shuffle(data.bookmarks));
    setIndex(0);
    setResponse(undefined);
    setRevealed(false);
    setFillInput('');
    setScore({ correct: 0, wrong: 0 });
  };

  if (data.bookmarks.length === 0) {
    return (
      <div className="page">
        <div className="page-header">
          <h1>저장한 문제</h1>
          <Link to="/" className="back-link">
            홈
          </Link>
        </div>
        <div className="empty-state">
          <p>아직 저장한 문제가 없어요. 랜덤 퀴즈에서 ☆ 저장 버튼을 눌러보세요.</p>
          <Link to="/random-quiz" className="btn btn-primary">
            랜덤 퀴즈로 가기
          </Link>
        </div>
      </div>
    );
  }

  const current = queue[index];

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
    if (index + 1 < queue.length) {
      setIndex(index + 1);
    } else {
      reshuffle();
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>저장한 문제 ({data.bookmarks.length})</h1>
        <Link to="/" className="back-link">
          홈
        </Link>
      </div>

      <div className="type-tabs">
        <div className={`type-tab ${mode === 'quiz' ? 'active' : ''}`} onClick={() => setMode('quiz')}>
          퀴즈로 풀기
        </div>
        <div className={`type-tab ${mode === 'list' ? 'active' : ''}`} onClick={() => setMode('list')}>
          목록 관리
        </div>
      </div>

      {mode === 'list' && (
        <div className="question-list">
          {data.bookmarks.map((b) => (
            <div key={b.id} className="question-card">
              <span className="question-type-badge">{b.type === 'OX' ? 'OX' : '빈칸'}</span>
              <div>{b.prompt}</div>
              <div className="category-meta">
                {b.type === 'OX' ? `정답: ${b.answer ? 'O' : 'X'}` : `정답: ${(b.answers ?? []).join(' / ')}`}
                {b.sourceLabel && ` · ${b.sourceLabel}`}
              </div>
              <button className="btn btn-danger btn-sm" onClick={() => removeBookmark(b.id)}>
                저장 해제
              </button>
            </div>
          ))}
        </div>
      )}

      {mode === 'quiz' && current && (
        <>
          <div className="category-meta">
            {index + 1} / {queue.length} · 맞음 {score.correct} / 틀림 {score.wrong}
          </div>

          <div className="quiz-prompt">{current.prompt}</div>

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
              {index + 1 < queue.length ? '다음 문제' : '처음부터 다시'}
            </button>
          )}
        </>
      )}
    </div>
  );
}
