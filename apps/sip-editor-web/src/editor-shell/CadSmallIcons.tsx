import type { ReactNode } from 'react';

const s = { display: 'block' as const };

export function IcoFolderOpen(): ReactNode {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden style={s}>
      <path d="M2 4h4l1 1h7v8H2V4z" stroke="currentColor" strokeWidth="1.2" fill="none" />
      <path d="M2 6h12" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

export function IcoSave(): ReactNode {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden style={s}>
      <path d="M3 2h7l3 3v9H3V2z" stroke="currentColor" strokeWidth="1.2" fill="none" />
      <path d="M5 2v4h4V2" stroke="currentColor" strokeWidth="1" />
      <path d="M5 10h6v4H5z" stroke="currentColor" strokeWidth="1" fill="rgba(0,0,0,0.04)" />
    </svg>
  );
}

export function IcoGrid(): ReactNode {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden style={s}>
      <path d="M2 2h12v12H2z" stroke="currentColor" strokeWidth="1" fill="none" />
      <path d="M6 2v12M10 2v12M2 6h12M2 10h12" stroke="currentColor" strokeWidth="0.8" opacity="0.6" />
    </svg>
  );
}

export function IcoMagnet(): ReactNode {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden style={s}>
      <path
        d="M5 3h6v3a3 3 0 01-6 0V3zM5 6v5a3 3 0 006 0V6"
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </svg>
  );
}

export function IcoCursor(): ReactNode {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden style={s}>
      <path d="M3 2l6 7-3 1 2 5 2-1-2-5 3-1z" fill="currentColor" />
    </svg>
  );
}

export function IcoHand(): ReactNode {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden style={s}>
      <path
        d="M6 2v5M8 3v6M10 4v7M12 6v5M4 8v4a2 2 0 002 2h4"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IcoLine(): ReactNode {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden style={s}>
      <line x1="2" y1="12" x2="12" y2="2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function IcoRect(): ReactNode {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden style={s}>
      <rect x="3" y="4" width="9" height="8" stroke="currentColor" strokeWidth="1.2" fill="none" />
    </svg>
  );
}

export function IcoWindow(): ReactNode {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden style={s}>
      <rect x="2" y="5" width="12" height="7" stroke="currentColor" strokeWidth="1.2" fill="none" />
      <path d="M8 5v7M2 8.5h12" stroke="currentColor" strokeWidth="0.9" opacity="0.7" />
    </svg>
  );
}

export function IcoDoor(): ReactNode {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden style={s}>
      <path d="M4 13V5a4 4 0 018 0v8" stroke="currentColor" strokeWidth="1.2" fill="none" />
      <path d="M9 9l3 2" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

export function IcoPortal(): ReactNode {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden style={s}>
      <rect x="3" y="4" width="4" height="9" stroke="currentColor" strokeWidth="1.2" fill="none" />
      <rect x="9" y="4" width="4" height="9" stroke="currentColor" strokeWidth="1.2" fill="none" />
    </svg>
  );
}

export function IcoUndo(): ReactNode {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden style={s}>
      <path d="M5 7H2V4" stroke="currentColor" strokeWidth="1.2" />
      <path d="M3 7a5 5 0 119 2" stroke="currentColor" strokeWidth="1.2" fill="none" />
    </svg>
  );
}

export function IcoRedo(): ReactNode {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden style={s}>
      <path d="M11 7h3V4" stroke="currentColor" strokeWidth="1.2" />
      <path d="M13 7a5 5 0 10-9 2" stroke="currentColor" strokeWidth="1.2" fill="none" />
    </svg>
  );
}

export function IcoZoomIn(): ReactNode {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden style={s}>
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.2" fill="none" />
      <path d="M7 5v4M5 7h4M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export function IcoZoomOut(): ReactNode {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden style={s}>
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.2" fill="none" />
      <path d="M5 7h4M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export function IcoFit(): ReactNode {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden style={s}>
      <path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" stroke="currentColor" strokeWidth="1.2" fill="none" />
    </svg>
  );
}

export function IcoReset(): ReactNode {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden style={s}>
      <path d="M8 3a5 5 0 104 7" stroke="currentColor" strokeWidth="1.2" fill="none" />
      <path d="M13 3v4h-4" stroke="currentColor" strokeWidth="1.2" fill="none" />
    </svg>
  );
}

export function IcoImport(): ReactNode {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden style={s}>
      <path d="M8 2v8M5 6l3-3 3 3" stroke="currentColor" strokeWidth="1.2" fill="none" />
      <path d="M2 14h12" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export function IcoVersion(): ReactNode {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden style={s}>
      <rect x="3" y="2" width="10" height="12" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none" />
      <path d="M6 6h4M6 9h4" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}
