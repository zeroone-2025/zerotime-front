import { test, expect } from './fixtures/auth.fixture';
import { mockAuthenticatedAPIs } from './fixtures/api-mocks';

test.describe('Auth Callback 페이지', () => {
  test('리프레시를 기다리는 동안 로딩 스피너가 표시된다', async ({ asGuest }) => {
    await asGuest.route('**/auth/refresh', () => {
      // Keep the cookie-refresh request pending so the transient state is observable.
    });
    await asGuest.goto('/auth/callback');
    await expect(asGuest.locator('.animate-spin')).toBeVisible();
  });

  test('리프레시를 기다리는 동안 로딩 문구가 표시된다', async ({ asGuest }) => {
    await asGuest.route('**/auth/refresh', () => {
      // Keep the cookie-refresh request pending so the transient state is observable.
    });
    await asGuest.goto('/auth/callback');
    await expect(asGuest.getByText('로그인 처리 중...')).toBeVisible();
  });

  test('리프레시 인증에 실패하면 홈으로 리다이렉트된다', async ({ asGuest }) => {
    await asGuest.goto('/auth/callback');
    await expect(asGuest).toHaveURL('/', { timeout: 10_000 });
  });

  test('URL query bearer는 리프레시 실패 시 인증되지 않는다', async ({ asGuest }) => {
    const refreshResponse = asGuest.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/auth/refresh' && response.status() === 401,
    );

    await asGuest.goto('/auth/callback?access_token=attacker-controlled-token');
    await refreshResponse;
    await expect(asGuest).toHaveURL('/', { timeout: 10_000 });
  });
  test('악성 URL 자격 증명은 성공한 쿠키 리프레시 세션을 덮어쓰지 않는다', async ({ page }) => {
    const refreshCookie = 'http-only-refresh-cookie';
    const refreshedAccessToken = 'cookie-refresh-access-token';
    const attackerCredentialValues = [
      'query-access-token',
      'query-bearer',
      'query-authorization',
      'fragment-access-token',
      'fragment-bearer',
      'fragment-authorization',
    ];

    await page.context().addCookies([
      {
        name: 'refresh_token',
        value: refreshCookie,
        domain: 'localhost',
        path: '/auth',
        httpOnly: true,
        secure: false,
        sameSite: 'Lax',
      },
    ]);
    expect(await page.context().cookies('http://localhost:8080/auth/refresh')).toContainEqual(
      expect.objectContaining({
        name: 'refresh_token',
        value: refreshCookie,
        path: '/auth',
        httpOnly: true,
      }),
    );

    await mockAuthenticatedAPIs(page);
    await page.route('**/auth/refresh', (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ access_token: refreshedAccessToken }),
      }),
    );

    const refreshRequest = page.waitForRequest(
      (request) => new URL(request.url()).pathname === '/auth/refresh',
    );
    const profileRequest = page.waitForRequest(
      (request) =>
        new URL(request.url()).pathname === '/users/me' && request.method() === 'GET',
    );

    await page.goto(
      `http://localhost:${process.env.PLAYWRIGHT_PORT ?? '3000'}/auth/callback?access_token=query-access-token&bearer=query-bearer&authorization=query-authorization#access_token=fragment-access-token&bearer=fragment-bearer&authorization=fragment-authorization`,
    );

    const [refresh, profile] = await Promise.all([refreshRequest, profileRequest]);
    const authorizationHeaders = [
      refresh.headers().authorization,
      profile.headers().authorization,
    ].filter((header): header is string => Boolean(header));

    expect(refresh.headers().cookie).toContain(`refresh_token=${refreshCookie}`);
    expect(profile.headers().authorization).toBe(`Bearer ${refreshedAccessToken}`);
    for (const attackerCredentialValue of attackerCredentialValues) {
      expect(authorizationHeaders.join(' ')).not.toContain(attackerCredentialValue);
    }
    const persistedSessionValues = await page.evaluate(() => Object.values(localStorage));
    expect(persistedSessionValues).toContain('active');
    for (const attackerCredentialValue of attackerCredentialValues) {
      expect(persistedSessionValues).not.toContain(attackerCredentialValue);
    }

    await expect(page).toHaveURL(/\/(\?login=success)?$/, { timeout: 10_000 });
    const finalUrl = new URL(page.url());
    for (const credentialName of ['access_token', 'bearer', 'authorization']) {
      expect(finalUrl.searchParams.has(credentialName)).toBe(false);
    }
    expect(finalUrl.hash).toBe('');
  });

  test('error=access_denied이면 홈으로 리다이렉트된다', async ({ asGuest }) => {
    await asGuest.goto('/auth/callback?error=access_denied');
    await expect(asGuest).toHaveURL('/', { timeout: 10_000 });
  });

  test('기존 유저는 쿠키 리프레시 성공 시 홈으로 이동한다', async ({ page }) => {
    await mockAuthenticatedAPIs(page);
    const refreshResponse = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/auth/refresh' && response.status() === 200,
    );
    await page.goto('/auth/callback');
    await refreshResponse;
    // 홈으로 이동 (login=success 쿼리 파라미터는 Next.js router에 의해 제거될 수 있음)
    await expect(page).toHaveURL(/\/(\?login=success)?$/, { timeout: 10_000 });
  });

  test('신규 유저는 쿠키 리프레시 성공 시 온보딩으로 이동한다', async ({ page }) => {
    await mockAuthenticatedAPIs(page, { isNewUser: true });
    const refreshResponse = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/auth/refresh' && response.status() === 200,
    );
    await page.goto('/auth/callback');
    await refreshResponse;
    await expect(page).toHaveURL(/\/onboarding/, { timeout: 10_000 });
  });
});
