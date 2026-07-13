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

      {data.categories.length === 0 ? (
        <div className="empty-state">
          <p>아직 등록된 지침 카테고리가 없어요.</p>
          <Link to="/manage" className="btn btn-primary">
            지침 카테고리 만들기
          </Link>
        </div>
      ) : (
        <>
          <div className="card card-row">
            <div>
              <strong>전체 문제 {totalQuestions}개</strong>
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
