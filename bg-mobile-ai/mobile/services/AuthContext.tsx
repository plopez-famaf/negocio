import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';

interface User {
  id: string;
  email: string;
  name?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  token: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const storedToken = await SecureStore.getItemAsync('auth_token');
      const storedUser = await SecureStore.getItemAsync('user_data');
      
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      } else {
        // For demo purposes, create a mock user
        const mockUser = {
          id: 'mobile-user-1',
          email: 'user@behaviorguard.ai',
          name: 'Demo User'
        };
        const mockToken = 'mobile-demo-token';
        
        setUser(mockUser);
        setToken(mockToken);
        
        // Store for persistence
        await SecureStore.setItemAsync('auth_token', mockToken);
        await SecureStore.setItemAsync('user_data', JSON.stringify(mockUser));
      }
    } catch (error) {
      console.error('Error loading stored auth:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      
      // TODO: Implement actual authentication with bg-web service
      // For demo purposes, simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const mockUser = {
        id: 'mobile-user-1',
        email: email,
        name: email.split('@')[0]
      };
      const mockToken = 'mobile-auth-token-' + Date.now();
      
      setUser(mockUser);
      setToken(mockToken);
      
      await SecureStore.setItemAsync('auth_token', mockToken);
      await SecureStore.setItemAsync('user_data', JSON.stringify(mockUser));
      
      return true;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      setUser(null);
      setToken(null);
      
      await SecureStore.deleteItemAsync('auth_token');
      await SecureStore.deleteItemAsync('user_data');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        token
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}