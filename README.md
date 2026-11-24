# HyperTube

Kendini geliştirmeye odaklı kişisel YouTube: kendi seçtiğin kanallardan gelen videoları hedeflerine göre Gemini ile ön elemeden geçirir, her gün bir Akış hazırlar ve her video için zaman damgalı bir Syllabus üretir.

Terimler [`GLOSSARY.md`](GLOSSARY.md), kararlar [`docs/adr/`](docs/adr/) altında.

## Kurulum

```bash
npm install
./scripts/setup.sh   # Gemini, YouTube ve Supabase anahtarları + Vercel yayını, adım adım
npm run dev          # http://localhost:3000
```

Veritabanı şeması: [`supabase/migrations/`](supabase/migrations/). Tüm ortam değişkenleri: [`.env.example`](.env.example).

## Nasıl çalışır

1. Her sabah (Vercel Cron) kaynak kanalların son 50 videosu çekilir; Shorts ve 4 dakikadan kısa videolar atılır.
2. Yeni adaylar, yalnızca başlık ve açıklamalarıyla, Gemini'de hedeflerine göre puanlanır (ön eleme). Görüntülenme ve beğeni sayısı hiçbir zaman puana girmez (ADR-0001).
3. En iyi adaylardan günün Akış'ı kurulur; her hedefe en az iki yer ayrılır.
4. Bir videoyu açtığında Gemini videonun kendisini izleyip Türkçe Syllabus üretir (ADR-0004); sonuç saklanır.

## Geliştirme

```bash
npm test        # vitest
npx tsc --noEmit
npx eslint
```
