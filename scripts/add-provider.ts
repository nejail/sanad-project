/**
 * Registers a technician for Provider Mode (V2 feature 4): writes providers/{uid} for the Firebase
 * user with this phone number. The security rules do not let the app create provider profiles,
 * so this runs as an admin with a service account key, like seed-services.ts.
 *
 * The technician signs in to SANAD once with their number first (so the Firebase user exists),
 * then:
 *
 *   npm run add:provider -- --phone 55550123 --name "Ahmed Al-Mansouri" --business "Al Sadd Auto" \
 *     --vehicle "Toyota Hilux service van" --plate 61570 --services battery,tire,fuel --key ~/sanad-key.json
 *   npm run add:provider -- --phone 55550123 --name "Ahmed" --dry-run     # print the document only
 *   npm run add:provider -- --phone 55550123 --remove --key ~/sanad-key.json
 *
 * Without --services the technician sees requests for every service.
 */
import { readFileSync } from 'node:fs';
import { cert, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { COLLECTIONS, ProviderDoc, toE164 } from '../src/models/firestore';
import { ServiceId } from '../src/models/types';

const SERVICE_IDS: ServiceId[] = ['battery', 'fuel', 'carwash', 'tire', 'oil', 'emergency'];

/** Reads a `--name value` argument. */
function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

/** Builds the providers/{uid} document from the command line. */
function providerDoc(phone: string): ProviderDoc {
  const services = (arg('services') ?? '').split(',').map((s) => s.trim()).filter(Boolean) as ServiceId[];
  const unknown = services.filter((s) => !SERVICE_IDS.includes(s));
  if (unknown.length) fail(`Unknown service(s): ${unknown.join(', ')}. Use: ${SERVICE_IDS.join(', ')}`);
  const doc: ProviderDoc = {
    name: arg('name') ?? fail('Missing --name'),
    businessName: arg('business') ?? '',
    osmId: null,
    services,
    phone,
    vehicle: arg('vehicle') ?? 'Service van',
    rating: Number(arg('rating') ?? 5),
    ratingCount: 0,
    base: { latitude: 25.2854, longitude: 51.531 },
    lastLocation: null,
    geohash: null,
    isOnline: true,
  };
  const plate = arg('plate');
  if (plate) doc.vehiclePlate = plate;
  return doc;
}

async function main() {
  const local = (arg('phone') ?? fail('Missing --phone (8-digit Qatar number)')).replace(/\D/g, '').replace(/^974/, '');
  if (local.length !== 8) fail('The phone number must have 8 digits, e.g. 55550123');
  const phone = toE164(local);
  const remove = process.argv.includes('--remove');
  const doc = remove ? null : providerDoc(phone);

  if (process.argv.includes('--dry-run')) {
    console.log(JSON.stringify(doc, null, 2));
    console.log(`\n${remove ? 'Would remove' : 'Would write'} /${COLLECTIONS.providers}/<uid of ${phone}> (dry run, nothing written)`);
    return;
  }

  const keyPath = arg('key') ?? process.env.GOOGLE_APPLICATION_CREDENTIALS ?? fail('Missing service account key. Pass --key path/to/key.json or set GOOGLE_APPLICATION_CREDENTIALS.');
  const key = JSON.parse(readFileSync(keyPath.replace(/^~/, process.env.HOME ?? '~'), 'utf8'));
  initializeApp({ credential: cert(key), projectId: key.project_id });

  const user = await getAuth().getUserByPhoneNumber(phone).catch(() =>
    fail(`No Firebase user with ${phone}. Sign in to SANAD once with this number, then run this again.`));
  const ref = getFirestore().collection(COLLECTIONS.providers).doc(user.uid);
  if (remove) {
    await ref.delete();
    console.log(`Removed provider ${phone} (${user.uid}).`);
    return;
  }
  await ref.set(doc!);
  console.log(`${doc!.name} (${phone}) is now a SANAD technician: /${COLLECTIONS.providers}/${user.uid}`);
  console.log('Open Profile > Provider Mode in the app to see new requests.');
}

main().catch((e) => fail(String(e?.stack ?? e)));
