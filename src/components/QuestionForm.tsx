import { useState } from 'react';
import { useAppData } from '../store/AppDataContext';
import type { NewQuestion, Question, QuestionType } from '../types/quiz';

interface Props {
  categoryId: string;
  existing: Question | null;
  onDone: () => void;
}

export default function QuestionForm({ categoryId, existing, onDone }: Props) {
  const { addQuestion, updateQuestion } = useAppData();
  const [type, setType] = useState<QuestionType>(existing?.type ?? 'OX');
  const [prompt, setPrompt] = useState(existing?.prompt ?? '');
  const [explanation, setExplanation] = useState(existing?.explanation ?? '');
  const [oxAnswer, setOxAnswer] = useState(existing?.type === 'OX' ? existing.answer : true);
  const [choices, setChoices] = useState<string[]>(
    existing?.type === 'MCQ' ? existing.choices : ['', '', '', ''],
  );
  const [answerIndex, setAnswerIndex] = useState(existing?.type === 'MCQ' ? existing.answerIndex : 0);
  const [fillAnswers, setFillAnswers] = useState(
    existing?.type === 'FILL_BLANK' ? existing.answers.join(', ') : '',
  );

  const handleSave = () => {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      alert('문제 내용을 입력해주세요.');
      return;
    }

    let payload: NewQuestion;

    if (type === 'OX') {
      payload = {
        categoryId,
        type: 'OX',
        prompt: trimmedPrompt,
        explanation: explanation.trim() || undefined,
        answer: oxAnswer,
      };
    } else if (type === 'MCQ') {
      const cleanedChoices = choices.map((c) => c.trim()).filter(Boolean);
      if (cleanedChoices.length < 2) {
        alert('보기를 최소 2개 이상 입력해주세요.');
        return;
      }
      if (answerIndex >= cleanedChoices.length) {
        alert('정답 보기를 선택해주세요.');
        return;
      }
      payload = {
        categoryId,
        type: 'MCQ',
        prompt: trimmedPrompt,
        explanation: explanation.trim() || undefined,
        choices: cleanedChoices,
        answerIndex,
      };
    } else {
      const answers = fillAnswers
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean);
      if (answers.length === 0) {
        alert('정답을 하나 이상 입력해주세요.');
        return;
      }
      payload = {
        categoryId,
        type: 'FILL_BLANK',
        prompt: trimmedPrompt,
        explanation: explanation.trim() || undefined,
        answers,
      };
    }

    if (existing) {
      updateQuestion(existing.id, payload);
    } else {
      addQuestion(payload);
    }
    onDone();
  };

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="type-tabs">
        {(['OX', 'MCQ', 'FILL_BLANK'] as QuestionType[]).map((t) => (
          <div
            key={t}
            className={`type-tab ${type === t ? 'active' : ''}`}
            onClick={() => setType(t)}
          >
            {t === 'OX' ? 'OX' : t === 'MCQ' ? '객관식' : '빈칸채우기'}
          </div>
        ))}
      </div>

      <div className="field">
        <label>문제 (지침 내용을 바탕으로 작성)</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={
            type === 'FILL_BLANK'
              ? '예: 기록물의 보존기간은 ___ 로 구분한다.'
              : '문제 내용을 입력하세요'
          }
        />
      </div>

      {type === 'OX' && (
        <div className="field">
          <label>정답</label>
          <div className="type-tabs">
            <div
              className={`type-tab ${oxAnswer ? 'active' : ''}`}
              onClick={() => setOxAnswer(true)}
            >
              O
            </div>
            <div
              className={`type-tab ${!oxAnswer ? 'active' : ''}`}
              onClick={() => setOxAnswer(false)}
            >
              X
            </div>
          </div>
        </div>
      )}

      {type === 'MCQ' && (
        <div className="field">
          <label>보기 (정답 앞 라디오 버튼 선택)</label>
          {choices.map((choice, i) => (
            <div className="choice-row" key={i}>
              <input
                type="radio"
                name="mcq-answer"
                checked={answerIndex === i}
                onChange={() => setAnswerIndex(i)}
              />
              <input
                type="text"
                value={choice}
                placeholder={`보기 ${i + 1}`}
                onChange={(e) => {
                  const next = [...choices];
                  next[i] = e.target.value;
                  setChoices(next);
                }}
              />
            </div>
          ))}
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setChoices([...choices, ''])}
          >
            + 보기 추가
          </button>
        </div>
      )}

      {type === 'FILL_BLANK' && (
        <div className="field">
          <label>정답 (여러 개면 쉼표로 구분, 동의어 인정)</label>
          <input
            type="text"
            value={fillAnswers}
            placeholder="예: 10년, 준영구"
            onChange={(e) => setFillAnswers(e.target.value)}
          />
        </div>
      )}

      <div className="field">
        <label>해설 (선택)</label>
        <textarea
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          placeholder="정답 근거나 지침 조항을 적어두면 복습에 도움돼요"
        />
      </div>

      <div className="button-row">
        <button className="btn btn-primary" onClick={handleSave}>
          {existing ? '수정 저장' : '문제 저장'}
        </button>
        <button className="btn" onClick={onDone}>
          취소
        </button>
      </div>
    </div>
  );
}
