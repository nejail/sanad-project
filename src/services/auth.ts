/**
 * Phone sign-in for SANAD.
 *
 * Two interchangeable providers sit behind one interface:
 *  - FirebasePhoneAuth: real SMS codes through Firebase Authentication. Needs the development
 *    build (React Native Firebase is native code) and a GoogleService-Info.plist.
 *  - LocalPhoneAuth: the Sprint 3 prototype rules (code generated on the phone and shown as a
 *    notification). Used automatically in Expo Go and on web, so the app still runs there.
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { OTP_LENGTH, otpErrorMessage, otpService } from '../models/otp';
import { notify } from './notifications';

export type AuthMode = 'firebase' | 'local';

export interface SendResult {
  /** Local mode only: the code, shown if notifications are off. Never set in Firebase mode. */
  localCode?: string;
  /** Local mode only: seconds before another code can be requested. */
  cooldownSeconds: number;
}

export interface AuthUser {
  uid: string; // Firebase user id, or "local:<phone>" in local mode
  phone: string; // 8-digit Qatar number without +974
}

export interface PhoneAuthProvider {
  readonly mode: AuthMode;
  /** Sends a verification code to an 8-digit Qatar mobile number. */
  sendCode(phone: string): Promise<SendResult>;
  /** Checks the code for the number that was last sent. Throws an Error with a user-friendly message. */
  confirmCode(phone: string, code: string): Promise<AuthUser>;
  /** The signed-in user remembered by the provider, if any. */
  currentUser(): AuthUser | null;
  signOut(): Promise<void>;
}

export const toE164 = (phone: string) => `+974${phone}`;
export const fromE164 = (phone: string) => phone.replace(/^\+974/, '');

/** Turns Firebase Auth error codes into messages a driver can act on. */
export function firebaseAuthMessage(error: unknown): string {
  const code = (error as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/invalid-verification-code':
      return 'Wrong code. Check the SMS and try again.';
    case 'auth/code-expired':
    case 'auth/session-expired':
      return 'This code has expired. Tap resend to get a new one.';
    case 'auth/invalid-phone-number':
    case 'auth/missing-phone-number':
      return 'That phone number is not valid. Go back and check it.';
    case 'auth/too-many-requests':
      return 'Too many attempts from this phone. Wait a few minutes and try again.';
    case 'auth/quota-exceeded':
      return 'SMS limit reached for today. Try again later.';
    case 'auth/network-request-failed':
      return 'No internet connection. Check your connection and try again.';
    case 'auth/operation-not-allowed':
      return 'Phone sign-in is not enabled for this app yet (Firebase console > Authentication > Sign-in method).';
    case 'auth/billing-not-enabled':
      return 'SMS sending needs billing enabled on the Firebase project. Use a test number for now.';
    case 'auth/missing-client-identifier':
    case 'auth/captcha-check-failed':
      return 'Verification was cancelled. Try again and finish the check that opens.';
    case 'auth/missing-verification-id':
      return 'Request a new code first.';
    default:
      return (error as Error)?.message || 'Something went wrong. Try again.';
  }
}

/** The small part of the React Native Firebase auth API that SANAD uses (injected for tests). */
export interface FirebaseAuthApi {
  getAuth(): unknown;
  signInWithPhoneNumber(auth: unknown, phoneNumber: string): Promise<{ confirm(code: string): Promise<{ user: { uid: string; phoneNumber: string | null } } | null> }>;
  signOut(auth: unknown): Promise<void>;
  currentUser(auth: unknown): { uid: string; phoneNumber: string | null } | null;
}

/** Real SMS verification through Firebase Authentication. */
export class FirebasePhoneAuth implements PhoneAuthProvider {
  readonly mode: AuthMode = 'firebase';
  private confirmation: Awaited<ReturnType<FirebaseAuthApi['signInWithPhoneNumber']>> | null = null;
  private pendingPhone: string | null = null;

  constructor(private api: FirebaseAuthApi) {}

  async sendCode(phone: string): Promise<SendResult> {
    try {
      this.confirmation = await this.api.signInWithPhoneNumber(this.api.getAuth(), toE164(phone));
      this.pendingPhone = phone;
      // Firebase controls resend limits itself; 30 s keeps the UI consistent with local mode.
      return { cooldownSeconds: 30 };
    } catch (e) {
      throw new Error(firebaseAuthMessage(e));
    }
  }

