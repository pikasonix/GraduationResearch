import React, { useState, useRef, DragEvent, ChangeEvent } from "react";
import { UploadCloud } from "lucide-react";
import Image from "next/image";

interface FileUploadProps {
  label: string;
  id?: string;
  name?: string;
  onFileSelect: (file: File | null) => void;
  currentImageUrl?: string | null; // To display the current avatar
  accept?: string; // e.g., "image/png, image/jpeg"
  error?: string | null;
}

/**
 * A styled file upload component, supporting drag & drop and preview.
 *
 * @param {FileUploadProps} props Component props.
 * @returns {JSX.Element} The file upload component.
 */
const FileUpload: React.FC<FileUploadProps> = ({
  label,
  id,
  name,
  onFileSelect,
  currentImageUrl,
  accept = "image/*",
  error,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = id || name || "file-upload";

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileSelect(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      onFileSelect(null);
      setPreviewUrl(null);
    }
  };

  const handleDrag = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (
      file &&
      (!accept ||
        accept === "*/*" ||
        accept
          .split(",")
          .map((a) => a.trim())
          .includes(file.type))
    ) {
      onFileSelect(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
      // Update the input element's files (optional but good practice)
      if (inputRef.current) {
        inputRef.current.files = e.dataTransfer.files;
      }
    } else {
      console.warn("File type not accepted or no file dropped.");
      onFileSelect(null);
      setPreviewUrl(null);
      if (inputRef.current) {
        inputRef.current.value = ""; // Clear input if drop fails
      }
    }
  };

  const triggerFileInput = () => {
    inputRef.current?.click();
  };

  const displayUrl = previewUrl || currentImageUrl;

  return (
    <div className="w-full">
      <span className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </span>
      <div className="flex items-center gap-4">
        {/* Avatar Preview */}
        {displayUrl ? (
          <div className="relative w-16 h-16 shrink-0 rounded-full overflow-hidden border border-gray-200">
            <Image
              src={displayUrl}
              alt="Avatar Preview"
              fill
              className="object-cover"
            />
          </div>
        ) : (
          <div className="w-16 h-16 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-400">
            {/* Placeholder Icon or Initials */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-8 w-8"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          </div>
        )}
        {/* Upload Area */}
        <div
          className={`flex-grow border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-gray-400 ${dragActive
              ? "border-indigo-500 bg-indigo-50"
              : error
                ? "border-red-500"
                : "border-gray-300"
            }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={triggerFileInput}
        >
          <input
            ref={inputRef}
            type="file"
            id={inputId}
            name={name}
            className="hidden"
            onChange={handleFileChange}
            accept={accept}
          />
          <div className="flex flex-col items-center justify-center">
            <UploadCloud
              size={24}
              className={`mb-2 ${dragActive ? "text-indigo-600" : "text-gray-400"
                }`}
            />
            <p className="text-sm text-gray-600">
              <span className="font-semibold text-indigo-600">
                Click to upload
              </span>{" "}
              or drag and drop
            </p>
            <p className="text-xs text-gray-500 mt-1">
              SVG, PNG, JPG (max 100mb)
            </p>{" "}
            {/* TODO: Update text per requirements */}
          </div>
        </div>
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
};

export default FileUpload;
