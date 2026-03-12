import { create } from 'zustand';

interface CallStore {
  inCall: boolean;
  setInCall: (inCall: boolean) => void;
}

export const useCallStore = create<CallStore>()((set) => ({
  inCall: false,
  setInCall: (inCall: boolean) => set({ inCall })
}));

