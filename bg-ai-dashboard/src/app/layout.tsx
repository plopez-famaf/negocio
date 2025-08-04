import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/components/providers/auth-provider';
import { SocketProvider } from '@/components/providers/socket-provider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'BehaviorGuard AI Dashboard',
  description: 'Real-time AI monitoring and analytics for identity verification and threat detection',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang=\"en\">
      <body className={inter.className}>
        <AuthProvider>
          <SocketProvider>
            {children}
          </SocketProvider>
        </AuthProvider>
      </body>
    </html>
  );
}