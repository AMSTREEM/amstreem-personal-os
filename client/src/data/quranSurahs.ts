/**
 * Surah reference for the standard 604-page Madani Mushaf (Hafs/Kufan numbering).
 * Metadata source: Mushaf-Learning/quran-text, metadata/surahs.json.
 * Page spans are inclusive; short Surahs may share a Mushaf page.
 */
export type QuranSurah = {
  number: number;
  name: string;
  arabicName: string;
  ayahCount: number;
  startPage: number;
  endPage: number;
  juz: number;
};

export const quranSurahs: QuranSurah[] = [
  {
    "number": 1,
    "name": "Al-Faatiha",
    "arabicName": "الفاتحة",
    "ayahCount": 7,
    "startPage": 1,
    "endPage": 1,
    "juz": 1
  },
  {
    "number": 2,
    "name": "Al-Baqara",
    "arabicName": "البقرة",
    "ayahCount": 286,
    "startPage": 2,
    "endPage": 49,
    "juz": 1
  },
  {
    "number": 3,
    "name": "Aal-i-Imraan",
    "arabicName": "آل عمران",
    "ayahCount": 200,
    "startPage": 50,
    "endPage": 76,
    "juz": 3
  },
  {
    "number": 4,
    "name": "An-Nisaa",
    "arabicName": "النساء",
    "ayahCount": 176,
    "startPage": 77,
    "endPage": 105,
    "juz": 4
  },
  {
    "number": 5,
    "name": "Al-Maaida",
    "arabicName": "المائدة",
    "ayahCount": 120,
    "startPage": 106,
    "endPage": 127,
    "juz": 6
  },
  {
    "number": 6,
    "name": "Al-An'aam",
    "arabicName": "الأنعام",
    "ayahCount": 165,
    "startPage": 128,
    "endPage": 150,
    "juz": 7
  },
  {
    "number": 7,
    "name": "Al-A'raaf",
    "arabicName": "الأعراف",
    "ayahCount": 206,
    "startPage": 151,
    "endPage": 176,
    "juz": 8
  },
  {
    "number": 8,
    "name": "Al-Anfaal",
    "arabicName": "الأنفال",
    "ayahCount": 75,
    "startPage": 177,
    "endPage": 186,
    "juz": 9
  },
  {
    "number": 9,
    "name": "At-Tawba",
    "arabicName": "التوبة",
    "ayahCount": 129,
    "startPage": 187,
    "endPage": 207,
    "juz": 10
  },
  {
    "number": 10,
    "name": "Yunus",
    "arabicName": "يونس",
    "ayahCount": 109,
    "startPage": 208,
    "endPage": 220,
    "juz": 11
  },
  {
    "number": 11,
    "name": "Hud",
    "arabicName": "هود",
    "ayahCount": 123,
    "startPage": 221,
    "endPage": 234,
    "juz": 11
  },
  {
    "number": 12,
    "name": "Yusuf",
    "arabicName": "يوسف",
    "ayahCount": 111,
    "startPage": 235,
    "endPage": 248,
    "juz": 12
  },
  {
    "number": 13,
    "name": "Ar-Ra'd",
    "arabicName": "الرعد",
    "ayahCount": 43,
    "startPage": 249,
    "endPage": 254,
    "juz": 13
  },
  {
    "number": 14,
    "name": "Ibrahim",
    "arabicName": "ابراهيم",
    "ayahCount": 52,
    "startPage": 255,
    "endPage": 261,
    "juz": 13
  },
  {
    "number": 15,
    "name": "Al-Hijr",
    "arabicName": "الحجر",
    "ayahCount": 99,
    "startPage": 262,
    "endPage": 266,
    "juz": 14
  },
  {
    "number": 16,
    "name": "An-Nahl",
    "arabicName": "النحل",
    "ayahCount": 128,
    "startPage": 267,
    "endPage": 281,
    "juz": 14
  },
  {
    "number": 17,
    "name": "Al-Israa",
    "arabicName": "الإسراء",
    "ayahCount": 111,
    "startPage": 282,
    "endPage": 292,
    "juz": 15
  },
  {
    "number": 18,
    "name": "Al-Kahf",
    "arabicName": "الكهف",
    "ayahCount": 110,
    "startPage": 293,
    "endPage": 304,
    "juz": 15
  },
  {
    "number": 19,
    "name": "Maryam",
    "arabicName": "مريم",
    "ayahCount": 98,
    "startPage": 305,
    "endPage": 311,
    "juz": 16
  },
  {
    "number": 20,
    "name": "Taa-Haa",
    "arabicName": "طه",
    "ayahCount": 135,
    "startPage": 312,
    "endPage": 321,
    "juz": 16
  },
  {
    "number": 21,
    "name": "Al-Anbiyaa",
    "arabicName": "الأنبياء",
    "ayahCount": 112,
    "startPage": 322,
    "endPage": 331,
    "juz": 17
  },
  {
    "number": 22,
    "name": "Al-Hajj",
    "arabicName": "الحج",
    "ayahCount": 78,
    "startPage": 332,
    "endPage": 341,
    "juz": 17
  },
  {
    "number": 23,
    "name": "Al-Muminoon",
    "arabicName": "المؤمنون",
    "ayahCount": 118,
    "startPage": 342,
    "endPage": 349,
    "juz": 18
  },
  {
    "number": 24,
    "name": "An-Noor",
    "arabicName": "النور",
    "ayahCount": 64,
    "startPage": 350,
    "endPage": 358,
    "juz": 18
  },
  {
    "number": 25,
    "name": "Al-Furqaan",
    "arabicName": "الفرقان",
    "ayahCount": 77,
    "startPage": 359,
    "endPage": 366,
    "juz": 18
  },
  {
    "number": 26,
    "name": "Ash-Shu'araa",
    "arabicName": "الشعراء",
    "ayahCount": 227,
    "startPage": 367,
    "endPage": 376,
    "juz": 19
  },
  {
    "number": 27,
    "name": "An-Naml",
    "arabicName": "النمل",
    "ayahCount": 93,
    "startPage": 377,
    "endPage": 384,
    "juz": 19
  },
  {
    "number": 28,
    "name": "Al-Qasas",
    "arabicName": "القصص",
    "ayahCount": 88,
    "startPage": 385,
    "endPage": 395,
    "juz": 20
  },
  {
    "number": 29,
    "name": "Al-Ankaboot",
    "arabicName": "العنكبوت",
    "ayahCount": 69,
    "startPage": 396,
    "endPage": 403,
    "juz": 20
  },
  {
    "number": 30,
    "name": "Ar-Room",
    "arabicName": "الروم",
    "ayahCount": 60,
    "startPage": 404,
    "endPage": 410,
    "juz": 21
  },
  {
    "number": 31,
    "name": "Luqman",
    "arabicName": "لقمان",
    "ayahCount": 34,
    "startPage": 411,
    "endPage": 414,
    "juz": 21
  },
  {
    "number": 32,
    "name": "As-Sajda",
    "arabicName": "السجدة",
    "ayahCount": 30,
    "startPage": 415,
    "endPage": 417,
    "juz": 21
  },
  {
    "number": 33,
    "name": "Al-Ahzaab",
    "arabicName": "الأحزاب",
    "ayahCount": 73,
    "startPage": 418,
    "endPage": 427,
    "juz": 21
  },
  {
    "number": 34,
    "name": "Saba",
    "arabicName": "سبإ",
    "ayahCount": 54,
    "startPage": 428,
    "endPage": 433,
    "juz": 22
  },
  {
    "number": 35,
    "name": "Faatir",
    "arabicName": "فاطر",
    "ayahCount": 45,
    "startPage": 434,
    "endPage": 439,
    "juz": 22
  },
  {
    "number": 36,
    "name": "Yaseen",
    "arabicName": "يس",
    "ayahCount": 83,
    "startPage": 440,
    "endPage": 445,
    "juz": 22
  },
  {
    "number": 37,
    "name": "As-Saaffaat",
    "arabicName": "الصافات",
    "ayahCount": 182,
    "startPage": 446,
    "endPage": 452,
    "juz": 23
  },
  {
    "number": 38,
    "name": "Saad",
    "arabicName": "ص",
    "ayahCount": 88,
    "startPage": 453,
    "endPage": 457,
    "juz": 23
  },
  {
    "number": 39,
    "name": "Az-Zumar",
    "arabicName": "الزمر",
    "ayahCount": 75,
    "startPage": 458,
    "endPage": 466,
    "juz": 23
  },
  {
    "number": 40,
    "name": "Al-Ghaafir",
    "arabicName": "غافر",
    "ayahCount": 85,
    "startPage": 467,
    "endPage": 476,
    "juz": 24
  },
  {
    "number": 41,
    "name": "Fussilat",
    "arabicName": "فصلت",
    "ayahCount": 54,
    "startPage": 477,
    "endPage": 482,
    "juz": 24
  },
  {
    "number": 42,
    "name": "Ash-Shura",
    "arabicName": "الشورى",
    "ayahCount": 53,
    "startPage": 483,
    "endPage": 488,
    "juz": 25
  },
  {
    "number": 43,
    "name": "Az-Zukhruf",
    "arabicName": "الزخرف",
    "ayahCount": 89,
    "startPage": 489,
    "endPage": 495,
    "juz": 25
  },
  {
    "number": 44,
    "name": "Ad-Dukhaan",
    "arabicName": "الدخان",
    "ayahCount": 59,
    "startPage": 496,
    "endPage": 498,
    "juz": 25
  },
  {
    "number": 45,
    "name": "Al-Jaathiya",
    "arabicName": "الجاثية",
    "ayahCount": 37,
    "startPage": 499,
    "endPage": 501,
    "juz": 25
  },
  {
    "number": 46,
    "name": "Al-Ahqaf",
    "arabicName": "الأحقاف",
    "ayahCount": 35,
    "startPage": 502,
    "endPage": 506,
    "juz": 26
  },
  {
    "number": 47,
    "name": "Muhammad",
    "arabicName": "محمد",
    "ayahCount": 38,
    "startPage": 507,
    "endPage": 510,
    "juz": 26
  },
  {
    "number": 48,
    "name": "Al-Fath",
    "arabicName": "الفتح",
    "ayahCount": 29,
    "startPage": 511,
    "endPage": 514,
    "juz": 26
  },
  {
    "number": 49,
    "name": "Al-Hujuraat",
    "arabicName": "الحجرات",
    "ayahCount": 18,
    "startPage": 515,
    "endPage": 517,
    "juz": 26
  },
  {
    "number": 50,
    "name": "Qaaf",
    "arabicName": "ق",
    "ayahCount": 45,
    "startPage": 518,
    "endPage": 519,
    "juz": 26
  },
  {
    "number": 51,
    "name": "Adh-Dhaariyat",
    "arabicName": "الذاريات",
    "ayahCount": 60,
    "startPage": 520,
    "endPage": 522,
    "juz": 26
  },
  {
    "number": 52,
    "name": "At-Tur",
    "arabicName": "الطور",
    "ayahCount": 49,
    "startPage": 523,
    "endPage": 525,
    "juz": 27
  },
  {
    "number": 53,
    "name": "An-Najm",
    "arabicName": "النجم",
    "ayahCount": 62,
    "startPage": 526,
    "endPage": 527,
    "juz": 27
  },
  {
    "number": 54,
    "name": "Al-Qamar",
    "arabicName": "القمر",
    "ayahCount": 55,
    "startPage": 528,
    "endPage": 530,
    "juz": 27
  },
  {
    "number": 55,
    "name": "Ar-Rahmaan",
    "arabicName": "الرحمن",
    "ayahCount": 78,
    "startPage": 531,
    "endPage": 533,
    "juz": 27
  },
  {
    "number": 56,
    "name": "Al-Waaqia",
    "arabicName": "الواقعة",
    "ayahCount": 96,
    "startPage": 534,
    "endPage": 536,
    "juz": 27
  },
  {
    "number": 57,
    "name": "Al-Hadid",
    "arabicName": "الحديد",
    "ayahCount": 29,
    "startPage": 537,
    "endPage": 541,
    "juz": 27
  },
  {
    "number": 58,
    "name": "Al-Mujaadila",
    "arabicName": "المجادلة",
    "ayahCount": 22,
    "startPage": 542,
    "endPage": 544,
    "juz": 28
  },
  {
    "number": 59,
    "name": "Al-Hashr",
    "arabicName": "الحشر",
    "ayahCount": 24,
    "startPage": 545,
    "endPage": 548,
    "juz": 28
  },
  {
    "number": 60,
    "name": "Al-Mumtahana",
    "arabicName": "الممتحنة",
    "ayahCount": 13,
    "startPage": 549,
    "endPage": 550,
    "juz": 28
  },
  {
    "number": 61,
    "name": "As-Saff",
    "arabicName": "الصف",
    "ayahCount": 14,
    "startPage": 551,
    "endPage": 552,
    "juz": 28
  },
  {
    "number": 62,
    "name": "Al-Jumu'a",
    "arabicName": "الجمعة",
    "ayahCount": 11,
    "startPage": 553,
    "endPage": 553,
    "juz": 28
  },
  {
    "number": 63,
    "name": "Al-Munaafiqoon",
    "arabicName": "المنافقون",
    "ayahCount": 11,
    "startPage": 554,
    "endPage": 555,
    "juz": 28
  },
  {
    "number": 64,
    "name": "At-Taghaabun",
    "arabicName": "التغابن",
    "ayahCount": 18,
    "startPage": 556,
    "endPage": 557,
    "juz": 28
  },
  {
    "number": 65,
    "name": "At-Talaaq",
    "arabicName": "الطلاق",
    "ayahCount": 12,
    "startPage": 558,
    "endPage": 559,
    "juz": 28
  },
  {
    "number": 66,
    "name": "At-Tahrim",
    "arabicName": "التحريم",
    "ayahCount": 12,
    "startPage": 560,
    "endPage": 561,
    "juz": 28
  },
  {
    "number": 67,
    "name": "Al-Mulk",
    "arabicName": "الملك",
    "ayahCount": 30,
    "startPage": 562,
    "endPage": 563,
    "juz": 29
  },
  {
    "number": 68,
    "name": "Al-Qalam",
    "arabicName": "القلم",
    "ayahCount": 52,
    "startPage": 564,
    "endPage": 565,
    "juz": 29
  },
  {
    "number": 69,
    "name": "Al-Haaqqa",
    "arabicName": "الحاقة",
    "ayahCount": 52,
    "startPage": 566,
    "endPage": 567,
    "juz": 29
  },
  {
    "number": 70,
    "name": "Al-Ma'aarij",
    "arabicName": "المعارج",
    "ayahCount": 44,
    "startPage": 568,
    "endPage": 569,
    "juz": 29
  },
  {
    "number": 71,
    "name": "Nooh",
    "arabicName": "نوح",
    "ayahCount": 28,
    "startPage": 570,
    "endPage": 571,
    "juz": 29
  },
  {
    "number": 72,
    "name": "Al-Jinn",
    "arabicName": "الجن",
    "ayahCount": 28,
    "startPage": 572,
    "endPage": 573,
    "juz": 29
  },
  {
    "number": 73,
    "name": "Al-Muzzammil",
    "arabicName": "المزمل",
    "ayahCount": 20,
    "startPage": 574,
    "endPage": 574,
    "juz": 29
  },
  {
    "number": 74,
    "name": "Al-Muddaththir",
    "arabicName": "المدثر",
    "ayahCount": 56,
    "startPage": 575,
    "endPage": 576,
    "juz": 29
  },
  {
    "number": 75,
    "name": "Al-Qiyaama",
    "arabicName": "القيامة",
    "ayahCount": 40,
    "startPage": 577,
    "endPage": 577,
    "juz": 29
  },
  {
    "number": 76,
    "name": "Al-Insaan",
    "arabicName": "الانسان",
    "ayahCount": 31,
    "startPage": 578,
    "endPage": 579,
    "juz": 29
  },
  {
    "number": 77,
    "name": "Al-Mursalaat",
    "arabicName": "المرسلات",
    "ayahCount": 50,
    "startPage": 580,
    "endPage": 581,
    "juz": 29
  },
  {
    "number": 78,
    "name": "An-Naba",
    "arabicName": "النبإ",
    "ayahCount": 40,
    "startPage": 582,
    "endPage": 582,
    "juz": 30
  },
  {
    "number": 79,
    "name": "An-Naazi'aat",
    "arabicName": "النازعات",
    "ayahCount": 46,
    "startPage": 583,
    "endPage": 584,
    "juz": 30
  },
  {
    "number": 80,
    "name": "Abasa",
    "arabicName": "عبس",
    "ayahCount": 42,
    "startPage": 585,
    "endPage": 585,
    "juz": 30
  },
  {
    "number": 81,
    "name": "At-Takwir",
    "arabicName": "التكوير",
    "ayahCount": 29,
    "startPage": 586,
    "endPage": 586,
    "juz": 30
  },
  {
    "number": 82,
    "name": "Al-Infitaar",
    "arabicName": "الإنفطار",
    "ayahCount": 19,
    "startPage": 587,
    "endPage": 587,
    "juz": 30
  },
  {
    "number": 83,
    "name": "Al-Mutaffifin",
    "arabicName": "المطففين",
    "ayahCount": 36,
    "startPage": 587,
    "endPage": 588,
    "juz": 30
  },
  {
    "number": 84,
    "name": "Al-Inshiqaaq",
    "arabicName": "الإنشقاق",
    "ayahCount": 25,
    "startPage": 589,
    "endPage": 589,
    "juz": 30
  },
  {
    "number": 85,
    "name": "Al-Burooj",
    "arabicName": "البروج",
    "ayahCount": 22,
    "startPage": 590,
    "endPage": 590,
    "juz": 30
  },
  {
    "number": 86,
    "name": "At-Taariq",
    "arabicName": "الطارق",
    "ayahCount": 17,
    "startPage": 591,
    "endPage": 591,
    "juz": 30
  },
  {
    "number": 87,
    "name": "Al-A'laa",
    "arabicName": "الأعلى",
    "ayahCount": 19,
    "startPage": 591,
    "endPage": 591,
    "juz": 30
  },
  {
    "number": 88,
    "name": "Al-Ghaashiya",
    "arabicName": "الغاشية",
    "ayahCount": 26,
    "startPage": 592,
    "endPage": 592,
    "juz": 30
  },
  {
    "number": 89,
    "name": "Al-Fajr",
    "arabicName": "الفجر",
    "ayahCount": 30,
    "startPage": 593,
    "endPage": 593,
    "juz": 30
  },
  {
    "number": 90,
    "name": "Al-Balad",
    "arabicName": "البلد",
    "ayahCount": 20,
    "startPage": 594,
    "endPage": 594,
    "juz": 30
  },
  {
    "number": 91,
    "name": "Ash-Shams",
    "arabicName": "الشمس",
    "ayahCount": 15,
    "startPage": 595,
    "endPage": 595,
    "juz": 30
  },
  {
    "number": 92,
    "name": "Al-Lail",
    "arabicName": "الليل",
    "ayahCount": 21,
    "startPage": 595,
    "endPage": 595,
    "juz": 30
  },
  {
    "number": 93,
    "name": "Ad-Dhuhaa",
    "arabicName": "الضحى",
    "ayahCount": 11,
    "startPage": 596,
    "endPage": 596,
    "juz": 30
  },
  {
    "number": 94,
    "name": "Ash-Sharh",
    "arabicName": "الشرح",
    "ayahCount": 8,
    "startPage": 596,
    "endPage": 596,
    "juz": 30
  },
  {
    "number": 95,
    "name": "At-Tin",
    "arabicName": "التين",
    "ayahCount": 8,
    "startPage": 597,
    "endPage": 597,
    "juz": 30
  },
  {
    "number": 96,
    "name": "Al-Alaq",
    "arabicName": "العلق",
    "ayahCount": 19,
    "startPage": 597,
    "endPage": 597,
    "juz": 30
  },
  {
    "number": 97,
    "name": "Al-Qadr",
    "arabicName": "القدر",
    "ayahCount": 5,
    "startPage": 598,
    "endPage": 598,
    "juz": 30
  },
  {
    "number": 98,
    "name": "Al-Bayyina",
    "arabicName": "البينة",
    "ayahCount": 8,
    "startPage": 598,
    "endPage": 598,
    "juz": 30
  },
  {
    "number": 99,
    "name": "Az-Zalzala",
    "arabicName": "الزلزلة",
    "ayahCount": 8,
    "startPage": 599,
    "endPage": 599,
    "juz": 30
  },
  {
    "number": 100,
    "name": "Al-Aadiyaat",
    "arabicName": "العاديات",
    "ayahCount": 11,
    "startPage": 599,
    "endPage": 599,
    "juz": 30
  },
  {
    "number": 101,
    "name": "Al-Qaari'a",
    "arabicName": "القارعة",
    "ayahCount": 11,
    "startPage": 600,
    "endPage": 600,
    "juz": 30
  },
  {
    "number": 102,
    "name": "At-Takaathur",
    "arabicName": "التكاثر",
    "ayahCount": 8,
    "startPage": 600,
    "endPage": 600,
    "juz": 30
  },
  {
    "number": 103,
    "name": "Al-Asr",
    "arabicName": "العصر",
    "ayahCount": 3,
    "startPage": 601,
    "endPage": 601,
    "juz": 30
  },
  {
    "number": 104,
    "name": "Al-Humaza",
    "arabicName": "الهمزة",
    "ayahCount": 9,
    "startPage": 601,
    "endPage": 601,
    "juz": 30
  },
  {
    "number": 105,
    "name": "Al-Fil",
    "arabicName": "الفيل",
    "ayahCount": 5,
    "startPage": 601,
    "endPage": 601,
    "juz": 30
  },
  {
    "number": 106,
    "name": "Quraish",
    "arabicName": "قريش",
    "ayahCount": 4,
    "startPage": 602,
    "endPage": 602,
    "juz": 30
  },
  {
    "number": 107,
    "name": "Al-Maa'un",
    "arabicName": "الماعون",
    "ayahCount": 7,
    "startPage": 602,
    "endPage": 602,
    "juz": 30
  },
  {
    "number": 108,
    "name": "Al-Kawthar",
    "arabicName": "الكوثر",
    "ayahCount": 3,
    "startPage": 602,
    "endPage": 602,
    "juz": 30
  },
  {
    "number": 109,
    "name": "Al-Kaafiroon",
    "arabicName": "الكافرون",
    "ayahCount": 6,
    "startPage": 603,
    "endPage": 603,
    "juz": 30
  },
  {
    "number": 110,
    "name": "An-Nasr",
    "arabicName": "النصر",
    "ayahCount": 3,
    "startPage": 603,
    "endPage": 603,
    "juz": 30
  },
  {
    "number": 111,
    "name": "Al-Masad",
    "arabicName": "المسد",
    "ayahCount": 5,
    "startPage": 603,
    "endPage": 603,
    "juz": 30
  },
  {
    "number": 112,
    "name": "Al-Ikhlaas",
    "arabicName": "الإخلاص",
    "ayahCount": 4,
    "startPage": 604,
    "endPage": 604,
    "juz": 30
  },
  {
    "number": 113,
    "name": "Al-Falaq",
    "arabicName": "الفلق",
    "ayahCount": 5,
    "startPage": 604,
    "endPage": 604,
    "juz": 30
  },
  {
    "number": 114,
    "name": "An-Naas",
    "arabicName": "الناس",
    "ayahCount": 6,
    "startPage": 604,
    "endPage": 604,
    "juz": 30
  }
];

