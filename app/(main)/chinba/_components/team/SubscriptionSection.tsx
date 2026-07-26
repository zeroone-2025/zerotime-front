'use client';

import { useState } from 'react';

import ConfirmModal from '@/_components/ui/ConfirmModal';
import LoadingSpinner from '@/_components/ui/LoadingSpinner';
import { useToast } from '@/_context/ToastContext';
import {
  useSubscription,
  useCreateSubscription,
  useCancelSubscription,
} from '@/_lib/hooks/useSubscription';
import type { TierInfo } from '@/_types/team';

interface SubscriptionSectionProps {
  teamId: number;
  canManage: boolean;
}

const CYCLE_LABELS: Record<string, string> = {
  monthly: '월간',
  semester: '학기(4개월)',
  annual: '연간(12개월)',
};

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  active: { label: '구독 중', className: 'bg-green-50 text-green-600' },
  cancelled: { label: '해지 예정', className: 'bg-yellow-50 text-yellow-600' },
  expired: { label: '만료', className: 'bg-gray-50 text-gray-400' },
};

function formatDate(dateStr: string | null) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatPrice(price: number) {
  return price.toLocaleString('ko-KR') + '원';
}

function getTierPrice(tier: TierInfo, cycle: 'monthly' | 'semester' | 'annual') {
  if (cycle === 'semester') return tier.semester_price;
  if (cycle === 'annual') return tier.annual_price;
  return tier.monthly_price;
}

