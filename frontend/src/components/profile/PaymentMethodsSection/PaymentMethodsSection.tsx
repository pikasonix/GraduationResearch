'use client';

import React, { useState } from "react";
import { CreditCard, Trash2 } from "lucide-react";
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

export type PaymentMethodType = "credit-card" | "e-wallet";

export interface PaymentMethod {
    id: string;
    type: PaymentMethodType;
    provider: string;
    last4: string;
    isDefault: boolean;
}

interface PaymentMethodsSectionProps {
    methods?: PaymentMethod[];
    onChange?: (methods: PaymentMethod[]) => void;
}

const defaultMethods: PaymentMethod[] = [
    {
        id: "pm_01",
        type: "credit-card",
        provider: "Vietcombank Visa",
        last4: "6452",
        isDefault: true,
    },
    {
        id: "pm_02",
        type: "e-wallet",
        provider: "Momo",
        last4: "***",
        isDefault: false,
    },
];

const emptyForm = {
    type: "credit-card" as PaymentMethodType,
    provider: "",
    last4: "",
};

const PaymentMethodsSection: React.FC<PaymentMethodsSectionProps> = ({
    methods,
    onChange,
}) => {
    const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(
        methods ?? defaultMethods
    );
    const [formValues, setFormValues] = useState(emptyForm);

    const setDefaultMethod = (id: string) => {
        const updated = paymentMethods.map((method) => ({
            ...method,
            isDefault: method.id === id,
        }));
        setPaymentMethods(updated);
        onChange?.(updated);
    };

    const removeMethod = (id: string) => {
        const updated = paymentMethods.filter((method) => method.id !== id);
        setPaymentMethods(updated);
        onChange?.(updated);
    };

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!formValues.provider.trim()) {
            return;
        }

        const newMethod: PaymentMethod = {
            id: `pm_${Date.now()}`,
            type: formValues.type,
            provider: formValues.provider.trim(),
            last4: formValues.type === "credit-card" ? formValues.last4.slice(-4) : "***",
            isDefault: paymentMethods.length === 0,
        };

        const updated = [...paymentMethods, newMethod];
        setPaymentMethods(updated);
        onChange?.(updated);
        setFormValues(emptyForm);
    };

    const formDescriptor =
        formValues.type === "credit-card"
            ? "Nhập tên ngân hàng/chi nhánh và 4 số cuối. Ví dụ: Techcombank Titanium"
            : "Nhập tên ví điện tử hoặc ứng dụng thanh toán. Ví dụ: Momo, ZaloPay";

    return (
        <section className="space-y-6" aria-labelledby="payment-methods-section">
            <div className="flex flex-col gap-3">
                <h2 id="payment-methods-section" className="text-xl font-semibold text-gray-900">
                    Phương thức thanh toán
                </h2>
                <p className="text-sm text-gray-600 max-w-2xl">
                    Quản lý thẻ tín dụng và ví điện tử phục vụ cho việc trả phí sạc. Bạn có thể thiết lập phương thức mặc định và xoá khi không còn sử dụng.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_2fr] gap-6">
                <form
                    className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 space-y-4"
                    onSubmit={handleSubmit}
                >
                    <header className="flex items-start justify-between">
                        <div>
                            <h3 className="text-base font-semibold text-gray-900">Liên kết phương thức mới</h3>
                            <p className="text-xs text-gray-500">
                                Điền thông tin để thêm thẻ tín dụng hoặc ví điện tử.
                            </p>
                        </div>
                    </header>

                    <div className="space-y-4">
                        <Field label="Loại phương thức" htmlFor="payment-type">
                            <Select
                                value={formValues.type}
                                onValueChange={(value: PaymentMethodType) =>
                                    setFormValues((prev) => ({ ...prev, type: value }))
                                }
                            >
                                <SelectTrigger id="payment-type">
                                    <SelectValue placeholder="Chọn loại phương thức" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="credit-card">Thẻ tín dụng/ghi nợ</SelectItem>
                                    <SelectItem value="e-wallet">Ví điện tử</SelectItem>
                                </SelectContent>
                            </Select>
                        </Field>

                        <Field label="Tên phương thức" htmlFor="payment-provider">
                            <Input
                                id="payment-provider"
                                placeholder={
                                    formValues.type === "credit-card"
                                        ? "VD: Vietcombank Visa"
                                        : "VD: Momo"
                                }
                                value={formValues.provider}
                                onChange={(event) =>
                                    setFormValues((prev) => ({ ...prev, provider: event.target.value }))
                                }
                                required
                            />
                        </Field>

                        {formValues.type === "credit-card" && (
                            <Field label="4 số cuối" htmlFor="payment-last4">
                                <Input
                                    id="payment-last4"
                                    placeholder="VD: 6452"
                                    value={formValues.last4}
                                    maxLength={4}
                                    onChange={(event) =>
                                        setFormValues((prev) => ({ ...prev, last4: event.target.value.replace(/\D/g, "") }))
                                    }
                                    required
                                />
                            </Field>
                        )}

                        <p className="text-xs text-gray-500">{formDescriptor}</p>
                    </div>
                    <Button type="submit">Liên kết phương thức</Button>
                </form>

                <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                        <div>
                            <h3 className="text-base font-semibold text-gray-900">Phương thức đã liên kết</h3>
                            <p className="text-xs text-gray-500">
                                {paymentMethods.length} phương thức khả dụng
                            </p>
                        </div>
                    </div>
                    {paymentMethods.length === 0 ? (
                        <div className="px-6 py-10 text-sm text-gray-500 text-center">
                            Chưa có phương thức nào. Thêm mới bằng biểu mẫu bên trái.
                        </div>
                    ) : (
                        <ul className="divide-y divide-gray-100">
                            {paymentMethods.map((method) => (
                                <li key={method.id} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                    <div className="flex items-start gap-3">
                                        <div className="mt-0.5">
                                            <CreditCard className="size-5 text-blue-600" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-gray-900">
                                                {method.provider}
                                                {method.isDefault && (
                                                    <span className="ml-2 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                                                        Mặc định
                                                    </span>
                                                )}
                                            </p>
                                            <p className="text-xs text-gray-500 mt-1">
                                                {method.type === "credit-card" ? `Thẻ •••• ${method.last4}` : "Ví điện tử"}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setDefaultMethod(method.id)}
                                            disabled={method.isDefault}
                                        >
                                            Đặt mặc định
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="destructive"
                                            size="sm"
                                            onClick={() => removeMethod(method.id)}
                                        >
                                            <Trash2 className="size-4" />
                                        </Button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
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

export default PaymentMethodsSection;
