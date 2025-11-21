import React, { useState, KeyboardEvent } from "react";
import { X } from "lucide-react";

interface TagInputProps {
  label: string;
  id?: string;
  name?: string;
  tags: string[]; // Current list of tags
  onTagsChange: (newTags: string[]) => void; // Callback when tags change
  placeholder?: string; // Placeholder for the input field
  error?: string | null;
  hintText?: string;
  // Add suggestions logic later if needed
}

/**
 * A reusable input component for managing a list of tags.
 *
 * @param {TagInputProps} props Component props.
 * @returns {JSX.Element} The tag input component.
 */
const TagInput: React.FC<TagInputProps> = ({
  label,
  id,
  name,
  tags,
  onTagsChange,
  placeholder = "Add a tag...",
  error,
  hintText,
}) => {
  const [inputValue, setInputValue] = useState("");
  const inputId = id || name;

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault(); // Prevent form submission or comma in input
      const newTag = inputValue.trim();
      if (newTag && !tags.includes(newTag)) {
        onTagsChange([...tags, newTag]);
      }
      setInputValue(""); // Clear input
    }
    // Handle backspace to remove last tag if input is empty
    if (event.key === "Backspace" && inputValue === "" && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  };

  const removeTag = (tagToRemove: string) => {
    onTagsChange(tags.filter((tag) => tag !== tagToRemove));
  };

  return (
    <div className="w-full">
      <label
        htmlFor={`${inputId}-input`}
        className="block text-sm font-medium text-gray-700 mb-1"
      >
        {label}
      </label>
      <div
        className={`flex flex-wrap items-center gap-2 p-2 border rounded-md min-h-[42px] ${
          error ? "border-red-500" : "border-gray-300"
        }`}
      >
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-md text-sm font-medium bg-gray-100 text-gray-700 border border-gray-200"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="flex-shrink-0 p-0.5 rounded hover:bg-gray-200 focus:outline-none"
              aria-label={`Remove ${tag}`}
            >
              <X size={14} className="text-gray-500 hover:text-gray-700" />
            </button>
          </span>
        ))}
        <input
          id={`${inputId}-input`}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? placeholder : ""} // Show placeholder only when no tags
          className="flex-grow p-1 outline-none text-sm bg-transparent min-w-[80px]"
          aria-describedby={
            error
              ? `${inputId}-error`
              : hintText
              ? `${inputId}-hint`
              : undefined
          }
        />
      </div>
      {hintText && !error && (
        <p className="mt-1 text-xs text-gray-500" id={`${inputId}-hint`}>
          {hintText}
        </p>
      )}
      {error && (
        <p className="mt-1 text-xs text-red-600" id={`${inputId}-error`}>
          {error}
        </p>
      )}
    </div>
  );
};

export default TagInput;
