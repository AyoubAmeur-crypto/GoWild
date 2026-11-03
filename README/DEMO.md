# README/DEMO.md — Reproducible End-to-End Walkthrough

## 1. Launch Services
```bash
cp -n .env.example .env
npm run server
# In a second terminal:
npx expo start
```

## 2. Core Booking Journey Verification
1. **Branded Onboarding (`src/app/index.tsx`)**:
   - Verify the preserved geometric blue flower `goWild` mark (`#40B4F8`) and typography over scenic hotel photography.
   - Tap **Start Exploring** (or **Sign In** to authenticate immediately).
2. **Home Discovery (`src/app/(tabs)/index.tsx`)**:
   - Inspect active provider mode indicator when in Sandbox / Development Fixtures mode.
   - Browse **Most Popular** horizontal hero hotel cards, filter **Recommended Stays** by property category (`All`, `Hotels`, `Resorts`, `Villas`, `Boutique`), or tap the location banner to switch featured city.
3. **Search, Dates, Occupancy & Filters (`src/app/search/index.tsx`)**:
   - Tap the search bar -> type a city (`Paris`, `Tokyo`, `San Diego`, `Kyoto`, `Marrakech`, `New York`, `Santorini`) and pick an autocomplete suggestion.
   - Open **Dates & Guests** -> pick Check-In / Check-Out dates and adjust Rooms, Adults, and Children (with child ages).
   - Tap the **Filter** button -> filter by max price, minimum star rating, **Free Cancellation**, and amenities (`Free Wi-Fi`, `Pool`, `Spa`, `Breakfast`) -> tap **Apply Filter**.
   - Sort results by `Recommended`, `Price: Low to High`, `Price: High to Low`, or `Top Rated`.
4. **Synchronized Map Discovery (`src/app/map/index.tsx`)**:
   - Tap **Map** from Search or Home -> tap circular photo+rating hotel pins on the map and observe the bottom floating preview carousel synchronize smoothly; swipe cards to highlight the corresponding map marker.
5. **Hotel Detail & Live Room Offers (`src/app/hotel/[id].tsx`)**:
   - Open any hotel -> swipe or expand the full-screen **Hotel Gallery**, inspect rating, amenities, check-in/out & cancellation policies, location coordinates, and verified guest reviews.
   - Adjust dates/guests right on the detail screen to re-query live **Room Offers** (`Room Only`, `Breakfast Included`, refundable vs non-refundable rates) -> tap **Select Room**.
6. **Offer Revalidation & Checkout (`src/app/booking/review.tsx`)**:
   - Observe automatic **Offer Revalidation** (`POST /api/offers/revalidate`) locking the quote and displaying itemized nightly subtotal, taxes & fees, total payable amount, cancellation deadline, and provider attribution.
   - Enter validated Lead Guest details (or auto-fill from signed-in Traveler Profile) and submit reservation (protected by `Idempotency-Key`).
7. **Confirmation & My Trips (`src/app/booking/confirmation/[id].tsx` & `src/app/(tabs)/bookings.tsx`)**:
   - Review the booking confirmation receipt (including honest `SANDBOX` / `PROVIDER` badge and confirmation reference).
   - Navigate to **Trips** tab -> inspect **Upcoming**, **Completed**, and **Cancelled** segments -> cancel an active refundable booking and verify status updates immediately in SQLite and UI.
8. **Auth, Favorites & Preferences (`src/app/(tabs)/favorites.tsx` & `profile.tsx`)**:
   - Create a Traveler Account in **Profile -> Sign Up**, toggle **Currency** (`USD`/`EUR`/`GBP`/`MAD`/`JPY`), **Language** (`EN`/`FR`), **Dark Mode**, and **Reduced Motion**, and verify saved hotels sync cleanly.

