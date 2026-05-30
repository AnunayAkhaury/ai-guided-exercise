import { create } from 'zustand';

interface UserStore {
  uid: null | string;
  role: null | string;
  fullname: null | string;
  username: null | string;
  email: null | string;
  authInitialized: boolean;

  setUid: (uid: string) => void;
  setRole: (role: string) => void;
  setFullName: (fullname: string) => void;
  setUsername: (username: string) => void;
  setEmail: (email: string | null) => void;
  setAuthInitialized: (value: boolean) => void;

  reset: () => void;
}

export const useUserStore = create<UserStore>()((set) => ({
  uid: null,
  role: null,
  fullname: null,
  username: null,
  email: null,
  authInitialized: false,

  setUid: (uid) => set({ uid }),
  setRole: (role) => set({ role }),
  setFullName: (fullname) => set({ fullname }),
  setUsername: (username) => set({ username }),
  setEmail: (email) => set({ email }),
  setAuthInitialized: (value) => set({ authInitialized: value }),

  reset: () =>
    set({
      uid: null,
      role: null,
      fullname: null,
      username: null,
      email: null,
      authInitialized: false
    })
}));
