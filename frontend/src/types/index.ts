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
  availability?: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
}
