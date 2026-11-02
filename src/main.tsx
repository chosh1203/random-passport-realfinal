import { createRoot } from 'react-dom/client'
import '@fontsource/zen-maru-gothic/500.css'
import '@fontsource/zen-maru-gothic/700.css'
import './styles/index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <App />,
)
