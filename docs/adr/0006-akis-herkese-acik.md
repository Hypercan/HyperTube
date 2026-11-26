# Akış herkese açık, salt okunur

Sahibin Akış'ı ve hazır syllabus'lar giriş yapmadan herkese açıktır; ziyaretçi videoyu izleyip var olan syllabus'u okuyabilir ama Gemini ya da YouTube kotası harcayan hiçbir şeyi (yeni derin analiz, arama, yenileme) tetikleyemez ve hedef adlarını görmez. Bu ADR-0002'yi değiştirmez: HyperTube hâlâ tek kullanıcılıdır, ziyaretçinin hesabı, kişisel Akış'ı ya da etkisi yoktur; ayrı bir paylaşım sayfası yerine şifre kontrolü bu sayfalar için kaldırıldı, çünkü en az kodla aynı sonucu verir.

## Considered Options

- Gizli paylaşım linki (`/paylas/<token>`): linki bilmeyen göremezdi, ama tek şifreli korumayla aynı sorunu çözmek için ikinci bir erişim mekanizması gerekirdi.
- Ziyaretçinin de syllabus ürettirebilmesi: günlük ücretsiz derin analiz kotası (ADR-0003) yabancıların tıklamasıyla tükenebilirdi.
