'use client';

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './use-auth';

export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { user, token } = useAuth();

  useEffect(() => {
    if (!user || !token) return;

    const threatAIUrl = process.env.NEXT_PUBLIC_THREAT_AI_SERVICE_URL || 'http://localhost:3002';
    
    const socketInstance = io(threatAIUrl, {
      auth: {
        token: token
      },
      transports: ['websocket', 'polling']
    });

    socketInstance.on('connect', () => {
      console.log('Connected to Threat AI Service');
      setIsConnected(true);
    });

    socketInstance.on('disconnect', () => {
      console.log('Disconnected from Threat AI Service');
      setIsConnected(false);
    });

    socketInstance.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setIsConnected(false);
    });

    socketInstance.on('connected', (data) => {
      console.log('Welcome message from server:', data);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [user, token]);

  return { socket, isConnected };
}