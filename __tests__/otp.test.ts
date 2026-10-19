import { LocalOtpService, OTP_MAX_ATTEMPTS, OTP_TTL_MS, otpErrorMessage } from '../src/models/otp';

const PHONE = '50123456';

function service() {
  let now = 1_000_000;
  const svc = new LocalOtpService(() => now, () => 0.42); // deterministic code "444444"
  return { svc, advance: (ms: number) => (now += ms) };
}

describe('LocalOtpService', () => {
  it('issues a 6-digit code', () => {
    const { svc } = service();
    expect(svc.request(PHONE).code).toMatch(/^\d{6}$/);
  });

  it('accepts the right code once', () => {
    const { svc } = service();
    const { code } = svc.request(PHONE);
    expect(svc.verify(PHONE, code)).toEqual({ ok: true });
    expect(svc.verify(PHONE, code)).toEqual({ ok: false, reason: 'no_code' });
  });

  it('rejects a wrong code and counts attempts down', () => {
    const { svc } = service();
    svc.request(PHONE);
    const r = svc.verify(PHONE, '000000');
    expect(r).toEqual({ ok: false, reason: 'wrong_code', attemptsLeft: OTP_MAX_ATTEMPTS - 1 });
    expect(otpErrorMessage(r)).toContain('4 attempts left');
  });

  it('locks after too many wrong attempts, even if the right code follows', () => {
    const { svc } = service();
    const { code } = svc.request(PHONE);
    for (let i = 0; i < OTP_MAX_ATTEMPTS; i++) svc.verify(PHONE, '000000');
    expect(svc.verify(PHONE, code)).toEqual({ ok: false, reason: 'too_many_attempts' });
  });

  it('expires codes after 5 minutes', () => {
    const { svc, advance } = service();
    const { code } = svc.request(PHONE);
    advance(OTP_TTL_MS + 1);
    expect(svc.verify(PHONE, code)).toEqual({ ok: false, reason: 'expired' });
  });

  it('enforces a 30 second resend cooldown', () => {
    const { svc, advance } = service();
    svc.request(PHONE);
    expect(svc.secondsUntilResend(PHONE)).toBe(30);
    advance(12_000);
    expect(svc.secondsUntilResend(PHONE)).toBe(18);
    advance(20_000);
    expect(svc.secondsUntilResend(PHONE)).toBe(0);
  });

  it('keeps codes for different phone numbers separate', () => {
    const { svc } = service();
    const a = svc.request('50123456').code;
    const b = svc.request('66554433').code;
    expect(svc.verify('66554433', b)).toEqual({ ok: true });
    // Verifying B does not consume A's pending code.
    expect(svc.verify('50123456', a)).toEqual({ ok: true });
  });
});
