'use client';

import { Capacitor } from '@capacitor/core';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FiEdit3, FiUser } from 'react-icons/fi';
import { api, deleteUserAccount, getAllDepartments, logoutUser, resetAuthState } from '@/_lib/api';
import {
  DELETION_OPERATION_STORAGE_KEY,
  DELETION_STATUS_STORAGE_KEY,
  acknowledgeDeletionOperation,
  advanceDeletionOperation,
  formatDeletionDeadline,
  localizedDeletionState,
  parseDeletionStatus,
  parseStoredDeletionOperationRecord,
  parseStoredDeletionStatusRecord,
  type DeletionOperation,
  type DeletionStatus,
  type StoredDeletionStatus,
} from '@/_lib/accountDeletion';
import { useUser, useUpdateUser } from '@/_lib/hooks/useUser';
import { MOBILE_RELEASE_CONTRACT } from '@/_lib/native/mobileRelease';
import {
  clearNativeAuthSessionAfterAccountDeletionAcknowledgement,
  createNativeAuthSecureStorageAdapter,
  isNativeAuthPlatform,
} from '@/_lib/native/nativeAuth';
import { nativeNotificationCoordinatorPlugin } from '@/_lib/native/notificationCoordinator';
import { useUserStore } from '@/_lib/store/useUserStore';
import UserInfoForm, { UserInfoFormData } from '@/_components/auth/UserInfoForm';
import Button from '@/_components/ui/Button';
import ConfirmModal from '@/_components/ui/ConfirmModal';
import LoadingSpinner from '@/_components/ui/LoadingSpinner';
import { useToast } from '@/_context/ToastContext';
import { ensureNativeAccountDeletionBarrier, getQueryClient } from '@/providers';

type DeletionStorage = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
};

function formatAdmissionYear(year: number | null | undefined): string | null {
  if (!year) return null;
  return `${String(year).slice(-2)}학번`;
}

function requireSessionStorage(): DeletionStorage {
  try {
    const storage = window.sessionStorage;
    storage.getItem(DELETION_STATUS_STORAGE_KEY);
    return {
      async get(key) {
        return storage.getItem(key);
      },
      async set(key, value) {
        storage.setItem(key, value);
      },
    };
  } catch {
    throw new Error('SESSION_STORAGE_UNAVAILABLE');
  }
}

async function getDeletionStorage(): Promise<DeletionStorage> {
  if (!isNativeAuthPlatform()) {
    return requireSessionStorage();
  }
  const secureStorage = createNativeAuthSecureStorageAdapter();
  if (!(await secureStorage.isAvailable())) {
    throw new Error('NATIVE_DELETION_TRACKING_SECURE_STORAGE_UNAVAILABLE');
  }
  return secureStorage;
}

const DELETION_JOURNAL_RECOVERY_MESSAGE =
  '삭제 작업 기록이 손상되었거나 서로 일치하지 않습니다. 기존 기록은 보존했으며 새 삭제 요청을 전송하지 않았습니다. 상태 확인 또는 고객 지원을 이용해주세요.';

async function readStoredStatus(storage: DeletionStorage) {
  return parseStoredDeletionStatusRecord(await storage.get(DELETION_STATUS_STORAGE_KEY));
}

async function readStoredOperation(storage: DeletionStorage) {
  return parseStoredDeletionOperationRecord(await storage.get(DELETION_OPERATION_STORAGE_KEY));
}

function requiresDeletionJournalRecovery(
  stored: StoredDeletionStatus | null,
  operation: DeletionOperation | null,
): boolean {
  if (!stored) {
    if (!operation || (operation.kind === 'cancel' && operation.phase === 'local_complete')) return false;
    return operation.kind !== 'request'
      || (
        operation.phase !== 'reauth_pending'
        && operation.phase !== 'native_begin_pending'
        && operation.phase !== 'sending'
        && operation.phase !== 'outcome_unknown'
      );
  }
  if (!operation) return true;
  return operation.requestId !== undefined && operation.requestId !== stored.requestId;
}

