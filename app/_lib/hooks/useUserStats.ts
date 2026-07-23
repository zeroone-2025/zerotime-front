import { useQuery } from '@tanstack/react-query';
import { getUserStats } from '@/_lib/api/stats';

export function useUserStats(school?: string) {
    return useQuery({
        queryKey: ['stats', 'users', school],
        queryFn: () => getUserStats(school),
        staleTime: 1000 * 60 * 60, // 1시간 캐시
        refetchOnMount: false,
    });
}
