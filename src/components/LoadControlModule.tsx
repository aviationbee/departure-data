import React, { useState, useEffect, useRef } from 'react';
import { UserInfo, FlightFormData } from '../types';
import { findRouteByFlightNo, ROUTE_MAP as AVIATION_ROUTE_MAP, AIRPORT_NAMES } from '../data/aviationData';
import {
  saveFlightReportToCloud,
  deleteFlightReportFromCloud,
  logUserActivity,
  StoredFlightReport,
} from '../firebase';
import {
  ArrowLeft,
  Navigation,
  Printer,
  Copy,
  RotateCcw,
  Plane,
  FileText,
  Sliders,
  CheckCircle,
  FolderOpen,
  Edit3,
  MapPin,
} from 'lucide-react';

export const STATION_OPTIONS = [
  { code: 'DAC', name: 'DAC - DHAKA' },
  { code: 'SPD', name: 'SPD - SAIDPUR' },
  { code: 'CXB', name: "CXB - COX'S BAZAR" },
  { code: 'CGP', name: 'CGP - CHATTOGRAM' },
  { code: 'RJH', name: 'RJH - RAJSHAHI' },
  { code: 'JSR', name: 'JSR - JASHORE' },
  { code: 'BZL', name: 'BZL - BARISHAL' },
  { code: 'ZYL', name: 'ZYL - SYLHET' },
];

export function extractStationCode(stn?: string): string {
  if (!stn) return 'DAC';
  const clean = stn.trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(clean)) return clean;
  const match = clean.match(/^([A-Z]{3})\b/);
  if (match) return match[1];
  for (const [code, name] of Object.entries(AIRPORT_NAMES)) {
    if (clean.includes(code) || clean.includes(name.toUpperCase())) {
      return code;
    }
  }
  return clean.slice(0, 3) || 'DAC';
}

interface Props {
  userInfo: UserInfo;
  onBackToDashboard: () => void;
  onGoToSavedFlights: () => void;
  showToast: (msg: string) => void;
  editReport?: StoredFlightReport | null;
  initialViewMode?: 'input' | 'dual-report';
  onClearEditReport?: () => void;
  onUpdateStation?: (stationCode: string) => void;
}

const ROUTE_MAP: Record<string, number[]> = {
  'DAC-CGP': [101, 103, 105, 107, 109, 111, 113, 115, 117, 119],
  'DAC-CXB': [141, 143, 145, 147, 149, 151, 153, 155, 157, 159],
  'DAC-CCU': [201, 203],
  'DAC-SIN': [307, 309],
  'DAC-ZYL': [531, 533, 535, 537, 539],
  'DAC-JSR': [121, 123, 125, 127, 129],
  'DAC-RJH': [161, 163, 165, 167, 169],
  'DAC-BZL': [171, 173, 175, 177, 179],
  'DAC-SPD': [181, 183, 185, 187, 189, 191, 193, 195, 197, 199],
  'DAC-MAA': [205, 207, 209],
  'DAC-BKK': [217, 219],
  'DAC-KUL': [315, 317, 319],
  'DAC-AUH': [349, 351],
  'DAC-DOH': [333, 335],
  'DAC-MCT': [321, 323],
  'DAC-SHJ': [345, 347],
  'DAC-CAN': [325, 327],
  'DAC-DXB': [341, 343],
  'DAC-JED': [361, 363],
  'DAC-RUH': [381, 383],
  'DAC-MLE': [337, 339],
};

export function getRouteForFlightNo(flightNoStr: string, station?: string): string {
  const cleanNum = flightNoStr.replace(/\D/g, '');
  const num = parseInt(cleanNum, 10);
  if (isNaN(num)) return '';

  let standardRoute = '';
  for (const [rKey, nums] of Object.entries(ROUTE_MAP)) {
    if (nums.includes(num)) {
      standardRoute = rKey;
      break;
    }
  }

  if (!standardRoute) {
    for (const [rKey, nums] of Object.entries(AVIATION_ROUTE_MAP)) {
      if (nums.includes(num)) {
        standardRoute = rKey;
        break;
      }
    }
  }

  if (!standardRoute) {
    standardRoute = findRouteByFlightNo(cleanNum);
  }

  if (!standardRoute) return '';

  const parts = standardRoute.split('-').map((s) => s.trim().toUpperCase());
  const origin = parts[0];
  const dest = parts.length > 1 ? parts[1] : parts[0];
  const userStn = extractStationCode(station);

  // If user station is the destination of a domestic flight from DAC (e.g. flight 141 DAC-CXB for officer at CXB),
  // retain DAC-CXB so inbound domestic flight stays accurate
  if (userStn === dest && origin === 'DAC') {
    return standardRoute;
  }

  // Otherwise, route departure station is the officer's active station (e.g. SPD-DXB, CXB-DXB, CGP-CCU, DAC-DXB)
  return `${userStn}-${dest}`;
}

const AC_TYPE_MAP = {
  atr: ['AKG', 'AKK', 'AKH', 'AKI', 'AKJ', 'AKL', 'AKM', 'AKO', 'AKP'],
  boeing: ['AJG', 'AJH', 'AJE', 'AJF'],
  airbus: ['ALA', 'ALB', 'ALD', 'SXA'],
};

const SPECIAL_REG_MAP: Record<string, { type: string }> = {
  PKBBG: { type: 'BOEING 737' },
  BBG: { type: 'BOEING 737' },
  PKBBH: { type: 'BOEING 737' },
  BBH: { type: 'BOEING 737' },
  '9HSAU': { type: 'BOEING 737' },
  SAU: { type: 'BOEING 737' },
  HSSXA: { type: 'AIRBUS 320' },
  SXA: { type: 'AIRBUS 320' },
};

function formatDate(dateString: string, format: 'DDMONYY' | 'DDMON' | 'DD' = 'DDMONYY'): string {
  if (!dateString) return 'N/A';
  const date = new Date(dateString + 'T00:00:00Z');
  if (isNaN(date.getTime())) return 'N/A';
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = date.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' }).toUpperCase();
  const year = date.getUTCFullYear().toString().slice(-2);
  if (format === 'DDMON') return `${day}${month}`;
  if (format === 'DD') return day;
  return `${day}${month}${year}`;
}

function getSeatConfig(regInput: string): string {
  const reg = regInput.toUpperCase();
  if (['SXA', 'HSSXA'].includes(reg)) return 'C0Y180';
  if (['ALA', 'ALB', 'ALD'].includes(reg)) return 'C0Y436';
  if (['AJG', 'AJH', 'AJE', 'AJF', 'SAU', '9HSAU', 'BBH', 'PKBBH'].includes(reg))
    return 'C0Y189';
  if (['BBG', 'PKBBG'].includes(reg)) return 'C0Y186';
  if (reg === 'AKO') return 'C0Y78';
  if (['AKG', 'AKK', 'AKH', 'AKI', 'AKJ', 'AKL', 'AKM', 'AKP'].includes(reg))
    return 'C0Y72';
  return 'C0Y189';
}

interface LdmFormData {
  date: string;
  flightNoSuffix: string;
  route: string;
  acRegSuffix: string;
  acType: string;
  captain: string;
  configure: string;
  std: string;
  doorClosed: string;
  chocksOff: string;
  airborne: string;
  departureStatus: string;
  boardingGate: string;
  docIn: string;
  docOut: string;
  fuelUplift: string;
  paxMale: string;
  paxFemale: string;
  paxChild: string;
  paxInfant: string;
  paxTotal: string;
  baggageWeight: string;
  baggagePcs: string;
  baggageComNo: string;
  cargoWeight: string;
  cargoPcs: string;
  cargoComNo: string;
  crewBagPcs: string;
  crewBagComNo: string;
  totalWeight: string;
  distB1: string;
  distB2: string;
  distB3: string;
  distB4: string;
  distA1: string;
  distA2: string;
  distA3: string;
  distA4: string;
  distA5: string;
  distAtrFwr: string;
  distAtrFwl: string;
  distAtrAft: string;
  status: string;
  mail: string;
  counterNoshow: string;
  gateNoShow: string;
  selfOffload: string;
  refused: string;
  immigrationOff: string;
  immigrationNotFace: string;
  customOff: string;
  maas: string;
  umPax: string;
  wchrFig: string;
  wchrSeat: string;
  wchcFig: string;
  wchcSeat: string;
  loadingStuff: string;
  loadController: string;
  paxHandling: string;
  remarks: string;
}

const INITIAL_LDM_DATA: LdmFormData = {
  date: new Date().toISOString().split('T')[0],
  flightNoSuffix: '',
  route: '',
  acRegSuffix: '',
  acType: '',
  captain: '',
  configure: '',
  std: '',
  doorClosed: '',
  chocksOff: '',
  airborne: '',
  departureStatus: 'ON TIME',
  boardingGate: '',
  docIn: 'N/A',
  docOut: 'N/A',
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
  crewBagPcs: '',
  crewBagComNo: '',
  totalWeight: '',
  distB1: '',
  distB2: '',
  distB3: '',
  distB4: '',
  distA1: '',
  distA2: '',
  distA3: '',
  distA4: '',
  distA5: '',
  distAtrFwr: '',
  distAtrFwl: '',
  distAtrAft: '',
  status: '',
  mail: '',
  counterNoshow: '',
  gateNoShow: '',
  selfOffload: '',
  refused: '',
  immigrationOff: '',
  immigrationNotFace: '',
  customOff: '',
  maas: '',
  umPax: '',
  wchrFig: '',
  wchrSeat: '',
  wchcFig: '',
  wchcSeat: '',
  loadingStuff: '',
  loadController: '',
  paxHandling: '',
  remarks: '',
};

