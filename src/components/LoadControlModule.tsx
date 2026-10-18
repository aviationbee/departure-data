import React, { useState, useEffect, useRef } from 'react';
import { UserInfo, FlightFormData } from '../types';
import {
  findRouteByFlightNo,
  ROUTE_MAP as AVIATION_ROUTE_MAP,
  AIRPORT_NAMES,
  calculateArrivalStatus,
  calculateDepartureStatus,
  parseTimeToMinutes,
} from '../data/aviationData';
import {
  saveFlightReportToCloud,
  deleteFlightReportFromCloud,
  logUserActivity,
  StoredFlightReport,
} from '../firebase';
import { DepartureReportTable } from './DepartureReportTable';
import { ArrivalReportTable } from './ArrivalReportTable';
import {
  ArrowLeft,
  Navigation,
  Printer,
  Copy,
  RotateCcw,
  Plane,
  FileText,
  Sliders,
  FolderOpen,
  Edit3,
  MapPin,
  Clock,
  Send,
  Layers,
  CheckCircle,
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

  if (userStn === dest && origin === 'DAC') {
    return standardRoute;
  }

  return `${userStn}-${dest}`;
}

export function getArrivalRouteOptions(flightNoStr: string, station?: string): string[] {
  const cleanNum = flightNoStr.replace(/\D/g, '');
  const num = parseInt(cleanNum, 10);
  if (isNaN(num)) return [];

  const stn = extractStationCode(station);

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

  if (standardRoute && standardRoute.includes('-')) {
    const parts = standardRoute.split('-').map((s) => s.trim().toUpperCase());
    const origin = parts[0];
    const dest = parts[1];

    if (origin === 'DAC') {
      // Outbound flight from Dhaka via station (e.g. 341 DAC-DXB -> DAC-SPD & SPD-DXB)
      if (dest === stn) {
        return [`DAC-${stn}`, `${stn}-DAC`];
      }
      return [`DAC-${stn}`, `${stn}-${dest}`];
    } else if (dest === 'DAC') {
      // Inbound flight to Dhaka via station (e.g. 342 DXB-DAC -> DXB-SPD & SPD-DAC)
      if (origin === stn) {
        return [`${stn}-DAC`, `DAC-${stn}`];
      }
      return [`${origin}-${stn}`, `${stn}-DAC`];
    } else {
      return [`${origin}-${stn}`, `${stn}-${dest}`];
    }
  }

  // Fallback for custom or unmapped flight number
  const isEven = num % 2 === 0;
  if (isEven) {
    return [`DXB-${stn}`, `${stn}-DAC`];
  } else {
    return [`DAC-${stn}`, `${stn}-DXB`];
  }
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
  const fullYear = date.getUTCFullYear().toString();
  if (format === 'DDMON') return `${day}${month}`;
  if (format === 'DD') return day;
  return `${day}${month}${year}`;
}

