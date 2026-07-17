/**
 * F007 — 온보딩 노출 판정을 user_type 기준으로 통일 (실 백엔드).
 *
 * 배경: 예전 게이트는 dept_code 로 온보딩 노출을 판정했다. 그래서 온보딩 중 학과를 건너뛴
 * 유저(dept_code=NULL, user_type 은 채움)는 매 로그인마다 온보딩으로 되돌아갔다. 판정 기준을
 * user_type 으로 통일하면서, "가입=user_type='' → 온보딩 필요", "온보딩 진행함=user_type 채움
 * → 온보딩 불필요(학과 건너뜀 무관)" 두 축을 검증한다.
 *
 * (a) dept_skipped (user_type 채움·dept_code=NULL): 건너뛰기 유저는 /onboarding 직접 접근해도
 *     '/'로 리다이렉트되고 홈에서 온보딩 모달이 뜨지 않아야 한다(재노출 버그 회귀 방지).
 * (b) onboarding_needed (user_type=''): 신규 가입 상태 유저는 홈 진입 시 온보딩 모달이 떠야 한다.
 *
 * 시드 유저를 공유하므로(병렬 시 충돌) chromium 단일 프로젝트에서만 실행한다.
 */

import { test, expect } from './fixtures/real-auth.fixture';

// 온보딩 모달(홈/온보딩 공통 OnboardingModal)의 첫 화면 식별 텍스트. 닫히면 DOM 에서 사라진다.
const ONBOARDING_MODAL_HEADING = '제로타임에 오신 것을 환영합니다!';

test.describe('F007 온보딩 노출 판정 — user_type 기준', () => {
  test('학과 건너뛴 유저(user_type 채움)는 /onboarding 접근 시 홈으로 리다이렉트되고 모달이 뜨지 않는다', async ({
    page,
    loginAs,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'chromium',
      '공유 백엔드 시드 유저를 사용하는 로그인 테스트 — chromium 단일 프로젝트에서만 실행',
    );

    // dept_skipped: user_type='student', dept_code=NULL. 로그인 복원(/auth/refresh)까지 대기.
    await loginAs('deptSkipped');
    const refreshRestore = page.waitForResponse(
      (res) => res.url().includes('/auth/refresh') && res.request().method() === 'POST',
      { timeout: 15_000 },
    );
    await page.goto('/onboarding', { waitUntil: 'networkidle' });
    await refreshRestore;

    // 온보딩 페이지의 리다이렉트 게이트(user_type 채움 → 홈)로 '/'에 도달해야 한다.
    await expect(page).toHaveURL('/', { timeout: 15_000 });

    // 부트스트랩(session_hint→refresh→init)이 끝난 뒤 단정 — 홈 온보딩 모달이 뜨면 안 된다.
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.animate-spin')).toHaveCount(0, { timeout: 15_000 });
    await expect(
      page.getByText(ONBOARDING_MODAL_HEADING),
      '학과 건너뛴 유저는 온보딩 모달이 재노출되면 안 된다(dept_code 기준 게이트 회귀)',
    ).toHaveCount(0);
  });

  test('신규 가입 상태 유저(user_type="")는 홈 진입 시 온보딩 모달이 뜬다', async ({
    page,
    loginAs,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'chromium',
      '공유 백엔드 시드 유저를 사용하는 로그인 테스트 — chromium 단일 프로젝트에서만 실행',
    );

    // onboarding_needed: user_type=''(가입 직후). 로그인 복원까지 대기 후 홈 진입.
    await loginAs('onboardingNeeded');
    const refreshRestore = page.waitForResponse(
      (res) => res.url().includes('/auth/refresh') && res.request().method() === 'POST',
      { timeout: 15_000 },
    );
    await page.goto('/', { waitUntil: 'networkidle' });
    await refreshRestore;

    // 부트스트랩 완료 후 홈의 useEffect(!user.user_type)가 모달을 연다.
    await page.waitForLoadState('networkidle');
    await expect(
      page.getByText(ONBOARDING_MODAL_HEADING),
      'user_type="" 유저는 홈에서 온보딩 모달이 노출되어야 한다',
    ).toBeVisible({ timeout: 15_000 });
  });
});
