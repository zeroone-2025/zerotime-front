// 공지사항 관련 타입 정의

export interface Notice {
    id: number;
    title: string;
    link: string;
    date: string;
    board_code: string; // 게시판 코드
    created_at: string; // 데이터 수집 시각
    is_read: boolean; // 읽음 여부
    view: number; // 조회수
    is_favorite: boolean; // 즐겨찾기 여부
    favorite_created_at?: string | null; // 즐겨찾기 추가 시각
    matched_keywords?: string[]; // 매칭된 키워드 목록
}

// 무한 스크롤 응답 타입
export interface NoticeListResponse {
    items: Notice[];
    next_cursor: string | null;
    has_next: boolean;
    total_count?: number | null; // 전체 결과 개수 (검색 응답에서만 채워짐)
}

// 공지사항 읽음 처리 응답
export interface MarkAsReadResponse {
    message: string;
    notice_id: number;
    is_read: boolean;
}

// 공지사항 즐겨찾기 토글 응답
export interface ToggleFavoriteResponse {
    message: string;
    notice_id: number;
    is_favorite: boolean;
}

// 공지사항 조회수 증가 응답
export interface IncrementViewResponse {
    notice_id: number;
    view: number;
    user_view_count: number;
    message: string;
}
