import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider } from './src/viewModels/AppContext';
import { LiveLocationProvider } from './src/viewModels/LiveLocationContext';
import RootNavigator from './src/navigation/RootNavigator';
import { SyncToast } from './src/components/SyncToast';
import { OrderStatusWatcher } from './src/components/OrderStatusWatcher';
import { configureNotifications } from './src/services/notifications';

export default function App() {
  useEffect(() => {
    configureNotifications();
  }, []);

  return (
    <SafeAreaProvider>
      <AppProvider>
        <LiveLocationProvider>
          <StatusBar style="light" />
          <RootNavigator />
          <SyncToast />
          <OrderStatusWatcher />
        </LiveLocationProvider>
      </AppProvider>
    </SafeAreaProvider>
  );
}
