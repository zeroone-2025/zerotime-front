import { test, expect } from './fixtures/auth.fixture';

test.describe('필터 페이지 - 게스트', () => {
  test('FullPageModal이 렌더링된다', async ({ asGuest }) => {
    await asGuest.goto('/filter');
    await expect(asGuest.getByRole('heading', { name: '관심 게시판 설정' })).toBeVisible({ timeout: 10_000 });
  });

  test('뒤로가기 버튼이 있다', async ({ asGuest }) => {
    await asGuest.goto('/filter');
    await expect(asGuest.getByRole('button', { name: '뒤로가기' })).toBeVisible({ timeout: 10_000 });
  });

  test('게시판 카테고리가 표시된다', async ({ asGuest }) => {
    await asGuest.goto('/filter');
    // 카테고리 헤더 h4가 보여야 함 (구 '전북대' 라벨 → 다학교 지원으로 '본부'로 개칭)
    await expect(asGuest.getByRole('heading', { name: '본부', exact: true })).toBeVisible({ timeout: 10_000 });
  });

  test('게시판 검색 입력란이 있다', async ({ asGuest }) => {
    await asGuest.goto('/filter');
    await expect(asGuest.getByPlaceholder('게시판 검색')).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('필터 페이지 - 로그인 사용자', () => {
  test('FullPageModal이 렌더링된다', async ({ asLoggedInUser }) => {
    await asLoggedInUser.goto('/filter');
    await expect(asLoggedInUser.getByRole('heading', { name: '관심 게시판 설정' })).toBeVisible({ timeout: 10_000 });
  });

  test('게시판 카테고리가 표시된다', async ({ asLoggedInUser }) => {
    await asLoggedInUser.goto('/filter');
    await expect(asLoggedInUser.getByRole('heading', { name: '본부', exact: true })).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('필터 페이지 - 반응형', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('모바일에서 전체 화면 모달로 표시된다', async ({ asGuest }) => {
    await asGuest.goto('/filter');
    await expect(asGuest.getByRole('heading', { name: '관심 게시판 설정' })).toBeVisible({ timeout: 10_000 });
  });
});
