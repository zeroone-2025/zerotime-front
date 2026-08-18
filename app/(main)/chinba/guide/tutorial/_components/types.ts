import type { ReactNode } from 'react';

export type SceneId =
  | 'createClub' // 동아리 만들기 풀페이지
  | 'clubHome' // 동아리 상세(탭+운영 패널)
  | 'membersModal' // 동아리 상세 위 멤버 관리 모달
  | 'groups' // 조 편성 풀페이지
  | 'eventCreate' // 일정 잡기 풀페이지
  | 'timetable' // MY 탭 내 시간표
  | 'eventDetail' // 일정 상세(전체/내 일정 탭)
  | 'recordForm' // 동아리 상세(기록 탭) 위 기록 폼 모달
  | 'records'; // 동아리 상세 기록 탭

export type MemberRole = '회장' | '부회장' | '운영진' | '회원';

export interface TutorialMember {
  id: string;
  name: string;
  role: MemberRole;
}

/** 튜토리얼 전체 가짜 데이터 — API 없이 useReducer로만 굴린다 */
export interface TutorialState {
  clubName: string;
  category: string | null;
  members: TutorialMember[];
  groupSetName: string; // 그룹세트 이름 (예: 친바)
  groupsCreated: number; // 만든 조 수 (0~2)
  group1Ids: string[]; // 1조 멤버 (첫 번째 = 조장)
  group2Ids: string[]; // 2조 멤버 (첫 번째 = 조장)
  groupSaved: boolean;
  studySetCreated: boolean; // 두 번째 그룹세트(스터디) 생성 연출 완료
  eventTitle: string;
  eventDates: number[]; // 달력 day 숫자
  submissions: string[]; // 시간을 제출한 memberId
  eventCompleted: boolean;
  record: { title: string; desc: string; amount: string };
  savedRecord: boolean;
  timetableLoaded: boolean; // 부원: AI 분석 완료
  importedTimetable: boolean; // 부원: 내 시간표 불러오기 완료
  paintedCells: string[]; // 부원: 직접 칠한 셀 key ("row-col")
}

export type TutorialAction =
  | { type: 'SET_CLUB_NAME'; value: string }
  | { type: 'SET_CATEGORY'; value: string }
  | { type: 'ADD_MEMBER'; member: TutorialMember }
  | { type: 'SET_ROLE'; id: string; role: MemberRole }
  | { type: 'SET_GROUP_SET_NAME'; value: string }
  | { type: 'CREATE_GROUP' }
  | { type: 'ASSIGN_MEMBER'; id: string; group: 1 | 2 }
  | { type: 'SAVE_GROUPS' }
  | { type: 'CREATE_STUDY_SET' }
  | { type: 'SET_EVENT_TITLE'; value: string }
  | { type: 'TOGGLE_DATE'; day: number }
  | { type: 'ADD_SUBMISSION'; id: string }
  | { type: 'COMPLETE_EVENT' }
  | { type: 'SET_RECORD'; patch: Partial<TutorialState['record']> }
  | { type: 'SAVE_RECORD' }
  | { type: 'LOAD_TIMETABLE' }
  | { type: 'IMPORT_TIMETABLE' }
  | { type: 'TOGGLE_CELL'; key: string }
  | { type: 'RESET' };

/** 스텝 진행 방식 */
export type Advance =
  | { kind: 'click'; enabledWhen?: (s: TutorialState) => boolean } // 대상 클릭으로 완료
  | { kind: 'next'; enabledWhen?: (s: TutorialState) => boolean } // 말풍선 [다음] 버튼으로 완료
  | { kind: 'auto' } // onEnter script가 끝나면 자동 완료
  | { kind: 'state'; when: (s: TutorialState) => boolean }; // 상태 조건 충족 시 자동 완료

/** 연출 항목 — 스텝 진입(또는 완료) 후 delayMs 시점에 실행 */
export interface ScriptItem {
  delayMs: number; // 스크립트 시작 기준 절대 지연
  action?: TutorialAction;
  toast?: { message: string; type: 'success' | 'info' };
}

export interface TutorialStep {
  id: string;
  scene: SceneId;
  /** TutorialTarget id — null이면 스포트라이트 대상 없음(모달 스텝 등) */
  target: string | null;
  /** align: 'right'는 화면 오른쪽 끝 대상용 — 말풍선 오른쪽 모서리를 대상에 맞춘다 */
  bubble: {
    content: ReactNode;
    placement: 'top' | 'bottom' | 'left' | 'right';
    align?: 'center' | 'right';
  } | null;
  advance: Advance;
  /** false면 어두운 스포트라이트 오버레이를 끈다 (기능 설명 투어처럼 실제 화면을 그대로 보여줄 때) */
  overlay?: boolean;
  /** 완료 즉시 디스패치할 액션들 */
  onComplete?: TutorialAction[];
  /** 연출 스크립트. advance='auto'면 진입 시, 그 외엔 완료 직후 실행 후 다음 스텝으로 */
  script?: ScriptItem[];
}
