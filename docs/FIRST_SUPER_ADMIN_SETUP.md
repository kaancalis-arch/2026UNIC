# İlk Super Admin Kurulumu

İlk Super Admin uygulama içinden oluşturulamaz. Kullanıcı oluşturma Edge Function'ı yalnızca `public.system_users` tablosunda aktif Admin veya Super Admin profili bulunan, doğrulanmış bir Auth kullanıcısına izin verir. Sistemde henüz yönetici yokken bu güven zinciri Supabase Dashboard üzerinden bir kez kurulmalıdır.

## 1. Auth Kullanıcısını Oluşturun

1. Supabase Dashboard'da **Authentication > Users** ekranını açın.
2. **Add user** ile ilk yönetici hesabını oluşturun.
3. Güçlü ve geçici bir parola belirleyin.
4. Kullanıcının e-posta adresini doğrulanmış olarak oluşturun.
5. Oluşturulan kullanıcının UUID değerini kaydedin.

Service role key'i tarayıcıya, SQL Editor'a yazılan örnek verilere, frontend environment değişkenlerine veya repository dosyalarına yapıştırmayın.

## 2. System User Profilini Oluşturun

Supabase SQL Editor'da aşağıdaki şablonu kendi değerlerinizle çalıştırın. Örnekte gerçek e-posta veya UUID bulunmaz.

```sql
INSERT INTO public.system_users (
  id,
  full_name,
  email,
  role,
  branch_id,
  parent_user_id,
  status
)
VALUES (
  '<AUTH_USER_UUID>'::uuid,
  '<AD_SOYAD>',
  '<E_POSTA>',
  'Super Admin',
  NULL,
  NULL,
  'active'
);
```

`system_users.id` değeri, oluşturulan `auth.users.id` UUID değeriyle birebir aynı olmalıdır. Rol değeri tam olarak `Super Admin`, durum değeri tam olarak `active` olmalıdır. Super Admin için üst kullanıcı seçilmez; şube zorunlu değildir.

## 3. Güvenlik Kontrolleri

Kullanıcı yönetimini açmadan önce aşağıdaki migration'ların kontrollü biçimde uygulanmış olması gerekir:

- Kullanıcı hiyerarşisi doğrulama migration'ı
- Son aktif Super Admin koruması migration'ı

Son aktif Super Admin koruması uygulanmadan yönetici hesabını pasifleştirmeyin, rolünü değiştirmeyin veya silmeyin.

## 4. İlk Giriş

1. Uygulamaya oluşturduğunuz e-posta ve geçici parola ile giriş yapın.
2. Profil ve rolün doğru yüklendiğini doğrulayın.
3. İlk girişten sonra geçici parolayı güçlü ve benzersiz bir parola ile değiştirin.
4. Daha sonraki Admin ve Super Admin hesaplarını yalnız yetkili kullanıcı yönetimi akışı üzerinden oluşturun.