  async confirmCode(phone: string, code: string): Promise<AuthUser> {
    if (!this.confirmation || this.pendingPhone !== phone) throw new Error(firebaseAuthMessage({ code: 'auth/missing-verification-id' }));
    if (!new RegExp(`^\\d{${OTP_LENGTH}}$`).test(code)) throw new Error(firebaseAuthMessage({ code: 'auth/invalid-verification-code' }));
    try {
      const cred = await this.confirmation.confirm(code);
      const user = cred?.user ?? this.api.currentUser(this.api.getAuth());
      if (!user) throw new Error('Sign-in did not complete. Try again.');
      this.confirmation = null;
      return { uid: user.uid, phone: user.phoneNumber ? fromE164(user.phoneNumber) : phone };
    } catch (e) {
      throw new Error(firebaseAuthMessage(e));
    }
  }

  currentUser(): AuthUser | null {
    const u = this.api.currentUser(this.api.getAuth());
    return u ? { uid: u.uid, phone: u.phoneNumber ? fromE164(u.phoneNumber) : '' } : null;
  }

  async signOut(): Promise<void> {
    this.confirmation = null;
    await this.api.signOut(this.api.getAuth());
  }
}

/** Sprint 3 prototype verification, kept for Expo Go, web and tests. */
export class LocalPhoneAuth implements PhoneAuthProvider {
  readonly mode: AuthMode = 'local';
  private signedIn: AuthUser | null = null;

  constructor(
    private otp = otpService,
    private deliver: (title: string, body: string) => Promise<boolean> = notify,
  ) {}

  async sendCode(phone: string): Promise<SendResult> {
    const { code } = this.otp.request(phone);
    // Stand-in for an SMS: deliver the code as a local notification.
    const shown = await this.deliver('SANAD verification code', `${code} is your SANAD code. It expires in 5 minutes.`);
    return { localCode: shown ? undefined : code, cooldownSeconds: this.otp.secondsUntilResend(phone) };
  }

  async confirmCode(phone: string, code: string): Promise<AuthUser> {
    const result = this.otp.verify(phone, code);
    if (!result.ok) throw new Error(otpErrorMessage(result));
    this.signedIn = { uid: `local:${phone}`, phone };
    return this.signedIn;
  }

  currentUser(): AuthUser | null {
    return this.signedIn;
  }

  async signOut(): Promise<void> {
    this.signedIn = null;
  }
}

/** True when running inside the SANAD development build with Firebase configured. */
export function firebaseAvailable(): boolean {
  if (Platform.OS === 'web') return false;
  if (Constants.executionEnvironment === 'storeClient') return false; // Expo Go has no React Native Firebase
  try {
    // Required lazily so Expo Go never loads the native module.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getApp } = require('@react-native-firebase/app');
    return !!getApp()?.options?.projectId;
  } catch {
    return false;
  }
}

/** Firebase project id when available (shown on the Feasibility Tests screen). */
export function firebaseProjectId(): string | null {
  if (!firebaseAvailable()) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getApp } = require('@react-native-firebase/app');
  return getApp().options.projectId ?? null;
}

function createFirebaseApi(): FirebaseAuthApi {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const rnfbAuth = require('@react-native-firebase/auth');
  return {
    getAuth: () => rnfbAuth.getAuth(),
    signInWithPhoneNumber: (auth, phone) => rnfbAuth.signInWithPhoneNumber(auth, phone),
    signOut: (auth) => rnfbAuth.signOut(auth),
    currentUser: (auth) => (auth as { currentUser: { uid: string; phoneNumber: string | null } | null }).currentUser,
  };
}

let provider: PhoneAuthProvider | null = null;

/** The provider for this run of the app: Firebase in the development build, local otherwise. */
export function getPhoneAuth(): PhoneAuthProvider {
  if (!provider) provider = firebaseAvailable() ? new FirebasePhoneAuth(createFirebaseApi()) : new LocalPhoneAuth();
  return provider;
}

/** Test hook: replace the provider. */
export function setPhoneAuthForTests(p: PhoneAuthProvider | null) {
  provider = p;
}
