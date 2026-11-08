import React from "react";
import { StyleProp, ViewStyle } from "react-native";
import { AppBottomSheet, AppBottomSheetProps } from "./AppBottomSheet";

export interface SpringBottomSheetProps extends Omit<AppBottomSheetProps, "title"> {
  title: string;
}

/**
 * SpringBottomSheet: Backward-compatible wrapper over AppBottomSheet
 * with zero-dim background, interactive drag-to-dismiss handle, spring physics,
 * and solid bottom coverage.
 */
export const SpringBottomSheet: React.FC<SpringBottomSheetProps> = (props) => {
  return <AppBottomSheet {...props} />;
};
