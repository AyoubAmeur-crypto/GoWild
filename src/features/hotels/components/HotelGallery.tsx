import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Expand, X } from "lucide-react-native";
import type { HotelImage } from "../../../types/domain";

interface HotelGalleryProps {
  images: HotelImage[];
  hotelName: string;
}

export const HotelGallery: React.FC<HotelGalleryProps> = ({
  images,
  hotelName,
}) => {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const safeImages =
    images.length > 0
      ? images.slice(0, 10)
      : [
          {
            id: "fallback",
            url: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80",
            caption: hotelName,
          },
        ];

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / width);
          setActiveIndex(Math.max(0, Math.min(idx, safeImages.length - 1)));
        }}
      >
        {safeImages.map((img) => (
          <Pressable
            key={img.id}
            onPress={() => setLightboxOpen(true)}
            style={{ width, height: 300 }}
            accessibilityRole="imagebutton"
            accessibilityLabel={`Open full photo gallery for ${hotelName}`}
          >
            <Image
              source={{ uri: img.url }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={200}
            />
          </Pressable>
        ))}
      </ScrollView>

      <Pressable
        onPress={() => setLightboxOpen(true)}
        style={styles.counterBadge}
        accessibilityRole="button"
        accessibilityLabel="Expand gallery"
      >
        <Expand size={13} color="#FFFFFF" />
        <Text style={styles.counterText}>
          {activeIndex + 1} / {safeImages.length}
        </Text>
      </Pressable>

      <Modal
        visible={lightboxOpen}
        animationType="fade"
        transparent={false}
        onRequestClose={() => setLightboxOpen(false)}
      >
        <View
          style={[
            styles.lightboxRoot,
            { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 20 },
          ]}
        >
          <View style={styles.lightboxHeader}>
            <Text style={styles.lightboxTitle} numberOfLines={1}>
              {hotelName}
            </Text>
            <Pressable
              onPress={() => setLightboxOpen(false)}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Close gallery"
            >
              <X size={22} color="#FFFFFF" />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.lightboxScroll}
            showsVerticalScrollIndicator={false}
          >
            {safeImages.map((img, i) => (
              <View key={img.id} style={styles.lightboxCard}>
                <Image
                  source={{ uri: img.url }}
                  style={styles.lightboxImg}
                  contentFit="cover"
                />
                <Text style={styles.lightboxCaption}>
                  Photo {i + 1}
                  {img.caption ? ` · ${img.caption}` : ""}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 300,
    width: "100%",
    position: "relative",
    backgroundColor: "#171725",
  },
  counterBadge: {
    position: "absolute",
    bottom: 18,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(23, 23, 37, 0.76)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  counterText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  lightboxRoot: {
    flex: 1,
    backgroundColor: "#0F131D",
  },
  lightboxHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  lightboxTitle: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
    flex: 1,
    marginRight: 12,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  lightboxScroll: {
    paddingHorizontal: 16,
    gap: 18,
    paddingBottom: 24,
  },
  lightboxCard: {
    gap: 8,
  },
  lightboxImg: {
    width: "100%",
    height: 250,
    borderRadius: 16,
    backgroundColor: "#171D2B",
  },
  lightboxCaption: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 13,
    fontWeight: "500",
  },
});

