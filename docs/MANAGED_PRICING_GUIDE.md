# Shopify Managed App Pricing: Hướng Dẫn & Nghiên Cứu Chi Tiết

Tài liệu này tổng hợp đầy đủ kiến thức về **Shopify Managed App Pricing**, từ khái niệm cơ bản, so sánh với Billing API, quy trình cấu hình step-by-step, cho đến các kỹ thuật nâng cao như tạo giao diện chọn gói (Monthly/Yearly radio buttons).

---

## 1. Managed Pricing là gì?

**Managed App Pricing** là tính năng cho phép bạn khai báo các gói giá (plans) của ứng dụng trực tiếp trong Partner Dashboard. Shopify sẽ thay bạn xử lý toàn bộ logic tính phí phức tạp.

### Shopify sẽ tự động xử lý:
*   **Hosting trang chọn gói (Plan Selection Page):** Giao diện chuẩn trong Shopify Admin.
*   **Recurring Charges:** Tự động charge phí định kỳ (Tháng/Năm).
*   **Free Trial:** Quản lý thời gian dùng thử.
*   **Proration:** Tự động tính toán tiền chênh lệch khi user nâng/hạ gói giữa kỳ.
*   **Price Updates:** Cập nhật giá cho các subscriber cũ/mới.
*   **Giao diện chuyển đổi:** Nút Radio button cho gói Tháng/Năm (nếu cấu hình đúng).

### Lợi ích chính:
Bạn **không** cần phải tự xây dựng UX chọn gói hay gọi Billing API (`appSubscriptionCreate`, `appPurchaseOneTimeCreate`) cho các luồng cơ bản.

---

## 2. Khi nào nên dùng Managed Pricing?

### ✅ Nên dùng khi:
*   App có cấu trúc giá đơn giản: Free, Monthly, Annual.
*   Muốn giảm thiểu code backend và frontend liên quan đến thanh toán.
*   Muốn tận dụng giao diện chuẩn của Shopify (độ tin cậy cao với Merchant).
*   Cần tính năng **Radio Buttons** (chuyển đổi nhanh giữa giá tháng/năm) trên trang thanh toán.

### ❌ Cân nhắc dùng Billing API (Manual) khi:
*   Mô hình giá quá phức tạp (Usage-based phức tạp, custom one-time purchases).
*   Cần logic giảm giá (discounts) tùy biến cao mà Managed Pricing chưa hỗ trợ.
*   Bạn cần tích hợp sâu data thanh toán vào hệ thống phân tích riêng ngay lập tức (dù Managed Pricing vẫn có API để pull data).

### Bảng so sánh nhanh

| Tính Năng | Billing API (Manual) | Managed App Pricing |
| :--- | :--- | :--- |
| **Giao diện chọn gói** | Bạn tự code (Frontend của bạn) | Shopify host (Giao diện Admin) |
| **UX Monthly/Yearly** | Khó làm Radio buttons chuẩn | ✅ Hỗ trợ Native (Radio buttons) |
| **Logic chuyển gói** | Tự code (hủy gói cũ, tạo gói mới) | ✅ Shopify tự xử lý (Proration) |
| **Độ linh hoạt** | Rất cao | Theo khuôn mẫu của Shopify |
| **Triển khai** | Tốn nhiều công sức dev | Nhanh chóng, cấu hình là chính |

---

## 3. Quy Trình Cài Đặt & Cấu Hình Step-by-Step

### Bước 1: Tạo App Public (Nếu chưa có)
1.  Vào **Partner Dashboard** > **Apps** > **Create app**.
2.  Chọn **Public app** (Managed pricing thường mặc định cho public app mới).
3.  Điền thông tin cơ bản: Tên, App URL, Redirect URLs.

### Bước 2: Kích hoạt Managed Pricing
1.  Vào **Apps** > [Tên App Của Bạn] > **Distribution**.
2.  Tại phần **Shopify App Store listing**, chọn **Manage listing**.
3.  Tại phần **Pricing content**, bấm **Manage** để vào trang Pricing Index.
4.  Bấm **Settings** (hoặc tab Settings).
5.  Chọn **Managed pricing** > **Save**.
    *   *Lưu ý:* Nếu app cũ đang dùng Billing API, bạn có thể cần xóa các cấu hình cũ không tương thích trước khi switch.

