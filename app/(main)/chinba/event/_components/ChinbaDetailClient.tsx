'use client';

import { useSearchParams, useRouter } from 'next/navigation';

import FullPageModal from '@/_components/layout/FullPageModal';
import { useChinbaEventDetail } from '@/_lib/hooks/useChinba';
import { useSmartBack } from '@/_lib/hooks/useSmartBack';

import ChinbaEventDetailBody from './ChinbaEventDetailBody';

// 풀페이지 라우트(/chinba/event) 래퍼 — 개인 친바·공유 링크·모바일용.
// 데스크톱 팀 상세에서는 ChinbaEventDetailBody가 ?view=event로 임베드된다.
export default function ChinbaDetailClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const smartBack = useSmartBack();
  const eventId = searchParams.get('id') || '';

  // 제목 표시용 — Body도 같은 쿼리를 쓰므로 react-query 캐시가 공유되어 중복 요청 없음
  const { data: event } = useChinbaEventDetail(eventId);

  const handleCompleted = (recordQuery: string) => {
    // 팀 상세 '기록' 탭으로 이동하면서 일정 정보를 넘겨 '활동 기록하기' 폼이 자동으로 열리게 한다.
    // 완료는 그 폼에서 '기록하기/기록하지 않기'를 선택해야 확정된다.
    // returnTo 없이 진입한 경우(공유 링크·사이드바 등)도 팀 일정이면 팀 상세로 보낸다 —
    // 여기서 끊기면 완료를 확정할 경로가 없다.
    const returnTo = searchParams.get('returnTo');
    const dest = returnTo
      ? decodeURIComponent(returnTo)
      : event?.team_id
        ? `/chinba/team/detail?id=${event.team_id}&tab=mwoheni`
        : null;
    if (!dest) return;
    router.replace(recordQuery ? `${dest}${dest.includes('?') ? '&' : '?'}${recordQuery}` : dest);
  };

  return (
    <FullPageModal isOpen={true} onClose={smartBack} title={event?.title || '친바'}>
      <ChinbaEventDetailBody
        eventId={eventId}
        variant="page"
        onDeleted={() => router.replace('/chinba')}
        onCompleted={handleCompleted}
      />
    </FullPageModal>
  );
}
