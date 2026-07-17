import { test, expect } from './fixtures/auth.fixture';

test.describe('친바 페이지 - 게스트', () => {
  test('페이지가 렌더링된다', async ({ asGuest }) => {
    await asGuest.goto('/chinba');
    await expect(asGuest.locator('.animate-spin')).toHaveCount(0, { timeout: 10_000 });
  });

  test('섹션 헤더가 표시된다', async ({ asGuest }) => {
    await asGuest.goto('/chinba');
    await expect(asGuest.getByText('친바 동아리 선택')).toBeVisible({ timeout: 10_000 });
  });

  test('동아리 만들기 버튼이 있다', async ({ asGuest }) => {
    await asGuest.goto('/chinba');
    await expect(asGuest.getByRole('button', { name: '만들기', exact: true })).toBeVisible({ timeout: 10_000 });
  });

  test('비로그인 시 빈 상태가 표시된다', async ({ asGuest }) => {
    await asGuest.goto('/chinba');
    await expect(asGuest.getByText('로그인하면 내 동아리를 골라 바로 들어갈 수 있어요.')).toBeVisible({ timeout: 10_000 });
  });

  test('비로그인 동아리 만들기는 로그인으로 이동한다', async ({ asGuest }) => {
    await asGuest.goto('/chinba');
    await asGuest.getByRole('button', { name: '만들기', exact: true }).click();
    await expect(asGuest).toHaveURL(/\/login\/\?redirect=\/chinba/, { timeout: 10_000 });
  });
});

test.describe('친바 페이지 - 로그인 사용자', () => {
  test('동아리 목록이 표시된다', async ({ asLoggedInUser }) => {
    await asLoggedInUser.goto('/chinba');
    await expect(asLoggedInUser.locator('.animate-spin')).toHaveCount(0, { timeout: 10_000 });
    await expect(asLoggedInUser.getByText('테스트 동아리')).toBeVisible({ timeout: 10_000 });
  });
});
