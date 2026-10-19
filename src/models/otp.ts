/**
 * One-time password (OTP) logic for registration and sign in.
 *
 * In the prototype the code is generated on the device and "delivered" as a local
 * notification that imitates an SMS. In production the same interface would be backed
 * by a server (e.g. Twilio Verify or Supabase phone auth) so the code never exists on
 * the client. The rules below (6 digits, 5 minute expiry, 30 second resend cooldown,
 * 5 attempts) are the ones the real service would enforce.
 */
export const OTP_LENGTH = 6;
export const OTP_TTL_MS = 5 * 60 * 1000;
export const OTP_RESEND_COOLDOWN_MS = 30 * 1000;
export const OTP_MAX_ATTEMPTS = 5;

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: 'no_code' | 'expired' | 'wrong_code' | 'too_many_attempts'; attemptsLeft?: number };

interface PendingCode {
  code: string;
  issuedAt: number;
  attempts: number;
}

export interface OtpService {
  request(phone: string): { code: string; issuedAt: number };
  verify(phone: string, code: string): VerifyResult;
  secondsUntilResend(phone: string): number;
}

export class LocalOtpService implements OtpService {
  private pending = new Map<string, PendingCode>();

  constructor(
    private now: () => number = () => Date.now(),
    private random: () => number = Math.random,
  ) {}

  request(phone: string) {
    const code = Array.from({ length: OTP_LENGTH }, () => Math.floor(this.random() * 10)).join('');
    const issuedAt = this.now();
    this.pending.set(phone, { code, issuedAt, attempts: 0 });
    return { code, issuedAt };
  }

  verify(phone: string, code: string): VerifyResult {
    const p = this.pending.get(phone);
    if (!p) return { ok: false, reason: 'no_code' };
    if (this.now() - p.issuedAt > OTP_TTL_MS) {
      this.pending.delete(phone);
      return { ok: false, reason: 'expired' };
    }
    if (p.attempts >= OTP_MAX_ATTEMPTS) return { ok: false, reason: 'too_many_attempts' };
    if (code !== p.code) {
      p.attempts += 1;
      const attemptsLeft = OTP_MAX_ATTEMPTS - p.attempts;
      return attemptsLeft <= 0
        ? { ok: false, reason: 'too_many_attempts' }
        : { ok: false, reason: 'wrong_code', attemptsLeft };
    }
    this.pending.delete(phone);
    return { ok: true };
  }

  secondsUntilResend(phone: string): number {
    const p = this.pending.get(phone);
    if (!p) return 0;
    return Math.max(0, Math.ceil((OTP_RESEND_COOLDOWN_MS - (this.now() - p.issuedAt)) / 1000));
  }
}

export function otpErrorMessage(r: VerifyResult): string {
  if (r.ok) return '';
  switch (r.reason) {
    case 'no_code':
      return 'Request a new code first.';
    case 'expired':
      return 'This code has expired. Tap resend to get a new one.';
    case 'too_many_attempts':
      return 'Too many wrong attempts. Request a new code.';
    case 'wrong_code':
      return `Wrong code. ${r.attemptsLeft} ${r.attemptsLeft === 1 ? 'attempt' : 'attempts'} left.`;
  }
}

export const otpService = new LocalOtpService();
