"use client";

import React from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import {
  useGetProjectByIdQuery,
  useGetAllProjectsQuery,
} from "@/lib/redux/services/profileApi";
import { useOptionLabels } from "@/lib/hooks/useOptionLabels";
import { formatCurrency } from "@/lib/utils";
import TiptapEditor from "@/components/common/TiptapEditor";
import { ChevronRightIcon, HelpCircleIcon } from "lucide-react";
import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";
import Link from "next/link";
import type { ProjectWithFounder } from "@/lib/redux/services/profileApi";
import ProjectsList from "@/components/ProjectsList";

type RtkQueryError = FetchBaseQueryError & {
  data?: { message?: string } | string;
};

const LoadingSpinner: React.FC = () => (
  <div className="flex justify-center items-center min-h-screen bg-gray-50">
    <div className="h-16 w-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
  </div>
);

const ErrorDisplay: React.FC<{ message: string }> = ({ message }) => (
  <div className="text-center text-red-600 py-10 min-h-screen flex flex-col justify-center items-center bg-gray-50">
    <p className="text-3xl font-semibold">Lỗi tải dữ liệu dự án</p>
    <p className="text-xl mt-2">{message}</p>
    <p className="mt-6 text-gray-700">
      Vui lòng thử làm mới trang hoặc liên hệ bộ phận hỗ trợ nếu sự cố vẫn tiếp
      diễn.
    </p>
  </div>
);

