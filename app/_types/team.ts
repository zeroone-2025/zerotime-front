export type TeamRole = 'captain' | 'executive' | 'member'
export type TeamStatus = 'active' | 'archived'

export interface Team {
  id: number
  name: string
  description: string | null
  category: string | null
  invite_code: string | null
  member_count: number
  my_role: TeamRole
  status: TeamStatus
  created_at: string
}

export interface TeamListItem {
  id: number
  name: string
  category: string | null
  member_count: number
  my_role: TeamRole
  status: TeamStatus
  is_paid: boolean
  created_at: string
}

export interface TeamDetail {
  id: number
  name: string
  description: string | null
  category: string | null
  member_count: number
  my_role: TeamRole
  my_group: { id: number; name: string; is_leader: boolean } | null
  invite_code: string | null
  status: TeamStatus
  is_paid: boolean
  trial_used: boolean
  subscription: {
    tier: string
    billing_cycle: string
    status: string
    expires_at: string
  } | null
  created_at: string
}

export interface TeamMember {
  id: number
  user_id: number
  nickname: string | null
  profile_image: string | null
  role: TeamRole
  group: { id: number; name: string; is_leader: boolean } | null
  joined_at: string
}

export interface TeamMemberListResponse {
  members: TeamMember[]
  total: number
}

export interface TeamCreateRequest {
  name: string
  description?: string
  category?: string
}

export interface TeamUpdateRequest {
  name?: string
  description?: string
  category?: string
}

export interface JoinTeamRequest {
  invite_code: string
}

export interface JoinTeamResponse {
  team_id: number
  team_name: string
  my_role: TeamRole
  message: string
}

export interface InvitationInfo {
  invite_code: string
  invite_url: string
  is_active: boolean
  created_at: string
  expires_at: string | null
}

export interface CaptainTransferRequest {
  new_captain_member_id: number
}

// ==================== Group Types ====================

export interface GroupMember {
  member_id: number
  user_id: number
  nickname: string | null
  profile_image: string | null
  is_leader: boolean
}

export interface Group {
  id: number
  name: string
  display_order: number
  member_count: number
  leader: { member_id: number; nickname: string } | null
  members?: GroupMember[]
  group_set_id: number | null
}

export interface GroupsListResponse {
  groups: Group[]
  unassigned_members: { member_id: number; nickname: string }[]
}

export interface GroupMemberInput {
  member_id: number
  is_leader: boolean
}

export interface GroupInput {
  name: string
  display_order: number
  members: GroupMemberInput[]
}

export interface GroupsSaveRequest {
  groups: GroupInput[]
  group_set_id?: number
}

export interface GroupParseRequest {
  text: string
  group_set_id?: number
}

export interface ParsedGroupMember {
  nickname: string
  matched_member_id: number | null
  is_leader: boolean
  confidence: number
}

export interface ParsedGroup {
  name: string
  members: ParsedGroupMember[]
}

export interface GroupParseResponse {
  parsed_groups: ParsedGroup[]
  unmatched_names: string[]
  unassigned_members: { member_id: number; nickname: string }[]
}

// ==================== GroupSet Types ====================

export interface GroupSet {
  id: number
  name: string
  display_order: number
  group_count: number
  groups: Group[]
}

export interface GroupSetsListResponse {
  group_sets: GroupSet[]
}

export interface GroupSetCreateRequest {
  name: string
}

// ==================== Event Category Types ====================

export interface EventCategory {
  id: number
  name: string
  display_order: number
}

export interface EventCategoriesListResponse {
  categories: EventCategory[]
}

export interface EventCategoryCreateRequest {
  name: string
}

/** 이벤트·활동 응답에 임베드되는 축약형 */
export interface EventCategoryRef {
  id: number
  name: string
}

// ==================== Subscription Types ====================

export interface TierInfo {
  tier: string
  member_range: string
  monthly_price: number
  semester_price: number
  annual_price: number
}

export interface SubscriptionDetail {
  team_id: number
  member_count: number
  tier: string | null
  tier_label: string | null
  billing_cycle: string | null
  amount: number | null
  status: string | null
  started_at: string | null
  expires_at: string | null
  trial_used: boolean
  available_tiers: TierInfo[]
}

