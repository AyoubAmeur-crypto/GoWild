import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  Modal,
  StyleSheet,
} from "react-native";
import {
  Plane,
  ArrowRight,
  ArrowLeftRight,
  Calendar,
  Users,
  Search,
  Check,
  Clock,
  Luggage,
  X,
  ChevronRight,
  CheckCircle,
} from "lucide-react-native";
import { useAppTheme } from "../../../theme/useAppTheme";
import { useSearchStore } from "../../../stores/useSearchStore";
import { formatDateRangeShort } from "../../../lib/pricing";
import { triggerSelectionHaptic } from "../../../lib/haptics";
import { PrimaryButton } from "../../../components/ui/PrimaryButton";
import { SpringBottomSheet } from "../../../components/ui/SpringBottomSheet";
import { DateRangePicker } from "../../availability/components/DateRangePicker";

export interface Airport {
  code: string;
  city: string;
  country: string;
  name: string;
}

export const AIRPORTS_DATABASE: Airport[] = [
  { code: "CMN", city: "Casablanca", country: "Morocco", name: "Mohammed V International" },
  { code: "RAK", city: "Marrakech", country: "Morocco", name: "Menara Airport" },
  { code: "TNG", city: "Tangier", country: "Morocco", name: "Ibn Battouta Airport" },
  { code: "AGA", city: "Agadir", country: "Morocco", name: "Al Massira Airport" },
  { code: "RBA", city: "Rabat", country: "Morocco", name: "Salé Airport" },
  { code: "CDG", city: "Paris", country: "France", name: "Charles de Gaulle" },
  { code: "ORY", city: "Paris", country: "France", name: "Paris Orly" },
  { code: "NCE", city: "Nice", country: "France", name: "Côte d'Azur Airport" },
  { code: "LHR", city: "London", country: "United Kingdom", name: "Heathrow Airport" },
  { code: "LGW", city: "London", country: "United Kingdom", name: "Gatwick Airport" },
  { code: "JFK", city: "New York", country: "United States", name: "John F. Kennedy" },
  { code: "EWR", city: "New York", country: "United States", name: "Newark Liberty" },
  { code: "DXB", city: "Dubai", country: "United Arab Emirates", name: "Dubai International" },
  { code: "AUH", city: "Abu Dhabi", country: "United Arab Emirates", name: "Zayed International" },
  { code: "HND", city: "Tokyo", country: "Japan", name: "Haneda Airport" },
  { code: "NRT", city: "Tokyo", country: "Japan", name: "Narita International" },
  { code: "MAD", city: "Madrid", country: "Spain", name: "Adolfo Suárez Barajas" },
  { code: "BCN", city: "Barcelona", country: "Spain", name: "Josep Tarradellas El Prat" },
  { code: "FCO", city: "Rome", country: "Italy", name: "Leonardo da Vinci Fiumicino" },
  { code: "MXP", city: "Milan", country: "Italy", name: "Malpensa Airport" },
  { code: "AMS", city: "Amsterdam", country: "Netherlands", name: "Schiphol Airport" },
  { code: "IST", city: "Istanbul", country: "Turkey", name: "Istanbul Airport" },
  { code: "CAI", city: "Cairo", country: "Egypt", name: "Cairo International" },
  { code: "DOH", city: "Doha", country: "Qatar", name: "Hamad International" },
  { code: "SIN", city: "Singapore", country: "Singapore", name: "Changi Airport" },
  { code: "BKK", city: "Bangkok", country: "Thailand", name: "Suvarnabhumi Airport" },
  { code: "SYD", city: "Sydney", country: "Australia", name: "Kingsford Smith" },
  { code: "LAX", city: "Los Angeles", country: "United States", name: "Los Angeles International" },
  { code: "MIA", city: "Miami", country: "United States", name: "Miami International" },
  { code: "GVA", city: "Geneva", country: "Switzerland", name: "Geneva Airport" },
  { code: "FRA", city: "Frankfurt", country: "Germany", name: "Frankfurt Airport" },
];

