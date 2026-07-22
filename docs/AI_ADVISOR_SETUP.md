# UNIC AI Danışman Kurulumu

AI Danışman, gerçek danışmanın fiziksel öğrenci görüşmesine destek olur. Dış araştırma yapmaz, öğrenci sürecini otomatik değiştirmez ve danışman onayı olmadan rapor paylaşmaz.

## Güvenlik modeli

- Tarayıcı OpenAI ile doğrudan iletişim kurmaz.
- `OPENAI_API_KEY` yalnız Supabase Edge Function secret'ıdır.
- Öğrenci rolü modüle tamamen kapalıdır.
- Yetkili personel yalnız mevcut öğrenci/şube/atama kapsamındaki raporları görebilir.
- OpenAI'ye ad, e-posta, telefon, belge veya serbest profil verisi gönderilmez.
- İsteklerde `store: false` kullanılır ve hiçbir web/tool özelliği açılmaz.
- Rapor önce `draft`, ardından gerçek danışman onayıyla `approved` olur.
- Public bağlantı yalnız onaylı tek raporu gösterir; öğrenci profiline erişim vermez.

## Uygulama sırası

Canlı veritabanı yedeği ve read-only şema kontrolünden sonra:

1. Önceki kullanıcı, AI rate-limit ve güvenli öğrenci evrakı migration'larını zaman damgası sırasıyla uygulayın.
2. `20260722150000_create_ai_advisor_reports.sql` migration'ını uygulayın.
3. Supabase Edge Function secret'larını tanımlayın:

```text
ALLOWED_ORIGINS=https://2026-unic.vercel.app,http://localhost:5000
AI_PROVIDER=openai
OPENAI_API_KEY=<OPENAI_API_KEY>
OPENAI_MODEL=gpt-5.6-luna
```

4. Edge Function'ları deploy edin:

```text
ai-advisor
ai-advisor-share
```

5. Vercel deploy edin; `/share/report/:token` rewrite'ının çalıştığını doğrulayın.

Gerçek secret değerlerini komut geçmişine, GitHub'a, Vercel frontend değişkenlerine veya `VITE_*` isimli herhangi bir değişkene yazmayın.

## İlk canlı test matrisi

1. Anon kullanıcı `ai-advisor` çağrısında 401 almalı.
2. Öğrenci rolü 403 almalı.
3. Pasif personel 403 almalı.
4. Farklı şube veya atama dışındaki personel 403 almalı.
5. Yetkili danışman taslak oluşturabilmeli ve düzenleyebilmeli.
6. Taslak rapor için paylaşım bağlantısı oluşturulamamalı.
7. Danışman onayından sonra içerik değiştirilememeli.
8. Onaylı rapor için 72 saatlik link yalnız tek raporu göstermeli.
9. İptal edilmiş, süresi geçmiş veya kullanım limiti dolmuş link açılmamalı.
10. Rapor üretimi dakikada 10 ve 24 saatte 100 istek sınırını korumalı.

## UNIC kural yönetimi

Super Admin ve Admin, `System Settings > AI Danışman` ekranından kuruma özgü kısa kurallar ekler. Her rapor oluşturulurken kullanılan kurallar sürüm bilgisiyle rapora snapshot olarak kaydedilir. Daha sonra bir kural değişse bile geçmiş raporun hangi kurallarla üretildiği korunur.
