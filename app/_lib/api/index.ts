// API 모듈 통합 export
// 이 파일을 통해 모든 API 함수를 import 할 수 있습니다

// Client
export { default as api, API_BASE_URL, authApi } from './client';

// Notices
export * from './notices';

// Keywords
export * from './keywords';

// Auth
export * from './auth';

// User
export * from './user';

// Board groups
export * from './boardGroups';

// Boards
export * from './boards';

// Departments
export * from './departments';

// Timetable
export * from './timetable';

// Career
export * from './career';

// Chinba
export * from './chinba';

// Subscriptions
export * from './subscriptions';

// Activities
export * from './activities';

// Types re-export for convenience
export type { Notice, NoticeListResponse } from '@/_types/notice';
export type { Keyword } from '@/_types/keyword';
export type { UserProfile, UserSubscription, OnboardingRequest } from '@/_types/user';
export type { Department, DepartmentSearchResponse } from '@/_types/department';
export type { TimetableData, TimetableClass, TimetableAnalysisResponse } from '@/_types/timetable';
export type { CareerProfile } from '@/_types/career';
