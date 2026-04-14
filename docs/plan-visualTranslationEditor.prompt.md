# Plan: Visual Translation Editor

**TL;DR**: Xây dựng trang `/app/visual-editor` trong embedded app — split layout với iframe storefront (qua server-side proxy để tránh cross-origin) bên trái, form dịch với TipTap rich text bên phải. Đọc bản dịch via `translatableResource` (Admin API), ghi via `translationsRegister`. MVP: Product only.

---

## Phase 1 — Config (1 bước)

**1.** Sửa `shopify.app.test-new.toml` — thêm scopes:
```
scopes = "read_translations,write_translations,read_locales"
```
Sau đó chạy `shopify app deploy` (hoặc reinstall app) để áp dụng scopes mới.

---

## Phase 2 — Backend API Routes (4 routes mới)

**2.** `app/routes/api.shop-locales.jsx`
- Loader: `authenticate.admin` → query `shopLocales { locale primary published }`
- Return JSON → dùng để populate Language Switcher

**3.** `app/routes/api.translatable-resource.jsx`
- Loader: query params `resourceId` + `locale`
- Admin GraphQL query `translatableResource(resourceId)` lấy `translatableContent` (key, value, **digest**) + `translations(locale)` (bản dịch hiện tại)
- Digest là bắt buộc khi lưu `translationsRegister`

**4.** `app/routes/api.translations.jsx`
- Action (POST): `{ resourceId, locale, translations: [{key, value, digest}] }`
- Gọi mutation `translationsRegister`
- Return `{ success }` hoặc `{ errors }`

**5.** `app/routes/app.storefront-proxy.jsx`
- Loader: query param `url`
- **Security**: validate `url` chứa đúng `session.shop` domain (chống SSRF)
- Server-side `fetch(url)` → inject `<base href="https://{shop}">` vào `<head>` để fix relative URLs
- Return `new Response(html, { 'Content-Type': 'text/html' })` — không bị CORS vì cùng domain với app
- *bước 2–5 độc lập, có thể làm song song*

---

## Phase 3 — Visual Editor Page

**6.** `app/routes/app.visual-editor.jsx` — Loader gọi `shopLocales`, trả về `{ locales, shopDomain }`

**7.** Top toolbar:
- **Language Switcher**: Polaris `Select`, options từ locales
- **Product Picker**: nút gọi `shopify.resourcePicker({ type: 'product' })` (App Bridge) → lưu `{ id, title, handle, onlineStoreUrl }` vào state

**8.** Split layout (CSS flexbox, 60/40):
- **Left**: `<iframe src="/app/storefront-proxy?url={productUrl}">` — reload khi language thay đổi hoặc sau save
- **Right**: Translation Editor panel

---

## Phase 4 — Translation Form

**9.** Khi product + language được chọn → `fetcher.load('/api/translatable-resource?resourceId=...&locale=...')` → hiển thị 4 fields của Product:

| Field key          | Loại editor                   |
|--------------------|-------------------------------|
| `title`            | Polaris `TextField`           |
| `body_html`        | TipTap rich text              |
| `meta_title`       | Polaris `TextField`           |
| `meta_description` | Polaris `TextField` multiline |

**10.** `app/components/TranslationFieldEditor.jsx`
- Props: `fieldKey`, `originalValue`, `translatedValue`, `isHtml`, `onChange`
- HTML field → TipTap `useEditor` + `EditorContent`; text field → Polaris `TextField`

**11.** Save button → `fetcher.submit(...)` POST `/api/translations`; Polaris Toast success/error; reload iframe sau save

---

## Phase 5 — Navigation

**12.** Sửa `app/routes/app.jsx` — thêm nav link `<a href="/app/visual-editor">Visual Editor</a>` vào `<ui-nav-menu>`

---

## Files

### Tạo mới
- `app/routes/app.visual-editor.jsx`
- `app/routes/api.shop-locales.jsx`
- `app/routes/api.translatable-resource.jsx`
- `app/routes/api.translations.jsx`
- `app/routes/app.storefront-proxy.jsx`
- `app/components/TranslationFieldEditor.jsx`

### Sửa đổi
- `shopify.app.test-new.toml` — thêm scopes
- `app/routes/app.jsx` — thêm nav item

### New Dependencies
- `@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`

---

## GraphQL Queries

### Admin API
```graphql
# Lấy locales
query ShopLocales {
  shopLocales { locale primary published }
}

# Lấy translatable content + existing translations
query TranslatableResource($resourceId: ID!, $locale: String!) {
  translatableResource(resourceId: $resourceId) {
    resourceId
    translatableContent { key value digest locale }
    translations(locale: $locale) { key value locale outdated }
  }
}

# Lưu translation
mutation TranslationsRegister($resourceId: ID!, $translations: [TranslationInput!]!) {
  translationsRegister(resourceId: $resourceId, translations: $translations) {
    translations { key value locale }
    userErrors { field message }
  }
}
```

---

## Verification
1. `npm run dev` không lỗi
2. `/app/visual-editor` hiển thị toolbar + split layout
3. Pick Product → iframe load trang sản phẩm, form hiện 4 fields
4. Chọn ngôn ngữ phụ → form load bản dịch hiện có
5. Sửa title → Save → kiểm tra Shopify Admin > Translate & Adapt thấy bản dịch mới
6. Iframe reload với `?locale=XX` → thấy nội dung đã dịch

---

## Further Considerations

1. **Storefront proxy auth**: Iframe load gọi route `app.storefront-proxy` cần auth. Nếu Shopify session cookie không có trong iframe request, giải pháp là tạo signed short-lived token trong URL, hoặc dùng route không require auth nhưng validate HMAC.
2. **Click-to-highlight overlay (Phase 2+)**: Sau MVP có thể inject script vào proxy HTML để highlight text elements và `postMessage({ fieldKey, resourceId })` lên parent, biến editor thành true "click-to-edit".
3. **Storefront URL**: `product.onlineStoreUrl` từ ResourcePicker có thể là `null` nếu store dùng custom domain. Cần fallback sang `https://{shop}/products/{handle}`.
