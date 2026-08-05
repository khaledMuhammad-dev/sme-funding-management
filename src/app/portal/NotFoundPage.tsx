import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { ArrowIcon, SearchIcon } from '@/components/icons'
import { ROUTES } from '../routes'

export default function NotFoundPage() {
  const { t } = useTranslation()

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 py-24 text-center sm:px-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col items-center gap-6"
      >
        <span
          aria-hidden="true"
          className="text-8xl font-semibold tracking-tight text-primary-soft tabular sm:text-9xl"
        >
          404
        </span>

        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {t('notFound.title')}
          </h1>
          <p className="max-w-md text-muted-foreground">{t('notFound.description')}</p>
        </div>

        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <Link to={ROUTES.landing}>
              {t('notFound.backHome')}
              <ArrowIcon size={17} className="rtl-flip" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to={ROUTES.track}>
              <SearchIcon size={16} />
              {t('notFound.trackApplication')}
            </Link>
          </Button>
        </div>
      </motion.div>
    </div>
  )
}