### Bước 3: Tạo Public Plans (Cơ Bản & Nâng Cao)

Bạn có thể tạo tối đa 4 public plans. Dưới đây là 2 cách cấu hình phổ biến:

#### Cách A: Các gói riêng biệt (Ví dụ: Basic, Pro, Enterprise)
1.  Tại trang **Pricing**, bấm **Add**.
2.  Chọn **Plan type**: Free, Monthly ($9.99), hoặc Annual ($99).
3.  Điền tên gói (VD: "Pro Plan"), mô tả, features.

#### Cách B: Tạo Gói có Radio Buttons (Tháng/Năm) - ⭐️ RECOMMENDED
Để hiển thị giao diện chọn nhanh (Radio buttons) giữa giá Tháng và Năm cho cùng một cấp độ dịch vụ (Tier):

1.  Tạo **MỘT Plan duy nhất** (Ví dụ tên: "Starter").
2.  Trong plan đó, thêm **Pricing Plan** lần thứ nhất:
    *   Interval: **Every 30 days**
    *   Price: **$10.00**
3.  Vẫn trong plan đó, thêm **Pricing Plan** lần tiếp theo (Add another price):
    *   Interval: **Every year**
    *   Price: **$84.00**
4.  Lưu lại.
    *   **Kết quả:** Trên trang chọn gói, Merchant sẽ thấy gói "Starter" với tùy chọn: 🔘 $10/month hoặc ⚪️ $84/year.

---

## 4. Tích Hợp Vào Code Ứng Dụng (Development)

Với Managed Pricing, bạn không gọi API tạo charge. Nhiệm vụ của bạn chỉ là **dẫn hướng (Redirect)** merchant đến trang chọn gói của Shopify.

### Code Logic Flow:
1.  **Kiểm tra Plan hiện tại:**
    Dùng Admin API (REST/GraphQL) để xem `Shop` hoặc `AppSubscription` hiện tại của merchant để biết họ đang dùng gói nào (Free hay Paid).
    *   *Gợi ý UX:* Hiển thị banner "You are on Free Plan" nếu chưa trả phí.

2.  **Redirect tới Plan Selection Page:**
    Khi user bấm nút "Upgrade" hoặc "Manage Plan":
    *   Bạn **không** render trang thanh toán checkout.
    *   Bạn dùng **App Bridge** để redirect tới URL chuẩn của Shopify Managed Pricing Plan Selection.

    **Cách lấy URL:**
    *   Trong Dashboard, sau khi tạo plan, Shopify sẽ cung cấp URL dạng:
        `https://admin.shopify.com/store/{shop}/charges/{app_id}/pricing_plans`
    *   Hoặc đơn giản là dùng App Bridge Redirect tới đường dẫn tương đối trong admin nếu có dynamic variable.

### Ví dụ mô phỏng React & App Bridge:
```javascript
import { Redirect } from '@shopify/app-bridge/actions';
import { useAppBridge } from '@shopify/app-bridge-react';

function UpgradeButton() {
  const app = useAppBridge();

  const handleUpgrade = () => {
    // Redirect toi trang chon goi cua Shopify
    // URL nay thuong co dinh cho App cua ban hoac duoc cung cap trong docs
    const redirect = Redirect.create(app);
    // Redirect ra khoi iframe cua app, toi trang admin pricing
    redirect.dispatch(Redirect.Action.ADMIN_PATH, {
      path: '/charges/your-app-id/pricing_plans', // Check docs for exact pattern
    });
  };

  return <button onClick={handleUpgrade}>Upgrade to Pro</button>;
}
```

---

## Tài Liệu Tham Khảo (Official Docs)
*   **[Managed App Pricing Overview](https://shopify.dev/docs/apps/launch/billing/managed-pricing)**
*   **[About billing for your app](https://shopify.dev/docs/apps/billing)**
