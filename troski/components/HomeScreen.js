import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, Dimensions, SafeAreaView, ActivityIndicator, FlatList, TouchableWithoutFeedback } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function HomeScreen({ navigation }) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [locLabel, setLocLabel] = useState('Get current location');
  const [locLoading, setLocLoading] = useState(false);
  const [recentOrigins, setRecentOrigins] = useState([]);
  const [recentDestinations, setRecentDestinations] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [activeField, setActiveField] = useState(null); // 'from' | 'to' | null
  const suggestionsRef = useRef(null);

  const RECENT_ORIGINS_KEY = 'recent:origins';
  const RECENT_DESTINATIONS_KEY = 'recent:destinations';

  useEffect(() => {
    (async () => {
      try {
        const [o, d] = await Promise.all([
          AsyncStorage.getItem(RECENT_ORIGINS_KEY),
          AsyncStorage.getItem(RECENT_DESTINATIONS_KEY),
        ]);
        setRecentOrigins(o ? JSON.parse(o) : []);
        setRecentDestinations(d ? JSON.parse(d) : []);
      } catch (e) {
        // ignore
      }
    })();
  }, []);

  const persistRecents = async (key, list) => {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(list));
    } catch (e) {
      // ignore
    }
  };

  const saveToRecents = (key, listSetter, storageKey, value) => {
    if (!value || !value.trim()) return;
    listSetter(prev => {
      const deduped = [value.trim(), ...(prev || []).filter(i => i.toLowerCase() !== value.trim().toLowerCase())];
      const trimmed = deduped.slice(0, 10);
      persistRecents(storageKey, trimmed);
      return trimmed;
    });
  };

  const filterSuggestions = (query, forField) => {
    if (!query || query.trim().length === 0) return forField === 'from' ? recentOrigins : recentDestinations;
    const list = forField === 'from' ? recentOrigins : recentDestinations;
    const q = query.trim().toLowerCase();
    return list.filter(item => item.toLowerCase().includes(q));
  };

  const formatAddress = (place) => {
    const parts = [
      place.name || place.street || '',
      place.city || place.subregion || '',
      place.region || '',
      place.country || '',
    ].filter(Boolean);
    return parts.join(', ');
  };

  const handleGetLocation = () => {
    Alert.alert(
      'Location Permission',
      'Allow troski to access your location?',
      [
        { text: 'Deny', style: 'cancel' },
        {
          text: 'Allow',
          onPress: async () => {
            try {
              setLocLoading(true);
              const servicesEnabled = await Location.hasServicesEnabledAsync();
              if (!servicesEnabled) {
                setLocLoading(false);
                Alert.alert('Turn on Location', 'Please enable Location Services to continue.');
                return;
              }

              const { status } = await Location.requestForegroundPermissionsAsync();
              if (status !== 'granted') {
                setLocLoading(false);
                Alert.alert('Permission Denied', 'Location permission was not granted.');
                return;
              }

              const position = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
                mayShowUserSettingsDialog: true,
              });
              const { latitude, longitude } = position.coords;

              const places = await Location.reverseGeocodeAsync({ latitude, longitude });
              const label =
                (places && places.length > 0 && formatAddress(places[0])) ||
                `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;

              setLocLabel(label);
              if (!from) setFrom(label);
            } catch (e) {
              Alert.alert('Location Error', e?.message || 'Unable to get current location.');
            } finally {
              setLocLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleFindRoutes = () => {
    if (!from || !to) {
      Alert.alert('Please enter both origin and destination');
      return;
    }
    // persist to recents
    saveToRecents(RECENT_ORIGINS_KEY, setRecentOrigins, RECENT_ORIGINS_KEY, from);
    saveToRecents(RECENT_DESTINATIONS_KEY, setRecentDestinations, RECENT_DESTINATIONS_KEY, to);
    setActiveField(null);
    setSuggestions([]);
    navigation.navigate('RouteResults', { origin: from, destination: to });
  };

  return (
    <TouchableWithoutFeedback onPress={() => { setActiveField(null); setSuggestions([]); }}>
      <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.troski}>troski</Text>

        <TouchableOpacity style={styles.locationRow} onPress={handleGetLocation} disabled={locLoading}>
          <Ionicons name="locate-outline" size={24} color="#222" style={{ marginRight: 8 }} />
          {locLoading ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <ActivityIndicator size="small" color="#222" style={{ marginRight: 8 }} />
              <Text style={[styles.locationText, { opacity: 0.7 }]}>Getting location…</Text>
            </View>
          ) : (
            <Text style={styles.locationText} numberOfLines={1} ellipsizeMode="tail">{locLabel}</Text>
          )}
        </TouchableOpacity>

  <View style={styles.centerContent}>
          <View style={styles.inputCard}>
            <View style={styles.inputRow}>
              <Ionicons name="location-outline" size={22} color="#222" style={{ marginRight: 8 }} />
              <View style={{ flex: 1 }}>
                <TextInput
                  style={styles.input}
                  placeholder="From"
                  placeholderTextColor="#aaa"
                  value={from}
                  onChangeText={(text) => {
                    setFrom(text);
                    setSuggestions(filterSuggestions(text, 'from'));
                    setActiveField('from');
                  }}
                  onFocus={() => {
                    setSuggestions(filterSuggestions(from, 'from'));
                    setActiveField('from');
                  }}
                />
                {activeField === 'from' && suggestions && suggestions.length > 0 && (
                  <View style={styles.suggestionsCard} ref={suggestionsRef}>
                    <FlatList
                      keyboardShouldPersistTaps="handled"
                      data={suggestions}
                      keyExtractor={(item, idx) => `${item}-${idx}`}
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          style={styles.suggestionItem}
                          onPress={() => {
                            setFrom(item);
                            setActiveField(null);
                            setSuggestions([]);
                            saveToRecents(RECENT_ORIGINS_KEY, setRecentOrigins, RECENT_ORIGINS_KEY, item);
                          }}
                        >
                          <Text style={styles.suggestionText}>{item}</Text>
                        </TouchableOpacity>
                      )}
                    />
                  </View>
                )}
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.inputRow}>
              <Ionicons name="location-outline" size={22} color="#222" style={{ marginRight: 8 }} />
              <View style={{ flex: 1 }}>
                <TextInput
                  style={styles.input}
                  placeholder="To"
                  placeholderTextColor="#aaa"
                  value={to}
                  onChangeText={(text) => {
                    setTo(text);
                    setSuggestions(filterSuggestions(text, 'to'));
                    setActiveField('to');
                  }}
                  onFocus={() => {
                    setSuggestions(filterSuggestions(to, 'to'));
                    setActiveField('to');
                  }}
                />
                {activeField === 'to' && suggestions && suggestions.length > 0 && (
                  <View style={styles.suggestionsCard}>
                    <FlatList
                      keyboardShouldPersistTaps="handled"
                      data={suggestions}
                      keyExtractor={(item, idx) => `${item}-${idx}`}
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          style={styles.suggestionItem}
                          onPress={() => {
                            setTo(item);
                            setActiveField(null);
                            setSuggestions([]);
                            saveToRecents(RECENT_DESTINATIONS_KEY, setRecentDestinations, RECENT_DESTINATIONS_KEY, item);
                          }}
                        >
                          <Text style={styles.suggestionText}>{item}</Text>
                        </TouchableOpacity>
                      )}
                    />
                  </View>
                )}
              </View>
            </View>
          </View>

          <TouchableOpacity style={styles.button} onPress={handleFindRoutes}>
            <Text style={styles.buttonText}>Find Routes</Text>
          </TouchableOpacity>
        </View>
      </View>
            </SafeAreaView>
            </TouchableWithoutFeedback>
          );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingTop: screenHeight * 0.025,
    paddingHorizontal: 20,
  },
  centerContent: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: screenHeight * 0.1,
  },
  troski: {
    fontFamily: 'NanumPenScript-Regular',
    fontSize: screenWidth * 0.08,
    marginBottom: screenHeight * 0.04,
    alignSelf: 'center',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: screenHeight * 0.05,
    paddingHorizontal: 20,
  },
  locationText: {
    fontSize: screenWidth * 0.045,
    color: '#222',

  },
  inputCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#f7f6f6',
    borderRadius: 20,
    padding: screenWidth * 0.04,
    marginBottom: screenHeight * 0.03,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: screenWidth * 0.01,
    marginBottom: 0,
  },
  input: {
    flex: 1,
    fontSize: screenWidth * 0.045,
    color: '#222',
  },
  suggestionsCard: {
    position: 'absolute',
    top: screenHeight * 0.065,
    left: 0,
    right: 0,
    maxHeight: screenHeight * 0.22,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 50,
  },
  suggestionItem: {
    paddingVertical: screenHeight * 0.012,
    paddingHorizontal: screenWidth * 0.035,
  },
  suggestionText: {
    fontSize: screenWidth * 0.04,
    color: '#222',
  },
  divider: {
    height: 1,
    backgroundColor: '#ccc',
    marginVertical: screenHeight * 0.01,
    marginLeft: screenWidth * 0.08,
  },
  button: {
    width: '100%',
    maxWidth: 200,
    backgroundColor: '#4d90fe',
    paddingVertical: screenHeight * 0.015,
    borderRadius: 12,
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: screenHeight * 0.015,
  },
  buttonText: {
    color: '#fff',
    fontSize: screenWidth * 0.045,
    fontWeight: '500',
  },
});