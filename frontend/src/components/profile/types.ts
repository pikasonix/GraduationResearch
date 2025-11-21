export type UserRole = "CUSTOMER" | "SUPPLIER" | "TECH";

export const roleLabels: Record<UserRole, string> = {
    CUSTOMER: "Khách hàng",
    SUPPLIER: "Chủ trạm",
    TECH: "Đội kỹ thuật",
};
