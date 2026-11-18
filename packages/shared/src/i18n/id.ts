import type { Messages } from './messages.ts';
// Complete customer catalogue; independent professional/native review is not claimed.
export const messages = {
  photoUi: {
    JP: 'Jalan-jalan tradisional di Kyoto, Jepang',
    IT: 'Bangunan pesisir yang berwarna-warni di Cinque Terre, Italia',
    US: 'Patung Liberty di New York, Amerika Serikat',
    TR: 'Balon udara panas di atas formasi batuan di Cappadocia, Turki',
    FR: 'Menara Eiffel di Paris, Prancis',
    CH: 'Pegunungan bersalju dan danau beku di Engadin, Swiss',
    TH: 'Wat Arun di tepi sungai di Bangkok, Thailand',
    AU: 'Sydney Opera House di Pelabuhan Sydney, Australia',
    BR: 'Patung Kristus Penebus di atas Rio de Janeiro, Brasil',
    ZA: 'Gunung Table di Cape Town, Afrika Selatan',
    AE: 'Burj Khalifa di Dubai, Uni Emirat Arab',
    EG: 'Sebuah piramida di gurun di Giza, Mesir',
  },
  transactionUi: {
    purchaseContract: 'Kontrak Pembelian Anda',
    yourOrder: 'Pesanan Anda',
    legalAcceptanceTimestamp: 'Tanda waktu penerimaan hukum',
    taxNotRecorded: 'Pajak tidak dicatat secara terpisah pada pesanan ini.',
    wifiStep: 'Hubungkan ponsel Anda ke Wi-Fi.',
    title: 'Alozuri — Konfirmasi Pesanan & Kontrak',
    confirmedPurchase: 'Pembelian Anda yang telah dikonfirmasi',
    orderPlaced: 'Pesanan dibuat',
    paidAt: 'Pembayaran dikonfirmasi pada',
    timestampMissing: 'Cap waktu tidak termasuk dalam respons pesanan ini',
    testPayment: 'Pembayaran uji coba berhasil — tidak ada biaya nyata atau eSIM',
    customerName: 'Nama pelanggan',
    purchasedPlans: 'Paket yang dibeli',
    planReference: 'Referensi paket',
    includedCountries: 'Negara yang termasuk',
    activationRule: 'Aturan aktivasi',
    restrictions: 'Pembatasan / penggunaan wajar',
    noRestrictions: 'Tidak ada pembatasan tambahan yang dicatat.',
    supplierConditions: 'Ketentuan pemasok',
    quantity: 'Jumlah',
    unitPrice: 'Harga per unit',
    lineTotal: 'Total baris',
    paymentTotal: 'Total pembayaran',
    tax: 'Pajak yang dibebankan secara terpisah',
    taxMissing: 'Tidak dicatat secara terpisah',
    taxDoc:
      'Tidak ada tarif pajak atau pendaftaran VAT yang dicatat pada pesanan ini. Ini adalah konfirmasi pesanan dan kontrak.',
    legalAcceptance: 'Penerimaan hukum yang dicatat',
    acceptedAt: 'Diterima pada',
    termsVersion: 'Versi Syarat dan Ketentuan',
    refundVersion: 'Kebijakan Pengembalian Dana dan Pembatalan versi',
    effectiveDate: 'Tanggal berlaku kebijakan',
    totalPaid: 'Total yang dibayarkan',
    orderReference: 'Referensi pesanan',
    purchaseDate: 'Tanggal dan waktu pembelian',
    contractDate: 'Tanggal dan waktu kontrak',
    seller: 'Penjual',
    companyNumber: 'Nomor perusahaan',
    contact: 'Kontak',
    contractIncludes:
      'Detail paket, negara, masa berlaku, syarat aktivasi, dan pembatasan dalam Pesanan Anda di atas merupakan bagian dari kontrak pembelian ini.',
    thanks:
      'Terima kasih telah memilih Alozuri. Akses eSIM Anda melalui halaman pesanan aman Anda.',
    ready:
      'eSIM Anda sudah siap. Buka halaman pesanan aman Anda untuk melihat kode QR dan detail instalasi manual.',
    pending:
      'Pesanan Anda sedang diproses. Halaman pesanan aman Anda menampilkan status pesanan dan akan menampilkan kode eSIM QR, detail instalasi manual, dan informasi aktivasi setelah provisioning selesai. Gunakan tautan yang sama untuk kembali kapan saja.',
    activationNote:
      'Sebelum menginstal, periksa aturan aktivasi aktual di bawah ini untuk setiap paket. Beberapa paket dimulai saat instalasi, koneksi jaringan pertama, atau pembelian; ikuti aturan yang tercatat untuk paket yang Anda beli.',
    important:
      'Perangkat Anda harus mendukung eSIM dan tidak terkunci jaringan. Simpan kode QR, detail instalasi, dan tautan pesanan pribadi Anda dengan aman. Aturan aktivasi, masa berlaku, kuota data, dan batasan penggunaan wajar yang tercatat ditampilkan di ringkasan pesanan Anda di atas. Hubungi support@alozuri.com untuk bantuan.',
    access: 'Akses eSIM Anda',
    viewInstall: 'Lihat & Instal eSIM Anda',
    installReady: 'Instal saat Anda siap',
    openOrder: 'Buka halaman pesanan Alozuri Anda yang aman.',
    scan: 'Pindai kode eSIM QR atau ikuti petunjuk instalasi manual.',
    enable: 'Aktifkan Alozuri eSIM Anda di pengaturan ponsel Anda.',
    roaming: 'Nyalakan roaming data untuk Alozuri eSIM jika diperlukan.',
    connect: 'Terhubung ke jaringan yang didukung sesuai dengan kondisi aktivasi paket Anda.',
    importantTitle: 'Informasi penting',
    originalRetail: 'Harga eceran asli',
    promotion: 'Promosi {code} ({percent}%)',
    taxPresent:
      'Pajak yang dibebankan secara terpisah: {amount}. Tidak ada tarif pajak atau pendaftaran VAT yang tercatat pada pesanan ini.',
    paymentStatus: 'Status pembayaran',
  },
  legalUi: {
    about: 'Tentang Alozuri',
    eyebrow: 'ALOZURI · HUKUM & INFORMASI PELANGGAN',
    effective: 'Berlaku mulai {date} · Versi {version}',
    version: 'Versi {version}',
    permanent: 'Versi permanen',
    contents: 'Di halaman ini',
    scroll: 'Geser atau gulir untuk melihat semua kolom.',
    related: 'Kebijakan terkait',
    archived: 'Versi kebijakan yang diarsipkan',
    previous: 'Sebelumnya {title}',
    request: 'Untuk meminta salinan versi kebijakan ini, hubungi {support}.',
    orderCopies:
      'Syarat pembelian Anda tetap tersedia di konfirmasi pesanan Anda dan dokumen yang dapat diunduh di halaman pesanan pribadi Anda.',
    unchanged: 'Pembaruan ini tidak mengubah syarat yang sudah berlaku untuk pembelian Anda.',
    current: 'Baca {title} saat ini',
    notice:
      'Dengan melakukan pemesanan, Anda setuju dengan Syarat & Ketentuan kami dan mengakui Kebijakan Pengembalian, Kebijakan Privasi, serta Persyaratan Kompatibilitas eSIM kami.',
    documentHeader: 'Versi {version} — berlaku mulai {date}',
  },
  seoUi: {
    homeTitle: 'Alozuri eSIM perjalanan untuk perjalanan internasional',
    homeDescription:
      'Bandingkan data eSIM perjalanan prabayar untuk satu negara atau perjalanan multi-negara. Tinjau cakupan sebenarnya, kuota, masa berlaku, dan aktivasi sebelum membayar.',
    destTitle: 'eSIM destinasi',
    destDescription:
      'Temukan cakupan eSIM perjalanan berdasarkan negara atau bandingkan satu paket untuk rencana perjalanan multi-negara.',
    helpTitle: 'Bantuan dan eSIM instalasi',
    helpDescription:
      'Dapatkan bantuan untuk memeriksa kompatibilitas perangkat, memasang eSIM perjalanan Anda, memahami aktivasi, dan menghubungi Alozuri.',
    planDescription:
      'Data perjalanan {allowance} untuk {days}. Tinjau cakupan negara yang terverifikasi, aktivasi, dan kondisi penggunaan wajar sebelum membeli.',
    planTitle: 'Rincian paket',
    planUnavailable:
      'Periksa ketersediaan eSIM saat ini dan rincian paket yang sudah diverifikasi.',
    tagline: 'Alozuri — Satu eSIM. Setiap tujuan.',
  },
  partnersUi: {
    metaTitle: 'Program Afiliasi Alozuri | Menjadi Mitra',
    metaDescription:
      'Bergabung dengan Program Afiliasi Alozuri. Dapatkan komisi 10% untuk setiap referensi eSIM yang memenuhi syarat dengan pelacakan selama 30 hari dan dasbor mitra khusus.',
    eyebrow: 'MITRA ALOZURI',
    title: 'Bermitra dengan Alozuri',
    intro:
      'Bantu pelancong tetap terhubung di seluruh dunia dan dapatkan komisi dengan merekomendasikan paket Alozuri eSIM.',
    apply: 'Jadi Mitra',
    free: 'Gratis untuk bergabung. Aplikasi tunduk pada persetujuan.',
    benefitsTitle: 'Kemitraan yang menguntungkan.',
    commissionTitle: '10% Komisi',
    commission:
      'Dapatkan 10% dari setiap pembelian eSIM yang memenuhi syarat yang dikaitkan dengan referral Anda.',
    trackingTitle: 'Pelacakan 30 Hari',
    tracking:
      'Terima kredit untuk pembelian yang memenuhi syarat yang diselesaikan dalam 30 hari setelah referral.',
    dashboardTitle: 'Dasbor Khusus',
    dashboard: 'Akses dasbor afiliasi Anda untuk memantau referral, penjualan, dan komisi.',
    applyStep: 'Daftar',
    applyText: 'Kirim aplikasi Anda untuk bergabung dengan Program Afiliasi Alozuri.',
    shareStep: 'Bagikan',
    shareText:
      'Setelah disetujui, terima tautan referral unik Anda dan promosikan Alozuri melalui saluran Anda.',
    earnStep: 'Dapatkan',
    earnText:
      'Dapatkan komisi dari pembelian yang memenuhi syarat dan lacak kinerja Anda melalui dasbor afiliasi.',
    audienceTitle: 'Siapa yang bisa bermitra dengan kami?',
    audienceIntro:
      'Apakah Anda membuat konten perjalanan atau membantu orang merencanakan perjalanan mereka, Alozuri menawarkan cara sederhana untuk mendapatkan penghasilan dengan merekomendasikan paket data internasional eSIM.',
    youtube: 'YouTuber Perjalanan',
    creators: 'Pembuat konten dan influencer',
    blogs: 'Blogger dan penerbit perjalanan',
    agencies: 'Agen perjalanan',
    communities: 'Komunitas perjalanan',
    termsEyebrow: 'JELAS DARI AWAL',
    paymentsTitle: 'Komisi dan pembayaran',
    paymentsIntro: 'Program yang sederhana, dengan kriteria kelayakan yang jelas.',
    termCommission: 'Komisi 10% dari pembelian yang memenuhi syarat.',
    termWindow: 'Jendela pelacakan referensi selama 30 hari.',
    termAttribution: 'Atribusi klik terakhir.',
    termPending: 'Komisi tetap tertunda selama 30 hari setelah pembelian.',
    termMinimum: 'Saldo minimum pembayaran: $50 setara USD.',
    termPaid:
      'Komisi yang disetujui dibayarkan setiap bulan melalui metode pembayaran yang didukung.',
    termExcluded:
      'Transaksi yang dikembalikan, dibatalkan, penipuan, atau chargeback tidak memenuhi syarat.',
    faqIntro: 'Beberapa hal yang perlu diketahui sebelum Anda mendaftar.',
    q1: 'Apakah bergabung gratis?',
    a1: 'Ya. Tidak ada biaya untuk mendaftar atau berpartisipasi.',
    q2: 'Siapa yang bisa menjadi mitra?',
    a2: 'Pencipta konten perjalanan, blogger, penerbit, dan bisnis terkait dapat mendaftar. Semua pendaftaran harus disetujui.',
    q3: 'Berapa banyak yang bisa saya hasilkan?',
    a3: 'Afiliasi memperoleh komisi 10% dari pembelian yang memenuhi syarat yang berasal dari rujukan mereka.',
    q4: 'Bagaimana rujukan dilacak?',
    a4: 'Rujukan dilacak hingga 30 hari, tergantung pada izin yang berlaku dan ketersediaan pelacakan.',
    q5: 'Kapan saya akan dibayar?',
    a5: 'Komisi yang disetujui dibayarkan setiap bulan ketika saldo yang dapat dibayarkan Anda mencapai setara $50 USD.',
    q6: 'Di mana saya bisa melihat penghasilan saya?',
    a6: 'Mitra yang disetujui dapat mengakses dasbor afiliasi Endorsely mereka.',
    finalTitle: 'Mari tumbuh bersama.',
    finalText:
      'Bergabunglah dengan Program Afiliasi Alozuri dan mulai menghasilkan dengan membantu para pelancong tetap terhubung.',
    finalApply: 'Ajukan permohonan untuk Menjadi Mitra',
    newTab: 'buka di tab baru',
  },
  regionUi: {
    title: 'eSIM perjalanan multi-negara Eropa',
    description:
      'Bandingkan paket data eSIM untuk perjalanan multi-negara di Eropa. Periksa negara yang termasuk dalam setiap paket, harga saat ini, masa berlaku, dan aktivasi; cakupan regional bervariasi.',
    eyebrow: 'DATA PERJALANAN MULTI-NEGARA',
    heading: 'eSIM Eropa untuk rencana perjalanan Anda',
    intro:
      'Bepergian dari Amerika Serikat atau tempat lain ke beberapa negara di Eropa? Bandingkan satu paket data dengan tujuan perjalanan Anda yang sebenarnya. Eropa adalah label regional, bukan jaminan bahwa setiap negara Eropa termasuk.',
    example:
      'Paket contoh di bawah ini mencakup {countries}. Buka daftar setiap negara untuk cakupan penuhnya, atau ubah rencana perjalanan di perencana. Tidak ada paket yang diberi label mencakup seluruh Eropa.',
    tip1: 'Tambahkan setiap negara yang akan Anda kunjungi, termasuk tempat transit di mana Anda memerlukan data seluler.',
    tip2: 'Jangan berasumsi UK, Swiss atau Turki termasuk hanya karena paket mengatakan Eropa.',
    tip3: 'Untuk perbandingan eSIM 10 GB di Eropa, pilih jatah tersebut dan bandingkan validitas serta daftar cakupan penuhnya. Periksa dukungan hotspot di kondisi paket yang diberikan jika Anda membutuhkannya.',
    question1: 'Bisakah satu eSIM mencakup beberapa negara Eropa?',
    answer1:
      'Ya, jika daftar cakupan yang diverifikasi mencakup setiap negara dalam perjalanan Anda. Perencana mengharuskan setiap negara yang dipilih tercakup; paket lokal untuk hanya satu tempat persinggahan bukanlah kecocokan yang lengkap.',
    question2: 'Apakah saya perlu menginstal eSIM secara terpisah di setiap negara?',
    answer2:
      'Satu profil regional dapat mencakup beberapa negara, sesuai dengan cakupan paket tersebut dan kondisi aktivasi. Periksa plan-nya daripada mengasumsikan operator atau kecepatan jaringan sama di mana-mana.',
    oneCountry: 'Mengunjungi satu negara? Bandingkan {gb} atau {destinations}.',
    adviceTitle: 'Rencanakan data seluler Anda sebelum bepergian',
    questions: 'Pertanyaan umum',
    adviceLinks:
      'Periksa {compatibility}, baca {installation}, atau tinjau {refunds}. Instalasi dan aktivasi dapat memengaruhi kelayakan pembatalan; kebijakan menjelaskan pengecualian dan hak konsumen.',
    compatibility: 'kompatibilitas perangkat',
    installation: 'kapan menginstal eSIM Anda',
    notFound: 'Tujuan tidak ditemukan',
    genericTitle: '{country} perjalanan eSIM',
    genericDescription:
      'Bandingkan paket data perjalanan {country}, kuota, masa berlaku, dan aturan aktivasi. Temukan cakupan lokal atau buat rencana perjalanan beberapa negara.',
  },
  destinationCopy: {
    USTitle: 'eSIM perjalanan USA untuk perjalanan dari UK dan seterusnya',
    USDescription:
      'Bandingkan paket data perjalanan USA eSIM berdasarkan kuota, masa berlaku, harga saat ini, dan aktivasi. Periksa cakupan di AS sebelum perjalanan ke satu negara atau multi-tujuan.',
    USIntro:
      'Bepergian dari UK ke AS? Bandingkan data prabayar untuk peta, pesan, dan pemesanan perjalanan tanpa mengasumsikan kuota roaming rumah Anda berlaku. Pilih paket hanya untuk USA atau periksa setiap pemberhentian di rencana perjalanan yang lebih luas.',
    USTip1:
      'Pilih periode validitas yang mencakup kedatangan dan keberangkatan Anda, lalu periksa kapan waktunya mulai.',
    USTip2:
      'Paket untuk Amerika Serikat tidak otomatis termasuk Kanada atau Meksiko. Tambahkan pemberhentian tersebut ke perencana perjalanan jika Anda membutuhkannya.',
    USTip3:
      'Untuk perbandingan 10 GB, gunakan filter allowance dan bandingkan validitas serta kebijakan data maupun harga.',
    USQuestion1: 'Apakah eSIM dari USA akan bekerja pada ponsel UK saya?',
    USAnswer1:
      'Model ponsel Anda harus mendukung eSIM dan tidak terkunci oleh operator. Periksa pabrikan dan operator Anda sebelum membeli; negara tempat Anda membeli ponsel tidak menjamin kompatibilitas.',
    USQuestion2: 'Apakah eSIM dari USA menyertakan nomor telepon AS?',
    USAnswer2:
      'Paket yang ditampilkan di sini menyediakan data seluler. Jangan menganggap nomor lokal, panggilan suara biasa, atau SMS disertakan. Panggilan dan pesan melalui internet menggunakan kuota data Anda.',
    GBTitle: 'UK eSIM travel untuk turis dan pelancong Amerika',
    GBDescription:
      'Bandingkan data, validitas, dan harga terkini untuk eSIM perjalanan prabayar Inggris. Periksa kompatibilitas perangkat, jaringan, dan aktivasi untuk kunjungan UK Anda.',
    GBIntro:
      'Mengunjungi Inggris dari Amerika Serikat atau negara lain? Gunakan daftar paket untuk membandingkan data seluler untuk petunjuk perjalanan, pemesanan, dan tetap berhubungan. Periksa bahwa ponsel Anda tidak terkunci sebelum membayar.',
    GBTip1:
      'Jika ponsel AS Anda dibiayai atau terkunci ke operator, tanyakan kepada operator tentang kelayakan buka kunci sebelum perjalanan Anda.',
    GBTip2:
      'Bepergian ke Eropa selanjutnya? Paket UK saja tidak akan otomatis mencakup negara berikutnya; bandingkan paket multi-negara.',
    GBTip3:
      'Periksa daftar negara setiap paket daripada mengasumsikan pulau atau wilayah terdekat termasuk.',
    GBQuestion1: 'Bisakah orang Amerika membeli paket perjalanan UK eSIM?',
    GBAnswer1:
      'Anda dapat membandingkan dan membeli paket sebagai tamu. Ponsel Anda harus mendukung profil eSIM yang diberikan dan tidak terkunci oleh operator; kewarganegaraan asal Anda tidak menentukan kompatibilitas perangkat.',
    GBQuestion2: 'Apakah UK termasuk dalam eSIM Eropa?',
    GBAnswer2:
      'Hanya jika paket tertentu mencantumkan Inggris. Nama regional saja bukan bukti cakupan; periksa negara yang termasuk sebelum membeli.',
    JPTitle: 'Paket data perjalanan Jepang eSIM',
    JPDescription:
      'Bandingkan kuota, masa berlaku, harga saat ini, dan aturan aktivasi penyedia paket data perjalanan Jepang eSIM. Periksa jaringan yang didukung dan kompatibilitas sebelum perjalanan Anda.',
    JPIntro:
      'Merencanakan perjalanan ke Jepang? Anggarkan data seluler untuk navigasi antar tempat, menerjemahkan teks, mengirim pesan, dan memeriksa reservasi. Bandingkan kuota tetap dengan paket harian dan baca apa yang terjadi saat kuota harian digunakan.',
    JPTip1:
      'Unduh peta dan paket bahasa besar melalui Wi-Fi sebelum keberangkatan untuk mengurangi penggunaan data seluler.',
    JPTip2:
      'Jangan menganggap setiap paket dimulai saat tiba. Baca aturan aktivasi yang disediakan sebelum menginstal.',
    JPTip3:
      'Untuk perjalanan Asia yang lebih luas, tambahkan setiap tujuan alih-alih menganggap paket Jepang mencakup negara lain.',
    JPQuestion1: 'Bisakah saya menginstal eSIM Jepang sebelum terbang?',
    JPAnswer1:
      'Itu tergantung pada aturan aktivasi paket. Instalasi dapat memulai masa berlaku pada beberapa profil, jadi periksa paket yang dibeli sebelum memindai kode QR.',
    JPQuestion2: 'Jaringan Jepang mana yang dapat saya gunakan?',
    JPAnswer2:
      'Gunakan jaringan yang dilaporkan untuk paket tertentu. Jika pemasok belum menyediakan informasi jaringan, Alozuri tidak menjanjikan operator atau kecepatan tertentu.',
    THTitle: 'Paket data wisatawan Thailand eSIM',
    THDescription:
      'Bandingkan kuota data, masa berlaku, dan harga terkini untuk perjalanan ke Thailand eSIM. Baca detail jaringan, aktivasi, dan batas harian untuk liburan Anda.',
    THIntro:
      'Pilih data perjalanan ke Thailand sesuai durasi liburan dan cara Anda menggunakan ponsel. Peta, transfer, pesan, dan video tidak menggunakan jumlah data yang sama; bandingkan kuota dan masa berlaku secara bersamaan.',
    THTip1:
      'Untuk liburan 7 hari, periksa apakah masa berlaku dimulai saat pembelian, pemasangan, atau koneksi jaringan pertama yang didukung.',
    THTip2:
      'Paket harian mungkin mengurangi kecepatan atau menghentikan data setelah kuota hariannya; baca kebijakan yang dinyatakan.',
    THTip3:
      'Jika Anda juga mengunjungi negara lain, tambahkan ke perencana agar setiap pemberhentian tercakup.',
    THQuestion1: 'Apakah SIM turis eSIM sama dengan SIM suara lokal?',
    THAnswer1:
      'Paket Alozuri yang ditampilkan di sini hanya untuk data. Jangan menganggap mereka menyertakan nomor telepon lokal atau SMS.',
    THQuestion2: 'Apakah unlimited berarti tanpa batasan?',
    THAnswer2:
      'Tidak. Jika suatu paket menggunakan label itu, baca pembatasan penggunaan wajar dan kecepatan dari penyedia. Alokasi tetap atau harian mungkin lebih mudah untuk dibandingkan.',
    TRTitle: 'Paket data untuk perjalanan ke Turki eSIM',
    TRDescription:
      'Bandingkan paket data Turki eSIM dan harga saat ini untuk pelancong UK dan pengunjung lainnya. Tinjau jangkauan, masa berlaku, dan aktivasi sebelum membeli.',
    TRIntro:
      'Bepergian dari UK ke Turki? Bandingkan paket data khusus Turki daripada mengandalkan label regional atau mengira paket roaming rumah Anda mencakup perjalanan tersebut.',
    TRTip1:
      'Baca daftar negara yang sebenarnya: kata Eropa pada paket lain tidak serta merta menunjukkan jangkauan Turki.',
    TRTip2:
      'Gunakan Wi-Fi untuk cadangan dan unduhan, lalu anggarkan data seluler untuk navigasi dan pesan.',
    TRTip3:
      'Matikan roaming data dan pengalihan data otomatis pada SIM rumah Anda jika ingin menghindari penggunaan roaming.',
    TRQuestion1: 'Apakah eSIM Eropa mencakup Turki?',
    TRAnswer1:
      'Hanya jika Turki muncul dalam daftar negara yang termasuk dalam paket tersebut. Buatlah rencana perjalanan yang mencakup Turki untuk membandingkan paket yang mencakupnya.',
    TRQuestion2: 'Bagaimana saya bisa menghindari biaya roaming jaringan rumah?',
    TRAnswer2:
      'Pilih eSIM perjalanan untuk data seluler dan ikuti petunjuk roamingnya. Nonaktifkan secara terpisah roaming data dan pengalihan data otomatis untuk SIM rumah Anda; biaya panggilan dan SMS dari operator rumah masih dapat berlaku.',
    AETitle: 'Paket data perjalanan eSIM UAE',
    AEDescription:
      'Bandingkan kuota data, masa berlaku, aktivasi, dan harga terkini paket data perjalanan eSIM UAE. Periksa ketentuan paket untuk kunjungan Anda ke Uni Emirat Arab.',
    AEIntro:
      'Mengunjungi Uni Emirat Arab? Pilih kuota data dan periode berlaku selama Anda tinggal, lalu baca rincian aktivasi dan jaringan dari penyedia. Simpan salinan pemesanan penting secara offline.',
    AETip1:
      'Untuk transit, periksa periode berlaku penuh dan kapan paket dimulai daripada hanya memilih berdasarkan ukuran data.',
    AETip2:
      'Data seluler tidak menjamin bahwa setiap aplikasi panggilan atau pesan tersedia di tujuan Anda.',
    AETip3:
      'Untuk perjalanan lanjutan, periksa setiap negara di perencana perjalanan daripada menganggap paket UAE menyediakan cakupan regional.',
    AEQuestion1: 'Apakah UAE eSIM menyertakan panggilan telepon biasa?',
    AEAnswer1:
      'Paket yang ditampilkan di sini hanya untuk data. Periksa syarat operator rumah Anda jika Anda berniat menggunakan SIM rumah untuk panggilan suara atau SMS biasa.',
    AEQuestion2: 'Bisakah saya mengandalkan jaringan atau kecepatan tertentu?',
    AEAnswer2:
      'Hanya jaringan yang benar-benar disediakan untuk paket yang dipilih yang tercantum. Cakupan dan kecepatan tergantung pada lokasi, perangkat, dan kondisi jaringan; tidak ada kecepatan tetap yang dijanjikan.',
  },
  guideUi: {
    title: 'Panduan perjalanan eSIM',
    description:
      'Panduan praktis untuk memilih data perjalanan eSIM, membuat anggaran untuk perjalanan Anda, memeriksa kompatibilitas, dan memasang dengan aman.',
    intro:
      'Buat paket data praktis untuk perjalanan Anda. Mulailah dengan negara, perangkat Anda yang tepat, dan aturan aktivasi paket yang Anda pilih.',
    compare:
      'Siap membandingkan? Jelajahi paket perjalanan untuk {us}, {gb}, {europe}, {jp}, dan {th}.',
    all: 'Semua panduan perjalanan',
    policy: 'Baca {refunds} sebelum instalasi. Untuk bantuan dengan pesanan, {support}.',
    notFound: 'Panduan tidak ditemukan',
  },
  guideCopy: {
    usaTitle: 'Cara memilih eSIM untuk Amerika Serikat',
    usaDescription:
      'Daftar periksa praktis untuk membandingkan cakupan USA eSIM, kuota data, masa berlaku, dan kompatibilitas sebelum membeli.',
    usaDestination: 'Bandingkan paket USA eSIM',
    usaHeading1: 'Mulailah dengan jadwal perjalanan Anda, bukan harga utama termurah',
    usaParagraph1A:
      'Paket untuk Amerika Serikat tidak otomatis berlaku untuk Kanada atau Meksiko. Tuliskan setiap negara di mana Anda memerlukan data, termasuk saat singgah jika Anda berniat meninggalkan bandara. Gunakan pencarian untuk satu tujuan jika perjalanan hanya di USA dan perencana multi-negara untuk lebih banyak pemberhentian.',
    usaParagraph1B:
      'Untuk pelancong UK, bandingkan perjalanan eSIM dengan penawaran roaming aktual dari operator rumah Anda. Jangan menganggap kuota domestik dapat digunakan di luar negeri dengan harga yang sama.',
    usaHeading2: 'Bandingkan yang sejenis dengan yang sejenis',
    usaParagraph2A:
      'Bandingkan tunjangan tetap seperti 10 GB dengan tunjangan tetap lainnya sepanjang perjalanan Anda. Tunjangan harian adalah produk yang berbeda: periksa apakah itu direset, mengurangi kecepatan, atau menghentikan data setelah batas harian yang ditentukan. Jangan bandingkan keduanya dengan label tak terbatas tanpa membaca kondisi penggunaan wajar.',
    usaParagraph2B:
      'Periksa masa berlaku dan pemicu aktivasi bersama-sama. Paket 7-hari yang lebih murah mungkin tidak mencakup kunjungan 10-hari, dan paket yang dimulai saat instalasi bisa mulai sebelum Anda terbang. Jaringan, batasan, dan daftar negara ditampilkan dalam spesifikasi paket saat diberikan.',
    usaHeading3: 'Periksa detail telepon dan pengiriman yang tepat',
    usaParagraph3A:
      'Konfirmasi bahwa model perangkat Anda yang tepat mendukung eSIM dan tidak terkunci oleh operator Anda. Nama model yang mendukung eSIM tidak cukup jika varian regional atau kunci operator mencegah pemasangan.',
    usaParagraph3B:
      'Gunakan alamat email yang dapat Anda akses melalui Wi-Fi. Jaga tautan pesanan aman dan kredensial instalasi tetap pribadi. Sebelum membeli, baca kebijakan pengembalian: instalasi atau aktivasi dapat memengaruhi kelayakan pembatalan.',
    budgetTitle: 'Berapa banyak data seluler yang Anda butuhkan untuk liburan 7 hari atau 14 hari?',
    budgetDescription:
      'Perkirakan anggaran data perjalanan dari penggunaan ponsel Anda sendiri, durasi perjalanan, akses Wi-Fi dan jenis kuota.',
    budgetDestination: 'Bandingkan destinasi dan kuota data',
    budgetHeading1: 'Gunakan penggunaan terbaru Anda sebagai titik awal',
    budgetParagraph1A:
      'Buka pengaturan data seluler ponsel Anda dan catat periode pengukuran. Jika mencakup satu bulan, jangan salah mengira total itu untuk satu minggu. Lihat aplikasi yang Anda harapkan untuk digunakan saat bepergian dan bedakan data seluler dari penggunaan Wi-Fi.',
    budgetParagraph1B:
      'Sebagai contoh aritmetika—bukan janji penggunaan—500 MB setiap hari sekitar 3.5 GB selama tujuh hari atau 7 GB selama empat belas hari, menggunakan satuan desimal. Buffer 20% akan membuat perkiraan tersebut sekitar 4.2 GB dan 8.4 GB. Penggunaan Anda yang sebenarnya mungkin sangat berbeda.',
    budgetHeading2: 'Identifikasi apa yang dapat berubah saat di luar negeri.',
    budgetParagraph2A:
      'Navigasi, pesan, dan konfirmasi pemesanan berperilaku berbeda dari sesi video panjang, panggilan video, atau tethering laptop. Cadangan foto di latar belakang, pembaruan sistem, dan unduhan aplikasi dapat mengonsumsi data tanpa sesi penjelajahan yang jelas.',
    budgetParagraph2B:
      'Unduh peta, media, dan file besar melalui Wi-Fi bila memungkinkan. Periksa pengaturan aplikasi untuk unduhan otomatis dan cadangan cloud. Jika Anda berencana untuk membagikan koneksi, pertama konfirmasi pembatasan hotspot paket yang dipilih; jangan menganggap semua paket memungkinkan penggunaan yang sama.',
    budgetHeading3: 'Cocokkan baik jatah maupun masa berlaku',
    budgetParagraph3A:
      'Jatah tetap 10 GB berlaku sampai digunakan atau paket berakhir, sesuai dengan ketentuannya. Produk 1 GB per hari memiliki aturan harian dan mungkin tidak membolehkan sisa jatah dibawa ke hari berikutnya. Periksa kata-kata pasti mengenai reset atau penggunaan wajar.',
    budgetParagraph3B:
      'Pilih masa berlaku yang cukup untuk perjalanan dan periksa kapan mulai. Sisakan cadangan praktis untuk perubahan rencana perjalanan; jatah yang terlihat cukup tidak berguna setelah masa berlaku paket berakhir. Pembacaan penggunaan yang diberikan oleh jaringan mungkin tertunda, jadi penghitung di perangkat Anda berguna untuk pemantauan sehari-hari.',
    installTitle: 'Bisakah Anda memasang eSIM sebelum bepergian?',
    installDescription:
      'Pahami perbedaan antara pemasangan dan aktivasi, periksa aturan mulai paket, dan siapkan kode atau detail manual QR dengan aman.',
    installDestination: 'Periksa kompatibilitas dan pemasangan eSIM',
    installHeading1: 'Pemasangan dan aktivasi adalah pemeriksaan yang berbeda',
    installParagraph1A:
      'Tidak ada jawaban ya atau tidak yang universal. Beberapa paket mulai berlaku saat dibeli, beberapa saat dipasang, dan lainnya saat koneksi jaringan yang didukung pertama kali. Baca aturan untuk paket yang Anda beli sebelum memindai kode QR.',
    installParagraph1B:
      'Jika pemasangan memulai berlaku, memasang beberapa hari sebelum keberangkatan bisa menggunakan sebagian paket sebelum perjalanan Anda. Jika paket mulai berlaku saat koneksi jaringan yang didukung, ikuti instruksi pemasangannya dan jangan menganggap bisa disimpan tanpa batas: periksa juga batas waktu unduhan atau aktivasi.',
    installHeading2: 'Siapkan sebelum membuka kode QR',
    installParagraph2A:
      'Konfirmasi kompatibilitas perangkat dan status buka kunci operator, lalu hubungkan ke Wi-Fi yang dapat diandalkan. Buka tautan pesanan aman dari email pengiriman Anda. Jika Anda perlu memindai kode QR, tampilkan di layar lain; gunakan detail instalasi manual yang diberikan bila sesuai.',
    installParagraph2B:
      'Labeli profil baru dengan jelas sehingga Anda dapat membedakannya dari SIM rumah Anda. Jaga kode QR dan kredensial aktivasi tetap pribadi, dan hindari menghapus profil yang sudah diinstal: sebuah profil mungkin hanya bisa diinstal sekali.',
    installHeading3: 'Di tujuan Anda',
    installParagraph3A:
      'Pilih eSIM perjalanan untuk data seluler dan ikuti instruksi paket untuk pengaturan roaming profil tersebut. Tinjau secara terpisah pengaturan roaming data dan pengalihan data otomatis pada SIM rumah Anda.',
    installParagraph3B:
      'Instalasi atau aktivasi dapat memengaruhi kelayakan pengembalian dana bahkan jika Anda belum sengaja menggunakan data. Baca kebijakan pengembalian dana sebelum instalasi dan hubungi dukungan jika aturan aktivasi yang diberikan tidak jelas.',
    roamingTitle: 'Cara menghindari biaya roaming tak terduga di luar negeri',
    roamingDescription:
      'Periksa pengaturan SIM rumah Anda, bandingkan biaya roaming, dan pilih eSIM perjalanan tanpa mengasumsikan bahwa setiap jenis biaya tercakup.',
    roamingDestination: 'Bandingkan paket data perjalanan',
    roamingHeading1: 'Periksa apa yang benar-benar dibebankan oleh operator rumah Anda',
    roamingParagraph1A:
      'Sebelum bepergian, periksa syarat operator Anda untuk tujuan yang tepat. Pass roaming harian, kuota yang termasuk, dan roaming bayar sesuai pemakaian dapat memiliki biaya yang sangat berbeda. Perhatikan apakah panggilan, SMS, dan data dikenakan biaya terpisah.',
    roamingParagraph1B:
      'Bandingkan biaya selama durasi perjalanan Anda dengan eSIM perjalanan yang sesuai. Gunakan harga setelah diskon yang sah, mata uang yang disebutkan, dan periode berlaku penuh. Jangan menganggap bahwa perjalanan eSIM selalu lebih murah untuk setiap pelancong.',
    roamingHeading2: 'Jaga kedua profil SIM tetap terpisah',
    roamingParagraph2A:
      'Pilih perjalanan eSIM sebagai jalur data seluler Anda. Ikuti petunjuk roaming eSIM sendiri: beberapa profil perjalanan memerlukan roaming data diaktifkan untuk terhubung ke jaringan yang didukung.',
    roamingParagraph2B:
      'Untuk SIM rumah Anda, nonaktifkan roaming data dan pergantian data seluler otomatis jika Anda ingin menghindari penggunaan data roaming. Pengaturan tepatnya bervariasi tergantung perangkat. Mempertahankan jalur rumah aktif untuk panggilan atau pesan teks masih bisa melibatkan biaya dari operator rumah; perjalanan eSIM hanya data tidak menghilangkan biaya tersebut.',
    roamingHeading3: 'Hindari kejutan latar belakang',
    roamingParagraph3A:
      'Gunakan Wi-Fi untuk unduhan besar, pembaruan, dan cadangan foto. Periksa aplikasi mana yang diizinkan menggunakan data seluler dan apakah perangkat yang terhubung ke hotspot dapat mengunduh pembaruan.',
    roamingParagraph3B:
      'Periksa aturan penggunaan wajar dari paket yang dipilih dan pantau penggunaan. Pembacaan dari penyedia bisa tertunda; ini bukan jaminan waktu nyata dari sisa saldo. Jika Anda melintasi ke negara lain, pastikan bahwa hal itu secara eksplisit termasuk sebelum mengandalkan paket yang sama.',
    compatibilityTitle:
      'eSIM kompatibilitas dan aktivasi: apa yang harus diperiksa sebelum membeli',
    compatibilityDescription:
      'Periksa varian perangkat Anda yang tepat, status buka kunci operator, aturan aktivasi paket, dan langkah instalasi aman.',
    compatibilityDestination: 'Buka daftar periksa kompatibilitas dan instalasi',
    compatibilityHeading1: 'Periksa model, wilayah, dan kunci operator yang tepat',
    compatibilityParagraph1A:
      'Gunakan spesifikasi pabrikan untuk model dan negara pembelian Anda yang tepat. Satu keluarga model mungkin termasuk varian regional dengan dukungan SIM berbeda. Periksa opsi Add eSIM, tetapi juga verifikasi dukungan pabrikan dan status unlock operator.',
    compatibilityParagraph1B:
      'Jika ponsel Anda terkunci, tanyakan pada operator tentang kelayakan dan waktu sebelum membeli profil perjalanan. Jangan menganggap bahwa unlock bisa dilakukan setelah Anda tiba atau hanya karena perangkat mendukung perangkat keras eSIM.',
    compatibilityHeading2: 'Baca kondisi paket sebelum memasang',
    compatibilityParagraph2A:
      'Konfirmasi negara yang Anda butuhkan, jenis kuota, masa berlaku, pemicu aktivasi, dan batas waktu unduhan. Periksa daftar jaringan dan batasan dari pemasok jika disediakan; informasi jaringan atau kecepatan yang hilang bukanlah janji.',
    compatibilityParagraph2B:
      'Paket data-only tidak menetapkan nomor telepon lokal, layanan suara, atau hak SMS. Jika Anda membutuhkan layanan tersebut, periksa syarat operator rumah Anda secara terpisah.',
    compatibilityHeading3: 'Pasang dengan aman dan simpan jalur pemulihan',
    compatibilityParagraph3A:
      'Sambungkan ke Wi-Fi, buka detail instalasi aman dari pesanan Anda dan ikuti petunjuk untuk paket yang sebenarnya. Tetap jaga akses ke email pengiriman dan jangan bagikan kredensial aktivasi dengan orang lain.',
    compatibilityParagraph3B:
      'Jika koneksi gagal, konfirmasi saluran data, jangkauan, dan petunjuk roaming/APN yang diberikan sebelum menghapus profil. Hubungi dukungan Alozuri dengan referensi pesanan Anda; jangan pernah mengirim detail kartu lengkap atau kata sandi. Halaman kompatibilitas dan kebijakan pengembalian menyediakan langkah berikutnya dan kondisi yang berlaku.',
  },
  helpUi: {
    eyebrow: 'SEBENTAR BANTUAN UNTUK PERJALANAN',
    title: 'Mari kita hubungkan Anda.',
    intro: 'Periksa perangkat Anda, pahami paket Anda, dan instal dengan percaya diri.',
    compatibility:
      'Perangkat Anda harus mendukung eSIM dan tidak terkunci operator. Cari “Tambah eSIM” di pengaturan seluler. Kompatibilitas tergantung pada model dan negara pembelian; konfirmasikan dengan produsen atau operator Anda sebelum membeli.',
    unlock:
      'Di iPhone, lihat di Pengaturan → Umum → Tentang untuk informasi kunci operator. Di Android, periksa dengan operator Anda jika status buka kunci tidak jelas.',
    beforeTitle: '1. Sebelum instalasi',
    before:
      'Hubungkan ke Wi-Fi yang dapat diandalkan. Buka pesanan Anda dari akun Anda. Baca kapan masa berlaku dimulai: pembelian, instalasi, atau koneksi jaringan pertama yang didukung, sesuai dengan paket.',
    addTitle: '2. Tambahkan eSIM Anda',
    add: 'iPhone: Pengaturan → Seluler / Layanan Seluler → Tambah eSIM. Android: Pengaturan → Koneksi / Jaringan & internet → Pengelola SIM / SIM → Tambah eSIM. Menu dapat berbeda tergantung perangkat.',
    private:
      'Gunakan kode QR atau rincian aktivasi manual yang disediakan dengan pesanan Anda. Jangan pernah membagikan kode aktivasi Anda.',
    arrivalTitle: '3. Di tujuan Anda',
    arrival:
      'Pilih eSIM perjalanan Anda untuk data mobile dan ikuti petunjuk roamingnya. Matikan roaming data dan pengalihan data otomatis untuk SIM rumah Anda untuk menghindari biaya operator.',
    connectionTitle: 'Koneksi tidak berfungsi?',
    connection:
      'Periksa apakah paket Anda mencakup negara tersebut, eSIM Anda dipilih untuk data, dan petunjuk aktivasi serta roaming telah diikuti. Coba mode pesawat secara singkat. Masukkan APN hanya jika pesanan Anda menyediakannya. Hindari menghapus eSIM yang terpasang; pemasangan ulang mungkin tidak didukung.',
    readings:
      'Jika penyedia memberikan pembacaan penggunaan, akun Anda dapat menampilkan saldo yang dilaporkan dan waktu pengecekan. Pembacaan bisa tertunda dan tidak menjamin waktu nyata.',
    moreGuides: 'Untuk saran persiapan lebih lanjut, baca {guides} kami, termasuk {budget}.',
    guideLabel: 'panduan perjalanan eSIM',
    budgetLabel: 'anggaran data 7 hari atau 14 hari',
    needHelp: 'Butuh bantuan lebih lanjut?',
    supportIntro: 'Email {support} atau kunjungi halaman kontak kami.',
    contact: 'Hubungi dukungan',
  },
  countryUi: {
    search: 'Cari tujuan',
    available: '{count} destinasi yang tersedia',
    compare: 'Bandingkan paket data',
    availabilityHint:
      'Ketersediaan paket saat ini tidak dapat dikonfirmasi di sini. Gunakan perencana di bawah ini untuk memeriksa opsi saat ini; tidak ada harga atau cakupan yang dijanjikan hingga diverifikasi.',
    localPlans: 'Paket lokal saat ini',
    multiPlans: 'Paket multi-negara saat ini',
    review:
      'Tinjau seluruh ketentuan paket dan total pembayaran saat ini sebelum membeli. Gunakan perencana untuk membandingkan semua kuota dan cakupan regional.',
    conditions: 'Cakupan, jaringan, dan aktivasi',
    fullSpecs: 'Spesifikasi paket lengkap dan harga saat ini',
    pricesError:
      'Harga mata uang saat ini tidak dapat dimuat. Gunakan perencana untuk mencoba kembali.',
    directoryTitle: 'Kemana Anda akan pergi selanjutnya?',
    directoryHint:
      'Pilih satu tujuan, atau buat rencana perjalanan untuk menemukan satu paket untuk setiap pemberhentian.',
    buildItinerary: 'Buat rencana perjalanan saya',
    connected: 'Tetap terhubung di {country}.',
    travelData: 'DATA PERJALANAN',
    intro:
      'Bandingkan kuota data dan masa berlaku untuk perjalanan Anda ke {country}. Buka sebuah paket untuk membaca cakupan yang dilaporkan oleh penyedia dan aturan aktivasi, atau tambahkan lebih banyak negara untuk membandingkan rencana perjalanan multi-perhentian.',
    networkMissing: 'Tidak disediakan untuk paket ini; tidak ada operator bernama yang dijanjikan.',
  },
  pageUi: {
    errorTitle: 'Kami mengalami masalah koneksi.',
    errorText: 'Silakan coba membuka halaman ini lagi.',
    notFoundEyebrow: 'SEDIKIT MEMBENGKOK',
    notFoundTitle: 'Pemberhentian ini tidak ada di peta.',
    notFoundText:
      'Kami tidak dapat menemukan halaman ini. Mari kita bawa Anda kembali ke perjalanan Anda.',
    backHome: 'Kembali ke Alozuri',
  },
  supplierCopy: {
    reduced: '{size} kecepatan tinggi per hari, kemudian kecepatan berkurang ({speed}).',
    reducedPolicy:
      '{size} kecepatan tinggi per hari, kemudian kecepatan berkurang sesuai dengan kebijakan penggunaan wajar penyedia.',
    cutoff: '{size} per hari. Layanan berhenti saat mencapai batas harian. {policy}',
    unlimited:
      'Pemasok menggambarkan paket ini sebagai tanpa batas. Periksa nama paket dan ketentuan pemasok untuk pembatasan kecepatan.',
    statusUnavailable: 'Status SM-DP+: Online. Permintaan status SM-DP+ tidak didukung.',
    usageUnavailable: 'Periksa Penggunaan: Permintaan penggunaan online tidak didukung.',
    usageContact:
      'Periksa Penggunaan: Permintaan penggunaan online tidak didukung. Harap hubungi dukungan pelanggan online untuk informasi penggunaan.',
    validity15:
      'Masa Berlaku: Berlaku selama 15 hari sejak penggunaan pertama. Periode berlaku dimulai ketika Anda tiba di tujuan dan mulai menggunakan data seluler. “Waktu Aktivasi” sistem tidak menunjukkan waktu penggunaan pertama yang sebenarnya.',
    refundInUse:
      'Kebijakan pengembalian dana pemasok: Setelah pembelian, status eSIM berubah menjadi IN USE. Pemasok tidak memberikan pengembalian dana, termasuk untuk eSIM yang belum digunakan.',
    salesMinimum:
      'Kebijakan Penjualan Supplier: Reseller harus memastikan bahwa harga eceran kepada pelanggan akhir tidak kurang dari USD {amount}, sesuai dengan kebijakan harga eceran minimum dari supplier operator ini, jika tidak, penjualan paket dapat dihentikan.',
    refundPurchase:
      'Kebijakan Pengembalian Pemasok: Setelah dibeli, pengembalian dana dari pemasok tidak didukung.',
    usageConsole:
      'Periksa Penggunaan: API pemeriksaan penggunaan belum didukung. Klik tombol refresh di konsol pemasok untuk memeriksa sisa data waktu nyata sebagai referensi.',
  },
  dashboardUi: {
    ordersError: 'Kami tidak dapat memuat pesanan Anda. Silakan coba lagi.',
    actionError: 'Itu gagal dilakukan. Harap tunggu sebentar dan coba lagi.',
    opening: 'Membuka akun Anda…',
    greeting: 'Halo, {name}.',
    traveller: 'pelancong',
    title: 'Setiap petualangan, di satu tempat.',
    hint: 'Paket Anda, status pembayaran, dan detail pemasangan eSIM.',
    signedOut: 'Anda telah keluar.',
    profileSyncError: 'Profil Anda tidak dapat disinkronkan. Silakan coba lagi.',
    retryProfile: 'Coba sinkronisasi profil lagi',
    syncing: 'Menyinkronkan profil Anda…',
    preview:
      'Masuk untuk mengelola akun Anda. Tidak ada pembelian sampel yang ditambahkan ke akun Anda.',
    signinHint: 'Masuk untuk melihat eSIM yang telah Anda beli.',
    verifyBefore: 'Verifikasi email Anda sebelum mengakses akun.',
    verifyInstruction: 'Buka tautan di email verifikasi Anda, kemudian periksa lagi.',
    verified: 'Terverifikasi',
    earlierEsims: 'eSIM yang siap sebelumnya',
    earlierOrders: 'Pesanan sebelumnya',
    accountStatus: 'Status akun',
    checkEmail: 'Periksa email',
    guest: 'Tamu',
    noEarlier: 'Tidak ada pesanan sebelumnya',
    ordersUnavailable: 'Pesanan sementara ini tidak tersedia.',
    currentHint:
      'Lihat pembelian dan detail pemasangan Anda saat ini di tab Pesanan dan eSIM Saya.',
    nextTrip: 'Rencanakan perjalanan saya berikutnya',
    details: 'Detail akun',
    nameSaved: 'Nama Anda telah diperbarui.',
    saveName: 'Simpan nama',
    manageHint: 'Masuk untuk mengelola profil Anda.',
    takeoff: 'Siap untuk lepas landas?',
    installHint:
      'Periksa ponsel Anda, pasang melalui Wi-Fi, dan baca aturan aktivasi paket Anda sebelum bepergian.',
    installHelp: 'Bantuan instalasi',
    usageDelay: 'Informasi penggunaan dapat tertunda sekitar 2–3 jam.',
  },
  legacyOrder: {
    choose: 'Pilih sebuah pesanan',
    chooseHint: 'Buka pesanan dari akun Anda untuk melihat statusnya.',
    stripePending: 'Kami belum dapat memeriksa Stripe. Pembayaran Anda mungkin masih dalam proses.',
    delayed:
      'Pesanan Anda memakan waktu lebih lama dari biasanya. Segarkan statusnya atau hubungi dukungan sebelum memulai pembayaran lain.',
    refunded:
      'Pembayaran Anda telah dikembalikan. Berikan waktu bagi bank Anda untuk menampilkan kredit.',
    expired: 'Proses pembayaran ini berakhir tanpa konfirmasi pembayaran.',
    paymentPending:
      'Pembayaran Anda akan diverifikasi dan eSIM Anda akan muncul di sini setelah penyediaan. Anda dapat kembali ke halaman ini kapan saja.',
    testComplete: 'Pembayaran percobaan selesai',
  },
  orderUi: {
    paymentStatus: 'Pembayaran: {status}',
    unitStatus: 'Status: {status}',
    total: 'Total: {amount}',
    pdfFontError: 'Font PDF tidak dapat dimuat. Silakan coba lagi.',
    eyebrow: 'PESANAN ALOZURI ANDA',
    testOrder: 'Pesanan percobaan Anda',
    readyTitle: 'eSIM Anda sudah siap.',
    onWayTitle: 'eSIM Anda sedang dalam perjalanan.',
    checkingTitle: 'Memeriksa pembayaran Anda',
    loadError:
      'Kami tidak dapat memuat pesanan ini. Gunakan tautan email pribadi atau masuk dengan alamat email pengiriman.',
    checkAgain: 'Periksa lagi',
    signinPurchases: 'Masuk ke pembelian Anda',
    privateLinkHint:
      'Buka tautan pesanan pribadi Anda dari email, atau masuk untuk melihat pembelian Anda.',
    confirming: 'Mengonfirmasi pesanan Anda…',
    documents: 'Dokumen pesanan',
    termsVersion: 'Versi syarat {version} · Diterima {date}',
    preparingPdf: 'Menyiapkan PDF…',
    downloadPdf: 'Unduh PDF kontrak Anda',
    pdfPending: 'PDF akan tersedia setelah pembayaran dikonfirmasi.',
    pdfError: 'Kontrak Anda tidak dapat diunduh. Silakan coba lagi.',
    testNotice: 'Stripe pesanan percobaan. Tidak ada biaya nyata atau eSIM yang diterbitkan.',
    supportNotice:
      'Pembayaran Anda telah dicatat. Pesanan Anda memerlukan dukungan sebelum kami dapat menyiapkan eSIM Anda. Hubungi {support} dengan referensi pesanan Anda.',
    preparingNotice:
      'Menyiapkan eSIM Anda. Halaman pribadi ini diperbarui ketika rincian instalasi siap. Email konfirmasi pesanan Anda menyertakan tautan kembali ke sini dan kontrak pembelian Anda.',
    deliveryIssue:
      'Pengiriman memerlukan perhatian. Hubungi dukungan dengan referensi pesanan Anda.',
    refundNotice: 'Pengembalian dana Anda sedang diproses.',
    refresh: 'Segarkan status pesanan',
    guidance: 'Panduan instalasi',
    title: 'Pesanan Anda',
    quantityAmount: 'Kuantitas {quantity} · {amount}',
    purchasesError: 'Pembelian Anda tidak dapat dimuat. Coba lagi nanti.',
    accountEyebrow: 'ALOZURI ANDA',
    usageHint: 'Periksa penggunaan data untuk setiap eSIM yang telah Anda kirim.',
    historyHint: 'Rincian pembelian dan instalasi Anda, semuanya dalam satu tempat.',
    loginHint:
      'Masuk dengan email pengiriman yang telah diverifikasi untuk menemukan pembelian Anda. Pelanggan tamu juga dapat menggunakan tautan pribadi dalam email pengiriman mereka.',
    retryPurchases: 'Coba lagi memuat pembelian',
    loadingPurchases: 'Memuat pembelian…',
    empty: 'Belum ada pembelian',
    viewOrder: 'Lihat pesanan dan instalasi',
    testNoUsage: 'Pesanan percobaan. Tidak ada penggunaan eSIM yang tersedia.',
    unitWaiting: 'Status eSIM: {status}. Penggunaan akan tersedia setelah pengiriman.',
    earlierAccount: 'Pesanan sebelumnya dan pengaturan akun',
    cancelledUsage: 'Penggunaan tidak tersedia untuk eSIM yang dibatalkan atau dikembalikan.',
    supportUsage: 'eSIM ini memerlukan dukungan sebelum penggunaan dapat ditampilkan.',
    preparingUsage:
      'eSIM Anda sedang dipersiapkan. Penggunaan menjadi tersedia setelah pengiriman.',
    emptyUsage: 'Belum ada eSIM yang tersedia untuk digunakan',
    paidAllocating:
      'Pesanan berbayar Anda sedang diproses. eSIM Anda akan muncul di sini setelah dialokasikan.',
    liveUsageOnly:
      'Penggunaan tersedia untuk eSIM yang telah dikirim. Pesanan percobaan tidak berisi eSIM yang aktif.',
    viewOrders: 'Lihat pesanan',
  },
  usageUi: {
    error: 'Penggunaan tidak dapat diperiksa. Silakan coba lagi.',
    checking: 'Memeriksa penggunaan data…',
    used: 'Data yang digunakan',
    remaining: 'Sisa kuota',
    total: 'Total kuota',
    installation: 'Instalasi',
    tran: 'eSIM No. Transaksi',
    supplierStatus: 'Status pemasok',
    expiry: 'Masa berlaku',
    notYet: 'Belum dilaporkan',
    nonFixed:
      'Paket ini menampilkan penggunaan yang dilaporkan oleh pemasok. Sisa kuota kecepatan tinggi tidak dilaporkan di sini.',
    lastChecked: 'Terakhir diperiksa: {date}',
    stale: 'Menampilkan pembacaan yang lebih lama. Periksa lagi sebentar lagi.',
    pending:
      'Penggunaan belum dilaporkan, atau pemeriksaan sedang berlangsung. Coba lagi sebentar lagi.',
    unavailable: 'Penggunaan sementara tidak tersedia. Silakan coba lagi nanti.',
    delay:
      'Pembacaan pemasok dapat tertunda hingga 2–3 jam. Paket harian dan tanpa batas mengikuti kuota dan aturan penggunaan wajar masing-masing.',
    refresh: 'Segarkan penggunaan',
  },
  status: {
    preparing: 'Sedang disiapkan',
    ready: 'Siap',
    active: 'Aktif',
    depleted: 'Kuota habis',
    expired: 'Kedaluwarsa',
    cancelled: 'Dibatalkan',
    suspended: 'Ditangguhkan',
    revoked: 'Dicabut',
    notReported: 'Belum dilaporkan',
    readyInstall: 'Siap dipasang',
    downloaded: 'Diunduh; pemasangan belum dikonfirmasi',
    installed: 'Terpasang',
    enabled: 'Terpasang · diaktifkan',
    disabled: 'Terpasang · dinonaktifkan',
    deleted: 'Dihapus',
    awaitingPayment: 'Menunggu pembayaran',
    processing: 'Pembayaran diproses',
    paid: 'Lunas',
    fulfilling: 'Menyiapkan eSIM',
    deliveryIssue: 'Pengiriman perlu diperiksa',
    refundPending: 'Pengembalian dana diproses',
    refunded: 'Dana dikembalikan',
    attention: 'Perlu perhatian',
    failed: 'Pembayaran gagal',
  },
  planInfo: {
    unavailable: 'Paket tidak tersedia',
    search: 'Cari paket',
    eyebrow: 'SATU PAKET. SETIAP PEMBERHENTIAN.',
    includes: 'Termasuk tepat {count, plural, one {# tujuan} other {# tujuan-tujuan}}:',
    know: 'Ketahui sebelum pergi',
    activation: 'Aktivasi',
    networks: 'Jaringan',
    networkMissing: 'Informasi jaringan belum disediakan untuk paket ini.',
    dataPolicy: 'Kebijakan data',
    calls: 'Panggilan dan pesan',
    callsText: 'Hanya data. Gunakan SIM rumah Anda untuk nomor yang sudah ada.',
    device: 'Periksa kompatibilitas perangkat',
    conditions: 'Ketentuan paket',
    rights: 'Hak statuter Anda berlaku. Baca {refunds} kami.',
    summary: 'RINGKASAN PAKET',
    sample: 'CONTOH PAKET',
    sampleNotice: 'Contoh ilustratif. Paket ini tidak dapat dibeli.',
    adding: 'Menambahkan…',
    basket: 'Menyiapkan keranjang…',
    retry: 'Coba harga lagi',
    added: 'Ditambahkan ke keranjang Anda.',
    viewCart: 'Lihat keranjang',
    limit: 'Batas keranjang tercapai: lima per paket dan sepuluh eSIM per pesanan.',
    deviceNotice:
      'Perangkat Anda harus mendukung eSIM dan tidak terkunci operator. Pasang melalui Wi-Fi dan ikuti aturan aktivasi.',
    refunds: 'Informasi pengembalian dana',
    priceError: 'Kami tidak bisa memuat harga saat ini. Silakan coba lagi.',
    addError: 'Tidak bisa menambahkan paket ini. Silakan coba lagi.',
    localCoverage: 'Cakupan lokal',
    multiCoverage: 'Cakupan multi-negara',
  },
  authUi: {
    verifyEyebrow: 'VERIFIKASI EMAIL ANDA',
    verifyTitle: 'Periksa kotak masuk Anda',
    verifyIntro:
      'Buka email verifikasi yang dikirim ke {email}. Verifikasi email Anda sebelum mengakses akun Anda.',
    verifyDelay:
      'Jika Anda baru saja mendaftar, email Anda mungkin membutuhkan waktu beberapa saat untuk tiba. Periksa juga folder spam.',
    verifiedButton: 'Saya sudah memverifikasi email saya',
    resend: 'Kirim ulang email',
    another: 'Gunakan akun lain',
    verifyNotYet: 'Email Anda belum diverifikasi. Buka tautan verifikasi, lalu periksa lagi.',
    verifyCheckError: 'Tidak bisa memeriksa verifikasi. Silakan coba lagi.',
    verifySent: 'Email verifikasi telah dikirim. Periksa kotak masuk dan folder spam Anda.',
    verifySendError: 'Tidak bisa mengirim email. Silakan tunggu sebentar dan coba lagi.',
    openingVerification: 'Membuka verifikasi…',
    registerTitle: 'Petualangan berikutnya dimulai di sini.',
    resetTitle: 'Awal yang baru.',
    loginTitle: 'Selamat datang kembali, pengembara.',
    artEyebrow: 'DUNIA ANDA. TERHUBUNG.',
    artTitleA: 'Kurangi pencarian untuk Wi-Fi.',
    artTitleB: 'Lebih banyak hadir di sana.',
    artFooter: 'Satu akun. Setiap petualangan.',
    joinEyebrow: 'GABUNGLAH DALAM PERJALANAN',
    resetEyebrow: 'SETEL ULANG PASSWORD ANDA',
    loginEyebrow: 'SENANG MELIHAT ANDA',
    registerHint: 'Simpan semua eSIM, paket, dan petualangan Anda di satu tempat.',
    resetHint: 'Masukkan email Anda dan kami akan mengirimkan tautan untuk reset.',
    loginHint: 'Masuk untuk menemukan eSIM Anda dan melanjutkan dari tempat Anda berhenti.',
    ageNotice:
      'Akun dan pembelian ditujukan untuk orang dewasa berusia 18 ke atas. Baca {terms} dan {privacy} kami. Masuk tidak mendaftar Anda untuk pemasaran atau pelacakan dukungan opsional.',
    unconfigured:
      'Akses akun sementara tidak tersedia. Sementara itu, Anda dapat menjelajahi toko.',
    wait: 'Harap tunggu…',
    google: 'Lanjutkan dengan Google',
    orEmail: 'atau lanjutkan dengan email',
    first: 'Nama depan',
    last: 'Nama belakang',
    email: 'Alamat email',
    password: 'Kata sandi',
    passwordHint: 'Minimal 8 karakter',
    passwordPlaceholder: 'Kata sandi Anda',
    hide: 'Sembunyikan kata sandi',
    show: 'Tampilkan kata sandi',
    forgot: 'Lupa kata sandi?',
    registerAgreement: 'Saya setuju dengan {terms} dan {privacy}.',
    create: 'Buat akun saya',
    sendReset: 'Kirim tautan reset',
    continueAccount: 'Lanjut ke akun Anda',
    newHere: 'Baru di sini?',
    alreadyMember: 'Sudah menjadi bagian dari perjalanan?',
    backLogin: 'Kembali ke masuk',
    secure: 'Petualangan Anda berikutnya, terhubung dengan aman.',
    resetSuccess: 'Jika akun untuk email tersebut ada, Anda akan menerima tautan reset kata sandi.',
    guestTitle: 'Atau cek out sebagai tamu',
    guestHint: 'Tidak perlu akun.',
    verifyNotice:
      'Anda dapat membayar sekarang. {verify} untuk mengakses pesanan Anda di My eSIMs.',
    guestUnconfigured: 'Masuk akun tidak tersedia di sini. Anda bisa lanjut sebagai tamu.',
    checkoutRegisterAgreement:
      'Dengan membuat akun, Anda setuju dengan {terms} dan {privacy} kami. Akun ditujukan untuk orang dewasa berusia 18 ke atas.',
    createCheckout: 'Buat akun dan tetap di pembayaran',
    loginCheckout: 'Masuk dan tetap di pembayaran',
    guestAlternative: 'Anda juga bisa melanjutkan sebagai tamu.',
    passwordRequired: 'Masukkan kata sandi Anda.',
    passwordLength: 'Pilih kata sandi minimal 8 karakter.',
    checkingAccess: 'Memeriksa akses akun…',
    invalidCredential: 'Email atau kata sandi salah.',
    invalidEmail: 'Masukkan alamat email yang valid.',
    strongerPassword: 'Pilih kata sandi yang lebih kuat dan coba lagi.',
    emailInUse: 'Email ini sudah memiliki akun. Masuk atau atur ulang kata sandi Anda.',
    weakPassword: 'Silakan pilih kata sandi minimal 8 karakter.',
    popupBlocked: 'Peramban Anda memblokir masuk Google. Izinkan pop-up dan coba lagi.',
    popupClosed: 'Masuk Google ditutup. Coba lagi saat Anda siap.',
    tooMany: 'Terlalu banyak percobaan. Silakan tunggu sebentar dan coba lagi.',
    unauthorizedDomain: 'Masuk belum tersedia di domain ini.',
    methodDisabled: 'Metode masuk ini belum diaktifkan.',
    authError: 'Tidak dapat masuk. Silakan coba lagi.',
  },
  paymentUi: {
    declined: 'Kartu Anda ditolak. Coba metode pembayaran lain.',
    policy:
      'Dengan melanjutkan, Anda menyetujui {terms} serta mengakui telah membaca {refunds} dan {privacy} kami.',
    orCard: 'atau bayar dengan kartu',
    formError: 'Formulir pembayaran tidak dapat dimuat. Segarkan halaman dan coba lagi.',
    processing: 'Memproses pembayaran…',
    unavailable: 'Formulir pembayaran tidak tersedia',
    loadingPayment: 'Memuat pembayaran aman…',
    loadingCheckout: 'Memuat halaman pembayaran…',
    availabilityError: 'Kami tidak dapat memuat ketersediaan pembayaran. Silakan coba lagi.',
    planUnavailable: 'Paket ini tidak tersedia. Kembali ke keranjang Anda.',
    totalTimeout:
      'Konfirmasi total Anda memakan waktu terlalu lama. Keranjang Anda disimpan. Silakan coba lagi.',
    priceError: 'Tidak dapat memeriksa harga.',
    startError: 'Proses pembayaran tidak dapat dimulai.',
    stripeError: 'Stripe tidak dapat dimuat. Periksa koneksi Anda dan coba lagi.',
    loadingPlan: 'Memuat paket Anda…',
    preparing: 'Menyiapkan pembayaran yang aman…',
    signingIn: 'Menyelesaikan masuk…',
    checkingAvailability: 'Memeriksa ketersediaan pembayaran…',
    confirmingTotal: 'Mengonfirmasi total Anda…',
    openingHint:
      'Membuka opsi pembayaran Anda. Anda akan meninjau pembayaran sebelum dikenakan biaya.',
    signInHint: 'Selesaikan masuk untuk melanjutkan. Pesanan Anda telah disimpan.',
    confirmingHint:
      'Anda dapat memasukkan detail Anda sementara kami mengonfirmasi pesanan Anda. Anda akan meninjau pembayaran sebelum dikenakan biaya.',
    syncHint: 'Selesaikan masalah sinkronisasi keranjang Anda sebelum melanjutkan ke pembayaran.',
    totalHint: 'Kami tidak dapat mengonfirmasi total Anda. Silakan coba lagi di bawah.',
    paymentsHint: 'Pembayaran saat ini tidak tersedia. Keranjang Anda telah disimpan.',
    compatibilityHint: 'Konfirmasi bahwa perangkat Anda mendukung eSIM di atas untuk melanjutkan.',
    editCart: 'Sunting keranjang',
    deliveryEmail: 'Email pengiriman: {email}',
    testNotice: 'Uji pembayaran. Uang sungguhan atau eSIM tidak akan diterbitkan.',
    walletTimeout:
      'Dompet digital tidak merespons. Silakan bayar dengan kartu di bawah. Pesanan Anda tidak berubah dan percobaan dompet digital ini belum mengirimkan pembayaran.',
    syncingCart: 'Menyinkronkan keranjang yang tersimpan…',
    resolveCart: 'Kembali ke keranjang Anda untuk menyelesaikan ini sebelum membayar.',
    promotionQuestion: 'Punya kode promosi?',
    promotionApplied: '{code}: {percent}% off · Diskon {discount} · Total asli {original}',
    compatible: 'Perangkat saya mendukung eSIM dan tidak terkunci ke operator tertentu.',
    checkCompatibility: 'Periksa kompatibilitas',
    notConfigured:
      'Pembayaran saat ini belum dikonfigurasi untuk toko ini. Keranjang Anda tersimpan.',
    retry: 'Coba lagi pembayaran',
    walletFailed: 'Dompet tidak merespons. Silakan bayar dengan kartu sebagai gantinya.',
    detailsError: 'Periksa detail pembayaran Anda.',
    furtherAction: 'Pembayaran memerlukan tindakan lebih lanjut. Silakan coba lagi.',
  },
  cart: {
    discount: 'Diskon',
    activationLegacyNetwork:
      'Dimulai saat pertama kali terhubung ke jaringan yang didukung. Periksa paket yang dibeli sebelum instalasi.',
    title: 'Keranjang Anda',
    eyebrow: 'SIAP UNTUK PERJALANAN ANDA SELANJUTNYA',
    orderTitle: 'PESANAN ANDA',
    intro: '{count} × eSIM · Harga dalam {currency}',
    summaryLine: '{allowance} · {validity} · Jumlah {quantity}',
    activation: 'Aktivasi: {rule}',
    coverage: 'Cakupan: {countries}',
    networks: 'Jaringan: {networks}',
    details: 'Rincian paket',
    subtotal: 'Jumlah sementara',
    total: 'Total · {currency}',
    priceNote:
      'Harga diverifikasi sebelum pembayaran. Tidak ada biaya tambahan saat menyelesaikan pesanan.',
    confirming: 'Mengonfirmasi harga terbaru…',
    security: 'Detail pembayaran ditangani dengan aman oleh Stripe.',
    savedError: 'Keranjang yang disimpan tidak dapat dimuat. Silakan coba lagi.',
    validationError: 'Tidak dapat memvalidasi keranjang. Silakan coba lagi.',
    loading: 'Memuat keranjang Anda…',
    emptyTitle: 'Keranjang Anda kosong',
    emptyText: 'Jelajahi paket eSIM untuk tujuan Anda berikutnya.',
    useSaved: 'Gunakan keranjang akun yang disimpan',
    explore: 'Jelajahi destinasi',
    unitPrice: '{amount} per eSIM',
    unavailablePrice: 'Tidak tersedia · harga terakhir terlihat:',
    quantity: 'Jumlah untuk {plan}',
    decrease: 'Kurangi jumlah untuk {plan}',
    increase: 'Tambahkan jumlah untuk {plan}',
    remove: 'Hapus',
    removeLabel: 'Hapus {plan}',
    continueShopping: 'Lanjutkan berbelanja',
    retryPrices: 'Coba ulang harga',
    saving: 'Menyimpan keranjang Anda…',
    secureCheckout: 'Pembayaran aman',
    syncPending:
      'Keranjang belanja Anda akan siap saat keranjang yang disimpan selesai disinkronkan.',
    syncFailed: 'Selesaikan pesan sinkronisasi keranjang di atas sebelum melanjutkan.',
    removeUnavailable: 'Hapus paket yang tidak tersedia untuk melanjutkan ke pembayaran.',
    syncError:
      'Keranjang belanja Anda tidak dapat disinkronkan. Coba lagi atau gunakan keranjang akun yang telah disimpan.',
    activationNetwork: 'Dimulai saat terhubung pertama kali ke jaringan seluler yang didukung.',
    activationPurchase:
      'Masa berlaku dimulai setelah pembelian. Beli hanya saat Anda siap untuk menggunakannya.',
    activationInstall:
      'Masa berlaku dimulai saat eSIM dipasang. Pasang saat Anda siap untuk menggunakannya.',
    fairFixed: 'Batas data total tetap. Hanya data; tanpa nomor telepon lokal.',
  },
  privacyUi: {
    chatFrame: 'Obrolan pelanggan Alozuri',
    choices: 'Pilihan privasi Anda',
    banner:
      'Penyimpanan penting menjaga masuk, keranjang, dan pembayaran tetap berfungsi. Obrolan Tawk.to opsional dan penyedia layanannya, termasuk Cloudflare, tetap mati sampai Anda mengizinkan dan membuka obrolan. Pengukuran iklan opsional Meta tetap mati sampai Anda mengizinkan iklan.',
    acceptAll: 'Terima semua',
    reject: 'Tolak opsional',
    customize: 'Sesuaikan pilihan',
    storageRefused:
      'Peramban Anda tidak menyimpan pilihan ini. Teknologi opsional tetap mati; dukungan email tersedia.',
    storageFailed: 'Preferensi tidak dapat disimpan. Teknologi opsional tetap mati.',
    settingsHint:
      'Belanja dan dukungan email berfungsi tanpa persetujuan opsional. Ubah pilihan Anda kapan saja.',
    necessaryTitle: 'Diperlukan — selalu aktif.',
    necessary:
      'Sesi akun, keranjang belanja, pembayaran aman, bahasa dan mata uang yang diminta, dan pilihan privasi ini.',
    optionalSupportTitle: 'Dukungan opsional — Tawk.to.',
    optionalSupport:
      'Izinkan obrolan langsung saat Anda memilih untuk membukanya, termasuk analitik layanan penyedia dan teknologi keamanan. Kami tidak secara otomatis membagikan detail akun atau pesanan Anda dengan obrolan.',
    advertisingTitle: 'Iklan opsional — Meta.',
    advertising:
      'Ukur iklan dan pembelian menggunakan Meta Pixel dan pengukuran pembelian yang dikonfirmasi.',
    measurement:
      'Meta mengukur tampilan halaman, tampilan paket, dimulainya pembayaran, dan pembelian yang dikonfirmasi hanya dengan persetujuan iklan. Meta menerima pengidentifikasi browser, ID peristiwa, nilai pembelian, dan mata uang, bukan kredensial pemasangan.',
    inventory: 'Baca inventaris cookie',
    save: 'Simpan pilihan',
    closeSettings: 'Tutup pengaturan',
    chat: 'Obrolan',
    closeChat: 'Tutup obrolan',
    chatTitle: 'Obrolan dengan Alozuri',
    chatPrivacy:
      'Obrolan disediakan oleh Tawk.to dan mungkin menggunakan cookie dan penyimpanannya. Aktifkan dukungan opsional untuk memulai. Kami tidak membagikan rincian akun, pesanan, atau instalasi Anda secara otomatis.',
    enableChat: 'Aktifkan obrolan',
    preferEmail: 'Lebih suka email?',
    privacyLink: 'Pilihan privasi dan cookie',
    chatLoading: 'Obrolan tidak memuat?',
    emailUs: 'Kirim email kepada kami',
    contactTitle: 'Pilih cara menghubungi kami',
    emailWithoutConsent: 'Dukungan email berfungsi tanpa persetujuan opsional.',
    openChat: 'Buka obrolan',
    chatSafety:
      'Obrolan terbuka di sudut pada desktop dan layar penuh di ponsel. Jangan mengirim kata sandi, rincian kartu lengkap, kode QR atau kredensial aktivasi. Ketersediaan agen tidak dijamin.',
  },
  display: {
    unlimited: 'Tak terbatas',
    daily: '{size}/hari',
    reduced: 'Tidak terbatas · {size}/hari kecepatan tinggi',
    featureTitle: 'Jelajahi eSIM Regional & Global',
    featureDescription: 'Bandingkan kuota data dan cakupan untuk perjalanan Anda berikutnya.',
    featureRegionAllowance: 'Kuota data untuk {region}',
    featureView: 'Lihat paket: {region} {amount} GB',
    featureCoverage: 'Mencakup {count} negara',
    featureLoading: 'Memuat paket saat ini…',
    featureUnavailable: 'Paket saat ini tidak tersedia',
    featureRetry: 'Silakan cek kembali nanti.',
    featureError: 'Harga paket sementara tidak tersedia. Silakan coba lagi nanti.',
    europe: 'Eropa',
    asia: 'Asia',
    northAmerica: 'Amerika Utara',
    global: 'Global',
    seasonal: 'Inspirasi tujuan musiman',
    photo: 'Inspirasi perjalanan: {country}',
    installIntro:
      'Sambungkan ke Wi-Fi sebelum memasang. Ikuti aturan aktivasi paket Anda dan jaga agar informasi ini tetap pribadi.',
    installLoading: 'Memuat detail instalasi…',
    installShow: 'Tampilkan detail instalasi',
    installQr: 'Kode instalasi QR eSIM pribadi Anda',
    installInstructions:
      'Di ponsel Anda, buka Pengaturan → Seluler → Tambahkan eSIM. Pindai kode QR ini dari layar lain, atau masukkan detail di bawah secara manual.',
    smdp: 'Alamat SM-DP+',
    activationCode: 'Kode aktivasi',
    confirmationCode: 'Kode konfirmasi',
    installWarning:
      'Jangan hapus eSIM setelah pemasangan kecuali dukungan meminta Anda melakukannya. Beberapa profil hanya bisa dipasang sekali.',
    installError:
      'Detail instalasi gagal dimuat. Coba lagi atau hubungi dukungan dengan referensi pesanan Anda.',
  },
  search: {
    find: 'Temukan sebuah eSIM',
    multi: 'Multi-negara',
    multiTrip: 'Perjalanan multi-negara',
    matcher: 'PENCOCOK PERJALANAN',
    single: 'Satu tujuan',
    whereTrip: 'Ke mana Anda bepergian?',
    whereCountry: 'Ke mana tujuan Anda?',
    tripHint: 'Tambahkan setiap pemberhentian. Temukan satu eSIM yang mencakup semuanya.',
    countryHint: 'Temukan paket data untuk tujuan Anda berikutnya.',
    covered: 'Setiap pemberhentian. Tercakup.',
    addAnother: 'Tambahkan tujuan lain untuk membandingkan paket multi-negara.',
    chooseTwo: 'Pilih setidaknya dua tujuan untuk perjalanan multi-negara.',
    chooseOneNotice:
      'Pilih satu negara untuk pencarian tujuan tunggal. Itinerary multi-negara Anda akan disimpan.',
    destinations: 'TUJUAN ANDA',
    destination: 'TUJUAN ANDA',
    remove: 'Hapus {country}',
    add: 'Tambahkan tujuan',
    change: 'Ubah tujuan',
    addStop: 'Tambahkan pemberhentian',
    choose: 'Pilih tujuan',
    chooseCountry: 'Pilih negara',
    searchCountries: 'Cari negara',
    searchPlaceholder: 'Cari sebuah negara…',
    closeSearch: 'Tutup pencarian negara',
    loadingDestinations: 'Memuat tujuan…',
    noDestinations: 'Tidak ada tujuan yang cocok.',
    allData: 'Semua paket data',
    minimumData: '{amount} GB atau lebih',
    daily: 'Paket data harian',
    unlimited: 'Tak terbatas (periksa penggunaan wajar)',
    finding: 'Menemukan paket Anda…',
    coverageChecked: 'Cakupan diperiksa untuk setiap negara yang dipilih',
    demoNotice: 'Pratinjau · contoh paket · pembelian dinonaktifkan',
    searching: 'Mencari paket saat ini…',
    refresh: 'Segarkan hasil',
    matched: 'COCOK DENGAN ITINERARY ANDA',
    localResults:
      '{count, plural, one {# paket lokal untuk {countries}.} other {# paket lokal untuk {countries}.}}',
    tripResults:
      '{count, plural, one {# paket. Setiap berhenti tercakup.} other {# paket. Setiap berhenti tercakup.}}',
    noAllowance: 'Tidak ada paket yang cocok dengan kuota data ini',
    noLocal: 'Tidak ada paket lokal yang tersedia',
    noCoverage: 'Tidak ada paket yang mencakup semua negara yang dipilih',
    localExplanation: 'Paket ini hanya mencakup negara yang Anda pilih.',
    tripExplanation: 'Mencakup semua negara yang Anda pilih: {countries}.',
    mismatchExplanation:
      'Paket yang mencakup tujuan yang Anda pilih: {count}. Tidak ada yang sesuai dengan kuota data yang dipilih.',
    noLocalExplanation: 'Saat ini tidak ada paket lokal yang tersedia untuk negara ini.',
    noCoverageExplanation:
      'Saat ini tidak ada satu paket pun yang mencakup semua negara yang dipilih. Coba kombinasi tujuan lain.',
    sort: 'Urutkan paket',
    recommended: 'Ukuran data yang direkomendasikan',
    value: 'Nilai per GB (data tetap)',
    price: 'Harga total terendah',
    mostData: 'Data terbanyak',
    showAll: 'Tampilkan semua paket data',
    showing: 'Menampilkan {shown} dari {total} paket yang sesuai',
    loadingMore: 'Memuat lebih banyak…',
    showMore: 'Tampilkan lebih banyak paket ({shown} dari {total})',
    destinationsError: 'Tujuan tidak dapat dimuat. Segarkan halaman dan coba lagi.',
    chooseTwoError: 'Tambahkan setidaknya dua tujuan untuk pencarian multi-negara.',
    chooseOneError: 'Pilih satu negara sebelum mencari dalam mode tujuan tunggal.',
    chooseFirstError: 'Tambahkan setidaknya satu tujuan untuk menemukan eSIM Anda.',
    searchError: 'Tidak dapat menemukan paket. Silakan coba lagi.',
    sampleCurrencyError: 'Paket contoh hanya tersedia dalam USD.',
    bestValue: 'NILAI TERBAIK / GB',
    destinationsCount: '{count} tujuan',
    dataOnly: 'Hanya data',
    samplePrice: 'harga contoh',
    coverage: '{count, plural, one {Cakupan: # tujuan} other {Cakupan: # tujuan}}',
  },
  home: {
    heroTitleA: 'Satu eSIM.',
    heroTitleB: 'Setiap tujuan.',
    instant: 'Pengiriman instan',
    noRoaming: 'Tanpa biaya roaming tak terduga',
    tripConnected: 'PERJALANAN ANDA, TERHUBUNG',
    oneEsim: 'SATU eSIM',
    coversAll: 'Mencakup semua negara pilihan Anda',
    onePlan: 'Satu paket lintas negara',
    noSim: 'Tidak perlu menukar SIM fisik',
    secure: 'Pembayaran aman melalui Stripe',
    compare: 'Bandingkan paket data perjalanan',
    dataNoDetours: 'Data, tanpa belokan',
    keepNumber: 'Pertahankan nomor Anda',
    destinationsEyebrow: 'TEMUKAN KONEKSI ANDA BERIKUTNYA',
    destinationsTitle: 'Ke mana selanjutnya?',
    destinationsDescription:
      'Dari liburan akhir pekan hingga perjalanan yang telah Anda rencanakan bertahun-tahun.',
    europeTitle: 'Prancis, Swiss, dan Italia? Ya, ketiganya.',
    europeDescription:
      'Kami memeriksa cakupan di setiap negara dalam rute Anda agar Anda tidak perlu melakukannya sendiri.',
    matchItinerary: 'Cocokkan rencana perjalanan saya',
    stepsEyebrow: 'TIGA LANGKAH. SATU KEKHAWATIRAN BERKURANG.',
    stepsTitle: 'Siap terhubung dalam beberapa langkah.',
    checkDevice: 'Periksa perangkat Anda',
    stepChooseTitle: 'Pilih destinasi Anda',
    stepChooseText:
      'Tambahkan setiap negara dalam rencana perjalanan Anda. Bandingkan paket yang mencakup semua pemberhentian yang Anda pilih.',
    stepInstallTitle: 'Pasang eSIM Anda',
    stepInstallText:
      'Temukan eSIM Anda di akun Anda setelah siap. Pindai kode QR dengan koneksi Wi-Fi yang stabil.',
    stepConnectTitle: 'Mendarat. Terhubung. Pergi.',
    stepConnectText:
      'Atur eSIM Anda untuk data seluler dan aktifkan roaming datanya. Ikuti aturan aktivasi untuk paket Anda.',
    faqEyebrow: 'SEBELUM ANDA BERANGKAT',
    faqTitle: 'Beberapa pertanyaan bagus.',
    faqIntro:
      'Sudah banyak hal yang perlu disiapkan untuk perjalanan. Koneksi internet seharusnya mudah.',
    faqLink: 'Kunjungi pusat bantuan',
    faqCoverageQuestion: 'Apakah satu eSIM dapat digunakan di semua negara saya?',
    faqCoverageAnswer:
      'Ya, jika paket mencakup semua negara yang dipilih. Pencarian hanya menampilkan paket yang mencakup seluruh rute Anda. Swiss dan Inggris Raya diperiksa secara terpisah; nama “Eropa” tidak otomatis berarti semua negara Eropa tercakup.',
    faqPhoneQuestion: 'Apakah ponsel saya kompatibel?',
    faqPhoneAnswer:
      'Ponsel harus mendukung eSIM dan tidak terkunci ke operator tertentu. Periksa opsi “Tambahkan eSIM” di pengaturan jaringan seluler. Sebelum membeli, pastikan kepada produsen bahwa model dan versi untuk wilayah pembelian ponsel Anda mendukung eSIM.',
    faqNumberQuestion: 'Bisakah saya mempertahankan WhatsApp dan nomor telepon saya?',
    faqNumberAnswer:
      'Ya. Pertahankan SIM Anda yang ada untuk panggilan dan nomor WhatsApp biasa Anda. Pilih Alozuri untuk data seluler, dan nonaktifkan roaming data pada SIM rumah Anda untuk menghindari biaya operator.',
    faqStartQuestion: 'Kapan paket saya mulai?',
    faqStartAnswer:
      'Itu tergantung pada paket. Beberapa paket mulai saat instalasi; yang lain mulai dengan koneksi jaringan yang didukung pertama. Rincian paket dan halaman instalasi menjelaskan aturan aktivasi.',
    finalEyebrow: 'PERJALANAN ANDA SELANJUTNYA, DIPERMUDAH',
    finalTitle: 'Lebih sedikit roaming. Lebih banyak bepergian.',
    finalText: 'Koneksi berikutnya dimulai dengan tujuan Anda.',
    findEsim: 'Temukan eSIM saya',
  },
  site: {
    operations: 'Operasi',
    cookieSettings: 'Pengaturan cookie',
    skip: 'Lewati ke konten',
    languageUnsupported: 'Bahasa ini tidak didukung.',
    languageLoadError: 'Bahasa Anda tidak dapat dimuat. Silakan coba lagi.',
    languageSaveError:
      'Bahasa Anda diubah di perangkat ini, tetapi preferensi akun Anda tidak dapat disimpan.',
    home: 'Beranda Alozuri',
    mainNav: 'Navigasi utama',
    currency: 'Mata uang',
    cartCount: '{count, plural, one {Keranjang belanja, # item} other {Keranjang belanja, # item}}',
    openMenu: 'Buka menu',
    closeMenu: 'Tutup menu',
    myAccount: 'Akun saya',
    verifyEmail: 'Verifikasi email',
    accountNav: 'Navigasi akun',
    myEsims: 'eSIM saya',
    usage: 'Penggunaan data',
    orders: 'Pesanan',
    settings: 'Pengaturan akun',
    loggingOut: 'Sedang keluar…',
    logoutError: 'Tidak dapat keluar. Silakan coba lagi.',
    explore: 'Jelajahi',
    allDestinations: 'Semua tujuan',
    itinerary: 'Bangun rencana perjalanan Anda',
    europeEsims: 'eSIM perjalanan Eropa',
    guides: 'Panduan perjalanan eSIM',
    partners: 'Mitra',
    legal: 'Hukum',
    support: 'Bantuan & Dukungan',
    compatibility: 'eSIM kompatibilitas & instalasi',
    contact: 'Kontak & keluhan',
    createAccount: 'Buat akun',
    sloganA: 'Sedikit lebih sedikit berkeliaran.',
    sloganB: 'Lebih banyak menjelajah.',
    office: 'Kantor terdaftar',
    company:
      '{brand} adalah nama dagang {company}, perusahaan yang terdaftar di Inggris dan Wales dengan nomor perusahaan {number}.',
    copyright: '© {year} Alozuri. Dibuat untuk perjalanan.',
    acceptableUse: 'Penggunaan yang Dapat Diterima, Penggunaan Wajar & Cakupan',
  },
  common: {
    language: 'Bahasa',
    loading: 'Memuat…',
    retry: 'Coba lagi',
    save: 'Simpan',
    cancel: 'Batal',
    back: 'Kembali',
    unavailableLanguage: 'Bahasa ini belum tersedia.',
  },
  navigation: {
    destinations: 'Destinasi',
    howItWorks: 'Cara kerja',
    help: 'Pusat bantuan',
    login: 'Masuk',
    signup: 'Daftar',
    cart: 'Keranjang belanja',
    logout: 'Keluar',
  },
  plans: {
    view: 'Lihat paket',
    add: 'Tambahkan ke keranjang',
    buy: 'Beli sekarang',
    loadingPrice: 'Memuat harga…',
    unavailable: 'Harga tidak tersedia',
    allowance: 'Kuota data',
    validity: 'Masa berlaku',
    coverage: 'Cakupan',
    days: '{count, plural, other {# hari}}',
  },
  checkout: {
    legalUnavailable:
      'Pembayaran dan dokumen pesanan saat ini tersedia dalam bahasa Inggris. Beralihlah ke bahasa Inggris untuk melanjutkan; keranjang dan mata uang Anda tetap sama.',
    useEnglish: 'Lanjutkan dalam bahasa Inggris',
    title: 'Pembayaran',
    deliveryEmail: 'Email penerima pesanan',
    emailHint: 'Kami akan mengirimkan petunjuk pemasangan eSIM ke alamat ini.',
    continue: 'Lanjut ke pembayaran',
    securePayment: 'Pembayaran aman',
    apply: 'Terapkan kode',
    remove: 'Hapus kode',
    promotionalCode: 'Kode promo',
    pay: 'Bayar {amount}',
  },
  errors: {
    promoNotApplicable:
      'Kode ini tidak dapat digunakan untuk pesanan ini. Coba kode lain atau hapus kode untuk melanjutkan.',
    generic: 'Terjadi kesalahan. Silakan coba lagi.',
    catalogueChanged: 'Katalog berubah. Perbarui pencarian Anda.',
    searchPageInvalid: 'Halaman hasil ini sudah tidak berlaku. Mulai pencarian baru.',
    promoInvalid: 'Kode promo ini tidak valid.',
    promoExpired: 'Kode promo ini sudah kedaluwarsa.',
    authentication: 'Masuk untuk melanjutkan.',
    planUnavailable: 'Paket ini sudah tidak tersedia.',
    paymentFailed: 'Pembayaran tidak dapat diselesaikan. Silakan coba lagi.',
    paymentCancelled: 'Pembayaran dibatalkan.',
    rateLimited: 'Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi.',
  },
  account: {
    language: 'Bahasa pilihan',
    profile: 'Profil Anda',
    orders: 'Pesanan Anda',
  },
  installation: {
    unitDetails: 'Detail pemasangan untuk eSIM {number}',
    unitQr: 'Kode QR pemasangan pribadi untuk eSIM {number}',
    title: 'Pasang eSIM Anda',
    wifi: 'Hubungkan ke Wi-Fi sebelum memasang.',
    private: 'Jaga kerahasiaan detail pemasangan Anda.',
  },
  emails: {
    confirmationSubject: 'Konfirmasi pesanan eSIM Alozuri Anda',
    confirmed: 'Pesanan Anda dikonfirmasi!',
    ready: 'eSIM Anda siap dipasang.',
    reference: 'Referensi pesanan: {reference}',
  },
  legal: {
    terms: 'Syarat dan Ketentuan',
    privacy: 'Kebijakan Privasi',
    cookies: 'Kebijakan Cookie',
    refunds: 'Kebijakan Pengembalian dan Pembatalan',
  },
} satisfies Messages;
