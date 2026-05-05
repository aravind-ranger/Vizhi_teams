import React from 'react';

interface ProgressBarProps {
  progress: number; // 0 to 100
  color?: string;
  height?: string;
  className?: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ progress, color = 'bg-primary', height = 'h-2', className = '' }) => {
  return (
    <div className={`w-full bg-gray-100 rounded-full overflow-hidden ${height} ${className}`}>
      <div 
        className={`${color} h-full transition-all duration-600 ease-in-out`}
        style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
      />
    </div>
  );
};

export default ProgressBar;
