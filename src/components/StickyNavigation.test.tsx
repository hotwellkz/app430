/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { StickyNavigation } from './StickyNavigation';

vi.mock('../contexts/MenuVisibilityContext', () => ({
  useMenuVisibility: () => ({ isMenuVisible: true }),
}));

vi.mock('../contexts/MobileWhatsAppChatContext', () => ({
  useMobileWhatsAppChat: () => ({ isMobileWhatsAppChatOpen: false }),
}));

vi.mock('../hooks/useIsMobile', () => ({
  useIsMobile: () => false,
}));

vi.mock('../hooks/useWhatsAppFloatingButtonState', () => ({
  useWhatsAppFloatingButtonState: () => ({
    unreadChatsCount: 0,
    hasAwaitingReply: false,
  }),
}));

vi.mock('../hooks/useCurrentCompanyUser', () => ({
  useCurrentCompanyUser: () => ({
    loading: false,
    canAccess: () => true,
  }),
}));

describe('StickyNavigation', () => {
  beforeEach(() => {
    document.body.classList.remove('attachment-preview-open');
  });

  it('не отображается вне transaction роутов', () => {
    render(
      <MemoryRouter initialEntries={['/clients']}>
        <StickyNavigation onNavigate={vi.fn()} />
      </MemoryRouter>
    );
    expect(screen.queryByTestId('sticky-navigation-root')).toBeNull();
  });

  it('отображается на странице транзакций', () => {
    render(
      <MemoryRouter initialEntries={['/transactions']}>
        <StickyNavigation onNavigate={vi.fn()} />
      </MemoryRouter>
    );
    expect(screen.getByTestId('sticky-navigation-root')).toBeTruthy();
  });

  it('скрывается при открытом preview вложения', () => {
    document.body.classList.add('attachment-preview-open');
    render(
      <MemoryRouter initialEntries={['/transactions/history/1']}>
        <StickyNavigation onNavigate={vi.fn()} />
      </MemoryRouter>
    );
    expect(screen.queryByTestId('sticky-navigation-root')).toBeNull();
  });
});

