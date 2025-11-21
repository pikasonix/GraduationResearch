"use client";

import Image from "next/image";
import { useState } from "react";
import { BlogPost } from "@/components/BlogData";

interface BlogListProps {
  posts: BlogPost[];
}

/**
 * Client component for displaying blog posts with pagination
 */
export default function BlogList({ posts }: BlogListProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const postsPerPage = 9;
  const totalPages = Math.ceil(posts.length / postsPerPage);

  // Get current posts for the page
  const indexOfLastPost = currentPage * postsPerPage;
  const indexOfFirstPost = indexOfLastPost - postsPerPage;
  const currentPosts = posts.slice(indexOfFirstPost, indexOfLastPost);

  // Pagination controls
  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);
  const goToFirstPage = () => setCurrentPage(1);
  const goToLastPage = () => setCurrentPage(totalPages);
  const goToPreviousPage = () =>
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  const goToNextPage = () =>
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {currentPosts.map((post) => (
          <div
            key={post.id}
            className="bg-white rounded-2xl overflow-hidden shadow-sm"
          >
            <div className="h-48 relative overflow-hidden">
              <Image
                src={post.coverImage}
                alt={post.title}
                fill
                sizes="(max-width: 768px) 100vw, 33vw"
                className="object-cover"
              />
            </div>
            <div className="p-6">
              <span className="text-purple-600 font-semibold text-sm">
                {post.category}
              </span>
              <h3 className="text-xl font-semibold mt-2 flex justify-between items-start">
                <span>{post.title}</span>
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="mt-1"
                >
                  <path
                    d="M5.83398 14.1667L14.1673 5.83334M14.1673 5.83334H5.83398M14.1673 5.83334V14.1667"
                    stroke="#101828"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </h3>
              <p className="text-gray-600 mt-2">{post.description}</p>

              <div className="flex items-center gap-3 mt-6">
                <div
                  className={`w-10 h-10 ${post.author.avatarBg} rounded-full overflow-hidden`}
                >
                  {post.author.avatar && (
                    <Image
                      src={post.author.avatar}
                      alt={post.author.name}
                      width={40}
                      height={40}
                      className="object-cover w-full h-full"
                    />
                  )}
                </div>
                <div>
                  <p className="font-semibold text-sm text-gray-900">
                    {post.author.name}
                  </p>
                  <p className="text-gray-500 text-xs">{post.date}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center mt-12">
          <div className="flex gap-2">
            <button
              onClick={goToFirstPage}
              className="w-12 h-12 border border-gray-300 rounded-lg flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors"
              disabled={currentPage === 1}
            >
              &lt;&lt;
            </button>
            <button
              onClick={goToPreviousPage}
              className="w-12 h-12 border border-gray-300 rounded-lg flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors"
              disabled={currentPage === 1}
            >
              &lt;
            </button>

            {[...Array(totalPages)].map((_, index) => (
              <button
                key={index}
                onClick={() => paginate(index + 1)}
                className={`w-12 h-12 rounded-lg flex items-center justify-center transition-colors ${
                  currentPage === index + 1
                    ? "bg-blue-500 text-white"
                    : "border border-gray-300 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {index + 1}
              </button>
            ))}

            <button
              onClick={goToNextPage}
              className="w-12 h-12 border border-gray-300 rounded-lg flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors"
              disabled={currentPage === totalPages}
            >
              &gt;
            </button>
            <button
              onClick={goToLastPage}
              className="w-12 h-12 border border-gray-300 rounded-lg flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors"
              disabled={currentPage === totalPages}
            >
              &gt;&gt;
            </button>
          </div>
        </div>
      )}
    </>
  );
}
