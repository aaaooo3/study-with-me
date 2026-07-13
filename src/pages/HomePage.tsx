import { Link } from 'react-router-dom';
import { useAppData } from '../store/AppDataContext';

export default function HomePage() {
  const { data } = useAppData();
  const totalQuestions = data.questions.length;

  const categoryCards = data.categories.map((category) => {
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
          <Link
            to={count > 0 ? `/quiz/${category.id}` : '#'}
            className="btn btn-primary btn-sm"
            aria-disabled={count === 0}
            onClick={(e) => count === 0 && e.preventDefault()}
          >
            퀴즈 풀기
          </Link>
          <Link to={`/manage/${category.id}`} className="btn btn-sm">
            문제 관리
          </Link>
        </div>
      </div>
    );
  });

  return (
    <div className="page">
      <div className="page-header">
        <h1>기록원 지침 퀴즈</h1>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div>
          <strong>🎲 바로 랜덤 퀴즈</strong>
          <div className="category-meta">
            카테고리 설정 없이, 지침 34종에서 계속 랜덤으로 문제를 만들어서 보여줘요.
          </div>
        </div>
        <Link to="/random-quiz" className="btn btn-primary btn-block">
          지금 시작
        </Link>
      </div>

      {data.categories.length === 0 ? (
        <div className="empty-state">
          <p>내가 직접 고른 문제만 모은 카테고리를 만들고 싶다면:</p>
          <Link to="/manage" className="btn">
            지침 카테고리 만들기
          </Link>
        </div>
      ) : (
        <>
          <div className="card card-row">
            <div>
              <strong>내 카테고리 문제 {totalQuestions}개</strong>
              <div className="category-meta">{data.categories.length}개 카테고리</div>
            </div>
            {totalQuestions > 0 && (
              <Link to="/quiz/all" className="btn btn-primary btn-sm">
                전체 랜덤 퀴즈
              </Link>
            )}
          </div>

          <div className="category-list">{categoryCards}</div>

          <Link to="/manage" className="btn btn-block">
            + 카테고리 및 문제 관리
          </Link>
        </>
      )}
    </div>
  );
}
