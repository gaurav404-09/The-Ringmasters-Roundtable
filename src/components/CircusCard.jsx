import React from 'react';

const CircusCard = ({ variant, children, className }) => {
  const variants = {
    glass: 'bg-white/10 backdrop-blur-md border border-white/20 shadow-glass',
  };

  return (
    <div className={`p-8 rounded-xl ${variants[variant] || 'bg-white/10'} ${className}`}>
      {children}
    </div>
  );
};

export default CircusCard;
