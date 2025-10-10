import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom';
import { setWasmUrl } from '@lottiefiles/dotlottie-react';
import App from './App'
import './index.css'
import { AuthProvider } from './context/AuthContext'
import { PipProvider } from './context/PipContext.jsx'

setWasmUrl('/dotlottie-player.wasm');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <AuthProvider>
        <PipProvider>
          <App />
        </PipProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
