import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { LangIcon } from '@/components/icons'
import { useUiStore } from '@/stores/useUiStore'
import { applyDocumentLang, type Lang } from '@/lib/i18n'
import { cn } from '@/lib/utils'

/**
 * Keeps i18next, the store and `<html lang|dir>` in agreement.
 * Mounted once by the app root.
 */
export function useLangEffect() {
  const lang = useUiStore((s) => s.lang)
  const { i18n } = useTranslation()

  useEffect(() => {
    if (i18n.language !== lang) void i18n.changeLanguage(lang)
    applyDocumentLang(lang)
  }, [lang, i18n])
}

export function LangSwitch({
  className,
  variant = 'icon',
}: {
  className?: string
  variant?: 'icon' | 'labelled'
}) {
  const { t } = useTranslation()
  const lang = useUiStore((s) => s.lang)
  const setLang = useUiStore((s) => s.setLang)

  const next: Lang = lang === 'ar' ? 'en' : 'ar'
  const nextLabel = next === 'ar' ? 'العربية' : 'English'

  if (variant === 'labelled') {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setLang(next)}
        className={cn('gap-2', className)}
        aria-label={t('common.toggleLanguage')}
      >
        <LangIcon size={16} />
        {nextLabel}
      </Button>
    )
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setLang(next)}
      className={className}
      aria-label={t('common.toggleLanguage')}
      title={nextLabel}
    >
      <LangIcon size={18} />
      <span className="sr-only">{nextLabel}</span>
    </Button>
  )
}
