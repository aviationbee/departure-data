import { initializeApp } from 'firebase/app';
import {
  initializeFirestore,
  setLogLevel,
  collection,
  doc,
  setDoc,
  addDoc,
  deleteDoc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  limit,
  where,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { FlightFormData, UserInfo } from './types';

// Suppress internal @firebase/firestore transient connection timeout warnings
setLogLevel('silent');

// Initialize Firebase App & Cloud Firestore (asia-southeast1) with forced HTTP long-polling so corporate/airport networks never hit the 10s WebChannel timeout
const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(
  app,
  { experimentalForceLongPolling: true },
  firebaseConfig.firestoreDatabaseId
);

// LocalStorage Backup Cache Keys (prevents data loss and keeps reports available even if offline or quota limited)
export const CACHED_FLIGHT_REPORTS_KEY = 'usba_cached_flight_reports_backup';
export const CACHED_MASS_REPORTS_KEY = 'usba_cached_mass_reports_backup';
export const CACHED_SYSTEM_NOTICE_KEY = 'usba_cached_system_notice_backup';
export const FLIGHT_LAST_SYNC_KEY = 'usba_flight_last_sync_iso';
export const FLIGHT_FULL_SYNC_TS_KEY = 'usba_flight_full_sync_ts';
export const MASS_LAST_SYNC_KEY = 'usba_mass_last_sync_iso';
export const MASS_FULL_SYNC_TS_KEY = 'usba_mass_full_sync_ts';
export const NOTICE_LAST_CHECK_TS_KEY = 'usba_notice_last_check_ts';

const SMART_SYNC_COOLDOWN_MS = 10 * 60 * 1000;
const FULL_15D_COOLDOWN_MS = 30 * 60 * 1000;
const NOTICE_CHECK_COOLDOWN_MS = 15 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export function mergeFlightReports(
  existing: StoredFlightReport[],
  incoming: StoredFlightReport[]
): StoredFlightReport[] {
  const map = new Map<string, StoredFlightReport>();
  (existing || []).forEach((r) => {
    if (r?.id) map.set(r.id, r);
  });
  (incoming || []).forEach((r) => {
    if (r?.id) {
      map.set(r.id, r);
    }
  });
  return Array.from(map.values()).sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return timeB - timeA;
  });
}

export function mergeMassReports(
  existing: StoredMassReport[],
  incoming: StoredMassReport[]
): StoredMassReport[] {
  const map = new Map<string, StoredMassReport>();
  (existing || []).forEach((r) => {
    if (r?.id) map.set(r.id, r);
  });
  (incoming || []).forEach((r) => {
    if (r?.id) {
      map.set(r.id, r);
    }
  });
  return Array.from(map.values()).sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return timeB - timeA;
  });
}

