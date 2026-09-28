import { initializeApp } from 'firebase/app';
import {
  initializeFirestore,
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

// Initialize Firebase App & Cloud Firestore (asia-southeast1) with auto long-polling detection for airport/mobile networks
const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(
  app,
  { experimentalAutoDetectLongPolling: true },
  firebaseConfig.firestoreDatabaseId
);

// Active subscriber registries for instant activity-based sync without page reload
const flightReportSubscribers = new Set<(reports: StoredFlightReport[]) => void>();
const activityLogSubscribers = new Set<(logs: ActivityLogEntry[]) => void>();
const systemNoticeSubscribers = new Set<(notice: SystemNoticeDoc | null) => void>();

let lastActivitySyncTime = 0;

// Actively pull latest updates from Firestore on any user activity (without refreshing page or logging out)
export async function syncRealtimeDataOnActivity(force = false): Promise<void> {
  const now = Date.now();
  if (!force && now - lastActivitySyncTime < 1500) return;
  lastActivitySyncTime = now;

  try {
    // 1. Always sync active System Notice so popup appears immediately on any user activity
    if (systemNoticeSubscribers.size > 0) {
      const noticeSnap = await getDoc(doc(db, 'system_notices', 'current_notice'));
      const noticeData = noticeSnap.exists()
        ? ({ id: noticeSnap.id, ...(noticeSnap.data() as Omit<SystemNoticeDoc, 'id'>) } as SystemNoticeDoc)
        : null;
      systemNoticeSubscribers.forEach((cb) => cb(noticeData));
    }

    // 2. Sync Flight Reports if Admin Dashboard is active
    if (flightReportSubscribers.size > 0) {
      const qReports = query(collection(db, 'flight_reports'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(qReports);
      const list: StoredFlightReport[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data() as Omit<StoredFlightReport, 'id'>;
        if (!data.expiresAt || data.expiresAt > now) {
          list.push({ id: docSnap.id, ...data });
        }
      });
      flightReportSubscribers.forEach((cb) => cb(list));
    }

    // 3. Sync Activity Logs if Super Admin Log Check is active
    if (activityLogSubscribers.size > 0) {
      const qLogs = query(collection(db, 'activity_logs'), orderBy('timestamp', 'desc'), limit(500));
      const snap = await getDocs(qLogs);
      const list: ActivityLogEntry[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data() as Omit<ActivityLogEntry, 'id'>;
        list.push({ id: docSnap.id, ...data });
      });
      activityLogSubscribers.forEach((cb) => cb(list));
    }
  } catch (err) {
    // Silent catch on transient network hiccups
  }
}

// Storage start date (previous dates before today are hidden in Admin calendar)
export const STORAGE_START_DATE = '2026-09-28';

// 90 Days in milliseconds
export const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

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
  rawFormData?: FlightFormData;
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
  createdAt: string;
  expiresAt: number;
}

// Save Flight Report to Firestore (preserved for 90 days)
export async function saveFlightReportToCloud(
  formData: FlightFormData,
  userInfo: UserInfo
): Promise<void> {
  const station = (userInfo.stationName || 'DAC').trim().toUpperCase();
  const date = formData.date || new Date().toISOString().split('T')[0];
  const flightNo = `BS-${(formData.flightNoSuffix || '000').trim().toUpperCase()}`;
  const docId = `${station}_${date}_${flightNo.replace(/[^A-Z0-9]/g, '')}`;
  const now = Date.now();
  const createdAt = new Date(now).toISOString();
  const expiresAt = now + NINETY_DAYS_MS;

  const payload: Omit<StoredFlightReport, 'id'> = {
    station,
    date,
    flightNo,
    route: formData.route || '',
    acReg: formData.acRegSuffix ? `S2-${formData.acRegSuffix}` : '',
    acType: formData.acType || '',
    captain: formData.captain || '',
    configure: formData.configure || '',
    sta: formData.sta || '',
    chocksOn: formData.chocksOn || '',
    doorOpen: formData.doorOpen || '',
    arrivalStatus: formData.arrivalStatus || '',
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

  try {
    await setDoc(doc(db, 'flight_reports', docId), payload);
  } catch (err) {
    console.error('Firestore saveFlightReportToCloud error:', err);
  }
}

export async function deleteFlightReportFromCloud(
  report: StoredFlightReport,
  actorUser: UserInfo
): Promise<void> {
  try {
    await deleteDoc(doc(db, 'flight_reports', report.id));
    await logUserActivity(
      'FLIGHT REPORT DELETED',
      `Deleted Flight ${report.flightNo} (${report.route}) of ${report.date} [Station: ${report.station}]`,
      actorUser
    );
  } catch (err) {
    console.error('Firestore deleteFlightReportFromCloud error:', err);
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
  },
  userInfo: UserInfo
): Promise<void> {
  const station = (userInfo.stationName || 'DAC').trim().toUpperCase();
  const now = Date.now();
  const createdAt = new Date(now).toISOString();
  const expiresAt = now + NINETY_DAYS_MS;
  const docId = `${station}_${item.id}`;

  try {
    await setDoc(doc(db, 'mass_reports', docId), {
      station,
      dateInput: item.dateInput,
      flightNoInput: item.flightNoInput,
      destInput: item.destInput,
      categoryInput: item.categoryInput,
      flstText: item.flstText,
      preparedBy: userInfo.userName || 'OFFICER',
      usbaId: userInfo.usbaId || '',
      createdAt,
      expiresAt,
    });
  } catch (err) {
    console.error('Firestore saveMassReportToCloud error:', err);
  }
}

export async function deleteMassReportFromCloud(
  docId: string,
  flightNoInput: string,
  dateInput: string,
  userInfo: UserInfo
): Promise<void> {
  try {
    await deleteDoc(doc(db, 'mass_reports', docId));
    await logUserActivity(
      'MASS REPORT DELETED',
      `Deleted MASS Report BS-${flightNoInput} (${dateInput})`,
      userInfo
    );
  } catch (err) {
    console.error('Firestore deleteMassReportFromCloud error:', err);
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
  } catch (err) {
    console.error('Firestore logUserActivity error:', err);
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
    console.error('Firestore circulateAdminNotice error:', err);
  }
}

// Subscribe to Flight Reports in real-time (filtered to 90 days)
export function subscribeToFlightReports(
  callback: (reports: StoredFlightReport[]) => void
) {
  flightReportSubscribers.add(callback);
  const q = query(collection(db, 'flight_reports'), orderBy('createdAt', 'desc'));
  const unsub = onSnapshot(
    q,
    (snapshot) => {
      const now = Date.now();
      const list: StoredFlightReport[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Omit<StoredFlightReport, 'id'>;
        if (!data.expiresAt || data.expiresAt > now) {
          list.push({ id: docSnap.id, ...data });
        }
      });
      callback(list);
    },
    (err) => {
      console.error('Error subscribing to flight_reports:', err);
    }
  );
  return () => {
    flightReportSubscribers.delete(callback);
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
      console.error('Error subscribing to activity_logs:', err);
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
      console.error('Error subscribing to system_notices:', err);
    }
  );
  return () => {
    systemNoticeSubscribers.delete(callback);
    unsub();
  };
}
