// Environment variables configuration
const ENV = {
  // API Keys
  OPENWEATHER_API_KEY: import.meta.env.VITE_OPENWEATHER_API_KEY || process.env.VITE_OPENWEATHER_API_KEY,
  ORS_API_KEY: import.meta.env.VITE_ORS_API_KEY || process.env.VITE_ORS_API_KEY,
  
  // API Endpoints
  WEATHER_API: 'https://api.openweathermap.org/data/2.5/weather',
  API_BASE_URL: (import.meta.env.VITE_API_BASE_URL || process.env.VITE_API_BASE_URL || 'http://localhost:3000'),
  
  // Development mode
  IS_DEVELOPMENT: import.meta.env.DEV || process.env.NODE_ENV === 'development',
  IS_PRODUCTION: import.meta.env.PROD || process.env.NODE_ENV === 'production',
};

// Log the environment configuration (remove in production)
if (ENV.IS_DEVELOPMENT) {
  console.log('Environment configuration:', {
    ...ENV,
    ORS_API_KEY: ENV.ORS_API_KEY ? '*** (set)' : '*** (missing)'
  });
}

// Validate required environment variables
const requiredVars = ['VITE_OPENWEATHER_API_KEY', 'VITE_ORS_API_KEY'];
const missingVars = requiredVars.filter(
  (varName) => !import.meta.env[varName]
);

if (missingVars.length > 0 && ENV.IS_DEVELOPMENT) {
  console.warn('Missing required environment variables:', missingVars);
  console.log('Current environment variables:', import.meta.env);
}

export default ENV;