export function getCachedFlightReports(): StoredFlightReport[] {
  try {
    const raw = localStorage.getItem(CACHED_FLIGHT_REPORTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCachedFlightReports(reports: StoredFlightReport[], overwrite = false): void {
  try {
    const listToSave = overwrite ? reports : mergeFlightReports(getCachedFlightReports(), reports);
    localStorage.setItem(CACHED_FLIGHT_REPORTS_KEY, JSON.stringify(listToSave.slice(0, 1000)));
  } catch {
    // Ignore quota error in localStorage
  }
}

export function getCachedMassReports(): StoredMassReport[] {
  try {
    const raw = localStorage.getItem(CACHED_MASS_REPORTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCachedMassReports(reports: StoredMassReport[], overwrite = false): void {
  try {
    const listToSave = overwrite ? reports : mergeMassReports(getCachedMassReports(), reports);
    localStorage.setItem(CACHED_MASS_REPORTS_KEY, JSON.stringify(listToSave.slice(0, 1000)));
  } catch {
    // Ignore quota error in localStorage
  }
}

export function exportStationBackupJson(stationCode?: string): string {
  const flights = getCachedFlightReports();
  const mass = getCachedMassReports();
  const filteredFlights = stationCode
    ? flights.filter((r) => (r.station || '').toUpperCase() === stationCode.toUpperCase())
    : flights;
  const filteredMass = stationCode
    ? mass.filter((r) => (r.station || '').toUpperCase() === stationCode.toUpperCase())
    : mass;
  return JSON.stringify(
    {
      version: '1.4.0',
      exportedAt: new Date().toISOString(),
      station: stationCode || 'ALL',
      flightReports: filteredFlights,
      massReports: filteredMass,
    },
    null,
    2
  );
}

export function restoreStationBackupJson(jsonString: string): { restoredFlights: number; restoredMass: number } {
  try {
    const parsed = JSON.parse(jsonString);
    let restoredFlights = 0;
    let restoredMass = 0;
    if (Array.isArray(parsed.flightReports) && parsed.flightReports.length > 0) {
      saveCachedFlightReports(parsed.flightReports);
      flightReportSubscribers.forEach((cb) => cb(getCachedFlightReports()));
      restoredFlights = parsed.flightReports.length;
    }
    if (Array.isArray(parsed.massReports) && parsed.massReports.length > 0) {
      saveCachedMassReports(parsed.massReports);
      massReportSubscribers.forEach((cb) => cb(getCachedMassReports()));
      restoredMass = parsed.massReports.length;
    }
    return { restoredFlights, restoredMass };
  } catch (e) {
    console.error('Failed to restore backup:', e);
    return { restoredFlights: 0, restoredMass: 0 };
  }
}

let quotaExceededNotified = false;
let quotaExceededState = false;
const quotaStatusSubscribers = new Set<(exceeded: boolean) => void>();

export function notifyQuotaExceeded(): void {
  quotaExceededState = true;
  quotaStatusSubscribers.forEach((cb) => cb(true));
  if (quotaExceededNotified) return;
  quotaExceededNotified = true;
  console.warn(
    'Firestore Quota Exceeded: Daily free read units reached. Serving reports from local persistent cache until quota resets.'
  );
}

export function clearQuotaExceeded(): void {
  if (!quotaExceededState) return;
  quotaExceededState = false;
  quotaExceededNotified = false;
  quotaStatusSubscribers.forEach((cb) => cb(false));
}

export function isQuotaExceeded(): boolean {
  return quotaExceededState;
}

export function subscribeToQuotaStatus(callback: (exceeded: boolean) => void): () => void {
  quotaStatusSubscribers.add(callback);
  callback(quotaExceededState);
  return () => {
    quotaStatusSubscribers.delete(callback);
  };
}

// Active subscriber registries for instant activity-based sync without page reload
const flightReportSubscribers = new Set<(reports: StoredFlightReport[]) => void>();
const massReportSubscribers = new Set<(reports: StoredMassReport[]) => void>();
const activityLogSubscribers = new Set<(logs: ActivityLogEntry[]) => void>();
const systemNoticeSubscribers = new Set<(notice: SystemNoticeDoc | null) => void>();

// Safe debounced sync function (preserves Firestore daily quota; real-time onSnapshot listeners handle live data)
export async function syncRealtimeDataOnActivity(_force = false): Promise<void> {
  // onSnapshot listeners already maintain an active persistent WebSocket/channel.
  // Avoiding redundant getDocs queries prevents exhausting Firestore daily free read quotas.
}

// 15 Days retention (Firestore will save flight data from latest flight generate / today to last 15 days)
export const FIFTEEN_DAYS_MS = 15 * 24 * 60 * 60 * 1000;
export const NINETY_DAYS_MS = FIFTEEN_DAYS_MS; // Alias for backward compatibility
export const getFifteenDaysAgoDate = (): string => {
  return new Date(Date.now() - FIFTEEN_DAYS_MS).toISOString().split('T')[0];
};
export const STORAGE_START_DATE = '2026-10-21'; // Set to 15 days back

export interface StoredFlightReport {
  id: string;
  station: string;
  date: string;
  flightNo: string;
  route: string;
  acReg: string;
  acType: string;
  captain: string;
  configure: string;
  sta: string;
  chocksOn: string;
  doorOpen: string;
  arrivalStatus: string;
  arrFlightNo?: string;
  arrRoute?: string;
  arrPaxReceiving?: string;
  std: string;
  doorClosed: string;
  chocksOff: string;
  airborne: string;
  departureStatus: string;
  delayReason: string;
  flightLoad: string;
  fuelUplift: string;
  paxMale: string;
  paxFemale: string;
  paxChild: string;
  paxInfant: string;
  paxTotal: string;
  baggageWeight: string;
  baggagePcs: string;
  cargoWeight: string;
  cargoPcs: string;
  mail: string;
  counterNoshow: string;
  noshowPnr: string;
  ebt?: string;
  transit?: string;
  gateNoShow: string;
  selfOffload: string;
  vip: string;
  cip: string;
  maas: string;
  umPax: string;
  umPaxSeat: string;
  fireArms: string;
  fireArmsSeat: string;
  wchrFig: string;
  wchrSeat: string;
  wchcFig: string;
  wchcSeat: string;
  checkInStaff: string;
  rampOfficer: string;
  loadController: string;
  paxHandling: string;
  remarks: string;
  preparedBy: string;
  usbaId: string;
  createdAt: string;
  updatedAt?: string;
  expiresAt: number;
  sourceModule?: 'load-control' | 'standard';
  rawFormData?: FlightFormData;
}

export function isLoadControlReport(r: StoredFlightReport): boolean {
  if (r.sourceModule === 'standard') return false;
  if (r.sourceModule === 'load-control') return true;
  if (r.id && r.id.endsWith('_LC')) return true;
  const raw = (r.rawFormData as any) || {};
  if (raw?.ldmRawData || (r as any).ldmRawData) return true;
  if (raw?.docIn !== undefined || (r as any).docIn !== undefined) return true;
  if (raw?.boardingGate !== undefined && raw?.boardingGate !== '') return true;
  if (raw?.dist?.b1 || raw?.dist?.a1 || raw?.dist?.atrFwr || raw?.distB1 || raw?.baggageComNo) return true;
  if (
    r.route &&
    /^(SPD|CXB|CGP|RJH|JSR|BZL|ZYL)-(DXB|SHJ|AUH|RUH|JED|MLE|BKK|MCT|DOH|CCU|MAA|CAN|SIN|KUL)$/i.test(
      r.route.trim()
    )
  ) {
    return true;
  }
  // BS 341 generated from SPD or outstation load control
  const numOnly = (r.flightNo || '').replace(/\D/g, '');
  if (numOnly === '341' && (r.station === 'SPD' || (r.route || '').includes('SPD'))) {
    return true;
  }
  return false;
}

export interface ActivityLogEntry {
  id: string;
  action: string;
  details: string;
  userName: string;
  usbaId: string;
  station: string;
  createdAt: string;
  timestamp: number;
}

export interface SystemNoticeDoc {
  id: string;
  message: string;
  active: boolean;
  createdAt: string;
  timestamp: number;
  createdBy: string;
}

export interface StoredMassReport {
  id: string;
  station: string;
  dateInput: string;
  flightNoInput: string;
  destInput: string;
  categoryInput: string;
  flstText: string;
  preparedBy: string;
  usbaId: string;
  designation?: string;
  createdAt: string;
  updatedAt?: string;
  expiresAt: number;
}

export function reconstructFormDataFromStoredReport(r: StoredFlightReport): FlightFormData {
  if (r.rawFormData) {
    return r.rawFormData;
  }
  return {
    date: r.date || new Date().toISOString().split('T')[0],
    flightNoSuffix: (r.flightNo || '').replace(/^BS-/i, ''),
    route: r.route || '',
    acRegSuffix: (r.acReg || '').replace(/^S2-/i, ''),
    acType: r.acType || '',
    captain: r.captain || '',
    configure: r.configure || '',
    sta: r.sta || '',
    chocksOn: r.chocksOn || '',
    doorOpen: r.doorOpen || '',
    arrivalStatus: r.arrivalStatus || 'FLIGHT ON TIME ARRIVED',
    arrFlightNo: r.arrFlightNo || '',
    arrRoute: r.arrRoute || '',
    arrPaxReceiving: r.arrPaxReceiving || '',
    std: r.std || '',
    doorClosed: r.doorClosed || '',
    chocksOff: r.chocksOff || '',
    airborne: r.airborne || '',
    departureStatus: r.departureStatus || 'FLIGHT ONTIME',
    delayReason: r.delayReason || '',
    flightLoad: r.flightLoad || '',
    fuelUplift: r.fuelUplift || '',
    paxMale: r.paxMale || '',
    paxFemale: r.paxFemale || '',
    paxChild: r.paxChild || '',
    paxInfant: r.paxInfant || '',
    paxTotal: r.paxTotal || '',
    baggageWeight: r.baggageWeight || '',
    baggagePcs: r.baggagePcs || '',
    cargoWeight: r.cargoWeight || '',
    cargoPcs: r.cargoPcs || '',
    mail: r.mail || '',
    counterNoshow: r.counterNoshow || '',
    noshowPnr: r.noshowPnr || '',
    ebt: (r as any).ebt || (r.rawFormData as any)?.ebt || '',
    transit: (r as any).transit || (r.rawFormData as any)?.transit || '',
    transitPax: (r as any).transit || (r.rawFormData as any)?.transit || '',
    gateNoShow: r.gateNoShow || '',
    selfOffload: r.selfOffload || '',
    vip: r.vip || '',
    cip: r.cip || '',
    maas: r.maas || '',
    umPax: r.umPax || '',
    umPaxSeat: r.umPaxSeat || '',
    fireArms: r.fireArms || '',
    fireArmsSeat: r.fireArmsSeat || '',
    wchrFig: r.wchrFig || '',
    wchrSeat: r.wchrSeat || '',
    wchcFig: r.wchcFig || '',
    wchcSeat: r.wchcSeat || '',
    checkInStaff: r.checkInStaff || '',
    checkInStuff: r.checkInStaff || '',
    rampOfficer: r.rampOfficer || '',
    loadingStuff: r.rampOfficer || '',
    loadController: r.loadController || '',
    paxHandling: r.paxHandling || '',
    remarks: r.remarks || '',
    flstRawMessage: '',
  };
}

// Save Flight Report to Firestore (preserved for 90 days)
export async function saveFlightReportToCloud(
  formData: FlightFormData,
  userInfo: UserInfo,
  originalCreatedAt?: string,
  sourceModule?: 'load-control' | 'standard'
): Promise<void> {
  const rawStn = (userInfo.stationName || 'DAC').trim().toUpperCase();
  const stationMatch = rawStn.match(/^([A-Z]{3})\b/);
  const station = stationMatch ? stationMatch[1] : (rawStn.slice(0, 3) || 'DAC');
  const date = formData.date || new Date().toISOString().split('T')[0];
  const flightNo = `BS-${(formData.flightNoSuffix || '000').trim().toUpperCase()}`;
  const isLc =
    sourceModule === 'load-control' ||
    Boolean((formData as any)?.ldmRawData) ||
    Boolean((formData as any)?.boardingGate) ||
    Boolean((formData as any)?.dist?.b1) ||
    Boolean((formData as any)?.dist?.atrFwr);
  const detectedSource: 'load-control' | 'standard' = isLc ? 'load-control' : (sourceModule || 'standard');
  const docId = isLc
    ? `${station}_${date}_${flightNo.replace(/[^A-Z0-9]/g, '')}_LC`
    : `${station}_${date}_${flightNo.replace(/[^A-Z0-9]/g, '')}`;
  const now = Date.now();
  const createdAt = originalCreatedAt || new Date(now).toISOString();
  const updatedAt = new Date(now).toISOString();
  const expiresAt = now + NINETY_DAYS_MS;

  const payload: Omit<StoredFlightReport, 'id'> = {
    station,
    date,
    flightNo,
    sourceModule: detectedSource,
    route: formData.route || '',
    acReg: formData.acRegSuffix ? `S2-${formData.acRegSuffix}` : '',
    acType: formData.acType || '',
    captain: formData.captain || '',
    configure: formData.configure || '',
    sta: formData.sta || '',
    chocksOn: formData.chocksOn || '',
    doorOpen: formData.doorOpen || '',
    arrivalStatus: formData.arrivalStatus || '',
    arrFlightNo: formData.arrFlightNo || '',
    arrRoute: formData.arrRoute || '',
    arrPaxReceiving: formData.arrPaxReceiving || '',
    std: formData.std || '',
    doorClosed: formData.doorClosed || '',
    chocksOff: formData.chocksOff || '',
    airborne: formData.airborne || '',
    departureStatus: formData.departureStatus || '',
    delayReason: formData.delayReason || '',
    flightLoad: formData.flightLoad || '',
    fuelUplift: formData.fuelUplift || '',
    paxMale: formData.paxMale || '0',
    paxFemale: formData.paxFemale || '0',
    paxChild: formData.paxChild || '0',
    paxInfant: formData.paxInfant || '0',
    paxTotal: formData.paxTotal || '0',
    baggageWeight: formData.baggageWeight || '0',
    baggagePcs: formData.baggagePcs || '0',
    cargoWeight: formData.cargoWeight || '0',
    cargoPcs: formData.cargoPcs || '0',
    mail: formData.mail || 'NIL',
    counterNoshow: formData.counterNoshow || '0',
    noshowPnr: formData.noshowPnr || 'NIL',
    ebt: formData.ebt || '',
    transit: formData.transit || formData.transitPax || '',
    gateNoShow: formData.gateNoShow || '0',
    selfOffload: formData.selfOffload || '0',
    vip: formData.vip || '0',
    cip: formData.cip || '0',
    maas: formData.maas || '0',
    umPax: formData.umPax || '0',
    umPaxSeat: formData.umPaxSeat || '',
    fireArms: formData.fireArms || 'NIL',
    fireArmsSeat: formData.fireArmsSeat || '',
    wchrFig: formData.wchrFig || '0',
    wchrSeat: formData.wchrSeat || '',
    wchcFig: formData.wchcFig || '0',
    wchcSeat: formData.wchcSeat || '',
    checkInStaff: formData.checkInStaff || formData.checkInStuff || '',
    rampOfficer: formData.rampOfficer || formData.loadingStuff || '',
    loadController: formData.loadController || '',
    paxHandling: formData.paxHandling || '',
    remarks: formData.remarks || '',
    preparedBy: userInfo.userName || 'OFFICER',
    usbaId: userInfo.usbaId || '',
    createdAt,
    updatedAt,
    expiresAt,
    rawFormData: formData,
  };

  // 1. Immediately update localStorage persistent cache so reports are never lost or empty
  const currentCached = getCachedFlightReports();
  const updatedList: StoredFlightReport[] = [
    { id: docId, ...payload },
    ...currentCached.filter((r) => r.id !== docId),
  ];
  saveCachedFlightReports(updatedList);
  flightReportSubscribers.forEach((cb) => cb(updatedList));

  // 2. Persist to Cloud Firestore (no post-save getDocs read — onSnapshot updates listeners directly)
  try {
    await setDoc(doc(db, 'flight_reports', docId), payload);
  } catch (err: any) {
    console.warn('Firestore saveFlightReportToCloud warning:', err);
    if (err?.code === 'resource-exhausted' || err?.message?.includes('Quota exceeded')) {
      notifyQuotaExceeded();
    }
  }
}

export async function deleteFlightReportFromCloud(
  report: StoredFlightReport,
  actorUser: UserInfo
): Promise<void> {
  const currentCached = getCachedFlightReports();
  const updatedList = currentCached.filter((r) => r.id !== report.id);
  saveCachedFlightReports(updatedList, true);
  flightReportSubscribers.forEach((cb) => cb(updatedList));

  try {
    await deleteDoc(doc(db, 'flight_reports', report.id));
    await logUserActivity(
      'FLIGHT REPORT DELETED',
      `Deleted Flight ${report.flightNo} (${report.route}) of ${report.date} [Station: ${report.station}]`,
      actorUser
    );
  } catch (err: any) {
    console.warn('Firestore deleteFlightReportFromCloud warning:', err);
  }
}

// Save MASS Form Report to Cloud (preserved for 90 days)
export async function saveMassReportToCloud(
  item: {
    id: number;
    dateInput: string;
    flightNoInput: string;
    destInput: string;
    categoryInput: string;
    flstText: string;
    designation?: string;
  },
  userInfo: UserInfo
): Promise<void> {
  const station = (userInfo.stationName || 'DAC').trim().toUpperCase();
  const now = Date.now();
  const createdAt = new Date(now).toISOString();
  const updatedAt = createdAt;
  const expiresAt = now + NINETY_DAYS_MS;
  const docId = `${station}_${item.id}`;

  const massData: Omit<StoredMassReport, 'id'> = {
    station,
    dateInput: item.dateInput,
    flightNoInput: item.flightNoInput,
    destInput: item.destInput,
    categoryInput: item.categoryInput,
    flstText: item.flstText,
    preparedBy: (userInfo.userName || 'OFFICER').toUpperCase(),
    usbaId: (userInfo.usbaId || '').toUpperCase(),
    designation: (item.designation || 'EXECUTIVE').toUpperCase(),
    createdAt,
    updatedAt,
    expiresAt,
  };

  const currentMass = getCachedMassReports();
  const updatedMassList = [{ id: docId, ...massData }, ...currentMass.filter((r) => r.id !== docId)];
  saveCachedMassReports(updatedMassList);
  massReportSubscribers.forEach((cb) => cb(updatedMassList));

  try {
    await setDoc(doc(db, 'mass_reports', docId), massData);
  } catch (err: any) {
    console.warn('Firestore saveMassReportToCloud warning:', err);
    if (err?.code === 'resource-exhausted' || err?.message?.includes('Quota exceeded')) {
      notifyQuotaExceeded();
    }
  }
}

export async function deleteMassReportFromCloud(
  docId: string,
  flightNoInput: string,
  dateInput: string,
  userInfo: UserInfo
): Promise<void> {
  const currentMass = getCachedMassReports();
  const updatedMassList = currentMass.filter((r) => r.id !== docId);
  saveCachedMassReports(updatedMassList, true);
  massReportSubscribers.forEach((cb) => cb(updatedMassList));

  try {
    await deleteDoc(doc(db, 'mass_reports', docId));
    await logUserActivity(
      'MASS REPORT DELETED',
      `Deleted MASS Report BS-${flightNoInput} (${dateInput})`,
      userInfo
    );
  } catch (err: any) {
    console.warn('Firestore deleteMassReportFromCloud warning:', err);
  }
}

// Log User Activity (Log In, Log Out, Report Generate, Report Delete, etc.)
export async function logUserActivity(
  action: string,
  details: string,
  userInfo: UserInfo
): Promise<void> {
  const now = Date.now();
  const createdAt = new Date(now).toISOString();
  try {
    await addDoc(collection(db, 'activity_logs'), {
      action: action.toUpperCase(),
      details: details.toUpperCase(),
      userName: (userInfo.userName || 'UNKNOWN').toUpperCase(),
      usbaId: (userInfo.usbaId || 'N/A').toUpperCase(),
      station: (userInfo.stationName || 'DAC').toUpperCase(),
      createdAt,
      timestamp: now,
    });
    await syncRealtimeDataOnActivity(true);
  } catch (err) {
    console.warn('Firestore logUserActivity warning:', err);
  }
}

// Broadcast / Clear Super Admin Notice
export async function circulateAdminNotice(
  message: string,
  active: boolean,
  createdBy = 'SUPER ADMIN'
): Promise<boolean> {
  const now = Date.now();
  const createdAt = new Date(now).toISOString();
  const noticePayload: SystemNoticeDoc = {
    id: 'current_notice',
    message: message.trim().toUpperCase(),
    active,
    createdAt,
    timestamp: now,
    createdBy: createdBy.toUpperCase(),
  };
  setSafeStorageItem(CACHED_SYSTEM_NOTICE_KEY, JSON.stringify(noticePayload));
  systemNoticeSubscribers.forEach((cb) => cb(noticePayload));
  try {
    await setDoc(doc(db, 'system_notices', 'current_notice'), {
      message: noticePayload.message,
      active: noticePayload.active,
      createdAt,
      timestamp: now,
      createdBy: noticePayload.createdBy,
    });
    clearQuotaExceeded();
    return true;
  } catch (err: any) {
    console.warn('Firestore circulateAdminNotice warning:', err);
    if (err?.code === 'resource-exhausted' || err?.message?.includes('Quota exceeded')) {
      notifyQuotaExceeded();
    }
    return false;
  }
}

export type CloudSyncMode = 'smart' | 'today' | 'full';

function normalizeSyncMode(modeOrForce: CloudSyncMode | boolean): CloudSyncMode {
  if (modeOrForce === true) return 'full';
  if (modeOrForce === false || !modeOrForce) return 'smart';
  return modeOrForce;
}

function getSafeStorageItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function setSafeStorageItem(key: string, val: string): void {
  try {
    localStorage.setItem(key, val);
  } catch {
    // Ignore storage quota errors
  }
}

let inFlightFlightSync: Promise<StoredFlightReport[]> | null = null;
let inFlightMassSync: Promise<StoredMassReport[]> | null = null;

function getTodayDateCandidates(): string[] {
  const candidates = new Set<string>();
  candidates.add(new Date().toISOString().split('T')[0]);
  try {
    candidates.add(new Date().toLocaleDateString('en-CA'));
    candidates.add(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' }));
  } catch {
    // Fallback to UTC ISO date only
  }
  return Array.from(candidates).filter(Boolean).slice(0, 3);
}

// Smart Quota-Preserving Sync for Flight Reports:
// - 'smart': 10-min cooldown -> Today-only initial load on fresh device -> updatedAt delta afterwards
// - 'today': bypasses 10-min cooldown, loads last 24h createdAt (used by SYNC / REFRESH button)
// - 'full' : loads 15-day archive (limit 120) with 30-min cooldown (used only when clicking ALL DATES / ALL 15 DAYS)
export async function syncFlightReportsFromCloud(
  modeOrForce: CloudSyncMode | boolean = 'smart'
): Promise<StoredFlightReport[]> {
  const mode = normalizeSyncMode(modeOrForce);
  const cached = getCachedFlightReports();
  const now = Date.now();

  if (mode === 'smart' && cached.length > 0) {
    const lastSyncIso = getSafeStorageItem(FLIGHT_LAST_SYNC_KEY);
    if (lastSyncIso) {
      const lastSyncMs = Date.parse(lastSyncIso);
      if (!isNaN(lastSyncMs) && now - lastSyncMs < SMART_SYNC_COOLDOWN_MS) {
        return cached;
      }
    }
  }

  if (mode === 'full' && cached.length > 0) {
    const lastFullTs = Number(getSafeStorageItem(FLIGHT_FULL_SYNC_TS_KEY) || '0');
    if (lastFullTs > 0 && now - lastFullTs < FULL_15D_COOLDOWN_MS) {
      return cached;
    }
  }

  if (inFlightFlightSync) {
    return inFlightFlightSync;
  }

  inFlightFlightSync = (async () => {
    try {
      const lastSyncIso = getSafeStorageItem(FLIGHT_LAST_SYNC_KEY);
      const lastSyncMs = lastSyncIso ? Date.parse(lastSyncIso) : NaN;
      const hasValidDeltaCursor =
        mode === 'smart' && cached.length > 0 && !isNaN(lastSyncMs) && lastSyncMs > 0;

      let q;
      if (mode === 'full') {
        q = query(collection(db, 'flight_reports'), orderBy('createdAt', 'desc'), limit(120));
      } else if (hasValidDeltaCursor) {
        const deltaCursorIso = new Date(Math.max(now - FIFTEEN_DAYS_MS, lastSyncMs - 2 * 60 * 1000)).toISOString();
        q = query(
          collection(db, 'flight_reports'),
          where('updatedAt', '>=', deltaCursorIso),
          orderBy('updatedAt', 'desc'),
          limit(60)
        );
      } else if (mode === 'today') {
        const recent24hIso = new Date(now - TWENTY_FOUR_HOURS_MS).toISOString();
        q = query(
          collection(db, 'flight_reports'),
          where('createdAt', '>=', recent24hIso),
          orderBy('createdAt', 'desc'),
          limit(60)
        );
      } else {
        q = query(
          collection(db, 'flight_reports'),
          where('date', 'in', getTodayDateCandidates()),
          limit(60)
        );
      }

      const snapshot = await getDocs(q);
      clearQuotaExceeded();
      const currentNow = Date.now();
      const cutoff = currentNow - FIFTEEN_DAYS_MS;
      const list: StoredFlightReport[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Omit<StoredFlightReport, 'id'>;
        const cTime = data.createdAt ? new Date(data.createdAt).getTime() : currentNow;
        if (cTime >= cutoff && (!data.expiresAt || data.expiresAt > currentNow)) {
          list.push({ id: docSnap.id, ...data });
        }
      });

      const merged = mergeFlightReports(getCachedFlightReports(), list).filter((r) => {
        const cTime = r.createdAt ? new Date(r.createdAt).getTime() : currentNow;
        return cTime >= cutoff && (!r.expiresAt || r.expiresAt > currentNow);
      });
      saveCachedFlightReports(merged, true);
      setSafeStorageItem(FLIGHT_LAST_SYNC_KEY, new Date(currentNow).toISOString());
      if (mode === 'full') {
        setSafeStorageItem(FLIGHT_FULL_SYNC_TS_KEY, String(currentNow));
      }
      flightReportSubscribers.forEach((cb) => cb(merged));
      return merged;
    } catch (err: any) {
      console.warn('syncFlightReportsFromCloud warning:', err);
      if (err?.code === 'resource-exhausted' || err?.message?.includes('Quota exceeded')) {
        notifyQuotaExceeded();
      }
      return getCachedFlightReports();
    } finally {
      inFlightFlightSync = null;
    }
  })();

  return inFlightFlightSync;
}

export async function syncMassReportsFromCloud(
  modeOrForce: CloudSyncMode | boolean = 'smart'
): Promise<StoredMassReport[]> {
  const mode = normalizeSyncMode(modeOrForce);
  const cached = getCachedMassReports();
  const now = Date.now();

  if (mode === 'smart' && cached.length > 0) {
    const lastSyncIso = getSafeStorageItem(MASS_LAST_SYNC_KEY);
    if (lastSyncIso) {
      const lastSyncMs = Date.parse(lastSyncIso);
      if (!isNaN(lastSyncMs) && now - lastSyncMs < SMART_SYNC_COOLDOWN_MS) {
        return cached;
      }
    }
  }

  if (mode === 'full' && cached.length > 0) {
    const lastFullTs = Number(getSafeStorageItem(MASS_FULL_SYNC_TS_KEY) || '0');
    if (lastFullTs > 0 && now - lastFullTs < FULL_15D_COOLDOWN_MS) {
      return cached;
    }
  }

  if (inFlightMassSync) {
    return inFlightMassSync;
  }

  inFlightMassSync = (async () => {
    try {
      const lastSyncIso = getSafeStorageItem(MASS_LAST_SYNC_KEY);
      const lastSyncMs = lastSyncIso ? Date.parse(lastSyncIso) : NaN;
      const hasValidDeltaCursor =
        mode === 'smart' && cached.length > 0 && !isNaN(lastSyncMs) && lastSyncMs > 0;

      let q;
      if (mode === 'full') {
        q = query(collection(db, 'mass_reports'), orderBy('createdAt', 'desc'), limit(120));
      } else if (hasValidDeltaCursor) {
        const deltaCursorIso = new Date(Math.max(now - FIFTEEN_DAYS_MS, lastSyncMs - 2 * 60 * 1000)).toISOString();
        q = query(
          collection(db, 'mass_reports'),
          where('updatedAt', '>=', deltaCursorIso),
          orderBy('updatedAt', 'desc'),
          limit(40)
        );
      } else if (mode === 'today') {
        const recent24hIso = new Date(now - TWENTY_FOUR_HOURS_MS).toISOString();
        q = query(
          collection(db, 'mass_reports'),
          where('createdAt', '>=', recent24hIso),
          orderBy('createdAt', 'desc'),
          limit(50)
        );
      } else {
        q = query(
          collection(db, 'mass_reports'),
          where('dateInput', 'in', getTodayDateCandidates()),
          limit(40)
        );
      }

      const snapshot = await getDocs(q);
      clearQuotaExceeded();
      const currentNow = Date.now();
      const cutoff = currentNow - FIFTEEN_DAYS_MS;
      const list: StoredMassReport[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Omit<StoredMassReport, 'id'>;
        const cTime = data.createdAt ? new Date(data.createdAt).getTime() : currentNow;
        if (cTime >= cutoff && (!data.expiresAt || data.expiresAt > currentNow)) {
          list.push({ id: docSnap.id, ...data });
        }
      });

      const merged = mergeMassReports(getCachedMassReports(), list).filter((r) => {
        const cTime = r.createdAt ? new Date(r.createdAt).getTime() : currentNow;
        return cTime >= cutoff && (!r.expiresAt || r.expiresAt > currentNow);
      });
      saveCachedMassReports(merged, true);
      setSafeStorageItem(MASS_LAST_SYNC_KEY, new Date(currentNow).toISOString());
      if (mode === 'full') {
        setSafeStorageItem(MASS_FULL_SYNC_TS_KEY, String(currentNow));
      }
      massReportSubscribers.forEach((cb) => cb(merged));
      return merged;
    } catch (err: any) {
      console.warn('syncMassReportsFromCloud warning:', err);
      if (err?.code === 'resource-exhausted' || err?.message?.includes('Quota exceeded')) {
        notifyQuotaExceeded();
      }
      return getCachedMassReports();
    } finally {
      inFlightMassSync = null;
    }
  })();

  return inFlightMassSync;
}

let flightReportsSnapshotUnsub: (() => void) | null = null;
let flightRealtimeRefCount = 0;
let massReportsSnapshotUnsub: (() => void) | null = null;
let massRealtimeRefCount = 0;

// Cross-tab synchronization via storage event (0ms instantaneous updates across tabs)
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === CACHED_FLIGHT_REPORTS_KEY) {
      const updated = getCachedFlightReports();
      flightReportSubscribers.forEach((cb) => cb(updated));
    } else if (e.key === CACHED_MASS_REPORTS_KEY) {
      const updated = getCachedMassReports();
      massReportSubscribers.forEach((cb) => cb(updated));
    } else if (e.key === CACHED_SYSTEM_NOTICE_KEY) {
      try {
        const parsed = e.newValue ? (JSON.parse(e.newValue) as SystemNoticeDoc | null) : null;
        systemNoticeSubscribers.forEach((cb) => cb(parsed));
      } catch {
        // ignore parse failure
      }
    }
  });
}

// Lightweight delta-only onSnapshot listener (only attached when Admin views live dashboard)
export function ensureFlightReportsSnapshotListener(): void {
  if (flightReportsSnapshotUnsub) return;
  try {
    const startDeltaIso = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const q = query(
      collection(db, 'flight_reports'),
      where('updatedAt', '>=', startDeltaIso),
      orderBy('updatedAt', 'desc'),
      limit(50)
    );

    flightReportsSnapshotUnsub = onSnapshot(
      q,
      (snapshot) => {
        clearQuotaExceeded();
        const currentNow = Date.now();
        const cutoff = currentNow - FIFTEEN_DAYS_MS;
        const incoming: StoredFlightReport[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as Omit<StoredFlightReport, 'id'>;
          const cTime = data.createdAt ? new Date(data.createdAt).getTime() : currentNow;
          if (cTime >= cutoff && (!data.expiresAt || data.expiresAt > currentNow)) {
            incoming.push({ id: docSnap.id, ...data });
          }
        });
        if (incoming.length > 0) {
          const merged = mergeFlightReports(getCachedFlightReports(), incoming).filter((r) => {
            const cTime = r.createdAt ? new Date(r.createdAt).getTime() : currentNow;
            return cTime >= cutoff && (!r.expiresAt || r.expiresAt > currentNow);
          });
          saveCachedFlightReports(merged, true);
          setSafeStorageItem(FLIGHT_LAST_SYNC_KEY, new Date(currentNow).toISOString());
          flightReportSubscribers.forEach((cb) => cb(merged));
        }
      },
      (err: any) => {
        console.warn('Real-time flight_reports onSnapshot warning:', err);
        flightReportsSnapshotUnsub = null;
        if (err?.code === 'resource-exhausted' || err?.message?.includes('Quota exceeded')) {
          notifyQuotaExceeded();
        }
      }
    );
  } catch (e) {
    console.warn('Failed to attach flight_reports onSnapshot:', e);
  }
}

