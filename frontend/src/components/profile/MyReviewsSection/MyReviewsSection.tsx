'use client';

import React from "react";
import { Star } from "lucide-react";

export interface ReviewItem {
    id: string;
    title: string;
    comment: string;
    rating: number;
    createdAt: string;
    location?: string;
}

interface MyReviewsSectionProps {
    reviews?: ReviewItem[];
}

const defaultReviews: ReviewItem[] = [
    {
        id: "review_01",
        title: "WAYO Station Nguyễn Trãi",
        comment: "Trạm sạch sẽ, nhân viên hỗ trợ nhiệt tình. Tốc độ sạc nhanh đúng như quảng cáo.",
        rating: 5,
        createdAt: "2025-09-20T09:30:00+07:00",
        location: "Quận 5, TP.HCM",
    },
    {
        id: "review_02",
        title: "WAYO Station Phú Mỹ Hưng",
        comment: "Không gian rộng nhưng cuối tuần hơi đông. Hy vọng mở thêm nhiều cổng sạc nhanh.",
        rating: 4,
        createdAt: "2025-09-15T18:45:00+07:00",
        location: "Quận 7, TP.HCM",
    },
    {
        id: "review_03",
        title: "Dịch vụ cứu hộ WAYO",
        comment: "Đội kỹ thuật tới rất nhanh, hỗ trợ tận tình. Chi phí minh bạch.",
        rating: 5,
        createdAt: "2025-08-30T22:10:00+07:00",
        location: "Biên Hòa, Đồng Nai",
    },
];

const MyReviewsSection: React.FC<MyReviewsSectionProps> = ({ reviews }) => {
    const reviewList = reviews && reviews.length > 0 ? reviews : defaultReviews;

    return (
        <section className="space-y-6" aria-labelledby="my-reviews-section">
            <div className="flex flex-col gap-3">
                <h2 id="my-reviews-section" className="text-xl font-semibold text-gray-900">
                    Đánh giá của tôi
                </h2>
                <p className="text-sm text-gray-600 max-w-3xl">
                    Xem lại các bình luận và điểm số bạn đã gửi cho trạm sạc hoặc dịch vụ cứu hộ. Đây là giao diện demo hiển thị dữ liệu mẫu.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {reviewList.map((review) => (
                    <article
                        key={review.id}
                        className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 flex flex-col gap-3"
                    >
                        <header className="flex items-center justify-between">
                            <h3 className="text-base font-semibold text-gray-900">{review.title}</h3>
                            <Rating rating={review.rating} />
                        </header>
                        <p className="text-sm text-gray-600 leading-relaxed">{review.comment}</p>
                        <footer className="text-xs text-gray-500 flex items-center justify-between">
                            <span>{formatVietnameseDate(review.createdAt)}</span>
                            {review.location && <span>{review.location}</span>}
                        </footer>
                    </article>
                ))}
            </div>
        </section>
    );
};

const Rating: React.FC<{ rating: number }> = ({ rating }) => (
    <div className="flex items-center gap-1">
        {Array.from({ length: 5 }).map((_, index) => (
            <Star
                key={index}
                className={`size-4 ${index < rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
            />
        ))}
        <span className="text-sm font-medium text-gray-800">{rating.toFixed(1)}</span>
    </div>
);

const formatVietnameseDate = (isoString: string) => {
    const formatter = new Intl.DateTimeFormat("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
    return formatter.format(new Date(isoString));
};

export default MyReviewsSection;
