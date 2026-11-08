import React from "react";
import Svg, { Path, G, Rect, Circle } from "react-native-svg";

interface LogoProps {
  size?: number;
  width?: number;
  height?: number;
}

/**
 * Official 4-color Google "G" logo
 */
export const GoogleGLogo: React.FC<LogoProps> = ({ size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      fill="#4285F4"
      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.03h3.88c2.27-2.09 3.665-5.17 3.665-9.12z"
    />
    <Path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.03c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.13C3.26 21.36 7.33 24 12 24z"
    />
    <Path
      fill="#FBBC05"
      d="M5.28 14.29c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.58H1.26C.46 8.18 0 9.99 0 12s.46 3.82 1.26 5.42l4.02-3.13z"
    />
    <Path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.26 6.58l4.02 3.13c.95-2.83 3.6-4.96 6.72-4.96z"
    />
  </Svg>
);

/**
 * Iconic Visa Brand Mark
 */
export const VisaLogo: React.FC<LogoProps> = ({ width = 42, height = 26 }) => (
  <Svg width={width} height={height} viewBox="0 0 48 30">
    <Rect width="48" height="30" rx="4" fill="#1434CB" />
    <Path
      fill="#FEFEFE"
      d="M19.1 19.8l2.5-11.6h3.4l-2.5 11.6h-3.4zm14.2-11.3c-.7-.3-1.8-.5-3.1-.5-3.4 0-5.8 1.8-5.8 4.4 0 1.9 1.7 3 3 3.6 1.3.6 1.8 1 1.8 1.6 0 .8-1 1.2-1.9 1.2-1.3 0-2.1-.2-3.2-.7l-.4-.2-.5 2.8c.8.4 2.2.7 3.7.7 3.6 0 6-1.8 6-4.5 0-1.5-.9-2.7-3-3.6-1.2-.6-2-.9-2-1.5 0-.5.6-1 1.9-1 .9 0 1.9.2 2.5.5l.3.2.7-2.5zm8.5 0h-2.6c-.8 0-1.4.2-1.8 1l-5.1 10.3h3.6l.7-2h4.4l.4 2h3.2l-2.8-11.3zm-4.7 6.9l1.8-4.9.9 4.9h-2.7zM14.6 8.5l-3.3 8-.4-1.8c-.6-2.1-2.5-4.4-4.6-5.5l3 10.9h3.6l5.4-11.6h-3.7z"
    />
    <Path
      fill="#F9A01B"
      d="M6.3 8.5H.8L0 9.2c4.4 1.1 7.4 3.8 8.6 7.1l-1.2-6c-.2-.9-.9-1.8-1.1-1.8z"
    />
  </Svg>
);

/**
 * Iconic Mastercard Overlapping Circles Logo
 */
export const MastercardLogo: React.FC<LogoProps> = ({ width = 42, height = 26 }) => (
  <Svg width={width} height={height} viewBox="0 0 48 30">
    <Rect width="48" height="30" rx="4" fill="#171725" />
    <G>
      <Circle cx="18" cy="15" r="9" fill="#EB001B" />
      <Circle cx="30" cy="15" r="9" fill="#F79E1B" />
      <Path
        d="M24 8.7a9 9 0 0 1 0 12.6 9 9 0 0 1 0-12.6z"
        fill="#FF5F00"
      />
    </G>
  </Svg>
);

