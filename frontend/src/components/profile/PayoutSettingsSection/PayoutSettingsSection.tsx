'use client';

import React, { useState } from "react";
import { PiggyBank } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { UserRole, roleLabels } from "../types";

type SupportedRole = Extract<UserRole, "SUPPLIER" | "TECH">;

export interface PayoutSettings {
    bankName: string;
    accountName: string;
    accountNumber: string;
    branch: string;
    swiftCode?: string;
    payoutFrequency: "daily" | "weekly" | "monthly" | "per-transaction";
    autoWithdrawal: boolean;
}

interface PayoutSettingsSectionProps {
    role: SupportedRole;
    settings?: PayoutSettings;
    onSave?: (settings: PayoutSettings) => void;
}

const defaultSupplierSettings: PayoutSettings = {
    bankName: "Vietcombank",
    accountName: "CÔNG TY CP NĂNG LƯỢNG XANH VIỆT",
    accountNumber: "0441336789",
    branch: "TP. Hồ Chí Minh",
    swiftCode: "BFTVVNVX",
    payoutFrequency: "daily",
    autoWithdrawal: true,
};

const defaultTechSettings: PayoutSettings = {
    bankName: "Techcombank",
    accountName: "GARAGE EV RESCUE",
    accountNumber: "1903377888",
    branch: "Chi nhánh Tân Bình",
    swiftCode: undefined,
    payoutFrequency: "weekly",
    autoWithdrawal: false,
};

const PayoutSettingsSection: React.FC<PayoutSettingsSectionProps> = ({
    role,
    settings,
    onSave,
}) => {
    const [formValues, setFormValues] = useState<PayoutSettings>(
        settings ?? (role === "SUPPLIER" ? defaultSupplierSettings : defaultTechSettings)
    );
    const [saving, setSaving] = useState(false);

    const handleChange = (field: keyof PayoutSettings) => (
        event: React.ChangeEvent<HTMLInputElement>
    ) => {
        const value =
            field === "autoWithdrawal" ? event.target.checked : event.target.value;
        setFormValues((prev) => ({ ...prev, [field]: value }));
    };

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setSaving(true);
        setTimeout(() => {
            onSave?.(formValues);
            setSaving(false);
        }, 600);
    };

    return (
        <section className="space-y-6" aria-labelledby="payout-settings-section">
            <div className="flex flex-col gap-3">
                <h2 id="payout-settings-section" className="text-xl font-semibold text-gray-900">
                    Cấu hình nhận tiền – {roleLabels[role]}
                </h2>
                <p className="text-sm text-gray-600 max-w-2xl">
                    Thiết lập tài khoản ngân hàng hoặc cổng thanh toán nhận tiền. Giao diện demo lưu dữ liệu tại chỗ, giúp bạn thử nghiệm quy trình cấu hình.
                </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
                <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
                    <PiggyBank className="size-6 text-blue-600" />
                    <div>
                        <h3 className="text-base font-semibold text-gray-900">Thông tin tài khoản ngân hàng</h3>
                        <p className="text-xs text-gray-500">
                            Tất cả các khoản thanh toán sẽ được chuyển vào tài khoản này tùy theo tần suất bạn chọn.
                        </p>
                    </div>
                </div>
                <form className="p-6 space-y-5" onSubmit={handleSubmit}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Tên ngân hàng" htmlFor="payout-bank-name">
                            <Input
                                id="payout-bank-name"
                                value={formValues.bankName}
                                onChange={handleChange("bankName")}
                                required
                            />
                        </Field>
                        <Field label="Chi nhánh" htmlFor="payout-branch">
                            <Input
                                id="payout-branch"
                                value={formValues.branch}
                                onChange={handleChange("branch")}
                                required
                            />
                        </Field>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Tên chủ tài khoản" htmlFor="payout-account-name">
                            <Input
                                id="payout-account-name"
                                value={formValues.accountName}
                                onChange={handleChange("accountName")}
                                required
                            />
                        </Field>
                        <Field label="Số tài khoản" htmlFor="payout-account-number">
                            <Input
                                id="payout-account-number"
                                value={formValues.accountNumber}
                                onChange={handleChange("accountNumber")}
                                inputMode="numeric"
                                required
                            />
                        </Field>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="SWIFT/BIC (tuỳ chọn)" htmlFor="payout-swift">
                            <Input
                                id="payout-swift"
                                value={formValues.swiftCode ?? ""}
                                onChange={handleChange("swiftCode")}
                                placeholder="VD: BFTVVNVX"
                            />
                        </Field>
                        <Field label="Chu kỳ chuyển tiền" htmlFor="payout-frequency">
                            <Select
                                value={formValues.payoutFrequency}
                                onValueChange={(value: PayoutSettings["payoutFrequency"]) =>
                                    setFormValues((prev) => ({ ...prev, payoutFrequency: value }))
                                }
                            >
                                <SelectTrigger id="payout-frequency">
                                    <SelectValue placeholder="Chọn chu kỳ" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="per-transaction">Ngay khi có giao dịch</SelectItem>
                                    <SelectItem value="daily">Hằng ngày</SelectItem>
                                    <SelectItem value="weekly">Hằng tuần</SelectItem>
                                    <SelectItem value="monthly">Hằng tháng</SelectItem>
                                </SelectContent>
                            </Select>
                        </Field>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border border-gray-100 rounded-lg px-4 py-3 bg-gray-50">
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={formValues.autoWithdrawal}
                                onChange={handleChange("autoWithdrawal")}
                                className="size-4"
                            />
                            <span className="text-sm font-medium text-gray-800">Tự động rút tiền</span>
                        </label>
                        <p className="text-xs text-gray-500">
                            Khi bật, hệ thống sẽ chuyển khoản theo chu kỳ mà không cần xác nhận thủ công.
                        </p>
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
                        <span className="text-xs text-gray-500">
                            Thay đổi sẽ áp dụng cho các phiên thanh toán tiếp theo.
                        </span>
                        <Button type="submit" disabled={saving}>
                            {saving ? "Đang lưu..." : "Lưu cấu hình"}
                        </Button>
                    </div>
                </form>
            </div>
        </section>
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

export default PayoutSettingsSection;
export type { PayoutSettingsSectionProps };
