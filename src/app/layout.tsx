import type { Metadata } from 'next'
import { Poppins } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '../components/auth/AuthProvider'
import { AuthGuard } from '../components/auth/AuthGuard'
import { CompanyProvider } from '../contexts/CompanyContext'
import { WorkspaceProvider } from '../contexts/WorkspaceContext'
import { NotificationProvider } from '../contexts/NotificationContext'
import { ErrorBoundaryWrapper } from '../components/errors/ErrorBoundaryWrapper'
import { PushNotificationInitializer } from '../components/notifications/PushNotificationInitializer'
import { TenantGuard } from '../components/auth/TenantGuard'
import { DynamicFavicon } from '../components/layout/DynamicFavicon'
import { DynamicTitle } from '../components/layout/DynamicTitle'
import { ThemeProvider } from '../components/providers/ThemeProvider'
import { TenantThemeProvider } from '../components/providers/TenantThemeProvider'
import { Toaster } from 'react-hot-toast'
import { TaskNumberMigration } from '../components/migrations/TaskNumberMigration'
import { QueryProvider } from '../components/providers/QueryProvider'
import { resolveCompanyIdFromRequest } from '../lib/proxy'
import { CopilotKitProvider } from '@copilotkit/react-core'

// Root layout uses headers() via resolveCompanyIdFromRequest; opt out of static generation
export const dynamic = 'force-dynamic'

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-poppins'
})

export const metadata: Metadata = {
  title: 'PMS - Project Management System',
  description: 'Project Management System for Manufacturing & Technology Operations',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon.svg', type: 'image/svg+xml' }
    ],
    shortcut: '/favicon.ico',
    apple: '/favicon.ico',
  },
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Resolve companyId from request using proxy.ts (replaces middleware)
  const { companyId: resolvedCompanyId } = await resolveCompanyIdFromRequest()
  const companyId = resolvedCompanyId || undefined

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={poppins.className} suppressHydrationWarning={true}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          storageKey="pms-theme"
          disableTransitionOnChange
        >
          <CopilotKitProvider>
            <ErrorBoundaryWrapper>
              <QueryProvider>
                <AuthProvider initialCompanyId={companyId}>
                  <AuthGuard>
                    <CompanyProvider initialCompanyId={companyId}>
                      <DynamicFavicon />
                      <DynamicTitle />
                      <TenantGuard>
                        <TenantThemeProvider>
                          <WorkspaceProvider>
                            <NotificationProvider>
                              <PushNotificationInitializer />
                              <TaskNumberMigration />
                              {children}
                              <Toaster
                                position="bottom-right"
                                containerStyle={{
                                  zIndex: 99999, // Ensure toasts appear above all dialogs
                                }}
                                toastOptions={{
                                  duration: 4000,
                                  style: {
                                    background: 'hsl(var(--popover))',
                                    color: 'hsl(var(--popover-foreground))',
                                    border: '1px solid hsl(var(--border))',
                                  },
                                }}
                              />
                            </NotificationProvider>
                          </WorkspaceProvider>
                        </TenantThemeProvider>
                      </TenantGuard>
                    </CompanyProvider>
                  </AuthGuard>
                </AuthProvider>
              </QueryProvider>
            </ErrorBoundaryWrapper>
          </CopilotKitProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
