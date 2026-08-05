import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { useUiStore } from '@/stores/useUiStore'

/**
 * Route transition: fade + a 12px slide that follows reading direction, so in
 * Arabic the page enters from the right.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const lang = useUiStore((s) => s.lang)
  const offset = lang === 'ar' ? -12 : 12

  return (
    <motion.div
      initial={{ opacity: 0, x: offset }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -offset }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="min-h-full"
    >
      {children}
    </motion.div>
  )
}