export function ensureMassReportsSnapshotListener(): void {
  if (massReportsSnapshotUnsub) return;
  try {
    const startDeltaIso = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const q = query(
      collection(db, 'mass_reports'),
      where('updatedAt', '>=', startDeltaIso),
      orderBy('updatedAt', 'desc'),
      limit(50)
    );

    massReportsSnapshotUnsub = onSnapshot(
      q,
      (snapshot) => {
        clearQuotaExceeded();
        const currentNow = Date.now();
        const cutoff = currentNow - FIFTEEN_DAYS_MS;
        const incoming: StoredMassReport[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as Omit<StoredMassReport, 'id'>;
          const cTime = data.createdAt ? new Date(data.createdAt).getTime() : currentNow;
          if (cTime >= cutoff && (!data.expiresAt || data.expiresAt > currentNow)) {
            incoming.push({ id: docSnap.id, ...data });
          }
        });
        if (incoming.length > 0) {
          const merged = mergeMassReports(getCachedMassReports(), incoming).filter((r) => {
            const cTime = r.createdAt ? new Date(r.createdAt).getTime() : currentNow;
            return cTime >= cutoff && (!r.expiresAt || r.expiresAt > currentNow);
          });
          saveCachedMassReports(merged, true);
          setSafeStorageItem(MASS_LAST_SYNC_KEY, new Date(currentNow).toISOString());
          massReportSubscribers.forEach((cb) => cb(merged));
        }
      },
      (err: any) => {
        console.warn('Real-time mass_reports onSnapshot warning:', err);
        massReportsSnapshotUnsub = null;
        if (err?.code === 'resource-exhausted' || err?.message?.includes('Quota exceeded')) {
          notifyQuotaExceeded();
        }
      }
    );
  } catch (e) {
    console.warn('Failed to attach mass_reports onSnapshot:', e);
  }
}

