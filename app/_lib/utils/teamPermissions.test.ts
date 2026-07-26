import { describe, it, expect } from 'vitest';
import {
  canEditTeam,
  canDeleteTeam,
  canRemoveMember,
  canChangeRole,
  canChangeRoleOf,
  canViewInvitation,
  canRegenerateInvitation,
  canTransferCaptain,
  canManageSubscription,
} from './teamPermissions';

describe('canEditTeam', () => {
  it('captain can edit team', () => {
    expect(canEditTeam('captain')).toBe(true);
  });

  it('vice_captain can edit team', () => {
    expect(canEditTeam('vice_captain')).toBe(true);
  });

  it('executive can edit team', () => {
    expect(canEditTeam('executive')).toBe(true);
  });

  it('member cannot edit team', () => {
    expect(canEditTeam('member')).toBe(false);
  });
});

describe('canDeleteTeam', () => {
  it('captain can delete team', () => {
    expect(canDeleteTeam('captain')).toBe(true);
  });

  it('vice_captain can delete team', () => {
    expect(canDeleteTeam('vice_captain')).toBe(true);
  });

  it('executive cannot delete team', () => {
    expect(canDeleteTeam('executive')).toBe(false);
  });

  it('member cannot delete team', () => {
    expect(canDeleteTeam('member')).toBe(false);
  });
});

describe('canRemoveMember', () => {
  it('captain can remove executive', () => {
    expect(canRemoveMember('captain', 'executive')).toBe(true);
  });

  it('captain can remove member', () => {
    expect(canRemoveMember('captain', 'member')).toBe(true);
  });

  it('captain cannot remove captain', () => {
    expect(canRemoveMember('captain', 'captain')).toBe(false);
  });

  it('captain can remove vice_captain', () => {
    expect(canRemoveMember('captain', 'vice_captain')).toBe(true);
  });

  it('vice_captain can remove vice_captain, executive, member', () => {
    expect(canRemoveMember('vice_captain', 'vice_captain')).toBe(true);
    expect(canRemoveMember('vice_captain', 'executive')).toBe(true);
    expect(canRemoveMember('vice_captain', 'member')).toBe(true);
  });

  it('vice_captain cannot remove captain', () => {
    expect(canRemoveMember('vice_captain', 'captain')).toBe(false);
  });

  it('executive can remove member', () => {
    expect(canRemoveMember('executive', 'member')).toBe(true);
  });

  it('executive cannot remove executive', () => {
    expect(canRemoveMember('executive', 'executive')).toBe(false);
  });

  it('executive cannot remove vice_captain', () => {
    expect(canRemoveMember('executive', 'vice_captain')).toBe(false);
  });

  it('executive cannot remove captain', () => {
    expect(canRemoveMember('executive', 'captain')).toBe(false);
  });

  it('member cannot remove anyone', () => {
    expect(canRemoveMember('member', 'member')).toBe(false);
    expect(canRemoveMember('member', 'executive')).toBe(false);
    expect(canRemoveMember('member', 'vice_captain')).toBe(false);
    expect(canRemoveMember('member', 'captain')).toBe(false);
  });
});

describe('canChangeRole', () => {
  it('captain can change role', () => {
    expect(canChangeRole('captain')).toBe(true);
  });

  it('vice_captain can change role', () => {
    expect(canChangeRole('vice_captain')).toBe(true);
  });

  it('executive cannot change role', () => {
    expect(canChangeRole('executive')).toBe(false);
  });

  it('member cannot change role', () => {
    expect(canChangeRole('member')).toBe(false);
  });
});

describe('canChangeRoleOf', () => {
  it('captain can change role of anyone but captain', () => {
    expect(canChangeRoleOf('captain', 'vice_captain')).toBe(true);
    expect(canChangeRoleOf('captain', 'executive')).toBe(true);
    expect(canChangeRoleOf('captain', 'member')).toBe(true);
    expect(canChangeRoleOf('captain', 'captain')).toBe(false);
  });

  it('vice_captain can change role of anyone but captain', () => {
    expect(canChangeRoleOf('vice_captain', 'vice_captain')).toBe(true);
    expect(canChangeRoleOf('vice_captain', 'executive')).toBe(true);
    expect(canChangeRoleOf('vice_captain', 'member')).toBe(true);
    expect(canChangeRoleOf('vice_captain', 'captain')).toBe(false);
  });

  it('executive cannot change any role', () => {
    expect(canChangeRoleOf('executive', 'vice_captain')).toBe(false);
    expect(canChangeRoleOf('executive', 'member')).toBe(false);
  });

  it('member cannot change any role', () => {
    expect(canChangeRoleOf('member', 'member')).toBe(false);
  });
});

describe('canViewInvitation', () => {
  it('captain can view invitation', () => {
    expect(canViewInvitation('captain')).toBe(true);
  });

  it('vice_captain can view invitation', () => {
    expect(canViewInvitation('vice_captain')).toBe(true);
  });

  it('executive can view invitation', () => {
    expect(canViewInvitation('executive')).toBe(true);
  });

  it('member cannot view invitation', () => {
    expect(canViewInvitation('member')).toBe(false);
  });
});

describe('canRegenerateInvitation', () => {
  it('captain can regenerate invitation', () => {
    expect(canRegenerateInvitation('captain')).toBe(true);
  });

  it('vice_captain can regenerate invitation', () => {
    expect(canRegenerateInvitation('vice_captain')).toBe(true);
  });

  it('executive cannot regenerate invitation', () => {
    expect(canRegenerateInvitation('executive')).toBe(false);
  });

  it('member cannot regenerate invitation', () => {
    expect(canRegenerateInvitation('member')).toBe(false);
  });
});

describe('canTransferCaptain', () => {
  it('captain can transfer captain', () => {
    expect(canTransferCaptain('captain')).toBe(true);
  });

  it('vice_captain cannot transfer captain', () => {
    expect(canTransferCaptain('vice_captain')).toBe(false);
  });

  it('executive cannot transfer captain', () => {
    expect(canTransferCaptain('executive')).toBe(false);
  });

  it('member cannot transfer captain', () => {
    expect(canTransferCaptain('member')).toBe(false);
  });
});

describe('canManageSubscription', () => {
  it('captain can manage subscription', () => {
    expect(canManageSubscription('captain')).toBe(true);
  });

  it('vice_captain can manage subscription', () => {
    expect(canManageSubscription('vice_captain')).toBe(true);
  });

  it('executive cannot manage subscription', () => {
    expect(canManageSubscription('executive')).toBe(false);
  });

  it('member cannot manage subscription', () => {
    expect(canManageSubscription('member')).toBe(false);
  });
});
