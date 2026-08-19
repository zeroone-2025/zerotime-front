import { ChapterHeader } from './GuideBlocks';

/**
 * 6장 — 알아두면 좋은 기능 (MY 탭, 동아리 전환, 일정 상태, 동아리 설정)
 * 7장 — 자주 묻는 질문
 * 근거 화면: MyTabContent, ClubSwitcher, ChinbaEventDetailBody(상태·생성자 권한),
 * TeamSettingsView, 백엔드 import-timetable(시간표 슬롯만 교체·수동 입력 보존).
 */

const EXTRA_FEATURES: { title: string; body: string }[] = [
  {
    title: 'MY 탭, 내 것만 모아 보기',
    body: '하단의 MY 탭은 나를 기준으로 정리된 화면입니다. 아직 시간을 제출하지 않은 일정이 "내 할일"에 모이고, 내가 속한 동아리 목록과 앞으로 7일 안의 다가오는 일정이 이어집니다. 내 시간표 관리도 이 탭의 [내 시간표] 버튼에서 합니다.',
  },
  {
    title: '동아리 여러 개 오가기',
    body: '동아리에 2개 이상 속해 있으면 동아리 화면 상단의 동아리 이름 옆에 ▼가 생깁니다. 눌러서 드롭다운으로 바로 전환할 수 있고, 마지막에 보던 동아리를 기억해 다음에 열 때 그 동아리부터 보여줍니다.',
  },
  {
    title: '일정의 세 가지 상태',
    body: '일정은 진행중(파랑) → 완료됨(초록) 또는 지난 일정(회색)으로 흘러갑니다. 후보 날짜가 다 지나면 자동으로 "지난 일정"이 되는데, 그때도 완료 처리하고 활동을 기록할 수 있습니다. 일정의 완료 처리와 삭제는 그 일정을 만든 사람만 할 수 있습니다.',
  },
  {
    title: '사이드바에서 바로 가기',
    body: '왼쪽 사이드바의 타임라인 메뉴를 펼치면 내가 참여 중인 일정 목록이 바로 나옵니다. 어느 화면에 있든 두 번의 클릭으로 일정 제출 화면까지 갈 수 있습니다.',
  },
  {
    title: '동아리 설정 페이지',
    body: '동아리 화면 오른쪽 위 톱니바퀴가 동아리 설정입니다. 동아리 이름·카테고리 수정, 초대 링크, 멤버 관리, 그룹/조 관리가 한 페이지에 모여 있고, 맨 아래에 회장 위임과 동아리 삭제(회장·부회장만)가 있습니다.',
  },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: '제출한 시간을 바꾸고 싶어요.',
    a: '일정의 "내 일정" 탭에서 다시 칠하고 [저장하기]를 누르면 이전 제출을 덮어씁니다. 몇 번이든 수정할 수 있습니다.',
  },
  {
    q: '시간표를 바꿨는데 일정에 반영이 안 돼요.',
    a: '일정마다 [내 시간표 불러오기]를 다시 누르면 됩니다. 시간표에서 온 시간만 새로 갈아끼우고, 직접 칠한 시간은 그대로 보존됩니다.',
  },
  {
    q: '조 편성을 바꾸고 싶어요.',
    a: '조 / 그룹 관리에서 그룹세트의 [수정]으로 조원을 옮기거나, [재편성]으로 처음부터 다시 짤 수 있습니다. 스터디용·MT용처럼 용도가 다르면 그룹세트를 하나 더 만드는 쪽이 깔끔합니다.',
  },
  {
    q: '일정 조율은 몇 시부터 몇 시까지인가요?',
    a: '기본 오전 8시부터 자정까지, 30분 단위입니다.',
  },
  {
    q: '동아리 없이도 쓸 수 있나요?',
    a: '네. 타임라인 홈의 "동아리 없이 잡은 일정"에서 일정을 만들고 링크만 공유하면 됩니다. 조·멤버 관리 없이 시간 조율 기능만 가볍게 쓰는 방식입니다.',
  },
  {
    q: '초대 코드가 밖으로 새어 나갔어요.',
    a: '동아리 설정의 [초대 코드 재생성]을 누르세요(회장·부회장만). 기존 링크는 즉시 무효가 됩니다.',
  },
];

export default function GuideExtras() {
  return (
    <>
      <section>
        <ChapterHeader
          no={6}
          id="extras"
          title="알아두면 좋은 기능"
          subtitle="플로우 밖에 있지만 쓰다 보면 찾게 되는 것들"
        />

        <div className="mt-8 space-y-4">
          {EXTRA_FEATURES.map(({ title, body }) => (
            <div key={title} className="rounded-xl border border-gray-100 bg-white p-5">
              <h3 className="text-base font-bold text-gray-900">{title}</h3>
              <p className="mt-2 text-sm leading-7 text-gray-700">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <ChapterHeader
          no={7}
          id="faq"
          title="자주 묻는 질문"
          subtitle="짧게 묻고 짧게 답하기"
        />

        <div className="mt-8 space-y-4">
          {FAQ.map(({ q, a }) => (
            <div key={q} className="rounded-xl border border-gray-100 bg-gray-50 p-5">
              <p className="text-[15px] font-bold text-gray-900">Q. {q}</p>
              <p className="mt-2 text-sm leading-7 text-gray-700">{a}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
