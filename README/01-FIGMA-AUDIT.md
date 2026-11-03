# 01 — Figma Audit & Node Inspection

- **Figma File Key**: `SIECorieNr9uNimiuo2N3e`
- **File Name**: Aspen Travel App Exploration - Mobile App Design (Community)
- **Author**: NickelFox Design

## Inspected Nodes & Frames

### 1. `screen1` (Node `#0:177`) — Onboarding / Splash
- **Dimensions**: 375 x 812 pt
- **Background**: High-res mountain alpine imagery (`assets/images/onboarding_bg.png`) with gradient overlay (`linear-gradient(180deg, rgba(33, 27, 28, 0) 63%, rgba(59, 89, 105, 0.7) 100%)`).
- **Typography**:
  - Title: "goWild" (custom display branding, 116pt white, tracking 0.085em).
  - Subtitle: "Plan your" (24pt Regular) + "Luxurious Vacation" (40pt Medium).
- **CTA**: "Explore" button (311 x 56 pt, borderRadius 16pt, primary blue gradient `#176FF2` -> `#196EEE`).
- **Interaction**: Pressing "Explore" routes directly into `/(tabs)`.

### 2. `Screen 2` (Node `#0:72`) — Explore / Home Screen
- **Dimensions**: 375 x 812 pt
- **Header**:
  - Greeting: "Explore" (Montserrat Regular 14pt) / "goWild" (Montserrat Medium 32pt).
  - Location Selector: Duotone Pin Icon + "Aspen, USA" (CircularXX Regular 12pt, `#606060`) + Chevron.
- **Search**:
  - Input container: Height 52pt, borderRadius 24pt, fill `#F3F8FE`.
  - Placeholder: "Find things to do" with Search icon.
- **Category Filter**:
  - Active: "Location" (CircularXX Bold 14pt, `#176FF2`, pill fill `rgba(23, 111, 242, 0.05)`, borderRadius 33pt).
  - Inactive: "Hotels", "Food", "Adventure", "Activities" (`#B8B8B8`).
- **Popular Destinations (Horizontal Scroll)**:
  - Card Size: 188 x 240 pt, borderRadius 24pt.
  - Card 1: "Alley Palace" (Rating: 4.1, image: `alley_palace.png`, heart favorite button).
  - Card 2: "Coeurdes Alpes" (Rating: 4.5, image: `coeurdes_alpes.png`).
- **Recommended Destinations (Horizontal / Grid)**:
  - Card Size: 174 x 148 pt, borderRadius 16pt, subtle border `#F4F4F4`.
  - Duration Badge: "4N/5D" / "2N/3D" (forest green pill `#3A544F` with white stroke).
  - Badge: Trending icon + "Hot Deal" (`#3A544F`).
  - Items: "Explore goWild" (`explore_gowild.png`) and "Luxurious goWild" (`luxurious_gowild.png`).
- **Bottom Navigation**:
  - Real Apple iOS NativeTabs with system Liquid Glass.

### 3. `screen 3` (Node `#0:14`) — Destination Detail Screen
- **Dimensions**: 375 x 812 pt
- **Hero Image Container**:
  - Image: `coeurdes_alpes.png` (335 x 340 pt, borderRadius 20pt).
  - Back Button: 40 x 40 pt rounded button, background `#F3F8FE`.
  - Favorite Heart: 44 x 44 pt circle button, background `#F2F7FD`, elevated shadow.
- **Content Section**:
  - Title: "Coeurdes Alpes" (24pt SemiBold) + "Show map" action (14pt Bold blue).
  - Rating: Star icon + "4.5 (355 Reviews)".
  - Description: Storybook alpine narrative with expandable "Read more" toggle.
  - Facilities: 4 pills with icons ("1 Heater", "Dinner", "1 Tub", "Pool").
- **Booking Footer**:
  - Price: "Price" label + "$199" in `#2DD7A4`.
  - CTA Button: "Book Now" with right chevron, primary blue gradient.

## Retrieved Assets
All raw Figma image references were downloaded using Figma MCP into:
- `assets/images/onboarding_bg.png`
- `assets/images/alley_palace.png`
- `assets/images/coeurdes_alpes.png`
- `assets/images/coeurdes_alpes_alt.png`
- `assets/images/explore_gowild.png`
- `assets/images/luxurious_gowild.png`
- `assets/icons/location.svg`
- `assets/icons/trending_up.svg`
- `assets/icons/facility_heater.svg`
- `assets/icons/facility_dinner.svg`
- `assets/icons/facility_tub.svg`
- `assets/icons/facility_pool.svg`
