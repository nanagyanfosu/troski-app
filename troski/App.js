
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { useFonts } from 'expo-font';
import colors from './assets/colors/colors';
import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';


export default function App({ navigation }) {
  const [fontsLoaded] = useFonts({
    'PlusJakartaSans-Regular': require('./assets/fonts/PlusJakartaSans-Regular.ttf'),
    'NanumPenScript-Regular': require('./assets/fonts/NanumPenScript-Regular.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded) {
      const timer = setTimeout(() => {
        if (navigation) {
          navigation.replace('HomeScreen');
        }
      }, 2000); // 2 seconds delay
      return () => clearTimeout(timer);
    }
  }, [fontsLoaded, navigation]);

  if (!fontsLoaded) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* <Ionicons name="bus-outline" size={30} color={colors.primary} /> */}
      <Text style={styles.text}>troski</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.basic,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 40,   
    fontFamily: 'NanumPenScript-Regular', // Add this line
  }
});
