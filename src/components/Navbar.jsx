import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  FaRoute,
  FaMoneyBillWave,
  FaCalendarAlt,
  FaBalanceScale,
  FaClipboardList,
  FaUserCircle,
  FaSignInAlt,
  FaSignOutAlt,
} from 'react-icons/fa';
import { WiDaySunny } from 'react-icons/wi';
import { useAuth } from '../context/AuthContext';

const BASE_NAV_ITEMS = [
  { name: 'Home', path: '/', icon: WiDaySunny },
  { name: 'Weather', path: '/weather', icon: WiDaySunny },
  { name: 'Routes', path: '/routes', icon: FaRoute },
  { name: 'Budget', path: '/budget', icon: FaMoneyBillWave },
  { name: 'Events', path: '/events', icon: FaCalendarAlt },
  { name: 'Compare', path: '/compare', icon: FaBalanceScale },
  { name: 'Dashboard', path: '/dashboard', icon: FaClipboardList },
  { name: 'Itinerary', path: '/itinerary', icon: FaClipboardList },
];

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = useMemo(() => {
    const items = [
      ...BASE_NAV_ITEMS,
      { name: 'Plan Trip', path: '/planner', icon: FaRoute, type: 'link' },
    ];

    if (user) {
      items.push({ name: 'Logout', action: 'logout', icon: FaSignOutAlt, type: 'action' });
    } else {
      items.push({ name: 'Login · Sign Up', path: '/auth', icon: FaSignInAlt, type: 'link' });
    }

    return items;
  }, [user]);

  const isActive = (path) => location.pathname === path;

  const baseNavLinkClasses =
    'inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold tracking-wide border-b-2 border-transparent text-slate-200 transition-colors duration-200';
  const activeNavClasses = 'text-white border-white';
  const inactiveNavClasses = 'text-slate-300 hover:text-white hover:border-white/40';

  const navLinkClass = (path) =>
    `${baseNavLinkClasses} ${path ? (isActive(path) ? activeNavClasses : inactiveNavClasses) : inactiveNavClasses}`;

  const closeMobileMenu = () => setMobileOpen(false);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
      closeMobileMenu();
    } catch (error) {
      console.error('Failed to log out', error);
    }
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-800/70 text-white shadow-[0_14px_40px_rgba(15,23,42,0.5)] backdrop-blur-xl overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-slate-950/95 via-slate-900/90 to-slate-950/95" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" aria-hidden="true" />
      <div className="flex h-16 w-full items-center justify-between px-4 sm:px-6 lg:px-12 relative">
        {/* Desktop Navigation */}
        <div className="hidden lg:flex items-center gap-6">
          {navItems.map(({ name, path, icon: Icon, action, type }) => {
            if (type === 'action' && action === 'logout') {
              return (
                <button key="logout" onClick={handleLogout} className={navLinkClass()}>
                  <Icon className="text-base" />
                  <span>{name}</span>
                </button>
              );
            }

            return (
              <Link
                key={path}
                to={path}
                onClick={closeMobileMenu}
                className={navLinkClass(path)}
              >
                <Icon className="text-base" />
                <span>{name}</span>
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-4">
          {user && (
            <div className="hidden lg:inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold tracking-wide text-white shadow-[0_6px_18px_rgba(15,23,42,0.35)]">
              <FaUserCircle className="text-base text-white/80" />
              <span className="max-w-[12rem] truncate">{user.email}</span>
            </div>
          )}

          {/* Mobile toggle */}
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md border border-white/10 bg-white/5 p-2 text-white/80 transition-colors duration-200 hover:text-white focus:outline-none lg:hidden"
            aria-controls="mobile-menu"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((prev) => !prev)}
          >
            <span className="sr-only">Toggle navigation</span>
            <svg
              className="h-6 w-6"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div id="mobile-menu" className="lg:hidden border-t border-slate-800/70 bg-slate-900/95 backdrop-blur-xl">
          <div className="space-y-4 px-4 py-6">
            <div className="flex flex-col gap-2">
              {navItems.map(({ name, path, icon: Icon, action, type }) => {
                if (type === 'action' && action === 'logout') {
                  return (
                    <button key="logout" onClick={handleLogout} className={`${navLinkClass()} justify-center`}>
                      <Icon className="text-base" />
                      <span>{name}</span>
                    </button>
                  );
                }

                return (
                  <Link
                    key={path}
                    to={path}
                    onClick={closeMobileMenu}
                    className={`${navLinkClass(path)} justify-center`}
                  >
                    <Icon className="text-base" />
                    <span>{name}</span>
                  </Link>
                );
              })}
            </div>

            {user && (
              <div className="flex items-center gap-2 rounded-md border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_22px_rgba(15,23,42,0.35)]">
                <FaUserCircle className="text-lg text-white/80" />
                <span className="truncate">{user.email}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;