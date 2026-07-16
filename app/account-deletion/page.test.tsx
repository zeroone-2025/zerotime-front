import { render, screen } from '@testing-library/react';
import AccountDeletionPage from './page';


describe('AccountDeletionPage rollback', () => {
  it('routes account deletion back to the profile flow', () => {
    render(<AccountDeletionPage />);

    expect(screen.getByRole('heading', { name: '회원 탈퇴' })).toBeVisible();
    expect(screen.getByRole('link', { name: '프로필로 이동' })).toHaveAttribute('href', '/profile/');
  });
});
