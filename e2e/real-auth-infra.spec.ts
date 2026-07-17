/**
 * F004 인프라 검증 spec.
 *
 * 시드된 온보딩-완료 유저를 실 백엔드 경로로 주입한 뒤, 홈(/)이 "로그인 상태 UI"를
 * 렌더함을 단정한다. 목이 아니라 실제 refresh→access 교환으로 로그인한다.
 *
 * 이 spec 이 통과하면 F006(온보딩→캐시 무효화)·F007(재노출 판정) E2E 가 이 픽스처 위에
 * 세워질 수 있다.
 */

import { test, expect } from './fixtures/real-auth.fixture';

test.describe('F004 실 백엔드 로그인 인프라', () => {
  test('시드 유저 주입 후 홈이 로그인 상태 UI 를 렌더한다', async ({ page, context, loginAs }) => {
    // 1) 로그인 상태 주입 (쿠키 + session_hint). goto 이전.
    const email = await loginAs('onboardedJbnu');

    // 2) 부팅 시 발생할 프로필 로드(/users/me/init)를 미리 기다릴 준비.
    const initResponse = page.waitForResponse(
      (res) => res.url().includes('/users/me/init') && res.request().method() === 'GET',
      { timeout: 15_000 },
    );

    // 3) 홈 진입 → initializeAuth 가 /auth/refresh 로 access 재발급 → 프로필 로드.
    await page.goto('/', { waitUntil: 'networkidle' });

    // 4) 프로필 로드가 200 으로 완료됐는지 확인(하이드레이션 레이스 방지).
    const res = await initResponse;
    expect(res.status(), 'GET /users/me/init should succeed for the seeded user').toBe(200);

    // 5) 로그인 전용 UI 마커: 사이드바의 "로그아웃" 버튼.
    //    데스크톱(chromium)은 사이드바가 기본 노출, 모바일은 메뉴를 열어야 한다.
    const logoutBtn = page.getByRole('button', { name: '로그아웃', exact: true });
    if (!(await logoutBtn.isVisible().catch(() => false))) {
      await page.getByRole('button', { name: '메뉴 열기' }).click();
    }
    await expect(logoutBtn, 'logged-in sidebar shows 로그아웃').toBeVisible({ timeout: 10_000 });

    // 6) 게스트 전용 CTA 는 사라져야 한다(비로그인 음성 확인).
    await expect(
      page.getByRole('button', { name: '로그인하기' }),
      'guest login CTA must be absent when logged in',
    ).toHaveCount(0);

    // 7) 주입한 계정의 프로필이 반영됐는지(닉네임 노출).
    // 닉네임은 데스크톱/모바일 사이드바 변형이 DOM 에 동시에 존재할 수 있어(숨김 사본 포함)
    // 보이는 요소만 골라 단정한다.
    await expect(
      page.getByText('E2E전북대유저').filter({ visible: true }).first(),
      'seeded nickname should render in logged-in UI',
    ).toBeVisible({ timeout: 10_000 });

    // 부수 확인: 쿠키/힌트가 실제로 세팅됐다.
    const cookies = await context.cookies();
    expect(cookies.some((c) => c.name === 'refresh_token')).toBe(true);
    expect(email).toContain('@');
  });
});
