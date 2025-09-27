import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Dimensions, SafeAreaView } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function RouteMapView({ route, navigation }) {
  const { routeInfo } = route.params || {};
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [routeData, setRouteData] = useState(null);
  const [fromLocation, setFromLocation] = useState(null);
  const [toLocation, setToLocation] = useState(null);
  const [polylineCoords, setPolylineCoords] = useState([]);
  const [travelTime, setTravelTime] = useState('');
  const [distance, setDistance] = useState('');

  useEffect(() => {
    const fetchDirections = async () => {
      try {
        setLoading(true);
        setError(null);
        const backendUrl = 'https://troski-backend.vercel.app/api/directions';
        const origin = encodeURIComponent(routeInfo?.origin || '');
        const destination = encodeURIComponent(routeInfo?.destination || '');
        const url = `${backendUrl}?origin=${origin}&destination=${destination}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch directions');
        const data = await response.json();
        setRouteData(data);

        const startLoc = data?.routes?.[0]?.legs?.[0]?.start_location;
        const endLoc = data?.routes?.[0]?.legs?.[0]?.end_location;
        if (startLoc && endLoc) {
          setFromLocation({ latitude: startLoc.lat, longitude: startLoc.lng });
          setToLocation({ latitude: endLoc.lat, longitude: endLoc.lng });
        }

        const polyline = data?.routes?.[0]?.overview_polyline?.points;
        if (polyline) {
          const decodePolyline = (t, e) => {
            let points = [];
            let index = 0, lat = 0, lng = 0;
            while (index < t.length) {
              let b, shift = 0, result = 0;
              do {
                b = t.charCodeAt(index++) - 63;
                result |= (b & 0x1f) << shift;
                shift += 5;
              } while (b >= 0x20);
              let dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
              lat += dlat;
              shift = 0;
              result = 0;
              do {
                b = t.charCodeAt(index++) - 63;
                result |= (b & 0x1f) << shift;
                shift += 5;
              } while (b >= 0x20);
              let dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
              lng += dlng;
              points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
            }
            return points;
          };
          setPolylineCoords(decodePolyline(polyline));
        }

        const time = data?.routes?.[0]?.legs?.[0]?.duration?.text;
        const dist = data?.routes?.[0]?.legs?.[0]?.distance?.text;
        setTravelTime(time || routeInfo?.duration || '');
        setDistance(dist || routeInfo?.distance || '');
      } catch (err) {
        setError(err.message);
        Alert.alert('Error', err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchDirections();
  }, [routeInfo]);

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1566d6" />
        <Text style={styles.loadingText}>Loading route...</Text>
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
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={screenWidth * 0.07} color="#222" />
          </TouchableOpacity>
          <Text style={styles.header}>Map View</Text>
          <View style={styles.placeholder} />
        </View>
        
        <MapView
          style={styles.map}
          initialRegion={fromLocation ? {
            latitude: fromLocation.latitude,
            longitude: fromLocation.longitude,
            latitudeDelta: 0.03,
            longitudeDelta: 0.03,
          } : {
            latitude: 5.6506,
            longitude: -0.1967,
            latitudeDelta: 0.03,
            longitudeDelta: 0.03,
          }}
        >
          {fromLocation && (
            <Marker coordinate={fromLocation} title="Start" />
          )}
          {toLocation && (
            <Marker coordinate={toLocation} title="Destination" />
          )}
          {polylineCoords.length > 0 && (
            <Polyline coordinates={polylineCoords} strokeWidth={4} strokeColor="#1566d6" />
          )}
        </MapView>
        
        {/* Bottom Card */}
        <View style={styles.bottomSheet}>
          <View style={styles.dragBar} />
          <Text style={styles.arrival}>
            {routeData?.routes?.[0]?.arrival_time?.text 
              ? `Arrives at ${routeData.routes[0].arrival_time.text}` 
              : `Arrival in ${travelTime || routeInfo?.duration || 'N/A'}`}
          </Text>
          
          {/* Row 1: Route title + bus icon */}
          <View style={styles.cardHeader}>
            <View style={styles.routeInfo}>
              <Text style={styles.routeNum}>{routeInfo?.routeNum || 'Route'}</Text>
              <Text style={styles.routeName}>{routeInfo?.name || ''}</Text>
            </View>
            <MaterialCommunityIcons name="bus" size={screenWidth * 0.095} color="#222" />
          </View>

          {/* Row 2: Left (origin/destination) + Right (time aligned with origin, distance aligned with destination) */}
          <View style={styles.routeDetails}>
            <View style={styles.locationsContainer}>
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={screenWidth * 0.045} color="#222" style={{ marginRight: 6 }} />
                <Text style={styles.value} numberOfLines={1}>{routeInfo?.origin || ''}</Text>
              </View>
              <View style={styles.dottedLine} />
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={screenWidth * 0.045} color="#222" style={{ marginRight: 6 }} />
                <Text style={styles.value} numberOfLines={1}>{routeInfo?.destination || ''}</Text>
              </View>
            </View>

            <View style={styles.metricsContainer}>
              <Text style={styles.metricsTime} numberOfLines={1}>
                {travelTime || routeInfo?.duration || 'N/A'}
              </Text>
              <Text style={styles.metricsDistance} numberOfLines={1}>
                {distance || routeInfo?.distance || ''}
              </Text>
            </View>
          </View>
        </View>
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
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: screenHeight * 0.015,
    paddingHorizontal: screenWidth * 0.05,
    paddingBottom: screenHeight * 0.04,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
    maxHeight: screenHeight * 0.55,
  },
  dragBar: {
    width: screenWidth * 0.15,
    height: 5,
    backgroundColor: '#ccc',
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: screenHeight * 0.01,
  },
  arrival: {
    fontSize: screenWidth * 0.045,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: screenHeight * 0.015,
    color: '#222',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: screenHeight * 0.015,
  },
  routeInfo: {
    flex: 1,
  },
  routeNum: {
    fontWeight: '600',
    fontSize: screenWidth * 0.04,
    marginBottom: 2,
    color: '#666',
  },
  routeName: {
    fontWeight: 'bold',
    fontSize: screenWidth * 0.065,
    marginBottom: 2,
    color: '#222',
  },
  routeDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'stretch',
  },
  locationsContainer: {
    flex: 1,
    marginRight: screenWidth * 0.04,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: screenHeight * 0.005,
  },
  value: {
    fontWeight: '500',
    fontSize: screenWidth * 0.042,
    color: '#222',
    flex: 1,
  },
  dottedLine: {
    width: 2,
    height: screenHeight * 0.04,
    backgroundColor: 'transparent',
    borderStyle: 'dotted',
    borderLeftWidth: 2,
    borderColor: '#bbb',
    alignSelf: 'flex-start',
    marginLeft: screenWidth * 0.015,
    marginVertical: screenHeight * 0.001,
  },
  metricsContainer: {
    alignItems: 'flex-end',
    justifyContent: 'space-evenly',
    alignSelf: 'stretch',
  },
  metricsTime: {
    fontSize: screenWidth * 0.035,
    fontWeight: '500',
    color: '#222',
    
  },
  metricsDistance: {
    fontSize: screenWidth * 0.035,
    color: '#666',
  },
  departureText: {
    fontSize: screenWidth * 0.03,
    color: '#888',
    marginTop: screenHeight * 0.003,
    fontStyle: 'italic',
  },
});