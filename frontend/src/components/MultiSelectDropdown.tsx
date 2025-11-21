import React, { useState, useRef } from "react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ChevronDownIcon, X, Check } from "lucide-react";

export interface OptionType {
  value: string;
  label: string;
}

/**
 * MultiSelectDropdown allows selecting multiple options from a predefined list.
 * @param {OptionType[]} options - List of selectable options.
 * @param {string[]} value - Currently selected value keys.
 * @param {(val: string[]) => void} onChange - Callback when selection changes.
 * @param {string} placeholder - Placeholder text when nothing is selected.
 * @param {string} label - Optional label for accessibility.
 */
export type MultiSelectDropdownProps = {
  options: OptionType[];
  value: string[]; // Stores array of selected values (keys)
  onChange: (val: string[]) => void;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
};

const MultiSelectDropdown: React.FC<MultiSelectDropdownProps> = ({
  options,
  value, // This is an array of selected keys, e.g. ["CUSTOMER_company", "angel_STATION_OWNER"]
  onChange,
  label,
  placeholder = "Select options...",
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const handleToggle = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter((v) => v !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
  };

  const handleRemove = (optionValue: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    onChange(value.filter((v) => v !== optionValue));
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const el = e.currentTarget as HTMLDivElement;
    // Scroll the container manually so the wheel always scrolls the dropdown
    el.scrollTop += e.deltaY;
    e.preventDefault();
  };

  const handleBoxClick = (e: React.MouseEvent) => {
    if (
      !disabled &&
      (e.target as HTMLElement).closest("button[data-chip-remove]") == null
    ) {
      setOpen(true);
    }
  };

  // Get the label for a given value key
  const getLabel = (optionValue: string) => {
    return (
      options.find((opt) => opt.value === optionValue)?.label || optionValue
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          ref={boxRef}
          className={`flex flex-wrap items-center gap-2 px-3 py-2 border rounded-md min-h-[44px] border-gray-300 bg-white w-full relative ${disabled ? "cursor-not-allowed bg-gray-50" : "cursor-pointer"
            }`}
          onClick={handleBoxClick}
          tabIndex={disabled ? -1 : 0}
          aria-label={label}
          role="button"
        >
          {/* Placeholder - absolutely positioned */}
          {value.length === 0 && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">
              {placeholder}
            </span>
          )}

          {/* Selected tags */}
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
            {value.map((selectedValue) => (
              <span
                key={selectedValue}
                className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-md text-sm font-medium text-gray-700 border border-gray-200"
              >
                {getLabel(selectedValue)}
                <button
                  type="button"
                  onClick={(e) => handleRemove(selectedValue, e)}
                  className="flex-shrink-0 p-0.5 rounded hover:bg-gray-200 focus:outline-none"
                  aria-label={`Remove ${getLabel(selectedValue)}`}
                  data-chip-remove
                  disabled={disabled}
                >
                  <X size={14} className="text-gray-500 hover:text-gray-700" />
                </button>
              </span>
            ))}
          </div>

          {/* Dropdown trigger button (visual only) */}
          <Button
            variant="ghost"
            className="flex items-center justify-center p-1 h-7 w-7 min-w-0 ml-auto border-none shadow-none focus:ring-0 focus:outline-none"
            disabled={disabled}
            aria-label={label}
            type="button"
            tabIndex={-1} // Not focusable by itself, box is focusable
          >
            <ChevronDownIcon className="h-4 w-4 opacity-50" />
          </Button>
        </div>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        className="p-0"
        style={{ width: "var(--radix-popover-trigger-width)" }}
      >
        <div className="max-h-40 overflow-y-auto flex flex-col gap-0.5 p-1" onWheel={handleWheel}>
          {options.map((option) => (
            <div
              key={option.value}
              className={`flex items-center justify-between rounded-md px-3 py-3 text-sm font-medium hover:bg-accent ${value.includes(option.value) ? "bg-accent" : ""}`}
              onClick={() => {
                if (!disabled) {
                  handleToggle(option.value);
                }
              }}
              style={{ cursor: disabled ? "not-allowed" : "pointer" }}
              role="option"
              aria-selected={value.includes(option.value)}
            >
              <span>{option.label}</span>
              {value.includes(option.value) && <Check className="h-4 w-4 text-sky-600" />}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default MultiSelectDropdown;