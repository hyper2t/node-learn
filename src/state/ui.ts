import { Platform } from 'react-native';
import { create } from 'zustand';

const KEY = 'node-learn.sidebar.collapsed';
const readInitial = (): boolean => {
  if (Platform.OS !== 'web' || typeof localStorage === 'undefined') return false;
  return localStorage.getItem(KEY) === '1';
};

type UiState = { sidebarCollapsed: boolean; toggleSidebar: () => void; setSidebarCollapsed: (v: boolean) => void };
export const useUiStore = create<UiState>((set) => ({
  sidebarCollapsed: readInitial(),
  setSidebarCollapsed: (v) => {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') localStorage.setItem(KEY, v ? '1' : '0');
    set({ sidebarCollapsed: v });
  },
  toggleSidebar: () => set((s) => {
    const v = !s.sidebarCollapsed;
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') localStorage.setItem(KEY, v ? '1' : '0');
    return { sidebarCollapsed: v };
  }),
}));
