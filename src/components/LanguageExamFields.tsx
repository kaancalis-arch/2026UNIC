import React from 'react';
import { AnalysisReport } from '../types';

type LanguageAnalysis = AnalysisReport['language'];
type LanguageField = keyof LanguageAnalysis;

interface LanguageExamFieldsProps {
  language: LanguageAnalysis;
  onChange: (field: LanguageField, value: string) => void;
}

const EXAM_OPTIONS = ['IELTS', 'IELTS UKVI', 'TOEFL', 'DUOLINGO', 'Diğer'];

const EXAM_FIELDS: Array<{
  number: number;
  type: LanguageField;
  score: LanguageField;
  date: LanguageField;
  otherNote: LanguageField;
}> = [
  { number: 1, type: 'examType', score: 'examScore', date: 'pastExamDate', otherNote: 'examOtherNote' },
  { number: 2, type: 'examType2', score: 'examScore2', date: 'pastExamDate2', otherNote: 'examOtherNote2' },
  { number: 3, type: 'examType3', score: 'examScore3', date: 'pastExamDate3', otherNote: 'examOtherNote3' },
];

const LanguageExamFields: React.FC<LanguageExamFieldsProps> = ({ language, onChange }) => (
  <div className="space-y-4">
    {EXAM_FIELDS.map(({ number, type, score, date, otherNote }) => {
      const selectedExam = String(language[type] || '');

      return (
        <div key={number} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-xs font-black uppercase tracking-wider text-slate-500">
              {number}. Sınav {number > 1 && <span className="font-semibold normal-case tracking-normal">(İsteğe Bağlı)</span>}
            </p>
            <button
              type="button"
              onClick={() => {
                onChange(type, '');
                onChange(score, '');
                onChange(date, '');
                onChange(otherNote, '');
              }}
              className="rounded-lg border border-rose-100 bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-rose-600 transition hover:bg-rose-50"
            >
              Sil
            </button>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm text-slate-600">Sınav</label>
              <select
                value={selectedExam}
                onChange={event => {
                  onChange(type, event.target.value);
                  if (event.target.value !== 'Diğer') onChange(otherNote, '');
                }}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="">Seçiniz</option>
                {EXAM_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-600">Skor</label>
              <input
                type="text"
                value={String(language[score] || '')}
                onChange={event => onChange(score, event.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                placeholder="Örn: 6.5"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-600">Sınav Tarihi</label>
              <input
                type="date"
                value={String(language[date] || '')}
                onChange={event => onChange(date, event.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>
          {selectedExam === 'Diğer' && (
            <div className="mt-4">
              <label className="mb-1 block text-sm text-slate-600">Diğer Sınav Notu</label>
              <input
                type="text"
                value={String(language[otherNote] || '')}
                onChange={event => onChange(otherNote, event.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                placeholder="Sınav adını veya açıklamayı yazınız"
              />
            </div>
          )}
        </div>
      );
    })}
  </div>
);

export default LanguageExamFields;
