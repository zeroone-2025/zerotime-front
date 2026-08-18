import type { TutorialAction, TutorialState } from './types';

export const ME_ID = 'me';

export const initialTutorialState: TutorialState = {
  clubName: '',
  category: null,
  members: [],
  groupSetName: '',
  groupsCreated: 0,
  group1Ids: [],
  group2Ids: [],
  groupSaved: false,
  studySetCreated: false,
  eventTitle: '',
  eventDates: [],
  submissions: [],
  eventCompleted: false,
  record: { title: '', desc: '', amount: '' },
  savedRecord: false,
  timetableLoaded: false,
  importedTimetable: false,
  paintedCells: [],
};

export function tutorialReducer(state: TutorialState, action: TutorialAction): TutorialState {
  switch (action.type) {
    case 'SET_CLUB_NAME':
      return { ...state, clubName: action.value };
    case 'SET_CATEGORY':
      return { ...state, category: action.value };
    case 'ADD_MEMBER':
      if (state.members.some((m) => m.id === action.member.id)) return state;
      return { ...state, members: [...state.members, action.member] };
    case 'SET_ROLE':
      return {
        ...state,
        members: state.members.map((m) => (m.id === action.id ? { ...m, role: action.role } : m)),
      };
    case 'SET_GROUP_SET_NAME':
      return { ...state, groupSetName: action.value };
    case 'CREATE_GROUP':
      return { ...state, groupsCreated: Math.min(state.groupsCreated + 1, 2) };
    case 'ASSIGN_MEMBER': {
      if (state.group1Ids.includes(action.id) || state.group2Ids.includes(action.id)) return state;
      return action.group === 1
        ? { ...state, group1Ids: [...state.group1Ids, action.id] }
        : { ...state, group2Ids: [...state.group2Ids, action.id] };
    }
    case 'SAVE_GROUPS':
      return { ...state, groupSaved: true };
    case 'CREATE_STUDY_SET':
      return { ...state, studySetCreated: true };
    case 'SET_EVENT_TITLE':
      return { ...state, eventTitle: action.value };
    case 'TOGGLE_DATE':
      return {
        ...state,
        eventDates: state.eventDates.includes(action.day)
          ? state.eventDates.filter((d) => d !== action.day)
          : [...state.eventDates, action.day].sort((a, b) => a - b),
      };
    case 'ADD_SUBMISSION':
      if (state.submissions.includes(action.id)) return state;
      return { ...state, submissions: [...state.submissions, action.id] };
    case 'COMPLETE_EVENT':
      return { ...state, eventCompleted: true };
    case 'SET_RECORD':
      return { ...state, record: { ...state.record, ...action.patch } };
    case 'SAVE_RECORD':
      return { ...state, savedRecord: true };
    case 'LOAD_TIMETABLE':
      return { ...state, timetableLoaded: true };
    case 'IMPORT_TIMETABLE':
      return { ...state, importedTimetable: true };
    case 'TOGGLE_CELL':
      return {
        ...state,
        paintedCells: state.paintedCells.includes(action.key)
          ? state.paintedCells.filter((k) => k !== action.key)
          : [...state.paintedCells, action.key],
      };
    case 'RESET':
      return initialTutorialState;
    default:
      return state;
  }
}
