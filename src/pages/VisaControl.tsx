import React, { useState, useEffect, useRef } from 'react';
import { CheckSquare, Square, Globe, ChevronDown, Check, User, Search, FileText, Copy, Download, ClipboardCheck, AlertCircle, Save, Loader2 } from 'lucide-react';
import { getFlagEmoji, getCountryCode } from '../utils/countryUtils';
import { countryService } from '../services/countryService';
import { studentService } from '../services/studentService';
import { visaChecklistService, VisaChecklistItem } from '../services/visaChecklistService';
import { CountryData, Student, SystemUser } from '../types';

interface VisaControlProps {
  currentUser: SystemUser;
}

const VisaControl: React.FC<VisaControlProps> = ({ currentUser }) => {
  // Data
  const [countries, setCountries] = useState<CountryData[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [visaItems, setVisaItems] = useState<VisaChecklistItem[]>([]);

  // Selections
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedCountry, setSelectedCountry] = useState('');
  const [selectedVisaType, setSelectedVisaType] = useState<string>('');

  // Dropdown states
  const [studentDropdownOpen, setStudentDropdownOpen] = useState(false);
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');

  // Check states
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  // Loading
  const [loading, setIsLoading] = useState(false); // keep name diff small or change it
  const [copied, setCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Note states
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

  // Refs
  const studentDropdownRef = useRef<HTMLDivElement>(null);
  const countryDropdownRef = useRef<HTMLDivElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  // Load initial data
  useEffect(() => {
    const fetchData = async () => {
      const [countriesData, studentsData] = await Promise.all([
        countryService.getAll(),
        studentService.getAll()
      ]);
      setCountries(countriesData);
      setStudents(studentsData);
    };
    fetchData();
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (studentDropdownRef.current && !studentDropdownRef.current.contains(event.target as Node)) {
        setStudentDropdownOpen(false);
      }
      if (countryDropdownRef.current && !countryDropdownRef.current.contains(event.target as Node)) {
        setCountryDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load checklist when country+visa changes
  useEffect(() => {
    const loadItems = async () => {
      if (selectedCountry && selectedVisaType) {
        setIsLoading(true);
        try {
          const items = await visaChecklistService.getItems(selectedCountry, selectedVisaType);
          setVisaItems(items);
          // Reset checks
          setCheckedItems({});
        } finally {
          setIsLoading(false);
        }
      } else {
        setVisaItems([]);
        setCheckedItems({});
      }
    };
    loadItems();
  }, [selectedCountry, selectedVisaType]);

  // Reset visa type when country changes
  useEffect(() => {
    setSelectedVisaType('');
  }, [selectedCountry]);

  const activeCountryData = countries.find(c => c.name === selectedCountry);

  const toggleCheck = (id: string | undefined) => {
    if (!id) return;
    setCheckedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const CATEGORIES = [
    'Kişisel Belgeler',
    'E-devletten Alınacak Belgeler',
    'Banka Bilgileri',
    'Çalışma Belgeleri',
    'Danışmanınız Tarafından hazırlanacak Belgeler'
  ];

  // Unchecked items for report
  const uncheckedItems = visaItems.filter(item => !checkedItems[item.id!]);
  const hasReport = selectedCountry && selectedVisaType && visaItems.length > 0 && uncheckedItems.length > 0;

  // Filtered students
  const filteredStudents = students.filter(s => {
    const fullName = `${s.firstName} ${s.lastName}`.toLowerCase();
    return fullName.includes(studentSearch.toLowerCase());
  });

  // Generate WhatsApp text
  const generateWhatsAppText = () => {
    const studentName = selectedStudent ? `${selectedStudent.firstName} ${selectedStudent.lastName}` : '';
    const today = new Date().toLocaleDateString('tr-TR');
    
    let text = `🛂 *VİZE BELGE KONTROL RAPORU*\n`;
    text += `━━━━━━━━━━━━━━━━━━━\n`;
    if (studentName) text += `👤 *Öğrenci:* ${studentName}\n`;
    text += `🌍 *Ülke:* ${selectedCountry}\n`;
    text += `📋 *Vize Tipi:* ${selectedVisaType}\n`;
    text += `📅 *Tarih:* ${today}\n`;
    text += `━━━━━━━━━━━━━━━━━━━\n\n`;
    text += `⚠️ *EKSİK BELGELER:*\n\n`;

    CATEGORIES.forEach(category => {
      const categoryUnchecked = uncheckedItems.filter(item => item.category === category);
      if (categoryUnchecked.length > 0) {
        text += `📂 *${category}*\n`;
        categoryUnchecked.forEach((item, i) => {
          text += `  ${i + 1}. ${item.task}`;
          if (item.translation_required) text += ` 🌐(Çeviri Gerekli)`;
          text += `\n`;
          if (item.description) text += `     _${item.description}_\n`;
          const note = itemNotes[item.id!];
          if (note) text += `     📝 *Not:* _${note}_\n`;
        });
        text += `\n`;
      }
    });

    text += `━━━━━━━━━━━━━━━━━━━\n`;
    text += `✅ Tamamlanan: ${visaItems.length - uncheckedItems.length} / ${visaItems.length}\n`;
    text += `❌ Eksik: ${uncheckedItems.length} belge\n`;

    return text;
  };

  const handleCopyWhatsApp = () => {
    const text = generateWhatsAppText();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleSaveToCRM = async () => {
    if (!selectedStudent || !selectedCountry || !selectedVisaType) return;
    setIsSaving(true);
    try {
      const reportText = generateWhatsAppText();
      const newReport = {
        id: Math.random().toString(36).substr(2, 9),
        createdAt: new Date().toISOString(),
        country: selectedCountry,
        visaType: selectedVisaType,
        completedItems: visaItems.length - uncheckedItems.length,
        totalItems: visaItems.length,
        missingItemsReport: reportText
      };
      
      const updatedReports = [...(selectedStudent.visaReports || []), newReport];
      await studentService.update(selectedStudent.id, { visaReports: updatedReports });
      
      setStudents(prev => prev.map(s => s.id === selectedStudent.id ? { ...s, visaReports: updatedReports } : s));
      setSelectedStudent(prev => prev ? { ...prev, visaReports: updatedReports } : null);
      
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Failed to save report to CRM", error);
      alert("Kayıt sırasında bir hata oluştu.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadPDF = async () => {
    // Use browser print for PDF generation
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const studentName = selectedStudent ? `${selectedStudent.firstName} ${selectedStudent.lastName}` : '';
    const today = new Date().toLocaleDateString('tr-TR');

    let categoriesHtml = '';
    CATEGORIES.forEach(category => {
      const categoryUnchecked = uncheckedItems.filter(item => item.category === category);
      if (categoryUnchecked.length > 0) {
        categoriesHtml += `
          <div style="margin-bottom: 20px;">
            <h3 style="font-size: 14px; color: #4338ca; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid #e2e8f0;">${category}</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
              <thead>
                <tr style="background: #f8fafc;">
                  <th style="padding: 6px 8px; text-align: left; border: 1px solid #e2e8f0; width: 30px;">#</th>
                  <th style="padding: 6px 8px; text-align: left; border: 1px solid #e2e8f0;">Belge Adı</th>
                  <th style="padding: 6px 8px; text-align: left; border: 1px solid #e2e8f0;">Açıklama</th>
                  <th style="padding: 6px 8px; text-align: center; border: 1px solid #e2e8f0; width: 60px;">Çeviri</th>
                </tr>
              </thead>
              <tbody>
                ${categoryUnchecked.map((item, i) => `
                  <tr>
                    <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">${i + 1}</td>
                    <td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-weight: 600;">
                      ${item.task}
                      ${itemNotes[item.id!] ? `<div style="font-size: 10px; color: #4338ca; margin-top: 4px; font-weight: normal; font-style: italic;">📝 Not: ${itemNotes[item.id!]}</div>` : ''}
                    </td>
                    <td style="padding: 6px 8px; border: 1px solid #e2e8f0; color: #64748b;">${item.description || '-'}</td>
                    <td style="padding: 6px 8px; border: 1px solid #e2e8f0; text-align: center; color: ${item.translation_required ? '#d97706' : '#94a3b8'};">${item.translation_required ? '✓' : '-'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      }
    });

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Vize Belge Kontrol Raporu</title>
        <style>
          @media print { @page { margin: 20mm; } }
          body { font-family: 'Segoe UI', Tahoma, sans-serif; color: #1e293b; max-width: 800px; margin: 0 auto; padding: 20px; }
        </style>
      </head>
      <body>
        <div style="text-align: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid #4338ca;">
          <h1 style="font-size: 20px; color: #4338ca; margin: 0;">🛂 VİZE BELGE KONTROL RAPORU</h1>
          <p style="font-size: 12px; color: #64748b; margin-top: 4px;">Eksik Belgeler Listesi</p>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 20px; padding: 12px; background: #f8fafc; border-radius: 8px; font-size: 13px;">
          ${studentName ? `<div><strong>👤 Öğrenci:</strong> ${studentName}</div>` : ''}
          <div><strong>🌍 Ülke:</strong> ${selectedCountry}</div>
          <div><strong>📋 Vize Tipi:</strong> ${selectedVisaType}</div>
          <div><strong>📅 Tarih:</strong> ${today}</div>
        </div>

        <div style="display: flex; gap: 12px; margin-bottom: 20px;">
          <div style="flex: 1; padding: 8px 12px; background: #fef2f2; border-radius: 8px; text-align: center; font-size: 13px;">
            <strong style="color: #dc2626;">❌ ${uncheckedItems.length}</strong><br/>
            <span style="color: #64748b; font-size: 11px;">Eksik Belge</span>
          </div>
          <div style="flex: 1; padding: 8px 12px; background: #f0fdf4; border-radius: 8px; text-align: center; font-size: 13px;">
            <strong style="color: #16a34a;">✅ ${visaItems.length - uncheckedItems.length}</strong><br/>
            <span style="color: #64748b; font-size: 11px;">Tamamlanan</span>
          </div>
          <div style="flex: 1; padding: 8px 12px; background: #f8fafc; border-radius: 8px; text-align: center; font-size: 13px;">
            <strong style="color: #4338ca;">📊 ${visaItems.length}</strong><br/>
            <span style="color: #64748b; font-size: 11px;">Toplam</span>
          </div>
        </div>

        ${categoriesHtml}

        <div style="margin-top: 24px; padding-top: 12px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 10px; color: #94a3b8;">
          UNIC University Counsellor Platform tarafından oluşturulmuştur.
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-start lg:items-center flex-col lg:flex-row gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Vize Kontrol Formu</h2>
          <p className="text-slate-500 text-sm mt-1">Öğrenci vize belgelerini kontrol edin ve rapor oluşturun.</p>
        </div>
      </div>

      {/* Selection Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col lg:flex-row items-start lg:items-end gap-4">

          {/* Student Selection */}
          <div className="flex flex-col w-full lg:w-auto">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 ml-1">Öğrenci Seçimi</label>
            <div className="relative" ref={studentDropdownRef}>
              <button
                type="button"
                onClick={() => setStudentDropdownOpen(!studentDropdownOpen)}
                className="pl-3 pr-8 py-2 w-full lg:w-64 border border-slate-200 rounded-lg text-sm font-medium outline-none focus:border-indigo-500 hover:bg-slate-50 transition-colors text-left flex items-center gap-2.5 bg-white"
              >
                {selectedStudent ? (
                  <>
                    <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                      {selectedStudent.avatarUrl ? (
                        <img src={selectedStudent.avatarUrl} className="w-6 h-6 rounded-full object-cover" alt="" />
                      ) : (
                        <User className="w-3.5 h-3.5 text-indigo-600" />
                      )}
                    </div>
                    <span className="truncate">{selectedStudent.firstName} {selectedStudent.lastName}</span>
                  </>
                ) : (
                  <>
                    <User className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span className="text-slate-400">Öğrenci Seçiniz...</span>
                  </>
                )}
                <ChevronDown className={`w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 transition-transform ${studentDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {studentDropdownOpen && (
                <div className="absolute z-50 mt-1 w-full lg:w-64 bg-white border border-slate-200 rounded-xl shadow-xl max-h-72 overflow-hidden animate-fade-in">
                  {/* Search */}
                  <div className="p-2 border-b border-slate-100 sticky top-0 bg-white">
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={studentSearch}
                        onChange={e => setStudentSearch(e.target.value)}
                        placeholder="Ara..."
                        className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg outline-none focus:border-indigo-400"
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="overflow-y-auto max-h-56">
                    {filteredStudents.length === 0 ? (
                      <div className="px-3 py-4 text-center text-sm text-slate-400">Öğrenci bulunamadı.</div>
                    ) : (
                      filteredStudents.map(s => (
                        <div
                          key={s.id}
                          className={`flex items-center gap-2.5 px-3 py-2.5 hover:bg-indigo-50 cursor-pointer text-sm font-medium transition-colors ${
                            selectedStudent?.id === s.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700'
                          }`}
                          onClick={() => {
                            setSelectedStudent(s);
                            setStudentDropdownOpen(false);
                            setStudentSearch('');
                          }}
                        >
                          <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                            {s.avatarUrl ? (
                              <img src={s.avatarUrl} className="w-6 h-6 rounded-full object-cover" alt="" />
                            ) : (
                              <User className="w-3.5 h-3.5 text-slate-500" />
                            )}
                          </div>
                          <span className="truncate">{s.firstName} {s.lastName}</span>
                          {selectedStudent?.id === s.id && (
                            <Check className="w-4 h-4 text-indigo-600 ml-auto flex-shrink-0" />
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Country Selection */}
          <div className="flex flex-col w-full lg:w-auto">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 ml-1">Ülke Seçimi</label>
            <div className="relative" ref={countryDropdownRef}>
              <button
                type="button"
                onClick={() => setCountryDropdownOpen(!countryDropdownOpen)}
                className="pl-3 pr-8 py-2 w-full lg:w-56 border border-slate-200 rounded-lg text-sm font-medium outline-none focus:border-indigo-500 hover:bg-slate-50 transition-colors text-left flex items-center gap-2.5 bg-white"
              >
                {selectedCountry ? (
                  <>
                    {getCountryCode(selectedCountry) ? (
                      <img
                        src={`https://flagcdn.com/24x18/${getCountryCode(selectedCountry)}.png`}
                        srcSet={`https://flagcdn.com/48x36/${getCountryCode(selectedCountry)}.png 2x`}
                        width="24" height="18" alt={selectedCountry}
                        className="rounded-sm shadow-sm border border-slate-200/50 flex-shrink-0"
                      />
                    ) : (
                      <Globe className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    )}
                    <span className="truncate">{selectedCountry}</span>
                  </>
                ) : (
                  <>
                    <Globe className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span className="text-slate-400">Ülke Seçiniz...</span>
                  </>
                )}
                <ChevronDown className={`w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 transition-transform ${countryDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {countryDropdownOpen && (
                <div className="absolute z-50 mt-1 w-full lg:w-56 bg-white border border-slate-200 rounded-xl shadow-xl max-h-64 overflow-y-auto animate-fade-in">
                  <div
                    className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-slate-50 cursor-pointer text-sm text-slate-400 border-b border-slate-100"
                    onClick={() => { setSelectedCountry(''); setCountryDropdownOpen(false); }}
                  >
                    <Globe className="w-4 h-4 flex-shrink-0" />
                    Ülke Seçiniz...
                  </div>
                  {countries.map(c => {
                    const code = getCountryCode(c.name);
                    return (
                      <div
                        key={c.id}
                        className={`flex items-center gap-2.5 px-3 py-2.5 hover:bg-indigo-50 cursor-pointer text-sm font-medium transition-colors ${
                          selectedCountry === c.name ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700'
                        }`}
                        onClick={() => { setSelectedCountry(c.name); setCountryDropdownOpen(false); }}
                      >
                        {code ? (
                          <img
                            src={`https://flagcdn.com/24x18/${code}.png`}
                            srcSet={`https://flagcdn.com/48x36/${code}.png 2x`}
                            width="24" height="18" alt={c.name}
                            className="rounded-sm shadow-sm border border-slate-200/50 flex-shrink-0"
                          />
                        ) : (
                          <span className="text-base flex-shrink-0">{getFlagEmoji(c.name)}</span>
                        )}
                        {c.name}
                        {selectedCountry === c.name && (
                          <Check className="w-4 h-4 text-indigo-600 ml-auto flex-shrink-0" />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Visa Type Selection */}
          <div className="flex flex-col w-full lg:w-auto">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 ml-1">Vize Tipi</label>
            <select
              value={selectedVisaType}
              onChange={(e) => setSelectedVisaType(e.target.value)}
              disabled={!activeCountryData?.visaTypes?.length}
              className="px-4 py-2 w-full lg:w-64 border border-slate-200 rounded-lg text-sm font-medium outline-none focus:border-indigo-500 hover:bg-slate-50 transition-colors appearance-none disabled:bg-slate-50 disabled:text-slate-400"
            >
              <option value="">Vize Tipi Seçiniz...</option>
              {activeCountryData?.visaTypes?.length ? (
                activeCountryData.visaTypes.map((vt) => (
                  <option key={vt.id} value={vt.name}>{vt.name}</option>
                ))
              ) : (
                activeCountryData && <option value="">(Vize Tipi Tanımlanmamış)</option>
              )}
            </select>
          </div>
        </div>
      </div>

      {/* Checklist + Report */}
      {selectedCountry && selectedVisaType ? (
        <div className={`grid grid-cols-1 lg:grid-cols-5 gap-6 ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
          
          {/* Checklist - Left */}
          <div className="lg:col-span-3 space-y-6">
            {visaItems.length === 0 && !loading ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                <ClipboardCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-400 text-sm">Bu ülke ve vize tipi için henüz belge tanımlanmamış.</p>
                <p className="text-slate-300 text-xs mt-1">Visa Info Girişi sayfasından belge ekleyebilirsiniz.</p>
              </div>
            ) : (
              CATEGORIES.map((category) => {
                const categoryItems = visaItems.filter(item => item.category === category);
                if (categoryItems.length === 0) return null;

                return (
                  <div key={category} className="space-y-3">
                    <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                      <div className="w-1 h-5 bg-indigo-500 rounded-full" />
                      <div className="flex flex-col">
                        <h3 className="text-base font-bold text-slate-800">{category}</h3>
                        {category === 'Banka Bilgileri' && (
                          <span className="text-[10px] text-slate-500 font-normal -mt-0.5">
                            (Sponsor veya Başvuru sahibine ait olmalıdır)
                          </span>
                        )}
                        {category === 'Çalışma Belgeleri' && (
                          <span className="text-[10px] text-slate-500 font-normal -mt-0.5">
                            (Sponsor ve Başvuru sahibi çalışıyorsa her ikisi için de alınmalıdır)
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-400 ml-auto">
                        {categoryItems.filter(i => checkedItems[i.id!]).length}/{categoryItems.length}
                      </span>
                    </div>
                    
                    <div className="space-y-2">
                      {categoryItems.map(item => {
                        const isChecked = checkedItems[item.id!] || false;
                        return (
                          <div
                            key={item.id}
                            onClick={() => toggleCheck(item.id)}
                            className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all group ${
                              isChecked
                                ? 'bg-emerald-50/50 border-emerald-200 shadow-sm'
                                : 'bg-white border-slate-200 hover:border-indigo-200 shadow-sm'
                            }`}
                          >
                            <div className="mt-0.5">
                              {isChecked ? (
                                <CheckSquare className="w-5 h-5 text-emerald-500" />
                              ) : (
                                <Square className="w-5 h-5 text-slate-300 group-hover:text-indigo-400" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className={`font-semibold text-sm transition-colors ${isChecked ? 'text-emerald-700 line-through' : 'text-slate-800'}`}>
                                  {item.task}
                                </h4>
                                {item.translation_required && (
                                  <span className="text-[9px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">Çeviri</span>
                                )}
                              </div>
                              {item.description && (
                                <p className={`text-xs mt-1 transition-colors ${isChecked ? 'text-emerald-500/70' : 'text-slate-400'}`}>
                                  {item.description}
                                </p>
                              )}
                              
                              <div className="flex items-center gap-2 mt-3">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingNoteId(editingNoteId === item.id ? null : item.id!);
                                  }}
                                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                                    editingNoteId === item.id
                                      ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                                      : 'bg-slate-50 text-slate-600 border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600'
                                  }`}
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  Düzenleme
                                </button>
                              </div>

                              {editingNoteId === item.id && (
                                <div className="mt-3 animate-fade-in" onClick={(e) => e.stopPropagation()}>
                                  <textarea
                                    value={itemNotes[item.id!] || ''}
                                    onChange={(e) => setItemNotes(prev => ({ ...prev, [item.id!]: e.target.value }))}
                                    placeholder="Bu belge ile ilgili ek not giriniz..."
                                    className="w-full p-3 text-sm border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none resize-none h-24 bg-slate-50/50"
                                    autoFocus
                                  />
                                </div>
                              )}
                              
                              {itemNotes[item.id!] && editingNoteId !== item.id && (
                                <div className="mt-2 flex items-start gap-1.5 px-2 py-1.5 bg-indigo-50/50 rounded-lg border border-indigo-100/50">
                                  <FileText className="w-3 h-3 text-indigo-400 mt-0.5" />
                                  <p className="text-[11px] text-indigo-600 italic font-medium truncate">
                                    Not: {itemNotes[item.id!]}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Report - Right */}
          <div className="lg:col-span-2">
            <div className="sticky top-8 space-y-4">
              {/* Progress Card */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                  <ClipboardCheck className="w-4 h-4 text-indigo-600" />
                  İlerleme Durumu
                </h3>
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: `${visaItems.length ? ((visaItems.length - uncheckedItems.length) / visaItems.length) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold text-slate-700">
                    {visaItems.length ? Math.round(((visaItems.length - uncheckedItems.length) / visaItems.length) * 100) : 0}%
                  </span>
                </div>
                <div className="flex gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    Tamamlanan: {visaItems.length - uncheckedItems.length}
                  </span>
                  <span className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-rose-400" />
                    Eksik: {uncheckedItems.length}
                  </span>
                </div>
              </div>

              {/* Report Card */}
              {hasReport && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-4 bg-gradient-to-r from-rose-50 to-amber-50 border-b border-slate-200">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-500" />
                        Eksik Belgeler Raporu
                      </h3>
                      <span className="text-xs font-bold text-rose-600 bg-rose-100 px-2 py-0.5 rounded-full">
                        {uncheckedItems.length} belge
                      </span>
                    </div>
                    {selectedStudent && (
                      <p className="text-xs text-slate-500 mt-1">
                        👤 {selectedStudent.firstName} {selectedStudent.lastName}
                      </p>
                    )}
                  </div>

                  <div ref={reportRef} className="p-4 space-y-3 max-h-96 overflow-y-auto">
                    {CATEGORIES.map(category => {
                      const categoryUnchecked = uncheckedItems.filter(item => item.category === category);
                      if (categoryUnchecked.length === 0) return null;
                      return (
                        <div key={category}>
                          <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-2">{category}</h4>
                          <div className="space-y-1.5">
                            {categoryUnchecked.map((item, i) => (
                              <div key={item.id} className="flex items-start gap-2 text-xs">
                                <span className="text-slate-400 font-mono w-4 text-right flex-shrink-0">{i + 1}.</span>
                                <div>
                                  <span className="font-medium text-slate-700">{item.task}</span>

                                  {item.translation_required && (
                                    <span className="ml-1 text-amber-500 text-[9px] font-bold">🌐</span>
                                  )}
                                  {item.description && (
                                    <p className="text-slate-400 text-[11px] mt-0.5">{item.description}</p>
                                  )}
                                  {itemNotes[item.id!] && (
                                    <p className="text-indigo-500 text-[11px] mt-0.5 italic font-medium">📝 Not: {itemNotes[item.id!]}</p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Action Buttons */}
                  <div className="p-3 border-t border-slate-200 flex flex-wrap gap-2">
                    <button
                      onClick={handleSaveToCRM}
                      disabled={isSaving || !selectedStudent}
                      className="flex-1 min-w-[120px] flex items-center justify-center gap-2 px-3 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl text-xs font-bold transition-colors active:scale-95"
                      title={!selectedStudent ? "Lütfen bir öğrenci seçiniz" : "CRM'e Kaydet"}
                    >
                      {isSaving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : saveSuccess ? (
                        <>
                          <Check className="w-4 h-4" />
                          Kaydedildi!
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          CRM'e Kaydet
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleCopyWhatsApp}
                      className="flex-1 min-w-[120px] flex items-center justify-center gap-2 px-3 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors active:scale-95"
                    >
                      {copied ? (
                        <>
                          <Check className="w-4 h-4" />
                          Kopyalandı!
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          WhatsApp Kopyala
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleDownloadPDF}
                      className="flex-1 min-w-[120px] flex items-center justify-center gap-2 px-3 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors active:scale-95"
                    >
                      <Download className="w-4 h-4" />
                      PDF İndir
                    </button>
                  </div>
                </div>
              )}

              {/* All complete message */}
              {selectedCountry && selectedVisaType && visaItems.length > 0 && uncheckedItems.length === 0 && (
                <div className="bg-emerald-50 rounded-2xl border border-emerald-200 p-6 text-center">
                  <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Check className="w-6 h-6 text-emerald-600" />
                  </div>
                  <h3 className="font-bold text-emerald-800 mb-1">Tüm Belgeler Tamam! 🎉</h3>
                  <p className="text-xs text-emerald-600">Tüm gerekli belgeler tamamlanmış görünüyor.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
          <Globe className="w-16 h-16 text-slate-200 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-400 mb-2">Kontrol Başlatın</h3>
          <p className="text-sm text-slate-300 max-w-md mx-auto">
            Yukarıdan öğrenci, ülke ve vize tipini seçerek belge kontrol sürecini başlatabilirsiniz.
          </p>
        </div>
      )}
    </div>
  );
};

export default VisaControl;
