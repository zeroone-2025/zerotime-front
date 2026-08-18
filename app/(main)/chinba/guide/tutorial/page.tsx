import type { Metadata } from 'next';

import TutorialApp from './_components/TutorialApp';

export const metadata: Metadata = {
  title: '타임라인 튜토리얼 | 제로타임',
  description:
    '실제 화면과 똑같은 연습 공간에서 클릭하며 배우는 타임라인 튜토리얼. 회장 트랙과 부원 트랙을 제공합니다.',
};

export default function ChinbaTutorialPage() {
  return <TutorialApp />;
}
