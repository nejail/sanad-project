import React from 'react';
import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../viewModels/AppContext';
import { colors } from '../theme';
import { RootStackParamList, TabParamList } from './types';

import SplashView from '../views/auth/SplashView';
import LoginView from '../views/auth/LoginView';
import RegisterView from '../views/auth/RegisterView';
import VerifyOtpView from '../views/auth/VerifyOtpView';
import AddCarView from '../views/cars/AddCarView';
import HomeView from '../views/home/HomeView';
import MyCarsView from '../views/cars/MyCarsView';
import OrdersView from '../views/orders/OrdersView';
import ProfileView from '../views/profile/ProfileView';
import ServiceView from '../views/booking/ServiceView';
import SelectVehicleView from '../views/booking/SelectVehicleView';
import LocationView from '../views/booking/LocationView';
import ScheduleView from '../views/booking/ScheduleView';
import ReviewOrderView from '../views/booking/ReviewOrderView';
import OrderPlacedView from '../views/orders/OrderPlacedView';
import TrackOrderView from '../views/orders/TrackOrderView';
import MyAddressesView from '../views/profile/MyAddressesView';
import AddAddressView from '../views/profile/AddAddressView';
import FeasibilityTestsView from '../views/profile/FeasibilityTestsView';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.bg, card: colors.surface, primary: colors.primary, border: colors.border, text: colors.text },
};

const tabIcons: Record<keyof TabParamList, [React.ComponentProps<typeof Ionicons>['name'], string]> = {
  Home: ['home-outline', 'Home'],
  MyCars: ['car-outline', 'My Cars'],
  Orders: ['receipt-outline', 'Orders'],
  Profile: ['person-outline', 'Profile'],
};

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, height: 86, paddingTop: 8 },
        tabBarLabel: tabIcons[route.name][1],
        tabBarIcon: ({ color, size }) => <Ionicons name={tabIcons[route.name][0]} size={size} color={color} />,
      })}
    >
      <Tab.Screen name="Home" component={HomeView} />
      <Tab.Screen name="MyCars" component={MyCarsView} />
      <Tab.Screen name="Orders" component={OrdersView} />
      <Tab.Screen name="Profile" component={ProfileView} />
    </Tab.Navigator>
  );
}

/**
 * Entry flow agreed in the Sprint 2 supervision meeting:
 *  Splash -> (session found) Home with registered cars loaded
 *  Splash -> (no session) Sign in / Register -> OTP -> new user: Add First Car, returning user: Home
 */
export default function RootNavigator() {
  const { status, account } = useApp();
  const needsFirstCar = status === 'signedIn' && (account?.cars.length ?? 0) === 0;

  return (
    <NavigationContainer theme={theme}>
      <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'slide_from_right' }}>
        {status === 'loading' ? (
          <Stack.Screen name="Splash" component={SplashView} options={{ animation: 'fade' }} />
        ) : status === 'signedOut' ? (
          <Stack.Group screenOptions={{ animationTypeForReplace: 'pop' }}>
            <Stack.Screen name="Login" component={LoginView} options={{ animation: 'fade' }} />
            <Stack.Screen name="Register" component={RegisterView} />
            <Stack.Screen name="VerifyOtp" component={VerifyOtpView} />
          </Stack.Group>
        ) : (
          <Stack.Group>
            {needsFirstCar ? <Stack.Screen name="AddFirstCar" component={AddCarView} /> : null}
            <Stack.Screen name="Tabs" component={Tabs} options={{ animation: 'fade' }} />
            {!needsFirstCar ? <Stack.Screen name="AddFirstCar" component={AddCarView} /> : null}
            <Stack.Screen name="Service" component={ServiceView} />
            <Stack.Screen name="SelectVehicle" component={SelectVehicleView} />
            <Stack.Screen name="AddCar" component={AddCarView} />
            <Stack.Screen name="Location" component={LocationView} />
            <Stack.Screen name="Schedule" component={ScheduleView} />
            <Stack.Screen name="ReviewOrder" component={ReviewOrderView} />
            <Stack.Screen name="OrderPlaced" component={OrderPlacedView} options={{ gestureEnabled: false }} />
            <Stack.Screen name="TrackOrder" component={TrackOrderView} />
            <Stack.Screen name="MyAddresses" component={MyAddressesView} />
            <Stack.Screen name="AddAddress" component={AddAddressView} />
            <Stack.Screen name="FeasibilityTests" component={FeasibilityTestsView} />
          </Stack.Group>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
