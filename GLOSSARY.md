# HyperTube

Kendini geliştirmeye odaklı, tek kullanıcılı kişisel YouTube istemcisi: videoları kullanıcının hedeflerine göre seçip sıralar ve her biri için bir syllabus sunar.

## Language

### Hedefler ve içerik

**Hedef**:
Kullanıcının açıkça tanımladığı bir kendini geliştirme yönü (ör. "backend mühendisliği"); akış hedeflere göre şekillenir.
_Avoid_: İlgi alanı, kategori, konu

**Kaynak kanal**:
Kullanıcının videolarını düzenli olarak aday havuzuna almak istediği, kendi seçtiği bir YouTube kanalı.
_Avoid_: Abonelik, takip edilen kanal

**Keşif araması**:
Bir hedef için, kaynak kanalların dışındaki videoları bulmak amacıyla günde bir kez otomatik yapılan arama; sorguları Gemini yazar ve her gün öncekilerden farklı olur.
_Avoid_: Sorgu, search

**Arama**:
Kullanıcının elle yaptığı YouTube araması; sonuçlar ön elemeden geçirilip hedeflere göre puanıyla sıralanır.
_Avoid_: Keşif araması (o otomatiktir)

**Aday**:
Kaynak kanallardan, keşif aramasından veya aramadan gelmiş, henüz akışa girip girmeyeceği belirlenmemiş video.
_Avoid_: Sonuç, öneri

### Değerlendirme

**Ön eleme**:
Bir adayın yalnızca metin bilgilerinden hedefe uygunluk, derinlik ve öğreticilik açısından puanlandığı ilk değerlendirme; akışın sırası bu puana göre belirlenir.
_Avoid_: Filtre, skor, ranking

**Derin analiz**:
Videonun kendi içeriğinin incelenip syllabus üretildiği ikinci değerlendirme.
_Avoid_: Transkripsiyon, özetleme

### Sunum

**Akış**:
HyperTube'un ana deneyimi; günde bir kez hazırlanan, ön eleme puanına göre sıralanmış video listesi. Yeni ve eski videoları birlikte içerir.
_Avoid_: Feed, ana sayfa, öneriler, timeline

**Syllabus**:
Bir video için derin analizle üretilen, kalıcı olarak saklanan yapılandırılmış rehber: ana fikir, kime hitap ettiği ve ön koşullar, zaman damgalı bölümler, anahtar çıkarımlar. Video dilinden bağımsız olarak her zaman Türkçedir.
_Avoid_: Özet, summary, transkript

**Kütüphane**:
Kullanıcının kaydettiği videoların, syllabus'larıyla birlikte durduğu yer; her video bir hedefe bağlıdır ve bir durumu vardır: izlenecek, izleniyor, tamamlandı.
_Avoid_: Kuyruk, daha sonra izle, playlist, kaydedilenler
