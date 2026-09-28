/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  UserInfo,
  FlightFormData,
  PageMode,
} from './types';
import {
  AC_REG_KEYS,
  AIRCRAFT_DATABASE,
  CAPTAIN_SUGGESTIONS,
  COMMON_DELAY_REASONS,
  findRouteByFlightNo,
  calculateDepartureStatus,
  calculateArrivalStatus,
  calculateGroundTime,
  getRegistrationDetails,
  getAircraftDetails,
} from './data/aviationData';
import { generateFlightDepartureMessage, parseFlstMessage } from './utils/reportGenerators';
import { DepartureReportTable } from './components/DepartureReportTable';
import { DeparturePhotoCard } from './components/DeparturePhotoCard';
import { MassFormModule } from './components/MassFormModule';
import {
  Plane,
  Printer,
  Copy,
  ArrowLeft,
  RotateCcw,
  CheckCircle,
  FileText,
  User,
  ShieldCheck,
  Send,
  Sparkles,
  MapPin,
  Globe,
  Navigation,
  LogOut,
  AlertTriangle,
  Image as ImageIcon,
} from 'lucide-react';

const STATION_OPTIONS = [
  { code: 'DAC', name: 'DAC - DHAKA' },
  { code: 'CXB', name: "CXB - COX'S BAZAR" },
  { code: 'SPD', name: 'SPD - SAIDPUR' },
  { code: 'CGP', name: 'CGP - CHATTOGRAM' },
  { code: 'RJH', name: 'RJH - RAJSHAHI' },
  { code: 'JSR', name: 'JSR - JASHORE' },
  { code: 'BZL', name: 'BZL - BARISHAL' },
  { code: 'ZYL', name: 'ZYL - SYLHET' },
];

const INITIAL_FORM_DATA: FlightFormData = {
  date: new Date().toISOString().split('T')[0],
  flightNoSuffix: '',
  route: '',
  acRegSuffix: '',
  acType: '',
  captain: '',
  configure: '',
  sta: '',
  chocksOn: '',
  doorOpen: '',
  arrivalStatus: 'FLIGHT ON TIME ARRIVED',
  std: '',
  doorClosed: '',
  chocksOff: '',
  airborne: '',
  departureStatus: 'FLIGHT ONTIME',
  delayReason: '',
  flightLoad: '',
  fuelUplift: '',
  paxMale: '',
  paxFemale: '',
  paxChild: '',
  paxInfant: '',
  paxTotal: '',
  baggageWeight: '',
  baggagePcs: '',
  baggageComNo: '',
  cargoWeight: '',
  cargoPcs: '',
  cargoComNo: '',
  crewBagWeight: '',
  crewBagPcs: '',
  crewBagComNo: '',
  mail: '',
  counterNoshow: '',
  gateNoShow: '',
  selfOffload: '',
  refused: '',
  immigrationOff: '',
  immigrationNotFace: '',
  customOff: '',
  vip: '',
  cip: '',
  maas: '',
  umPax: '',
  umPaxSeat: '',
  fireArms: '',
  fireArmsSeat: '',
  wchrFig: '',
  wchrSeat: '',
  wchcFig: '',
  wchcSeat: '',
  checkInStaff: '',
  checkInStuff: '',
  rampOfficer: '',
  loadingStuff: '',
  loadController: '',
  paxHandling: '',
  noshowPnr: '',
  remarks: '',
  flstRawMessage: '',
};

// Animated Typewriter Text component
const TypewriterText: React.FC<{ text: string }> = ({ text }) => {
  const [displayText, setDisplayText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [typingSpeed, setTypingSpeed] = useState(120);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    const handleType = () => {
      const fullText = text;
      setDisplayText(
        isDeleting
          ? fullText.substring(0, displayText.length - 1)
          : fullText.substring(0, displayText.length + 1)
      );

      setTypingSpeed(isDeleting ? 45 : 110);

      if (!isDeleting && displayText === fullText) {
        timer = setTimeout(() => setIsDeleting(true), 2200);
      } else if (isDeleting && displayText === '') {
        setIsDeleting(false);
        timer = setTimeout(() => {}, 600);
      }
    };

    timer = setTimeout(handleType, typingSpeed);
    return () => clearTimeout(timer);
  }, [displayText, isDeleting, text, typingSpeed]);

  return (
    <span className="inline-flex items-center tracking-widest text-amber-400 font-mono text-xs md:text-sm font-bold uppercase drop-shadow-sm">
      <span>{displayText}</span>
      <span className="animate-pulse ml-1 text-amber-300 font-bold">|</span>
    </span>
  );
};

