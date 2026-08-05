import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import ar from './locales/ar.json'
import en from './locales/en.json'

export const SUPPORTED_LANGS = ['ar', 'en'] as const
export type Lang = (typeof SUPPORTED_LANGS)[number]

export const LANG_DIR: Record<Lang, 'rtl' | 'ltr'> = { ar: 'rtl', en: 'ltr' }

/** Arabic is the default and the primary demo language. */
export const DEFAULT_LANG: Lang = 'ar'

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      ar: { translation: ar },
      en: { translation: en },
    },
    fallbackLng: DEFAULT_LANG,
    supportedLngs: SUPPORTED_LANGS as unknown as string[],
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'lang',
      caches: ['localStorage'],
    },
    interpolation: { escapeValue: false },
    returnNull: false,
  })

/** Keeps `<html lang>` / `<html dir>` in step with the active language. */
export function applyDocumentLang(lang: Lang) {
  const root = document.documentElement
  root.setAttribute('lang', lang)
  root.setAttribute('dir', LANG_DIR[lang])
}

export default i18n
