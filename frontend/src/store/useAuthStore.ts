import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthState, User } from '../types';
import { auth } from '../firebase';

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      setAuth: (user: User) => {
        set({ user });
      },
      logout: async () => {
        try {
          // Sign out from Firebase to clear the persistent session
          await auth.signOut();
        } catch (e) {
          // ignore sign-out errors
        }
        // Clear persisted profile immediately
        try {
          localStorage.removeItem('vizhi-teams-auth');
        } catch (e) {
          // ignore
        }
        set({ user: null });
      },
    }),
    {
      name: 'vizhi-teams-auth',
    }
  )
);
