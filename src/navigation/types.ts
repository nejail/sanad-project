import type { NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ServiceId } from '../models/types';

export type TabParamList = {
  Home: undefined;
  MyCars: undefined;
  Orders: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  // Loading
  Splash: undefined;
  // Signed out
  Login: undefined;
  Register: { phone?: string; verified?: boolean } | undefined;
  VerifyOtp: { phone: string; mode: 'signin' | 'register'; name?: string };
  // Signed in
  AddFirstCar: undefined;
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  Service: { serviceId: ServiceId };
  SelectVehicle: undefined;
  AddCar: { fromBooking?: boolean } | undefined;
  Location: undefined;
  Schedule: undefined;
  ReviewOrder: undefined;
  OrderPlaced: { orderId: string };
  TrackOrder: { orderId: string };
  MyAddresses: undefined;
  AddAddress: undefined;
  FeasibilityTests: undefined;
};

export type ScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, T>;
