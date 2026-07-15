/**
 * E2E 테스트용 목 데이터
 */

// 기존 유저 (온보딩 완료)
export const MOCK_USER = {
  id: 1,
  email: 'test@jbnu.ac.kr',
  username: null,
  nickname: '테스트유저',
  dept_code: 'dept_csai',
  school: '전북대학교',
  admission_year: 2021,
  profile_image: null,
  role: 'user',
  user_type: 'student' as const,
  created_at: '2024-01-01T00:00:00',
  keyword_notice_seen_at: null as string | null,
};

// 신규 유저 (온보딩 미완료)
export const MOCK_NEW_USER = {
  id: 2,
  email: 'new@jbnu.ac.kr',
  username: null,
  nickname: '신규유저',
  dept_code: null,
  school: '전북대학교',
  admission_year: null,
  profile_image: null,
  role: 'user',
  user_type: 'student' as const,
  created_at: '2024-06-01T00:00:00',
  keyword_notice_seen_at: null,
};

// 공지사항 목록
export const MOCK_NOTICES = {
  items: [
    {
      id: 1,
      title: '[중요] 2024학년도 2학기 수강신청 안내',
      link: 'https://www.jbnu.ac.kr/notice/1',
      date: new Date().toISOString().split('T')[0],
      board_code: 'home_campus',
      created_at: new Date().toISOString(),
      is_read: false,
      view: 150,
      is_favorite: false,
      matched_keywords: [],
    },
    {
      id: 2,
      title: '2024학년도 장학금 신청 안내',
      link: 'https://www.jbnu.ac.kr/notice/2',
      date: new Date().toISOString().split('T')[0],
      board_code: 'home_student',
      created_at: new Date().toISOString(),
      is_read: true,
      view: 230,
      is_favorite: true,
      favorite_created_at: new Date().toISOString(),
      matched_keywords: [],
    },
    {
      id: 3,
      title: 'SW중심대학사업단 특강 개최',
      link: 'https://www.jbnu.ac.kr/notice/3',
      date: '2024-06-01',
      board_code: 'agency_sw',
      created_at: '2024-06-01T09:00:00',
      is_read: false,
      view: 80,
      is_favorite: false,
      matched_keywords: ['특강'],
    },
    {
      id: 4,
      title: '도서관 개관시간 변경 안내',
      link: 'https://www.jbnu.ac.kr/notice/4',
      date: '2024-05-15',
      board_code: 'home_library',
      created_at: '2024-05-15T10:00:00',
      is_read: true,
      view: 45,
      is_favorite: false,
      matched_keywords: [],
    },
    {
      id: 5,
      title: '컴퓨터인공지능학부 졸업요건 안내',
      link: 'https://www.jbnu.ac.kr/notice/5',
      date: '2024-05-10',
      board_code: 'dept_csai',
      created_at: '2024-05-10T14:00:00',
      is_read: false,
      view: 120,
      is_favorite: true,
      favorite_created_at: '2024-05-10T15:00:00',
      matched_keywords: ['졸업'],
    },
  ],
  next_cursor: null,
  has_next: false,
};

// 키워드 목록
export const MOCK_KEYWORDS = [
  { id: 1, keyword: '장학금', created_at: '2024-01-15T00:00:00' },
  { id: 2, keyword: '수강신청', created_at: '2024-02-01T00:00:00' },
];

// 키워드 공지 목록
export const MOCK_KEYWORD_NOTICES = [
  {
    id: 101,
    title: '2024학년도 성적우수 장학금 안내',
    link: 'https://www.jbnu.ac.kr/notice/101',
    date: new Date().toISOString().split('T')[0],
    board_code: 'home_student',
    created_at: new Date().toISOString(),
    is_read: false,
    view: 50,
    is_favorite: false,
    matched_keywords: ['장학금'],
  },
  {
    id: 102,
    title: '수강신청 일정 변경 공지',
    link: 'https://www.jbnu.ac.kr/notice/102',
    date: '2024-06-01',
    board_code: 'home_campus',
    created_at: '2024-06-01T08:00:00',
    is_read: true,
    view: 200,
    is_favorite: false,
    matched_keywords: ['수강신청'],
  },
];

// 구독 목록
export const MOCK_SUBSCRIPTIONS = [
  { id: 1, board_code: 'home_campus' },
  { id: 2, board_code: 'home_student' },
  { id: 3, board_code: 'dept_csai' },
  { id: 4, board_code: 'agency_sw' },
];

// 친바 이벤트 목록
export const MOCK_CHINBA_EVENTS = [
  {
    event_id: 'evt-001',
    title: '조별과제 회의',
    dates: ['2024-07-10', '2024-07-11', '2024-07-12'],
    status: 'active' as const,
    creator_id: 1,
    creator_nickname: '테스트유저',
    participant_count: 3,
    submitted_count: 2,
    my_submitted: true,
    created_at: '2024-07-01T10:00:00',
  },
];

export const MOCK_TEAMS = {
  teams: [
    {
      id: 1,
      name: '테스트 동아리',
      category: 'study',
      member_count: 3,
      my_role: 'captain' as const,
      status: 'active' as const,
      is_paid: false,
      created_at: '2024-07-01T10:00:00',
    },
  ],
};

// 친바 이벤트 상세
export const MOCK_CHINBA_EVENT_DETAIL = {
  event_id: 'evt-001',
  title: '조별과제 회의',
  dates: ['2024-07-10', '2024-07-11', '2024-07-12'],
  start_hour: 9,
  end_hour: 24,
  status: 'active' as const,
  creator_id: 1,
  creator_nickname: '테스트유저',
  participants: [
    { user_id: 1, nickname: '테스트유저', has_submitted: true },
    { user_id: 2, nickname: '참여자2', has_submitted: true },
    { user_id: 3, nickname: '참여자3', has_submitted: false },
  ],
  heatmap: [],
  recommended_times: [],
  created_at: '2024-07-01T10:00:00',
};

// 친바 내 참여 정보
export const MOCK_CHINBA_MY_PARTICIPATION = {
  has_submitted: true,
  unavailable_slots: [],
};

// 저장 그룹
export const MOCK_BOARD_GROUPS = [
  {
    id: 1,
    name: '학교 공지',
    board_codes: ['home_campus', 'home_student'],
    created_at: '2024-01-01T00:00:00',
    updated_at: '2024-01-01T00:00:00',
  },
];

// 학과 목록
export const MOCK_DEPARTMENTS = [
  { dept_code: 'dept_csai', dept_name: '컴퓨터인공지능학부', college_name: '공과대학' },
  { dept_code: 'dept_electronics', dept_name: '전자공학부', college_name: '공과대학' },
  { dept_code: 'dept_software', dept_name: '소프트웨어공학과', college_name: '공과대학' },
];

// 유저 통계
export const MOCK_USER_STATS = {
  total_users: 1234,
  school: '전북대학교',
  updated_at: new Date().toISOString(),
};

// 시간표 데이터
export const MOCK_TIMETABLE = null; // 시간표 미등록 상태

// 커리어 프로필
export const MOCK_CAREER = {
  user_id: 1,
  contact: { name: null, email: null, phone: null },
  educations: [],
  works: [],
  skills: [],
  certifications: [],
  activities: [],
  mentor_qna: null,
};
