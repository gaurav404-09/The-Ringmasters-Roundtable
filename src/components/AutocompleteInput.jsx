import React, { useState, useRef, useEffect } from 'react';
import cities from '../data/cities';

const AutocompleteInput = ({ value, onChange, placeholder, className = '' }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleInputChange = (e) => {
    const input = e.target.value;
    onChange(input);

    if (input.length > 1) {
      const filtered = cities
        .filter(city => 
          city.toLowerCase().includes(input.toLowerCase())
        )
        .slice(0, 5); // Show top 5 matches
      setSuggestions(filtered);
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    onChange(suggestion);
    setShowSuggestions(false);
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <input
        type="text"
        value={value}
        onChange={handleInputChange}
        onFocus={() => value.length > 1 && setShowSuggestions(true)}
        placeholder={placeholder}
        className={`w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-shadow duration-200 ${className}`}
        style={{
          boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
        }}
      />
      {showSuggestions && suggestions.length > 0 && (
        <ul 
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden"
          style={{
            maxHeight: '300px',
            overflowY: 'auto',
            scrollbarWidth: 'thin',
            scrollbarColor: '#9ca3af #f3f4f6',
          }}
        >
          {suggestions.map((suggestion, index) => (
            <li
              key={index}
              className="px-4 py-3 text-gray-800 hover:bg-green-50 cursor-pointer transition-colors duration-150 border-b border-gray-100 last:border-b-0"
              onClick={() => handleSuggestionClick(suggestion)}
            >
              <div className="flex items-center">
                <svg 
                  className="w-4 h-4 mr-2 text-gray-400" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" 
                  />
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" 
                  />
                </svg>
                <span className="truncate">{suggestion}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AutocompleteInput;
