import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, Dimensions, SafeAreaView, ActivityIndicator, FlatList, TouchableWithoutFeedback } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { autocompletePlaces, getPlaceDetails } from '../services/places';
import { v4 as uuidv4 } from 'uuid';

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
  const [sessionToken, setSessionToken] = useState(null);
  const [remotePredictions, setRemotePredictions] = useState([]);
  const typingTimerRef = useRef(null);
  const [lastDeleted, setLastDeleted] = useState(null); // { field, item }
  const undoTimerRef = useRef(null);
  const [undoVisible, setUndoVisible] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [o, d] = await Promise.all([
          AsyncStorage.getItem(RECENT_ORIGINS_KEY),
          AsyncStorage.getItem(RECENT_DESTINATIONS_KEY),
        ]);
        const parsedO = o ? JSON.parse(o) : [];
        const parsedD = d ? JSON.parse(d) : [];
        // normalize legacy string entries to objects { label }
        const norm = list => list.map(item => (typeof item === 'string' ? { label: item } : item));
        setRecentOrigins(norm(parsedO));
        setRecentDestinations(norm(parsedD));
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
    // value may be a string label or an object { label, lat, lng }
    const entry = typeof value === 'string' ? { label: value.trim() } : value;
    listSetter(prev => {
      const prevList = prev || [];
      const filtered = prevList.filter(i => (i.label || '').toLowerCase() !== (entry.label || '').toLowerCase());
      const deduped = [entry, ...filtered];
      const trimmed = deduped.slice(0, 10);
      persistRecents(storageKey, trimmed);
      return trimmed;
    });
  };

  const filterSuggestions = (query, forField) => {
    // return merged list: remotePredictions (labels) then local recents
    if (!query || query.trim().length === 0) {
      return forField === 'from' ? recentOrigins : recentDestinations;
    }
    const q = query.trim().toLowerCase();
    const remote = remotePredictions.filter(p => (p.description || '').toLowerCase().includes(q));
    const localList = (forField === 'from' ? recentOrigins : recentDestinations).filter(item => (item.label || '').toLowerCase().includes(q));
    // map remote to uniform object shape
    const remoteMapped = remote.map(r => ({ label: r.description, placeId: r.place_id, isRemote: true }));
    return [...remoteMapped, ...localList];
  };

  // debounce and fetch remote predictions
  const scheduleRemoteFetch = (input) => {
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    if (!input || input.trim().length === 0) {
      setRemotePredictions([]);
      return;
    }
    typingTimerRef.current = setTimeout(async () => {
      try {
        // ensure a session token per user entry series
        const token = sessionToken || uuidv4();
        setSessionToken(token);
        const data = await autocompletePlaces(input, token);
        setRemotePredictions(data.predictions || []);
      } catch (e) {
        console.warn('Places autocomplete failed', e);
      }
    }, 300);
  };

  const getQueryForField = (field) => (field === 'from' ? from : to);

  const highlightMatch = (text, q) => {
    if (!q) return <Text style={styles.suggestionText}>{text}</Text>;
    const lower = text.toLowerCase();
    const idx = lower.indexOf(q.trim().toLowerCase());
    if (idx === -1) return <Text style={styles.suggestionText}>{text}</Text>;
    const before = text.slice(0, idx);
    const match = text.slice(idx, idx + q.length);
    const after = text.slice(idx + q.length);
    return (
      <Text style={styles.suggestionText} numberOfLines={1}>
        {before}
        <Text style={styles.suggestionMatch}>{match}</Text>
        {after}
      </Text>
    );
  };

  const renderSuggestions = (field) => {
    const q = getQueryForField(field);
    return (
      <View style={styles.suggestionsCard}>
        <FlatList
          keyboardShouldPersistTaps="handled"
          data={suggestions}
          keyExtractor={(item, idx) => `${item.label || item.description}-${idx}`}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.suggestionItemRow}
              onPress={async () => {
                if (item.isRemote || item.placeId) {
                  try {
                    const details = await getPlaceDetails(item.placeId || item.place_id, sessionToken);
                    const place = details?.result;
                    const label = place?.formatted_address || item.description || item.label;
                    const lat = place?.geometry?.location?.lat;
                    const lng = place?.geometry?.location?.lng;
                    const entry = { label, lat, lng };
                    if (field === 'from') {
                      setFrom(label);
                      saveToRecents(RECENT_ORIGINS_KEY, setRecentOrigins, RECENT_ORIGINS_KEY, entry);
                    } else {
                      setTo(label);
                      saveToRecents(RECENT_DESTINATIONS_KEY, setRecentDestinations, RECENT_DESTINATIONS_KEY, entry);
                    }
                  } catch (e) {
                    console.warn('place details failed', e);
                    if (field === 'from') {
                      setFrom(item.description || item.label);
                      saveToRecents(RECENT_ORIGINS_KEY, setRecentOrigins, RECENT_ORIGINS_KEY, { label: item.description || item.label });
                    } else {
                      setTo(item.description || item.label);
                      saveToRecents(RECENT_DESTINATIONS_KEY, setRecentDestinations, RECENT_DESTINATIONS_KEY, { label: item.description || item.label });
                    }
                  }
                } else {
                  if (field === 'from') {
                    setFrom(item.label);
                    saveToRecents(RECENT_ORIGINS_KEY, setRecentOrigins, RECENT_ORIGINS_KEY, item);
                  } else {
                    setTo(item.label);
                    saveToRecents(RECENT_DESTINATIONS_KEY, setRecentDestinations, RECENT_DESTINATIONS_KEY, item);
                  }
                }
                setActiveField(null);
                setSuggestions([]);
              }}
            >
              <View style={styles.suggestionLeft}>
                <Ionicons
                  name={item.isRemote ? 'location-sharp' : 'time-outline'}
                  size={18}
                  color={item.isRemote ? '#4d90fe' : '#888'}
                />
              </View>
              <View style={styles.suggestionBody}>
                {highlightMatch(item.description || item.label, q)}
                <Text style={styles.suggestionMeta}>{item.isRemote ? 'Places' : 'Recent'}</Text>
              </View>
              {/* If local recent, show a small delete button; otherwise show chevron */}
              {!item.isRemote ? (
                <TouchableOpacity
                  onPress={() => {
                    // remove this recent entry
                    removeRecent(field, item);
                  }}
                  style={styles.removeButton}
                >
                  <Ionicons name="close-circle" size={20} color="#d23f3f" />
                </TouchableOpacity>
              ) : (
                <Ionicons name="chevron-forward" size={18} color="#bbb" />
              )}
            </TouchableOpacity>
          )}
        />
      </View>
    );
  };

  // remove a recent item from storage and update state
  const removeRecent = (field, item) => {
    const label = (item && (item.label || item.description || ''));
    if (!label) return;
    // clear any existing undo timer and finalize previous deletions
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }

    if (field === 'from') {
      setRecentOrigins(prev => {
        const next = (prev || []).filter(i => (i.label || '').toLowerCase() !== label.toLowerCase());
        persistRecents(RECENT_ORIGINS_KEY, next);
        // also update suggestions if currently shown
        setSuggestions(s => (s || []).filter(x => (x.label || x.description || '').toLowerCase() !== label.toLowerCase()));
        // show undo affordance
        setLastDeleted({ field, item });
        setUndoVisible(true);
        // start timer to finalize delete
        undoTimerRef.current = setTimeout(() => {
          setLastDeleted(null);
          setUndoVisible(false);
          undoTimerRef.current = null;
        }, 5000);
        return next;
      });
    } else {
      setRecentDestinations(prev => {
        const next = (prev || []).filter(i => (i.label || '').toLowerCase() !== label.toLowerCase());
        persistRecents(RECENT_DESTINATIONS_KEY, next);
        setSuggestions(s => (s || []).filter(x => (x.label || x.description || '').toLowerCase() !== label.toLowerCase()));
        setLastDeleted({ field, item });
        setUndoVisible(true);
        undoTimerRef.current = setTimeout(() => {
          setLastDeleted(null);
          setUndoVisible(false);
          undoTimerRef.current = null;
        }, 5000);
        return next;
      });
    }
  };

  const handleUndo = () => {
    if (!lastDeleted) return;
    const { field, item } = lastDeleted;
    // re-insert at top and persist
    const entry = typeof item === 'string' ? { label: item } : item;
    if (field === 'from') {
      setRecentOrigins(prev => {
        const filtered = (prev || []).filter(i => (i.label || '').toLowerCase() !== (entry.label || '').toLowerCase());
        const next = [entry, ...filtered].slice(0, 10);
        persistRecents(RECENT_ORIGINS_KEY, next);
        // also update suggestions list if open
        setSuggestions(s => {
          const cur = s || [];
          const without = cur.filter(x => (x.label || x.description || '').toLowerCase() !== (entry.label || '').toLowerCase());
          return [entry, ...without];
        });
        return next;
      });
    } else {
      setRecentDestinations(prev => {
        const filtered = (prev || []).filter(i => (i.label || '').toLowerCase() !== (entry.label || '').toLowerCase());
        const next = [entry, ...filtered].slice(0, 10);
        persistRecents(RECENT_DESTINATIONS_KEY, next);
        setSuggestions(s => {
          const cur = s || [];
          const without = cur.filter(x => (x.label || x.description || '').toLowerCase() !== (entry.label || '').toLowerCase());
          return [entry, ...without];
        });
        return next;
      });
    }

    // clear undo state
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    setLastDeleted(null);
    setUndoVisible(false);
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
                    scheduleRemoteFetch(text);
                    setSuggestions(filterSuggestions(text, 'from'));
                    setActiveField('from');
                  }}
                  onFocus={() => {
                    setSuggestions(filterSuggestions(from, 'from'));
                    setActiveField('from');
                  }}
                />
                {activeField === 'from' && suggestions && suggestions.length > 0 && renderSuggestions('from')}
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
                    scheduleRemoteFetch(text);
                    setSuggestions(filterSuggestions(text, 'to'));
                    setActiveField('to');
                  }}
                  onFocus={() => {
                    setSuggestions(filterSuggestions(to, 'to'));
                    setActiveField('to');
                  }}
                />
                {activeField === 'to' && suggestions && suggestions.length > 0 && renderSuggestions('to')}
              </View>
            </View>
          </View>

          <TouchableOpacity style={styles.button} onPress={handleFindRoutes}>
            <Text style={styles.buttonText}>Find Routes</Text>
          </TouchableOpacity>
        </View>
      </View>
        {undoVisible && (
          <View style={styles.undoBarContainer} pointerEvents="box-none">
            <View style={styles.undoBar}>
              <Text style={styles.undoText}>Removed "{(lastDeleted && (lastDeleted.item.label || lastDeleted.item.description)) || ''}"</Text>
              <TouchableOpacity onPress={handleUndo} style={styles.undoButton}>
                <Text style={styles.undoButtonText}>Undo</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
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
    marginBottom: screenHeight * 0.005,
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
    position: 'relative',
    marginTop: 8,
    maxHeight: screenHeight * 0.3,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 50,
  },
  suggestionItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: screenHeight * 0.012,
    paddingHorizontal: screenWidth * 0.035,
    borderBottomColor: '#f1f1f1',
    borderBottomWidth: 1,
  },
  suggestionLeft: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionBody: {
    flex: 1,
    paddingRight: 8,
  },
  removeButton: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 6,
  },
  undoBarContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 20,
    alignItems: 'center',
    zIndex: 100,
  },
  undoBar: {
    backgroundColor: '#222',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 260,
    maxWidth: 520,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 10,
  },
  undoText: {
    color: '#fff',
    flex: 1,
    marginRight: 12,
  },
  undoButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  undoButtonText: {
    color: '#222',
    fontWeight: '600',
  },
  suggestionText: {
    fontSize: screenWidth * 0.042,
    color: '#222',
  },
  suggestionMatch: {
    backgroundColor: 'rgba(77,144,254,0.12)',
    color: '#1776ff',
    fontWeight: '600',
  },
  suggestionMeta: {
    marginTop: 2,
    fontSize: screenWidth * 0.032,
    color: '#888',
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