async function clearWebPersonalData(): Promise<void> {
  let cookieSessionError: unknown = null;
  try {
    await logoutUser();
  } catch (error) {
    cookieSessionError = error;
    resetAuthState();
  }

  try {
    window.localStorage.clear();
    const cacheNames = await window.caches?.keys();
    if (cacheNames) {
      await Promise.all(cacheNames.map((name) => window.caches.delete(name)));
    }
    getQueryClient()?.clear();
    useUserStore.getState().clearUser();
  } catch (error) {
    if (!cookieSessionError) cookieSessionError = error;
  }

  if (cookieSessionError) {
    throw new Error('WEB_LOCAL_CLEANUP_INCOMPLETE');
  }
}

export default function ProfileClient() {
  const router = useRouter();
  const { showToast } = useToast();
  const { user, isLoggedIn, isAuthLoaded, isLoading: isUserLoading } = useUser();
  const updateMutation = useUpdateUser();
  const clearUser = useUserStore((state) => state.clearUser);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [storedDeletionStatus, setStoredDeletionStatus] = useState<StoredDeletionStatus | null>(null);
  const [deletionStatus, setDeletionStatus] = useState<DeletionStatus | null>(null);
  const [deletionStatusError, setDeletionStatusError] = useState<string | null>(null);
  const [deletionOperation, setDeletionOperation] = useState<DeletionOperation | null>(null);
  const [isDeletionStatusHydrating, setIsDeletionStatusHydrating] = useState(true);
  const deletionCleanupInFlightRef = useRef(false);
  const [deletionJournalRecoveryRequired, setDeletionJournalRecoveryRequired] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<
    'not_determined' | 'denied' | 'granted' | 'provisional' | 'ephemeral' | 'unavailable'
  >('unavailable');

  const [formData, setFormData] = useState<UserInfoFormData>({
    nickname: '',
    username: '',
    school: '',
    dept_code: '',
    dept_name: '',
    admission_year: '',
  });

  const [deptName, setDeptName] = useState<string | null>(null);
  const admissionYearText = formatAdmissionYear(user?.admission_year);

  const persistOperation = async (storage: DeletionStorage, operation: DeletionOperation) => {
    await storage.set(DELETION_OPERATION_STORAGE_KEY, JSON.stringify(operation));
    setDeletionOperation(operation);
  };

  const loadDeletionStatus = async (
    stored: StoredDeletionStatus,
    expectedOperation?: DeletionOperation,
  ): Promise<DeletionStatus> => {
    const response = await api.get<unknown>(
      `/v1/account-deletion/requests/${encodeURIComponent(stored.requestId)}/status`,
      {
        headers: {
          'X-ZeroTime-Contract': MOBILE_RELEASE_CONTRACT,
          'X-Deletion-Status-Handle': stored.statusHandle,
        },
      },
    );
    const status = parseDeletionStatus(
      response.data,
      stored.requestId,
      Date.now(),
      expectedOperation,
    );
    setDeletionStatus(status);
    setDeletionStatusError(null);
    return status;
  };

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const storage = await getDeletionStorage();
        const [storedRecord, operationRecord] = await Promise.all([
          readStoredStatus(storage),
          readStoredOperation(storage),
        ]);
        if (!active) return;

        const stored = storedRecord.kind === 'valid' ? storedRecord.value : null;
        const operation = operationRecord.kind === 'valid' ? operationRecord.value : null;
        const recoveryRequired = storedRecord.kind === 'corrupt'
          || operationRecord.kind === 'corrupt'
          || requiresDeletionJournalRecovery(stored, operation);

        setStoredDeletionStatus(stored);
        setDeletionOperation(operation);
        setDeletionJournalRecoveryRequired(recoveryRequired);
        if (recoveryRequired) {
          setDeletionStatusError(DELETION_JOURNAL_RECOVERY_MESSAGE);
          return;
        }
        if (stored) {
          await loadDeletionStatus(stored, operation?.requestId ? operation : undefined);
          if (!active
            || !operation
            || operation.kind !== 'request'
            || (operation.phase !== 'sending'
              && operation.phase !== 'outcome_unknown'
              && operation.phase !== 'server_acknowledged')) {
            return;
          }

          const acknowledged = operation.requestId
            ? operation
            : acknowledgeDeletionOperation(operation, stored.requestId);
          if (acknowledged !== operation) {
            await persistOperation(storage, acknowledged);
          }
          try {
            await runLocalCleanup(storage, acknowledged);
          } catch {
            if (active) {
              setDeletionStatusError(
                '서버가 삭제 예약을 확인했지만 이 기기의 로그인 정보·알림 표시 연결 정리가 아직 완료되지 않았습니다.',
              );
            }
          }
        }
      } catch (error) {
        if (!active) return;
        setDeletionStatusError(
          error instanceof Error && error.message === 'NATIVE_DELETION_TRACKING_SECURE_STORAGE_UNAVAILABLE'
            ? '네이티브 안전 저장소를 확인할 수 없어 30일 삭제 예약 상태를 안전하게 보관하거나 취소할 수 없습니다.'
            : '삭제 예약 상태를 확인하지 못했습니다. 응답이 확인될 때까지 완료 상태로 표시하지 않습니다.',
        );
      } finally {
        if (active) setIsDeletionStatusHydrating(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isNativeAuthPlatform()) {
      return;
    }

    void nativeNotificationCoordinatorPlugin.getDisplayPermission()
      .then(({ permission }) => {
        setNotificationPermission(
          permission === 'not_determined'
          || permission === 'denied'
          || permission === 'granted'
          || permission === 'provisional'
          || permission === 'ephemeral'
            ? permission
            : 'unavailable',
        );
      })
      .catch(() => setNotificationPermission('unavailable'));
  }, []);

  useEffect(() => {
    if (!user?.dept_code) {
      setDeptName(null);
      return;
    }
    getAllDepartments(true, user.school)
      .then((depts) => {
        const found = depts.find((dept) => dept.dept_code === user.dept_code);
        setDeptName(found?.dept_name || null);
      })
      .catch(() => setDeptName(null));
  }, [user?.dept_code]);

  useEffect(() => {
    if (user) {
      setFormData({
        nickname: user.nickname || '',
        username: user.username || '',
        school: user.school || '',
        dept_code: user.dept_code || '',
        dept_name: '',
        admission_year: user.admission_year ? user.admission_year.toString() : '',
      });
    }
  }, [user]);

  useEffect(() => {
    if (isDeletionStatusHydrating
      || !isAuthLoaded
      || isLoggedIn
      || storedDeletionStatus
      || deletionJournalRecoveryRequired) {
      return;
    }
    clearUser();
    router.replace('/');
  }, [
    clearUser,
    deletionJournalRecoveryRequired,
    isAuthLoaded,
    isDeletionStatusHydrating,
    isLoggedIn,
    router,
    storedDeletionStatus,
  ]);

  const handleFormChange = (data: Partial<UserInfoFormData>) => {
    setFormData((prev) => ({ ...prev, ...data }));
  };

  const handleCancel = () => {
    if (user) {
      setFormData({
        nickname: user.nickname || '',
        username: user.username || '',
        school: user.school || '',
        dept_code: user.dept_code || '',
        dept_name: '',
        admission_year: user.admission_year ? user.admission_year.toString() : '',
      });
    }
    setIsEditing(false);
  };

  const handleOpenNotificationSettings = async () => {
    if (!isNativeAuthPlatform()) {
      showToast('브라우저 설정에서 알림 권한을 변경해주세요.', 'info');
      return;
    }

    try {
      const result = await nativeNotificationCoordinatorPlugin.openNotificationSettings();
      if (!result.success) {
        throw new Error('Native settings navigation was not acknowledged.');
      }
      showToast('운영체제 알림 설정을 열었습니다.', 'success');
    } catch (error) {
      console.error('Notification settings navigation failed:', error);
      showToast('운영체제 알림 설정을 열지 못했습니다.', 'error');
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    try {
      await updateMutation.mutateAsync({
        nickname: formData.nickname,
        username: formData.username,
        school: formData.school,
        dept_code: formData.dept_code,
        admission_year: formData.admission_year ? parseInt(formData.admission_year, 10) : undefined,
      });
      showToast('프로필이 성공적으로 업데이트되었습니다.', 'success');
      setIsEditing(false);
    } catch (error) {
      console.error('Profile update failed:', error);
      showToast('업데이트 중 오류가 발생했습니다.', 'error');
    }
  };

  const finishLocalCleanup = async (
    storage: DeletionStorage,
    acknowledgedOperation: DeletionOperation,
  ) => {
    const pending = advanceDeletionOperation(acknowledgedOperation, 'local_cleanup_pending');
    await persistOperation(storage, pending);

    if (isNativeAuthPlatform()) {
      const displayEpoch = await ensureNativeAccountDeletionBarrier();
      if (!displayEpoch) {
        throw new Error('Native deletion barrier receipt is unavailable.');
      }
      await clearNativeAuthSessionAfterAccountDeletionAcknowledgement(displayEpoch);
      window.localStorage.clear();
      getQueryClient()?.clear();
      clearUser();
    } else {
      await clearWebPersonalData();
    }

    const complete = advanceDeletionOperation(pending, 'local_complete');
    await persistOperation(storage, complete);
  };
  const runLocalCleanup = async (
    storage: DeletionStorage,
    acknowledgedOperation: DeletionOperation,
  ) => {
    if (deletionCleanupInFlightRef.current) {
      return;
    }
    deletionCleanupInFlightRef.current = true;
    try {
      await finishLocalCleanup(storage, acknowledgedOperation);
    } finally {
      deletionCleanupInFlightRef.current = false;
    }
  };

  const handleDeletionRequest = async () => {
    setIsDeleting(true);
    try {
      await deleteUserAccount();
      await clearWebPersonalData();
      setShowDeleteModal(false);
      router.replace('/?deleted=success');
    } catch (error) {
      console.error('Account deletion failed:', error);
      showToast('회원 탈퇴 처리 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const localCleanupMessage = deletionOperation?.phase === 'local_complete'
    ? '이 기기의 로그인 정보와 알림 표시 연결 정리가 완료되었습니다.'
    : deletionOperation?.phase === 'local_cleanup_pending'
      ? '서버 응답은 확인되었지만 이 기기의 로컬 정리가 아직 완료되지 않았습니다.'
      : deletionOperation?.phase === 'outcome_unknown'
        ? '마지막 삭제 요청 결과를 확인하는 중입니다. 같은 작업 식별자로만 다시 시도합니다.'
        : '서버 상태 응답을 확인하는 중입니다.';

  if (storedDeletionStatus) {
    return (
      <div className="flex h-full flex-col px-5 py-8" aria-busy={isDeletionStatusHydrating}>
        <h1 className="text-lg font-bold text-gray-900">계정 삭제 예약</h1>
        <p className="mt-2 text-sm leading-6 text-gray-600" role="status" aria-live="polite" aria-atomic="true">
          {localCleanupMessage}
        </p>
        {deletionStatus ? (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="status" aria-live="polite" aria-atomic="true">
            <p className="font-semibold">현재 상태: {localizedDeletionState(deletionStatus.state)}</p>
            <p className="mt-1">예정일: {formatDeletionDeadline(deletionStatus.deadline_at_utc)}</p>
            {deletionStatus.retry_guidance && <p className="mt-2">{deletionStatus.retry_guidance}</p>}
          </div>
        ) : (
          <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900" role="status" aria-live="polite">
            서버 상태 응답을 검증하는 중입니다. 검증되지 않은 응답은 성공으로 표시하지 않습니다.
          </p>
        )}
        {deletionStatus?.cancelable && (
          <div className="mt-5 rounded-xl border border-gray-200 p-4 text-sm text-gray-600">
            <p className="font-semibold text-gray-800">예약 취소</p>
            <p className="mt-1 leading-5">
              취소에는 동일 제공업체 재인증과 서버 확인이 필요합니다. 안전하게 보관된 상태 핸들을 사용하는
              계정 삭제 페이지에서 재인증을 완료하세요.
            </p>
            <button
              type="button"
              onClick={() => router.push('/account-deletion/')}
              className="mt-3 text-xs font-semibold text-blue-700 underline underline-offset-2"
            >
              삭제 예약 취소 계속하기
            </button>
          </div>
        )}
        {deletionStatusError && (
          <p className="mt-4 text-sm leading-6 text-red-700" role="alert" aria-live="assertive">
            {deletionStatusError}
          </p>
        )}
        <button
          type="button"
          onClick={() => router.replace('/')}
          className="mt-6 text-sm font-semibold text-blue-700"
        >
          홈으로 이동
        </button>
      </div>
    );
  }

  if (!isAuthLoaded || isUserLoading || isDeletionStatusHydrating) {
    return (
      <div className="flex h-[400px] flex-col items-center justify-center" aria-busy="true">
        <div aria-hidden="true"><LoadingSpinner size="md" /></div>
        <p className="sr-only" role="status" aria-live="polite">프로필과 삭제 예약 상태를 확인하는 중입니다.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-4 px-5 py-6">
        {user?.profile_image ? (
          <img
            src={user.profile_image}
            alt={user.nickname || '사용자'}
            className="h-20 w-20 rounded-full border border-gray-100 object-cover"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full border border-gray-100 bg-gray-50" aria-hidden="true">
            <FiUser className="text-gray-400" size={32} />
          </div>
        )}
        <div className="flex flex-col">
          <p className="text-lg leading-tight font-bold text-gray-800">{user?.nickname || '사용자'}</p>
          {user?.username && <p className="mt-0.5 text-sm text-gray-500">@{user.username}</p>}
          {(user?.school || deptName || admissionYearText) && (
            <p className="mt-0.5 text-xs text-gray-400">
              {[user?.school, deptName, admissionYearText].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="px-5 py-6">
          {deletionStatusError && (
            <p className="mb-4 text-sm leading-6 text-red-700" role="alert" aria-live="assertive">
              {deletionStatusError}
            </p>
          )}
          <form onSubmit={handleSubmit} className="space-y-6">
            <UserInfoForm
              formData={formData}
              onChange={handleFormChange}
              email={user?.email}
              showNickname
              isReadonlyNickname={false}
              showUsername
              isReadonly={!isEditing}
            />

            <div className="mb-4 flex justify-end">
              {!isEditing ? (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-900 transition-all hover:bg-gray-200 active:scale-95"
                >
                  <FiEdit3 size={14} aria-hidden="true" />
                  수정하기
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCancel}
                  className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-500 transition-all hover:bg-gray-200 active:scale-95"
                >
                  취소
                </button>
              )}
            </div>

            {isEditing && (
              <div className="animate-slide-up pt-4">
                <Button
                  type="submit"
                  disabled={updateMutation.isPending}
                  fullWidth
                  size="lg"
                  className="shadow-lg active:scale-95"
                >
                  {updateMutation.isPending ? '저장 중...' : '저장하기'}
                </Button>
              </div>
            )}
          </form>

          <div className="mt-12 border-t border-gray-100 pt-6">
            {Capacitor.isNativePlatform() && (
              <div className="mb-6 rounded-xl border border-gray-100 bg-gray-50 p-4">
                <p className="text-sm font-semibold text-gray-800">알림 권한</p>
                <p className="mt-1 text-xs text-gray-500">
                  현재 상태: {
                    notificationPermission === 'granted'
                      ? '허용'
                      : notificationPermission === 'provisional'
                        ? '임시 허용'
                        : notificationPermission === 'ephemeral'
                          ? '일시 허용'
                          : notificationPermission === 'denied'
                            ? '허용 안 함'
                            : notificationPermission === 'not_determined'
                              ? '결정되지 않음'
                              : '확인할 수 없음'
                  }
                </p>
                <button
                  type="button"
                  onClick={handleOpenNotificationSettings}
                  className="mt-3 text-xs font-semibold text-blue-700 underline underline-offset-2"
                >
                  운영체제 알림 설정 열기
                </button>
              </div>
            )}
            <p className="mb-2 text-xs leading-5 text-gray-500">
              회원 탈퇴 시 계정 접근이 즉시 비활성화됩니다.
            </p>
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              disabled={isDeleting || deletionJournalRecoveryRequired}
              className="text-xs text-red-700 underline underline-offset-2 transition-colors hover:text-red-800 disabled:opacity-50"
            >
              회원 탈퇴하기
            </button>
          </div>

          <ConfirmModal
            isOpen={showDeleteModal}
            onConfirm={handleDeletionRequest}
            onCancel={() => setShowDeleteModal(false)}
            title="회원 탈퇴"
            confirmLabel={isDeleting ? '처리 중...' : '탈퇴하기'}
            cancelLabel="취소"
            variant="danger"
          >
            <p>회원 탈퇴 시 계정 접근이 즉시 비활성화됩니다.</p>
          </ConfirmModal>
        </div>
      </div>
    </div>
  );
}
