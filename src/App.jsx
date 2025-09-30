
import "leaflet/dist/leaflet.css";
import { Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from 'framer-motion';
import { Toaster } from 'react-hot-toast';
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import Weather from "./pages/Weather";
import RoutesPage from "./pages/Routes";
import Budget from "./pages/Budget";
import Events from "./pages/Events";
import Compare from "./pages/Compare";
import Itinerary from "./pages/Itinerary";
import TripSummary from "./pages/TripSummary.jsx";
import AuthPage from './pages/AuthPage';


function App() {
  const location = useLocation();
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <Navbar />
      <Toaster position="top-right" />
      <main className="min-h-[calc(100vh-64px)]">
        <AnimatePresence mode="wait" initial={false}>
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<Home />} />
            <Route path="/weather" element={<Weather />} />
            <Route path="/routes" element={<RoutesPage />} />
            <Route path="/budget" element={<Budget />} />
            <Route path="/events" element={<Events />} />
            <Route path="/compare" element={<Compare />} />
            <Route path="/itinerary" element={<Itinerary />} />
            <Route path="/trip-summary" element={<TripSummary />} />
            <Route path="/auth" element={<AuthPage />} />
          </Routes>
        </AnimatePresence>
      </main>
      
      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-2">
              <span className="text-2xl">🎪</span>
              <span className="text-lg font-semibold text-gray-800">Ringmaster's Roundtable</span>
            </div>
            <p className="mt-4 text-sm text-gray-500 md:mt-0">
              &copy; {new Date().getFullYear()} Ringmaster's Roundtable. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
