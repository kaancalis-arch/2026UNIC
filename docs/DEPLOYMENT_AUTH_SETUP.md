# Vercel Deployment ve Auth Kurulumu

Bu dokümandaki yer tutucuları ilgili projenin değerleriyle doldurun. Gerçek anahtarları repository'ye, GitHub değişkenlerine veya dokümana yazmayın.

## 1. Vercel Projesi

Vercel projesinin build ayarları:

- Framework Preset: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`

Production ortamı için **Project Settings > Environment Variables** altında şu frontend değişkenlerini tanımlayın:

```text
VITE_SUPABASE_URL=https://<SUPABASE_PROJECT_REF>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<SUPABASE_PUBLISHABLE_KEY>
VITE_APP_URL=https://2026-unic.vercel.app
```

`VITE_*` değişkenleri build sırasında tarayıcı paketine yazılır ve gizli değildir. `VITE_SUPABASE_PUBLISHABLE_KEY` bu kullanım için tasarlanmış publishable/anon anahtar olmalıdır; service role key olmamalıdır.

Vercel serverless API tarafından kullanılan aşağıdaki değer yalnız Vercel'in server-side environment variable'ı olarak tanımlanır:

```text
N8N_UNIVERSITY_RESEARCH_WEBHOOK_URL=https://<N8N_HOST>/webhook/<WEBHOOK_PATH>
```

Webhook URL'sini `VITE_N8N_WEBHOOK_URL` adıyla tanımlamayın; `VITE_*` değerleri istemciye açılır. Gemini çağrıları kimlik doğrulamalı `ai-counselor` Supabase Edge Function üzerinden yapılır ve Gemini secret'ı frontend'e aktarılmaz.

`vercel.json` yalnız `/reset-password` ve `/reset-password/` isteklerini SPA giriş dosyası `/index.html` üzerine rewrite eder. Catch-all rewrite yoktur; `/api/*` ve `/assets/*` bu kuraldan etkilenmez.

## 2. Supabase Auth URL Configuration

Supabase Dashboard'da **Authentication > URL Configuration** bölümünü aşağıdaki şekilde yapılandırın:

```text
Site URL: https://2026-unic.vercel.app

Redirect URLs:
https://2026-unic.vercel.app/reset-password
https://2026-unic.vercel.app/reset-password/
http://localhost:5000/reset-password
http://localhost:5000/reset-password/
```

Production recovery e-postası `VITE_APP_URL` üzerinden `https://2026-unic.vercel.app/reset-password` adresine yönlenir. Farklı bir Vercel preview domain'i ile recovery doğrulanacaksa yalnız ihtiyaç duyulan tam preview callback URL'sini Redirect URLs listesine ayrıca ekleyin; geniş wildcard kullanmayın.

## 3. Supabase Edge Function Secrets

Supabase Dashboard'da **Edge Functions > Secrets** altında veya `supabase secrets set` ile şu değerleri tanımlayın:

```text
ALLOWED_ORIGINS=https://2026-unic.vercel.app,http://localhost:5000
SUPABASE_URL=https://<SUPABASE_PROJECT_REF>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<SUPABASE_SERVICE_ROLE_KEY>
PROJECT_SUPABASE_URL=https://<SUPABASE_PROJECT_REF>.supabase.co
PROJECT_SUPABASE_SERVICE_ROLE_KEY=<SUPABASE_SERVICE_ROLE_KEY>
FIRECRAWL_API_KEY=<FIRECRAWL_API_KEY>
GEMINI_API_KEY=<GEMINI_API_KEY>
```

- `ALLOWED_ORIGINS`, `create-system-user` ve `update-system-user` fonksiyonlarının tarayıcı origin kontrolünde kullanılır. Production'da yerel erişim gerekmiyorsa `http://localhost:5000` değerini kaldırın.
- `PROJECT_SUPABASE_URL`, `PROJECT_SUPABASE_SERVICE_ROLE_KEY` ve `FIRECRAWL_API_KEY`, `university-research` Edge Function tarafından kullanılır.
- `GEMINI_API_KEY`, yalnız `ai-counselor` Supabase Edge Function tarafından kullanılan server-side secret'tır. Vercel frontend/build ortamına, `VITE_GEMINI_*` veya başka bir `VITE_*` değişkenine, yerel `.env` dosyalarına ya da GitHub'a eklenemez.
- `SUPABASE_URL` ve `SUPABASE_SERVICE_ROLE_KEY`, Supabase tarafından hosted Edge Functions ortamına sağlanan yerleşik secret'lardır; `create-system-user` ve `update-system-user` bunları kullanır. Değerlerini frontend'e taşımayın.

Secret komutlarına gerçek değerleri yalnız yerel, güvenli terminal oturumunda verin. Komutları gerçek değerlerle shell history, CI logu veya dokümana kaydetmeyin.

## 4. Service Role Güvenlik Kuralları

`SUPABASE_SERVICE_ROLE_KEY`, `PROJECT_SUPABASE_SERVICE_ROLE_KEY` ve `GEMINI_API_KEY` sunucu sırlarıdır.

- Adı `VITE_` ile başlayan hiçbir değişkende tutulamaz.
- Vercel'in frontend/build için kullanılan environment variable'larına eklenemez.
- GitHub repository, Actions secret/variable, workflow dosyası, issue, log veya artifact içine yazılamaz.
- `.env`, `.env.example`, kaynak kod, istemci bundle'ı veya tarayıcı storage alanlarına yazılamaz.
- Service role key'ler yalnız Supabase Edge Function secret ortamında ve gerçekten server-side çalışan güvenilir servislerde kullanılmalıdır. `GEMINI_API_KEY` ise yalnız Supabase Edge Function secret ortamında tutulmalıdır.

Frontend yalnız publishable/anon key kullanır. Recovery token'ları uygulama tarafından loglanmaz veya ayrıca storage'a yazılmaz; oturum persistence'ı Supabase istemcisinin kendi yönetimindedir. Uygulama yalnız recovery akışının aktif olduğunu belirten boolean bir marker'ı geçerli sekmenin `sessionStorage` alanında tutar ve sign-out/başarılı parola güncellemesinde temizler.

## 5. Yayın Öncesi Kontrol Listesi

1. Vercel production domain'inin `https://2026-unic.vercel.app` olduğunu doğrulayın.
2. Üç frontend değişkeninin Production ortamında tanımlı olduğunu doğrulayın.
3. Supabase Site URL ve dört açık Redirect URL değerini doğrulayın.
4. Edge Function secret'larının doğru Supabase projesinde tanımlı olduğunu doğrulayın.
5. Hiçbir service role key'in veya `GEMINI_API_KEY` değerinin Vercel frontend ortamında, GitHub'da, yerel `.env` dosyalarında veya `VITE_*` değişkenlerinde bulunmadığını doğrulayın.
6. Anahtarları ve token'ları build, function veya browser console loglarında göstermeyin.