export default function SubscriptionSection({ teamId, canManage }: SubscriptionSectionProps) {
  const { showToast } = useToast();
  const { data: sub, isLoading } = useSubscription(teamId);
  const createSubscription = useCreateSubscription(teamId);
  const cancelSubscription = useCancelSubscription(teamId);

  const [selectedCycle, setSelectedCycle] = useState<'monthly' | 'semester' | 'annual'>('monthly');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  if (isLoading) {
    return (
      <section className="mb-6">
        <h2 className="text-sm font-bold text-gray-800 mb-3">구독 관리</h2>
        <div className="rounded-xl border border-gray-100 bg-white flex items-center justify-center py-8">
          <LoadingSpinner size="sm" />
        </div>
      </section>
    );
  }

  if (!sub) return null;

  const isSubscribed = sub.status === 'active';
  const isCancelled = sub.status === 'cancelled';

  // 관리 권한도 없고 구독도 없으면 보여줄 것이 없다 (요금제 안내만 남은 막다른 화면 방지)
  if (!canManage && !isSubscribed && !isCancelled) return null;
  const statusInfo = STATUS_LABELS[sub.status ?? ''] ?? { label: '미구독', className: 'bg-gray-50 text-gray-400' };

  // 현재 멤버 수 기반으로 해당하는 티어 찾기
  const currentTier = sub.available_tiers.find((t) => t.tier === sub.tier);

  const handleSubscribe = async () => {
    try {
      await createSubscription.mutateAsync({ billing_cycle: selectedCycle });
      showToast('구독이 시작되었습니다', 'success');
    } catch (err: any) {
      showToast(err.response?.data?.detail || '구독에 실패했습니다', 'error');
    }
  };

  const handleCancel = async () => {
    try {
      await cancelSubscription.mutateAsync();
      showToast('구독이 해지되었습니다. 남은 기간까지 사용 가능합니다.', 'success');
    } catch (err: any) {
      showToast(err.response?.data?.detail || '해지에 실패했습니다', 'error');
    }
    setShowCancelConfirm(false);
  };

  return (
    <section className="mb-6">
      <h2 className="text-sm font-bold text-gray-800 mb-3">구독 관리</h2>
      <div className="rounded-xl border border-gray-100 bg-white">
        {/* 현재 구독 상태 */}
        {(isSubscribed || isCancelled) ? (
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-800">
                  {sub.tier_label ?? sub.tier}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusInfo.className}`}>
                  {statusInfo.label}
                </span>
              </div>
              {sub.amount != null && (
                <span className="text-sm font-medium text-gray-600">
                  {formatPrice(sub.amount)}/{CYCLE_LABELS[sub.billing_cycle ?? ''] ?? '월'}
                </span>
              )}
            </div>

            <div className="flex gap-4 text-xs text-gray-500">
              <div>
                <span className="text-gray-400">시작일</span>{' '}
                <span className="font-medium text-gray-600">{formatDate(sub.started_at)}</span>
              </div>
              <div>
                <span className="text-gray-400">만료일</span>{' '}
                <span className="font-medium text-gray-600">{formatDate(sub.expires_at)}</span>
              </div>
            </div>

            {currentTier && (
              <div className="text-xs text-gray-400">
                멤버 {sub.member_count}명 ({currentTier.member_range})
              </div>
            )}

            {canManage && isSubscribed && (
              <button
                onClick={() => setShowCancelConfirm(true)}
                className="w-full rounded-xl border border-red-100 py-2.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-50"
              >
                구독 해지
              </button>
            )}
          </div>
        ) : (
          /* 미구독 상태 — 요금제 안내 */
          <div className="p-4 space-y-4">
            <div className="text-center py-2">
              <p className="text-sm font-medium text-gray-600 mb-1">
                프리미엄 기능을 이용해보세요
              </p>
              <p className="text-xs text-gray-400">
                활동 기록(뭐했니)과 조별 비교(잡아봐) 기능을 사용할 수 있습니다
              </p>
            </div>

            {/* 결제 주기 선택 */}
            {canManage && (
              <>
                <div className="flex rounded-lg bg-gray-50 p-1">
                  {(['monthly', 'semester', 'annual'] as const).map((cycle) => (
                    <button
                      key={cycle}
                      onClick={() => setSelectedCycle(cycle)}
                      className={`flex-1 rounded-md py-2 text-xs font-medium transition-colors ${
                        selectedCycle === cycle
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {CYCLE_LABELS[cycle]}
                      {cycle === 'semester' && (
                        <span className="ml-1 text-[10px] text-blue-500">15%</span>
                      )}
                      {cycle === 'annual' && (
                        <span className="ml-1 text-[10px] text-blue-500">25%</span>
                      )}
                    </button>
                  ))}
                </div>

                {/* 요금제 카드 */}
                <div className="space-y-2">
                  {sub.available_tiers.map((tier) => {
                    const price = getTierPrice(tier, selectedCycle);
                    return (
                      <div
                        key={tier.tier}
                        className="flex items-center justify-between rounded-xl border border-gray-100 px-4 py-3"
                      >
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{tier.tier}</p>
                          <p className="text-xs text-gray-400">{tier.member_range}</p>
                        </div>
                        <p className="text-sm font-bold text-gray-800">
                          {formatPrice(price)}
                          <span className="text-xs font-normal text-gray-400">
                            /{CYCLE_LABELS[selectedCycle]}
                          </span>
                        </p>
                      </div>
                    );
                  })}
                </div>

                <p className="text-center text-[11px] text-gray-400">
                  현재 멤버 {sub.member_count}명 · 멤버 수에 따라 요금제가 자동 적용됩니다
                </p>

                <button
                  onClick={handleSubscribe}
                  disabled={createSubscription.isPending}
                  className="w-full rounded-xl bg-gray-900 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-800 active:scale-[0.98] disabled:opacity-50"
                >
                  {createSubscription.isPending ? '처리 중...' : '구독하기'}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* 해지 확인 모달 */}
      <ConfirmModal
        isOpen={showCancelConfirm}
        onConfirm={handleCancel}
        onCancel={() => setShowCancelConfirm(false)}
        title="구독 해지"
        confirmLabel="해지"
        cancelLabel="취소"
        variant="danger"
      >
        <p>구독을 해지하시겠습니까?</p>
        <p className="mt-1 text-xs text-gray-400">
          남은 기간까지는 프리미엄 기능을 계속 이용할 수 있습니다.
        </p>
      </ConfirmModal>
    </section>
  );
}
