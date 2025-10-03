import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, SafeAreaView, ActivityIndicator, Animated, PanResponder } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function RouteResults({ route, navigation }) {
  const { origin, destination } = route.params || {};
  const [region, setRegion] = useState({
    latitude: 5.6506,
    longitude: -0.1967,
    latitudeDelta: 0.03,
    longitudeDelta: 0.03,
  });
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Bottom sheet config
  const MIN_HEIGHT = screenHeight * 0.28;   // collapsed (fits ~2 rows)
  const MAX_HEIGHT = screenHeight * 0.8;    // expanded (~80% of screen)
  const heightAnim = useRef(new Animated.Value(MIN_HEIGHT)).current;
  const startHeightRef = useRef(MIN_HEIGHT);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const fetchRoutes = async () => {
      try {
        setLoading(true);
        setError(null);
        const backendUrl = 'https://troski-backend.vercel.app/api/routes';
        const url = `${backendUrl}?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch routes');
        const data = await response.json();
        setRoutes(data.routes || []);
        if (data.routes && data.routes[0]?.start_location) {
          setRegion({
            latitude: data.routes[0].start_location.lat,
            longitude: data.routes[0].start_location.lng,
            latitudeDelta: 0.03,
            longitudeDelta: 0.03,
          });
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    if (origin && destination) fetchRoutes();
  }, [origin, destination]);

  const springTo = (target) => {
    startHeightRef.current = target;
    Animated.spring(heightAnim, {
      toValue: target,
      useNativeDriver: false,
      stiffness: 220,
      damping: 24,
      mass: 0.6,
    }).start(() => {
      setExpanded(target === MAX_HEIGHT);
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        heightAnim.stopAnimation((val) => {
          if (typeof val === 'number') startHeightRef.current = val;
        });
      },
      onPanResponderMove: (_evt, gestureState) => {
        const proposed = startHeightRef.current - gestureState.dy; // drag up -> dy<0 -> increase height
        const clamped = Math.max(MIN_HEIGHT, Math.min(proposed, MAX_HEIGHT));
        heightAnim.setValue(clamped);
      },
      onPanResponderRelease: (_evt, gestureState) => {
        const current = Math.max(MIN_HEIGHT, Math.min(startHeightRef.current - gestureState.dy, MAX_HEIGHT));
        const mid = (MIN_HEIGHT + MAX_HEIGHT) / 2;
        const biased = current - gestureState.vy * 40; // upward fling favors expand
        const target = biased < mid ? MAX_HEIGHT : MIN_HEIGHT;
        springTo(target);
      },
      onPanResponderTerminate: () => {
        const current = startHeightRef.current;
        const target = Math.abs(current - MAX_HEIGHT) < Math.abs(current - MIN_HEIGHT) ? MAX_HEIGHT : MIN_HEIGHT;
        springTo(target);
      },
    })
  ).current;

  const displayRoutes = expanded ? routes : routes.slice(0, 2);

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1566d6" />
        <Text style={styles.loadingText}>Loading available routes...</Text>
      </SafeAreaView>
    );
  }
  if (error) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.mapContainer}>
        <View style={styles.headerRow}>
                  <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={screenWidth * 0.07} color="#222" />
                  </TouchableOpacity>
                  <Text style={styles.header}>Map View</Text>
                  <View style={styles.placeholder} />
                </View>
        <MapView
          style={styles.map}
          region={region}
          showsUserLocation
          showsMyLocationButton
        >
          {routes.length > 0 && routes.map((r, idx) => (
            r?.start_location?.lat != null && r?.start_location?.lng != null ? (
              <Marker
                key={idx}
                coordinate={{ latitude: r.start_location.lat, longitude: r.start_location.lng }}
                title={r.name || `Route ${idx + 1}`}
                description={r.origin}
              />
            ) : null
          ))}
        </MapView>
        
        <Animated.View style={[styles.bottomSheet, { height: heightAnim }]}>
          <View
            style={styles.dragBar}
            {...panResponder.panHandlers}
          />
          <Text style={styles.chooseRoute}>Choose a Route</Text>
          
          {routes.length === 0 ? (
            <View style={styles.noRoutesContainer}>
              <Text style={styles.noRoutesText}>No routes found.</Text>
            </View>
          ) : (
            <View style={styles.routesList}>
              {displayRoutes.map((r, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.routeRow}
                  onPress={() => navigation.navigate('RouteDetails', { routeInfo: r })}
                  activeOpacity={0.85}
                >
                  <View style={styles.rowTop}>
                    <Text style={styles.routeTitle} numberOfLines={1}>
                      {r.name || `Route ${idx + 1}`}
                    </Text>
                    <Text style={styles.timeText} numberOfLines={1}>
                      {r.arrival_time?.text || r.timeRange || r.time || ''}
                    </Text>
                  </View>

                  <View style={styles.rowBottom}>
                    <View style={styles.routeMeta}>
                      <Ionicons name="git-compare-outline" size={screenWidth * 0.045} color="#888" />
                      <Text style={styles.kmText}>{r.distance || ''}</Text>
                    </View>

                    <View style={styles.timingMeta}>
                      {idx === 0 && (
                        <View style={styles.fastestBadge}>
                          <Ionicons name="flash" size={screenWidth * 0.03} color="#fff" />
                          <Text style={styles.fastestText}>Fastest</Text>
                        </View>
                      )}
                      <Ionicons name="time-outline" size={screenWidth * 0.04} color="#888" style={{ marginLeft: screenWidth * 0.02 }} />
                      <Text style={styles.minText}>{r.duration || r.time || ''}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}

              {routes.length > 2 && (
                <TouchableOpacity
                  style={styles.showMoreButton}
                  onPress={() => springTo(expanded ? MIN_HEIGHT : MAX_HEIGHT)}
                >
                  <Text style={styles.showMoreText}>
                    {expanded ? 'Show less' : `Show ${routes.length - 2} more routes`}
                  </Text>
                  <Ionicons name={expanded ? 'chevron-down' : 'chevron-up'} size={screenWidth * 0.04} color="#1566d6" />
                </TouchableOpacity>
              )}
            </View>
          )}
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  mapContainer: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: screenHeight * 0.01,
    paddingHorizontal: screenWidth * 0.04,
    backgroundColor: 'transparent',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    paddingBottom: screenHeight * 0.015,
  },
  backButton: {
    padding: screenWidth * 0.02,
  },
  header: {
    fontSize: screenWidth * 0.05,
    fontWeight: '600',
    textAlign: 'center',
    flex: 1,
  },
  placeholder: {
    width: screenWidth * 0.07,
  },
  map: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: screenHeight * 0.015,
    fontSize: screenWidth * 0.04,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: screenWidth * 0.05,
  },
  errorText: {
    color: 'red',
    fontSize: screenWidth * 0.04,
    textAlign: 'center',
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: screenHeight * 0.015,
    paddingHorizontal: screenWidth * 0.06,
    paddingBottom: screenHeight * 0.04,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
    overflow: 'hidden',
  },
  dragBar: {
    width: screenWidth * 0.18,
    height: 12,
    backgroundColor: '#ccc',
    borderRadius: 6,
    alignSelf: 'center',
    marginBottom: screenHeight * 0.01,
  },
  chooseRoute: {
    fontSize: screenWidth * 0.04,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: screenHeight * 0.02,
    color: '#222',
  },
  noRoutesContainer: {
    alignItems: 'center',
    paddingVertical: screenHeight * 0.03,
  },
  noRoutesText: {
    fontSize: screenWidth * 0.04,
    color: '#666',
  },
  routesList: {
    gap: screenHeight * 0.015,
  },
  routeRow: {
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    paddingVertical: screenHeight * 0.016,
    paddingHorizontal: screenWidth * 0.03,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: screenWidth * 0.03,
    marginBottom: screenHeight * 0.0065,
  },
  rowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  routeTitle: {
    flexShrink: 1,
    fontSize: screenWidth * 0.045,
    fontWeight: '500',
    color: '#222',
  },
  routeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  kmText: {
    color: '#888',
    fontSize: screenWidth * 0.04,
    marginLeft: screenWidth * 0.008,
  },
  timeText: {
    fontSize: screenWidth * 0.06,
    fontWeight: '500',
    color: '#222',
  },
  timingMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fastestBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1566d6',
    borderRadius: 25,
    paddingHorizontal: screenWidth * 0.015,
    paddingVertical: screenHeight * 0.0025,
    marginRight: screenWidth * 0.01,
  },
  fastestText: {
    color: '#fff',
    fontSize: screenWidth * 0.03,
    marginLeft: screenWidth * 0.005,
    fontWeight: '500',
  },
  minText: {
    color: '#888',
    fontSize: screenWidth * 0.04,
    marginLeft: screenWidth * 0.005,
  },
  showMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: screenHeight * 0.015,
    backgroundColor: '#f0f8ff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1566d6',
  },
  showMoreText: {
    color: '#1566d6',
    fontSize: screenWidth * 0.04,
    fontWeight: '500',
    marginRight: screenWidth * 0.01,
  },
});