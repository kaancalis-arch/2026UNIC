# Güvenli Öğrenci Belgesi Modülü

Bu modül, öğrenci belgelerini private `student-documents` bucket'ında ve belge metadatasını ilişkisel tablolarda tutar. Mevcut `student_profiles.analysis.documents` legacy alanına dokunulmaz ve bu alandan otomatik veri taşınmaz.

Bu dosyanın ve migration dosyalarının repoda bulunması hiçbir migration'ın uygulanmış veya function'ın deploy edilmiş olduğu anlamına gelmez.

## Bileşenler

- `document_types`: Aktif/pasif, zorunlu, çoklu belge ve sıralama kurallarını içerir. Aktif sistem kullanıcıları okuyabilir; aktif Admin ve Super Admin yazabilir.
- `student_documents`: Öğrenci, tür, şube, yükleyen kullanıcı, Storage yolu, MIME, boyut, SHA-256, sürüm ve `uploaded/approved/rejected/archived` durumunu tutar.
- `student_document_share_links`: Yalnız SHA-256 token hash'i, sona erme, görüntüleme limiti/sayacı ve iptal bilgisini tutar.
- `student_document_audit_log`: Yükleme, dahili görüntüleme URL'si, paylaşım oluşturma/kullanma/iptal, arşiv ve kalıcı silme olaylarını tutar.
- `student-documents`: Public olmayan, 3 MB limitli PDF/PNG/JPEG/WEBP Storage bucket'ıdır.

Belge, paylaşım ve audit tablolarında browser rolleri için doğrudan yetki veya RLS policy yoktur. Erişim yalnız service-role kullanan Edge Function'lar üzerinden sağlanır. Service-role anahtarı hiçbir zaman istemciye verilmemelidir.

## Migration Sırası

1. Canlı veritabanının yedeğini alın.
2. Önce `supabase/migrations/20260722120000_create_document_types.sql` dosyasını inceleyip uygulayın.
3. Sonra `supabase/migrations/20260722121000_create_secure_student_documents.sql` dosyasını inceleyip uygulayın.
4. İkinci migration mevcut `storage.objects` policy'lerini inceler. `student-documents` literal'ine açıkça bağlı policy'leri kaldırır, başka bucket'a açıkça bağlı policy'lere dokunmaz ve broad/opaque bir policy görürse fail closed davranır.
5. Migration'lar bu çalışma kapsamında çalıştırılmamıştır.

`document_types` önceden varsa migration beklenen kolon tiplerini, NOT NULL durumunu ve primary key'i doğrular; uyumsuz şemayı sessizce kabul etmez. Öğrenci belge tablolarından biri önceden varsa ikinci migration veri veya şema üzerine yazmak yerine açık hata ile durur. Migration'lar mevcut belge verisi silmez.

## Edge Function'lar

`student-documents` function'ı JWT doğrulamasıyla çalışır ve tam olarak `Bearer <token>` ister. POST JSON işlemleri:

- `list`: `student_id`; isteğe bağlı `document_id` verilirse en fazla 300 saniyelik dahili signed URL üretir.
- `archive`: `document_id`; belgeyi varsayılan silme davranışı olarak arşivler ve aktif paylaşımları iptal eder.
- `create_share_link`: `document_id`, isteğe bağlı `expires_in_hours` (`24`, `72`, `168`, varsayılan `72`) ve `max_views`.
- `revoke_share_link`: `share_link_id`.
- `permanent_delete`: `document_id`; yalnız Super Admin.

Yükleme `multipart/form-data` ile `operation=upload`, `student_id`, `document_type_id` ve `file` alanlarını kullanır. Sunucu 3 MB sınırını, magic byte/MIME eşleşmesini doğrular; belge UUID'sini ve `<branch_uuid>/<student_uuid>/<document_uuid>/<random_uuid>.<canonical_ext>` yolunu üretir ve SHA-256 hesaplar.

`student-document-share` function'ı gateway JWT doğrulaması olmadan public çalışır, fakat yalnız `{ "token": "..." }` kabul eder. Token server tarafında hash'lenir ve security-definer RPC paylaşımı row lock ile atomik tüketir. Function en fazla 300 saniyelik signed URL ile yalnız belge kimliği, dosya adı ve MIME türünü döndürür.

## Yetkilendirme

- Öğrenci rolü reddedilir.
- Super Admin ve Admin tüm aktif şubelerde global erişir.
- Şube Müdürü yalnız `student_profiles.branch_id` kendi aktif şubesiyle eşleşen öğrencilere erişir.
- Danışman, Temsilci ve Öğrenci Temsilci yalnız `student_profiles.counselor_id` doğrudan kendi kullanıcı kimliğine eşitse erişir.
- Yeni yetkilendirmede `representative_id` kullanılmaz.
- Hem aktör profili/şubesi hem hedef öğrencinin şubesi aktif olmalıdır.

## Yapılandırma

`supabase/config.toml` ayarları:

```toml
[functions.student-documents]
verify_jwt = true

[functions.student-document-share]
verify_jwt = false
```

Function ortamında `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` ve ortak CORS helper'ının kullandığı `ALLOWED_ORIGINS` tanımlı olmalıdır. Public paylaşım endpoint'ini browser'dan kullanacak origin de allowlist'e eklenmelidir.

## Doğrulama Kontrolü

- Admin/global, Şube Müdürü/şube ve doğrudan `counselor_id` ataması senaryolarını test edin.
- `representative_id` ile tek başına erişimin reddedildiğini test edin.
- Pasif kullanıcı, pasif şube ve Öğrenci rolünün reddedildiğini test edin.
- Yanlış magic byte, yanlış MIME ve 3 MB üzeri yüklemeyi test edin.
- Süresi dolmuş, iptal edilmiş ve limiti dolmuş paylaşım tokenlarını test edin.
- Browser anahtarıyla tablolara ve bucket'a doğrudan erişilemediğini doğrulayın.
- Her başarılı operasyon için audit kaydını doğrulayın.