const ProjectDetailPage: React.FC = () => {
  const params = useParams();
  const projectId = params?.projectId as string;

  const {
    data: projectData,
    error,
    isLoading,
    isFetching,
  } = useGetProjectByIdQuery(projectId, {
    skip: !projectId,
  });
  const { data: allProjectsData } = useGetAllProjectsQuery();
  const { getLabels } = useOptionLabels();

  const project = projectData as ProjectWithFounder | null;
  const founderProfile = project?.profiles;

  if (isLoading || isFetching) {
    return <LoadingSpinner />;
  }

  if (error) {
    let extractedErrorMessage = "Đã xảy ra lỗi không xác định";
    if (typeof error === "object" && error && "data" in error) {
      const errorData = (error as RtkQueryError).data;
      if (typeof errorData === "string") {
        extractedErrorMessage = errorData;
      } else if (typeof errorData === "object" && errorData?.message) {
        extractedErrorMessage = errorData.message;
      }
    } else if (error && "message" in error) {
      extractedErrorMessage = String(error.message);
    }
    return <ErrorDisplay message={extractedErrorMessage} />;
  }

  if (
    !project ||
    !founderProfile ||
    (!Array.isArray(founderProfile.role) && founderProfile.role !== null)
  ) {
    if (project && founderProfile) {
      console.error(
        "Data shape mismatch: Founder profile role is not array/null.",
        founderProfile
      );
    }
    return (
      <ErrorDisplay message="Không tìm thấy dự án hoặc thông tin người sáng lập không hợp lệ." />
    );
  }

  const {
    title,
    description,
    tags: categoryValues,
    start_date,
    end_date,
    location,
    investment,
    currency,
    cofounders: cofounderValues,
    website,
    portfolio,
    email,
  } = project;

  const toArray = (
    value: string[] | string | null | undefined
  ): string[] =>
    Array.isArray(value) ? value : value ? [value] : [];

  const founderName = founderProfile.name ?? "Chưa có thông tin";
  const founderAvatarUrl = founderProfile.avatar_url;

  const founderRolesArray = toArray(founderProfile.role);
  const founderTypesArray = toArray(founderProfile.type);

  const categoryArray = toArray(categoryValues);
  const cofounderArray = toArray(cofounderValues);
  const partnerArray = toArray(project.partners);

  const founderRolesText = founderRolesArray.length
    ? getLabels("profileRole", founderRolesArray, "Chưa có thông tin")
    : "Chưa có thông tin";

  const founderTypeLabels = founderTypesArray.length
    ? getLabels("profileType", founderTypesArray, "N/A")
    : "N/A";

  const founderTypeDisplayString = founderTypeLabels.replace(/, /g, " / ");

  const projectCategoryLabels = getLabels(
    "projectCategory",
    categoryArray,
    "Chưa có thông tin"
  ).split(", ");

  const cofounderRoleStrings =
    cofounderArray.length
      ? cofounderArray
        .map((roleString) =>
          getLabels("cofounder", [roleString], "Chưa có thông tin")
        )
        .join(", ")
      : "Chưa có thông tin";

  const partnerRoleStrings =
    partnerArray.length
      ? partnerArray
        .map((roleString) =>
          getLabels("partner", [roleString], "Chưa có thông tin")
        )
        .join(", ")
      : "Chưa có thông tin";

  // const formattedStartDate = startDate
  //   ? new Date(startDate).toLocaleDateString("vi-VN")
  //   : "Chưa có thông tin";
  // const formattedEndDate = endDate
  //   ? new Date(endDate).toLocaleDateString("vi-VN")
  //   : "Chưa có thông tin";

  const otherProjects =
    allProjectsData?.filter((p: ProjectWithFounder) => p.id !== projectId) ||
    [];

  const InfoItem: React.FC<{
    label: string;
    value?: string | null;
    isLink?: boolean;
    linkPrefix?: string;
  }> = ({ label, value, isLink, linkPrefix }) => {
    if (!value) return null;
    let displayValue: React.ReactNode = value;
    if (isLink) {
      const href =
        value.startsWith("http") || value.startsWith("mailto:")
          ? value
          : (linkPrefix || "http://") + value;
      displayValue = (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline break-all"
        >
          {value}
        </a>
      );
    }
    return (
      <div className="flex">
        <span className="text-gray-600 w-28 shrink-0">{label}:</span>
        <span className="text-gray-900 font-medium">{displayValue}</span>
      </div>
    );
  };

  const Breadcrumbs: React.FC = () => (
    <nav className="flex items-center text-sm text-gray-500 mb-8">
      <Link href="/" className="hover:text-gray-700">
        Trang chủ
      </Link>
      <ChevronRightIcon className="h-4 w-4 mx-1 text-gray-400" />
      <span className="font-medium text-blue-600 truncate max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg xl:max-w-xl">
        {title ?? "Chi tiết dự án"}
      </span>
    </nav>
  );

  return (
    <div className="min-h-screen bg-white pt-24">
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Breadcrumbs />

        <div className="bg-white rounded-xl border border-gray-200 p-6 md:p-8">
          <div className="flex flex-wrap items-center gap-4 mb-6 pb-6 border-b border-gray-200">
            {founderAvatarUrl ? (
              <Image
                src={founderAvatarUrl}
                alt={founderName}
                width={60}
                height={60}
                className="rounded-lg border border-gray-300"
              />
            ) : (
              <div className="w-15 h-15 bg-gray-200 rounded-lg flex items-center justify-center text-gray-500 text-2xl">
                {founderName.charAt(0)}
              </div>
            )}
            <div>
              <h2 className="text-base sm:text-2xl font-semibold text-gray-900">
                {founderName}
              </h2>
              <p className="text-sm sm:text-base text-gray-600 mt-1">{founderRolesText}</p>
            </div>
            <div className="flex items-center w-full justify-center md:w-auto md:ml-auto">
              <span className="bg-green-100 text-green-700 px-4 py-2 rounded-full text-sm font-medium border border-green-200 text-center">
                {founderTypeDisplayString}
              </span>
              <span title="Loại hồ sơ">
                <HelpCircleIcon className="ml-2 h-5 w-5 text-gray-400 cursor-pointer" />
              </span>
            </div>
          </div>

          <div className="mb-6">
            <h1 className="text-xl sm:text-3xl font-bold text-gray-900 mb-2">
              {title ?? "Dự án chưa có tên"}
            </h1>
            <div className="flex flex-wrap gap-2">
              {projectCategoryLabels.map(
                (label) =>
                  label !== "Chưa có thông tin" && (
                    <span
                      key={label}
                      className="bg-blue-50 text-blue-700 px-3 py-1 rounded-md text-xs font-medium border border-blue-200"
                    >
                      {label}
                    </span>
                  )
              )}
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-x-8 gap-y-4 mb-6 pb-6 border-b border-gray-200 text-sm">
            {/* <InfoItem label="Ngày đăng" value={start_date} />
            <InfoItem label="Ngày kết thúc" value={end_date} /> */}
            <InfoItem label="Địa chỉ" value={location} />
            <InfoItem label="Email" value={email} isLink linkPrefix="mailto:" />
            <InfoItem label="Website" value={website} isLink />
            <InfoItem label="Portfolio" value={portfolio} isLink />
          </div>

          {description && (
            <div className="mb-8 prose prose-sm sm:prose lg:prose-lg xl:prose-xl max-w-none text-gray-700">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                Mô tả dự án
              </h3>
              <TiptapEditor value={description} editable={false} />
            </div>
          )}

          <div className="pt-6 border-t border-gray-200">
            <div className="flex flex-col md:flex-row justify-between items-start gap-6">
              <div className="flex flex-col sm:flex-row gap-6 md:gap-10 flex-grow">
                <div className="flex-1 min-w-[150px]">
                  <p className="text-sm sm:text-lg text-blue-600">Vốn huy động</p>
                  <p className="text-xl font-semibold text-[#0049AC] mt-1">
                    {investment ? formatCurrency(investment, currency) : "Thỏa thuận"}
                  </p>
                </div>

                {cofounderValues &&
                  cofounderValues.length > 0 &&
                  cofounderRoleStrings !== "Chưa có thông tin" && (
                    <div className="flex-1 min-w-[150px]">
                      <p className="text-sm sm:text-lg text-blue-600">Đồng sáng lập</p>
                      <div className={cofounderValues.length > 1 ? "flex flex-col gap-1 mt-1" : "flex gap-3 flex-wrap mt-1"}>
                        {cofounderRoleStrings.split(", ").map((role, index) => (
                          <span key={index} className="font-semibold text-base sm:text-lg text-[#0049AC]">
                            {role}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                {project.partners &&
                  project.partners.length > 0 &&
                  partnerRoleStrings !== "Chưa có thông tin" && (
                    <div className="flex-1 min-w-[150px]">
                      <p className="text-sm sm:text-lg text-blue-600">Đối tác</p>
                      <div className={project.partners.length > 1 ? "flex flex-col gap-1 mt-1" : "flex gap-3 flex-wrap mt-1"}>
                        {partnerRoleStrings.split(", ").map((role, index) => (
                          <span key={index} className="font-semibold text-base sm:text-lg text-[#0049AC]">
                            {role}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
              </div>

              <div className="w-full md:w-auto mt-4 md:mt-0 md:ml-6 flex-shrink-0">
                <button className="w-full sm:w-auto bg-blue-500 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-600 transition-colors">
                  Liên hệ
                </button>
              </div>
            </div>
          </div>
        </div>

        {otherProjects.length > 0 && (
          <div className="mt-12">
            <h2 className="text-xl sm:text-3xl font-bold text-gray-900 mb-8">
              Các dự án khác
            </h2>
            <ProjectsList projects={otherProjects} activeFilter="all" selectedTag={null} />
          </div>
        )}
      </main>
    </div>
  );
};

export default ProjectDetailPage;
