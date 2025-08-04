# BG Mobile AI Service

**BehaviorGuard Mobile AI Service** - Mobile biometric verification application with React Native and Expo.

## Overview

This service provides a mobile application for AI-powered biometric verification including:

- **Mobile Biometric Authentication**: Face ID, Touch ID, and fingerprint recognition
- **Document Scanning**: Camera-based document capture and processing
- **Real-time Verification**: Integration with bg-identity-ai service
- **Secure Storage**: Encrypted local storage for sensitive data
- **Cross-platform Support**: iOS and Android compatibility

## Architecture

- **Framework**: React Native with Expo
- **Navigation**: React Navigation 6
- **Authentication**: Expo Local Authentication + Custom JWT
- **Storage**: Expo Secure Store for sensitive data
- **Camera**: Expo Camera for biometric capture
- **Backend Integration**: Axios for API communication

## Mobile App Features

### Biometric Verification
- Face recognition using device camera
- Fingerprint/Touch ID authentication
- Document photo capture and processing
- Real-time verification results

### Security Features
- Secure token storage
- Biometric authentication for app access
- Encrypted communication with backend services
- Local data encryption

### User Experience
- Intuitive mobile-first interface
- Real-time feedback and progress indicators
- Offline capability for basic functions
- Push notifications for verification results

## Development

### Prerequisites
- Node.js 18+
- Expo CLI
- iOS Simulator (for iOS development)
- Android Studio (for Android development)

### Setup
```bash
# Install dependencies
npm install

# Start Expo development server
npm run mobile:start

# Run on iOS simulator
npm run mobile:ios

# Run on Android emulator
npm run mobile:android
```

### Backend API Server
```bash
# Start backend API server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

## API Integration

The mobile app integrates with the following services:

### BG Identity AI Service (Port 3001)
- `/api/biometric/verify-face` - Face verification
- `/api/biometric/verify-fingerprint` - Fingerprint verification
- `/api/biometric/enroll` - Biometric enrollment

### BG Web Service (Port 3000)
- `/api/auth/login` - User authentication
- `/api/user/profile` - User profile management
- `/api/verification/history` - Verification history

## Mobile App Structure

```
mobile/
├── screens/              # App screens
│   ├── HomeScreen.tsx
│   ├── BiometricVerificationScreen.tsx
│   ├── DocumentScanScreen.tsx
│   └── SettingsScreen.tsx
├── services/            # Context providers and services
│   ├── AuthContext.tsx
│   ├── BiometricContext.tsx
│   └── ApiService.ts
├── components/          # Reusable components
├── navigation/          # Navigation configuration
└── assets/             # Images, fonts, etc.
```

## Environment Variables

Create a `.env` file in the root directory:

```bash
# API Endpoints
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000
EXPO_PUBLIC_IDENTITY_AI_URL=http://localhost:3001
EXPO_PUBLIC_THREAT_AI_URL=http://localhost:3002

# Development
EXPO_PUBLIC_ENV=development
```

## Device Permissions

### iOS (Info.plist)
- `NSCameraUsageDescription` - Camera access for biometric capture
- `NSPhotoLibraryUsageDescription` - Photo library access
- `NSFaceIDUsageDescription` - Face ID authentication
- `NSLocalNetworkUsageDescription` - Local network access

### Android (Permissions)
- `CAMERA` - Camera access
- `USE_FINGERPRINT` - Fingerprint authentication
- `USE_BIOMETRIC` - Biometric authentication
- `INTERNET` - Network access
- `READ_EXTERNAL_STORAGE` - File access

## Deployment

### Development Build
```bash
# Create development build
expo build:android --type app-bundle
expo build:ios --type archive
```

### Production Build
```bash
# Configure app signing
expo credentials:manager

# Build for production
expo build:android --type app-bundle --release-channel production
expo build:ios --type archive --release-channel production
```

### App Store Deployment
1. Configure app signing certificates
2. Set up App Store Connect metadata
3. Upload build through Expo or Xcode
4. Submit for App Store review

## Security Considerations

- All biometric data is processed locally on device
- API communication uses HTTPS with certificate pinning
- Sensitive data is encrypted using Expo Secure Store
- Authentication tokens have limited lifetime
- Biometric templates are never transmitted to backend

## Testing

```bash
# Run unit tests
npm test

# Run E2E tests with Detox
npm run test:e2e

# Test on physical devices
expo start --tunnel
```

## Performance Optimization

- Image compression for document scanning
- Lazy loading of screens and components
- Biometric processing optimization
- Efficient API request caching
- Background processing for non-critical tasks