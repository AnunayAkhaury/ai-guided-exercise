import { create } from 'zustand'

interface UserStore {
  uid: null | string,
  role: null | string
  fullname: null | string
  username: null | string
  email: null | string
  setUid: (uid: any) => void
  setRole: (role: string) => void
  setFullName: (fullname: string) => void
  setUsername: (username: string) => void
  setEmail: (email: string | null) => void
  reset: () => void
}

export const useUserStore = create<UserStore>()((set) => ({
  uid: null,
  role: null,
  fullname: null,
  username: null,
  email: null,
  setUid: (uid: string) => set({ uid }),
  setRole: (role: string) => set({ role }),
  setFullName: (fullname: string) => set({ fullname }),
  setUsername: (username: string) => set({ username }),
  setEmail: (email: string | null) => set({ email }),
  reset: () => set({ uid: null, role: null, fullname: null, username: null, email: null }),
}))
