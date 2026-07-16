/**
 * API Route 모킹 팩토리
 * page.route()로 백엔드 API를 가로채서 목 데이터 반환
 *
 * 중요: API 요청(port 8080)만 가로채야 하며, 페이지 요청(port 3000)은 통과시켜야 함.
 * 이를 위해 URL 필터 함수를 사용하여 XHR/fetch 요청만 매칭.
 */

import { Page, Route } from '@playwright/test';
import {
  MOCK_USER,
  MOCK_NEW_USER,
  MOCK_NOTICES,
  MOCK_KEYWORDS,
  MOCK_KEYWORD_NOTICES,
  MOCK_SUBSCRIPTIONS,
  MOCK_CHINBA_EVENTS,
  MOCK_CHINBA_EVENT_DETAIL,
  MOCK_CHINBA_MY_PARTICIPATION,
  MOCK_TEAMS,
  MOCK_BOARD_GROUPS,
  MOCK_DEPARTMENTS,
  MOCK_USER_STATS,
  MOCK_TIMETABLE,
  MOCK_CAREER,
} from './test-data';

/** API 요청만 매칭하는 헬퍼 (페이지 네비게이션 제외) */
function isApiRequest(route: Route): boolean {
  const resourceType = route.request().resourceType();
  // XHR/fetch 요청만 매칭, document(페이지 네비게이션)는 제외
  return resourceType === 'xhr' || resourceType === 'fetch';
}

/** API 요청이 아니면 continue, 맞으면 handler 실행 */
function apiOnly(handler: (route: Route) => void | Promise<void>) {
  return (route: Route) => {
    if (!isApiRequest(route)) {
      return route.continue();
    }
    return handler(route);
  };
}

function json(route: Route, data: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(data),
  });
}

/**
 * 게스트 (비로그인) 상태 API 모킹
 */
export async function mockGuestAPIs(page: Page) {
  // Auth refresh: 실패
  await page.route('**/auth/refresh', apiOnly((route) =>
    json(route, { detail: 'Not authenticated' }, 401)
  ));

  // Notices
  await page.route('**/notices?**', apiOnly((route) =>
    json(route, MOCK_NOTICES)
  ));

  await page.route('**/notices', apiOnly((route) => {
    if (route.request().method() === 'GET') {
      return json(route, MOCK_NOTICES);
    }
    return route.continue();
  }));

  // Users/me → 401 (비로그인)
  await page.route('**/users/me', apiOnly((route) =>
    json(route, { detail: 'Not authenticated' }, 401)
  ));

  await page.route('**/users/me/**', apiOnly((route) =>
    json(route, { detail: 'Not authenticated' }, 401)
  ));

  // Stats
  await page.route('**/stats/**', apiOnly((route) =>
    json(route, MOCK_USER_STATS)
  ));

  // Departments
  await page.route('**/departments**', apiOnly((route) =>
    json(route, MOCK_DEPARTMENTS)
  ));

  // Chinba events (public)
  await page.route('**/chinba/**', apiOnly((route) =>
    json(route, MOCK_CHINBA_EVENT_DETAIL)
  ));

  // Timetable
  await page.route('**/timetable', apiOnly((route) => {
    if (route.request().method() === 'GET') {
      return json(route, { detail: 'Not found' }, 404);
    }
    return route.continue();
  }));

  await page.route('**/timetable/**', apiOnly((route) =>
    json(route, { message: 'ok' })
  ));
}

/**
 * 로그인 상태 API 모킹
 */
