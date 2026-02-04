import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Mount to either badge-root (embedded) or root (standalone)
const rootElement = document.getElementById('badge-root') || document.getElementById('root')

if (rootElement) {
    ReactDOM.createRoot(rootElement).render(<App />)
}