export interface GeneratedFlight {
  id: string;
  airline: string;
  flightNumber: string;
  origin: Airport;
  destination: Airport;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  stops: "Direct" | "1 Stop";
  stopCity?: string;
  priceMad: number;
  aircraft: string;
  cabin: string;
}

export const FlightSearchEngine: React.FC = () => {
  const { palette, isDark } = useAppTheme();

  const checkIn = useSearchStore((s) => s.checkIn);
  const checkOut = useSearchStore((s) => s.checkOut);
  const setDates = useSearchStore((s) => s.setDates);

  const [tripType, setTripType] = useState<"roundTrip" | "oneWay">("roundTrip");
  const [origin, setOrigin] = useState<Airport>(AIRPORTS_DATABASE[0]); // Casablanca CMN
  const [destination, setDestination] = useState<Airport>(AIRPORTS_DATABASE[5]); // Paris CDG
  const [adults, setAdults] = useState(1);
  const [cabin, setCabin] = useState<"Economy" | "Premium Economy" | "Business" | "First">("Economy");

  const [datesModalOpen, setDatesModalOpen] = useState(false);
  const [pickingTarget, setPickingTarget] = useState<"origin" | "destination" | null>(null);
  const [airportSearchQuery, setAirportSearchQuery] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedFlight, setSelectedFlight] = useState<GeneratedFlight | null>(null);
  const [bookingConfirmed, setBookingConfirmed] = useState(false);

  const filteredAirports = useMemo(() => {
    const q = airportSearchQuery.toLowerCase().trim();
    if (!q) return AIRPORTS_DATABASE;
    return AIRPORTS_DATABASE.filter(
      (a) =>
        a.code.toLowerCase().includes(q) ||
        a.city.toLowerCase().includes(q) ||
        a.country.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q)
    );
  }, [airportSearchQuery]);

  const handleSwap = () => {
    triggerSelectionHaptic();
    const temp = origin;
    setOrigin(destination);
    setDestination(temp);
  };

  // Generate dynamic, realistic flights for any origin/destination pair
  const flights: GeneratedFlight[] = useMemo(() => {
    const isDomestic = origin.country === destination.country;
    const isEurope = /france|spain|united kingdom|italy|netherlands|switzerland|germany/i.test(destination.country);
    const isMiddleEast = /united arab emirates|qatar|turkey|egypt/i.test(destination.country);
    const isUS = /united states/i.test(destination.country);
    const isAsia = /japan|singapore|thailand|australia/i.test(destination.country);

    let baseDurationHours = 3;
    let basePriceMad = 1850;

    if (isDomestic) {
      baseDurationHours = 1;
      basePriceMad = 750;
    } else if (isEurope) {
      baseDurationHours = 3;
      basePriceMad = 2100;
    } else if (isMiddleEast) {
      baseDurationHours = 7;
      basePriceMad = 4800;
    } else if (isUS) {
      baseDurationHours = 8.5;
      basePriceMad = 6900;
    } else if (isAsia) {
      baseDurationHours = 12;
      basePriceMad = 9200;
    }

    const cabinMultiplier =
      cabin === "First" ? 3.8 : cabin === "Business" ? 2.5 : cabin === "Premium Economy" ? 1.5 : 1;

    const roundTripMultiplier = tripType === "roundTrip" ? 1.8 : 1;
    const finalBasePrice = Math.round(basePriceMad * cabinMultiplier * roundTripMultiplier * adults);

    return [
      {
        id: `fl-${origin.code}-${destination.code}-1`,
        airline: origin.country === "Morocco" ? "Royal Air Maroc" : "Air France",
        flightNumber: origin.country === "Morocco" ? `AT-${Math.floor(600 + Math.random() * 200)}` : `AF-${Math.floor(1200 + Math.random() * 300)}`,
        origin,
        destination,
        departureTime: "08:30",
        arrivalTime: "12:15",
        duration: `${Math.floor(baseDurationHours)}h ${Math.round((baseDurationHours % 1) * 60 + 15)}m`,
        stops: "Direct",
        priceMad: finalBasePrice,
        aircraft: "Boeing 787-9 Dreamliner",
        cabin,
      },
      {
        id: `fl-${origin.code}-${destination.code}-2`,
        airline: isMiddleEast ? "Emirates" : isEurope ? "Iberia" : "Delta Air Lines",
        flightNumber: `DL-${Math.floor(800 + Math.random() * 150)}`,
        origin,
        destination,
        departureTime: "14:10",
        arrivalTime: "18:40",
        duration: `${Math.floor(baseDurationHours)}h ${Math.round((baseDurationHours % 1) * 60 + 30)}m`,
        stops: "Direct",
        priceMad: Math.round(finalBasePrice * 1.08),
        aircraft: "Airbus A350-900",
        cabin,
      },
      {
        id: `fl-${origin.code}-${destination.code}-3`,
        airline: "Turkish Airlines",
        flightNumber: `TK-${Math.floor(400 + Math.random() * 200)}`,
        origin,
        destination,
        departureTime: "11:20",
        arrivalTime: "19:05",
        duration: `${Math.floor(baseDurationHours + 2.5)}h 45m`,
        stops: "1 Stop",
        stopCity: "Istanbul (IST)",
        priceMad: Math.round(finalBasePrice * 0.85),
        aircraft: "Airbus A321neo",
        cabin,
      },
    ];
  }, [origin, destination, cabin, tripType, adults]);

  return (
    <View style={styles.container}>
      {/* Flight Search Card */}
      <View
        style={[
          styles.flightCard,
          {
            backgroundColor: palette.surface,
            borderColor: palette.border,
          },
        ]}
      >
        {/* Trip Type Selector */}
        <View
          style={[
            styles.tripTypeRow,
            { backgroundColor: palette.surfaceMuted, borderColor: palette.border },
          ]}
        >
          <Pressable
            onPress={() => {
              triggerSelectionHaptic();
              setTripType("roundTrip");
            }}
            style={[
              styles.tripTypeTab,
              tripType === "roundTrip" && [
                styles.tripTypeTabActive,
                {
                  backgroundColor: isDark ? "#24242F" : palette.surface,
                  borderColor: palette.border,
                },
              ],
            ]}
          >
            <Text
              style={[
                styles.tripTypeText,
                { color: tripType === "roundTrip" ? palette.text : palette.subtext },
              ]}
            >
              Round-trip
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              triggerSelectionHaptic();
              setTripType("oneWay");
            }}
            style={[
              styles.tripTypeTab,
              tripType === "oneWay" && [
                styles.tripTypeTabActive,
                {
                  backgroundColor: isDark ? "#24242F" : palette.surface,
                  borderColor: palette.border,
                },
              ],
            ]}
          >
            <Text
              style={[
                styles.tripTypeText,
                { color: tripType === "oneWay" ? palette.text : palette.subtext },
              ]}
            >
              One-way
            </Text>
          </Pressable>
        </View>

        {/* Origin & Destination Interactive Pickers */}
        <View style={styles.airportsWrap}>
          <Pressable
            onPress={() => {
              triggerSelectionHaptic();
              setAirportSearchQuery("");
              setPickingTarget("origin");
            }}
            style={[
              styles.airportBlock,
              { backgroundColor: palette.surfaceMuted, borderColor: palette.border },
            ]}
          >
            <Text style={[styles.airportRole, { color: palette.subtext }]}>FROM</Text>
            <Text style={[styles.airportCode, { color: palette.text }]}>{origin.code}</Text>
            <Text style={[styles.airportName, { color: palette.subtext }]} numberOfLines={1}>
              {origin.city}, {origin.country}
            </Text>
          </Pressable>

          {/* Swap Button */}
          <Pressable
            onPress={handleSwap}
            style={[
              styles.swapCircle,
              {
                backgroundColor: isDark ? "#252532" : palette.surface,
                borderColor: palette.border,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Swap departure and arrival airports"
          >
            <ArrowLeftRight size={16} color={palette.primary} />
          </Pressable>

          <Pressable
            onPress={() => {
              triggerSelectionHaptic();
              setAirportSearchQuery("");
              setPickingTarget("destination");
            }}
            style={[
              styles.airportBlock,
              { backgroundColor: palette.surfaceMuted, borderColor: palette.border },
            ]}
          >
            <Text style={[styles.airportRole, { color: palette.subtext }]}>TO</Text>
            <Text style={[styles.airportCode, { color: palette.text }]}>{destination.code}</Text>
            <Text style={[styles.airportName, { color: palette.subtext }]} numberOfLines={1}>
              {destination.city}, {destination.country}
            </Text>
          </Pressable>
        </View>

        {/* Dates & Passengers Strip */}
        <View style={styles.metaRow}>
          <Pressable
            onPress={() => {
              triggerSelectionHaptic();
              setDatesModalOpen(true);
            }}
            style={[
              styles.metaChip,
              { backgroundColor: palette.surfaceMuted, borderColor: palette.border },
            ]}
          >
            <Calendar size={14} color={palette.primary} />
            <Text style={[styles.metaText, { color: palette.text }]}>
              {tripType === "roundTrip"
                ? formatDateRangeShort(checkIn, checkOut)
                : `Depart ${checkIn}`}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              triggerSelectionHaptic();
              setCabin((curr) =>
                curr === "Economy"
                  ? "Premium Economy"
                  : curr === "Premium Economy"
                  ? "Business"
                  : curr === "Business"
                  ? "First"
                  : "Economy"
              );
            }}
            style={[
              styles.metaChip,
              { backgroundColor: palette.surfaceMuted, borderColor: palette.border },
            ]}
          >
            <Users size={14} color={palette.primary} />
            <Text style={[styles.metaText, { color: palette.text }]}>
              {adults} Ad · {cabin}
            </Text>
          </Pressable>
        </View>

        {/* Search Flights Action Button */}
        <PrimaryButton
          label={`Search Flights (${origin.code} ➔ ${destination.code})`}
          icon={<Plane size={16} color="#FFFFFF" />}
          onPress={() => {
            triggerSelectionHaptic();
            setHasSearched(true);
          }}
        />
      </View>

      {/* Flight Search Results */}
      <View style={styles.resultsSection}>
        <View style={styles.resultsHeaderRow}>
          <Text style={[styles.resultsTitle, { color: palette.text }]}>
            Available Flights ({flights.length})
          </Text>
          <Text style={[styles.resultsRoute, { color: palette.subtext }]}>
            {origin.city} to {destination.city}
          </Text>
        </View>

        {flights.map((flight) => (
          <Pressable
            key={flight.id}
            onPress={() => {
              triggerSelectionHaptic();
              setSelectedFlight(flight);
              setBookingConfirmed(false);
            }}
            style={[
              styles.flightResultCard,
              {
                backgroundColor: palette.surface,
                borderColor: palette.border,
              },
            ]}
          >
            {/* Airline Header */}
            <View style={styles.flightCardTop}>
              <View style={styles.airlineWrap}>
                <Plane size={14} color={palette.primary} />
                <Text style={[styles.airlineName, { color: palette.text }]}>
                  {flight.airline} · {flight.flightNumber}
                </Text>
              </View>
              <View
                style={[
                  styles.stopBadge,
                  {
                    backgroundColor:
                      flight.stops === "Direct"
                        ? "rgba(63, 182, 152, 0.15)"
                        : "rgba(245, 158, 11, 0.15)",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.stopText,
                    {
                      color: flight.stops === "Direct" ? "#34977D" : "#D97706",
                    },
                  ]}
                >
                  {flight.stops}
                </Text>
              </View>
            </View>

            {/* Flight Timings & Route Line */}
            <View style={styles.timingRow}>
              <View style={styles.timeCol}>
                <Text style={[styles.timeText, { color: palette.text }]}>
                  {flight.departureTime}
                </Text>
                <Text style={[styles.airportSub, { color: palette.subtext }]}>
                  {flight.origin.code}
                </Text>
              </View>

              <View style={styles.flightLineWrap}>
                <Text style={[styles.durationText, { color: palette.subtext }]}>
                  {flight.duration}
                </Text>
                <View
                  style={[styles.flightLine, { backgroundColor: palette.border }]}
                />
                {flight.stopCity ? (
                  <Text style={[styles.stopCitySub, { color: palette.muted }]}>
                    via {flight.stopCity}
                  </Text>
                ) : null}
              </View>

              <View style={[styles.timeCol, { alignItems: "flex-end" }]}>
                <Text style={[styles.timeText, { color: palette.text }]}>
                  {flight.arrivalTime}
                </Text>
                <Text style={[styles.airportSub, { color: palette.subtext }]}>
                  {flight.destination.code}
                </Text>
              </View>
            </View>

            {/* Price & Booking Footer */}
            <View style={[styles.flightFooter, { borderTopColor: palette.border }]}>
              <View style={styles.baggageWrap}>
                <Luggage size={13} color={palette.subtext} />
                <Text style={[styles.baggageText, { color: palette.subtext }]}>
                  Cabin + 23kg checked bag
                </Text>
              </View>

              <View style={styles.priceActionWrap}>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={[styles.flightPrice, { color: palette.primary }]}>
                    {flight.priceMad.toLocaleString()} MAD
                  </Text>
                  <Text style={[styles.flightPriceSub, { color: palette.subtext }]}>
                    total per traveler
                  </Text>
                </View>
                <ChevronRight size={16} color={palette.primary} />
              </View>
            </View>
          </Pressable>
        ))}
      </View>

      {/* Airport Search Picker Modal */}
      <Modal
        visible={pickingTarget !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setPickingTarget(null)}
      >
        <View style={styles.airportModalBackdrop}>
          <View
            style={[
              styles.airportModalSheet,
              { backgroundColor: palette.background, borderColor: palette.border },
            ]}
          >
            <View style={styles.airportModalHeader}>
              <Text style={[styles.airportModalTitle, { color: palette.text }]}>
                Select {pickingTarget === "origin" ? "Departure" : "Destination"} Airport
              </Text>
              <Pressable
                onPress={() => setPickingTarget(null)}
                style={[styles.closeCircle, { backgroundColor: palette.surfaceMuted }]}
              >
                <X size={16} color={palette.text} />
              </Pressable>
            </View>

            {/* Airport Search Input */}
            <View
              style={[
                styles.airportSearchInputRow,
                { backgroundColor: palette.surfaceMuted, borderColor: palette.border },
              ]}
            >
              <Search size={16} color={palette.subtext} />
              <TextInput
                value={airportSearchQuery}
                onChangeText={setAirportSearchQuery}
                placeholder="Search city, country, or code (e.g. JFK, CDG, CMN)"
                placeholderTextColor={palette.muted}
                style={[styles.airportSearchInput, { color: palette.text }]}
                autoFocus
              />
            </View>

            <ScrollView
              contentContainerStyle={styles.airportsListScroll}
              showsVerticalScrollIndicator={false}
            >
              {filteredAirports.map((item) => (
                <Pressable
                  key={item.code}
                  onPress={() => {
                    triggerSelectionHaptic();
                    if (pickingTarget === "origin") {
                      setOrigin(item);
                    } else {
                      setDestination(item);
                    }
                    setPickingTarget(null);
                  }}
                  style={[
                    styles.airportItemRow,
                    { borderBottomColor: palette.border },
                  ]}
                >
                  <View
                    style={[
                      styles.codeBadge,
                      { backgroundColor: palette.surfaceMuted, borderColor: palette.border },
                    ]}
                  >
                    <Text style={[styles.codeBadgeText, { color: palette.primary }]}>
                      {item.code}
                    </Text>
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[styles.airportItemCity, { color: palette.text }]}>
                      {item.city}, {item.country}
                    </Text>
                    <Text style={[styles.airportItemName, { color: palette.subtext }]}>
                      {item.name}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Flight Detail & Booking Inquiry Modal */}
      <Modal
        visible={selectedFlight !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedFlight(null)}
      >
        <View style={styles.airportModalBackdrop}>
          <View
            style={[
              styles.flightDetailSheet,
              { backgroundColor: palette.background, borderColor: palette.border },
            ]}
          >
            {selectedFlight ? (
              <>
                <View style={styles.airportModalHeader}>
                  <Text style={[styles.airportModalTitle, { color: palette.text }]}>
                    Flight Details & Booking
                  </Text>
                  <Pressable
                    onPress={() => setSelectedFlight(null)}
                    style={[styles.closeCircle, { backgroundColor: palette.surfaceMuted }]}
                  >
                    <X size={16} color={palette.text} />
                  </Pressable>
                </View>

                {bookingConfirmed ? (
                  <View style={styles.confirmedWrap}>
                    <CheckCircle size={48} color="#34977D" />
                    <Text style={[styles.confirmedTitle, { color: palette.text }]}>
                      Flight Reservation Requested!
                    </Text>
                    <Text style={[styles.confirmedSub, { color: palette.subtext }]}>
                      Your booking for {selectedFlight.airline} ({selectedFlight.origin.code} ➔{" "}
                      {selectedFlight.destination.code}) is reserved. Electronic ticket details sent.
                    </Text>
                    <PrimaryButton
                      label="Done"
                      onPress={() => setSelectedFlight(null)}
                      style={{ marginTop: 12, width: "100%" }}
                    />
                  </View>
                ) : (
                  <ScrollView
                    contentContainerStyle={{ gap: 14, paddingBottom: 20 }}
                    showsVerticalScrollIndicator={false}
                  >
                    <View
                      style={[
                        styles.flightSummaryBox,
                        { backgroundColor: palette.surfaceMuted, borderColor: palette.border },
                      ]}
                    >
                      <View style={styles.summaryTopRow}>
                        <Text style={[styles.airlineName, { color: palette.text }]}>
                          {selectedFlight.airline} · {selectedFlight.flightNumber}
                        </Text>
                        <Text style={[styles.aircraftText, { color: palette.subtext }]}>
                          {selectedFlight.aircraft}
                        </Text>
                      </View>

                      <View style={styles.summaryRouteRow}>
                        <View>
                          <Text style={[styles.sumCity, { color: palette.text }]}>
                            {selectedFlight.origin.city} ({selectedFlight.origin.code})
                          </Text>
                          <Text style={[styles.sumTime, { color: palette.primary }]}>
                            {selectedFlight.departureTime}
                          </Text>
                        </View>
                        <ArrowRight size={18} color={palette.primary} />
                        <View style={{ alignItems: "flex-end" }}>
                          <Text style={[styles.sumCity, { color: palette.text }]}>
                            {selectedFlight.destination.city} ({selectedFlight.destination.code})
                          </Text>
                          <Text style={[styles.sumTime, { color: palette.primary }]}>
                            {selectedFlight.arrivalTime}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <View
                      style={[
                        styles.includedBox,
                        { backgroundColor: palette.surface, borderColor: palette.border },
                      ]}
                    >
                      <Text style={[styles.includedTitle, { color: palette.text }]}>
                        Included with your fare ({selectedFlight.cabin}):
                      </Text>
                      <Text style={[styles.includedItem, { color: palette.subtext }]}>
                        ✓ 1 Carry-on bag (up to 10kg)
                      </Text>
                      <Text style={[styles.includedItem, { color: palette.subtext }]}>
                        ✓ 1 Checked suitcase (up to 23kg)
                      </Text>
                      <Text style={[styles.includedItem, { color: palette.subtext }]}>
                        ✓ Complimentary in-flight meals & drinks
                      </Text>
                      <Text style={[styles.includedItem, { color: palette.subtext }]}>
                        ✓ Standard seat selection
                      </Text>
                    </View>

                    <PrimaryButton
                      label={`Reserve Flight · ${selectedFlight.priceMad.toLocaleString()} MAD`}
                      onPress={() => {
                        triggerSelectionHaptic();
                        setBookingConfirmed(true);
                      }}
                    />
                  </ScrollView>
                )}
              </>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* Dates Modal */}
      <SpringBottomSheet
        visible={datesModalOpen}
        title="Flight Travel Dates"
        onClose={() => setDatesModalOpen(false)}
        footer={
          <PrimaryButton
            label="Apply Flight Dates"
            onPress={() => setDatesModalOpen(false)}
          />
        }
      >
        <ScrollView
          contentContainerStyle={{ gap: 14, paddingBottom: 10 }}
          showsVerticalScrollIndicator={false}
        >
          <DateRangePicker checkIn={checkIn} checkOut={checkOut} onChange={setDates} />
        </ScrollView>
      </SpringBottomSheet>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  flightCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 14,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  tripTypeRow: {
    flexDirection: "row",
    padding: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  tripTypeTab: {
    flex: 1,
    paddingVertical: 7,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  tripTypeTabActive: {
    borderWidth: 1,
  },
  tripTypeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  airportsWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    position: "relative",
  },
  airportBlock: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 2,
  },
  airportRole: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  airportCode: {
    fontSize: 20,
    fontWeight: "800",
  },
  airportName: {
    fontSize: 12,
    fontWeight: "500",
  },
  swapCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 5,
  },
  metaRow: {
    flexDirection: "row",
    gap: 10,
  },
  metaChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  metaText: {
    fontSize: 13,
    fontWeight: "600",
  },
  resultsSection: {
    gap: 12,
    marginTop: 4,
  },
  resultsHeaderRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  resultsTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  resultsRoute: {
    fontSize: 12,
    fontWeight: "500",
  },
  flightResultCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  flightCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  airlineWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  airlineName: {
    fontSize: 13,
    fontWeight: "700",
  },
  stopBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  stopText: {
    fontSize: 11,
    fontWeight: "700",
  },
  timingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  timeCol: {
    gap: 2,
  },
  timeText: {
    fontSize: 18,
    fontWeight: "700",
  },
  airportSub: {
    fontSize: 12,
    fontWeight: "600",
  },
  flightLineWrap: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 4,
  },
  durationText: {
    fontSize: 11,
    fontWeight: "500",
  },
  flightLine: {
    height: 1,
    width: "100%",
  },
  stopCitySub: {
    fontSize: 10,
    fontWeight: "500",
  },
  flightFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 10,
    borderTopWidth: 1,
  },
  baggageWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  baggageText: {
    fontSize: 11,
    fontWeight: "500",
  },
  priceActionWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  flightPrice: {
    fontSize: 16,
    fontWeight: "800",
  },
  flightPriceSub: {
    fontSize: 10,
    fontWeight: "500",
  },
  airportModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "flex-end",
  },
  airportModalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    maxHeight: "80%",
    padding: 16,
    gap: 12,
  },
  airportModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  airportModalTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  closeCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  airportSearchInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
  },
  airportSearchInput: {
    flex: 1,
    fontSize: 13,
    padding: 0,
  },
  airportsListScroll: {
    gap: 2,
    paddingBottom: 20,
  },
  airportItemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  codeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 46,
    alignItems: "center",
  },
  codeBadgeText: {
    fontSize: 13,
    fontWeight: "800",
  },
  airportItemCity: {
    fontSize: 14,
    fontWeight: "700",
  },
  airportItemName: {
    fontSize: 11,
  },
  flightDetailSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    padding: 20,
    gap: 14,
    maxHeight: "85%",
  },
  flightSummaryBox: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  summaryTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  aircraftText: {
    fontSize: 11,
    fontWeight: "500",
  },
  summaryRouteRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sumCity: {
    fontSize: 13,
    fontWeight: "700",
  },
  sumTime: {
    fontSize: 16,
    fontWeight: "800",
    marginTop: 2,
  },
  includedBox: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
  },
  includedTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  includedItem: {
    fontSize: 12,
    lineHeight: 18,
  },
  confirmedWrap: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 10,
  },
  confirmedTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 8,
  },
  confirmedSub: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
    paddingHorizontal: 16,
  },
});

