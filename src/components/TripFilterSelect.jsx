import { useEffect, useMemo, useRef, useState } from 'react';
import { FaChevronDown } from 'react-icons/fa';

const TripFilterSelect = ({
  value = '',
  onChange,
  options = [],
  placeholder = 'All',
  label,
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const normalizedOptions = useMemo(() => {
    const base = placeholder ? [{ label: placeholder, value: '' }] : [];
    const mapped = options.map((option) => ({ label: option, value: option }));
    return [...base, ...mapped];
  }, [options, placeholder]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const selected = normalizedOptions.find((option) => option.value === value);

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <div className="pb-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
          {label}
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between rounded-2xl border border-white/40 bg-white/90 px-4 py-2 text-left text-sm font-semibold text-slate-600 shadow-inner shadow-slate-200 transition focus:outline-none focus-visible:border-cyan-300 focus-visible:shadow-[0_0_0_2px_rgba(56,189,248,0.35)] dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-200 dark:shadow-slate-900/40 dark:focus-visible:border-cyan-400"
      >
        <span className={`${value ? 'text-cyan-600 dark:text-cyan-300' : 'text-slate-500 dark:text-slate-400'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <FaChevronDown className={`text-xs transition ${open ? 'rotate-180 text-cyan-500' : 'text-slate-400 dark:text-slate-500'}`} />
      </button>

      {open && (
        <div className="absolute top-full z-30 mt-2 w-full overflow-hidden rounded-2xl border border-white/30 bg-white/95 shadow-[0_18px_42px_rgba(15,23,42,0.28)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/95 dark:shadow-[0_20px_60px_rgba(2,6,23,0.65)]">
          <div className="max-h-56 overflow-y-auto py-2">
            {normalizedOptions.length === 0 && (
              <div className="px-4 py-2 text-xs text-slate-400 dark:text-slate-500">
                No options available
              </div>
            )}
            {normalizedOptions.map((option) => {
              const active = option.value === value;
              return (
                <button
                  key={option.value || 'all'}
                  type="button"
                  onClick={() => {
                    onChange?.(option.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between px-4 py-2 text-sm transition ${
                    active
                      ? 'bg-cyan-50 text-cyan-600 dark:bg-cyan-500/10 dark:text-cyan-300'
                      : 'text-slate-600 hover:bg-slate-100/80 dark:text-slate-300 dark:hover:bg-slate-800/70'
                  }`}
                >
                  <span>{option.label}</span>
                  {active && (
                    <span className="text-[10px] uppercase tracking-[0.3em] text-cyan-500 dark:text-cyan-300">
                      Active
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default TripFilterSelect;
