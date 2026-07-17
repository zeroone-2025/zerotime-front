/**
 * 실 백엔드 로그인 픽스처 (목 아님) — F004 인프라.
 *
 * 사용:
 *   import { test, expect } from './fixtures/real-auth.fixture';
 *   test('로그인 홈', async ({ page, loginAs }) => {
 *     await loginAs('onboardedJbnu');   // 쿠키 + session_hint 주입 (goto 이전)
 *     await page.goto('/');             // 부팅 시 /auth/refresh 로 로그인 복원
 *   });
 *
 * 전제: 로컬 백엔드 스택 기동 + dev 서버를 API 와 같은 host 로 API base 지정
 *   (NEXT_PUBLIC_API_BASE_URL_WEB=http://127.0.0.1:8080). 자세한 이유는 backend-auth.ts 주석.
 *
 * 시드는 worker 당 1회(멱등). loginAs 는 프리셋별 refresh 토큰을 발급해 브라우저에 심는다.
 */

import { test as base, expect } from '@playwright/test';
import { establishWebLogin, seedE2EUsers, type PresetKey, type SeededUser } from './backend-auth';

export { expect };
export { PRESET_EMAILS, type PresetKey } from './backend-auth';

type RealAuthWorkerFixtures = {
  seededUsers: SeededUser[];
};

type RealAuthTestFixtures = {
  /** 프리셋 유저로 로그인 상태를 심는다. page.goto 이전에 호출할 것. 반환: 사용한 email. */
  loginAs: (preset: PresetKey) => Promise<string>;
};

export const test = base.extend<RealAuthTestFixtures, RealAuthWorkerFixtures>({
  seededUsers: [
    async ({}, use) => {
      await use(seedE2EUsers());
    },
    { scope: 'worker' },
  ],

  loginAs: async ({ context, page, seededUsers }, use) => {
    void seededUsers; // worker 픽스처를 강제 실행해 시드를 보장
    await use((preset: PresetKey) => establishWebLogin(context, page, preset));
  },
});
