# Troski - Public Transport Route Planning App

A comprehensive React Native application for public transport route planning in Accra, featuring real-time traffic data, arrival time estimates, and interactive route visualization.

## 🚌 Features

### Core Functionality
- **Route Planning**: Find optimal public transport routes between any two locations in Ghana

- **Real-time Traffic Data**: Live traffic conditions with delay estimates

- **Multiple Route Options**: Compare different route alternatives with detailed information

- **Interactive Maps**: Visual route representation with markers and polylines

- **Arrival Time Estimates**: Precise arrival time predictions based on current traffic

### Advanced Features
- **Traffic Information Display**: Color-coded traffic severity indicators
  - 🟢 Clear roads - no significant delays
  - 🟠 Light traffic - minimal delays (≤5 min)
  - 🔴 Moderate traffic - 6-15 minutes delay
  - 🔴 Heavy traffic - >15 minutes delay
- **Responsive Route Selection**: Drag-to-expand interface for 3+ routes
- **Route Details**: Comprehensive information including distance, duration, and traffic conditions
- **Fastest Route Highlighting**: Automatic identification of the quickest route

## 🏗️ Architecture

### Frontend (React Native)
- **Framework**: React Native with Expo
- **Navigation**: React Navigation v7
- **Maps**: React Native Maps
- **State Management**: React Hooks (useState, useEffect)
- **UI Components**: Custom responsive components with dynamic sizing

### Backend (Node.js Serverless)
- **Platform**: Vercel Serverless Functions
- **API**: Google Maps Directions API
- **Language**: JavaScript (ES6+)
- **Deployment**: Vercel with GitHub integration


## 📱 App Structure

### Components
1. **HomeScreen.js** - Origin and destination input
2. **RouteResults.js** - Route selection with interactive map
3. **RouteDetails.js** - Detailed route information with traffic data
4. **RouteMapView.js** - Full-screen map visualization

### Screens Overview
- **Landing (App.js)**: Font loading → auto-navigate to Home
- **Home (HomeScreen)**: Get current location label, input origin/destination, find routes
- **Results (RouteResults)**: Calls backend /api/routes, shows markers/list, navigate to details
- **Details (RouteDetails)**: Rich route info, traffic badge, CTA to map
- **Map (RouteMapView)**: Calls backend /api/directions, draws polyline, shows time/distance

### Backend Integration
- **Routes endpoint**: https://troski-backend.vercel.app/api/routes?origin=...&destination=...
- **Directions endpoint**: https://troski-backend.vercel.app/api/directions?origin=...&destination=...
Note: These URLs are hardcoded in RouteResults.js and RouteMapView.js. Update them if you deploy your own backend.

### Key Features Implementation

#### RouteResults Component
- **Default Display**: Shows 2 routes by default
- **Dragbar Functionality**: Swipe up to reveal additional routes (3+)
- **Responsive Design**: Adapts to different screen sizes

#### Traffic Information System
- **Real-time Data**: Fetches current traffic conditions
- **Severity Classification**: Automatic traffic level detection
- **Visual Indicators**: Color-coded traffic status
- **Delay Calculation**: Precise delay estimates in minutes

## 🛠️ Technical Implementation

### Backend API Endpoints

#### `/api/routes`
- **Method**: GET
- **Parameters**: `origin`, `destination`
- **Response**: Array of route objects with traffic data
- **Features**:
  - Real-time traffic integration
  - Arrival time calculation
  - Route sorting by duration
  - Traffic severity analysis

#### `/api/directions`
- **Method**: GET
- **Parameters**: `origin`, `destination`
- **Response**: Single route with detailed information
- **Features**:
  - Detailed turn-by-turn directions
  - Traffic-aware routing
  - Arrival time estimates

#### `/api/health`
- **Method**: GET
- **Response**: Service status check
- **Purpose**: Health monitoring and debugging

### Data Flow
1. **User Input** → HomeScreen captures origin/destination
2. **API Request** → RouteResults fetches routes from backend
3. **Data Processing** → Backend processes Google Maps API response
4. **Traffic Analysis** → Real-time traffic data integration
5. **UI Rendering** → Components display formatted route information

### State Management
- **Route Data**: Fetched and stored in component state
- **Loading States**: Activity indicators during API calls
- **Error Handling**: User-friendly error messages
- **Navigation**: React Navigation for screen transitions

### Known Limitations
- Web support may be limited for react-native-maps; mobile is recommended
- If the backend is unreachable, routes and map data will not load

## 🚀 Getting Started

### Prerequisites
- Node.js (v14 or higher)
- Expo CLI
- Expo Go App on IOS or Android
- Google Maps API key
- Vercel account (for backend deployment)

### Frontend Setup
```bash
cd troski-app
cd troski
npm install
npx expo start
```
- on Android, scan QR code in development mode
- on IOS, press s to switch to Expo Go mode and scan QR code

### Backend Setup
```bash
cd troski-backend-1
cd troski-backend
npm install
```

### Environment Variables
Create `.env` file in backend directory:
