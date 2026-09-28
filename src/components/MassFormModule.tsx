import React, { useState, useEffect } from 'react';
import { UserInfo, PageMode } from '../types';
import {
  User,
  ShieldCheck,
  MapPin,
  History,
  LogOut,
  ArrowLeft,
  Printer,
  Trash2,
  FileText,
  Send,
  Navigation,
} from 'lucide-react';

interface MassHistoryItem {
  id: number;
  dateInput: string;
  flightNoInput: string;
  destInput: string;
  categoryInput: string;
  flstText: string;
}

interface MassPassenger {
  name: string;
  seat: string;
  remarks: string;
}

interface Props {
  currentPage: PageMode;
  setCurrentPage: (page: PageMode) => void;
  onPrevious: () => void;
  onDashboard: () => void;
  onLogout: () => void;
  userInfo: UserInfo;
  showToast: (msg: string) => void;
}

const FLIGHT_DEST_MAP: Record<string, number[]> = {
  CGP: [101, 103, 105, 107, 109, 111, 113, 115, 117, 119],
  ZYL: [531, 533, 535, 537, 539],
  CXB: [141, 143, 145, 147, 149, 151, 153, 155, 157, 159],
  RJH: [161, 163, 165, 167, 169],
  SPD: [181, 183, 185, 187, 189, 191, 193, 195, 197, 199],
  BZL: [171, 173, 175, 179],
  JSR: [121, 123, 125, 127, 129],
  DXB: [341, 343],
  SHJ: [345, 347],
  AUH: [349, 351],
  RUH: [381, 383],
  JED: [361, 363],
  MLE: [337, 339],
  BKK: [217, 219],
  MCT: [321, 323],
  DOH: [333, 335],
  CCU: [201, 203],
  MAA: [205, 207, 209],
  CAN: [325, 327],
  SIN: [307, 309],
  KUL: [315, 317, 319],
};

const EXACT_FLIGHT_DEST_MAP: Record<number, string> = {};
for (const [dest, flights] of Object.entries(FLIGHT_DEST_MAP)) {
  flights.forEach((f) => {
    EXACT_FLIGHT_DEST_MAP[f] = dest;
  });
}

const DESTINATION_OPTIONS = [
  'DAC',
  'CGP',
  'SPD',
  'ZYL',
  'CXB',
  'JSR',
  'RJH',
  'BZL',
  'DXB',
  'AUH',
  'SHJ',
  'RUH',
  'JED',
  'MLE',
  'SIN',
  'CAN',
  'MCT',
  'BKK',
  'CCU',
  'MAA',
  'KUL',
  'DOH',
];

function formatMassDate(dateStr: string): string {
  if (!dateStr) return '';
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const year = parts[0].slice(-2);
    const monthIdx = parseInt(parts[1], 10) - 1;
    const day = parts[2].padStart(2, '0');
    const month = months[monthIdx] || '';
    return `${day} ${month} ${year}`;
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = String(d.getDate()).padStart(2, '0');
  const month = months[d.getMonth()];
  const year = String(d.getFullYear()).slice(-2);
  return `${day} ${month} ${year}`;
}

