import { Suspense } from 'react';

import type { Metadata } from 'next';

import InviteClient from './_components/InviteClient';

// 링크 프리뷰(OG) — 이 경로에서만 루트 layout의 제로타임 메타를 타임라인으로 덮는다.
// openGraph는 세그먼트 단위로 통째 교체되므로 siteName·locale·type도 다시 적는다.
// 카드 이미지는 같은 폴더의 opengraph-image.tsx가 자동으로 붙는다.
const TITLE = '타임라인 - 우리 동아리에 초대합니다';
const DESCRIPTION = '일정 조율부터 활동 기록, 조별 랭킹, 운영진 관리까지 한 곳에서.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    siteName: '타임라인 (TimeLine)',
    locale: 'ko_KR',
    type: 'website',
  },
};

export default function InvitePage() {
  return (
    <Suspense fallback={null}>
      <InviteClient />
    </Suspense>
  );
}
