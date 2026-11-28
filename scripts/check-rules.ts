/**
 * Runs the Rules Playground checks from docs/version-2.md against firebase/firestore.rules on
 * Firebase's own rules engine (the Firebase Rules API "test" method, which the console's Rules
 * Playground uses too), and can publish the rules.
 *
 *   npm run check:rules -- --key ~/sanad-key.json              # run every check, publish nothing
 *   npm run check:rules -- --key ~/sanad-key.json --publish    # run, then publish Firestore and Storage rules if all pass
 *
 * Needs a key whose service account has the Firebase Rules Admin role (firebaserules.rulesets.test,
 * and .create/.releases for --publish). The default Admin SDK key used for seed:services gets a 403.
 * Keep the key out of the repo.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cert, initializeApp } from 'firebase-admin/app';
import { getSecurityRules } from 'firebase-admin/security-rules';

type Data = Record<string, unknown>;
interface Check {
  n: number;
  what: string;
  method: 'get' | 'create' | 'update' | 'delete';
  path: string; // under /databases/(default)/documents/
  uid: string;
  before?: Data | null; // the stored document (null: it does not exist)
  write?: Data; // fields written (merged into before for update)
  expect: 'ALLOW' | 'DENY';
}

const DOCS = '/databases/(default)/documents';
const T0 = '2026-11-25T10:00:00Z';

// Console data from docs/version-2.md: providers provA and provB, and orders/o1 offered to provA.
const o1: Data = {
  customerId: 'custA', providerId: null, dispatch: 'provider', status: 'confirmed', offeredTo: 'provA',
  statusHistory: [{ status: 'confirmed', at: T0 }],
};
const o1Accepted: Data = { ...o1, providerId: 'provA', status: 'accepted', statusHistory: [{ status: 'confirmed', at: T0 }, { status: 'accepted', at: T0 }] };
const o4Done: Data = { ...o1Accepted, status: 'done' }; // orders/o4: a job provA finished for custA
const review = (over: Data = {}): Data => ({ orderId: 'o4', providerId: 'provA', customerId: 'custA', stars: 5, comment: 'Quick', createdAt: T0, ...over });
const live: Data = { location: { latitude: 25.31, longitude: 51.44 }, etaMin: 6, updatedAt: T0 };

const CHECKS: Check[] = [
  { n: 1, what: 'open job, offered to me', method: 'get', path: 'orders/o1', uid: 'provA', before: o1, expect: 'ALLOW' },
  { n: 2, what: 'another driver reads it', method: 'get', path: 'orders/o1', uid: 'custB', before: o1, expect: 'DENY' },
  { n: 3, what: 'provA accepts', method: 'update', path: 'orders/o1', uid: 'provA', before: o1, write: { providerId: 'provA', status: 'accepted' }, expect: 'ALLOW' },
  { n: 4, what: 'not a provider accepts', method: 'update', path: 'orders/o1', uid: 'custB', before: o1, write: { providerId: 'custB', status: 'accepted' }, expect: 'DENY' },
  { n: 5, what: 'driver assigns a technician', method: 'update', path: 'orders/o1', uid: 'custA', before: o1, write: { providerId: 'custA' }, expect: 'DENY' },
  { n: 6, what: 'skips On the way', method: 'update', path: 'orders/o1', uid: 'provA', before: o1Accepted, write: { status: 'arrived' }, expect: 'DENY' },
  { n: 7, what: 'On the way', method: 'update', path: 'orders/o1', uid: 'provA', before: o1Accepted, write: { status: 'on_the_way' }, expect: 'ALLOW' },
  { n: 8, what: 'provB takes an accepted job', method: 'update', path: 'orders/o1', uid: 'provB', before: o1Accepted, write: { providerId: 'provB', status: 'accepted' }, expect: 'DENY' },
  { n: 9, what: 'technician sets own rating', method: 'update', path: 'providers/provA', uid: 'provA', before: { name: 'A', rating: 4, isOnline: true }, write: { rating: 5 }, expect: 'DENY' },
  { n: 10, what: 'provB reads a job offered to provA', method: 'get', path: 'orders/o1', uid: 'provB', before: o1, expect: 'DENY' },
  { n: 11, what: 'provB accepts a job offered to provA', method: 'update', path: 'orders/o1', uid: 'provB', before: o1, write: { providerId: 'provB', status: 'accepted' }, expect: 'DENY' },
  { n: 12, what: 'driver moves the offer on', method: 'update', path: 'orders/o1', uid: 'custA', before: o1, write: { offeredTo: 'provB', offeredBefore: ['provA'] }, expect: 'ALLOW' },
  { n: 13, what: 'driver moves an accepted offer', method: 'update', path: 'orders/o1', uid: 'custA', before: o1Accepted, write: { offeredTo: 'provB' }, expect: 'DENY' },
  { n: 14, what: 'driver sets accepted', method: 'update', path: 'orders/o1', uid: 'custA', before: o1, write: { status: 'accepted' }, expect: 'DENY' },
  { n: 15, what: 'driver cancels', method: 'update', path: 'orders/o1', uid: 'custA', before: o1, write: { status: 'cancelled' }, expect: 'ALLOW' },
  { n: 16, what: 'driver changes dispatch', method: 'update', path: 'orders/o1', uid: 'custA', before: o1, write: { dispatch: 'simulated' }, expect: 'DENY' },
  { n: 17, what: 'driver places an order', method: 'create', path: 'orders/o2', uid: 'custA', before: null, write: { customerId: 'custA', providerId: null }, expect: 'ALLOW' },
  { n: 18, what: 'order for another driver', method: 'create', path: 'orders/o3', uid: 'custA', before: null, write: { customerId: 'custB', providerId: null }, expect: 'DENY' },
  { n: 19, what: 'assigned technician shares location', method: 'create', path: 'orders/o1/tracking/live', uid: 'provA', before: null, write: live, expect: 'ALLOW' },
  { n: 20, what: 'other technician shares location', method: 'create', path: 'orders/o1/tracking/live', uid: 'provB', before: null, write: live, expect: 'DENY' },
  { n: 21, what: 'driver reads live location', method: 'get', path: 'orders/o1/tracking/live', uid: 'custA', before: live, expect: 'ALLOW' },
  { n: 22, what: 'technician updates own location', method: 'update', path: 'providers/provA', uid: 'provA', before: { name: 'A', rating: 4, isOnline: true }, write: { lastLocation: { latitude: 25.3, longitude: 51.5 }, geohash: 'thkx' }, expect: 'ALLOW' },
  // Driver's status history on an order sent to technicians (smaller fix).
  { n: 23, what: 'driver cancels and adds one cancelled entry', method: 'update', path: 'orders/o1', uid: 'custA', before: o1, write: { status: 'cancelled', statusHistory: [{ status: 'confirmed', at: T0 }, { status: 'cancelled', at: T0 }] }, expect: 'ALLOW' },
  { n: 24, what: 'driver rewrites the status history', method: 'update', path: 'orders/o1', uid: 'custA', before: o1, write: { statusHistory: [{ status: 'confirmed', at: T0 }, { status: 'done', at: T0 }] }, expect: 'DENY' },
  { n: 25, what: 'driver cancels but drops a history entry', method: 'update', path: 'orders/o1', uid: 'custA', before: o1Accepted, write: { status: 'cancelled', statusHistory: [{ status: 'cancelled', at: T0 }] }, expect: 'DENY' },
  // Reviews (V2 feature 14): reviews/{orderId}.
  { n: 26, what: 'driver rates a done job', method: 'create', path: 'reviews/o4', uid: 'custA', before: null, write: review(), expect: 'ALLOW' },
  { n: 27, what: 'second rating of the same job', method: 'update', path: 'reviews/o4', uid: 'custA', before: review(), write: { stars: 1 }, expect: 'DENY' },
  { n: 28, what: 'driver deletes a review', method: 'delete', path: 'reviews/o4', uid: 'custA', before: review(), expect: 'DENY' },
  { n: 29, what: 'someone else rates the job', method: 'create', path: 'reviews/o4', uid: 'custB', before: null, write: review({ customerId: 'custB' }), expect: 'DENY' },
  { n: 30, what: 'rating names another technician', method: 'create', path: 'reviews/o4', uid: 'custA', before: null, write: review({ providerId: 'provB' }), expect: 'DENY' },
  { n: 31, what: 'rating a job that is not done', method: 'create', path: 'reviews/o1', uid: 'custA', before: null, write: review({ orderId: 'o1' }), expect: 'DENY' },
  { n: 32, what: '6 stars', method: 'create', path: 'reviews/o4', uid: 'custA', before: null, write: review({ stars: 6 }), expect: 'DENY' },
];

/** What get() and exists() return during a check: the console data above. */
function functionMocks(check: Check) {
  // The tracking checks run after check 3, when provA has accepted o1.
  const order1 = check.path.startsWith('orders/o1/tracking') ? o1Accepted : o1;
  const docs: Record<string, Data | null> = {
    'providers/provA': { name: 'A', isOnline: true },
    'providers/provB': { name: 'B', isOnline: true },
    'orders/o1': order1,
    'orders/o4': o4Done,
  };
  const mocks: unknown[] = [];
  for (const [path, data] of Object.entries(docs)) {
    const full = `${DOCS}/${path}`;
    mocks.push({ function: 'exists', args: [{ exactValue: full }], result: { value: true } });
    mocks.push({ function: 'get', args: [{ exactValue: full }], result: { value: { data } } });
  }
  mocks.push({ function: 'exists', args: [{ anyValue: {} }], result: { value: false } });
  mocks.push({ function: 'get', args: [{ anyValue: {} }], result: { undefined: {} } });
  return mocks;
}

