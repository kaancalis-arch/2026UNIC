import React, { useState, useEffect } from 'react';
import { ClipboardCheck, CheckSquare, Square, Info, AlertCircle, Globe, Plus, MessageSquare, Edit2, Check, X, Trash2, MapPin, Building2, CreditCard, Clock, FileText, Link, ExternalLink, Download, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import { getFlagEmoji } from '../utils/countryUtils';
import { countryService } from '../services/countryService';
import { visaChecklistService, VisaChecklistItem, VisaMetadata } from '../services/visaChecklistService';
import { CountryData, SystemUser, UserRole } from '../types';

interface VisaChecklistProps {
  currentUser: SystemUser;
}

const VisaChecklist: React.FC<VisaChecklistProps> = ({ currentUser }) => {
  const [countries, setCountries] = useState<CountryData[]>([]);
  const [selectedCountry, setSelectedCountry] = useState('');
  const [selectedVisaType, setSelectedVisaType] = useState<string>('');

  useEffect(() => {
    const fetchCountries = async () => {
      const data = await countryService.getAll();
      setCountries(data);
    };
    fetchCountries();
  }, []);

  const [isLoading, setIsLoading] = useState(false);

  const [visaInfo, setVisaInfo] = useState({
    institution: '',
    locations: '',
    method: '',
    pricing: '',
    durations: '',
    additional_info: ''
  });

  const [visaItems, setVisaItems] = useState<VisaChecklistItem[]>([]);

  // Load checklist data when selection changes
  useEffect(() => {
    const loadData = async () => {
      if (selectedCountry && selectedVisaType) {
        setIsLoading(true);
        try {
          // 1. Metadata yükle
          const metadata = await visaChecklistService.getMetadata(selectedCountry, selectedVisaType);
          setVisaInfo({
            institution: metadata?.institution || '',
            locations: metadata?.locations || '',
            method: metadata?.method || '',
            pricing: metadata?.pricing || '',
            durations: metadata?.durations || '',
            additional_info: metadata?.additional_info || ''
          });

          // 2. Belge listesini yükle
          const items = await visaChecklistService.getItems(selectedCountry, selectedVisaType);
          setVisaItems(items);
        } finally {
          setIsLoading(false);
        }
      }
    };
    loadData();
  }, [selectedCountry, selectedVisaType]);

  useEffect(() => {
    setSelectedVisaType('');
  }, [selectedCountry]);

  const activeCountryData = countries.find(c => c.name === selectedCountry);

  const CATEGORIES = [
    'Kişisel Belgeler',
    'E-devletten Alınacak Belgeler',
    'Sponsor Banka Belgeleri',
    'Sponsor Çalışma Belgeleri'
  ];

  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});
  const [openedNotes, setOpenedNotes] = useState<Record<string, boolean>>({});

  // Editing state
  const [editingItem, setEditingItem] = useState<VisaChecklistItem | null>(null);

  useEffect(() => {
    setEditingItem(null);
  }, [selectedCountry, selectedVisaType]);

  const toggleCheck = (id: string | undefined) => {
    if (!id) return;
    setCheckedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const updateNote = (id: string | undefined, text: string) => {
    if (!id) return;
    setItemNotes(prev => ({ ...prev, [id]: text }));
  };

  const toggleNoteOpen = (id: string | undefined) => {
    if (!id) return;
    setOpenedNotes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const startEdit = (item: VisaChecklistItem) => {
    setEditingItem({ ...item });
  };

  const cancelEdit = () => {
    setEditingItem(null);
  };

  const saveEdit = async () => {
    if (!editingItem || !editingItem.task.trim()) return;
    setIsLoading(true);
    try {
      const updated = await visaChecklistService.saveItem(editingItem);
      if (updated) {
        setVisaItems(prev => prev.map(item => item.id === updated.id ? updated : item));
      }
      setEditingItem(null);
    } catch (error: any) {
      alert('Hata: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteItem = async (id: string | undefined) => {
    if (!id || !window.confirm('Bu maddeyi silmek istediğinize emin misiniz?')) return;
    setIsLoading(true);
    try {
      await visaChecklistService.deleteItem(id);
      setVisaItems(prev => prev.filter(item => item.id !== id));
    } catch (error: any) {
      alert('Hata: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddNewItem = async (category: string) => {
    if (!selectedCountry || !selectedVisaType) return;
    const newItem: VisaChecklistItem = {
      country_name: selectedCountry,
      visa_type_name: selectedVisaType,
      category,
      task: '',
      description: '',
      required: true,
      translation_required: false,
      example_url: ''
    };
    
    setIsLoading(true);
    try {
      const saved = await visaChecklistService.saveItem(newItem);
      if (saved) {
        setVisaItems(prev => [...prev, saved]);
        setEditingItem(saved);
      }
    } catch (error: any) {
      alert('Hata: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };



  const handleSaveMetadata = async () => {
    if (!selectedCountry || !selectedVisaType) return;
    
    setIsLoading(true);
    try {
      await visaChecklistService.saveMetadata({
        country_name: selectedCountry,
        visa_type_name: selectedVisaType,
        ...visaInfo
      });
      alert('Başvuru bilgileri başarıyla kaydedildi.');
    } catch (error: any) {
      alert('Kaydetme hatası: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      setIsLoading(true);
      // Tüm verileri çek
      const allItems = await visaChecklistService.getAllItems?.() || [];
      const allMetadata = await visaChecklistService.getAllMetadata?.() || [];

      // Metadata'yı kolay erişim için mapleyelim
      const metaMap = new Map();
      allMetadata.forEach(m => {
        metaMap.set(`${m.country_name}-${m.visa_type_name}`, m);
      });

      const exportData = allItems.map(item => {
        const meta = metaMap.get(`${item.country_name}-${item.visa_type_name}`);
        return {
          'Ülke': item.country_name,
          'Vize Tipi': item.visa_type_name,
          'Kategori': item.category,
          'Belge Adı': item.task,
          'Açıklama': item.description,
          'Zorunlu Mu': item.required ? 'Evet' : 'Hayır',
          'Çeviri Gerekli Mi': item.translation_required ? 'Evet' : 'Hayır',
          'Örnek Belge URL': item.example_url || '',
          'Başvurulacak Kurum': meta?.institution || '',
          'Başvuru Yerleri': meta?.locations || '',
          'Başvuru Şekli': meta?.method || '',
          'Ücretlendirme': meta?.pricing || '',
          'Süreler': meta?.durations || '',
          'Ek Bilgiler': meta?.additional_info || ''
        };
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Vize Bilgileri");
      XLSX.writeFile(wb, `vize_bilgileri_toplu_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error: any) {
      alert('Dışa aktarma hatası: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm('Seçtiğiniz Excel dosyasındaki veriler sisteme yüklenecektir. Mevcut aynı kayıtlar güncellenecektir. Onaylıyor musunuz?')) {
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        setIsLoading(true);
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        // Verileri gruplayıp kaydetmemiz lazım
        // 1. Metadata'ları topla (Unique country+visa)
        const metadataMap = new Map();
        // 2. Item'ları topla
        const items: VisaChecklistItem[] = [];

        data.forEach(row => {
          const key = `${row['Ülke']}-${row['Vize Tipi']}`;
          if (!metadataMap.has(key)) {
            metadataMap.set(key, {
              country_name: String(row['Ülke']),
              visa_type_name: String(row['Vize Tipi']),
              institution: String(row['Başvurulacak Kurum'] || ''),
              locations: String(row['Başvuru Yerleri'] || ''),
              method: String(row['Başvuru Şekli'] || ''),
              pricing: String(row['Ücretlendirme'] || ''),
              durations: String(row['Süreler'] || ''),
              additional_info: String(row['Ek Bilgiler'] || '')
            });
          }

          items.push({
            country_name: String(row['Ülke']),
            visa_type_name: String(row['Vize Tipi']),
            category: String(row['Kategori'] || 'Diğer'),
            task: String(row['Belge Adı'] || ''),
            description: String(row['Açıklama'] || ''),
            required: String(row['Zorunlu Mu']).toLowerCase() === 'evet',
            translation_required: String(row['Çeviri Gerekli Mi']).toLowerCase() === 'evet',
            example_url: String(row['Örnek Belge URL'] || '')
          });
        });

        // Veritabanına yaz
        for (const meta of metadataMap.values()) {
          await visaChecklistService.saveMetadata(meta);
        }
        
        // Item'ları toplu upsert et (Service'de bulk upsert eklememiz lazım)
        await visaChecklistService.saveBulkItems?.(items);

        alert('Excel verileri başarıyla yüklendi.');
        window.location.reload();
      } catch (error: any) {
        alert('İçe aktarma hatası: ' + error.message);
      } finally {
        setIsLoading(false);
        e.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const isAuthorized = currentUser.role === UserRole.SUPER_ADMIN || currentUser.role === UserRole.ADMIN;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-start lg:items-center flex-col lg:flex-row gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Visa Info Girişi</h2>
          <p className="text-slate-500 text-sm mt-1">Vize başvuru bilgilerini ve belge listelerini yönetin.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm w-full lg:w-auto">
          
          <div className="flex flex-col w-full sm:w-auto">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 ml-1">Ülke Seçimi</label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center">
                <Globe className="w-4 h-4 text-slate-400" />
              </div>
              <select
                value={selectedCountry}
                onChange={(e) => setSelectedCountry(e.target.value)}
                className="pl-9 pr-8 py-2 w-full sm:w-48 border border-slate-200 rounded-lg text-sm font-medium outline-none focus:border-indigo-500 hover:bg-slate-50 transition-colors appearance-none"
              >
                <option value="">Ülke Seçiniz...</option>
                {countries.map(c => (
                  <option key={c.id} value={c.name}>{getFlagEmoji(c.name)} {c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col w-full sm:w-auto">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 ml-1">Vize Tipi</label>
            <select
              value={selectedVisaType}
              onChange={(e) => setSelectedVisaType(e.target.value)}
              disabled={!activeCountryData?.visaTypes?.length}
              className="px-4 py-2 w-full sm:w-64 border border-slate-200 rounded-lg text-sm font-medium outline-none focus:border-indigo-500 hover:bg-slate-50 transition-colors appearance-none disabled:bg-slate-50 disabled:text-slate-400"
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

            {isAuthorized && (
              <div className="flex gap-2">
                <button
                  onClick={handleSaveMetadata}
                  disabled={isLoading || !selectedCountry || !selectedVisaType}
                  className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 shadow-md shadow-indigo-100 transition-all active:scale-95"
                >
                  <Check className="w-4 h-4" />
                  Bilgileri Kaydet
                </button>

                <button
                  onClick={handleExportExcel}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-lg text-sm font-bold hover:bg-emerald-100 disabled:opacity-50 transition-colors"
                  title="Tüm vize verilerini dışa aktar"
                >
                  <Download className="w-4 h-4" />
                  Excel İndir
                </button>

                <div className="relative">
                  <input
                    type="file"
                    accept=".xlsx, .xls"
                    onChange={handleImportExcel}
                    className="hidden"
                    id="excel-upload"
                    disabled={isLoading}
                  />
                  <label
                    htmlFor="excel-upload"
                    className={`flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg text-sm font-bold hover:bg-blue-100 cursor-pointer transition-colors ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}
                    title="Excel'den vize verisi yükle"
                  >
                    <Upload className="w-4 h-4" />
                    Excel Yükle
                  </label>
                </div>
              </div>
            )}

        </div>
      </div>

      {selectedCountry && selectedVisaType ? (
        <div className={`grid grid-cols-1 lg:grid-cols-3 gap-6 ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="lg:col-span-2 space-y-6">
            
            {/* İletişim Kutusu (Visa Info) */}
            <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm space-y-8">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-800">İletişim ve Başvuru Bilgileri</h3>
                  <p className="text-sm text-slate-500">Vize başvurusu ile ilgili temel detaylar.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                      <Building2 className="w-3 h-3" /> Başvurulacak Kurum
                    </label>
                    <input 
                      type="text" 
                      value={visaInfo.institution}
                      onChange={(e) => setVisaInfo({...visaInfo, institution: e.target.value})}
                      disabled={!isAuthorized}
                      placeholder="Örn: VFS Global, iDATA, Konsolosluk..."
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:border-indigo-500 focus:bg-white transition-all outline-none disabled:opacity-60"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                      <MapPin className="w-3 h-3" /> Başvuru Yerleri
                    </label>
                    <textarea 
                      value={visaInfo.locations}
                      onChange={(e) => setVisaInfo({...visaInfo, locations: e.target.value})}
                      disabled={!isAuthorized}
                      placeholder="Örn: İstanbul, Ankara, İzmir (Birden fazla girilebilir)"
                      rows={2}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:border-indigo-500 focus:bg-white transition-all outline-none resize-none disabled:opacity-60"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                      <Globe className="w-3 h-3" /> Başvuru Şekli
                    </label>
                    <input 
                      type="text" 
                      value={visaInfo.method}
                      onChange={(e) => setVisaInfo({...visaInfo, method: e.target.value})}
                      disabled={!isAuthorized}
                      placeholder="Örn: Online Randevu, Şahsen Başvuru..."
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:border-indigo-500 focus:bg-white transition-all outline-none disabled:opacity-60"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                      <CreditCard className="w-3 h-3" /> Ücretlendirme
                    </label>
                    <input 
                      type="text" 
                      value={visaInfo.pricing}
                      onChange={(e) => setVisaInfo({...visaInfo, pricing: e.target.value})}
                      disabled={!isAuthorized}
                      placeholder="Örn: 80 EUR + Hizmet Bedeli"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:border-indigo-500 focus:bg-white transition-all outline-none disabled:opacity-60"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                      <Clock className="w-3 h-3" /> Vize Süreleri
                    </label>
                    <input 
                      type="text" 
                      value={visaInfo.durations}
                      onChange={(e) => setVisaInfo({...visaInfo, durations: e.target.value})}
                      disabled={!isAuthorized}
                      placeholder="Örn: İşlem süresi 15 iş günü"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:border-indigo-500 focus:bg-white transition-all outline-none disabled:opacity-60"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                      <FileText className="w-3 h-3" /> Ek Bilgiler
                    </label>
                    <textarea 
                      value={visaInfo.additional_info}
                      onChange={(e) => setVisaInfo({...visaInfo, additional_info: e.target.value})}
                      disabled={!isAuthorized}
                      placeholder="Önemli notlar ve uyarılar..."
                      rows={2}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:border-indigo-500 focus:bg-white transition-all outline-none resize-none disabled:opacity-60"
                    />
                  </div>
                </div>
              </div>
            </div>

            {CATEGORIES.map((category) => {
              const categoryItems = visaItems.filter(item => item.category === category);
              
              return (
                <div key={category} className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-4">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <div className="w-1 h-6 bg-indigo-500 rounded-full" />
                      {category}
                    </h3>
                    <button 
                      onClick={() => handleAddNewItem(category)}
                      className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-colors"
                    >
                      <Plus className="w-4 h-4" /> Yeni Madde
                    </button>
                  </div>

                  <div className="space-y-4">
                    {categoryItems.length === 0 ? (
                      <div className="py-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
                        <p className="text-sm text-slate-400 italic">Bu kategoriye henüz belge eklenmemiş.</p>
                      </div>
                    ) : (
                      categoryItems.map((item) => {
                        const isChecked = checkedItems[item.id!] || false;
                        const isNoteOpen = openedNotes[item.id!] || false;
                        const noteText = itemNotes[item.id!] || '';
                        const isEditing = editingItem?.id === item.id;

                        if (isEditing) {
                          return (
                            <div key={item.id} className="bg-white p-5 rounded-2xl border border-indigo-300 shadow-md">
                              <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <label className="block text-xs font-semibold text-slate-500 mb-1">Madde Adı</label>
                                    <input
                                      type="text"
                                      value={editingItem.task}
                                      onChange={(e) => setEditingItem({ ...editingItem, task: e.target.value })}
                                      className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
                                    />
                                  </div>
                                  <div className="flex gap-4 items-end pb-1">
                                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                                      <input 
                                        type="checkbox" 
                                        checked={editingItem.required}
                                        onChange={(e) => setEditingItem({ ...editingItem, required: e.target.checked })}
                                        className="w-4 h-4 text-indigo-600 border-gray-300 rounded cursor-pointer"
                                      />
                                      Zorunlu
                                    </label>
                                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                                      <input 
                                        type="checkbox" 
                                        checked={editingItem.translation_required}
                                        onChange={(e) => setEditingItem({ ...editingItem, translation_required: e.target.checked })}
                                        className="w-4 h-4 text-indigo-600 border-gray-300 rounded cursor-pointer"
                                      />
                                      İngilizce veya Yeminli Çeviri olmalı
                                    </label>
                                  </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <label className="block text-xs font-semibold text-slate-500 mb-1">Açıklama</label>
                                    <input
                                      type="text"
                                      value={editingItem.description}
                                      onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                                      className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-semibold text-slate-500 mb-1 flex items-center justify-between">
                                      <span className="flex items-center gap-1.5"><Link className="w-3 h-3" /> Örnek Belge</span>
                                      <span className="text-[10px] text-slate-400 font-normal">Link veya Dosya Yükle</span>
                                    </label>
                                    <div className="flex gap-2">
                                      <input
                                        type="text"
                                        value={editingItem.example_url || ''}
                                        onChange={(e) => setEditingItem({ ...editingItem, example_url: e.target.value })}
                                        className="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
                                        placeholder="Dosya linki veya upload edin..."
                                      />
                                      <label className="flex items-center justify-center p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg cursor-pointer transition-all border border-slate-300 shadow-sm disabled:opacity-50">
                                        <Upload className="w-4 h-4" />
                                        <input 
                                          type="file" 
                                          className="hidden" 
                                          onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                              try {
                                                setIsLoading(true);
                                                const url = await visaChecklistService.uploadExampleFile(file, `${selectedCountry}/${selectedVisaType}`);
                                                if (url) {
                                                  setEditingItem({ ...editingItem, example_url: url });
                                                }
                                              } catch (err: any) {
                                                alert('Yükleme hatası: ' + err.message);
                                              } finally {
                                                setIsLoading(false);
                                              }
                                            }
                                          }}
                                        />
                                      </label>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex flex-col gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                                  <p className="text-[10px] font-bold text-slate-400 uppercase">Toplu İşlem Seçenekleri</p>
                                  <div className="flex flex-wrap gap-4">
                                    <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer">
                                      <input 
                                        type="checkbox" 
                                        checked={editingItem.applyToCountry || false}
                                        onChange={(e) => setEditingItem({ ...editingItem, applyToCountry: e.target.checked })}
                                        className="w-3.5 h-3.5 text-amber-600 border-gray-300 rounded cursor-pointer"
                                      />
                                      Seçili Ülkenin Tüm Vize Tiplerine Uygula
                                    </label>
                                    <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer">
                                      <input 
                                        type="checkbox" 
                                        checked={editingItem.applyGlobally || false}
                                        onChange={(e) => setEditingItem({ ...editingItem, applyGlobally: e.target.checked })}
                                        className="w-3.5 h-3.5 text-rose-600 border-gray-300 rounded cursor-pointer"
                                      />
                                      TÜM Ülkelerin Vizelerine Uygula
                                    </label>
                                  </div>
                                </div>
                                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                                  <button onClick={cancelEdit} className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-slate-100 text-slate-600 rounded-lg text-sm font-medium transition-colors">
                                    <X className="w-4 h-4" /> İptal
                                  </button>
                                  <button onClick={async () => {
                                    if (editingItem.applyGlobally) {
                                      await visaChecklistService.applyItemToAllVisasGlobally(editingItem);
                                    } else if (editingItem.applyToCountry) {
                                      await visaChecklistService.applyItemToCountryVisas(selectedCountry, editingItem);
                                    }
                                    await saveEdit();
                                  }} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors">
                                    <Check className="w-4 h-4" /> Kaydet
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div 
                            key={item.id} 
                            className={`bg-white p-5 rounded-2xl border transition-all group relative ${
                              isChecked ? 'border-emerald-500 shadow-sm bg-emerald-50/10' : 'border-slate-200 shadow-sm hover:border-indigo-200'
                            }`}
                          >
                            <div className="flex flex-col gap-3">
                              <div className="flex gap-4">
                                <div className="mt-1" onClick={() => toggleCheck(item.id)}>
                                  {isChecked ? (
                                    <CheckSquare className="w-5 h-5 text-emerald-500 cursor-pointer" />
                                  ) : (
                                    <Square className="w-5 h-5 text-slate-300 group-hover:text-indigo-400 cursor-pointer" />
                                  )}
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center justify-between mb-1">
                                    <h4 className={`font-bold transition-colors ${isChecked ? 'text-emerald-700' : 'text-slate-800'}`}>
                                      {item.task}
                                    </h4>
                                    <div className="flex items-center gap-2">
                                      <button 
                                        onClick={() => toggleNoteOpen(item.id)}
                                        className={`p-1.5 rounded-lg transition-colors ${noteText ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:bg-slate-50 hover:text-indigo-600'}`}
                                        title="Not Ekle/Gör"
                                      >
                                        <MessageSquare className="w-4 h-4" />
                                      </button>
                                      <label className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-indigo-600 transition-colors cursor-pointer" title="Örnek Belge Yükle">
                                        <Upload className="w-4 h-4" />
                                        <input 
                                          type="file" 
                                          className="hidden" 
                                          onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                              try {
                                                setIsLoading(true);
                                                const url = await visaChecklistService.uploadExampleFile(file, `${selectedCountry}/${selectedVisaType}`);
                                                if (url) {
                                                  // Directly update database and state
                                                  const updated = await visaChecklistService.saveItem({ ...item, example_url: url });
                                                  if (updated) {
                                                    setVisaItems(prev => prev.map(vi => vi.id === item.id ? updated : vi));
                                                  }
                                                }
                                              } catch (err: any) {
                                                alert('Yükleme hatası: ' + err.message);
                                              } finally {
                                                setIsLoading(false);
                                              }
                                            }
                                          }}
                                        />
                                      </label>
                                      <button 
                                        onClick={() => startEdit(item)}
                                        className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-indigo-600 transition-colors"
                                        title="Maddeyi Düzenle"
                                      >
                                        <Edit2 className="w-4 h-4" />
                                      </button>
                                      <button 
                                        onClick={() => deleteItem(item.id)}
                                        className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                                        title="Maddeyi Sil"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                      {item.required ? (
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-rose-500 bg-rose-50 px-2 py-0.5 rounded">Zorunlu</span>
                                      ) : (
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50 px-2 py-0.5 rounded">Opsiyonel</span>
                                      )}
                                    </div>
                                  </div>
                                  
                                  {item.translation_required && (
                                    <div className="flex items-center gap-1.5 mb-2 mt-1">
                                      <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                        <Globe className="w-3 h-3" /> İngilizce veya Yeminli Çeviri olmalı
                                      </span>
                                    </div>
                                  )}

                                  {item.example_url && (
                                    <div className="mb-2">
                                      <a 
                                        href={item.example_url} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium hover:underline"
                                      >
                                        <ExternalLink className="w-3 h-3" /> Örnek Belge Görüntüle
                                      </a>
                                    </div>
                                  )}

                                  <p className={`text-sm leading-relaxed transition-colors ${isChecked ? 'text-emerald-600/80' : 'text-slate-500'}`}>
                                    {item.description}
                                  </p>
                                </div>
                              </div>
                              
                              {isNoteOpen && (
                                <div className="ml-9 border-t border-slate-100 pt-3 mt-1">
                                  <textarea
                                    value={noteText}
                                    onChange={(e) => updateNote(item.id, e.target.value)}
                                    placeholder="Bu belge ile ilgili notlarınızı buraya yazın..."
                                    className="w-full text-sm resize-none bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-700 outline-none focus:border-indigo-400 focus:bg-white transition-colors"
                                    rows={2}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-6">
            <div className="bg-indigo-600 rounded-2xl p-6 text-white shadow-lg shadow-indigo-200">
              <div className="flex items-center gap-3 mb-4">
                <Info className="w-6 h-6 opacity-80" />
                <h3 className="font-bold text-lg">Pro Tip</h3>
              </div>
              <p className="text-sm text-indigo-100 leading-relaxed mb-4">
                Always check the official embassy website for the most up-to-date requirements. Rules can change without notice.
              </p>
              <button className="w-full py-2 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-medium transition-colors">
                Visit Official Portal
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <AlertCircle className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-slate-800">Common Pitfalls</h3>
              </div>
              <ul className="space-y-3">
                {[
                  'Insufficient financial proof',
                  'Inconsistent travel history',
                  'Incomplete DS-160 forms',
                  'Missing original documents'
                ].map((pitfall, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-1.5" />
                    {pitfall}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
          <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-4">
            <ClipboardCheck className="w-8 h-8 text-indigo-500" />
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">Checklist Hazır Değil</h3>
          <p className="text-slate-500 text-center max-w-sm px-6">
            Lütfen belge listesini görüntülemek için yukarıdan bir <span className="font-bold text-slate-700">ülke</span> ve <span className="font-bold text-slate-700">vize tipi</span> seçin.
          </p>
        </div>
      )}
    </div>
  );
};

export default VisaChecklist;

