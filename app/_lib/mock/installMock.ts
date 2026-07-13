/**
 * DEV 전용 목업 어댑터 설치.
 *
 * `api`와 `authApi` **둘 다**의 `defaults.adapter`를 오버라이드한다 —
 * `/auth/refresh`·`/auth/logout`은 인터셉터 없는 `authApi`를 타므로, 한쪽만 붙이면
 * 새로고침·로그아웃이 실 백엔드로 새어나간다(이 기능의 최대 함정).
 *
 * 매칭되는 요청은 픽스처로 응답하고, 미매칭은 캡처해 둔 원래 어댑터로 위임한다.
 * dead-branch 동적 import로만 진입하므로 프로덕션에서 실행되지 않는다.
 */

import axios, {
  AxiosError,
  type AxiosAdapter,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios';

import api, { authApi } from '@/_lib/api/client';

import { resolveMock } from './mockRouter';

let installed = false;

const STATUS_TEXT: Record<number, string> = {
  200: 'OK',
  201: 'Created',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  500: 'Internal Server Error',
};

function safeParse(data: unknown): unknown {
  if (typeof data !== 'string') return data;
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
}

function makeAdapter(instance: AxiosInstance): AxiosAdapter {
  // 오버라이드 전에 원래 어댑터를 캡처(재귀 방지).
  const base = axios.getAdapter(instance.defaults.adapter ?? axios.defaults.adapter);

  return (config: InternalAxiosRequestConfig) => {
    const hit = resolveMock(config.method ?? 'get', config.url ?? '', safeParse(config.data));
    if (!hit) return base(config);

    const response = {
      data: hit.data,
      status: hit.status,
      statusText: STATUS_TEXT[hit.status] ?? String(hit.status),
      headers: {},
      config,
      request: {},
    };

    if (hit.status >= 200 && hit.status < 300) {
      return Promise.resolve(response as never);
    }
    // 4xx/5xx는 실 백엔드처럼 AxiosError로 reject → 인터셉터/에러 처리 경로 동일하게 동작.
    return Promise.reject(
      new AxiosError(
        `Request failed with status code ${hit.status}`,
        hit.status >= 500 ? AxiosError.ERR_BAD_RESPONSE : AxiosError.ERR_BAD_REQUEST,
        config,
        {},
        response as never,
      ),
    );
  };
}

export function installMockLayer(): void {
  if (installed) return;
  installed = true;
  api.defaults.adapter = makeAdapter(api);
  authApi.defaults.adapter = makeAdapter(authApi);
  if (typeof window !== 'undefined') {
    console.log('[MockAuth] axios 목업 레이어 설치됨 (api + authApi)');
  }
}
