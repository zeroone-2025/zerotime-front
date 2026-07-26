import type { ReactNode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { useDeleteTeam } from './useTeam';

const mocks = vi.hoisted(() => ({
  deleteTeam: vi.fn(),
}));

vi.mock('@/_lib/api/teams', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/_lib/api/teams')>();
  return {
    ...actual,
    deleteTeam: mocks.deleteTeam,
  };
});

describe('useDeleteTeam', () => {
  it('삭제 성공 시 목록 캐시에서 해당 팀을 즉시 제거하고 상세 캐시를 지운다', async () => {
    mocks.deleteTeam.mockResolvedValue({ message: 'ok' });

    const qc = new QueryClient();
    const teamA = { id: 1, name: '동아리A' };
    const teamB = { id: 2, name: '동아리B' };
    qc.setQueryData(['teams'], { teams: [teamA, teamB] });
    qc.setQueryData(['teams', 1], { id: 1, name: '동아리A' });

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useDeleteTeam(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(1);
    });

    expect(mocks.deleteTeam).toHaveBeenCalledWith(1);
    // 재조회를 기다리지 않고도 낡은 목록으로 삭제된 팀에 재진입하지 않아야 한다
    expect(qc.getQueryData(['teams'])).toEqual({ teams: [teamB] });
    expect(qc.getQueryData(['teams', 1])).toBeUndefined();
  });
});
