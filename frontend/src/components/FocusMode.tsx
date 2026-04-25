import React, { useState, useEffect } from 'react';
import { Timer, X, Play, Pause, RotateCcw, Zap } from 'lucide-react';
import { toast } from 'react-hot-toast';

const FocusMode: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [seconds, setSeconds] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [mode, setMode] = useState<'work' | 'break'>('work');

  useEffect(() => {
    let interval: any = null;
    if (isActive && seconds > 0) {
      interval = setInterval(() => {
        setSeconds((s) => s - 1);
      }, 1000);
    } else if (seconds === 0) {
      clearInterval(interval);
      const nextMode = mode === 'work' ? 'break' : 'work';
      const nextTime = nextMode === 'work' ? 25 * 60 : 5 * 60;
      setMode(nextMode);
      setSeconds(nextTime);
      setIsActive(false);
      toast.success(nextMode === 'work' ? 'Time to focus!' : 'Take a break!', {
        icon: '🔔',
        duration: 5000,
      });
    }
    return () => clearInterval(interval);
  }, [isActive, seconds, mode]);

  const toggleTimer = () => setIsActive(!isActive);
  const resetTimer = () => {
    setIsActive(false);
    setSeconds(mode === 'work' ? 25 * 60 : 5 * 60);
  };

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="relative w-full max-w-2xl p-12 text-center space-y-12">
        <button 
          onClick={onClose}
          className="absolute top-0 right-0 p-4 text-white/50 hover:text-white transition-colors"
        >
          <X className="w-8 h-8" />
        </button>

        <div className="space-y-4">
          <div className="flex items-center justify-center space-x-3 text-primary">
            <Zap className="w-6 h-6 fill-current" />
            <span className="text-sm font-bold uppercase tracking-[0.3em]">{mode === 'work' ? 'Deep Work Session' : 'Short Break'}</span>
          </div>
          <h2 className="text-9xl font-black text-white tracking-tighter tabular-nums">
            {formatTime(seconds)}
          </h2>
        </div>

        <div className="flex items-center justify-center space-x-8">
          <button 
            onClick={resetTimer}
            className="p-4 rounded-full bg-white/5 text-white hover:bg-white/10 transition-all active:scale-95"
          >
            <RotateCcw className="w-8 h-8" />
          </button>
          <button 
            onClick={toggleTimer}
            className={`w-24 h-24 rounded-full flex items-center justify-center transition-all active:scale-90 shadow-2xl ${
              isActive ? 'bg-white text-black' : 'bg-primary text-white shadow-primary/20'
            }`}
          >
            {isActive ? <Pause className="w-10 h-10 fill-current" /> : <Play className="w-10 h-10 fill-current ml-1" />}
          </button>
          <div className="w-16"></div> {/* Spacer */}
        </div>

        <div className="pt-12">
          <p className="text-white/30 text-sm font-medium italic">
            "Your focus is your greatest currency."
          </p>
        </div>
      </div>
    </div>
  );
};

export default FocusMode;
