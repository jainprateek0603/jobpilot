import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type ThemeChoice = 'light' | 'dark' | 'system'

type ThemeValue = { theme: ThemeChoice; setTheme: (theme: ThemeChoice) => void }

const ThemeContext = createContext<ThemeValue | null>(null)

export function applyTheme(theme: ThemeChoice) {
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
  localStorage.setItem('jobpilot-theme', theme)
}

function storedTheme(): ThemeChoice {
  const value = localStorage.getItem('jobpilot-theme')
  if (value === 'light' || value === 'dark' || value === 'system') return value
  return 'system'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeChoice>(storedTheme)

  useEffect(() => {
    applyTheme(theme)
    if (theme !== 'system') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme('system')
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [theme])

  const value = useMemo<ThemeValue>(
    () => ({
      theme,
      setTheme(next) {
        setThemeState(next)
        applyTheme(next)
      },
    }),
    [theme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('useTheme must be used inside ThemeProvider')
  return value
}
