'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

export type ThemePref = 'light' | 'dark' | 'system'

type Ctx = {
  theme: ThemePref
  resolved: 'light' | 'dark'
  setTheme: (t: ThemePref) => void
  cycleTheme: () => void
}

const ThemeContext = createContext<Ctx | null>(null)
const STORAGE = 'maocerta-theme'

function resolve(theme: ThemePref): 'light' | 'dark' {
  if (theme === 'light' || theme === 'dark') return theme
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemePref>('system')
  const [resolved, setResolved] = useState<'light' | 'dark'>('light')
  const [mounted, setMounted] = useState(false)

  const applyDom = useCallback((t: ThemePref) => {
    const r = resolve(t)
    setResolved(r)
    document.documentElement.classList.toggle('dark', r === 'dark')
  }, [])

  useEffect(() => {
    setMounted(true)
    const s = localStorage.getItem(STORAGE) as ThemePref | null
    const initial = s === 'light' || s === 'dark' || s === 'system' ? s : 'system'
    setThemeState(initial)
    applyDom(initial)
  }, [applyDom])

  useEffect(() => {
    if (!mounted || theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const fn = () => applyDom('system')
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [theme, mounted, applyDom])

  const setTheme = useCallback(
    (t: ThemePref) => {
      setThemeState(t)
      try {
        localStorage.setItem(STORAGE, t)
      } catch {
        /* ignore */
      }
      applyDom(t)
    },
    [applyDom]
  )

  const cycleTheme = useCallback(() => {
    setThemeState((prev) => {
      const order: ThemePref[] = ['light', 'dark', 'system']
      const i = order.indexOf(prev)
      const next = order[(i + 1) % order.length]
      try {
        localStorage.setItem(STORAGE, next)
      } catch {
        /* ignore */
      }
      const r = resolve(next)
      setResolved(r)
      document.documentElement.classList.toggle('dark', r === 'dark')
      return next
    })
  }, [])

  const value = useMemo(
    () => ({ theme, resolved, setTheme, cycleTheme }),
    [theme, resolved, setTheme, cycleTheme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const v = useContext(ThemeContext)
  if (!v) throw new Error('useTheme precisa de ThemeProvider')
  return v
}
