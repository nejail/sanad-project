import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { Coordinates } from '../models/types';
import { colors } from '../theme';

export interface MapPreviewProps {
  center: Coordinates;
  provider?: Coordinates;
  route?: Coordinates[];
  height?: number;
  interactive?: boolean;
  onPick?: (c: Coordinates) => void;
  onReady?: () => void;
}

/** Native map (Apple Maps on iOS, Google Maps on Android) via react-native-maps. */
export function MapPreview({ center, provider, route, height = 220, interactive = true, onPick, onReady }: MapPreviewProps) {
  const ref = useRef<MapView>(null);

  useEffect(() => {
    const points = provider ? [center, provider] : [center];
    if (points.length > 1) {
      ref.current?.fitToCoordinates(points, { edgePadding: { top: 60, right: 60, bottom: 60, left: 60 }, animated: true });
    } else {
      ref.current?.animateToRegion({ ...center, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 400);
    }
  }, [center.latitude, center.longitude, provider?.latitude, provider?.longitude]);

  return (
    <View style={[styles.wrap, { height }]}>
      <MapView
        ref={ref}
        style={StyleSheet.absoluteFill}
        initialRegion={{ ...center, latitudeDelta: 0.02, longitudeDelta: 0.02 }}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        userInterfaceStyle="dark"
        onMapReady={onReady}
        onPress={onPick ? (e) => onPick(e.nativeEvent.coordinate) : undefined}
      >
        <Marker coordinate={center} pinColor={colors.primary} title="You" />
        {provider ? <Marker coordinate={provider} pinColor={colors.price} title="Provider" /> : null}
        {route && route.length > 1 ? <Polyline coordinates={route} strokeColor={colors.primary} strokeWidth={4} lineDashPattern={[8, 6]} /> : null}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden', borderRadius: 12, backgroundColor: colors.surface },
});
