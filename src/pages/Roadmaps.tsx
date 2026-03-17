import React, { useState, useMemo } from 'react';
import { Map, Search, Globe, GraduationCap, BookOpen, Clock, CheckCircle2, ChevronRight, Info, AlertCircle, FileText, ClipboardList } from 'lucide-react';

interface RoadmapGuide {
  id: string;
  country: string;
  programType: string;
  department: string;
  overview: string;
  requirements: string[];
  deadlines: Array<{ label: string, date: string }>;
  steps: Array<{ title: string, description: string }>;
  tuitionInfo: string;
}

const ROADMAP_GUIDES: RoadmapGuide[] = [
  {
    id: 'italy-medicine-ug',
    country: 'İtalya',
    programType: 'Lisans',
    department: 'Tıp',
    overview: 'İtalya\'da tıp eğitimi (Medicine and Surgery), uluslararası öğrenciler için oldukça popülerdir. Eğitim süresi 6 yıldır ve genellikle IMAT (International Medical Admissions Test) sınavı ile öğrenci kabul edilir.',
    requirements: [
      'Lise Diploması',
      'YKS Barajını Geçmek (Tıp için yeterli puan)',
      'IMAT Sınav Puanı',
      'İngilizce Dil Belgesi (En az B2 - IELTS 6.0+)',
      'Üniversite Ön Kayıt (Universitaly)'
    ],
    deadlines: [
      { label: 'Universitaly Ön Başvuru', date: 'Mayıs - Temmuz' },
      { label: 'IMAT Sınav Kaydı', date: 'Temmuz' },
      { label: 'IMAT Sınav Tarihi', date: 'Eylül' },
      { label: 'Vize Başvurusu', date: 'Ağustos - Eylül' }
    ],
    steps: [
      { title: 'Hazırlık Aşaması', description: 'İngilizce dil yeterliliği alınmalı ve IMAT sınavına hazırlık başlanmalı.' },
      { title: 'Universitaly Kaydı', description: 'Seçilen üniversite için portal üzerinden ön kayıt oluşturulmalı.' },
      { title: 'Sınav Girişi', description: 'Belirlenen merkezlerde IMAT sınavına girilmeli.' },
      { title: 'Denklik ve Vize', description: 'DOV (Declaration of Value) veya CIMEA belgesi alınmalı ve vize başvurusu yapılmalı.' }
    ],
    tuitionInfo: 'Devlet üniversitelerinde harçlar aile gelirine göre 156€ ile 4000€ arasında değişmektedir.'
  },
  {
      id: 'italy-eng-ug',
      country: 'İtalya',
      programType: 'Lisans',
      department: 'Mühendislik',
      overview: 'Politecnico di Milano ve Politecnico di Torino gibi okullar dünyada ilk sıralardadır. Giriş için genellikle TOLC-I veya okulun kendi sınavı (TIL) gerekir.',
      requirements: ['Lise Diploması', 'TOLC-I Sınavı', 'B2 İngilizce', 'YKS Barajı'],
      deadlines: [{ label: 'Başvuru Dönemi', date: 'Şubat - Haziran' }],
      steps: [{ title: 'Sınav', description: 'TOLC sınavına online veya merkezde girilir.' }],
      tuitionInfo: 'Yıllık 2500€ - 3800€ arası.'
  }
];

const COUNTRIES = ['İtalya', 'Almanya', 'Hollanda', 'İngiltere', 'Polonya', 'Macaristan', 'Amerika', 'Kanada'];
const PROGRAM_TYPES = ['Lisans', 'Yüksek Lisans', 'Sertifika', 'Dil Okulu', 'Yaz Okulu'];
const DEPARTMENTS = ['Tıp', 'Mühendislik', 'Mimarlık', 'İşletme/Ekonomi', 'Psikoloji', 'Sanat/Tasarım', 'Hukuk'];

