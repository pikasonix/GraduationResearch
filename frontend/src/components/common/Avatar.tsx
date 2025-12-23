import React from "react";
import Image from "next/image";
import { getUserInitials } from "@/lib/utils/avatar";

interface AvatarProps {
  src?: string | null;
  name?: string | null;
  size?: number;
  className?: string;
}

/**
 * Avatar component that displays image or initials fallback
 */
export const Avatar: React.FC<AvatarProps> = ({ 
  src, 
  name, 
  size = 36, 
  className = "" 
}) => {
  const initials = getUserInitials(name);
  
  if (src) {
    return (
      <div 
        className={`relative overflow-hidden rounded-full ${className}`}
        style={{ width: size, height: size }}
      >
        <Image
          src={src}
          alt={name || "Avatar"}
          fill
          className="object-cover"
        />
      </div>
    );
  }
  
  // Fallback to initials
  return (
    <div
      className={`flex items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white font-semibold ${className}`}
      style={{ 
        width: size, 
        height: size,
        fontSize: size * 0.4 
      }}
    >
      {initials}
    </div>
  );
};
