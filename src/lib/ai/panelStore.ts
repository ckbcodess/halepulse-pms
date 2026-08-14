import { create } from 'zustand';

/**
 * Open/close state for the global AI companion panel. Lives in a store rather
 * than AppShell state so any page can open the panel (e.g. a "explain this"
 * link on a report) without prop-drilling through the shell.
 */
interface AiPanelStore {
  open: boolean;
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
  setOpen: (open: boolean) => void;
}

export const useAiPanelStore = create<AiPanelStore>((set) => ({
  open: false,
  openPanel: () => set({ open: true }),
  closePanel: () => set({ open: false }),
  togglePanel: () => set((s) => ({ open: !s.open })),
  setOpen: (open) => set({ open }),
}));
