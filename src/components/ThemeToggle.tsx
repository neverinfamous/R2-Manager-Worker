import { Sun, Moon, Monitor } from 'lucide-react'
import { useTheme } from '../hooks/useTheme'
import '../styles/ThemeToggle.css'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  const cycleTheme = () => {
    // Cycle through: system → light → dark → system
    if (theme === 'system') {
      setTheme('light')
    } else if (theme === 'light') {
      setTheme('dark')
    } else {
      setTheme('system')
    }
  }

  const getIcon = () => {
    switch (theme) {
      case 'light':
        return <Sun className="theme-icon" />
      case 'dark':
        return <Moon className="theme-icon" />
      case 'system':
        return <Monitor className="theme-icon" />
    }
  }

  const getLabel = () => {
    switch (theme) {
      case 'light':
        return 'Light'
      case 'dark':
        return 'Dark'
      case 'system':
        return 'System'
    }
  }

  return (
    <button
      onClick={cycleTheme}
      className="theme-toggle-button"
      aria-label={`Current theme: ${theme}. Click to switch theme.`}
      title={`Theme: ${getLabel()} (click to cycle)`}
    >
      {getIcon()}
      <span className="theme-label">{getLabel()}</span>
    </button>
  )
}

