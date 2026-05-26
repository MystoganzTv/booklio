import { CoreTrackingStatus } from "../types/models";

export const formatStatusLabel = (status: CoreTrackingStatus) => {
  if (status === "dnf") {
    return "unfinished";
  }

  return status.replaceAll("-", " ");
};
