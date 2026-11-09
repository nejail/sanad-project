import { SERVICES, getOption, getService, homeServiceIds, resetCatalog } from '../src/models/catalog';
import { serviceFromDoc, serviceToDoc } from '../src/models/firestore';
import { buildQuote } from '../src/models/pricing';
import { loadCatalog, mergeCatalog } from '../src/services/catalogRepo';
import { FirestoreApi } from '../src/services/firestoreRepo';
import { FakeFirestore } from './fakeFirestore';

/** Puts the built-in catalogue into the fake `services` collection, with optional edits. */
function seeded(edit?: (id: string, doc: Record<string, unknown>) => Record<string, unknown> | null) {
  const db = new FakeFirestore();
  for (const s of SERVICES) {
    const doc = serviceToDoc(s) as unknown as Record<string, unknown>;
    const out = edit ? edit(s.id, doc) : doc;
    if (out) db.docs.set(`services/${s.id}`, out);
  }
  return db;
}

afterEach(() => resetCatalog());

describe('service documents', () => {
  it('round-trip every built-in service without losing anything', () => {
    for (const s of SERVICES) {
      const back = serviceFromDoc(s.id, JSON.parse(JSON.stringify(serviceToDoc(s))), s);
      expect(back).not.toBeNull();
      const { active, ...service } = back!;
      expect(active).toBe(true);
      expect(service).toEqual({ ...s, accent: s.accent, addOns: s.addOns });
    }
  });

  it('never stores undefined (Firestore rejects it)', () => {
    const json = JSON.stringify(serviceToDoc(SERVICES[0]));
    expect(Object.values(JSON.parse(json))).not.toContain(undefined);
    expect('addOns' in serviceToDoc(SERVICES[0])).toBe(false);
  });

  it('rejects unusable documents', () => {
    const battery = SERVICES.find((s) => s.id === 'battery')!;
    expect(serviceFromDoc('pizza', serviceToDoc(battery))).toBeNull();
    expect(serviceFromDoc('battery', { ...serviceToDoc(battery), options: [] })).toBeNull();
    expect(serviceFromDoc('battery', { ...serviceToDoc(battery), options: [{ id: 'jump', title: 'Jump', price: '50' }] })).toBeNull();
    expect(serviceFromDoc('battery', { ...serviceToDoc(battery), options: [{ id: 'jump', title: 'Jump', price: -5 }] })).toBeNull();
    expect(serviceFromDoc('battery', null)).toBeNull();
  });
});

describe('loadCatalog', () => {
  it('uses the built-in catalogue when Firestore is not available (Expo Go)', async () => {
    const r = await loadCatalog(null);
    expect(r.source).toBe('builtin');
    expect(getService('battery')).toBe(SERVICES.find((s) => s.id === 'battery'));
  });

  it('uses Firestore prices for the whole app, including the price breakdown', async () => {
    const db = seeded((id, doc) =>
      id === 'battery'
        ? { ...doc, options: (doc.options as { id: string; price: number }[]).map((o) => (o.id === 'jump' ? { ...o, price: 60, priceLabel: '60 QAR' } : o)) }
        : doc,
    );
    const r = await loadCatalog(db);
    expect(r.source).toBe('firestore');
    expect(r.fromFirestore).toBe(6);
    expect(getOption('battery', 'jump').price).toBe(60);
    expect(buildQuote({ serviceId: 'battery', optionId: 'jump' }).total).toBe(63); // 60 + 5% VAT
  });

  it('keeps the built-in version of a service whose document is broken or missing', async () => {
    const db = seeded((id, doc) => (id === 'oil' ? { ...doc, options: 'oops' } : id === 'tire' ? null : doc));
    const r = await loadCatalog(db);
    expect(r.source).toBe('firestore');
    expect(r.fromFirestore).toBe(4);
    expect(getService('oil')).toBe(SERVICES.find((s) => s.id === 'oil'));
    expect(getService('tire')).toBe(SERVICES.find((s) => s.id === 'tire'));
  });

  it('hides services switched off in the console from Home', async () => {
    await loadCatalog(seeded((id, doc) => (id === 'carwash' ? { ...doc, active: false } : doc)));
    expect(homeServiceIds()).toEqual(['fuel', 'battery', 'tire', 'oil', 'emergency']);
    expect(getService('carwash').title).toBe('Car Wash'); // old car wash orders still show
  });

  it('falls back when the collection is empty', async () => {
    const r = await loadCatalog(new FakeFirestore());
    expect(r).toMatchObject({ source: 'builtin', reason: 'The services collection is empty' });
  });

  it('falls back when offline or denied', async () => {
    const db = seeded();
    db.failReads = 'unavailable';
    const r = await loadCatalog(db);
    expect(r.source).toBe('builtin');
    expect(homeServiceIds()).toHaveLength(6);
  });

  it('does not wait forever on a slow network', async () => {
    const slow = { getDocs: () => new Promise(() => undefined) } as unknown as FirestoreApi;
    const r = await loadCatalog(slow, 20);
    expect(r).toMatchObject({ source: 'builtin', reason: 'Timed out after 20 ms' });
  });

  it('keeps the built-in order of services', () => {
    const merged = mergeCatalog([...SERVICES].reverse().map((s) => ({ id: s.id, data: serviceToDoc(s) })));
    expect(merged.services.map((s) => s.id)).toEqual(SERVICES.map((s) => s.id));
  });
});
