import { test, expect } from '@playwright/test';

import { mockGuestAPIs } from './fixtures/api-mocks';

/**
 * 게스트 학교 선택(버튼+펼침 메뉴)을 빠르게 여러 번 전환할 때
 * 게시판 목록 리셋과 refetch가 겹쳐서 깜빡이거나 꼬이지 않는지 확인.
 * 학교별 /boards 응답 시간을 의도적으로 다르게 만들어 오래된 응답이 최신 학교를
 * 덮어쓰는 레이스를 결정적으로 재현한다.
 */

const FULL_NAME: Record<string, string> = {
  전북대: '전북대학교',
  전남대: '전남대학교',
  경북대: '경북대학교',
  충남대: '충남대학교',
};

const BOARD_FIXTURES = {
  전북대: [{ board_code: 'jbnu_csai', name: '컴퓨터인공지능학부', school: '전북대', category: '학과', default_subscribe: true }],
  전남대: [{ board_code: 'jnu_econ', name: '경제학부', school: '전남대', category: '학과', default_subscribe: true }],
  경북대: [{ board_code: 'knu_cs', name: '컴퓨터학부', school: '경북대', category: '학과', default_subscribe: true }],
  충남대: [{ board_code: 'cnu_geo', name: '지질환경과학과', school: '충남대', category: '학과', default_subscribe: true }],
} as const;

const RESPONSE_DELAYS: Record<string, number> = {
  전남대: 500,
  경북대: 400,
  충남대: 50,
  전북대: 300,
};

test('게스트가 학교를 빠르게 여러 번 전환해도 게시판 목록이 정상 유지된다', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));

  await mockGuestAPIs(page);
  await page.route('**/boards*', async (route) => {
    const school = new URL(route.request().url()).searchParams.get('school') ?? '전북대';
    await new Promise((resolve) => setTimeout(resolve, RESPONSE_DELAYS[school] ?? 0));
    const boards = BOARD_FIXTURES[school as keyof typeof BOARD_FIXTURES] ?? [];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(boards),
    });
  });

  await page.goto('/');
  await expect(page.locator('.animate-spin')).toHaveCount(0, { timeout: 15_000 });

  const trigger = page.getByRole('button', { name: '둘러볼 학교 선택' });
  await expect(trigger).toBeVisible({ timeout: 10_000 });

  const schools = ['전남대', '경북대', '충남대', '전북대', '충남대'];
  for (const school of schools) {
    await trigger.click();
    await page.getByRole('button', { name: FULL_NAME[school] }).click({ force: true });
    // 의도적으로 짧게만 대기 — refetch가 끝나기 전에 다음 전환이 겹치도록
    await page.waitForTimeout(150);
  }

  await expect.poll(() => page.evaluate(() =>
    localStorage.getItem('JB_ALARM_GUEST_FILTER_SCHOOL')
  )).toBe('충남대');
  await expect(trigger).toContainText('충남대학교');

  // 필터 화면으로 이동해 실제 게시판 목록이 충남대 기준으로 뜨는지 확인
  await page.goto('/filter');
  await expect(page.locator('.animate-spin')).toHaveCount(0, { timeout: 15_000 });
  await expect(page.getByText('지질환경과학과').first()).toBeVisible({ timeout: 10_000 });
  // 전북대 전용 학과 게시판이 안 섞여 들어왔는지 확인 — 게시판 name엔 더 이상
  // [학교명] 접두사가 없어서(2026-07 제거) 전북대에만 존재하는 학과명으로 판별한다.
  // 페이지 하단의 "전북대학교 컴퓨터인공지능학부..." 앱 제작 크레딧 문구는 항상 고정이라
  // 버튼 요소로 범위를 좁혀 제외한다.
  await expect(page.locator('button', { hasText: '컴퓨터인공지능학부' })).toHaveCount(0);

  console.log('Console errors captured:', consoleErrors);
  expect(consoleErrors.filter((e) => !e.includes('favicon'))).toEqual([]);
});
