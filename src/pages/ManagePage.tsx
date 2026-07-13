import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAppData } from '../store/AppDataContext';
import type { Question, QuestionType } from '../types/quiz';
import { exportDataAsFile, parseImportedFile } from '../store/storage';
import QuestionForm from '../components/QuestionForm';

export default function ManagePage() {
  const { categoryId } = useParams();
  const { data, addCategory, deleteCategory, deleteQuestion, replaceAll } = useAppData();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [showForm, setShowForm] = useState(false);

  if (!categoryId) {
    const handleAddCategory = () => {
      const name = newCategoryName.trim();
      if (!name) return;
      const category = addCategory(name);
      setNewCategoryName('');
      navigate(`/manage/${category.id}`);
    };

    const handleExport = () => exportDataAsFile(data);

    const handleImportClick = () => fileInputRef.current?.click();

    const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const parsed = parseImportedFile(text);
        if (confirm('가져온 백업으로 현재 데이터를 덮어씁니다. 계속할까요?')) {
          replaceAll(parsed);
        }
      } catch (err) {
        alert(err instanceof Error ? err.message : '파일을 읽을 수 없습니다.');
      } finally {
        e.target.value = '';
      }
    };

    return (
      <div className="page">
        <div className="page-header">
          <h1>카테고리 관리</h1>
          <Link to="/" className="back-link">
            홈
          </Link>
        </div>

        <div className="card">
          <div className="field">
            <label>새 카테고리 (지침명)</label>
            <div className="button-row">
              <input
                type="text"
                value={newCategoryName}
                placeholder="예: 기록물관리 지침"
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                style={{ flex: 1 }}
              />
              <button className="btn btn-primary" onClick={handleAddCategory}>
                추가
              </button>
            </div>
          </div>
        </div>

        <div className="category-list">
          {data.categories.map((category) => {
            const count = data.questions.filter((q) => q.categoryId === category.id).length;
            return (
              <div key={category.id} className="category-card">
                <div className="card-row">
                  <div>
                    <div className="category-name">{category.name}</div>
                    <div className="category-meta">문제 {count}개</div>
                  </div>
                </div>
                <div className="button-row">
                  <Link to={`/manage/${category.id}`} className="btn btn-sm">
                    문제 관리
                  </Link>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => {
                      if (confirm(`'${category.name}' 카테고리와 모든 문제를 삭제할까요?`)) {
                        deleteCategory(category.id);
                      }
                    }}
                  >
                    삭제
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="card">
          <div className="category-meta" style={{ marginBottom: 10 }}>
            데이터 백업 (다른 기기로 옮기거나 안전하게 보관)
          </div>
          <div className="button-row">
            <button className="btn" onClick={handleExport}>
              내보내기 (JSON)
            </button>
            <button className="btn" onClick={handleImportClick}>
              가져오기
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              style={{ display: 'none' }}
              onChange={handleImportFile}
            />
          </div>
        </div>
      </div>
    );
  }

  const category = data.categories.find((c) => c.id === categoryId);
  const questions = data.questions.filter((q) => q.categoryId === categoryId);

  if (!category) {
    return (
      <div className="page">
        <div className="empty-state">
          <p>존재하지 않는 카테고리입니다.</p>
          <Link to="/manage" className="btn">
            카테고리 목록으로
          </Link>
        </div>
      </div>
    );
  }

  const typeLabel: Record<QuestionType, string> = {
    OX: 'OX',
    MCQ: '객관식',
    FILL_BLANK: '빈칸',
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>{category.name}</h1>
        <Link to="/manage" className="back-link">
          목록
        </Link>
      </div>

      {!showForm && (
        <button
          className="btn btn-primary btn-block"
          onClick={() => {
            setEditingQuestion(null);
            setShowForm(true);
          }}
        >
          + 문제 추가
        </button>
      )}

      {showForm && (
        <QuestionForm
          categoryId={category.id}
          existing={editingQuestion}
          onDone={() => {
            setShowForm(false);
            setEditingQuestion(null);
          }}
        />
      )}

      <div className="question-list">
        {questions.length === 0 && (
          <div className="empty-state">
            <p>등록된 문제가 없습니다. 위에서 문제를 추가해보세요.</p>
          </div>
        )}
        {questions.map((q) => (
          <div key={q.id} className="question-card">
            <span className="question-type-badge">{typeLabel[q.type]}</span>
            <div>{q.prompt}</div>
            <div className="category-meta">
              {q.type === 'OX' && `정답: ${q.answer ? 'O' : 'X'}`}
              {q.type === 'MCQ' && `정답: ${q.choices[q.answerIndex]}`}
              {q.type === 'FILL_BLANK' && `정답: ${q.answers.join(' / ')}`}
            </div>
            <div className="button-row">
              <button
                className="btn btn-sm"
                onClick={() => {
                  setEditingQuestion(q);
                  setShowForm(true);
                }}
              >
                수정
              </button>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => {
                  if (confirm('이 문제를 삭제할까요?')) deleteQuestion(q.id);
                }}
              >
                삭제
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
