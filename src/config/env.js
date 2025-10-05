// Environment configuration
const ENV = {
  // API Keys
  OPENWEATHER_API_KEY: import.meta.env.VITE_OPENWEATHER_API_KEY || '',
  ORS_API_KEY: import.meta.env.VITE_ORS_API_KEY || '',
  COHERE_API_KEY: import.meta.env.VITE_COHERE_API_KEY || '',
  
  // API Endpoints
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001',
  WEATHER_API: 'https://api.openweathermap.org/data/2.5/weather',
  WS_URL: import.meta.env.VITE_WS_URL || 'ws://localhost:3000',
  
  // Environment
  IS_DEVELOPMENT: import.meta.env.DEV || process.env.NODE_ENV === 'development',
  IS_PRODUCTION: import.meta.env.PROD || process.env.NODE_ENV === 'production',
};

// Log configuration in development
if (ENV.IS_DEVELOPMENT) {
  console.log('Environment configuration loaded:', {
    ...ENV,
    OPENWEATHER_API_KEY: ENV.OPENWEATHER_API_KEY ? '*** (set)' : '*** (missing)',
    ORS_API_KEY: ENV.ORS_API_KEY ? '*** (set)' : '*** (missing)',
    COHERE_API_KEY: ENV.COHERE_API_KEY ? '*** (set)' : '*** (missing)'
  });
}

export default ENV;
