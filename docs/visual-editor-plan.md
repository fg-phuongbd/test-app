# Visual Translation Editor – Phased Implementation Plan

## Tài liệu tham khảo chính

- Storefront localization: https://shopify.dev/docs/storefronts/headless/building-with-the-storefront-api/markets/multiple-languages
- Markets & translatable resources: https://shopify.dev/docs/storefronts/headless/building-with-the-storefront-api/markets
- Theme locale files: https://shopify.dev/docs/themes/architecture/locales/storefront-locale-files
- Theme app extensions & app embeds: https://shopify.dev/docs/apps/themes/theme-app-extensions
- Translations API (Admin): https://shopify.dev/docs/apps/store/internationalization/translations
- Storefront API: https://shopify.dev/docs/api/storefront

---

## Kiến trúc tổng thể (New Approach – Embed Block Data Layer)

### Tại sao không dùng Theme Clone + PUT Assets

Shopify yêu cầu **exemption đặc biệt** để ghi file vào theme assets (cả REST `PUT /themes/{id}/assets.json` và GraphQL `themeFilesUpsert` đều bị block với `{"errors":"Not Found"}` / `ACCESS_DENIED`). Approach clone theme trong plan gốc không khả thi mà không có exemption.

### New Approach: Embed Block Data Layer

**Nguyên lý:**

```
Merchant bật App Embed Block 1 lần trong Theme Customizer
           ↓
Embed block Liquid chạy SERVER-SIDE trong context theme
→ có full access: product, collection, page, article, shop, metafields...
→ output <script id="ve-layer" type="application/json">{ exact values + GIDs }</script>
           ↓
Merchant click "Open Visual Editor" trong app → window.open('/?visual_translate=1')
           ↓
Embed JS kích hoạt (detect ?visual_translate=1)
→ parse #ve-layer JSON
→ tìm DOM elements theo EXACT VALUE MATCHING (chính xác vì dùng exact server-side values)
→ wrap bằng <span class="translation-target" data-translation-*>
           ↓
Merchant click element → postMessage → App sidebar → translation panel
           ↓
GET /api/translations → Storefront API @inContext(language) → original + current
POST /api/translations → Admin Translations API translationsRegister → lưu bản dịch
```

**Ưu điểm:**
- Không cần ghi file theme → không cần Shopify exemption
- Embed block Liquid server-side có full object context → element detection chính xác
- Live theme không bị chỉnh sửa code, chỉ thêm embed block một lần
- Scalable sang mọi resource type / metafield / locale string trong tương lai

**Data attributes protocol:**
- `data-translation-source` ∈ `resource_field | resource_metafield | theme_locale | section_setting`
- `data-translation-resource-type` (Product, Collection, Page, Article, ShopPolicy…)
- `data-translation-resource-id` (GID: `gid://shopify/Product/123`)
- `data-translation-field` (title, descriptionHtml, body…)
- `data-translation-metafield-namespace`, `data-translation-metafield-key`
- `data-translation-locale-key`
- `data-translation-section-id`, `data-translation-setting-id`, `data-translation-block-id`

---

## Phase 0 – Kiến trúc nền tảng

**Mục tiêu:** Chốt các building blocks mà mọi phase sau sẽ dùng lại.

### 0.1 Embed block: Server-side data layer

File: `extensions/visual-editor-embed/blocks/visual-editor-embed.liquid`

Embed block Liquid có full access đến Shopify theme objects vì chạy trong context của theme. Output JSON data layer ẩn (không hiển thị trên storefront):

```liquid
{% if request.page_type == 'product' %}
<script id="ve-layer" type="application/json">
{
  "page": "product",
  "resources": [
    {
      "source": "resource_field",
      "type": "Product",
      "gid": "gid://shopify/Product/{{ product.id }}",
      "fields": {
        "title": {{ product.title | json }},
        "descriptionHtml": {{ product.description | json }},
        "seo.title": {{ product.seo.title | default: product.title | json }},
        "seo.description": {{ product.seo.description | json }}
      }
    }
    {% for variant in product.variants %}
    ,{
      "source": "resource_field",
      "type": "ProductVariant",
      "gid": "gid://shopify/ProductVariant/{{ variant.id }}",
      "fields": { "title": {{ variant.title | json }} }
    }
    {% endfor %}
  ]
}
</script>
{% elsif request.page_type == 'collection' %}
...
{% endif %}
```

Conditional theo `request.page_type`: `product` / `collection` / `page` / `article` / `blog`.

### 0.2 Embed JS: Exact Value Finder

Thay vì text-guess mù, JS đọc data layer rồi tìm element theo exact server-side value:

```js
const layer = JSON.parse(document.getElementById('ve-layer')?.textContent || 'null');
if (!layer) return;

layer.resources.forEach(resource => {
  Object.entries(resource.fields).forEach(([field, value]) => {
    if (!value) return;
    findAndWrap(value, { source: resource.source, type: resource.type, gid: resource.gid, field });
  });
});
```

