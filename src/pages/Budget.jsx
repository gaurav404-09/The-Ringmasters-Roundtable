import React, { useState } from 'react';
import { FaMoneyBillWave, FaHotel, FaUtensils, FaTicketAlt, FaCar, FaPlane, FaTrain, FaBus, FaShoppingBag } from 'react-icons/fa';

const Budget = () => {
  const [tripDetails, setTripDetails] = useState({
    destination: '',
    travelers: 1,
    duration: 3,
    travelClass: 'economy',
  });
  
  const [expenses, setExpenses] = useState({
    transportation: 0,
    accommodation: 0,
    food: 0,
    activities: 0,
    shopping: 0,
    other: 0,
  });
  
  // Mock budget data
  const budgetRecommendations = {
    low: 50,
    medium: 100,
    high: 200,
  };
  
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setTripDetails(prev => ({
      ...prev,
      [name]: name === 'travelers' || name === 'duration' ? parseInt(value) || 0 : value
    }));
  };
  
  const handleExpenseChange = (category, value) => {
    setExpenses(prev => ({
      ...prev,
      [category]: parseFloat(value) || 0
    }));
  };
  
  const calculateTotal = () => {
    return Object.values(expenses).reduce((sum, value) => sum + value, 0);
  };
  
  const getBudgetStatus = () => {
    const total = calculateTotal();
    const dailyBudget = total / (tripDetails.duration || 1);
    
    if (dailyBudget < budgetRecommendations.low) {
      return { status: 'Low', color: 'text-green-600 bg-green-100' };
    } else if (dailyBudget < budgetRecommendations.medium) {
      return { status: 'Moderate', color: 'text-yellow-600 bg-yellow-100' };
    } else if (dailyBudget < budgetRecommendations.high) {
      return { status: 'Comfortable', color: 'text-orange-600 bg-orange-100' };
    } else {
      return { status: 'Luxury', color: 'text-red-600 bg-red-100' };
    }
  };
  
  const budgetStatus = getBudgetStatus();
  const totalBudget = calculateTotal();
  const dailyAverage = totalBudget / (tripDetails.duration || 1);
  
  const expenseCategories = [
    { id: 'transportation', name: 'Transportation', icon: <FaCar className="text-blue-500" /> },
    { id: 'accommodation', name: 'Accommodation', icon: <FaHotel className="text-purple-500" /> },
    { id: 'food', name: 'Food & Drinks', icon: <FaUtensils className="text-red-500" /> },
    { id: 'activities', name: 'Activities', icon: <FaTicketAlt className="text-green-500" /> },
    { id: 'shopping', name: 'Shopping', icon: <FaShoppingBag className="text-pink-500" /> },
    { id: 'other', name: 'Other', icon: <FaMoneyBillWave className="text-gray-500" /> },
  ];
  
  const transportOptions = [
    { value: 'economy', label: 'Economy', icon: <FaBus /> },
    { value: 'standard', label: 'Standard', icon: <FaTrain /> },
    { value: 'premium', label: 'Premium', icon: <FaPlane /> },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-light to-gray-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-display font-bold text-dark mb-8">
          Quartermaster's Ledger
        </h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Trip Details */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-xl p-6 sticky top-6">
              <h2 className="text-2xl font-bold mb-6 text-gray-800">Trip Details</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Destination</label>
                  <input
                    type="text"
                    name="destination"
                    value={tripDetails.destination}
                    onChange={handleInputChange}
                    placeholder="Where are you going?"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Travelers</label>
                    <input
                      type="number"
                      name="travelers"
                      min="1"
                      value={tripDetails.travelers}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Duration (days)</label>
                    <input
                      type="number"
                      name="duration"
                      min="1"
                      value={tripDetails.duration}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Travel Style</label>
                  <div className="grid grid-cols-3 gap-2">
                    {transportOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setTripDetails(prev => ({ ...prev, travelClass: option.value }))}
                        className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-colors ${
                          tripDetails.travelClass === option.value
                            ? 'border-purple-500 bg-purple-50'
                            : 'border-gray-200 hover:border-purple-300'
                        }`}
                      >
                        <span className="text-lg mb-1">{option.icon}</span>
                        <span className="text-xs font-medium">{option.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="pt-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700">Budget Level:</span>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${budgetStatus.color}`}>
                      {budgetStatus.status}
                    </span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${
                        budgetStatus.status === 'Low' ? 'bg-green-500' :
                        budgetStatus.status === 'Moderate' ? 'bg-yellow-500' :
                        budgetStatus.status === 'Comfortable' ? 'bg-orange-500' : 'bg-red-500'
                      }`} 
                      style={{ width: `${Math.min(100, (dailyAverage / budgetRecommendations.high) * 100)}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>Economy</span>
                    <span>Luxury</span>
                  </div>
                </div>
              </div>
              
              <div className="mt-8 p-4 bg-purple-50 rounded-lg">
                <div className="text-center">
                  <div className="text-4xl font-bold text-purple-700">${totalBudget.toFixed(2)}</div>
                  <div className="text-sm text-gray-600">Total Estimated Budget</div>
                  <div className="mt-2 text-sm text-gray-500">
                    ${dailyAverage.toFixed(2)} per day
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Expense Tracker */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-xl overflow-hidden">
              <div className="p-6 bg-gradient-to-r from-purple-600 to-purple-700 text-white">
                <h2 className="text-2xl font-bold">Expense Tracker</h2>
                <p className="opacity-90">Plan and track your travel expenses</p>
              </div>
              
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {expenseCategories.map((category) => (
                    <div key={category.id} className="bg-gray-50 p-4 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center">
                          <span className="mr-3 p-2 bg-white rounded-lg shadow-sm">
                            {category.icon}
                          </span>
                          <span className="font-medium">{category.name}</span>
                        </div>
                        <span className="font-semibold">
                          ${expenses[category.id]?.toFixed(2) || '0.00'}
                        </span>
                      </div>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <span className="text-gray-500">$</span>
                        </div>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={expenses[category.id] || ''}
                          onChange={(e) => handleExpenseChange(category.id, e.target.value)}
                          className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="mt-8">
                  <h3 className="text-lg font-semibold mb-4">Budget Breakdown</h3>
                  <div className="space-y-4">
                    {expenseCategories.map((category) => (
                      <div key={category.id} className="flex items-center">
                        <div className="w-32 text-sm font-medium text-gray-700">
                          {category.name}
                        </div>
                        <div className="flex-1 mx-4">
                          <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-purple-500" 
                              style={{ 
                                width: `${(expenses[category.id] / (totalBudget || 1)) * 100}%`,
                                backgroundColor: category.icon.props.className.includes('blue') ? '#3B82F6' :
                                                category.icon.props.className.includes('purple') ? '#8B5CF6' :
                                                category.icon.props.className.includes('red') ? '#EF4444' :
                                                category.icon.props.className.includes('green') ? '#10B981' :
                                                category.icon.props.className.includes('pink') ? '#EC4899' : '#6B7280'
                              }}
                            ></div>
                          </div>
                        </div>
                        <div className="w-24 text-right text-sm font-medium">
                          ${expenses[category.id]?.toFixed(2) || '0.00'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="mt-8 p-6 bg-gray-50 rounded-lg">
                  <h3 className="text-lg font-semibold mb-4">Budgeting Tips</h3>
                  <ul className="space-y-3">
                    <li className="flex items-start">
                      <span className="text-green-500 mr-2">✓</span>
                      <span>Allocate more budget for accommodation in expensive cities</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-green-500 mr-2">✓</span>
                      <span>Consider local transportation passes for multiple trips</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-green-500 mr-2">✓</span>
                      <span>Set aside 10-15% of your budget for unexpected expenses</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-green-500 mr-2">✓</span>
                      <span>Look for free activities and attractions at your destination</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Budget;
