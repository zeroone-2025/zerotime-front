import { test, expect } from '@playwright/test';
import { mockGuestAPIs } from './fixtures/api-mocks';

/**
 * GET /boards가 학교 전환 시점에 일시적으로 실패해도 빈 배열이 영구 캐시로
 * 저장되지 않고(useSelectedCategories.ts), 장애가 풀린 뒤(새로고침) 정상
 * 복구되는지 확인한다. 목킹 없이 실제 로컬 백엔드를 쓰되, /boards 요청 1회만
 * page.route로 실패시켜 "일시적 API 장애"를 재현한다.
 *
 * ⚠️ 반드시 기본 포트(3000, 즉 PLAYWRIGHT_PORT 미지정)로 실행할 것 — 백엔드
 * CORS_ORIGINS 기본값이 http://localhost:3000, http://127.0.0.1:3000만
 * 허용한다. 다른 포트(예: PLAYWRIGHT_PORT=3100)로 돌리면 /boards 응답에
 * Access-Control-Allow-Origin이 안 붙어 브라우저가 응답을 차단하고, 이 테스트가
 * 코드와 무관하게 실패한다(게시판 목록 비어있음, GUEST_FILTER_SCHOOL_KEY 복구 안 됨 등).
 */

const GUEST_FILTER_KEY = 'JB_ALARM_GUEST_FILTER';
const GUEST_FILTER_SCHOOL_KEY = 'JB_ALARM_GUEST_FILTER_SCHOOL';

test('학교 전환 중 /boards가 실패해도 화면이 영구히 비지 않고, 복구 후 정상 표시된다', async ({ page }) => {
  await mockGuestAPIs(page);
  await page.goto('/');
  await expect(page.locator('.animate-spin')).toHaveCount(0, { timeout: 15_000 });

  const trigger = page.getByRole('button', { name: '둘러볼 학교 선택' });
  await expect(trigger).toBeVisible({ timeout: 10_000 });

  // 경북대로 전환하는 이번 /boards 요청만 실패시킨다 (일시적 장애 재현)
  let failedOnce = false;
  await page.route('**/boards*', async (route) => {
    const url = new URL(route.request().url());
    if (!failedOnce && url.searchParams.get('school') === '경북대') {
      failedOnce = true;
      await route.abort('failed');
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ board_code: 'knu_cs', name: '테스트 게시판', school: '경북대', category: '학과', default_subscribe: true }]) });
  });

  await trigger.click();
  await page.getByRole('button', { name: '경북대학교' }).click();
  await page.waitForTimeout(1500);

  expect(failedOnce).toBe(true);

  // 실패를 "확정된 빈 게시판"으로 저장하면 안 된다 — 다음에도 재시도할 수 있는
  // 상태로 남아야 한다 (경북대 마커가 안 찍혀 있어야 재시도가 트리거됨).
  const afterFailure = await page.evaluate(
    ([filterKey, schoolKey]) => ({
      filter: localStorage.getItem(filterKey),
      school: localStorage.getItem(schoolKey),
    }),
    [GUEST_FILTER_KEY, GUEST_FILTER_SCHOOL_KEY],
  );
  expect(afterFailure.school).not.toBe('경북대');
  if (afterFailure.filter !== null) {
    expect(JSON.parse(afterFailure.filter)).not.toEqual([]);
  }

  // 화면이 완전히 깨지지 않았는지(에러 없이 렌더링 유지) 확인
  await expect(page.locator('body')).toBeVisible();

  // 장애 해제 후 새로고침 — 이번엔 /boards가 정상 응답해야 한다
  await page.reload();
  await expect(page.locator('.animate-spin')).toHaveCount(0, { timeout: 15_000 });
  await expect(trigger).toContainText('경북대학교', { timeout: 10_000 });

  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), GUEST_FILTER_SCHOOL_KEY)).toBe('경북대');
  const afterRecovery = await page.evaluate(
    ([filterKey, schoolKey]) => ({
      filter: localStorage.getItem(filterKey),
      school: localStorage.getItem(schoolKey),
    }),
    [GUEST_FILTER_KEY, GUEST_FILTER_SCHOOL_KEY],
  );
  expect(afterRecovery.school).toBe('경북대');
  expect(JSON.parse(afterRecovery.filter!).length).toBeGreaterThan(0);
});
