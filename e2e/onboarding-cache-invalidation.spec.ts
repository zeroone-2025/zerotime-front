/**
 * F006 — 온보딩 완료 후 캐시 무효화 검증 (실 백엔드).
 *
 * 버그: 온보딩 완료 경로가 프로필이 실제로 읽는 ['user','init'] 캐시를 invalidate 하지
 * 않아, 부팅 때 로드된 stale init 캐시가 방금 저장한 학교를 zustand 위로 되덮었다
 * (온보딩에서 전남대를 골라도 프로필은 이전 값으로 되돌아감).
 *
 * 시나리오:
 *   1) preset 'onboardingNeeded'(dept_code=NULL) 로 로그인 → /onboarding 에 머문다.
 *   2) 학생 유형 → 학교 '전남대' + 학과 + 학번 입력 → 완료(시작하기).
 *   3) 완료 경로의 invalidate 로 /users/me/init 가 재조회된다(수정의 관측 지점).
 *   4) 리로드 없이(SPA) /profile 로 이동 → networkidle 로 settle.
 *   5) 프로필의 학교 필드가 '전남대'여야 한다('전북대'/공란으로 되돌아가면 버그).
 *
 * 반드시 SPA 이동이어야 한다 — page.goto('/profile') 는 풀 리로드라 init 를 새로 받아
 * 버그가 가려진다. settle 후 단정이어야 stale 되덮기 레이스를 판별한다.
 */

import type { Page } from '@playwright/test';

import { test, expect } from './fixtures/real-auth.fixture';

test.describe('F006 온보딩 완료 → 캐시 무효화', () => {
  test('전남대로 온보딩 완료 후 프로필이 전남대를 유지한다', async ({ page, loginAs }, testInfo) => {
    // 이 테스트는 공유 백엔드 유저(onboardingNeeded)의 dept_code를 변경한다. 프로젝트별로
    // 병렬 실행하면 같은 유저를 동시에 온보딩해 충돌하므로 단일 프로젝트에서만 돌린다.
    test.skip(
      testInfo.project.name !== 'chromium',
      '공유 백엔드 유저를 변경하는 mutation 테스트 — chromium 단일 프로젝트에서만 실행',
    );

    // 1) 온보딩 필요(dept_code=NULL) 유저로 로그인 상태 주입 후 온보딩 진입.
    await loginAs('onboardingNeeded');
    await page.goto('/onboarding', { waitUntil: 'networkidle' });
    await expect(page.locator('.animate-spin')).toHaveCount(0, { timeout: 15_000 });

    // 2) 학생 유형 선택.
    await page.locator('button', { hasText: '재학생/신입생' }).click();
    await page.getByRole('button', { name: '다음' }).click();

    // 3) 학교/학과/학번 입력.
    await page.locator('select[name="school"]').selectOption('전남대');

    // 학교를 고르면 DepartmentSearch 가 전남대 학과를 다시 로드한다 — 로드 후 검색.
    const deptSearch = page.getByPlaceholder('학과를 검색하세요');
    await deptSearch.fill('간호');
    await page.locator('button', { hasText: '간호학과' }).first().click();

    await page.locator('select[name="admission_year"]').selectOption('21');

    // 4) 완료: 온보딩 저장 + init 재조회(수정 지점).
    const onboardingPost = page.waitForResponse(
      (res) => res.url().includes('/users/me/onboarding') && res.request().method() === 'POST',
      { timeout: 15_000 },
    );
    const initAfterSubmit = page.waitForResponse(
      (res) => res.url().includes('/users/me/init') && res.request().method() === 'GET',
      { timeout: 15_000 },
    );

    await page.getByRole('button', { name: '시작하기' }).click();

    expect((await onboardingPost).ok(), 'POST /users/me/onboarding 성공').toBeTruthy();
    await initAfterSubmit; // invalidate(['user','init']) 로 촉발되는 재조회 — 수정의 관측 지점
    await expect(page).toHaveURL('/', { timeout: 15_000 });

    // 5) 리로드 없이 SPA 로 프로필 이동.
    await goToProfileViaSpa(page);
    await expect(page).toHaveURL(/\/profile/, { timeout: 15_000 });

    // settle 후 단정 — stale 되덮기 레이스가 끝난 뒤 학교가 전남대로 남아야 한다.
    await page.waitForLoadState('networkidle');
    await expect(
      page.locator('select[name="school"]'),
      '프로필 학교 필드가 전남대로 유지되어야 한다(전북대/공란이면 stale 캐시 되덮기 버그)',
    ).toHaveValue('전남대', { timeout: 10_000 });
  });
});

async function goToProfileViaSpa(page: Page) {
  // 데스크톱 사이드바는 접힌 레일(아이콘)과 펼친 SidebarContent가 둘 다 DOM에 있어
  // role=button "프로필"이 중복 매칭된다. 텍스트 노드로 좁힌다(레일 버튼은 아이콘뿐).
  const profileNav = page.getByText('프로필', { exact: true }).first();
  if (!(await profileNav.isVisible().catch(() => false))) {
    // 모바일: 사이드바가 숨겨져 있어 헤더의 메뉴를 먼저 연다.
    await page.getByRole('button', { name: '메뉴 열기' }).click();
  }
  await profileNav.click();
}
