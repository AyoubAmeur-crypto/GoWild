# README/FIGMA_AUDIT.md — Verified Figma MCP Audit & React Native Mapping

## 1. Source File & Verified Nodes
- **Figma File**: `sim22KJgjq1zKePEhnJzdM` — *"Grand Hotel - Hotel Booking App Ui Kits (Simplifies hotel bookings with a few clicks) (Community)"*
- **MCP Server Used**: `figma-dev-mode-mcp-server` (`get_figma_data`)
- **Inspected Nodes**:
  1. **Root Canvas Tree (`depth=2`)**: Canvases `💻 Presentation (#196:2364)`, `✏️Style Guide (#26:1597)`, and `✨UI Design (#70:2209)` containing 50 screens across Onboarding, Auth, Home, Search, Filter, Map, Detail, Room Detail, Checkout, My Booking, Favorite, Notifications, and Profile.
  2. **`Home` (`#32127:1241`) — Primary Target Node**:
     - Frame: `375×812`, background `#FEFEFE` (`Additional Colors/white`), inner content column `width: 327px` (`24px` horizontal padding), `24px` section gap.
     - Header (`#32134:1483`): `40×41` circular avatar + user name (`Plus Jakarta Sans SemiBold 16`, `#171725`) + location pin subtitle (`#78828A`) on left; two `40×40` circular icon buttons (`stroke: #DADDDD`, `Search` & `Bell`) on right.
     - Location Banner (`#32137:1384`): `327×72`, `borderRadius: 12`, fill `#E8F2FF` (`Main colors/Secondary`), `32×32` white icon badge + contextual prompt + chevron.
     - `Most Popular` Section (`#32136:1298`): Section header (`16px SemiBold`, `See All` in `#2853AF`), horizontal cards (`height: 220`, `borderRadius: 12`, `padding: 12`, bottom linear gradient `rgba(0,0,0,0) 19% -> rgba(0,0,0,0.7) 100%`) with top-right heart icon, title (`14px SemiBold #FFFFFF`), location (`10px Regular`), price (`12px SemiBold`), and star rating (`12px` + gold star).
     - `Recommended for you` Section (`#32137:1546`): Property filter chips (`All` active in `#2853AF` text `#FFFFFF`; inactive `Villas`, `Hotels`, `Apartement` with `1px #E9EBED` border, `borderRadius: 8`) + vertical compact hotel rows (`78×78` thumbnail `borderRadius: 8`, title `16px SemiBold #171725`, location `#66707A`/`#9CA4AB`, right-aligned star rating, and `{#2853AF}$270 /night` separated by `1px #E9EBED` dividers).
  3. **`Map - Nearby Hotel` (`#32141:3881`) — Secondary Target Node**:
     - Frame: `375×812`, full-bleed map canvas (`#32141:4173`) with floating top header (`44×44` circular back button, `Nearby Hotel` H6 `18px SemiBold`, `40×40` action button) + floating search/filter pill (`#32141:3902`, `327×52`, `borderRadius: 24`, `#FFFFFF` fill, `1px #E9EBED` stroke, vertical divider before filter icon).
     - Map Pins (`#32143:4933`, `#32143:4938`, `#32143:4943`): `61×61` circular property photo (`2px` `#FFFFFF` border inactive, `2px` `#2853AF` border when selected) + bottom overlapping white rating pill (`padding: 2px 6px`, `borderRadius: 40`, star + score `4.7`).
     - Bottom Synchronized Preview Carousel (`#32141:4774`): Floating cards (`width: 327`, `padding: 24px 20px`, `borderRadius: 16`, `#FFFFFF` fill, soft shadow) showing `78×78` photo, title, location, rating, price/night, primary `"Booking Now"` CTA (`borderRadius: 12..24`, `#2853AF`), and quick secondary action icon (`56×56`).
  4. **`Detail` (`#32146:7920`)**:
     - Sticky top header (`375×121` with safe area, `44×44` back & more buttons, H6 `"Detail"`), location map card (`327×173`, `borderRadius: 15`, `"Open Map"` link in `#2853AF`, address line), `Reviews` list (`48×48` avatar, reviewer name `14px SemiBold`, review text `12px Regular #A7AEC1`, star score), `Recommendation` cards (with current price + `#F41F52` strikethrough compare price), and sticky bottom booking bar (`375×90`, `borderRadius: 16px 16px 0 0`, `"Price"` label + `$120.00` `24px SemiBold` + `"Booking Now"` button).
  5. **`Search - Found` (`#32143:5245`)**:
     - Search pill (`327×52`, `borderRadius: 24`) + category chips + large vertical search cards (`327×180` hero image `borderRadius: 16`, top-left blurred rating pill `backdropFilter: blur(10px)`, top-right blurred heart button, bottom row with hotel name `16px SemiBold`, city `12px #878787`, room/bed summary chips, and right-aligned `$290` `18px SemiBold #2853AF` + `Per Night`).
  6. **`Filter` (`#32145:5980`)**:
     - Blurred backdrop (`rgba(23,23,37,0.24)`) + bottom sheet (`borderRadius: 32px 32px 0 0`, drag handle `60×5 #E3E9ED`), `"Filter By"` title, Guest selector field (`height: 52`, `borderRadius: 15`), Price range selector, `"Instant Book"` / Free Cancellation toggle row, Location chips, Facilities checkboxes (`20×20`, `borderRadius: 6`, `#2853AF` checked fill), Star Rating pills (`56×43`, `borderRadius: 15`, `5..1` stars), and `"Apply Filter"` primary CTA.
  7. **`Request to book` (`#32152:1759`)**:
     - Header `"Request to book"`, side-by-side `Check-In` & `Check-Out` tiles (`158px` wide, `padding: 16`, `borderRadius: 16`, `#F7F7F7`), `Guest` stepper row (`- 1 +`), Payment method summary card (`327×64`, `borderRadius: 16` — adapted in goWild to compliant provider checkout / sandbox payment method badge without raw card PAN collection), and itemized `Payment Details` (`Nights subtotal`, `Taxes & Fees`, `Service/Property Fee`, `1px` divider, `Total Payment`) + `"Checkout"` primary CTA.

