import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Dimensions, SafeAreaView } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function RouteDetails({ route, navigation }) {
  const { routeInfo } = route.params || {};

  const [notifyEnabled, setNotifyEnabled] = useState(false);
  const handleNotificationPress = () => {
    if (!notifyEnabled) {
      Alert.alert(
        'App Would Like to Send You Route Notifications',
        'Notifications may include alerts, sounds, and icon badges to help you stay updated on your trotro route status',
        [
          { text: "Don't Allow", style: 'cancel' },
          { text: 'Allow', onPress: () => setNotifyEnabled(true) },
        ]
      );
    } else {
      setNotifyEnabled(false);
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
                      routeInfo.traffic.severity === 'moderate' ? 'alert-circle' : 'alert-triangle'} 
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
});