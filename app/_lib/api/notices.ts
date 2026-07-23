import api from './client';
import type {
    Notice,
    NoticeListResponse,
    MarkAsReadResponse,
    ToggleFavoriteResponse,
    IncrementViewResponse,
} from '@/_types/notice';

// 공지사항 조회 (페이지네이션)
export const fetchNotices = async (
    page: number = 0,
    limit: number = 20,
    includeRead: boolean = false,
) => {
    const response = await api.get<Notice[]>('/notices', {
        params: {
            skip: page * limit,
            limit,
            include_read: includeRead,
        },
    });
    return response.data;
};

// 무한 스크롤용 공지사항 조회 (커서 기반)
export const fetchNoticesInfinite = async (
    cursor: string | null = null,
    limit: number = 20,
    includeRead: boolean = true,
    boardCodes?: string[],
    onlyFavorite?: boolean,
) => {
    const response = await api.get<NoticeListResponse>('/notices', {
        params: {
            cursor: cursor ?? undefined,
            limit,
            include_read: includeRead,
            board_codes: boardCodes && boardCodes.length > 0 ? boardCodes.join(',') : undefined,
            only_favorite: onlyFavorite ? true : undefined,
        },
    });
    return response.data;
};

// 공지사항 제목 검색 (커서 기반)
// 검색 범위: 교내공지(home_campus)는 항상 포함 + 구독 게시판(boardCodes).
//   로그인 사용자는 서버 구독 목록을 기준으로 하므로 boardCodes는 비로그인(게스트)용이다.
// 기간: 백엔드가 오늘 기준 최근 5년 이내로 제한한다.
export const searchNotices = async (
    query: string,
    cursor: string | null = null,
    limit: number = 20,
    boardCodes?: string[],
) => {
    const response = await api.get<NoticeListResponse>('/notices/search', {
        params: {
            q: query,
            cursor: cursor ?? undefined,
            limit,
            board_codes: boardCodes && boardCodes.length > 0 ? boardCodes.join(',') : undefined,
        },
    });
    return response.data;
};

// 수동 크롤링 트리거
export const triggerCrawl = async () => {
    return api.post('/notices/crawl');
};

// 공지사항 읽음 처리
export const markNoticeAsRead = async (noticeId: number) => {
    const response = await api.post<MarkAsReadResponse>(`/notices/${noticeId}/read`);
    return response.data;
};

// 공지사항 즐겨찾기 토글
export const toggleNoticeFavorite = async (noticeId: number) => {
    const response = await api.post<ToggleFavoriteResponse>(`/notices/${noticeId}/favorite`);
    return response.data;
};

// 공지사항 조회수 증가
export const incrementNoticeView = async (noticeId: number) => {
    const response = await api.post<IncrementViewResponse>(`/notices/${noticeId}/increment-view`);
    return response.data;
};

// DB 데이터 전체 초기화 (관리자용)
export const resetNotices = async () => {
    return api.delete('/notices/reset');
};