const Roadmaps: React.FC = () => {
    const [selectedCountry, setSelectedCountry] = useState('');
    const [selectedProgram, setSelectedProgram] = useState('');
    const [selectedDept, setSelectedDept] = useState('');

    const activeGuide = useMemo(() => {
        return ROADMAP_GUIDES.find(g => 
            g.country === selectedCountry && 
            g.programType === selectedProgram && 
            g.department === selectedDept
        );
    }, [selectedCountry, selectedProgram, selectedDept]);

    const isSelectionComplete = selectedCountry && selectedProgram && selectedDept;

    return (
        <div className="space-y-8 animate-fade-in pb-12">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 uppercase tracking-tight">Kılavuzlar & Yol Haritaları</h2>
                    <p className="text-slate-500 font-medium">Hedef ülkeye ve bölüme göre süreci planlayın.</p>
                </div>
                <div className="flex items-center gap-2 bg-indigo-50 px-4 py-2 rounded-xl text-indigo-700 font-bold text-sm border border-indigo-100">
                    <Map className="w-4 h-4" />
                    Global Roadmap Module
                </div>
            </div>

            {/* Selection Box */}
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/50">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <Globe className="w-3.5 h-3.5" />
                            Ülke Seçimi
                        </label>
                        <select 
                            value={selectedCountry}
                            onChange={(e) => setSelectedCountry(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-700 font-medium focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all appearance-none cursor-pointer"
                        >
                            <option value="">Seçiniz...</option>
                            {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>

                    <div className="space-y-2">
                         <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <GraduationCap className="w-3.5 h-3.5" />
                            Program Türü
                        </label>
                        <select 
                            value={selectedProgram}
                            onChange={(e) => setSelectedProgram(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-700 font-medium focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all appearance-none cursor-pointer"
                        >
                            <option value="">Seçiniz...</option>
                            {PROGRAM_TYPES.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <BookOpen className="w-3.5 h-3.5" />
                            Bölüm Seçimi
                        </label>
                        <select 
                            value={selectedDept}
                            onChange={(e) => setSelectedDept(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-700 font-medium focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all appearance-none cursor-pointer"
                        >
                            <option value="">Seçiniz...</option>
                            {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {/* Results Area */}
            {!isSelectionComplete ? (
                <div className="bg-slate-100/50 border-2 border-dashed border-slate-200 rounded-3xl p-16 text-center space-y-4">
                    <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto shadow-sm">
                        <Search className="w-8 h-8 text-slate-300" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-700 uppercase">Yol Haritası Gösterilmeye Hazır</h3>
                        <p className="text-slate-500 max-w-sm mx-auto">Süreci görüntülemek için lütfen yukarıdaki seçimleri tamamlayın.</p>
                    </div>
                </div>
            ) : activeGuide ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-slide-up">
                    {/* Main Content */}
                    <div className="lg:col-span-2 space-y-8">
                        {/* Overview Section */}
                        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm border-l-8 border-l-indigo-600">
                             <div className="flex items-center gap-3 mb-6">
                                <div className="p-2.5 bg-indigo-50 rounded-xl">
                                    <Info className="w-6 h-6 text-indigo-600" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-800 uppercase tracking-wider">{activeGuide.country} {activeGuide.department} Rehberi</h3>
                             </div>
                             <p className="text-slate-600 leading-relaxed text-lg italic">
                                "{activeGuide.overview}"
                             </p>
                        </div>

                        {/* Steps Section */}
                        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                             <div className="flex items-center gap-3 mb-8">
                                <div className="p-2.5 bg-amber-50 rounded-xl">
                                    <Clock className="w-6 h-6 text-amber-600" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-800 uppercase tracking-wider">İşlem Basamakları</h3>
                             </div>
                             
                             <div className="space-y-6 relative">
                                 {/* Vertical Line */}
                                 <div className="absolute left-[23px] top-4 bottom-4 w-0.5 bg-slate-100 hidden md:block"></div>
                                 
                                 {activeGuide.steps.map((step, i) => (
                                     <div key={i} className="flex gap-6 relative group">
                                         <div className="w-12 h-12 rounded-2xl bg-white border-2 border-slate-100 shadow-sm flex items-center justify-center font-bold text-slate-400 group-hover:border-indigo-600 group-hover:text-indigo-600 transition-all z-10 shrink-0">
                                             {i + 1}
                                         </div>
                                         <div className="flex-1 pb-6 border-b border-slate-50 group-last:border-none">
                                              <h4 className="font-bold text-slate-800 text-lg mb-2">{step.title}</h4>
                                              <p className="text-slate-500 leading-relaxed">{step.description}</p>
                                         </div>
                                     </div>
                                 ))}
                             </div>
                        </div>
                    </div>

                    {/* Sidebar Info */}
                    <div className="space-y-6">
                         {/* Requirements */}
                         <div className="bg-indigo-900 text-white p-8 rounded-3xl shadow-xl shadow-indigo-200">
                            <h3 className="font-bold text-lg mb-6 flex items-center gap-2 uppercase tracking-wider">
                                <ClipboardList className="w-5 h-5 text-indigo-300" />
                                Kabul Şartları
                            </h3>
                            <ul className="space-y-4">
                                {activeGuide.requirements.map((req, i) => (
                                    <li key={i} className="flex items-start gap-3 text-indigo-100 text-sm font-medium">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                        {req}
                                    </li>
                                ))}
                            </ul>
                         </div>

                         {/* Deadlines */}
                         <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm border-t-8 border-t-rose-500">
                            <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2 uppercase tracking-wider">
                                <AlertCircle className="w-5 h-5 text-rose-500" />
                                Kritik Tarihler
                            </h3>
                            <div className="space-y-4">
                                {activeGuide.deadlines.map((dl, i) => (
                                    <div key={i} className="flex justify-between items-center bg-slate-50 p-3 rounded-2xl border border-slate-100">
                                        <span className="text-xs font-bold text-slate-500">{dl.label}</span>
                                        <span className="text-sm font-bold text-rose-600 bg-rose-50 px-2 py-1 rounded-lg">{dl.date}</span>
                                    </div>
                                ))}
                            </div>
                         </div>

                         {/* Tuition info */}
                         <div className="bg-emerald-600 text-white p-8 rounded-3xl shadow-lg">
                             <div className="flex items-center gap-3 mb-4">
                                <FileText className="w-6 h-6 text-emerald-200" />
                                <h3 className="font-bold uppercase tracking-wider">Maliyet Bilgisi</h3>
                             </div>
                             <p className="text-emerald-50 font-medium">
                                 {activeGuide.tuitionInfo}
                             </p>
                         </div>
                    </div>
                </div>
            ) : (
                <div className="bg-amber-50 border border-amber-100 rounded-3xl p-16 text-center space-y-4">
                     <AlertCircle className="w-12 h-12 text-amber-500 mx-auto" />
                     <div className="max-w-md mx-auto">
                        <h3 className="text-lg font-bold text-amber-900 uppercase">Kılavuz Bulunamadı</h3>
                        <p className="text-amber-700 mt-2">
                             Seçtiğiniz kriterler için henüz detaylı bir yol haritası hazırlanmamış olabilir. 
                             Daha fazla bilgi için danışmanınızla iletişime geçebilirsiniz.
                        </p>
                        <div className="mt-8 pt-8 border-t border-amber-200 text-xs font-bold text-amber-500 uppercase tracking-widest">
                            İpucu: İtalya - Lisans - Tıp kombinasyonunu deneyin.
                        </div>
                     </div>
                </div>
            )}
        </div>
    );
};

export default Roadmaps;
