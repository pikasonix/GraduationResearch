import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { type OptionType } from "@/components/MultiSelectDropdown";
import {
  COFOUNDER_TYPE_OPTIONS,
  PARTNER_TYPE_OPTIONS,
  PROFILE_ROLE_OPTIONS,
  PROFILE_TYPE_OPTIONS,
  PROJECT_CATEGORY_OPTIONS,
} from "@/lib/constants/options";
import { Currency } from "lucide-react";

/**
 * Combines class names with Tailwind's merge function
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats a numeric string or number as US Dollar currency (USD).
 *
 * @param value The numeric string or number to format.
 * @param currency The currency code ('USD' or 'VND'). Defaults to 'USD'.
 * @returns The formatted currency string (e.g., "$1,000,000", "VND 20.000.000") or null if the value is invalid/null.
 * @param currency The currency code ('USD' or 'VND'). Defaults to 'USD'.
 * @returns The formatted currency string (e.g., "$1,000,000", "VND 20.000.000") or null if the value is invalid/null.
 */
export const formatCurrency = (
  value: string | null | undefined | number,
  currency: string | null | undefined
): string | null => {
  let numericValue: number;

  if (value === null || value === undefined || value === "") {
    return null; // Return null for empty/null input
  }

  if (typeof value === "string") {
    const cleanedValue = value.replace(/[^\d]/g, ""); // Keep escaped hyphen regex
    numericValue = parseFloat(cleanedValue);
  } else if (typeof value === "number") {
    numericValue = value;
  } else {
    return null; // Return null for invalid types
  }

  if (isNaN(numericValue)) {
    // Return null if parsing failed
    return null;
  }

  // Format with US locale and add '$' or 'VND'
  if (currency === "VND") {
    return `${numericValue.toLocaleString("vi-VN", {
      maximumFractionDigits: 0,
    })} VND`;
  }
  return `$${numericValue.toLocaleString("en-US", {
    maximumFractionDigits: 2,
  })}`;
};

/**
 * Gets a label for a given value from an options array
 * @param value - The option value to find
 * @param options - Array of options with value/label pairs
 * @param fallback - Optional fallback text if value not found
 * @returns The corresponding label or the fallback/value
 */
export function getLabelFromValue(
  value: string | null | undefined,
  options: OptionType[],
  fallback?: string
): string {
  if (!value) return fallback || "";

  const option = options.find((opt) => opt.value === value);
  return option ? option.label : fallback || value;
}

/**
 * Converts an array of option values to their corresponding labels
 * @param values - Array of option values to convert
 * @param options - Array of options with value/label pairs
 * @param fallback - Optional fallback text if no values or empty array
 * @returns A comma-separated string of labels
 */
export function getLabelsFromValues(
  values: string[] | null | undefined,
  options: OptionType[],
  fallback: string = "Chưa có"
): string {
  if (!values || values.length === 0) {
    return fallback;
  }

  return values.map((value) => getLabelFromValue(value, options)).join(", ");
}

/**
 * Gets the appropriate options array for a given option type
 * @param optionType - The type of options to retrieve (cofounder, partner, profileRole, profileType, projectCategory)
 * @returns The corresponding options array
 */
export function getOptionsByType(
  optionType:
    | "cofounder"
    | "partner"
    | "profileRole"
    | "profileType"
    | "projectCategory"
) {
  switch (optionType) {
    case "cofounder":
      return COFOUNDER_TYPE_OPTIONS;
    case "partner":
      return PARTNER_TYPE_OPTIONS;
    case "profileRole":
      return PROFILE_ROLE_OPTIONS;
    case "profileType":
      return PROFILE_TYPE_OPTIONS;
    case "projectCategory":
      return PROJECT_CATEGORY_OPTIONS;
    default:
      return [];
  }
}
export function formatVietnameseDate(dateString: string): string {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return ""; // tránh crash nếu date không hợp lệ
  const day = date.getDate();
  const month = date.getMonth() + 1; // getMonth() bắt đầu từ 0
  const year = date.getFullYear();
  return `${day} tháng ${month}, năm ${year}`;
}
