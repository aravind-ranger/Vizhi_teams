import React from 'react';
import { X, CheckCircle2, AlertTriangle, User, Clock, MapPin } from 'lucide-react';
import Avatar from './Avatar';

interface UserListModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  users: any[];
  type: 'present' | 'absent';
}

const UserListModal: React.FC<UserListModalProps> = ({ isOpen, onClose, title, users, type }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-glass dark:border dark:border-border w-full max-w-2xl rounded-[40px] shadow-2xl animate-scale-up overflow-hidden">
        <div className="p-8 border-b border-gray-100 dark:border-border flex justify-between items-center bg-gray-50/50 dark:bg-transparent">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-xl ${type === 'present' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
              {type === 'present' ? <CheckCircle2 className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
            </div>
            <div>
              <h3 className="text-xl font-black text-text-primary">{title}</h3>
              <p className="text-xs font-bold text-text-muted uppercase tracking-widest">{users.length} Users Found</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors text-text-muted">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-8 max-h-[60vh] overflow-y-auto">
          {users.length === 0 ? (
            <div className="text-center py-20 bg-gray-50 dark:bg-white/5 rounded-3xl border border-dashed border-gray-200 dark:border-border">
              <User className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-sm font-bold text-text-muted uppercase tracking-widest">No users found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {users.map((user) => (
                <div key={user.id} className="flex items-center space-x-4 p-4 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-border hover:shadow-md transition-all group">
                  <Avatar name={user.name} url={user.avatar_url} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-text-primary truncate">{user.name}</p>
                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest truncate">{user.role} • {user.department}</p>
                  </div>
                  {type === 'present' && user.check_in && (
                    <div className="text-right flex-shrink-0">
                      <div className="flex items-center text-[10px] font-black text-success uppercase tracking-tighter">
                        <Clock className="w-3 h-3 mr-1" />
                        {new Date(user.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      {user.work_location && (
                        <div className="flex items-center text-[8px] font-black text-text-muted uppercase tracking-widest mt-0.5 justify-end">
                          <MapPin className="w-2 h-2 mr-0.5" />
                          {user.work_location}
                        </div>
                      )}
                    </div>
                  )}
                  {type === 'absent' && (
                    <div className="text-[10px] font-black text-danger uppercase tracking-widest">
                      Offline
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-8 bg-gray-50 dark:bg-transparent border-t border-gray-100 dark:border-border flex justify-end">
          <button 
            onClick={onClose}
            className="px-10 py-4 bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserListModal;
