import overpass from './fixtures/overpass-garages.json';
import osrm from './fixtures/osrm-route.json';
import { buildOverpassQuery, parseOsrmRoute, parseOverpass, pointAlongPath } from '../src/api/osm';

const CMUQ = { latitude: 25.3155, longitude: 51.439 };

describe('Overpass API parsing', () => {
  const places = parseOverpass(overpass, CMUQ, 'garage');

  it('keeps nodes and ways (using the way centre), drops duplicates and items without coordinates', () => {
    expect(places.map((p) => p.id).sort()).toEqual(['node/1001', 'node/1003', 'way/2002']);
  });

  it('lists named businesses first, nearest first, and unnamed ones last', () => {
    expect(places.map((p) => p.id)).toEqual(['node/1001', 'way/2002', 'node/1003']);
    expect(places[0].distanceKm).toBeLessThan(places[1].distanceKm);
  });

  it('prefers the English name and falls back to a generic label', () => {
    expect(places.find((p) => p.id === 'way/2002')?.name).toBe('Gharrafa Garage');
    expect(places.find((p) => p.id === 'node/1003')?.name).toBe('Garage');
  });

  it('maps phone and opening hours tags', () => {
    const p = places.find((x) => x.id === 'node/1001');
    expect(p?.phone).toBe('+974 4400 1234');
    expect(p?.openingHours).toBe('Sa-Th 07:00-21:00');
  });

  it('rejects responses without an elements array', () => {
    expect(() => parseOverpass({ remark: 'runtime error' }, CMUQ, 'garage')).toThrow('elements');
  });

  it('builds a query for nodes and ways around the driver', () => {
    const q = buildOverpassQuery(CMUQ, 'fuel', 5000);
    expect(q).toContain('[out:json]');
    expect(q).toContain('node["amenity"="fuel"](around:5000,25.3155,51.439)');
    expect(q).toContain('way["amenity"="fuel"]');
    expect(q).toContain('out center;');
  });
});

describe('OSRM route parsing', () => {
  const route = parseOsrmRoute(osrm);

  it('converts metres to km and seconds to minutes', () => {
    expect(route.distanceKm).toBe(8.43);
    expect(route.durationMin).toBe(12);
  });

  it('swaps GeoJSON [lon, lat] into app coordinates', () => {
    expect(route.path[0]).toEqual({ latitude: 25.2847, longitude: 51.4973 });
    expect(route.path).toHaveLength(4);
  });

  it('throws on errors such as NoRoute', () => {
    expect(() => parseOsrmRoute({ code: 'NoRoute', message: 'Impossible route between points' })).toThrow('Impossible route');
  });

  it('finds points along the route for the moving provider', () => {
    expect(pointAlongPath(route.path, 0)).toEqual(route.path[0]);
    expect(pointAlongPath(route.path, 1)).toEqual(route.path[3]);
    const mid = pointAlongPath(route.path, 0.5);
    expect(mid.latitude).toBeGreaterThan(25.2847);
    expect(mid.latitude).toBeLessThan(25.3155);
  });
});
