import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { WyndbaseProvider } from '@wyndbase/sdk/react'
import { App } from './App'
import { wyndbase } from './wyndbase'
import './index.css'

declare module '@wyndbase/sdk/react' {
  interface Register {
    sdk: typeof wyndbase
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WyndbaseProvider sdk={wyndbase}>
      <App />
    </WyndbaseProvider>
  </StrictMode>,
)
