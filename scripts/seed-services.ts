/**
 * Seeds the Firestore `services` collection from the built-in catalogue (src/models/catalog.ts).
 * Writes six documents: fuel, carwash, battery, tire, oil, emergency.
 *
 * The security rules block app writes to `services`, so this runs as an admin with a service
 * account key (Firebase console > Project settings > Service accounts > Generate new private key).
 * Keep that key out of the repo.
 *
 *   npm run seed:services -- --dry-run                      # print the documents, write nothing
 *   npm run seed:services -- --key ~/Downloads/sanad-key.json
 *   GOOGLE_APPLICATION_CREDENTIALS=~/sanad-key.json npm run seed:services
 *
 * Running it again resets every price to the built-in values (useful after a demo).
 */
import { readFileSync } from 'node:fs';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { SERVICES } from '../src/models/catalog';
import { COLLECTIONS, serviceToDoc } from '../src/models/firestore';

/** Reads a `--name value` argument. */
function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/** Writes all six service documents in one batch, or prints them with --dry-run. */
async function main() {
  const docs = SERVICES.map((s) => ({ id: s.id, data: serviceToDoc(s) }));

  if (process.argv.includes('--dry-run')) {
    console.log(JSON.stringify(Object.fromEntries(docs.map((d) => [d.id, d.data])), null, 2));
    console.log(`\n${docs.length} documents for /${COLLECTIONS.services} (dry run, nothing written)`);
    return;
  }

  const keyPath = arg('key') ?? process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!keyPath) {
    console.error('Missing service account key. Pass --key path/to/key.json or set GOOGLE_APPLICATION_CREDENTIALS.');
    process.exit(1);
  }
  const key = JSON.parse(readFileSync(keyPath.replace(/^~/, process.env.HOME ?? '~'), 'utf8'));
  initializeApp({ credential: cert(key), projectId: key.project_id });
  const db = getFirestore();

  const batch = db.batch();
  for (const d of docs) batch.set(db.collection(COLLECTIONS.services).doc(d.id), d.data);
  await batch.commit();
  console.log(`Wrote ${docs.length} documents to /${COLLECTIONS.services} in project ${key.project_id}: ${docs.map((d) => d.id).join(', ')}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
