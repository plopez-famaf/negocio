import React, { createContext, useContext, useState, useEffect } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';

interface BiometricResult {
  success: boolean;
  error?: string;
  biometricType?: string;
}

interface BiometricContextType {
  isAvailable: boolean;
  supportedTypes: LocalAuthentication.AuthenticationType[];
  authenticate: () => Promise<BiometricResult>;
  isEnrolled: boolean;
}

const BiometricContext = createContext<BiometricContextType | undefined>(undefined);

export function BiometricProvider({ children }: { children: React.ReactNode }) {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [supportedTypes, setSupportedTypes] = useState<LocalAuthentication.AuthenticationType[]>([]);

  useEffect(() => {
    checkBiometricAvailability();
  }, []);

  const checkBiometricAvailability = async () => {
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      
      setIsAvailable(compatible && enrolled);
      setIsEnrolled(enrolled);
      setSupportedTypes(types);
      
      console.log('Biometric availability:', {
        compatible,
        enrolled,
        types: types.map(type => LocalAuthentication.AuthenticationType[type])
      });
    } catch (error) {
      console.error('Error checking biometric availability:', error);
      setIsAvailable(false);
      setIsEnrolled(false);
    }
  };

  const authenticate = async (): Promise<BiometricResult> => {
    try {
      if (!isAvailable) {
        return {
          success: false,
          error: 'Biometric authentication is not available'
        };
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate with your biometric',
        fallbackLabel: 'Use PIN',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });

      if (result.success) {
        const biometricType = supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)
          ? 'Face ID'
          : supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)
          ? 'Fingerprint'
          : 'Biometric';

        return {
          success: true,
          biometricType
        };
      } else {
        return {
          success: false,
          error: result.error || 'Authentication failed'
        };
      }
    } catch (error) {
      console.error('Biometric authentication error:', error);
      return {
        success: false,
        error: 'An error occurred during authentication'
      };
    }
  };

  return (
    <BiometricContext.Provider
      value={{
        isAvailable,
        supportedTypes,
        authenticate,
        isEnrolled
      }}
    >
      {children}
    </BiometricContext.Provider>
  );
}

export function useBiometric() {
  const context = useContext(BiometricContext);
  if (context === undefined) {
    throw new Error('useBiometric must be used within a BiometricProvider');
  }
  return context;
}