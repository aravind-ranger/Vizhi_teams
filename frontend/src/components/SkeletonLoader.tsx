import React from 'react';

interface SkeletonLoaderProps {
  type: 'card' | 'table' | 'stats' | 'text';
  count?: number;
}

const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({ type, count = 1 }) => {
  const renderSkeleton = () => {
    switch (type) {
      case 'card':
        return (
          <div className="card p-6 space-y-4">
            <div className="skeleton w-1/4 h-4 rounded" />
            <div className="skeleton w-3/4 h-6 rounded" />
            <div className="skeleton w-full h-20 rounded" />
            <div className="flex justify-between">
              <div className="skeleton w-1/4 h-2 rounded" />
              <div className="skeleton w-1/4 h-2 rounded" />
            </div>
          </div>
        );
      case 'table':
        return (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex space-x-4">
                <div className="skeleton w-12 h-12 rounded-full" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="skeleton w-3/4 h-4 rounded" />
                  <div className="skeleton w-1/2 h-3 rounded" />
                </div>
                <div className="skeleton w-20 h-8 rounded" />
              </div>
            ))}
          </div>
        );
      case 'stats':
        return (
          <div className="card p-6 flex items-center space-x-4">
            <div className="skeleton w-12 h-12 rounded-xl" />
            <div className="space-y-2">
              <div className="skeleton w-20 h-3 rounded" />
              <div className="skeleton w-12 h-6 rounded" />
            </div>
          </div>
        );
      case 'text':
        return <div className="skeleton w-full h-4 rounded" />;
      default:
        return null;
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6">
      {[...Array(count)].map((_, i) => (
        <React.Fragment key={i}>
          {renderSkeleton()}
        </React.Fragment>
      ))}
    </div>
  );
};

export default SkeletonLoader;