// Date format normalizer to ISO (YYYY-MM-DD)
export function normalizeDateToIso(d?: string | null): string {
  if (!d) return '';
  const trimmed = d.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }
  const ymdMatch = trimmed.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = ymdMatch[2].padStart(2, '0');
    const day = ymdMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return '';
}

// Subscribe to Flight Reports:
// - Serves instantly from localStorage (0 reads)
// - Only attaches delta-only live onSnapshot when { realtime: true } (Admin pages)
export function subscribeToFlightReports(
  callback: (reports: StoredFlightReport[]) => void,
  options?: { realtime?: boolean }
) {
  flightReportSubscribers.add(callback);

  const now = Date.now();
  const fifteenDaysCutoff = now - FIFTEEN_DAYS_MS;

  const cached = getCachedFlightReports().filter((r) => {
    const cTime = r.createdAt ? new Date(r.createdAt).getTime() : now;
    return cTime >= fifteenDaysCutoff && (!r.expiresAt || r.expiresAt > now);
  });
  callback(cached);

  const wantsRealtime = Boolean(options?.realtime);
  if (wantsRealtime) {
    flightRealtimeRefCount += 1;
    ensureFlightReportsSnapshotListener();
  }

  return () => {
    flightReportSubscribers.delete(callback);
    if (wantsRealtime) {
      flightRealtimeRefCount = Math.max(0, flightRealtimeRefCount - 1);
      if (flightRealtimeRefCount === 0 && flightReportsSnapshotUnsub) {
        flightReportsSnapshotUnsub();
        flightReportsSnapshotUnsub = null;
      }
    }
  };
}

