This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, set up your environment variables:

1. Create a `.env.local` file in the root directory
2. Copy the contents from `.env.local.example`
3. Replace the placeholder values with your actual Supabase credentials

Then, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

### Route Details Module

Đã tách phần xem chi tiết route khỏi trang `/map` thành các trang riêng:

- `src/app/route-details/page.tsx`: Trang index hiển thị danh sách các route (đọc từ localStorage: `allRoutes`, `currentInstance`) và panel chi tiết route được chọn.
- `src/app/route-details/[routeId]/page.tsx`: Trang động hiển thị 1 route cụ thể. Có thể mở bằng cách click "Mở tab" trong trang index hoặc từ sidebar bên map.
- Component dùng chung: `src/components/route-details/RouteDetailsView.tsx` (render UI + bản đồ + thông tin route).
- Hook nạp dữ liệu: `src/components/route-details/useRouteDetailsData.ts` (hỗ trợ đọc `?data=` base64 JSON hoặc localStorage).

Luồng chuyển hướng từ trang map:
1. Người dùng chọn một route ở sidebar map.
2. Logic lưu `selectedRoute`, `currentInstance`, và toàn bộ danh sách vào localStorage.
3. Mở tab mới `/route-details/{id}` để xem chi tiết.

Tùy chọn truyền dữ liệu qua URL:
- Encode object `{route, instance, routes}` thành base64 rồi gắn vào `?data=<base64>`.

Mở rộng trong tương lai:
- Thêm API fetch route theo id nếu không muốn phụ thuộc localStorage.
- Bổ sung timeline nâng cao (đã có prototype trong phiên bản cũ) vào `RouteDetailsView`.
- Thêm breadcrumbs + SEO metadata động.
## Supabase Integration

This project uses [Supabase](https://supabase.com) as its backend database and authentication service. The integration includes:

- Type-safe database access
- Data services for projects and blog posts
- Server-side data fetching for optimal performance

To use this integration:

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Set up the following tables in your Supabase database:
   - `projects`
   - `founders`
   - `blog_posts`
   - `authors`
3. Copy your Supabase URL and anon key from your project settings to your `.env.local` file

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
