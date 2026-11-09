import { FirebaseAuthApi, FirebasePhoneAuth, LocalPhoneAuth, firebaseAuthMessage, fromE164, toE164 } from '../src/services/auth';
import { LocalOtpService } from '../src/models/otp';

const PHONE = '50123456';

/** Fake React Native Firebase auth API that accepts one code. */
function fakeFirebase(validCode = '123456') {
  let current: { uid: string; phoneNumber: string } | null = null;
  const calls: string[] = [];
  const api: FirebaseAuthApi = {
    getAuth: () => ({}),
    signInWithPhoneNumber: async (_auth, phone) => {
      calls.push(phone);
      if (!/^\+974[3567]\d{7}$/.test(phone)) throw Object.assign(new Error('bad'), { code: 'auth/invalid-phone-number' });
      return {
        confirm: async (code: string) => {
          if (code !== validCode) throw Object.assign(new Error('bad code'), { code: 'auth/invalid-verification-code' });
          current = { uid: 'uid-abc', phoneNumber: phone };
          return { user: current };
        },
      };
    },
    signOut: async () => {
      current = null;
    },
    currentUser: () => current,
  };
  return { api, calls };
}

describe('phone number format', () => {
  it('converts between local and E.164 numbers', () => {
    expect(toE164(PHONE)).toBe('+97450123456');
    expect(fromE164('+97450123456')).toBe(PHONE);
  });
});

describe('FirebasePhoneAuth', () => {
  it('sends the SMS to the +974 number and signs in with the right code', async () => {
    const { api, calls } = fakeFirebase();
    const auth = new FirebasePhoneAuth(api);
    await expect(auth.sendCode(PHONE)).resolves.toEqual({ cooldownSeconds: 30 });
    expect(calls).toEqual(['+97450123456']);
    await expect(auth.confirmCode(PHONE, '123456')).resolves.toEqual({ uid: 'uid-abc', phone: PHONE });
    expect(auth.currentUser()).toEqual({ uid: 'uid-abc', phone: PHONE });
  });

  it('shows a friendly message for a wrong code and keeps the user signed out', async () => {
    const auth = new FirebasePhoneAuth(fakeFirebase().api);
    await auth.sendCode(PHONE);
    await expect(auth.confirmCode(PHONE, '000000')).rejects.toThrow('Wrong code');
    expect(auth.currentUser()).toBeNull();
  });

  it('asks for a new code if none was sent for this number', async () => {
    const auth = new FirebasePhoneAuth(fakeFirebase().api);
    await expect(auth.confirmCode(PHONE, '123456')).rejects.toThrow('Request a new code');
    await auth.sendCode(PHONE);
    await expect(auth.confirmCode('66554433', '123456')).rejects.toThrow('Request a new code');
  });

  it('maps Firebase errors when sending', async () => {
    const auth = new FirebasePhoneAuth(fakeFirebase().api);
    await expect(auth.sendCode('12345678')).rejects.toThrow('not valid');
  });

  it('signs out of Firebase', async () => {
    const auth = new FirebasePhoneAuth(fakeFirebase().api);
    await auth.sendCode(PHONE);
    await auth.confirmCode(PHONE, '123456');
    await auth.signOut();
    expect(auth.currentUser()).toBeNull();
  });
});

describe('firebaseAuthMessage', () => {
  it.each([
    ['auth/code-expired', 'expired'],
    ['auth/session-expired', 'expired'],
    ['auth/too-many-requests', 'Too many attempts'],
    ['auth/network-request-failed', 'No internet'],
    ['auth/operation-not-allowed', 'not enabled'],
    ['auth/billing-not-enabled', 'Blaze'],
  ])('%s', (code, text) => {
    expect(firebaseAuthMessage({ code })).toContain(text);
  });

  it('falls back to the error message for unknown codes', () => {
    expect(firebaseAuthMessage(new Error('Something odd'))).toBe('Something odd');
  });
});

describe('LocalPhoneAuth (Expo Go fallback)', () => {
  it('delivers the code as a notification and verifies it', async () => {
    const otp = new LocalOtpService(() => 0, () => 0.1);
    const delivered: string[] = [];
    const auth = new LocalPhoneAuth(otp, async (_t, body) => (delivered.push(body), true));
    const sent = await auth.sendCode(PHONE);
    expect(sent.localCode).toBeUndefined();
    expect(delivered[0]).toContain('111111');
    await expect(auth.confirmCode(PHONE, '111111')).resolves.toEqual({ uid: `local:${PHONE}`, phone: PHONE });
  });

  it('returns the code to show on screen when notifications are off', async () => {
    const auth = new LocalPhoneAuth(new LocalOtpService(() => 0, () => 0.1), async () => false);
    expect((await auth.sendCode(PHONE)).localCode).toBe('111111');
  });

  it('rejects a wrong code with the attempts left', async () => {
    const auth = new LocalPhoneAuth(new LocalOtpService(() => 0, () => 0.1), async () => true);
    await auth.sendCode(PHONE);
    await expect(auth.confirmCode(PHONE, '000000')).rejects.toThrow('attempts left');
  });
});
