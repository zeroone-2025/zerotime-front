'use client';

import { useCallback } from 'react';

import { useRouter } from 'next/navigation';
import { FiUsers } from 'react-icons/fi';

import Button from '@/_components/ui/Button';
import { useToast } from '@/_context/ToastContext';
import { hasAccessToken } from '@/_lib/auth/tokenStore';
import { useJoinChinbaEventTeam } from '@/_lib/hooks/useChinba';
import { useSmartBack } from '@/_lib/hooks/useSmartBack';
import { formatDateRanges } from '@/_lib/utils/dateRange';
import { getLoginUrl } from '@/_lib/utils/requireLogin';
import type { ChinbaEventDetail } from '@/_types/chinba';

interface TeamJoinGateProps {
  eventId: string;
  event: ChinbaEventDetail;
}

// 동아리 초대 링크 없이 일정 링크만 받은 사람이 보는 화면.
// 백엔드가 비멤버에게는 제목·동아리명·기간만 내려주므로(participants·heatmap은 빈 배열)
// 여기서 가입 동의를 받고 나서야 일정 상세가 열린다.
export default function TeamJoinGate({ eventId, event }: TeamJoinGateProps) {
  const router = useRouter();
  const goBack = useSmartBack('/chinba');
  const { showToast } = useToast();
  const joinMutation = useJoinChinbaEventTeam(eventId);

  const handleJoin = useCallback(async () => {
    // 비로그인이면 로그인 후 이 화면으로 돌아와 다시 누르게 한다 (/invite와 같은 방식)
    if (!hasAccessToken()) {
      router.replace(getLoginUrl(`/chinba/event?id=${encodeURIComponent(eventId)}&tab=team`));
      return;
    }

    try {
      const result = await joinMutation.mutateAsync();
      showToast(result.message, 'success');
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      showToast(detail || '가입에 실패했습니다', 'error');
    }
  }, [eventId, joinMutation, router, showToast]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-gray-50">
        <FiUsers size={28} className="text-gray-400" />
      </div>

      <h2 className="text-lg font-bold text-gray-800">{event.title}</h2>
      <p className="mt-1 text-sm text-gray-500">{formatDateRanges(event.dates)}</p>

      <p className="mt-6 text-sm text-gray-700">
        이 일정은{' '}
        <span className="font-bold text-gray-900">
          {event.team_name ? `'${event.team_name}'` : '동아리'}
        </span>
        의 일정입니다
      </p>
      <p className="mt-1 text-sm text-gray-500">참여하려면 동아리에 가입해야 해요</p>

      <div className="mt-8 flex w-full max-w-xs flex-col gap-2">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={handleJoin}
          disabled={joinMutation.isPending}
        >
          {joinMutation.isPending ? '가입하는 중...' : '가입하고 참여하기'}
        </Button>
        <Button variant="secondary" size="lg" fullWidth onClick={goBack}>
          돌아가기
        </Button>
      </div>
    </div>
  );
}
