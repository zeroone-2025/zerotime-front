import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function ok(config: InternalAxiosRequestConfig, data: unknown): AxiosResponse {
  return { data, status: 200, statusText: 'OK', headers: {}, config };
}

function unauthorized(config: InternalAxiosRequestConfig): AxiosError {
  return new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, null, {
    data: {},
    status: 401,
    statusText: 'Unauthorized',
    headers: {},
    config,
  });
}

async function loadModules() {
  vi.resetModules();
  const tokenStore = await import('@/_lib/auth/tokenStore');
  const client = await import('@/_lib/api/client');
  const auth = await import('@/_lib/api/auth');
  return { tokenStore, api: client.default, authApi: client.authApi, auth };
}

function stubAuthApi(authApi: Awaited<ReturnType<typeof loadModules>>['authApi']) {
  const refreshResponse = deferred<unknown>();
  const refreshStarted = deferred<void>();
  authApi.defaults.adapter = async (config) => {
    if (config.url === '/auth/refresh') {
      refreshStarted.resolve();
      return ok(config, await refreshResponse.promise);
    }
    if (config.url === '/auth/logout') {
      return ok(config, {});
    }
    throw new Error(`unexpected authApi call ${config.url}`);
  };
  return { refreshResponse, refreshStarted };
}

describe('logout during an in-flight token refresh', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('does not restore the session when the 401-triggered refresh resolves after logout', async () => {
    const { tokenStore, api, authApi, auth } = await loadModules();
    tokenStore.setAccessToken('expired-token');
    api.defaults.adapter = async (config) => {
      throw unauthorized(config);
    };
    const { refreshResponse, refreshStarted } = stubAuthApi(authApi);

    const request = api.get('/users/me');
    await refreshStarted.promise;

    await auth.logoutUser();
    expect(tokenStore.getAccessToken()).toBeNull();

    refreshResponse.resolve({ access_token: 'late-token', token_type: 'bearer' });
    await expect(request).rejects.toBeDefined();

    expect(tokenStore.getAccessToken()).toBeNull();
    expect(tokenStore.getAuthSessionState()).toBe('anonymous');
    expect(localStorage.getItem('session_hint')).toBeNull();
  });

  it('does not restore the session when an initialization refresh resolves after logout', async () => {
    const { tokenStore, authApi, auth } = await loadModules();
    const { refreshResponse, refreshStarted } = stubAuthApi(authApi);

    const refresh = auth.refreshAccessToken();
    await refreshStarted.promise;

    await auth.logoutUser();

    refreshResponse.resolve({ access_token: 'late-token', token_type: 'bearer' });
    await expect(refresh).resolves.toBeNull();

    expect(tokenStore.getAccessToken()).toBeNull();
    expect(tokenStore.getAuthSessionState()).toBe('anonymous');
    expect(localStorage.getItem('session_hint')).toBeNull();
  });

  it('still stores a refresh that completes without an intervening logout', async () => {
    const { tokenStore, authApi, auth } = await loadModules();
    const { refreshResponse } = stubAuthApi(authApi);

    const refresh = auth.refreshAccessToken();
    refreshResponse.resolve({ access_token: 'fresh-token', token_type: 'bearer' });

    await expect(refresh).resolves.toBe('fresh-token');
    expect(tokenStore.getAccessToken()).toBe('fresh-token');
    expect(tokenStore.getAuthSessionState()).toBe('active');
  });
});
