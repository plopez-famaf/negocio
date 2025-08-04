'use client';

import { useState, useEffect } from 'react';
import Cookies from 'js-cookie';
import jwt from 'jsonwebtoken';

interface User {
  id: string;
  email: string;
  role: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedToken = Cookies.get('auth_token') || localStorage.getItem('auth_token');
    
    if (storedToken) {
      try {
        // In a real implementation, you would verify the token with your auth service
        // For now, we'll decode it without verification (demo purposes only)
        const decoded = jwt.decode(storedToken) as any;
        
        if (decoded && decoded.exp * 1000 > Date.now()) {
          setUser({
            id: decoded.id || 'demo-user',
            email: decoded.email || 'admin@behaviorguard.ai',
            role: decoded.role || 'admin'
          });
          setToken(storedToken);
        } else {
          // Token expired
          Cookies.remove('auth_token');
          localStorage.removeItem('auth_token');
        }
      } catch (error) {
        console.error('Token decode error:', error);
        // Invalid token
        Cookies.remove('auth_token');
        localStorage.removeItem('auth_token');
      }
    } else {
      // For demo purposes, create a mock user
      const mockUser = {
        id: 'demo-admin',
        email: 'admin@behaviorguard.ai',
        role: 'admin'
      };
      
      const mockToken = 'demo-token-for-websocket-connection';
      
      setUser(mockUser);
      setToken(mockToken);
      
      // Store for persistence
      localStorage.setItem('auth_token', mockToken);
    }
    
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    // Mock login implementation
    const mockUser = {
      id: 'demo-admin',
      email: email,
      role: email.includes('admin') ? 'admin' : 'user'
    };
    
    const mockToken = 'demo-token-for-websocket-connection';
    
    setUser(mockUser);
    setToken(mockToken);
    
    Cookies.set('auth_token', mockToken, { expires: 7 });
    localStorage.setItem('auth_token', mockToken);
    
    return { success: true };
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    Cookies.remove('auth_token');
    localStorage.removeItem('auth_token');
  };

  return {
    user,
    token,
    isLoading,
    login,
    logout,
    isAuthenticated: !!user
  };
}