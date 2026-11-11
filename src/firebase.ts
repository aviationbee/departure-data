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
export function notifyQuotaExceeded(): void {
  if (quotaExceededNotified) return;
  quotaExceededNotified = true;
  console.warn(
    'Firestore Quota Exceeded: Daily free read units reached. Serving reports from local persistent cache until quota resets.'
  );
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

  // 2. Persist to Cloud Firestore
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
): Promise<void> {
  const now = Date.now();
  const createdAt = new Date(now).toISOString();
  try {
    await setDoc(doc(db, 'system_notices', 'current_notice'), {
      message: message.trim().toUpperCase(),
      active,
      createdAt,
      timestamp: now,
      createdBy: createdBy.toUpperCase(),
    });
  } catch (err) {
    console.warn('Firestore circulateAdminNotice warning:', err);
  }
}

// Subscribe to Flight Reports in real-time (filtered from latest flight generate/today to last 15 days)
export function subscribeToFlightReports(
  callback: (reports: StoredFlightReport[]) => void
) {
  flightReportSubscribers.add(callback);

  const now = Date.now();
  const fifteenDaysCutoff = now - FIFTEEN_DAYS_MS;

  // 1. Immediately emit cached reports from localStorage (within last 15 days)
  const cached = getCachedFlightReports().filter((r) => {
    const cTime = r.createdAt ? new Date(r.createdAt).getTime() : now;
    return cTime >= fifteenDaysCutoff && (!r.expiresAt || r.expiresAt > now);
  });
  if (cached.length > 0) {
    callback(cached);
  }

  // 2. Attach Firestore live onSnapshot listener
  const q = query(collection(db, 'flight_reports'), orderBy('createdAt', 'desc'));
  const unsub = onSnapshot(
    q,
    (snapshot) => {
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
      callback(merged);
    },
    (err: any) => {
      console.warn('Warning subscribing to flight_reports:', err);
      if (err?.code === 'resource-exhausted' || err?.message?.includes('Quota exceeded')) {
        notifyQuotaExceeded();
      }
      // Fallback to local storage cache so reports are never empty
      const fallback = getCachedFlightReports().filter((r) => {
        const cTime = r.createdAt ? new Date(r.createdAt).getTime() : Date.now();
        return cTime >= Date.now() - FIFTEEN_DAYS_MS && (!r.expiresAt || r.expiresAt > Date.now());
      });
      if (fallback.length > 0) {
        callback(fallback);
      }
    }
  );
  return () => {
    flightReportSubscribers.delete(callback);
    unsub();
  };
}

// Subscribe to MASS Reports in real-time (filtered from latest generate/today to last 15 days)
export function subscribeToMassReports(
  callback: (reports: StoredMassReport[]) => void
) {
  massReportSubscribers.add(callback);

  const now = Date.now();
  const fifteenDaysCutoff = now - FIFTEEN_DAYS_MS;

  // 1. Immediately emit cached reports from localStorage (within last 15 days)
  const cached = getCachedMassReports().filter((r) => {
    const cTime = r.createdAt ? new Date(r.createdAt).getTime() : now;
    return cTime >= fifteenDaysCutoff && (!r.expiresAt || r.expiresAt > now);
  });
  if (cached.length > 0) {
    callback(cached);
  }

  const q = query(collection(db, 'mass_reports'), orderBy('createdAt', 'desc'));
  const unsub = onSnapshot(
    q,
    (snapshot) => {
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
      callback(merged);
    },
    (err: any) => {
      console.warn('Warning subscribing to mass_reports:', err);
      if (err?.code === 'resource-exhausted' || err?.message?.includes('Quota exceeded')) {
        notifyQuotaExceeded();
      }
      const fallback = getCachedMassReports().filter((r) => {
        const cTime = r.createdAt ? new Date(r.createdAt).getTime() : Date.now();
        return cTime >= Date.now() - FIFTEEN_DAYS_MS && (!r.expiresAt || r.expiresAt > Date.now());
      });
      if (fallback.length > 0) {
        callback(fallback);
      }
    }
  );
  return () => {
    massReportSubscribers.delete(callback);
    unsub();
  };
}

// Subscribe to Activity Logs in real-time
export function subscribeToActivityLogs(
  callback: (logs: ActivityLogEntry[]) => void
) {
  activityLogSubscribers.add(callback);
  const q = query(
    collection(db, 'activity_logs'),
    orderBy('timestamp', 'desc'),
    limit(500)
  );
  const unsub = onSnapshot(
    q,
    (snapshot) => {
      const list: ActivityLogEntry[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Omit<ActivityLogEntry, 'id'>;
        list.push({ id: docSnap.id, ...data });
      });
      callback(list);
    },
    (err) => {
      console.warn('Warning subscribing to activity_logs:', err);
    }
  );
  return () => {
    activityLogSubscribers.delete(callback);
    unsub();
  };
}

// Subscribe to Active System Notice in real-time
export function subscribeToSystemNotice(
  callback: (notice: SystemNoticeDoc | null) => void
) {
  systemNoticeSubscribers.add(callback);
  const unsub = onSnapshot(
    doc(db, 'system_notices', 'current_notice'),
    (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as Omit<SystemNoticeDoc, 'id'>;
        callback({ id: docSnap.id, ...data });
      } else {
        callback(null);
      }
    },
    (err) => {
      console.warn('Warning subscribing to system_notices:', err);
    }
  );
  return () => {
    systemNoticeSubscribers.delete(callback);
    unsub();
  };
}