export function reconstructLdmFormDataFromStoredReport(r: StoredFlightReport): LdmFormData {
  const raw = r.rawFormData;
  const ldm = (raw as any)?.ldmRawData || {};

  return {
    date: ldm.date || raw?.date || r.date || new Date().toISOString().split('T')[0],
    flightNoSuffix: (ldm.flightNoSuffix || raw?.flightNoSuffix || r.flightNo || '').replace(/^BS-/i, '').trim(),
    route: ldm.route || raw?.route || r.route || '',
    acRegSuffix: (ldm.acRegSuffix || raw?.acRegSuffix || r.acReg || '').replace(/^(S2-|HS-|PK-)/i, '').trim(),
    acType: ldm.acType || raw?.acType || r.acType || '',
    captain: ldm.captain || raw?.captain || r.captain || '',
    configure: ldm.configure || raw?.configure || r.configure || '',
    std: ldm.std || raw?.std || r.std || '',
    doorClosed: ldm.doorClosed || raw?.doorClosed || r.doorClosed || '',
    chocksOff: ldm.chocksOff || raw?.chocksOff || r.chocksOff || '',
    airborne: ldm.airborne || raw?.airborne || r.airborne || '',
    departureStatus: ldm.departureStatus || raw?.departureStatus || r.departureStatus || 'ON TIME',
    boardingGate: ldm.boardingGate || (raw as any)?.boardingGate || '',
    docIn: ldm.docIn || (raw as any)?.docIn || 'N/A',
    docOut: ldm.docOut || (raw as any)?.docOut || 'N/A',
    fuelUplift: ldm.fuelUplift || raw?.fuelUplift || r.fuelUplift || '',
    paxMale: ldm.paxMale || raw?.paxMale || r.paxMale || '',
    paxFemale: ldm.paxFemale || raw?.paxFemale || r.paxFemale || '',
    paxChild: ldm.paxChild || raw?.paxChild || r.paxChild || '',
    paxInfant: ldm.paxInfant || raw?.paxInfant || r.paxInfant || '',
    paxTotal: ldm.paxTotal || raw?.paxTotal || r.paxTotal || '',
    baggageWeight: ldm.baggageWeight || raw?.baggageWeight || r.baggageWeight || '',
    baggagePcs: ldm.baggagePcs || raw?.baggagePcs || r.baggagePcs || '',
    baggageComNo: ldm.baggageComNo || raw?.baggageComNo || '',
    cargoWeight: ldm.cargoWeight || raw?.cargoWeight || r.cargoWeight || '',
    cargoPcs: ldm.cargoPcs || raw?.cargoPcs || r.cargoPcs || '',
    cargoComNo: ldm.cargoComNo || raw?.cargoComNo || '',
    crewBagPcs: ldm.crewBagPcs || raw?.crewBagPcs || '',
    crewBagComNo: ldm.crewBagComNo || raw?.crewBagComNo || '',
    totalWeight: ldm.totalWeight || (raw as any)?.totalWeight || '',
    distB1: ldm.distB1 || raw?.dist?.b1 || '',
    distB2: ldm.distB2 || raw?.dist?.b2 || '',
    distB3: ldm.distB3 || raw?.dist?.b3 || '',
    distB4: ldm.distB4 || raw?.dist?.b4 || '',
    distA1: ldm.distA1 || raw?.dist?.a1 || '',
    distA2: ldm.distA2 || raw?.dist?.a2 || '',
    distA3: ldm.distA3 || raw?.dist?.a3 || '',
    distA4: ldm.distA4 || raw?.dist?.a4 || '',
    distA5: ldm.distA5 || raw?.dist?.a5 || '',
    distAtrFwr: ldm.distAtrFwr || raw?.dist?.atrFwr || '',
    distAtrFwl: ldm.distAtrFwl || raw?.dist?.atrFwl || '',
    distAtrAft: ldm.distAtrAft || raw?.dist?.atrAft || '',
    status: ldm.status || (raw as any)?.status || '',
    mail: ldm.mail || raw?.mail || r.mail || '',
    counterNoshow: ldm.counterNoshow || raw?.counterNoshow || r.counterNoshow || '',
    gateNoShow: ldm.gateNoShow || raw?.gateNoShow || r.gateNoShow || '',
    selfOffload: ldm.selfOffload || raw?.selfOffload || r.selfOffload || '',
    refused: ldm.refused || raw?.refused || '',
    immigrationOff: ldm.immigrationOff || raw?.immigrationOff || '',
    immigrationNotFace: ldm.immigrationNotFace || raw?.immigrationNotFace || '',
    customOff: ldm.customOff || raw?.customOff || '',
    maas: ldm.maas || raw?.maas || r.maas || '',
    umPax: ldm.umPax || raw?.umPax || r.umPax || '',
    wchrFig: ldm.wchrFig || raw?.wchrFig || r.wchrFig || '',
    wchrSeat: ldm.wchrSeat || raw?.wchrSeat || r.wchrSeat || '',
    wchcFig: ldm.wchcFig || raw?.wchcFig || r.wchcFig || '',
    wchcSeat: ldm.wchcSeat || raw?.wchcSeat || r.wchcSeat || '',
    loadingStuff: ldm.loadingStuff || raw?.loadingStuff || r.rampOfficer || '',
    loadController: ldm.loadController || raw?.loadController || r.loadController || '',
    paxHandling: ldm.paxHandling || raw?.paxHandling || r.paxHandling || '',
    remarks: ldm.remarks || raw?.remarks || r.remarks || '',
  };
}

export function buildDepartureMessage(d: LdmFormData, officerUser: UserInfo): string {
  const cleanRawReg = d.acRegSuffix.toUpperCase().replace(/^(S2-|HS-|PK-)/, '');
  let finalAcRegDisplay = `S2-${cleanRawReg}`;
  if (['PKBBG', 'BBG'].includes(cleanRawReg)) finalAcRegDisplay = 'PK-BBG';
  else if (['PKBBH', 'BBH'].includes(cleanRawReg)) finalAcRegDisplay = 'PK-BBH';
  else if (['9HSAU', 'SAU'].includes(cleanRawReg)) finalAcRegDisplay = '9H-SAU';
  else if (['HSSXA', 'SXA'].includes(cleanRawReg)) finalAcRegDisplay = 'HS-SXA';

  const userStn = (officerUser.stationName || 'CGP').trim().toUpperCase();

  return `FLIGHT DEPARTURE MESSAGE
--------------------------------------
DATE: ${d.date}
FLIGHT NO: BS-${d.flightNoSuffix} (${d.route})
A/C REG: ${finalAcRegDisplay}
A/C TYPE: ${d.acType}
CAPTAIN: ${d.captain}
CONFIGURE: ${d.configure}

FLIGHT OPERATIONS SUMMARY
--------------------------------------
STD: ${d.std ? d.std + ' UTC' : 'N/A'}
DOOR CLOSED: ${d.doorClosed ? d.doorClosed + ' UTC' : 'N/A'}
CHOCKS OFF: ${d.chocksOff ? d.chocksOff + ' UTC' : 'N/A'}
AIRBORNE: ${d.airborne ? d.airborne + ' UTC' : 'N/A'}
DEPARTURE STATUS: ${d.departureStatus}
BOARDING GATE: ${d.boardingGate || 'N/A'}
DOC IN: ${d.docIn && d.docIn !== 'N/A' ? d.docIn + ' UTC' : 'N/A'}
DOC OUT: ${d.docOut && d.docOut !== 'N/A' ? d.docOut + ' UTC' : 'N/A'}
FUEL UPLIFT: ${d.fuelUplift || '0'} KG

LOAD SUMMARY
--------------------------------------
PASSENGERS: AS PER SYSTEM
BAGGAGE: ${d.baggageWeight || '0'} KG / ${d.baggagePcs || '0'} PCS / COM NO ${d.baggageComNo || 'N/A'}
CREW BAG: ${d.crewBagPcs || '0'} PCS / COM NO ${d.crewBagComNo || 'N/A'}
CARGO: ${d.cargoWeight || '0'} KG / ${d.cargoPcs || '0'} PCS / COM NO ${d.cargoComNo || 'N/A'}
MAIL: ${d.mail || '0'}
UNDER LOAD: ${d.paxHandling || 'N/A'}

PASSENGER HANDLING DETAILS
--------------------------------------
COUNTER NOSHOW: ${d.counterNoshow || '0'}
GATE NO SHOW: ${d.gateNoShow || '0'}
SELF OFFLOAD: ${d.selfOffload || '0'}
REFUSED: ${d.refused || '0'}
IMMIGRATION OFF: ${d.immigrationOff || '0'}
IMMIGRATION NOT FACE: ${d.immigrationNotFace || '0'}
CUSTOM OFF: ${d.customOff || '0'}

SPECIAL HANDLING
--------------------------------------
MAAS: ${d.maas || '0'}
UM PAX: ${d.umPax || '0'}
WCHR: ${d.wchrFig || '0'} (${d.wchrSeat || 'N/A'})
WCHC: ${d.wchcFig || '0'} (${d.wchcSeat || 'N/A'})

DUTY PERSONNEL:
--------------------------------------
LOADING STUFF / G7: ${d.loadingStuff || 'N/A'}
LOAD CONTROLLER: ${d.loadController || 'N/A'}

REMARKS:
--------------------------------------
${d.remarks || 'NIL'}

--------------------------------------
PREPARED BY:
NAME: ${(officerUser.userName || 'SAMPLE').toUpperCase()}
USBA ID: ${(officerUser.usbaId || '123').toUpperCase()}
STATION: ${userStn}`;
}

