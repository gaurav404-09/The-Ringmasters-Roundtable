import React, { useState } from 'react';
import { FaMapMarkerAlt, FaCalendarAlt, FaUsers, FaDollarSign, FaHeart, FaCamera, FaUtensils, FaLandmark, FaTree, FaMusic, FaShoppingBag, FaSpinner, FaPlane, FaHotel } from 'react-icons/fa';

const ItineraryGenerator = ({ onItineraryGenerated }) => {
  const [step, setStep] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [formData, setFormData] = useState({
    destination: '',
    startDate: '',
    endDate: '',
    travelers: 1,
    budget: 'medium',
    interests: []
  });

  const interests = [
    { id: 'culture', name: 'Culture & History', icon: <FaLandmark /> },
    { id: 'food', name: 'Food & Dining', icon: <FaUtensils /> },
    { id: 'nature', name: 'Nature & Parks', icon: <FaTree /> },
    { id: 'photography', name: 'Photography', icon: <FaCamera /> },
    { id: 'nightlife', name: 'Nightlife & Entertainment', icon: <FaMusic /> },
    { id: 'shopping', name: 'Shopping', icon: <FaShoppingBag /> }
  ];

  const budgetOptions = [
    { value: 'low', label: 'Budget ($)', description: 'Affordable options' },
    { value: 'medium', label: 'Moderate ($$)', description: 'Mid-range experiences' },
    { value: 'high', label: 'Luxury ($$$)', description: 'Premium experiences' }
  ];

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const toggleInterest = (interestId) => {
    setFormData(prev => ({
      ...prev,
      interests: prev.interests.includes(interestId)
        ? prev.interests.filter(id => id !== interestId)
        : [...prev.interests, interestId]
    }));
  };

  const generateItinerary = async () => {
    setIsGenerating(true);
    
    try {
      const response = await fetch('http://localhost:5000/api/itinerary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          destination: formData.destination,
          days: Math.ceil((new Date(formData.endDate) - new Date(formData.startDate)) / (1000 * 60 * 60 * 24)) + 1,
          interests: formData.interests,
          startDate: formData.startDate,
          budget: formData.budget,
          travelers: formData.travelers
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to generate itinerary');
      }
      
      const itinerary = await response.json();
      onItineraryGenerated(itinerary);
    } catch (error) {
      console.error('Error generating itinerary:', error);
      
      alert(`Failed to generate itinerary: ${error.message}\n\nPlease check:\n- Your destination name is correct\n- Backend server is running on port 5000\n- Internet connection is stable`);
      
      setIsGenerating(false);
      return;
    }
    
    setIsGenerating(false);
  };

  const nextStep = () => {
    if (step < 4) setStep(step + 1);
  };

  const prevStep = () => {
    if (step > 1) setStep(step - 1);
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return formData.destination.trim() !== '';
      case 2:
        return formData.startDate && formData.endDate;
      case 3:
        return formData.travelers > 0;
      case 4:
        return true;
      default:
        return false;
    }
  };

  if (isGenerating) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center p-6">
        <div className="text-center max-w-md w-full">
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-indigo-100 rounded-full opacity-30 blur-xl animate-pulse"></div>
            <FaSpinner className="relative text-6xl text-indigo-600 animate-spin mx-auto" />
          </div>
          
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Creating Your Perfect Itinerary</h2>
          <p className="text-gray-700 mb-8">Fetching real attractions, restaurants, and hotels...</p>
          
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
            <div className="space-y-5">
              <div className="flex items-center text-gray-900">
                <div className="flex-shrink-0 w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center mr-4">
                  <FaMapMarkerAlt className="text-indigo-600 text-lg" />
                </div>
                <span className="font-medium">Finding attractions and landmarks</span>
              </div>
              <div className="flex items-center text-gray-900">
                <div className="flex-shrink-0 w-10 h-10 bg-rose-50 rounded-full flex items-center justify-center mr-4">
                  <FaUtensils className="text-rose-600 text-lg" />
                </div>
                <span className="font-medium">Discovering local restaurants</span>
              </div>
              <div className="flex items-center text-gray-900">
                <div className="flex-shrink-0 w-10 h-10 bg-violet-50 rounded-full flex items-center justify-center mr-4">
                  <FaHotel className="text-violet-600 text-lg" />
                </div>
                <span className="font-medium">Locating accommodations</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-indigo-50 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Progress Bar */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-800">Step {step} of 4</span>
            <span className="text-sm font-medium text-gray-700">{Math.round((step / 4) * 100)}% Complete</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div 
              className="bg-indigo-600 h-full rounded-full transition-all duration-300"
              style={{ width: `${(step / 4) * 100}%` }}
            ></div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 md:p-8 border border-gray-200">
          {/* Step 1: Destination */}
          {step === 1 && (
            <div className="text-center">
              <FaMapMarkerAlt className="text-5xl text-indigo-600 mx-auto mb-5" />
              <h2 className="text-2xl font-bold text-gray-900 mb-3">Where would you like to go?</h2>
              <p className="text-gray-700 mb-6 text-lg">Enter your dream destination</p>
              
              <input
                type="text"
                placeholder="e.g., Paris, Tokyo, New York"
                value={formData.destination}
                onChange={(e) => handleInputChange('destination', e.target.value)}
                className="w-full p-4 text-lg text-gray-900 bg-white border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none transition-colors placeholder-gray-500"
              />
            </div>
          )}

          {/* Step 2: Dates */}
          {step === 2 && (
            <div className="text-center">
              <FaCalendarAlt className="text-5xl text-emerald-600 mx-auto mb-5" />
              <h2 className="text-2xl font-bold text-gray-900 mb-3">When are you traveling?</h2>
              <p className="text-gray-700 mb-7 text-lg">Select your travel dates</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Start Date</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => handleInputChange('startDate', e.target.value)}
                    className="w-full p-4 text-gray-900 bg-white border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">End Date</label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => handleInputChange('endDate', e.target.value)}
                    className="w-full p-4 text-gray-900 bg-white border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none transition-colors"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Travelers & Budget */}
          {step === 3 && (
            <div className="text-center">
              <FaUsers className="text-5xl text-violet-600 mx-auto mb-5" />
              <h2 className="text-2xl font-bold text-gray-900 mb-3">Travel Details</h2>
              <p className="text-gray-700 mb-7 text-lg">How many travelers and what's your budget?</p>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-3">Number of Travelers</label>
                  <div className="flex items-center space-x-3">
                    <button 
                      onClick={() => handleInputChange('travelers', Math.max(1, formData.travelers - 1))}
                      className="w-14 h-14 rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors flex items-center justify-center text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                      aria-label="Decrease number of travelers"
                    >
                      -
                    </button>
                    <div className="flex-1">
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={formData.travelers}
                        onChange={(e) => handleInputChange('travelers', parseInt(e.target.value) || 1)}
                        className="w-full p-4 text-center text-lg font-semibold text-gray-900 bg-white border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none"
                        aria-label="Number of travelers"
                      />
                    </div>
                    <button 
                      onClick={() => handleInputChange('travelers', formData.travelers + 1)}
                      className="w-14 h-14 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors flex items-center justify-center text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                      aria-label="Increase number of travelers"
                    >
                      +
                    </button>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-4">Budget Range</label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {budgetOptions.map((option) => {
                      const isSelected = formData.budget === option.value;
                      return (
                        <button
                          key={option.value}
                          onClick={() => handleInputChange('budget', option.value)}
                          className={`p-4 rounded-xl border-2 transition-all text-left ${
                            isSelected
                              ? 'border-indigo-600 bg-indigo-50 text-gray-900 shadow-md'
                              : 'border-gray-200 hover:border-indigo-300 bg-white hover:bg-gray-50'
                          }`}
                        >
                          <div className="font-semibold text-gray-900">{option.label}</div>
                          <div className={`text-sm mt-1 ${isSelected ? 'text-gray-700' : 'text-gray-600'}`}>
                            {option.description}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Interests */}
          {step === 4 && (
            <div className="text-center">
              <FaHeart className="text-5xl text-rose-600 mx-auto mb-5" />
              <h2 className="text-2xl font-bold text-gray-900 mb-3">What interests you?</h2>
              <p className="text-gray-700 mb-7">Select your travel interests (optional)</p>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {interests.map((interest) => (
                  <button
                    key={interest.id}
                    onClick={() => toggleInterest(interest.id)}
                    className={`p-4 rounded-xl border-2 transition-all h-full w-full ${
                      formData.interests.includes(interest.id)
                        ? 'border-indigo-600 bg-indigo-50 shadow-md transform -translate-y-0.5'
                        : 'border-gray-200 hover:border-indigo-300 bg-white hover:bg-gray-50'
                    }`}
                  >
                    <div className={`text-2xl mb-2 ${formData.interests.includes(interest.id) ? 'text-indigo-600' : 'text-gray-600'}`}>
                      {interest.icon}
                    </div>
                    <div className="text-sm font-semibold text-gray-900">{interest.name}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-10 pt-6 border-t border-gray-200">
            <button
              onClick={prevStep}
              disabled={step === 1}
              className={`px-6 py-3.5 rounded-xl font-medium flex items-center space-x-2 transition-all ${
                step === 1
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border-2 border-gray-200 hover:border-gray-300 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span>Previous</span>
            </button>
            
            {step < 4 ? (
              <button
                onClick={nextStep}
                disabled={!canProceed()}
                className={`px-8 py-3.5 rounded-xl font-medium flex items-center space-x-2 transition-all ${
                  canProceed()
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md hover:shadow-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
                    : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                }`}
              >
                <span>Next</span>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ) : (
              <button
                onClick={generateItinerary}
                disabled={!canProceed()}
                className={`px-8 py-3.5 rounded-xl font-medium flex items-center space-x-2 transition-all ${
                  canProceed()
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md hover:shadow-emerald-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500'
                    : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                }`}
              >
                <span>Generate Itinerary</span>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ItineraryGenerator;
