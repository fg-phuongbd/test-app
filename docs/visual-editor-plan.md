Yêu cầu: tôi muốn làm chức năng visual editor, là một công cụ cho phép user chỉnh sửa / cấu hình nội dung dịch trực tiếp trên giao diện store của khách, nhưng tận dụng bản dịch từ shopify

Tài liệu quan trọng nhất cho case này là:

Support multiple languages on storefronts (Storefront API)
Building localized experiences with the Storefront API and Shopify Markets
Ví dụ query sản phẩm có dịch: product query – “Load translated and localized content for a product”
1. Ý tưởng tổng thể cho “visual translation editor”
Mục tiêu của bạn:

Cho user (content editor) mở giao diện storefront thực tế (VD: product page, collection page…)
Cho phép họ click trực tiếp vào text (title sản phẩm, description, menu, policy, page content, v.v.)
Xem / sửa bản dịch của text đó cho từng ngôn ngữ
Tận dụng các bản dịch đã tạo sẵn trong Shopify (qua Admin hoặc Translations API), chứ không tạo hệ thống dịch riêng.
Về mặt kiến trúc, có thể chia thành 3 phần:
Frontend overlay / editor UI

Một “layer” JS chồng lên storefront (nếu là Online Store theme) / hoặc một custom storefront (Hydrogen / React app).
Layer này highlight các đoạn text “translatable”, cho phép click vào và mở một sidebar / popup editor.
Storefront API (GraphQL) để:

Lấy nội dung đã dịch theo ngôn ngữ (title, descriptionHtml, page content, blog article, policies, v.v.) qua directive @inContext(language: XX).
Biết được shop có những ngôn ngữ nào đang bật, để render language switcher trong editor.
Admin side (ngoài phạm vi Storefront API)

Để lưu lại bản dịch mà user chỉnh sửa, cần dùng Admin GraphQL API / Translations API.
Storefront API chỉ là read translations (bên phía khách truy cập); write translations là việc của Admin/Translations API.
Tuy nhiên, phần này nằm ngoài phạm vi Storefront GraphQL Storefront API mà chúng ta đang tập trung, nên ở đây mình sẽ tập trung vào phần đọc dữ liệu dịch để hiển thị trong visual editor.
2. Những gì Storefront API hỗ trợ cho đa ngôn ngữ
Các tài liệu nền tảng:

Tổng quan localization: Building localized experiences with the Storefront API and Shopify Markets
Query list ngôn ngữ và country: Support multiple languages on storefronts
2.1. Danh sách ngôn ngữ của shop
Bạn có thể dùng object localization để biết:

availableLanguages – Các ngôn ngữ đang bật cho market hiện tại.
availableCountries – Các country + languages tương ứng.
Ví dụ query (đã được validate với Storefront schema):

query LocalizationLanguages @inContext(country: US, language: EN){
  localization {
    availableLanguages {
      isoCode
      endonymName
    }
    availableCountries {
      isoCode
      name
      availableLanguages {
        isoCode
        endonymName
      }
    }
  }
}
Tài liệu localization nằm trong guide: Support multiple languages on storefronts.
Dùng kết quả này để:

Render list ngôn ngữ (EN, FR, DE, VI…) trong visual editor.
Biết language code (kiểu LanguageCode) để set context khi query nội dung cho visual editor.
2.2. Lấy nội dung đã dịch cho 1 resource cụ thể
Storefront API hỗ trợ @inContext(language: XX, country: YY) trên hầu hết các query.

Danh sách resource có thể dịch (trích từ Building localized experiences with Markets):

Product – title, descriptionHtml, description
ProductVariant – title, selectedOptions
Collection – title, descriptionHtml, description
Page – title, body
Article – title, content, contentHtml, excerpt, excerptHtml
Blog – title
ShopPolicy – body
Metafield.value (nếu bạn dùng metafield để chứa content tùy chỉnh)
Với visual editor, bạn có thể:

Query cùng một resource nhưng với nhiều ngôn ngữ khác nhau (nhiều request hoặc trong backend “fan-out” nhiều request song song).
Xây UI kiểu “language tabs” để thấy từng bản dịch cạnh nhau.
3. Ví dụ query để dùng trong visual editor
3.1. Lấy sản phẩm + bản dịch cho 1 ngôn ngữ
Đây là ví dụ query sản phẩm theo handle, với context language và country.
Query này đã được validate với Storefront API (lưu ý ProductOption.values đã deprecated; nên nếu cần, bạn có thể đổi sang optionValues, nhưng nhiều store vẫn dùng values được – mình sẽ giữ cho đơn giản ở đây, bạn có thể tối ưu sau):

query ProductTranslations(
  $handle: String!,
  $language: LanguageCode!,
  $country: CountryCode!
) @inContext(country: $country, language: $language) {
  product(handle: $handle) {
    id
    title
    descriptionHtml
    options {
      name
      values
    }
    variants(first: 10) {
      nodes {
        id
        title
        price {
          amount
          currencyCode
        }
        availableForSale
      }
    }
  }
}
Pattern này dựa trên ví dụ chính thức “Load translated and localized content for a product” trong docs product query.
Cách dùng trong visual editor:

