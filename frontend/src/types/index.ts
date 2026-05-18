export type Role = 'admin' | 'manager' | 'employee';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  department?: string;
  avatar_url?: string;
  is_active: boolean;
  is_verified: boolean;
  availability_status?: string;
}

export interface AuthState {
  user: User | null;
  setAuth: (user: User) => void;
  logout: () => Promise<void>;
}
