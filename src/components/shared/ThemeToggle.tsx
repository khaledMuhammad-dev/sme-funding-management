import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { MoonSunIcon } from '@/components/icons'
import { useUiStore } from '@/stores/useUiStore'

/** Applies the persisted theme to `<html>` — mounted once by the app root. */
export function useThemeEffect() {
  const theme = useUiStore((s) => s.theme)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.documentElement.style.colorScheme = theme
  }, [theme])
}

export function ThemeToggle({ className }: { className?: string }) {
  const { t } = useTranslation()
  const theme = useUiStore((s) => s.theme)
  const toggleTheme = useUiStore((s) => s.toggleTheme)

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className={className}
      aria-label={t('common.toggleTheme')}
      title={theme === 'dark' ? t('common.themeLight') : t('common.themeDark')}
    >
      {/* The moon morphs into a sun — the only state this icon needs to express. */}
      <MoonSunIcon active={theme === 'dark'} size={18} />
    </Button>
  )
}
