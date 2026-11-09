import { isVerifiedNumber } from '../src/services/auth';

describe('isVerifiedNumber', () => {
  it('accepts the number Firebase verified', () => {
    expect(isVerifiedNumber({ uid: 'u1', phone: '50123456' }, '50123456')).toBe(true);
  });

  it('rejects a different number than the one verified', () => {
    expect(isVerifiedNumber({ uid: 'u1', phone: '50123456' }, '66554433')).toBe(false);
  });

  it('rejects when nobody is signed in or the user has no phone', () => {
    expect(isVerifiedNumber(null, '50123456')).toBe(false);
    expect(isVerifiedNumber({ uid: 'u1', phone: '' }, '')).toBe(false);
  });
});
