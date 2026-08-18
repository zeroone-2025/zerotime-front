'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import DoneScreen from './DoneScreen';
import FakeSidebar from './FakeSidebar';
import SceneClubHome from './scenes/SceneClubHome';
import SceneCreateClub from './scenes/SceneCreateClub';
import SceneEventCreate from './scenes/SceneEventCreate';
import SceneEventDetail from './scenes/SceneEventDetail';
import SceneGroups from './scenes/SceneGroups';
import SceneMembersModal from './scenes/SceneMembersModal';
import SceneRecordForm from './scenes/SceneRecordForm';
import SceneRecords from './scenes/SceneRecords';
import SceneTimetable from './scenes/SceneTimetable';
import { TutorialOverlay } from './Spotlight';
import StartScreen from './StartScreen';
import { TUTORIAL_STEPS } from './tracks';
import TutorialChrome from './TutorialChrome';
import TutorialConfirmModal from './TutorialConfirmModal';
import TutorialToasts from './TutorialToasts';
import type { SceneId } from './types';
import { useTutorialEngine, type TutorialEngine } from './useTutorialEngine';

const SCENES: Record<SceneId, (props: { engine: TutorialEngine }) => React.ReactNode> = {
  createClub: SceneCreateClub,
  clubHome: SceneClubHome,
  membersModal: SceneMembersModal,
  groups: SceneGroups,
  eventCreate: SceneEventCreate,
  timetable: SceneTimetable,
  eventDetail: SceneEventDetail,
  recordForm: SceneRecordForm,
  records: SceneRecords,
};

/**
 * 튜토리얼 루트 — 실제 앱 셸 전체를 fixed 오버레이(z-[70])로 덮고,
 * 그 안에 가짜 앱 화면(왼쪽 사이드바 + 중앙 + 우측 운영 패널)을 복제한다.
 */
export default function TutorialApp() {
  const [started, setStarted] = useState(false);
  const [runId, setRunId] = useState(0);

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-gray-50">
      {started ? (
        <TutorialRun
          key={runId}
          onRestart={() => {
            setStarted(false);
            setRunId((n) => n + 1);
          }}
        />
      ) : (
        <div className="flex-1 overflow-y-auto">
          <StartScreen onStart={() => setStarted(true)} />
        </div>
      )}
    </div>
  );
}

function TutorialRun({ onRestart }: { onRestart: () => void }) {
  const router = useRouter();
  const engine = useTutorialEngine(TUTORIAL_STEPS);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  if (engine.isDone) {
    return (
      <div className="flex-1 overflow-y-auto">
        <DoneScreen onRestart={onRestart} />
      </div>
    );
  }

  const scene = engine.step!.scene;
  const Scene = SCENES[scene];

  return (
    <>
      <TutorialChrome
        trackLabel="타임라인 튜토리얼"
        stepIndex={engine.stepIndex}
        totalSteps={engine.totalSteps}
        onExit={() => setShowExitConfirm(true)}
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* 실제 (main) 레이아웃 재현: 가운데 정렬된 [사이드바 | 콘텐츠] 박스 */}
        <div className="mx-auto flex min-h-full w-full max-w-[1200px] md:shadow-xl">
          <FakeSidebar />
          <div className="flex min-h-full w-full min-w-0 flex-1 flex-col border-x border-gray-100 bg-white md:border-l-0">
            {/* 장면 — scene이 바뀔 때 리마운트 + fadeIn (transform 계열 금지: 스포트라이트 z-승격 보호) */}
            <div key={scene} className="flex-1 animate-fadeIn">
              <Scene engine={engine} />
            </div>
          </div>
        </div>
      </div>

      <TutorialOverlay engine={engine} />
      <TutorialToasts toasts={engine.toasts} />

      <TutorialConfirmModal
        isOpen={showExitConfirm}
        title="튜토리얼 나가기"
        confirmLabel="나가기"
        onConfirm={() => router.push('/chinba/guide/')}
        onCancel={() => setShowExitConfirm(false)}
      >
        진행 상황은 저장되지 않아요. 나갈까요?
      </TutorialConfirmModal>
    </>
  );
}
