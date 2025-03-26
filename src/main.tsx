import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './app.css'
import FileManager from './app.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FileManager />
  </StrictMode>,
)