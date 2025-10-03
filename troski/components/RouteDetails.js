import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Dimensions, SafeAreaView, Animated, Easing } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function RouteDetails({ route, navigation }) {
  const { routeInfo } = route.params || {};

  const [notifyEnabled, setNotifyEnabled] = useState(false);
  const [storedNotifyPref, setStoredNotifyPref] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('info'); // info | success | warning | error
  const toastAnim = useRef(new Animated.Value(0)).current;
  const pollRef = useRef(null);
  const prevTrafficRef = useRef(routeInfo?.traffic ?? null);
  const getStorageKey = () => {
    return routeInfo ? `notify:route:${routeInfo.id ?? routeInfo.name ?? routeInfo.routeNum ?? 'unknown'}` : null;
  };
  const handleNotificationPress = () => {
    if (!notifyEnabled) {
      Alert.alert(
        'App Would Like to Send You Route Notifications',
        'Notifications may include alerts, sounds, and icon badges to help you stay updated on your trotro route status',
        [
          { text: "Don't Allow", style: 'cancel' },
          { text: 'Allow', onPress: () => enableNotifications() },
        ]
      );
    } else {
      disableNotifications();
    }
  };

  const showToast = (message, type = 'info', duration = 3500) => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
    Animated.timing(toastAnim, {
      toValue: 1,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    if (duration > 0) {
      setTimeout(() => {
        Animated.timing(toastAnim, {
          toValue: 0,
          duration: 250,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }).start(() => setToastVisible(false));
      }, duration);
    }
  };

  // Push setup: request permission, get token and send to backend
  const registerForPushNotificationsAsync = async () => {
    try {
      if (!Device.isDevice) {
        console.warn('Must use physical device for Push Notifications');
        return null;
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        showToast('Push notifications permission not granted', 'warning');
        return null;
      }

      const tokenData = await Notifications.getExpoPushTokenAsync();
      const token = tokenData?.data;
      if (token) {
        // send token to backend for this user/route so server can push when traffic changes
        try {
          const backend = 'https://troski-backend.vercel.app/api/push/register';
          await fetch(backend, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, route: { id: routeInfo?.id, name: routeInfo?.name, routeNum: routeInfo?.routeNum } }),
          });
        } catch (e) {
          // ignore network errors here; backend sample provided
        }
      }
      return token;
    } catch (err) {
      console.warn('Push registration failed', err);
      return null;
    }
  };

  // When a traffic change is detected, also create a local notification so the user gets OS-level alert
  const notifyLocally = async (title, body) => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: { title, body, data: { routeId: routeInfo?.id } },
        trigger: null,
      });
    } catch (e) {
      // ignore
    }
  };

  const enableNotifications = () => {
    (async () => {
      try {
        // Request permission and register for push token (if available) before enabling
        await registerForPushNotificationsAsync();
        setNotifyEnabled(true);
        const key = getStorageKey();
        if (key) await AsyncStorage.setItem(key, '1');
        setStoredNotifyPref(true);
        showToast('Route notifications enabled — We will watch for traffic changes', 'success');
        startTrafficPolling();
      } catch (e) {
        console.warn('enableNotifications error', e);
      }
    })();
  };

  const disableNotifications = () => {
    setNotifyEnabled(false);
    (async () => {
      try {
        const key = getStorageKey();
        if (key) await AsyncStorage.setItem(key, '0');
      } catch (e) {
        // ignore storage errors
      }
    })();
    showToast('Route notifications disabled', 'info');
    stopTrafficPolling();
  };

  useEffect(() => {
    // load persisted preference per-route and start polling if enabled
    let mounted = true;
    (async () => {
      try {
        const key = getStorageKey();
        if (!key) return;
        const v = await AsyncStorage.getItem(key);
        if (mounted && v != null) {
          const enabled = v === '1';
          // persist the stored preference but do not auto-enable. User must explicitly allow.
          setStoredNotifyPref(enabled);
        }
      } catch (e) {
        // ignore
      }
    })();

    return () => {
      mounted = false;
      stopTrafficPolling();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeInfo]);

  const backendFetchLatestRoute = async () => {
    try {
      // Use origin/destination to fetch latest route info (backend used elsewhere in app)
      const backendUrl = 'https://troski-backend.vercel.app/api/routes';
      const origin = routeInfo?.origin || routeInfo?.start || '';
      const destination = routeInfo?.destination || routeInfo?.end || '';
      if (!origin || !destination) return null;
      const url = `${backendUrl}?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`;
      const response = await fetch(url);
      if (!response.ok) return null;
      const data = await response.json();
      const routes = data.routes || [];
      // try to find the same route by id/name/routeNum; otherwise return the first
      const match = routes.find(r => (routeInfo?.id && r.id === routeInfo.id) || (r.name && routeInfo?.name && r.name === routeInfo.name) || (r.routeNum && routeInfo?.routeNum && r.routeNum === routeInfo.routeNum));
      return match || routes[0] || null;
    } catch (err) {
      // silent fail for polling
      return null;
    }
  };

  const startTrafficPolling = () => {
    // Avoid duplicate intervals
    if (pollRef.current) return;
    // immediate check
    (async () => {
      const latest = await backendFetchLatestRoute();
      if (latest?.traffic) {
        prevTrafficRef.current = latest.traffic;
      }
    })();

    pollRef.current = setInterval(async () => {
      const latest = await backendFetchLatestRoute();
      if (!latest || !latest.traffic) return;
      const prev = prevTrafficRef.current;
      const curr = latest.traffic;
      // simple comparison — look for severity change or delay change
      const severityChanged = prev?.severity !== curr?.severity;
      const delayChanged = prev?.delay_minutes !== curr?.delay_minutes || prev?.duration_in_traffic !== curr?.duration_in_traffic;
      if (severityChanged || delayChanged) {
        prevTrafficRef.current = curr;
        // show an in-app notification
        const title = severityChanged ? `Traffic now ${curr.severity}` : 'Traffic update';
        const msg = curr.message || `Delay: ${curr.delay_minutes ?? ''} min`;
        showToast(`${title}: ${msg}`, severityChanged ? 'warning' : 'info', 5000);
        // local OS notification
        notifyLocally(title, msg);
        // For elevated alerts, also show an Alert to make sure user notices (optional)
        if ((curr.severity === 'moderate' || curr.severity === 'heavy') && notifyEnabled) {
          Alert.alert(`Traffic alert — ${curr.severity.toUpperCase()}`, msg, [{ text: 'OK' }]);
        }
      }
    }, 30000); // poll every 30s
  };

  const stopTrafficPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const severityKey = routeInfo?.traffic?.severity
    ? routeInfo.traffic.severity.charAt(0).toUpperCase() + routeInfo.traffic.severity.slice(1)
    : null;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={screenWidth * 0.07} color="#222" />
          </TouchableOpacity>
          <Text style={styles.header}>Route Details</Text>
          <TouchableOpacity onPress={handleNotificationPress}>
            <Ionicons
              name={notifyEnabled ? 'notifications' : 'notifications-outline'}
              size={screenWidth * 0.065}
              color={notifyEnabled ? '#000' : '#222'}
            />
          </TouchableOpacity>
        </View>
        
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.routeInfo}>
              <Text style={styles.routeNum}>{routeInfo?.routeNum || 'Route'}</Text>
              <Text style={styles.routeName}>{routeInfo?.name || ''}</Text>
            </View>
            <MaterialCommunityIcons name="bus" size={screenWidth * 0.095} color="#222" />
          </View>
          
          <View style={styles.detailsGrid}>
            <View style={styles.detailRow}>
              <View style={styles.detailItem}>
                <Text style={styles.label}>Origin</Text>
                <Text style={styles.value}>{routeInfo?.origin || ''}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.label}>Destination</Text>
                <Text style={styles.value}>{routeInfo?.destination || ''}</Text>
              </View>
            </View>
            
            <View style={styles.detailRow}>
              <View style={styles.detailItem}>
                <Text style={styles.label}>Total Time</Text>
                <Text style={styles.value}>{routeInfo?.duration || routeInfo?.time || ''}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.label}>Distance</Text>
                <Text style={styles.value}>{routeInfo?.distance || ''}</Text>
              </View>
            </View>
            
            <View style={styles.detailRow}>
              <View style={styles.detailItem}>
                <Text style={styles.label}>Arrival Time</Text>
                <Text style={styles.value}>{routeInfo?.arrival_time?.text || ''}</Text>
              </View>
            </View>

            {routeInfo?.stops && (
              <View style={styles.detailRow}>
                <View style={styles.detailItem}>
                  <Text style={styles.label}>Stops</Text>
                  <Text style={styles.value}>{routeInfo.stops}</Text>
                </View>
              </View>
            )}
            
            {routeInfo?.arrival && (
              <View style={styles.detailRow}>
                <View style={styles.detailItem}>
                  <Text style={styles.label}>Arrival</Text>
                  <Text style={styles.value}>{routeInfo.arrival}</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {routeInfo?.traffic && (
          <View style={[
            styles.trafficInfoBox,
            severityKey ? styles[`trafficInfoBox${severityKey}`] : null
          ]}>
            <View style={styles.trafficHeader}>
              <Ionicons 
                name={routeInfo.traffic.severity === 'clear' ? 'checkmark-circle' : 
                      routeInfo.traffic.severity === 'light' ? 'warning' : 
                      routeInfo.traffic.severity === 'moderate' ? 'alert-circle' : 'alert-circle-outline'} 
                size={20} 
                color={routeInfo.traffic.severity === 'clear' ? '#4CAF50' : 
                       routeInfo.traffic.severity === 'light' ? '#FF9800' : 
                       routeInfo.traffic.severity === 'moderate' ? '#FF5722' : '#F44336'} 
              />
              <Text style={[
                styles.trafficTitle,
                severityKey ? styles[`trafficTitle${severityKey}`] : null
              ]}>
                Traffic Conditions
              </Text>
            </View>
            <Text style={styles.trafficMessage}>{routeInfo.traffic.message}</Text>
            {routeInfo.traffic.has_traffic && (
              <View style={styles.trafficDetails}>
                <Text style={styles.trafficDetailText}>
                  Normal time: {routeInfo.traffic.normal_duration}
                </Text>
                <Text style={styles.trafficDetailText}>
                  With traffic: {routeInfo.traffic.duration_in_traffic}
                </Text>
                <Text style={styles.trafficDetailText}>
                  Delay: +{routeInfo.traffic.delay_minutes} minutes
                </Text>
              </View>
            )}
          </View>
        )}
        
        <View style={styles.bottomSection}>
          <TouchableOpacity
            style={styles.mapBtn}
            onPress={() => navigation.navigate('RouteMapView', { routeInfo })}
            activeOpacity={0.85}
          >
            <Ionicons name="map-outline" size={screenWidth * 0.055} color="#222" style={{ marginRight: 8 }} />
            <Text style={styles.mapBtnText}>View on Map</Text>
          </TouchableOpacity>
        </View>
        {/* In-app toast */}
        {toastVisible && (
          <Animated.View
            pointerEvents="box-none"
            style={[
              styles.toast,
              toastType === 'success' ? styles.toastSuccess : toastType === 'warning' ? styles.toastWarning : toastType === 'error' ? styles.toastError : styles.toastInfo,
              { transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }], opacity: toastAnim }
            ]}
          >
            <Text style={styles.toastText} numberOfLines={2}>{toastMessage}</Text>
            <TouchableOpacity onPress={() => {
              Animated.timing(toastAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setToastVisible(false));
            }}>
              <Ionicons name="close" size={18} color="#fff" style={{ marginLeft: 10 }} />
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    paddingHorizontal: screenWidth * 0.04,
    paddingBottom: screenHeight * 0.14, // room for bottom button near home indicator
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: screenHeight * 0.02,
    marginBottom: screenHeight * 0.02,
  },
  header: {
    fontSize: screenWidth * 0.06,
    fontWeight: '500',
    textAlign: 'center',
    flex: 1,
  },
  card: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: screenWidth * 0.045,
    marginBottom: screenHeight * 0.02,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: screenHeight * 0.02,
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
  detailsGrid: {
    gap: screenHeight * 0.015,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: screenWidth * 0.04,
  },
  detailItem: {
    flex: 1,
  },
  label: {
    color: '#444',
    fontSize: screenWidth * 0.038,
    marginBottom: 4,
    fontWeight: '500',
  },
  value: {
    fontWeight: '500',
    fontSize: screenWidth * 0.042,
    color: '#222',
  },
  // Separate traffic alert card (now outside the main card)
  trafficInfoBox: {
    borderRadius: 12,
    padding: screenWidth * 0.04,
    marginBottom: screenHeight * 0.02,
    borderLeftWidth: 4,
  },
  trafficInfoBoxClear: {
    backgroundColor: '#E8F5E8',
    borderLeftColor: '#4CAF50',
  },
  trafficInfoBoxLight: {
    backgroundColor: '#FFF3E0',
    borderLeftColor: '#FF9800',
  },
  trafficInfoBoxModerate: {
    backgroundColor: '#FFEBEE',
    borderLeftColor: '#FF5722',
  },
  trafficInfoBoxHeavy: {
    backgroundColor: '#FCE4EC',
    borderLeftColor: '#F44336',
  },
  trafficHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: screenHeight * 0.01,
  },
  trafficTitle: {
    fontSize: screenWidth * 0.045,
    fontWeight: '600',
    marginLeft: screenWidth * 0.02,
  },
  trafficTitleClear: {
    color: '#2E7D32',
  },
  trafficTitleLight: {
    color: '#F57C00',
  },
  trafficTitleModerate: {
    color: '#D32F2F',
  },
  trafficTitleHeavy: {
    color: '#C2185B',
  },
  trafficMessage: {
    fontSize: screenWidth * 0.04,
    fontWeight: '500',
    marginBottom: screenHeight * 0.01,
    color: '#333',
  },
  trafficDetails: {
    marginTop: screenHeight * 0.01,
  },
  trafficDetailText: {
    fontSize: screenWidth * 0.035,
    color: '#666',
    marginBottom: 2,
  },
  // Bottom button pinned near the home indicator
  bottomSection: {
    position: 'absolute',
    left: screenWidth * 0.04,
    right: screenWidth * 0.04,
    bottom: screenHeight * 0.01, // sits right above the home indicator; SafeAreaView handles inset
    zIndex: 5,
  },
  mapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#bbb',
    borderRadius: 10,
    paddingVertical: screenHeight * 0.018,
    paddingHorizontal: screenWidth * 0.04,
    justifyContent: 'center',
    backgroundColor: '#f8f9fa',
  },
  mapBtnText: {
    fontSize: screenWidth * 0.045,
    fontWeight: '500',
    color: '#222',
  },
  toast: {
    position: 'absolute',
    left: screenWidth * 0.06,
    right: screenWidth * 0.06,
    bottom: screenHeight * 0.12,
    paddingVertical: screenHeight * 0.012,
    paddingHorizontal: screenWidth * 0.04,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 12,
    zIndex: 40,
  },
  toastText: {
    color: '#fff',
    fontSize: screenWidth * 0.038,
    flex: 1,
    marginRight: 8,
  },
  toastInfo: {
    backgroundColor: '#333',
  },
  toastSuccess: {
    backgroundColor: '#2E7D32',
  },
  toastWarning: {
    backgroundColor: '#F57C00',
  },
  toastError: {
    backgroundColor: '#C62828',
  },
});