export const quranJuzBoundaries = [
  {
    "juz": 1,
    "surah": 1,
    "ayah": 1
  },
  {
    "juz": 2,
    "surah": 2,
    "ayah": 142
  },
  {
    "juz": 3,
    "surah": 2,
    "ayah": 253
  },
  {
    "juz": 4,
    "surah": 3,
    "ayah": 93
  },
  {
    "juz": 5,
    "surah": 4,
    "ayah": 24
  },
  {
    "juz": 6,
    "surah": 4,
    "ayah": 148
  },
  {
    "juz": 7,
    "surah": 5,
    "ayah": 82
  },
  {
    "juz": 8,
    "surah": 6,
    "ayah": 111
  },
  {
    "juz": 9,
    "surah": 7,
    "ayah": 88
  },
  {
    "juz": 10,
    "surah": 8,
    "ayah": 41
  },
  {
    "juz": 11,
    "surah": 9,
    "ayah": 93
  },
  {
    "juz": 12,
    "surah": 11,
    "ayah": 6
  },
  {
    "juz": 13,
    "surah": 12,
    "ayah": 53
  },
  {
    "juz": 14,
    "surah": 15,
    "ayah": 1
  },
  {
    "juz": 15,
    "surah": 17,
    "ayah": 1
  },
  {
    "juz": 16,
    "surah": 18,
    "ayah": 75
  },
  {
    "juz": 17,
    "surah": 21,
    "ayah": 1
  },
  {
    "juz": 18,
    "surah": 23,
    "ayah": 1
  },
  {
    "juz": 19,
    "surah": 25,
    "ayah": 21
  },
  {
    "juz": 20,
    "surah": 27,
    "ayah": 56
  },
  {
    "juz": 21,
    "surah": 29,
    "ayah": 46
  },
  {
    "juz": 22,
    "surah": 33,
    "ayah": 31
  },
  {
    "juz": 23,
    "surah": 36,
    "ayah": 28
  },
  {
    "juz": 24,
    "surah": 39,
    "ayah": 32
  },
  {
    "juz": 25,
    "surah": 41,
    "ayah": 47
  },
  {
    "juz": 26,
    "surah": 46,
    "ayah": 1
  },
  {
    "juz": 27,
    "surah": 51,
    "ayah": 31
  },
  {
    "juz": 28,
    "surah": 58,
    "ayah": 1
  },
  {
    "juz": 29,
    "surah": 67,
    "ayah": 1
  },
  {
    "juz": 30,
    "surah": 78,
    "ayah": 1
  }
] as const;

/** Return the Juz containing a given Surah and ayah (Hafs/Kufan numbering). */
export function getJuzForAyah(surahNumber: number, ayahNumber: number): number {
  let currentJuz = 1;
  for (const boundary of quranJuzBoundaries) {
    if (surahNumber > boundary.surah || (surahNumber === boundary.surah && ayahNumber >= boundary.ayah)) {
      currentJuz = boundary.juz;
    } else {
      break;
    }
  }
  return currentJuz;
}

export const getQuranSurah = (number: number) => quranSurahs.find((surah) => surah.number === number);
