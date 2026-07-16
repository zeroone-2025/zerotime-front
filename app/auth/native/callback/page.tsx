'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import {
  isNativeAuthPlatform,
  resumeNativeDeletionAuthCallback,
} from '@/_lib/native/nativeAuth';

function eraseCallbackUrl(): void {
  window.history.replaceState(null, '', '/auth/native/callback/');
}

export default function NativeDeletionCallbackPage() {
  const router = useRouter();
  const processedRef = useRef(false);
  const [status, setStatus] = useState('제공업체 재인증을 확인하는 중...');
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (processedRef.current) return;
    processedRef.current = true;

    void (async () => {
      try {
        if (!isNativeAuthPlatform()) {
          throw new Error('NATIVE_CALLBACK_OUTSIDE_NATIVE_APP');
        }
        const routed = await resumeNativeDeletionAuthCallback(window.location.href);
        eraseCallbackUrl();

        if (routed?.kind === 'deletion_capability') {
          setStatus(
            routed.purpose === 'request'
              ? '재인증이 확인되었습니다. 삭제 예약 요청을 확인하는 중...'
              : '재인증이 확인되었습니다. 삭제 예약 취소를 확인하는 중...',
          );
          router.replace('/account-deletion/');
          return;
        }
        if (routed?.kind === 'deletion_rejected') {
          setStatus(
            routed.purpose === 'request'
              ? '제공업체 재인증이 취소되거나 거부되었습니다. 삭제 예약은 생성되지 않았습니다.'
              : '제공업체 재인증이 취소되거나 거부되었습니다. 예약은 취소되지 않았습니다.',
          );
          setHasError(true);
          return;
        }
        throw new Error('INVALID_TRANSACTION');
      } catch {
        eraseCallbackUrl();
        setStatus('유효하지 않거나 만료된 재인증 콜백입니다. 삭제 요청은 전송되지 않았습니다.');
        setHasError(true);
      }
    })();
  }, [router]);

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-white px-5 text-gray-900" aria-busy={!hasError}>
      <div className="max-w-md text-center">
        {!hasError && (
          <div
            aria-hidden="true"
            className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-gray-900"
          />
        )}
        <p
          className="mt-4 text-sm leading-6 text-gray-700"
          role={hasError ? 'alert' : 'status'}
          aria-live={hasError ? 'assertive' : 'polite'}
          aria-atomic="true"
        >
          {status}
        </p>
      </div>
    </main>
  );
}
