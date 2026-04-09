import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface MobileSidebarContextType {
  /** Открыто ли мобильное боковое меню (CRM drawer слева). */
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  /** Алиасы для единого API (то же, что open / close / toggle). */
  openMobileMenu: () => void;
  closeMobileMenu: () => void;
  toggleMobileMenu: () => void;
}

const MobileSidebarContext = createContext<MobileSidebarContextType | undefined>(undefined);

export const useMobileSidebar = () => {
  const context = useContext(MobileSidebarContext);
  if (context === undefined) {
    throw new Error('useMobileSidebar must be used within a MobileSidebarProvider');
  }
  return context;
};

interface MobileSidebarProviderProps {
  children: ReactNode;
}

export const MobileSidebarProvider: React.FC<MobileSidebarProviderProps> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  const value: MobileSidebarContextType = {
    isOpen,
    open,
    close,
    toggle,
    openMobileMenu: open,
    closeMobileMenu: close,
    toggleMobileMenu: toggle
  };

  return <MobileSidebarContext.Provider value={value}>{children}</MobileSidebarContext.Provider>;
};
