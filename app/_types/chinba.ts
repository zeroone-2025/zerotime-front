export interface ChinbaParticipantInfo {
  user_id: number;
  nickname: string | null;
  has_submitted: boolean;
}

export interface ChinbaHeatmapSlot {
  dt: string; // ISO 8601
  unavailable_count: number;
  unavailable_members: string[];
}

export interface ChinbaRecommendedTime {
  date: string;
  start_time: string;
  end_time: string;
  available_count: number;
  all_available: boolean;
}

export interface ChinbaEventDetail {
  event_id: string;
  title: string;
  dates: string[];
  start_hour: number;
  end_hour: number;
  status: 'active' | 'completed' | 'expired';
  creator_id: number;
  creator_nickname: string | null;
  category: { id: number; name: string } | null;
  participants: ChinbaParticipantInfo[];
  heatmap: ChinbaHeatmapSlot[];
  recommended_times: ChinbaRecommendedTime[];
  created_at: string;
  // 동아리(팀) 일정 여부 — 개인 친바는 null
  team_id: number | null;
  team_name: string | null;
  // false면 동아리 일정인데 아직 멤버가 아니라는 뜻 — participants·heatmap이 비어 오고
  // 가입 확인 화면(TeamJoinGate)을 띄운다
  is_team_member: boolean;
}

export interface ChinbaEventTeamJoinResponse {
  team_id: number;
  team_name: string;
  my_role: string;
  already_member: boolean;
  message: string;
}

export interface ChinbaMyParticipation {
  has_submitted: boolean;
  unavailable_slots: string[];
}

export interface ChinbaEventListItem {
  event_id: string;
  title: string;
  dates: string[];
  status: 'active' | 'completed' | 'expired';
  /** 동아리 일정이면 팀 id, 개인(동아리 없이 잡은) 일정이면 null */
  team_id: number | null;
  creator_id: number;
  creator_nickname: string | null;
  participant_count: number;
  submitted_count: number;
  my_submitted: boolean;
  created_at: string;
}

export interface ChinbaEventCreateRequest {
  title: string;
  dates: string[];
}

export interface ChinbaEventCreateResponse {
  event_id: string;
}

export interface ChinbaUnavailabilityUpdateRequest {
  unavailable_slots: string[];
}
