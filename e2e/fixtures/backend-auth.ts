/**
 * 실 백엔드 기반 E2E 로그인 인프라 (목이 아님).
 *
 * dev 페르소나 로그인이 develop에서 revert된 뒤, 무인 E2E에서 로그인 상태를 만드는
 * 유일한 경로다. 흐름:
 *   1) 로컬 DB에 프리셋 유저를 멱등 시드 (백엔드 컨테이너 안에서 백엔드 코드로).
 *   2) 그 유저의 웹 refresh 토큰을 백엔드 로그인과 동일한 방식으로 발급
 *      (RefreshTokenService.create_refresh_token — 컨테이너 안에서). 시크릿은 출력 안 함.
 *   3) 브라우저에 refresh 쿠키(name=refresh_token, path=/auth) + localStorage.session_hint
 *      를 심는다. 프론트 부팅 시 initializeAuth → POST /auth/refresh 가 이를 교환해
 *      access JWT 를 메모리에 올린다(로그인 복원).
 *
 * 쿠키 전송 요건(중요): 브라우저 SameSite=Lax 는 "same-site" 요청에만 쿠키를 실어보낸다.
 * 페이지 origin(127.0.0.1:3000)과 API origin 의 host 가 같아야 한다(port 는 site 판정과 무관).
 * 따라서 dev 서버를 반드시 API 와 같은 host 로 API base 를 잡아 띄운다:
 *   NEXT_PUBLIC_API_BASE_URL_WEB=http://127.0.0.1:8080  (localhost 로 두면 host 불일치 → 쿠키 차단)
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { BrowserContext, Page } from '@playwright/test';

// Playwright 는 spec 을 CJS 로 트랜스파일하므로 __dirname 이 네이티브로 존재한다
// (ESM 전용 import.meta.url 을 쓰면 CJS 출력과 충돌한다).
const BACKEND_DIR = join(__dirname, '..', 'backend');
const SEED_SCRIPT = join(BACKEND_DIR, 'seed_e2e_users.py');
const ISSUE_SCRIPT = join(BACKEND_DIR, 'issue_web_refresh_token.py');

/** 백엔드 app 컨테이너 이름 (docker-compose.local.yml). 필요시 env 로 덮어쓴다. */
const CONTAINER = process.env.E2E_BACKEND_CONTAINER ?? 'zerotime-api-local';

/** 프론트가 붙는 API base. dev 서버와 동일 값이어야 쿠키가 same-site 로 전송된다. */
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL_WEB ?? 'http://127.0.0.1:8080';

/** 백엔드 refresh 쿠키 규격 (app/routers/auth.py). path 는 /auth 로 스코프됨. */
export const REFRESH_COOKIE_NAME = 'refresh_token';
export const REFRESH_COOKIE_PATH = '/auth';

/** 시드 프리셋 키 → email. seed_e2e_users.py 의 PRESETS 와 일치해야 한다. */
export const PRESET_EMAILS = {
  /** 신규 가입 직후 상태(dept_code=NULL) — 온보딩 필요. F006/F007 전제. */
  onboardingNeeded: 'e2e-onboarding-needed@e2e.zerotime.kr',
  /** 온보딩 완료 전북대 유저(dept_code=dept_mechanical) — 깨끗한 로그인 상태. */
  onboardedJbnu: 'e2e-onboarded-jbnu@e2e.zerotime.kr',
  /** 학과 건너뛴 유저(user_type/school/admission_year 채움, dept_code=NULL) — F007 재노출 전제. */
  deptSkipped: 'e2e-dept-skipped@e2e.zerotime.kr',
} as const;

export type PresetKey = keyof typeof PRESET_EMAILS;

export interface SeededUser {
  preset: string;
  id: number;
  email: string;
  user_type: string;
  school: string | null;
  dept_code: string | null;
  admission_year: number | null;
  created: boolean;
}

function dockerExecPython(scriptPath: string, args: string[] = []): string {
  const scriptSource = readFileSync(scriptPath);
  // `python -` 로 stdin 의 스크립트를 실행하고, args 는 sys.argv 로 전달한다.
  return execFileSync(
    'docker',
    ['exec', '-i', CONTAINER, 'python', '-', ...args],
    { input: scriptSource, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 },
  );
}

/**
 * 프리셋 유저 3종을 로컬 DB 에 멱등 시드한다(재실행 안전). 스키마 갭도 자가 보정한다.
 * 마지막 stdout 줄의 JSON 을 파싱해 시드 결과를 반환한다.
 */
export function seedE2EUsers(): SeededUser[] {
  const out = dockerExecPython(SEED_SCRIPT);
  const lastLine = out.trim().split('\n').filter(Boolean).pop() ?? '{}';
  const parsed = JSON.parse(lastLine) as { seeded?: SeededUser[] };
  if (!parsed.seeded?.length) {
    throw new Error(`seedE2EUsers: unexpected output: ${out}`);
  }
  return parsed.seeded;
}

/**
 * 시드된 유저의 웹 refresh 토큰을 발급한다(opaque 문자열만 반환). 백엔드 로그인과 동일 경로.
 */
export function issueWebRefreshToken(email: string): string {
  const token = dockerExecPython(ISSUE_SCRIPT, [email]).trim();
  if (!token || token.includes(' ') || token.length < 16) {
    throw new Error(`issueWebRefreshToken: invalid token for ${email}`);
  }
  return token;
}

/** API base 의 host (쿠키 domain 으로 사용). 예: http://127.0.0.1:8080 → 127.0.0.1 */
function apiHost(): string {
  return new URL(API_BASE_URL).hostname;
}

/**
 * 브라우저 컨텍스트에 로그인 상태를 심는다: refresh 쿠키 + session_hint.
 * goto 이전에 호출해야 프론트 부팅의 initializeAuth 가 이를 집어 access 를 재발급한다.
 *
 * @returns 발급에 사용한 유저 email
 */
export async function establishWebLogin(
  context: BrowserContext,
  page: Page,
  preset: PresetKey,
): Promise<string> {
  const email = PRESET_EMAILS[preset];
  const refreshToken = issueWebRefreshToken(email);

  await context.addCookies([
    {
      name: REFRESH_COOKIE_NAME,
      value: refreshToken,
      domain: apiHost(),
      path: REFRESH_COOKIE_PATH,
      httpOnly: true,
      secure: false, // 로컬은 COOKIE_SECURE=False (http)
      sameSite: 'Lax',
    },
  ]);

  // 프론트는 session_hint 가 있어야만 부팅 시 /auth/refresh 를 시도한다(api/auth.ts).
  await page.addInitScript(() => {
    try {
      localStorage.setItem('session_hint', 'active');
    } catch {
      /* addInitScript 는 about:blank 등에서 localStorage 접근이 막힐 수 있어 무시 */
    }
  });

  return email;
}
