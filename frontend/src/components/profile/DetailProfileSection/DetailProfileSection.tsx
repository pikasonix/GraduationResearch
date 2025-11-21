'use client';

import React, { useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import TagInput from "@/components/common/TagInput";
import { UserRole, roleLabels } from "../types";

const STATUS_RESET_TIMEOUT = 2400;

type CustomerDetail = {
    fullName: string;
    phone: string;
    password: string;
};

type SupplierDetail = {
    legalEntity: string;
    address: string;
    representative: string;
    verified: boolean;
};

type TechDetail = {
    garageName: string;
    address: string;
    hotline: string;
    serviceTypes: string[];
};

interface DetailProfileSectionProps {
    role: UserRole;
    customerInfo?: CustomerDetail;
    supplierInfo?: SupplierDetail;
    techInfo?: TechDetail;
    onCustomerSave?: (values: CustomerDetail) => void;
    onSupplierSave?: (values: SupplierDetail) => void;
    onTechSave?: (values: TechDetail) => void;
}

const defaultCustomerInfo: CustomerDetail = {
    fullName: "Nguyễn Văn A",
    phone: "0901 234 567",
    password: "********",
};

const defaultSupplierInfo: SupplierDetail = {
    legalEntity: "Công ty CP Năng lượng Xanh Việt",
    address: "123 Đường Hai Bà Trưng, Quận 1, TP.HCM",
    representative: "Trần Thị B",
    verified: true,
};

const defaultTechInfo: TechDetail = {
    garageName: "Garage EV Rescue",
    address: "45A Lý Thường Kiệt, Quận Tân Bình, TP.HCM",
    hotline: "1900 636 999",
    serviceTypes: ["Cứu hộ tại chỗ", "Vận chuyển xe", "Sạc nhanh lưu động"],
};

const DetailProfileSection: React.FC<DetailProfileSectionProps> = ({
    role,
    customerInfo,
    supplierInfo,
    techInfo,
    onCustomerSave,
    onSupplierSave,
    onTechSave,
}) => {
    const content = useMemo(() => {
        switch (role) {
            case "CUSTOMER":
                return (
                    <CustomerDetailForm
                        defaultValues={customerInfo ?? defaultCustomerInfo}
                        onSubmit={onCustomerSave}
                    />
                );
            case "SUPPLIER":
                return (
                    <SupplierDetailForm
                        defaultValues={supplierInfo ?? defaultSupplierInfo}
                        onSubmit={onSupplierSave}
                    />
                );
            case "TECH":
                return (
                    <TechDetailForm
                        defaultValues={techInfo ?? defaultTechInfo}
                        onSubmit={onTechSave}
                    />
                );
            default:
                return null;
        }
    }, [role, customerInfo, supplierInfo, techInfo, onCustomerSave, onSupplierSave, onTechSave]);

    return (
        <section className="space-y-6" aria-labelledby="detail-profile-section">
            <div className="flex flex-col gap-3">
                <h2 id="detail-profile-section" className="text-xl font-semibold text-gray-900">
                    Thông tin chi tiết tài khoản – {roleLabels[role]}
                </h2>
                <p className="text-sm text-gray-600">
                    Giao diện demo cho phép nhập và lưu các thông tin cơ bản. Dữ liệu được lưu tạm thời trên trình duyệt nhằm mô phỏng trải nghiệm chỉnh sửa.
                </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 sm:p-8">
                {content}
            </div>
        </section>
    );
};

interface FormWithStatusProps<T> {
    defaultValues: T;
    onSubmit?: (values: T) => void;
}

const CustomerDetailForm: React.FC<FormWithStatusProps<CustomerDetail>> = ({
    defaultValues,
    onSubmit,
}) => {
    const [formValues, setFormValues] = useState(defaultValues);
    const [isSaved, setIsSaved] = useState(false);

    const handleChange = (field: keyof CustomerDetail) => (
        event: React.ChangeEvent<HTMLInputElement>
    ) => {
        setFormValues((prev) => ({ ...prev, [field]: event.target.value }));
    };

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        onSubmit?.(formValues);
        setIsSaved(true);
        const timeout = setTimeout(() => setIsSaved(false), STATUS_RESET_TIMEOUT);
        return () => clearTimeout(timeout);
    };

    return (
        <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Họ và tên" htmlFor="customer-fullname">
                    <Input
                        id="customer-fullname"
                        value={formValues.fullName}
                        onChange={handleChange("fullName")}
                        placeholder="Nhập họ và tên"
                        required
                    />
                </Field>
                <Field label="Số điện thoại" htmlFor="customer-phone">
                    <Input
                        id="customer-phone"
                        value={formValues.phone}
                        onChange={handleChange("phone")}
                        placeholder="VD: 0901 234 567"
                        required
                    />
                </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Mật khẩu" htmlFor="customer-password">
                    <Input
                        id="customer-password"
                        type="password"
                        value={formValues.password}
                        onChange={handleChange("password")}
                        placeholder="********"
                        required
                    />
                </Field>
                <Field label="Xác nhận mật khẩu" htmlFor="customer-password-confirm">
                    <Input
                        id="customer-password-confirm"
                        type="password"
                        placeholder="Nhập lại mật khẩu"
                        value={formValues.password}
                        readOnly
                    />
                </Field>
            </div>
            <FormActions isSaved={isSaved} />
        </form>
    );
};

