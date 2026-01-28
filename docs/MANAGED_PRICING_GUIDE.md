# Hướng Dẫn Shopify Managed App Pricing

Hướng dẫn chi tiết cách triển khai Managed App Pricing của Shopify với radio buttons chọn gói Tháng/Năm trên trang xác nhận thanh toán của Shopify.

## 🎯 Kết Quả Đạt Được

Sau khi hoàn thành hướng dẫn này, merchants sẽ thấy:
- **Radio buttons**: trên trang xác nhận của Shopify
- **Gói Tháng**: $10.00 mỗi 30 ngày
- **Gói Năm**: $84.00 mỗi năm (Tiết kiệm $36)

Đây là **giao diện giống** với các app như Yousify!

### So Sánh Billing API và Managed App Pricing

| Tính Năng | Billing API | Managed App Pricing |
| --------- | ----------- | ------------------- |
| Giao diện chọn gói | Trong app của bạn | Trên trang Shopify |
| Radio buttons | ❌ Không thể | ✅ Có sẵn |
| Free trials | Tự code | ✅ Tự động |
| Thay đổi gói | Phải viết code | ✅ Shopify xử lý |
| Độ linh hoạt | Cao | Hạn chế |

### Khi Nào Nên Dùng Managed Pricing

✅ **Nên dùng khi:**
- Muốn radio buttons trên trang Shopify
- Pricing đơn giản (Tháng/Năm)
- Muốn Shopify tự xử lý thay đổi gói

❌ **Nên dùng Billing API khi:**
- Cần logic pricing phức tạp
- Tính phí theo usage
- Cần mã giảm giá tùy chỉnh

## Yêu Cầu Trước Khi Bắt Đầu

- [ ] Tài khoản Shopify Partner
- [ ] App đã tạo trong Partner Dashboard
- [ ] Development store để test
- [ ] App đã cài đặt trong development store

## Giai Đoạn 1: Cấu Hình Partner Dashboard

### Bước 1: Truy Cập Pricing Settings

1. Vào [Shopify Partners](https://partners.shopify.com)
2. Điều hướng đến: **Apps** → **App của bạn** → **Distribution**
3. Click **"Manage submission"**

### Bước 2: Bật Managed Pricing

1. Vào **Settings** (icon bánh răng)
2. Tìm **"Pricing method"**
3. Chọn **"Managed pricing"**
4. Click **Save**

> ⚠️ **Cảnh báo**: Sau khi bật, bạn không thể dùng Billing API để tạo charges nữa!

### Bước 3: Tạo Plan (QUAN TRỌNG NHẤT!)

Đây là **bước quyết định** để có radio buttons!

1. Quay lại **Pricing** section
2. Click **"Add"** cạnh Public plans
3. Cấu hình plan:

```text
Tên plan: STARTER
Display name: Starter

Giá Tháng:
- Price: $10.00
- Interval: Every 30 days

Giá Năm:
- Price: $84.00
- Interval: Every year
```

> 🔑 **QUAN TRỌNG**: Bạn phải thêm **CẢ HAI giá Tháng VÀ Năm** vào **CÙNG MỘT plan** để có radio buttons!

### Bước 4: Xác Nhận Cấu Hình

Sau khi lưu, Pricing page sẽ hiển thị:

```text
starter
$10/month or $84/year
```

Nếu bạn thấy **"$10/month or $84/year"** - cấu hình đã đúng! ✅

## Điểm Chính Cần Nhớ

1. **Một plan, hai intervals** - Tạo một plan duy nhất với cả giá Tháng và Năm
2. **Chỉ dùng Managed Pricing** - Không thể dùng Billing API sau khi opt in
3. **Radio buttons tự động** - Shopify xử lý giao diện
4. **Redirect đơn giản** - Chỉ cần redirect đến trang chọn gói của Shopify

### Tài Liệu Chính Thức Shopify

- **[Managed Pricing Overview](https://shopify.dev/docs/apps/billing/purchase-adjustments/managed-pricing)** - Hướng dẫn chính về Managed App Pricing
- **[Configuring App Pricing](https://shopify.dev/docs/apps/distribution/billing/pricing)** - Cách cấu hình pricing trong Partner Dashboard
- **[App Billing and Subscriptions](https://shopify.dev/docs/apps/billing)** - Tài liệu billing đầy đủ
- **[Subscription Webhooks](https://shopify.dev/docs/apps/webhooks/configuration/mandatory-webhooks#app-subscription-webhooks)** - Xử lý subscription events
- **[GraphQL Billing API Reference](https://shopify.dev/docs/api/admin-graphql/current/mutations/appSubscriptionCreate)** - API reference (cho Billing API)
