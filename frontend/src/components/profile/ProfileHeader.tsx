import React from "react";
import { Button } from "@/components/ui/button";
import Image from "next/image";

interface ProfileHeaderProps {
  user: {
    name: string;
    avatarUrl: string | null;
    isVerified: boolean;
    typeBadges: string[]; // Specifically for type badges
    roleDisplayText: string; // For displaying roles as text
  };
  onEdit: () => void; // Callback for edit button click
}

/**
 * Displays the header section of the user profile.
 *
 * @param {ProfileHeaderProps} props The component props.
 * @returns {JSX.Element} The profile header component.
 */
const ProfileHeader: React.FC<ProfileHeaderProps> = ({ user, onEdit }) => {
  return (
    <header className="flex flex-col sm:flex-row items-center gap-6 sm:pr-8">
      <div className="relative w-24 h-24 sm:w-28 sm:h-28 flex-shrink-0">
        <Image
          src={user.avatarUrl || "/avatar/default-avatar.jpg"}
          alt={`${user.name}'s avatar`}
          fill
          className="rounded-full object-cover border-2 border-white shadow-md"
        />
        {user.isVerified && (
          <div className="absolute bottom-1 right-1 bg-white rounded-full p-0.5">
            <div className="w-4 h-4 bg-blue-500 rounded-full" />
          </div>
        )}
      </div>

      <div className="flex-1 text-center sm:text-left">
        <div className="flex items-center justify-center sm:justify-start gap-2">
          <h1 className="text-2xl font-bold text-gray-900">{user.name}</h1>
          {user.typeBadges.map((badge, index) => (
            <span
              key={index}
              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"
            >
              {badge}
            </span>
          ))}
        </div>
        <p className="text-md text-gray-600 mt-1">{user.roleDisplayText}</p>
      </div>

      <Button variant="outline" onClick={onEdit} className="flex-shrink-0">
        Chỉnh sửa
      </Button>
    </header>
  );
};

export default ProfileHeader;