// Subscribe to MASS Reports:
// - Serves instantly from localStorage (0 reads)
// - Only attaches delta-only live onSnapshot when { realtime: true } (Admin SAVED MAAS page)
export function subscribeToMassReports(
  callback: (reports: StoredMassReport[]) => void,
  options?: { realtime?: boolean }
) {
  massReportSubscribers.add(callback);

  const now = Date.now();
  const fifteenDaysCutoff = now - FIFTEEN_DAYS_MS;

  const cached = getCachedMassReports().filter((r) => {
    const cTime = r.createdAt ? new Date(r.createdAt).getTime() : now;
    return cTime >= fifteenDaysCutoff && (!r.expiresAt || r.expiresAt > now);
  });
  callback(cached);

  const wantsRealtime = Boolean(options?.realtime);
  if (wantsRealtime) {
    massRealtimeRefCount += 1;
    ensureMassReportsSnapshotListener();
  }

  return () => {
    massReportSubscribers.delete(callback);
    if (wantsRealtime) {
      massRealtimeRefCount = Math.max(0, massRealtimeRefCount - 1);
      if (massRealtimeRefCount === 0 && massReportsSnapshotUnsub) {
        massReportsSnapshotUnsub();
        massReportsSnapshotUnsub = null;
      }
    }
  };
}

