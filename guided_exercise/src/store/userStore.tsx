import { create } from 'zustand'

interface UserStore {
  uid: null | string,
  role: null | string
  fullname: null | string
  username: null | string
  setUid: (uid: any) => void
  setRole: (role: string) => void
  setFullName: (fullname: string) => void
  setUsername: (username: string) => void
}

export const useUserStore = create<UserStore>()((set) => ({
  uid: null,
  role: null,
  fullname: null,
  username: null,
  setUid: (uid: string) => set({ uid }),
  setRole: (role: string) => set({ role }),
  setFullName: (fullname: string) => set({ fullname }),
  setUsername: (username: string) => set({ username }),
}))