User chọn 1 product trên UI (hoặc bạn detect từ URL/handle hiện tại).
Backend của bạn gọi query trên với:
handle: handle của sản phẩm trên page hiện tại
country: country của market muốn xem (VD: US)
language: EN, FR, DE, … tùy tab đang mở trong editor
Frontend hiển thị:
title (ví dụ: “Camiseta blanca” ở ES),
descriptionHtml (HTML đã dịch),
options, variants… đều là bản dịch.
Lưu ý performance: visual editor chỉ cần 1 số field quan trọng, nên đừng query quá nhiều field không cần thiết để tránh payload nặng. Storefront API chạy trên client/headless, ảnh hưởng UX.

3.2. Lấy Page / Article / Blog / Policy đã dịch
Tùy bạn muốn cho edit loại nội dung nào, pattern đều giống nhau: dùng @inContext.

Ví dụ (pseudo, không cần full triển khai ở đây):
query PageTranslations(
  $handle: String!,
  $language: LanguageCode!,
  $country: CountryCode!
) @inContext(country: $country, language: $language) {
  page(handle: $handle) {
    id
    title
    body
  }
}

query ArticleTranslations(
  $handle: String!,
  $blogHandle: String!,
  $language: LanguageCode!,
  $country: CountryCode!
) @inContext(country: $country, language: $language) {
  blog(handle: $blogHandle) {
    articleByHandle(handle: $handle) {
      id
      title
      contentHtml
      excerptHtml
    }
  }
}
Tương tự với shop { privacyPolicy { body } } v.v. khi bạn cần hiển thị/cho editor sửa nội dung các policy.

4. Cách “map” giữa text trên UI và resource trong Shopify
Đây là phần khó nhất của một visual editor, không nằm riêng trong Shopify:

Product/collection page

Dùng URL / handle để xác định resource hiện tại (product(handle: ...), collection(handle: ...)).
Text trên page (VD: title, description) nên được render từ đúng GraphQL data đó, kèm theo metadata (VD: data-translation-key="product.title" hoặc data-shopify-id="gid://shopify/Product/...").
Visual editor overlay đọc metadata này để biết “đây là field nào của resource nào”.
Page / blog article / menu / custom content

Tương tự: mỗi khối text trong theme / app UI nên gắn 1 identifier (VD: data-resource-type="Page" data-resource-id="..." data-field="body").
Khi user click, editor biết phải call query nào để lấy bản dịch, và sau đó sẽ send update về Admin API khi người dùng lưu.
Metafields

Nếu bạn muốn cho chỉnh sửa các nội dung custom (VD: heading trong section, banner text…), bạn có thể đưa chúng vào metafield (đã cấu hình translatable) và dùng Storefront API để đọc:
metafield(namespace: "...", key: "...") { value } trong context ngôn ngữ tương ứng.
Tài liệu về translatable metafields: trong phần Building localized experiences with Markets.
5. Luồng hoạt động mẫu của visual translation editor
Giả sử bạn làm một app riêng, có iframe/overlay xuất hiện trên storefront:

Khởi tạo editor

Gọi query LocalizationLanguages (ở trên) để lấy list ngôn ngữ, hiển thị language switcher.
Detect URL hiện tại để biết đang ở product/collection/page nào.
Load nội dung gốc + bản dịch

Với mỗi block text editable, editor biết đó là field nào (VD: product title, page body…).
Gọi query Storefront tương ứng với @inContext(language: activeLang) để lấy bản dịch.
Bên cạnh đó, bạn có thể gọi thêm 1 query @inContext(language: defaultLang) để hiển thị original text cho reference (tùy UI).
Cho phép user chỉnh sửa

Người dùng edit text trong một form / inline editor.
Khi Save, không thể dùng Storefront API để update – phải gọi Admin GraphQL / Translations API từ server app của bạn để ghi lại bản dịch. (Đây là phần ngoài scope Storefront API, nhưng rất quan trọng về mặt kiến trúc.)
Refresh preview

Sau khi lưu, bạn có thể:
Gọi lại Storefront query @inContext(language: activeLang) để lấy bản dịch đã cập nhật, và update DOM, hoặc
Reload toàn page với query param hoặc header ngôn ngữ phù hợp (nếu là Hydrogen / headless).
6. Lưu ý quan trọng
Phân quyền & bảo mật:

Visual editor là công cụ cho merchant/staff, không phải cho public user.
Nên chạy trong môi trường đã authenticated (VD: từ Shopify Admin app, embedded app, proxy…).
Storefront API token là public-facing, dùng để đọc dữ liệu.
Admin API token phải để ở backend để ghi translations.
Hiệu năng:

Editor thường cần nhiều query (vì nhiều block text). Hãy tối ưu:
Gộp nhiều field của cùng resource vào 1 query.
Cache kết quả theo resource+language trên backend.
Với Storefront API, chỉ query field thực sự cần cho UI editor.
Khả năng mở rộng:

Bắt đầu với các resource chính (Product, Collection, Page, Article).
Sau đó mở rộng thêm Metafields cho phần content “cấu hình” (section settings, banner, CTA text, v.v.).
