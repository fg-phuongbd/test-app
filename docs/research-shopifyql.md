# Research: ShopifyQL — Tổng quan & Yêu cầu tích hợp

**Ngày:** 17/04/2026  
**Mục đích:** Đánh giá khả năng sử dụng ShopifyQL trong Shopify App để xây dựng trang Analytics.

---

## 1. ShopifyQL là gì?

> Tài liệu tham khảo: [About ShopifyQL](https://shopify.dev/docs/api/shopifyql)

ShopifyQL là **ngôn ngữ truy vấn chuyên cho thương mại** (commerce-focused query language), được thiết kế để:

- Phân tích dữ liệu bán hàng (analytics)
- Xây báo cáo tùy biến
- Tạo phân khúc khách hàng (segment)
- Trích xuất dữ liệu cho phân tích nâng cao

### So sánh với SQL thông thường

| Đặc điểm | SQL | ShopifyQL |
|---|---|---|
| Cú pháp JOIN | Phải tự viết | Ẩn đi, tự động |
| Đối tượng truy vấn | Table vật lý | Table logic cho commerce |
| Time-series | Cần tự xử lý | Có sẵn (`TIMESERIES month`) |
| So sánh kỳ | Phải tự viết | Có sẵn (`this_month vs last_month`) |
| Multi-store | Không có | Có (`FROM ORGANIZATION sales`) |
| Visualization | Không có | Có (chỉ định chart trong query) |

### Các table chính

| Table | Mô tả |
|---|---|
| `sales` | Doanh thu / đơn hàng ở mức tổng hợp |
| `orders` | Chi tiết đơn hàng |
| `products` | Sản phẩm |
| `customers` | Khách hàng |
| `sessions` | Phiên truy cập |

---

## 2. Các nơi có thể dùng ShopifyQL

> Tài liệu tham khảo: [Where you can use ShopifyQL](https://shopify.dev/docs/api/shopifyql#where-you-can-use-shopifyql)

### 2.1. Trong Shopify Admin (merchant dùng trực tiếp)

> Tài liệu: [ShopifyQL in the Shopify admin](https://shopify.dev/docs/api/shopifyql/shopifyql-admin)

Merchant vào **Analytics → Reports / Explorations**, mở code editor ShopifyQL với:
- Syntax highlighting
- Gợi ý schema
- Validation query
- Preview bảng / biểu đồ

> Đây là dành cho merchant/analyst, **không liên quan trực tiếp đến app**.

### 2.2. Qua GraphQL Admin API — `shopifyqlQuery` ✅ (dùng cho app)

> Tài liệu: [ShopifyQL with the GraphQL Admin API](https://shopify.dev/docs/api/shopifyql/graphql-admin-api)  
> Reference: [`shopifyqlQuery`](https://shopify.dev/docs/api/admin-graphql/latest/queries/shopifyqlQuery)

Cách app sử dụng:

```graphql
query {
  shopifyqlQuery(query: "FROM sales SHOW total_sales SINCE last_month") {
    tableData {
      columns { name dataType displayName }
      rows
    }
    parseErrors
  }
}
```

Nhận về:
- `tableData.columns` — danh sách cột (tên, kiểu dữ liệu, tên hiển thị)
- `tableData.rows` — mảng các hàng dữ liệu
- `parseErrors` — lỗi cú pháp nếu có

### 2.3. Qua Python SDK & CLI

> Tài liệu: [ShopifyQL Python SDK and CLI](https://shopify.dev/docs/api/shopifyql/python-sdk)

Dùng cho use case phân tích dữ liệu ngoài app (data science, BI). Nguyên tắc quyền truy cập tương tự.

---

## 3. Yêu cầu để sử dụng ShopifyQL trong app

### 3.1. Loại app & API

- App phải là **Admin app** (public hoặc custom), có OAuth đúng chuẩn, sử dụng Admin access token
- Endpoint: `/admin/api/2026-04/graphql.json` (hoặc version mới nhất)

### 3.2. Scopes bắt buộc

| Scope | Bắt buộc? | Ghi chú |
|---|---|---|
| `read_reports` | ✅ Bắt buộc | Luôn cần cho `shopifyqlQuery` |
| `read_customers` | Tùy query | Nếu query bảng `customers` |
| `read_customer_email` | Tùy query | Nếu query cột email |
| `read_customer_name` | Tùy query | Nếu query cột tên |
| `read_customer_phone` | Tùy query | Nếu query cột phone |
| `read_customer_address` | Tùy query | Nếu query cột address |

> ⚠️ **Scope là điều kiện cần nhưng chưa đủ.**

### 3.3. Protected Customer Data — Level 2 (điều kiện bắt buộc)

Từ tài liệu chính thức của `shopifyqlQuery`:

> *"Requires `read_reports` access scope. Also: **Level 2 access to Customer data** including name, address, phone, and email fields."*

**Điểm quan trọng:**

- Dù query `FROM sales SHOW total_sales` — **không đụng đến customers** — vẫn yêu cầu Level 2
- `shopifyqlQuery` được Shopify xem là endpoint **có khả năng truy cập dữ liệu khách hàng**, nên toàn bộ field này bị chặn nếu chưa có Level 2
- Không có "chế độ nhẹ" — không thể bypass bằng code hay scopes

**Kết quả thực tế khi thiếu Level 2:**

```json
{
  "errors": [{
    "message": "Access denied for shopifyqlQuery field. Required access: `read_reports` access scope. Also: Level 2 access to Customer data...",
    "extensions": { "code": "ACCESS_DENIED" }
  }]
}
```

### 3.4. Cách xin Level 2 access

> Tài liệu chi tiết: [Protected customer data requirements](https://shopify.dev/docs/apps/launch/protected-customer-data)

**Quy trình (Public app):**

1. Vào **Partner Dashboard** → chọn app → **API access**
2. Tìm mục **Protected customer data access** → **Request access**
3. Chọn **Level 2** — Customer name, address, phone number, email
4. Điền thông tin:
   - Mục đích sử dụng dữ liệu
   - Cách lưu trữ & bảo mật
   - Thời gian giữ dữ liệu
   - Quy trình xóa dữ liệu theo yêu cầu
5. Cung cấp Privacy Policy rõ ràng
6. Submit → Shopify review và cấp quyền

**Quy trình (Custom app / Development store):**

- Vẫn phải tuân thủ nguyên tắc protected data
- Quy trình nhẹ hơn so với public app
- Ràng buộc kỹ thuật **y hệt** — không đủ Level 2 → vẫn `ACCESS_DENIED`

---

## 4. Kết luận

| Câu hỏi | Trả lời |
|---|---|
| ShopifyQL có dùng được qua API không? | ✅ Có, qua `shopifyqlQuery` |
| Chỉ cần `read_reports` là đủ không? | ❌ Không — cần thêm Level 2 |
| Có thể bypass Level 2 bằng code không? | ❌ Không |
| Level 2 có áp dụng cho mọi query ShopifyQL không? | ✅ Có, kể cả query không liên quan customer |
| Giải pháp thay thế nếu không muốn xin Level 2? | Dùng Admin GraphQL `orders` query + JS aggregation |
