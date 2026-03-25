---
description: Otomatik Büyük-Küçük Harf Düzenleme (Title Case Standardization)
---

# ✨ Otomatik Büyük-Küçük Harf Düzenleme (Title Case Standardization)

## 🎯 Amaç
Kullanıcının sisteme girdiği tüm metinlerin (örneğin bölüm adı, şehir, program adı vb.) otomatik olarak **düzgün Büyük-Küçük harf formatına (Title Case)** dönüştürülmesi.

Örnek:
- `bilgisayar mühendisliği` → **Bilgisayar Mühendisliği**
- `istanbul teknik üniversitesi` → **İstanbul Teknik Üniversitesi**

---

## ⚙️ Beklenen Davranış

Sistem aşağıdaki şekilde çalışmalıdır:

1. Kullanıcı input alanına veri girer.
2. Yazım anında (real-time) veya onBlur anında (imleç bozulmasını önlemek için):
   - Metin otomatik olarak düzeltilir.
   - Input içinde anında doğru format görünür.
3. Veritabanına kayıt edilirken:
   - Her zaman standart formatta kaydedilir.
   - Veri tutarlılığı sağlanır.

---

## 🧠 Format Kuralları

### 1. Genel Kural
- Her kelimenin ilk harfi büyük, geri kalan harfler küçük olmalıdır.

**Örnek:**
- `makine mühendisliği` → `Makine Mühendisliği`

---

### 2. Türkçe Karakter Desteği
- Türkçe karakterler doğru işlenmelidir:
  - i → İ
  - ı → I
  - ç, ş, ğ, ö, ü korunmalı

---

### 3. İstisnalar (İsteğe Bağlı)
Aşağıdaki bağlaçlar küçük kalabilir (opsiyonel):

- ve
- ile
- için
- veya

**Örnek:**
- `uluslararası ticaret ve işletme`  
→ `Uluslararası Ticaret ve İşletme`

---

## 💻 Frontend Davranışı

### Real-time / onBlur Dönüşümü:
- Kullanıcı yazarken otomatik düzeltme yapılır (cursor pozisyonu bozulmamalıdır; bunu sağlamak için React içerisinde genellikle `onBlur` anında veya özel bir cursor tracking state'i ile uygulanır).

### Kullanılacak Gelişmiş TypeScript/JavaScript Fonksiyonu:

```javascript
export function formatTitleCase(text) {
  if (!text) return text;
  
  const exceptions = ["ve", "ile", "için", "veya"];
  
  return text
    .toLocaleLowerCase('tr-TR')
    .split(' ')
    .map((word, index) => {
      // Eğer kelime istisnalar listesindeyse ve ilk kelime değilse, küçük harf bırak.
      if (exceptions.includes(word) && index !== 0) {
        return word;
      }
      return word.charAt(0).toLocaleUpperCase('tr-TR') + word.slice(1);
    })
    .join(' ');
}
```

Bu kural dokümanı, gelecekte eklenecek tüm input, modal ve veri girişi alanlarında zorunlu bir workflow olarak uygulanmalıdır.
