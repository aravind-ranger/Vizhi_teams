import React from "react";
import { X, Sparkles, CheckCircle2 } from "lucide-react";
import { APP_VERSION, getLatestVersion } from "../config/version";

interface ReleaseNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ReleaseNotesModal: React.FC<ReleaseNotesModalProps> = ({
  isOpen,
  onClose,
}) => {
  const latest = getLatestVersion();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto scrollbar-hide border border-gray-200 dark:border-white/10">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-primary to-blue-600 text-white p-8 rounded-t-[32px] flex items-start justify-between">
          <div className="flex items-start space-x-4">
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-black">Release Notes</h2>
              <p className="text-white/80 text-sm font-medium mt-1">
                Version {APP_VERSION}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 space-y-8">
          {/* Latest Release */}
          <div className="space-y-4">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-1 h-8 bg-primary rounded-full" />
              <div>
                <h3 className="text-xl font-black text-text-primary">
                  {latest.title}
                </h3>
                <p className="text-xs text-text-muted font-bold uppercase tracking-widest mt-1">
                  {latest.date} • v{latest.version}
                </p>
              </div>
            </div>

            <div className="space-y-3 pl-6">
              {latest.changes.map((change, idx) => (
                <div key={idx} className="flex items-start space-x-3 group">
                  <div className="pt-0.5">
                    <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0 group-hover:scale-110 transition-transform" />
                  </div>
                  <p className="text-sm font-medium text-text-primary group-hover:text-primary transition-colors">
                    {change}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-primary/5 dark:bg-primary/10 border border-primary/20 dark:border-primary/30 rounded-xl p-4 space-y-2">
            <p className="text-sm font-bold text-primary">Note</p>
            <p className="text-xs text-text-secondary">
              This summary includes all major updates completed during the
              current session.
            </p>
          </div>

          {/* Button */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 bg-primary text-white font-black py-3 rounded-xl hover:bg-primary/90 transition-all active:scale-95"
            >
              Acknowledge
            </button>
          </div>

          {/* Version Info */}
          <div className="text-center text-[10px] text-text-muted font-bold uppercase tracking-widest">
            <p>Running Vizhi v{APP_VERSION}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReleaseNotesModal;
