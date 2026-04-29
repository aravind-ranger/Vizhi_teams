import React from 'react';

interface AvatarProps {
  name: string;
  url?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const Avatar: React.FC<AvatarProps> = ({ name, url, size = 'md', className = '' }) => {
  const safeName = name || '?';
  const getInitials = (n: string) => {
    return n.split(' ').map(p => p?.[0] || '').join('').toUpperCase().slice(0, 2);
  };

  const getColor = (n: string) => {
    const firstLetter = (n || '?')[0].toUpperCase();
    if ('ABCD'.includes(firstLetter)) return 'bg-blue-500';
    if ('EFGH'.includes(firstLetter)) return 'bg-green-500';
    if ('IJKL'.includes(firstLetter)) return 'bg-amber-500';
    if ('MNOP'.includes(firstLetter)) return 'bg-purple-500';
    if ('QRST'.includes(firstLetter)) return 'bg-red-500';
    return 'bg-teal-500';
  };

  const sizeClasses = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-20 h-20 text-2xl',
  };

  if (url) {
    return (
      <img 
        src={url} 
        alt={name} 
        className={`${sizeClasses[size]} rounded-full object-cover border border-border ${className}`}
      />
    );
  }

  return (
    <div className={`${sizeClasses[size]} ${getColor(safeName)} rounded-full flex items-center justify-center text-white font-bold border border-white/20 ${className}`}>
      {getInitials(safeName)}
    </div>
  );
};

export default Avatar;
