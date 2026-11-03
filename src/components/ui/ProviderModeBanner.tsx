import React from "react";
import type { ProviderCapabilities } from "../../types/domain";

interface ProviderModeBannerProps {
  capabilities?: ProviderCapabilities;
  compact?: boolean;
}

/**
 * Intentionally renders nothing in consumer UI so technical gateway/fixture
 * debug banners never clutter hotel discovery or reservation screens.
 */
export const ProviderModeBanner: React.FC<ProviderModeBannerProps> = () => {
  return null;
};
