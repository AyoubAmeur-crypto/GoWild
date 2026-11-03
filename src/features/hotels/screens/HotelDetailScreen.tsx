import React, { useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Share,
  Modal,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowLeft,
  Share2,
  MapPin,
  Calendar,
  Users,
  Clock,
  ShieldCheck,
  MessageSquareQuote,
  Star,
  X,
} from "lucide-react-native";
import type { RoomOffer } from "../../../types/domain";
import { useAppTheme } from "../../../theme/useAppTheme";
import { useSearchStore } from "../../../stores/useSearchStore";
import { formatDateRangeShort } from "../../../lib/pricing";
import { FavoriteHeartButton } from "../../../components/ui/FavoriteHeartButton";
import { RatingBadge } from "../../../components/ui/RatingBadge";
import { AmenityChip } from "../../../components/ui/AmenityChip";
import { PriceDisplay } from "../../../components/ui/PriceDisplay";
import { PrimaryButton } from "../../../components/ui/PrimaryButton";
import { Skeleton } from "../../../components/ui/Skeleton";
import { EmptyState } from "../../../components/ui/EmptyState";
import { ErrorState } from "../../../components/ui/ErrorState";
import { useHotelDetail } from "../hooks/useHotels";
import { HotelGallery } from "../components/HotelGallery";
import { useRoomOffers } from "../../availability/hooks/useRoomOffers";
import { RoomOfferCard } from "../../availability/components/RoomOfferCard";
import { DateRangePicker } from "../../availability/components/DateRangePicker";
import { GuestCounter } from "../../availability/components/GuestCounter";

interface HotelDetailScreenProps {
  hotelId: string;
}

