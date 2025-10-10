import React, { useState, useRef, useEffect } from 'react';
import cities from '../data/cities';
import { getIataCode, formatCityWithCode } from '../utils/cityCodes';

const AutocompleteInput = ({ value, onChange, onIataCode, placeholder, className = '' }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef(null);
  const lastReportedCodeRef = useRef('');

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

  useEffect(() => {
    if (!onIataCode) {
      return;
    }

    const derivedCode = getIataCode(value);
    if (derivedCode && derivedCode !== lastReportedCodeRef.current) {
      onIataCode(derivedCode);
      lastReportedCodeRef.current = derivedCode;
    } else if (!derivedCode && lastReportedCodeRef.current) {
      onIataCode('');
      lastReportedCodeRef.current = '';
    }
  }, [value, onIataCode]);

  const handleInputChange = (e) => {
    const input = e.target.value;
    onChange(input);

    if (input.length > 1) {
      const inputLower = input.toLowerCase().trim();

      const filtered = cities
        .filter(city => {
          const cityLower = city.toLowerCase();
          const cityName = city.split(',')[0].toLowerCase().trim();
          return cityLower.includes(inputLower) || cityName.includes(inputLower);
        })
        .sort((a, b) => {
          const aIndex = a.toLowerCase().indexOf(inputLower);
          const bIndex = b.toLowerCase().indexOf(inputLower);
          return aIndex - bIndex;
        })
        .slice(0, 8);

      setSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    onChange(formatCityWithCode(suggestion));
    const iataCode = getIataCode(suggestion);
    if (onIataCode) onIataCode(iataCode);
    setShowSuggestions(false);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && showSuggestions && suggestions.length > 0) {
      event.preventDefault();
      handleSuggestionClick(suggestions[0]);
    }
  };

  const highlightSuggestion = (suggestion, input) => {
    if (!input || input.length < 2) return suggestion;

    const inputLower = input.toLowerCase();
    const suggestionLower = suggestion.toLowerCase();
    const matchIndex = suggestionLower.indexOf(inputLower);

    if (matchIndex === -1) return suggestion;

    const before = suggestion.substring(0, matchIndex);
    const match = suggestion.substring(matchIndex, matchIndex + input.length);
    const after = suggestion.substring(matchIndex + input.length);

    return (
      <>
        {before}
        <span className="font-semibold text-green-600">{match}</span>
        {after}
      </>
    );
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg
            className="h-5 w-5 text-gray-400"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <input
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => value.length > 1 && setShowSuggestions(true)}
          placeholder={placeholder}
          className={`w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-shadow duration-200 ${className}`}
          style={{
            boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
          }}
        />
      </div>
      
      {showSuggestions && suggestions.length > 0 && (
        <div 
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden"
          style={{
            maxHeight: '300px',
            overflowY: 'auto',
            scrollbarWidth: 'thin',
            scrollbarColor: '#9ca3af #f3f4f6',
          }}
        >
          <ul>
            {suggestions.map((suggestion, index) => {
              const iataCode = getIataCode(suggestion);

              return (
                <li
                  key={index}
                  className="px-4 py-3 text-gray-800 hover:bg-green-50 cursor-pointer transition-colors duration-150 border-b border-gray-100 last:border-b-0"
                  onClick={() => handleSuggestionClick(suggestion)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center min-w-0">
                      <svg
                        className="w-4 h-4 mr-2 text-gray-400 flex-shrink-0"
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
                      <span className="truncate pr-2">
                        {highlightSuggestion(suggestion, value)}
                      </span>
                    </div>
                    {iataCode && (
                      <span className="ml-3 text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                        {iataCode}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};

export default AutocompleteInput;
