# 07 — Cross-Platform Liquid Glass & Premium UI Controls

## 1. Cross-Platform Navigation Architecture

| Dimension | iOS Implementation | Android Implementation |
|---|---|---|
| **Underlying API** | `NativeTabs` (`expo-router/native-tabs`) | `Tabs` (`expo-router/js-tabs`) with custom `tabBar` |
| **Visual Design** | System-native Liquid Glass (iOS 26+) | Floating capsule pill (`GoWildGlassTabBar`) |
| **Material / Blur** | Apple UIKit system translucent blur | `BlurView` (`dimezisBlurViewSdk31Plus`) + translucent backing |
| **Active Indicator** | System tint (`Colors.primary`) | Animated sliding spring pill (`withSpring`) |
| **Tab Icons** | Native Apple SF Symbols (`expo-symbols`) | `lucide-react-native` vectors (`Home`, `Ticket`, `Heart`, `User`) |
| **Minimization** | System `minimizeBehavior="automatic"` | Floating over safe-area padding |
| **Platform File** | `src/components/navigation/GoWildTabs.ios.tsx` | `src/components/navigation/GoWildTabs.android.tsx` |

The route definitions in `src/app/(tabs)/` remain completely identical and shared between platforms. The platform difference is isolated inside `src/components/navigation/GoWildTabs`.

---

## 2. Chosen Libraries & Technical Rationale

1. **`expo-router/native-tabs` (iOS)**:
   - Direct binding to Apple's modern UIKit tab bar controller.
   - Provides true hardware Liquid Glass blurring, edge-to-edge content handling, and native minimization without JS thread overhead.
2. **`expo-blur` (Android & Glass Surface)**:
   - Provides Android blur support using the modern Android 12+ (SDK 31+) native RenderEffect blur (`dimezisBlurViewSdk31Plus`).
   - For Android SDK 30 and below, gracefully falls back to an optimized semi-transparent surface.
3. **`react-native-reanimated` (v4.7.1)**:
   - Powers the sliding tab indicator in `GoWildGlassTabBar`.
   - Powers the fluid track tint interpolation and thumb travel in `GlassSwitch`.
   - Executes entirely on the native UI thread for 60/120 FPS responsiveness.
4. **`react-native-safe-area-context`**:
   - Ensures the floating pill tab bar clears both Android 3-button navigation and gesture navigation bars.

---

## 3. Component APIs

### GlassSurface (`src/components/ui/GlassSurface.tsx`)
```typescript
interface GlassSurfaceProps {
  children?: React.ReactNode;
  intensity?: number;           // Default: 50
  tint?: BlurTint;              // Default: 'light'
  borderRadius?: number;        // Default: 16
  bordered?: boolean;           // Default: true
  style?: StyleProp<ViewStyle>;
  blurMethod?: BlurMethod;      // Default: 'dimezisBlurViewSdk31Plus'
}
```

### GlassSwitch (`src/components/ui/GlassSwitch.tsx`)
```typescript
interface GlassSwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";    // Default: 'md'
  variant?: "glass" | "solid";  // Default: 'glass'
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}
```

### SegmentedControl (`src/components/ui/SegmentedControl.tsx`)
```typescript
interface SegmentedControlProps {
  options: string[];
  selectedIndex: number;
  onChange: (index: number) => void;
  variant?: "glass" | "solid";
  style?: StyleProp<ViewStyle>;
}
```

---

## 4. Android Blur Fallback & Performance

- **Android 12+ (API 31+)**: Rendered via hardware `dimezisBlurViewSdk31Plus` providing authentic real-time background blurring over high-resolution alpine travel imagery.
- **Older Android (< API 31)**: Automatically falls back to a high-contrast translucent frosted layer (`rgba(255, 255, 255, 0.90)` with border `rgba(255, 255, 255, 0.75)` and subtle brand shadow) preventing GPU thrashing and low-frame-rate degradation.
- **Reduced Motion Support**: When `reducedMotion` is toggled in `useSettingsStore`, animations transition instantly (`duration: 0`) to respect user accessibility preferences.

---

## 5. Verification Matrix

- [x] **iOS Tabs**: Authentic Apple Liquid Glass navigation via `NativeTabs` and SF Symbols.
- [x] **Android Tabs**: Floating pill container with animated tab indicator and `BlurView`.
- [x] **GlassSwitch**: Reanimated-powered liquid toggle with spring mechanics, accessible switch role, integrated into `src/app/(tabs)/profile.tsx`.
- [x] **TypeScript Validation**: `npx tsc --noEmit` — 0 errors.
- [x] **Expo Doctor**: `npx expo-doctor` — 20/20 checks passed.
