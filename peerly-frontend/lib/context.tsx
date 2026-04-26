'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SkeletonTheme } from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import type { TweaksState, CardLayout, AnonStyle, AccentColor } from './types';

const TweaksContext = createContext<TweaksState>({
  darkMode: false,
  cardLayout: 'open',
  anonStyle: 'badge',
  accentColor: 'sage',
  setDarkMode: () => {},
  setCardLayout: () => {},
  setAnonStyle: () => {},
  setAccentColor: () => {},
});

export function TweaksProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [darkMode, setDarkModeState] = useState(false);
  const [cardLayout, setCardLayout] = useState<CardLayout>('open');
  const [anonStyle, setAnonStyle] = useState<AnonStyle>('badge');
  const [accentColor, setAccentColor] = useState<AccentColor>('sage');

  useEffect(() => {
    const stored = localStorage.getItem('peerly_dark');
    if (stored === 'true') {
      setDarkModeState(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  const setDarkMode = (v: boolean) => {
    setDarkModeState(v);
    localStorage.setItem('peerly_dark', String(v));
    if (v) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleSetAccentColor = (v: AccentColor) => {
    setAccentColor(v);
    if (v === 'sage') {
      document.documentElement.removeAttribute('data-accent');
    } else {
      document.documentElement.setAttribute('data-accent', v);
    }
  };

  const skeletonBase = darkMode ? '#2a2f3a' : '#e8eaed';
  const skeletonHighlight = darkMode ? '#363c4a' : '#f4f5f7';

  return (
    <QueryClientProvider client={queryClient}>
      <SkeletonTheme baseColor={skeletonBase} highlightColor={skeletonHighlight}>
        <TweaksContext.Provider value={{
          darkMode, cardLayout, anonStyle, accentColor,
          setDarkMode, setCardLayout, setAnonStyle,
          setAccentColor: handleSetAccentColor,
        }}>
          {children}
        </TweaksContext.Provider>
      </SkeletonTheme>
    </QueryClientProvider>
  );
}

export const useTweaks = () => useContext(TweaksContext);
