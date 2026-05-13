'use client'

import { ThemeProvider } from '@/components/providers/ThemeProvider'

export default function AppProviders({ children }: { children: React.ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>
}
