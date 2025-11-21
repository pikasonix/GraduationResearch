import React from "react";

const Footer: React.FC = () => {
    return (
        <footer className="w-full border-t border-gray-200 mt-12 py-8">
            <div className="container mx-auto px-4 text-center text-sm text-gray-600">
                © {new Date().getFullYear()} WAYO. All rights reserved.
            </div>
        </footer>
    );
};

export default Footer;

