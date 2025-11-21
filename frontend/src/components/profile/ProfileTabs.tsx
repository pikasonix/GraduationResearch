import React, { useEffect, useMemo, useState } from "react";
import ProjectHeaderSection from "@/components/profile/ProjectHeaderSection";
import DetailProfileSection, {
  type CustomerDetail,
  type SupplierDetail,
  type TechDetail,
} from "@/components/profile/DetailProfileSection";
import CarInfoSection from "@/components/profile/CarInfoSection";
import PaymentMethodsSection from "@/components/profile/PaymentMethodsSection";
import MyReviewsSection from "@/components/profile/MyReviewsSection";
import PayoutSettingsSection from "@/components/profile/PayoutSettingsSection";
import StationManagementSection from "@/components/profile/StationManagementSection";
import DriverManagementSection from "@/components/profile/DriverManagementSection";
import HistorySection from "@/components/profile/HistorySection";
import AnalyticsSection from "@/components/profile/AnalyticsSection";
import type { UserRole } from "@/components/profile/types";

// Define specific types for props
interface ContactInfo {
  location: string | null;
  website: string | null;
  portfolio: string | null;
  email: string | null;
}

interface FundingInfo {
  investment: string | null;
  currency: string | null;
  cofounders: string[];
  partners: string[];
}

interface ProfileTabsProps {
  role: UserRole;
  project: {
    title: string;
    tags: string[];
    description: string;
    contactInfo: ContactInfo;
    fundingInfo: FundingInfo;
  };
  detailInfo?: {
    customer?: CustomerDetail;
    supplier?: SupplierDetail;
    tech?: TechDetail;
  };
  onEditProject: () => void;
  onEditContact: () => void;
  onEditAbout: () => void;
  onEditFunding: () => void;
}

/**
 * Manages the vertical tabs and displays the corresponding content section.
 *
 * @param {ProfileTabsProps} props Component props.
 * @returns {JSX.Element} The profile tabs component.
 */