function formatDateLong(dateString: string): string {
  if (!dateString) return 'N/A';
  const date = new Date(dateString + 'T00:00:00Z');
  if (isNaN(date.getTime())) return 'N/A';
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = date.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' }).toUpperCase();
  const fullYear = date.getUTCFullYear().toString();
  return `${day}${month}${fullYear}`;
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

export interface LdmFormData {
  date: string;
  flightNoSuffix: string;
  route: string;
  acRegSuffix: string;
  acType: string;
  captain: string;
  configure: string;
  boardingGate: string;
  docIn: string;
  docOut: string;

  // ARRIVAL INFO
  arrFlightNo: string;
  arrRoute: string;
  sta: string;
  chocksOn: string;
  doorOpen: string;
  arrivalStatus: string;
  arrTotalPax: string;
  arrBagWeight: string;
  arrBagPcs: string;
  arrCargoWeight: string;
  arrCargoPcs: string;
  arrMailPcs: string;
  arrPaxReceiving: string;
  arrUnloading: string;
  arrVip: string;
  arrCip: string;
  arrMaas: string;
  arrHandling: string;
  arrRemarks: string;

  // DEPARTURE INFO
  std: string;
  doorClosed: string;
  chocksOff: string;
  airborne: string;
  departureStatus: string;
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
  crewBagWeight: string;
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
  umPaxSeat: string;
  wchrFig: string;
  wchrSeat: string;
  wchcFig: string;
  wchcSeat: string;
  loadingStuff: string;
  loadController: string;
  paxHandling: string;
  tripTime: string;
  underLoad: string;
  remarks: string;
}

const INITIAL_LDM_DATA: LdmFormData = {
  date: new Date().toISOString().split('T')[0],
  flightNoSuffix: '',
  route: '',
  acRegSuffix: '',
  acType: '',
  captain: '',
  configure: '2/5',
  boardingGate: '',
  docIn: '',
  docOut: '',

  // ARRIVAL INFO
  arrFlightNo: '',
  arrRoute: '',
  sta: '',
  chocksOn: '',
  doorOpen: '',
  arrivalStatus: 'FLIGHT ON TIME ARRIVED',
  arrTotalPax: '',
  arrBagWeight: '',
  arrBagPcs: '',
  arrCargoWeight: '',
  arrCargoPcs: '',
  arrMailPcs: '',
  arrPaxReceiving: '',
  arrUnloading: '',
  arrVip: '',
  arrCip: '',
  arrMaas: '',
  arrHandling: '',
  arrRemarks: '',

  // DEPARTURE INFO
  std: '',
  doorClosed: '',
  chocksOff: '',
  airborne: '',
  departureStatus: 'ON TIME',
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
  umPaxSeat: '',
  wchrFig: '',
  wchrSeat: '',
  wchcFig: '',
  wchcSeat: '',
  loadingStuff: '',
  loadController: '',
  paxHandling: '',
  tripTime: '',
  underLoad: '',
  remarks: '',
};

function calculateEta(chocksOffStr: string, tripTimeStr: string): string {
  const offMin = parseTimeToMinutes(chocksOffStr);
  if (offMin === null) return '----';
  const cleanTrip = (tripTimeStr || '').replace(/\D/g, '');
  let tripMin = 0;
  if ((tripTimeStr || '').includes(':')) {
    const parts = tripTimeStr.split(':');
    tripMin = (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
  } else if (cleanTrip.length >= 3) {
    const h = parseInt(cleanTrip.slice(0, cleanTrip.length - 2), 10) || 0;
    const m = parseInt(cleanTrip.slice(-2), 10) || 0;
    tripMin = h * 60 + m;
  } else {
    tripMin = parseInt(cleanTrip, 10) || 0;
  }
  const etaTotalMin = (offMin + tripMin) % 1440;
  const etaH = Math.floor(etaTotalMin / 60);
  const etaM = etaTotalMin % 60;
  return `${String(etaH).padStart(2, '0')}${String(etaM).padStart(2, '0')}`;
}

function calculateTakeoffFuel(fuelUpliftStr: string, acType: string): string {
  const fuel = parseInt((fuelUpliftStr || '').replace(/\D/g, ''), 10);
  if (isNaN(fuel) || fuel <= 0) return '0';
  const typeUpper = (acType || '').toUpperCase();
  let taxiFuel = 200; // Boeing default: 200 KG
  if (typeUpper.includes('ATR')) {
    taxiFuel = 100; // ATR: 100 KG
  } else if (typeUpper.includes('AIRBUS') || typeUpper.includes('330') || typeUpper.includes('320')) {
    taxiFuel = 900; // AIRBUS: 900 KG
  } else if (typeUpper.includes('BOEING') || typeUpper.includes('737')) {
    taxiFuel = 200; // BOEING: 200 KG
  }
  const takeOff = Math.max(0, fuel - taxiFuel);
  return String(takeOff);
}

function formatTripTime(tripTimeStr?: string): string {
  if (!tripTimeStr) return '00:00';
  const clean = tripTimeStr.replace(/\D/g, '');
  if (tripTimeStr.includes(':')) {
    const parts = tripTimeStr.split(':');
    return `${String(parts[0]).padStart(2, '0')}:${String(parts[1]).padStart(2, '0')}`;
  }
  if (clean.length === 4) {
    return `${clean.slice(0, 2)}:${clean.slice(2, 4)}`;
  }
  if (clean.length === 3) {
    return `0${clean.slice(0, 1)}:${clean.slice(1, 3)}`;
  }
  return clean ? `${clean}:00` : '00:00';
}

function calculateDepartureStatusRemark(
  stdStr?: string,
  chocksOffStr?: string,
  manualStatus?: string
): string {
  const stdMin = parseTimeToMinutes(stdStr || '');
  const offMin = parseTimeToMinutes(chocksOffStr || '');
  if (stdMin !== null && offMin !== null) {
    let diff = offMin - stdMin;
    if (diff < -720) diff += 1440;
    else if (diff > 720) diff -= 1440;
    if (diff === 0) return 'FLIGHT ON TIME DEPARTURE';
    const absDiff = Math.abs(diff);
    const hrs = Math.floor(absDiff / 60);
    const mins = absDiff % 60;
    const timeFormatted = `${String(hrs).padStart(2, '0')}${String(mins).padStart(2, '0')}`;
    if (diff < 0) {
      return `FLT ${timeFormatted} HRS EARLY DEPARTURE`;
    } else {
      return `FLT ${timeFormatted} HRS DELAY DEPARTURE`;
    }
  }
  return manualStatus ? manualStatus.toUpperCase() : 'FLIGHT ON TIME DEPARTURE';
}

export function buildMvtMessage(d: LdmFormData, officerUser: UserInfo): string {
  const departStation = extractStationCode(officerUser.stationName);
  const routeParts = (d.route || '').split('-').map((s) => s.trim().toUpperCase());
  const destStation = routeParts.length > 1 ? routeParts[1] : 'DXB';
  const cleanRawReg = d.acRegSuffix.toUpperCase().replace(/^(S2-|HS-|PK-)/, '');
  let fullReg = `S2-${cleanRawReg}`;
  if (['PKBBG', 'BBG', 'PKBBH', 'BBH'].includes(cleanRawReg)) fullReg = `PK-${cleanRawReg.replace(/^PK/, '')}`;
  else if (['9HSAU', 'SAU'].includes(cleanRawReg)) fullReg = `9H-${cleanRawReg.replace(/^9H/, '')}`;
  else if (['HSSXA', 'SXA'].includes(cleanRawReg)) fullReg = `HS-${cleanRawReg.replace(/^HS/, '')}`;

  const fltNo = `BS-${d.flightNoSuffix || '000'}`;
  const config = d.configure || '2/5';
  const formattedDate = formatDate(d.date, 'DDMONYY');

  const chocksOffClean = (d.chocksOff || '').replace(/\D/g, '').padEnd(4, '0').slice(0, 4);
  const airborneClean = (d.airborne || '').replace(/\D/g, '').padEnd(4, '0').slice(0, 4);
  const etaClean = calculateEta(chocksOffClean, d.tripTime || '00:00');

  const picName = d.captain
    ? d.captain.toUpperCase().startsWith('CAPT')
      ? d.captain.toUpperCase()
      : `CAPT. ${d.captain.toUpperCase()}`
    : 'CAPT. N/A';

  const paxAdultChild =
    (parseInt(d.paxMale, 10) || 0) +
    (parseInt(d.paxFemale, 10) || 0) +
    (parseInt(d.paxChild, 10) || 0);
  const paxInfant = parseInt(d.paxInfant, 10) || 0;
  const paxDepart = d.paxTotal ? `${paxAdultChild}+${String(paxInfant).padStart(2, '0')}` : '00+00';

  const takeOffFuel = calculateTakeoffFuel(d.fuelUplift, d.acType);
  const tripTimeFormatted = formatTripTime(d.tripTime);
  const depStatusRemark = calculateDepartureStatusRemark(d.std, d.chocksOff, d.departureStatus);

  return `MVT
${fltNo}/${formattedDate}.${config}.${fullReg}.${departStation}
ATD ${chocksOffClean}/${airborneClean} UTC ETA ${etaClean} UTC ${destStation}
PIC: ${picName}
PAX: ${paxDepart}
TAKE-OFF FUEL: ${takeOffFuel}
FLT TIME: ${tripTimeFormatted} HRS
REMARKS: ${depStatusRemark}

REGARDS
${(officerUser.userName || 'OFFICER').toUpperCase()}
ASD ${departStation} APT
US-BANGLA AIRLINES`;
}

export function reconstructLdmFormDataFromStoredReport(r: StoredFlightReport): LdmFormData {
  const raw = (r.rawFormData as any) || {};
  const ldm = (raw.ldmRawData as any) || raw;

  return {
    date: ldm.date || r.date || new Date().toISOString().split('T')[0],
    flightNoSuffix: (ldm.flightNoSuffix || r.flightNo || '').replace(/^BS-/i, ''),
    route: ldm.route || r.route || '',
    acRegSuffix: (ldm.acRegSuffix || r.acReg || '').replace(/^(S2-|HS-|PK-|9H-)/i, ''),
    acType: ldm.acType || r.acType || '',
    captain: ldm.captain || r.captain || '',
    configure: ldm.configure || r.configure || '2/5',
    boardingGate: ldm.boardingGate || raw.boardingGate || '',
    docIn: ldm.docIn || raw.docIn || '',
    docOut: ldm.docOut || raw.docOut || '',

    // ARRIVAL INFO
    arrFlightNo: ldm.arrFlightNo || (r.arrFlightNo || '').replace(/^BS-/i, '') || '',
    arrRoute: ldm.arrRoute || r.arrRoute || '',
    sta: ldm.sta || r.sta || '',
    chocksOn: ldm.chocksOn || r.chocksOn || '',
    doorOpen: ldm.doorOpen || r.doorOpen || '',
    arrivalStatus: ldm.arrivalStatus || r.arrivalStatus || 'FLIGHT ON TIME ARRIVED',
    arrTotalPax: ldm.arrTotalPax || (r as any).arrTotalPax || (r as any).arrPaxAdult || '',
    arrBagWeight: ldm.arrBagWeight || (r as any).arrBagWeight || (r as any).arrBaggageWeight || '',
    arrBagPcs: ldm.arrBagPcs || (r as any).arrBagPcs || (r as any).arrBaggagePcs || '',
    arrCargoWeight: ldm.arrCargoWeight || (r as any).arrCargoWeight || '',
    arrCargoPcs: ldm.arrCargoPcs || (r as any).arrCargoPcs || '',
    arrMailPcs: ldm.arrMailPcs || (r as any).arrMailPcs || (r as any).arrMail || '',
    arrPaxReceiving: ldm.arrPaxReceiving || r.arrPaxReceiving || '',
    arrUnloading: ldm.arrUnloading || (r as any).arrUnloading || '',
    arrVip: ldm.arrVip || (r as any).arrVip || r.vip || '',
    arrCip: ldm.arrCip || (r as any).arrCip || r.cip || '',
    arrMaas: ldm.arrMaas || (r as any).arrMaas || '',
    arrHandling: ldm.arrHandling || (r as any).arrHandling || '',
    arrRemarks: ldm.arrRemarks || (r as any).arrRemarks || '',

    // DEPARTURE INFO
    std: ldm.std || r.std || '',
    doorClosed: ldm.doorClosed || r.doorClosed || '',
    chocksOff: ldm.chocksOff || r.chocksOff || '',
    airborne: ldm.airborne || r.airborne || '',
    departureStatus: ldm.departureStatus || r.departureStatus || 'ON TIME',
    fuelUplift: ldm.fuelUplift || r.fuelUplift || '',
    paxMale: ldm.paxMale || r.paxMale || '',
    paxFemale: ldm.paxFemale || r.paxFemale || '',
    paxChild: ldm.paxChild || r.paxChild || '',
    paxInfant: ldm.paxInfant || r.paxInfant || '',
    paxTotal: ldm.paxTotal || r.paxTotal || '',
    baggageWeight: ldm.baggageWeight || r.baggageWeight || '',
    baggagePcs: ldm.baggagePcs || r.baggagePcs || '',
    baggageComNo: ldm.baggageComNo || '',
    cargoWeight: ldm.cargoWeight || r.cargoWeight || '',
    cargoPcs: ldm.cargoPcs || r.cargoPcs || '',
    cargoComNo: ldm.cargoComNo || '',
    crewBagWeight: ldm.crewBagWeight || '',
    crewBagPcs: ldm.crewBagPcs || '',
    crewBagComNo: ldm.crewBagComNo || '',
    totalWeight: ldm.totalWeight || (r as any).totalWeight || '',
    distB1: ldm.distB1 || raw.dist?.b1 || '',
    distB2: ldm.distB2 || raw.dist?.b2 || '',
    distB3: ldm.distB3 || raw.dist?.b3 || '',
    distB4: ldm.distB4 || raw.dist?.b4 || '',
    distA1: ldm.distA1 || raw.dist?.a1 || '',
    distA2: ldm.distA2 || raw.dist?.a2 || '',
    distA3: ldm.distA3 || raw.dist?.a3 || '',
    distA4: ldm.distA4 || raw.dist?.a4 || '',
    distA5: ldm.distA5 || raw.dist?.a5 || '',
    distAtrFwr: ldm.distAtrFwr || raw.dist?.atrFwr || '',
    distAtrFwl: ldm.distAtrFwl || raw.dist?.atrFwl || '',
    distAtrAft: ldm.distAtrAft || raw.dist?.atrAft || '',
    status: ldm.status || (r as any).status || '',
    mail: ldm.mail || r.mail || '',
    counterNoshow: ldm.counterNoshow || r.counterNoshow || '',
    gateNoShow: ldm.gateNoShow || r.gateNoShow || '',
    selfOffload: ldm.selfOffload || r.selfOffload || '',
    refused: ldm.refused || (r as any).refused || '',
    immigrationOff: ldm.immigrationOff || (r as any).immigrationOff || '',
    immigrationNotFace: ldm.immigrationNotFace || (r as any).immigrationNotFace || '',
    customOff: ldm.customOff || (r as any).customOff || '',
    maas: ldm.maas || r.maas || '',
    umPax: ldm.umPax || r.umPax || '',
    umPaxSeat: ldm.umPaxSeat || r.umPaxSeat || '',
    wchrFig: ldm.wchrFig || r.wchrFig || '',
    wchrSeat: ldm.wchrSeat || r.wchrSeat || '',
    wchcFig: ldm.wchcFig || r.wchcFig || '',
    wchcSeat: ldm.wchcSeat || r.wchcSeat || '',
    loadingStuff: ldm.loadingStuff || r.rampOfficer || '',
    loadController: ldm.loadController || r.loadController || '',
    paxHandling: ldm.paxHandling || r.paxHandling || '',
    tripTime: ldm.tripTime || '',
    underLoad: ldm.underLoad || '',
    remarks: ldm.remarks || r.remarks || '',
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
UNDER LOAD: ${d.underLoad || d.paxHandling || 'N/A'}

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
  const [activeReportTab, setActiveReportTab] = useState<number>(0);
  const [departureMessageHtml, setDepartureMessageHtml] = useState<string>('');
  const [ldmReportText, setLdmReportText] = useState<string>('');
  const [mvtMessageText, setMvtMessageText] = useState<string>('');
  const [editingReportInfo, setEditingReportInfo] = useState<{
    id: string;
    createdAt: string;
  } | null>(null);

  const activeStation = extractStationCode(userInfo.stationName);
  const isOutstation = activeStation !== 'DAC';

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
        const mvt = buildMvtMessage(loadedLdm, reportUser);
        setDepartureMessageHtml(depMsg);
        setLdmReportText(ldm);
        setMvtMessageText(mvt);
        setViewMode('dual-report');
        showToast(`FLIGHT ${editReport.flightNo || 'FINAL REPORT'} LOADED`);
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

  // Auto-sync departure route whenever user station or flightNoSuffix is loaded
  useEffect(() => {
    if (formData.flightNoSuffix) {
      const autoRoute = getRouteForFlightNo(formData.flightNoSuffix, activeStation);
      if (autoRoute && autoRoute !== formData.route) {
        setFormData((prev) => ({ ...prev, route: autoRoute }));
      }
    }
  }, [userInfo.stationName, formData.flightNoSuffix, activeStation]);

  // Typewriter text state
  const [typedTitle, setTypedTitle] = useState('');
  const fullTitle = 'INVENTED BY RADOAN RASEL';
  const typeIndexRef = useRef(0);

  useEffect(() => {
    typeIndexRef.current = 0;
    const interval = setInterval(() => {
      if (typeIndexRef.current < fullTitle.length) {
        setTypedTitle(fullTitle.slice(0, typeIndexRef.current + 1));
        typeIndexRef.current++;
      } else {
        clearInterval(interval);
      }
    }, 45);
    return () => clearInterval(interval);
  }, []);

  // Auto calculate Pax Total
  useEffect(() => {
    const m = parseInt(formData.paxMale, 10) || 0;
    const f = parseInt(formData.paxFemale, 10) || 0;
    const c = parseInt(formData.paxChild, 10) || 0;
    const tot = m + f + c;
    setFormData((prev) => ({
      ...prev,
      paxTotal: tot > 0 ? String(tot) : '',
    }));
  }, [formData.paxMale, formData.paxFemale, formData.paxChild]);

  // Auto calculate Total Weight and Hold Status
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

  // Auto calculate Arrival Status based on STA and Chocks On
  const updateArrivalStatus = (staVal: string, chocksOnVal: string) => {
    return calculateArrivalStatus(staVal, chocksOnVal);
  };

  // Handle Flight No change -> auto lookup Route
  const handleFlightNoChange = (val: string) => {
    const cleanNum = val.replace(/\D/g, '');
    const autoRoute = getRouteForFlightNo(cleanNum, activeStation);
    setFormData((prev) => ({
      ...prev,
      flightNoSuffix: cleanNum,
      route: autoRoute || (cleanNum.length >= 3 ? `${activeStation}-` : ''),
    }));
  };

  // Handle Arrival Flight No change -> auto calculate route options and default
  const handleArrFlightNoChange = (val: string) => {
    const cleanNum = val.replace(/\D/g, '');
    const options = getArrivalRouteOptions(cleanNum, activeStation);
    setFormData((prev) => {
      const defaultRoute =
        options.length > 0
          ? prev.arrRoute && options.includes(prev.arrRoute)
            ? prev.arrRoute
            : options[0]
          : prev.arrRoute;
      return {
        ...prev,
        arrFlightNo: cleanNum,
        arrRoute: defaultRoute,
      };
    });
  };

  // Generate arrival route options when user inputs arrival flight number
  const arrivalRouteOptions = getArrivalRouteOptions(formData.arrFlightNo, activeStation);

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

  // Handle Boarding Gate change -> allows any letter or number
  const handleBoardingGateChange = (gateVal: string) => {
    const upper = gateVal.trim().toUpperCase();
    if (isOutstation) {
      // For outstation: user can type any letter or number, DOC IN & DOC OUT always editable
      setFormData((prev) => ({
        ...prev,
        boardingGate: upper,
      }));
    } else {
      const allowed = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8'];
      const isAllowed = allowed.includes(upper);
      setFormData((prev) => ({
        ...prev,
        boardingGate: upper,
        docIn: isAllowed ? (prev.docIn === 'N/A' ? '' : prev.docIn) : 'N/A',
        docOut: isAllowed ? (prev.docOut === 'N/A' ? '' : prev.docOut) : 'N/A',
      }));
    }
  };

  // Time format helper (auto-injects colon)
  const handleTimeChange = (
    field: 'std' | 'doorClosed' | 'chocksOff' | 'airborne' | 'docIn' | 'docOut' | 'sta' | 'chocksOn' | 'doorOpen',
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
      if (field === 'sta' || field === 'chocksOn') {
        next.arrivalStatus = updateArrivalStatus(next.sta, next.chocksOn);
      }
      return next;
    });
  };

  // Generate Flight LDM Text according to destination rules
  const generateLdmForDestination = (d: LdmFormData, officerUser?: UserInfo): string => {
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

    const upperRoute = (d.route || '').toUpperCase();
    const cleanFlightNum = parseInt((d.flightNoSuffix || '').replace(/\D/g, ''), 10);

    // Extract destination station from route or flight number
    let dest = 'DAC';
    const segments = upperRoute.split(/[&\/,]/).map((s) => s.trim()).filter(Boolean);
    const lastSegment = segments[segments.length - 1] || upperRoute;
    const parts = lastSegment.split('-').map((s) => s.trim()).filter(Boolean);
    if (parts.length > 1) {
      dest = parts[parts.length - 1];
    } else if (parts.length === 1 && parts[0]) {
      dest = parts[0];
    }

    // Determine specific station profile
    let profile = dest;
    if (upperRoute.includes('DXB') || [341, 342, 343, 344].includes(cleanFlightNum)) {
      profile = 'DXB';
      if (dest === 'DAC' && upperRoute.includes('DXB') && !upperRoute.endsWith('DAC')) dest = 'DXB';
    } else if (upperRoute.includes('AUH') || [349, 350, 351, 352].includes(cleanFlightNum)) {
      profile = 'AUH';
      if (dest === 'DAC' && upperRoute.includes('AUH') && !upperRoute.endsWith('DAC')) dest = 'AUH';
    } else if (upperRoute.includes('SHJ') || [345, 346, 347, 348].includes(cleanFlightNum)) {
      profile = 'SHJ';
      if (dest === 'DAC' && upperRoute.includes('SHJ') && !upperRoute.endsWith('DAC')) dest = 'SHJ';
    } else if (upperRoute.includes('RUH') || [381, 382, 383, 384].includes(cleanFlightNum)) {
      profile = 'RUH';
      if (dest === 'DAC' && upperRoute.includes('RUH') && !upperRoute.endsWith('DAC')) dest = 'RUH';
    } else if (upperRoute.includes('JED') || [361, 362, 363, 364].includes(cleanFlightNum)) {
      profile = 'JED';
      if (dest === 'DAC' && upperRoute.includes('JED') && !upperRoute.endsWith('DAC')) dest = 'JED';
    } else if (upperRoute.includes('DOH') || [333, 334, 335, 336].includes(cleanFlightNum)) {
      profile = 'DOH';
      if (dest === 'DAC' && upperRoute.includes('DOH') && !upperRoute.endsWith('DAC')) dest = 'DOH';
    } else if (upperRoute.includes('MCT') || [321, 322, 323, 324].includes(cleanFlightNum)) {
      profile = 'MCT';
      if (dest === 'DAC' && upperRoute.includes('MCT') && !upperRoute.endsWith('DAC')) dest = 'MCT';
    }

    switch (profile) {
      // ATTACHMENT 1: DXB, AUH & SHJ (SAME FORMAT)
      case 'DXB':
      case 'AUH':
      case 'SHJ': {
        const targetStn = dest;

        const pad2 = (val: string | number) => {
          const n = parseInt(String(val || 0), 10);
          if (isNaN(n) || n === 0) return '00';
          return n < 10 ? String(n).padStart(2, '0') : String(n);
        };
        const mStr = d.paxMale || '00';
        const fStr = d.paxFemale || '00';
        const cStr = pad2(d.paxChild);
        const iStr = pad2(d.paxInfant);

        // Hold distribution with trailing dots: e.g. 1/0.2/2000.3/2200.4/0.
        const holdDists = isAirbus
          ? `1/${dist1}.2/${dist2Val}.3/${dist3}.4/${dist4}.5/${dist5}.`
          : `1/${dist1}.2/${dist2}.3/${dist3}.4/${dist4}.`;

        ldm =
          `LDM\n` +
          `BS${d.flightNoSuffix}/${formatDate(d.date, 'DDMON')}.${finalAcRegLdm}.${seatConfig}.${d.configure}\n` +
          `-${targetStn}.${mStr}/${fStr}/${cStr}/${iStr}.T.${totalLoad}.${holdDists}PAX/0/${d.paxTotal || '0'}.PAD/0/0\n\n`;

        // CPT Compartments block
        const bComs = (d.baggageComNo || '').split(/[\s,+/]+/).map((s) => s.trim().toUpperCase());
        const cComs = (d.cargoComNo || '').split(/[\s,+/]+/).map((s) => s.trim().toUpperCase());

        const getCptLine = (cptNum: number, weight?: string) => {
          const sNum = String(cptNum);
          const hasBag = bComs.includes(sNum) || bComs.includes(`C${sNum}`) || bComs.includes(`CPT${sNum}`);
          const hasCgo = cComs.includes(sNum) || cComs.includes(`C${sNum}`) || cComs.includes(`CPT${sNum}`);
          if (hasBag && hasCgo) return `CPT${cptNum}- BAG+CGO BY`;
          if (hasBag) return `CPT${cptNum}- BAG BY`;
          if (hasCgo) return `CPT${cptNum}- CGO BY`;

          const distVal = parseInt(weight || '0', 10);
          if (distVal > 0) {
            const hasAnyCgo = parseInt(d.cargoWeight || '0', 10) > 0;
            const hasAnyBag = parseInt(d.baggageWeight || '0', 10) > 0;
            if (hasAnyBag && hasAnyCgo) return `CPT${cptNum}- BAG+CGO BY`;
            if (hasAnyBag) return `CPT${cptNum}- BAG BY`;
            if (hasAnyCgo) return `CPT${cptNum}- CGO BY`;
          }

          return `CPT${cptNum}- NIL`;
        };

        const cptLines: string[] = [];
        if (isAirbus) {
          cptLines.push(getCptLine(1, dist1));
          cptLines.push(getCptLine(2, dist2));
          cptLines.push(getCptLine(3, dist3));
          cptLines.push(getCptLine(4, dist4));
          cptLines.push(getCptLine(5, dist5));
        } else {
          cptLines.push(getCptLine(1, dist1));
          cptLines.push(getCptLine(2, dist2));
          cptLines.push(getCptLine(3, dist3));
          cptLines.push(getCptLine(4, dist4));
        }
        ldm += `${cptLines.join('\n')}\n\n`;

        // Cargo & Baggage line: DXB C  210/  1200 M  0 B  180/  3000 O  0 T  0
        ldm += `${targetStn} C  ${d.cargoPcs || '0'}/  ${d.cargoWeight || '0'} M  0 B  ${d.baggagePcs || '0'}/  ${d.baggageWeight || '0'} O  0 T  0\n`;

        // SI Lines
        if (crewBagSiLine) ldm += `${crewBagSiLine}\n`;
        if (comailSiLine) ldm += `${comailSiLine}\n`;
        if (wcSiString) ldm += `${wcSiString}\n`;

        ldm += `\n\nEND\n\n\n${dynamicRegards}`;
        break;
      }

      // ATTACHMENT 2: RUH & JED
      case 'RUH':
      case 'JED': {
        const targetStn = dest;
        const dists = isAirbus
          ? `.1/${dist1}.2/${dist2Val}.3/${dist3}.4/${dist4}.5/${dist5}`
          : `.1/${dist1}.2/${dist2}.3/${dist3}.4/${dist4}`;

        ldm =
          `LDM\n` +
          `BS${d.flightNoSuffix}/${formatDate(d.date, 'DD')}.${finalAcRegLdm}.${seatConfig}.${d.configure}\n` +
          `-${targetStn}.${d.paxMale || '0'}/${d.paxFemale || '0'}/${d.paxChild || '0'}/${d.paxInfant || '0'}.T${totalLoad}${dists}.PAX/0/${d.paxTotal || '0'}.PAD/0/0\n`;

        // SI lines directly follow
        const wchrFigNum = parseInt(d.wchrFig || '0', 10);
        if (wchrFigNum > 0 && d.wchrSeat && d.wchrSeat !== 'N/A') {
          const formattedWchrSeat = d.wchrSeat.replace(/,\s*/g, '/');
          ldm += `SI O/B 0 WCHR: ${String(wchrFigNum).padStart(2, '0')} SN ${formattedWchrSeat}\n`;
        }
        const wchcFigNum = parseInt(d.wchcFig || '0', 10);
        if (wchcFigNum > 0 && d.wchcSeat && d.wchcSeat !== 'N/A') {
          const formattedWchcSeat = d.wchcSeat.replace(/,\s*/g, '/');
          ldm += `SI O/B 0 WCHC: ${String(wchcFigNum).padStart(2, '0')} SN ${formattedWchcSeat}\n`;
        }

        // SI Cargo & Baggage line: SI JED C  722/  9791 M  0 B  421/  8300 O  0 T  0
        ldm += `SI ${targetStn} C  ${d.cargoPcs || '0'}/  ${d.cargoWeight || '0'} M  0 B  ${d.baggagePcs || '0'}/  ${d.baggageWeight || '0'} O  0 T  0\n`;

        if (crewBagSiLine) ldm += `${crewBagSiLine}\n`;
        if (comailSiLine) ldm += `${comailSiLine}\n`;

        ldm += `\nEND\n\n\n${dynamicRegards}`;
        break;
      }

      case 'DOH': {
        const dists = isAirbus
          ? `.1/${dist1}.2/${dist2Val}.3/${dist3}.4/${dist4}.5/${dist5}`
          : `.1/${dist1}.2/${dist2}.3/${dist3}.4/${dist4}`;

        ldm =
          `LDM\nBS${d.flightNoSuffix}/${formatDate(d.date, 'DD')}.${finalAcRegLdm}.${seatConfig}.${d.configure}\n` +
          `-${dest}.${d.paxMale || '0'}/${d.paxFemale || '0'}/${d.paxChild || '0'}/${d.paxInfant || '0'}.T${totalLoad}${dists}.PAX/0/${d.paxTotal || '0'}.PAD/0/0\n`;
        ldm += `SI ${dest} C     ${d.cargoPcs || '0'}/     ${d.cargoWeight || '0'} M     0    B     ${d.baggagePcs || '0'}/     ${d.baggageWeight || '0'} O     0 T     0\n`;
        if (crewBagSiLine) ldm += `${crewBagSiLine}\n`;
        if (comailSiLine) ldm += `${comailSiLine}\n`;
        if (wcSiString) ldm += `${wcSiString}\n`;
        ldm += `\nEND\n\n\n${dynamicRegards}`;
        break;
      }

      case 'MCT': {
        const distsMct = isAirbus
          ? `.1/${dist1}.2/${dist2Val}.3/${dist3}.4/${dist4}.5/${dist5}`
          : `.1/${dist1}.2/${dist2}.3/${dist3}.4/${dist4}`;

        ldm =
          `LDM\nBS${d.flightNoSuffix}/${formatDate(d.date, 'DDMON')}.${finalAcRegLdm}.${seatConfig}.${d.configure}\n` +
          `-${dest}.${d.paxMale || '00'}/${d.paxFemale || '00'}/${d.paxChild || '00'}/${d.paxInfant || '00'}.T.${totalLoad}${distsMct}.PAX.00/${d.paxTotal || '000'}.PAD/0/0\n\n` +
          `${dest} FRE 0 POS 0 BAG ${d.baggagePcs || '0'} PCS/${d.baggageWeight || '0'} KGS EQP 0 TRA 0\n` +
          `${dest} FRE 0 POS 0 CGO ${d.cargoPcs || '0'} PCS/${d.cargoWeight || '0'} KGS  EQP 0 TRA 0\n\n`;

        if (parseInt(d.maas, 10) > 0) siLines.push(`SI: MAAS ${String(d.maas).padStart(2, '0')}`);
        if (wcSiString) siLines.push(wcSiString);
        if (crewBagSiLine) siLines.push(crewBagSiLine);
        if (comailSiLine) siLines.push(comailSiLine);
        if (siLines.length > 0) ldm += `${siLines.join('\n')}\n`;
        ldm += `\n\nEND\n\n\n${dynamicRegards}`;
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
    const mvtText = buildMvtMessage(formData, userInfo);

    setDepartureMessageHtml(departureMsg);
    setLdmReportText(ldmText);
    setMvtMessageText(mvtText);
    setViewMode('dual-report');
    setActiveReportTab(0);

    // Build standard FlightFormData to save report to Cloud Firestore (preserved 30+ days)
    const flightPayload: FlightFormData = {
      date: formData.date,
      flightNoSuffix: formData.flightNoSuffix,
      route: formData.route,
      acRegSuffix: cleanRawReg,
      acType: formData.acType,
      captain: formData.captain,
      configure: formData.configure,
      boardingGate: formData.boardingGate,
      docIn: formData.docIn,
      docOut: formData.docOut,

      // ARRIVAL (ALL FIELDS TRANSFER TO FINAL REPORT)
      sta: formData.sta,
      chocksOn: formData.chocksOn,
      doorOpen: formData.doorOpen,
      arrivalStatus: formData.arrivalStatus,
      arrFlightNo: formData.arrFlightNo ? `BS-${formData.arrFlightNo.replace(/^BS-/i, '')}` : '',
      arrRoute: formData.arrRoute,
      arrTotalPax: formData.arrTotalPax,
      arrPaxAdult: formData.arrTotalPax,
      arrBagWeight: formData.arrBagWeight,
      arrBagPcs: formData.arrBagPcs,
      arrBaggageWeight: formData.arrBagWeight,
      arrBaggagePcs: formData.arrBagPcs,
      arrCargoWeight: formData.arrCargoWeight,
      arrCargoPcs: formData.arrCargoPcs,
      arrMailPcs: formData.arrMailPcs,
      arrMail: formData.arrMailPcs,
      arrPaxReceiving: formData.arrPaxReceiving,
      arrUnloading: formData.arrUnloading,
      arrVip: formData.arrVip,
      arrCip: formData.arrCip,
      arrMaas: formData.arrMaas,
      arrHandling: formData.arrHandling,
      arrRemarks: formData.arrRemarks,

      // DEPARTURE
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
      crewBagWeight: formData.crewBagWeight,
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
      vip: formData.arrVip || '0',
      cip: formData.arrCip || '0',
      maas: formData.maas,
      umPax: formData.umPax,
      umPaxSeat: formData.umPaxSeat,
      fireArms: 'NIL',
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
          : isOutstation
          ? '05 FINAL REPORTS GENERATED & SAVED IN CLOUD DATA STORE!'
          : 'LOAD CONTROL REPORT & LDM GENERATED & SAVED IN CLOUD DATA STORE!'
      );
      setEditingReportInfo(null);
      onClearEditReport?.();
    } catch (err) {
      console.warn('Error saving load control report:', err);
      showToast('REPORTS GENERATED!');
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
    showToast('NEW FORM READY');
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`${label.toUpperCase()} COPIED TO CLIPBOARD!`);
    } catch (err) {
      showToast('FAILED TO COPY TEXT');
    }
  };

  // Convert current LDM form data to FlightFormData for official report tables
  const flightFormDataForOfficialTables: FlightFormData = {
    date: formData.date,
    flightNoSuffix: formData.flightNoSuffix,
    route: formData.route,
    acRegSuffix: formData.acRegSuffix,
    acType: formData.acType,
    captain: formData.captain,
    configure: formData.configure,
    boardingGate: formData.boardingGate,
    docIn: formData.docIn,
    docOut: formData.docOut,

    // ARRIVAL INFO (ALL FIELDS TRANSFER TO OFFICIAL FLIGHT ARRIVAL REPORT)
    sta: formData.sta,
    chocksOn: formData.chocksOn,
    doorOpen: formData.doorOpen,
    arrivalStatus: formData.arrivalStatus,
    arrFlightNo: formData.arrFlightNo ? `BS-${formData.arrFlightNo.replace(/^BS-/i, '')}` : (formData.flightNoSuffix ? `BS-${formData.flightNoSuffix}` : ''),
    arrRoute: formData.arrRoute,
    arrTotalPax: formData.arrTotalPax,
    arrPaxAdult: formData.arrTotalPax,
    arrBagWeight: formData.arrBagWeight,
    arrBagPcs: formData.arrBagPcs,
    arrBaggageWeight: formData.arrBagWeight,
    arrBaggagePcs: formData.arrBagPcs,
    arrCargoWeight: formData.arrCargoWeight,
    arrCargoPcs: formData.arrCargoPcs,
    arrMailPcs: formData.arrMailPcs,
    arrMail: formData.arrMailPcs,
    arrPaxReceiving: formData.arrPaxReceiving,
    arrUnloading: formData.arrUnloading,
    arrVip: formData.arrVip,
    arrCip: formData.arrCip,
    arrMaas: formData.arrMaas,
    arrHandling: formData.arrHandling,
    arrRemarks: formData.arrRemarks,

    std: formData.std,
    doorClosed: formData.doorClosed,
    chocksOff: formData.chocksOff,
    airborne: formData.airborne,
    departureStatus: formData.departureStatus,
    flightLoad: formData.paxTotal || '0',
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
    crewBagWeight: formData.crewBagWeight,
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
    vip: formData.arrVip || '0',
    cip: formData.arrCip || '0',
    maas: formData.maas,
    umPax: formData.umPax,
    umPaxSeat: formData.umPaxSeat,
    fireArms: 'NIL',
    wchrFig: formData.wchrFig,
    wchrSeat: formData.wchrSeat,
    wchcFig: formData.wchcFig,
    wchcSeat: formData.wchcSeat,
    loadingStuff: formData.loadingStuff,
    rampOfficer: formData.loadingStuff,
    loadController: formData.loadController,
    paxHandling: formData.paxHandling,
    remarks: formData.remarks,
    status: formData.status,
    totalWeight: formData.totalWeight,
  };

  const isSpecialReg = ['PKBBG', 'BBG', 'PKBBH', 'BBH', '9HSAU', 'SAU', 'HSSXA', 'SXA'].includes(
    formData.acRegSuffix.toUpperCase().replace(/^(S2-|HS-|PK-)/, '')
  );

  return (
    <div className="min-h-screen bg-[#030712] text-[#e0e6ed] font-mono flex flex-col relative select-text">
      {/* Background HUD Grid Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-[#030712]/90 to-[#030712] pointer-events-none" />

      {/* VIEW MODE: FINAL REPORT / MULTI-REPORT */}
      {viewMode === 'dual-report' ? (
        <div className="relative z-10 flex-1 flex flex-col p-3 md:p-6 w-full max-w-7xl mx-auto">
          {/* Header Bar */}
          <div className="no-print w-full flex flex-col md:flex-row justify-between items-start md:items-center pb-4 mb-4 border-b border-cyan-500/40 gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-black tracking-wider text-white uppercase flex items-center gap-2">
                  <Plane className="w-5 h-5 text-amber-400" />
                  <span>FOR LOAD CONTROLLER &mdash; FINAL REPORTS</span>
                </h1>
                {isOutstation && (
                  <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-400 text-cyan-300 text-xs font-bold uppercase">
                    05 REPORTS GENERATED
                  </span>
                )}
              </div>
              <p className="text-[11px] font-mono text-[#ffaa00] font-black uppercase tracking-widest mt-0.5">
                INVENTED BY RADOAN RASEL
              </p>
              <p className="text-xs text-cyan-300/80 font-mono mt-0.5 uppercase tracking-wide">
                FLIGHT: <strong className="text-amber-300">BS-{formData.flightNoSuffix}</strong> ({formData.route}) &bull; DATE: {formData.date} &bull; OFFICER:{' '}
                {userInfo.userName} &bull; STATION: {userInfo.stationName}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setViewMode('input')}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs flex items-center gap-1.5 cursor-pointer transition-all shadow uppercase"
              >
                <Edit3 className="w-4 h-4 text-slate-950" />
                <span>EDIT FLIGHT DATA</span>
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

          {/* Outstation 5-Report Tabs or Standard Dual Column */}
          {isOutstation ? (
            <div className="flex flex-col flex-1">
              {/* Report Tab Selector */}
              <div className="no-print flex flex-wrap items-center gap-2 mb-4 p-1.5 rounded-xl bg-slate-900/90 border border-cyan-500/30">
                {[
                  { id: 0, label: '1. FLIGHT DEPARTURE MESSAGE' },
                  { id: 1, label: '2. FLIGHT LDM' },
                  { id: 2, label: '3. OFFICIAL DEPARTURE REPORT' },
                  { id: 3, label: '4. OFFICIAL ARRIVAL REPORT' },
                  { id: 4, label: '5. MVT MESSAGE' },
                  { id: 5, label: 'ALL 5 REPORTS (FULL VIEW)' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveReportTab(tab.id)}
                    className={`px-3.5 py-2 rounded-lg text-xs font-bold uppercase transition-all cursor-pointer flex items-center gap-1.5 ${
                      activeReportTab === tab.id
                        ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-[0_0_12px_rgba(0,240,255,0.4)]'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>

              {/* TAB 0: 1. FLIGHT DEPARTURE MESSAGE */}
              {(activeReportTab === 0 || activeReportTab === 5) && (
                <div className="mb-6 bg-slate-900/95 border-2 border-cyan-500/60 rounded-xl p-5 shadow-2xl text-slate-100">
                  <div className="flex justify-between items-center pb-2.5 mb-3 border-b border-cyan-500/40">
                    <h2 className="text-base font-black tracking-widest text-[#00f0ff] uppercase flex items-center gap-2">
                      <FileText className="w-4 h-4 text-cyan-400" />
                      <span>1. FLIGHT DEPARTURE MESSAGE</span>
                    </h2>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(departureMessageHtml, 'Departure Message')}
                      className="no-print px-3 py-1 rounded bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 hover:text-white border border-cyan-500/50 text-xs font-bold uppercase flex items-center gap-1 cursor-pointer transition-all"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>COPY MESSAGE</span>
                    </button>
                  </div>
                  <pre className="overflow-x-auto text-xs md:text-sm font-mono whitespace-pre-wrap leading-relaxed text-slate-200 bg-slate-950/70 p-4 rounded-lg border border-slate-800">
                    {departureMessageHtml}
                  </pre>
                </div>
              )}

              {/* TAB 1: 2. FLIGHT LDM */}
              {(activeReportTab === 1 || activeReportTab === 5) && (
                <div className="mb-6 bg-slate-900/95 border-2 border-cyan-500/60 rounded-xl p-5 shadow-2xl text-slate-100">
                  <div className="flex justify-between items-center pb-2.5 mb-3 border-b border-cyan-500/40">
                    <h2 className="text-base font-black tracking-widest text-[#00f0ff] uppercase flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-emerald-400" />
                      <span>2. FLIGHT LDM</span>
                    </h2>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(ldmReportText, 'Flight LDM')}
                      className="no-print px-3 py-1 rounded bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 hover:text-white border border-emerald-500/50 text-xs font-bold uppercase flex items-center gap-1 cursor-pointer transition-all"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>COPY LDM</span>
                    </button>
                  </div>
                  <pre className="overflow-x-auto text-xs md:text-sm font-mono whitespace-pre-wrap leading-relaxed text-emerald-300 bg-slate-950/70 p-4 rounded-lg border border-slate-800">
                    {ldmReportText}
                  </pre>
                </div>
              )}

              {/* TAB 2: 3. OFFICIAL FLIGHT DEPARTURE REPORT */}
              {(activeReportTab === 2 || activeReportTab === 5) && (
                <div className="mb-6 bg-slate-900/95 border-2 border-indigo-500/60 rounded-xl p-5 shadow-2xl text-slate-100">
                  <div className="flex justify-between items-center pb-2.5 mb-3 border-b border-indigo-500/40">
                    <h2 className="text-base font-black tracking-widest text-indigo-300 uppercase flex items-center gap-2">
                      <Plane className="w-4 h-4 text-indigo-400" />
                      <span>3. OFFICIAL FLIGHT DEPARTURE REPORT</span>
                    </h2>
                    <div className="no-print flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="px-3 py-1 rounded bg-indigo-950/80 hover:bg-indigo-900 text-indigo-200 hover:text-white border border-indigo-500/50 text-xs font-bold uppercase flex items-center gap-1 cursor-pointer transition-all"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>PRINT</span>
                      </button>
                    </div>
                  </div>
                  <div className="overflow-x-auto bg-slate-950/60 p-2 rounded-xl">
                    <DepartureReportTable
                      data={flightFormDataForOfficialTables}
                      user={userInfo}
                      mode="dom"
                    />
                  </div>
                </div>
              )}

              {/* TAB 3: 4. OFFICIAL FLIGHT ARRIVAL REPORT */}
              {(activeReportTab === 3 || activeReportTab === 5) && (
                <div className="mb-6 bg-slate-900/95 border-2 border-teal-500/60 rounded-xl p-5 shadow-2xl text-slate-100">
                  <div className="flex justify-between items-center pb-2.5 mb-3 border-b border-teal-500/40">
                    <h2 className="text-base font-black tracking-widest text-teal-300 uppercase flex items-center gap-2">
                      <Plane className="w-4 h-4 text-teal-400 rotate-90" />
                      <span>4. OFFICIAL FLIGHT ARRIVAL REPORT</span>
                    </h2>
                    <div className="no-print flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="px-3 py-1 rounded bg-teal-950/80 hover:bg-teal-900 text-teal-200 hover:text-white border border-teal-500/50 text-xs font-bold uppercase flex items-center gap-1 cursor-pointer transition-all"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>PRINT</span>
                      </button>
                    </div>
                  </div>
                  <div className="overflow-x-auto bg-slate-950/60 p-2 rounded-xl">
                    <ArrivalReportTable
                      data={flightFormDataForOfficialTables}
                      user={userInfo}
                      mode="dom"
                    />
                  </div>
                </div>
              )}

              {/* TAB 4: 5. MVT MESSAGE */}
              {(activeReportTab === 4 || activeReportTab === 5) && (
                <div className="mb-6 bg-slate-900/95 border-2 border-amber-500/60 rounded-xl p-5 shadow-2xl text-slate-100">
                  <div className="flex justify-between items-center pb-2.5 mb-3 border-b border-amber-500/40">
                    <h2 className="text-base font-black tracking-widest text-amber-300 uppercase flex items-center gap-2">
                      <Send className="w-4 h-4 text-amber-400" />
                      <span>5. MVT MESSAGE</span>
                    </h2>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(mvtMessageText, 'MVT Message')}
                      className="no-print px-3 py-1 rounded bg-amber-950/80 hover:bg-amber-900 text-amber-300 hover:text-white border border-amber-500/50 text-xs font-bold uppercase flex items-center gap-1 cursor-pointer transition-all"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>COPY MVT</span>
                    </button>
                  </div>
                  <pre className="overflow-x-auto text-xs md:text-sm font-mono whitespace-pre-wrap leading-relaxed text-amber-200 bg-slate-950/70 p-4 rounded-lg border border-slate-800">
                    {mvtMessageText}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            /* DAC STANDARD DUAL REPORT (DEPARTURE MESSAGE & LDM) */
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
                    className="no-print text-xs font-mono text-cyan-300 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>COPY</span>
                  </button>
                </div>
                <pre className="flex-1 overflow-x-auto text-xs md:text-sm font-mono whitespace-pre-wrap leading-relaxed text-slate-200 bg-slate-950/70 p-4 rounded-lg border border-slate-800">
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
                    className="no-print text-xs font-mono text-cyan-300 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>COPY</span>
                  </button>
                </div>
                <pre className="flex-1 overflow-x-auto text-xs md:text-sm font-mono whitespace-pre-wrap leading-relaxed text-emerald-300 bg-slate-950/70 p-4 rounded-lg border border-slate-800">
                  {ldmReportText}
                </pre>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ================= INPUT FORM (FOR LOAD CONTROLLER) ================= */
        <div className="relative z-10 flex-1 flex flex-col items-center p-3 md:p-6 w-full max-w-6xl mx-auto">
          {/* Top Navigation & Status Bar */}
          <div className="w-full flex flex-col sm:flex-row justify-between items-start sm:items-center pb-3 mb-4 border-b border-cyan-500/30 gap-3">
            <div className="flex items-center gap-2">
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
            <div className="mb-4 p-4 rounded-xl bg-gradient-to-r from-amber-500/20 via-amber-600/10 to-slate-900 border border-amber-400/60 shadow-[0_0_20px_rgba(245,158,11,0.2)] flex flex-wrap items-center justify-between gap-3 text-xs w-full">
              <div className="flex items-center gap-2.5 text-amber-300 font-bold uppercase tracking-wider">
                <Edit3 className="w-4 h-4 text-amber-400 animate-pulse" />
                <span>
                  EDITING SAVED FLIGHT BS-{formData.flightNoSuffix || 'DATA'} &bull; EDIT ANY FIELDS &amp; CLICK &ldquo;UPDATE &amp; GENERATE FINAL REPORT&rdquo;
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
            className="w-full space-y-6"
          >
            {/* ================= PART 1: GENERAL SECTION ================= */}
            <div className="bg-[#0a1526]/90 border-2 border-cyan-500/50 shadow-[0_0_25px_rgba(0,240,255,0.15)] rounded-2xl p-5 md:p-6 backdrop-blur-md">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-cyan-500/40">
                <div className="flex items-center gap-2 text-[#00f0ff] font-black text-sm md:text-base tracking-wider uppercase">
                  <Sliders className="w-4 h-4 text-cyan-400" />
                  <span>GENERAL INFORMATION</span>
                </div>
                <span className="text-[11px] font-mono text-cyan-300/80 bg-cyan-950/60 border border-cyan-500/40 px-2.5 py-0.5 rounded-full">
                  PART 1 &bull; GENERAL
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* DATE */}
                <div className="flex flex-col">
                  <label className="text-xs font-bold text-sky-400 mb-1 tracking-wider uppercase">
                    DATE
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] font-mono text-sm focus:outline-none focus:border-cyan-400 shadow-[inset_0_0_8px_rgba(0,240,255,0.1)]"
                  />
                </div>

                {/* A/C REG */}
                <div className="flex flex-col">
                  <label className="text-xs font-bold text-sky-400 mb-1 tracking-wider uppercase">
                    A/C REG
                  </label>
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
                      className={`w-full p-2 bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] font-bold text-sm focus:outline-none focus:border-cyan-400 uppercase ${
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
                  <label className="text-xs font-bold text-sky-400 mb-1 tracking-wider uppercase">
                    A/C TYPE
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={formData.acType}
                    placeholder="AUTO DETECT"
                    className="p-2 rounded bg-[#0a1526]/60 border border-[#111e2f] text-sky-300 font-bold text-sm cursor-not-allowed uppercase"
                  />
                </div>

                {/* CAPTAIN */}
                <div className="flex flex-col">
                  <label className="text-xs font-bold text-sky-400 mb-1 tracking-wider uppercase">
                    CAPTAIN
                  </label>
                  <input
                    type="text"
                    placeholder="ENTER CAPTAIN"
                    value={formData.captain}
                    onChange={(e) =>
                      setFormData({ ...formData, captain: e.target.value.toUpperCase() })
                    }
                    className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] font-bold text-sm focus:outline-none focus:border-cyan-400 uppercase"
                  />
                </div>

                {/* CONFIGURE */}
                <div className="flex flex-col">
                  <label className="text-xs font-bold text-sky-400 mb-1 tracking-wider uppercase">
                    CONFIGURE
                  </label>
                  <input
                    type="text"
                    placeholder="2/5"
                    value={formData.configure}
                    onChange={(e) =>
                      setFormData({ ...formData, configure: e.target.value.toUpperCase() })
                    }
                    className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] font-bold text-sm focus:outline-none focus:border-cyan-400 uppercase"
                  />
                </div>

                {/* BOARDING GATE (user can type any number or letter) */}
                <div className="flex flex-col">
                  <label className="text-xs font-bold text-sky-400 mb-1 tracking-wider uppercase flex items-center justify-between">
                    <span>BOARDING GATE</span>
                    <span className="text-[10px] text-amber-300 font-normal">ANY NO/LETTER</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 01, G1, A2"
                    value={formData.boardingGate}
                    onChange={(e) => handleBoardingGateChange(e.target.value)}
                    className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] font-bold text-sm focus:outline-none focus:border-cyan-400 uppercase font-mono"
                  />
                </div>

                {/* DOC IN (UTC) - editable always */}
                <div className="flex flex-col">
                  <label className="text-xs font-bold text-sky-400 mb-1 tracking-wider uppercase flex items-center justify-between">
                    <span>DOC IN (UTC)</span>
                    <span className="text-[10px] text-emerald-400 font-normal">EDITABLE</span>
                  </label>
                  <input
                    type="text"
                    placeholder="HH:MM"
                    value={formData.docIn}
                    onChange={(e) => handleTimeChange('docIn', e.target.value)}
                    className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] font-mono text-sm focus:outline-none focus:border-cyan-400 shadow-[inset_0_0_8px_rgba(0,240,255,0.1)]"
                  />
                </div>

                {/* DOC OUT (UTC) - editable always */}
                <div className="flex flex-col">
                  <label className="text-xs font-bold text-sky-400 mb-1 tracking-wider uppercase flex items-center justify-between">
                    <span>DOC OUT (UTC)</span>
                    <span className="text-[10px] text-emerald-400 font-normal">EDITABLE</span>
                  </label>
                  <input
                    type="text"
                    placeholder="HH:MM"
                    value={formData.docOut}
                    onChange={(e) => handleTimeChange('docOut', e.target.value)}
                    className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] font-mono text-sm focus:outline-none focus:border-cyan-400 shadow-[inset_0_0_8px_rgba(0,240,255,0.1)]"
                  />
                </div>
              </div>
            </div>

            {/* ================= PART 2: ARRIVAL INFO (OUTSTATION ONLY) ================= */}
            {isOutstation && (
              <div className="bg-[#061e24]/90 border-2 border-teal-500/50 shadow-[0_0_25px_rgba(20,184,166,0.15)] rounded-2xl p-5 md:p-6 backdrop-blur-md">
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-teal-500/40">
                  <div className="flex items-center gap-2 text-teal-300 font-black text-sm md:text-base tracking-wider uppercase">
                    <Plane className="w-4 h-4 text-teal-400 rotate-90" />
                    <span>ARRIVAL INFORMATION</span>
                  </div>
                  <span className="text-[11px] font-mono text-teal-200/80 bg-teal-950/60 border border-teal-500/40 px-2.5 py-0.5 rounded-full">
                    PART 2 &bull; ARRIVAL INFO
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* FLIGHT NO (ARRIVAL) */}
                  <div className="flex flex-col">
                    <label className="text-xs font-bold text-teal-300 mb-1 tracking-wider uppercase">
                      FLIGHT NO
                    </label>
                    <div className="flex items-center">
                      <span className="px-3 py-2 bg-[#0c2e36] border border-r-0 border-teal-800 rounded-l text-teal-300 font-bold text-sm">
                        BS-
                      </span>
                      <input
                        type="text"
                        placeholder="321"
                        value={formData.arrFlightNo}
                        onChange={(e) => handleArrFlightNoChange(e.target.value)}
                        className="w-full p-2 rounded-r bg-[#04161a] border border-teal-800 text-teal-200 font-bold text-sm focus:outline-none focus:border-teal-400 font-mono"
                      />
                    </div>
                  </div>

                  {/* ROUTE (DROPDOWN 2 OPTIONS E.G. DAC-SPD & SPD-DXB OR DXB-SPD & SPD-DAC) */}
                  <div className="flex flex-col">
                    <label className="text-xs font-bold text-teal-300 mb-1 tracking-wider uppercase flex items-center justify-between">
                      <span>ROUTE</span>
                      <span className="text-[10px] text-teal-400 font-mono font-normal">2 OPTIONS</span>
                    </label>
                    <div className="flex flex-col gap-1.5">
                      <select
                        value={formData.arrRoute}
                        onChange={(e) => setFormData({ ...formData, arrRoute: e.target.value })}
                        className="w-full p-2 rounded bg-[#04161a] border border-teal-800 text-teal-200 font-bold text-sm focus:outline-none focus:border-teal-400 font-mono cursor-pointer"
                      >
                        <option value="">SELECT ROUTE</option>
                        {arrivalRouteOptions.map((opt, idx) => (
                          <option key={opt} value={opt} className="bg-slate-900 text-white font-bold">
                            {idx + 1}. {opt}
                          </option>
                        ))}
                        {formData.arrRoute && !arrivalRouteOptions.includes(formData.arrRoute) && (
                          <option value={formData.arrRoute} className="bg-slate-900 text-white font-bold">
                            {formData.arrRoute}
                          </option>
                        )}
                      </select>

                      {arrivalRouteOptions.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {arrivalRouteOptions.map((opt, idx) => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => setFormData((prev) => ({ ...prev, arrRoute: opt }))}
                              className={`px-2.5 py-0.5 rounded text-[11px] font-mono font-bold cursor-pointer transition-all border ${
                                formData.arrRoute === opt
                                  ? 'bg-teal-500 text-slate-950 border-teal-300 shadow-[0_0_10px_rgba(20,184,166,0.6)]'
                                  : 'bg-teal-950/80 text-teal-300 border-teal-700/70 hover:bg-teal-900 hover:text-white'
                              }`}
                            >
                              {idx + 1}. {opt}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* STA (UTC) */}
                  <div className="flex flex-col">
                    <label className="text-xs font-bold text-teal-300 mb-1 tracking-wider uppercase">
                      STA (UTC)
                    </label>
                    <input
                      type="text"
                      placeholder="HH:MM"
                      value={formData.sta}
                      onChange={(e) => handleTimeChange('sta', e.target.value)}
                      className="p-2 rounded bg-[#04161a] border border-teal-800 text-teal-200 font-mono text-sm focus:outline-none focus:border-teal-400"
                    />
                  </div>

                  {/* CHOCKS ON (UTC) */}
                  <div className="flex flex-col">
                    <label className="text-xs font-bold text-teal-300 mb-1 tracking-wider uppercase">
                      CHOCKS ON (UTC)
                    </label>
                    <input
                      type="text"
                      placeholder="HH:MM"
                      value={formData.chocksOn}
                      onChange={(e) => handleTimeChange('chocksOn', e.target.value)}
                      className="p-2 rounded bg-[#04161a] border border-teal-800 text-teal-200 font-mono text-sm focus:outline-none focus:border-teal-400"
                    />
                  </div>

                  {/* DOOR OPEN (UTC) */}
                  <div className="flex flex-col">
                    <label className="text-xs font-bold text-teal-300 mb-1 tracking-wider uppercase">
                      DOOR OPEN (UTC)
                    </label>
                    <input
                      type="text"
                      placeholder="HH:MM"
                      value={formData.doorOpen}
                      onChange={(e) => handleTimeChange('doorOpen', e.target.value)}
                      className="p-2 rounded bg-[#04161a] border border-teal-800 text-teal-200 font-mono text-sm focus:outline-none focus:border-teal-400"
                    />
                  </div>

                  {/* ARRIVAL STATUS (COUNTED FROM STA TO CHOCKS ON) */}
                  <div className="flex flex-col">
                    <label className="text-xs font-bold text-teal-300 mb-1 tracking-wider uppercase flex items-center justify-between">
                      <span>ARRIVAL STATUS</span>
                      <span className="text-[10px] text-amber-300 font-mono">AUTO COUNT</span>
                    </label>
                    <input
                      type="text"
                      value={formData.arrivalStatus}
                      onChange={(e) =>
                        setFormData({ ...formData, arrivalStatus: e.target.value.toUpperCase() })
                      }
                      className="p-2 rounded bg-[#04161a] border border-teal-800 text-amber-300 font-black text-xs md:text-sm focus:outline-none focus:border-teal-400 uppercase"
                    />
                  </div>

                  {/* TOTAL PAX (LIKE 149+02) */}
                  <div className="flex flex-col">
                    <label className="text-xs font-bold text-teal-300 mb-1 tracking-wider uppercase flex items-center justify-between">
                      <span>TOTAL PAX</span>
                      <span className="text-[10px] text-teal-400 font-mono font-normal">E.G. 149+02</span>
                    </label>
                    <input
                      type="text"
                      placeholder="149+02"
                      value={formData.arrTotalPax}
                      onChange={(e) => setFormData({ ...formData, arrTotalPax: e.target.value })}
                      className="p-2 rounded bg-[#04161a] border border-teal-800 text-teal-200 font-bold text-sm focus:outline-none focus:border-teal-400 font-mono"
                    />
                  </div>

                  {/* TOTAL BAG (WEIGHT AND PCS) */}
                  <div className="flex flex-col">
                    <label className="text-xs font-bold text-teal-300 mb-1 tracking-wider uppercase flex items-center justify-between">
                      <span>TOTAL BAG</span>
                      <span className="text-[10px] text-teal-400 font-mono font-normal">WT &amp; PCS</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        placeholder="KG"
                        value={formData.arrBagWeight}
                        onChange={(e) => setFormData({ ...formData, arrBagWeight: e.target.value })}
                        className="p-2 rounded bg-[#04161a] border border-teal-800 text-teal-200 text-sm focus:outline-none focus:border-teal-400 font-mono"
                      />
                      <input
                        type="number"
                        placeholder="PCS"
                        value={formData.arrBagPcs}
                        onChange={(e) => setFormData({ ...formData, arrBagPcs: e.target.value })}
                        className="p-2 rounded bg-[#04161a] border border-teal-800 text-teal-200 text-sm focus:outline-none focus:border-teal-400 font-mono"
                      />
                    </div>
                  </div>

                  {/* TOTAL CGO (WEIGHT AND PCS) */}
                  <div className="flex flex-col">
                    <label className="text-xs font-bold text-teal-300 mb-1 tracking-wider uppercase flex items-center justify-between">
                      <span>TOTAL CGO</span>
                      <span className="text-[10px] text-teal-400 font-mono font-normal">WT &amp; PCS</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        placeholder="KG"
                        value={formData.arrCargoWeight}
                        onChange={(e) => setFormData({ ...formData, arrCargoWeight: e.target.value })}
                        className="p-2 rounded bg-[#04161a] border border-teal-800 text-teal-200 text-sm focus:outline-none focus:border-teal-400 font-mono"
                      />
                      <input
                        type="number"
                        placeholder="PCS"
                        value={formData.arrCargoPcs}
                        onChange={(e) => setFormData({ ...formData, arrCargoPcs: e.target.value })}
                        className="p-2 rounded bg-[#04161a] border border-teal-800 text-teal-200 text-sm focus:outline-none focus:border-teal-400 font-mono"
                      />
                    </div>
                  </div>

                  {/* TOTAL MAIL (ONLY PCS) */}
                  <div className="flex flex-col">
                    <label className="text-xs font-bold text-teal-300 mb-1 tracking-wider uppercase flex items-center justify-between">
                      <span>TOTAL MAIL</span>
                      <span className="text-[10px] text-teal-400 font-mono font-normal">PCS ONLY</span>
                    </label>
                    <input
                      type="number"
                      placeholder="PCS"
                      value={formData.arrMailPcs}
                      onChange={(e) => setFormData({ ...formData, arrMailPcs: e.target.value })}
                      className="p-2 rounded bg-[#04161a] border border-teal-800 text-teal-200 font-mono text-sm focus:outline-none focus:border-teal-400"
                    />
                  </div>

                  {/* PAX RECEIVING (NAME ONLY) */}
                  <div className="flex flex-col">
                    <label className="text-xs font-bold text-teal-300 mb-1 tracking-wider uppercase">
                      PAX RECEIVING
                    </label>
                    <input
                      type="text"
                      placeholder="NAME ONLY"
                      value={formData.arrPaxReceiving}
                      onChange={(e) =>
                        setFormData({ ...formData, arrPaxReceiving: e.target.value.toUpperCase() })
                      }
                      className="p-2 rounded bg-[#04161a] border border-teal-800 text-teal-200 font-bold text-sm focus:outline-none focus:border-teal-400 uppercase"
                    />
                  </div>

                  {/* UNLOADING (NAME ONLY) */}
                  <div className="flex flex-col">
                    <label className="text-xs font-bold text-teal-300 mb-1 tracking-wider uppercase">
                      UNLOADING
                    </label>
                    <input
                      type="text"
                      placeholder="NAME ONLY"
                      value={formData.arrUnloading}
                      onChange={(e) =>
                        setFormData({ ...formData, arrUnloading: e.target.value.toUpperCase() })
                      }
                      className="p-2 rounded bg-[#04161a] border border-teal-800 text-teal-200 font-bold text-sm focus:outline-none focus:border-teal-400 uppercase"
                    />
                  </div>

                  {/* VIP (NUMBER ONLY) */}
                  <div className="flex flex-col">
                    <label className="text-xs font-bold text-teal-300 mb-1 tracking-wider uppercase">
                      VIP
                    </label>
                    <input
                      type="number"
                      placeholder="NUMBER ONLY"
                      value={formData.arrVip}
                      onChange={(e) => setFormData({ ...formData, arrVip: e.target.value })}
                      className="p-2 rounded bg-[#04161a] border border-teal-800 text-teal-200 font-mono text-sm focus:outline-none focus:border-teal-400"
                    />
                  </div>

                  {/* CIP (NUMBER ONLY) */}
                  <div className="flex flex-col">
                    <label className="text-xs font-bold text-teal-300 mb-1 tracking-wider uppercase">
                      CIP
                    </label>
                    <input
                      type="number"
                      placeholder="NUMBER ONLY"
                      value={formData.arrCip}
                      onChange={(e) => setFormData({ ...formData, arrCip: e.target.value })}
                      className="p-2 rounded bg-[#04161a] border border-teal-800 text-teal-200 font-mono text-sm focus:outline-none focus:border-teal-400"
                    />
                  </div>

                  {/* MAAS (NUMBER ONLY) */}
                  <div className="flex flex-col">
                    <label className="text-xs font-bold text-teal-300 mb-1 tracking-wider uppercase">
                      MAAS
                    </label>
                    <input
                      type="number"
                      placeholder="NUMBER ONLY"
                      value={formData.arrMaas}
                      onChange={(e) => setFormData({ ...formData, arrMaas: e.target.value })}
                      className="p-2 rounded bg-[#04161a] border border-teal-800 text-teal-200 font-mono text-sm focus:outline-none focus:border-teal-400"
                    />
                  </div>

                  {/* HANDLING (NAME ONLY) */}
                  <div className="flex flex-col">
                    <label className="text-xs font-bold text-teal-300 mb-1 tracking-wider uppercase">
                      HANDLING
                    </label>
                    <input
                      type="text"
                      placeholder="NAME ONLY"
                      value={formData.arrHandling}
                      onChange={(e) =>
                        setFormData({ ...formData, arrHandling: e.target.value.toUpperCase() })
                      }
                      className="p-2 rounded bg-[#04161a] border border-teal-800 text-teal-200 font-bold text-sm focus:outline-none focus:border-teal-400 uppercase"
                    />
                  </div>

                  {/* REMARKS (ARRIVAL) */}
                  <div className="flex flex-col sm:col-span-2 lg:col-span-4">
                    <label className="text-xs font-bold text-teal-300 mb-1 tracking-wider uppercase">
                      ARRIVAL REMARKS
                    </label>
                    <input
                      type="text"
                      placeholder="ENTER ARRIVAL OPERATIONAL REMARKS (IF ANY)"
                      value={formData.arrRemarks}
                      onChange={(e) =>
                        setFormData({ ...formData, arrRemarks: e.target.value.toUpperCase() })
                      }
                      className="p-2 rounded bg-[#04161a] border border-teal-800 text-teal-200 font-bold text-sm focus:outline-none focus:border-teal-400 uppercase"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ================= PART 3: DEPARTURE INFO ================= */}
            <div className="bg-[#0f172a]/95 border-2 border-indigo-500/50 shadow-[0_0_25px_rgba(99,102,241,0.15)] rounded-2xl p-5 md:p-6 backdrop-blur-md">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-indigo-500/40">
                <div className="flex items-center gap-2 text-indigo-300 font-black text-sm md:text-base tracking-wider uppercase">
                  <Plane className="w-4 h-4 text-indigo-400" />
                  <span>DEPARTURE INFORMATION</span>
                </div>
                <span className="text-[11px] font-mono text-indigo-200/80 bg-indigo-950/60 border border-indigo-500/40 px-2.5 py-0.5 rounded-full">
                  PART 3 &bull; DEPARTURE INFO
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* FLIGHT NO & ROUTE (IF NOT ALREADY SHOWN IN PART 1) */}
                <div className="flex flex-col">
                  <label className="text-xs font-bold text-sky-400 mb-1 tracking-wider uppercase">
                    DEPART FLIGHT NO
                  </label>
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

                <div className="flex flex-col">
                  <label className="text-xs font-bold text-sky-400 mb-1 tracking-wider uppercase flex items-center justify-between">
                    <span>ROUTE</span>
                    <span className="text-[10px] text-cyan-400 font-mono font-bold uppercase bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-500/40">
                      AUTO
                    </span>
                  </label>
                  <input
                    type="text"
                    value={formData.route}
                    onChange={(e) =>
                      setFormData({ ...formData, route: e.target.value.toUpperCase() })
                    }
                    placeholder="e.g. SPD-DXB"
                    className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] font-bold text-sm focus:outline-none font-mono"
                  />
                </div>

                {/* STD (UTC) */}
                <div className="flex flex-col">
                  <label className="text-xs font-bold text-sky-400 mb-1 tracking-wider uppercase">
                    STD (UTC)
                  </label>
                  <input
                    type="text"
                    placeholder="HH:MM"
                    value={formData.std}
                    onChange={(e) => handleTimeChange('std', e.target.value)}
                    className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] font-mono text-sm focus:outline-none focus:border-cyan-400"
                  />
                </div>

                {/* DOOR CLOSED (UTC) */}
                <div className="flex flex-col">
                  <label className="text-xs font-bold text-sky-400 mb-1 tracking-wider uppercase">
                    DOOR CLOSED (UTC)
                  </label>
                  <input
                    type="text"
                    placeholder="HH:MM"
                    value={formData.doorClosed}
                    onChange={(e) => handleTimeChange('doorClosed', e.target.value)}
                    className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] font-mono text-sm focus:outline-none focus:border-cyan-400"
                  />
                </div>

                {/* CHOCKS OFF (UTC) */}
                <div className="flex flex-col">
                  <label className="text-xs font-bold text-sky-400 mb-1 tracking-wider uppercase">
                    CHOCKS OFF (UTC)
                  </label>
                  <input
                    type="text"
                    placeholder="HH:MM"
                    value={formData.chocksOff}
                    onChange={(e) => handleTimeChange('chocksOff', e.target.value)}
                    className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] font-mono text-sm focus:outline-none focus:border-cyan-400"
                  />
                </div>

                {/* AIRBORNE (UTC) */}
                <div className="flex flex-col">
                  <label className="text-xs font-bold text-sky-400 mb-1 tracking-wider uppercase">
                    AIRBORNE (UTC)
                  </label>
                  <input
                    type="text"
                    placeholder="HH:MM"
                    value={formData.airborne}
                    onChange={(e) => handleTimeChange('airborne', e.target.value)}
                    className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] font-mono text-sm focus:outline-none focus:border-cyan-400"
                  />
                </div>

                {/* DEPARTURE STATUS */}
                <div className="flex flex-col">
                  <label className="text-xs font-bold text-sky-400 mb-1 tracking-wider uppercase flex items-center justify-between">
                    <span>DEPARTURE STATUS</span>
                    <span className="text-[10px] text-amber-300 font-mono">AUTO</span>
                  </label>
                  <input
                    type="text"
                    value={formData.departureStatus}
                    onChange={(e) =>
                      setFormData({ ...formData, departureStatus: e.target.value.toUpperCase() })
                    }
                    className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-amber-300 font-bold text-sm focus:outline-none uppercase"
                  />
                </div>

                {/* FUEL UPLIFT */}
                <div className="flex flex-col">
                  <label className="text-xs font-bold text-sky-400 mb-1 tracking-wider uppercase">
                    FUEL UPLIFT (KG)
                  </label>
                  <input
                    type="number"
                    placeholder="KG"
                    value={formData.fuelUplift}
                    onChange={(e) => setFormData({ ...formData, fuelUplift: e.target.value })}
                    className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] font-mono text-sm focus:outline-none focus:border-cyan-400"
                  />
                </div>

                {/* TRIP TIME (Only for Outstations, removed for DAC station) */}
                {isOutstation && (
                  <div className="flex flex-col">
                    <label className="text-xs font-bold text-amber-300 mb-1 tracking-wider uppercase flex items-center justify-between">
                      <span>TRIP TIME</span>
                      <span className="text-[10px] text-amber-400/80 font-mono">E.G. 04:50</span>
                    </label>
                    <input
                      type="text"
                      placeholder="04:50"
                      value={formData.tripTime}
                      onChange={(e) => {
                        const val = e.target.value;
                        const digits = val.replace(/\D/g, '').slice(0, 4);
                        let formatted = digits;
                        if (digits.length > 2) {
                          formatted = `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
                        }
                        setFormData({ ...formData, tripTime: formatted });
                      }}
                      className="p-2 rounded bg-[#060d1a]/90 border border-amber-500/70 text-amber-300 font-black text-sm focus:outline-none focus:border-amber-400 font-mono shadow-[inset_0_0_8px_rgba(245,158,11,0.15)]"
                      title="User will input here the trip time of depart station to destination station"
                    />
                  </div>
                )}

                {/* PASSENGERS (M+F+C+I = TOTAL) */}
                <div className="flex flex-col sm:col-span-2 lg:col-span-3">
                  <label className="text-xs font-bold text-sky-400 mb-1 tracking-wider uppercase flex items-center justify-between">
                    <span>PASSENGERS (M + F + C + I = TOTAL)</span>
                    <span className="text-[11px] font-mono text-cyan-300 font-bold">
                      TOTAL: {formData.paxTotal || '0'}
                    </span>
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    <input
                      type="number"
                      placeholder="M"
                      value={formData.paxMale}
                      onChange={(e) => setFormData({ ...formData, paxMale: e.target.value })}
                      className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] text-sm text-center font-mono"
                      title="Male"
                    />
                    <input
                      type="number"
                      placeholder="F"
                      value={formData.paxFemale}
                      onChange={(e) => setFormData({ ...formData, paxFemale: e.target.value })}
                      className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] text-sm text-center font-mono"
                      title="Female"
                    />
                    <input
                      type="number"
                      placeholder="C"
                      value={formData.paxChild}
                      onChange={(e) => setFormData({ ...formData, paxChild: e.target.value })}
                      className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] text-sm text-center font-mono"
                      title="Child"
                    />
                    <input
                      type="number"
                      placeholder="I"
                      value={formData.paxInfant}
                      onChange={(e) => setFormData({ ...formData, paxInfant: e.target.value })}
                      className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-amber-300 text-sm text-center font-mono"
                      title="Infant"
                    />
                    <input
                      type="text"
                      readOnly
                      placeholder="TOT"
                      value={formData.paxTotal}
                      className="p-2 rounded bg-[#0a1526]/80 border border-cyan-700/60 text-emerald-400 font-black text-sm text-center cursor-not-allowed font-mono"
                      title="Total (Adult + Child)"
                    />
                  </div>
                </div>

                {/* BAGGAGE (WEIGHT, PCS, COM NO) */}
                <div className="flex flex-col sm:col-span-2">
                  <label className="text-xs font-bold text-sky-400 mb-1 tracking-wider uppercase">
                    BAGGAGE (WEIGHT / PCS / COM NO)
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="number"
                      placeholder="WEIGHT"
                      value={formData.baggageWeight}
                      onChange={(e) => setFormData({ ...formData, baggageWeight: e.target.value })}
                      className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] text-sm font-mono"
                    />
                    <input
                      type="number"
                      placeholder="PCS"
                      value={formData.baggagePcs}
                      onChange={(e) => setFormData({ ...formData, baggagePcs: e.target.value })}
                      className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] text-sm font-mono"
                    />
                    <input
                      type="text"
                      placeholder="COM NO"
                      value={formData.baggageComNo}
                      onChange={(e) =>
                        setFormData({ ...formData, baggageComNo: e.target.value.toUpperCase() })
                      }
                      className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] text-sm font-mono uppercase"
                    />
                  </div>
                </div>

                {/* CARGO (WEIGHT, PCS, COM NO) */}
                <div className="flex flex-col sm:col-span-2">
                  <label className="text-xs font-bold text-sky-400 mb-1 tracking-wider uppercase">
                    CARGO (WEIGHT / PCS / COM NO)
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="number"
                      placeholder="WEIGHT"
                      value={formData.cargoWeight}
                      onChange={(e) => setFormData({ ...formData, cargoWeight: e.target.value })}
                      className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] text-sm font-mono"
                    />
                    <input
                      type="number"
                      placeholder="PCS"
                      value={formData.cargoPcs}
                      onChange={(e) => setFormData({ ...formData, cargoPcs: e.target.value })}
                      className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] text-sm font-mono"
                    />
                    <input
                      type="text"
                      placeholder="COM NO"
                      value={formData.cargoComNo}
                      onChange={(e) =>
                        setFormData({ ...formData, cargoComNo: e.target.value.toUpperCase() })
                      }
                      className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] text-sm font-mono uppercase"
                    />
                  </div>
                </div>

                {/* CREW BAG (PCS & COM NO) */}
                <div className="flex flex-col sm:col-span-2">
                  <label className="text-xs font-bold text-sky-400 mb-1 tracking-wider uppercase">
                    CREW BAG (PCS / COM NO)
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      placeholder="PCS"
                      value={formData.crewBagPcs}
                      onChange={(e) => setFormData({ ...formData, crewBagPcs: e.target.value })}
                      className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] text-sm font-mono"
                    />
                    <input
                      type="text"
                      placeholder="COM NO"
                      value={formData.crewBagComNo}
                      onChange={(e) =>
                        setFormData({ ...formData, crewBagComNo: e.target.value.toUpperCase() })
                      }
                      className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] text-sm font-mono uppercase"
                    />
                  </div>
                </div>

                {/* TOTAL WEIGHT */}
                <div className="flex flex-col sm:col-span-2">
                  <label className="text-xs font-bold text-sky-400 mb-1 tracking-wider uppercase flex items-center justify-between">
                    <span>TOTAL WEIGHT</span>
                    <span className="text-[10px] text-cyan-400 font-mono">BAG + CGO</span>
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={formData.totalWeight ? `${formData.totalWeight} KG` : ''}
                    placeholder="0 KG"
                    className="p-2 rounded bg-[#0a1526]/80 border border-cyan-700/60 text-emerald-300 font-mono font-bold text-sm cursor-not-allowed"
                  />
                </div>

                {/* DISTRIBUTION (HOLD DISTRIBUTION - PREVIOUS LOGIC) */}
                <div className="flex flex-col sm:col-span-2 lg:col-span-4 bg-[#08101e] p-3.5 rounded-xl border border-cyan-900/60 my-1">
                  <span className="text-xs font-bold text-[#00f0ff] mb-2 tracking-wider uppercase flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5 text-cyan-400" />
                    <span>CARGO HOLD DISTRIBUTION ({formData.acType || 'DETECTION REQUIRED'})</span>
                  </span>

                  {formData.acType.includes('BOEING') && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <input
                        type="number"
                        placeholder="HOLD 1"
                        value={formData.distB1}
                        onChange={(e) => setFormData({ ...formData, distB1: e.target.value })}
                        className="p-2 rounded bg-[#040812] border border-cyan-900/80 text-[#00f0ff] text-sm text-center font-mono"
                      />
                      <input
                        type="number"
                        placeholder="HOLD 2"
                        value={formData.distB2}
                        onChange={(e) => setFormData({ ...formData, distB2: e.target.value })}
                        className="p-2 rounded bg-[#040812] border border-cyan-900/80 text-[#00f0ff] text-sm text-center font-mono"
                      />
                      <input
                        type="number"
                        placeholder="HOLD 3"
                        value={formData.distB3}
                        onChange={(e) => setFormData({ ...formData, distB3: e.target.value })}
                        className="p-2 rounded bg-[#040812] border border-cyan-900/80 text-[#00f0ff] text-sm text-center font-mono"
                      />
                      <input
                        type="number"
                        placeholder="HOLD 4"
                        value={formData.distB4}
                        onChange={(e) => setFormData({ ...formData, distB4: e.target.value })}
                        className="p-2 rounded bg-[#040812] border border-cyan-900/80 text-[#00f0ff] text-sm text-center font-mono"
                      />
                    </div>
                  )}

                  {formData.acType.includes('AIRBUS') && (
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      <input
                        type="number"
                        placeholder="CPT 1"
                        value={formData.distA1}
                        onChange={(e) => setFormData({ ...formData, distA1: e.target.value })}
                        className="p-2 rounded bg-[#040812] border border-cyan-900/80 text-[#00f0ff] text-sm text-center font-mono"
                      />
                      <input
                        type="number"
                        placeholder="CPT 2"
                        value={formData.distA2}
                        onChange={(e) => setFormData({ ...formData, distA2: e.target.value })}
                        className="p-2 rounded bg-[#040812] border border-cyan-900/80 text-[#00f0ff] text-sm text-center font-mono"
                      />
                      <input
                        type="number"
                        placeholder="CPT 3"
                        value={formData.distA3}
                        onChange={(e) => setFormData({ ...formData, distA3: e.target.value })}
                        className="p-2 rounded bg-[#040812] border border-cyan-900/80 text-[#00f0ff] text-sm text-center font-mono"
                      />
                      <input
                        type="number"
                        placeholder="CPT 4"
                        value={formData.distA4}
                        onChange={(e) => setFormData({ ...formData, distA4: e.target.value })}
                        className="p-2 rounded bg-[#040812] border border-cyan-900/80 text-[#00f0ff] text-sm text-center font-mono"
                      />
                      <input
                        type="number"
                        placeholder="CPT 5"
                        value={formData.distA5}
                        onChange={(e) => setFormData({ ...formData, distA5: e.target.value })}
                        className="p-2 rounded bg-[#040812] border border-cyan-900/80 text-[#00f0ff] text-sm text-center font-mono"
                      />
                    </div>
                  )}

                  {formData.acType.includes('ATR') && (
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="number"
                        placeholder="FWD RIGHT"
                        value={formData.distAtrFwr}
                        onChange={(e) => setFormData({ ...formData, distAtrFwr: e.target.value })}
                        className="p-2 rounded bg-[#040812] border border-cyan-900/80 text-[#00f0ff] text-sm text-center font-mono"
                      />
                      <input
                        type="number"
                        placeholder="FWD LEFT"
                        value={formData.distAtrFwl}
                        onChange={(e) => setFormData({ ...formData, distAtrFwl: e.target.value })}
                        className="p-2 rounded bg-[#040812] border border-cyan-900/80 text-[#00f0ff] text-sm text-center font-mono"
                      />
                      <input
                        type="number"
                        placeholder="AFT HOLD"
                        value={formData.distAtrAft}
                        onChange={(e) => setFormData({ ...formData, distAtrAft: e.target.value })}
                        className="p-2 rounded bg-[#040812] border border-cyan-900/80 text-[#00f0ff] text-sm text-center font-mono"
                      />
                    </div>
                  )}

                  {!formData.acType && (
                    <div className="text-xs text-slate-500 italic py-1">
                      PLEASE ENTER A/C REG TO LOAD COMPARTMENT INPUTS
                    </div>
                  )}
                </div>

                {/* HOLD STATUS - NOW SHOWS IMMEDIATELY AFTER CARGO HOLD DISTRIBUTION */}
                <div className="flex flex-col sm:col-span-2">
                  <label className="text-xs font-bold text-sky-400 mb-1 tracking-wider uppercase flex items-center justify-between">
                    <span>HOLD STATUS</span>
                    <span className="text-[10px] text-amber-300 font-mono">BASED ON DISTRIBUTION</span>
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={formData.status}
                    placeholder="EQUAL / +/-"
                    className="p-2 rounded bg-[#0a1526]/80 border border-cyan-700/60 text-amber-300 font-mono font-bold text-sm cursor-not-allowed uppercase"
                  />
                </div>

                {/* MAIL */}
                <div className="flex flex-col">
                  <label className="text-xs font-bold text-sky-400 mb-1 tracking-wider uppercase">
                    MAIL
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 01 (TO CREW)"
                    value={formData.mail}
                    onChange={(e) => setFormData({ ...formData, mail: e.target.value.toUpperCase() })}
                    className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] text-sm font-mono uppercase"
                  />
                </div>

                {/* UNDER LOAD */}
                <div className="flex flex-col">
                  <label className="text-xs font-bold text-sky-400 mb-1 tracking-wider uppercase">
                    UNDER LOAD
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. NORMAL / 2500 KG"
                    value={formData.underLoad}
                    onChange={(e) =>
                      setFormData({ ...formData, underLoad: e.target.value.toUpperCase() })
                    }
                    className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] text-sm font-mono uppercase"
                  />
                </div>

                {/* COUNTER NOSHOW */}
                <div className="flex flex-col">
                  <label className="text-xs font-bold text-sky-400 mb-1 tracking-wider uppercase">
                    COUNTER NOSHOW
                  </label>
                  <input
                    type="number"
                    placeholder="0"
                    value={formData.counterNoshow}
                    onChange={(e) => setFormData({ ...formData, counterNoshow: e.target.value })}
                    className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] text-sm font-mono"
                  />
                </div>

                {/* GATE NO SHOW */}
                <div className="flex flex-col">
                  <label className="text-xs font-bold text-sky-400 mb-1 tracking-wider uppercase">
                    GATE NO SHOW
                  </label>
                  <input
                    type="number"
                    placeholder="0"
                    value={formData.gateNoShow}
                    onChange={(e) => setFormData({ ...formData, gateNoShow: e.target.value })}
                    className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] text-sm font-mono"
                  />
                </div>

                {/* SELF OFFLOAD */}
                <div className="flex flex-col">
                  <label className="text-xs font-bold text-sky-400 mb-1 tracking-wider uppercase">
                    SELF OFFLOAD
                  </label>
                  <input
                    type="number"
                    placeholder="0"
                    value={formData.selfOffload}
                    onChange={(e) => setFormData({ ...formData, selfOffload: e.target.value })}
                    className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] text-sm font-mono"
                  />
                </div>

                {/* REFUSED */}
                <div className="flex flex-col">
                  <label className="text-xs font-bold text-sky-400 mb-1 tracking-wider uppercase">
                    REFUSED
                  </label>
                  <input
                    type="number"
                    placeholder="0"
                    value={formData.refused}
                    onChange={(e) => setFormData({ ...formData, refused: e.target.value })}
                    className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] text-sm font-mono"
                  />
                </div>

                {/* IMMIGRATION OFF */}
                <div className="flex flex-col">
                  <label className="text-xs font-bold text-sky-400 mb-1 tracking-wider uppercase">
                    IMMIGRATION OFF
                  </label>
                  <input
                    type="number"
                    placeholder="0"
                    value={formData.immigrationOff}
                    onChange={(e) => setFormData({ ...formData, immigrationOff: e.target.value })}
                    className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] text-sm font-mono"
                  />
                </div>

                {/* IMMIGRATION NOT FACE */}
                <div className="flex flex-col">
                  <label className="text-xs font-bold text-sky-400 mb-1 tracking-wider uppercase">
                    IMMIGRATION NOT FACE
                  </label>
                  <input
                    type="number"
                    placeholder="0"
                    value={formData.immigrationNotFace}
                    onChange={(e) => setFormData({ ...formData, immigrationNotFace: e.target.value })}
                    className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] text-sm font-mono"
                  />
                </div>

                {/* CUSTOM OFF */}
                <div className="flex flex-col">
                  <label className="text-xs font-bold text-sky-400 mb-1 tracking-wider uppercase">
                    CUSTOM OFF
                  </label>
                  <input
                    type="number"
                    placeholder="0"
                    value={formData.customOff}
                    onChange={(e) => setFormData({ ...formData, customOff: e.target.value })}
                    className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] text-sm font-mono"
                  />
                </div>

                {/* MAAS */}
                <div className="flex flex-col">
                  <label className="text-xs font-bold text-sky-400 mb-1 tracking-wider uppercase">
                    MAAS
                  </label>
                  <input
                    type="number"
                    placeholder="0"
                    value={formData.maas}
                    onChange={(e) => setFormData({ ...formData, maas: e.target.value })}
                    className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] text-sm font-mono"
                  />
                </div>

                {/* UM PAX */}
                <div className="flex flex-col">
                  <label className="text-xs font-bold text-sky-400 mb-1 tracking-wider uppercase">
                    UM PAX
                  </label>
                  <input
                    type="number"
                    placeholder="0"
                    value={formData.umPax}
                    onChange={(e) => setFormData({ ...formData, umPax: e.target.value })}
                    className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] text-sm font-mono"
                  />
                </div>

                {/* WCHR • WCHC (FIG + SEAT) */}
                <div className="flex flex-col sm:col-span-2">
                  <label className="text-xs font-bold text-sky-400 mb-1 tracking-wider uppercase">
                    WCHR (FIG + SEAT)
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      placeholder="FIG"
                      value={formData.wchrFig}
                      onChange={(e) => setFormData({ ...formData, wchrFig: e.target.value })}
                      className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] text-sm font-mono"
                    />
                    <input
                      type="text"
                      placeholder="SEAT (e.g. 12A, 14B)"
                      value={formData.wchrSeat}
                      onChange={(e) =>
                        setFormData({ ...formData, wchrSeat: e.target.value.toUpperCase() })
                      }
                      className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] text-sm font-mono uppercase"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:col-span-2">
                  <label className="text-xs font-bold text-sky-400 mb-1 tracking-wider uppercase">
                    WCHC (FIG + SEAT)
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      placeholder="FIG"
                      value={formData.wchcFig}
                      onChange={(e) => setFormData({ ...formData, wchcFig: e.target.value })}
                      className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] text-sm font-mono"
                    />
                    <input
                      type="text"
                      placeholder="SEAT"
                      value={formData.wchcSeat}
                      onChange={(e) =>
                        setFormData({ ...formData, wchcSeat: e.target.value.toUpperCase() })
                      }
                      className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] text-sm font-mono uppercase"
                    />
                  </div>
                </div>

                {/* LOADING STUFF / G7 */}
                <div className="flex flex-col">
                  <label className="text-xs font-bold text-sky-400 mb-1 tracking-wider uppercase">
                    LOADING STUFF / G7
                  </label>
                  <input
                    type="text"
                    placeholder="NAME"
                    value={formData.loadingStuff}
                    onChange={(e) =>
                      setFormData({ ...formData, loadingStuff: e.target.value.toUpperCase() })
                    }
                    className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] font-bold text-sm uppercase"
                  />
                </div>

                {/* LOAD CONTROLLER */}
                <div className="flex flex-col">
                  <label className="text-xs font-bold text-sky-400 mb-1 tracking-wider uppercase">
                    LOAD CONTROLLER
                  </label>
                  <input
                    type="text"
                    placeholder="NAME"
                    value={formData.loadController}
                    onChange={(e) =>
                      setFormData({ ...formData, loadController: e.target.value.toUpperCase() })
                    }
                    className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] font-bold text-sm uppercase"
                  />
                </div>

                {/* PAX HANDLING (Only for Outstations, removed for DAC station) */}
                {isOutstation && (
                  <div className="flex flex-col">
                    <label className="text-xs font-bold text-sky-400 mb-1 tracking-wider uppercase">
                      PAX HANDLING
                    </label>
                    <input
                      type="text"
                      placeholder="NAME"
                      value={formData.paxHandling}
                      onChange={(e) =>
                        setFormData({ ...formData, paxHandling: e.target.value.toUpperCase() })
                      }
                      className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] font-bold text-sm uppercase"
                    />
                  </div>
                )}

                {/* REMARKS (DEPARTURE) */}
                <div className="flex flex-col sm:col-span-2 lg:col-span-4">
                  <label className="text-xs font-bold text-sky-400 mb-1 tracking-wider uppercase">
                    DEPARTURE REMARKS
                  </label>
                  <textarea
                    rows={2}
                    placeholder="ENTER OPERATIONAL REMARKS (E.G. GOT DELAY DUE TO ATC CLEARANCE)"
                    value={formData.remarks}
                    onChange={(e) =>
                      setFormData({ ...formData, remarks: e.target.value.toUpperCase() })
                    }
                    className="p-2 rounded bg-[#060d1a]/90 border border-cyan-900/80 text-[#00f0ff] font-bold text-sm focus:outline-none focus:border-cyan-400 uppercase font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="w-full flex flex-col sm:flex-row justify-between items-center pt-2 gap-4">
              <button
                type="button"
                onClick={resetForm}
                className="w-full sm:w-auto px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-slate-700"
              >
                <RotateCcw className="w-4 h-4" />
                <span>RESET FORM</span>
              </button>

              <button
                type="submit"
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-black tracking-widest text-sm shadow-[0_0_25px_rgba(0,240,255,0.4)] hover:shadow-[0_0_35px_rgba(0,240,255,0.6)] transition-all cursor-pointer transform active:scale-95 flex items-center justify-center gap-2 uppercase"
              >
                <CheckCircle className="w-5 h-5 text-cyan-200" />
                <span>
                  {editingReportInfo
                    ? 'UPDATE & GENERATE FINAL REPORTS'
                    : isOutstation
                    ? 'GENERATE 05 FINAL REPORTS'
                    : 'GENERATE FINAL REPORT'}
                </span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
