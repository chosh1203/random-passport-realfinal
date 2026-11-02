import { AnimatePresence, motion } from 'motion/react'
import { lazy, Suspense } from 'react'
import { StampDefs } from './components/Stamp'
import { TopNav } from './components/TopNav'
import { useReducedMotion } from './hooks/useStores'
import { useRoute } from './hooks/useRoute'
import { useDocumentLang } from './i18n'
import Collection from './pages/Collection'
import DestinationPage from './pages/Destination'
import Home from './pages/Home'
import Passport from './pages/Passport'

const Stats = lazy(() => import('./pages/Stats'))
const Settings = lazy(() => import('./pages/Settings'))

export default function App() {
  const route = useRoute()
  useDocumentLang()
  const reduced = useReducedMotion()
  const key = route.name === 'destination' ? `destination:${route.id ?? ''}` : route.name

  return (
    <>
      <StampDefs />
      <TopNav route={route} />
      <AnimatePresence mode="wait" initial={false}>
        <motion.main
          key={key}
          initial={{ opacity: 0, y: reduced ? 0 : 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reduced ? 0 : -6 }}
          transition={{ duration: reduced ? 0.01 : 0.35, ease: 'easeOut' }}
        >
          {route.name === 'home' && <Home route={route} />}
          {route.name === 'destination' && <DestinationPage id={route.id} />}
          {route.name === 'passport' && <Passport />}
          <Suspense fallback={<div className="min-h-[70vh]" />}>
            {route.name === 'stats' && <Stats />}
            {route.name === 'settings' && <Settings />}
          </Suspense>
          {route.name === 'collection' && <Collection />}
        </motion.main>
      </AnimatePresence>
    </>
  )
}