let cachedActivityLogs: ActivityLogEntry[] = [];
let lastActivityLogsFetchTs = 0;
const ACTIVITY_LOGS_COOLDOWN_MS = 60 * 1000;

// One-shot Activity Logs fetch (no background listener; capped at 50 entries with 60s cache)
export async function fetchActivityLogsOnce(force = false): Promise<ActivityLogEntry[]> {
  const now = Date.now();
  if (!force && cachedActivityLogs.length > 0 && now - lastActivityLogsFetchTs < ACTIVITY_LOGS_COOLDOWN_MS) {
    return cachedActivityLogs;
  }
  try {
    const q = query(collection(db, 'activity_logs'), orderBy('timestamp', 'desc'), limit(50));
    const snapshot = await getDocs(q);
    clearQuotaExceeded();
    const list: ActivityLogEntry[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as Omit<ActivityLogEntry, 'id'>;
      list.push({ id: docSnap.id, ...data });
    });
    cachedActivityLogs = list;
    lastActivityLogsFetchTs = Date.now();
    activityLogSubscribers.forEach((cb) => cb(list));
    return list;
  } catch (err: any) {
    console.warn('Warning fetching activity_logs:', err);
    if (err?.code === 'resource-exhausted' || err?.message?.includes('Quota exceeded')) {
      notifyQuotaExceeded();
    }
    return cachedActivityLogs;
  }
}