`findAndWrap(value, meta)`:
1. **Text field**: walk DOM text nodes, tìm node có `textContent === value`
2. **HTML field** (descriptionHtml, body): tìm container element có `innerHTML` match sau normalize whitespace
3. Wrap bằng `<span class="translation-target" data-translation-source="..." data-translation-resource-type="..." data-translation-resource-id="..." data-translation-field="...">`
4. Attach hover highlight + click → `postMessage` về `window.opener`

### 0.3 App UI – 2 trạng thái

File: `app/routes/app.in-context-editor.jsx`

| State | UI |
|---|---|
| `needs_embed` | Hướng dẫn bật App Embed trong Theme Customizer + link trực tiếp + auto-polling 3s |
| `ready` | Nút "Open Visual Editor" → `window.open('https://{shop}/?visual_translate=1')` |

Check embed status: `GET /api/embed-status` → đọc `config/settings_data.json` của live theme, tìm embed block UUID của app.

### 0.4 Backend API skeleton

`GET /api/translations`
- Input: `{ source, resourceType, resourceId, field, namespace, key, localeKey, sectionId, settingId, blockId, language, country }`
- Storefront API `@inContext(language: X)` → trả về `{ original, current }`

`POST /api/translations`
- Input: như GET + `value`
- Tùy `source` → gọi Admin Translations API `translationsRegister`

---

## Phase 1 – Product Page (resource_field Product)

**Mục tiêu:** Visual editor hoạt động trên product page, chỉnh được title và description.

### 1.1 Data layer – Product fields

Embed block output (từ 0.1):
- `product.title`
- `product.description` (HTML)
- `product.seo.title`, `product.seo.description`
- Per-variant: `variant.title`

### 1.2 Exact value matching

JS `findAndWrap`:
- **title**: walk `h1`, `.product-title`, `.product__title` → text node exact match
- **descriptionHtml**: tìm `.product-description`, `.product__description`, `[class*="description"]` → innerHTML match sau normalize
- **seo fields**: không render trên DOM, editable qua sidebar khi click title
- **variant.title**: walk `.product-form__option`, `[data-option-name]` text nodes

### 1.3 Visual editor UI

App sidebar (React) lắng nghe `postMessage` từ storefront window:
- Nhận `{ type: 'visualTranslation:open', detail: { translationSource, translationResourceType, translationResourceId, translationField } }`
- Gọi `GET /api/translations` → hiện original vs current language side-by-side
- User chỉnh + Save → `POST /api/translations` → Admin Translations API `translationsRegister`
- Cập nhật DOM element text/innerHTML sau khi save thành công

**Kết quả Phase 1:** Merchant mở visual editor, click vào title/description của product, chỉnh dịch theo từng language.

---

## Phase 2 – Mở rộng sang các Resource Page khác

**Mục tiêu:** Collection, Page, Article, Policy pages.

### 2.1 Data layer mở rộng

Bổ sung conditionals vào embed block Liquid:

| `request.page_type` | Resources | Fields |
|---|---|---|
| `collection` | Collection | title, descriptionHtml, seo.title, seo.description |
| `page` | Page | title, body |
| `article` | Article, Blog | title, contentHtml, excerptHtml |
| Tất cả | Shop | privacyPolicy.body, termsOfService.body, refundPolicy.body, shippingPolicy.body |

### 2.2 Backend

Storefront API `node(id: GID) @inContext(language: X)` với inline fragment:

```graphql
query NodeTranslation($id: ID!, $country: CountryCode!, $language: LanguageCode!)
@inContext(country: $country, language: $language) {
  node(id: $id) {
    ... on Collection { title descriptionHtml }
    ... on Page { title body }
    ... on Article { title contentHtml excerptHtml }
    ... on ShopPolicy { body }
  }
}
```

Ghi translation: `translationsRegister` với resource GID + locale + key + value.

**Kết quả Phase 2:** Visual editor hỗ trợ hầu hết content "resource" của shop.

---

## Phase 3 – Theme Locale Strings (theme_locale)

**Mục tiêu:** Dịch được toàn bộ text UI của theme (labels, buttons, messages…) — tất cả những gì Shopify coi là translatable trong `locales/*.json`, không hardcode bất kỳ key nào.

### 3.1 Tại sao không hardcode / không dùng Liquid data layer cho locale

Liquid `t` filter yêu cầu key biết trước tại compile time — không thể iterate động toàn bộ locale keys từ embed block. Giải pháp: **app proxy cung cấp locale map đầy đủ tại runtime**.

### 3.2 App proxy endpoint: `GET /api/locale-map`

App backend gọi Admin Translations API để lấy toàn bộ translatable locale strings của theme:

```graphql
query TranslatableLocaleStrings($themeGid: ID!) {
  translatableResource(resourceId: $themeGid) {
    resourceId
    translatableContent {
      key      # e.g. "products.product.add_to_cart"
      value    # rendered value in default language e.g. "Add to cart"
      digest
      locale   # default shop locale
    }
  }
}
```

