'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useUpdateUser } from '@/_lib/hooks/useUser';
import UserInfoForm, { UserInfoFormData } from '@/_components/auth/UserInfoForm';
import { FiEdit3, FiUser } from 'react-icons/fi';
import Button from '@/_components/ui/Button';
import LoadingSpinner from '@/_components/ui/LoadingSpinner';
import ConfirmModal from '@/_components/ui/ConfirmModal';
import { getAllDepartments, deleteUserAccount, logoutUser } from '@/_lib/api';
import { useUserStore } from '@/_lib/store/useUserStore';
import { useToast } from '@/_context/ToastContext';

function formatAdmissionYear(year: number | null | undefined): string | null {
  if (!year) return null;
  return `${String(year).slice(-2)}학번`;
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

  useEffect(() => {
    if (!user?.dept_code) {
      setDeptName(null);
      return;
    }
    getAllDepartments(true, user.school)
      .then((depts) => {
        const found = depts.find((d) => d.dept_code === user.dept_code);
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
    if (isAuthLoaded && !isLoggedIn) {
      router.replace('/');
    }
  }, [isAuthLoaded, isLoggedIn, router]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await updateMutation.mutateAsync({
        nickname: formData.nickname,
        username: formData.username,
        school: formData.school,
        dept_code: formData.dept_code,
        admission_year: formData.admission_year ? parseInt(formData.admission_year) : undefined,
      });
      showToast('프로필이 성공적으로 업데이트되었습니다.', 'success');
      setIsEditing(false);
    } catch (error) {
      console.error('Profile update failed:', error);
      showToast('업데이트 중 오류가 발생했습니다.', 'error');
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      await deleteUserAccount();
      await logoutUser();
      localStorage.removeItem('my_subscribed_categories');
      localStorage.removeItem('access_token');
      clearUser();
      window.location.href = '/?deleted=success';
    } catch (error) {
      console.error('Account deletion failed:', error);
      showToast('탈퇴 처리 중 오류가 발생했습니다.', 'error');
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  if (!isAuthLoaded || isUserLoading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <LoadingSpinner size="md" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 flex items-center gap-4 px-5 py-6">
        {user?.profile_image ? (
          <img
            src={user.profile_image}
            alt={user.nickname || '사용자'}
            className="h-20 w-20 rounded-full border border-gray-100 object-cover"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full border border-gray-100 bg-gray-50">
            <FiUser className="text-gray-400" size={32} />
          </div>
        )}
        <div className="flex flex-col">
          <p className="text-lg leading-tight font-bold text-gray-800">
            {user?.nickname || '사용자'}
          </p>
          {user?.username && (
            <p className="mt-0.5 text-sm text-gray-500">@{user.username}</p>
          )}
          {(user?.school || deptName || admissionYearText) && (
            <p className="mt-0.5 text-xs text-gray-400">
              {[user?.school, deptName, admissionYearText].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
      </div>

      {/* Basic info form */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="px-5 py-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <UserInfoForm
              formData={formData}
              onChange={handleFormChange}
              email={user?.email}
              showNickname={true}
              isReadonlyNickname={false}
              showUsername={true}
              isReadonly={!isEditing}
            />

            <div className="mb-4 flex justify-end">
              {!isEditing ? (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-900 transition-all hover:bg-gray-200 active:scale-95"
                >
                  <FiEdit3 size={14} />
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

          {/* 회원 탈퇴 섹션 */}
          <div className="mt-12 border-t border-gray-100 pt-6">
            <p className="text-xs text-gray-400 mb-2">
              탈퇴 시 구독, 키워드, 즐겨찾기 등 설정 데이터가 삭제됩니다.
            </p>
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className="text-xs text-red-400 underline underline-offset-2 hover:text-red-500 transition-colors"
            >
              회원 탈퇴하기
            </button>
          </div>

          <ConfirmModal
            isOpen={showDeleteModal}
            onConfirm={handleDeleteAccount}
            onCancel={() => setShowDeleteModal(false)}
            title="회원 탈퇴"
            confirmLabel={isDeleting ? '처리 중...' : '탈퇴하기'}
            cancelLabel="취소"
            variant="danger"
          >
            <p>정말 탈퇴하시겠습니까?</p>
            <p className="mt-1 text-xs text-gray-400">
              구독, 키워드, 즐겨찾기 등이 삭제됩니다.<br />
              같은 계정으로 다시 가입할 수 있습니다.
            </p>
          </ConfirmModal>
        </div>
      </div>
    </div>
  );
}
