
import React, { useState } from 'react';
import { ClipboardCheck, CheckSquare, Square, Info, AlertCircle, Globe } from 'lucide-react';
import { getCountryCode, getFlagEmoji } from '../utils/countryUtils';

const VisaChecklist: React.FC = () => {
  const [selectedCountry, setSelectedCountry] = useState('USA');

  const checklists: Record<string, any[]> = {
    'USA': [
      { id: 1, task: 'Valid Passport', required: true, description: 'Must be valid for at least 6 months beyond stay.' },
      { id: 2, task: 'Form I-20', required: true, description: 'Certificate of Eligibility for Nonimmigrant Student Status.' },
      { id: 3, task: 'DS-160 Confirmation', required: true, description: 'Online Nonimmigrant Visa Application.' },
      { id: 4, task: 'SEVIS Fee Receipt', required: true, description: 'Proof of payment for the Student and Exchange Visitor Information System.' },
      { id: 5, task: 'Financial Support Proof', required: true, description: 'Bank statements, scholarship letters, etc.' },
      { id: 6, task: 'Academic Transcripts', required: false, description: 'Original copies of your previous academic records.' },
    ],
    'UK': [
      { id: 1, task: 'CAS (Confirmation of Acceptance for Studies)', required: true, description: 'Reference number from your university.' },
      { id: 2, task: 'Current Passport', required: true, description: 'Valid travel document.' },
      { id: 3, task: 'Financial Evidence', required: true, description: 'Proof you can pay for your course and support yourself.' },
      { id: 4, task: 'TB Test Results', required: true, description: 'If applying from certain countries.' },
      { id: 5, task: 'ATAS Certificate', required: false, description: 'Depending on your course of study.' },
    ],
    'Canada': [
      { id: 1, task: 'Letter of Acceptance', required: true, description: 'From a Designated Learning Institution (DLI).' },
      { id: 2, task: 'Proof of Identity', required: true, description: 'Passport and two recent photos.' },
      { id: 3, task: 'Proof of Financial Support', required: true, description: 'Tuition payment, GIC, bank statements.' },
      { id: 4, task: 'Letter of Explanation', required: true, description: 'Why you want to study in Canada.' },
      { id: 5, task: 'CAQ (Quebec only)', required: false, description: 'If studying in Quebec.' },
    ]
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Visa Checklist</h2>
          <p className="text-slate-500 text-sm">Required documents and steps for student visa applications.</p>
        </div>
        <div className="flex items-center gap-3 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
          {Object.keys(checklists).map(country => (
            <button
              key={country}
              onClick={() => setSelectedCountry(country)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                selectedCountry === country 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <div className="w-4 h-4 rounded-full overflow-hidden flex items-center justify-center shrink-0 border border-black/10">
                  {getCountryCode(country) ? (
                      <img src={`https://flagcdn.com/w40/${getCountryCode(country).toLowerCase()}.png`} className="w-full h-full object-cover" alt={country} />
                  ) : (
                      <span className="text-[10px]">{getFlagEmoji(country)}</span>
                  )}
              </div>
              {country}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {checklists[selectedCountry].map((item) => (
            <div key={item.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-indigo-200 transition-all group">
              <div className="flex gap-4">
                <div className="mt-1">
                  <Square className="w-5 h-5 text-slate-300 group-hover:text-indigo-400 cursor-pointer" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-bold text-slate-800">{item.task}</h4>
                    {item.required ? (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-rose-500 bg-rose-50 px-2 py-0.5 rounded">Required</span>
                    ) : (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50 px-2 py-0.5 rounded">Optional</span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500 leading-relaxed">{item.description}</p>
                </div>
              </div>
            </div>
          ))}
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
    </div>
  );
};

export default VisaChecklist;
