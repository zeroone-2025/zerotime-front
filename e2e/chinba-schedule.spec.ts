import { test, expect } from './fixtures/auth.fixture';

test.describe('친바 시간 범위 확대 (24시)', () => {
  test('이벤트 상세에서 23:00, 23:30 시간 슬롯이 표시된다', async ({ asLoggedInUser }) => {
    const eventDetailResponse = asLoggedInUser.waitForResponse((response) => {
      const url = new URL(response.url());
      return response.request().method() === 'GET' && url.pathname.endsWith('/chinba/events/evt-001');
    });
    await asLoggedInUser.goto('/chinba/event?id=evt-001&tab=my');
    const eventDetail = await (await eventDetailResponse).json();
    expect(eventDetail.end_hour).toBe(24);
    await expect(asLoggedInUser.locator('.animate-spin')).toHaveCount(0, { timeout: 10_000 });
    const lastHourSlots = asLoggedInUser.locator('[data-slot-key$="T23:00:00"]');
    const lastHalfHourSlots = asLoggedInUser.locator('[data-slot-key$="T23:30:00"]');
    await expect(lastHourSlots).toHaveCount(3);
    await expect(lastHalfHourSlots).toHaveCount(3);
    await lastHalfHourSlots.last().scrollIntoViewIfNeeded();
    await expect(asLoggedInUser.getByText('23시')).toBeVisible({ timeout: 10_000 });
  });

  test('히트맵에서도 23시대 슬롯이 표시된다', async ({ asLoggedInUser }) => {
    await asLoggedInUser.goto('/chinba/event?id=evt-001&tab=team');
    await expect(asLoggedInUser.locator('.animate-spin')).toHaveCount(0, { timeout: 10_000 });
    const lastHourSlots = asLoggedInUser.locator('[data-slot-key$="T23:00:00"]');
    const lastHalfHourSlots = asLoggedInUser.locator('[data-slot-key$="T23:30:00"]');
    await expect(lastHourSlots).toHaveCount(3);
    await expect(lastHalfHourSlots).toHaveCount(3);
    await lastHalfHourSlots.last().scrollIntoViewIfNeeded();
    await expect(asLoggedInUser.getByText('23시')).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('시간표 불러오기 병합', () => {
  test('내 일정 탭에서 시간표 불러오기 버튼이 있다', async ({ asLoggedInUser }) => {
    await asLoggedInUser.goto('/chinba/event?id=evt-001&tab=my');
    await expect(asLoggedInUser.getByText('내 시간표 불러오기')).toBeVisible({ timeout: 10_000 });
  });

  test('시간표 불러오기 성공 시 토스트 메시지가 표시된다', async ({ asLoggedInUser }) => {
    await asLoggedInUser.goto('/chinba/event?id=evt-001&tab=my');
    await asLoggedInUser.getByText('내 시간표 불러오기').click();
    await expect(asLoggedInUser.getByText(/슬롯을 불러왔습니다/)).toBeVisible({ timeout: 10_000 });
  });
});
