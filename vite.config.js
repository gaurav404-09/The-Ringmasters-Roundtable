import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    // Explicitly define global constants
    define: {
      'process.env': {}
    },
    server: {
      headers: {
        'Content-Security-Policy': [
          "default-src 'self' http://localhost:5173 http://127.0.0.1:5173 http://localhost:3000;",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' 'inline-speculation-rules' data: blob: http://localhost:5173 http://127.0.0.1:5173 https://apis.google.com https://www.gstatic.com https://identitytoolkit.googleapis.com;",
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;",
          "font-src 'self' https://fonts.gstatic.com data:;",
          "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://images.unsplash.com;",
          "connect-src 'self' ws://localhost:5173 ws://127.0.0.1:5173 http://localhost:3000 http://127.0.0.1:3000 https://identitytoolkit.googleapis.com https://firestore.googleapis.com https://securetoken.googleapis.com https://cdn.jsdelivr.net https://unpkg.com https://lottie.host https://apis.google.com https://www.gstatic.com https://api.openweathermap.org https://tile.openweathermap.org;",
          "frame-src 'self' https://apis.google.com https://www.gstatic.com https://*.firebaseapp.com;",
          "worker-src 'self' blob:;",
          "media-src 'self' https://*.tile.openstreetmap.org;",
          "object-src 'none';"
        ].join(' ')
      }
    }
    // If you're having issues with environment variables in production
    // you might need to add this:
    // envPrefix: 'VITE_',
  };
});