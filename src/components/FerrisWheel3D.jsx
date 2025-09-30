import React from 'react';

const FerrisWheel3D = () => {
  return (
    <div className="fixed inset-0 flex items-center justify-center pointer-events-none">
      <div className="animate-ferris opacity-20">
        <svg width="600" height="600" viewBox="0 0 600 600" className="absolute">
          <circle cx="300" cy="300" r="250" fill="none" stroke="#FFD700" strokeWidth="12"/>
          <circle cx="300" cy="300" r="30" fill="#4B0082"/>
          {/* Spokes */}
          {Array.from({length: 8}).map((_, i) => {
            const angle = (i * 45) * Math.PI / 180;
            const x2 = 300 + 250 * Math.cos(angle);
            const y2 = 300 + 250 * Math.sin(angle);
            return <line key={i} x1="300" y1="300" x2={x2} y2={y2} stroke="#8B4513" strokeWidth="6"/>;
          })}
          {/* Cabins */}
          {Array.from({length: 12}).map((_, i) => {
            const angle = (i * 30) * Math.PI / 180;
            const x = 300 + 250 * Math.cos(angle);
            const y = 300 + 250 * Math.sin(angle);
            const colors = ["#DC143C", "#1E90FF", "#FFD700", "#9932CC"];
            return <rect key={i} x={x-20} y={y-15} width="40" height="30" fill={colors[i % colors.length]} rx="8"/>;
          })}
        </svg>
      </div>
    </div>
  );
};

export default FerrisWheel3D;