export const LoadControlModule: React.FC<Props> = ({
  userInfo,
  onBackToDashboard,
  onGoToSavedFlights,
  showToast,
  editReport,
  initialViewMode = 'input',
  onClearEditReport,
  onUpdateStation,
}) => {
  const [formData, setFormData] = useState<LdmFormData>(INITIAL_LDM_DATA);
  const [viewMode, setViewMode] = useState<'input' | 'dual-report'>('input');
  const [departureMessageHtml, setDepartureMessageHtml] = useState<string>('');
  const [ldmReportText, setLdmReportText] = useState<string>('');
  const [editingReportInfo, setEditingReportInfo] = useState<{
    id: string;
    createdAt: string;
  } | null>(null);

  // Load saved flight data for editing or viewing when editReport prop is provided
  useEffect(() => {
    if (editReport) {
      const loadedLdm = reconstructLdmFormDataFromStoredReport(editReport);
      setFormData(loadedLdm);
      setEditingReportInfo({
        id: editReport.id,
        createdAt: editReport.createdAt,
      });

      const reportStn = extractStationCode(editReport.station || userInfo.stationName);
      if (editReport.station && onUpdateStation) {
        onUpdateStation(reportStn);
      }

      const reportUser: UserInfo = {
        userName: editReport.preparedBy || userInfo.userName,
        usbaId: editReport.usbaId || userInfo.usbaId,
        stationName: reportStn,
      };

      if (initialViewMode === 'dual-report') {
        const depMsg = buildDepartureMessage(loadedLdm, reportUser);
        const ldm = generateLdmForDestination(loadedLdm, reportUser);
        setDepartureMessageHtml(depMsg);
        setLdmReportText(ldm);
        setViewMode('dual-report');
        showToast(`FLIGHT ${editReport.flightNo || 'FINAL REPORT'} (MESSAGE & LDM) LOADED`);
      } else {
        setViewMode('input');
        showToast(`FLIGHT ${editReport.flightNo || 'DATA'} LOADED FOR EDITING`);
      }
    }
  }, [editReport, initialViewMode]);

  // Handle station change directly from Load Controller
  const handleStationChange = (newStn: string) => {
    const code = extractStationCode(newStn);
    if (onUpdateStation) {
      onUpdateStation(code);
    }
    if (formData.flightNoSuffix) {
      const updatedRoute = getRouteForFlightNo(formData.flightNoSuffix, code);
      if (updatedRoute) {
        setFormData((prev) => ({ ...prev, route: updatedRoute }));
      }
    }
    showToast(`STATION SWITCHED TO ${code}`);
  };

  // Auto-sync route whenever user station or flightNoSuffix is loaded
  useEffect(() => {
    if (formData.flightNoSuffix) {
      const activeStn = extractStationCode(userInfo.stationName);
      const autoRoute = getRouteForFlightNo(formData.flightNoSuffix, activeStn);
      if (autoRoute && autoRoute !== formData.route) {
        setFormData((prev) => ({ ...prev, route: autoRoute }));
      }
    }
  }, [userInfo.stationName, formData.flightNoSuffix]);

  // Typewriter text state
  const [typedTitle, setTypedTitle] = useState('');
  useEffect(() => {
    const text = 'INVENTION OF RADOAN RASEL';
    let idx = 0;
    setTypedTitle('');
    const timer = setInterval(() => {
      idx++;
      setTypedTitle(text.slice(0, idx));
      if (idx >= text.length) clearInterval(timer);
    }, 70);
    return () => clearInterval(timer);
  }, [viewMode]);

  // Auto calculate Passenger Total (M + F + C)
  useEffect(() => {
    const male = parseInt(formData.paxMale, 10) || 0;
    const female = parseInt(formData.paxFemale, 10) || 0;
    const child = parseInt(formData.paxChild, 10) || 0;
    const sum = male + female + child;
    setFormData((prev) => ({
      ...prev,
      paxTotal: sum > 0 ? String(sum) : '',
    }));
  }, [formData.paxMale, formData.paxFemale, formData.paxChild]);

  // Auto calculate Total Weight and Distribution Balance Status
  useEffect(() => {
    const bagW = parseFloat(formData.baggageWeight) || 0;
    const cgoW = parseFloat(formData.cargoWeight) || 0;
    const totW = bagW + cgoW;
    const totWStr = totW > 0 ? String(totW) : '';

    let distSum = 0;
    const isBoeing = formData.acType.includes('BOEING');
    const isAirbus = formData.acType.includes('AIRBUS');
    const isAtr = formData.acType.includes('ATR');

    if (isBoeing) {
      distSum =
        (parseFloat(formData.distB1) || 0) +
        (parseFloat(formData.distB2) || 0) +
        (parseFloat(formData.distB3) || 0) +
        (parseFloat(formData.distB4) || 0);
    } else if (isAirbus) {
      distSum =
        (parseFloat(formData.distA1) || 0) +
        (parseFloat(formData.distA2) || 0) +
        (parseFloat(formData.distA3) || 0) +
        (parseFloat(formData.distA4) || 0) +
        (parseFloat(formData.distA5) || 0);
    } else if (isAtr) {
      distSum =
        (parseFloat(formData.distAtrFwr) || 0) +
        (parseFloat(formData.distAtrFwl) || 0) +
        (parseFloat(formData.distAtrAft) || 0);
    }

    let statusVal = '';
    if (totW === 0 && distSum === 0) {
      statusVal = '';
    } else {
      const diff = distSum - totW;
      if (diff === 0) statusVal = 'EQUAL';
      else if (diff > 0) statusVal = `+${diff}`;
      else statusVal = `${diff}`;
    }

    setFormData((prev) => ({
      ...prev,
      totalWeight: totWStr,
      status: statusVal,
    }));
  }, [
    formData.baggageWeight,
    formData.cargoWeight,
    formData.distB1,
    formData.distB2,
    formData.distB3,
    formData.distB4,
    formData.distA1,
    formData.distA2,
    formData.distA3,
    formData.distA4,
    formData.distA5,
    formData.distAtrFwr,
    formData.distAtrFwl,
    formData.distAtrAft,
    formData.acType,
  ]);

  // Auto calculate Departure Status based on STD and Chocks Off
  const updateDepartureStatus = (stdVal: string, offVal: string) => {
    if (stdVal && offVal) {
      const cleanStd = stdVal.replace(/\D/g, '');
      const cleanOff = offVal.replace(/\D/g, '');
      if (cleanStd.length === 4 && cleanOff.length === 4) {
        const stdMinutes =
          parseInt(cleanStd.slice(0, 2), 10) * 60 + parseInt(cleanStd.slice(2, 4), 10);
        const offMinutes =
          parseInt(cleanOff.slice(0, 2), 10) * 60 + parseInt(cleanOff.slice(2, 4), 10);
        let diff = offMinutes - stdMinutes;
        if (diff < -720) diff += 1440;
        else if (diff > 720) diff -= 1440;

        if (diff > 0) return `FLIGHT ${diff} MINS LATE`;
        if (diff < 0) return `FLIGHT ${Math.abs(diff)} MINS EARLY`;
        return 'ON TIME';
      }
    }
    return 'ON TIME';
  };

  // Handle Flight No change -> auto lookup Route based on officer's station (e.g. SPD-DXB, CXB-DXB, CGP-CCU, DAC-DXB)
  const handleFlightNoChange = (val: string) => {
    const cleanNum = val.replace(/\D/g, '');
    const activeStn = extractStationCode(userInfo.stationName);
    const autoRoute = getRouteForFlightNo(cleanNum, activeStn);
    setFormData((prev) => ({
      ...prev,
      flightNoSuffix: cleanNum,
      route: autoRoute || (cleanNum.length >= 3 ? `${activeStn}-` : ''),
    }));
  };

  // Handle A/C Reg Change -> auto detect A/C Type, configure SXA C2 lock, and toggle distributions
  const handleAcRegChange = (val: string) => {
    const rawReg = val.trim().toUpperCase().replace(/^(S2-|HS-|PK-)/, '');
    let currentAcType = '';

    if (SPECIAL_REG_MAP[rawReg]) {
      currentAcType = SPECIAL_REG_MAP[rawReg].type;
    } else if (AC_TYPE_MAP.atr.includes(rawReg)) {
      currentAcType = 'ATR-72-600';
    } else if (AC_TYPE_MAP.boeing.includes(rawReg)) {
      currentAcType = 'BOEING 737';
    } else if (AC_TYPE_MAP.airbus.includes(rawReg)) {
      currentAcType = 'AIRBUS 330';
    }

    const isSxa = rawReg === 'SXA' || rawReg === 'HSSXA';

    setFormData((prev) => ({
      ...prev,
      acRegSuffix: rawReg,
      acType: currentAcType || prev.acType,
      distA2: isSxa ? '0' : prev.distA2,
    }));
  };

  // Handle Boarding Gate change -> conditional access for DOC IN / DOC OUT
  const handleBoardingGateChange = (gateVal: string) => {
    const upper = gateVal.trim().toUpperCase();
    const allowed = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8'];
    const isAllowed = allowed.includes(upper);

    setFormData((prev) => ({
      ...prev,
      boardingGate: upper,
      docIn: isAllowed ? (prev.docIn === 'N/A' ? '' : prev.docIn) : 'N/A',
      docOut: isAllowed ? (prev.docOut === 'N/A' ? '' : prev.docOut) : 'N/A',
    }));
  };

  // Time format helper (auto-injects colon)
  const handleTimeChange = (
    field: 'std' | 'doorClosed' | 'chocksOff' | 'airborne' | 'docIn' | 'docOut',
    val: string
  ) => {
    const digits = val.replace(/\D/g, '').slice(0, 4);
    let formatted = digits;
    if (digits.length > 2) {
      formatted = `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
    }
    setFormData((prev) => {
      const next = { ...prev, [field]: formatted };
      if (field === 'std' || field === 'chocksOff') {
        next.departureStatus = updateDepartureStatus(next.std, next.chocksOff);
      }
      return next;
    });
  };

  // Generate Flight LDM Text according to destination rules
  const generateLdmForDestination = (d: LdmFormData, officerUser?: UserInfo): string => {
    const routeParts = (d.route || '').split('-').map((s) => s.trim().toUpperCase()).filter(Boolean);
    const dest = routeParts.length > 1 ? routeParts[1] : (routeParts[0] || 'DAC');
    let ldm = '';
    const activeUser = officerUser || userInfo;
    const userStation = (activeUser.stationName || 'DAC').trim().toUpperCase();
    const dynamicRegards = `REGARDS,\n______________________________\n${(activeUser.userName || 'OFFICER').toUpperCase()}\nLOAD CONTROL OFFICER II\nUSBA-${(activeUser.usbaId || '123').toUpperCase()} II ${userStation} APT II`;

    const totalLoad = (parseInt(d.baggageWeight, 10) || 0) + (parseInt(d.cargoWeight, 10) || 0);
    const isAirbus = d.acType.includes('AIRBUS');
    const isAtr = d.acType.includes('ATR');

    const dist1 = isAirbus ? d.distA1 || '0' : d.distB1 || '0';
    const dist2 = isAirbus ? d.distA2 || '0' : d.distB2 || '0';
    const dist3 = isAirbus ? d.distA3 || '0' : d.distB3 || '0';
    const dist4 = isAirbus ? d.distA4 || '0' : d.distB4 || '0';
    const dist5 = isAirbus ? d.distA5 || '0' : '0';

    const cleanRawReg = d.acRegSuffix.toUpperCase().replace(/^(S2-|HS-|PK-)/, '');
    let finalAcRegLdm = `S2${cleanRawReg}`;
    if (['PKBBG', 'BBG'].includes(cleanRawReg)) finalAcRegLdm = 'PKBBG';
    else if (['PKBBH', 'BBH'].includes(cleanRawReg)) finalAcRegLdm = 'PKBBH';
    else if (['9HSAU', 'SAU'].includes(cleanRawReg)) finalAcRegLdm = '9HSAU';
    else if (['HSSXA', 'SXA'].includes(cleanRawReg)) finalAcRegLdm = 'HSSXA';

    const seatConfig = getSeatConfig(cleanRawReg);
    const dist2Val = finalAcRegLdm.includes('SXA') ? '00' : dist2;

    const siLines: string[] = [];

    let crewBagSiLine = '';
    if (parseInt(d.crewBagPcs, 10) > 0 && d.crewBagComNo && d.crewBagComNo !== 'N/A') {
      crewBagSiLine = `SI CREWBAG :${String(d.crewBagPcs).padStart(2, '0')}/C${d.crewBagComNo}`;
    }

    let comailSiLine = '';
    const mailPcs = parseInt(d.mail.replace(/\D/g, ''), 10);
    if (!isNaN(mailPcs) && mailPcs > 0) {
      if (mailPcs === 1) {
        comailSiLine = `SI COMAIL: ${String(mailPcs).padStart(2, '0')} PC`;
      } else {
        comailSiLine = `SI COMAIL: ${String(mailPcs).padStart(2, '0')} PCS`;
      }
    }

    const siWcLines: string[] = [];
    if (parseInt(d.wchrFig, 10) > 0 && d.wchrSeat && d.wchrSeat !== 'N/A') {
      siWcLines.push(`SI WCHR: ${String(d.wchrFig).padStart(2, '0')} (${d.wchrSeat})`);
    }
    if (parseInt(d.wchcFig, 10) > 0 && d.wchcSeat && d.wchcSeat !== 'N/A') {
      siWcLines.push(`SI WCHC: ${String(d.wchcFig).padStart(2, '0')} (${d.wchcSeat})`);
    }
    const wcSiString = siWcLines.join('\n');

    switch (dest) {
      case 'DOH': {
        if (finalAcRegLdm.includes('AL') || finalAcRegLdm.includes('SXA')) {
          const bagComsDoh = d.baggageComNo ? d.baggageComNo.split(',').map((s) => s.trim()) : [];
          const cgoComsDoh = d.cargoComNo ? d.cargoComNo.split(',').map((s) => s.trim()) : [];

          const getCptLineDoh = (cptNum: number) => {
            const sNum = String(cptNum);
            const hasBag = bagComsDoh.includes(sNum);
            const hasCgo = cgoComsDoh.includes(sNum);
            if (hasBag && hasCgo) return 'BAG/CGO BY';
            if (hasBag) return 'BAG BY';
            if (hasCgo) return 'CGO BY';
            return 'NIL';
          };

          ldm =
            `LDM\nBS${d.flightNoSuffix}/${formatDate(d.date, 'DDMONYY')}.${finalAcRegLdm}.${seatConfig}.${d.configure}\n` +
            `-${dest}.${d.paxMale || '0'}/${d.paxFemale || '0'}/${d.paxChild || '0'}/${d.paxInfant || '0'}.T.${totalLoad}.1/${dist1}.2/${dist2Val}.3/${dist3}.4/${dist4}.5/${dist5}.PAX.00/${d.paxTotal || '0'}.PAD/0/0\n` +
            `CPT1- ${getCptLineDoh(1)}\n` +
            `CPT2- ${getCptLineDoh(2)}\n` +
            `CPT3- ${getCptLineDoh(3)}\n` +
            `CPT4- ${getCptLineDoh(4)}\n` +
            `CPT5- ${getCptLineDoh(5)}\n\n` +
            `${dest} FRE 0 POS 0 BAG ${d.baggagePcs || '0'} PCS /${d.baggageWeight || '0'} KGS EQP 0 TRA 0\n` +
            `${dest} FRE 0 POS 0 CGO ${d.cargoPcs || '0'} PCS/ ${d.cargoWeight || '0'} KGS EQP 0 TRA 0\n`;
        } else {
          ldm =
            `LDM\nBS${d.flightNoSuffix}/${formatDate(d.date, 'DDMONYY')}.${finalAcRegLdm}.${seatConfig}.${d.configure}\n` +
            `-${dest}.${d.paxMale || '0'}/${d.paxFemale || '0'}/${d.paxChild || '0'}/${d.paxInfant || '0'}.T.${totalLoad}.1/${dist1}.2/${dist2}.3/${dist3}.4/${dist4}.PAX.00/${d.paxTotal || '0'}.PAD/0/0\n` +
            `CPT1- ${parseInt(dist1, 10) > 0 ? 'BAG/CGO BY' : 'NIL'}\n` +
            `CPT2- BAG BY\n` +
            `CPT3- BAG BY\n` +
            `CPT4- ${parseInt(dist4, 10) > 0 ? 'BAG/CGO BY' : 'NIL'}\n\n` +
            `${dest} FRE 0 POS 0 BAG ${d.baggagePcs || '0'} PCS /${d.baggageWeight || '0'} KGS EQP 0 TRA 0\n` +
            `${dest} FRE 0 POS 0 CGO ${d.cargoPcs || '0'} PCS/ ${d.cargoWeight || '0'} KGS EQP 0 TRA 0\n`;
        }

        if (crewBagSiLine) siLines.push(crewBagSiLine);
        if (wcSiString) siLines.push(wcSiString);
        if (comailSiLine) siLines.push(comailSiLine);
        if (siLines.length > 0) ldm += `\n${siLines.join('\n')}`;
        ldm += `\n\n\nEND\n\n\n${dynamicRegards}`;
        break;
      }

      case 'SHJ':
      case 'DXB':
      case 'AUH': {
        if (finalAcRegLdm.includes('AL') || finalAcRegLdm.includes('SXA')) {
          const bagComs = d.baggageComNo ? d.baggageComNo.split(',').map((s) => s.trim()) : [];
          const cgoComs = d.cargoComNo ? d.cargoComNo.split(',').map((s) => s.trim()) : [];

          const getCptLineAirbus = (cptNum: number) => {
            const sNum = String(cptNum);
            const hasBag = bagComs.includes(sNum);
            const hasCgo = cgoComs.includes(sNum);
            if (hasBag && hasCgo) return 'BAG+CGO BY';
            if (hasBag) return 'BAG BY';
            if (hasCgo) return 'CGO BY';
            return 'NIL';
          };

          ldm =
            `LDM\nBS${d.flightNoSuffix}/${formatDate(d.date, 'DDMON')}.${finalAcRegLdm}.${seatConfig}.${d.configure}\n` +
            `-${dest}.${d.paxMale || '0'}/${d.paxFemale || '0'}/${d.paxChild || '0'}/${d.paxInfant || '0'}.T.${totalLoad}.1/${dist1}.2/${dist2Val}.3/${dist3}.4/${dist4}.5/${dist5}.PAX/0/${d.paxTotal || '0'}.PAD/0/0\n\n` +
            `CPT1- ${getCptLineAirbus(1)}\n` +
            `CPT2- ${getCptLineAirbus(2)}\n` +
            `CPT3- ${getCptLineAirbus(3)}\n` +
            `CPT4- ${getCptLineAirbus(4)}\n` +
            `CPT5- ${getCptLineAirbus(5)}\n\n` +
            `${dest} C     ${d.cargoPcs || '0'}/     ${d.cargoWeight || '0'} M     0 B     ${d.baggagePcs || '0'}/     ${d.baggageWeight || '0'} O     0 T       0\n`;
        } else {
          const bagComs = d.baggageComNo ? d.baggageComNo.split(',').map((s) => s.trim()) : [];
          const cgoComs = d.cargoComNo ? d.cargoComNo.split(',').map((s) => s.trim()) : [];

          const getCptLine = (cptNum: number) => {
            const hasBag = bagComs.includes(String(cptNum));
            const hasCgo = cgoComs.includes(String(cptNum));
            let content = 'NIL';
            if (hasBag && hasCgo) content = 'BAG+CGO BY';
            else if (hasBag) content = 'BAG BY';
            else if (hasCgo) content = 'CGO BY';
            return `CPT${cptNum}- ${content}`;
          };

          ldm =
            `LDM\nBS${d.flightNoSuffix}/${formatDate(d.date, 'DDMON')}.${finalAcRegLdm}.${seatConfig}.${d.configure}\n` +
            `-${dest}.${d.paxMale || '0'}/${d.paxFemale || '0'}/${d.paxChild || '0'}/${d.paxInfant || '0'}.T.${totalLoad}.1/${dist1}.2/${dist2}.3/${dist3}.4/${dist4}.PAX/0/${d.paxTotal || '0'}.PAD/0/0\n\n` +
            `${getCptLine(1)}\n` +
            `${getCptLine(2)}\n` +
            `${getCptLine(3)}\n` +
            `${getCptLine(4)}\n\n` +
            `${dest} C     ${d.cargoPcs || '0'}/     ${d.cargoWeight || '0'} M     0 B     ${d.baggagePcs || '0'}/     ${d.baggageWeight || '0'} O     0 T       0\n`;
        }

        if (wcSiString) siLines.push(wcSiString);
        if (crewBagSiLine) siLines.push(crewBagSiLine);
        if (comailSiLine) siLines.push(comailSiLine);
        if (siLines.length > 0) ldm += `${siLines.join('\n')}\n`;
        ldm += `\n\n\nEND\n\n\n${dynamicRegards}`;
        break;
      }

      case 'MCT': {
        let loadLineMct = '';
        if (finalAcRegLdm.includes('AL') || finalAcRegLdm.includes('SXA')) {
          loadLineMct = `-${dest}.${d.paxMale || '0'}/${d.paxFemale || '0'}/${d.paxChild || '0'}/${d.paxInfant || '0'}.T.${totalLoad}.1/${dist1}.2/${dist2Val}.3/${dist3}.4/${dist4}.5/${dist5}.PAX.00/${d.paxTotal || '0'}.PAD/0/0`;
        } else {
          loadLineMct = `-${dest}.${d.paxMale || '0'}/${d.paxFemale || '0'}/${d.paxChild || '0'}/${d.paxInfant || '0'}.T.${totalLoad}.1/${dist1}.2/${dist2}.3/${dist3}.4/${dist4}.PAX.00/${d.paxTotal || '0'}.PAD/0/0`;
        }

        ldm =
          `LDM\nBS${d.flightNoSuffix}/${formatDate(d.date, 'DDMON')}.${finalAcRegLdm}.${seatConfig}.${d.configure}\n` +
          `${loadLineMct}\n\n` +
          `${dest} FRE 0 POS 0 BAG ${d.baggagePcs || '0'} PCS/${d.baggageWeight || '0'} KGS EQP 0 TRA 0\n` +
          `${dest} FRE 0 POS 0 CGO ${d.cargoPcs || '0'} PCS/${d.cargoWeight || '0'} KGS  EQP 0 TRA 0\n\n`;

        siLines.push(`SI: MAAS ${String(d.maas || '0').padStart(2, '0')}`);
        if (wcSiString) siLines.push(wcSiString);
        if (crewBagSiLine) siLines.push(crewBagSiLine);
        if (comailSiLine) siLines.push(comailSiLine);
        ldm += `${siLines.join('\n')}\n`;
        ldm += `\n\n\nEND\n\n\n${dynamicRegards}`;
        break;
      }

      case 'RUH':
      case 'JED': {
        const wcLinesRuh: string[] = [];
        if (parseInt(d.wchrFig, 10) > 0 && d.wchrSeat && d.wchrSeat !== 'N/A') {
          const formattedWchrSeat = d.wchrSeat.replace(/,\s*/g, '/');
          wcLinesRuh.push(
            `SI O/B 0 WCHR: ${String(d.wchrFig).padStart(2, '0')} SN ${formattedWchrSeat}`
          );
        }
        if (parseInt(d.wchcFig, 10) > 0 && d.wchcSeat && d.wchcSeat !== 'N/A') {
          const formattedWchcSeat = d.wchcSeat.replace(/,\s*/g, '/');
          wcLinesRuh.push(
            `SI O/B 0 WCHC: ${String(d.wchcFig).padStart(2, '0')} SN ${formattedWchcSeat}`
          );
        }
        const wcStringRuh = wcLinesRuh.join('\n');

        const dists = isAirbus
          ? `.1/${dist1}.2/${dist2Val}.3/${dist3}.4/${dist4}.5/${dist5}`
          : `.1/${dist1}.2/${dist2}.3/${dist3}.4/${dist4}`;

        ldm =
          `LDM\nBS${d.flightNoSuffix}/${formatDate(d.date, 'DD')}.${finalAcRegLdm}.${seatConfig}.${d.configure}\n` +
          `-${dest}.${d.paxMale || '0'}/${d.paxFemale || '0'}/${d.paxChild || '0'}/${d.paxInfant || '0'}.T${totalLoad}${dists}.PAX/0/${d.paxTotal || '0'}.PAD/0/0\n`;
        if (wcStringRuh) {
          ldm += `${wcStringRuh}\n`;
        }
        ldm += `SI ${dest} C     ${d.cargoPcs || '0'}/     ${d.cargoWeight || '0'} M     0    B     ${d.baggagePcs || '0'}/     ${d.baggageWeight || '0'} O     0 T     0\n`;
        if (crewBagSiLine) ldm += `${crewBagSiLine}\n`;
        if (comailSiLine) ldm += `${comailSiLine}\n`;
        ldm += `\nEND\n\n\n${dynamicRegards}`;
        break;
      }

      case 'CCU':
      default: {
        if (d.baggageComNo && d.baggageComNo !== 'N/A' && parseInt(d.baggagePcs, 10) > 0) {
          siLines.push(
            `SI: ALL BAG LDD IN C: ${d.baggageComNo} - ${d.baggagePcs} PCS/ ${d.baggageWeight} KGS.`
          );
        }
        if (d.cargoComNo && d.cargoComNo !== 'N/A' && parseInt(d.cargoPcs, 10) > 0) {
          siLines.push(
            `SI: ALL CGO LDD IN C: ${d.cargoComNo} - ${d.cargoPcs} PCS/ ${d.cargoWeight} KGS`
          );
        }
        if (parseInt(d.maas, 10) > 0) siLines.push(`SI MAAS - ${String(d.maas).padStart(2, '0')}`);
        if (wcSiString) siLines.push(wcSiString);
        if (crewBagSiLine) siLines.push(crewBagSiLine);
        if (comailSiLine) siLines.push(comailSiLine);

        const distsCCU = isAirbus
          ? `.1/${dist1}.2/${dist2Val}.3/${dist3}.4/${dist4}.5/${dist5}`
          : `.1/${dist1}.2/${dist2}.3/${dist3}.4/${dist4}`;

        let loadLineCCU = '';
        if (isAtr) {
          loadLineCCU = `-${dest}.${d.paxMale || '0'}/${d.paxFemale || '0'}/${d.paxChild || '0'}/${d.paxInfant || '0'}.T.${totalLoad}.H- FWD&AFT.\nPAX.00/${d.paxTotal || '0'}.PAD.00/00`;
        } else {
          loadLineCCU = `-${dest}.${d.paxMale || '0'}/${d.paxFemale || '0'}/${d.paxChild || '0'}/${d.paxInfant || '0'}.T.${totalLoad}${distsCCU}.\nPAX.00/${d.paxTotal || '0'}.PAD.00/00`;
        }

        ldm =
          `LDM\n\nBS${d.flightNoSuffix}/${formatDate(d.date, 'DDMONYY')}.${finalAcRegLdm}.${seatConfig}.${d.configure}\n` +
          `${loadLineCCU}\n\n` +
          (siLines.length > 0 ? siLines.join('\n') : '') +
          `\n\nEND\n\n\n${dynamicRegards}`;
        break;
      }
    }

    return ldm;
  };

  // Generate Reports
  const handleGenerateReport = async () => {
    if (!formData.flightNoSuffix) {
      alert('PLEASE INPUT FLIGHT NUMBER!');
      return;
    }

    const cleanRawReg = formData.acRegSuffix.toUpperCase().replace(/^(S2-|HS-|PK-)/, '');
    const departureMsg = buildDepartureMessage(formData, userInfo);
    const ldmText = generateLdmForDestination(formData, userInfo);

    setDepartureMessageHtml(departureMsg);
    setLdmReportText(ldmText);
    setViewMode('dual-report');

    // Build standard FlightFormData to save report to Cloud Firestore (preserved 30+ days)
    const flightPayload: FlightFormData = {
      date: formData.date,
      flightNoSuffix: formData.flightNoSuffix,
      route: formData.route,
      acRegSuffix: cleanRawReg,
      acType: formData.acType,
      captain: formData.captain,
      configure: formData.configure,
      std: formData.std,
      doorClosed: formData.doorClosed,
      chocksOff: formData.chocksOff,
      airborne: formData.airborne,
      departureStatus: formData.departureStatus,
      flightLoad: `${formData.paxTotal || '0'} PAX / ${formData.totalWeight || '0'} KG`,
      fuelUplift: formData.fuelUplift,
      paxMale: formData.paxMale,
      paxFemale: formData.paxFemale,
      paxChild: formData.paxChild,
      paxInfant: formData.paxInfant,
      paxTotal: formData.paxTotal,
      baggageWeight: formData.baggageWeight,
      baggagePcs: formData.baggagePcs,
      baggageComNo: formData.baggageComNo,
      cargoWeight: formData.cargoWeight,
      cargoPcs: formData.cargoPcs,
      cargoComNo: formData.cargoComNo,
      crewBagPcs: formData.crewBagPcs,
      crewBagComNo: formData.crewBagComNo,
      mail: formData.mail || '0',
      counterNoshow: formData.counterNoshow,
      gateNoShow: formData.gateNoShow,
      selfOffload: formData.selfOffload,
      refused: formData.refused,
      immigrationOff: formData.immigrationOff,
      immigrationNotFace: formData.immigrationNotFace,
      customOff: formData.customOff,
      vip: '0',
      cip: '0',
      maas: formData.maas,
      umPax: formData.umPax,
      fireArms: '0',
      wchrFig: formData.wchrFig,
      wchrSeat: formData.wchrSeat,
      wchcFig: formData.wchcFig,
      wchcSeat: formData.wchcSeat,
      loadingStuff: formData.loadingStuff,
      rampOfficer: formData.loadingStuff,
      loadController: formData.loadController,
      paxHandling: formData.paxHandling,
      remarks: formData.remarks,
      dist: {
        b1: formData.distB1,
        b2: formData.distB2,
        b3: formData.distB3,
        b4: formData.distB4,
        a1: formData.distA1,
        a2: formData.distA2,
        a3: formData.distA3,
        a4: formData.distA4,
        a5: formData.distA5,
        atrFwr: formData.distAtrFwr,
        atrFwl: formData.distAtrFwl,
        atrAft: formData.distAtrAft,
      },
      boardingGate: formData.boardingGate,
      docIn: formData.docIn,
      docOut: formData.docOut,
      status: formData.status,
      totalWeight: formData.totalWeight,
      ldmRawData: formData,
    };

    const originalCreatedAt = editingReportInfo?.createdAt;
    try {
      await saveFlightReportToCloud(flightPayload, userInfo, originalCreatedAt, 'load-control');

      // If flight number or date changed during edit, clean up old docId to avoid duplicates
      const station = extractStationCode(userInfo.stationName);
      const date = formData.date || new Date().toISOString().split('T')[0];
      const flightNo = `BS-${(formData.flightNoSuffix || '000').trim().toUpperCase()}`;
      const newDocId = `${station}_${date}_${flightNo.replace(/[^A-Z0-9]/g, '')}_LC`;

      if (editingReportInfo?.id && editingReportInfo.id !== newDocId) {
        await deleteFlightReportFromCloud({ id: editingReportInfo.id } as StoredFlightReport, userInfo);
      }

      await logUserActivity(
        editingReportInfo ? 'LOAD CONTROL REPORT EDITED' : 'LOAD CONTROL REPORT GENERATED',
        `${editingReportInfo ? 'Updated & saved' : 'Generated'} Load Control & LDM for BS-${formData.flightNoSuffix} (${formData.route})`,
        userInfo
      );
      showToast(
        editingReportInfo
          ? 'LOAD CONTROL REPORT UPDATED & SAVED IN CLOUD DATA STORE!'
          : 'LOAD CONTROL REPORT & LDM GENERATED & SAVED IN CLOUD DATA STORE!'
      );
      setEditingReportInfo(null);
      onClearEditReport?.();
    } catch (err) {
      console.warn('Error saving load control report:', err);
      showToast('LOAD CONTROL REPORT & LDM GENERATED!');
    }
  };

  const resetForm = () => {
    setFormData({
      ...INITIAL_LDM_DATA,
      date: new Date().toISOString().split('T')[0],
    });
    setEditingReportInfo(null);
    onClearEditReport?.();
    setViewMode('input');
    showToast('NEW REPORT READY');
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`${label} COPIED TO CLIPBOARD!`);
  };

  const cleanRawReg = formData.acRegSuffix.toUpperCase().replace(/^(S2-|HS-|PK-)/, '');
  const isSpecialReg = ['PKBBG', 'BBG', 'PKBBH', 'BBH', '9HSAU', 'SAU', 'HSSXA', 'SXA'].includes(
    cleanRawReg
  );
  const isSxaReg = cleanRawReg === 'SXA' || cleanRawReg === 'HSSXA';

  const isBoeing = formData.acType.includes('BOEING');
  const isAirbus = formData.acType.includes('AIRBUS');
  const isAtr = formData.acType.includes('ATR');

  const isAllowedGate = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8'].includes(
    formData.boardingGate.trim().toUpperCase()
  );

  return (
    <div className="min-h-screen w-full relative bg-[#060d1a] text-slate-100 flex flex-col font-serif uppercase selection:bg-cyan-500 selection:text-black">
      {/* Background HUD Aviation Grid Overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-0 opacity-40"
        style={{
          backgroundImage: `
            radial-gradient(circle at center, transparent 40%, rgba(0, 240, 255, 0.08) 100%),
            linear-gradient(rgba(0, 240, 255, 0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 240, 255, 0.04) 1px, transparent 1px)
          `,
          backgroundSize: '100% 100%, 40px 40px, 40px 40px',
        }}
      />

      {/* DUAL REPORT VIEW */}
      {viewMode === 'dual-report' ? (
        <div className="relative z-10 flex-1 flex flex-col p-4 md:p-8 max-w-7xl mx-auto w-full">
          {/* Header Bar */}
          <div className="no-print flex flex-col sm:flex-row justify-between items-center pb-4 mb-6 border-b border-cyan-500/40 gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-400 flex items-center justify-center text-cyan-400">
                  <Sliders className="w-4 h-4" />
                </span>
                <h1 className="text-xl md:text-2xl font-black tracking-widest text-[#00f0ff] drop-shadow-[0_0_12px_rgba(0,240,255,0.7)]">
                  LOAD CONTROL &bull; DUAL REPORTS
                </h1>
              </div>
              <p className="text-xs text-sky-300 font-mono mt-1">
                FLIGHT: BS-{formData.flightNoSuffix} ({formData.route}) &bull; OFFICER:{' '}
                {userInfo.userName} &bull; STATION: {userInfo.stationName}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setViewMode('input')}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-200 border border-slate-600 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>BACK TO FORM</span>
              </button>

              <button
                type="button"
                onClick={onGoToSavedFlights}
                className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white border border-emerald-500/60 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow uppercase"
              >
                <FolderOpen className="w-4 h-4 text-emerald-200" />
                <span>SAVED LDM</span>
              </button>

              <button
                type="button"
                onClick={onBackToDashboard}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow transition-all uppercase"
              >
                <Navigation className="w-4 h-4" />
                <span>DASHBOARD</span>
              </button>

              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow"
              >
                <RotateCcw className="w-4 h-4" />
                <span>NEW REPORT</span>
              </button>
            </div>
          </div>

          {/* Dual Columns Container */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 mb-8">
            {/* Left Box: Departure Message */}
            <div className="bg-slate-900/95 border-2 border-cyan-500/60 rounded-xl p-5 shadow-2xl flex flex-col text-slate-100">
              <div className="flex justify-between items-center pb-2.5 mb-3 border-b border-cyan-500/40">
                <h2 className="text-base font-black tracking-widest text-[#00f0ff]">
                  FLIGHT DEPARTURE MESSAGE
                </h2>
                <button
                  type="button"
                  onClick={() => copyToClipboard(departureMessageHtml, 'Departure Message')}
                  className="no-print text-xs font-mono text-cyan-300 hover:underline flex items-center gap-1"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>COPY</span>
                </button>
              </div>
              <pre className="flex-1 overflow-x-auto text-xs md:text-sm font-mono whitespace-pre-wrap leading-relaxed text-slate-200">
                {departureMessageHtml}
              </pre>
            </div>

            {/* Right Box: Flight LDM */}
            <div className="bg-slate-900/95 border-2 border-cyan-500/60 rounded-xl p-5 shadow-2xl flex flex-col text-slate-100">
              <div className="flex justify-between items-center pb-2.5 mb-3 border-b border-cyan-500/40">
                <h2 className="text-base font-black tracking-widest text-[#00f0ff]">
                  FLIGHT LDM
                </h2>
                <button
                  type="button"
                  onClick={() => copyToClipboard(ldmReportText, 'Flight LDM')}
                  className="no-print text-xs font-mono text-cyan-300 hover:underline flex items-center gap-1"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>COPY</span>
                </button>
              </div>
              <pre className="flex-1 overflow-x-auto text-xs md:text-sm font-mono whitespace-pre-wrap leading-relaxed text-emerald-300">
                {ldmReportText}
              </pre>
            </div>
          </div>
        </div>
      ) : (
        /* INPUT FORM (FOR LOAD CONTROLLER) */
        <div className="relative z-10 flex-1 flex flex-col items-center p-3 md:p-6 w-full max-w-5xl mx-auto">
          {/* Top Navigation & Status Bar */}
          <div className="w-full flex flex-col sm:flex-row justify-between items-start sm:items-center pb-3 mb-4 border-b border-cyan-500/30 gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onBackToDashboard}
                className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-200 border border-slate-600 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>MAIN DASHBOARD</span>
              </button>

              <button
                type="button"
                onClick={onGoToSavedFlights}
                className="px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white border border-emerald-500/60 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow uppercase"
              >
                <FolderOpen className="w-4 h-4 text-emerald-200" />
                <span>SAVED LDM</span>
              </button>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-950/80 border border-cyan-400/50 text-[#00f0ff] text-xs font-mono shadow-[0_0_15px_rgba(0,240,255,0.2)]">
              <span>OFFICER: {userInfo.userName || 'OFFICER'}</span>
              <span>&bull;</span>
              <span>USBA-{userInfo.usbaId || '10245'}</span>
              <span>&bull;</span>
              <span className="flex items-center gap-1.5 font-bold text-amber-300">
                <MapPin className="w-3.5 h-3.5 text-amber-400" />
                <span>STATION:</span>
                <select
                  value={extractStationCode(userInfo.stationName)}
                  onChange={(e) => handleStationChange(e.target.value)}
                  className="bg-slate-900 text-cyan-300 border border-cyan-500/60 rounded px-1.5 py-0.5 text-xs font-bold focus:outline-none focus:border-cyan-300 cursor-pointer"
                  title="Active station for flight route generation (e.g. SPD, CXB, CGP, DAC)"
                >
                  {STATION_OPTIONS.map((st) => (
                    <option key={st.code} value={st.code} className="bg-slate-900 text-white">
                      {st.name}
                    </option>
                  ))}
                </select>
              </span>
            </div>
          </div>

          {/* Title Header with HUD Glow */}
          <div className="text-center mb-5">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-widest text-[#00f0ff] drop-shadow-[0_0_15px_rgba(0,240,255,0.7)]">
              FOR LOAD CONTROLLER
            </h1>
            <div className="h-6 mt-1 flex items-center justify-center">
              <span className="font-mono text-xs md:text-sm text-[#ffaa00] font-bold tracking-widest drop-shadow-[0_0_8px_rgba(255,170,0,0.8)] border-r-2 border-[#ffaa00] pr-1 animate-pulse">
                {typedTitle}
              </span>
            </div>
          </div>

          {/* Editing Mode Banner */}
          {editingReportInfo && (
            <div className="mb-4 p-4 rounded-xl bg-gradient-to-r from-amber-500/20 via-amber-600/10 to-slate-900 border border-amber-400/60 shadow-[0_0_20px_rgba(245,158,11,0.2)] flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5 text-amber-300 font-bold uppercase tracking-wider">
                <Edit3 className="w-4 h-4 text-amber-400 animate-pulse" />
                <span>
                  EDITING SAVED FLIGHT BS-{formData.flightNoSuffix || 'DATA'} &bull; EDIT ANY FIELDS &amp; CLICK &ldquo;UPDATE &amp; GENERATE FINAL REPORT&rdquo; TO SAVE UPDATES IN DATA SERVER
                </span>
              </div>
              <button
                type="button"
                onClick={resetForm}
                className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-white border border-amber-500/50 font-bold text-xs uppercase cursor-pointer transition-all"
              >
                CANCEL / NEW FORM
              </button>
            </div>
          )}

          {/* Form Container */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleGenerateReport();
            }}
            className="w-full bg-[#0a1526]/90 border-2 border-[#102a45] shadow-[0_0_30px_rgba(0,240,255,0.15)] rounded-2xl p-4 md:p-7 backdrop-blur-md grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
          >
            {/* DATE */}
            <div className="flex flex-col">
              <label className="text-xs font-bold text-sky-400 mb-1 tracking-wider">DATE</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] font-mono text-sm focus:outline-none focus:border-cyan-400 shadow-[inset_0_0_8px_rgba(0,240,255,0.1)]"
              />
            </div>

            {/* FLIGHT NO */}
            <div className="flex flex-col">
              <label className="text-xs font-bold text-sky-400 mb-1 tracking-wider">FLIGHT NO</label>
              <div className="flex items-center">
                <span className="px-3 py-2 bg-[#0f1e33] border border-r-0 border-cyan-900/80 rounded-l text-sky-400 font-bold text-sm">
                  BS-
                </span>
                <input
                  type="text"
                  placeholder="341"
                  value={formData.flightNoSuffix}
                  onChange={(e) => handleFlightNoChange(e.target.value)}
                  className="w-full p-2 rounded-r bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] font-bold text-sm focus:outline-none focus:border-cyan-400 font-mono"
                />
              </div>
            </div>

            {/* ROUTE */}
            <div className="flex flex-col">
              <label className="text-xs font-bold text-sky-400 mb-1 tracking-wider flex items-center justify-between">
                <span>ROUTE</span>
                <span className="text-[10px] text-cyan-400 font-mono font-bold tracking-normal uppercase bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-500/40">
                  AUTO (READ ONLY)
                </span>
              </label>
              <input
                type="text"
                readOnly
                placeholder="AUTO GENERATED"
                value={formData.route}
                className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] font-bold text-sm focus:outline-none cursor-not-allowed select-all tracking-wider font-mono"
                title="Route is automatically generated from your station to destination (Read Only)"
              />
              {formData.route && (
                <div className="text-[11px] text-emerald-400 font-mono mt-1 flex items-center gap-1.5 bg-emerald-950/40 border border-emerald-500/30 rounded px-2 py-0.5 w-fit">
                  <span>DEP: <strong className="text-amber-300 font-bold">{formData.route.split('-')[0]}</strong></span>
                  <span>➔</span>
                  <span>DEST: <strong className="text-cyan-300 font-bold">{formData.route.split('-')[1] || '--'}</strong></span>
                </div>
              )}
            </div>

            {/* A/C REG */}
            <div className="flex flex-col">
              <label className="text-xs font-bold text-sky-400 mb-1 tracking-wider">A/C REG</label>
              <div className="flex items-center">
                {!isSpecialReg && (
                  <span className="px-2.5 py-2 bg-[#0f1e33] border border-r-0 border-cyan-900/80 rounded-l text-sky-400 font-bold text-sm">
                    S2-
                  </span>
                )}
                <input
                  type="text"
                  list="load-ac-reg-list"
                  placeholder="XXX"
                  value={formData.acRegSuffix}
                  onChange={(e) => handleAcRegChange(e.target.value)}
                  className={`w-full p-2 bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] font-bold text-sm focus:outline-none focus:border-cyan-400 ${
                    isSpecialReg ? 'rounded' : 'rounded-r'
                  }`}
                />
                <datalist id="load-ac-reg-list">
                  <option value="AKG" />
                  <option value="AKK" />
                  <option value="AKH" />
                  <option value="AKI" />
                  <option value="AKJ" />
                  <option value="AKL" />
                  <option value="AKM" />
                  <option value="AKO" />
                  <option value="AKP" />
                  <option value="AJG" />
                  <option value="AJH" />
                  <option value="AJE" />
                  <option value="AJF" />
                  <option value="ALA" />
                  <option value="ALB" />
                  <option value="ALD" />
                  <option value="SXA" />
                  <option value="BBG" />
                  <option value="BBH" />
                  <option value="SAU" />
                </datalist>
              </div>
            </div>

            {/* A/C TYPE */}
            <div className="flex flex-col">
              <label className="text-xs font-bold text-sky-400 mb-1 tracking-wider">A/C TYPE</label>
              <input
                type="text"
                readOnly
                value={formData.acType}
                placeholder="AUTO DETECT"
                className="p-2 rounded bg-[#0a1526]/60 border border-[#111e2f] text-sky-300 font-bold text-sm cursor-not-allowed"
              />
            </div>

            {/* CAPTAIN */}
            <div className="flex flex-col">
              <label className="text-xs font-bold text-sky-400 mb-1 tracking-wider">CAPTAIN</label>
              <input
                type="text"
                placeholder="ENTER CAPTAIN"
                value={formData.captain}
                onChange={(e) => setFormData({ ...formData, captain: e.target.value.toUpperCase() })}
                className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] font-bold text-sm focus:outline-none focus:border-cyan-400"
              />
            </div>

            {/* CONFIGURE */}
            <div className="flex flex-col">
              <label className="text-xs font-bold text-sky-400 mb-1 tracking-wider">CONFIGURE</label>
              <input
                type="text"
                placeholder="2/5"
                value={formData.configure}
                onChange={(e) => setFormData({ ...formData, configure: e.target.value.toUpperCase() })}
                className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] font-bold text-sm focus:outline-none focus:border-cyan-400"
              />
            </div>

            {/* STD (UTC) */}
            <div className="flex flex-col">
              <label className="text-xs font-bold text-sky-400 mb-1 tracking-wider">STD (UTC)</label>
              <input
                type="text"
                maxLength={5}
                placeholder="10:00"
                value={formData.std}
                onChange={(e) => handleTimeChange('std', e.target.value)}
                className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] font-mono text-center text-sm focus:outline-none focus:border-cyan-400"
              />
            </div>

            {/* DOOR CLOSED (UTC) */}
            <div className="flex flex-col">
              <label className="text-xs font-bold text-sky-400 mb-1 tracking-wider">
                DOOR CLOSED (UTC)
              </label>
              <input
                type="text"
                maxLength={5}
                placeholder="10:05"
                value={formData.doorClosed}
                onChange={(e) => handleTimeChange('doorClosed', e.target.value)}
                className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] font-mono text-center text-sm focus:outline-none focus:border-cyan-400"
              />
            </div>

            {/* CHOCKS OFF (UTC) */}
            <div className="flex flex-col">
              <label className="text-xs font-bold text-sky-400 mb-1 tracking-wider">
                CHOCKS OFF (UTC)
              </label>
              <input
                type="text"
                maxLength={5}
                placeholder="10:10"
                value={formData.chocksOff}
                onChange={(e) => handleTimeChange('chocksOff', e.target.value)}
                className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] font-mono text-center text-sm focus:outline-none focus:border-cyan-400"
              />
            </div>

            {/* AIRBORNE (UTC) */}
            <div className="flex flex-col">
              <label className="text-xs font-bold text-sky-400 mb-1 tracking-wider">
                AIRBORNE (UTC)
              </label>
              <input
                type="text"
                maxLength={5}
                placeholder="10:20"
                value={formData.airborne}
                onChange={(e) => handleTimeChange('airborne', e.target.value)}
                className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] font-mono text-center text-sm focus:outline-none focus:border-cyan-400"
              />
            </div>

            {/* DEPARTURE STATUS */}
            <div className="flex flex-col">
              <label className="text-xs font-bold text-sky-400 mb-1 tracking-wider">
                DEPARTURE STATUS
              </label>
              <input
                type="text"
                value={formData.departureStatus}
                onChange={(e) =>
                  setFormData({ ...formData, departureStatus: e.target.value.toUpperCase() })
                }
                className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-amber-300 font-bold text-sm focus:outline-none focus:border-cyan-400"
              />
            </div>

            {/* BOARDING GATE */}
            <div className="flex flex-col">
              <label className="text-xs font-bold text-sky-400 mb-1 tracking-wider">
                BOARDING GATE
              </label>
              <input
                type="text"
                placeholder="E.G., C1"
                value={formData.boardingGate}
                onChange={(e) => handleBoardingGateChange(e.target.value)}
                className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] font-bold text-sm focus:outline-none focus:border-cyan-400"
              />
            </div>

            {/* DOC IN (UTC) */}
            <div className="flex flex-col">
              <label className="text-xs font-bold text-sky-400 mb-1 tracking-wider">
                DOC IN (UTC) {!isAllowedGate && <span className="text-slate-500 text-[10px]">(C1-C8 ONLY)</span>}
              </label>
              <input
                type="text"
                readOnly={!isAllowedGate}
                maxLength={5}
                placeholder={isAllowedGate ? '10:00' : 'N/A'}
                value={formData.docIn}
                onChange={(e) => handleTimeChange('docIn', e.target.value)}
                className={`p-2 rounded text-sm font-mono text-center ${
                  isAllowedGate
                    ? 'bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] focus:outline-none focus:border-cyan-400'
                    : 'bg-[#0a1526]/60 border border-[#111e2f] text-slate-500 cursor-not-allowed'
                }`}
              />
            </div>

            {/* DOC OUT (UTC) */}
            <div className="flex flex-col">
              <label className="text-xs font-bold text-sky-400 mb-1 tracking-wider">
                DOC OUT (UTC) {!isAllowedGate && <span className="text-slate-500 text-[10px]">(C1-C8 ONLY)</span>}
              </label>
              <input
                type="text"
                readOnly={!isAllowedGate}
                maxLength={5}
                placeholder={isAllowedGate ? '10:15' : 'N/A'}
                value={formData.docOut}
                onChange={(e) => handleTimeChange('docOut', e.target.value)}
                className={`p-2 rounded text-sm font-mono text-center ${
                  isAllowedGate
                    ? 'bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] focus:outline-none focus:border-cyan-400'
                    : 'bg-[#0a1526]/60 border border-[#111e2f] text-slate-500 cursor-not-allowed'
                }`}
              />
            </div>

            {/* FUEL UPLIFT */}
            <div className="flex flex-col">
              <label className="text-xs font-bold text-sky-400 mb-1 tracking-wider">FUEL UPLIFT</label>
              <div className="flex items-center">
                <input
                  type="number"
                  placeholder="E.G., 17500"
                  value={formData.fuelUplift}
                  onChange={(e) => setFormData({ ...formData, fuelUplift: e.target.value })}
                  className="w-full p-2 rounded-l bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] font-bold text-sm focus:outline-none focus:border-cyan-400"
                />
                <span className="px-3 py-2 bg-[#0f1e33] border border-l-0 border-cyan-900/80 rounded-r text-sky-400 font-bold text-sm">
                  KG
                </span>
              </div>
            </div>

            {/* PASSENGERS (M+F+C+I=TOTAL) */}
            <div className="flex flex-col sm:col-span-2">
              <label className="text-xs font-bold text-sky-400 mb-1 tracking-wider">
                PASSENGERS (M+F+C+I = TOTAL)
              </label>
              <div className="flex items-center gap-1.5 bg-[#060d1a]/90 border border-cyan-900/80 rounded p-1.5">
                <input
                  type="number"
                  placeholder="M"
                  value={formData.paxMale}
                  onChange={(e) => setFormData({ ...formData, paxMale: e.target.value })}
                  className="w-full p-1.5 bg-slate-900/90 text-[#00f0ff] text-center font-bold text-sm rounded border border-slate-700"
                />
                <span className="text-[#00f0ff] font-bold">+</span>
                <input
                  type="number"
                  placeholder="F"
                  value={formData.paxFemale}
                  onChange={(e) => setFormData({ ...formData, paxFemale: e.target.value })}
                  className="w-full p-1.5 bg-slate-900/90 text-[#00f0ff] text-center font-bold text-sm rounded border border-slate-700"
                />
                <span className="text-[#00f0ff] font-bold">+</span>
                <input
                  type="number"
                  placeholder="C"
                  value={formData.paxChild}
                  onChange={(e) => setFormData({ ...formData, paxChild: e.target.value })}
                  className="w-full p-1.5 bg-slate-900/90 text-[#00f0ff] text-center font-bold text-sm rounded border border-slate-700"
                />
                <span className="text-[#00f0ff] font-bold">+</span>
                <input
                  type="number"
                  placeholder="I"
                  value={formData.paxInfant}
                  onChange={(e) => setFormData({ ...formData, paxInfant: e.target.value })}
                  className="w-full p-1.5 bg-slate-900/90 text-[#00f0ff] text-center font-bold text-sm rounded border border-slate-700"
                />
                <span className="text-[#00f0ff] font-bold">=</span>
                <input
                  type="text"
                  readOnly
                  placeholder="T"
                  value={formData.paxTotal}
                  className="w-full p-1.5 bg-[#0a1526]/80 text-emerald-300 font-black text-center text-sm rounded border border-emerald-500/50 cursor-not-allowed"
                />
              </div>
            </div>

            {/* BAGGAGE (WEIGHT, PCS, COM NO) */}
            <div className="flex flex-col sm:col-span-2">
              <label className="text-xs font-bold text-sky-400 mb-1 tracking-wider">BAGGAGE</label>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="number"
                  placeholder="WEIGHT"
                  value={formData.baggageWeight}
                  onChange={(e) => setFormData({ ...formData, baggageWeight: e.target.value })}
                  className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] font-bold text-sm focus:outline-none focus:border-cyan-400"
                />
                <input
                  type="number"
                  placeholder="PCS"
                  value={formData.baggagePcs}
                  onChange={(e) => setFormData({ ...formData, baggagePcs: e.target.value })}
                  className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] font-bold text-sm focus:outline-none focus:border-cyan-400"
                />
                <input
                  type="text"
                  placeholder="COM NO"
                  value={formData.baggageComNo}
                  onChange={(e) =>
                    setFormData({ ...formData, baggageComNo: e.target.value.toUpperCase() })
                  }
                  className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] font-bold text-sm focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            {/* CARGO (WEIGHT, PCS, COM NO) */}
            <div className="flex flex-col sm:col-span-2">
              <label className="text-xs font-bold text-sky-400 mb-1 tracking-wider">CARGO</label>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="number"
                  placeholder="WEIGHT"
                  value={formData.cargoWeight}
                  onChange={(e) => setFormData({ ...formData, cargoWeight: e.target.value })}
                  className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] font-bold text-sm focus:outline-none focus:border-cyan-400"
                />
                <input
                  type="number"
                  placeholder="PCS"
                  value={formData.cargoPcs}
                  onChange={(e) => setFormData({ ...formData, cargoPcs: e.target.value })}
                  className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] font-bold text-sm focus:outline-none focus:border-cyan-400"
                />
                <input
                  type="text"
                  placeholder="COM NO"
                  value={formData.cargoComNo}
                  onChange={(e) =>
                    setFormData({ ...formData, cargoComNo: e.target.value.toUpperCase() })
                  }
                  className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] font-bold text-sm focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            {/* CREW BAG (PCS, COM NO) */}
            <div className="flex flex-col">
              <label className="text-xs font-bold text-sky-400 mb-1 tracking-wider">CREW BAG</label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  placeholder="PCS"
                  value={formData.crewBagPcs}
                  onChange={(e) => setFormData({ ...formData, crewBagPcs: e.target.value })}
                  className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] font-bold text-sm focus:outline-none focus:border-cyan-400"
                />
                <input
                  type="text"
                  placeholder="COM NO"
                  value={formData.crewBagComNo}
                  onChange={(e) =>
                    setFormData({ ...formData, crewBagComNo: e.target.value.toUpperCase() })
                  }
                  className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] font-bold text-sm focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            {/* TOTAL WEIGHT (CALCULATED) */}
            <div className="flex flex-col">
              <label className="text-xs font-bold text-sky-400 mb-1 tracking-wider">
                TOTAL WEIGHT
              </label>
              <input
                type="text"
                readOnly
                placeholder="0"
                value={formData.totalWeight}
                className="p-2 rounded bg-[#0a1526]/60 border border-[#111e2f] text-amber-300 font-black text-sm text-center cursor-not-allowed"
              />
            </div>

            {/* DISTRIBUTION (DYNAMIC CONTAINER ACCORDING TO AIRCRAFT TYPE) */}
            <div className="flex flex-col sm:col-span-2">
              <label className="text-xs font-bold text-sky-400 mb-1 tracking-wider">
                DISTRIBUTION {isBoeing && '(BOEING C1-C4)'} {isAirbus && '(AIRBUS C1-C5)'}{' '}
                {isAtr && '(ATR FWR/FWL/AFT)'}
              </label>

              {/* BOEING DISTRIBUTION */}
              {isBoeing && (
                <div className="grid grid-cols-4 gap-2">
                  <input
                    type="number"
                    placeholder="C1"
                    value={formData.distB1}
                    onChange={(e) => setFormData({ ...formData, distB1: e.target.value })}
                    className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] font-bold text-center text-sm"
                  />
                  <input
                    type="number"
                    placeholder="C2"
                    value={formData.distB2}
                    onChange={(e) => setFormData({ ...formData, distB2: e.target.value })}
                    className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] font-bold text-center text-sm"
                  />
                  <input
                    type="number"
                    placeholder="C3"
                    value={formData.distB3}
                    onChange={(e) => setFormData({ ...formData, distB3: e.target.value })}
                    className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] font-bold text-center text-sm"
                  />
                  <input
                    type="number"
                    placeholder="C4"
                    value={formData.distB4}
                    onChange={(e) => setFormData({ ...formData, distB4: e.target.value })}
                    className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] font-bold text-center text-sm"
                  />
                </div>
              )}

              {/* AIRBUS DISTRIBUTION */}
              {isAirbus && (
                <div className="grid grid-cols-5 gap-2">
                  <input
                    type="number"
                    placeholder="C1"
                    value={formData.distA1}
                    onChange={(e) => setFormData({ ...formData, distA1: e.target.value })}
                    className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] font-bold text-center text-sm"
                  />
                  <input
                    type="number"
                    placeholder="C2"
                    readOnly={isSxaReg}
                    value={formData.distA2}
                    onChange={(e) => setFormData({ ...formData, distA2: e.target.value })}
                    className={`p-2 rounded font-bold text-center text-sm ${
                      isSxaReg
                        ? 'bg-black/60 border border-red-500 text-red-500 cursor-not-allowed'
                        : 'bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff]'
                    }`}
                  />
                  <input
                    type="number"
                    placeholder="C3"
                    value={formData.distA3}
                    onChange={(e) => setFormData({ ...formData, distA3: e.target.value })}
                    className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] font-bold text-center text-sm"
                  />
                  <input
                    type="number"
                    placeholder="C4"
                    value={formData.distA4}
                    onChange={(e) => setFormData({ ...formData, distA4: e.target.value })}
                    className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] font-bold text-center text-sm"
                  />
                  <input
                    type="number"
                    placeholder="C5"
                    value={formData.distA5}
                    onChange={(e) => setFormData({ ...formData, distA5: e.target.value })}
                    className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] font-bold text-center text-sm"
                  />
                </div>
              )}

              {/* ATR DISTRIBUTION */}
              {isAtr && (
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="number"
                    placeholder="FWR"
                    value={formData.distAtrFwr}
                    onChange={(e) => setFormData({ ...formData, distAtrFwr: e.target.value })}
                    className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] font-bold text-center text-sm"
                  />
                  <input
                    type="number"
                    placeholder="FWL"
                    value={formData.distAtrFwl}
                    onChange={(e) => setFormData({ ...formData, distAtrFwl: e.target.value })}
                    className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] font-bold text-center text-sm"
                  />
                  <input
                    type="number"
                    placeholder="AFT"
                    value={formData.distAtrAft}
                    onChange={(e) => setFormData({ ...formData, distAtrAft: e.target.value })}
                    className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] font-bold text-center text-sm"
                  />
                </div>
              )}

              {!isBoeing && !isAirbus && !isAtr && (
                <div className="p-2 rounded bg-slate-900/60 border border-slate-800 text-slate-500 text-xs italic text-center">
                  SELECT AIRCRAFT REGISTRATION TO CONFIGURE COMPARTMENTS
                </div>
              )}
            </div>

            {/* STATUS */}
            <div className="flex flex-col">
              <label className="text-xs font-bold text-sky-400 mb-1 tracking-wider">STATUS</label>
              <input
                type="text"
                readOnly
                placeholder="EQUAL"
                value={formData.status}
                className={`p-2 rounded font-black text-center text-sm cursor-not-allowed ${
                  formData.status === 'EQUAL'
                    ? 'bg-emerald-950/80 border border-emerald-500 text-emerald-300'
                    : formData.status
                    ? 'bg-rose-950/80 border border-rose-500 text-rose-300'
                    : 'bg-[#0a1526]/60 border border-[#111e2f] text-slate-500'
                }`}
              />
            </div>

            {/* MAIL */}
            <div className="flex flex-col">
              <label className="text-xs font-bold text-sky-400 mb-1 tracking-wider">MAIL</label>
              <input
                type="text"
                placeholder="XXX PCS"
                value={formData.mail}
                onChange={(e) => setFormData({ ...formData, mail: e.target.value.toUpperCase() })}
                className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] font-bold text-sm focus:outline-none focus:border-cyan-400"
              />
            </div>

            {/* COUNTER NOSHOW */}
            <div className="flex flex-col">
              <label className="text-xs font-bold text-sky-400 mb-1 tracking-wider">
                COUNTER NOSHOW
              </label>
              <input
                type="number"
                placeholder="PAX FIGURE"
                value={formData.counterNoshow}
                onChange={(e) => setFormData({ ...formData, counterNoshow: e.target.value })}
                className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] font-bold text-sm focus:outline-none focus:border-cyan-400"
              />
            </div>

            {/* GATE NO SHOW */}
            <div className="flex flex-col">
              <label className="text-xs font-bold text-sky-400 mb-1 tracking-wider">
                GATE NO SHOW
              </label>
              <input
                type="number"
                placeholder="PAX FIGURE"
                value={formData.gateNoShow}
                onChange={(e) => setFormData({ ...formData, gateNoShow: e.target.value })}
                className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] font-bold text-sm focus:outline-none focus:border-cyan-400"
              />
            </div>

            {/* SELF OFFLOAD */}
            <div className="flex flex-col">
              <label className="text-xs font-bold text-sky-400 mb-1 tracking-wider">
                SELF OFFLOAD
              </label>
              <input
                type="number"
                placeholder="PAX FIGURE"
                value={formData.selfOffload}
                onChange={(e) => setFormData({ ...formData, selfOffload: e.target.value })}
                className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] font-bold text-sm focus:outline-none focus:border-cyan-400"
              />
            </div>

            {/* REFUSED */}
            <div className="flex flex-col">
              <label className="text-xs font-bold text-sky-400 mb-1 tracking-wider">REFUSED</label>
              <input
                type="number"
                placeholder="PAX FIGURE"
                value={formData.refused}
                onChange={(e) => setFormData({ ...formData, refused: e.target.value })}
                className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] font-bold text-sm focus:outline-none focus:border-cyan-400"
              />
            </div>

            {/* IMMIGRATION OFF */}
            <div className="flex flex-col">
              <label className="text-xs font-bold text-sky-400 mb-1 tracking-wider">
                IMMIGRATION OFF
              </label>
              <input
                type="number"
                placeholder="PAX FIGURE"
                value={formData.immigrationOff}
                onChange={(e) => setFormData({ ...formData, immigrationOff: e.target.value })}
                className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] font-bold text-sm focus:outline-none focus:border-cyan-400"
              />
            </div>

            {/* IMMIGRATION NOT FACE */}
            <div className="flex flex-col">
              <label className="text-xs font-bold text-sky-400 mb-1 tracking-wider">
                IMMIGRATION NOT FACE
              </label>
              <input
                type="number"
                placeholder="PAX FIGURE"
                value={formData.immigrationNotFace}
                onChange={(e) => setFormData({ ...formData, immigrationNotFace: e.target.value })}
                className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] font-bold text-sm focus:outline-none focus:border-cyan-400"
              />
            </div>

            {/* CUSTOM OFF */}
            <div className="flex flex-col">
              <label className="text-xs font-bold text-sky-400 mb-1 tracking-wider">CUSTOM OFF</label>
              <input
                type="number"
                placeholder="PAX FIGURE"
                value={formData.customOff}
                onChange={(e) => setFormData({ ...formData, customOff: e.target.value })}
                className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] font-bold text-sm focus:outline-none focus:border-cyan-400"
              />
            </div>

            {/* MAAS */}
            <div className="flex flex-col">
              <label className="text-xs font-bold text-sky-400 mb-1 tracking-wider">MAAS</label>
              <input
                type="number"
                placeholder="PAX FIGURE"
                value={formData.maas}
                onChange={(e) => setFormData({ ...formData, maas: e.target.value })}
                className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] font-bold text-sm focus:outline-none focus:border-cyan-400"
              />
            </div>

            {/* UM PAX */}
            <div className="flex flex-col">
              <label className="text-xs font-bold text-sky-400 mb-1 tracking-wider">UM PAX</label>
              <input
                type="number"
                placeholder="PAX FIGURE"
                value={formData.umPax}
                onChange={(e) => setFormData({ ...formData, umPax: e.target.value })}
                className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] font-bold text-sm focus:outline-none focus:border-cyan-400"
              />
            </div>

            {/* WCHR & WCHC PAIRS */}
            <div className="flex flex-col sm:col-span-2">
              <label className="text-xs font-bold text-sky-400 mb-1 tracking-wider">
                WCHR &bull; WCHC (FIG + SEAT)
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex gap-1.5">
                  <input
                    type="number"
                    placeholder="WCHR FIG"
                    value={formData.wchrFig}
                    onChange={(e) => setFormData({ ...formData, wchrFig: e.target.value })}
                    className="w-24 p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] font-bold text-center text-sm"
                  />
                  <input
                    type="text"
                    placeholder="SEAT NO"
                    value={formData.wchrSeat}
                    onChange={(e) =>
                      setFormData({ ...formData, wchrSeat: e.target.value.toUpperCase() })
                    }
                    className="w-full p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] font-bold text-sm"
                  />
                </div>

                <div className="flex gap-1.5">
                  <input
                    type="number"
                    placeholder="WCHC FIG"
                    value={formData.wchcFig}
                    onChange={(e) => setFormData({ ...formData, wchcFig: e.target.value })}
                    className="w-24 p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] font-bold text-center text-sm"
                  />
                  <input
                    type="text"
                    placeholder="SEAT NO"
                    value={formData.wchcSeat}
                    onChange={(e) =>
                      setFormData({ ...formData, wchcSeat: e.target.value.toUpperCase() })
                    }
                    className="w-full p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] font-bold text-sm"
                  />
                </div>
              </div>
            </div>

            {/* LOADING STUFF / G7 */}
            <div className="flex flex-col">
              <label className="text-xs font-bold text-sky-400 mb-1 tracking-wider">
                LOADING STUFF / G7
              </label>
              <input
                type="text"
                placeholder="LOADING STUFF"
                value={formData.loadingStuff}
                onChange={(e) =>
                  setFormData({ ...formData, loadingStuff: e.target.value.toUpperCase() })
                }
                className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] font-bold text-sm focus:outline-none focus:border-cyan-400"
              />
            </div>

            {/* LOAD CONTROLLER */}
            <div className="flex flex-col">
              <label className="text-xs font-bold text-sky-400 mb-1 tracking-wider">
                LOAD CONTROLLER
              </label>
              <input
                type="text"
                placeholder="LOAD CONTROLLER"
                value={formData.loadController}
                onChange={(e) =>
                  setFormData({ ...formData, loadController: e.target.value.toUpperCase() })
                }
                className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] font-bold text-sm focus:outline-none focus:border-cyan-400"
              />
            </div>

            {/* UNDER LOAD */}
            <div className="flex flex-col">
              <label className="text-xs font-bold text-sky-400 mb-1 tracking-wider">UNDER LOAD</label>
              <input
                type="text"
                placeholder="UNDER LOAD"
                value={formData.paxHandling}
                onChange={(e) =>
                  setFormData({ ...formData, paxHandling: e.target.value.toUpperCase() })
                }
                className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] font-bold text-sm focus:outline-none focus:border-cyan-400"
              />
            </div>

            {/* REMARKS */}
            <div className="flex flex-col sm:col-span-full">
              <label className="text-xs font-bold text-sky-400 mb-1 tracking-wider">REMARKS</label>
              <textarea
                rows={2}
                placeholder="INPUT ANY NOSHOW PNR(S) OR OTHER REMARKS HERE."
                value={formData.remarks}
                onChange={(e) =>
                  setFormData({ ...formData, remarks: e.target.value.toUpperCase() })
                }
                className="p-2.5 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] font-mono text-sm focus:outline-none focus:border-cyan-400"
              />
            </div>

            {/* Form Actions */}
            <div className="sm:col-span-full flex flex-col sm:flex-row items-center justify-center gap-4 mt-4 pt-4 border-t border-cyan-900/40">
              <button
                type="button"
                onClick={onBackToDashboard}
                className="w-full sm:w-auto px-6 py-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-200 border border-slate-600 text-sm font-bold flex items-center justify-center gap-2 cursor-pointer transition-all shadow"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>PREVIOUS</span>
              </button>

              <button
                type="submit"
                className="w-full sm:w-auto px-10 py-3.5 rounded-lg bg-[#00f0ff] hover:bg-[#38bdf8] text-[#060d1a] font-black text-sm md:text-base tracking-widest shadow-[0_0_20px_rgba(0,240,255,0.5)] hover:shadow-[0_0_30px_rgba(0,240,255,0.8)] cursor-pointer transition-all flex items-center justify-center gap-2"
              >
                <Plane className="w-5 h-5 text-black" />
                <span>
                  {editingReportInfo ? 'UPDATE & GENERATE FINAL REPORT' : 'GENERATE FINAL REPORT'}
                </span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
