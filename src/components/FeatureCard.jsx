import React from 'react';

const FeatureCard = ({ icon, title, description, color }) => {
  const colorClasses = {
    blue: 'text-blue-500',
    gold: 'text-circus-gold',
    red: 'text-circus-red',
  };

  return (
    <div className="bg-white/10 backdrop-blur-md p-8 rounded-xl border border-white/20 text-center transform hover:-translate-y-2 transition-transform duration-300 shadow-glass hover:shadow-2xl">
      <div className={`inline-block p-4 bg-white/20 backdrop-blur-sm rounded-full mb-4 ${colorClasses[color] || 'text-white'}`}>
        {icon}
      </div>
      <h3 className="text-xl font-semibold text-circus-cream mb-2">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
};

export default FeatureCard;
