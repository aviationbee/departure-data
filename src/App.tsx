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
  parseTimeToMinutes,
  getRegistrationDetails,
  getAircraftDetails,
} from './data/aviationData';
import { generateFlightDepartureMessage, parseFlstMessage } from './utils/reportGenerators';
import { DepartureReportTable } from './components/DepartureReportTable';
import { ArrivalReportTable } from './components/ArrivalReportTable';
import { DeparturePhotoCard } from './components/DeparturePhotoCard';
import { MassFormModule } from './components/MassFormModule';
import { AdminModule } from './components/AdminModule';
import {
  saveFlightReportToCloud,
  logUserActivity,
  subscribeToSystemNotice,
  subscribeToFlightReports,
  syncRealtimeDataOnActivity,
  reconstructFormDataFromStoredReport,
  StoredFlightReport,
  SystemNoticeDoc,
} from './firebase';
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
  Lock,
  Megaphone,
  FolderOpen,
  Eye,
  Download,
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
  arrPaxAdult: '',
  arrPaxInfant: '',
  arrBaggageWeight: '',
  arrBaggagePcs: '',
  arrCargoWeight: '',
  arrCargoPcs: '',
  arrMail: '',
  arrVip: '',
  arrCip: '',
  arrMaas: '',
  arrRemarks: '',
  arrFlightNo: '',
  arrRoute: '',
  arrPaxReceiving: '',
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
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed.configure === 'string' && /^00\/00\/\d+$/.test(parsed.configure.trim())) {
          parsed.configure = '';
        }
        return parsed;
      } catch (e) {}
    }
    return INITIAL_FORM_DATA;
  });

  const [showDelayBox, setShowDelayBox] = useState(false);
  const [showNewReportModal, setShowNewReportModal] = useState(false);
  const [highlightRedBoxes, setHighlightRedBoxes] = useState(false);
  const [visitedNoshowPnr, setVisitedNoshowPnr] = useState(false);
  const [showRedBoxWarningModal, setShowRedBoxWarningModal] = useState(false);
  const missingMandatoryBox: string | null = null;
  void missingMandatoryBox;
  const [pageHistory, setPageHistory] = useState<PageMode[]>([]);
  const [liveNotice, setLiveNotice] = useState<SystemNoticeDoc | null>(null);
  const [cloudFlightReports, setCloudFlightReports] = useState<StoredFlightReport[]>([]);
  const [viewedSavedReport, setViewedSavedReport] = useState<{
    formData: FlightFormData;
    user: UserInfo;
  } | null>(null);
  const [dismissedNoticeTs, setDismissedNoticeTs] = useState<number>(() => {
    return Number(localStorage.getItem('usba_dismissed_notice_ts') || '0');
  });
  const flightNoInputRef = React.useRef<HTMLInputElement>(null);
  const acRegInputRef = React.useRef<HTMLInputElement>(null);
  const captainInputRef = React.useRef<HTMLInputElement>(null);
  const configureInputRef = React.useRef<HTMLInputElement>(null);
  const staInputRef = React.useRef<HTMLInputElement>(null);
  const chocksOnInputRef = React.useRef<HTMLInputElement>(null);
  const doorOpenInputRef = React.useRef<HTMLInputElement>(null);
  const stdInputRef = React.useRef<HTMLInputElement>(null);
  const doorClosedInputRef = React.useRef<HTMLInputElement>(null);
  const chocksOffInputRef = React.useRef<HTMLInputElement>(null);
  const airborneInputRef = React.useRef<HTMLInputElement>(null);
  const flightLoadInputRef = React.useRef<HTMLInputElement>(null);
  const paxMaleInputRef = React.useRef<HTMLInputElement>(null);
  const paxFemaleInputRef = React.useRef<HTMLInputElement>(null);
  const paxChildInputRef = React.useRef<HTMLInputElement>(null);
  const paxInfantInputRef = React.useRef<HTMLInputElement>(null);
  const fuelUpliftInputRef = React.useRef<HTMLInputElement>(null);
  const baggageWeightInputRef = React.useRef<HTMLInputElement>(null);
  const baggagePcsInputRef = React.useRef<HTMLInputElement>(null);
  const cargoWeightInputRef = React.useRef<HTMLInputElement>(null);
  const cargoPcsInputRef = React.useRef<HTMLInputElement>(null);
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

  const navigateToPage = (nextPage: PageMode) => {
    if (nextPage === 'identification' || nextPage === 'welcome') {
      setPageHistory([]);
      setViewedSavedReport(null);
    } else if (nextPage !== currentPage) {
      setPageHistory((prev) => [...prev, currentPage]);
    }
    setCurrentPage(nextPage);
  };

  const handlePreviousPage = () => {
    if (currentPage === 'dual-report' && viewedSavedReport) {
      setViewedSavedReport(null);
      if (pageHistory.length > 0) {
        const prev = pageHistory[pageHistory.length - 1];
        setPageHistory((h) => h.slice(0, -1));
        setCurrentPage(prev);
        return;
      }
      setCurrentPage('saved-flights');
      return;
    }
    if (pageHistory.length > 0) {
      const prev = pageHistory[pageHistory.length - 1];
      setPageHistory((h) => h.slice(0, -1));
      setCurrentPage(prev);
      return;
    }
    if (currentPage === 'dual-report') {
      setCurrentPage(lastDataPage);
    } else if (currentPage === 'saved-flights') {
      setCurrentPage('welcome');
    } else if (currentPage === 'mass-report' || currentPage === 'mass-history') {
      setCurrentPage('mass-dashboard');
    } else if (currentPage === 'mass-dashboard') {
      setCurrentPage('mass-login');
    } else if (
      currentPage === 'admin-logs' ||
      currentPage === 'admin-saved-flight' ||
      currentPage === 'admin-saved-maas'
    ) {
      setCurrentPage('admin-dashboard');
    } else if (currentPage === 'admin-dashboard') {
      setCurrentPage('welcome');
    } else {
      setCurrentPage('welcome');
    }
  };

  const handleLogout = () => {
    if (userInfo.userName) {
      logUserActivity('USER LOG OUT', `Officer logged out from ${userInfo.stationName}`, userInfo);
    }
    localStorage.removeItem('usba_user_info');
    localStorage.removeItem('usba_flight_form_data');
    localStorage.removeItem('usba_current_page');
    localStorage.removeItem('usba_last_data_page');
    localStorage.removeItem('usba_report_type');
    localStorage.removeItem('usba_last_activity');
    sessionStorage.removeItem('usba_admin_role');
    sessionStorage.removeItem('usba_admin_station');
    setPageHistory([]);
    setUserInfo({ userName: '', usbaId: '', stationName: 'DAC' });
    setFormData(INITIAL_FORM_DATA);
    setCurrentPage('identification');
    showToast('LOGGED OUT SUCCESSFULLY.');
  };

  // Real-time subscription to Super Admin Notice + Flight Reports + Activity-Triggered Instant Cloud Sync (no page refresh required)
  useEffect(() => {
    const unsub = subscribeToSystemNotice((notice) => {
      setLiveNotice(notice);
    });
    const unsubFlights = subscribeToFlightReports((reports) => {
      setCloudFlightReports(reports);
    });

    // Trigger immediate sync on mount
    syncRealtimeDataOnActivity(true);

    // Sync whenever user performs any activity in the app
    const handleUserActivitySync = () => {
      syncRealtimeDataOnActivity(false);
    };

    const activityEvents = ['click', 'keydown', 'touchstart', 'focus', 'visibilitychange'];
    activityEvents.forEach((ev) =>
      window.addEventListener(ev, handleUserActivitySync, { passive: true })
    );

    // Continuous 4-second background heartbeat sync
    const syncTimer = window.setInterval(() => {
      syncRealtimeDataOnActivity(false);
    }, 4000);

    return () => {
      unsub();
      unsubFlights();
      activityEvents.forEach((ev) => window.removeEventListener(ev, handleUserActivitySync));
      window.clearInterval(syncTimer);
    };
  }, []);

  // Also force real-time sync whenever user switches pages inside the app
  useEffect(() => {
    syncRealtimeDataOnActivity(true);
  }, [currentPage]);

  // 2-Hour Inactivity Auto-Logout (7,200,000 ms)
  useEffect(() => {
    if (currentPage === 'identification') return;

    const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
    const updateActivity = () => {
      localStorage.setItem('usba_last_activity', String(Date.now()));
    };

    if (!localStorage.getItem('usba_last_activity')) {
      updateActivity();
    }

    const checkInactivity = () => {
      const lastAct = Number(localStorage.getItem('usba_last_activity') || Date.now());
      if (Date.now() - lastAct >= TWO_HOURS_MS) {
        if (userInfo.userName) {
          logUserActivity(
            'AUTO LOG OUT (2H INACTIVE)',
            `Auto logged out due to 2 hours of inactivity at ${userInfo.stationName}`,
            userInfo
          );
        }
        localStorage.removeItem('usba_user_info');
        localStorage.removeItem('usba_flight_form_data');
        localStorage.removeItem('usba_current_page');
        localStorage.removeItem('usba_last_data_page');
        localStorage.removeItem('usba_report_type');
        localStorage.removeItem('usba_last_activity');
        sessionStorage.removeItem('usba_admin_role');
        sessionStorage.removeItem('usba_admin_station');
        setPageHistory([]);
        setUserInfo({ userName: '', usbaId: '', stationName: 'DAC' });
        setFormData(INITIAL_FORM_DATA);
        setCurrentPage('identification');
        showToast('AUTO LOGGED OUT DUE TO 2 HOURS INACTIVITY.');
      }
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach((ev) => window.addEventListener(ev, updateActivity, { passive: true }));
    const interval = window.setInterval(checkInactivity, 15000);
    checkInactivity();

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, updateActivity));
      window.clearInterval(interval);
    };
  }, [currentPage, userInfo]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const validateDelayReason = (_e?: React.FocusEvent<any> | React.MouseEvent<any>): boolean => {
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

  // Handle Flight No change -> auto Route & auto Arrival Flight No / Route
  const handleFlightNoChange = (val: string) => {
    const cleanVal = val.replace(/\D/g, '').toUpperCase();
    const matchedRoute = findRouteByFlightNo(cleanVal);
    const parsed = parseInt(cleanVal, 10);
    const arrNum = !isNaN(parsed) && parsed > 0 ? (parsed % 2 === 0 ? parsed - 1 : parsed) : '';
    const autoArrFlt = arrNum ? `BS-${arrNum}` : '';
    const matchedArrRoute = arrNum ? findRouteByFlightNo(String(arrNum)) : '';
    const fallbackArrRoute = (() => {
      const parts = (matchedRoute || '').split('-').map((p) => p.trim().toUpperCase()).filter(Boolean);
      if (parts.length === 2) {
        if (parts[0] === 'DAC') return `${parts[0]}-${parts[1]}`;
        return `DAC-${parts[0]}`;
      }
      const stn = (userInfo.stationName || '').trim().toUpperCase();
      return stn && stn !== 'DAC' ? `DAC-${stn}` : '';
    })();
    const autoArrRoute = matchedArrRoute || fallbackArrRoute;

    setFormData((prev) => ({
      ...prev,
      flightNoSuffix: cleanVal,
      route: matchedRoute || prev.route,
      arrFlightNo:
        prev.arrFlightNo && !prev.arrFlightNo.startsWith('BS-') && prev.arrFlightNo !== autoArrFlt
          ? prev.arrFlightNo
          : autoArrFlt || prev.arrFlightNo,
      arrRoute:
        prev.arrRoute && prev.arrRoute !== autoArrRoute ? prev.arrRoute : autoArrRoute || prev.arrRoute,
    }));
  };

  // Handle Arrival Flight No change in ARRIVAL INFORMATION -> auto-calculate arrival Route
  const handleArrivalFlightNoChange = (val: string) => {
    const upper = val.toUpperCase();
    const cleanDigits = upper.replace(/\D/g, '');
    const matchedRoute = cleanDigits ? findRouteByFlightNo(cleanDigits) : '';
    const fallbackRoute = (() => {
      if (!cleanDigits) return '';
      const stn = (userInfo.stationName || '').trim().toUpperCase();
      if (stn && stn !== 'DAC') {
        return `DAC-${stn}`;
      }
      return '';
    })();
    const autoRoute = matchedRoute || fallbackRoute;

    setFormData((prev) => ({
      ...prev,
      arrFlightNo: upper,
      arrRoute: autoRoute || (upper ? prev.arrRoute : ''),
    }));
  };

  // Handle Reg Change -> auto AC Type only (leave CONFIGURE / CREW COUNT watermark as "2/2")
  const handleRegChange = (val: string) => {
    const upper = val.toUpperCase().trim().replace(/^(S2-|HS-|PK-)/, '').slice(0, 3);
    const details = getAircraftDetails(upper);
    setFormData((prev) => ({
      ...prev,
      acRegSuffix: upper,
      acType: details.type || prev.acType,
      configure: /^00\/00\/\d+$/.test((prev.configure || '').trim()) ? '' : prev.configure,
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
    setHighlightRedBoxes(false);
    setVisitedNoshowPnr(false);
    setShowRedBoxWarningModal(false);
  };

  // Navigation handlers
  const handleEnterIdentification = () => {
    if (!userInfo.userName.trim() || !userInfo.usbaId.trim()) {
      alert('Please fill in both User Name and USBA ID to continue.');
      return;
    }
    localStorage.setItem('usba_last_activity', String(Date.now()));
    logUserActivity(
      'USER LOG IN',
      `Officer logged in at Station ${userInfo.stationName}`,
      userInfo
    );
    setCurrentPage('welcome');
  };

  const goToDataPage = (page: PageMode, type: 'intl' | 'dom') => {
    setViewedSavedReport(null);
    setReportType(type);
    setLastDataPage(page);
    navigateToPage(page);
  };

  const isZeroOrEmptyVal = (val?: string): boolean => {
    if (!val) return true;
    const trimmed = val.trim().toUpperCase();
    if (trimmed === '' || trimmed === 'NIL' || trimmed === 'N/A' || trimmed === '-') return true;
    if (/^0+$/.test(trimmed)) return true;
    return false;
  };

  const isOutstation = (userInfo.stationName || 'DAC').trim().toUpperCase() !== 'DAC';

  // Option A Required Boxes: CAPTAIN, CONFIGURE / CREW COUNT, DELAY REASON (if delayed), BAGGAGE, NOSHOW PNR * (if NOSHOW FIGURE >= 1)
  const isCaptainMissing = !formData.captain || formData.captain.trim() === '';
  const isConfigureMissing = !formData.configure || formData.configure.trim() === '';
  const isDelayReasonMissing =
    showDelayBox && (!formData.delayReason || formData.delayReason.trim() === '');
  const isBaggageWeightMissing = !formData.baggageWeight || formData.baggageWeight.trim() === '';
  const isBaggagePcsMissing = !formData.baggagePcs || formData.baggagePcs.trim() === '';
  const isBaggageMissing = isBaggageWeightMissing || isBaggagePcsMissing;
  const counterNoshowVal = parseInt(formData.counterNoshow, 10);
  const isNoshowPnrMissing =
    !isNaN(counterNoshowVal) &&
    counterNoshowVal >= 1 &&
    isZeroOrEmptyVal(formData.noshowPnr);

  const hasAnyRedBoxMissing =
    isCaptainMissing ||
    isConfigureMissing ||
    isDelayReasonMissing ||
    isBaggageMissing ||
    isNoshowPnrMissing;

  const focusFirstRedBox = () => {
    if (isCaptainMissing) captainInputRef.current?.focus();
    else if (isConfigureMissing) configureInputRef.current?.focus();
    else if (isDelayReasonMissing) delayReasonInputRef.current?.focus();
    else if (isBaggageWeightMissing) baggageWeightInputRef.current?.focus();
    else if (isBaggagePcsMissing) baggagePcsInputRef.current?.focus();
    else if (isNoshowPnrMissing) noshowPnrInputRef.current?.focus();
  };

  const handleGridFocusCapture = (e: React.FocusEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (!target || (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA')) return;
    if (visitedNoshowPnr && target !== noshowPnrInputRef.current) {
      setHighlightRedBoxes(true);
    }
  };

  const handleGenerateReport = (type: 'intl' | 'dom') => {
    if (hasAnyRedBoxMissing) {
      setHighlightRedBoxes(true);
      setShowRedBoxWarningModal(true);
      return;
    }

    // Automatically save flight data to Cloud Firestore (preserved for 90 days) & log activity
    saveFlightReportToCloud(formData, userInfo);
    logUserActivity(
      'FLIGHT REPORT GENERATED',
      `Generated Flight Report BS-${formData.flightNoSuffix || '000'} (${formData.route || 'N/A'}) Date: ${formData.date}`,
      userInfo
    );

    setViewedSavedReport(null);
    setReportType(type);
    navigateToPage('dual-report');
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`${label} copied to clipboard!`);
  };

  const printSection = (target: 'message' | 'right' | 'arrival' | 'all') => {
    if (target === 'right') {
      document.body.setAttribute('data-print-target', 'departure');
    } else if (target === 'arrival') {
      document.body.setAttribute('data-print-target', 'arrival');
    } else {
      document.body.removeAttribute('data-print-target');
    }
    window.print();
    setTimeout(() => {
      document.body.removeAttribute('data-print-target');
    }, 500);
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
        arrPaxAdult: '70',
        arrPaxInfant: '02',
        arrBaggageWeight: '420',
        arrBaggagePcs: '48',
        arrCargoWeight: '100',
        arrCargoPcs: '10',
        arrMail: '01',
        arrVip: '2',
        arrCip: '1',
        arrMaas: '2',
        arrPaxReceiving: 'HASAN',
        arrRemarks: 'NIL',
        arrFlightNo: 'BS-141',
        arrRoute: 'DAC-CXB',
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

  const activeReportFormData = viewedSavedReport ? viewedSavedReport.formData : formData;
  const activeReportUser = viewedSavedReport ? viewedSavedReport.user : userInfo;
  const isReadOnlySavedReport = Boolean(viewedSavedReport);
  const activeIsOutstation =
    (activeReportUser.stationName || userInfo.stationName || 'DAC').trim().toUpperCase() !== 'DAC';

  const todayIsoDate = new Date().toISOString().split('T')[0];
  const todayLocalDate = new Date().toLocaleDateString('en-CA');
  const currentStationUpper = (userInfo.stationName || 'DAC').trim().toUpperCase();
  const todayStationSavedFlights = cloudFlightReports.filter((r) => {
    const rStation = (r.station || 'DAC').trim().toUpperCase();
    if (rStation !== currentStationUpper) return false;
    const isTodayFlightDate = r.date === todayIsoDate || r.date === todayLocalDate;
    const isCreatedToday =
      r.createdAt &&
      (r.createdAt.startsWith(todayIsoDate) ||
        new Date(r.createdAt).toLocaleDateString('en-CA') === todayLocalDate);
    return Boolean(isTodayFlightDate || isCreatedToday);
  });

  // Station Today's Saved Flights KPI Totals
  const savedTotalFlights = todayStationSavedFlights.length;
  const savedTotalPax = todayStationSavedFlights.reduce(
    (sum, r) => sum + (parseInt(r.paxTotal, 10) || 0),
    0
  );
  const savedTotalBagKg = todayStationSavedFlights.reduce(
    (sum, r) => sum + (parseInt(r.baggageWeight, 10) || 0),
    0
  );
  const savedTotalBagPcs = todayStationSavedFlights.reduce(
    (sum, r) => sum + (parseInt(r.baggagePcs, 10) || 0),
    0
  );
  const savedTotalCargoKg = todayStationSavedFlights.reduce(
    (sum, r) => sum + (parseInt(r.cargoWeight, 10) || 0),
    0
  );
  const savedTotalNoshow = todayStationSavedFlights.reduce(
    (sum, r) => sum + (parseInt(r.counterNoshow, 10) || 0),
    0
  );

  // Download Station's Saved Flight Data as Excel
  const handleDownloadStationSavedExcel = () => {
    if (todayStationSavedFlights.length === 0) {
      showToast('NO FLIGHT DATA FOUND TO DOWNLOAD!');
      return;
    }

    // OUTSTATION SPECIFIC EXCEL SHEET (Matching Attachment 2 with arrival & departure rearranged and color coded)
    if (currentStationUpper !== 'DAC') {
      const formatToHHMM = (val?: string): string => {
        if (!val) return '--';
        const clean = val.replace(/\D/g, '');
        if (clean.length === 4) {
          return `${clean.slice(0, 2)}:${clean.slice(2, 4)}`;
        }
        if (val.includes(':')) return val.trim();
        return val.trim() || '--';
      };

      const getTimeDiffAndStatus = (
        schedStr?: string,
        actStr?: string
      ): { diff: number; status: 'ON TIME' | 'EARLY' | 'DELAY'; minsStr: string } => {
        const sMin = parseTimeToMinutes(schedStr || '');
        const aMin = parseTimeToMinutes(actStr || '');
        if (sMin === null || aMin === null) {
          return { diff: 0, status: 'ON TIME', minsStr: '00' };
        }
        let diff = aMin - sMin;
        if (diff < -720) diff += 1440;
        else if (diff > 720) diff -= 1440;

        if (diff === 0) {
          return { diff: 0, status: 'ON TIME', minsStr: '00' };
        }
        if (diff > 0) {
          return { diff, status: 'DELAY', minsStr: String(diff).padStart(2, '0') };
        }
        return {
          diff: Math.abs(diff),
          status: 'EARLY',
          minsStr: String(Math.abs(diff)).padStart(2, '0'),
        };
      };

      const getGroundTimeFormatted = (ataStr?: string, atdStr?: string): string => {
        const aMin = parseTimeToMinutes(ataStr || '');
        const dMin = parseTimeToMinutes(atdStr || '');
        if (aMin === null || dMin === null) return '--';
        let diff = dMin - aMin;
        if (diff < 0) diff += 1440;
        const hours = Math.floor(diff / 60);
        const mins = diff % 60;
        return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
      };

      const getStatusStyle = (status: 'ON TIME' | 'EARLY' | 'DELAY') => {
        if (status === 'DELAY') {
          return 'color: #dc2626; background-color: #ffd7d7; font-weight: bold; text-align: center; border: 1px solid #000000;';
        }
        if (status === 'EARLY') {
          return 'color: #16a34a; background-color: #d7ffd7; font-weight: bold; text-align: center; border: 1px solid #000000;';
        }
        return 'color: #b45309; background-color: #fff5cc; font-weight: bold; text-align: center; border: 1px solid #000000;';
      };

      const getRemarksStyle = (status: 'ON TIME' | 'EARLY' | 'DELAY') => {
        if (status === 'DELAY') {
          return 'color: #dc2626; font-weight: bold; text-align: center; border: 1px solid #000000;';
        }
        if (status === 'EARLY') {
          return 'color: #16a34a; font-weight: bold; text-align: center; border: 1px solid #000000;';
        }
        return 'color: #b45309; font-weight: bold; text-align: center; border: 1px solid #000000;';
      };

      const rawFlightDate = todayStationSavedFlights[0]?.date || todayIsoDate;
      const parsedDate = new Date(rawFlightDate + 'T00:00:00Z');
      const formattedDateForHeader = !isNaN(parsedDate.getTime())
        ? `${String(parsedDate.getUTCDate()).padStart(2, '0')} ${parsedDate
            .toLocaleString('en-GB', { month: 'long', timeZone: 'UTC' })
            .toUpperCase()} ${parsedDate.getUTCFullYear()}`
        : rawFlightDate;

      const rowsHtml = todayStationSavedFlights
        .map((r) => {
          const raw = r.rawFormData;

          // Arrival Flight
          const rawFltDigits = (r.flightNo || '').replace(/\D/g, '');
          const parsedFltNum = parseInt(rawFltDigits, 10);
          const autoArrNum =
            !isNaN(parsedFltNum) && parsedFltNum > 0
              ? String(parsedFltNum % 2 === 0 ? parsedFltNum - 1 : parsedFltNum)
              : '';
          const arvFlt = raw?.arrFlightNo?.trim()
            ? raw.arrFlightNo.trim().toUpperCase().startsWith('BS-')
              ? raw.arrFlightNo.trim().toUpperCase()
              : `BS-${raw.arrFlightNo.trim().toUpperCase()}`
            : autoArrNum
            ? `BS-${autoArrNum}`
            : r.flightNo || 'N/A';

          const staFormatted = formatToHHMM(r.sta || raw?.sta);
          const ataFormatted = formatToHHMM(
            r.chocksOn || raw?.chocksOn || r.doorOpen || raw?.doorOpen
          );
          const arrCalc = getTimeDiffAndStatus(
            r.sta || raw?.sta,
            r.chocksOn || raw?.chocksOn || r.doorOpen || raw?.doorOpen
          );

          const arrAdultPax = raw?.arrPaxAdult?.trim() || '00';
          const arrInfantPax = String(parseInt(raw?.arrPaxInfant?.trim() || '0', 10) || 0).padStart(
            2,
            '0'
          );
          const arvPax = `${arrAdultPax}+${arrInfantPax}`;

          // Departure Flight
          const depFlt = r.flightNo?.trim()
            ? r.flightNo.trim().toUpperCase().startsWith('BS-')
              ? r.flightNo.trim().toUpperCase()
              : `BS-${r.flightNo.trim().toUpperCase()}`
            : 'N/A';

          const stdFormatted = formatToHHMM(r.std || raw?.std);
          const atdFormatted = formatToHHMM(
            r.chocksOff || raw?.chocksOff || r.airborne || raw?.airborne
          );
          const depCalc = getTimeDiffAndStatus(
            r.std || raw?.std,
            r.chocksOff || raw?.chocksOff || r.airborne || raw?.airborne
          );

          const gtFormatted = getGroundTimeFormatted(
            r.chocksOn || raw?.chocksOn || r.doorOpen || raw?.doorOpen,
            r.chocksOff || raw?.chocksOff || r.airborne || raw?.airborne
          );

          const depAdultPax = r.paxTotal || raw?.paxTotal || '00';
          const depInfantPax = String(parseInt(r.paxInfant || raw?.paxInfant || '0', 10) || 0).padStart(
            2,
            '0'
          );
          const depPax = `${depAdultPax}+${depInfantPax}`;

          // Departure Remarks
          let depRemarks = '';
          if (depCalc.status === 'ON TIME') {
            depRemarks = 'FLT ON TIME';
          } else if (depCalc.status === 'EARLY') {
            depRemarks = `FLT ${String(depCalc.diff).padStart(4, '0')} HRS EARLY DEPARTURE`;
          } else {
            const arrLateStr =
              arrCalc.status === 'DELAY' && arrCalc.diff > 0
                ? ` DUE TO ${String(arrCalc.diff).padStart(4, '0')} HRS L/A`
                : '';
            const reasonStr =
              !arrLateStr && (r.delayReason || raw?.delayReason)
                ? ` DUE TO ${(r.delayReason || raw?.delayReason).trim().toUpperCase()}`
                : '';
            depRemarks = `FLT ${String(depCalc.diff).padStart(4, '0')} HRS DELAY${arrLateStr || reasonStr}`;
          }

          const customRemark = (r.remarks || raw?.remarks || '').trim().toUpperCase();
          if (customRemark && customRemark !== 'NIL' && customRemark !== depRemarks) {
            depRemarks = `${depRemarks} - ${customRemark}`;
          }

          return `
            <tr style="height: 25px;">
              <td style="border: 1px solid #000000; text-align: center; font-weight: bold; mso-number-format:'\\@';">${arvFlt}</td>
              <td style="border: 1px solid #000000; text-align: center; mso-number-format:'\\@';">${staFormatted}</td>
              <td style="border: 1px solid #000000; text-align: center; mso-number-format:'\\@';">${ataFormatted}</td>
              <td style="border: 1px solid #000000; text-align: center; mso-number-format:'\\@';">${arrCalc.minsStr}</td>
              <td style="${getStatusStyle(arrCalc.status)}">${arrCalc.status}</td>
              <td style="border: 1px solid #000000; text-align: center; mso-number-format:'\\@';">${arvPax}</td>
              <td style="border: 1px solid #000000; text-align: center; font-weight: bold; mso-number-format:'\\@';">${depFlt}</td>
              <td style="border: 1px solid #000000; text-align: center; mso-number-format:'\\@';">${stdFormatted}</td>
              <td style="border: 1px solid #000000; text-align: center; mso-number-format:'\\@';">${atdFormatted}</td>
              <td style="border: 1px solid #000000; text-align: center; mso-number-format:'\\@';">${depCalc.minsStr}</td>
              <td style="border: 1px solid #000000; text-align: center; mso-number-format:'\\@';">${gtFormatted}</td>
              <td style="${getStatusStyle(depCalc.status)}">${depCalc.status}</td>
              <td style="border: 1px solid #000000; text-align: center; mso-number-format:'\\@';">${depPax}</td>
              <td style="${getRemarksStyle(depCalc.status)}">${depRemarks}</td>
            </tr>
          `;
        })
        .join('');

      const excelHtml = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
          <!--[if gte mso 9]>
          <xml>
            <x:ExcelWorkbook>
              <x:ExcelWorksheets>
                <x:ExcelWorksheet>
                  <x:Name>Flight Status</x:Name>
                  <x:WorksheetOptions>
                    <x:DisplayGridlines/>
                  </x:WorksheetOptions>
                </x:ExcelWorksheet>
              </x:ExcelWorksheets>
            </x:ExcelWorkbook>
          </xml>
          <![endif]-->
          <style>
            table { border-collapse: collapse; font-family: Calibri, Arial, sans-serif; font-size: 11pt; }
            th { border: 1px solid #000000; text-align: center; vertical-align: middle; }
            td { border: 1px solid #000000; vertical-align: middle; }
          </style>
        </head>
        <body>
          <table border="1">
            <tr>
              <td colspan="14" style="font-size: 16pt; font-weight: bold; text-align: center; height: 38px; border: none;">
                Flight Status ${formattedDateForHeader}
              </td>
            </tr>
            <tr>
              <td colspan="14" style="font-size: 13pt; font-weight: bold; text-align: center; background-color: #1e4b7a; color: #ffffff; height: 32px; border: 1px solid #1e4b7a;">
                US-Bangla Airlines
              </td>
            </tr>
            <tr style="background-color: #3d3d3d; color: #ffffff; font-weight: bold; text-align: center; height: 30px;">
              <th style="background-color: #3d3d3d; color: #ffffff; border: 1px solid #000000; width: 90px;">Flight No</th>
              <th style="background-color: #3d3d3d; color: #ffffff; border: 1px solid #000000; width: 70px;">STA</th>
              <th style="background-color: #3d3d3d; color: #ffffff; border: 1px solid #000000; width: 70px;">ATA</th>
              <th style="background-color: #3d3d3d; color: #ffffff; border: 1px solid #000000; width: 70px;">Minutes</th>
              <th style="background-color: #3d3d3d; color: #ffffff; border: 1px solid #000000; width: 85px;">Status</th>
              <th style="background-color: #3d3d3d; color: #ffffff; border: 1px solid #000000; width: 80px;">PAX</th>
              <th style="background-color: #3d3d3d; color: #ffffff; border: 1px solid #000000; width: 90px;">Flight No</th>
              <th style="background-color: #3d3d3d; color: #ffffff; border: 1px solid #000000; width: 70px;">STD</th>
              <th style="background-color: #3d3d3d; color: #ffffff; border: 1px solid #000000; width: 70px;">ATD</th>
              <th style="background-color: #3d3d3d; color: #ffffff; border: 1px solid #000000; width: 70px;">Minutes</th>
              <th style="background-color: #3d3d3d; color: #ffffff; border: 1px solid #000000; width: 70px;">GT</th>
              <th style="background-color: #3d3d3d; color: #ffffff; border: 1px solid #000000; width: 85px;">Status</th>
              <th style="background-color: #3d3d3d; color: #ffffff; border: 1px solid #000000; width: 80px;">PAX</th>
              <th style="background-color: #3d3d3d; color: #ffffff; border: 1px solid #000000; width: 400px;">REMARKS</th>
            </tr>
            ${rowsHtml}
          </table>
        </body>
        </html>
      `;

      const blob = new Blob([excelHtml], { type: 'application/vnd.ms-excel;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Flight_Status_${currentStationUpper}_${todayLocalDate}.xls`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast('OUTSTATION FLIGHT STATUS EXCEL DOWNLOADED SUCCESSFULLY!');
      return;
    }

    const headers = [
      'DATE',
      'STATION',
      'FLIGHT NO',
      'ROUTE',
      'A/C REG',
      'A/C TYPE',
      'CAPTAIN',
      'CREW CONFIG',
      'STA',
      'C/ON',
      'DOOR OPEN',
      'ARRIVAL STATUS',
      'ARR FLIGHT NO',
      'ARR ROUTE',
      'ARR PAX RECEIVING',
      'ARR PAX ADULT',
      'ARR PAX INFANT',
      'ARR BAG WEIGHT (KG)',
      'ARR BAG PCS',
      'ARR CARGO WEIGHT (KG)',
      'ARR CARGO PCS',
      'ARR MAIL',
      'ARR VIP',
      'ARR CIP',
      'ARR MAAS',
      'ARR REMARKS',
      'STD',
      'DOOR CLOSED',
      'C/OFF',
      'AIRBORNE',
      'DEPARTURE STATUS',
      'DELAY REASON',
      'FLIGHT LOAD',
      'FUEL (KG)',
      'PAX MALE',
      'PAX FEMALE',
      'PAX CHILD',
      'PAX INFANT',
      'TOTAL PAX',
      'BAG WEIGHT (KG)',
      'BAG PCS',
      'BAG COM NO',
      'CARGO WEIGHT (KG)',
      'CARGO PCS',
      'CARGO COM NO',
      'CREW BAG WEIGHT (KG)',
      'CREW BAG PCS',
      'CREW BAG COM NO',
      'MAIL',
      'COUNTER NOSHOW',
      'NOSHOW PNR',
      'GATE NOSHOW',
      'SELF OFFLOAD',
      'VIP',
      'CIP',
      'MAAS',
      'WCHR (SEAT)',
      'WCHC (SEAT)',
      'UM PAX (SEAT)',
      'FIRE ARMS (SEAT)',
      'LOAD CONTROLLER',
      'RAMP OFFICER',
      'CHECK IN STAFF',
      'PAX HANDLING',
      'REMARKS',
      'REPORT BY',
      'USBA ID',
      'SAVED AT',
    ];

    const escapeCsv = (val: string | number | undefined) => {
      const raw = String(val ?? '');
      if (raw.startsWith('="') && raw.endsWith('"')) {
        const inner = raw.slice(2, -1).replace(/"/g, '""');
        return `="${inner}"`;
      }
      const str = raw.replace(/"/g, '""');
      return `"${str}"`;
    };

    const toExcelTextMode = (val: string | undefined) => {
      const clean = String(val ?? '').trim();
      return clean ? `="${clean}"` : '';
    };

    const rows = todayStationSavedFlights.map((r) => {
      const raw = r.rawFormData;
      return [
        r.date,
        r.station,
        r.flightNo,
        r.route,
        r.acReg,
        r.acType,
        r.captain,
        toExcelTextMode(r.configure),
        r.sta || raw?.sta || '',
        r.chocksOn || raw?.chocksOn || '',
        r.doorOpen || raw?.doorOpen || '',
        r.arrivalStatus || raw?.arrivalStatus || '',
        raw?.arrFlightNo || '',
        raw?.arrRoute || '',
        raw?.arrPaxReceiving || '',
        raw?.arrPaxAdult || '',
        raw?.arrPaxInfant || '',
        raw?.arrBaggageWeight || '',
        raw?.arrBaggagePcs || '',
        raw?.arrCargoWeight || '',
        raw?.arrCargoPcs || '',
        raw?.arrMail || '',
        raw?.arrVip || '',
        raw?.arrCip || '',
        raw?.arrMaas || '',
        raw?.arrRemarks || '',
        r.std,
        r.doorClosed,
        r.chocksOff,
        r.airborne,
        r.departureStatus,
        r.delayReason,
        r.flightLoad,
        r.fuelUplift,
        r.paxMale,
        r.paxFemale,
        r.paxChild,
        r.paxInfant,
        r.paxTotal,
        r.baggageWeight,
        r.baggagePcs,
        raw?.baggageComNo || '',
        r.cargoWeight,
        r.cargoPcs,
        raw?.cargoComNo || '',
        raw?.crewBagWeight || '',
        raw?.crewBagPcs || '',
        raw?.crewBagComNo || '',
        r.mail,
        r.counterNoshow,
        r.noshowPnr,
        r.gateNoShow,
        r.selfOffload,
        r.vip,
        r.cip,
        r.maas,
        r.wchrSeat ? `${r.wchrFig} (${r.wchrSeat})` : r.wchrFig,
        r.wchcSeat ? `${r.wchcFig} (${r.wchcSeat})` : r.wchcFig,
        r.umPaxSeat ? `${r.umPax} (${r.umPaxSeat})` : r.umPax,
        r.fireArmsSeat ? `${r.fireArms} (${r.fireArmsSeat})` : r.fireArms,
        r.loadController,
        r.rampOfficer,
        r.checkInStaff,
        r.paxHandling || raw?.paxHandling || '',
        r.remarks,
        r.preparedBy,
        `USBA-${r.usbaId}`,
        new Date(r.createdAt).toLocaleString(),
      ];
    });

    const csvContent =
      '\uFEFF' +
      [headers.map(escapeCsv).join(','), ...rows.map((row) => row.map(escapeCsv).join(','))].join(
        '\r\n'
      );

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `USBA_SAVED_FLIGHT_DATA_${currentStationUpper}_${todayLocalDate}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('EXCEL (.CSV) DOWNLOADED SUCCESSFULLY!');
  };

  const departureMessage = generateFlightDepartureMessage(
    activeReportFormData,
    activeReportUser,
    reportType
  );
  const flstWhatsappMessage = parseFlstMessage(
    activeReportFormData.flstRawMessage,
    activeReportFormData
  );

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
                onClick={() => navigateToPage('saved-flights')}
                className="py-4 px-6 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-extrabold tracking-widest shadow-lg hover:shadow-emerald-600/30 hover:scale-[1.02] active:scale-[0.98] transition-all text-sm md:text-base border border-emerald-400/30 flex items-center justify-center gap-3 cursor-pointer uppercase"
              >
                <FolderOpen className="w-5 h-5 text-emerald-200" />
                <span>SAVED FLIGHT DATA</span>
              </button>

              <button
                onClick={() => navigateToPage('mass-login')}
                className="py-4 px-6 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-indigo-500 hover:to-purple-600 text-white font-extrabold tracking-widest shadow-lg hover:shadow-purple-600/30 hover:scale-[1.02] active:scale-[0.98] transition-all text-sm md:text-base border border-purple-400/30 flex items-center justify-center gap-3 cursor-pointer uppercase"
              >
                <FileText className="w-5 h-5 text-purple-200" />
                <span>MASS FORM</span>
              </button>

              <button
                onClick={() => navigateToPage('admin-login')}
                className="py-4 px-6 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-black tracking-widest shadow-lg hover:shadow-amber-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all text-sm md:text-base border border-amber-300/50 flex items-center justify-center gap-3 cursor-pointer uppercase"
              >
                <Lock className="w-5 h-5 text-slate-950" />
                <span>ADMIN ONLY</span>
              </button>

              <button
                onClick={handleLogout}
                className="mt-4 py-2.5 px-6 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 font-semibold text-xs tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer w-fit mx-auto border border-slate-700"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>LOG OUT / PREVIOUS</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= PAGE 2.5: SAVED FLIGHT DATA (TODAY'S STATION REPORTS - VIEW & PRINT ONLY) ================= */}
      {currentPage === 'saved-flights' && (
        <div className="flex-1 p-4 md:p-8 min-h-screen flex flex-col items-center">
          <div className="max-w-6xl w-full bg-slate-900/90 backdrop-blur-xl border border-slate-700/70 shadow-2xl rounded-2xl p-5 md:p-8 my-auto text-slate-200">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-5 mb-6 border-b border-slate-800 gap-4">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs font-black tracking-wider uppercase mb-2">
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>STATION: {currentStationUpper} &bull; TODAY&apos;S GENERATED FLIGHT REPORTS</span>
                </div>
                <h1 className="text-xl md:text-2xl font-black tracking-wider text-white uppercase flex items-center gap-2">
                  <Plane className="w-6 h-6 text-amber-400" />
                  <span>SAVED FLIGHT DATA ({todayStationSavedFlights.length})</span>
                </h1>
                <p className="text-xs text-slate-400 font-sans mt-0.5 uppercase tracking-wider">
                  REAL-TIME TODAY&apos;S FLIGHT LIST FOR STATION {currentStationUpper} &mdash; CLICK &ldquo;OPEN&rdquo; TO VIEW &amp; PRINT REPORTS (READ-ONLY)
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadStationSavedExcel}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs tracking-wider uppercase shadow-lg cursor-pointer flex items-center justify-center gap-2 transition-all"
                >
                  <Download className="w-4 h-4" />
                  <span>DOWNLOAD EXCEL ({todayStationSavedFlights.length})</span>
                </button>

                <button
                  type="button"
                  onClick={handlePreviousPage}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer border border-slate-700 uppercase"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>PREVIOUS</span>
                </button>

                <button
                  type="button"
                  onClick={() => navigateToPage('welcome')}
                  className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow uppercase"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>DASHBOARD</span>
                </button>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow uppercase"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>LOG OUT</span>
                </button>
              </div>
            </div>

            {/* Full-Day Summary KPIs Display Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6 font-sans">
              <div className="bg-slate-800/90 border border-slate-700 rounded-xl p-3.5 text-center">
                <div className="text-[11px] font-bold text-slate-400 uppercase">TOTAL FLIGHTS</div>
                <div className="text-2xl font-black text-amber-400 mt-1">{savedTotalFlights}</div>
              </div>
              <div className="bg-slate-800/90 border border-slate-700 rounded-xl p-3.5 text-center">
                <div className="text-[11px] font-bold text-slate-400 uppercase">TOTAL PASSENGERS</div>
                <div className="text-2xl font-black text-sky-400 mt-1">{savedTotalPax}</div>
              </div>
              <div className="bg-slate-800/90 border border-slate-700 rounded-xl p-3.5 text-center">
                <div className="text-[11px] font-bold text-slate-400 uppercase">TOTAL BAGGAGE</div>
                <div className="text-lg font-black text-emerald-400 mt-1">
                  {savedTotalBagKg} KG / {savedTotalBagPcs} PCS
                </div>
              </div>
              <div className="bg-slate-800/90 border border-slate-700 rounded-xl p-3.5 text-center">
                <div className="text-[11px] font-bold text-slate-400 uppercase">TOTAL CARGO</div>
                <div className="text-lg font-black text-indigo-300 mt-1">{savedTotalCargoKg} KG</div>
              </div>
              <div className="bg-slate-800/90 border border-rose-500/40 rounded-xl p-3.5 text-center">
                <div className="text-[11px] font-bold text-rose-300 uppercase">COUNTER NOSHOW</div>
                <div className="text-2xl font-black text-rose-400 mt-1">{savedTotalNoshow}</div>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-700 shadow-inner">
              <table className="w-full border-collapse text-xs md:text-sm font-sans uppercase">
                <thead>
                  <tr className="bg-slate-800 text-amber-300 border-b border-slate-700">
                    <th className="p-3.5 text-center font-bold whitespace-nowrap">SL</th>
                    <th className="p-3.5 text-left font-bold whitespace-nowrap">DATE</th>
                    <th className="p-3.5 text-left font-bold whitespace-nowrap">FLIGHT NO</th>
                    <th className="p-3.5 text-left font-bold whitespace-nowrap">ROUTE</th>
                    <th className="p-3.5 text-left font-bold whitespace-nowrap">A/C REG</th>
                    <th className="p-3.5 text-left font-bold whitespace-nowrap">CAPTAIN</th>
                    <th className="p-3.5 text-center font-bold whitespace-nowrap">STD / ATD / A/B</th>
                    <th className="p-3.5 text-center font-bold whitespace-nowrap">TOTAL PAX</th>
                    <th className="p-3.5 text-left font-bold whitespace-nowrap">PREPARED BY</th>
                    <th className="p-3.5 text-center font-bold whitespace-nowrap">OPTION</th>
                  </tr>
                </thead>
                <tbody>
                  {todayStationSavedFlights.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-10 text-center text-slate-400 font-bold">
                        NO FLIGHT REPORTS GENERATED TODAY FOR STATION {currentStationUpper}.
                      </td>
                    </tr>
                  ) : (
                    todayStationSavedFlights.map((r, index) => (
                      <tr
                        key={r.id}
                        className="border-b border-slate-800 hover:bg-slate-800/60 transition-colors"
                      >
                        <td className="p-3.5 text-center font-mono font-bold text-slate-400">
                          {String(index + 1).padStart(2, '0')}
                        </td>
                        <td className="p-3.5 font-mono font-bold text-slate-200 whitespace-nowrap">
                          {r.date}
                        </td>
                        <td className="p-3.5 font-black text-sky-300 whitespace-nowrap">
                          {r.flightNo}
                        </td>
                        <td className="p-3.5 font-bold text-white whitespace-nowrap">{r.route}</td>
                        <td className="p-3.5 font-bold text-slate-200 whitespace-nowrap">
                          {r.acReg} <span className="text-[11px] text-slate-400">({r.acType})</span>
                        </td>
                        <td className="p-3.5 font-bold text-white whitespace-nowrap">
                          {r.captain}
                        </td>
                        <td className="p-3.5 text-center font-mono text-slate-200 whitespace-nowrap">
                          {r.std || '--'} / {r.chocksOff || '--'} / {r.airborne || '--'}
                        </td>
                        <td className="p-3.5 text-center font-bold text-emerald-300 whitespace-nowrap">
                          {r.paxTotal || '0'}+{r.paxInfant || '0'}
                        </td>
                        <td className="p-3.5 font-bold text-indigo-300 whitespace-nowrap">
                          {r.preparedBy}
                          {r.usbaId && (
                            <span className="block text-[10px] text-slate-400">
                              USBA-{r.usbaId}
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => {
                              const loadedData = reconstructFormDataFromStoredReport(r);
                              setViewedSavedReport({
                                formData: loadedData,
                                user: {
                                  userName: r.preparedBy || userInfo.userName,
                                  usbaId: r.usbaId || userInfo.usbaId,
                                  stationName: r.station || userInfo.stationName,
                                },
                              });
                              navigateToPage('dual-report');
                            }}
                            className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs tracking-wider uppercase shadow-lg cursor-pointer inline-flex items-center gap-1.5 transition-all transform active:scale-95"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>OPEN</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
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

              <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2">
                <button
                  type="button"
                  onClick={handlePreviousPage}
                  className="px-3.5 py-2 text-xs rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 font-sans font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-sm uppercase"
                >
                  <ArrowLeft className="w-3.5 h-3.5 text-slate-300" />
                  <span>PREVIOUS</span>
                </button>

                <button
                  type="button"
                  onClick={() => navigateToPage('welcome')}
                  className="px-3.5 py-2 text-xs rounded-xl bg-indigo-600/80 hover:bg-indigo-500 text-white border border-indigo-400/40 font-sans font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-sm uppercase"
                >
                  <Navigation className="w-3.5 h-3.5 text-indigo-200" />
                  <span>DASHBOARD</span>
                </button>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-3.5 py-2 text-xs rounded-xl bg-rose-600/80 hover:bg-rose-500 text-white border border-rose-400/40 font-sans font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-sm uppercase"
                >
                  <LogOut className="w-3.5 h-3.5 text-rose-100" />
                  <span>LOG OUT</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const freshData: FlightFormData = {
                      ...INITIAL_FORM_DATA,
                      date: new Date().toISOString().split('T')[0],
                    };
                    setFormData(freshData);
                    localStorage.removeItem('usba_flight_form_data');
                    setHighlightRedBoxes(false);
                    setVisitedNoshowPnr(false);
                    setShowRedBoxWarningModal(false);
                    showToast('FORM CLEARED! READY FOR NEW DATA INPUT.');
                  }}
                  className="px-3.5 py-2 text-xs rounded-xl bg-cyan-600/80 hover:bg-cyan-500 text-white border border-cyan-400/40 font-sans font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-sm uppercase"
                  title="Clear all fields and reset form for new flight data input"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-cyan-100" />
                  <span>CLEAR FORM</span>
                </button>

                <button
                  type="button"
                  onClick={() => populateSampleData(currentPage === 'data-intl' ? 'intl' : 'dom')}
                  className="px-3.5 py-2 text-xs rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-sans font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm uppercase"
                  title="Populate test data with standard flight parameters"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>SAMPLE DATA</span>
                </button>
              </div>
            </div>

            {/* Inputs Grid */}
            <div
              onFocusCapture={handleGridFocusCapture}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs font-sans"
            >
              {/* Date */}
              <div className="flex flex-col">
                <label className="font-bold text-slate-300 mb-1 tracking-wider">DATE</label>
                <input
                  data-mandatory-key="date"
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
                    ref={flightNoInputRef}
                    data-mandatory-key="flightNo"
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
                  data-mandatory-key="acReg"
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
                    ref={acRegInputRef}
                    data-mandatory-key="acReg"
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
                <label
                  className={`font-bold mb-1 tracking-wider ${
                    highlightRedBoxes && isCaptainMissing ? 'text-red-500 font-black' : 'text-slate-300'
                  }`}
                >
                  CAPTAIN
                </label>
                <input
                  ref={captainInputRef}
                  data-mandatory-key="captain"
                  type="text"
                  list="captain-options"
                  placeholder="CAPTAIN NAME (E.G. AHMAD)"
                  value={formData.captain}
                  onChange={(e) => setFormData({ ...formData, captain: e.target.value.toUpperCase() })}
                  className={`p-2.5 rounded-xl text-white focus:outline-none text-sm uppercase ${
                    highlightRedBoxes && isCaptainMissing
                      ? 'border-2 border-red-500 ring-2 ring-red-500/60 bg-red-950/40 shadow-[0_0_15px_rgba(239,68,68,0.45)]'
                      : 'border border-slate-700 bg-slate-800/90 focus:border-amber-400'
                  }`}
                />
                <datalist id="captain-options">
                  {CAPTAIN_SUGGESTIONS.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>

              {/* CONFIGURE / CREW COUNT */}
              <div className="flex flex-col">
                <label
                  className={`font-bold mb-1 tracking-wider ${
                    highlightRedBoxes && isConfigureMissing ? 'text-red-500 font-black' : 'text-slate-300'
                  }`}
                >
                  CONFIGURE / CREW COUNT
                </label>
                <input
                  ref={configureInputRef}
                  data-mandatory-key="configure"
                  type="text"
                  placeholder="2/2"
                  value={formData.configure}
                  onChange={(e) => setFormData({ ...formData, configure: e.target.value.toUpperCase() })}
                  className={`p-2.5 rounded-xl text-white focus:outline-none text-sm uppercase ${
                    highlightRedBoxes && isConfigureMissing
                      ? 'border-2 border-red-500 ring-2 ring-red-500/60 bg-red-950/40 shadow-[0_0_15px_rgba(239,68,68,0.45)]'
                      : 'border border-slate-700 bg-slate-800/90 focus:border-amber-400'
                  }`}
                />
              </div>

              {/* OUTSTATION ONLY: ARRIVAL INFORMATION BORDERED SECTION (SKYBLUE BACKGROUND) */}
              {isOutstation && (
                <div className="md:col-span-full border-2 border-sky-300 bg-sky-500/35 backdrop-blur-md rounded-2xl p-4 md:p-5 shadow-[0_0_25px_rgba(56,189,248,0.3)]">
                  <div className="flex items-center gap-2 mb-3.5 pb-2 border-b border-sky-300/50">
                    <span className="w-6 h-6 rounded-lg bg-sky-400/30 border border-sky-200 flex items-center justify-center text-white">
                      <Plane className="w-3.5 h-3.5 rotate-90" />
                    </span>
                    <h3 className="text-sm md:text-base font-black tracking-widest text-sky-100 uppercase drop-shadow">
                      ARRIVAL INFORMATION
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* BOX: FLIGHT NO */}
                    <div className="flex flex-col">
                      <label className="font-bold text-sky-100 mb-1 tracking-wider uppercase">
                        FLIGHT NO
                      </label>
                      <input
                        type="text"
                        placeholder="E.G. BS-141"
                        value={formData.arrFlightNo || ''}
                        onChange={(e) => handleArrivalFlightNoChange(e.target.value)}
                        className="p-2.5 border border-sky-300/70 rounded-xl bg-slate-900/90 text-white focus:border-white focus:outline-none text-sm font-bold tracking-wider uppercase"
                      />
                    </div>

                    {/* BOX: ROUTE */}
                    <div className="flex flex-col">
                      <label className="font-bold text-sky-100 mb-1 tracking-wider uppercase">
                        ROUTE
                      </label>
                      <input
                        type="text"
                        placeholder="E.G. DAC-CXB"
                        value={formData.arrRoute || ''}
                        onChange={(e) =>
                          setFormData({ ...formData, arrRoute: e.target.value.toUpperCase() })
                        }
                        className="p-2.5 border border-sky-300/70 rounded-xl bg-slate-900/90 text-amber-300 focus:border-white focus:outline-none text-sm font-bold tracking-wider uppercase"
                      />
                    </div>

                    {/* 1ST BOX: STA (LT) */}
                    <div className="flex flex-col">
                      <label className="font-bold text-sky-100 mb-1 tracking-wider uppercase">
                        STA (LT)
                      </label>
                      <input
                        ref={staInputRef}
                        data-mandatory-key="sta"
                        type="text"
                        placeholder="1000"
                        maxLength={4}
                        value={formData.sta || ''}
                        onChange={(e) => handleTimeInput('sta', e.target.value)}
                        className="p-2.5 border border-sky-300/70 rounded-xl bg-slate-900/90 text-white focus:border-white focus:outline-none text-sm font-mono text-center tracking-wider font-bold"
                      />
                    </div>

                    {/* 2ND BOX: C/ON (LT) */}
                    <div className="flex flex-col">
                      <label className="font-bold text-sky-100 mb-1 tracking-wider uppercase">
                        C/ON (LT)
                      </label>
                      <input
                        ref={chocksOnInputRef}
                        data-mandatory-key="chocksOn"
                        type="text"
                        placeholder="0950"
                        maxLength={4}
                        value={formData.chocksOn || ''}
                        onChange={(e) => handleTimeInput('chocksOn', e.target.value)}
                        className="p-2.5 border border-sky-300/70 rounded-xl bg-slate-900/90 text-white focus:border-white focus:outline-none text-sm font-mono text-center tracking-wider font-bold"
                      />
                    </div>

                    {/* 3RD BOX: DOOR OPEN (LT) */}
                    <div className="flex flex-col">
                      <label className="font-bold text-sky-100 mb-1 tracking-wider uppercase">
                        DOOR OPEN (LT)
                      </label>
                      <input
                        ref={doorOpenInputRef}
                        data-mandatory-key="doorOpen"
                        type="text"
                        placeholder="0952"
                        maxLength={4}
                        value={formData.doorOpen || ''}
                        onChange={(e) => handleTimeInput('doorOpen', e.target.value)}
                        className="p-2.5 border border-sky-300/70 rounded-xl bg-slate-900/90 text-white focus:border-white focus:outline-none text-sm font-mono text-center tracking-wider font-bold"
                      />
                    </div>

                    {/* 4TH BOX: ARRIVAL STATUS */}
                    <div className="flex flex-col">
                      <label className="font-bold text-sky-100 mb-1 tracking-wider uppercase">
                        ARRIVAL STATUS
                      </label>
                      <input
                        data-mandatory-key="std"
                        type="text"
                        value={formData.arrivalStatus || 'FLIGHT ON TIME ARRIVED'}
                        onChange={(e) =>
                          setFormData({ ...formData, arrivalStatus: e.target.value.toUpperCase() })
                        }
                        className="p-2.5 border border-sky-300/80 rounded-xl bg-slate-900/95 text-sky-300 font-bold text-sm tracking-wide uppercase"
                      />
                    </div>

                    {/* 5TH BOX: TOTAL PAX (WITHIN 2 BOX LIKE 70+02) */}
                    <div className="flex flex-col">
                      <label className="font-bold text-sky-100 mb-1 tracking-wider uppercase">
                        TOTAL PAX
                      </label>
                      <div className="flex items-center gap-1.5 bg-slate-900/90 p-1.5 border border-sky-300/70 rounded-xl">
                        <input
                          type="number"
                          placeholder="70"
                          value={formData.arrPaxAdult || ''}
                          onChange={(e) =>
                            setFormData({ ...formData, arrPaxAdult: e.target.value })
                          }
                          className="w-full min-w-0 p-1.5 border border-sky-400/50 rounded-lg text-center text-sm font-bold bg-slate-950 text-white focus:border-white focus:outline-none"
                        />
                        <span className="font-black text-sky-200 text-base px-0.5">+</span>
                        <input
                          type="text"
                          placeholder="02"
                          value={formData.arrPaxInfant || ''}
                          onChange={(e) =>
                            setFormData({ ...formData, arrPaxInfant: e.target.value.replace(/\D/g, '') })
                          }
                          className="w-20 min-w-0 p-1.5 border border-sky-400/50 rounded-lg text-center text-sm font-bold bg-slate-950 text-white focus:border-white focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* 6TH BOX: BAGGAGE (2 BOX IN SINGLE BOX TYPE LIKE TOTAL PAX) */}
                    <div className="flex flex-col">
                      <label className="font-bold text-sky-100 mb-1 tracking-wider uppercase">
                        BAGGAGE
                      </label>
                      <div className="flex items-center gap-1.5 bg-slate-900/90 p-1.5 border border-sky-300/70 rounded-xl">
                        <input
                          type="number"
                          placeholder="Weight (KG)"
                          value={formData.arrBaggageWeight || ''}
                          onChange={(e) =>
                            setFormData({ ...formData, arrBaggageWeight: e.target.value })
                          }
                          className="w-full min-w-0 p-1.5 border border-sky-400/50 rounded-lg text-center text-sm font-bold bg-slate-950 text-white focus:border-white focus:outline-none"
                        />
                        <span className="font-black text-sky-200 text-sm px-0.5">/</span>
                        <input
                          type="number"
                          placeholder="PCS"
                          value={formData.arrBaggagePcs || ''}
                          onChange={(e) =>
                            setFormData({ ...formData, arrBaggagePcs: e.target.value })
                          }
                          className="w-20 min-w-0 p-1.5 border border-sky-400/50 rounded-lg text-center text-sm font-bold bg-slate-950 text-white focus:border-white focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* 7TH BOX: CARGO (2 BOX IN SINGLE BOX TYPE LIKE BAGGAGE) */}
                    <div className="flex flex-col">
                      <label className="font-bold text-sky-100 mb-1 tracking-wider uppercase">
                        CARGO
                      </label>
                      <div className="flex items-center gap-1.5 bg-slate-900/90 p-1.5 border border-sky-300/70 rounded-xl">
                        <input
                          type="number"
                          placeholder="Weight (KG)"
                          value={formData.arrCargoWeight || ''}
                          onChange={(e) =>
                            setFormData({ ...formData, arrCargoWeight: e.target.value })
                          }
                          className="w-full min-w-0 p-1.5 border border-sky-400/50 rounded-lg text-center text-sm font-bold bg-slate-950 text-white focus:border-white focus:outline-none"
                        />
                        <span className="font-black text-sky-200 text-sm px-0.5">/</span>
                        <input
                          type="number"
                          placeholder="PCS"
                          value={formData.arrCargoPcs || ''}
                          onChange={(e) =>
                            setFormData({ ...formData, arrCargoPcs: e.target.value })
                          }
                          className="w-20 min-w-0 p-1.5 border border-sky-400/50 rounded-lg text-center text-sm font-bold bg-slate-950 text-white focus:border-white focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* 8TH BOX: MAIL (HOW MANY) */}
                    <div className="flex flex-col">
                      <label className="font-bold text-sky-100 mb-1 tracking-wider uppercase">
                        MAIL
                      </label>
                      <input
                        type="number"
                        placeholder="HOW MANY"
                        value={formData.arrMail || ''}
                        onChange={(e) => setFormData({ ...formData, arrMail: e.target.value })}
                        className="p-2.5 border border-sky-300/70 rounded-xl bg-slate-900/90 text-white focus:border-white focus:outline-none text-sm font-bold"
                      />
                    </div>

                    {/* 9TH BOX: VIP (HOW MANY) */}
                    <div className="flex flex-col">
                      <label className="font-bold text-sky-100 mb-1 tracking-wider uppercase">
                        VIP
                      </label>
                      <input
                        type="number"
                        placeholder="HOW MANY"
                        value={formData.arrVip || ''}
                        onChange={(e) => setFormData({ ...formData, arrVip: e.target.value })}
                        className="p-2.5 border border-sky-300/70 rounded-xl bg-slate-900/90 text-white focus:border-white focus:outline-none text-sm font-bold"
                      />
                    </div>

                    {/* 10TH BOX: CIP */}
                    <div className="flex flex-col">
                      <label className="font-bold text-sky-100 mb-1 tracking-wider uppercase">
                        CIP
                      </label>
                      <input
                        type="number"
                        placeholder="HOW MANY"
                        value={formData.arrCip || ''}
                        onChange={(e) => setFormData({ ...formData, arrCip: e.target.value })}
                        className="p-2.5 border border-sky-300/70 rounded-xl bg-slate-900/90 text-white focus:border-white focus:outline-none text-sm font-bold"
                      />
                    </div>

                    {/* 11TH BOX: MAAS (HOW MANY) */}
                    <div className="flex flex-col">
                      <label className="font-bold text-sky-100 mb-1 tracking-wider uppercase">
                        MAAS
                      </label>
                      <input
                        type="number"
                        placeholder="HOW MANY"
                        value={formData.arrMaas || ''}
                        onChange={(e) => setFormData({ ...formData, arrMaas: e.target.value })}
                        className="p-2.5 border border-sky-300/70 rounded-xl bg-slate-900/90 text-white focus:border-white focus:outline-none text-sm font-bold"
                      />
                    </div>

                    {/* 12TH BOX: PAX RECEIVING (AFTER MAAS) */}
                    <div className="flex flex-col">
                      <label className="font-bold text-sky-100 mb-1 tracking-wider uppercase">
                        PAX RECEIVING
                      </label>
                      <input
                        type="text"
                        placeholder="OFFICER / STAFF NAME"
                        value={formData.arrPaxReceiving || ''}
                        onChange={(e) =>
                          setFormData({ ...formData, arrPaxReceiving: e.target.value.toUpperCase() })
                        }
                        className="p-2.5 border border-sky-300/70 rounded-xl bg-slate-900/90 text-white focus:border-white focus:outline-none text-sm font-bold uppercase"
                      />
                    </div>

                    {/* 13TH BOX: REMARKS */}
                    <div className="flex flex-col sm:col-span-2 lg:col-span-2">
                      <label className="font-bold text-sky-100 mb-1 tracking-wider uppercase">
                        REMARKS
                      </label>
                      <input
                        type="text"
                        placeholder="ENTER ARRIVAL REMARKS"
                        value={formData.arrRemarks || ''}
                        onChange={(e) =>
                          setFormData({ ...formData, arrRemarks: e.target.value.toUpperCase() })
                        }
                        className="p-2.5 border border-sky-300/70 rounded-xl bg-slate-900/90 text-white focus:border-white focus:outline-none text-sm font-bold uppercase"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* DEPARTURE INFORMATION (Bordered section for Outstation, seamless grid for DAC) */}
              <div
                className={
                  isOutstation
                    ? 'md:col-span-full border-2 border-amber-500/50 bg-slate-900/70 rounded-2xl p-4 md:p-5 shadow-xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
                    : 'contents'
                }
              >
                {isOutstation && (
                  <div className="col-span-full flex items-center gap-2 mb-1 pb-2 border-b border-amber-500/30">
                    <span className="w-6 h-6 rounded-lg bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-400">
                      <Plane className="w-3.5 h-3.5" />
                    </span>
                    <h3 className="text-sm md:text-base font-black tracking-widest text-amber-400 uppercase">
                      DEPARTURE INFORMATION
                    </h3>
                  </div>
                )}

              {/* STD */}
              <div className="flex flex-col">
                <label className="font-bold text-slate-300 mb-1 tracking-wider">STD (LT)</label>
                <input
                  ref={stdInputRef}
                  data-mandatory-key="std"
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
                  ref={doorClosedInputRef}
                  data-mandatory-key="doorClosed"
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
                  ref={chocksOffInputRef}
                  data-mandatory-key="chocksOff"
                  type="text"
                  placeholder="0959"
                  maxLength={4}
                  value={formData.chocksOff}
                  onChange={(e) => handleTimeInput('chocksOff', e.target.value)}
                  className="p-2.5 border border-slate-700 rounded-xl bg-slate-800/90 text-white focus:border-amber-400 focus:outline-none text-sm font-mono text-center tracking-wider font-bold"
                />
              </div>

              {/* CONDITIONAL DELAY REASON BOX (Placed immediately after CHOCKS OFF (LT)) */}
              {showDelayBox && (
                <div
                  className={`flex flex-col md:col-span-full p-4 rounded-xl animate-fadeIn shadow-lg ${
                    highlightRedBoxes && isDelayReasonMissing
                      ? 'bg-red-950/50 border-2 border-red-500 ring-2 ring-red-500/60 shadow-[0_0_15px_rgba(239,68,68,0.45)]'
                      : 'bg-amber-500/15 border-2 border-amber-500/60'
                  }`}
                >
                  <div
                    className={`flex items-center gap-2 mb-2 font-black text-xs uppercase tracking-wider ${
                      highlightRedBoxes && isDelayReasonMissing ? 'text-red-400' : 'text-amber-300'
                    }`}
                  >
                    <AlertTriangle
                      className={`w-4 h-4 animate-pulse ${
                        highlightRedBoxes && isDelayReasonMissing ? 'text-red-400' : 'text-amber-400'
                      }`}
                    />
                    <span>FLIGHT DELAY DETECTED &mdash; ENTER DELAY REASON (REQUIRED)</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      ref={delayReasonInputRef}
                      data-mandatory-key="delayReason"
                      type="text"
                      list="delay-reason-options"
                      placeholder="E.G. LAST PAX ACCEPTANCE, LATE INBOUND AIRCRAFT, ATC CLEARANCE"
                      value={formData.delayReason || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, delayReason: e.target.value.toUpperCase() })
                      }
                      className={`p-2.5 flex-1 rounded-xl text-white text-sm font-bold uppercase focus:outline-none placeholder:text-slate-400 ${
                        highlightRedBoxes && isDelayReasonMissing
                          ? 'border-2 border-red-500 ring-2 ring-red-500/60 bg-red-950/60'
                          : 'border-2 border-amber-500 bg-slate-800 focus:ring-2 focus:ring-amber-400'
                      }`}
                    />
                    <datalist id="delay-reason-options">
                      {COMMON_DELAY_REASONS.map((r) => (
                        <option key={r} value={r} />
                      ))}
                    </datalist>
                  </div>
                </div>
              )}

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
                  ref={airborneInputRef}
                  data-mandatory-key="airborne"
                  type="text"
                  placeholder="1010"
                  maxLength={4}
                  value={formData.airborne}
                  onChange={(e) => handleTimeInput('airborne', e.target.value)}
                  className="p-2.5 border border-slate-700 rounded-xl bg-slate-800/90 text-white focus:border-amber-400 focus:outline-none text-sm font-mono text-center tracking-wider font-bold"
                />
              </div>

              {/* DEPARTURE STATUS (CALCULATED - READ ONLY) */}
              <div className="flex flex-col">
                <label className="font-bold text-slate-300 mb-1 tracking-wider">
                  DEPARTURE STATUS (CALCULATED)
                </label>
                <input
                  type="text"
                  readOnly
                  value={formData.departureStatus}
                  className="p-2.5 border border-slate-700 rounded-xl bg-slate-900/95 text-amber-300 font-bold text-sm tracking-wide uppercase cursor-not-allowed select-none"
                />
              </div>

              {/* FLIGHT LOAD (BOOKED) */}
              <div className="flex flex-col">
                <label className="font-bold text-slate-300 mb-1 tracking-wider">FLIGHT LOAD</label>
                <input
                  ref={flightLoadInputRef}
                  data-mandatory-key="flightLoad"
                  type="number"
                  placeholder="Booked Pax Figure"
                  value={formData.flightLoad}
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
                    ref={paxMaleInputRef}
                    data-mandatory-key="paxMale"
                    type="number"
                    placeholder="M"
                    value={formData.paxMale}
                    onChange={(e) => setFormData({ ...formData, paxMale: e.target.value })}
                    className="w-16 p-2 border border-slate-600 rounded-lg text-center text-sm font-bold bg-slate-900 text-white focus:outline-none"
                  />
                  <span className="font-bold text-slate-400">+</span>
                  <input
                    ref={paxFemaleInputRef}
                    data-mandatory-key="paxFemale"
                    type="number"
                    placeholder="F"
                    value={formData.paxFemale}
                    onChange={(e) => setFormData({ ...formData, paxFemale: e.target.value })}
                    className="w-16 p-2 border border-slate-600 rounded-lg text-center text-sm font-bold bg-slate-900 text-white focus:outline-none"
                  />
                  <span className="font-bold text-slate-400">+</span>
                  <input
                    ref={paxChildInputRef}
                    data-mandatory-key="paxChild"
                    type="number"
                    placeholder="C"
                    value={formData.paxChild}
                    onChange={(e) => setFormData({ ...formData, paxChild: e.target.value })}
                    className="w-16 p-2 border border-slate-600 rounded-lg text-center text-sm font-bold bg-slate-900 text-white focus:outline-none"
                  />
                  <span className="font-bold text-slate-400">+</span>
                  <input
                    ref={paxInfantInputRef}
                    data-mandatory-key="paxInfant"
                    type="number"
                    placeholder="I"
                    value={formData.paxInfant}
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
                    ref={fuelUpliftInputRef}
                    data-mandatory-key="fuelUplift"
                    type="number"
                    placeholder="5000"
                    value={formData.fuelUplift}
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
                <label
                  className={`font-bold mb-1 tracking-wider ${
                    highlightRedBoxes && isBaggageMissing ? 'text-red-500 font-black' : 'text-slate-300'
                  }`}
                >
                  BAGGAGE
                </label>
                <div className="flex gap-1.5">
                  <input
                    ref={baggageWeightInputRef}
                    data-mandatory-key="baggageWeight"
                    type="number"
                    placeholder="Weight (KG)"
                    value={formData.baggageWeight}
                    onChange={(e) => setFormData({ ...formData, baggageWeight: e.target.value })}
                    className={`p-2.5 flex-1 rounded-xl text-white focus:outline-none text-sm ${
                      highlightRedBoxes && isBaggageWeightMissing
                        ? 'border-2 border-red-500 ring-2 ring-red-500/60 bg-red-950/40 shadow-[0_0_15px_rgba(239,68,68,0.45)]'
                        : 'border border-slate-700 bg-slate-800/90 focus:border-amber-400'
                    }`}
                  />
                  <input
                    ref={baggagePcsInputRef}
                    data-mandatory-key="baggagePcs"
                    type="number"
                    placeholder="PCS"
                    value={formData.baggagePcs}
                    onChange={(e) => setFormData({ ...formData, baggagePcs: e.target.value })}
                    className={`p-2.5 w-20 rounded-xl text-white focus:outline-none text-sm text-center ${
                      highlightRedBoxes && isBaggagePcsMissing
                        ? 'border-2 border-red-500 ring-2 ring-red-500/60 bg-red-950/40 shadow-[0_0_15px_rgba(239,68,68,0.45)]'
                        : 'border border-slate-700 bg-slate-800/90 focus:border-amber-400'
                    }`}
                  />
                </div>
              </div>

              {/* CARGO */}
              <div className="flex flex-col">
                <label className="font-bold text-slate-300 mb-1 tracking-wider">CARGO</label>
                <div className="flex gap-1.5">
                  <input
                    ref={cargoWeightInputRef}
                    data-mandatory-key="cargoWeight"
                    type="number"
                    placeholder="Weight (KG)"
                    value={formData.cargoWeight}
                    onChange={(e) => setFormData({ ...formData, cargoWeight: e.target.value })}
                    className="p-2.5 flex-1 border border-slate-700 rounded-xl bg-slate-800/90 text-white focus:border-amber-400 focus:outline-none text-sm"
                  />
                  <input
                    ref={cargoPcsInputRef}
                    data-mandatory-key="cargoPcs"
                    type="number"
                    placeholder="PCS"
                    value={formData.cargoPcs}
                    onChange={(e) => setFormData({ ...formData, cargoPcs: e.target.value })}
                    className="p-2.5 w-20 border border-slate-700 rounded-xl bg-slate-800/90 text-white focus:border-amber-400 focus:outline-none text-sm text-center"
                  />
                </div>
              </div>

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
              <div className="flex flex-col">
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
                    className="flex-1 p-2.5 border border-slate-700 rounded-xl bg-slate-800/90 text-white focus:border-amber-400 focus:outline-none text-sm uppercase"
                  />
                </div>
              </div>

              {/* FIRE ARMS */}
              <div className="flex flex-col">
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
                    className="flex-1 p-2.5 border border-amber-500/50 rounded-xl bg-slate-800/90 text-white focus:border-amber-400 focus:outline-none text-sm uppercase"
                  />
                </div>
              </div>

              {/* WCHR */}
              <div className="flex flex-col">
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
                    className="flex-1 p-2.5 border border-slate-700 rounded-xl bg-slate-800/90 text-white focus:border-amber-400 focus:outline-none text-sm uppercase"
                  />
                </div>
              </div>

              {/* WCHC */}
              <div className="flex flex-col">
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
                    className="flex-1 p-2.5 border border-slate-700 rounded-xl bg-slate-800/90 text-white focus:border-amber-400 focus:outline-none text-sm uppercase"
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
                  className="p-2.5 border border-rose-500/70 rounded-xl bg-slate-800/90 text-rose-300 font-black focus:border-rose-400 focus:outline-none text-sm uppercase"
                />
              </div>

              {/* NOSHOW PNR * */}
              <div className="flex flex-col">
                <label
                  className={`font-black mb-1 tracking-wider uppercase ${
                    highlightRedBoxes && isNoshowPnrMissing ? 'text-red-500' : 'text-red-400'
                  }`}
                >
                  NOSHOW PNR *
                </label>
                <input
                  ref={noshowPnrInputRef}
                  type="text"
                  placeholder="6-DIGIT PNR (E.G. 024UGD, 03ERUF)"
                  value={formData.noshowPnr || ''}
                  onFocus={() => {
                    setVisitedNoshowPnr(true);
                  }}
                  onBlur={() => {
                    setVisitedNoshowPnr(true);
                    setHighlightRedBoxes(true);
                  }}
                  onChange={(e) => {
                    const upper = e.target.value.toUpperCase();
                    setFormData({ ...formData, noshowPnr: upper });
                  }}
                  className={`p-2.5 rounded-xl focus:outline-none text-sm uppercase font-black ${
                    highlightRedBoxes && isNoshowPnrMissing
                      ? 'border-2 border-red-500 ring-2 ring-red-500/60 bg-red-950/50 text-red-300 placeholder:text-red-300/60 shadow-[0_0_15px_rgba(239,68,68,0.5)]'
                      : 'border border-slate-700 bg-slate-800/90 text-white placeholder:text-slate-400 focus:border-amber-400'
                  }`}
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
                    setVisitedNoshowPnr(true);
                    setHighlightRedBoxes(true);
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
                    setVisitedNoshowPnr(true);
                    setHighlightRedBoxes(true);
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
                onClick={handlePreviousPage}
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
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl md:text-2xl font-bold tracking-wider text-white uppercase flex items-center gap-2">
                  <Plane className="w-5 h-5 text-amber-400" />
                  <span>US-BANGLA AIRLINES &mdash; FLIGHT REPORTS</span>
                </h1>
                {isReadOnlySavedReport && (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 text-[11px] font-sans font-black tracking-wider uppercase">
                    SAVED REPORT (VIEW &amp; PRINT ONLY)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 font-sans mt-0.5">
                FLIGHT:{' '}
                <span className="font-bold text-amber-300">
                  BS-{activeReportFormData.flightNoSuffix || 'XXX'}
                </span>{' '}
                ({activeReportFormData.route || 'N/A'}) &bull; PREPARED BY:{' '}
                {activeReportUser.userName} &bull; STATION: {activeReportUser.stationName}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handlePreviousPage}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all shadow-sm border border-slate-700 uppercase"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{isReadOnlySavedReport ? 'BACK TO SAVED LIST' : 'PREVIOUS'}</span>
              </button>

              <button
                onClick={() => navigateToPage('welcome')}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all shadow-sm uppercase"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>DASHBOARD</span>
              </button>

              <button
                onClick={() => copyToClipboard(departureMessage, 'Flight Departure Text Message')}
                className="px-4 py-2 rounded-xl bg-sky-700/80 hover:bg-sky-600 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>COPY TEXT</span>
              </button>

              <button
                onClick={() => printSection('all')}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>PRINT REPORT (A4)</span>
              </button>

              {!isReadOnlySavedReport && (
                <button
                  onClick={() => setShowNewReportModal(true)}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all shadow-sm uppercase"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>NEW REPORT</span>
                </button>
              )}

              <button
                onClick={handleLogout}
                className="px-3.5 py-2 rounded-xl bg-rose-600/80 hover:bg-rose-500 text-white border border-rose-400/40 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all shadow-sm uppercase"
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
              <DeparturePhotoCard data={activeReportFormData} user={activeReportUser} />
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
                  data={activeReportFormData}
                  user={activeReportUser}
                  mode={reportType}
                />
              </div>
            </div>

            {/* Panel 3: Official Arrival Report Table (Outstation Only - Printable A4 - Generated right after Official Flight Departure Report) */}
            {activeIsOutstation && (
              <div
                id="arrival-report-printable"
                className="bg-slate-900/80 backdrop-blur-xl border border-sky-500/60 rounded-2xl p-5 shadow-2xl flex flex-col overflow-hidden"
              >
                <div className="no-print flex justify-between items-center border-b border-slate-800 pb-3 mb-4">
                  <h2 className="text-base font-bold tracking-wider text-white uppercase flex items-center gap-2">
                    <FileText className="w-4 h-4 text-sky-400" />
                    <span>OFFICIAL FLIGHT ARRIVAL REPORT</span>
                  </h2>

                  <button
                    onClick={() => printSection('arrival')}
                    className="px-3.5 py-1.5 rounded-xl bg-sky-600/80 hover:bg-sky-500 text-white font-sans text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shadow"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>PRINT A4 TABLE</span>
                  </button>
                </div>

                <div className="print-table-scroll flex-1 overflow-y-auto">
                  <ArrivalReportTable
                    data={activeReportFormData}
                    user={activeReportUser}
                    mode={reportType}
                  />
                </div>
              </div>
            )}
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
          setCurrentPage={navigateToPage}
          onPrevious={handlePreviousPage}
          onDashboard={() => navigateToPage('welcome')}
          onLogout={handleLogout}
          userInfo={userInfo}
          showToast={showToast}
        />
      )}

      {/* ================= ADMIN ONLY PAGES ================= */}
      {(currentPage === 'admin-login' ||
        currentPage === 'admin-dashboard' ||
        currentPage === 'admin-saved-flight' ||
        currentPage === 'admin-saved-maas' ||
        currentPage === 'admin-logs') && (
        <AdminModule
          currentPage={currentPage}
          setCurrentPage={navigateToPage}
          onPrevious={handlePreviousPage}
          onDashboard={() => navigateToPage('welcome')}
          onLogout={handleLogout}
          userInfo={userInfo}
          showToast={showToast}
          onLoadFlightReport={(loadedData, reportUser) => {
            setViewedSavedReport({
              formData: loadedData,
              user: reportUser || userInfo,
            });
            navigateToPage('dual-report');
          }}
        />
      )}

      {/* Real-Time Super Admin Notice Popup Modal (Shows immediately without page refresh) */}
      {liveNotice &&
        liveNotice.active &&
        liveNotice.message &&
        liveNotice.timestamp > dismissedNoticeTs && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fadeIn">
            <div className="bg-slate-900 border-2 border-amber-500 rounded-3xl max-w-lg w-full p-7 text-center shadow-2xl relative uppercase">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border-2 border-amber-400 text-amber-400 flex items-center justify-center mx-auto mb-4 animate-bounce">
                <Megaphone className="w-9 h-9" />
              </div>
              <h3 className="text-xl font-black text-amber-400 uppercase tracking-widest mb-2">
                URGENT SUPER ADMIN NOTICE
              </h3>
              <div className="bg-amber-500/15 border-2 border-amber-500/50 rounded-2xl p-5 my-4">
                <p className="text-base md:text-lg font-black text-white uppercase tracking-wider leading-relaxed">
                  ADMIN MESSAGE : {liveNotice.message}
                </p>
              </div>
              <p className="text-[11px] text-slate-400 mb-6 uppercase tracking-wider">
                CIRCULATED BY {liveNotice.createdBy || 'SUPER ADMIN'} &bull;{' '}
                {new Date(liveNotice.timestamp || liveNotice.createdAt).toLocaleTimeString()}
              </p>
              <button
                type="button"
                onClick={() => {
                  setDismissedNoticeTs(liveNotice.timestamp);
                  localStorage.setItem('usba_dismissed_notice_ts', String(liveNotice.timestamp));
                }}
                className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-black tracking-widest text-sm uppercase shadow-xl transition-all cursor-pointer transform active:scale-95"
              >
                ACKNOWLEDGE &amp; CONTINUE
              </button>
            </div>
          </div>
        )}

      {/* Red Marked Box Warning Modal Popup ("OFFICER, PLEASE FILL UP THE RED MARKED BOX") */}
      {showRedBoxWarningModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
          <div className="bg-slate-900 border-2 border-red-500 rounded-3xl max-w-md w-full p-7 text-center shadow-2xl relative uppercase">
            <div className="w-16 h-16 rounded-2xl bg-red-500/20 border-2 border-red-400 text-red-400 flex items-center justify-center mx-auto mb-4 animate-bounce">
              <AlertTriangle className="w-9 h-9" />
            </div>
            <h3 className="text-xl font-black text-red-400 uppercase tracking-widest mb-2">
              REQUIRED BOX MISSING!
            </h3>
            <div className="bg-red-500/15 border-2 border-red-500/50 rounded-2xl p-4 my-4">
              <p className="text-base font-black text-white uppercase tracking-wider leading-snug">
                OFFICER, PLEASE FILL UP THE RED MARKED BOX
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowRedBoxWarningModal(false);
                setTimeout(() => {
                  focusFirstRedBox();
                }, 100);
              }}
              className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-400 hover:to-rose-500 text-white font-black tracking-widest text-sm uppercase shadow-xl transition-all cursor-pointer transform active:scale-95"
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
