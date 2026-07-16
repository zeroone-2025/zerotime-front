import axios, { type AxiosInstance } from 'axios';

import { clearAccessToken, getAccessToken, setAccessToken } from '@/_lib/auth/tokenStore';
import {
  isValidatedNativeReleaseRuntime,
  MobileReleaseClient,
  readValidatedNativeReleaseManifest,
  type DisplayAuthorizationResponse,
  type InstallationGenerations,
  type MobileReleaseTransport,
} from '@/_lib/native/mobileRelease';

function isNativePlatform(): boolean {
  return isValidatedNativeReleaseRuntime();
}

function getApiBaseUrl(): string {
  if (isNativePlatform()) {
    return readValidatedNativeReleaseManifest().api_origin;
  }
  return process.env.NEXT_PUBLIC_API_BASE_URL_WEB || 'http://localhost:8080';
}

export const API_BASE_URL = getApiBaseUrl();
const API_USES_NATIVE_RUNTIME = isNativePlatform();

/**
 * Native calls never attach browser cookies. Native auth uses only the in-memory
 * bearer and the Keychain/Keystore-backed adapter configured by native startup.
 */
export const authApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 5000,
  withCredentials: !API_USES_NATIVE_RUNTIME,
  headers: {
    'Content-Type': 'application/json',
  },
});

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 5000,
  withCredentials: !API_USES_NATIVE_RUNTIME,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
  },
});

function responseData<T>(request: Promise<{ data: T }>): Promise<T> {
  return request.then((response) => response.data);
}

/** The sole typed transport for mobile-release OpenAPI operations. */
export function createAxiosMobileReleaseTransport(
  client: AxiosInstance = api,
): MobileReleaseTransport {
  return {
    putInstallation(installationId, request, headers) {
      return responseData<InstallationGenerations>(
        client.put(`/v1/installations/${encodeURIComponent(installationId)}`, request, { headers }),
      );
    },
    patchInstallationToken(installationId, request, headers) {
      return responseData<InstallationGenerations>(
        client.patch(`/v1/installations/${encodeURIComponent(installationId)}/token`, request, { headers }),
      );
    },
    patchInstallationPermission(installationId, request, headers) {
      return responseData<InstallationGenerations>(
        client.patch(`/v1/installations/${encodeURIComponent(installationId)}/permission`, request, { headers }),
      );
    },
    linkInstallation(installationId, request, headers) {
      return responseData<InstallationGenerations>(
        client.post(`/v1/installations/${encodeURIComponent(installationId)}/link`, request, { headers }),
      );
    },
    unlinkInstallation(installationId, request, headers) {
      return responseData<InstallationGenerations>(
        client.post(`/v1/installations/${encodeURIComponent(installationId)}/unlink`, request, { headers }),
      );
    },
    authorizeDisplay(request, headers) {
      const noticeId = Number(request.notice_id);
      if (!Number.isSafeInteger(noticeId) || noticeId < 1) {
        return Promise.reject(new Error('Display authorization notice ID was invalid.'));
      }
      const { delivery_id, ...body } = request;
      return responseData<DisplayAuthorizationResponse>(
        client.post(
          `/v1/push-deliveries/${encodeURIComponent(delivery_id)}/authorize-display`,
          { ...body, notice_id: noticeId },
          { headers },
        ),
      );
    },
  };
}

export const mobileReleaseClient = new MobileReleaseClient(createAxiosMobileReleaseTransport());

let refreshPromise: Promise<string> | null = null;

interface WebRefreshResponse {
  readonly access_token: string;
  readonly token_type: 'bearer';
}

function isWebRefreshResponse(value: unknown): value is WebRefreshResponse {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const response = value as Record<string, unknown>;
  if (
    !Object.prototype.hasOwnProperty.call(response, 'access_token')
    || !Object.prototype.hasOwnProperty.call(response, 'token_type')
  ) {
    return false;
  }

  const accessToken = response.access_token;
  return (
    typeof accessToken === 'string'
    && accessToken.length > 0
    && accessToken.trim() === accessToken
    && response.token_type === 'bearer'
  );
}

async function refreshForCurrentPlatform(): Promise<string> {
  if (isNativePlatform()) {
    // Dynamic import avoids a client/nativeAuth circular module initialization.
    const { refreshNativeAuthSession } = await import('@/_lib/native/nativeAuth');
    const token = await refreshNativeAuthSession();
    if (!token) {
      throw new Error('Native session refresh was not acknowledged.');
    }
    return token;
  }

  const response = await authApi.post<unknown>('/auth/refresh');
  if (!isWebRefreshResponse(response.data)) {
    throw new Error('Web refresh response was invalid.');
  }
  return response.data.access_token;
}

function refreshAccessToken(): Promise<string> {
  if (refreshPromise) {
    return refreshPromise;
  }

  const activeRefresh = refreshForCurrentPlatform().then((token) => {
    setAccessToken(token, { persistSessionHint: !isNativePlatform() });
    return token;
  });
  refreshPromise = activeRefresh;
  void activeRefresh.then(
    () => {
      if (refreshPromise === activeRefresh) {
        refreshPromise = null;
      }
    },
    () => {
      if (refreshPromise === activeRefresh) {
        refreshPromise = null;
      }
    },
  );
  return activeRefresh;
}

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const hasAuthHeader = !!originalRequest?.headers?.Authorization;

    if (error.response?.status !== 401 || !originalRequest || originalRequest._retry || !hasAuthHeader) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;
    try {
      const newToken = await refreshAccessToken();
      originalRequest.headers = originalRequest.headers ?? {};
      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      clearAccessToken();
      return Promise.reject(refreshError);
    }
  },
);

export default api;
