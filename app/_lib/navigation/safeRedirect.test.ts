import { describe, expect, it } from 'vitest';

import { toSafeInternalPath } from './safeRedirect';

describe('toSafeInternalPath', () => {
  it.each([
    '/',
    '/?login=success',
    '/chinba/team/detail?id=7&tab=mwoheni',
    '/onboarding?resume_onboarding=true',
    '/notices?q=%',
  ])('keeps in-app path %s', (path) => {
    expect(toSafeInternalPath(path)).toBe(path);
  });

  it.each([
    ['protocol-relative', '//outside.invalid/path'],
    ['backslash host', '/\\outside.invalid'],
    ['tab-smuggled host', '/\t/outside.invalid'],
    ['newline-smuggled host', '/\n/outside.invalid'],
    ['javascript scheme', 'javascript:alert(1)'],
    ['absolute url', 'https://outside.invalid/'],
    ['relative path', 'chinba/team/detail'],
    ['empty', ''],
  ])('rejects %s', (_label, value) => {
    expect(toSafeInternalPath(value)).toBeNull();
  });

  it('rejects missing values', () => {
    expect(toSafeInternalPath(null)).toBeNull();
    expect(toSafeInternalPath(undefined)).toBeNull();
  });

  it('accepts a returnTo built with a single encodeURIComponent without re-decoding', () => {
    const target = '/chinba/team/detail?id=7&tab=mwoheni';
    const params = new URLSearchParams(`id=3&returnTo=${encodeURIComponent(target)}`);

    expect(toSafeInternalPath(params.get('returnTo'))).toBe(target);
  });

  it('does not throw on a returnTo containing a lone %', () => {
    const params = new URLSearchParams(`returnTo=${encodeURIComponent('/chinba/team/detail?q=%')}`);

    expect(() => toSafeInternalPath(params.get('returnTo'))).not.toThrow();
    expect(toSafeInternalPath(params.get('returnTo'))).toBe('/chinba/team/detail?q=%');
  });

  it('rejects a javascript: returnTo after query decoding', () => {
    const params = new URLSearchParams(`returnTo=${encodeURIComponent('javascript:alert(document.domain)')}`);

    expect(toSafeInternalPath(params.get('returnTo'))).toBeNull();
  });
});
