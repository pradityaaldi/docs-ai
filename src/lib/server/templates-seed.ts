// Seed data for the template gallery (Google Docs style).
// Specs follow common Indonesian academic/administrative conventions:
// - A4, Times New Roman 12pt (DOCX font size in half-points = 24)
// - line spacing: 480 = double (1.0=240, 1.5=360, 2.0=480), skripsi pakai 2.0
// - margins in twips (1 cm ≈ 567 twips): skripsi 4-3-3-3 cm (kiri-atas-kanan-bawah)
// - daftar pustaka: APA style

export interface FormField {
	key: string;
	label: string;
	type: 'text' | 'textarea' | 'select';
	placeholder?: string;
	options?: string[];
	required?: boolean;
}

export interface TemplateSeed {
	name: string;
	slug: string;
	category: 'skripsi' | 'makalah' | 'surat';
	kampus?: string;
	org?: string;
	description: string;
	struktur: unknown;
	format: unknown;
	formFields: FormField[];
}

const BAHASA_FIELD: FormField = {
	key: 'bahasa',
	label: 'Bahasa',
	type: 'select',
	options: ['Indonesia', 'English'],
	required: true
};

const SKRIPSI_STRUKTUR = [
	{ section: 'Halaman Judul (Cover)' },
	{ section: 'Halaman Pengesahan' },
	{ section: 'Abstrak' },
	{ section: 'Kata Pengantar' },
	{ section: 'Daftar Isi' },
	{
		section: 'BAB I PENDAHULUAN',
		sub: ['Latar Belakang', 'Rumusan Masalah', 'Tujuan Penelitian', 'Manfaat Penelitian', 'Batasan Masalah']
	},
	{
		section: 'BAB II TINJAUAN PUSTAKA',
		sub: ['Landasan Teori', 'Penelitian Terdahulu', 'Kerangka Pemikiran']
	},
	{
		section: 'BAB III METODOLOGI PENELITIAN',
		sub: ['Jenis Penelitian', 'Objek Penelitian', 'Metode Pengumpulan Data', 'Metode Analisis Data']
	},
	{
		section: 'BAB IV HASIL DAN PEMBAHASAN',
		sub: ['Hasil Penelitian', 'Pembahasan']
	},
	{
		section: 'BAB V PENUTUP',
		sub: ['Kesimpulan', 'Saran']
	},
	{ section: 'Daftar Pustaka' }
];

const SKRIPSI_FORMAT = {
	pageSize: 'A4',
	orientation: 'portrait',
	font: 'Times New Roman',
	fontSize: 24, // 12pt
	lineSpacing: 480, // double
	marginTop: 1701, // 3 cm
	marginRight: 1701, // 3 cm
	marginBottom: 1701, // 3 cm
	marginLeft: 2268, // 4 cm
	headingStyle: 'numbered-bab',
	daftarPustakaStyle: 'APA',
	cover: { type: 'skripsi', includeLogo: true }
};

const SKRIPSI_FIELDS: FormField[] = [
	{ key: 'judul', label: 'Judul / Ide Skripsi', type: 'textarea', placeholder: 'mis. Analisis Pengaruh ... terhadap ...', required: true },
	{ key: 'nama', label: 'Nama Lengkap', type: 'text', required: true },
	{ key: 'nim', label: 'NIM', type: 'text', required: true },
	{ key: 'jurusan', label: 'Program Studi / Jurusan', type: 'text', required: true },
	{ key: 'fakultas', label: 'Fakultas', type: 'text' },
	{ key: 'dosen_pembimbing', label: 'Dosen Pembimbing', type: 'text' },
	{ key: 'tahun', label: 'Tahun', type: 'text', placeholder: '2026' },
	BAHASA_FIELD
];

