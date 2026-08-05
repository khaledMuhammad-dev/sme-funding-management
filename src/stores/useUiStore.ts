import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Lang } from '@/lib/i18n'

interface UiState {
  theme: 'light' | 'dark'
  lang: Lang
  sidebarCollapsed: boolean
  setTheme: (theme: 'light' | 'dark') => void
  toggleTheme: () => void
  setLang: (lang: Lang) => void
  toggleSidebar: () => void
}

/** Only theme + language survive a reload — demo data is always fresh. */
export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      theme: 'light',
      lang: 'ar',
      sidebarCollapsed: false,
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set({ theme: get().theme === 'dark' ? 'light' : 'dark' }),
      setLang: (lang) => set({ lang }),
      toggleSidebar: () => set({ sidebarCollapsed: !get().sidebarCollapsed }),
    }),
    { name: 'ui', partialize: (s) => ({ theme: s.theme, lang: s.lang }) },
  ),
)
