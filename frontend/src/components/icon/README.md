# Icon Generation Tool

Tự động tạo React icon components từ file SVG.

## Cách sử dụng

### 1. Tạo thư mục và thêm SVG files:

```
src/components/icon/
└── raw-svgs/              ← Tạo thư mục này
    ├── pin/               ← Thêm SVG vào đây
    │   ├── location.svg
    │   └── marker.svg
    ├── weather/
    │   └── sunny.svg
    └── vehicle/
        └── car.svg
```

### 2. Chạy lệnh generate:

```bash
npm run icons:generate
```

### 3. Sử dụng icons:

```tsx
import { LocationIcon, MarkerIcon, SunnyIcon } from '@/components/icon';

<LocationIcon width={32} height={32} />
```

## Tính năng

- Tự động scan tất cả file `.svg` trong `raw-svgs/`
- Generate React components với TypeScript
- Giữ nguyên gradient và styling
- Tự động cập nhật file `index.ts`
- Component name tự động từ filename (ví dụ: `home-pin.svg` → `HomePinIcon`)

## Component Props

Tất cả icon components có props:
- `width?: number` (default: 20)
- `height?: number` (default: 20)
- `className?: string`
