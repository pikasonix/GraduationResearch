import React from "react";

export const DesktopLoginsSignups: React.FC = () => {
    return (
        <div className="flex items-center space-x-4">
            <a href="/login" className="text-sm font-medium text-gray-700 hover:text-gray-900">
                Đăng nhập
            </a>
            <a
                href="/signup"
                className="inline-block px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm font-semibold"
            >
                Đăng ký
            </a>
        </div>
    );
};

export default DesktopLoginsSignups;
