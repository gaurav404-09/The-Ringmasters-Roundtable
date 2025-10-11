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
  FaChevronDown,
} from 'react-icons/fa';
import { GiCrystalBall } from 'react-icons/gi';
import { WiDaySunny } from 'react-icons/wi';
import { useAuth } from '../context/AuthContext';

const NAV_STRUCTURE = [
  { key: 'home', type: 'link', name: 'Home', path: '/', icon: WiDaySunny },
  {
    key: 'agents',
    type: 'dropdown',
    name: 'Agents',
    icon: FaCalendarAlt,
    items: [
      { key: 'events', name: 'Events', path: '/events', icon: FaCalendarAlt },
      { key: 'itinerary', name: 'Itinerary', path: '/itinerary', icon: FaClipboardList },
      { key: 'weather', name: 'Weather', path: '/weather', icon: WiDaySunny },
      { key: 'routes', name: 'Routes', path: '/routes', icon: FaRoute },
    ],
  },
  {
    key: 'features',
    type: 'dropdown',
    name: 'Features',
    icon: FaBalanceScale,
    items: [
      { key: 'compare', name: 'Compare', path: '/compare', icon: FaBalanceScale },
      { key: 'budget', name: 'Budget', path: '/budget', icon: FaMoneyBillWave },
      { key: 'crystal', name: 'Crystal Ball', path: '/crystal-ball', icon: GiCrystalBall },
    ],
  },
  { key: 'plan', type: 'cta', name: 'Plan Trip', path: '/planner', icon: FaRoute },
  { key: 'community', type: 'link', name: 'Community', path: '/community', icon: FaUserCircle },
  { key: 'dashboard', type: 'link', name: 'Dashboard', path: '/dashboard', icon: FaClipboardList },
];

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = useMemo(() => {
    const items = [...NAV_STRUCTURE];

    if (user) {
      items.push({ key: 'logout', type: 'action', name: 'Logout', icon: FaSignOutAlt, action: 'logout' });
    } else {
      items.push({ key: 'auth', type: 'link', name: 'Login / Sign Up', path: '/auth', icon: FaSignInAlt });
    }

    return items;
  }, [user]);

  const isActive = (path) => location.pathname === path;

  const baseNavLinkClasses =
    'inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold tracking-wide border-b-2 border-transparent text-slate-200 transition-colors duration-200';
  const activeNavClasses = 'text-white border-white';
  const inactiveNavClasses = 'text-slate-300 hover:text-white hover:border-white/40';

  const navButtonClass = (active = false) =>
    `${baseNavLinkClasses} ${active ? activeNavClasses : inactiveNavClasses}`;

  const isDropdownActive = (items) => items?.some((item) => isActive(item.path));

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
    <nav className="sticky top-0 z-50 border-b border-slate-800/70 text-white shadow-[0_14px_40px_rgba(15,23,42,0.5)] backdrop-blur-xl overflow-visible">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-slate-950/95 via-slate-900/90 to-slate-950/95" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" aria-hidden="true" />
      <div className="flex h-16 w-full items-center justify-between px-4 sm:px-6 lg:px-12 relative">
        {/* Desktop Navigation */}
        <div className="hidden lg:flex items-center gap-4">
          {navItems.map((item) => {
            if (item.type === 'action') {
              return (
                <button key={item.key} onClick={handleLogout} className={navButtonClass()}>
                  <item.icon className="text-base" />
                  <span>{item.name}</span>
                </button>
              );
            }

            if (item.type === 'cta') {
              return (
                <Link
                  key={item.key}
                  to={item.path}
                  onClick={closeMobileMenu}
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 px-4 py-2 text-sm font-semibold uppercase tracking-[0.22em] text-white shadow-[0_18px_40px_rgba(56,189,248,0.35)] transition hover:scale-[1.03]"
                >
                  <item.icon className="text-base" />
                  <span>{item.name}</span>
                </Link>
              );
            }

            if (item.type === 'dropdown') {
              const dropdownActive = isDropdownActive(item.items);
              return (
                <div key={item.key} className="relative group">
                  <button
                    type="button"
                    className={`${navButtonClass(dropdownActive)} inline-flex items-center gap-2`}
                  >
                    <item.icon className="text-base" />
                    <span>{item.name}</span>
                    <FaChevronDown className={`text-xs transition ${dropdownActive ? 'text-cyan-300 rotate-0' : ''} group-hover:-rotate-180`} />
                  </button>
                  <div className="invisible absolute left-0 top-full z-[100] mt-2 w-52 translate-y-2 rounded-2xl border border-white/10 bg-slate-900/95 p-2 opacity-0 shadow-[0_18px_42px_rgba(2,6,23,0.6)] backdrop-blur-xl transition-all duration-300 ease-in-out delay-75 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-hover:delay-0">
                    {item.items.map((subItem) => (
                      <Link
                        key={subItem.key}
                        to={subItem.path}
                        onClick={closeMobileMenu}
                        className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                          isActive(subItem.path)
                            ? 'bg-cyan-500/10 text-cyan-300'
                            : 'text-slate-300 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <subItem.icon className="text-base" />
                        <span>{subItem.name}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            }

            return (
              <Link
                key={item.key}
                to={item.path}
                onClick={closeMobileMenu}
                className={navButtonClass(isActive(item.path))}
              >
                <item.icon className="text-base" />
                <span>{item.name}</span>
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
              {navItems.map((item) => {
                if (item.type === 'action') {
                  return (
                    <button key={item.key} onClick={handleLogout} className={`${navButtonClass()} justify-between`}>
                      <item.icon className="text-base" />
                      <span>{item.name}</span>
                    </button>
                  );
                }

                if (item.type === 'cta') {
                  return (
                    <Link
                      key={item.key}
                      to={item.path}
                      onClick={closeMobileMenu}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 px-4 py-3 text-sm font-semibold uppercase tracking-[0.22em] text-white shadow-[0_18px_40px_rgba(56,189,248,0.35)]"
                    >
                      <item.icon className="text-base" />
                      <span>{item.name}</span>
                    </Link>
                  );
                }

                if (item.type === 'dropdown') {
                  const dropdownActive = isDropdownActive(item.items);
                  return (
                    <div key={item.key} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                        <item.icon className="text-sm" />
                        <span className={dropdownActive ? 'text-cyan-300' : undefined}>{item.name}</span>
                      </div>
                      <div className="flex flex-col gap-2">
                        {item.items.map((subItem) => (
                          <Link
                            key={subItem.key}
                            to={subItem.path}
                            onClick={closeMobileMenu}
                            className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                              isActive(subItem.path)
                                ? 'bg-cyan-500/10 text-cyan-300'
                                : 'text-slate-200 hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            <subItem.icon className="text-base" />
                            <span>{subItem.name}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  );
                }

                return (
                  <Link
                    key={item.key}
                    to={item.path}
                    onClick={closeMobileMenu}
                    className={`${navButtonClass(isActive(item.path))} justify-between`}
                  >
                    <item.icon className="text-base" />
                    <span>{item.name}</span>
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