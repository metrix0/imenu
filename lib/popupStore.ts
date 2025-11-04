'use client';
import { create } from 'zustand';

type PopupState = {
    isOpen: boolean;
    content: React.ReactNode | null;
    open: (content: React.ReactNode) => void;
    close: () => void;
};

export const usePopup = create<PopupState>((set) => ({
    isOpen: false,
    content: null,
    open: (content) => set({ isOpen: true, content }),
    close: () => set({ isOpen: false, content: null }),
}));
