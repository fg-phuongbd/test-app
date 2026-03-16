# [Research Result] Integration Messaging Platforms & Real-time Bi-directional Translation

> **Ngày tạo:** 2026-03-10
> **Trạng thái:** Draft
> **Tác giả:** Engineering Team

---

## Mục lục

1. [Tổng quan & Mục tiêu](#1-tổng-quan--mục-tiêu)
2. [Messaging Platform Integration](#2-messaging-platform-integration)
   - 2.1 [Bảng so sánh tổng quan](#21-bảng-so-sánh-tổng-quan)
   - 2.2 [Phân tích chi tiết từng nền tảng](#22-phân-tích-chi-tiết-từng-nền-tảng)
3. [Real-time Bi-directional Translation](#3-real-time-bi-directional-translation)
   - 3.1 [So sánh Translation Engine](#31-so-sánh-translation-engine)
   - 3.2 [Kiến trúc đề xuất](#32-kiến-trúc-đề-xuất)
   - 3.3 [Latency, Concurrency & Error Handling](#33-latency-concurrency--error-handling)
4. [Ước lượng Chi phí Sơ bộ (Cost Estimation)](#4-ước-lượng-chi-phí-sơ-bộ)
5. [Risk & Limitations](#5-risk--limitations)
6. [Đề xuất MVP & Phase 1](#6-đề-xuất-mvp--phase-1)
7. [Kết luận](#7-kết-luận)

---

## 1. Tổng quan & Mục tiêu

**Objective:** Nghiên cứu khả năng tích hợp các nền tảng messaging phổ biến (WhatsApp, LINE, Viber, KakaoTalk, WeChat) và triển khai cơ chế dịch hai chiều theo thời gian thực (real-time bi-directional translation) kèm auto language detection.

**Bối cảnh:** Hệ thống hướng đến xây dựng một nền tảng CSKH (Customer Support) đa kênh, cho phép Agent giao tiếp với khách hàng quốc tế mà không cần biết ngôn ngữ của họ. Tin nhắn từ khách hàng sẽ tự động được phát hiện ngôn ngữ, dịch sang ngôn ngữ của Agent, và ngược lại.

---

## 2. Messaging Platform Integration

### 2.1 Bảng so sánh tổng quan

| Tiêu chí | WhatsApp Business API | LINE Messaging API | Viber Business API | KakaoTalk Channel API | WeChat Official Account API |
|:---|:---|:---|:---|:---|:---|
| **API Type** | Webhook (Inbound) + REST (Outbound) | Webhook (Inbound) + REST (Outbound) | Webhook + REST | Webhook + REST | Webhook (XML/JSON) + REST |
| **Business Account** | Bắt buộc — Verify qua Meta Business Manager | Khuyên dùng Official Account (verified hoặc unverified đều dùng được) | Bắt buộc — Đăng ký qua đối tác chính thức Viber | Bắt buộc — Cần giấy phép kinh doanh (ưu tiên pháp nhân tại Hàn Quốc) | Rất khắt khe — Service Account yêu cầu audit, pháp nhân nước ngoài rất khó |
| **Rate Limit** | Tier-based: 250 → 1K → 10K → 100K msg/ngày/số điện thoại | ~1,000 – 2,000 requests/giây | ~50 – 100 requests/giây | Phụ thuộc gói đăng ký (thường 1,000 msg/giây) | Quota hàng ngày: ~10K – 100K API calls tuỳ loại account |
| **Cost Model** | Per-conversation (24h session). Giá theo quốc gia (~$0.02 – $0.08/conversation) | Miễn phí nhận. Gửi (Push) trả phí theo gói tháng (Free: 500 msg, Light: ~$55/15K msg, Standard: ~$220/45K msg) | Minimum spend + Per-message (giá phụ thuộc quốc gia) | Per-message. Rẻ tại nội địa Hàn Quốc (~$0.006/msg) | Phí xác minh hàng năm (~$99). CSKH miễn phí trong 48h window |
| **Media Support** | ✅ Image, Video, Audio, Document, Location, Sticker | ✅ Image, Video, Audio, File, Sticker, Flex Message | ✅ Image, Video, File, Sticker, Location | ✅ Image, AlimTalk Template, Link | ✅ Image, Video, Voice, News Article |
| **Bot / Automation** | 24h window rule — ngoài 24h phải dùng Template Message (cần duyệt trước) | Không bị khóa cứng window. Bot tự do gửi Push Message | Phân biệt Promotional vs Transactional. Promotional bị hạn chế | AlimTalk (Notification) yêu cầu template duyệt trước. FriendTalk linh hoạt hơn | 48h window cho CSKH. Broadcast bị giới hạn số lượng/tháng |

### 2.2 Phân tích chi tiết từng nền tảng

> Mỗi nền tảng được phân tích theo **6 tiêu chí chính** tương ứng với bảng so sánh ở mục 2.1, kèm theo đánh giá ưu/nhược điểm và thông tin kỹ thuật bổ sung.

---

#### 2.2.1 WhatsApp (WhatsApp Business API)

**📊 Tổng quan:** Nền tảng messaging lớn nhất thế giới (~2.7 tỷ MAU). Phủ sóng mạnh tại Đông Nam Á, Ấn Độ, Châu Âu, Mỹ Latin.

##### ① API Type (Webhook / Polling)

- **Giao thức:** Webhook (Inbound) + REST API (Outbound).
- **Inbound (nhận tin):** Meta gửi HTTP POST đến Webhook URL đã đăng ký mỗi khi có tin nhắn mới. Payload dạng JSON.
- **Outbound (gửi tin):** Gọi REST API `POST /v17.0/{phone_number_id}/messages` với Bearer Token.
- **Webhook registration:** Cấu hình qua Meta App Dashboard → WhatsApp → Configuration → Callback URL.
- **Signature Verification:** Meta ký webhook bằng SHA256 (`X-Hub-Signature-256` header). Server phải verify trước khi xử lý.
- **Webhook retry:** Meta tự động retry nếu không nhận `200 OK` trong 20 giây. Retry tối đa vài lần trong vài giờ, sau đó disable webhook nếu tiếp tục fail.
- **Không hỗ trợ Polling.** Bắt buộc dùng Webhook.

##### ② Yêu cầu đăng ký Business Account

- **Bắt buộc** đăng ký và xác minh qua **Meta Business Manager** (business.facebook.com).
- **Quy trình:**
  1. Tạo Meta Business Account.
  2. Tạo App trên Meta for Developers → thêm sản phẩm WhatsApp.
  3. Đăng ký số điện thoại (phải là số chưa gắn WhatsApp cá nhân).
  4. Submit Business Verification (cần giấy phép kinh doanh, hóa đơn tiện ích, hoặc domain xác minh).
- **Thời gian verify:** 1–4 tuần tùy quốc gia và tài liệu.
- **Lưu ý:** Mỗi số điện thoại chỉ gắn được **1 WhatsApp Business Account (WABA)**. Không chia sẻ số giữa nhiều business.
- **Có thể dùng BSP (Business Solution Provider)** để rút ngắn thời gian: Twilio, MessageBird, 360dialog, Gupshup…

##### ③ Rate Limit

- Áp dụng **Tier system** dựa trên chất lượng gửi tin:

| Tier | Giới hạn gửi | Điều kiện lên tier |
|:---|:---|:---|
| **Unverified** | 250 conversations / 24h | Mới tạo, chưa verify |
| **Tier 1** | 1,000 conversations / 24h | Verify business xong |
| **Tier 2** | 10,000 conversations / 24h | Gửi 2x limit Tier 1 trong 7 ngày, chất lượng tốt |
| **Tier 3** | 100,000 conversations / 24h | Gửi 2x limit Tier 2 trong 7 ngày |
| **Unlimited** | Không giới hạn | Đạt Tier 3 + chất lượng ổn định |
- **API rate limit:** ~80 messages/giây (Cloud API). On-Premise API có thể cao hơn.
- **Quality Rating:** Nếu bị đánh giá chất lượng thấp (nhiều user report spam/block) → tự động hạ tier.

##### ④ Cost Model

- **Tính phí per-conversation** (không phải per-message). Mỗi conversation = 1 phiên 24 giờ.
- **Phân loại conversation:**

| Loại | Mô tả | Giá ước lượng |
|:---|:---|:---|
| **User-initiated (Service)** | User nhắn trước, business reply trong 24h | ~$0.005 – $0.03 |
| **Business-initiated (Utility)** | Business gửi Template (xác nhận đơn hàng, OTP…) | ~$0.02 – $0.05 |
| **Business-initiated (Marketing)** | Business gửi Template quảng cáo | ~$0.04 – $0.08 |
| **Business-initiated (Authentication)** | OTP, xác thực | ~$0.02 – $0.04 |
- **Giá thay đổi theo quốc gia** (VN rẻ hơn US/EU rất nhiều).
- **1,000 Service conversations miễn phí / tháng** (free tier).
- **Sandbox:** Hoàn toàn miễn phí cho dev/test (sử dụng số test của Meta, tối đa 5 số nhận).

##### ⑤ Support Media Message

- **Hỗ trợ đầy đủ:**

| Loại | Định dạng hỗ trợ | Giới hạn kích thước |
|:---|:---|:---|
| Image | JPEG, PNG | 5 MB |
| Video | MP4, 3GPP | 16 MB |
| Audio | AAC, MP4, AMR, OGG | 16 MB |
| Document | PDF, DOC, DOCX, XLS, PPT… | 100 MB |
| Sticker | WebP (static & animated) | 100 KB (static), 500 KB (animated) |
| Location | Latitude/Longitude | – |
| Contact | vCard format | – |
- **Interactive Messages:** Hỗ trợ Reply Buttons (tối đa 3 nút), List Messages (tối đa 10 items), Quick Replies.
- **Không hỗ trợ:** GIF trực tiếp (phải convert sang MP4).

##### ⑥ Hạn chế về Automation / Bot

- **Quy tắc 24-hour Conversation Window:**
  - Khi user gửi tin nhắn → mở 1 conversation window 24 giờ.
  - Trong 24h: Business có thể gửi **free-form message** bất kỳ (text, media, interactive).
  - Sau 24h: **CHỈ được gửi Template Message** đã được Meta duyệt trước.
- **Template Message:**
  - Phải submit và chờ duyệt (1–3 ngày). Nội dung phải có placeholder rõ ràng.
  - Không được chứa nội dung spam, quá nhiều quảng cáo, hoặc vi phạm policy.
  - Template bị từ chối phải sửa và submit lại.
- **Automation / Chatbot:** Được phép trong 24h window. Tuy nhiên, Meta yêu cầu phải có **lựa chọn connect to human agent** khi user yêu cầu.
- **Opt-in bắt buộc:** User phải đồng ý nhận tin nhắn từ business trước (consent requirement).

##### Ưu điểm tổng hợp
- Phủ sóng toàn cầu, user base khổng lồ.
- API ổn định, tài liệu đầy đủ, hệ sinh thái BSP đa dạng.
- Sandbox miễn phí cho dev/test.
- Hỗ trợ interactive messages (buttons, lists) tăng UX.

##### Nhược điểm tổng hợp
- 24h window rule nghiêm ngặt — giới hạn automation.
- Chi phí per-conversation tích lũy nhanh khi volume lớn.
- Verify business mất 1–4 tuần.
- Mỗi số điện thoại = 1 WABA.

##### Thông tin kỹ thuật bổ sung
- **API Version:** Cloud API v17.0+ (cập nhật thường xuyên mỗi 3 tháng).
- **Xác thực:** Bearer Token (System User Token hoặc Temporary Token).
- **Webhook payload:** JSON. Response phải `200 OK` trong 20 giây.
- **SDK chính thức:** Không có SDK chính thức — sử dụng REST API trực tiếp hoặc BSP SDK.
- **Webhook events:** `messages`, `statuses` (delivered/read), `errors`.

---

#### 2.2.2 LINE (LINE Messaging API)

**📊 Tổng quan:** Nền tảng messaging #1 tại Nhật Bản, Thái Lan, Đài Loan, Indonesia (~196 triệu MAU).

##### ① API Type (Webhook / Polling)

- **Giao thức:** Webhook (Inbound) + REST API (Outbound).
- **Inbound (nhận tin):** LINE Platform gửi HTTP POST tới Webhook URL. Payload dạng JSON, chứa mảng `events[]`.
- **Outbound (gửi tin):** 2 cách:
  - **Reply API:** `POST /v2/bot/message/reply` — dùng `replyToken` từ webhook event (miễn phí, hết hạn sau 1 phút).
  - **Push API:** `POST /v2/bot/message/push` — gửi chủ động bất kỳ lúc nào (tính phí).
- **Webhook registration:** Cấu hình qua LINE Developers Console → Channel → Messaging API → Webhook URL.
- **Signature Verification:** LINE ký webhook bằng HMAC-SHA256 sử dụng Channel Secret (`X-Line-Signature` header).
- **Webhook retry:** LINE retry tự động nếu response không phải `200 OK`. Retry 1 lần sau vài giây.
- **Không hỗ trợ Polling.** Bắt buộc dùng Webhook (có thể dùng Long Polling qua unofficial approach nhưng không khuyến khích).

##### ② Yêu cầu đăng ký Business Account

- **Khuyên dùng Official Account** nhưng không bắt buộc verify để bắt đầu:

| Loại Account | Đặc điểm | Phí |
|:---|:---|:---|
| **Unverified** | Tạo miễn phí qua LINE Developers Console. Đầy đủ tính năng API. Không có badge xanh, không search được trong LINE. | Miễn phí |
| **Verified (Official)** | Có badge xanh ✅. Search được trong LINE app. Tăng độ tin cậy. | Miễn phí (nhưng cần submit và được LINE duyệt) |
| **Premium** | Badge xanh đậm. Ưu tiên hiển thị. Dành cho thương hiệu lớn. | Trả phí |
- **Quy trình đăng ký:**
  1. Tạo tài khoản LINE Developers (developers.line.biz).
  2. Tạo Provider → tạo Channel (Messaging API type).
  3. Lấy Channel Access Token + Channel Secret.
  4. (Optional) Apply verified account qua LINE Official Account Manager.
- **Thời gian:** Tạo Unverified account → **vài phút**. Verify → **1–2 tuần**.
- **Không yêu cầu pháp nhân** cho Unverified account. Verified cần thông tin doanh nghiệp.

##### ③ Rate Limit

- **API rate limit:**

| API | Limit |
|:---|:---|
| Reply API | 1,000 requests/giây (không giới hạn số lượng message) |
| Push API | 1,000 requests/giây |
| Multicast API | 1,000 requests/phút (tối đa 500 users/request) |
| Broadcast API | ~1 request/giây (gửi cho tất cả followers) |
| Get Profile | 2,000 requests/giây |
- **Push Message quota (monthly):**

| Gói | Số Push Message miễn phí | Phí/tháng | Phí mua thêm |
|:---|:---|:---|:---|
| **Communication (Free)** | 200 msg/tháng | ¥0 | Không mua thêm được |
| **Communication (Light)** | 5,000 msg/tháng | ¥5,000 (~$33) | Không mua thêm được |
| **Communication (Standard)** | 30,000 msg/tháng | ¥15,000 (~$100) | ~¥3/msg (~$0.02) |
- **Reply messages:** Không tính vào quota, miễn phí không giới hạn.

##### ④ Cost Model

- **Miễn phí nhận** (Inbound) tất cả tin nhắn.
- **Reply Message:** Miễn phí hoàn toàn (sử dụng `replyToken` trong 1 phút sau khi nhận webhook).
- **Push Message:** Tính theo gói tháng (xem bảng Rate Limit ở trên).
- **Không tính per-conversation.** Tính per-push-message.
- **Lưu ý quan trọng:** Reply API miễn phí nên nếu thiết kế hệ thống tốt (luôn reply trong 1 phút), chi phí messaging có thể rất thấp.
- **Các tính năng trả phí khác:** LINE Ads, LINE VOOM, Official Account subscription (tùy quốc gia).

##### ⑤ Support Media Message

- **Hỗ trợ đầy đủ và phong phú:**

| Loại | Mô tả | Giới hạn |
|:---|:---|:---|
| Text | Plain text | 5,000 ký tự |
| Image | JPEG, PNG | 10 MB |
| Video | MP4 | 200 MB |
| Audio | M4A | 200 MB |
| File | Bất kỳ loại file nào | 300 MB |
| Sticker | LINE sticker packages | Package ID + Sticker ID |
| Location | Latitude/Longitude + Title | – |
| Imagemap | Image có vùng clickable | – |
| **Flex Message** | **UI components phức tạp (JSON layout):** carousel, bubble, button, box, image, text — thiết kế như mini web page trong chat | 50 KB JSON |
| Template | Button, Confirm, Carousel, Image Carousel | Tối đa 12 actions |
- **Flex Message** là điểm mạnh vượt trội so với các platform khác: cho phép tạo ticket, receipt, booking card, v.v. trực tiếp trong chat.
- **Rich Menu:** Customizable menu bar cố định ở dưới chat window (hỗ trợ 1–6 vùng action).

##### ⑥ Hạn chế về Automation / Bot

- **KHÔNG có quy tắc 24-hour window** — Bot có thể Push Message tới user bất kỳ lúc nào (chỉ cần user đã add friend/follow).
- **Rất thân thiện với bot/automation:**
  - Bot có thể chủ động gửi tin nhắn.
  - Hỗ trợ Postback actions → bot nhận callback khi user click button.
  - Rich Menu + Quick Reply → hướng dẫn user tương tác với bot.
- **Hạn chế duy nhất:** Push Message tính phí theo gói (nếu vượt free quota thì phải mua thêm).
- **Không yêu cầu opt-in** rõ ràng như WhatsApp — user add friend = đồng ý nhận tin.
- **LINE không yêu cầu** connect to human agent option (không như WhatsApp/Meta policy).

##### Ưu điểm tổng hợp
- Developer-friendly: SDK chính thức cho **Node.js, Python, Go, Java, Ruby, PHP**.
- Flex Message vượt trội, tạo UX phong phú.
- Reply API miễn phí → tối ưu chi phí nếu thiết kế hệ thống phản hồi nhanh.
- Không bị giới hạn bởi window rule, rất thuận lợi cho automation/chatbot.
- Tạo Unverified account trong vài phút, bắt đầu dev ngay.

##### Nhược điểm tổng hợp
- Thị phần hẹp (chủ yếu Đông Á + Đông Nam Á: JP, TH, TW, ID).
- Gói Free giới hạn 200 push messages / tháng (rất ít).
- Unverified Account không search được trong LINE app → khó acquire user mới.
- `replyToken` hết hạn sau 1 phút — phải xử lý webhook cực nhanh, nếu không phải dùng Push (mất phí).

##### Thông tin kỹ thuật bổ sung
- **SDK chính thức:** `@line/bot-sdk` (Node.js), `linebot` (Python), `line-bot-sdk-go` (Go)…
- **Channel Access Token:** 2 loại — Long-lived (không hết hạn) hoặc Stateless Channel Access Token (tự rotate).
- **Webhook events:** `message`, `follow`, `unfollow`, `join`, `leave`, `postback`, `beacon`, `accountLink`.
- **User ID:** LINE cấp unique `userId` per user per provider (không phải số điện thoại).

---

#### 2.2.3 Viber (Viber Business Messages API)

**📊 Tổng quan:** Phổ biến tại Đông Âu, CIS, Trung Đông, một số khu vực Đông Nam Á (~1.1 tỷ registered users).

##### ① API Type (Webhook / Polling)

- **Giao thức:** Webhook (Inbound) + REST API (Outbound).
- **Inbound (nhận tin):** Viber gửi HTTP POST tới Webhook URL mỗi khi có event (tin nhắn, subscribe, unsubscribe…).
- **Outbound (gửi tin):** `POST https://chatapi.viber.com/pa/send_message` với auth token.
- **Webhook registration:** Gọi API `POST https://chatapi.viber.com/pa/set_webhook` kèm `url` và `event_types[]`.
- **Signature Verification:** Viber ký webhook bằng HMAC-SHA256 sử dụng auth token (`X-Viber-Content-Signature` header).
- **Webhook timeout:** Server phải respond trong **10 giây**. Nếu timeout → Viber retry.
- **Không hỗ trợ Polling.** Chỉ Webhook.

##### ② Yêu cầu đăng ký Business Account

- **Bắt buộc đăng ký qua đối tác chính thức** (Viber Business Partner / Messaging Partner).
- **Không thể tự đăng ký trực tiếp** với Viber (khác với WhatsApp hay LINE).
- **Quy trình:**
  1. Liên hệ Viber Business Partner (VD: Infobip, MessageBird, GMS, Vonage).
  2. Cung cấp thông tin doanh nghiệp, use case, volume ước tính.
  3. Partner tạo Business Account và cung cấp Auth Token.
- **Loại account:**

| Loại | Mô tả |
|:---|:---|
| **Chatbot Account** | Cho phép tạo chatbot, gửi/nhận tin nhắn 1:1 | 
| **Business Messages** | Gửi tin nhắn hàng loạt (transactional + promotional) qua Partner |
- **Thời gian setup:** 1–2 tuần (phụ thuộc partner).
- **Yêu cầu pháp nhân:** Không nghiêm ngặt như WeChat, nhưng partner thường yêu cầu giấy phép kinh doanh.

##### ③ Rate Limit

- **Chatbot API:** ~50 – 100 requests/giây (tùy account tier từ partner).
- **Business Messages (qua Partner):** Thường được partner quản lý rate, có thể đạt hàng nghìn msg/giây.
- **Broadcast:** Tối đa 500 users/request khi gửi broadcast message.
- **Giới hạn tin nhắn đến:** Không giới hạn. User gửi bao nhiêu cũng nhận.
- **Lưu ý:** Rate limit cụ thể phụ thuộc vào **thỏa thuận với Partner**, không công khai rõ ràng như WhatsApp hay LINE.

##### ④ Cost Model

- **Tính phí qua Partner**, không trực tiếp với Viber:
  - **Minimum monthly spend:** Thường $100 – $500/tháng (tùy quốc gia và partner).
  - **Per-message cost:** Khác nhau theo quốc gia và loại tin nhắn (Transactional rẻ hơn Promotional).
  - **Ví dụ giá:** Ukraine ~$0.01/msg, Tây Âu ~$0.03-0.05/msg.
- **Chatbot API:** Một số partner cung cấp free tier cho chatbot (inbound miễn phí, outbound trả phí).
- **Không có free tier chính thức** từ Viber cho Business Messages.
- **Tính phí theo message**, không phải per-conversation như WhatsApp.

##### ⑤ Support Media Message

- **Hỗ trợ:**

| Loại | Mô tả | Giới hạn |
|:---|:---|:---|
| Text | Plain text | 7,000 ký tự |
| Image (Picture) | JPEG, PNG | 1 MB |
| Video | MP4 | 26 MB |
| File | Bất kỳ | 50 MB |
| Sticker | Viber sticker ID | – |
| Location | Latitude/Longitude | – |
| Contact | Phone + Name | – |
| URL | Clickable link với preview | – |
| **Rich Media (Carousel)** | Cards với image, text, buttons | Tối đa 6 buttons/card, 7 cards |
- **Keyboard (custom):** Gửi kèm Custom Keyboard (tương tự Quick Reply) với các button tùy chỉnh.
- **Không hỗ trợ Audio riêng** (khác với WhatsApp/LINE). Phải gửi dạng File.

##### ⑥ Hạn chế về Automation / Bot

- **Phân biệt rõ Transactional vs Promotional:**

| Loại | Mô tả | Hạn chế |
|:---|:---|:---|
| **Transactional** | Xác nhận đơn hàng, OTP, thông báo shipping… | Gửi bất kỳ lúc nào (miễn user đã subscribe) |
| **Promotional** | Quảng cáo, marketing, deal… | Bị hạn chế tần suất. Một số quốc gia chỉ cho gửi trong khung giờ nhất định (8h-21h) |
- **Opt-in bắt buộc:** User phải chủ động subscribe/chat trước → business mới được gửi tin.
- **Unsubscribe:** User có thể unsubscribe bất cứ lúc nào → business không được gửi thêm.
- **Không có window rule** (như WhatsApp/WeChat). Bot có thể gửi Transactional message bất kỳ lúc nào.
- **Chatbot tự do:** Không yêu cầu template duyệt trước cho tin nhắn chatbot 1:1.

##### Ưu điểm tổng hợp
- Phổ biến tại Đông Âu, CIS — thị trường tiềm năng cho CSKH khu vực này.
- Rich Media / Carousel giúp tạo trải nghiệm shopping-in-chat.
- Không bị window rule → automation linh hoạt.
- Transactional messages gửi tự do, không cần template duyệt.

##### Nhược điểm tổng hợp
- **Phải qua Partner** đăng ký → phụ thuộc bên thứ ba, ít kiểm soát.
- Minimum monthly spend → chi phí cố định kể cả khi volume thấp.
- API docs nghèo nàn hơn WhatsApp / LINE.
- Thị phần đang giảm tại một số khu vực. Ít phổ biến ở Mỹ, Đông Á.
- Không hỗ trợ Audio message riêng biệt.

##### Thông tin kỹ thuật bổ sung
- **Base URL:** `https://chatapi.viber.com/pa/`
- **Xác thực:** Auth Token trong header `X-Viber-Auth-Token`.
- **Webhook events:** `delivered`, `seen`, `failed`, `subscribed`, `unsubscribed`, `conversation_started`, `message`.
- **User ID:** Viber cấp unique ID per subscriber. Không cần số điện thoại.
- **SDK:** Không có SDK chính thức phong phú — chủ yếu dùng REST API trực tiếp.

---

#### 2.2.4 KakaoTalk (Kakao Business Channel API)

**📊 Tổng quan:** Nền tảng messaging #1 tại Hàn Quốc (~53 triệu MAU, >90% dân số HQ sử dụng).

##### ① API Type (Webhook / Polling)

- **Giao thức:** Webhook + REST API.
- **Inbound (nhận tin):** Kakao gửi Webhook (callback URL) khi user gửi tin nhắn tới Channel.
- **Outbound (gửi tin):** REST API qua 2 kênh chính:
  - **AlimTalk:** `POST /v2/api/alimtalk/send` — Notification message (template bắt buộc).
  - **FriendTalk:** `POST /v2/api/friendtalk/send` — Free-form message cho users đã add bạn.
- **Webhook setup:** Cấu hình callback URL trong Kakao Business Channel Admin. Phức tạp hơn WhatsApp/LINE.
- **API Gateway endpoint:** `kapi.kakao.com` (REST API chính).
- **Hạn chế:** Webhook documentation chủ yếu tiếng Hàn, ít tài liệu English.

##### ② Yêu cầu đăng ký Business Account

- **Bắt buộc** có **Kakao Business Channel:**
  - Yêu cầu **pháp nhân tại Hàn Quốc** hoặc đại diện kinh doanh hợp pháp tại HQ.
  - Cần Korean Business Registration Number (사업자등록번호).
- **Đối với AlimTalk:** Phải đăng ký thêm qua **Kakao I Partner** (thường là Agency tại HQ).
- **Quy trình:**
  1. Tạo Kakao Developers Account (developers.kakao.com).
  2. Tạo App → kết nối với Kakao Business Channel.
  3. Đăng ký business → xác minh giấy phép kinh doanh.
  4. (AlimTalk) Ký hợp đồng với Kakao I Agency Partner.
- **Thời gian:**
  - Tạo Kakao Business Channel: 1–3 ngày.
  - Verify + AlimTalk setup: 1–3 tuần.
- **Rào cản lớn:** Doanh nghiệp nước ngoài (không có pháp nhân HQ) rất khó tự đăng ký. Phải qua Agency.

##### ③ Rate Limit

- **Phụ thuộc gói đăng ký** và thỏa thuận với Agency:
  - Thường cho phép **~1,000 msg/giây** (AlimTalk).
  - FriendTalk rate limit thấp hơn.
- **Daily quota:** Phụ thuộc hợp đồng. Thường 50K – 500K msg/ngày.
- **API call limit:** ~1,000 requests/phút cho các API query (get user info, get channel info…).
- **Lưu ý:** Rate limit không công khai rõ ràng, phụ thuộc nhiều vào Agency Partner.

##### ④ Cost Model

- **AlimTalk (Notification):**
  - Chi phí cực thấp: **~₩8 – ₩10/msg** (~$0.006 – $0.007/msg).
  - Rẻ hơn nhiều so với SMS tại HQ (₩20/SMS).
  - AlimTalk thay thế SMS cho notifications business → adoption rất cao ở HQ.
- **FriendTalk (Ad message):**
  - Chi phí cao hơn AlimTalk: **~₩15 – ₩25/msg** (~$0.011 – $0.018/msg).
  - Hỗ trợ rich media (image, wide image, video, carousel).
- **Agency fee:** Thường có phí setup ban đầu + phí duy trì hàng tháng với Agency Partner.
- **Không có free tier** cho production. Kakao Developer sandbox chỉ dùng cho testing.

##### ⑤ Support Media Message

- **AlimTalk:**

| Loại | Mô tả |
|:---|:---|
| Text | Template text có placeholder variables |
| Button | Link, Delivery Tracking, App link (tối đa 5 buttons) |
| Image | Thumbnail image trong template |
| **Không hỗ trợ:** | Video, Audio, File, Location, Sticker |
- **FriendTalk:**

| Loại | Mô tả |
|:---|:---|
| Image | JPEG, PNG (wide image hoặc square) |
| Video | MP4 (embed hoặc link) |
| Carousel | Nhiều cards xếp ngang (tối đa 6 cards) |
| Button | Link, App link, Bot keyword |
| **Không hỗ trợ:** | Audio, File đính kèm, Location, Sticker |
- **Hạn chế chung:** Media support hạn chế hơn đáng kể so với WhatsApp và LINE. AlimTalk chủ yếu là text + buttons.

##### ⑥ Hạn chế về Automation / Bot

- **AlimTalk template bắt buộc duyệt trước:**
  - Submit template → Kakao review (1–2 ngày làm việc).
  - Format rất nghiêm ngặt: không được chứa quảng cáo, phải có thông tin hữu ích (xác nhận đơn hàng, OTP, thông báo giao hàng…).
  - Template bị từ chối nếu mang tính quảng cáo → phải dùng FriendTalk.
- **FriendTalk linh hoạt hơn:**
  - Không cần template. Gửi free-form message.
  - **Nhưng chỉ gửi được cho users đã add friend** với Kakao Business Channel.
  - Chi phí cao hơn AlimTalk.
- **Chatbot:** Hỗ trợ chatbot builder (Kakao I Open Builder) — nhưng chủ yếu hỗ trợ tiếng Hàn.
- **Không có window rule** (khác WhatsApp/WeChat). Gửi AlimTalk/FriendTalk bất kỳ lúc nào.

##### Ưu điểm tổng hợp
- Thống trị thị trường Hàn Quốc (>90% dân số). Bắt buộc nếu target HQ.
- AlimTalk: Chi phí notification thấp nhất so với mọi kênh (rẻ hơn SMS 3-4 lần).
- Ecosystem phong phú: Kakao Pay, Kakao Map, Kakao Commerce tích hợp mượt mà.
- Không bị window rule.

##### Nhược điểm tổng hợp
- **Chỉ hiệu quả tại thị trường Hàn Quốc.** Ngoài HQ gần như vô nghĩa.
- Yêu cầu pháp nhân HQ hoặc Agency → rào cản rất lớn cho DN nước ngoài.
- AlimTalk template duyệt nghiêm ngặt, format cứng nhắc.
- API documentation chủ yếu tiếng Hàn → developer nước ngoài gặp khó.
- Media support hạn chế (AlimTalk chỉ text + buttons).

##### Thông tin kỹ thuật bổ sung
- **API Gateway:** `kapi.kakao.com`.
- **Xác thực:** Admin Key / App Key + OAuth2 flow.
- **AlimTalk gửi qua:** Kakao I Partner Agency (không gọi trực tiếp từ app).
- **User ID:** Kakao cấp unique `userId`. Cũng hỗ trợ Phone number matching qua AlimTalk.
- **SDK:** Kakao SDK (chủ yếu cho Login, Share, Navi). Messaging API chủ yếu REST.
- **Webhook events:** `message`, `added` (friend add), `blocked`.

---

#### 2.2.5 WeChat (WeChat Official Account API)

**📊 Tổng quan:** Nền tảng messaging #1 tại Trung Quốc (~1.3 tỷ MAU). Super App — messaging, payment, mini programs, CSKH trong 1.

##### ① API Type (Webhook / Polling)

- **Giao thức:** Webhook (Inbound) + REST API (Outbound).
- **Inbound (nhận tin):** WeChat gửi HTTP POST tới Server URL (Webhook). Payload mặc định là **XML** (có thể chuyển sang JSON nếu cấu hình).
- **Outbound (gửi tin):**
  - **Customer Service Message:** `POST https://api.weixin.qq.com/cgi-bin/message/custom/send` (trong 48h window).
  - **Template Message:** `POST https://api.weixin.qq.com/cgi-bin/message/template/send` (bất kỳ lúc nào, template duyệt sẵn).
- **Webhook registration:** Cấu hình Server URL trong WeChat Official Account Platform → 基本配置 (Basic Config).
- **Verification:** WeChat gửi GET request kèm `signature`, `timestamp`, `nonce`, `echostr` → Server phải verify và echo back `echostr`.
- **Encryption Mode:** 3 chế độ — Plain text, Compatible, Safe (AES-256-CBC encryption). Khuyến khích dùng Safe mode.
- **Webhook retry:** WeChat retry 3 lần trong 5 giây nếu không nhận response `success`. **Rất agressive** — phải respond cực nhanh.
- **Không hỗ trợ Polling.** Chỉ Webhook.

##### ② Yêu cầu đăng ký Business Account

- **Rất khắt khe, phức tạp nhất trong 5 nền tảng:**

| Loại Account | Đặc điểm | Phí | Đăng ký |
|:---|:---|:---|:---|
| **Subscription Account (订阅号)** | 1 broadcast/ngày. Không có Customer Service API. Ít tính năng. | Miễn phí (TQ) | Cần CMND/Hộ chiếu TQ |
| **Service Account (服务号)** | 4 broadcasts/tháng. **Có Customer Service API, Template Message, WeChat Pay, Mini Programs.** | ¥300/năm (~$42) verify fee | Cần pháp nhân TQ |
| **Service Account (Overseas)** | Tương tự Service Account nhưng cho DN nước ngoài. | $99/năm verify fee | Cần agency, rất phức tạp |
- **CSKH (Customer Service) chỉ có trên Service Account** → bắt buộc phải đăng ký Service Account.
- **Quy trình DN nước ngoài:**
  1. Liên hệ WeChat authorized third-party agency (VD: WalktheChat, Grata, ParkLu).
  2. Cung cấp giấy phép kinh doanh (bản dịch công chứng tiếng Trung).
  3. Agency submit đơn → WeChat audit (2–4 tuần).
  4. Thanh toán phí xác minh hàng năm ($99 USD).
- **Thời gian:** Account mới: **2–6 tuần** (bao gồm audit). Gia hạn: 1–2 tuần hàng năm.
- **Rủi ro:** Hồ sơ có thể bị từ chối. Phải cung cấp đầy đủ giấy tờ pháp lý theo yêu cầu WeChat.

##### ③ Rate Limit

- **Customer Service API:** Không công bố rate limit cụ thể, nhưng thực tế:
  - ~50 – 100 requests/giây (tùy account tier).
  - Quota hàng ngày khác nhau theo loại account.
- **Template Message:** 
  - ~10,000 template messages/ngày (Service Account thường).
  - Account lớn (nhiều follower) có thể xin nâng quota lên 100K/ngày.
- **Broadcast:**

| Loại Account | Số broadcast |
|:---|:---|
| Subscription Account | 1 lần/ngày |
| Service Account | 4 lần/tháng |
- **API call quota:** ~10,000 – 100,000 API calls/ngày tùy loại API endpoint.
- **Access Token limit:** Mỗi AppID chỉ được gọi `getAccessToken` tối đa 2,000 lần/ngày. Token có hạn **2 giờ** → phải cache và refresh.

##### ④ Cost Model

- **Phí xác minh hàng năm:**
  - DN Trung Quốc: ¥300/năm (~$42).
  - DN nước ngoài: **$99 USD/năm**.
- **Customer Service Messages:** **Miễn phí** trong 48-hour window.
- **Template Messages:** **Miễn phí** (không giới hạn số lượng, chỉ giới hạn daily quota).
- **Agency fee:** Phí setup: $500 – $3,000 (one-time). Phí duy trì: $100 – $500/tháng.
- **Tổng chi phí thực tế (năm đầu):**
  - Agency setup: ~$1,000 – $3,000 (one-time).
  - Verify fee: $99/năm.
  - Agency maintenance: ~$1,200 – $6,000/năm.
  - **Message: Miễn phí** (trong window + template).
- **Rẻ nhất về per-message cost, nhưng đắt nhất về chi phí setup và duy trì.**

##### ⑤ Support Media Message

- **Customer Service Messages (trong 48h window):**

| Loại | Mô tả | Giới hạn |
|:---|:---|:---|
| Text | Plain text | 2,048 ký tự |
| Image | JPEG, PNG | 10 MB |
| Voice | AMR | 2 MB, max 60 giây |
| Video | MP4 | 10 MB |
| Music | URL (streaming link) | – |
| News (图文消息) | Rich article: title, description, image, URL | Tối đa 8 articles/message |
| Mini Program Card | Link đến WeChat Mini Program | – |
- **Template Messages:**
  - **Chỉ hỗ trợ Text** với placeholder variables.
  - Có thể kèm URL redirect (click template → mở web page / Mini Program).
  - **Không hỗ trợ image, video, audio** trong template.
- **News (图文消息)** là định dạng phổ biến nhất trên WeChat — tương tự article card, khi click sẽ mở WebView.
- **Không hỗ trợ:** Sticker tùy chỉnh, File đính kèm, Location trong Customer Service Messages.

##### ⑥ Hạn chế về Automation / Bot

- **Quy tắc 48-hour Window:**
  - Khi user gửi tin nhắn → mở 1 customer service window **48 giờ**.
  - Trong 48h: Business gửi free-form Customer Service Message (text, image, video…).
  - Sau 48h: **CHỈ được gửi Template Message** đã duyệt sẵn.
- **Template Message:**
  - Submit template → WeChat audit (1–5 ngày).
  - Template phải thuộc **danh mục cho phép** (industry templates): banking, ecommerce, education, travel…
  - **Nội dung template rất hạn chế:** Chủ yếu notification (đơn hàng, giao hàng, thanh toán…).
  - Template vi phạm → account bị cảnh cáo hoặc giới hạn.
- **Chatbot:**
  - WeChat hỗ trợ auto-reply (keyword-based) trong Official Account Platform.
  - Custom chatbot: phải tự build qua Customer Service API.
  - **Lưu ý:** WeChat kiểm soát chặt nội dung. Tin nhắn tự động mang tính spam có thể bị phạt.
- **Broadcast hạn chế:** Service Account chỉ 4 lần/tháng → không phù hợp cho mass messaging thường xuyên.

##### Ưu điểm tổng hợp
- User base khổng lồ tại TQ (1.3 tỷ). **Bắt buộc nếu target thị trường Trung Quốc.**
- Mini Programs: Xây full app bên trong WeChat ecosystem.
- WeChat Pay tích hợp mượt mà → Commerce-in-chat.
- Template Message miễn phí, Customer Service Message miễn phí trong window.
- News (图文消息) format rất mạnh cho content marketing.

##### Nhược điểm tổng hợp
- **Quy trình đăng ký phức tạp nhất:** Pháp nhân TQ hoặc agency. Audit nghiêm ngặt, mất 2–6 tuần.
- 48h window rule giới hạn automation.
- API sử dụng XML format (bên cạnh JSON) → phải viết parser riêng.
- Broadcast cực kỳ hạn chế (4 lần/tháng cho Service Account).
- **Great Firewall:** Server nên đặt tại TQ/HK. Latency cao nếu server ở nước ngoài.
- Access Token hết hạn mỗi 2 giờ → phải có cơ chế cache + auto refresh.
- Chi phí Agency setup và duy trì cao.

##### Thông tin kỹ thuật bổ sung
- **API Base URL:** `https://api.weixin.qq.com/cgi-bin/` (Global) hoặc `https://api.weixin.qq.com/cgi-bin/` (TQ).
- **Xác thực:** AppID + AppSecret → GET `/token` → nhận `access_token` (TTL: 7200 giây = 2 giờ). Phải cache, tránh gọi quá thường xuyên.
- **Webhook payload:** XML (mặc định). Nếu bật Safe Mode → AES-256-CBC encrypted XML.
- **User ID:** WeChat cấp unique `OpenID` per user per Official Account. `UnionID` dùng khi liên kết nhiều account/Mini Program.
- **SDK:** Nhiều community SDK: `wechatpy` (Python), `wechat4j` (Java), `node-weixin-api` (Node.js). Không có SDK chính thức.
- **Webhook events:** `text`, `image`, `voice`, `video`, `location`, `link`, `event` (subscribe/unsubscribe/scan/click).
- **Lưu ý hosting:** Nên deploy server tại AWS Beijing / Alibaba Cloud / Tencent Cloud để đảm bảo tốc độ kết nối với WeChat servers.

---

## 3. Real-time Bi-directional Translation

### 3.1 So sánh Translation Engine

Theo yêu cầu, so sánh **ít nhất 2 phương án**. Dưới đây là 3 engine phổ biến nhất:

> **Nguồn dữ liệu:** Tất cả số liệu dưới đây được xác minh từ trang pricing/documentation chính thức của từng provider (cập nhật tháng 3/2026).

| Tiêu chí | Google Cloud Translation (Advanced - V3) | DeepL API (Pro) | Microsoft Azure Translator (S1) |
|:---|:---|:---|:---|
| **Số ngôn ngữ** | **189 ngôn ngữ** (NMT model, cập nhật 11/2024) | **33+ ngôn ngữ** core (EU + CJK + VI, HE, TH...). Từ 11/2025 mở rộng lên **100+ ngôn ngữ** (thêm ~70 ngôn ngữ Á-Phi) | **130+ ngôn ngữ và phương ngữ** (bao gồm Klingon, iu-Latn...) |
| **Chất lượng dịch** | Tốt, ổn định đều các ngôn ngữ. Mạnh với ngôn ngữ hiếm | **Xuất sắc** — Ngữ cảnh tự nhiên nhất, đặc biệt EU & CJK. Nhiều benchmark đánh giá cao hơn Google/Azure cho cặp ngôn ngữ châu Âu | Tốt, tương đương Google. Mạnh với các ngôn ngữ châu Á (Hindi, Urdu, Bengali) |
| **Auto Language Detection** | ✅ Nhanh, chính xác cao kể cả text ngắn (trả về `confidence score`) | ✅ Tốt nhưng đôi khi lỗi với text < 5 từ. Không trả về confidence score | ✅ Tốt, hỗ trợ detect batch. Trả về confidence score + alternative languages |
| **Latency (trung bình)** | ~100 – 200ms (single request, text ngắn < 500 chars) | ~150 – 300ms (single request). Chậm hơn Google ~50-100ms | ~100 – 250ms (single request). Tương đương Google |
| **Custom Glossary** | ✅ Hỗ trợ (tối đa 10,000 terms per glossary) | ✅ Hỗ trợ — rất tốt, context-aware glossary | ✅ Hỗ trợ qua Custom Translator (train custom model) |
| **Adaptive / Custom Model** | ✅ AutoML Translation (train model riêng, phí $45/giờ training) + Adaptive Translation ($25/1M chars input + $25/1M chars output) | ❌ Không hỗ trợ custom model training | ✅ Custom Translator (train phí $10/1M chars training data, tối đa $300/session. Hosting: $10/model/region/tháng) |
| **Batch Translation** | ✅ (Document Translation: $0.08/trang NMT, $0.25/trang custom model) | ✅ (Document Translation: tính per-char, minimum 50K chars/file cho DOCX/PDF) | ✅ (Document Translation: $15/1M chars) |
| **Pricing (Text Translation)** | **$20 / 1 triệu ký tự** (NMT). LLM model: $10/1M input + $10/1M output | **$5.49/tháng** (base fee) + **$25 / 1 triệu ký tự** (usage). Tổng cộng: ~$30.49 cho 1M chars đầu tiên | **$10 / 1 triệu ký tự** (S1 Pay-as-you-go). Custom text: $40/1M chars |
| **Free Tier** | **500K ký tự/tháng** miễn phí (áp dụng $10 credit hàng tháng, không hết hạn. Áp dụng cho NMT text + custom model text) | **500K ký tự/tháng** miễn phí (DeepL API Free plan — không yêu cầu thẻ tín dụng. Hạn chế: không có next-gen model, text có thể bị dùng train AI) | **2 triệu ký tự/tháng** miễn phí (F0 tier — bao gồm cả standard + custom translation training) |
| **SLA (Uptime)** | **99.9%** (cam kết chính thức. Vi phạm → credit 10-50% tùy mức độ) | **99.0%** (Business plan) / **97.0%** (các plan khác). ⚠️ Không có SLA cho Free plan | **99.9%** (Cognitive Services SLA. Không có SLA cho F0 free tier) |
| **SDK / Library** | Rất phong phú — SDK chính thức: Node.js, Python, Go, Java, C#, Ruby, PHP | REST API + SDK chính thức: **Node.js, Python**. Community SDK cho các ngôn ngữ khác | Rất phong phú — SDK chính thức: Node.js, Python, Java, C#, Go |

**Kết luận so sánh:**

| Nhu cầu | Engine đề xuất | Lý do |
|:---|:---|:---|
| **Global scale, nhiều ngôn ngữ hiếm** | Google Cloud Translation | Hỗ trợ **189 ngôn ngữ** (nhiều nhất), auto-detect tốt nhất với confidence score, free tier 500K chars/tháng |
| **Chất lượng dịch tối ưu (EU + CJK)** | DeepL | Chất lượng ngữ cảnh tự nhiên nhất cho EU & CJK, glossary context-aware. Nhưng SLA chỉ 99.0% (Business) |
| **Tối ưu chi phí** | Azure Translator | Giá rẻ nhất (**$10/1M chars** — bằng 1/2 Google), free tier lớn nhất (**2M chars/tháng** — gấp 4x Google) |
| **MVP (Đề xuất)** | **Google Cloud Translation** | Cân bằng tốt nhất giữa chất lượng, số ngôn ngữ (189), SLA (99.9%), auto-detect confidence score, và hệ sinh thái SDK. Có thể fallback sang Azure khi cần tiết kiệm chi phí |

---

### 3.2 Kiến trúc đề xuất

#### Kiến trúc tổng quan (High-Level Architecture)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        MESSAGING PLATFORMS                         │
│  ┌──────────┐ ┌──────┐ ┌───────┐ ┌──────────┐ ┌────────┐          │
│  │ WhatsApp │ │ LINE │ │ Viber │ │ KakaoTalk│ │ WeChat │          │
│  └────┬─────┘ └──┬───┘ └───┬───┘ └────┬─────┘ └───┬────┘          │
│       │          │         │           │           │               │
└───────┼──────────┼─────────┼───────────┼───────────┼───────────────┘
        │          │         │           │           │
        ▼          ▼         ▼           ▼           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     API GATEWAY / WEBHOOK RECEIVER                  │
│  • Xác nhận 200 OK ngay lập tức                                    │
│  • Validate signature                                               │
│  • Normalize payload → Unified Message Format                       │
│  • Publish vào Message Queue                                        │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        MESSAGE QUEUE                                │
│  (RabbitMQ / AWS SQS / Redis Streams)                               │
│  ┌─────────────────┐    ┌─────────────────┐                         │
│  │ Inbound Queue   │    │ Outbound Queue  │                         │
│  └────────┬────────┘    └────────┬────────┘                         │
└───────────┼──────────────────────┼──────────────────────────────────┘
            │                      │
            ▼                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     TRANSLATION WORKERS                             │
│                                                                     │
│  Inbound Worker:                 Outbound Worker:                   │
│  1. Detect Language              1. Query user's language            │
│  2. Translate → Agent Language   2. Translate → User Language        │
│  3. Cache result                 3. Format per platform              │
│  4. Save to DB                   4. Call Platform API to send        │
│  5. Push via WebSocket           5. Update delivery status           │
│                                                                     │
│  ┌──────────────────────────────────────────┐                       │
│  │        Translation Engine API            │                       │
│  │  (Google Cloud Translation / DeepL)      │                       │
│  └──────────────────────────────────────────┘                       │
└─────────────────────────────────────────────────────────────────────┘
            │                      │
            ▼                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        DATA LAYER                                   │
│  ┌────────────┐  ┌─────────────┐  ┌──────────────┐                 │
│  │ PostgreSQL │  │ Redis Cache │  │  S3 / Blob   │                 │
│  │ (Messages, │  │ (Trans.     │  │  (Media      │                 │
│  │  Users,    │  │  Cache,     │  │   Storage)   │                 │
│  │  Sessions) │  │  Sessions)  │  │              │                 │
│  └────────────┘  └─────────────┘  └──────────────┘                 │
└─────────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   AGENT DASHBOARD (Frontend)                        │
│  • WebSocket real-time updates                                      │
│  • Hiển thị tin nhắn gốc + bản dịch                                │
│  • Agent gõ reply → đẩy vào Outbound Queue                         │
│  • Cảnh báo 24h/48h window countdown                                │
│  • Conversation history & search                                    │
└─────────────────────────────────────────────────────────────────────┘
```

#### Luồng xử lý chi tiết (Sequence)

**Inbound Flow (User → Agent):**

```
User gửi tin nhắn
    │
    ▼
Platform Webhook → API Gateway
    │
    ├─ 1. Respond HTTP 200 OK ngay lập tức (< 5s để tránh retry)
    ├─ 2. Validate webhook signature (HMAC-SHA256)
    ├─ 3. Normalize message → Unified Format:
    │      { platform, userId, messageType, content, timestamp, rawPayload }
    │
    ▼
Publish vào Inbound Queue
    │
    ▼
Translation Worker picks up
    │
    ├─ 4. Gọi Translation API: detectLanguage(content)
    │      → Kết quả: { language: "ja", confidence: 0.98 }
    │
    ├─ 5. Lưu user.detectedLanguage = "ja" (lần đầu hoặc update)
    │
    ├─ 6. Gọi Translation API: translate(content, source="ja", target="vi")
    │      → Kết quả: "Xin chào, tôi cần hỗ trợ"
    │
    ├─ 7. Cache translation result (key: hash(content + source + target), TTL: 24h)
    │
    ├─ 8. Lưu vào DB:
    │      messages { originalText, translatedText, sourceLang, targetLang, ... }
    │
    ▼
Push qua WebSocket → Agent Dashboard
    Agent thấy: [Original] こんにちは、サポートが必要です
                [Translated] Xin chào, tôi cần hỗ trợ
```

**Outbound Flow (Agent → User):**

```
Agent gõ reply (bằng tiếng Việt)
    │
    ▼
Frontend gửi API POST /messages/send
    { conversationId, content: "Chào bạn, tôi có thể giúp gì?" }
    │
    ▼
Publish vào Outbound Queue
    │
    ▼
Translation Worker picks up
    │
    ├─ 1. Query user.detectedLanguage → "ja"
    │
    ├─ 2. Gọi Translation API: translate(content, source="vi", target="ja")
    │      → "こんにちは、何かお手伝いできますか？"
    │
    ├─ 3. Format theo platform:
    │      WhatsApp → { messaging_product: "whatsapp", to: "...", text: { body: "..." } }
    │      LINE     → { to: "...", messages: [{ type: "text", text: "..." }] }
    │
    ├─ 4. Gọi Platform REST API để gửi
    │
    ├─ 5. Nhận response → update delivery status
    │
    ▼
Lưu DB + Push status qua WebSocket → Agent Dashboard
    Agent thấy: ✅ Đã gửi
```

---

### 3.3 Latency, Concurrency & Error Handling

#### Latency Target

| Giai đoạn | Target | Ghi chú |
|:---|:---|:---|
| Webhook receive → Queue publish | < 100ms | Chỉ validate + enqueue, không xử lý nặng |
| Queue → Translation API call | < 300ms | Google: ~100-200ms, DeepL: ~150-300ms |
| DB write + WebSocket push | < 100ms | Async, non-blocking |
| **Tổng E2E (Inbound)** | **< 500ms – 1s** | Mục tiêu lý tưởng |
| **Tổng E2E (Outbound)** | **< 1 – 2s** | Bao gồm cả gọi API platform (phụ thuộc network) |

#### Concurrency Strategy

- **Queue-Worker pattern:** Mỗi Worker là stateless, có thể scale ngang (horizontal scaling).
- **Auto-scaling:** Dùng container orchestration (K8s / ECS) để tự động tăng/giảm số Worker theo queue depth.
- **Connection pooling:** Dùng connection pool cho DB và HTTP client (keep-alive) để giảm overhead.
- **Target:** Xử lý **500 – 1,000 concurrent messages/giây** ở mức MVP.

#### Retry & Error Handling Strategy

| Lỗi | Chiến lược | Chi tiết |
|:---|:---|:---|
| **Translation API fail (5xx)** | Retry + Fallback | Retry 2 lần (backoff 1s, 3s). Nếu vẫn fail → gửi tin nhắn gốc (không dịch) kèm icon ⚠️ |
| **Translation API rate limit (429)** | Exponential Backoff | Retry với backoff: 1s → 2s → 4s → 8s (max 3 lần) |
| **Platform API fail (gửi tin)** | Retry + DLQ | Retry 3 lần (backoff 2s, 5s, 10s). Fail → chuyển vào Dead Letter Queue → Alert Admin |
| **Platform API rate limit** | Queue throttle | Áp dụng rate limiter trước khi gọi API (token bucket algorithm) |
| **Webhook timeout** | Respond first | Luôn respond `200 OK` trước khi xử lý → tránh platform retry không cần thiết |
| **Language detect fail** | Default language | Fallback về ngôn ngữ mặc định (English) + ghi log để review |
| **Worker crash** | Queue re-deliver | Message tự động re-queue (visibility timeout) → Worker khác pick up |

**Circuit Breaker Pattern:**
- Nếu Translation API fail liên tục > 5 lần trong 30 giây → Open circuit → bypass translation → gửi raw message.
- Sau 60 giây → Half-open → thử lại 1 request → nếu OK → close circuit.

---

## 4. Ước lượng Chi phí Sơ bộ

### 4.1 Infrastructure (Monthly - MVP)

| Hạng mục | Service | Chi phí ước lượng |
|:---|:---|:---|
| Application Server | AWS ECS Fargate / GCP Cloud Run (2 instances) | $80 – $120 |
| Database | AWS RDS PostgreSQL (db.t3.medium) | $50 – $70 |
| Cache | AWS ElastiCache Redis (cache.t3.micro) | $15 – $25 |
| Message Queue | AWS SQS / RabbitMQ on EC2 | $10 – $30 |
| Load Balancer | AWS ALB | $20 – $30 |
| Storage (Media) | AWS S3 | $5 – $10 |
| Monitoring | CloudWatch / Datadog Free | $0 – $20 |
| **Subtotal Infra** | | **$180 – $305/tháng** |

### 4.2 Translation API (Monthly - MVP)

| Kịch bản | Volume | Google Cloud | DeepL | Azure |
|:---|:---|:---|:---|:---|
| Light (500 conversations/ngày, ~50 chars/msg) | ~1.5M chars/tháng | ~$20 | €4.99 + €37.5 = ~$47 | ~$0 (free tier) |
| Medium (2K conversations/ngày) | ~6M chars/tháng | ~$100 | €4.99 + €150 = ~$170 | ~$40 |
| Heavy (5K conversations/ngày) | ~15M chars/tháng | ~$280 | €4.99 + €375 = ~$417 | ~$130 |

### 4.3 Messaging Platform (Monthly - MVP)

| Platform | Chi phí ước lượng (1K conversations/ngày) |
|:---|:---|
| WhatsApp | ~$600 – $2,400/tháng (tùy quốc gia, $0.02-0.08/conv) |
| LINE | ~$55 – $220/tháng (gói Light hoặc Standard) |
| Viber | ~$100 – $500/tháng (minimum spend) |
| KakaoTalk | ~$180/tháng (1K msg/ngày × $0.006) |
| WeChat | ~$99/năm (phí verify) + minimal per-message |

### 4.4 Tổng chi phí MVP (Phase 1 - WhatsApp + LINE)

| Hạng mục | Low estimate | High estimate |
|:---|:---|:---|
| Infrastructure | $180 | $305 |
| Translation (Google, Light) | $20 | $100 |
| WhatsApp (1K conv/ngày) | $600 | $2,400 |
| LINE (Standard) | $55 | $220 |
| **Tổng** | **$855/tháng** | **$3,025/tháng** |

---

## 5. Risk & Limitations

### 5.1 Technical Risks

| # | Risk | Impact | Probability | Mitigation |
|:---|:---|:---|:---|:---|
| R1 | **Translation quality sai nghĩa** (slang, thuật ngữ kỹ thuật, tên thương hiệu) | High | Medium | Xây dựng Custom Glossary. Hiển thị tin gốc song song để Agent tự verify |
| R2 | **Translation API downtime** | High | Low | Circuit Breaker pattern. Fallback engine (Google → Azure). Gửi tin gốc khi lỗi |
| R3 | **Webhook delivery fail** (platform retry storm) | Medium | Medium | Idempotency key (message ID dedup). Response `200 OK` ngay lập tức |
| R4 | **Auto-detect language sai** (text quá ngắn, mixed language) | Medium | Medium | Cho phép user/agent override language. Cache detected language per user |
| R5 | **Queue overflow** (burst traffic) | Medium | Low | Auto-scaling workers. Dead Letter Queue. Alert threshold |

### 5.2 Business / Operational Risks

| # | Risk | Impact | Probability | Mitigation |
|:---|:---|:---|:---|:---|
| R6 | **24h/48h window rule** (WhatsApp, WeChat) | High | High | UI countdown timer. Template Message dự phòng. Đào tạo Agent respond kịp thời |
| R7 | **Account verification chậm / bị từ chối** (đặc biệt WeChat, KakaoTalk) | High | Medium | Đăng ký sớm. Dùng Agency partner. Phase 1 chỉ chọn platform dễ verify |
| R8 | **Chi phí messaging tăng nhanh** khi scale | Medium | Medium | Monitor chi phí real-time. Đàm phán giá volume với BSP. Tối ưu conversation window |
| R9 | **Chính sách platform thay đổi** (API deprecation, pricing change) | Medium | Low | Abstract messaging layer (Adapter pattern). Theo dõi changelog |
| R10 | **GDPR / Data privacy** khi lưu trữ và dịch tin nhắn | High | Medium | Encryption at rest & in transit. Data retention policy. User consent flow |

### 5.3 Technical Constraints

- **WhatsApp:** Mỗi số điện thoại = 1 WABA. Không thể dùng 1 số cho nhiều business line.
- **WeChat:** Server nên đặt tại Trung Quốc/Hong Kong. Great Firewall có thể gây latency cao.
- **KakaoTalk:** Yêu cầu pháp nhân HQ. API docs chủ yếu tiếng Hàn.
- **Dịch thuật:** Không hỗ trợ dịch ảnh/voice real-time ở MVP → chỉ text.
- **Mixed-language messages:** Nếu user gửi tin chứa 2+ ngôn ngữ, auto-detect có thể sai.

---

## 6. Đề xuất MVP & Phase 1

### 6.1 MVP Approach

**Nguyên tắc:** Giới hạn phạm vi để validate concept nhanh nhất, giảm rủi ro trước khi đầu tư thêm.

#### Phase 1 Scope (MVP - 6-8 tuần):

| Hạng mục | Scope |
|:---|:---|
| **Platforms** | **WhatsApp** (global reach) + **LINE** (APAC reach) |
| **Translation Engine** | **Google Cloud Translation Advanced** (V3) |
| **Message Types** | Chỉ **Text** (bỏ qua Image, Video, Voice, Document) |
| **Translation Direction** | Bi-directional: User ↔ Agent |
| **Language Detection** | Auto-detect (Google API) + Manual override option |
| **Dashboard** | Web app cơ bản: Conversation list, Chat window, Original + Translated view |
| **Glossary** | Cơ bản (static JSON/DB table, admin quản lý thủ công) |

#### Phase 2 (Mở rộng - Sau MVP):

- Thêm Viber, KakaoTalk (nếu có nhu cầu thị trường).
- WeChat integration (cần chuẩn bị pháp lý).
- Media translation (Image OCR → Translate → Overlay).
- Voice message: Speech-to-Text → Translate → Text-to-Speech.
- Analytics dashboard (thống kê volume, ngôn ngữ, response time).
- Multi-agent routing + Queue management.
- DeepL fallback engine cho các cặp ngôn ngữ EU/CJK.

### 6.2 Estimation sơ bộ (Phase 1 - MVP)

| Task | Effort (Man-days) | Team |
|:---|:---|:---|
| **API Gateway + Webhook Receiver** (WhatsApp + LINE) | 5 – 7 days | Backend |
| **Message Queue + Translation Worker** | 4 – 5 days | Backend |
| **Translation API Integration** (Google Cloud) | 3 – 4 days | Backend |
| **Database Schema + Models** | 2 – 3 days | Backend |
| **Platform Adapters** (WhatsApp + LINE) | 4 – 5 days | Backend |
| **Agent Dashboard** (Frontend) | 8 – 10 days | Frontend |
| **WebSocket real-time** | 3 – 4 days | Full-stack |
| **Retry, Error Handling, DLQ** | 3 – 4 days | Backend |
| **Testing + QA** | 5 – 7 days | QA + Dev |
| **DevOps / Deployment** | 3 – 4 days | DevOps |
| **Buffer (20%)** | 8 – 10 days | – |
| **Tổng** | **48 – 63 man-days** | **~6–8 tuần** (team 2-3 devs) |

---

## 7. Kết luận

### Tóm tắt Deliverables đã hoàn thành:

| Acceptance Criteria | Status |
|:---|:---|
| ✅ Có document research đầy đủ | Bao gồm so sánh 5 nền tảng messaging với đầy đủ tiêu chí |
| ✅ So sánh ít nhất 2 phương án translation engine | So sánh 3 engine: Google, DeepL, Azure |
| ✅ Có kiến trúc đề xuất khả thi | Kiến trúc Queue-Worker, async, horizontal scalable |
| ✅ Xác định rõ risk & technical constraint | 10 risks + 5 technical constraints được liệt kê |
| ✅ Có estimation sơ bộ cho MVP | 48–63 man-days, $855–$3,025/tháng chi phí vận hành |

### Đề xuất Next Steps:

1. **Review & Approve** tài liệu này với stakeholders.
2. **Đăng ký accounts:** Meta Business (WhatsApp) + LINE Developers (bắt đầu càng sớm càng tốt vì verify mất thời gian).
3. **POC (Proof of Concept):** Xây dựng prototype WhatsApp webhook + Google Translate trong 1 tuần để validate E2E flow.
4. **Kickoff Phase 1** sau khi POC thành công.

---

> **Ghi chú:** Tài liệu này là bản Draft. Cần review lại khi có thêm thông tin về thị trường mục tiêu cụ thể và budget chính thức từ stakeholders.
