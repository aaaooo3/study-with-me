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
          <strong>⭐ 엄선 문제</strong>
          <div className="category-meta">
            지침 원문을 읽고 직접 만든 문제예요. 함정 있는 OX, 오답 보기가 있는 객관식,
            해설과 근거 조항까지 붙어 있어요.
          </div>
        </div>
        <Link to="/curated" className="btn btn-primary btn-block">
          엄선 문제 풀기
        </Link>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div>
          <strong>🎲 바로 랜덤 퀴즈</strong>
          <div className="category-meta">
            지침·법령 원문에서 규칙으로 자동 생성한 문제라 품질은 들쭉날쭉하지만, 양이 많아요.
            보존기간·기한 같은 숫자 암기에 쓸 만해요.
          </div>
        </div>
        <Link to="/random-quiz" className="btn btn-block">
          랜덤 문제 풀기
        </Link>
      </div>

      {data.bookmarks.length > 0 && (
        <Link to="/saved" className="btn btn-block">
          ⭐ 저장한 문제 다시보기 ({data.bookmarks.length})
        </Link>
      )}

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
