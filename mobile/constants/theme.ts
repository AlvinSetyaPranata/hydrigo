import { Platform } from 'react-native';

const tintColorLight = '#2f7d32';
const tintColorDark = '#9be27a';

export const Colors = {
  light: {
    text: '#17301a',
    background: '#f5f8f1',
    tint: tintColorLight,
    icon: '#6f7d68',
    tabIconDefault: '#87927d',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#eef6e9',
    background: '#0d1510',
    tint: tintColorDark,
    icon: '#93a18e',
    tabIconDefault: '#778471',
    tabIconSelected: tintColorDark,
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
