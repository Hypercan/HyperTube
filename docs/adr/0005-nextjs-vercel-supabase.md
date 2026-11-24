# Next.js + Vercel + Supabase

HyperTube tek bir Next.js (TypeScript) uygulamasıdır; Vercel'in ücretsiz planında barındırılır ve veriler Supabase Postgres'te tutulur. Seçim ölçütü sıfır maliyet ve tek kişi için en az sürtünme: Vercel'in günde bir kez çalışan cron'u günlük akış için yeterli, GitHub'a push otomatik yayın demek; Supabase'in ücretsiz projesi bir hafta boşta kalınca duraklatıldığından günlük cron onu da canlı tutar. Uygulama internete açık ama tek kullanıcılı olduğundan (ADR-0002) tek bir şifreyle korunur; API anahtarları yalnızca ortam değişkenlerinde durur, böylece repo açık kaynak olabilir.

## Considered Options

- Cloudflare Workers + D1 + Cron: o da ücretsiz, ancak Next.js orada ek uyarlama katmanı istiyor.
