import { test, expect } from './fixtures/auth.fixture';

test.describe('알림 페이지 - 게스트', () => {
  test('FullPageModal이 렌더링된다', async ({ asGuest }) => {
    await asGuest.goto('/notifications');
    await expect(asGuest.getByText('알림').first()).toBeVisible({ timeout: 10_000 });
  });

  test('비로그인 시 로그인 안내 UI가 표시된다', async ({ asGuest }) => {
    await asGuest.goto('/notifications');
    await expect(asGuest.getByText('로그인하면 알림을 받을 수 있어요')).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('알림 페이지 - 로그인 사용자', () => {
  test('키워드 공지 목록이 표시된다', async ({ asLoggedInUser }) => {
    await asLoggedInUser.goto('/notifications');
    await expect(asLoggedInUser.locator('.animate-spin')).toHaveCount(0, { timeout: 10_000 });
    // 목 데이터의 키워드 공지 제목 확인
    await expect(asLoggedInUser.getByText('장학금 안내')).toBeVisible({ timeout: 10_000 });
  });

  test('키워드 설정 바에 현재 키워드 수와 설정 버튼이 표시된다', async ({ asLoggedInUser }) => {
    await asLoggedInUser.goto('/notifications');
    await expect(asLoggedInUser.getByText('알림 받는 키워드 2개')).toBeVisible({ timeout: 10_000 });
    await expect(asLoggedInUser.getByRole('button', { name: '키워드 설정' })).toBeVisible();
  });
});

test.describe('알림 페이지 - 반응형', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('모바일에서 전체 화면 모달로 표시된다', async ({ asGuest }) => {
    await asGuest.goto('/notifications');
    await expect(asGuest.getByText('알림').first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('키워드 배지 서버 동기화', () => {
  test('벨 클릭 시 PATCH /users/me에 keyword_notice_seen_at 전송', async ({ asLoggedInUser }) => {
    await asLoggedInUser.goto('/');
    await asLoggedInUser.locator('[aria-label="알림"]').waitFor({ timeout: 10_000 });

    const patchPromise = asLoggedInUser.waitForRequest(
      (req) => req.url().includes('/users/me') && req.method() === 'PATCH',
      { timeout: 15_000 }
    );

    await asLoggedInUser.locator('[aria-label="알림"]').click();
    const patchReq = await patchPromise;

    const body = JSON.parse(patchReq.postData() || '{}');
    expect(body).toHaveProperty('keyword_notice_seen_at');
    expect(body.keyword_notice_seen_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test('홈 키워드 탭에 빨간 점 배지가 없음', async ({ asLoggedInUser }) => {
    await asLoggedInUser.goto('/');
    await asLoggedInUser.locator('[aria-label="알림"]').waitFor({ timeout: 10_000 });

    await expect(asLoggedInUser.locator('.h-2.w-2.rounded-full.bg-red-500')).toHaveCount(0, {
      timeout: 5000,
    });
  });

  test('서버 seen_at 미래 값이면 배지 숫자 0', async ({ page }) => {
    const { mockAuthenticatedAPIs } = await import('./fixtures/api-mocks');
    const { MOCK_USER } = await import('./fixtures/test-data');

    await mockAuthenticatedAPIs(page, {
      user: { ...MOCK_USER, keyword_notice_seen_at: '2099-01-01T00:00:00Z' },
    });

    await page.goto('/');
    await page.locator('[aria-label="알림"]').waitFor({ timeout: 10_000 });

    await expect(page.locator('[aria-label="알림"] .bg-red-500')).toHaveCount(0, {
      timeout: 5000,
    });
  });
});

test.describe('키워드 배지 localStorage 새로고침 시나리오', () => {
  test('markKeywordNoticesSeen 후 localStorage keyword_notice_seen_at 값이 존재해야 함', async ({ page }) => {
    const { mockAuthenticatedAPIs } = await import('./fixtures/api-mocks');

    await mockAuthenticatedAPIs(page);

    await page.goto('/');
    await page.locator('[aria-label="알림"]').waitFor({ timeout: 10_000 });

    // 벨 클릭 → markKeywordNoticesSeen(keywordNotices) 호출 → localStorage 설정
    await page.locator('[aria-label="알림"]').click();

    // 네비게이션 완료 대기 (홈 → /notifications)
    await page.waitForURL('**/notifications**', { timeout: 10_000 });

    // markKeywordNoticesSeen이 localStorage에 keyword_notice_seen_at을 설정했는지 확인
    const value = await page.evaluate(() => localStorage.getItem('keyword_notice_seen_at'));
    expect(value).not.toBeNull();
  });

  test('keyword_notice_seen_at localStorage 값이 새로고침 후에도 유지되어야 함', async ({ page }) => {
    const { mockAuthenticatedAPIs } = await import('./fixtures/api-mocks');

    await mockAuthenticatedAPIs(page);
    await page.addInitScript(() => {
      localStorage.setItem('keyword_notice_seen_at', '2099-01-01T00:00:00.000Z');
    });

    await page.goto('/');
    await page.locator('[aria-label="알림"]').waitFor({ timeout: 10_000 });

    await page.reload();
    await page.locator('[aria-label="알림"]').waitFor({ timeout: 10_000 });

    // localStorage 보존 확인
    const value = await page.evaluate(() => localStorage.getItem('keyword_notice_seen_at'));
    expect(value).not.toBeNull();

    // 새로고침 후 배지 카운트가 0 이어야 함 (숫자 배지 없음)
    await expect(page.locator('[aria-label="알림"] .bg-red-500')).toHaveCount(0, { timeout: 5000 });
  });

  test('서버 keyword_notice_seen_at이 null이어도 기존 localStorage 값을 삭제하지 않아야 함', async ({ page }) => {
    const { mockAuthenticatedAPIs } = await import('./fixtures/api-mocks');
    const { MOCK_USER } = await import('./fixtures/test-data');

    await mockAuthenticatedAPIs(page, {
      user: { ...MOCK_USER, keyword_notice_seen_at: null },
    });
    await page.addInitScript(() => {
      localStorage.setItem('keyword_notice_seen_at', '2023-12-01T00:00:00.000Z');
    });

    await page.goto('/');
    await page.locator('[aria-label="알림"]').waitFor({ timeout: 10_000 });

    const value = await page.evaluate(() => localStorage.getItem('keyword_notice_seen_at'));
    expect(value).not.toBeNull();
    expect(value).toBe('2023-12-01T00:00:00.000Z');
  });
});