export const TEMPLATE_SEEDS: TemplateSeed[] = [
	{
		name: 'Skripsi UGM',
		slug: 'skripsi-ugm',
		category: 'skripsi',
		kampus: 'Universitas Gadjah Mada',
		description: 'Format skripsi standar UGM — Times New Roman 12pt, spasi 2, margin 4-3-3-3 cm, daftar pustaka APA.',
		struktur: SKRIPSI_STRUKTUR,
		format: { ...SKRIPSI_FORMAT, cover: { type: 'skripsi', kampus: 'Universitas Gadjah Mada', includeLogo: true } },
		formFields: SKRIPSI_FIELDS
	},
	{
		name: 'Skripsi UNY',
		slug: 'skripsi-uny',
		category: 'skripsi',
		kampus: 'Universitas Negeri Yogyakarta',
		description: 'Format skripsi UNY — struktur BAB I–V, Times New Roman 12pt, spasi 2, daftar pustaka APA.',
		struktur: SKRIPSI_STRUKTUR,
		format: { ...SKRIPSI_FORMAT, cover: { type: 'skripsi', kampus: 'Universitas Negeri Yogyakarta', includeLogo: true } },
		formFields: SKRIPSI_FIELDS
	},
	{
		name: 'Skripsi Amikom',
		slug: 'skripsi-amikom',
		category: 'skripsi',
		kampus: 'Universitas Amikom Yogyakarta',
		description: 'Format skripsi Amikom Yogyakarta — fokus TI, struktur BAB I–V, Times New Roman 12pt, spasi 2.',
		struktur: SKRIPSI_STRUKTUR,
		format: { ...SKRIPSI_FORMAT, cover: { type: 'skripsi', kampus: 'Universitas Amikom Yogyakarta', includeLogo: true } },
		formFields: SKRIPSI_FIELDS
	},
	{
		name: 'Makalah / Tugas Kuliah',
		slug: 'makalah-tugas-kuliah',
		category: 'makalah',
		description: 'Makalah akademik umum — Cover, Kata Pengantar, Daftar Isi, BAB I–III, Daftar Pustaka.',
		struktur: [
			{ section: 'Halaman Judul (Cover)' },
			{ section: 'Kata Pengantar' },
			{ section: 'Daftar Isi' },
			{ section: 'BAB I PENDAHULUAN', sub: ['Latar Belakang', 'Rumusan Masalah', 'Tujuan'] },
			{ section: 'BAB II PEMBAHASAN', sub: ['Pembahasan Materi'] },
			{ section: 'BAB III PENUTUP', sub: ['Kesimpulan', 'Saran'] },
			{ section: 'Daftar Pustaka' }
		],
		format: {
			pageSize: 'A4',
			orientation: 'portrait',
			font: 'Times New Roman',
			fontSize: 24,
			lineSpacing: 360, // 1.5
			marginTop: 1701,
			marginRight: 1701,
			marginBottom: 1701,
			marginLeft: 2268,
			headingStyle: 'numbered-bab',
			daftarPustakaStyle: 'APA',
			cover: { type: 'makalah', includeLogo: true }
		},
		formFields: [
			{ key: 'judul', label: 'Judul / Topik Makalah', type: 'textarea', placeholder: 'mis. Dampak Media Sosial terhadap ...', required: true },
			{ key: 'nama', label: 'Nama Lengkap', type: 'text', required: true },
			{ key: 'nim', label: 'NIM / NPM', type: 'text' },
			{ key: 'mata_kuliah', label: 'Mata Kuliah', type: 'text', required: true },
			{ key: 'jurusan', label: 'Program Studi / Jurusan', type: 'text' },
			{ key: 'dosen', label: 'Dosen Pengampu', type: 'text' },
			BAHASA_FIELD
		]
	},
	{
		name: 'Surat Izin Sakit',
		slug: 'surat-izin-sakit',
		category: 'surat',
		description: 'Surat izin tidak masuk karena sakit — format surat resmi singkat.',
		struktur: [
			{ section: 'Tempat & Tanggal' },
			{ section: 'Tujuan Surat' },
			{ section: 'Pembuka' },
			{ section: 'Isi (keterangan sakit)' },
			{ section: 'Penutup' },
			{ section: 'Tanda Tangan' }
		],
		format: {
			pageSize: 'A4',
			orientation: 'portrait',
			font: 'Times New Roman',
			fontSize: 24,
			lineSpacing: 276, // 1.15
			marginTop: 1440,
			marginRight: 1440,
			marginBottom: 1440,
			marginLeft: 1440,
			headingStyle: 'none',
			cover: { type: 'none' }
		},
		formFields: [
			{ key: 'nama', label: 'Nama', type: 'text', required: true },
			{ key: 'kelas_jurusan', label: 'Kelas / Jurusan', type: 'text', required: true },
			{ key: 'tanggal', label: 'Tanggal Izin', type: 'text', placeholder: 'mis. 16 Juni 2026', required: true },
			{ key: 'lama', label: 'Lama Izin', type: 'text', placeholder: 'mis. 2 hari' },
			{ key: 'alasan', label: 'Alasan / Keterangan', type: 'textarea', placeholder: 'mis. demam dan perlu istirahat', required: true },
			{ key: 'ditujukan_ke', label: 'Ditujukan Kepada', type: 'text', placeholder: 'mis. Wali Kelas XII IPA 1', required: true },
			BAHASA_FIELD
		]
	},
	{
		name: 'Surat Izin / Cuti',
		slug: 'surat-izin-cuti',
		category: 'surat',
		description: 'Surat permohonan izin atau cuti kerja — format surat resmi.',
		struktur: [
			{ section: 'Kop / Tempat & Tanggal' },
			{ section: 'Tujuan Surat' },
			{ section: 'Pembuka' },
			{ section: 'Isi (permohonan izin/cuti)' },
			{ section: 'Penutup' },
			{ section: 'Tanda Tangan' }
		],
		format: {
			pageSize: 'A4',
			orientation: 'portrait',
			font: 'Times New Roman',
			fontSize: 24,
			lineSpacing: 276,
			marginTop: 1440,
			marginRight: 1440,
			marginBottom: 1440,
			marginLeft: 1440,
			headingStyle: 'none',
			cover: { type: 'none' }
		},
		formFields: [
			{ key: 'nama', label: 'Nama', type: 'text', required: true },
			{ key: 'jabatan', label: 'Jabatan / Posisi', type: 'text' },
			{ key: 'tanggal', label: 'Tanggal Izin/Cuti', type: 'text', placeholder: 'mis. 16–18 Juni 2026', required: true },
			{ key: 'jenis', label: 'Jenis', type: 'select', options: ['Izin', 'Cuti Tahunan', 'Cuti Melahirkan', 'Cuti Penting'], required: true },
			{ key: 'alasan', label: 'Alasan', type: 'textarea', required: true },
			{ key: 'ditujukan_ke', label: 'Ditujukan Kepada', type: 'text', placeholder: 'mis. Manajer HRD', required: true },
			BAHASA_FIELD
		]
	}
];
