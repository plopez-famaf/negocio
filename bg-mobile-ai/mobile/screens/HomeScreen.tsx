import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { useAuth } from '../services/AuthContext';
import { useBiometric } from '../services/BiometricContext';

export default function HomeScreen({ navigation }: any) {
  const { isAuthenticated, user } = useAuth();
  const { isAvailable, authenticate } = useBiometric();
  const [stats, setStats] = useState({
    totalVerifications: 0,
    successRate: 0,
    lastVerification: null as string | null,
  });

  useEffect(() => {
    // Load user statistics
    loadUserStats();
  }, []);

  const loadUserStats = async () => {
    // TODO: Load from secure storage or API
    setStats({
      totalVerifications: 42,
      successRate: 96.8,
      lastVerification: '2 hours ago',
    });
  };

  const handleBiometricVerification = () => {
    navigation.navigate('BiometricVerification');
  };

  const handleDocumentScan = () => {
    navigation.navigate('DocumentScan');
  };

  const handleQuickAuth = async () => {
    if (!isAvailable) {
      Alert.alert('Biometric Authentication', 'Biometric authentication is not available on this device.');
      return;
    }

    try {
      const result = await authenticate();
      if (result.success) {
        Alert.alert('Success', 'Biometric authentication successful!');
      } else {
        Alert.alert('Failed', result.error || 'Biometric authentication failed.');
      }
    } catch (error) {
      Alert.alert('Error', 'An error occurred during authentication.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Welcome Section */}
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeText}>Welcome back!</Text>
          <Text style={styles.userText}>{user?.email || 'Guest User'}</Text>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Ionicons name=\"checkmark-circle\" size={24} color=\"#10b981\" />
            <Text style={styles.statNumber}>{stats.totalVerifications}</Text>
            <Text style={styles.statLabel}>Total Verifications</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name=\"trending-up\" size={24} color=\"#3b82f6\" />
            <Text style={styles.statNumber}>{stats.successRate}%</Text>
            <Text style={styles.statLabel}>Success Rate</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsContainer}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          
          <TouchableOpacity
            style={[styles.actionButton, styles.primaryButton]}
            onPress={handleBiometricVerification}
          >
            <Ionicons name=\"finger-print\" size={24} color=\"white\" />
            <Text style={styles.actionButtonText}>Biometric Verification</Text>
            <Ionicons name=\"chevron-forward\" size={20} color=\"white\" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.secondaryButton]}
            onPress={handleDocumentScan}
          >
            <Ionicons name=\"document-text\" size={24} color=\"white\" />
            <Text style={styles.actionButtonText}>Document Scanner</Text>
            <Ionicons name=\"chevron-forward\" size={20} color=\"white\" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.tertiaryButton]}
            onPress={handleQuickAuth}
            disabled={!isAvailable}
          >
            <Ionicons name=\"shield-checkmark\" size={24} color=\"white\" />
            <Text style={styles.actionButtonText}>Quick Authentication</Text>
            <Ionicons name=\"chevron-forward\" size={20} color=\"white\" />
          </TouchableOpacity>
        </View>

        {/* Recent Activity */}
        <View style={styles.activityContainer}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <View style={styles.activityItem}>
            <Ionicons name=\"time\" size={20} color=\"#6b7280\" />
            <View style={styles.activityContent}>
              <Text style={styles.activityTitle}>Face verification completed</Text>
              <Text style={styles.activityTime}>{stats.lastVerification}</Text>
            </View>
            <View style={styles.activityStatus}>
              <Text style={styles.successText}>Success</Text>
            </View>
          </View>
        </View>

        {/* Settings Button */}
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => navigation.navigate('Settings')}
        >
          <Ionicons name=\"settings\" size={20} color=\"#6b7280\" />
          <Text style={styles.settingsText}>Settings & Privacy</Text>
          <Ionicons name=\"chevron-forward\" size={16} color=\"#6b7280\" />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollContent: {
    padding: 20,
  },
  welcomeSection: {
    marginBottom: 24,
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  userText: {
    fontSize: 16,
    color: '#6b7280',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 4,
  },
  actionsContainer: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryButton: {
    backgroundColor: '#2563eb',
  },
  secondaryButton: {
    backgroundColor: '#059669',
  },
  tertiaryButton: {
    backgroundColor: '#7c3aed',
  },
  actionButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    marginLeft: 12,
  },
  activityContainer: {
    marginBottom: 24,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  activityContent: {
    flex: 1,
    marginLeft: 12,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
  activityTime: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  activityStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#d1fae5',
    borderRadius: 6,
  },
  successText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#065f46',
  },
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  settingsText: {
    flex: 1,
    fontSize: 16,
    color: '#374151',
    marginLeft: 12,
  },
});