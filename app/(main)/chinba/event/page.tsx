import { Suspense } from 'react';

import type { Metadata } from 'next';

import ChinbaDetailClient from './_components/ChinbaDetailClient';

// 링크 프리뷰(OG) — 이 경로에서만 루트 layout의 제로타임 메타를 타임라인으로 덮는다.
// openGraph는 세그먼트 단위로 통째 교체되므로 siteName·locale·type도 다시 적는다.
// 카드 이미지는 같은 폴더의 opengraph-image.tsx가 자동으로 붙는다.
const TITLE = '타임라인 - 가장 편한 일정 잡기';
const DESCRIPTION = '내가 되는 시간만 체크하세요. 모두 되는 시간을 찾아드려요.';

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

export default function ChinbaEventPage() {
    return (
        <Suspense fallback={null}>
            <ChinbaDetailClient />
        </Suspense>
    );
}
