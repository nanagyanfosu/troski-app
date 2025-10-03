// Polyfill for web crypto.getRandomValues used by modern `uuid` packages
// Provides a React Native implementation so uuid.v4() works correctly.
import 'react-native-get-random-values';

import { registerRootComponent } from 'expo';

import AppNavigator from './navigation';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(AppNavigator);
