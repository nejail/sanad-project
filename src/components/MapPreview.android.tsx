import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import type { MapPreviewProps } from './MapPreview';
import { MAP_ORIGIN, mapPageHtml, parseMapMessage, updateScript } from './leafletPage';
import { colors } from '../theme';

/**
 * Android map: Leaflet with OpenStreetMap in a WebView, because Google Maps on Android needs an API key.
 * Same props as the iPhone map (Apple Maps, MapPreview.tsx): driver and technician pins, route, tap to pick.
 */
export function MapPreview({ center, provider, route, height = 220, interactive = true, onPick, onReady }: MapPreviewProps) {
  const ref = useRef<WebView<object>>(null);
  const source = useMemo(() => ({ html: mapPageHtml(), baseUrl: MAP_ORIGIN }), []);
  const [ready, setReady] = useState(false);
  // Android may stop the page when memory is low; a new key opens it again.
  const [page, setPage] = useState(0);

  const script = updateScript({ center, provider, route, interactive });
  useEffect(() => {
    if (ready) ref.current?.injectJavaScript(script);
  }, [ready, script]);

  const onMessage = (e: WebViewMessageEvent) => {
    const m = parseMapMessage(e.nativeEvent.data);
    if (m?.type === 'ready') {
      setReady(true);
      onReady?.();
    } else if (m?.type === 'pick') {
      onPick?.(m.coords);
    }
  };

  return (
    // Without touch the page is skipped, so the screen scrolls when the driver swipes over the map.
    <View style={[styles.wrap, { height }]} pointerEvents={interactive || onPick ? 'auto' : 'none'}>
      <WebView<object>
        key={page}
        ref={ref}
        source={source}
        style={styles.map}
        onMessage={onMessage}
        applicationNameForUserAgent="SANAD"
        nestedScrollEnabled
        overScrollMode="never"
        setSupportMultipleWindows={false}
        // The map page itself never navigates; the credit links open in the browser.
        onShouldStartLoadWithRequest={(r) => {
          if (r.url.startsWith(MAP_ORIGIN) || r.url.startsWith('about:')) return true;
          Linking.openURL(r.url).catch(() => undefined);
          return false;
        }}
        onRenderProcessGone={() => {
          setReady(false);
          setPage((n) => n + 1);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden', borderRadius: 12, backgroundColor: colors.surface },
  // Slightly transparent: an opaque WebView can crash Android during screen transitions.
  map: { flex: 1, backgroundColor: colors.surface, opacity: 0.99 },
});