const ProfileTabs: React.FC<ProfileTabsProps> = ({
  role,
  project,
  detailInfo,
  onEditProject,
  onEditContact,
  onEditAbout,
  onEditFunding,
}) => {
  const tabConfigs = useMemo(() => {
    const baseTabs = [
      {
        id: "project",
        name: "Thông tin dự án",
        content: (
          <div className="space-y-6">
            <div className="bg-white p-6 sm:p-8 rounded-lg border border-gray-200">
              <ProjectHeaderSection
                projectTitle={project.title}
                projectTags={project.tags}
                onEditProject={onEditProject}
              />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <InfoCard
                title="Thông tin liên hệ"
                actionLabel="Chỉnh sửa"
                onAction={onEditContact}
                items={[
                  { label: "Địa điểm", value: project.contactInfo.location ?? "Chưa cập nhật" },
                  { label: "Website", value: project.contactInfo.website ?? "Chưa cập nhật" },
                  { label: "Portfolio", value: project.contactInfo.portfolio ?? "Chưa cập nhật" },
                  { label: "Email", value: project.contactInfo.email ?? "Chưa cập nhật" },
                ]}
              />
              <InfoCard
                title="Thông tin gọi vốn"
                actionLabel="Chỉnh sửa"
                onAction={onEditFunding}
                items={[
                  { label: "Khoản đầu tư", value: project.fundingInfo.investment ?? "Chưa cập nhật" },
                  { label: "Loại tiền tệ", value: project.fundingInfo.currency ?? "Chưa cập nhật" },
                  {
                    label: "Đồng sáng lập",
                    value:
                      project.fundingInfo.cofounders?.length
                        ? project.fundingInfo.cofounders.join(", ")
                        : "Chưa cập nhật",
                  },
                  {
                    label: "Đối tác",
                    value:
                      project.fundingInfo.partners?.length
                        ? project.fundingInfo.partners.join(", ")
                        : "Chưa cập nhật",
                  },
                ]}
              />
            </div>
            <InfoDescriptionCard
              title="Mô tả dự án"
              description={project.description}
              actionLabel="Chỉnh sửa"
              onAction={onEditAbout}
            />
          </div>
        ),
      },
      {
        id: "account",
        name: "Hồ sơ tài khoản",
        content: (
          <div className="space-y-8">
            <DetailProfileSection
              role={role}
              customerInfo={detailInfo?.customer}
              supplierInfo={detailInfo?.supplier}
              techInfo={detailInfo?.tech}
            />
          </div>
        ),
      },
    ];

    if (role === "CUSTOMER") {
      baseTabs.push({
        id: "customer-services",
        name: "Phương tiện & Thanh toán",
        content: (
          <div className="space-y-8">
            <CarInfoSection />
            <PaymentMethodsSection />
            <MyReviewsSection />
          </div>
        ),
      });
    }

    if (role === "SUPPLIER") {
      baseTabs.push({
        id: "supplier-operations",
        name: "Quản lý trạm",
        content: (
          <div className="space-y-8">
            <StationManagementSection />
            <PayoutSettingsSection role={role} />
            <AnalyticsSection role={role} />
          </div>
        ),
      });
    }

    if (role === "TECH") {
      baseTabs.push({
        id: "tech-operations",
        name: "Quản lý đội cứu hộ",
        content: (
          <div className="space-y-8">
            <DriverManagementSection />
            <PayoutSettingsSection role={role} />
            <AnalyticsSection role={role} />
          </div>
        ),
      });
    }

    baseTabs.push({
      id: "history",
      name: "Lịch sử hoạt động",
      content: (
        <div className="space-y-8">
          <HistorySection role={role} />
        </div>
      ),
    });

    return baseTabs;
  }, [detailInfo?.customer, detailInfo?.supplier, detailInfo?.tech, onEditAbout, onEditContact, onEditFunding, onEditProject, project.contactInfo, project.description, project.fundingInfo, project.tags, project.title, role]);

  const [activeTabId, setActiveTabId] = useState<string>(tabConfigs[0]?.id ?? "project");

  useEffect(() => {
    if (!tabConfigs.find((tab) => tab.id === activeTabId)) {
      setActiveTabId(tabConfigs[0]?.id ?? "project");
    }
  }, [activeTabId, tabConfigs]);

  const activeTab = tabConfigs.find((tab) => tab.id === activeTabId) ?? tabConfigs[0];

  return (
    <div className="flex flex-col lg:flex-row gap-8 lg:gap-16 mt-8">
      {/* Vertical Tabs Navigation */}
      <div className="w-full lg:w-1/5 flex-shrink-0">
        <nav className="flex lg:flex-col gap-2 lg:gap-1 lg:mb-0">
          {tabConfigs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className={`flex-1 text-center group flex items-center justify-center lg:justify-start px-3 py-2 text-sm font-medium rounded-md ${activeTabId === tab.id
                ? "bg-gray-100 text-gray-900"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              aria-current={activeTabId === tab.id ? "page" : undefined}
            >
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content Area */}
      <div className="w-full lg:w-4/5">
        {activeTab?.content ?? <div>Không có nội dung.</div>}
      </div>
    </div>
  );
};

interface InfoCardItem {
  label: string;
  value: string | number;
}

interface InfoCardProps {
  title: string;
  items: InfoCardItem[];
  actionLabel?: string;
  onAction?: () => void;
}

const InfoCard: React.FC<InfoCardProps> = ({ title, items, actionLabel, onAction }) => (
  <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4 shadow-sm">
    <div className="flex items-start justify-between gap-3">
      <div>
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        <p className="text-xs text-gray-500 mt-1">Thông tin hiển thị theo dữ liệu hồ sơ hiện tại.</p>
      </div>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          {actionLabel}
        </button>
      )}
    </div>
    <dl className="space-y-3">
      {items.map((item) => (
        <div key={item.label} className="flex flex-col">
          <dt className="text-xs uppercase tracking-wide text-gray-500">{item.label}</dt>
          <dd className="text-sm text-gray-800">
            {typeof item.value === "string" && item.value.trim() === ""
              ? "Chưa cập nhật"
              : item.value}
          </dd>
        </div>
      ))}
    </dl>
  </div>
);

interface InfoDescriptionCardProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

const InfoDescriptionCard: React.FC<InfoDescriptionCardProps> = ({
  title,
  description,
  actionLabel,
  onAction,
}) => (
  <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm space-y-2">
    <div className="flex items-start justify-between gap-3">
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          {actionLabel}
        </button>
      )}
    </div>
    <p className="text-sm leading-relaxed text-gray-700">
      {description?.trim() ? description : "Chưa có mô tả cho dự án này."}
    </p>
  </div>
);

export default ProfileTabs;