export interface SubscriptionCreateRequest {
  billing_cycle: 'monthly' | 'semester' | 'annual'
}

export interface SubscriptionCreateResponse {
  subscription_id: number
  tier: string
  billing_cycle: string
  amount: number
  status: string
  started_at: string
  expires_at: string
}

// ==================== Team Events Types ====================

export interface TeamEvent {
  event_id: string
  title: string
  dates: string[]
  status: string
  team_id: number
  target_groups: { id: number; name: string }[]
  category: EventCategoryRef | null
  total_participants: number
  submitted_count: number
  created_at: string
}

export interface TeamEventCreateRequest {
  title: string
  dates: string[]
  target_group_ids?: number[]
  category_id?: number
}

export interface TeamEventListResponse {
  events: TeamEvent[]
  total: number
}

export interface TeamEventDetail {
  event_id: string
  title: string
  dates: string[]
  start_hour: number
  end_hour: number
  status: string
  creator_id: number
  creator_nickname: string | null
  team_id: number
  target_groups: { id: number; name: string }[]
  category: EventCategoryRef | null
  participants: {
    user_id: number
    nickname: string | null
    has_submitted: boolean
  }[]
  heatmap: {
    dt: string
    unavailable_count: number
    unavailable_members: string[]
  }[]
  recommended_times: {
    date: string
    start_time: string
    end_time: string
    available_count: number
    all_available: boolean
  }[]
  my_role: string
  created_at: string
}

export interface TimetableEntry {
  user_id: number
  nickname: string | null
  group_name: string | null
  is_leader: boolean
  semester: string
  classes: {
    name: string
    professor: string | null
    location: string | null
    day: number
    start_time: string
    end_time: string
  }[]
}

// ==================== Activity Types ====================

export interface ActivityScore {
  group_id: number
  group_name: string
  score: number
}

export interface ActivityRecorder {
  user_id: number
  nickname: string | null
  role_badge: string
}

export interface Activity {
  id: number
  title: string
  description: string | null
  highlight: string | null
  activity_date: string
  start_time: string | null
  end_time: string | null
  photo_urls: string[] | null
  category: EventCategoryRef | null
  recorder: ActivityRecorder
  scores: ActivityScore[]
  created_at: string
}

export interface ActivityCreateRequest {
  title: string
  description?: string
  highlight?: string
  activity_date: string
  start_time?: string
  end_time?: string
  photo_urls?: string[]
  scores?: { group_id: number; score: number }[]
  category_id?: number | null
}

export interface ActivityUpdateRequest {
  title?: string
  description?: string
  highlight?: string
  activity_date?: string
  start_time?: string
  end_time?: string
  photo_urls?: string[]
  scores?: { group_id: number; score: number }[]
  category_id?: number | null
}

export interface ActivityListResponse {
  activities: Activity[]
  total: number
}

// ==================== Rankings Types ====================

export interface RankingItem {
  rank: number
  group_id: number
  group_name: string
  total_score: number
  activity_count: number
  rank_change: number
}

export interface RankingsResponse {
  period: string
  rankings: RankingItem[]
}

export interface TrendDataPoint {
  label: string
  cumulative_score: number
}

export interface TrendSeries {
  group_id: number
  group_name: string
  data_points: TrendDataPoint[]
}

export interface TrendResponse {
  period: string
  interval: string
  series: TrendSeries[]
}

export interface GroupRankingDetail {
  group_id: number
  group_name: string
  total_score: number
  activity_count: number
  current_rank: number
  score_history: { activity_id: number; title: string; activity_date: string; score: number }[]
  member_participation: { member_id: number; nickname: string; is_leader: boolean; participation_count: number; total_activities: number }[]
}

export interface MyRanking {
  user_id: number
  nickname: string | null
  group: { id: number; name: string; current_rank: number; total_score: number } | null
  my_participation_count: number
  total_activities: number
}

export interface MemberRankingItem {
  member_id: number
  nickname: string | null
  group_name: string | null
  participation_count: number
  total_activities: number
  participation_rate: number
}

export interface MembersRankingResponse {
  members: MemberRankingItem[]
}
