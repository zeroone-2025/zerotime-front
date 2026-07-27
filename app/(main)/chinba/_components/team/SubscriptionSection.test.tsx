import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { useSubscription } from '@/_lib/hooks/useSubscription';

import SubscriptionSection from './SubscriptionSection';

vi.mock('@/_lib/hooks/useSubscription', () => ({
  useSubscription: vi.fn(),
  useCreateSubscription: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCancelSubscription: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('@/_context/ToastContext', () => ({ useToast: () => ({ showToast: vi.fn() }) }));

const mockedUseSubscription = vi.mocked(useSubscription);

const TIER = {
  tier: 'standard',
  tier_label: '스탠다드',
  member_range: '1-40명',
  monthly_price: 9900,
  semester_price: 35000,
  annual_price: 99000,
};

const subscriptionData = (status: string | null) => ({
  status,
  tier: 'standard',
  tier_label: '스탠다드',
  billing_cycle: status ? 'monthly' : null,
  amount: status ? 9900 : null,
  started_at: status ? '2026-07-01T00:00:00' : null,
  expires_at: status ? '2026-08-01T00:00:00' : null,
  member_count: 12,
  available_tiers: [TIER],
});

const setSubscription = (status: string | null) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockedUseSubscription.mockReturnValue({ data: subscriptionData(status), isLoading: false } as any);
};

describe('SubscriptionSection 관리 권한', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('구독 중 + 관리 권한 없음 → 상태는 보이되 해지 버튼이 없다', () => {
    setSubscription('active');
    render(<SubscriptionSection teamId={1} canManage={false} />);

    expect(screen.getByText('구독 중')).toBeInTheDocument();
    expect(screen.queryByText('구독 해지')).not.toBeInTheDocument();
  });

  it('구독 중 + 관리 권한 있음 → 해지 버튼이 있다', () => {
    setSubscription('active');
    render(<SubscriptionSection teamId={1} canManage={true} />);

    expect(screen.getByText('구독 해지')).toBeInTheDocument();
  });

  it('미구독 + 관리 권한 없음 → 섹션 자체가 렌더되지 않는다', () => {
    setSubscription(null);
    const { container } = render(<SubscriptionSection teamId={1} canManage={false} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('미구독 + 관리 권한 있음 → 구독하기 버튼이 있다', () => {
    setSubscription(null);
    render(<SubscriptionSection teamId={1} canManage={true} />);

    expect(screen.getByText('구독하기')).toBeInTheDocument();
  });

  it('해지 예정 상태는 관리 권한이 없어도 계속 보인다', () => {
    setSubscription('cancelled');
    render(<SubscriptionSection teamId={1} canManage={false} />);

    expect(screen.getByText('해지 예정')).toBeInTheDocument();
    expect(screen.queryByText('구독 해지')).not.toBeInTheDocument();
  });
});
