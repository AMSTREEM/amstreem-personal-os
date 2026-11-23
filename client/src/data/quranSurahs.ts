// Qur'an structural metadata for the standard 604-page Madinah Mushaf (Hafs 'an Asim).
// Surah and page metadata sourced from Tanzil.net via Mushaf-Learning/quran-text.
// Tanzil metadata is distributed under CC BY 3.0; retain this attribution.
export type QuranSurah = { number:number; arabic:string; transliteration:string; english:string; ayahs:number; revelation:'Meccan'|'Medinan'; juzStart:number; pageStart:number };
export const QURAN_SURAHS: QuranSurah[] = [
  {
    "number": 1,
    "arabic": "الفاتحة",
    "transliteration": "Al-Faatiha",
    "english": "The Opening",
    "ayahs": 7,
    "revelation": "Meccan",
    "juzStart": 1,
    "pageStart": 1
  },
  {
    "number": 2,
    "arabic": "البقرة",
    "transliteration": "Al-Baqara",
    "english": "The Cow",
    "ayahs": 286,
    "revelation": "Medinan",
    "juzStart": 1,
    "pageStart": 2
  },
  {
    "number": 3,
    "arabic": "آل عمران",
    "transliteration": "Aal-i-Imraan",
    "english": "The Family of Imraan",
    "ayahs": 200,
    "revelation": "Medinan",
    "juzStart": 3,
    "pageStart": 50
  },
  {
    "number": 4,
    "arabic": "النساء",
    "transliteration": "An-Nisaa",
    "english": "The Women",
    "ayahs": 176,
    "revelation": "Medinan",
    "juzStart": 4,
    "pageStart": 77
  },
  {
    "number": 5,
    "arabic": "المائدة",
    "transliteration": "Al-Maaida",
    "english": "The Table",
    "ayahs": 120,
    "revelation": "Medinan",
    "juzStart": 6,
    "pageStart": 106
  },
  {
    "number": 6,
    "arabic": "الأنعام",
    "transliteration": "Al-An'aam",
    "english": "The Cattle",
    "ayahs": 165,
    "revelation": "Meccan",
    "juzStart": 7,
    "pageStart": 128
  },
  {
    "number": 7,
    "arabic": "الأعراف",
    "transliteration": "Al-A'raaf",
    "english": "The Heights",
    "ayahs": 206,
    "revelation": "Meccan",
    "juzStart": 8,
    "pageStart": 151
  },
  {
    "number": 8,
    "arabic": "الأنفال",
    "transliteration": "Al-Anfaal",
    "english": "The Spoils of War",
    "ayahs": 75,
    "revelation": "Medinan",
    "juzStart": 9,
    "pageStart": 177
  },
  {
    "number": 9,
    "arabic": "التوبة",
    "transliteration": "At-Tawba",
    "english": "The Repentance",
    "ayahs": 129,
    "revelation": "Medinan",
    "juzStart": 10,
    "pageStart": 187
  },
  {
    "number": 10,
    "arabic": "يونس",
    "transliteration": "Yunus",
    "english": "Jonas",
    "ayahs": 109,
    "revelation": "Meccan",
    "juzStart": 11,
    "pageStart": 208
  },
  {
    "number": 11,
    "arabic": "هود",
    "transliteration": "Hud",
    "english": "Hud",
    "ayahs": 123,
    "revelation": "Meccan",
    "juzStart": 11,
    "pageStart": 221
  },
  {
    "number": 12,
    "arabic": "يوسف",
    "transliteration": "Yusuf",
    "english": "Joseph",
    "ayahs": 111,
    "revelation": "Meccan",
    "juzStart": 12,
    "pageStart": 235
  },
  {
    "number": 13,
    "arabic": "الرعد",
    "transliteration": "Ar-Ra'd",
    "english": "The Thunder",
    "ayahs": 43,
    "revelation": "Medinan",
    "juzStart": 13,
    "pageStart": 249
  },
  {
    "number": 14,
    "arabic": "ابراهيم",
    "transliteration": "Ibrahim",
    "english": "Abraham",
    "ayahs": 52,
    "revelation": "Meccan",
    "juzStart": 13,
    "pageStart": 255
  },
  {
    "number": 15,
    "arabic": "الحجر",
    "transliteration": "Al-Hijr",
    "english": "The Rock",
    "ayahs": 99,
    "revelation": "Meccan",
    "juzStart": 14,
    "pageStart": 262
  },
  {
    "number": 16,
    "arabic": "النحل",
    "transliteration": "An-Nahl",
    "english": "The Bee",
    "ayahs": 128,
    "revelation": "Meccan",
    "juzStart": 14,
    "pageStart": 267
  },
  {
    "number": 17,
    "arabic": "الإسراء",
    "transliteration": "Al-Israa",
    "english": "The Night Journey",
    "ayahs": 111,
    "revelation": "Meccan",
    "juzStart": 15,
    "pageStart": 282
  },
  {
    "number": 18,
    "arabic": "الكهف",
    "transliteration": "Al-Kahf",
    "english": "The Cave",
    "ayahs": 110,
    "revelation": "Meccan",
    "juzStart": 15,
    "pageStart": 293
  },
  {
    "number": 19,
    "arabic": "مريم",
    "transliteration": "Maryam",
    "english": "Mary",
    "ayahs": 98,
    "revelation": "Meccan",
    "juzStart": 16,
    "pageStart": 305
  },
  {
    "number": 20,
    "arabic": "طه",
    "transliteration": "Taa-Haa",
    "english": "Taa-Haa",
    "ayahs": 135,
    "revelation": "Meccan",
    "juzStart": 16,
    "pageStart": 312
  },
  {
    "number": 21,
    "arabic": "الأنبياء",
    "transliteration": "Al-Anbiyaa",
    "english": "The Prophets",
    "ayahs": 112,
    "revelation": "Meccan",
    "juzStart": 17,
    "pageStart": 322
  },
  {
    "number": 22,
    "arabic": "الحج",
    "transliteration": "Al-Hajj",
    "english": "The Pilgrimage",
    "ayahs": 78,
    "revelation": "Medinan",
    "juzStart": 17,
    "pageStart": 332
  },
  {
    "number": 23,
    "arabic": "المؤمنون",
    "transliteration": "Al-Muminoon",
    "english": "The Believers",
    "ayahs": 118,
    "revelation": "Meccan",
    "juzStart": 18,
    "pageStart": 342
  },
  {
    "number": 24,
    "arabic": "النور",
    "transliteration": "An-Noor",
    "english": "The Light",
    "ayahs": 64,
    "revelation": "Medinan",
    "juzStart": 18,
    "pageStart": 350
  },
  {
    "number": 25,
    "arabic": "الفرقان",
    "transliteration": "Al-Furqaan",
    "english": "The Criterion",
    "ayahs": 77,
    "revelation": "Meccan",
    "juzStart": 18,
    "pageStart": 359
  },
  {
    "number": 26,
    "arabic": "الشعراء",
    "transliteration": "Ash-Shu'araa",
    "english": "The Poets",
    "ayahs": 227,
    "revelation": "Meccan",
    "juzStart": 19,
    "pageStart": 367
  },
  {
    "number": 27,
    "arabic": "النمل",
    "transliteration": "An-Naml",
    "english": "The Ant",
    "ayahs": 93,
    "revelation": "Meccan",
    "juzStart": 19,
    "pageStart": 377
  },
  {
    "number": 28,
    "arabic": "القصص",
    "transliteration": "Al-Qasas",
    "english": "The Stories",
    "ayahs": 88,
    "revelation": "Meccan",
    "juzStart": 20,
    "pageStart": 385
  },
  {
    "number": 29,
    "arabic": "العنكبوت",
    "transliteration": "Al-Ankaboot",
    "english": "The Spider",
    "ayahs": 69,
    "revelation": "Meccan",
    "juzStart": 20,
    "pageStart": 396
  },
  {
    "number": 30,
    "arabic": "الروم",
    "transliteration": "Ar-Room",
    "english": "The Romans",
    "ayahs": 60,
    "revelation": "Meccan",
    "juzStart": 21,
    "pageStart": 404
  },
  {
    "number": 31,
    "arabic": "لقمان",
    "transliteration": "Luqman",
    "english": "Luqman",
    "ayahs": 34,
    "revelation": "Meccan",
    "juzStart": 21,
    "pageStart": 411
  },
  {
    "number": 32,
    "arabic": "السجدة",
    "transliteration": "As-Sajda",
    "english": "The Prostration",
    "ayahs": 30,
    "revelation": "Meccan",
    "juzStart": 21,
    "pageStart": 415
  },
  {
    "number": 33,
    "arabic": "الأحزاب",
    "transliteration": "Al-Ahzaab",
    "english": "The Clans",
    "ayahs": 73,
    "revelation": "Medinan",
    "juzStart": 21,
    "pageStart": 418
  },
  {
    "number": 34,
    "arabic": "سبإ",
    "transliteration": "Saba",
    "english": "Sheba",
    "ayahs": 54,
    "revelation": "Meccan",
    "juzStart": 22,
    "pageStart": 428
  },
  {
    "number": 35,
    "arabic": "فاطر",
    "transliteration": "Faatir",
    "english": "The Originator",
    "ayahs": 45,
    "revelation": "Meccan",
    "juzStart": 22,
    "pageStart": 434
  },
  {
    "number": 36,
    "arabic": "يس",
    "transliteration": "Yaseen",
    "english": "Yaseen",
    "ayahs": 83,
    "revelation": "Meccan",
    "juzStart": 22,
    "pageStart": 440
  },
  {
    "number": 37,
    "arabic": "الصافات",
    "transliteration": "As-Saaffaat",
    "english": "Those drawn up in Ranks",
    "ayahs": 182,
    "revelation": "Meccan",
    "juzStart": 23,
    "pageStart": 446
  },
  {
    "number": 38,
    "arabic": "ص",
    "transliteration": "Saad",
    "english": "The letter Saad",
    "ayahs": 88,
    "revelation": "Meccan",
    "juzStart": 23,
    "pageStart": 453
  },
  {
    "number": 39,
    "arabic": "الزمر",
    "transliteration": "Az-Zumar",
    "english": "The Groups",
    "ayahs": 75,
    "revelation": "Meccan",
    "juzStart": 23,
    "pageStart": 458
  },
  {
    "number": 40,
    "arabic": "غافر",
    "transliteration": "Al-Ghaafir",
    "english": "The Forgiver",
    "ayahs": 85,
    "revelation": "Meccan",
    "juzStart": 24,
    "pageStart": 467
  },
  {
    "number": 41,
    "arabic": "فصلت",
    "transliteration": "Fussilat",
    "english": "Explained in detail",
    "ayahs": 54,
    "revelation": "Meccan",
    "juzStart": 24,
    "pageStart": 477
  },
  {
    "number": 42,
    "arabic": "الشورى",
    "transliteration": "Ash-Shura",
    "english": "Consultation",
    "ayahs": 53,
    "revelation": "Meccan",
    "juzStart": 25,
    "pageStart": 483
  },
  {
    "number": 43,
    "arabic": "الزخرف",
    "transliteration": "Az-Zukhruf",
    "english": "Ornaments of gold",
    "ayahs": 89,
    "revelation": "Meccan",
    "juzStart": 25,
    "pageStart": 489
  },
  {
    "number": 44,
    "arabic": "الدخان",
    "transliteration": "Ad-Dukhaan",
    "english": "The Smoke",
    "ayahs": 59,
    "revelation": "Meccan",
    "juzStart": 25,
    "pageStart": 496
  },
  {
    "number": 45,
    "arabic": "الجاثية",
    "transliteration": "Al-Jaathiya",
    "english": "Crouching",
    "ayahs": 37,
    "revelation": "Meccan",
    "juzStart": 25,
    "pageStart": 499
  },
  {
    "number": 46,
    "arabic": "الأحقاف",
    "transliteration": "Al-Ahqaf",
    "english": "The Dunes",
    "ayahs": 35,
    "revelation": "Meccan",
    "juzStart": 26,
    "pageStart": 502
  },
  {
    "number": 47,
    "arabic": "محمد",
    "transliteration": "Muhammad",
    "english": "Muhammad",
    "ayahs": 38,
    "revelation": "Medinan",
    "juzStart": 26,
    "pageStart": 507
  },
  {
    "number": 48,
    "arabic": "الفتح",
    "transliteration": "Al-Fath",
    "english": "The Victory",
    "ayahs": 29,
    "revelation": "Medinan",
    "juzStart": 26,
    "pageStart": 511
  },
  {
    "number": 49,
    "arabic": "الحجرات",
    "transliteration": "Al-Hujuraat",
    "english": "The Inner Apartments",
    "ayahs": 18,
    "revelation": "Medinan",
    "juzStart": 26,
    "pageStart": 515
  },
  {
    "number": 50,
    "arabic": "ق",
    "transliteration": "Qaaf",
    "english": "The letter Qaaf",
    "ayahs": 45,
    "revelation": "Meccan",
    "juzStart": 26,
    "pageStart": 518
  },
  {
    "number": 51,
    "arabic": "الذاريات",
    "transliteration": "Adh-Dhaariyat",
    "english": "The Winnowing Winds",
    "ayahs": 60,
    "revelation": "Meccan",
    "juzStart": 26,
    "pageStart": 520
  },
  {
    "number": 52,
    "arabic": "الطور",
    "transliteration": "At-Tur",
    "english": "The Mount",
    "ayahs": 49,
    "revelation": "Meccan",
    "juzStart": 27,
    "pageStart": 523
  },
  {
    "number": 53,
    "arabic": "النجم",
    "transliteration": "An-Najm",
    "english": "The Star",
    "ayahs": 62,
    "revelation": "Meccan",
    "juzStart": 27,
    "pageStart": 526
  },
  {
    "number": 54,
    "arabic": "القمر",
    "transliteration": "Al-Qamar",
    "english": "The Moon",
    "ayahs": 55,
    "revelation": "Meccan",
    "juzStart": 27,
    "pageStart": 528
  },
  {
    "number": 55,
    "arabic": "الرحمن",
    "transliteration": "Ar-Rahmaan",
    "english": "The Beneficent",
    "ayahs": 78,
    "revelation": "Medinan",
    "juzStart": 27,
    "pageStart": 531
  },
  {
    "number": 56,
    "arabic": "الواقعة",
    "transliteration": "Al-Waaqia",
    "english": "The Inevitable",
    "ayahs": 96,
    "revelation": "Meccan",
    "juzStart": 27,
    "pageStart": 534
  },
  {
    "number": 57,
    "arabic": "الحديد",
    "transliteration": "Al-Hadid",
    "english": "The Iron",
    "ayahs": 29,
    "revelation": "Medinan",
    "juzStart": 27,
    "pageStart": 537
  },
  {
    "number": 58,
    "arabic": "المجادلة",
    "transliteration": "Al-Mujaadila",
    "english": "The Pleading Woman",
    "ayahs": 22,
    "revelation": "Medinan",
    "juzStart": 28,
    "pageStart": 542
  },
  {
    "number": 59,
    "arabic": "الحشر",
    "transliteration": "Al-Hashr",
    "english": "The Exile",
    "ayahs": 24,
    "revelation": "Medinan",
    "juzStart": 28,
    "pageStart": 545
  },
  {
    "number": 60,
    "arabic": "الممتحنة",
    "transliteration": "Al-Mumtahana",
    "english": "She that is to be examined",
    "ayahs": 13,
    "revelation": "Medinan",
    "juzStart": 28,
    "pageStart": 549
  },
  {
    "number": 61,
    "arabic": "الصف",
    "transliteration": "As-Saff",
    "english": "The Ranks",
    "ayahs": 14,
    "revelation": "Medinan",
    "juzStart": 28,
    "pageStart": 551
  },
  {
    "number": 62,
    "arabic": "الجمعة",
    "transliteration": "Al-Jumu'a",
    "english": "Friday",
    "ayahs": 11,
    "revelation": "Medinan",
    "juzStart": 28,
    "pageStart": 553
  },
  {
    "number": 63,
    "arabic": "المنافقون",
    "transliteration": "Al-Munaafiqoon",
    "english": "The Hypocrites",
    "ayahs": 11,
    "revelation": "Medinan",
    "juzStart": 28,
    "pageStart": 554
  },
  {
    "number": 64,
    "arabic": "التغابن",
    "transliteration": "At-Taghaabun",
    "english": "Mutual Disillusion",
    "ayahs": 18,
    "revelation": "Medinan",
    "juzStart": 28,
    "pageStart": 556
  },
  {
    "number": 65,
    "arabic": "الطلاق",
    "transliteration": "At-Talaaq",
    "english": "Divorce",
    "ayahs": 12,
    "revelation": "Medinan",
    "juzStart": 28,
    "pageStart": 558
  },
  {
    "number": 66,
    "arabic": "التحريم",
    "transliteration": "At-Tahrim",
    "english": "The Prohibition",
    "ayahs": 12,
    "revelation": "Medinan",
    "juzStart": 28,
    "pageStart": 560
  },
  {
    "number": 67,
    "arabic": "الملك",
    "transliteration": "Al-Mulk",
    "english": "The Sovereignty",
    "ayahs": 30,
    "revelation": "Meccan",
    "juzStart": 29,
    "pageStart": 562
  },
  {
    "number": 68,
    "arabic": "القلم",
    "transliteration": "Al-Qalam",
    "english": "The Pen",
    "ayahs": 52,
    "revelation": "Meccan",
    "juzStart": 29,
    "pageStart": 564
  },
  {
    "number": 69,
    "arabic": "الحاقة",
    "transliteration": "Al-Haaqqa",
    "english": "The Reality",
    "ayahs": 52,
    "revelation": "Meccan",
    "juzStart": 29,
    "pageStart": 566
  },
  {
    "number": 70,
    "arabic": "المعارج",
    "transliteration": "Al-Ma'aarij",
    "english": "The Ascending Stairways",
    "ayahs": 44,
    "revelation": "Meccan",
    "juzStart": 29,
    "pageStart": 568
  },
  {
    "number": 71,
    "arabic": "نوح",
    "transliteration": "Nooh",
    "english": "Noah",
    "ayahs": 28,
    "revelation": "Meccan",
    "juzStart": 29,
    "pageStart": 570
  },
  {
    "number": 72,
    "arabic": "الجن",
    "transliteration": "Al-Jinn",
    "english": "The Jinn",
    "ayahs": 28,
    "revelation": "Meccan",
    "juzStart": 29,
    "pageStart": 572
  },
  {
    "number": 73,
    "arabic": "المزمل",
    "transliteration": "Al-Muzzammil",
    "english": "The Enshrouded One",
    "ayahs": 20,
    "revelation": "Meccan",
    "juzStart": 29,
    "pageStart": 574
  },
  {
    "number": 74,
    "arabic": "المدثر",
    "transliteration": "Al-Muddaththir",
    "english": "The Cloaked One",
    "ayahs": 56,
    "revelation": "Meccan",
    "juzStart": 29,
    "pageStart": 575
  },
  {
    "number": 75,
    "arabic": "القيامة",
    "transliteration": "Al-Qiyaama",
    "english": "The Resurrection",
    "ayahs": 40,
    "revelation": "Meccan",
    "juzStart": 29,
    "pageStart": 577
  },
  {
    "number": 76,
    "arabic": "الانسان",
    "transliteration": "Al-Insaan",
    "english": "Man",
    "ayahs": 31,
    "revelation": "Medinan",
    "juzStart": 29,
    "pageStart": 578
  },
  {
    "number": 77,
    "arabic": "المرسلات",
    "transliteration": "Al-Mursalaat",
    "english": "The Emissaries",
    "ayahs": 50,
    "revelation": "Meccan",
    "juzStart": 29,
    "pageStart": 580
  },
  {
    "number": 78,
    "arabic": "النبإ",
    "transliteration": "An-Naba",
    "english": "The Announcement",
    "ayahs": 40,
    "revelation": "Meccan",
    "juzStart": 30,
    "pageStart": 582
  },
  {
    "number": 79,
    "arabic": "النازعات",
    "transliteration": "An-Naazi'aat",
    "english": "Those who drag forth",
    "ayahs": 46,
    "revelation": "Meccan",
    "juzStart": 30,
    "pageStart": 583
  },
  {
    "number": 80,
    "arabic": "عبس",
    "transliteration": "Abasa",
    "english": "He frowned",
    "ayahs": 42,
    "revelation": "Meccan",
    "juzStart": 30,
    "pageStart": 585
  },
  {
    "number": 81,
    "arabic": "التكوير",
    "transliteration": "At-Takwir",
    "english": "The Overthrowing",
    "ayahs": 29,
    "revelation": "Meccan",
    "juzStart": 30,
    "pageStart": 586
  },
  {
    "number": 82,
    "arabic": "الإنفطار",
    "transliteration": "Al-Infitaar",
    "english": "The Cleaving",
    "ayahs": 19,
    "revelation": "Meccan",
    "juzStart": 30,
    "pageStart": 587
  },
  {
    "number": 83,
    "arabic": "المطففين",
    "transliteration": "Al-Mutaffifin",
    "english": "Defrauding",
    "ayahs": 36,
    "revelation": "Meccan",
    "juzStart": 30,
    "pageStart": 587
  },
  {
    "number": 84,
    "arabic": "الإنشقاق",
    "transliteration": "Al-Inshiqaaq",
    "english": "The Splitting Open",
    "ayahs": 25,
    "revelation": "Meccan",
    "juzStart": 30,
    "pageStart": 589
  },
  {
    "number": 85,
    "arabic": "البروج",
    "transliteration": "Al-Burooj",
    "english": "The Constellations",
    "ayahs": 22,
    "revelation": "Meccan",
    "juzStart": 30,
    "pageStart": 590
  },
  {
    "number": 86,
    "arabic": "الطارق",
    "transliteration": "At-Taariq",
    "english": "The Morning Star",
    "ayahs": 17,
    "revelation": "Meccan",
    "juzStart": 30,
    "pageStart": 591
  },
  {
    "number": 87,
    "arabic": "الأعلى",
    "transliteration": "Al-A'laa",
    "english": "The Most High",
    "ayahs": 19,
    "revelation": "Meccan",
    "juzStart": 30,
    "pageStart": 591
  },
  {
    "number": 88,
    "arabic": "الغاشية",
    "transliteration": "Al-Ghaashiya",
    "english": "The Overwhelming",
    "ayahs": 26,
    "revelation": "Meccan",
    "juzStart": 30,
    "pageStart": 592
  },
  {
    "number": 89,
    "arabic": "الفجر",
    "transliteration": "Al-Fajr",
    "english": "The Dawn",
    "ayahs": 30,
    "revelation": "Meccan",
    "juzStart": 30,
    "pageStart": 593
  },
  {
    "number": 90,
    "arabic": "البلد",
    "transliteration": "Al-Balad",
    "english": "The City",
    "ayahs": 20,
    "revelation": "Meccan",
    "juzStart": 30,
    "pageStart": 594
  },
  {
    "number": 91,
    "arabic": "الشمس",
    "transliteration": "Ash-Shams",
    "english": "The Sun",
    "ayahs": 15,
    "revelation": "Meccan",
    "juzStart": 30,
    "pageStart": 595
  },
  {
    "number": 92,
    "arabic": "الليل",
    "transliteration": "Al-Lail",
    "english": "The Night",
    "ayahs": 21,
    "revelation": "Meccan",
    "juzStart": 30,
    "pageStart": 595
  },
  {
    "number": 93,
    "arabic": "الضحى",
    "transliteration": "Ad-Dhuhaa",
    "english": "The Morning Hours",
    "ayahs": 11,
    "revelation": "Meccan",
    "juzStart": 30,
    "pageStart": 596
  },
  {
    "number": 94,
    "arabic": "الشرح",
    "transliteration": "Ash-Sharh",
    "english": "The Consolation",
    "ayahs": 8,
    "revelation": "Meccan",
    "juzStart": 30,
    "pageStart": 596
  },
  {
    "number": 95,
    "arabic": "التين",
    "transliteration": "At-Tin",
    "english": "The Fig",
    "ayahs": 8,
    "revelation": "Meccan",
    "juzStart": 30,
    "pageStart": 597
  },
  {
    "number": 96,
    "arabic": "العلق",
    "transliteration": "Al-Alaq",
    "english": "The Clot",
    "ayahs": 19,
    "revelation": "Meccan",
    "juzStart": 30,
    "pageStart": 597
  },
  {
    "number": 97,
    "arabic": "القدر",
    "transliteration": "Al-Qadr",
    "english": "The Power, Fate",
    "ayahs": 5,
    "revelation": "Meccan",
    "juzStart": 30,
    "pageStart": 598
  },
  {
    "number": 98,
    "arabic": "البينة",
    "transliteration": "Al-Bayyina",
    "english": "The Evidence",
    "ayahs": 8,
    "revelation": "Medinan",
    "juzStart": 30,
    "pageStart": 598
  },
  {
    "number": 99,
    "arabic": "الزلزلة",
    "transliteration": "Az-Zalzala",
    "english": "The Earthquake",
    "ayahs": 8,
    "revelation": "Medinan",
    "juzStart": 30,
    "pageStart": 599
  },
  {
    "number": 100,
    "arabic": "العاديات",
    "transliteration": "Al-Aadiyaat",
    "english": "The Chargers",
    "ayahs": 11,
    "revelation": "Meccan",
    "juzStart": 30,
    "pageStart": 599
  },
  {
    "number": 101,
    "arabic": "القارعة",
    "transliteration": "Al-Qaari'a",
    "english": "The Calamity",
    "ayahs": 11,
    "revelation": "Meccan",
    "juzStart": 30,
    "pageStart": 600
  },
  {
    "number": 102,
    "arabic": "التكاثر",
    "transliteration": "At-Takaathur",
    "english": "Competition",
    "ayahs": 8,
    "revelation": "Meccan",
    "juzStart": 30,
    "pageStart": 600
  },
  {
    "number": 103,
    "arabic": "العصر",
    "transliteration": "Al-Asr",
    "english": "The Declining Day, Epoch",
    "ayahs": 3,
    "revelation": "Meccan",
    "juzStart": 30,
    "pageStart": 601
  },
  {
    "number": 104,
    "arabic": "الهمزة",
    "transliteration": "Al-Humaza",
    "english": "The Traducer",
    "ayahs": 9,
    "revelation": "Meccan",
    "juzStart": 30,
    "pageStart": 601
  },
  {
    "number": 105,
    "arabic": "الفيل",
    "transliteration": "Al-Fil",
    "english": "The Elephant",
    "ayahs": 5,
    "revelation": "Meccan",
    "juzStart": 30,
    "pageStart": 601
  },
  {
    "number": 106,
    "arabic": "قريش",
    "transliteration": "Quraish",
    "english": "Quraysh",
    "ayahs": 4,
    "revelation": "Meccan",
    "juzStart": 30,
    "pageStart": 602
  },
  {
    "number": 107,
    "arabic": "الماعون",
    "transliteration": "Al-Maa'un",
    "english": "Almsgiving",
    "ayahs": 7,
    "revelation": "Meccan",
    "juzStart": 30,
    "pageStart": 602
  },
  {
    "number": 108,
    "arabic": "الكوثر",
    "transliteration": "Al-Kawthar",
    "english": "Abundance",
    "ayahs": 3,
    "revelation": "Meccan",
    "juzStart": 30,
    "pageStart": 602
  },
  {
    "number": 109,
    "arabic": "الكافرون",
    "transliteration": "Al-Kaafiroon",
    "english": "The Disbelievers",
    "ayahs": 6,
    "revelation": "Meccan",
    "juzStart": 30,
    "pageStart": 603
  },
  {
    "number": 110,
    "arabic": "النصر",
    "transliteration": "An-Nasr",
    "english": "Divine Support",
    "ayahs": 3,
    "revelation": "Medinan",
    "juzStart": 30,
    "pageStart": 603
  },
  {
    "number": 111,
    "arabic": "المسد",
    "transliteration": "Al-Masad",
    "english": "The Palm Fibre",
    "ayahs": 5,
    "revelation": "Meccan",
    "juzStart": 30,
    "pageStart": 603
  },
  {
    "number": 112,
    "arabic": "الإخلاص",
    "transliteration": "Al-Ikhlaas",
    "english": "Sincerity",
    "ayahs": 4,
    "revelation": "Meccan",
    "juzStart": 30,
    "pageStart": 604
  },
  {
    "number": 113,
    "arabic": "الفلق",
    "transliteration": "Al-Falaq",
    "english": "The Dawn",
    "ayahs": 5,
    "revelation": "Meccan",
    "juzStart": 30,
    "pageStart": 604
  },
  {
    "number": 114,
    "arabic": "الناس",
    "transliteration": "An-Naas",
    "english": "Mankind",
    "ayahs": 6,
    "revelation": "Meccan",
    "juzStart": 30,
    "pageStart": 604
  }
];
export const QURAN_PAGE_STARTS: Array<[number,number,number]> = [[1,1,1],[2,2,1],[3,2,6],[4,2,17],[5,2,25],[6,2,30],[7,2,38],[8,2,49],[9,2,58],[10,2,62],[11,2,70],[12,2,77],[13,2,84],[14,2,89],[15,2,94],[16,2,102],[17,2,106],[18,2,113],[19,2,120],[20,2,127],[21,2,135],[22,2,142],[23,2,146],[24,2,154],[25,2,164],[26,2,170],[27,2,177],[28,2,182],[29,2,187],[30,2,191],[31,2,197],[32,2,203],[33,2,211],[34,2,216],[35,2,220],[36,2,225],[37,2,231],[38,2,234],[39,2,238],[40,2,246],[41,2,249],[42,2,253],[43,2,257],[44,2,260],[45,2,265],[46,2,270],[47,2,275],[48,2,282],[49,2,283],[50,3,1],[51,3,10],[52,3,16],[53,3,23],[54,3,30],[55,3,38],[56,3,46],[57,3,53],[58,3,62],[59,3,71],[60,3,78],[61,3,84],[62,3,92],[63,3,101],[64,3,109],[65,3,116],[66,3,122],[67,3,133],[68,3,141],[69,3,149],[70,3,154],[71,3,158],[72,3,166],[73,3,174],[74,3,181],[75,3,187],[76,3,195],[77,4,1],[78,4,7],[79,4,12],[80,4,15],[81,4,20],[82,4,24],[83,4,27],[84,4,34],[85,4,38],[86,4,45],[87,4,52],[88,4,60],[89,4,66],[90,4,75],[91,4,80],[92,4,87],[93,4,92],[94,4,95],[95,4,102],[96,4,106],[97,4,114],[98,4,122],[99,4,128],[100,4,135],[101,4,141],[102,4,148],[103,4,155],[104,4,163],[105,4,171],[106,4,176],[107,5,3],[108,5,6],[109,5,10],[110,5,14],[111,5,18],[112,5,24],[113,5,32],[114,5,37],[115,5,42],[116,5,46],[117,5,51],[118,5,58],[119,5,65],[120,5,71],[121,5,77],[122,5,83],[123,5,90],[124,5,96],[125,5,104],[126,5,109],[127,5,114],[128,6,1],[129,6,9],[130,6,19],[131,6,28],[132,6,36],[133,6,45],[134,6,53],[135,6,60],[136,6,69],[137,6,74],[138,6,82],[139,6,91],[140,6,95],[141,6,102],[142,6,111],[143,6,119],[144,6,125],[145,6,132],[146,6,138],[147,6,143],[148,6,147],[149,6,152],[150,6,158],[151,7,1],[152,7,12],[153,7,23],[154,7,31],[155,7,38],[156,7,44],[157,7,52],[158,7,58],[159,7,68],[160,7,74],[161,7,82],[162,7,88],[163,7,96],[164,7,105],[165,7,121],[166,7,131],[167,7,138],[168,7,144],[169,7,150],[170,7,156],[171,7,160],[172,7,164],[173,7,171],[174,7,179],[175,7,188],[176,7,196],[177,8,1],[178,8,9],[179,8,17],[180,8,26],[181,8,34],[182,8,41],[183,8,46],[184,8,53],[185,8,62],[186,8,70],[187,9,1],[188,9,7],[189,9,14],[190,9,21],[191,9,27],[192,9,32],[193,9,37],[194,9,41],[195,9,48],[196,9,55],[197,9,62],[198,9,69],[199,9,73],[200,9,80],[201,9,87],[202,9,94],[203,9,100],[204,9,107],[205,9,112],[206,9,118],[207,9,123],[208,10,1],[209,10,7],[210,10,15],[211,10,21],[212,10,26],[213,10,34],[214,10,43],[215,10,54],[216,10,62],[217,10,71],[218,10,79],[219,10,89],[220,10,98],[221,10,107],[222,11,6],[223,11,13],[224,11,20],[225,11,29],[226,11,38],[227,11,46],[228,11,54],[229,11,63],[230,11,72],[231,11,82],[232,11,89],[233,11,98],[234,11,109],[235,11,118],[236,12,5],[237,12,15],[238,12,23],[239,12,31],[240,12,38],[241,12,44],[242,12,53],[243,12,64],[244,12,70],[245,12,79],[246,12,87],[247,12,96],[248,12,104],[249,13,1],[250,13,6],[251,13,14],[252,13,19],[253,13,29],[254,13,35],[255,13,43],[256,14,6],[257,14,11],[258,14,19],[259,14,25],[260,14,34],[261,14,43],[262,15,1],[263,15,16],[264,15,32],[265,15,52],[266,15,71],[267,15,91],[268,16,7],[269,16,15],[270,16,27],[271,16,35],[272,16,43],[273,16,55],[274,16,65],[275,16,73],[276,16,80],[277,16,88],[278,16,94],[279,16,103],[280,16,111],[281,16,119],[282,17,1],[283,17,8],[284,17,18],[285,17,28],[286,17,39],[287,17,50],[288,17,59],[289,17,67],[290,17,76],[291,17,87],[292,17,97],[293,17,105],[294,18,5],[295,18,16],[296,18,21],[297,18,28],[298,18,35],[299,18,46],[300,18,54],[301,18,62],[302,18,75],[303,18,84],[304,18,98],[305,19,1],[306,19,12],[307,19,26],[308,19,39],[309,19,52],[310,19,65],[311,19,77],[312,19,96],[313,20,13],[314,20,38],[315,20,52],[316,20,65],[317,20,77],[318,20,88],[319,20,99],[320,20,114],[321,20,126],[322,21,1],[323,21,11],[324,21,25],[325,21,36],[326,21,45],[327,21,58],[328,21,73],[329,21,82],[330,21,91],[331,21,102],[332,22,1],[333,22,6],[334,22,16],[335,22,24],[336,22,31],[337,22,39],[338,22,47],[339,22,56],[340,22,65],[341,22,73],[342,23,1],[343,23,18],[344,23,28],[345,23,43],[346,23,60],[347,23,75],[348,23,90],[349,23,105],[350,24,1],[351,24,11],[352,24,21],[353,24,28],[354,24,32],[355,24,37],[356,24,44],[357,24,54],[358,24,59],[359,24,62],[360,25,3],[361,25,12],[362,25,21],[363,25,33],[364,25,44],[365,25,56],[366,25,68],[367,26,1],[368,26,20],[369,26,40],[370,26,61],[371,26,84],[372,26,112],[373,26,137],[374,26,160],[375,26,184],[376,26,207],[377,27,1],[378,27,14],[379,27,23],[380,27,36],[381,27,45],[382,27,56],[383,27,64],[384,27,77],[385,27,89],[386,28,6],[387,28,14],[388,28,22],[389,28,29],[390,28,36],[391,28,44],[392,28,51],[393,28,60],[394,28,71],[395,28,78],[396,28,85],[397,29,7],[398,29,15],[399,29,24],[400,29,31],[401,29,39],[402,29,46],[403,29,53],[404,29,64],[405,30,6],[406,30,16],[407,30,25],[408,30,33],[409,30,42],[410,30,51],[411,31,1],[412,31,12],[413,31,20],[414,31,29],[415,32,1],[416,32,12],[417,32,21],[418,33,1],[419,33,7],[420,33,16],[421,33,23],[422,33,31],[423,33,36],[424,33,44],[425,33,51],[426,33,55],[427,33,63],[428,34,1],[429,34,8],[430,34,15],[431,34,23],[432,34,32],[433,34,40],[434,34,49],[435,35,4],[436,35,12],[437,35,19],[438,35,31],[439,35,39],[440,35,45],[441,36,13],[442,36,28],[443,36,41],[444,36,55],[445,36,71],[446,37,1],[447,37,25],[448,37,52],[449,37,77],[450,37,103],[451,37,127],[452,37,154],[453,38,1],[454,38,17],[455,38,27],[456,38,43],[457,38,62],[458,38,84],[459,39,6],[460,39,11],[461,39,22],[462,39,32],[463,39,41],[464,39,48],[465,39,57],[466,39,68],[467,39,75],[468,40,8],[469,40,17],[470,40,26],[471,40,34],[472,40,41],[473,40,50],[474,40,59],[475,40,67],[476,40,78],[477,41,1],[478,41,12],[479,41,21],[480,41,30],[481,41,39],[482,41,47],[483,42,1],[484,42,11],[485,42,16],[486,42,23],[487,42,32],[488,42,45],[489,42,52],[490,43,11],[491,43,23],[492,43,34],[493,43,48],[494,43,61],[495,43,74],[496,44,1],[497,44,19],[498,44,40],[499,45,1],[500,45,14],[501,45,23],[502,45,33],[503,46,6],[504,46,15],[505,46,21],[506,46,29],[507,47,1],[508,47,12],[509,47,20],[510,47,30],[511,48,1],[512,48,10],[513,48,16],[514,48,24],[515,48,29],[516,49,5],[517,49,12],[518,50,1],[519,50,16],[520,50,36],[521,51,7],[522,51,31],[523,51,52],[524,52,15],[525,52,32],[526,53,1],[527,53,27],[528,53,45],[529,54,7],[530,54,28],[531,54,50],[532,55,17],[533,55,41],[534,55,68],[535,56,17],[536,56,51],[537,56,77],[538,57,4],[539,57,12],[540,57,19],[541,57,25],[542,58,1],[543,58,7],[544,58,12],[545,58,22],[546,59,4],[547,59,10],[548,59,17],[549,60,1],[550,60,6],[551,60,12],[552,61,6],[553,62,1],[554,62,9],[555,63,5],[556,64,1],[557,64,10],[558,65,1],[559,65,6],[560,66,1],[561,66,8],[562,67,1],[563,67,13],[564,67,27],[565,68,16],[566,68,43],[567,69,9],[568,69,35],[569,70,11],[570,70,40],[571,71,11],[572,72,1],[573,72,14],[574,73,1],[575,73,20],[576,74,18],[577,74,48],[578,75,20],[579,76,6],[580,76,26],[581,77,20],[582,78,1],[583,78,31],[584,79,16],[585,80,1],[586,81,1],[587,82,1],[588,83,7],[589,83,35],[590,85,1],[591,86,1],[592,87,16],[593,89,1],[594,89,24],[595,91,1],[596,92,15],[597,95,1],[598,97,1],[599,98,8],[600,100,10],[601,103,1],[602,106,1],[603,109,1],[604,112,1]];
export const QURAN_JUZ_STARTS: Array<[number,number,number]> = [[1,1,1],[2,2,142],[3,2,253],[4,3,93],[5,4,24],[6,4,148],[7,5,82],[8,6,111],[9,7,88],[10,8,41],[11,9,93],[12,11,6],[13,12,53],[14,15,1],[15,17,1],[16,18,75],[17,21,1],[18,23,1],[19,25,21],[20,27,56],[21,29,46],[22,33,31],[23,36,28],[24,39,32],[25,41,47],[26,46,1],[27,51,31],[28,58,1],[29,67,1],[30,78,1]];
export function findSurah(value:string) { const v=value.trim().toLocaleLowerCase(); return QURAN_SURAHS.find(s=>String(s.number)===v || s.transliteration.toLocaleLowerCase()===v || s.english.toLocaleLowerCase()===v || s.arabic===value.trim()); }
function pageAt(surah:number,ayah:number) { let result=1; for(const [page,s,a] of QURAN_PAGE_STARTS){ if(s<surah || (s===surah && a<=ayah)) result=page; else break; } return result; }
function juzAt(surah:number,ayah:number) { let result=1; for(const [j,s,a] of QURAN_JUZ_STARTS){ if(s<surah || (s===surah && a<=ayah)) result=j; else break; } return result; }
export function getAyahLocation(surahNumber:number,ayah:number) { const surah=QURAN_SURAHS[surahNumber-1]; if(!surah || !Number.isInteger(ayah) || ayah<1 || ayah>surah.ayahs) return null; return {page:pageAt(surahNumber,ayah),juz:juzAt(surahNumber,ayah)}; }
export function getAyahRangeLocation(surahNumber:number,start:number,end:number) { const first=getAyahLocation(surahNumber,start),last=getAyahLocation(surahNumber,end); if(!first||!last||start>end) return null; return {pageStart:first.page,pageEnd:last.page,pages:last.page-first.page+1,juzStart:first.juz,juzEnd:last.juz,juzs:Array.from({length:last.juz-first.juz+1},(_,i)=>first.juz+i)}; }