function testCase(c: Check) {
  const after = c.method === 'update' ? { ...(c.before ?? {}), ...(c.write ?? {}) } : c.write;
  const request: Data = { auth: { uid: c.uid, token: {} }, path: `${DOCS}/${c.path}`, method: c.method, time: T0 };
  if (after) request.resource = { data: after };
  const tc: Data = { expectation: c.expect, request, functionMocks: functionMocks(c) };
  if (c.before) tc.resource = { data: c.before };
  return tc;
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const keyPath = arg('key') ?? process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!keyPath) throw new Error('Missing service account key. Pass --key path/to/key.json.');
  const key = JSON.parse(readFileSync(keyPath.replace(/^~/, process.env.HOME ?? '~'), 'utf8'));
  const credential = cert(key);
  const root = join(__dirname, '..');
  const firestoreRules = readFileSync(join(root, 'firebase/firestore.rules'), 'utf8');

  const { access_token } = await credential.getAccessToken();
  const res = await fetch(`https://firebaserules.googleapis.com/v1/projects/${key.project_id}:test`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ source: { files: [{ name: 'firestore.rules', content: firestoreRules }] }, testSuite: { testCases: CHECKS.map(testCase) } }),
  });
  const body = (await res.json()) as { issues?: unknown[]; testResults?: { state: string; debugMessages?: string[]; errorPosition?: unknown }[]; error?: unknown };
  if (!res.ok) throw new Error(`Rules API ${res.status}: ${JSON.stringify(body.error ?? body)}`);
  if (body.issues?.length) console.log('Compiler issues:', JSON.stringify(body.issues, null, 2));

  let failed = 0;
  body.testResults!.forEach((r, i) => {
    const c = CHECKS[i];
    const ok = r.state === 'SUCCESS';
    if (!ok) failed++;
    const got = ok ? c.expect : c.expect === 'ALLOW' ? 'DENY' : 'ALLOW';
    console.log(`${ok ? 'PASS' : 'FAIL'}  #${String(c.n).padStart(2)}  ${c.method.padEnd(6)} ${c.path.padEnd(24)} as ${c.uid.padEnd(5)}  expected ${c.expect.padEnd(5)} got ${got.padEnd(5)}  ${c.what}`);
    if (!ok && r.debugMessages?.length) console.log('       ', r.debugMessages.join(' | '));
  });
  console.log(`\n${CHECKS.length - failed} of ${CHECKS.length} checks match the expected result.`);

  if (process.argv.includes('--publish')) {
    if (failed) throw new Error('Not publishing: some checks failed.');
    initializeApp({ credential, projectId: key.project_id, storageBucket: arg('bucket') });
    const rules = getSecurityRules();
    const fs = await rules.releaseFirestoreRulesetFromSource(firestoreRules);
    console.log(`Published Firestore rules: ${fs.name} (${fs.createTime})`);
    if (arg('bucket')) {
      const st = await rules.releaseStorageRulesetFromSource(readFileSync(join(root, 'firebase/storage.rules'), 'utf8'), arg('bucket'));
      console.log(`Published Storage rules for ${arg('bucket')}: ${st.name} (${st.createTime})`);
    } else {
      console.log('Storage rules not published: pass --bucket <name> (STORAGE_BUCKET in GoogleService-Info.plist).');
    }
  }
  if (failed) process.exit(1);
}

main().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});
