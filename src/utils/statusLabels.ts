import { CoreTrackingStatus } from "../types/models";

/**
 * i18n key for a tracking status — render with t(statusLabelKey(status)).
 * Keys live in translations under "status.*" (en + es).
 */
export const statusLabelKey = (status: CoreTrackingStatus): string =>
  `status.${status}`;

/**
 * Legacy English-only label. Prefer t(statusLabelKey(status)) in UI code.
 * Kept for non-UI contexts (logs, fallbacks).
 */
export const formatStatusLabel = (status: CoreTrackingStatus) => {
  if (status === "dnf") {
    return "unfinished";
  }
  return status.replaceAll("-", " ");
};
