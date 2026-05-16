"use client"

import { useEffect, useState } from "react"
import { Sun, Moon } from "lucide-react"

export function ThemeToggle() {
  const [theme, setTheme] = useState<string | null>(null)

  useEffect(() => {
    try {
      const stored = typeof window !== 'undefined' ? localStorage.getItem('theme') : null
      if (stored === 'light' || stored === 'dark') {
        applyTheme(stored)
        setTheme(stored)
      } else {
        // default to dark if nothing set
        applyTheme('dark')
        setTheme('dark')
      }
    } catch (e) {
      // ignore
    }
  }, [])

  function applyTheme(t: string) {
    const root = document.documentElement
    root.classList.remove('dark', 'light')
    root.classList.add(t)
    try { localStorage.setItem('theme', t) } catch (e) {}
  }

  function toggle() {
    const next = theme === 'light' ? 'dark' : 'light'
    applyTheme(next)
    setTheme(next)
  }

  return (
    <button
      onClick={toggle}
      title="Toggle theme"
      className="p-1 rounded-sm hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
    >
      {theme === 'light' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  )
}