export async function mockAuthenticatedAPIs(page: Page, options?: {
  user?: typeof MOCK_USER;
  isNewUser?: boolean;
}) {
  const user = options?.isNewUser ? MOCK_NEW_USER : (options?.user ?? MOCK_USER);

  await page.addInitScript(() => localStorage.setItem('session_hint', 'active'));

  // Auth refresh: 성공
  await page.route('**/auth/refresh', apiOnly((route) =>
    json(route, { access_token: 'test-jwt-token-for-e2e' })
  ));

  // Users/me/init: 유저 정보 + 구독 합산 (병렬화용)
  await page.route('**/users/me/init', apiOnly((route) =>
    json(route, { user, subscriptions: MOCK_SUBSCRIPTIONS })
  ));

  // Users/me
  await page.route('**/users/me', apiOnly((route) => {
    const method = route.request().method();
    if (method === 'GET') {
      return json(route, user);
    }
    if (method === 'PATCH') {
      const body = JSON.parse(route.request().postData() || '{}');
      return json(route, { ...user, ...body });
    }
    return route.continue();
  }));

  // Subscriptions
  await page.route('**/users/me/subscriptions', apiOnly((route) => {
    const method = route.request().method();
    if (method === 'GET') return json(route, MOCK_SUBSCRIPTIONS);
    if (method === 'PUT') return json(route, { message: 'ok', subscriptions: MOCK_SUBSCRIPTIONS });
    return route.continue();
  }));

  // Keywords
  await page.route('**/users/me/keywords', apiOnly((route) => {
    const method = route.request().method();
    if (method === 'GET') return json(route, MOCK_KEYWORDS);
    if (method === 'POST') return json(route, { id: 99, keyword: 'new', created_at: new Date().toISOString() });
    return route.continue();
  }));

  await page.route('**/users/me/keywords/*', apiOnly((route) => {
    if (route.request().method() === 'DELETE') {
      return json(route, { message: 'deleted', keyword_id: 1 });
    }
    return route.continue();
  }));

  // Keyword notices
  await page.route('**/users/me/keyword-notices**', apiOnly((route) =>
    json(route, MOCK_KEYWORD_NOTICES)
  ));

  // Board groups
  await page.route('**/users/me/board-groups', apiOnly((route) => {
    const method = route.request().method();
    if (method === 'GET') return json(route, MOCK_BOARD_GROUPS);
    if (method === 'POST') return json(route, { id: 99, name: 'new', board_codes: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    return route.continue();
  }));

  await page.route('**/users/me/board-groups/*', apiOnly((route) => {
    if (route.request().method() === 'DELETE') {
      return json(route, { message: 'deleted', group_id: 1 });
    }
    return route.continue();
  }));

  // Onboarding
  await page.route('**/users/me/onboarding', apiOnly((route) =>
    json(route, {
      message: 'ok',
      user: { ...MOCK_USER, dept_code: 'dept_csai' },
      subscribed_boards: ['home_campus', 'home_student', 'dept_csai'],
    })
  ));

  // Career
  await page.route('**/users/me/career', apiOnly((route) =>
    json(route, MOCK_CAREER)
  ));

  await page.route('**/users/me/career/**', apiOnly((route) =>
    json(route, MOCK_CAREER)
  ));

  // Notices
  await page.route('**/notices?**', apiOnly((route) =>
    json(route, MOCK_NOTICES)
  ));

  await page.route('**/notices', apiOnly((route) => {
    if (route.request().method() === 'GET') return json(route, MOCK_NOTICES);
    return route.continue();
  }));

  // Notice actions
  await page.route('**/notices/*/read', apiOnly((route) =>
    json(route, { message: 'ok', notice_id: 1, is_read: true })
  ));

  await page.route('**/notices/*/favorite', apiOnly((route) =>
    json(route, { message: 'ok', notice_id: 1, is_favorite: true })
  ));

  await page.route('**/notices/*/increment-view', apiOnly((route) =>
    json(route, { notice_id: 1, view: 1, user_view_count: 1, message: 'ok' })
  ));

  // Stats
  await page.route('**/stats/**', apiOnly((route) =>
    json(route, MOCK_USER_STATS)
  ));

  // Departments
  await page.route('**/departments**', apiOnly((route) =>
    json(route, MOCK_DEPARTMENTS)
  ));

  // Timetable
  await page.route('**/timetable', apiOnly((route) => {
    if (route.request().method() === 'GET') {
      return json(route, { detail: 'Not found' }, 404);
    }
    return route.continue();
  }));

  await page.route('**/timetable/**', apiOnly((route) =>
    json(route, { message: 'ok' })
  ));

  await page.route('**/chinba/teams', apiOnly((route) => {
    if (route.request().method() === 'GET') return json(route, MOCK_TEAMS);
    return route.continue();
  }));
  // Chinba - my events
  await page.route('**/chinba/my-events', apiOnly((route) =>
    json(route, MOCK_CHINBA_EVENTS)
  ));

  // Chinba - event detail & actions
  await page.route('**/chinba/events/**', apiOnly((route) => {
    const method = route.request().method();
    const url = route.request().url();

    if (url.includes('/my-participation')) return json(route, MOCK_CHINBA_MY_PARTICIPATION);
    if (url.includes('/my-unavailability')) return json(route, { message: 'ok' });
    if (url.includes('/complete')) return json(route, { message: 'ok' });
    if (url.includes('/import-timetable')) return json(route, { message: '시간표에서 6개 슬롯을 불러왔습니다', imported_count: 6 });
    if (method === 'GET') return json(route, MOCK_CHINBA_EVENT_DETAIL);
    if (method === 'DELETE') return json(route, { message: 'deleted' });
    return route.continue();
  }));

  // Chinba - create event
  await page.route('**/chinba/events', apiOnly((route) => {
    if (route.request().method() === 'POST') return json(route, { event_id: 'evt-new-001' });
    return route.continue();
  }));

  // Auth logout
  await page.route('**/auth/logout', apiOnly((route) =>
    json(route, { message: 'ok' })
  ));
}
