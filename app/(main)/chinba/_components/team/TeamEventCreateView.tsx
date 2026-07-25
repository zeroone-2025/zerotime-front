'use client';

import { useRouter, useSearchParams } from 'next/navigation';

import TeamEventCreateBody from '@/(main)/chinba/_components/team/TeamEventCreateBody';
import FullPageModal from '@/_components/layout/FullPageModal';
import { useSmartBack } from '@/_lib/hooks/useSmartBack';

// 풀페이지 라우트(/chinba/team/event-create) 래퍼 — 모바일·딥링크용.
// 데스크톱 팀 상세에서는 TeamEventCreateBody가 ?view=create로 임베드된다.
export default function TeamEventCreateView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const teamId = Number(searchParams.get('id'));
  const preSetId = searchParams.get('setId') ? Number(searchParams.get('setId')) : null;
  const preGroupId = searchParams.get('groupId') ? Number(searchParams.get('groupId')) : null;
  const preCategoryIdRaw = searchParams.get('categoryId');
  const preCategoryId =
    preCategoryIdRaw && Number.isFinite(Number(preCategoryIdRaw)) ? Number(preCategoryIdRaw) : null;
  const goBack = useSmartBack(`/chinba/team/detail?id=${teamId}&tab=mannaja`);

  return (
    <FullPageModal isOpen={true} onClose={goBack} title="동아리 친바 만들기">
      <TeamEventCreateBody
        teamId={teamId}
        preSetId={preSetId}
        preGroupId={preGroupId}
        preCategoryId={preCategoryId}
        onSuccess={() => router.replace(`/chinba/team/detail?id=${teamId}&tab=mannaja`)}
      />
    </FullPageModal>
  );
}