function parseMassFLST(text: string, selectedCategory: string): MassPassenger[] {
  const paxList: MassPassenger[] = [];
  const lines = (text || '').toUpperCase().split(/\r?\n/);
  let currentPax: MassPassenger | null = null;

  for (const rawLine of lines) {
    if (!rawLine.trim()) continue;

    const mainMatch = rawLine.match(/^\s*(\d+)\s+(.+)$/);
    const rest = mainMatch ? mainMatch[2] : rawLine.trim();

    const isSsrContinuation = /^\s*(?:MAAS|WCHR|WCHC|WCHS|VIP|CIP)\b/i.test(rawLine);
    const looksLikeMainPaxLine =
      !isSsrContinuation &&
      (Boolean(mainMatch) ||
        /(?:ETKT|TKNE)/i.test(rawLine) ||
        /\b[A-Z0-9]{5,8}\/[A-Z0-9]{2}/i.test(rawLine) ||
        /\d+\.\d+KG/i.test(rawLine) ||
        /[A-Z]+\/[A-Z]+/.test(rawLine));

    if (looksLikeMainPaxLine) {
      if (currentPax && currentPax.name) {
        paxList.push(currentPax);
      }

      // Extract Passenger Name cleanly before ETKT / TKNE / 10+ digit ticket number or 3+ spaces
      let paxName = rest;
      const nameSplit = rest.split(/\s+(?=ETKT|TKNE|\d{10,})/i);
      if (nameSplit.length > 1) {
        paxName = nameSplit[0].trim();
      } else {
        const multiSpaceSplit = rest.split(/\s{3,}/);
        paxName = multiSpaceSplit[0].trim();
      }
      paxName = paxName.replace(/\s+/g, ' ').trim();

      // Extract Seat Number accurately (ignoring /1B/ inside PNR like 0AEHN5/1B/BS)
      let seat = '';
      const seatAfterExc = rest.match(/EXC\s+\d+(?:\.\d+)?KG\s+([0-9]{1,3}[A-K])\b/i);
      if (seatAfterExc) {
        seat = seatAfterExc[1].toUpperCase();
      } else {
        // Strip PNR slash blocks (e.g. 0AEHN5/1B/BS) and ticket numbers before searching for seat
        const cleanedForSeat = rest
          .replace(/\b[A-Z0-9]{5,8}\/[A-Z0-9]{2}(?:\/[A-Z0-9]{2})?\b/gi, ' ')
          .replace(/\b(?:ETKT|TKNE)[A-Z0-9]+\b/gi, ' ');
        const allSeatMatches = [...cleanedForSeat.matchAll(/(?:^|\s)([0-9]{1,2}[A-K])(?=\s|$)/gi)];
        if (allSeatMatches.length > 0) {
          seat = allSeatMatches[allSeatMatches.length - 1][1].toUpperCase();
        }
      }

      currentPax = {
        name: paxName,
        seat,
        remarks: '',
      };
    } else if (currentPax) {
      const trimmedLine = rawLine.trim();
      if (trimmedLine.includes(selectedCategory)) {
        const extracted = trimmedLine
          .substring(trimmedLine.indexOf(selectedCategory) + selectedCategory.length)
          .trim();
        currentPax.remarks = currentPax.remarks
          ? `${currentPax.remarks} ${extracted}`.trim()
          : extracted;
      } else if (trimmedLine.includes('MAAS')) {
        const extracted = trimmedLine.substring(trimmedLine.indexOf('MAAS') + 4).trim();
        currentPax.remarks = currentPax.remarks
          ? `${currentPax.remarks} ${extracted}`.trim()
          : extracted;
      } else if (trimmedLine.includes('WCHR')) {
        const extracted = trimmedLine.substring(trimmedLine.indexOf('WCHR') + 4).trim();
        currentPax.remarks = currentPax.remarks
          ? `${currentPax.remarks} ${extracted}`.trim()
          : extracted;
      } else {
        currentPax.remarks = currentPax.remarks
          ? `${currentPax.remarks} ${trimmedLine}`.trim()
          : trimmedLine;
      }
    }
  }

  if (currentPax && currentPax.name) {
    paxList.push(currentPax);
  }

  return paxList;
}

