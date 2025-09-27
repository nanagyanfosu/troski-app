import * as React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AppLanding from './App';

import HomeScreen from './components/HomeScreen';
import RouteDetails from './components/RouteDetails';
import RouteMapView from './components/RouteMapView';
import RouteResults from './components/RouteResults';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Landing" component={AppLanding} />
        <Stack.Screen name="HomeScreen" component={HomeScreen} />
  <Stack.Screen name="RouteResults" component={RouteResults} />
  <Stack.Screen name="RouteDetails" component={RouteDetails} />
  <Stack.Screen name="RouteMapView" component={RouteMapView} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