const SupplierDetailForm: React.FC<FormWithStatusProps<SupplierDetail>> = ({
    defaultValues,
    onSubmit,
}) => {
    const [formValues, setFormValues] = useState(defaultValues);
    const [isSaved, setIsSaved] = useState(false);

    const handleChange = (field: keyof SupplierDetail) => (
        event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
        setFormValues((prev) => ({ ...prev, [field]: event.target.value }));
    };

    const toggleVerification = () => {
        setFormValues((prev) => ({ ...prev, verified: !prev.verified }));
    };

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        onSubmit?.(formValues);
        setIsSaved(true);
        const timeout = setTimeout(() => setIsSaved(false), STATUS_RESET_TIMEOUT);
        return () => clearTimeout(timeout);
    };

    return (
        <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Tên pháp nhân" htmlFor="supplier-legal-entity">
                    <Input
                        id="supplier-legal-entity"
                        value={formValues.legalEntity}
                        onChange={handleChange("legalEntity")}
                        placeholder="VD: Công ty TNHH ..."
                        required
                    />
                </Field>
                <Field label="Người đại diện" htmlFor="supplier-representative">
                    <Input
                        id="supplier-representative"
                        value={formValues.representative}
                        onChange={handleChange("representative")}
                        placeholder="Họ tên người đại diện"
                        required
                    />
                </Field>
            </div>
            <Field label="Địa chỉ pháp lý" htmlFor="supplier-address">
                <textarea
                    id="supplier-address"
                    value={formValues.address}
                    onChange={handleChange("address")}
                    placeholder="Nhập địa chỉ trụ sở"
                    className="w-full min-h-[96px] border border-gray-300 rounded-md px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    required
                />
            </Field>
            <div className="flex items-center justify-between border border-gray-200 rounded-lg px-4 py-3 bg-gray-50">
                <div className="flex items-center gap-3">
                    <CheckCircle2
                        className={`size-5 ${formValues.verified ? "text-emerald-500" : "text-gray-300"}`}
                    />
                    <div>
                        <p className="text-sm font-medium text-gray-800">Trạng thái xác thực</p>
                        <p className="text-xs text-gray-500">
                            {formValues.verified
                                ? "Giấy tờ đã được xác thực bởi hệ thống."
                                : "Chưa xác thực - vui lòng gửi lại hồ sơ."}
                        </p>
                    </div>
                </div>
                <Button
                    type="button"
                    variant={formValues.verified ? "outline" : "default"}
                    onClick={toggleVerification}
                >
                    {formValues.verified ? "Hủy xác thực" : "Đánh dấu đã xác thực"}
                </Button>
            </div>
            <FormActions isSaved={isSaved} />
        </form>
    );
};

const TechDetailForm: React.FC<FormWithStatusProps<TechDetail>> = ({
    defaultValues,
    onSubmit,
}) => {
    const [formValues, setFormValues] = useState(defaultValues);
    const [isSaved, setIsSaved] = useState(false);

    const handleChange = (
        field: keyof Omit<TechDetail, "serviceTypes">
    ) => (event: React.ChangeEvent<HTMLInputElement>) => {
        setFormValues((prev) => ({ ...prev, [field]: event.target.value }));
    };

    const handleServicesChange = (services: string[]) => {
        setFormValues((prev) => ({ ...prev, serviceTypes: services }));
    };

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        onSubmit?.(formValues);
        setIsSaved(true);
        const timeout = setTimeout(() => setIsSaved(false), STATUS_RESET_TIMEOUT);
        return () => clearTimeout(timeout);
    };

    return (
        <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Tên gara" htmlFor="tech-garage-name">
                    <Input
                        id="tech-garage-name"
                        value={formValues.garageName}
                        onChange={handleChange("garageName")}
                        placeholder="VD: Garage EV Rescue"
                        required
                    />
                </Field>
                <Field label="Hotline" htmlFor="tech-hotline">
                    <Input
                        id="tech-hotline"
                        value={formValues.hotline}
                        onChange={handleChange("hotline")}
                        placeholder="VD: 1900 636 999"
                        required
                    />
                </Field>
            </div>
            <Field label="Địa chỉ gara" htmlFor="tech-address">
                <Input
                    id="tech-address"
                    value={formValues.address}
                    onChange={handleChange("address")}
                    placeholder="Địa chỉ hoạt động chính"
                    required
                />
            </Field>
            <TagInput
                label="Các loại hình dịch vụ"
                tags={formValues.serviceTypes}
                onTagsChange={handleServicesChange}
                placeholder="Nhập và nhấn Enter để thêm dịch vụ"
                hintText="Ví dụ: cứu hộ pin, kéo xe, bảo dưỡng pin..."
            />
            <FormActions isSaved={isSaved} />
        </form>
    );
};

interface FieldProps {
    label: string;
    htmlFor: string;
    children: React.ReactNode;
}

const Field: React.FC<FieldProps> = ({ label, htmlFor, children }) => (
    <div className="flex flex-col gap-2">
        <Label htmlFor={htmlFor} className="text-sm font-medium text-gray-700">
            {label}
        </Label>
        {children}
    </div>
);

interface FormActionsProps {
    isSaved: boolean;
}

const FormActions: React.FC<FormActionsProps> = ({ isSaved }) => (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-100">
        <p className="text-xs text-gray-500">
            Thay đổi sẽ được lưu vào hồ sơ của bạn sau khi bấm &ldquo;Lưu cập nhật&rdquo;.
        </p>
        <div className="flex items-center gap-3">
            {isSaved && (
                <span className="text-sm text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="size-4" /> Đã lưu bản nháp
                </span>
            )}
            <Button type="submit">Lưu cập nhật</Button>
        </div>
    </div>
);

export type { CustomerDetail, SupplierDetail, TechDetail };
export default DetailProfileSection;
