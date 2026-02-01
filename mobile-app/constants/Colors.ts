/**
 * PhillySports color palette
 * Vintage Americana Theme - matching website design
 */

// Philadelphia team colors
export const TeamColors = {
  eagles: '#004C54',
  phillies: '#E81828',
  sixers: '#006BB6',
  flyers: '#F74902',
  union: '#B49759',
};

// Vintage Americana palette
export const VintageColors = {
  cream: '#f5f2eb',
  creamDark: '#e8e4d9',
  navy: '#1a1a1a',
  navyLight: '#2d2d2d',
  red: '#8B0000',
  redLight: '#a31515',
  gold: '#d4c9a8',
  goldDark: '#c4b898',
};

// Section header gradient colors
export const HeaderGradient = {
  start: '#d4c9a8',
  end: '#c4b898',
};

// App theme colors - matching website
export const Colors = {
  light: {
    // Core colors
    text: '#1a1a1a',
    textSecondary: '#4d4a47',
    textMuted: '#666360',
    background: '#f5f2eb', // Cream background like website
    card: '#f5f2eb',
    cardHover: '#e8e4d9',
    border: '#1a1a1a', // Dark border like website
    borderLight: '#e0e0e0',

    // Brand colors
    primary: '#8B0000', // Deep red accent
    primaryLight: '#a31515',
    accent: '#004C54', // Eagles green

    // Section headers (vintage style)
    headerBg: '#d4c9a8',
    headerBorder: '#1A2744',
    headerText: '#1A2744',

    // UI elements
    tint: '#8b0000',
    icon: '#666360',
    tabIconDefault: '#666360',
    tabIconSelected: '#8b0000',

    // Status colors
    success: '#4CAF50',
    error: '#f44336',
    warning: '#ff9800',
  },
  dark: {
    // Core colors
    text: '#e8e8e8',
    textSecondary: '#b0b0b0',
    textMuted: '#808080',
    background: '#121212',
    card: '#1e1e1e',
    cardHover: '#2a2a2a',
    border: '#333333',
    borderLight: '#444444',

    // Brand colors
    primary: '#8B0000',
    primaryLight: '#a31515',
    accent: '#004C54',

    // Section headers (keep vintage style in dark mode)
    headerBg: '#d4c9a8',
    headerBorder: '#1A2744',
    headerText: '#1A2744',

    // UI elements
    tint: '#ffffff',
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: '#ffffff',

    // Status colors
    success: '#4CAF50',
    error: '#f44336',
    warning: '#ff9800',
  },
};

// Typography scale (matching website)
export const Typography = {
  xs: 12.8,    // 0.8rem
  sm: 14.4,    // 0.9rem
  base: 16,    // 1rem
  lg: 17.6,    // 1.1rem
  xl: 20,      // 1.25rem
  '2xl': 24,   // 1.5rem
  '3xl': 28,   // 1.75rem
};

// Spacing scale
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
  '3xl': 64,
};

// Border radius (vintage = minimal)
export const BorderRadius = {
  sm: 2,
  md: 4,
  lg: 8,
  xl: 12,
};

export default Colors;
