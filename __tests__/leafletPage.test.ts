import { MAP_ORIGIN, TILE_URL, mapPageHtml, parseMapMessage, updateScript } from '../src/components/leafletPage';

const doha = { latitude: 25.2854, longitude: 51.531 };
const van = { latitude: 25.3, longitude: 51.5 };

describe('Android map page (Leaflet, no Google key)', () => {
  it('holds Leaflet itself, loads only OpenStreetMap tiles and credits them', () => {
    const html = mapPageHtml();
    expect(html).toContain('Leaflet 1.9.4');
    expect(html).toContain(TILE_URL);
    expect(html).toContain('openstreetmap.org/copyright');
    expect(html).not.toMatch(/<script[^>]+src=|<link[^>]+href=|googleapis/);
    expect(html.match(/<\/script>/g)).toHaveLength(2);
    expect(MAP_ORIGIN).toMatch(/^https:/);
  });

  it('sends pins and route to the page', () => {
    expect(updateScript({ center: doha, provider: van, route: [van, doha], interactive: false })).toBe(
      'window.sanadUpdate({"center":[25.2854,51.531],"provider":[25.3,51.5],"route":[[25.3,51.5],[25.2854,51.531]],"interactive":false}); true;',
    );
    expect(updateScript({ center: doha, route: [doha], interactive: true })).toContain('"provider":null,"route":null');
  });

  it('reads taps and ignores anything else', () => {
    expect(parseMapMessage('{"type":"ready"}')).toEqual({ type: 'ready' });
    expect(parseMapMessage('{"type":"pick","latitude":25.3,"longitude":51.5}')).toEqual({ type: 'pick', coords: van });
    for (const bad of ['', 'null', 'hello', '{"type":"pick"}', '{"type":"pick","latitude":"25","longitude":51}', '{"type":"pick","latitude":250,"longitude":51}', '{"type":"other"}']) {
      expect(parseMapMessage(bad)).toBeNull();
    }
  });
});
