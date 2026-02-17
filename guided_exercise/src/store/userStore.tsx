import { create } from 'zustand'

interface UserStore {
  uid: null | string,
  role: null | string
  fullname: null | string
  setUid: (uid: any) => void
  setRole: (role: string) => void
  setFullName: (role: string) => void
}

export const useUserStore = create<UserStore>()((set) => ({
  uid: null,
  role: null,
  fullname: null,
  setUid: (uid: string) => set({ uid }),
  setRole: (role: string) => set({ role }),
  setFullName: (fullname: string) => set({ fullname }),
}))
