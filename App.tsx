import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider } from './src/viewModels/AppContext';
import RootNavigator from './src/navigation/RootNavigator';
import { configureNotifications } from './src/services/notifications';

export default function App() {
  useEffect(() => {
    configureNotifications();
  }, []);

  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style="light" />
        <RootNavigator />
      </AppProvider>
    </SafeAreaProvider>
  );
}
