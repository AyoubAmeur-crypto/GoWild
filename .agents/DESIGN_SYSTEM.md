# .agents/DESIGN_SYSTEM.md — Tokens, Brand & Figma Mapping

## 1. Brand Source of Truth
- **Canonical Asset**: `assets/goWild (1080 x 600 px).png` (2295×1275 RGBA).
- **Extracted Lossless Transparent Assets** (`assets/brand/`):
  - `gowild-mark.png` (560×560): Geometric 8-petal flower mark in `#40B4F8` with intersecting negative-space diamond curves.
  - `gowild-logo-light.png` (2265×552): Flower mark (`#40B4F8`) + deep charcoal wordmark (`#171725`).
  - `gowild-logo-dark.png` (2265×552): Flower mark (`#40B4F8`) + crisp white wordmark (`#FEFEFE`).
- **Component**: `<BrandLogo variant="lockup" | "mark" tone="light" | "dark" size="sm" | "md" | "lg" />`.

## 2. Color Tokens (Grand Hotel Figma + goWild Brand Harmony)
Extracted from Figma file `sim22KJgjq1zKePEhnJzdM` (`Home #32127:1241`, `Map #32141:3881`, `Detail #32146:7920`, `Search #32143:5245`, `Filter #32145:5980`, `Request to book #32152:1759`):
- **Brand & Interactive**:
  - `primary`: `#2853AF` (Figma `Main colors/Primary` — primary buttons, active category pills, prices, active map pin ring)
  - `brandMark`: `#40B4F8` (goWild flower mark accent, badges, focus rings)
  - `secondaryIce`: `#E8F2FF` (Figma `Main colors/Secondary` — location contextual banner, selected tint surfaces)
- **Surfaces & Neutrals (Light Mode)**:
  - `background`: `#FEFEFE` (Figma `Additional Colors/white`)
  - `surface`: `#FFFFFF`
  - `surfaceSubtle`: `#F5F8FD` / `#F5F5F5` (Figma `Neutral/100` & `Light Grey/03 #FBFBFD`)
  - `charcoal`: `#171725` (Figma `Grayscale/Grayscale 100` — primary headings & titles)
  - `ink`: `#111111` (Figma `Additional Colors/Black`)
  - `textSecondary`: `#66707A` (Figma `Grayscale/Grayscale 80`)
  - `textMuted`: `#78828A` (Figma `Grayscale/Grayscale 70`)
  - `placeholder`: `#9CA4AB` (Figma `Grayscale/Grayscale 60`)
  - `border`: `#E9EBED` (Figma `Additional Colors/Line`)
- **Surfaces & Neutrals (Dark Mode)**:
  - `background`: `#0E131F`
  - `surface`: `#161D2E`
  - `surfaceSubtle`: `#1E273B`
  - `textPrimary`: `#F8FAFC`
  - `textSecondary`: `#94A3B8`
  - `border`: `#28334A`
- **Semantic Status**:
  - `ratingGold`: `#EDB900` (Figma `Detail #32146:7920` star & rating text)
  - `success`: `#27947A` / `#34977D` (Figma `fill_d82a56f9` — free cancellation, confirmed status)
  - `warning`: `#D97706` (expiring offer, price changed)
  - `error`: `#F41F52` (Figma `Alerts/Error` — strikethrough discount / sold-out / error)

## 3. Typography Scale
Mapped from Figma (`Plus Jakarta Sans` / `Jost` / `Inter` scales) to crisp cross-platform system typography with tabular numerals (`fontVariant: ['tabular-nums']` on prices):
- `display`: `30px / 38px`, weight `700`, tracking `-0.4`
- `h1`: `24px / 32px`, weight `700`, tracking `-0.3`
- `h2`: `20px / 28px`, weight `600` (Figma `Medium/H5`)
- `h3`: `18px / 26px`, weight `600` (Figma `Heading Text Style/H6`)
- `title`: `16px / 24px`, weight `600` (Figma `Body 2 SemiBold` / `Inter SemiBold 16`)
- `body`: `14px / 22px`, weight `400` (Figma `Body 3 Regular`)
- `bodyStrong`: `14px / 22px`, weight `600` (Figma `Body 3 SemiBold`)
- `caption`: `12px / 18px`, weight `500` (Figma `Body 4` / `Small Medium`)
- `micro`: `10px / 16px`, weight `600` (Figma `Body 5 SemiBold` — badges & tab labels)

## 4. Spacing, Radii & Elevation
- **Content Grid**: `24px` horizontal screen padding (`327px` content width on `375px` frame in Figma; responsive `paddingHorizontal: 20..24` on compact/large phones), `24px` vertical section gap, `12px–16px` card list gap.
- **Radii**: `xs: 6`, `sm: 8` (category chips, compact thumbnails), `md: 12` (primary buttons, hero popular cards), `lg: 16` (search cards, map preview cards, date tiles), `xl: 24` (search pill input `height: 52`), `sheet: 32` (filter bottom sheet), `full: 9999`.
- **Restrained Glass Usage**: Used ONLY on Android `GoWildGlassTabBar`, floating hero card rating/favorite badges (`backdropFilter: blur(10px)` in Figma `#32143:5853`), and floating map header/controls. Standard cards and forms use crisp solid surfaces with `1px` `#E9EBED` hairline borders and subtle elevation.

## 5. Canonical UI Component Primitives (`src/components/ui/`)
`BrandLogo`, `PrimaryButton`, `GlassSurface`, `GlassSwitch`, `SegmentedControl`, `FavoriteHeartButton`, `SearchBar`, `AmenityChip`, `RatingBadge`, `PriceDisplay`, `Skeleton`, `EmptyState`, `ErrorState`, `ProviderModeBanner`.
Feature components: `HotelCard` (hero, horizontal, search, map-preview variants), `HotelGallery`, `DateRangePicker`, `GuestCounter`, `FilterSheet`, `RoomOfferCard`, `PriceBreakdownCard`, `BookingSummaryCard`.

