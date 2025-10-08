import "leaflet/dist/leaflet.css";
import { Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { Toaster } from "react-hot-toast";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import Home from "./pages/Home";
import Weather from "./pages/Weather";
import RoutesPage from "./pages/Routes";
import Budget from "./pages/Budget";
import Events from "./pages/Events";
import Compare from "./pages/Compare";
import Itinerary from "./pages/Itinerary";
import TripSummary from "./pages/TripSummary.jsx";
import AuthPage from './pages/AuthPage';
import PlanTrip from './pages/PlanTrip';
import Dashboard from './pages/Dashboard';


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
            <Route path="/budget" element={<Planner />} />
            <Route path="/events" element={<Events />} />
            <Route path="/compare" element={<Compare />} />
            <Route path="/itinerary" element={<Itinerary />} />
            <Route path="/trip-summary" element={<TripSummary />} />
            <Route
              path="/planner"
              element={
                <ProtectedRoute>
                  <PlanTrip />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route path="/auth" element={<AuthPage />} />
          </Routes>
        </AnimatePresence>
      </main>
    </div>
  );
}

export default App;