export const HotelDetailScreen: React.FC<HotelDetailScreenProps> = ({
  hotelId,
}) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { palette } = useAppTheme();
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const roomsOffsetY = useRef(520);

  const checkIn = useSearchStore((s) => s.checkIn);
  const checkOut = useSearchStore((s) => s.checkOut);
  const occupancy = useSearchStore((s) => s.occupancy);
  const setDates = useSearchStore((s) => s.setDates);
  const setOccupancy = useSearchStore((s) => s.setOccupancy);

  const [expandedDesc, setExpandedDesc] = useState(false);
  const [datesModalOpen, setDatesModalOpen] = useState(false);

  const detailQuery = useHotelDetail(hotelId);
  const offersQuery = useRoomOffers(hotelId);

  const hotel = detailQuery.data?.hotel;
  const offers = offersQuery.data?.offers ?? [];
  const leadOffer: RoomOffer | undefined = offers[0];

  const handleSelectOffer = (offer: RoomOffer) => {
    router.push({
      pathname: "/booking/review",
      params: {
        hotelId,
        offerId: offer.offerId,
      },
    });
  };

  const handleShare = () => {
    if (!hotel) return;
    Share.share({
      title: hotel.name,
      message: `${hotel.name} in ${hotel.location.city}, ${hotel.location.country} — discovered on goWild.`,
    }).catch(() => {});
  };

  if (detailQuery.isLoading) {
    return (
      <View
        style={[
          styles.loadingRoot,
          {
            backgroundColor: palette.background,
            paddingTop: insets.top + 16,
          },
        ]}
      >
        <Skeleton height={280} borderRadius={22} />
        <Skeleton height={30} width="70%" />
        <Skeleton height={90} borderRadius={16} />
        <Skeleton height={180} borderRadius={18} />
      </View>
    );
  }

  if (detailQuery.error || !hotel) {
    return (
      <View
        style={[
          styles.loadingRoot,
          {
            backgroundColor: palette.background,
            paddingTop: insets.top + 24,
          },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          style={[
            styles.backOnlyBtn,
            { backgroundColor: palette.surface, borderColor: palette.border },
          ]}
        >
          <ArrowLeft size={18} color={palette.text} />
          <Text style={{ color: palette.text, fontWeight: "600" }}>Back</Text>
        </Pressable>
        <ErrorState
          error={detailQuery.error ?? new Error("Hotel was not found.")}
          onRetry={() => detailQuery.refetch()}
        />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: palette.background }]}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingBottom: 130 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Gallery + Floating Top Bar */}
        <View style={styles.heroWrap}>
          <HotelGallery images={hotel.images} hotelName={hotel.name} />
          <View
            style={[
              styles.floatingNav,
              { top: Math.max(insets.top + 8, 16) },
            ]}
          >
            <Pressable
              onPress={() => router.back()}
              style={styles.overlayCircle}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <ArrowLeft size={20} color="#171725" />
            </Pressable>

            <View style={styles.rightOverlayGroup}>
              <Pressable
                onPress={handleShare}
                style={styles.overlayCircle}
                accessibilityRole="button"
                accessibilityLabel="Share hotel"
              >
                <Share2 size={18} color="#171725" />
              </Pressable>
              <FavoriteHeartButton hotelId={hotel.id} size="md" overlay />
            </View>
          </View>
        </View>

        {/* Main Sheet Body (Figma #32146:7920) */}
        <View
          style={[
            styles.sheetBody,
            { backgroundColor: palette.background },
          ]}
        >
          <View style={styles.titleSection}>
            <View style={styles.starsRow}>
              {Array.from({ length: hotel.starRating }).map((_, idx) => (
                <Star
                  key={idx}
                  size={13}
                  color={palette.ratingGold}
                  fill={palette.ratingGold}
                />
              ))}
              <Text style={[styles.propBadgeText, { color: palette.primary }]}>
                {hotel.propertyType.toUpperCase()}
              </Text>
            </View>

            <View style={styles.nameRatingRow}>
              <Text style={[styles.hotelName, { color: palette.text }]}>
                {hotel.name}
              </Text>
              <RatingBadge
                score={hotel.reviewScore}
                reviewCount={hotel.reviewCount}
                variant="pill"
              />
            </View>

            <View style={styles.locRow}>
              <MapPin size={15} color={palette.primary} />
              <Text style={[styles.addressText, { color: palette.subtext }]}>
                {hotel.location.address}, {hotel.location.city},{" "}
                {hotel.location.country}
              </Text>
            </View>
          </View>

          {/* Location Map Preview Card */}
          <Pressable
            onPress={() => router.push("/map")}
            style={[
              styles.locationCard,
              {
                backgroundColor: palette.surfaceIce,
                borderColor: palette.border,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="View hotel on interactive map"
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.locCardTitle, { color: palette.text }]}>
                Interactive Location & Nearby Stays
              </Text>
              <Text style={[styles.locCardSub, { color: palette.subtext }]}>
                Coordinates {hotel.location.latitude.toFixed(4)}°,{" "}
                {hotel.location.longitude.toFixed(4)}°
              </Text>
            </View>
            <Text style={[styles.openMapLink, { color: palette.primary }]}>
              Open Map
            </Text>
          </Pressable>

          {/* Overview Description */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>
              Description
            </Text>
            <Text
              style={[styles.descText, { color: palette.subtext }]}
              numberOfLines={expandedDesc ? undefined : 4}
            >
              {hotel.description}
            </Text>
            <Pressable
              onPress={() => setExpandedDesc((v) => !v)}
              accessibilityRole="button"
            >
              <Text style={[styles.readMore, { color: palette.primary }]}>
                {expandedDesc ? "Show Less" : "Read More"}
              </Text>
            </Pressable>
          </View>

          {/* Common Facilities */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>
              Common Facilities
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.facilitiesScroll}
            >
              {hotel.amenities.map((am) => (
                <AmenityChip
                  key={am.code}
                  code={am.code}
                  label={am.label}
                  variant="tile"
                />
              ))}
            </ScrollView>
          </View>

          {/* Stay Dates & Occupancy Selector */}
          <View
            style={styles.section}
            onLayout={(e) => {
              roomsOffsetY.current = e.nativeEvent.layout.y;
            }}
          >
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>
                Room Availability & Rates
              </Text>
              <Pressable onPress={() => setDatesModalOpen(true)}>
                <Text style={[styles.readMore, { color: palette.primary }]}>
                  Change Dates
                </Text>
              </Pressable>
            </View>

            <Pressable
              onPress={() => setDatesModalOpen(true)}
              style={[
                styles.stayBar,
                {
                  backgroundColor: palette.surfaceMuted,
                  borderColor: palette.border,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Modify check-in, check-out, and guest count"
            >
              <View style={styles.stayBarItem}>
                <Calendar size={15} color={palette.primary} />
                <Text style={[styles.stayBarText, { color: palette.text }]}>
                  {formatDateRangeShort(checkIn, checkOut)}
                </Text>
              </View>
              <View style={styles.stayBarItem}>
                <Users size={15} color={palette.primary} />
                <Text style={[styles.stayBarText, { color: palette.text }]}>
                  {occupancy.rooms}{" "}
                  {occupancy.rooms === 1 ? "Room" : "Rooms"} ·{" "}
                  {occupancy.adults} Adults
                  {occupancy.childrenAges.length > 0
                    ? `, ${occupancy.childrenAges.length} Children`
                    : ""}
                </Text>
              </View>
            </Pressable>

            {offersQuery.isLoading ? (
              <View style={styles.offersGap}>
                <Skeleton height={210} borderRadius={18} />
                <Skeleton height={210} borderRadius={18} />
              </View>
            ) : offersQuery.error ? (
              <ErrorState
                error={offersQuery.error}
                onRetry={() => offersQuery.refetch()}
              />
            ) : offers.length === 0 ? (
              <EmptyState
                title="Sold Out for Selected Dates"
                description="No rooms are available for these exact dates and guest counts. Try shifting your check-in or check-out dates."
                actionLabel="Change Dates"
                onAction={() => setDatesModalOpen(true)}
              />
            ) : (
              <View style={styles.offersGap}>
                {offers.map((offer) => (
                  <RoomOfferCard
                    key={offer.offerId}
                    offer={offer}
                    onSelect={handleSelectOffer}
                  />
                ))}
              </View>
            )}
          </View>

          {/* Property Policies */}
          <View
            style={[
              styles.policiesCard,
              {
                backgroundColor: palette.surface,
                borderColor: palette.border,
              },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: palette.text }]}>
              Property Policies & Check-in
            </Text>

            <View style={styles.policyRow}>
              <Clock size={15} color={palette.primary} />
              <Text style={[styles.policyText, { color: palette.subtext }]}>
                Check-in from {hotel.policies.checkInFrom} · Check-out until{" "}
                {hotel.policies.checkOutUntil}
              </Text>
            </View>

            <View style={styles.policyRow}>
              <ShieldCheck size={15} color={palette.success} />
              <Text style={[styles.policyText, { color: palette.subtext }]}>
                {hotel.policies.cancellationSummary}
              </Text>
            </View>

            <Text style={[styles.policySubNote, { color: palette.muted }]}>
              {hotel.policies.childrenPolicy} ·{" "}
              {hotel.policies.petsAllowed
                ? "Pets welcome on request"
                : "No pets permitted"}
              {hotel.policies.importantNotes
                ? ` · ${hotel.policies.importantNotes}`
                : ""}
            </Text>
          </View>

          {/* Guest Reviews */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>
                Guest Reviews
              </Text>
              <Text style={[styles.reviewTotal, { color: palette.subtext }]}>
                {hotel.reviewScore.toFixed(1)} / 5 ({hotel.reviewCount})
              </Text>
            </View>

            {hotel.reviews.length === 0 ? (
              <View
                style={[
                  styles.reviewCard,
                  {
                    backgroundColor: palette.surfaceMuted,
                    borderColor: palette.border,
                  },
                ]}
              >
                <Text style={[styles.reviewComment, { color: palette.subtext }]}>
                  Aggregate rating ({hotel.reviewScore.toFixed(1)}/5 across{" "}
                  {hotel.reviewCount} verified stays) is provided by the
                  connected hotel supplier.
                </Text>
              </View>
            ) : (
              hotel.reviews.map((rev) => (
                <View
                  key={rev.id}
                  style={[
                    styles.reviewCard,
                    {
                      backgroundColor: palette.surface,
                      borderColor: palette.border,
                    },
                  ]}
                >
                  <View style={styles.reviewHeader}>
                    <View style={styles.reviewAuthorRow}>
                      <MessageSquareQuote size={15} color={palette.primary} />
                      <Text
                        style={[styles.reviewAuthor, { color: palette.text }]}
                      >
                        {rev.authorName}
                      </Text>
                    </View>
                    <RatingBadge score={rev.rating} />
                  </View>
                  {rev.title ? (
                    <Text style={[styles.reviewTitle, { color: palette.text }]}>
                      {rev.title}
                    </Text>
                  ) : null}
                  <Text
                    style={[styles.reviewComment, { color: palette.subtext }]}
                  >
                    {rev.comment}
                  </Text>
                  <Text style={[styles.reviewSource, { color: palette.muted }]}>
                    {rev.date} · {rev.sourceLabel}
                  </Text>
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>

      {/* Sticky Bottom Price + Booking CTA Bar */}
      <View
        style={[
          styles.stickyFooter,
          {
            backgroundColor: palette.surface,
            borderTopColor: palette.border,
            paddingBottom: Math.max(insets.bottom + 8, 16),
          },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.fromCap, { color: palette.subtext }]}>
            {leadOffer ? "Best available rate" : "Live pricing"}
          </Text>
          {leadOffer ? (
            <PriceDisplay
              amount={leadOffer.price.perNightBase}
              currency={leadOffer.price.currency}
              size="lg"
            />
          ) : hotel.lowestNightlyPrice ? (
            <PriceDisplay
              amount={hotel.lowestNightlyPrice.amount}
              currency={hotel.lowestNightlyPrice.currency}
              size="lg"
            />
          ) : (
            <Text style={[styles.checkDatesLabel, { color: palette.text }]}>
              Select dates
            </Text>
          )}
        </View>

        <PrimaryButton
          label={leadOffer ? "Reserve Best Room" : "View Rooms"}
          onPress={() => {
            if (leadOffer) {
              handleSelectOffer(leadOffer);
            } else {
              scrollRef.current?.scrollTo({
                y: roomsOffsetY.current,
                animated: true,
              });
            }
          }}
          style={styles.stickyBtn}
        />
      </View>

      {/* Dates & Guests Modal */}
      <Modal
        visible={datesModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setDatesModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalSheet,
              {
                backgroundColor: palette.background,
                paddingBottom: Math.max(insets.bottom + 14, 24),
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: palette.text }]}>
                Update Dates & Guests
              </Text>
              <Pressable
                onPress={() => setDatesModalOpen(false)}
                style={[
                  styles.closeSmall,
                  { backgroundColor: palette.surfaceMuted },
                ]}
              >
                <X size={18} color={palette.text} />
              </Pressable>
            </View>
            <ScrollView
              contentContainerStyle={styles.modalScroll}
              showsVerticalScrollIndicator={false}
            >
              <DateRangePicker
                checkIn={checkIn}
                checkOut={checkOut}
                onChange={setDates}
              />
              <GuestCounter occupancy={occupancy} onChange={setOccupancy} />
            </ScrollView>
            <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
              <PrimaryButton
                label="Refresh Room Rates"
                onPress={() => setDatesModalOpen(false)}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loadingRoot: {
    flex: 1,
    paddingHorizontal: 20,
    gap: 16,
  },
  backOnlyBtn: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
  },
  heroWrap: {
    position: "relative",
  },
  floatingNav: {
    position: "absolute",
    left: 20,
    right: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 20,
  },
  rightOverlayGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  overlayCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.90)",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetBody: {
    marginTop: -22,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 22,
    gap: 22,
  },
  titleSection: {
    gap: 8,
  },
  starsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  propBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    marginLeft: 6,
    letterSpacing: 0.6,
  },
  nameRatingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  hotelName: {
    flex: 1,
    fontSize: 22,
    fontWeight: "700",
    lineHeight: 28,
  },
  locRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  addressText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  locationCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  locCardTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  locCardSub: {
    fontSize: 12,
  },
  openMapLink: {
    fontSize: 13,
    fontWeight: "700",
  },
  section: {
    gap: 12,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  descText: {
    fontSize: 14,
    lineHeight: 21,
  },
  readMore: {
    fontSize: 13,
    fontWeight: "700",
  },
  facilitiesScroll: {
    gap: 10,
  },
  stayBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 13,
    borderRadius: 14,
    borderWidth: 1,
  },
  stayBarItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  stayBarText: {
    fontSize: 13,
    fontWeight: "600",
  },
  offersGap: {
    gap: 14,
  },
  policiesCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  policyRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  policyText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  policySubNote: {
    fontSize: 12,
    lineHeight: 17,
  },
  reviewTotal: {
    fontSize: 13,
    fontWeight: "600",
  },
  reviewCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 6,
  },
  reviewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  reviewAuthorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  reviewAuthor: {
    fontSize: 14,
    fontWeight: "700",
  },
  reviewTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  reviewComment: {
    fontSize: 13,
    lineHeight: 19,
  },
  reviewSource: {
    fontSize: 11,
    fontWeight: "500",
    marginTop: 2,
  },
  stickyFooter: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    gap: 14,
  },
  fromCap: {
    fontSize: 11,
    fontWeight: "600",
  },
  checkDatesLabel: {
    fontSize: 16,
    fontWeight: "700",
  },
  stickyBtn: {
    minWidth: 175,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(23,23,37,0.52)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  closeSmall: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  modalScroll: {
    paddingHorizontal: 20,
    gap: 16,
    paddingBottom: 16,
  },
});
