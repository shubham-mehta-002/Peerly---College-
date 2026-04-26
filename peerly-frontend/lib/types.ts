export type CardLayout = 'open' | 'bordered' | 'filled';
export type AnonStyle = 'badge' | 'inline' | 'ghost';
export type AccentColor = 'sage' | 'navy' | 'terra';

export interface TweaksState {
  darkMode: boolean;
  cardLayout: CardLayout;
  anonStyle: AnonStyle;
  accentColor: AccentColor;
  setDarkMode: (v: boolean) => void;
  setCardLayout: (v: CardLayout) => void;
  setAnonStyle: (v: AnonStyle) => void;
  setAccentColor: (v: AccentColor) => void;
}

export interface Post {
  id: number;
  author: string;
  anon: boolean;
  time: string;
  content: string;
  upvotes: number;
  comments: number;
  hasImage: boolean;
  trending: boolean;
  global: boolean;
}

export interface Community {
  id: number;
  name: string;
  desc: string;
  members: number;
  category: string;
  active?: boolean;
}

export interface Message {
  id: number;
  author: string;
  text: string;
  time: string;
  mine: boolean;
}

export interface Comment {
  id: number;
  author: string;
  anon: boolean;
  time: string;
  text: string;
  upvotes: number;
  depth: number;
}
