import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, SafeAreaProvider } from 'react-native';

// Screens
import HomeScreen from './mobile/screens/HomeScreen';
import BiometricVerificationScreen from './mobile/screens/BiometricVerificationScreen';
import DocumentScanScreen from './mobile/screens/DocumentScanScreen';
import VerificationResultScreen from './mobile/screens/VerificationResultScreen';
import SettingsScreen from './mobile/screens/SettingsScreen';

// Services
import { AuthProvider } from './mobile/services/AuthContext';
import { BiometricProvider } from './mobile/services/BiometricContext';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <BiometricProvider>
          <NavigationContainer>
            <Stack.Navigator
              initialRouteName=\"Home\"
              screenOptions={{
                headerStyle: {
                  backgroundColor: '#2563eb',
                },
                headerTintColor: '#fff',
                headerTitleStyle: {
                  fontWeight: 'bold',
                },
              }}
            >
              <Stack.Screen 
                name=\"Home\" 
                component={HomeScreen}
                options={{ title: 'BehaviorGuard Mobile AI' }}
              />
              <Stack.Screen 
                name=\"BiometricVerification\" 
                component={BiometricVerificationScreen}
                options={{ title: 'Biometric Verification' }}
              />
              <Stack.Screen 
                name=\"DocumentScan\" 
                component={DocumentScanScreen}
                options={{ title: 'Document Scanner' }}
              />
              <Stack.Screen 
                name=\"VerificationResult\" 
                component={VerificationResultScreen}
                options={{ title: 'Verification Results' }}
              />
              <Stack.Screen 
                name=\"Settings\" 
                component={SettingsScreen}
                options={{ title: 'Settings' }}
              />
            </Stack.Navigator>
          </NavigationContainer>
          <StatusBar style=\"light\" />
        </BiometricProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}