- `themeGid = gid://shopify/OnlineStoreTheme/{live_theme_id}`
- Trả về tất cả locale keys + rendered values của default language
- App flatten thành lookup map: `{ "Add to cart": { key: "products.product.add_to_cart", resourceId: "gid://..." } }`
- Response được **cache** (theme locale ít thay đổi), TTL ~5 phút

### 3.3 Embed JS: Dynamic locale scanner

Khi visual editor kích hoạt:

```js
// Fetch full locale map từ app proxy
const localeMap = await fetch('/apps/visual-editor/locale-map').then(r => r.json());
// localeMap: { [renderedValue]: { key, resourceId } }

// Walk toàn bộ DOM text nodes
walkTextNodes(document.body, node => {
  const text = node.textContent.trim();
  if (localeMap[text]) {
    const { key, resourceId } = localeMap[text];
    wrapTextNode(node, {
      source: 'theme_locale',
      localeKey: key,
      resourceId
    });
  }
});
```

`wrapTextNode`: thay text node bằng `<span class="translation-target" data-translation-source="theme_locale" data-translation-locale-key="{key}" data-translation-resource-id="{resourceId}">`.

**Coverage:** 100% những gì Shopify cho phép dịch trong theme locale — đúng bằng danh sách trong Shopify Translations admin.

### 3.4 Backend cho theme_locale

`GET /api/translations` khi `source=theme_locale`:
- Gọi `translatableResource(resourceId)` → lấy `translatableContent` value (original)
- Gọi `translatableResource.translations(locale: language)` → lấy translation hiện tại (current)

`POST /api/translations`:
- `translationsRegister(resourceId, translations: [{ key, locale, value, translatableContentDigest }])`
- Không cần ghi assets file — Admin Translations API handle trực tiếp

### 3.5 Collision handling

Một số locale values có thể trùng nhau (e.g. "Title" xuất hiện nhiều chỗ). Khi wrap, gắn thêm `data-translation-index` để distinguish. Khi click, sidebar hiện context đủ để merchant biết đang sửa string nào.

**Kết quả Phase 3:** Visual editor có thể dịch 100% text UI của theme mà Shopify cho phép dịch — không hardcode, tự động sync với theme updates.

---

## Phase 4 – Section/Block Settings & Metafields/Metaobjects

**Mục tiêu:** Gần như full coverage mọi text translatable của theme.

### 4.1 Metafields (resource_metafield) ✅ Embed block có access

Embed block Liquid có thể iterate `product.metafields`, `collection.metafields`, etc:

```liquid
{% assign text_types = 'single_line_text_field,multi_line_text_field,rich_text_field' | split: ',' %}
{% for mf in product.metafields %}
  {% if text_types contains mf.type %}
  ,{
    "source": "resource_metafield",
    "type": "Product",
    "gid": "gid://shopify/Product/{{ product.id }}",
    "namespace": {{ mf.namespace | json }},
    "key": {{ mf.key | json }},
    "fields": { "value": {{ mf.value | json }} }
  }
  {% endif %}
{% endfor %}
```

Backend:
- GET: Storefront API `product(id) @inContext(language)` → `metafield(namespace, key) { value }`
- POST: `translationsRegister` với metafield GID

### 4.2 Section/Block Settings (section_setting) ⚠️ Giới hạn

Embed block **không có access** `section.settings` (ngoài scope của embed block target: body). Approach thay thế:

1. Gọi Admin Translations API `translatableResource(resourceId: "gid://shopify/Section/{id}")` → liệt kê translatable content + values hiện tại
2. Cross-reference với DOM exact match → tìm element
3. Wrap với `data-translation-source="section_setting"` + `data-translation-section-id` + `data-translation-setting-id`

Backend:
- GET: Admin Translations API `translatableResource` → `translatableContent` + `translations`
- POST: `translationsRegister` với section/block GID

### 4.3 Metaobjects

Mở rộng sang `source: 'metaobject'` với GID + field name. Backend dùng Storefront + Translations API cho metaobject type.

**Kết quả Phase 4:** Visual editor có thể chỉnh dịch gần như 100% text translatable:
- Resource fields (product/collection/page/article/policy)
- Theme locale keys
- Section/block settings
- Metafields/metaobjects

---

## Tổng kết

| Phase | Nội dung | Ship được |
|---|---|---|
| **Phase 0** | Foundation: embed data layer, exact value finder JS, app UI 2-state, backend skeleton | ✅ |
| **Phase 1** | Product page: title, description, variants | ✅ |
| **Phase 2** | Collection, Page, Article, Shop policies | ✅ |
| **Phase 3** | Theme locale strings — 100% coverage qua Admin Translations API, không hardcode | ✅ |
| **Phase 4** | Section/block settings, metafields, metaobjects | ✅ |

Mỗi phase tạo ra tính năng ship được, đồng thời đặt nền cho phase tiếp theo. Embed block data layer là "protocol" chung giữa theme và app — tương đương vai trò của snippet `translation-target.liquid` trong plan gốc, nhưng không yêu cầu ghi file theme hay Shopify exemption.
