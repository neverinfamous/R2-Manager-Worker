/* eslint-disable react-refresh/only-export-components */
import { createContext, useEffect, useState, type ReactNode, useMemo, type JSX } from 'react'

export type ThemeMode = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

interface ThemeContextType {
  theme: ThemeMode
  resolvedTheme: ResolvedTheme
  setTheme: (theme: ThemeMode) => void
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

const STORAGE_KEY = 'r2-manager-theme'

// Detect system preference
const getSystemTheme = (): ResolvedTheme => {
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

// Get stored theme or default to 'system'
const getStoredTheme = (): ThemeMode => {
  if (typeof window === 'undefined') return 'system'
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored
  }
  return 'system'
}

// Resolve theme mode to actual theme
const resolveTheme = (theme: ThemeMode): ResolvedTheme => {
  if (theme === 'system') {
    return getSystemTheme()
  }
  return theme
}

interface ThemeProviderProps {
  children: ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps): JSX.Element {
  const [theme, setThemeState] = useState<ThemeMode>(getStoredTheme)
  
  // Compute resolved theme based on current theme
  const resolvedTheme = useMemo(() => resolveTheme(theme), [theme])

  // Apply theme to document
  useEffect(() => {
    // Apply data-theme attribute to document root
    document.documentElement.setAttribute('data-theme', resolvedTheme)
    
    // Update meta theme-color for mobile browsers
    const metaThemeColor = document.querySelector('meta[name="theme-color"]')
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', resolvedTheme === 'dark' ? '#111827' : '#ffffff')
    } else {
      const meta = document.createElement('meta')
      meta.name = 'theme-color'
      meta.content = resolvedTheme === 'dark' ? '#111827' : '#ffffff'
      document.head.appendChild(meta)
    }
  }, [resolvedTheme])

  // Listen for system theme changes when in 'system' mode
  useEffect(() => {
    if (theme !== 'system') {
      return undefined
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    
    const handleChange = (): void => {
      // Trigger a re-render by updating the theme state
      // This will cause resolvedTheme to recalculate
      setThemeState('system')
    }

    mediaQuery.addEventListener('change', handleChange)
    return (): void => { mediaQuery.removeEventListener('change', handleChange) }
  }, [theme])

  const setTheme = (newTheme: ThemeMode): void => {
    setThemeState(newTheme)
    localStorage.setItem(STORAGE_KEY, newTheme)
  }

  const contextValue = useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme]
  )

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  )
}

