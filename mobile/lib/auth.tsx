import { createContext, useContext, useMemo, useState, type PropsWithChildren } from 'react';

type UserRole = 'admin' | 'viewer';

type AuthUser = {
  email: string;
  name: string;
  role: UserRole;
};

type RegisterInput = {
  email: string;
  name: string;
  password: string;
  role: UserRole;
};

type LoginInput = {
  email: string;
  password: string;
};

type StoredAccount = RegisterInput;

type AuthContextValue = {
  user: AuthUser | null;
  login: (input: LoginInput) => void;
  logout: () => void;
  register: (input: RegisterInput) => void;
};

const defaultAccounts: StoredAccount[] = [
  {
    email: 'admin@hydrigo.app',
    name: 'Admin Hydrigo',
    password: 'admin123',
    role: 'admin',
  },
  {
    email: 'viewer@hydrigo.app',
    name: 'Viewer Hydrigo',
    password: 'viewer123',
    role: 'viewer',
  },
];

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [accounts, setAccounts] = useState<StoredAccount[]>(defaultAccounts);
  const [user, setUser] = useState<AuthUser | null>(null);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      login: ({ email, password }) => {
        const normalizedEmail = email.trim().toLowerCase();
        const account = accounts.find((item) => item.email.toLowerCase() === normalizedEmail);

        if (!account || account.password !== password) {
          throw new Error('Email atau kata sandi belum cocok.');
        }

        setUser({
          email: account.email,
          name: account.name,
          role: account.role,
        });
      },
      logout: () => {
        setUser(null);
      },
      register: ({ email, name, password, role }) => {
        const normalizedEmail = email.trim().toLowerCase();

        if (accounts.some((item) => item.email.toLowerCase() === normalizedEmail)) {
          throw new Error('Email ini sudah terdaftar.');
        }

        const nextAccount: StoredAccount = {
          email: normalizedEmail,
          name: name.trim(),
          password,
          role,
        };

        setAccounts((current) => [...current, nextAccount]);
        setUser({
          email: nextAccount.email,
          name: nextAccount.name,
          role: nextAccount.role,
        });
      },
    }),
    [accounts, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth harus dipakai di dalam AuthProvider.');
  }

  return context;
}