export const MassFormModule: React.FC<Props> = ({
  currentPage,
  setCurrentPage,
  onPrevious,
  onDashboard,
  onLogout,
  userInfo,
  showToast,
}) => {
  const [designation, setDesignation] = useState<string>(() => {
    return localStorage.getItem('massApp_designation') || 'EXECUTIVE';
  });

  const [flightDate, setFlightDate] = useState<string>(() => {
    return localStorage.getItem('massApp_flight-date') || new Date().toISOString().split('T')[0];
  });
  const [flightNo, setFlightNo] = useState<string>(() => {
    return localStorage.getItem('massApp_flight-no') || '';
  });
  const [flightDest, setFlightDest] = useState<string>(() => {
    return localStorage.getItem('massApp_flight-dest') || 'BKK';
  });
  const [flightCategory, setFlightCategory] = useState<string>(() => {
    return localStorage.getItem('massApp_flight-category') || 'MAAS';
  });
  const [flstData, setFlstData] = useState<string>(() => {
    return localStorage.getItem('massApp_flst-data') || '';
  });

  const [historyList, setHistoryList] = useState<MassHistoryItem[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('massApp_history') || '[]');
    } catch {
      return [];
    }
  });

  const [activeReportData, setActiveReportData] = useState<{
    dateInput: string;
    flightNoInput: string;
    destInput: string;
    categoryInput: string;
    flstText: string;
  } | null>(null);

  // Sync draft inputs to localStorage
  useEffect(() => {
    localStorage.setItem('massApp_flight-date', flightDate);
  }, [flightDate]);

  useEffect(() => {
    localStorage.setItem('massApp_flight-no', flightNo);
  }, [flightNo]);

  useEffect(() => {
    localStorage.setItem('massApp_flight-dest', flightDest);
  }, [flightDest]);

  useEffect(() => {
    localStorage.setItem('massApp_flight-category', flightCategory);
  }, [flightCategory]);

  useEffect(() => {
    localStorage.setItem('massApp_flst-data', flstData);
  }, [flstData]);

  // Handle Flight Number change + Auto-Fill Destination
  const handleFlightNoChange = (val: string) => {
    setFlightNo(val);
    const num = parseInt(val, 10);
    if (!isNaN(num)) {
      let dest: string | null = null;
      if (num % 2 === 0) {
        dest = 'DAC';
      } else if (EXACT_FLIGHT_DEST_MAP[num]) {
        dest = EXACT_FLIGHT_DEST_MAP[num];
      }
      if (dest) {
        setFlightDest(dest);
      }
    }
  };

  // Handle MASS Login (Designation selection only, since User Name, USBA ID, and Station are already set)
  const handleMassLogin = () => {
    const cleanDesig = (designation || 'EXECUTIVE').toUpperCase();
    setDesignation(cleanDesig);
    localStorage.setItem('massApp_designation', cleanDesig);
    showToast('WELCOME OFFICER');
    setCurrentPage('mass-dashboard');
  };

  // Handle MASS Logout (direct logout to Login page)
  const handleMassLogout = () => {
    localStorage.removeItem('massApp_designation');
    localStorage.removeItem('massApp_flight-date');
    localStorage.removeItem('massApp_flight-no');
    localStorage.removeItem('massApp_flight-dest');
    localStorage.removeItem('massApp_flight-category');
    localStorage.removeItem('massApp_flst-data');
    setFlightNo('');
    setFlightCategory('MAAS');
    setFlstData('');
    setFlightDate(new Date().toISOString().split('T')[0]);
    onLogout();
  };

  // Generate / Save MASS Report
  const handleGenerateReport = (fromHistory = false, item?: MassHistoryItem) => {
    if (fromHistory && item) {
      setActiveReportData({
        dateInput: item.dateInput,
        flightNoInput: item.flightNoInput,
        destInput: item.destInput,
        categoryInput: item.categoryInput,
        flstText: item.flstText,
      });
      setCurrentPage('mass-report');
      return;
    }

    const cleanFlightNo = flightNo.trim();
    const cleanDest = flightDest.toUpperCase();
    const cleanCategory = flightCategory.toUpperCase();

    if (!flightDate) {
      showToast('PLEASE SELECT DATE.');
      return;
    }
    if (!cleanFlightNo) {
      showToast('PLEASE ENTER FLIGHT NUMBER.');
      return;
    }
    if (!cleanDest) {
      showToast('PLEASE SELECT DESTINATION.');
      return;
    }
    if (!cleanCategory) {
      showToast('PLEASE SELECT CATEGORY.');
      return;
    }

    const newEntry: MassHistoryItem = {
      id: Date.now(),
      dateInput: flightDate,
      flightNoInput: cleanFlightNo,
      destInput: cleanDest,
      categoryInput: cleanCategory,
      flstText: flstData,
    };

    const updatedHistory = [...historyList, newEntry];
    setHistoryList(updatedHistory);
    localStorage.setItem('massApp_history', JSON.stringify(updatedHistory));

    setActiveReportData({
      dateInput: flightDate,
      flightNoInput: cleanFlightNo,
      destInput: cleanDest,
      categoryInput: cleanCategory,
      flstText: flstData,
    });
    setCurrentPage('mass-report');
  };

  const handleDeleteHistoryItem = (id: number) => {
    const updated = historyList.filter((h) => h.id !== id);
    setHistoryList(updated);
    localStorage.setItem('massApp_history', JSON.stringify(updated));
    showToast('REPORT DELETED');
  };

  // ================= 1. MASS LOGIN SCREEN (ONLY DESIGNATION REQUIREMENT) =================
  if (currentPage === 'mass-login') {
    return (
      <div className="flex-1 flex flex-col justify-center items-center p-4 md:p-6 min-h-screen relative">
        <div className="max-w-md w-full bg-slate-900/90 backdrop-blur-xl p-8 md:p-10 rounded-2xl border border-slate-700/70 border-t-4 border-t-sky-500 border-b-4 border-b-rose-500 shadow-2xl relative z-10 text-white">
          {/* Common Top Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-6 pb-4 border-b border-slate-800">
            <button
              type="button"
              onClick={onPrevious}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer border border-slate-700 transition-all uppercase"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>PREVIOUS</span>
            </button>
            <button
              type="button"
              onClick={onDashboard}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow transition-all uppercase"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>DASHBOARD</span>
            </button>
            <button
              type="button"
              onClick={handleMassLogout}
              className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow transition-all uppercase"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>LOG OUT</span>
            </button>
          </div>

          {/* Header matching 3rd attached screenshot in dark aviation theme */}
          <div className="text-center mb-6">
            <h2 className="text-2xl md:text-3xl font-black tracking-wider text-white uppercase mb-2">
              US BANGLA AIRLINES
            </h2>
            <div className="w-16 h-1 bg-rose-500 mx-auto rounded-full mb-4" />
            <p className="text-xs text-amber-300 font-bold tracking-widest uppercase">
              MEET &amp; ASSIST (MASS) FORM PORTAL
            </p>
          </div>

          {/* Pre-filled User & Station Badge from Initial Login */}
          <div className="mb-6 p-3.5 rounded-xl bg-slate-800/80 border border-slate-700 flex flex-col gap-2 text-xs font-sans uppercase">
            <div className="flex items-center justify-between text-slate-300">
              <span className="flex items-center gap-1.5 font-bold text-slate-400">
                <User className="w-3.5 h-3.5 text-sky-400" />
                <span>OFFICER:</span>
              </span>
              <span className="font-black text-white tracking-wider">{userInfo.userName || 'N/A'}</span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span className="flex items-center gap-1.5 font-bold text-slate-400">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                <span>USBA ID:</span>
              </span>
              <span className="font-black text-indigo-300 tracking-wider">USBA-{userInfo.usbaId || 'N/A'}</span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span className="flex items-center gap-1.5 font-bold text-slate-400">
                <MapPin className="w-3.5 h-3.5 text-amber-400" />
                <span>STATION:</span>
              </span>
              <span className="font-black text-amber-300 tracking-wider">{userInfo.stationName || 'DAC'}</span>
            </div>
          </div>

          {/* Designation Requirement Only */}
          <div className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                DESIGNATION
              </label>
              <div className="relative">
                <select
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-xl bg-slate-800/95 text-white border border-slate-600 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 font-bold tracking-wider text-sm appearance-none transition-all cursor-pointer uppercase"
                >
                  <option value="EXECUTIVE" className="bg-slate-900 text-white">
                    EXECUTIVE
                  </option>
                  <option value="SR. EXE" className="bg-slate-900 text-white">
                    SR. EXECUTIVE
                  </option>
                </select>
                <div className="absolute right-4 top-4 pointer-events-none text-slate-400 text-xs">
                  ▼
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleMassLogin}
              className="w-full mt-4 py-3.5 px-6 rounded-xl bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-500 hover:to-blue-600 text-white font-black tracking-widest text-sm md:text-base shadow-xl hover:shadow-sky-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer transform active:scale-[0.98] uppercase"
            >
              <span>LOG IN</span>
              <Send className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setCurrentPage('welcome')}
              className="w-full py-2.5 px-6 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer border border-slate-700 uppercase"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>PREVIOUS</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ================= 2. MASS DASHBOARD / DATA ENTRY PAGE =================
  if (currentPage === 'mass-dashboard') {
    return (
      <div className="flex-1 flex flex-col justify-center items-center p-4 md:p-8 min-h-screen relative">
        <div className="max-w-2xl w-full bg-slate-900/90 backdrop-blur-xl p-6 md:p-8 rounded-2xl border border-slate-700/70 border-t-4 border-t-sky-500 border-b-4 border-b-rose-500 shadow-2xl text-slate-200">
          {/* Top Typewriter Subtitle */}
          <div className="flex justify-center mb-3">
            <span className="font-mono font-bold text-xs md:text-sm text-amber-400 tracking-widest uppercase">
              Invention Of Radoan Rasel....
            </span>
          </div>

          {/* Welcome Header with Navigation Buttons */}
          <div className="flex flex-col sm:flex-row justify-between items-center pb-4 mb-6 border-b border-slate-800 gap-3">
            <div>
              <h2 className="text-xl md:text-2xl font-black tracking-wider text-white uppercase">
                WELCOME, <span className="text-amber-400">{userInfo.userName || 'OFFICER'}</span>
              </h2>
              <p className="text-[11px] font-sans text-slate-400 uppercase tracking-wider mt-0.5">
                DESIGNATION: <span className="text-sky-300 font-bold">{designation}</span> &bull; STATION:{' '}
                <span className="text-amber-300 font-bold">{userInfo.stationName}</span>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onPrevious}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer border border-slate-700 transition-all uppercase"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>PREVIOUS</span>
              </button>

              <button
                type="button"
                onClick={onDashboard}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow transition-all uppercase"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>DASHBOARD</span>
              </button>

              <button
                type="button"
                onClick={() => setCurrentPage('mass-history')}
                className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow transition-all uppercase"
              >
                <History className="w-3.5 h-3.5" />
                <span>HISTORY</span>
              </button>

              <button
                type="button"
                onClick={handleMassLogout}
                className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow transition-all uppercase"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>LOG OUT</span>
              </button>
            </div>
          </div>

          {/* Form Fields */}
          <div className="space-y-4 text-xs md:text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col">
                <label className="font-bold text-slate-300 mb-1.5 tracking-wider uppercase">
                  DATE <span className="text-rose-400">*</span>
                </label>
                <input
                  type="date"
                  value={flightDate}
                  onChange={(e) => setFlightDate(e.target.value)}
                  className="p-3 border border-slate-700 rounded-xl bg-slate-800/90 text-white focus:border-amber-400 focus:outline-none font-bold"
                />
              </div>

              <div className="flex flex-col">
                <label className="font-bold text-slate-300 mb-1.5 tracking-wider uppercase">
                  FLIGHT NO <span className="text-rose-400">*</span>
                </label>
                <input
                  type="number"
                  placeholder="E.G. 315"
                  value={flightNo}
                  onChange={(e) => handleFlightNoChange(e.target.value)}
                  className="p-3 border border-slate-700 rounded-xl bg-slate-800/90 text-white focus:border-amber-400 focus:outline-none font-bold uppercase"
                />
              </div>
            </div>

            <div className="flex flex-col">
              <label className="font-bold text-slate-300 mb-1.5 tracking-wider uppercase">
                DESTINATION <span className="text-rose-400">*</span>
              </label>
              <select
                value={flightDest}
                onChange={(e) => setFlightDest(e.target.value)}
                className="p-3 border border-slate-700 rounded-xl bg-slate-800/90 text-white focus:border-amber-400 focus:outline-none font-bold uppercase cursor-pointer"
              >
                {DESTINATION_OPTIONS.map((dest) => (
                  <option key={dest} value={dest} className="bg-slate-900 text-white">
                    {dest}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col">
              <label className="font-bold text-slate-300 mb-1.5 tracking-wider uppercase">
                CATEGORY <span className="text-rose-400">*</span>
              </label>
              <select
                value={flightCategory}
                onChange={(e) => setFlightCategory(e.target.value)}
                className="p-3 border border-slate-700 rounded-xl bg-slate-800/90 text-white focus:border-amber-400 focus:outline-none font-bold uppercase cursor-pointer"
              >
                <option value="MAAS" className="bg-slate-900 text-white">
                  MAAS
                </option>
                <option value="WCHR" className="bg-slate-900 text-white">
                  WCHR
                </option>
              </select>
            </div>

            <div className="flex flex-col">
              <label className="font-bold text-amber-300 mb-1.5 tracking-wider uppercase">
                FLST (PASTE SYSTEM DATA HERE)
              </label>
              <textarea
                rows={8}
                placeholder="PASTE USER INFORMATION FROM SYSTEM HERE..."
                value={flstData}
                onChange={(e) => setFlstData(e.target.value.toUpperCase())}
                className="p-3 border border-slate-700 rounded-xl bg-slate-800/90 text-white focus:border-amber-400 focus:outline-none font-mono text-xs md:text-sm uppercase leading-relaxed"
              />
            </div>

            <button
              type="button"
              onClick={() => handleGenerateReport(false)}
              className="w-full mt-4 py-3.5 px-6 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black tracking-widest text-sm md:text-base shadow-xl hover:shadow-blue-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer uppercase"
            >
              <FileText className="w-4 h-4" />
              <span>GENERATE/SAVE</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ================= 3. MASS HISTORY SCREEN =================
  if (currentPage === 'mass-history') {
    const reversedHistory = [...historyList].reverse();
    return (
      <div className="flex-1 flex flex-col justify-center items-center p-4 md:p-8 min-h-screen relative">
        <div className="max-w-3xl w-full bg-slate-900/90 backdrop-blur-xl p-6 md:p-8 rounded-2xl border border-slate-700/70 border-t-4 border-t-sky-500 border-b-4 border-b-rose-500 shadow-2xl text-slate-200">
          <div className="flex flex-col sm:flex-row justify-between items-center pb-4 mb-6 border-b border-slate-800 gap-3">
            <h2 className="text-xl md:text-2xl font-black tracking-wider text-white uppercase">
              SAVED REPORTS HISTORY
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onPrevious}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer border border-slate-700 transition-all uppercase"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>PREVIOUS</span>
              </button>
              <button
                type="button"
                onClick={onDashboard}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow transition-all uppercase"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>DASHBOARD</span>
              </button>
              <button
                type="button"
                onClick={handleMassLogout}
                className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow transition-all uppercase"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>LOG OUT</span>
              </button>
            </div>
          </div>

          <div className="max-h-[420px] overflow-y-auto rounded-xl border border-slate-700 mb-6">
            <table className="w-full border-collapse text-xs md:text-sm uppercase">
              <thead>
                <tr className="bg-slate-800 text-amber-300 border-b border-slate-700">
                  <th className="p-3 text-center font-bold">DATE</th>
                  <th className="p-3 text-center font-bold">FLIGHT NO</th>
                  <th className="p-3 text-center font-bold">CATEGORY</th>
                  <th className="p-3 text-center font-bold">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {reversedHistory.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-slate-400 font-bold">
                      NO SAVED REPORTS FOUND.
                    </td>
                  </tr>
                ) : (
                  reversedHistory.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="p-3 text-center font-bold text-white">
                        {formatMassDate(item.dateInput)}
                      </td>
                      <td className="p-3 text-center font-bold text-sky-300">
                        BS-{item.flightNoInput}
                      </td>
                      <td className="p-3 text-center font-bold text-amber-300">
                        {item.categoryInput || 'MAAS'}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleGenerateReport(true, item)}
                            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1 cursor-pointer transition-all"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>PRINT</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteHistoryItem(item.id)}
                            className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1 cursor-pointer transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>DELETE</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            onClick={() => setCurrentPage('mass-dashboard')}
            className="w-full py-3.5 px-6 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer border border-slate-700 uppercase"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>BACK TO DASHBOARD</span>
          </button>
        </div>
      </div>
    );
  }

  // ================= 4. MASS FINAL REPORT PAGE (PRINTABLE A4) =================
  if (currentPage === 'mass-report') {
    const dataToUse = activeReportData || {
      dateInput: flightDate,
      flightNoInput: flightNo,
      destInput: flightDest,
      categoryInput: flightCategory,
      flstText: flstData,
    };

    const formattedDate = formatMassDate(dataToUse.dateInput);
    const passengers = parseMassFLST(dataToUse.flstText, dataToUse.categoryInput);
    const totalPages = Math.max(1, Math.ceil(passengers.length / 8));
    const stationCode = (userInfo.stationName || 'DAC').toUpperCase();
    const officerName = (userInfo.userName || '').toUpperCase();
    const officerDesig = (designation || 'EXECUTIVE').toUpperCase();

    return (
      <div className="mass-report-wrapper flex-1 p-4 md:p-8 min-h-screen flex flex-col items-center">
        {/* Top Action Bar (Hidden when printing) */}
        <div className="no-print max-w-[850px] w-full flex flex-col sm:flex-row justify-between items-center mb-6 bg-slate-900/90 backdrop-blur-md p-4 rounded-2xl border border-slate-700/70 shadow-xl gap-3">
          <div className="flex items-center gap-2 text-white font-bold tracking-wider uppercase text-sm md:text-base">
            <FileText className="w-5 h-5 text-amber-400" />
            <span>MEET AND ASSIST (MASS) HAND OVER LIST &mdash; BS-{dataToUse.flightNoInput}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onPrevious}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer border border-slate-700 transition-all uppercase"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>PREVIOUS</span>
            </button>

            <button
              type="button"
              onClick={onDashboard}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-lg transition-all uppercase"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>DASHBOARD</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-lg transition-all uppercase"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>PRINT / SAVE AS PDF</span>
            </button>

            <button
              type="button"
              onClick={handleMassLogout}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-lg transition-all uppercase"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>LOG OUT</span>
            </button>
          </div>
        </div>

        {/* Printable Pages Container */}
        <div className="w-full flex flex-col items-center gap-8">
          {Array.from({ length: totalPages }).map((_, pageIdx) => {
            return (
              <div
                key={pageIdx}
                className="mass-report-page w-full max-w-[850px] bg-white text-black p-6 md:p-10 rounded-xl shadow-2xl uppercase"
                style={{ fontFamily: "'Times New Roman', Times, serif" }}
              >
                {/* Report Header */}
                <div className="flex justify-between items-center mb-7 border-b-2 border-black pb-4 gap-4">
                  <div className="flex flex-col items-start justify-center whitespace-nowrap">
                    <div
                      className="font-black italic text-[26px] text-[#0b2e59] leading-none"
                      style={{ fontFamily: 'Arial, sans-serif' }}
                    >
                      US-BANGLA
                    </div>
                    <div
                      className="text-[11px] tracking-[5px] text-black mt-1 font-bold"
                      style={{ fontFamily: 'Arial, sans-serif' }}
                    >
                      A I R L I N E S
                    </div>
                  </div>

                  <div
                    className="flex-1 text-center font-black text-base md:text-lg text-[#0b2e59] tracking-wider bg-[#f0f4f8] py-2.5 px-4 rounded-md border-l-[6px] border-[#0b2e59]"
                    style={{ fontFamily: "'Segoe UI', Arial, sans-serif" }}
                  >
                    MEET AND ASSIST (MASS) HAND OVER LIST
                  </div>
                </div>

                {/* Flight Info Bar */}
                <div className="flex justify-between items-center text-base md:text-[18px] font-bold mb-5 text-black">
                  <div>FLIGHT NO. BS- {dataToUse.flightNoInput}</div>
                  <div>DATE: {formattedDate}</div>
                  <div>STATION: {stationCode}</div>
                </div>

                {/* Passenger Table (8 Rows per page) */}
                <table className="w-full border-collapse mb-4 table-fixed border border-black text-black">
                  <thead>
                    <tr className="bg-slate-50/60">
                      <th className="border border-black px-2 py-2 text-center text-[13px] font-bold w-[30%]">
                        NAME OF PASSENGER
                      </th>
                      <th className="border border-black px-1.5 py-2 text-center text-[13px] font-bold w-[10%]">
                        SEAT NO.
                      </th>
                      <th className="border border-black px-1.5 py-2 text-center text-[13px] font-bold w-[15%]">
                        DESTINATION
                      </th>
                      <th className="border border-black px-1.5 py-2 text-center text-[13px] font-bold w-[13%]">
                        CATEGORY
                      </th>
                      <th className="border border-black px-2 py-2 text-center text-[13px] font-bold w-[32%]">
                        REMARKS
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 8 }).map((__, rowIdx) => {
                      const paxIndex = pageIdx * 8 + rowIdx;
                      const pax = passengers[paxIndex];
                      return (
                        <tr key={rowIdx} className="h-[36px]">
                          <td className="border border-black px-2 py-1.5 text-left text-[13px] break-words">
                            {pax ? pax.name : ''}
                          </td>
                          <td className="border border-black px-1.5 py-1.5 text-center text-[13px] font-semibold break-words">
                            {pax ? pax.seat : ''}
                          </td>
                          <td className="border border-black px-1.5 py-1.5 text-center text-[13px] break-words">
                            {pax ? dataToUse.destInput : ''}
                          </td>
                          <td className="border border-black px-1.5 py-1.5 text-center text-[13px] break-words">
                            {pax ? dataToUse.categoryInput : ''}
                          </td>
                          <td className="border border-black px-2 py-1.5 text-left text-[13px] break-words">
                            {pax ? pax.remarks : ''}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Note */}
                <div className="text-center font-bold text-[15px] my-5 text-black">
                  *PLEASE INDICATE: WEHR-WHEEL CHAIR UPTO RAMP, MEDA, UM/YP, ETC.
                </div>

                {/* Acknowledgement Section */}
                <div className="text-center font-bold text-[19px] mb-3 text-black">
                  ACKNOWLEDGEMENT
                </div>

                <table className="w-full border-collapse table-fixed border border-black text-black">
                  <thead>
                    <tr className="bg-slate-50/60">
                      <th className="border border-black px-2 py-2 text-center text-[13px] font-bold w-[16%]"></th>
                      <th className="border border-black px-2 py-2 text-center text-[13px] font-bold w-[34%]">
                        NAME / DESIGNATION
                      </th>
                      <th className="border border-black px-2 py-2 text-center text-[13px] font-bold w-[15%]">
                        STATION
                      </th>
                      <th className="border border-black px-2 py-2 text-center text-[13px] font-bold w-[20%]">
                        SIGNATURE
                      </th>
                      <th className="border border-black px-2 py-2 text-center text-[13px] font-bold w-[15%]">
                        DATE
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="h-[38px]">
                      <td className="border border-black px-2 py-1 text-center font-bold text-[13px] leading-tight">
                        UPLIFT
                        <br />
                        STATION
                      </td>
                      <td className="border border-black px-2 py-1 text-center text-[13px]">
                        {officerName} //{officerDesig}
                      </td>
                      <td className="border border-black px-2 py-1 text-center text-[13px]">
                        {stationCode}
                      </td>
                      <td className="border border-black px-2 py-1 text-center text-[13px]"></td>
                      <td className="border border-black px-2 py-1 text-center text-[13px]">
                        {formattedDate}
                      </td>
                    </tr>
                    <tr className="h-[38px]">
                      <td className="border border-black px-2 py-1 text-center font-bold text-[13px] leading-tight">
                        CABIN
                        <br />
                        CREW
                      </td>
                      <td className="border border-black px-2 py-1 text-center text-[13px]"></td>
                      <td className="border border-black px-2 py-1 text-center text-[13px]">
                        {stationCode}
                      </td>
                      <td className="border border-black px-2 py-1 text-center text-[13px]"></td>
                      <td className="border border-black px-2 py-1 text-center text-[13px]">
                        {formattedDate}
                      </td>
                    </tr>
                    <tr className="h-[38px]">
                      <td className="border border-black px-2 py-1 text-center font-bold text-[13px] leading-tight">
                        TRANSIT
                        <br />
                        STATION
                      </td>
                      <td className="border border-black px-2 py-1 text-center text-[13px]"></td>
                      <td className="border border-black px-2 py-1 text-center text-[13px]"></td>
                      <td className="border border-black px-2 py-1 text-center text-[13px]"></td>
                      <td className="border border-black px-2 py-1 text-center text-[13px]"></td>
                    </tr>
                    <tr className="h-[38px]">
                      <td className="border border-black px-2 py-1 text-center font-bold text-[13px] leading-tight">
                        ARRIVAL
                        <br />
                        STATION
                      </td>
                      <td className="border border-black px-2 py-1 text-center text-[13px]"></td>
                      <td className="border border-black px-2 py-1 text-center text-[13px]"></td>
                      <td className="border border-black px-2 py-1 text-center text-[13px]"></td>
                      <td className="border border-black px-2 py-1 text-center text-[13px]"></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
};