export default function App() {
  const [currentPage, setCurrentPage] = useState<PageMode>(() => {
    const saved = localStorage.getItem('usba_current_page');
    return (saved as PageMode) || 'identification';
  });
  const [lastDataPage, setLastDataPage] = useState<PageMode>(() => {
    const saved = localStorage.getItem('usba_last_data_page');
    return (saved as PageMode) || 'data-intl';
  });
  const [reportType, setReportType] = useState<'intl' | 'dom'>(() => {
    const saved = localStorage.getItem('usba_report_type');
    return (saved as 'intl' | 'dom') || 'intl';
  });

  const [userInfo, setUserInfo] = useState<UserInfo>(() => {
    const saved = localStorage.getItem('usba_user_info');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return {
      userName: '',
      usbaId: '',
      stationName: 'DAC',
    };
  });

  const [formData, setFormData] = useState<FlightFormData>(() => {
    const saved = localStorage.getItem('usba_flight_form_data');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return INITIAL_FORM_DATA;
  });

  const [showDelayBox, setShowDelayBox] = useState(false);
  const [delayWarningModal, setDelayWarningModal] = useState(false);
  const [showNewReportModal, setShowNewReportModal] = useState(false);
  const [showCounterNoshowModal, setShowCounterNoshowModal] = useState(false);
  const [noCounterNoshowConfirmed, setNoCounterNoshowConfirmed] = useState(false);
  const [showNoshowPnrWarningModal, setShowNoshowPnrWarningModal] = useState(false);
  const [pendingReportType, setPendingReportType] = useState<'intl' | 'dom' | null>(null);
  const [seatWarningTarget, setSeatWarningTarget] = useState<'umPax' | 'fireArms' | 'wchr' | 'wchc' | null>(null);
  const delayReasonInputRef = React.useRef<HTMLInputElement>(null);
  const counterNoshowInputRef = React.useRef<HTMLInputElement>(null);
  const noshowPnrInputRef = React.useRef<HTMLInputElement>(null);
  const umPaxSeatInputRef = React.useRef<HTMLInputElement>(null);
  const fireArmsSeatInputRef = React.useRef<HTMLInputElement>(null);
  const wchrSeatInputRef = React.useRef<HTMLInputElement>(null);
  const wchcSeatInputRef = React.useRef<HTMLInputElement>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sync state to LocalStorage
  useEffect(() => {
    localStorage.setItem('usba_current_page', currentPage);
  }, [currentPage]);

  useEffect(() => {
    localStorage.setItem('usba_last_data_page', lastDataPage);
  }, [lastDataPage]);

  useEffect(() => {
    localStorage.setItem('usba_report_type', reportType);
  }, [reportType]);

  useEffect(() => {
    localStorage.setItem('usba_user_info', JSON.stringify(userInfo));
  }, [userInfo]);

  useEffect(() => {
    localStorage.setItem('usba_flight_form_data', JSON.stringify(formData));
  }, [formData]);

  const handleLogout = () => {
    if (window.confirm('ARE YOU SURE TO LOG OUT? ALL STORED DATA WILL BE CLEARED.')) {
      localStorage.removeItem('usba_user_info');
      localStorage.removeItem('usba_flight_form_data');
      localStorage.removeItem('usba_current_page');
      localStorage.removeItem('usba_last_data_page');
      localStorage.removeItem('usba_report_type');
      setUserInfo({ userName: '', usbaId: '', stationName: 'DAC' });
      setFormData(INITIAL_FORM_DATA);
      setCurrentPage('identification');
      showToast('LOGGED OUT SUCCESSFULLY.');
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const validateDelayReason = (e?: React.FocusEvent<any> | React.MouseEvent<any>): boolean => {
    if (showDelayBox && (!formData.delayReason || formData.delayReason.trim() === '')) {
      if (e && 'target' in e && e.target && typeof (e.target as HTMLElement).blur === 'function') {
        (e.target as HTMLElement).blur();
      }
      setDelayWarningModal(true);
      return false;
    }
    return true;
  };

  // Auto calculate Passenger Total
  useEffect(() => {
    const male = parseInt(formData.paxMale, 10) || 0;
    const female = parseInt(formData.paxFemale, 10) || 0;
    const child = parseInt(formData.paxChild, 10) || 0;
    const total = male + female + child;
    setFormData((prev) => ({
      ...prev,
      paxTotal: total > 0 ? String(total) : '',
    }));
  }, [formData.paxMale, formData.paxFemale, formData.paxChild]);

  // Auto calculate Arrival Status (for Outstation)
  useEffect(() => {
    if (formData.sta && formData.chocksOn) {
      const arrStatus = calculateArrivalStatus(formData.sta, formData.chocksOn);
      setFormData((prev) => ({
        ...prev,
        arrivalStatus: arrStatus,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        arrivalStatus: 'FLIGHT ON TIME ARRIVED',
      }));
    }
  }, [formData.sta, formData.chocksOn]);

  // Auto calculate Departure Status and toggle Delay Reason Box
  useEffect(() => {
    if (formData.std && formData.chocksOff) {
      const result = calculateDepartureStatus(formData.std, formData.chocksOff, formData.delayReason);
      setShowDelayBox(result.isDelayed);
      setFormData((prev) => ({
        ...prev,
        departureStatus: result.statusText,
      }));
    } else {
      setShowDelayBox(false);
    }
  }, [formData.std, formData.chocksOff, formData.delayReason]);

  // Handle Flight No change -> auto Route
  const handleFlightNoChange = (val: string) => {
    const cleanVal = val.replace(/\D/g, '').toUpperCase();
    const matchedRoute = findRouteByFlightNo(cleanVal);
    setFormData((prev) => ({
      ...prev,
      flightNoSuffix: cleanVal,
      route: matchedRoute || prev.route,
    }));
  };

  // Handle Reg Change -> auto AC Type & Seats
  const handleRegChange = (val: string) => {
    const upper = val.toUpperCase().trim().replace(/^(S2-|HS-|PK-)/, '').slice(0, 3);
    const details = getAircraftDetails(upper);
    setFormData((prev) => ({
      ...prev,
      acRegSuffix: upper,
      acType: details.type || prev.acType,
      configure: prev.configure || (details.seat ? `00/00/${details.seat}` : ''),
    }));
  };

  // Format Time input: auto formats HHMM or digits
  const handleTimeInput = (
    field: 'sta' | 'chocksOn' | 'doorOpen' | 'std' | 'doorClosed' | 'chocksOff' | 'airborne',
    rawVal: string
  ) => {
    const digits = rawVal.replace(/\D/g, '').slice(0, 4);
    setFormData((prev) => ({
      ...prev,
      [field]: digits,
    }));
  };

  // Reset form
  const resetForm = () => {
    setFormData((prev) => ({
      ...INITIAL_FORM_DATA,
      date: new Date().toISOString().split('T')[0],
      checkInStuff: prev.checkInStuff,
      loadingStuff: prev.loadingStuff,
      loadController: prev.loadController,
    }));
    setShowDelayBox(false);
    setDelayWarningModal(false);
  };

  // Navigation handlers
  const handleEnterIdentification = () => {
    if (!userInfo.userName.trim() || !userInfo.usbaId.trim()) {
      alert('Please fill in both User Name and USBA ID to continue.');
      return;
    }
    setCurrentPage('welcome');
  };

  const goToDataPage = (page: PageMode, type: 'intl' | 'dom') => {
    setReportType(type);
    setLastDataPage(page);
    setCurrentPage(page);
  };

  const isZeroOrEmptyVal = (val?: string): boolean => {
    if (!val) return true;
    const trimmed = val.trim().toUpperCase();
    if (trimmed === '' || trimmed === 'NIL' || trimmed === 'N/A' || trimmed === '-') return true;
    if (/^0+$/.test(trimmed)) return true;
    return false;
  };

  // Validate 6-character alphanumeric PNR per PNR (e.g. 024UGD, 03ERUF, 0345VD, 1DHUR2, 161GPX)
  const isValidNoshowPnr = (val?: string): boolean => {
    if (!val) return false;
    const trimmed = val.trim().toUpperCase();
    if (trimmed === '' || trimmed === 'NIL' || trimmed === 'N/A' || trimmed === '-') return false;
    if (/^0+$/.test(trimmed)) return false;
    const tokens = trimmed.split(/[\s,/]+/).filter(Boolean);
    if (tokens.length === 0) return false;
    return tokens.every((t) => /^[A-Z0-9]{6}$/.test(t));
  };

  const handleGenerateReport = (type: 'intl' | 'dom') => {
    if (!validateDelayReason()) return;

    // 1. Validate UM PAX Seat Number if UM PAX > 0
    const umPaxNum = parseInt(formData.umPax, 10);
    if (!isNaN(umPaxNum) && umPaxNum > 0 && isZeroOrEmptyVal(formData.umPaxSeat)) {
      setSeatWarningTarget('umPax');
      return;
    }

    // 2. Validate FIRE ARMS Seat Number if FIRE ARMS > 0
    const fireArmsNum = parseInt(formData.fireArms, 10);
    const hasFireArms = (!isNaN(fireArmsNum) && fireArmsNum > 0) || !isZeroOrEmptyVal(formData.fireArms);
    if (hasFireArms && isZeroOrEmptyVal(formData.fireArmsSeat)) {
      setSeatWarningTarget('fireArms');
      return;
    }

    // 3. Validate WCHR Seat Number if WCHR > 0
    const wchrNum = parseInt(formData.wchrFig, 10);
    if (!isNaN(wchrNum) && wchrNum > 0 && isZeroOrEmptyVal(formData.wchrSeat)) {
      setSeatWarningTarget('wchr');
      return;
    }

    // 4. Validate WCHC Seat Number if WCHC > 0
    const wchcNum = parseInt(formData.wchcFig, 10);
    if (!isNaN(wchcNum) && wchcNum > 0 && isZeroOrEmptyVal(formData.wchcSeat)) {
      setSeatWarningTarget('wchc');
      return;
    }

    // 5. Check Counter Noshow: if blank, show "THIS FIELD CAN NOT BE BLANK" popup
    if (formData.counterNoshow.trim() === '') {
      setShowCounterNoshowModal(true);
      return;
    }

    // 6. If Counter Noshow >= 1, user MUST input valid 6-character PNR number in NOSHOW PNR box
    const counterNum = parseInt(formData.counterNoshow, 10);
    if (!isNaN(counterNum) && counterNum >= 1 && !isValidNoshowPnr(formData.noshowPnr)) {
      setShowNoshowPnrWarningModal(true);
      return;
    }

    setReportType(type);
    setCurrentPage('dual-report');
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`${label} copied to clipboard!`);
  };

  const printSection = (_target: 'message' | 'right') => {
    window.print();
  };

  // Demo autofill for rapid testing
  const populateSampleData = (type: 'intl' | 'dom') => {
    if (type === 'intl') {
      setFormData({
        date: new Date().toISOString().split('T')[0],
        flightNoSuffix: '333',
        route: 'DAC-DOH',
        acRegSuffix: 'ALA',
        acType: 'AIRBUS 330',
        captain: 'LUTFOR',
        configure: '2/5',
        sta: '1845',
        chocksOn: '1835',
        doorOpen: '1838',
        arrivalStatus: '10 MINS EARLY ARRIVED',
        std: '1945',
        doorClosed: '1940',
        chocksOff: '1945',
        airborne: '1955',
        departureStatus: 'FLIGHT ONTIME',
        delayReason: '',
        flightLoad: '360',
        fuelUplift: '32000',
        paxMale: '210',
        paxFemale: '110',
        paxChild: '35',
        paxInfant: '5',
        paxTotal: '355',
        baggageWeight: '7800',
        baggagePcs: '340',
        baggageComNo: '1, 2, 4',
        cargoWeight: '2400',
        cargoPcs: '85',
        cargoComNo: '3, 5',
        crewBagWeight: '120',
        crewBagPcs: '8',
        crewBagComNo: '1',
        mail: '2 pcs',
        counterNoshow: '3',
        gateNoShow: '1',
        selfOffload: '0',
        refused: '0',
        immigrationOff: '1',
        immigrationNotFace: '0',
        customOff: '0',
        vip: '0',
        cip: '2',
        maas: '4',
        umPax: '1',
        fireArms: 'NIL',
        wchrFig: '3',
        wchrSeat: '14A, 22C, 35K',
        wchcFig: '1',
        wchcSeat: '18D',
        checkInStuff: 'KABIR / HASAN',
        loadingStuff: 'RASEL / G7',
        loadController: 'RADOAN RASEL',
        paxHandling: 'NIL',
        remarks: 'NOSHOW PNR: X8Y9Z1, GATENOSHOW: K2L9P0',
        flstRawMessage: ` 1   ALAM/MD MONJUR  MR        ETKT42414411 7792412566959                          I   I  DAC CGP     0ADPN4/BS/BS 0  20.00kg 0.00/20.00kg Exc 0kg 18C AD AD                        
        MAAS                      Commissioner of taxes, Ministry of Finance, NBR, BD
    2   RAHMAN/ANISUR CAPT        TKNE42517876 7794883669747                          X   I  DAC CGP     0AELDQ/1B/BS 0  20.00kg 0.00/20.00kg Exc 0kg 17C AD AD                        
        WCHR                      DIRECTOR SEA CONSORTIUM BD LTD                      
    3   RASHED/MIR  MR            ETKT42517550 7792412595230                          T   I  DAC CGP     0AELAH/BS/BS 0  20.00kg 0.00/20.00kg Exc 0kg 18A AD AD                        
        MAAS                      Additional chief engineer.PWD`,
      });
    } else {
      setFormData({
        date: new Date().toISOString().split('T')[0],
        flightNoSuffix: '142',
        route: 'CXB-DAC',
        acRegSuffix: 'AKK',
        acType: 'ATR 72 600',
        captain: 'AHMAD',
        configure: '2/5',
        sta: '0930',
        chocksOn: '0920',
        doorOpen: '0922',
        arrivalStatus: '10 MINS EARLY ARRIVED',
        std: '1000',
        doorClosed: '0958',
        chocksOff: '0959',
        airborne: '1010',
        departureStatus: 'FLIGHT 1 MINS EARLY',
        delayReason: '',
        flightLoad: '72',
        fuelUplift: '5000',
        paxMale: '45',
        paxFemale: '20',
        paxChild: '5',
        paxInfant: '1',
        paxTotal: '70',
        baggageWeight: '450',
        baggagePcs: '50',
        baggageComNo: '',
        cargoWeight: '0',
        cargoPcs: '0',
        cargoComNo: '',
        crewBagWeight: '',
        crewBagPcs: '',
        crewBagComNo: '',
        mail: '01 (TO CREW)',
        counterNoshow: '2',
        gateNoShow: '0',
        selfOffload: '0',
        vip: '5',
        cip: '2',
        maas: '2',
        umPax: '0',
        fireArms: 'NIL',
        wchrFig: '2',
        wchrSeat: '2A, 3A',
        wchcFig: '1',
        wchcSeat: '2A',
        checkInStuff: 'HGHGHH, GFTHGHH',
        loadingStuff: 'ASHIQ',
        loadController: 'ABIR',
        paxHandling: 'NORMAL',
        remarks: 'NOSHOW PNR: P8L2M1',
        flstRawMessage: ` 1   ALAM/MD MONJUR  MR        ETKT42414411 7792412566959                          I   I  DAC CGP     0ADPN4/BS/BS 0  20.00kg 0.00/20.00kg Exc 0kg 18C AD AD                        
        MAAS                      Commissioner of taxes, Ministry of Finance, NBR, BD
    2   RAHMAN/ANISUR CAPT        TKNE42517876 7794883669747                          X   I  DAC CGP     0AELDQ/1B/BS 0  20.00kg 0.00/20.00kg Exc 0kg 17C AD AD                        
        WCHR                      DIRECTOR SEA CONSORTIUM BD LTD                      
    3   RASHED/MIR  MR            ETKT42517550 7792412595230                          T   I  DAC CGP     0AELAH/BS/BS 0  20.00kg 0.00/20.00kg Exc 0kg 18A AD AD                        
        MAAS                      Additional chief engineer.PWD`,
      });
    }
    showToast('Sample flight data loaded!');
  };

  const isOutstation = (userInfo.stationName || 'DAC').trim().toUpperCase() !== 'DAC';
  const departureMessage = generateFlightDepartureMessage(formData, userInfo, reportType);
  const flstWhatsappMessage = parseFlstMessage(formData.flstRawMessage, formData);

  return (
    <div className="aviation-modern-bg min-h-screen w-full flex flex-col font-serif select-text text-white relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-2xl text-xs md:text-sm font-sans flex items-center gap-2.5 animate-bounce border border-emerald-400">
          <CheckCircle className="w-4 h-4 text-emerald-200" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ================= PAGE 1: USER IDENTIFICATION ================= */}
      {currentPage === 'identification' && (
        <div className="flex-1 flex flex-col justify-center items-center text-center p-4 md:p-6 min-h-screen relative overflow-hidden">
          <div className="max-w-md w-full bg-slate-900/85 backdrop-blur-xl p-8 md:p-10 rounded-2xl border border-slate-700/60 shadow-2xl relative z-10">
            <div className="flex justify-center mb-3">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 p-0.5 shadow-lg shadow-amber-500/20 flex items-center justify-center">
                <div className="w-full h-full bg-slate-900 rounded-[14px] flex items-center justify-center">
                  <Plane className="w-7 h-7 text-amber-400 rotate-45" />
                </div>
              </div>
            </div>

            <h1 className="text-2xl md:text-3xl font-extrabold tracking-widest text-amber-400 drop-shadow-md">
              US-BANGLA AIRLINES
            </h1>
            <h2 className="text-xs md:text-sm font-bold tracking-[0.25em] text-slate-300 uppercase mt-1">
              STATION DEPARTURE REPORT
            </h2>

            {/* Typewriter Animated Subtitle */}
            <div className="mt-3 mb-8 h-6 flex items-center justify-center">
              <TypewriterText text="INVENTION OF RADOAN RASEL" />
            </div>

            <div className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  USER NAME
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="ENTER USER NAME"
                    value={userInfo.userName}
                    onChange={(e) =>
                      setUserInfo({ ...userInfo, userName: e.target.value.toUpperCase() })
                    }
                    className="w-full pl-10 pr-3 py-3 rounded-xl bg-slate-800/90 text-white border border-slate-600 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 text-center font-bold tracking-wider text-sm transition-all placeholder:text-slate-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  USBA ID
                </label>
                <div className="relative">
                  <ShieldCheck className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="ENTER USBA ID (E.G. 10245)"
                    value={userInfo.usbaId}
                    onChange={(e) =>
                      setUserInfo({ ...userInfo, usbaId: e.target.value.toUpperCase() })
                    }
                    className="w-full pl-10 pr-3 py-3 rounded-xl bg-slate-800/90 text-white border border-slate-600 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 text-center font-bold tracking-wider text-sm transition-all placeholder:text-slate-500"
                  />
                </div>
              </div>

              {/* Station Dropdown */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  STATION
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400 pointer-events-none" />
                  <select
                    value={userInfo.stationName}
                    onChange={(e) => setUserInfo({ ...userInfo, stationName: e.target.value })}
                    className="w-full pl-10 pr-8 py-3 rounded-xl bg-slate-800/90 text-white border border-slate-600 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 text-center font-bold tracking-wider text-sm appearance-none transition-all cursor-pointer"
                  >
                    {STATION_OPTIONS.map((st) => (
                      <option key={st.code} value={st.code} className="bg-slate-900 text-white">
                        {st.name}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3.5 top-3.5 pointer-events-none text-slate-400 text-xs">
                    ▼
                  </div>
                </div>
              </div>

              <button
                onClick={handleEnterIdentification}
                className="w-full mt-6 py-3.5 px-6 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black tracking-widest text-sm md:text-base shadow-xl hover:shadow-amber-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer transform active:scale-[0.98]"
              >
                <span>ENTER</span>
                <Send className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800 text-[11px] text-slate-400 tracking-wider">
              OFFICIAL DEPARTURE LOGGING SYSTEM &bull; US-BANGLA AIRLINES
            </div>
          </div>
        </div>
      )}

      {/* ================= PAGE 2: WELCOME & CATEGORY SELECTION ================= */}
      {currentPage === 'welcome' && (
        <div className="flex-1 flex flex-col justify-center items-center text-center p-4 md:p-6 min-h-screen relative">
          <div className="max-w-lg w-full bg-slate-900/85 backdrop-blur-xl p-8 md:p-10 rounded-2xl border border-slate-700/60 shadow-2xl relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-300 text-xs font-mono mb-4 tracking-wider">
              <User className="w-3.5 h-3.5" />
              <span>USBA ID: USBA-{userInfo.usbaId} &bull; STATION: {userInfo.stationName}</span>
            </div>

            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-wide">
              WELCOME, <span className="text-amber-400">{userInfo.userName || 'OFFICER'}</span>!
            </h1>
            <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest">
              US-BANGLA AIRLINES FLIGHT OPERATIONS
            </p>

            <div className="my-6 border-t border-slate-800" />

            <h2 className="text-lg md:text-xl font-bold tracking-widest text-amber-300 mb-6 uppercase">
              MAKING FOR
            </h2>

            <div className="flex flex-col gap-4 max-w-sm mx-auto">
              <button
                onClick={() => goToDataPage('data-dom', 'dom')}
                className="py-4 px-6 rounded-xl bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-500 hover:to-blue-600 text-white font-extrabold tracking-widest shadow-lg hover:shadow-sky-600/30 hover:scale-[1.02] active:scale-[0.98] transition-all text-sm md:text-base border border-sky-400/30 flex items-center justify-center gap-3 cursor-pointer uppercase"
              >
                <Navigation className="w-5 h-5 text-sky-200" />
                <span>FLIGHT DATA</span>
              </button>

              <button
                onClick={() => setCurrentPage('mass-login')}
                className="py-4 px-6 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-indigo-500 hover:to-purple-600 text-white font-extrabold tracking-widest shadow-lg hover:shadow-purple-600/30 hover:scale-[1.02] active:scale-[0.98] transition-all text-sm md:text-base border border-purple-400/30 flex items-center justify-center gap-3 cursor-pointer uppercase"
              >
                <FileText className="w-5 h-5 text-purple-200" />
                <span>MASS FORM</span>
              </button>

              <button
                onClick={() => setCurrentPage('identification')}
                className="mt-4 py-2.5 px-6 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 font-semibold text-xs tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer w-fit mx-auto border border-slate-700"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>LOG OUT / PREVIOUS</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= PAGE 3A & 3B: DATA ENTRY (DOMESTIC / INTERNATIONAL) ================= */}
      {(currentPage === 'data-intl' || currentPage === 'data-dom') && (
        <div className="flex-1 p-4 md:p-8 min-h-screen flex flex-col items-center">
          <div className="max-w-5xl w-full bg-slate-900/90 backdrop-blur-xl border border-slate-700/70 shadow-2xl rounded-2xl p-5 md:p-8 my-auto text-slate-200">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-center pb-5 mb-6 border-b border-slate-800 gap-4">
              <div className="flex flex-col items-center sm:items-start">
                <h1 className="text-xl md:text-2xl font-bold tracking-wider text-amber-400 uppercase">
                  ENTER FLIGHT DATA
                </h1>

                {/* Typewriter Animated Subtitle */}
                <div className="mt-1 h-5 flex items-center">
                  <TypewriterText text="INVENTED BY RADOAN RASEL" />
                </div>

                {/* Modern & Attractive User & Station Status Bar */}
                <div className="mt-2.5 inline-flex flex-wrap items-center gap-2 bg-gradient-to-r from-slate-800/95 via-slate-800/80 to-slate-900/95 border border-slate-700/80 rounded-xl px-3.5 py-1.5 shadow-lg font-sans text-xs uppercase">
                  <span className="inline-flex items-center gap-1.5 text-slate-300 font-bold">
                    <span className="w-5 h-5 rounded-md bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400">
                      <User className="w-3 h-3" />
                    </span>
                    <span className="text-slate-400 tracking-wider">USER:</span>
                    <span className="font-black text-white tracking-wide">
                      {userInfo.userName || 'N/A'}
                    </span>
                  </span>

                  <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 border border-indigo-400/40 text-indigo-300 font-black tracking-wider text-[11px] flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-indigo-400" />
                    <span>USBA-{userInfo.usbaId}</span>
                  </span>

                  <span className="text-slate-600 font-bold">|</span>

                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-amber-500/20 border border-amber-400/40 text-amber-300 font-black tracking-wider">
                    <MapPin className="w-3 h-3 text-amber-400" />
                    <span>STATION: {userInfo.stationName}</span>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => populateSampleData(currentPage === 'data-intl' ? 'intl' : 'dom')}
                  className="px-3.5 py-1.5 text-xs rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-sans font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm"
                  title="Populate test data with standard flight parameters"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>SAMPLE DATA</span>
                </button>
              </div>
            </div>

            {/* Inputs Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs font-sans">
              {/* Date */}
              <div className="flex flex-col">
                <label className="font-bold text-slate-300 mb-1 tracking-wider">DATE</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="p-2.5 border border-slate-700 rounded-xl bg-slate-800/90 text-white focus:border-amber-400 focus:outline-none text-sm"
                />
              </div>

              {/* Flight No */}
              <div className="flex flex-col">
                <label className="font-bold text-slate-300 mb-1 tracking-wider">
                  FLIGHT NO (INPUT NUMBER ONLY, E.G. 142)
                </label>
                <div className="flex rounded-xl border border-slate-700 overflow-hidden bg-slate-800/90 focus-within:border-amber-400">
                  <span className="bg-slate-700/80 text-amber-400 px-3.5 py-2.5 font-bold text-sm">
                    BS-
                  </span>
                  <input
                    type="text"
                    placeholder="142"
                    value={formData.flightNoSuffix}
                    onChange={(e) => handleFlightNoChange(e.target.value)}
                    className="p-2.5 flex-1 bg-transparent text-white focus:outline-none text-sm font-bold tracking-wider"
                  />
                </div>
              </div>

              {/* Route */}
              <div className="flex flex-col">
                <label className="font-bold text-slate-300 mb-1 tracking-wider">
                  ROUTE (AUTO-SELECTED / EDITABLE)
                </label>
                <input
                  type="text"
                  placeholder="AUTO-SELECTED (E.G. CXB-DAC)"
                  value={formData.route}
                  onChange={(e) => setFormData({ ...formData, route: e.target.value.toUpperCase() })}
                  className="p-2.5 border border-slate-700 rounded-xl bg-slate-800/90 text-amber-300 focus:border-amber-400 focus:outline-none text-sm font-bold uppercase tracking-wider"
                />
              </div>

              {/* A/C REG */}
              <div className="flex flex-col">
                <label className="font-bold text-slate-300 mb-1 tracking-wider">
                  A/C REG (3-LETTER CODE ONLY, E.G. AKK, SXA, BBG)
                </label>
                <div className="flex rounded-xl border border-slate-700 overflow-hidden bg-slate-800/90 focus-within:border-amber-400">
                  <span className="bg-slate-700/80 text-slate-300 px-3 py-2.5 font-bold text-xs flex items-center">
                    {getRegistrationDetails(formData.acRegSuffix).prefix}
                  </span>
                  <input
                    type="text"
                    maxLength={3}
                    list="ac-reg-options"
                    placeholder="AKK"
                    value={formData.acRegSuffix}
                    onChange={(e) => handleRegChange(e.target.value)}
                    className="p-2.5 flex-1 bg-transparent text-white focus:outline-none text-sm font-bold uppercase tracking-widest text-center"
                  />
                  <datalist id="ac-reg-options">
                    {AC_REG_KEYS.map((k) => (
                      <option key={k} value={k}>
                        {AIRCRAFT_DATABASE[k].fullReg} &mdash; {AIRCRAFT_DATABASE[k].type} ({AIRCRAFT_DATABASE[k].seat} seats)
                      </option>
                    ))}
                  </datalist>
                </div>
              </div>

              {/* A/C TYPE */}
              <div className="flex flex-col">
                <label className="font-bold text-slate-300 mb-1 tracking-wider">A/C TYPE</label>
                <input
                  type="text"
                  value={formData.acType}
                  readOnly
                  placeholder="AUTO-DETECTED"
                  className="p-2.5 border border-slate-700/80 rounded-xl bg-slate-800/50 text-slate-300 text-sm font-bold cursor-not-allowed uppercase"
                />
              </div>

              {/* CAPTAIN */}
              <div className="flex flex-col">
                <label className="font-bold text-slate-300 mb-1 tracking-wider">CAPTAIN</label>
                <input
                  type="text"
                  list="captain-options"
                  placeholder="CAPTAIN NAME (E.G. AHMAD)"
                  value={formData.captain}
                  onChange={(e) => setFormData({ ...formData, captain: e.target.value.toUpperCase() })}
                  className="p-2.5 border border-slate-700 rounded-xl bg-slate-800/90 text-white focus:border-amber-400 focus:outline-none text-sm uppercase"
                />
                <datalist id="captain-options">
                  {CAPTAIN_SUGGESTIONS.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>

              {/* CONFIGURE / CREW COUNT */}
              <div className="flex flex-col">
                <label className="font-bold text-slate-300 mb-1 tracking-wider">
                  CONFIGURE / CREW COUNT
                </label>
                <input
                  type="text"
                  placeholder="2/5"
                  value={formData.configure}
                  onChange={(e) => setFormData({ ...formData, configure: e.target.value.toUpperCase() })}
                  className="p-2.5 border border-slate-700 rounded-xl bg-slate-800/90 text-white focus:border-amber-400 focus:outline-none text-sm uppercase"
                />
              </div>

              {/* OUTSTATION ONLY: ARRIVAL INFORMATION BORDERED SECTION */}
              {isOutstation && (
                <div className="md:col-span-full border-2 border-emerald-500/70 bg-emerald-950/20 rounded-2xl p-4 md:p-5 shadow-xl">
                  <div className="flex items-center gap-2 mb-3.5 pb-2 border-b border-emerald-500/30">
                    <span className="w-6 h-6 rounded-lg bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center text-emerald-400">
                      <Plane className="w-3.5 h-3.5 rotate-90" />
                    </span>
                    <h3 className="text-sm md:text-base font-black tracking-widest text-emerald-400 uppercase">
                      ARRIVAL INFORMATION
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* 1ST BOX: STA (LT) */}
                    <div className="flex flex-col">
                      <label className="font-bold text-emerald-300 mb-1 tracking-wider uppercase">
                        STA (LT)
                      </label>
                      <input
                        type="text"
                        placeholder="1000"
                        maxLength={4}
                        value={formData.sta || ''}
                        onChange={(e) => handleTimeInput('sta', e.target.value)}
                        className="p-2.5 border border-emerald-600/60 rounded-xl bg-slate-800/90 text-white focus:border-emerald-400 focus:outline-none text-sm font-mono text-center tracking-wider font-bold"
                      />
                    </div>

                    {/* 2ND BOX: C/ON (LT) */}
                    <div className="flex flex-col">
                      <label className="font-bold text-emerald-300 mb-1 tracking-wider uppercase">
                        C/ON (LT)
                      </label>
                      <input
                        type="text"
                        placeholder="0950"
                        maxLength={4}
                        value={formData.chocksOn || ''}
                        onChange={(e) => handleTimeInput('chocksOn', e.target.value)}
                        className="p-2.5 border border-emerald-600/60 rounded-xl bg-slate-800/90 text-white focus:border-emerald-400 focus:outline-none text-sm font-mono text-center tracking-wider font-bold"
                      />
                    </div>

                    {/* 3RD BOX: DOOR OPEN (LT) */}
                    <div className="flex flex-col">
                      <label className="font-bold text-emerald-300 mb-1 tracking-wider uppercase">
                        DOOR OPEN (LT)
                      </label>
                      <input
                        type="text"
                        placeholder="0952"
                        maxLength={4}
                        value={formData.doorOpen || ''}
                        onChange={(e) => handleTimeInput('doorOpen', e.target.value)}
                        className="p-2.5 border border-emerald-600/60 rounded-xl bg-slate-800/90 text-white focus:border-emerald-400 focus:outline-none text-sm font-mono text-center tracking-wider font-bold"
                      />
                    </div>

                    {/* 4TH BOX: ARRIVAL STATUS */}
                    <div className="flex flex-col">
                      <label className="font-bold text-emerald-300 mb-1 tracking-wider uppercase">
                        ARRIVAL STATUS
                      </label>
                      <input
                        type="text"
                        value={formData.arrivalStatus || 'FLIGHT ON TIME ARRIVED'}
                        onChange={(e) =>
                          setFormData({ ...formData, arrivalStatus: e.target.value.toUpperCase() })
                        }
                        className="p-2.5 border border-emerald-500/70 rounded-xl bg-slate-800 text-emerald-300 font-bold text-sm tracking-wide uppercase"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* DEPARTURE INFORMATION (Bordered section for Outstation, seamless grid for DAC) */}
              <div
                className={
                  isOutstation
                    ? 'md:col-span-full border-2 border-sky-500/70 bg-sky-950/20 rounded-2xl p-4 md:p-5 shadow-xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
                    : 'contents'
                }
              >
                {isOutstation && (
                  <div className="col-span-full flex items-center gap-2 mb-1 pb-2 border-b border-sky-500/30">
                    <span className="w-6 h-6 rounded-lg bg-sky-500/20 border border-sky-400/50 flex items-center justify-center text-sky-400">
                      <Plane className="w-3.5 h-3.5" />
                    </span>
                    <h3 className="text-sm md:text-base font-black tracking-widest text-sky-400 uppercase">
                      DEPARTURE INFORMATION
                    </h3>
                  </div>
                )}

              {/* STD */}
              <div className="flex flex-col">
                <label className="font-bold text-slate-300 mb-1 tracking-wider">STD (LT)</label>
                <input
                  type="text"
                  placeholder="1000"
                  maxLength={4}
                  value={formData.std}
                  onChange={(e) => handleTimeInput('std', e.target.value)}
                  className="p-2.5 border border-slate-700 rounded-xl bg-slate-800/90 text-white focus:border-amber-400 focus:outline-none text-sm font-mono text-center tracking-wider font-bold"
                />
              </div>

              {/* DOOR CLOSED */}
              <div className="flex flex-col">
                <label className="font-bold text-slate-300 mb-1 tracking-wider">DOOR CLOSED (LT)</label>
                <input
                  type="text"
                  placeholder="0958"
                  maxLength={4}
                  value={formData.doorClosed}
                  onChange={(e) => handleTimeInput('doorClosed', e.target.value)}
                  className="p-2.5 border border-slate-700 rounded-xl bg-slate-800/90 text-white focus:border-amber-400 focus:outline-none text-sm font-mono text-center tracking-wider font-bold"
                />
              </div>

              {/* CHOCKS OFF */}
              <div className="flex flex-col">
                <label className="font-bold text-slate-300 mb-1 tracking-wider">CHOCKS OFF (LT)</label>
                <input
                  type="text"
                  placeholder="0959"
                  maxLength={4}
                  value={formData.chocksOff}
                  onChange={(e) => handleTimeInput('chocksOff', e.target.value)}
                  className="p-2.5 border border-slate-700 rounded-xl bg-slate-800/90 text-white focus:border-amber-400 focus:outline-none text-sm font-mono text-center tracking-wider font-bold"
                />
              </div>

              {/* GROUND TIME (Outstation Only - Auto Calculated from Arrival C/ON to Departure C/OFF, Not Editable) */}
              {isOutstation && (
                <div className="flex flex-col">
                  <label className="font-bold text-sky-300 mb-1 tracking-wider uppercase">
                    GROUND TIME
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={calculateGroundTime(formData.chocksOn, formData.chocksOff)}
                    className="p-2.5 border border-sky-500/70 rounded-xl bg-slate-900/95 text-sky-300 text-sm font-mono text-center tracking-wider font-black cursor-not-allowed select-none"
                  />
                </div>
              )}

              {/* AIRBORNE */}
              <div className="flex flex-col">
                <label className="font-bold text-slate-300 mb-1 tracking-wider">AIRBORNE (LT)</label>
                <input
                  type="text"
                  placeholder="1010"
                  maxLength={4}
                  value={formData.airborne}
                  onChange={(e) => handleTimeInput('airborne', e.target.value)}
                  className="p-2.5 border border-slate-700 rounded-xl bg-slate-800/90 text-white focus:border-amber-400 focus:outline-none text-sm font-mono text-center tracking-wider font-bold"
                />
              </div>

              {/* DEPARTURE STATUS */}
              <div className="flex flex-col">
                <label className="font-bold text-slate-300 mb-1 tracking-wider">
                  DEPARTURE STATUS (CALCULATED)
                </label>
                <input
                  type="text"
                  value={formData.departureStatus}
                  onChange={(e) => setFormData({ ...formData, departureStatus: e.target.value.toUpperCase() })}
                  className="p-2.5 border border-slate-700 rounded-xl bg-slate-800 text-amber-300 font-bold text-sm tracking-wide uppercase"
                />
              </div>

              {/* CONDITIONAL DELAY REASON BOX (If Flight Delayed) */}
              {showDelayBox && (
                <div className="flex flex-col md:col-span-full bg-amber-500/15 border-2 border-amber-500/60 p-4 rounded-xl animate-fadeIn shadow-lg">
                  <div className="flex items-center gap-2 mb-2 text-amber-300 font-black text-xs uppercase tracking-wider">
                    <AlertTriangle className="w-4 h-4 text-amber-400 animate-pulse" />
                    <span>FLIGHT DELAY DETECTED &mdash; ENTER DELAY REASON (REQUIRED)</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      ref={delayReasonInputRef}
                      type="text"
                      list="delay-reason-options"
                      placeholder="E.G. LAST PAX ACCEPTANCE, LATE INBOUND AIRCRAFT, ATC CLEARANCE"
                      value={formData.delayReason || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, delayReason: e.target.value.toUpperCase() })
                      }
                      className="p-2.5 flex-1 border-2 border-amber-500 rounded-xl bg-slate-800 text-white text-sm font-bold uppercase focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder:text-slate-400"
                    />
                    <datalist id="delay-reason-options">
                      {COMMON_DELAY_REASONS.map((r) => (
                        <option key={r} value={r} />
                      ))}
                    </datalist>
                  </div>
                </div>
              )}

              {/* FLIGHT LOAD (BOOKED) */}
              <div className="flex flex-col">
                <label className="font-bold text-slate-300 mb-1 tracking-wider">FLIGHT LOAD</label>
                <input
                  type="number"
                  placeholder="Booked Pax Figure"
                  value={formData.flightLoad}
                  onFocus={validateDelayReason}
                  onChange={(e) => setFormData({ ...formData, flightLoad: e.target.value })}
                  className="p-2.5 border border-slate-700 rounded-xl bg-slate-800/90 text-white focus:border-amber-400 focus:outline-none text-sm"
                />
              </div>

              {/* PASSENGERS (M + F + C + I = TOTAL) */}
              <div className="flex flex-col md:col-span-2">
                <label className="font-bold text-slate-300 mb-1 tracking-wider">
                  PASSENGERS (M + F + C + I = TOTAL)
                </label>
                <div className="flex items-center gap-1.5 bg-slate-800/90 p-1.5 border border-slate-700 rounded-xl">
                  <input
                    type="number"
                    placeholder="M"
                    value={formData.paxMale}
                    onFocus={validateDelayReason}
                    onChange={(e) => setFormData({ ...formData, paxMale: e.target.value })}
                    className="w-16 p-2 border border-slate-600 rounded-lg text-center text-sm font-bold bg-slate-900 text-white focus:outline-none"
                  />
                  <span className="font-bold text-slate-400">+</span>
                  <input
                    type="number"
                    placeholder="F"
                    value={formData.paxFemale}
                    onFocus={validateDelayReason}
                    onChange={(e) => setFormData({ ...formData, paxFemale: e.target.value })}
                    className="w-16 p-2 border border-slate-600 rounded-lg text-center text-sm font-bold bg-slate-900 text-white focus:outline-none"
                  />
                  <span className="font-bold text-slate-400">+</span>
                  <input
                    type="number"
                    placeholder="C"
                    value={formData.paxChild}
                    onFocus={validateDelayReason}
                    onChange={(e) => setFormData({ ...formData, paxChild: e.target.value })}
                    className="w-16 p-2 border border-slate-600 rounded-lg text-center text-sm font-bold bg-slate-900 text-white focus:outline-none"
                  />
                  <span className="font-bold text-slate-400">+</span>
                  <input
                    type="number"
                    placeholder="I"
                    value={formData.paxInfant}
                    onFocus={validateDelayReason}
                    onChange={(e) => setFormData({ ...formData, paxInfant: e.target.value })}
                    className="w-16 p-2 border border-slate-600 rounded-lg text-center text-sm font-bold bg-slate-900 text-white focus:outline-none"
                  />
                  <span className="font-bold text-slate-400">=</span>
                  <input
                    type="text"
                    placeholder="TOTAL"
                    value={formData.paxTotal}
                    readOnly
                    className="flex-1 p-2 border border-amber-500/50 rounded-lg text-center text-sm font-black bg-amber-500/20 text-amber-300"
                  />
                </div>
              </div>

              {/* FUEL UPLIFT */}
              <div className="flex flex-col">
                <label className="font-bold text-slate-300 mb-1 tracking-wider">FUEL UPLIFT</label>
                <div className="flex rounded-xl border border-slate-700 overflow-hidden bg-slate-800/90 focus-within:border-amber-400">
                  <input
                    type="number"
                    placeholder="5000"
                    value={formData.fuelUplift}
                    onFocus={validateDelayReason}
                    onChange={(e) => setFormData({ ...formData, fuelUplift: e.target.value })}
                    className="p-2.5 flex-1 bg-transparent text-white focus:outline-none text-sm"
                  />
                  <span className="bg-slate-700/80 text-amber-300 px-3 py-2 font-bold text-xs flex items-center">
                    KG
                  </span>
                </div>
              </div>

              {/* BAGGAGE */}
              <div className="flex flex-col">
                <label className="font-bold text-slate-300 mb-1 tracking-wider">BAGGAGE</label>
                <div className="flex gap-1.5">
                  <input
                    type="number"
                    placeholder="Weight (KG)"
                    value={formData.baggageWeight}
                    onChange={(e) => setFormData({ ...formData, baggageWeight: e.target.value })}
                    className="p-2.5 flex-1 border border-slate-700 rounded-xl bg-slate-800/90 text-white focus:border-amber-400 focus:outline-none text-sm"
                  />
                  <input
                    type="number"
                    placeholder="PCS"
                    value={formData.baggagePcs}
                    onChange={(e) => setFormData({ ...formData, baggagePcs: e.target.value })}
                    className="p-2.5 w-20 border border-slate-700 rounded-xl bg-slate-800/90 text-white focus:border-amber-400 focus:outline-none text-sm text-center"
                  />
                </div>
              </div>

              {/* CARGO */}
              <div className="flex flex-col">
                <label className="font-bold text-slate-300 mb-1 tracking-wider">CARGO</label>
                <div className="flex gap-1.5">
                  <input
                    type="number"
                    placeholder="Weight (KG)"
                    value={formData.cargoWeight}
                    onChange={(e) => setFormData({ ...formData, cargoWeight: e.target.value })}
                    className="p-2.5 flex-1 border border-slate-700 rounded-xl bg-slate-800/90 text-white focus:border-amber-400 focus:outline-none text-sm"
                  />
                  <input
                    type="number"
                    placeholder="PCS"
                    value={formData.cargoPcs}
                    onChange={(e) => setFormData({ ...formData, cargoPcs: e.target.value })}
                    className="p-2.5 w-20 border border-slate-700 rounded-xl bg-slate-800/90 text-white focus:border-amber-400 focus:outline-none text-sm text-center"
                  />
                </div>
              </div>

              {/* CREW BAG (Only in Intl) */}
              {currentPage === 'data-intl' && (
                <div className="flex flex-col">
                  <label className="font-bold text-slate-300 mb-1 tracking-wider">CREW BAG</label>
                  <div className="flex gap-1.5">
                    <input
                      type="number"
                      placeholder="Weight"
                      value={formData.crewBagWeight || ''}
                      onChange={(e) => setFormData({ ...formData, crewBagWeight: e.target.value })}
                      className="p-2.5 flex-1 border border-slate-700 rounded-xl bg-slate-800/90 text-white text-sm"
                    />
                    <input
                      type="number"
                      placeholder="PCS"
                      value={formData.crewBagPcs || ''}
                      onChange={(e) => setFormData({ ...formData, crewBagPcs: e.target.value })}
                      className="p-2.5 w-16 border border-slate-700 rounded-xl bg-slate-800/90 text-white text-sm text-center"
                    />
                    <input
                      type="text"
                      placeholder="COM"
                      value={formData.crewBagComNo || ''}
                      onChange={(e) => setFormData({ ...formData, crewBagComNo: e.target.value.toUpperCase() })}
                      className="p-2.5 w-20 border border-slate-700 rounded-xl bg-slate-800/90 text-white text-sm text-center uppercase"
                    />
                  </div>
                </div>
              )}

              {/* MAIL */}
              <div className="flex flex-col">
                <label className="font-bold text-slate-300 mb-1 tracking-wider">MAIL</label>
                <input
                  type="text"
                  placeholder="E.G. 01 (TO CREW) OR 2 PCS"
                  value={formData.mail}
                  onChange={(e) => setFormData({ ...formData, mail: e.target.value })}
                  className="p-2.5 border border-slate-700 rounded-xl bg-slate-800/90 text-white focus:border-amber-400 focus:outline-none text-sm uppercase"
                />
              </div>

              {/* GATE NO SHOW */}
              <div className="flex flex-col">
                <label className="font-bold text-slate-300 mb-1 tracking-wider">GATE NO SHOW</label>
                <input
                  type="number"
                  placeholder="Pax Figure"
                  value={formData.gateNoShow}
                  onChange={(e) => setFormData({ ...formData, gateNoShow: e.target.value })}
                  className="p-2.5 border border-slate-700 rounded-xl bg-slate-800/90 text-white focus:border-amber-400 focus:outline-none text-sm"
                />
              </div>

              {/* SELF OFFLOAD */}
              <div className="flex flex-col">
                <label className="font-bold text-slate-300 mb-1 tracking-wider">SELF OFFLOAD</label>
                <input
                  type="number"
                  placeholder="Pax Figure"
                  value={formData.selfOffload}
                  onChange={(e) => setFormData({ ...formData, selfOffload: e.target.value })}
                  className="p-2.5 border border-slate-700 rounded-xl bg-slate-800/90 text-white focus:border-amber-400 focus:outline-none text-sm"
                />
              </div>

              {/* INTL Specific Offloads */}
              {currentPage === 'data-intl' && (
                <>
                  <div className="flex flex-col">
                    <label className="font-bold text-slate-300 mb-1 tracking-wider">REFUSED</label>
                    <input
                      type="number"
                      placeholder="Pax Figure"
                      value={formData.refused || ''}
                      onChange={(e) => setFormData({ ...formData, refused: e.target.value })}
                      className="p-2.5 border border-slate-700 rounded-xl bg-slate-800/90 text-white text-sm"
                    />
                  </div>

                  <div className="flex flex-col">
                    <label className="font-bold text-slate-300 mb-1 tracking-wider">IMMIGRATION OFF</label>
                    <input
                      type="number"
                      placeholder="Pax Figure"
                      value={formData.immigrationOff || ''}
                      onChange={(e) => setFormData({ ...formData, immigrationOff: e.target.value })}
                      className="p-2.5 border border-slate-700 rounded-xl bg-slate-800/90 text-white text-sm"
                    />
                  </div>

                  <div className="flex flex-col">
                    <label className="font-bold text-slate-300 mb-1 tracking-wider">IMMIGRATION NOT FACE</label>
                    <input
                      type="number"
                      placeholder="Pax Figure"
                      value={formData.immigrationNotFace || ''}
                      onChange={(e) => setFormData({ ...formData, immigrationNotFace: e.target.value })}
                      className="p-2.5 border border-slate-700 rounded-xl bg-slate-800/90 text-white text-sm"
                    />
                  </div>

                  <div className="flex flex-col">
                    <label className="font-bold text-slate-300 mb-1 tracking-wider">CUSTOM OFF</label>
                    <input
                      type="number"
                      placeholder="Pax Figure"
                      value={formData.customOff || ''}
                      onChange={(e) => setFormData({ ...formData, customOff: e.target.value })}
                      className="p-2.5 border border-slate-700 rounded-xl bg-slate-800/90 text-white text-sm"
                    />
                  </div>
                </>
              )}

              {/* VIP & CIP */}
              <div className="flex flex-col">
                <label className="font-bold text-slate-300 mb-1 tracking-wider">VIP</label>
                <input
                  type="number"
                  placeholder="Pax Figure"
                  value={formData.vip}
                  onChange={(e) => setFormData({ ...formData, vip: e.target.value })}
                  className="p-2.5 border border-slate-700 rounded-xl bg-slate-800/90 text-white focus:border-amber-400 focus:outline-none text-sm"
                />
              </div>

              <div className="flex flex-col">
                <label className="font-bold text-slate-300 mb-1 tracking-wider">CIP</label>
                <input
                  type="number"
                  placeholder="Pax Figure"
                  value={formData.cip}
                  onChange={(e) => setFormData({ ...formData, cip: e.target.value })}
                  className="p-2.5 border border-slate-700 rounded-xl bg-slate-800/90 text-white focus:border-amber-400 focus:outline-none text-sm"
                />
              </div>

              {/* MAAS */}
              <div className="flex flex-col">
                <label className="font-bold text-slate-300 mb-1 tracking-wider">MAAS</label>
                <input
                  type="number"
                  placeholder="Pax Figure"
                  value={formData.maas}
                  onChange={(e) => setFormData({ ...formData, maas: e.target.value })}
                  className="p-2.5 border border-slate-700 rounded-xl bg-slate-800/90 text-white focus:border-amber-400 focus:outline-none text-sm"
                />
              </div>

              {/* UM PAX */}
              <div
                className="flex flex-col"
                onBlur={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    const num = parseInt(formData.umPax, 10);
                    if (!isNaN(num) && num > 0 && isZeroOrEmptyVal(formData.umPaxSeat)) {
                      setSeatWarningTarget('umPax');
                    }
                  }
                }}
              >
                <label className="font-bold text-slate-300 mb-1 tracking-wider uppercase">UM PAX</label>
                <div className="flex gap-1.5">
                  <input
                    type="number"
                    placeholder="UM Fig"
                    value={formData.umPax}
                    onChange={(e) => setFormData({ ...formData, umPax: e.target.value })}
                    className="w-24 p-2.5 border border-slate-700 rounded-xl bg-slate-800/90 text-white focus:border-amber-400 focus:outline-none text-sm text-center"
                  />
                  <input
                    ref={umPaxSeatInputRef}
                    type="text"
                    placeholder="Seat No (E.G. 4A)"
                    value={formData.umPaxSeat || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, umPaxSeat: e.target.value.toUpperCase() })
                    }
                    className={`flex-1 p-2.5 border rounded-xl bg-slate-800/90 text-white focus:outline-none text-sm uppercase ${
                      parseInt(formData.umPax, 10) > 0 && isZeroOrEmptyVal(formData.umPaxSeat)
                        ? 'border-rose-500 focus:border-rose-400'
                        : 'border-slate-700 focus:border-amber-400'
                    }`}
                  />
                </div>
              </div>

              {/* FIRE ARMS */}
              <div
                className="flex flex-col"
                onBlur={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    const num = parseInt(formData.fireArms, 10);
                    const hasFa = (!isNaN(num) && num > 0) || !isZeroOrEmptyVal(formData.fireArms);
                    if (hasFa && isZeroOrEmptyVal(formData.fireArmsSeat)) {
                      setSeatWarningTarget('fireArms');
                    }
                  }
                }}
              >
                <label className="font-bold text-amber-300 mb-1 tracking-wider uppercase">
                  FIRE ARMS
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="number"
                    placeholder="FA Fig"
                    value={formData.fireArms}
                    onChange={(e) => setFormData({ ...formData, fireArms: e.target.value })}
                    className="w-24 p-2.5 border border-amber-500/50 rounded-xl bg-slate-800/90 text-white focus:border-amber-400 focus:outline-none text-sm text-center uppercase"
                  />
                  <input
                    ref={fireArmsSeatInputRef}
                    type="text"
                    placeholder="Seat No (E.G. 5B)"
                    value={formData.fireArmsSeat || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, fireArmsSeat: e.target.value.toUpperCase() })
                    }
                    className={`flex-1 p-2.5 border rounded-xl bg-slate-800/90 text-white focus:outline-none text-sm uppercase ${
                      !isZeroOrEmptyVal(formData.fireArms) && isZeroOrEmptyVal(formData.fireArmsSeat)
                        ? 'border-rose-500 focus:border-rose-400'
                        : 'border-amber-500/50 focus:border-amber-400'
                    }`}
                  />
                </div>
              </div>

              {/* WCHR */}
              <div
                className="flex flex-col"
                onBlur={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    const num = parseInt(formData.wchrFig, 10);
                    if (!isNaN(num) && num > 0 && isZeroOrEmptyVal(formData.wchrSeat)) {
                      setSeatWarningTarget('wchr');
                    }
                  }
                }}
              >
                <label className="font-bold text-slate-300 mb-1 tracking-wider uppercase">
                  WCHR
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="number"
                    placeholder="WCHR Fig"
                    value={formData.wchrFig}
                    onChange={(e) => setFormData({ ...formData, wchrFig: e.target.value })}
                    className="w-24 p-2.5 border border-slate-700 rounded-xl bg-slate-800/90 text-white focus:border-amber-400 focus:outline-none text-sm text-center"
                  />
                  <input
                    ref={wchrSeatInputRef}
                    type="text"
                    placeholder="Seat No (E.G. 2A, 3A)"
                    value={formData.wchrSeat}
                    onChange={(e) => setFormData({ ...formData, wchrSeat: e.target.value.toUpperCase() })}
                    className={`flex-1 p-2.5 border rounded-xl bg-slate-800/90 text-white focus:outline-none text-sm uppercase ${
                      parseInt(formData.wchrFig, 10) > 0 && isZeroOrEmptyVal(formData.wchrSeat)
                        ? 'border-rose-500 focus:border-rose-400'
                        : 'border-slate-700 focus:border-amber-400'
                    }`}
                  />
                </div>
              </div>

              {/* WCHC */}
              <div
                className="flex flex-col"
                onBlur={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    const num = parseInt(formData.wchcFig, 10);
                    if (!isNaN(num) && num > 0 && isZeroOrEmptyVal(formData.wchcSeat)) {
                      setSeatWarningTarget('wchc');
                    }
                  }
                }}
              >
                <label className="font-bold text-slate-300 mb-1 tracking-wider uppercase">
                  WCHC
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="number"
                    placeholder="WCHC Fig"
                    value={formData.wchcFig}
                    onChange={(e) => setFormData({ ...formData, wchcFig: e.target.value })}
                    className="w-24 p-2.5 border border-slate-700 rounded-xl bg-slate-800/90 text-white focus:border-amber-400 focus:outline-none text-sm text-center"
                  />
                  <input
                    ref={wchcSeatInputRef}
                    type="text"
                    placeholder="Seat No (E.G. 2A)"
                    value={formData.wchcSeat}
                    onChange={(e) => setFormData({ ...formData, wchcSeat: e.target.value.toUpperCase() })}
                    className={`flex-1 p-2.5 border rounded-xl bg-slate-800/90 text-white focus:outline-none text-sm uppercase ${
                      parseInt(formData.wchcFig, 10) > 0 && isZeroOrEmptyVal(formData.wchcSeat)
                        ? 'border-rose-500 focus:border-rose-400'
                        : 'border-slate-700 focus:border-amber-400'
                    }`}
                  />
                </div>
              </div>

              {/* CHECK IN STAFF */}
              <div className="flex flex-col">
                <label className="font-bold text-slate-300 mb-1 tracking-wider uppercase">CHECK IN STAFF</label>
                <input
                  type="text"
                  placeholder="ENTER CHECK IN STAFF"
                  value={formData.checkInStaff || formData.checkInStuff || ''}
                  onChange={(e) => {
                    const upper = e.target.value.toUpperCase();
                    setFormData({ ...formData, checkInStaff: upper, checkInStuff: upper });
                  }}
                  className="p-2.5 border border-slate-700 rounded-xl bg-slate-800/90 text-white focus:border-amber-400 focus:outline-none text-sm uppercase"
                />
              </div>

              {/* RAMP OFFICER */}
              <div className="flex flex-col">
                <label className="font-bold text-slate-300 mb-1 tracking-wider uppercase">RAMP OFFICER</label>
                <input
                  type="text"
                  placeholder="ENTER RAMP OFFICER"
                  value={formData.rampOfficer || formData.loadingStuff || ''}
                  onChange={(e) => {
                    const upper = e.target.value.toUpperCase();
                    setFormData({ ...formData, rampOfficer: upper, loadingStuff: upper });
                  }}
                  className="p-2.5 border border-slate-700 rounded-xl bg-slate-800/90 text-white focus:border-amber-400 focus:outline-none text-sm uppercase"
                />
              </div>

              {/* LOAD CONTROLLER */}
              <div className="flex flex-col">
                <label className="font-bold text-slate-300 mb-1 tracking-wider uppercase">LOAD CONTROLLER</label>
                <input
                  type="text"
                  placeholder="ENTER LOAD CONTROLLER"
                  value={formData.loadController}
                  onChange={(e) => setFormData({ ...formData, loadController: e.target.value.toUpperCase() })}
                  className="p-2.5 border border-slate-700 rounded-xl bg-slate-800/90 text-white focus:border-amber-400 focus:outline-none text-sm uppercase"
                />
              </div>

              {/* PAX HANDLING */}
              <div className="flex flex-col">
                <label className="font-bold text-slate-300 mb-1 tracking-wider uppercase">PAX HANDLING</label>
                <input
                  type="text"
                  placeholder="NORMAL / REMARKS"
                  value={formData.paxHandling}
                  onChange={(e) => setFormData({ ...formData, paxHandling: e.target.value.toUpperCase() })}
                  className="p-2.5 border border-slate-700 rounded-xl bg-slate-800/90 text-white focus:border-amber-400 focus:outline-none text-sm uppercase"
                />
              </div>

              {/* NOSHOW FIGURE (COUNTER) (BEFORE NOSHOW PNR) */}
              <div className="flex flex-col">
                <label className="font-bold text-rose-400 mb-1 tracking-wider uppercase">
                  NOSHOW FIGURE (COUNTER)
                </label>
                <input
                  ref={counterNoshowInputRef}
                  type="text"
                  inputMode="numeric"
                  maxLength={2}
                  placeholder="ONLY DIGIT"
                  value={formData.counterNoshow}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 2);
                    setFormData({ ...formData, counterNoshow: digits });
                  }}
                  onBlur={(e) => {
                    const val = formData.counterNoshow.trim();
                    const num = parseInt(val, 10);
                    if (val === '') {
                      setShowCounterNoshowModal(true);
                    } else if (
                      !isNaN(num) &&
                      num >= 1 &&
                      e.relatedTarget !== noshowPnrInputRef.current &&
                      !isValidNoshowPnr(formData.noshowPnr)
                    ) {
                      setShowNoshowPnrWarningModal(true);
                    }
                  }}
                  className="p-2.5 border border-rose-500/70 rounded-xl bg-slate-800/90 text-rose-300 font-black focus:border-rose-400 focus:outline-none text-sm uppercase"
                />
              </div>

              {/* NOSHOW PNR (IN RED COLOR) */}
              <div className="flex flex-col">
                <label className="font-black text-red-500 mb-1 tracking-wider uppercase">
                  NOSHOW PNR *
                </label>
                <input
                  ref={noshowPnrInputRef}
                  type="text"
                  placeholder="6-DIGIT PNR (E.G. 024UGD, 03ERUF)"
                  value={formData.noshowPnr || ''}
                  onFocus={() => {
                    if (formData.counterNoshow.trim() === '') {
                      setShowCounterNoshowModal(true);
                    }
                  }}
                  onChange={(e) => {
                    const upper = e.target.value.toUpperCase();
                    setFormData({ ...formData, noshowPnr: upper });
                    if (
                      parseInt(formData.counterNoshow, 10) >= 1 &&
                      (upper.trim() === '0' || upper.trim() === '00')
                    ) {
                      setShowNoshowPnrWarningModal(true);
                    }
                  }}
                  onBlur={(e) => {
                    const counterNum = parseInt(formData.counterNoshow, 10);
                    if (
                      !isNaN(counterNum) &&
                      counterNum >= 1 &&
                      e.relatedTarget !== counterNoshowInputRef.current &&
                      !isValidNoshowPnr(formData.noshowPnr)
                    ) {
                      setShowNoshowPnrWarningModal(true);
                    }
                  }}
                  className="p-2.5 border-2 border-red-500/80 rounded-xl bg-slate-800/90 text-red-400 placeholder:text-red-400/45 focus:border-red-400 focus:outline-none text-sm uppercase font-black"
                />
              </div>
              </div>

              {/* REMARKS */}
              <div className="flex flex-col md:col-span-full">
                <label className="font-bold text-slate-300 mb-1 tracking-wider uppercase">REMARKS</label>
                <textarea
                  rows={2}
                  placeholder="ENTER OPERATIONAL REMARKS (E.G. GOT DELAY DUE TO ATC CLEARANCE)"
                  value={formData.remarks}
                  onFocus={() => {
                    if (formData.counterNoshow.trim() === '') {
                      setShowCounterNoshowModal(true);
                      return;
                    }
                    const counterNum = parseInt(formData.counterNoshow, 10);
                    if (!isNaN(counterNum) && counterNum >= 1 && !isValidNoshowPnr(formData.noshowPnr)) {
                      setShowNoshowPnrWarningModal(true);
                    }
                  }}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value.toUpperCase() })}
                  className="p-2.5 border border-slate-700 rounded-xl bg-slate-800/90 text-white focus:border-amber-400 focus:outline-none text-sm uppercase"
                />
              </div>

              {/* VIP/MAAS/WCHR MESSAGE ( COPY FROM FLST-IF HAVE) */}
              <div className="flex flex-col md:col-span-full">
                <label className="font-bold text-amber-300 mb-1 tracking-wider uppercase">
                  VIP/MAAS/WCHR MESSAGE ( COPY FROM FLST-IF HAVE)
                </label>
                <textarea
                  rows={4}
                  placeholder="PASTE VIP / MAAS / WCHR PASSENGER LIST COPIED FROM FLIGHT DCS (FLST) SYSTEM HERE..."
                  value={formData.flstRawMessage || ''}
                  onFocus={() => {
                    if (formData.counterNoshow.trim() === '') {
                      setShowCounterNoshowModal(true);
                      return;
                    }
                    const counterNum = parseInt(formData.counterNoshow, 10);
                    if (!isNaN(counterNum) && counterNum >= 1 && !isValidNoshowPnr(formData.noshowPnr)) {
                      setShowNoshowPnrWarningModal(true);
                    }
                  }}
                  onChange={(e) => setFormData({ ...formData, flstRawMessage: e.target.value })}
                  className="p-3 border border-amber-500/50 rounded-xl bg-slate-800/90 text-white focus:border-amber-400 focus:outline-none text-xs md:text-sm font-mono leading-relaxed"
                />
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex flex-col sm:flex-row justify-between items-center mt-8 pt-4 border-t border-slate-800 gap-4">
              <button
                type="button"
                onClick={() => setCurrentPage('welcome')}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm border border-slate-700"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>PREVIOUS</span>
              </button>

              <button
                type="button"
                onClick={() => handleGenerateReport(currentPage === 'data-intl' ? 'intl' : 'dom')}
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold tracking-wider text-sm shadow-xl hover:shadow-blue-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>GENERATE FINAL REPORT</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= PAGE 4: DUAL REPORT VIEW ================= */}
      {currentPage === 'dual-report' && (
        <div className="print-page-wrapper flex-1 p-3 md:p-6 min-h-screen flex flex-col">
          {/* Header Bar */}
          <div className="no-print max-w-7xl mx-auto w-full flex flex-col md:flex-row justify-between items-center mb-4 bg-slate-900/90 backdrop-blur-md p-4 rounded-2xl border border-slate-700/70 shadow-xl gap-3">
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-wider text-white uppercase flex items-center gap-2">
                <Plane className="w-5 h-5 text-amber-400" />
                <span>US-BANGLA AIRLINES &mdash; FLIGHT REPORTS</span>
              </h1>
              <p className="text-xs text-slate-400 font-sans mt-0.5">
                FLIGHT: <span className="font-bold text-amber-300">BS-{formData.flightNoSuffix || 'XXX'}</span> ({formData.route || 'N/A'}) &bull; PREPARED BY: {userInfo.userName} &bull; STATION: {userInfo.stationName}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setCurrentPage(lastDataPage)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all shadow-sm border border-slate-700"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>BACK TO FORM</span>
              </button>

              <button
                onClick={() => copyToClipboard(departureMessage, 'Flight Departure Text Message')}
                className="px-4 py-2 rounded-xl bg-sky-700/80 hover:bg-sky-600 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>COPY TEXT</span>
              </button>

              <button
                onClick={() => printSection('right')}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>PRINT REPORT (A4)</span>
              </button>

              <button
                onClick={() => setShowNewReportModal(true)}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all shadow-sm uppercase"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>NEW REPORT</span>
              </button>

              <button
                onClick={handleLogout}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-red-900/60 text-slate-300 hover:text-red-200 border border-slate-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all shadow-sm uppercase"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>LOG OUT</span>
              </button>
            </div>
          </div>

          {/* Dual Panels Layout */}
          <div className="print-dual-container max-w-7xl mx-auto w-full flex-1 flex flex-col gap-6">
            {/* Panel 1: HD PHOTO CARD (Replacing Departure Message, with JPG Download) */}
            <div
              id="left-report-printable"
              className="no-print bg-slate-900/80 backdrop-blur-xl border border-slate-700/70 rounded-2xl p-5 shadow-2xl flex flex-col"
            >
              <DeparturePhotoCard data={formData} user={userInfo} />
            </div>

            {/* Panel 1.5: VIP/MAAS/WCHR MESSAGE (WHATSAPP MESSAGE) */}
            <div className="no-print bg-slate-900/85 backdrop-blur-xl border border-emerald-500/50 rounded-2xl p-5 shadow-2xl flex flex-col">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-800 pb-3 mb-4 gap-3">
                <h2 className="text-base font-bold tracking-wider text-white uppercase flex items-center gap-2">
                  <Send className="w-4 h-4 text-emerald-400" />
                  <span>VIP/MAAS/WCHR MESSAGE (WHATSAPP MESSAGE)</span>
                </h2>

                <button
                  onClick={() =>
                    copyToClipboard(
                      flstWhatsappMessage || 'NIL',
                      'VIP/MAAS/WCHR WhatsApp Message'
                    )
                  }
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-sans text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow-lg"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>COPY WHATSAPP MESSAGE</span>
                </button>
              </div>

              <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 font-mono text-xs md:text-sm text-emerald-300 whitespace-pre-wrap leading-relaxed select-all">
                {flstWhatsappMessage ? (
                  flstWhatsappMessage
                ) : (
                  <span className="text-slate-500 italic">
                    NIL (No VIP/MAAS/WCHR FLST message entered)
                  </span>
                )}
              </div>
            </div>

            {/* Panel 2: Official Departure Report Table (Printable A4) */}
            <div
              id="right-report-printable"
              className="bg-slate-900/80 backdrop-blur-xl border border-slate-700/70 rounded-2xl p-5 shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="no-print flex justify-between items-center border-b border-slate-800 pb-3 mb-4">
                <h2 className="text-base font-bold tracking-wider text-white uppercase flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-400" />
                  <span>OFFICIAL FLIGHT DEPARTURE REPORT</span>
                </h2>

                <button
                  onClick={() => printSection('right')}
                  className="px-3.5 py-1.5 rounded-xl bg-blue-600/80 hover:bg-blue-500 text-white font-sans text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shadow"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>PRINT A4 TABLE</span>
                </button>
              </div>

              <div className="print-table-scroll flex-1 overflow-y-auto">
                <DepartureReportTable
                  data={formData}
                  user={userInfo}
                  mode={reportType}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MASS FORM PAGES ================= */}
      {(currentPage === 'mass-login' ||
        currentPage === 'mass-dashboard' ||
        currentPage === 'mass-history' ||
        currentPage === 'mass-report') && (
        <MassFormModule
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          userInfo={userInfo}
          showToast={showToast}
        />
      )}

      {/* Seat Number Warning Modal Popup (UM PAX, FIRE ARMS, WCHR, WCHC) */}
      {seatWarningTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
          <div className="bg-slate-900 border-2 border-amber-500 rounded-3xl max-w-md w-full p-7 text-center shadow-2xl relative uppercase">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border-2 border-amber-400 text-amber-400 flex items-center justify-center mx-auto mb-4 animate-bounce">
              <AlertTriangle className="w-9 h-9" />
            </div>
            <h3 className="text-xl font-black text-amber-400 uppercase tracking-widest mb-2">
              SEAT NUMBER REQUIRED!
            </h3>
            <div className="bg-amber-500/15 border border-amber-500/40 rounded-2xl p-4 my-4">
              <p className="text-base font-black text-white uppercase tracking-wider leading-snug">
                OFFICER, PLEASE FILL UP THE SEAT NUMBER
              </p>
            </div>
            <p className="text-xs text-slate-400 mb-6 uppercase tracking-wider">
              YOU ENTERED A FIGURE ABOVE 0 FOR{' '}
              {seatWarningTarget === 'umPax'
                ? 'UM PAX'
                : seatWarningTarget === 'fireArms'
                ? 'FIRE ARMS'
                : seatWarningTarget === 'wchr'
                ? 'WCHR'
                : 'WCHC'}
              . PLEASE INPUT THE SEAT NUMBER BEFORE PROCEEDING.
            </p>
            <button
              type="button"
              onClick={() => {
                const target = seatWarningTarget;
                setSeatWarningTarget(null);
                setTimeout(() => {
                  if (target === 'umPax') umPaxSeatInputRef.current?.focus();
                  else if (target === 'fireArms') fireArmsSeatInputRef.current?.focus();
                  else if (target === 'wchr') wchrSeatInputRef.current?.focus();
                  else if (target === 'wchc') wchcSeatInputRef.current?.focus();
                }, 100);
              }}
              className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black tracking-widest text-sm uppercase shadow-xl transition-all cursor-pointer transform active:scale-95"
            >
              OK, I WILL FILL UP NOW
            </button>
          </div>
        </div>
      )}

      {/* Delay Warning Modal Popup */}
      {delayWarningModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
          <div className="bg-slate-900 border-2 border-amber-500 rounded-3xl max-w-md w-full p-7 text-center shadow-2xl relative">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border-2 border-amber-400 text-amber-400 flex items-center justify-center mx-auto mb-4 animate-bounce">
              <AlertTriangle className="w-9 h-9" />
            </div>
            <h3 className="text-xl font-black text-amber-400 uppercase tracking-widest mb-2">
              WARNING: FLIGHT DELAYED!
            </h3>
            <div className="bg-amber-500/15 border border-amber-500/40 rounded-2xl p-4 my-4">
              <p className="text-base font-black text-white uppercase tracking-wider leading-snug">
                OFFICER FILL UP THE DELAY REASON FIRST
              </p>
            </div>
            <p className="text-xs text-slate-400 mb-6 uppercase tracking-wider">
              Please specify the delay reason in the highlighted box before proceeding with flight data entry.
            </p>
            <button
              type="button"
              onClick={() => {
                setDelayWarningModal(false);
                setTimeout(() => {
                  delayReasonInputRef.current?.focus();
                }, 100);
              }}
              className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black tracking-widest text-sm uppercase shadow-xl transition-all cursor-pointer transform active:scale-95"
            >
              OK, I WILL FILL UP NOW
            </button>
          </div>
        </div>
      )}

      {/* NOSHOW PNR Warning Modal Popup (When Counter Noshow >= 1 and user tries to skip NOSHOW PNR) */}
      {showNoshowPnrWarningModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
          <div className="bg-slate-900 border-2 border-red-500 rounded-3xl max-w-md w-full p-7 text-center shadow-2xl relative uppercase">
            <div className="w-16 h-16 rounded-2xl bg-red-500/20 border-2 border-red-400 text-red-400 flex items-center justify-center mx-auto mb-4 animate-bounce">
              <AlertTriangle className="w-9 h-9" />
            </div>
            <h3 className="text-xl font-black text-red-400 uppercase tracking-widest mb-2">
              NOSHOW PNR REQUIRED!
            </h3>
            <div className="bg-red-500/15 border border-red-500/40 rounded-2xl p-4 my-4">
              <p className="text-base font-black text-white uppercase tracking-wider leading-snug">
                YOU HAVE TO INPUT PNR NUMBER
              </p>
            </div>
            <p className="text-xs text-slate-300 mb-6 uppercase tracking-wider leading-relaxed">
              PLEASE INPUT 6 DIGIT PER PNR INSIDE NOSHOW PNR * BOX (E.G. 024UGD, 03ERUF, 0345VD, 1DHUR2, 161GPX).
            </p>
            <button
              type="button"
              onClick={() => {
                setShowNoshowPnrWarningModal(false);
                if (
                  formData.noshowPnr &&
                  (formData.noshowPnr.trim() === '0' || formData.noshowPnr.trim() === '00')
                ) {
                  setFormData((prev) => ({ ...prev, noshowPnr: '' }));
                }
                setTimeout(() => {
                  noshowPnrInputRef.current?.focus();
                }, 100);
              }}
              className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-400 hover:to-rose-500 text-white font-black tracking-widest text-sm uppercase shadow-xl transition-all cursor-pointer transform active:scale-95"
            >
              OK, I WILL INPUT PNR
            </button>
          </div>
        </div>
      )}

      {/* Counter Noshow Blank Warning Modal */}
      {showCounterNoshowModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
          <div className="bg-slate-900 border-2 border-rose-500 rounded-3xl max-w-md w-full p-7 text-center shadow-2xl relative uppercase">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/20 border-2 border-rose-400 text-rose-400 flex items-center justify-center mx-auto mb-4 animate-bounce">
              <AlertTriangle className="w-9 h-9" />
            </div>
            <h3 className="text-xl font-black text-rose-400 uppercase tracking-widest mb-2">
              COUNTER NOSHOW REQUIRED!
            </h3>
            <div className="bg-rose-500/15 border border-rose-500/40 rounded-2xl p-4 my-4">
              <p className="text-base font-black text-white uppercase tracking-wider leading-snug">
                THIS FIELD CAN NOT BE BLANK
              </p>
            </div>
            <p className="text-xs text-slate-400 mb-6 uppercase tracking-wider">
              PLEASE INPUT 0 (IF NO COUNTER NOSHOW) OR THE COUNTER NOSHOW FIGURE (MAX 02 DIGIT).
            </p>
            <button
              type="button"
              onClick={() => {
                setShowCounterNoshowModal(false);
                setTimeout(() => {
                  counterNoshowInputRef.current?.focus();
                }, 100);
              }}
              className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-400 hover:to-red-500 text-white font-black tracking-widest text-sm uppercase shadow-lg cursor-pointer transition-all active:scale-95"
            >
              OK, I WILL FILL UP NOW
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Modal for NEW REPORT */}
      {showNewReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
          <div className="bg-slate-900 border-2 border-amber-500 rounded-3xl max-w-md w-full p-7 text-center shadow-2xl relative uppercase">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border-2 border-amber-400 text-amber-400 flex items-center justify-center mx-auto mb-4 animate-pulse">
              <RotateCcw className="w-9 h-9" />
            </div>
            <h3 className="text-xl font-black text-amber-400 uppercase tracking-widest mb-2">
              CONFIRM NEW REPORT
            </h3>
            <div className="bg-amber-500/15 border border-amber-500/40 rounded-2xl p-4 my-4">
              <p className="text-base font-black text-white uppercase tracking-wider leading-snug">
                ARE YOU SURE TO CREATE NEW REPORT?
              </p>
            </div>
            <p className="text-xs text-slate-400 mb-6 uppercase tracking-wider">
              A fresh flight departure data entry page will be opened.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowNewReportModal(false);
                  resetForm();
                  setCurrentPage(lastDataPage);
                  showToast('NEW REPORT READY FOR ENTRY.');
                }}
                className="flex-1 py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-black tracking-widest text-sm uppercase shadow-lg cursor-pointer transition-all active:scale-95"
              >
                YES
              </button>
              <button
                type="button"
                onClick={() => setShowNewReportModal(false)}
                className="flex-1 py-3.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 font-black tracking-widest text-sm uppercase shadow-lg cursor-pointer transition-all active:scale-95"
              >
                NO
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