> **Rate Limit Note**: After fetching these 7 payloads, Figma's Starter Plan REST API returned HTTP `429` (`Retry after 399884 seconds`). Secondary screens (`My Trips`, `Profile`, `Sign In`, `Notifications`) derive strictly from the verified color, typography, card, and button tokens extracted above.

## 2. Figma-to-React-Native Component Mapping & Adaptations

| Figma Component / Pattern | goWild React Native Component | Necessary Production Adaptations |
| :--- | :--- | :--- |
| Brand Identity (replaces template title) | `src/components/ui/BrandLogo.tsx` | Uses lossless transparent slices from `assets/goWild (1080 x 600 px).png` (`#40B4F8` geometric flower mark) |
| `Bottom Navigation` (`#29349:2448`: Home, My Booking, Message, Profile) | `GoWildTabs.ios.tsx` (`NativeTabs`) & `GoWildTabs.android.tsx` (`GoWildGlassTabBar`) | Mapped to product's 4 core tabs (`Explore`, `Trips`, `Saved`, `Profile`); preserves native iOS 26+ Liquid Glass & Android `expo-blur` pill |
| `INPUT FIELD / Type=Search` (`#26:2030`) | `src/components/ui/SearchBar.tsx` | Real `TextInput` / trigger with clear button, live filter badge count, and accessible 44pt filter trigger |
| `Most Popular` Card (`#32136:1303`) & `Search` Card (`#32143:5844`) | `src/features/hotels/components/HotelCard.tsx` (`hero`, `compact`, `search`, `map` variants) | Powered by `expo-image` caching, real currency formatting (`PriceDisplay`), live availability badges, and `FavoriteHeartButton` |
| `Filter` Sheet (`#32145:6513`) | `src/features/hotels/components/FilterSheet.tsx` | Interactive price range presets + min/max controls, free-cancellation toggle (`GlassSwitch`), property types, amenities, and star ratings |
| `Map - Nearby Hotel` (`#32141:3881`) | `src/features/maps/components/InteractiveHotelMap.tsx` + `src/app/map/index.tsx` | Interactive pan/zoom viewport & coordinate projection (works identically in Expo Go, Web, iOS, and Android without requiring native Google Maps API billing keys) with synchronized marker selection & card carousel |
| `Detail` (`#32146:7920`) + Room Selection | `src/app/hotel/[id].tsx` + `HotelGallery` + `RoomOfferCard` | Adds interactive date/guest bar, live `RoomOffer` rate plans, cancellation policy deadlines, and provider attribution |
| `Request to book` (`#32152:1759`) | `src/app/booking/review.tsx` + `PriceBreakdownCard` | Runs live `revalidateOffer` before checkout, collects validated lead traveler details, enforces idempotency keys, and uses compliant provider/sandbox checkout (never raw card inputs) |

