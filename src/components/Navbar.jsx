import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FaUmbrellaBeach, FaRoute, FaMoneyBillWave, FaCalendarAlt, FaBalanceScale, FaClipboardList, FaUserCircle, FaSignInAlt, FaSignOutAlt } from 'react-icons/fa';
import { WiDaySunny } from 'react-icons/wi';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  
  const navItems = [
    { name: 'Home', path: '/', icon: <WiDaySunny className="text-xl" /> },
    { name: 'Weather', path: '/weather', icon: <WiDaySunny className="text-xl" /> },
    { name: 'Routes', path: '/routes', icon: <FaRoute className="text-lg" /> },
    { name: 'Budget', path: '/budget', icon: <FaMoneyBillWave className="text-lg" /> },
    { name: 'Events', path: '/events', icon: <FaCalendarAlt className="text-lg" /> },
    { name: 'Compare', path: '/compare', icon: <FaBalanceScale className="text-lg" /> },
    { name: 'Itinerary', path: '/itinerary', icon: <FaClipboardList className="text-lg" /> },
  ];

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Failed to log out', error);
    }
  };

  return (
    <nav className="bg-gradient-to-r from-indigo-600 to-purple-700 text-white shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex-shrink-0 flex items-center">
            <Link to="/" className="flex items-center space-x-2">
              <span className="text-2xl">🎪</span>
              <span className="text-xl font-bold text-white">Ringmaster's Roundtable</span>
            </Link>
          </div>
          
          {/* Desktop Navigation */}
          <div className="hidden md:block">
            <div className="ml-10 flex items-center space-x-1">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-3 py-2 rounded-md text-sm font-medium flex items-center space-x-1 transition-colors duration-200 ${
                    location.pathname === item.path
                      ? 'bg-white/20 text-white'
                      : 'text-white/90 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span className="text-yellow-300">{item.icon}</span>
                  <span>{item.name}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button
              type="button"
              className="inline-flex items-center justify-center p-2 rounded-md text-white/80 hover:text-white focus:outline-none"
              aria-controls="mobile-menu"
              aria-expanded="false"
            >
              <span className="sr-only">Open main menu</span>
              <svg
                className="block h-6 w-6"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>

          {/* User/Auth Section */}
          <div className="hidden md:block">
            {user ? (
              <div className="ml-4 flex items-center md:ml-6">
                <div className="relative">
                  <div className="flex items-center space-x-2">
                    <FaUserCircle className="h-8 w-8 text-white/90" />
                    <span className="text-sm font-medium text-white/90">{user.email}</span>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="ml-4 flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium text-white/90 hover:bg-white/10 transition-colors duration-200"
                >
                  <FaSignOutAlt className="h-4 w-4" />
                  <span>Logout</span>
                </button>
              </div>
            ) : (
              <Link
                to="/auth"
                className="ml-4 flex items-center space-x-1 px-4 py-2 rounded-md bg-white text-indigo-700 text-sm font-medium hover:bg-indigo-50 transition-colors duration-200"
              >
                <FaSignInAlt className="h-4 w-4" />
                <span>Login / Sign Up</span>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <div className="md:hidden" id="mobile-menu">
        <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center space-x-2 px-3 py-2 rounded-md text-base font-medium ${
                location.pathname === item.path
                  ? 'bg-white/20 text-white'
                  : 'text-white/90 hover:bg-white/10 hover:text-white'
              }`}
            >
              <span className="text-yellow-300">{item.icon}</span>
              <span>{item.name}</span>
            </Link>
          ))}
          {user ? (
            <div className="pt-4 pb-3 border-t border-white/10">
              <div className="flex items-center px-5">
                <div className="flex-shrink-0">
                  <FaUserCircle className="h-10 w-10 text-white/90" />
                </div>
                <div className="ml-3">
                  <div className="text-base font-medium text-white">{user.email}</div>
                </div>
              </div>
              <div className="mt-3 px-2 space-y-1">
                <button
                  onClick={handleLogout}
                  className="w-full text-left block px-3 py-2 rounded-md text-base font-medium text-white/90 hover:bg-white/10"
                >
                  <div className="flex items-center space-x-2">
                    <FaSignOutAlt className="h-4 w-4" />
                    <span>Logout</span>
                  </div>
                </button>
              </div>
            </div>
          ) : (
            <Link
              to="/auth"
              className="flex items-center space-x-2 px-3 py-2 rounded-md text-base font-medium text-white/90 hover:bg-white/10 hover:text-white mt-2"
            >
              <FaSignInAlt className="h-4 w-4" />
              <span>Login / Sign Up</span>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
