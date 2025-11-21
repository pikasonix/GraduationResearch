import { useMemo } from "react";
import {
  getLabelsFromValues,
  getLabelFromValue,
  getOptionsByType,
} from "@/lib/utils";
import type { OptionType } from "@/components/MultiSelectDropdown";

/**
 * Custom hook to easily get option labels from values across the application
 * @returns Functions for working with option labels
 */
export function useOptionLabels() {
  return useMemo(
    () => ({
      /**
       * Get multiple labels from an array of option values
       * @param type - The option type (cofounder, partner, profileRole, profileType, projectCategory)
       * @param values - Array of option values
       * @param fallback - Optional fallback text if no values
       */
      getLabels: (
        type:
          | "cofounder"
          | "partner"
          | "profileRole"
          | "profileType"
          | "projectCategory",
        values: string[] | null | undefined,
        fallback?: string
      ) => {
        const options = getOptionsByType(type);
        return getLabelsFromValues(values, options, fallback);
      },

      /**
       * Get single label from option value
       * @param type - The option type (cofounder, partner, profileRole, profileType, projectCategory)
       * @param value - Option value to convert to label
       * @param fallback - Optional fallback text if value not found
       */
      getLabel: (
        type:
          | "cofounder"
          | "partner"
          | "profileRole"
          | "profileType"
          | "projectCategory",
        value: string | null | undefined,
        fallback?: string
      ) => {
        const options = getOptionsByType(type);
        return getLabelFromValue(value, options, fallback);
      },

      /**
       * Get options array for a specific type
       * @param type - The option type (cofounder, partner, profileRole, profileType, projectCategory)
       */
      getOptions: (
        type:
          | "cofounder"
          | "partner"
          | "profileRole"
          | "profileType"
          | "projectCategory"
      ): OptionType[] => {
        return getOptionsByType(type);
      },
    }),
    []
  );
}
