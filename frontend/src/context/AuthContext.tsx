import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

interface User {
  id: number;
  username: string;
  full_name: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const savedToken = localStorage.getItem('gms_token');
      const savedUser = localStorage.getItem('gms_user');
      const savedLoginTime = localStorage.getItem('gms_login_time');
      
      if (savedToken && savedUser) {
        const thirtyDays = 30 * 24 * 60 * 60 * 1000;
        const loginTime = savedLoginTime ? parseInt(savedLoginTime, 10) : Date.now();
        const elapsed = Date.now() - loginTime;

        if (elapsed >= thirtyDays) {
          localStorage.removeItem('gms_token');
          localStorage.removeItem('gms_user');
          localStorage.removeItem('gms_login_time');
          setToken(null);
          setUser(null);
        } else {
          if (!savedLoginTime) {
            localStorage.setItem('gms_login_time', String(Date.now()));
          }
          setToken(savedToken);
          setUser(JSON.parse(savedUser));
        }
      }
    } catch (e) {
      console.error('Error restoring auth state:', e);
      localStorage.removeItem('gms_token');
      localStorage.removeItem('gms_user');
      localStorage.removeItem('gms_login_time');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!token) return;

    // Periodically verify session age every 15 minutes (avoids 32-bit int overflow in setTimeout)
    const checkExpiration = () => {
      const savedLoginTime = localStorage.getItem('gms_login_time');
      if (!savedLoginTime) return;

      const elapsed = Date.now() - parseInt(savedLoginTime, 10);
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;

      if (elapsed >= thirtyDays) {
        logout();
      }
    };

    const interval = setInterval(checkExpiration, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [token]);

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem('gms_token', newToken);
    localStorage.setItem('gms_user', JSON.stringify(newUser));
    localStorage.setItem('gms_login_time', String(Date.now()));
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem('gms_token');
    localStorage.removeItem('gms_user');
    localStorage.removeItem('gms_login_time');
    setToken(null);
    setUser(null);
  };

  if (loading) return null;

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
