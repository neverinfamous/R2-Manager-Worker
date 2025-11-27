import { useContext } from 'react'
import { ThemeContext, type ThemeMode } from '../contexts/ThemeContext'

export function useTheme(): { theme: ThemeMode; resolvedTheme: 'light' | 'dark'; setTheme: (theme: ThemeMode) => void } {
  const context = useContext(ThemeContext)
  
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  
  return context
}

