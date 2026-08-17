import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAppData } from '../store/AppDataContext';
import type { Question } from '../types/quiz';
import { shuffle } from '../utils/shuffle';

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, '');
}

function isCorrectAnswer(question: Question, response: unknown): boolean {
  if (question.type === 'OX') return response === question.answer;
  if (question.type === 'MCQ') return response === question.answerIndex;
  if (question.type === 'FILL_BLANK') {
    const text = typeof response === 'string' ? response : '';
    return question.answers.some((a) => normalize(a) === normalize(text));
  }
  return false;
}

export default function QuizPage() {
  const { categoryId } = useParams();
  const { data, recordAnswer } = useAppData();

  const category = categoryId === 'all' ? null : data.categories.find((c) => c.id === categoryId);
  const baseQuestions = useMemo(() => {
    const pool =
      categoryId === 'all'
        ? data.questions
        : data.questions.filter((q) => q.categoryId === categoryId);
    return shuffle(pool);
  }, [categoryId, data.questions]);

  const [queue, setQueue] = useState<Question[]>(baseQuestions);
  const [index, setIndex] = useState(0);
  const [response, setResponse] = useState<unknown>(undefined);
  const [revealed, setRevealed] = useState(false);
  const [fillInput, setFillInput] = useState('');
  const [score, setScore] = useState({ correct: 0, wrong: 0 });
  const [wrongQuestions, setWrongQuestions] = useState<Question[]>([]);
  const [finished, setFinished] = useState(false);

  if (baseQuestions.length === 0) {
    return (
      <div className="page">
        <div className="page-header">
          <h1>퀴즈</h1>
          <Link to="/" className="back-link">
            홈
          </Link>
        </div>
        <div className="empty-state">
          <p>이 카테고리에는 아직 문제가 없어요.</p>
          <Link to="/manage" className="btn btn-primary">
            문제 추가하러 가기
          </Link>
        </div>
      </div>
    );
  }

  const total = queue.length;
  const current = queue[index];

  const handleAnswer = (value: unknown) => {
    if (revealed) return;
    const correct = isCorrectAnswer(current, value);
    setResponse(value);
    setRevealed(true);
    recordAnswer(current.id, correct);
    if (correct) {
      setScore((s) => ({ ...s, correct: s.correct + 1 }));
    } else {
      setScore((s) => ({ ...s, wrong: s.wrong + 1 }));
      setWrongQuestions((w) => [...w, current]);
    }
  };

  const handleSubmitFill = () => handleAnswer(fillInput);

  const goNext = () => {
    setResponse(undefined);
    setRevealed(false);
    setFillInput('');
    if (index + 1 < total) {
      setIndex(index + 1);
    } else {
      setFinished(true);
    }
  };

  const restartWithWrong = () => {
    setQueue(shuffle(wrongQuestions));
    setWrongQuestions([]);
    setScore({ correct: 0, wrong: 0 });
    setIndex(0);
    setResponse(undefined);
    setRevealed(false);
    setFillInput('');
    setFinished(false);
  };

  const restartAll = () => {
    setQueue(shuffle(baseQuestions));
    setWrongQuestions([]);
    setScore({ correct: 0, wrong: 0 });
    setIndex(0);
    setResponse(undefined);
    setRevealed(false);
    setFillInput('');
    setFinished(false);
  };

  if (finished) {
    const pct = Math.round((score.correct / total) * 100);
    return (
      <div className="page">
        <div className="page-header">
          <h1>결과</h1>
          <Link to="/" className="back-link">
            홈
          </Link>
        </div>
        <div className="quiz-summary card">
          <div className="score">{pct}%</div>
          <div>
            {total}문제 중 {score.correct}개 정답, {score.wrong}개 오답
          </div>
          <div className="button-row" style={{ justifyContent: 'center' }}>
            {wrongQuestions.length > 0 && (
              <button className="btn btn-primary" onClick={restartWithWrong}>
                틀린 문제 다시 풀기 ({wrongQuestions.length})
              </button>
            )}
            <button className="btn" onClick={restartAll}>
              처음부터 다시
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>{category ? category.name : '전체 랜덤 퀴즈'}</h1>
        <Link to="/" className="back-link">
          홈
        </Link>
      </div>

      <div className="quiz-progress">
        <div
          className="quiz-progress-fill"
          style={{ width: `${(index / total) * 100}%` }}
        />
      </div>
      <div className="category-meta">
        {index + 1} / {total}
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

      {current.type === 'MCQ' && (
        <div className="quiz-choices">
          {current.choices.map((choice, i) => {
            const cls =
              revealed && response === i
                ? i === current.answerIndex
                  ? 'correct'
                  : 'wrong'
                : revealed && i === current.answerIndex
                  ? 'correct'
                  : '';
            return (
              <button
                key={i}
                className={`quiz-choice-btn ${cls}`}
                disabled={revealed}
                onClick={() => handleAnswer(i)}
              >
                {choice}
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
            <div>정답: {current.answers.join(' / ')}</div>
          )}
          {current.explanation && <div className="quiz-explanation">{current.explanation}</div>}
        </div>
      )}

      {revealed && (
        <button className="btn btn-primary btn-block" onClick={goNext}>
          {index + 1 < total ? '다음 문제' : '결과 보기'}
        </button>
      )}
    </div>
  );
}
