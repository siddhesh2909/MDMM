import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { RoleProvider } from '@/components/providers/RoleProvider';
import { ToastProvider } from '@/components/providers/ToastProvider';
import { AuthProvider } from '@/components/providers/AuthProvider';
import { AppShell } from '@/components/layout/AppShell';

export const metadata: Metadata = {
  title: 'Collaborative AI Platform',
  description: 'Role-based collaborative data platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <AuthProvider>
            <RoleProvider>
              <ToastProvider>
                <AppShell>
                  {children}
                </AppShell>
              </ToastProvider>
            </RoleProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
