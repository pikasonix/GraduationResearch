import React from "react";
import Image from "next/image";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { CalendarIcon, MapPinIcon } from "lucide-react";
import { useOptionLabels } from "@/lib/hooks/useOptionLabels";
import { type ProjectWithFounder } from "@/lib/redux/services/profileApi";

/**
 * Strips HTML tags and returns plain text content
 */
const stripHtml = (html: string): string => {
  return html.replace(/<[^>]*>/g, "");
};

/**
 * Truncates text to specified character limit
 */
const truncateText = (text: string, maxLength = 100): string => {
  if (!text || text.length <= maxLength) return text;

  // Find a good cutting point at a space
  const textToTruncate = text.substring(0, maxLength);
  const lastSpace = textToTruncate.lastIndexOf(" ");

  if (lastSpace > maxLength * 0.8) {
    return textToTruncate.substring(0, lastSpace) + "...";
  }

  return textToTruncate + "...";
};

/**
 * Component for rendering an individual project card
 */
export default function ProjectCard({
  project,
}: {
  project: ProjectWithFounder;
}) {
  const toArray = (
    value: string[] | string | null | undefined
  ): string[] =>
    Array.isArray(value) ? value : value ? [value] : [];

  const title = project.title ?? "Untitled Project";
  const description = project.description ?? "No description available.";
  const tagsArray = toArray(project.tags);
  // const date = project.start_date ?? new Date().toLocaleDateString();
  const date = project.created_at
    ? new Date(project.created_at).toLocaleDateString("vi-VN")
    : new Date().toLocaleDateString("vi-VN");
  const location = project.location ?? "Unknown Location";
  const investment = project.investment ?? "N/A";
  const currency = project.currency ?? "USD";
  const coFounders = toArray(project.cofounders);
  const partners = toArray(project.partners);
  const projectTypeArray = toArray(project.profiles?.type);
  const projectType = projectTypeArray[0] ?? "CUSTOMER";

  const founderName = project.profiles?.name ?? "Unknown Founder";
  const founderRolesArray = toArray(project.profiles?.role);
  const founderRole = founderRolesArray[0] ?? "Founder";
  const founderAvatar = project.profiles?.avatar_url;

  // Extract and truncate text content from HTML description
  const plainTextDescription = stripHtml(description);
  const truncatedDescription = truncateText(plainTextDescription);

  const { getLabels, getLabel } = useOptionLabels();

  const tagLabels = getLabels("projectCategory", tagsArray, "N/A");
  const coFounderRoleLabelsString = getLabels("cofounder", coFounders, "N/A");
  const partnerRoleLabelsString = getLabels("partner", partners, "N/A");
  const founderRoleLabel = getLabel("profileRole", founderRole, founderRole);

  // Determine the key for profileType options based on project.type
  const profileTypeKey = projectType;
  const profileTypeChipLabel = getLabel(
    "profileType",
    profileTypeKey,
    projectType
  );

  const MAX_COFOUNDER_ROLE_LENGTH = 20;

  return (
    <div
      className={`border border-gray-200 rounded-2xl py-[12px] px-[24px] flex flex-col h-full bg-white`}
    >
      <div className="flex flex-wrap items-center justify-between sm:flex-row sm:justify-between sm:items-center mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-300 rounded-full overflow-hidden">
            {founderAvatar ? (
              <Image
                src={founderAvatar}
                alt={founderName}
                width={48}
                height={48}
                className="object-cover w-full h-full"
              />
            ) : null}
          </div>
          <div>
            <p className="text-sm sm:text-base font-semibold text-gray-900">{founderName}</p>
            <p className="text-xs sm:text-sm text-gray-600">{founderRoleLabel}</p>
          </div>
        </div>
        <span
          className={`${projectType === "CUSTOMER"
            ? "text-xs sm:text-sm bg-blue-50 text-blue-800 border-blue-200"
            : "text-xs sm:text-sm bg-green-50 text-green-800 border-green-200"
            } px-4 py-2 rounded-full text-sm border font-medium`}
        >
          {profileTypeChipLabel}
        </span>
      </div>
      <hr className="border-gray-200 mb-4" />

      <h3 className="font-bold text-base sm:text-xl mb-3 text-gray-900">{title}</h3>

      <div className="flex gap-3 mb-4">
        {tagLabels.split(", ").map((tag, index) => (
          <span
            key={index}
            className="border border-gray-400 rounded-full px-3 py-1 text-xs sm:text-sm text-gray-900"
          >
            {tag}
          </span>
        ))}
      </div>

      <div className="flex gap-4 text-gray-600 mb-4">
        <div className="flex items-center gap-2 text-sm sm:text-base">
          <CalendarIcon className="w-4 h-4" />
          <span>{date}</span>
        </div>
        <div className="flex items-center gap-2 text-sm sm:text-base">
          <MapPinIcon className="w-4 h-4" />
          <span>{location}</span>
        </div>
      </div>

      {/* Render plain text description without HTML */}
      <div className="text-gray-600 mb-6 prose prose-sm max-w-none flex-1 text-sm sm:text-base">
        {truncatedDescription}
      </div>

      <hr className="border-gray-200 mb-4" />

      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mt-auto gap-6 sm:gap-4">
        <div className="grid grid-cols-2 sm:flex gap-x-4 sm:gap-12">
          {/* Đồng sáng lập section */}
          <div className="sm:order-2">
            <p className="font-semibold text-sm mb-1 text-[#0D92F4]">
              Đồng sáng lập
            </p>
            <div className={coFounders.length > 1 ? "flex flex-col gap-1" : "flex gap-3 flex-wrap"}>
              {coFounders.length > 0 ? (
                coFounderRoleLabelsString.split(", ").map((role, index) => (
                  <span
                    key={index}
                    className="font-bold text-sm text-[#0049AC]"
                  >
                    {truncateText(role, MAX_COFOUNDER_ROLE_LENGTH)}
                  </span>
                ))
              ) : (
                <span className="font-bold text-gray-400">N/A</span>
              )}
            </div>
          </div>
          {/* Đối tác section */}
          <div className="sm:order-3">
            <p className="font-semibold text-sm mb-1 text-[#0D92F4]">
              Đối tác
            </p>
            <div className={partners.length > 1 ? "flex flex-col gap-1" : "flex gap-3 flex-wrap"}>
              {partners.length > 0 ? (
                partnerRoleLabelsString.split(", ").map((role, index) => (
                  <span
                    key={index}
                    className="font-bold text-sm text-[#0049AC]"
                  >
                    {truncateText(role, MAX_COFOUNDER_ROLE_LENGTH)}
                  </span>
                ))
              ) : (
                <span className="font-bold text-gray-400">N/A</span>
              )}
            </div>
          </div>
          {/* Vốn huy động */}
          <div className="mt-4 sm:mt-0 sm:order-1">
            <p className="font-semibold text-sm mb-1 text-[#0D92F4]">
              Vốn huy động
            </p>
            <p className="font-bold text-xl text-[#0049AC]">
              {formatCurrency(investment, currency) ?? (
                <span className="text-gray-400">N/A</span>
              )}
            </p>
          </div>
        </div>
        {/* Wrap button in Link */}
        <Link href={`/projects/${project.id}`} passHref>
          <button className="w-full sm:w-auto bg-blue-500 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-600 transition-colors">
            Chi tiết
          </button>
        </Link>
      </div>
    </div>
  );
}
