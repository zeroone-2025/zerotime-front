import { test, expect } from './fixtures/auth.fixture';

test.describe('홈 페이지 - 게스트', () => {
  test('페이지가 정상적으로 로드된다', async ({ asGuest }) => {
    await asGuest.goto('/');
    await expect(asGuest.locator('.animate-spin')).toHaveCount(0, { timeout: 10_000 });
  });

  test('SharedHeader가 렌더링된다', async ({ asGuest }) => {
    await asGuest.goto('/');
    const header = asGuest.locator('header');
    await expect(header).toBeVisible();
  });

  test('알림 버튼이 있다', async ({ asGuest }) => {
    await asGuest.goto('/');
    const bellBtn = asGuest.getByRole('button', { name: '알림' });
    await expect(bellBtn).toBeVisible();
  });

  test('카테고리 필터 4개 탭이 표시된다', async ({ asGuest }) => {
    await asGuest.goto('/');
    await expect(asGuest.getByRole('button', { name: '전체' })).toBeVisible();
    await expect(asGuest.getByRole('button', { name: '안 읽음' })).toBeVisible();
    await expect(asGuest.getByRole('button', { name: '키워드', exact: true })).toBeVisible();
    await expect(asGuest.getByRole('button', { name: '즐겨찾기', exact: true })).toBeVisible();
  });

  test('전체 필터가 기본 활성 상태이다', async ({ asGuest }) => {
    await asGuest.goto('/');
    const allFilter = asGuest.getByRole('button', { name: '전체' });
    await expect(allFilter).toHaveClass(/bg-gray-900/);
  });

  test('필터 설정 버튼이 존재한다', async ({ asGuest }) => {
    await asGuest.goto('/');
    const settingsBtn = asGuest.getByRole('button', { name: '필터 설정' });
    await expect(settingsBtn).toBeVisible();
  });

  test('필터 설정 버튼 클릭 시 /filter로 이동한다', async ({ asGuest }) => {
    await asGuest.goto('/');
    await asGuest.getByRole('button', { name: '필터 설정' }).click();
    await expect(asGuest).toHaveURL(/\/filter/, { timeout: 10_000 });
  });

  test('비로그인 시 안 읽음 탭 클릭하면 전체 필터가 활성 유지된다', async ({ asGuest }) => {
    await asGuest.goto('/');
    await asGuest.getByRole('button', { name: '안 읽음' }).click();
    const allFilter = asGuest.getByRole('button', { name: '전체' });
    await expect(allFilter).toHaveClass(/bg-gray-900/);
  });

  test('공지사항 목록 영역이 존재한다', async ({ asGuest }) => {
    await asGuest.goto('/');
    await expect(asGuest.getByText('2024학년도 장학금 신청 안내')).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('홈 페이지 - 로그인 사용자', () => {
  test('페이지가 정상적으로 로드된다', async ({ asLoggedInUser }) => {
    await asLoggedInUser.goto('/');
    await expect(asLoggedInUser.locator('.animate-spin')).toHaveCount(0, { timeout: 10_000 });
  });

  test('카테고리 필터 탭이 모두 클릭 가능하다', async ({ asLoggedInUser }) => {
    await asLoggedInUser.goto('/');
    await expect(asLoggedInUser.locator('.animate-spin')).toHaveCount(0, { timeout: 10_000 });

    // 안 읽음 탭 클릭
    await asLoggedInUser.getByRole('button', { name: '안 읽음', exact: true }).click();
    await expect(asLoggedInUser.getByRole('button', { name: '안 읽음', exact: true })).toHaveClass(/bg-gray-900/);

    // 키워드 탭 클릭
    await asLoggedInUser.getByRole('button', { name: '키워드', exact: true }).click();
    await expect(asLoggedInUser.getByRole('button', { name: '키워드', exact: true })).toHaveClass(/bg-gray-900/);

    // 즐겨찾기 탭 클릭
    await asLoggedInUser.getByRole('button', { name: '즐겨찾기', exact: true }).click();
    await expect(asLoggedInUser.getByRole('button', { name: '즐겨찾기', exact: true })).toHaveClass(/bg-gray-900/);
  });

  test('공지사항 목록이 표시된다', async ({ asLoggedInUser }) => {
    await asLoggedInUser.goto('/');
    await expect(asLoggedInUser.locator('.animate-spin')).toHaveCount(0, { timeout: 10_000 });
    // 목 데이터의 첫 번째 공지 제목 확인
    await expect(asLoggedInUser.getByText('수강신청 안내')).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('홈 페이지 - 모바일 뷰', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('모바일에서 메뉴 버튼이 보인다', async ({ asGuest }) => {
    await asGuest.goto('/');
    const menuBtn = asGuest.getByRole('button', { name: '메뉴 열기' });
    await expect(menuBtn).toBeVisible();
  });

  test('데스크톱 사이드바가 모바일에서 숨겨진다', async ({ asGuest }) => {
    await asGuest.goto('/');
    const sidebar = asGuest.locator('aside');
    await expect(sidebar).toBeHidden();
  });
});

test.describe('홈 페이지 - 데스크톱 뷰', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('데스크톱에서 사이드바가 보인다', async ({ asGuest }) => {
    await asGuest.goto('/');
    const sidebar = asGuest.locator('aside');
    await expect(sidebar).toBeVisible();
  });

  test('데스크톱에서 메뉴 버튼이 숨겨진다', async ({ asGuest }) => {
    await asGuest.goto('/');
    const menuBtn = asGuest.getByRole('button', { name: '메뉴 열기' });
    await expect(menuBtn).toBeHidden();
  });
});

test.describe('홈 페이지 - 로고 탭', () => {
  test('로고 버튼이 존재하고 탭 가능하다', async ({ asGuest }) => {
    await asGuest.goto('/');
    const logoBtn = asGuest.getByRole('button', { name: '맨 위로 이동 및 새로고침', exact: true });
    await expect(logoBtn).toBeVisible();
    await expect(logoBtn).toBeEnabled();
  });

  test('로고 탭 시 logo-tap CustomEvent가 발생한다', async ({ asGuest }) => {
    await asGuest.goto('/');
    await expect(asGuest.locator('.animate-spin')).toHaveCount(0, { timeout: 10_000 });

    await asGuest.evaluate(() => {
      (window as unknown as Record<string, unknown>).__logoTapFired = false;
      window.addEventListener('logo-tap', () => {
        (window as unknown as Record<string, unknown>).__logoTapFired = true;
      });
    });

    const logoBtn = asGuest.getByRole('button', { name: '맨 위로 이동 및 새로고침', exact: true });
    await logoBtn.click();

    const fired = await asGuest.evaluate(
      () => (window as unknown as Record<string, unknown>).__logoTapFired
    );
    expect(fired).toBe(true);
  });

  test('로고 탭 시 공지사항 API refetch가 발생한다', async ({ asLoggedInUser }) => {
    await asLoggedInUser.goto('/');
    await expect(asLoggedInUser.locator('.animate-spin')).toHaveCount(0, { timeout: 10_000 });

    await asLoggedInUser.evaluate(() => {
      const el = document.querySelector('.h-full.overflow-y-auto');
      if (el) el.scrollTop = 300;
    });

    const refetchPromise = asLoggedInUser.waitForRequest(
      (req) => req.url().includes('/notices') && req.method() === 'GET',
      { timeout: 10_000 }
    );

    await asLoggedInUser.getByRole('button', { name: '맨 위로 이동 및 새로고침', exact: true }).click();

    await refetchPromise;
  });

  test('이미 상단에 있어도 로고 탭 시 refetch가 발생한다', async ({ asLoggedInUser }) => {
    await asLoggedInUser.goto('/');
    await expect(asLoggedInUser.locator('.animate-spin')).toHaveCount(0, { timeout: 10_000 });

    const scrollTop = await asLoggedInUser.evaluate(() => {
      const el = document.querySelector('.h-full.overflow-y-auto');
      return el ? el.scrollTop : 0;
    });
    expect(scrollTop).toBe(0);

    const refetchPromise = asLoggedInUser.waitForRequest(
      (req) => req.url().includes('/notices') && req.method() === 'GET',
      { timeout: 10_000 }
    );

    await asLoggedInUser.getByRole('button', { name: '맨 위로 이동 및 새로고침', exact: true }).click();

    await refetchPromise;
  });
});
