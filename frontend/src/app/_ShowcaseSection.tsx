import Link from "next/link";

export default function ShowcaseSection() {
    return (
        <section className="bg-[#F8F7FA]">
            <div className="max-w-6xl mx-auto px-6 py-20">
                {/* Hero */}
                <div className="grid md:grid-cols-2 gap-10 items-center">
                    <div>
                        <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 leading-tight">
                            Giải pháp tối ưu hoá PDPTW —
                            <span className="text-indigo-600"> Pickup & Delivery with Time Windows</span>
                        </h1>
                        <p className="mt-6 text-gray-700 text-lg">
                            Hệ thống lập lịch tuyến và phân phối hàng hóa tối ưu, cân bằng chi phí, thời gian và
                            ràng buộc cửa sổ thời gian. Dùng thuật toán kết hợp heuristic và tối ưu hoá để đưa ra
                            kế hoạch thực tế và có thể triển khai cho đội xe của bạn.
                        </p>

                        <div className="mt-8 flex flex-wrap gap-4">
                            <Link
                                href="/projects"
                                className="inline-block bg-indigo-600 text-white px-6 py-3 rounded-md font-medium hover:bg-indigo-700"
                            >
                                Dùng thử miễn phí
                            </Link>
                            <a
                                href="#how-it-works"
                                className="inline-block border border-gray-300 text-gray-900 px-6 py-3 rounded-md hover:bg-gray-50"
                            >
                                Cách hoạt động
                            </a>
                        </div>
                    </div>

                    <div className="rounded-lg bg-white shadow-lg p-6">
                        <div className="grid grid-cols-2 gap-4">
                            <StatCard label="Giảm chi phí" value="~15-40%" />
                            <StatCard label="Độ chính xác" value="Thực tế" />
                            <StatCard label="Công suất" value="Quy mô hàng trăm điểm" />
                            <StatCard label="Thời gian phản hồi" value="Nhỏ hơn vài phút" />
                        </div>
                        <p className="mt-4 text-sm text-gray-600">
                            Các con số trên thay đổi theo dữ liệu thực tế và cấu hình thuật toán. Hệ thống hỗ trợ
                            ràng buộc pickup/delivery, cửa sổ thời gian, tải trọng và nhiều ràng buộc doanh
                            nghiệp khác.
                        </p>
                    </div>
                </div>

                {/* Features */}
                <div className="mt-16 grid md:grid-cols-3 gap-8">
                    <FeatureCard
                        title="Tối ưu hoá tuyến"
                        desc="Tối thiểu hoá tổng chi phí/quãng đường trong khi tôn trọng cửa sổ thời gian và tải trọng."
                    />
                    <FeatureCard
                        title="Hỗ trợ ràng buộc thực tế"
                        desc="Pickup trước delivery, nhiều địa điểm, ưu tiên khách hàng, và năng lực phương tiện."
                    />
                    <FeatureCard
                        title="Triển khai dễ dàng"
                        desc="API REST và giao diện quản trị giúp bạn tích hợp vào luồng vận hành hiện có."
                    />
                </div>

                {/* How it works */}
                <div id="how-it-works" className="mt-20">
                    <h2 className="text-2xl font-semibold text-gray-900">Cách hoạt động</h2>
                    <ol className="mt-6 space-y-4 list-decimal list-inside text-gray-700">
                        <li>
                            Nhập dữ liệu: điểm pickup & delivery, cửa sổ thời gian, tải trọng và đội xe.
                        </li>
                        <li>Chạy thuật toán: thuật toán kết hợp heuristic + metaheuristic để tìm lời giải tốt.</li>
                        <li>
                            Tối ưu & kiểm tra: mô phỏng lịch trình, hiển thị xung đột cửa sổ thời gian và đề xuất
                            thay đổi.
                        </li>
                        <li>Xuất lịch trình sẵn sàng triển khai hoặc tích hợp qua API.</li>
                    </ol>
                </div>

                {/* CTA banner */}
                <div className="mt-16 bg-indigo-50 rounded-lg p-6 flex flex-col md:flex-row items-center justify-between">
                    <div>
                        <h3 className="text-xl font-semibold text-gray-900">Bắt đầu tối ưu hoá đội xe của bạn</h3>
                        <p className="mt-2 text-gray-700">Tải dữ liệu mẫu hoặc kết nối hệ thống của bạn để thử nghiệm ngay.</p>
                    </div>
                    <div className="mt-4 md:mt-0">
                        <Link
                            href="/projects"
                            className="inline-block bg-indigo-600 text-white px-5 py-2 rounded-md font-medium hover:bg-indigo-700"
                        >
                            Tạo bài toán mới
                        </Link>
                    </div>
                </div>
            </div>
        </section>
    );
}

function FeatureCard({ title, desc }: { title: string; desc: string }) {
    return (
        <div className="bg-white rounded-lg shadow-md p-5">
            <h4 className="font-semibold text-gray-900">{title}</h4>
            <p className="mt-2 text-gray-600 text-sm">{desc}</p>
        </div>
    );
}

function StatCard({ label, value }: { label: string; value: string }) {
    return (
        <div className="p-4 bg-gray-50 rounded">
            <div className="text-xs text-gray-500">{label}</div>
            <div className="mt-1 text-xl font-bold text-gray-900">{value}</div>
        </div>
    );
}

