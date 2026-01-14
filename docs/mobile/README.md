# Mobile (Android) Documentation

Tài liệu này mô tả thiết kế chuẩn cho app Android của WAYO theo **MVVM + XML (Activity/Fragment)**, ưu tiên khả năng **dễ theo dõi, kiểm thử, mở rộng**, và tích hợp đầy đủ **Supabase** + **Backend API**.

## Mục tiêu

- Chuẩn hóa kiến trúc: Presentation / Domain / Data.
- Không dùng Jetpack Compose.
- Hỗ trợ Online/Offline + đồng bộ nền.
- Định nghĩa API contract rõ ràng để FE mobile gọi được từ Supabase/Backend.
- Có chiến lược kiểm thử: unit (ViewModel/UseCase/Room) + instrumentation (UI).

## Tài liệu chính

- [Kiến trúc MVVM (XML)](./architecture-mvvm-xml.md)
- [Luồng màn hình & thiết kế UI](./screens.md)
- [Offline/Online & đồng bộ WorkManager](./offline-sync.md)
- [API contracts (Supabase + Backend)](./api-contracts.md)
- [Rules & quality gates (không Compose)](./rules-and-quality-gates.md)
- [Testing strategy](./testing.md)
- [Testing strategy](./testing.md)
- [Implementation roadmap](./implementation-roadmap.md)

## Nguyên tắc vàng (tóm tắt)

- UI bắt buộc dùng **XML + Fragment/Activity**.
- State/UI cập nhật qua **LiveData/Flow** trong ViewModel (không logic mạng trong UI).
- Data đi qua **UseCase** (Domain) → **Repository** (Data).
- Offline-first: dữ liệu hiển thị từ Room, đồng bộ khi có mạng.
- Tất cả tích hợp ngoài (Supabase/Backend/Map) phải có interface + testable.
