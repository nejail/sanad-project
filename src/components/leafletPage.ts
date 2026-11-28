import { Coordinates } from '../models/types';
import { colors } from '../theme';
import { LEAFLET_CSS, LEAFLET_JS } from './leafletAssets';

/**
 * The web page behind the Android map (MapPreview.android.tsx): Leaflet with OpenStreetMap tiles, which
 * need no API key. The app draws on it with `updateScript` and hears back through `parseMapMessage`.
 */

/** Origin the page runs under. OpenStreetMap's tile server asks apps to send one; nothing is loaded from it. */
export const MAP_ORIGIN = 'https://qa.cmu.sanad.prototype';
export const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

export interface MapState {
  center: Coordinates;
  provider?: Coordinates;
  route?: Coordinates[];
  interactive: boolean;
}

export type MapMessage = { type: 'ready' } | { type: 'pick'; coords: Coordinates };

const pair = (c: Coordinates): [number, number] => [c.latitude, c.longitude];

/** Runs inside the page to show the current pins and route. Only numbers are passed in. */
export function updateScript(s: MapState): string {
  const data = {
    center: pair(s.center),
    provider: s.provider ? pair(s.provider) : null,
    route: s.route && s.route.length > 1 ? s.route.map(pair) : null,
    interactive: s.interactive,
  };
  return `window.sanadUpdate(${JSON.stringify(data)}); true;`;
}

/** Reads a message from the page. Anything unexpected is ignored. */
export function parseMapMessage(text: string): MapMessage | null {
  try {
    const m = JSON.parse(text) as { type?: unknown; latitude?: unknown; longitude?: unknown } | null;
    if (m?.type === 'ready') return { type: 'ready' };
    if (m?.type === 'pick' && typeof m.latitude === 'number' && typeof m.longitude === 'number'
      && Math.abs(m.latitude) <= 90 && Math.abs(m.longitude) <= 180) {
      return { type: 'pick', coords: { latitude: m.latitude, longitude: m.longitude } };
    }
  } catch {
    // not a message from the map page
  }
  return null;
}

const pinSvg = (color: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="40" viewBox="0 0 30 40"><path d="M15 0C6.7 0 0 6.7 0 15c0 11 15 25 15 25s15-14 15-25C30 6.7 23.3 0 15 0z" fill="${color}"/><circle cx="15" cy="15" r="6" fill="#fff"/></svg>`;

const SCRIPT = `
(function () {
  var send = function (m) { if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(m)); };
  var icon = function (html) { return L.divIcon({ className: '', html: html, iconSize: [30, 40], iconAnchor: [15, 40] }); };
  var map = L.map('map', { zoomControl: false, zoomSnap: 0.5 });
  map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
  L.tileLayer('${TILE_URL}', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(map);
  var you = null, provider = null, line = null, shown = '';
  map.on('click', function (e) {
    var p = e.latlng.wrap();
    send({ type: 'pick', latitude: p.lat, longitude: p.lng });
  });
  window.sanadUpdate = function (s) {
    var first = shown === '';
    // Like the iPhone map: move only when a pin moved, so the driver can look around in between.
    var now = JSON.stringify([s.center, s.provider]);
    if (now !== shown) {
      if (s.provider) map.fitBounds([s.center, s.provider], { padding: [50, 50], maxZoom: 16, animate: !first });
      else map.setView(s.center, 15, { animate: !first });
      shown = now;
    }
    if (you) you.setLatLng(s.center); else you = L.marker(s.center, { icon: icon('${pinSvg(colors.primary)}'), title: 'You', interactive: false }).addTo(map);
    if (s.provider) {
      if (provider) provider.setLatLng(s.provider); else provider = L.marker(s.provider, { icon: icon('${pinSvg(colors.price)}'), title: 'Provider', interactive: false }).addTo(map);
    } else if (provider) { provider.remove(); provider = null; }
    if (s.route) {
      if (line) line.setLatLngs(s.route); else line = L.polyline(s.route, { color: '${colors.primary}', weight: 4, dashArray: '8 6', interactive: false }).addTo(map);
    } else if (line) { line.remove(); line = null; }
    ['dragging', 'touchZoom', 'doubleClickZoom', 'scrollWheelZoom'].forEach(function (k) { map[k][s.interactive ? 'enable' : 'disable'](); });
  };
  send({ type: 'ready' });
})();
`;

/** The whole page. Tiles are recoloured to match the app's dark theme. */
export function mapPageHtml(): string {
  return `<!doctype html>
<html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>${LEAFLET_CSS}</style>
<style>
html, body, #map { height: 100%; margin: 0; background: ${colors.surface}; }
.leaflet-tile-pane { filter: invert(1) hue-rotate(180deg) brightness(0.95) contrast(0.9); }
.leaflet-container .leaflet-control-attribution { background: rgba(15,23,42,0.75); color: ${colors.subtext}; font-size: 10px; }
.leaflet-container .leaflet-control-attribution a { color: ${colors.subtext}; }
</style></head>
<body><div id="map"></div>
<script>${LEAFLET_JS}</script>
<script>${SCRIPT}</script>
</body></html>`;
}