export function subscribeToActivityLogs(
  callback: (logs: ActivityLogEntry[]) => void
) {
  activityLogSubscribers.add(callback);
  if (cachedActivityLogs.length > 0) {
    callback(cachedActivityLogs);
  }
  fetchActivityLogsOnce(false).catch(() => {});
  return () => {
    activityLogSubscribers.delete(callback);
  };
}

function getCachedSystemNotice(): SystemNoticeDoc | null {
  try {
    const raw = localStorage.getItem(CACHED_SYSTEM_NOTICE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

let systemNoticeSnapshotUnsub: (() => void) | null = null;

function ensureSystemNoticeSnapshotListener(): void {
  if (systemNoticeSnapshotUnsub) return;
  try {
    systemNoticeSnapshotUnsub = onSnapshot(
      doc(db, 'system_notices', 'current_notice'),
      (docSnap) => {
        clearQuotaExceeded();
        const notice = docSnap.exists()
          ? ({ id: docSnap.id, ...(docSnap.data() as Omit<SystemNoticeDoc, 'id'>) } as SystemNoticeDoc)
          : null;
        setSafeStorageItem(CACHED_SYSTEM_NOTICE_KEY, JSON.stringify(notice));
        setSafeStorageItem(NOTICE_LAST_CHECK_TS_KEY, String(Date.now()));
        systemNoticeSubscribers.forEach((cb) => cb(notice));
      },
      (err: any) => {
        console.warn('Real-time system_notices onSnapshot warning:', err);
        systemNoticeSnapshotUnsub = null;
        if (err?.code === 'resource-exhausted' || err?.message?.includes('Quota exceeded')) {
          notifyQuotaExceeded();
        }
      }
    );
  } catch (e) {
    console.warn('Failed to attach system_notices onSnapshot:', e);
    systemNoticeSnapshotUnsub = null;
  }
}

export async function refreshSystemNoticeFromCloud(force = true): Promise<SystemNoticeDoc | null> {
  if (!force && systemNoticeSnapshotUnsub) {
    return getCachedSystemNotice();
  }
  const now = Date.now();
  const lastCheckTs = Number(getSafeStorageItem(NOTICE_LAST_CHECK_TS_KEY) || '0');
  if (!force && lastCheckTs > 0 && now - lastCheckTs < NOTICE_CHECK_COOLDOWN_MS) {
    return getCachedSystemNotice();
  }
  try {
    const docSnap = await getDoc(doc(db, 'system_notices', 'current_notice'));
    clearQuotaExceeded();
    const notice = docSnap.exists()
      ? ({ id: docSnap.id, ...(docSnap.data() as Omit<SystemNoticeDoc, 'id'>) } as SystemNoticeDoc)
      : null;
    setSafeStorageItem(CACHED_SYSTEM_NOTICE_KEY, JSON.stringify(notice));
    setSafeStorageItem(NOTICE_LAST_CHECK_TS_KEY, String(Date.now()));
    systemNoticeSubscribers.forEach((cb) => cb(notice));
    if (systemNoticeSubscribers.size > 0 && !systemNoticeSnapshotUnsub) {
      ensureSystemNoticeSnapshotListener();
    }
    return notice;
  } catch (err: any) {
    console.warn('Warning refreshing system_notices:', err);
    if (err?.code === 'resource-exhausted' || err?.message?.includes('Quota exceeded')) {
      notifyQuotaExceeded();
    }
    return getCachedSystemNotice();
  }
}

// Live 1-document real-time listener exclusively for Super Admin Notice popups (~1 read/login + ~1 read/notice)
export function subscribeToSystemNotice(
  callback: (notice: SystemNoticeDoc | null) => void
) {
  systemNoticeSubscribers.add(callback);
  callback(getCachedSystemNotice());
  ensureSystemNoticeSnapshotListener();

  return () => {
    systemNoticeSubscribers.delete(callback);
    if (systemNoticeSubscribers.size === 0 && systemNoticeSnapshotUnsub) {
      systemNoticeSnapshotUnsub();
      systemNoticeSnapshotUnsub = null;
    }
  };
}
