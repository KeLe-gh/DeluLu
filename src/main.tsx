import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { DevListChat } from './features/chat/DevListChat'

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <DevListChat>
            <App />
        </DevListChat>
    </StrictMode>,
)