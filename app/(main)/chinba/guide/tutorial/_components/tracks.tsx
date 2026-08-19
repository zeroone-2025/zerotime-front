import { ME_ID } from './state';
import type { TutorialStep } from './types';

/**
 * 통합 튜토리얼 대본 — 회장 플로우를 기본으로, 일정 생성과 기록 사이에
 * 참가자(부원) 플로우(시간표 등록 → 내 시간 제출)를 끼워 넣었다.
 */
export const TUTORIAL_STEPS: TutorialStep[] = [
  // ── 1. 동아리 만들기 ──
  {
    id: 'C-name',
    scene: 'createClub',
    target: 'cc-name',
    bubble: { content: <>동아리 이름을 지어주세요. 아무 이름이나 좋아요!</>, placement: 'bottom' },
    advance: { kind: 'next', enabledWhen: (s) => s.clubName.trim().length > 0 },
  },
  {
    id: 'C-category',
    scene: 'createClub',
    target: 'cc-category',
    bubble: { content: <>카테고리를 하나 골라보세요.</>, placement: 'bottom' },
    advance: { kind: 'state', when: (s) => s.category !== null },
  },
  {
    id: 'C-create',
    scene: 'createClub',
    target: 'cc-create',
    bubble: { content: <>[만들기]를 누르면 동아리가 생겨요.</>, placement: 'top' },
    advance: { kind: 'click', enabledWhen: (s) => s.clubName.trim().length > 0 },
    onComplete: [{ type: 'ADD_MEMBER', member: { id: ME_ID, name: '홍길동', role: '회장' } }],
    script: [{ delayMs: 0, toast: { message: '동아리가 생성되었습니다', type: 'success' } }],
  },
  // ── 2. 초대링크로 부원 초대 ──
  {
    id: 'I-copy',
    scene: 'clubHome',
    target: 'ops-invite',
    bubble: {
      content: <>여기가 동아리 홈이에요. 오른쪽 운영 패널에서 <strong>[초대링크 복사]</strong>를 눌러 단톡방에 붙여넣어 보세요.</>,
      placement: 'bottom',
    },
    advance: { kind: 'click' },
    script: [{ delayMs: 0, toast: { message: '초대 링크가 복사되었습니다', type: 'success' } }],
  },
  {
    id: 'I-join',
    scene: 'clubHome',
    target: 'ops-members',
    bubble: { content: <>링크를 받은 부원들이 들어오고 있어요!</>, placement: 'bottom' },
    advance: { kind: 'auto' },
    script: [
      { delayMs: 600, action: { type: 'ADD_MEMBER', member: { id: 'yh', name: '이영희', role: '회원' } }, toast: { message: '이영희님이 가입했어요 🎉', type: 'info' } },
      { delayMs: 1500, action: { type: 'ADD_MEMBER', member: { id: 'cs', name: '김철수', role: '회원' } }, toast: { message: '김철수님이 가입했어요 🎉', type: 'info' } },
      { delayMs: 2400, action: { type: 'ADD_MEMBER', member: { id: 'pjm', name: '박지민', role: '회원' } }, toast: { message: '박지민님이 가입했어요 🎉', type: 'info' } },
      { delayMs: 3300, action: { type: 'ADD_MEMBER', member: { id: 'sj', name: '최수진', role: '회원' } }, toast: { message: '최수진님이 가입했어요 🎉', type: 'info' } },
    ],
  },
  // ── 3. 멤버 관리 — 임원진 부여 ──
  {
    id: 'M-open',
    scene: 'clubHome',
    target: 'ops-members',
    bubble: { content: <>다 모였네요. <strong>[멤버 관리]</strong>를 눌러볼까요?</>, placement: 'bottom' },
    advance: { kind: 'click' },
  },
  {
    id: 'M-role',
    scene: 'membersModal',
    target: 'mem-role',
    overlay: false,
    bubble: {
      content: <>이영희님의 역할 메뉴를 눌러 <strong>부회장</strong>으로 바꿔보세요.</>,
      placement: 'bottom',
    },
    advance: { kind: 'state', when: (s) => s.members.some((m) => m.id === 'yh' && m.role === '부회장') },
    script: [{ delayMs: 0, toast: { message: '역할이 변경되었습니다', type: 'success' } }],
  },
  {
    id: 'M-close',
    scene: 'membersModal',
    target: 'mem-close',
    overlay: false,
    bubble: { content: <>뱃지가 주황색(부회장)으로 바뀌었죠? 닫고 다음으로!</>, placement: 'bottom', align: 'right' },
    advance: { kind: 'click' },
  },
  // ── 4. 그룹 만들고 조 짜기 ──
  {
    id: 'G-nav',
    scene: 'clubHome',
    target: 'ops-groups',
    bubble: { content: <>이번엔 조 편성이에요. <strong>[조 / 그룹 관리]</strong>로 들어가요.</>, placement: 'bottom' },
    advance: { kind: 'click' },
  },
  {
    id: 'G-setname',
    scene: 'groups',
    target: 'grp-set-name',
    bubble: {
      content: <>조 편성은 <strong>그룹세트</strong> 단위로 묶여요. 먼저 세트 이름을 지어요 — 정기모임용이라면 &lsquo;친바&rsquo;라고 적어볼까요?</>,
      placement: 'bottom',
    },
    advance: { kind: 'next', enabledWhen: (s) => s.groupSetName.trim().length > 0 },
  },
  {
    id: 'G-add1',
    scene: 'groups',
    target: 'grp-add',
    bubble: { content: <>[새 조 추가]를 눌러 <strong>1조</strong>를 만들어보세요.</>, placement: 'bottom' },
    advance: { kind: 'click' },
    onComplete: [{ type: 'CREATE_GROUP' }, { type: 'ASSIGN_MEMBER', id: ME_ID, group: 1 }],
  },
  {
    id: 'G-add2',
    scene: 'groups',
    target: 'grp-add',
    bubble: { content: <>한 번 더! <strong>2조</strong>도 만들어요. 조장은 이영희님에게 맡길게요.</>, placement: 'bottom' },
    advance: { kind: 'click' },
    onComplete: [{ type: 'CREATE_GROUP' }, { type: 'ASSIGN_MEMBER', id: 'yh', group: 2 }],
  },
  {
    id: 'G-fill',
    scene: 'groups',
    target: 'grp-fill',
    bubble: { content: <>[멤버 추가]를 눌러 나머지 부원들을 두 조에 나눠 담아요.</>, placement: 'bottom' },
    advance: { kind: 'click' },
    script: [
      { delayMs: 300, action: { type: 'ASSIGN_MEMBER', id: 'cs', group: 1 } },
      { delayMs: 800, action: { type: 'ASSIGN_MEMBER', id: 'pjm', group: 2 } },
      { delayMs: 1300, action: { type: 'ASSIGN_MEMBER', id: 'sj', group: 2 }, toast: { message: '모든 멤버가 배정되었어요', type: 'success' } },
    ],
  },
  {
    id: 'G-save',
    scene: 'groups',
    target: 'grp-save',
    bubble: { content: <>[저장하기]를 누르면 조 편성 완료!</>, placement: 'top' },
    advance: { kind: 'click' },
    onComplete: [{ type: 'SAVE_GROUPS' }],
    script: [{ delayMs: 0, toast: { message: '조 편성이 저장되었습니다', type: 'success' } }],
  },
  {
    id: 'G-set2',
    scene: 'groups',
    target: 'grp-newset',
    bubble: {
      content: <>그룹세트는 여러 개 둘 수 있어요. 같은 멤버로 <strong>&lsquo;스터디&rsquo;용 조</strong>를 따로 짜는 거죠. [새 그룹 생성]을 눌러보세요.</>,
      placement: 'bottom',
    },
    advance: { kind: 'click' },
    script: [
      { delayMs: 400, action: { type: 'CREATE_STUDY_SET' }, toast: { message: "'스터디' 그룹세트가 만들어졌어요", type: 'success' } },
      { delayMs: 1800, toast: { message: '이렇게 목적별로 조 편성을 따로 가질 수 있어요', type: 'info' } },
    ],
  },
  // ── 5. 일정 만들기 ──
  {
    id: 'E-nav',
    scene: 'clubHome',
    target: 'home-create-event',
    bubble: { content: <>준비 끝! 이제 <strong>[일정 잡기]</strong>로 모임을 만들어봐요.</>, placement: 'bottom' },
    advance: { kind: 'click' },
  },
  {
    id: 'E-title',
    scene: 'eventCreate',
    target: 'ev-title',
    bubble: { content: <>모임 이름을 적어주세요.</>, placement: 'bottom' },
    advance: { kind: 'next', enabledWhen: (s) => s.eventTitle.trim().length > 0 },
  },
  {
    id: 'E-dates',
    scene: 'eventCreate',
    target: 'ev-dates',
    bubble: {
      content: <>되는 후보 날짜를 <strong>두 개</strong> 골라보세요 (20·21·22일 중).</>,
      placement: 'top',
    },
    advance: { kind: 'state', when: (s) => s.eventDates.length >= 2 },
  },
  {
    id: 'E-create',
    scene: 'eventCreate',
    target: 'ev-create',
    bubble: { content: <>[만들기]로 일정을 만들어요.</>, placement: 'top' },
    advance: {
      kind: 'click',
      enabledWhen: (s) => s.eventTitle.trim().length > 0 && s.eventDates.length >= 2,
    },
    script: [{ delayMs: 0, toast: { message: '일정이 만들어졌습니다', type: 'success' } }],
  },
  // ── 6. 참가자 입장 — 내 시간 제출 (회장도 참가자!) ──
  {
    id: 'T-upload',
    scene: 'timetable',
    target: 'tt-upload',
    bubble: {
      content: <>회장도 참가자예요. 먼저 MY 탭의 내 시간표에서 <strong>에브리타임 캡처</strong>를 올려두면 AI가 알아서 읽어줘요.</>,
      placement: 'bottom',
      align: 'right',
    },
    advance: { kind: 'click' },
    script: [
      { delayMs: 0, toast: { message: '시간표를 분석하고 있어요...', type: 'info' } },
      { delayMs: 1500, action: { type: 'LOAD_TIMETABLE' }, toast: { message: '수업 4개를 등록했어요', type: 'success' } },
    ],
  },
  {
    id: 'E-import',
    scene: 'eventDetail',
    target: 'ev-import',
    bubble: {
      content: <>일정의 <strong>내 일정</strong> 탭이에요. [내 시간표 불러오기]를 누르면 수업 시간이 자동으로 불가능 처리돼요.</>,
      placement: 'bottom',
    },
    advance: { kind: 'click' },
    onComplete: [{ type: 'IMPORT_TIMETABLE' }],
    script: [{ delayMs: 0, toast: { message: '시간표에서 2개 슬롯을 불러왔습니다', type: 'success' } }],
  },
  {
    id: 'E-paint',
    scene: 'eventDetail',
    target: 'ev-grid',
    bubble: {
      content: <>알바나 약속이 있는 시간은 칸을 눌러 직접 칠해보세요. 빨간색이 안 되는 시간이에요.</>,
      placement: 'top',
    },
    advance: { kind: 'state', when: (s) => s.paintedCells.length >= 1 },
  },
  {
    id: 'E-save',
    scene: 'eventDetail',
    target: 'ev-save',
    bubble: { content: <>[저장하기]를 눌러야 제출됩니다!</>, placement: 'top' },
    advance: { kind: 'click' },
    onComplete: [{ type: 'ADD_SUBMISSION', id: ME_ID }],
    script: [{ delayMs: 0, toast: { message: '저장되었습니다', type: 'success' } }],
  },
  // ── 7. 링크 공유로 제출 모으기 ──
  {
    id: 'E-share',
    scene: 'eventDetail',
    target: 'ev-share',
    bubble: {
      content: <>이제 부원들 차례. 링크 아이콘으로 <strong>일정 링크</strong>를 복사해 보내보세요.</>,
      placement: 'bottom',
      align: 'right',
    },
    advance: { kind: 'click' },
    script: [
      { delayMs: 0, toast: { message: '일정 링크가 복사되었습니다', type: 'success' } },
      { delayMs: 1200, action: { type: 'ADD_SUBMISSION', id: 'yh' }, toast: { message: '이영희님이 시간을 제출했어요', type: 'info' } },
      { delayMs: 2100, action: { type: 'ADD_SUBMISSION', id: 'cs' }, toast: { message: '김철수님이 시간을 제출했어요', type: 'info' } },
      { delayMs: 3000, action: { type: 'ADD_SUBMISSION', id: 'pjm' }, toast: { message: '박지민님이 시간을 제출했어요', type: 'info' } },
      { delayMs: 3900, action: { type: 'ADD_SUBMISSION', id: 'sj' }, toast: { message: '전원 제출 완료! 추천 시간이 나왔어요 ✨', type: 'success' } },
    ],
  },
  // ── 8. 완료 처리 ──
  {
    id: 'E-check',
    scene: 'eventDetail',
    target: 'ev-complete',
    bubble: {
      content: <>모임을 마쳤다면 초록 체크를 눌러 <strong>완료 처리</strong>해보세요.</>,
      placement: 'bottom',
      align: 'right',
    },
    advance: { kind: 'state', when: (s) => s.eventCompleted },
  },
  // ── 9. 기록 작성 ──
  {
    id: 'R-form',
    scene: 'recordForm',
    target: 'rec-form',
    overlay: false,
    bubble: {
      content: <>완료하면 기록 폼이 열려요. 활동 제목과 설명을 적어보세요.</>,
      placement: 'top',
    },
    advance: {
      kind: 'next',
      enabledWhen: (s) => s.record.title.trim().length > 0 && s.record.desc.trim().length > 0,
    },
  },
  {
    id: 'R-save',
    scene: 'recordForm',
    target: 'rec-save',
    overlay: false,
    bubble: { content: <>[기록하기]를 누르면 일정 완료가 확정돼요.</>, placement: 'top' },
    advance: {
      kind: 'click',
      enabledWhen: (s) => s.record.title.trim().length > 0 && s.record.desc.trim().length > 0,
    },
    onComplete: [{ type: 'SAVE_RECORD' }],
    script: [{ delayMs: 0, toast: { message: '활동이 기록되었습니다', type: 'success' } }],
  },
  {
    id: 'R-card',
    scene: 'records',
    target: 'rec-card',
    bubble: {
      content: <>방금 쓴 기록이 기록 탭에 카드로 남았어요. 동아리의 활동 역사이자 회계 메모가 됩니다.</>,
      placement: 'bottom',
    },
    advance: { kind: 'next' },
  },
  // ── 10. 기능 투어 (실제 화면 그대로, 오버레이 없음) ──
  {
    id: 'X-icons',
    scene: 'eventDetail',
    target: 'ev-icons',
    overlay: false,
    bubble: {
      content: <>일정 화면 오른쪽 위 아이콘들이에요. 완료·링크·공유, 그리고 빨간 휴지통은 일정 삭제(만든 사람만).</>,
      placement: 'bottom',
      align: 'right',
    },
    advance: { kind: 'next' },
  },
  {
    id: 'X-panel',
    scene: 'clubHome',
    target: 'ops-response',
    overlay: false,
    bubble: {
      content: <>운영 패널의 <strong>응답 현황</strong> — 누가 아직 시간을 제출 안 했는지 보이고, 이름을 복사해 독촉할 수 있어요. 임원진에게만 보입니다.</>,
      placement: 'top',
    },
    advance: { kind: 'next' },
  },
  {
    id: 'X-gear',
    scene: 'clubHome',
    target: 'club-gear',
    overlay: false,
    bubble: {
      content: <>마지막! 톱니(설정)에는 동아리 이름 변경·초대 코드 재생성·회장 위임·동아리 삭제가 모여 있어요. 이제 진짜 동아리를 만들러 가볼까요?</>,
      placement: 'bottom',
      align: 'right',
    },
    advance: { kind: 'next' },
  },
];
