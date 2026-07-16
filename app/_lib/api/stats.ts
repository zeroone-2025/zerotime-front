import api from './client';

export interface UserStats {
    total_users: number;
    school: string;
    updated_at: string;
}

export const getUserStats = async (school?: string) => {
    const response = await api.get<UserStats>('/stats/users', {
        params: school ? { school } : {},
    });
    return response.data;
};

export interface TeamStats {
    total_teams: number;
    updated_at: string;
}

export const getTeamStats = async () => {
    const response = await api.get<TeamStats>('/stats/teams');
    return response.data;
};
