import React, { useState, useEffect } from 'react';
import { UserInfo, PageMode, FlightFormData } from '../types';
import {
  StoredFlightReport,
  ActivityLogEntry,
  SystemNoticeDoc,
  STORAGE_START_DATE,
  subscribeToFlightReports,
  subscribeToActivityLogs,
  subscribeToSystemNotice,
  circulateAdminNotice,
  deleteFlightReportFromCloud,
  logUserActivity,
} from '../firebase';
import {
  ShieldCheck,
  Lock,
  ArrowLeft,
  Navigation,
  LogOut,
  Download,
  Calendar,
  Megaphone,
  Activity,
  Trash2,
  Eye,
  Plane,
  CheckCircle,
  XCircle,
  Search,
  Building2,
} from 'lucide-react';

interface Props {
  currentPage: PageMode;
  setCurrentPage: (page: PageMode) => void;
  onPrevious: () => void;
  onDashboard: () => void;
  onLogout: () => void;
  userInfo: UserInfo;
  showToast: (msg: string) => void;
  onLoadFlightReport?: (formData: FlightFormData) => void;
}

const STATION_ADMIN_PASSWORDS: Record<string, string> = {
  DAC: 'dac307',
  CXB: 'cxb141',
  CGP: 'cgp102',
  JSR: 'jsr122',
  RJH: 'rjh162',
  SPD: 'spd192',
  BZL: 'bzl172',
  ZYL: 'zyl542',
};

const SUPER_ADMIN_PASSWORD = '11126';

export const AdminModule: React.FC<Props> = ({
  currentPage,
  setCurrentPage,
  onPrevious,
  onDashboard,
  onLogout,
  userInfo,
  showToast,
  onLoadFlightReport,
}) => {
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [adminRole, setAdminRole] = useState<'super' | 'station' | null>(() => {
    return (sessionStorage.getItem('usba_admin_role') as 'super' | 'station' | null) || null;
  });
  const [authorizedStation, setAuthorizedStation] = useState<string>(() => {
    return sessionStorage.getItem('usba_admin_station') || userInfo.stationName || 'DAC';
  });

  const todayStr = new Date().toISOString().split('T')[0];
  const initialDate = todayStr < STORAGE_START_DATE ? STORAGE_START_DATE : todayStr;
  const [selectedDate, setSelectedDate] = useState<string>(initialDate);
  const [showAllDates, setShowAllDates] = useState<boolean>(false);
  const [selectedStationFilter, setSelectedStationFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [flightReports, setFlightReports] = useState<StoredFlightReport[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([]);
  const [currentNotice, setCurrentNotice] = useState<SystemNoticeDoc | null>(null);
  const [noticeInput, setNoticeInput] = useState<string>('');
  const [logStationFilter, setLogStationFilter] = useState<string>('ALL');

  // Real-time Firestore subscriptions
  useEffect(() => {
    const unsubReports = subscribeToFlightReports((reports) => {
      setFlightReports(reports);
    });
    const unsubNotice = subscribeToSystemNotice((notice) => {
      setCurrentNotice(notice);
    });
    const unsubLogs = subscribeToActivityLogs((logs) => {
      setActivityLogs(logs);
    });
    return () => {
      unsubReports();
      unsubNotice();
      unsubLogs();
    };
  }, []);

  const handleAdminPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    const rawPass = passwordInput.trim();
    const userStation = (userInfo.stationName || 'DAC').trim().toUpperCase();

    if (!rawPass) {
      setLoginError('PLEASE INPUT ADMIN PASSWORD');
      return;
    }

    // 1. Check Super Admin Password (11126)
    if (rawPass === SUPER_ADMIN_PASSWORD) {
      setAdminRole('super');
      setAuthorizedStation('ALL');
      setSelectedStationFilter('ALL');
      sessionStorage.setItem('usba_admin_role', 'super');
      sessionStorage.setItem('usba_admin_station', 'ALL');
      setPasswordInput('');
      await logUserActivity('SUPER ADMIN LOG IN', 'Accessed Super Admin Portal', userInfo);
      showToast('SUPER ADMIN ACCESS GRANTED');
      setCurrentPage('admin-dashboard');
      return;
    }

    // 2. Check Station-Specific Password for the logged-in user's station
    const expectedStationPass = STATION_ADMIN_PASSWORDS[userStation];
    if (expectedStationPass && rawPass.toLowerCase() === expectedStationPass.toLowerCase()) {
      setAdminRole('station');
      setAuthorizedStation(userStation);
      setSelectedStationFilter(userStation);
      sessionStorage.setItem('usba_admin_role', 'station');
      sessionStorage.setItem('usba_admin_station', userStation);
      setPasswordInput('');
      await logUserActivity(
        'STATION ADMIN LOG IN',
        `Accessed ${userStation} Station Admin Portal`,
        userInfo
      );
      showToast(`${userStation} STATION ADMIN ACCESS GRANTED`);
      setCurrentPage('admin-dashboard');
      return;
    }

    // Check if user entered another station's password while logged into a different station
    const matchedOtherStation = Object.entries(STATION_ADMIN_PASSWORDS).find(
      ([, pass]) => pass.toLowerCase() === rawPass.toLowerCase()
    );
    if (matchedOtherStation && matchedOtherStation[0] !== userStation) {
      await logUserActivity(
        'UNAUTHORIZED ADMIN ACCESS ATTEMPT',
        `Officer at Station ${userStation} tried to access ${matchedOtherStation[0]} Station Admin Portal (Cross-Station Access Denied)`,
        userInfo
      );
      setLoginError(
        `ACCESS DENIED! YOU ARE LOGGED IN FROM ${userStation}. ONE STATION CANNOT VIEW ANOTHER STATION'S REPORT.`
      );
      return;
    }

    await logUserActivity(
      'UNAUTHORIZED ADMIN ACCESS ATTEMPT',
      `Failed Admin login attempt from Station ${userStation} with invalid password ("${rawPass}")`,
      userInfo
    );
    setLoginError('INVALID ADMIN PASSWORD! PLEASE CHECK AND TRY AGAIN.');
  };

  // Filter Flight Reports based on Role, Station, Date (>= STORAGE_START_DATE), and Search
  const filteredReports = flightReports.filter((r) => {
    // Hide any record prior to STORAGE_START_DATE
    if (r.date < STORAGE_START_DATE) return false;

    // Station Isolation
    if (adminRole === 'station') {
      if (r.station.toUpperCase() !== authorizedStation.toUpperCase()) return false;
    } else if (adminRole === 'super') {
      if (selectedStationFilter !== 'ALL' && r.station.toUpperCase() !== selectedStationFilter) {
        return false;
      }
    }

    // Date filter
    if (!showAllDates && selectedDate) {
      if (r.date !== selectedDate) return false;
    }

    // Search query
    if (searchQuery.trim() !== '') {
      const q = searchQuery.trim().toUpperCase();
      const matchFlight = r.flightNo.toUpperCase().includes(q);
      const matchRoute = r.route.toUpperCase().includes(q);
      const matchReg = r.acReg.toUpperCase().includes(q);
      const matchCapt = r.captain.toUpperCase().includes(q);
      const matchUser = r.preparedBy.toUpperCase().includes(q);
      if (!matchFlight && !matchRoute && !matchReg && !matchCapt && !matchUser) return false;
    }

    return true;
  });

  // Calculate Full-Day Totals
  const totalFlights = filteredReports.length;
  const totalPax = filteredReports.reduce((sum, r) => sum + (parseInt(r.paxTotal, 10) || 0), 0);
  const totalBagKg = filteredReports.reduce(
    (sum, r) => sum + (parseInt(r.baggageWeight, 10) || 0),
    0
  );
  const totalBagPcs = filteredReports.reduce(
    (sum, r) => sum + (parseInt(r.baggagePcs, 10) || 0),
    0
  );
  const totalCargoKg = filteredReports.reduce(
    (sum, r) => sum + (parseInt(r.cargoWeight, 10) || 0),
    0
  );
  const totalNoshow = filteredReports.reduce(
    (sum, r) => sum + (parseInt(r.counterNoshow, 10) || 0),
    0
  );

  // Download Flight Reports as Excel (.CSV with UTF-8 BOM)
  const handleDownloadExcel = () => {
    if (filteredReports.length === 0) {
      showToast('NO FLIGHT DATA FOUND TO DOWNLOAD!');
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
      'CARGO WEIGHT (KG)',
      'CARGO PCS',
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
      'REMARKS',
      'REPORT BY',
      'USBA ID',
      'SAVED AT',
    ];

    const escapeCsv = (val: string | number | undefined) => {
      const str = String(val ?? '').replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = filteredReports.map((r) => [
      r.date,
      r.station,
      r.flightNo,
      r.route,
      r.acReg,
      r.acType,
      r.captain,
      r.configure,
      r.sta,
      r.chocksOn,
      r.doorOpen,
      r.arrivalStatus,
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
      r.cargoWeight,
      r.cargoPcs,
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
      r.remarks,
      r.preparedBy,
      `USBA-${r.usbaId}`,
      new Date(r.createdAt).toLocaleString(),
    ]);

    const csvContent =
      '\uFEFF' +
      [headers.map(escapeCsv).join(','), ...rows.map((row) => row.map(escapeCsv).join(','))].join(
        '\r\n'
      );

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const stLabel = adminRole === 'super' ? selectedStationFilter : authorizedStation;
    const dtLabel = showAllDates ? '90DAYS' : selectedDate;
    link.href = url;
    link.setAttribute('download', `USBA_FLIGHT_REPORT_${stLabel}_${dtLabel}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('EXCEL (.CSV) DOWNLOADED SUCCESSFULLY!');
  };

  // Download Activity Logs as Excel
  const handleDownloadLogsExcel = (logsToExport: ActivityLogEntry[]) => {
    if (logsToExport.length === 0) {
      showToast('NO LOGS TO DOWNLOAD!');
      return;
    }
    const headers = ['DATE & TIME', 'STATION', 'USER NAME', 'USBA ID', 'ACTIVITY / ACTION', 'DETAILS'];
    const escapeCsv = (val: string | number | undefined) =>
      `"${String(val ?? '').replace(/"/g, '""')}"`;

    const rows = logsToExport.map((l) => [
      new Date(l.timestamp || l.createdAt).toLocaleString(),
      l.station,
      l.userName,
      `USBA-${l.usbaId}`,
      l.action,
      l.details,
    ]);

    const csvContent =
      '\uFEFF' +
      [headers.map(escapeCsv).join(','), ...rows.map((r) => r.map(escapeCsv).join(','))].join(
        '\r\n'
      );

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `USBA_ACTIVITY_LOGS_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('ACTIVITY LOGS EXCEL DOWNLOADED!');
  };

  const handleCirculateNotice = async () => {
    if (!noticeInput.trim()) {
      showToast('PLEASE TYPE A NOTICE MESSAGE FIRST!');
      return;
    }
    await circulateAdminNotice(noticeInput.trim(), true, userInfo.userName || 'SUPER ADMIN');
    await logUserActivity(
      'NOTICE CIRCULATED',
      `Circulated Notice: "${noticeInput.trim().toUpperCase()}"`,
      userInfo
    );
    setNoticeInput('');
    showToast('ADMIN NOTICE CIRCULATED TO ALL USERS LIVE!');
  };

  const handleClearNotice = async () => {
    await circulateAdminNotice('', false, userInfo.userName || 'SUPER ADMIN');
    showToast('ACTIVE ADMIN NOTICE CLEARED!');
  };

  // ================= 1. ADMIN PASSWORD LOGIN PAGE =================
  if (currentPage === 'admin-login') {
    return (
      <div className="flex-1 flex flex-col justify-center items-center p-4 md:p-6 min-h-screen relative">
        <div className="max-w-md w-full bg-slate-900/90 backdrop-blur-xl p-8 md:p-10 rounded-2xl border border-slate-700/70 border-t-4 border-t-amber-500 border-b-4 border-b-rose-500 shadow-2xl relative z-10 text-white">
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
              onClick={onLogout}
              className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow transition-all uppercase"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>LOG OUT</span>
            </button>
          </div>

          <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border-2 border-amber-400 text-amber-400 flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Lock className="w-8 h-8" />
          </div>

          <div className="text-center mb-6">
            <h2 className="text-2xl font-black tracking-wider text-amber-400 uppercase">
              ADMIN ONLY PORTAL
            </h2>
            <p className="text-xs text-slate-400 font-sans mt-1 uppercase tracking-wider">
              STATION: <span className="text-white font-bold">{userInfo.stationName}</span> &bull; OFFICER:{' '}
              <span className="text-white font-bold">{userInfo.userName}</span>
            </p>
          </div>

          <form onSubmit={handleAdminPasswordSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                ENTER ADMIN / STATION PASSWORD
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                autoFocus
                className="w-full px-4 py-3.5 rounded-xl bg-slate-800/95 text-white border border-slate-600 focus:border-amber-400 focus:outline-none text-center font-black tracking-[0.35em] text-base"
              />
            </div>

            {loginError && (
              <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/50 text-rose-300 text-xs font-bold text-center uppercase tracking-wider">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black tracking-widest text-sm uppercase shadow-xl transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>UNLOCK ADMIN PANEL</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ================= 2. SUPER ADMIN LOG CHECK PAGE =================
  if (currentPage === 'admin-logs') {
    const filteredLogs = activityLogs.filter((l) => {
      if (logStationFilter !== 'ALL' && l.station.toUpperCase() !== logStationFilter) {
        return false;
      }
      return true;
    });

    return (
      <div className="flex-1 p-4 md:p-8 min-h-screen flex flex-col items-center">
        <div className="max-w-7xl w-full bg-slate-900/90 backdrop-blur-xl border border-slate-700/70 shadow-2xl rounded-2xl p-5 md:p-8 text-slate-200">
          {/* Header with Common Top Action Buttons */}
          <div className="flex flex-col md:flex-row justify-between items-center pb-5 mb-6 border-b border-slate-800 gap-4">
            <div>
              <h1 className="text-xl md:text-2xl font-black tracking-wider text-amber-400 uppercase flex items-center gap-2.5">
                <Activity className="w-6 h-6 text-amber-400" />
                <span>SUPER ADMIN &mdash; LOG CHECK (USER ACTIVITIES)</span>
              </h1>
              <p className="text-xs text-slate-400 font-sans mt-1 uppercase tracking-wider">
                REAL-TIME AUDIT TRAIL OF USER LOG IN, LOG OUT, REPORT GENERATION &amp; DELETION
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onPrevious}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer border border-slate-700 uppercase"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>PREVIOUS</span>
              </button>
              <button
                type="button"
                onClick={onDashboard}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow uppercase"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>DASHBOARD</span>
              </button>
              <button
                type="button"
                onClick={onLogout}
                className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow uppercase"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>LOG OUT</span>
              </button>
            </div>
          </div>

          {/* Filter & Export Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5 bg-slate-800/70 p-4 rounded-xl border border-slate-700">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-300 uppercase">STATION FILTER:</span>
              <select
                value={logStationFilter}
                onChange={(e) => setLogStationFilter(e.target.value)}
                className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-xs font-bold uppercase"
              >
                <option value="ALL">ALL STATIONS</option>
                {Object.keys(STATION_ADMIN_PASSWORDS).map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
              <span className="text-xs font-bold text-amber-300 uppercase">
                TOTAL LOGS: {filteredLogs.length}
              </span>
            </div>

            <button
              type="button"
              onClick={() => handleDownloadLogsExcel(filteredLogs)}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-lg uppercase"
            >
              <Download className="w-4 h-4" />
              <span>DOWNLOAD LOGS (EXCEL)</span>
            </button>
          </div>

          {/* Activity Logs Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-700 max-h-[600px] overflow-y-auto">
            <table className="w-full border-collapse text-xs font-sans uppercase">
              <thead>
                <tr className="bg-slate-800 text-amber-300 border-b border-slate-700 sticky top-0">
                  <th className="p-3 text-left font-bold">DATE &amp; TIME</th>
                  <th className="p-3 text-center font-bold">STATION</th>
                  <th className="p-3 text-left font-bold">USER NAME</th>
                  <th className="p-3 text-center font-bold">USBA ID</th>
                  <th className="p-3 text-left font-bold">ACTIVITY / EVENT</th>
                  <th className="p-3 text-left font-bold">DETAILS</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400 font-bold">
                      NO USER ACTIVITY LOGS RECORDED YET.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => {
                    const isDelete =
                      log.action.includes('DELETE') || log.action.includes('UNAUTHORIZED');
                    const isLogin = log.action.includes('LOG IN');
                    const isLogout = log.action.includes('LOG OUT');
                    return (
                      <tr
                        key={log.id}
                        className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors"
                      >
                        <td className="p-3 text-slate-300 font-mono whitespace-nowrap">
                          {new Date(log.timestamp || log.createdAt).toLocaleString()}
                        </td>
                        <td className="p-3 text-center">
                          <span className="px-2.5 py-1 rounded-md bg-amber-500/20 border border-amber-400/40 text-amber-300 font-black">
                            {log.station}
                          </span>
                        </td>
                        <td className="p-3 font-bold text-white">{log.userName}</td>
                        <td className="p-3 text-center font-mono text-indigo-300 font-bold">
                          USBA-{log.usbaId}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2.5 py-1 rounded-md font-black text-[11px] inline-block ${
                              isDelete
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                : isLogin
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : isLogout
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                : 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                            }`}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td className="p-3 text-slate-200 font-semibold">{log.details}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ================= 3. ADMIN DASHBOARD (FULL DAY FLIGHT DATA REPORT) =================
  return (
    <div className="flex-1 p-4 md:p-8 min-h-screen flex flex-col items-center">
      <div className="max-w-7xl w-full bg-slate-900/90 backdrop-blur-xl border border-slate-700/70 shadow-2xl rounded-2xl p-5 md:p-8 text-slate-200">
        {/* Top Header with Common Navigation Buttons */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center pb-5 mb-6 border-b border-slate-800 gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-black tracking-wider uppercase mb-2">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>
                {adminRole === 'super'
                  ? 'SUPER ADMIN PORTAL (ALL STATIONS ACCESS)'
                  : `STATION ADMIN PORTAL — STATION: ${authorizedStation}`}
              </span>
            </div>
            <h1 className="text-xl md:text-2xl font-black tracking-wider text-white uppercase flex items-center gap-2">
              <Plane className="w-6 h-6 text-amber-400" />
              <span>FULL DAY FLIGHT DATA REPORT (90-DAY CLOUD ARCHIVE)</span>
            </h1>
            <p className="text-xs text-slate-400 font-sans mt-0.5 uppercase tracking-wider">
              GOOGLE CLOUD RUN (ASIA-SOUTHEAST1) &bull; GOOGLE CLOUD FIRESTORE REAL-TIME DATABASE
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onPrevious}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer border border-slate-700 uppercase"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>PREVIOUS</span>
            </button>

            <button
              type="button"
              onClick={onDashboard}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow uppercase"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>DASHBOARD</span>
            </button>

            {adminRole === 'super' && (
              <button
                type="button"
                onClick={() => setCurrentPage('admin-logs')}
                className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-lg uppercase"
              >
                <Activity className="w-3.5 h-3.5" />
                <span>LOG CHECK</span>
              </button>
            )}

            <button
              type="button"
              onClick={onLogout}
              className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow uppercase"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>LOG OUT</span>
            </button>
          </div>
        </div>

        {/* SUPER ADMIN ONLY: REAL-TIME NOTICE CIRCULATE BOX */}
        {adminRole === 'super' && (
          <div className="mb-6 p-4 md:p-5 rounded-2xl bg-gradient-to-r from-amber-950/40 via-slate-900 to-rose-950/30 border-2 border-amber-500/60 shadow-xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2 text-amber-400 font-black text-sm uppercase tracking-wider">
                <Megaphone className="w-5 h-5 animate-pulse" />
                <span>SUPER ADMIN NOTICE CIRCULATE BOX (REAL-TIME POPUP TO ALL USERS)</span>
              </div>
              {currentNotice && currentNotice.active && currentNotice.message && (
                <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 text-[11px] font-black flex items-center gap-1.5 uppercase">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>ACTIVE NOTICE LIVE</span>
                </span>
              )}
            </div>

            <div className="flex flex-col md:flex-row gap-3">
              <input
                type="text"
                placeholder="TYPE NOTICE HERE (E.G. PLEASE COMPLEATE YOUR DATA INPUT ASAP)"
                value={noticeInput}
                onChange={(e) => setNoticeInput(e.target.value.toUpperCase())}
                className="flex-1 p-3 rounded-xl bg-slate-800/95 border border-amber-500/50 text-white font-bold text-xs md:text-sm uppercase focus:border-amber-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleCirculateNotice}
                className="px-5 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-black text-xs tracking-wider uppercase cursor-pointer shadow-lg flex items-center justify-center gap-2 whitespace-nowrap"
              >
                <Megaphone className="w-4 h-4" />
                <span>CIRCULATE NOTICE</span>
              </button>
              {currentNotice && currentNotice.active && (
                <button
                  type="button"
                  onClick={handleClearNotice}
                  className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-rose-900/60 text-rose-300 border border-rose-500/40 font-bold text-xs uppercase cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap"
                >
                  <XCircle className="w-4 h-4" />
                  <span>STOP NOTICE</span>
                </button>
              )}
            </div>

            {currentNotice && currentNotice.active && currentNotice.message && (
              <div className="mt-2.5 text-xs text-amber-200 font-sans uppercase">
                CURRENT LIVE NOTICE:{' '}
                <span className="font-black text-white">
                  &ldquo;ADMIN MESSAGE : {currentNotice.message}&rdquo;
                </span>
              </div>
            )}
          </div>
        )}

        {/* Controls Bar: Calendar Date Picker (Min = STORAGE_START_DATE), Station Filter, Search & Excel Export */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 bg-slate-800/70 p-4 rounded-2xl border border-slate-700 font-sans">
          {/* Date Picker (Previous dates before STORAGE_START_DATE hidden/disabled) */}
          <div className="flex flex-col">
            <label className="text-[11px] font-bold text-amber-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              <span>SELECT FLIGHT DATE (FROM {STORAGE_START_DATE})</span>
            </label>
            <div className="flex gap-2">
              <input
                type="date"
                min={STORAGE_START_DATE}
                value={selectedDate}
                disabled={showAllDates}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val < STORAGE_START_DATE) {
                    setSelectedDate(STORAGE_START_DATE);
                  } else {
                    setSelectedDate(val);
                  }
                }}
                className="flex-1 p-2.5 rounded-xl bg-slate-900 border border-slate-600 text-white text-xs font-bold focus:border-amber-400 focus:outline-none disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowAllDates(!showAllDates)}
                className={`px-3 py-2 rounded-xl text-[11px] font-black uppercase border cursor-pointer transition-all ${
                  showAllDates
                    ? 'bg-amber-500 text-slate-950 border-amber-400'
                    : 'bg-slate-900 text-slate-300 border-slate-600 hover:bg-slate-800'
                }`}
              >
                {showAllDates ? 'SINGLE DAY' : 'ALL 90 DAYS'}
              </button>
            </div>
          </div>

          {/* Station Filter (Locked for Station Admin, Selectable for Super Admin) */}
          <div className="flex flex-col">
            <label className="text-[11px] font-bold text-sky-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" />
              <span>STATION ACCESS</span>
            </label>
            {adminRole === 'super' ? (
              <select
                value={selectedStationFilter}
                onChange={(e) => setSelectedStationFilter(e.target.value)}
                className="p-2.5 rounded-xl bg-slate-900 border border-slate-600 text-white text-xs font-bold uppercase focus:border-amber-400 focus:outline-none"
              >
                <option value="ALL">ALL STATIONS (SUPER ADMIN)</option>
                {Object.keys(STATION_ADMIN_PASSWORDS).map((st) => (
                  <option key={st} value={st}>
                    STATION: {st}
                  </option>
                ))}
              </select>
            ) : (
              <div className="p-2.5 rounded-xl bg-slate-900/90 border border-amber-500/40 text-amber-300 text-xs font-black uppercase flex items-center justify-between">
                <span>STATION: {authorizedStation} ONLY</span>
                <Lock className="w-3.5 h-3.5 text-amber-400" />
              </div>
            )}
          </div>

          {/* Search Filter */}
          <div className="flex flex-col">
            <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5" />
              <span>SEARCH FLIGHT / REG / CAPTAIN</span>
            </label>
            <input
              type="text"
              placeholder="E.G. BS-142, AKK, AHMED..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
              className="p-2.5 rounded-xl bg-slate-900 border border-slate-600 text-white text-xs font-bold uppercase focus:border-amber-400 focus:outline-none"
            />
          </div>

          {/* Download Excel Button */}
          <div className="flex flex-col justify-end">
            <button
              type="button"
              onClick={handleDownloadExcel}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs tracking-wider uppercase shadow-lg cursor-pointer flex items-center justify-center gap-2 transition-all"
            >
              <Download className="w-4 h-4" />
              <span>DOWNLOAD EXCEL ({filteredReports.length})</span>
            </button>
          </div>
        </div>

        {/* Full-Day Summary KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6 font-sans">
          <div className="bg-slate-800/90 border border-slate-700 rounded-xl p-3.5 text-center">
            <div className="text-[11px] font-bold text-slate-400 uppercase">TOTAL FLIGHTS</div>
            <div className="text-2xl font-black text-amber-400 mt-1">{totalFlights}</div>
          </div>
          <div className="bg-slate-800/90 border border-slate-700 rounded-xl p-3.5 text-center">
            <div className="text-[11px] font-bold text-slate-400 uppercase">TOTAL PASSENGERS</div>
            <div className="text-2xl font-black text-sky-400 mt-1">{totalPax}</div>
          </div>
          <div className="bg-slate-800/90 border border-slate-700 rounded-xl p-3.5 text-center">
            <div className="text-[11px] font-bold text-slate-400 uppercase">TOTAL BAGGAGE</div>
            <div className="text-lg font-black text-emerald-400 mt-1">
              {totalBagKg} KG / {totalBagPcs} PCS
            </div>
          </div>
          <div className="bg-slate-800/90 border border-slate-700 rounded-xl p-3.5 text-center">
            <div className="text-[11px] font-bold text-slate-400 uppercase">TOTAL CARGO</div>
            <div className="text-lg font-black text-indigo-300 mt-1">{totalCargoKg} KG</div>
          </div>
          <div className="bg-slate-800/90 border border-rose-500/40 rounded-xl p-3.5 text-center">
            <div className="text-[11px] font-bold text-rose-300 uppercase">COUNTER NOSHOW</div>
            <div className="text-2xl font-black text-rose-400 mt-1">{totalNoshow}</div>
          </div>
        </div>

        {/* Flight-Wise Full Day Table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-700 shadow-inner">
          <table className="w-full border-collapse text-xs font-sans uppercase">
            <thead>
              <tr className="bg-slate-800 text-amber-300 border-b border-slate-700">
                <th className="p-3 text-left font-bold whitespace-nowrap">DATE</th>
                <th className="p-3 text-center font-bold whitespace-nowrap">STN</th>
                <th className="p-3 text-left font-bold whitespace-nowrap">FLIGHT</th>
                <th className="p-3 text-left font-bold whitespace-nowrap">ROUTE</th>
                <th className="p-3 text-left font-bold whitespace-nowrap">A/C REG</th>
                <th className="p-3 text-left font-bold whitespace-nowrap">CAPTAIN</th>
                <th className="p-3 text-center font-bold whitespace-nowrap">STD / D/C / C/OFF / A/B</th>
                <th className="p-3 text-left font-bold whitespace-nowrap">DEP STATUS</th>
                <th className="p-3 text-center font-bold whitespace-nowrap">PAX (M/F/C/I)</th>
                <th className="p-3 text-center font-bold whitespace-nowrap">BAG (KG/PCS)</th>
                <th className="p-3 text-center font-bold whitespace-nowrap">NOSHOW &amp; PNR</th>
                <th className="p-3 text-left font-bold whitespace-nowrap">REPORT BY</th>
                <th className="p-3 text-center font-bold whitespace-nowrap">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredReports.length === 0 ? (
                <tr>
                  <td colSpan={13} className="p-8 text-center text-slate-400 font-bold">
                    NO FLIGHT DATA REPORTS FOUND FOR{' '}
                    {showAllDates ? 'THE LAST 90 DAYS' : selectedDate}.
                  </td>
                </tr>
              ) : (
                filteredReports.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-slate-800 hover:bg-slate-800/60 transition-colors"
                  >
                    <td className="p-3 font-mono font-bold text-slate-200 whitespace-nowrap">
                      {r.date}
                    </td>
                    <td className="p-3 text-center">
                      <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400/40 text-amber-300 font-black">
                        {r.station}
                      </span>
                    </td>
                    <td className="p-3 font-black text-sky-300 whitespace-nowrap">{r.flightNo}</td>
                    <td className="p-3 font-bold text-white whitespace-nowrap">{r.route}</td>
                    <td className="p-3 font-bold text-slate-300 whitespace-nowrap">
                      {r.acReg} <span className="text-[10px] text-slate-400">({r.acType})</span>
                    </td>
                    <td className="p-3 font-bold text-white whitespace-nowrap">{r.captain}</td>
                    <td className="p-3 text-center font-mono text-slate-200 whitespace-nowrap">
                      {r.std || '--'} / {r.doorClosed || '--'} / {r.chocksOff || '--'} /{' '}
                      {r.airborne || '--'}
                    </td>
                    <td className="p-3 font-bold text-amber-300 max-w-[200px] truncate" title={r.departureStatus}>
                      {r.departureStatus}
                    </td>
                    <td className="p-3 text-center font-bold text-white whitespace-nowrap">
                      <span className="text-sky-300 font-black">{r.paxTotal}</span>{' '}
                      <span className="text-[11px] text-slate-400">
                        ({r.paxMale}/{r.paxFemale}/{r.paxChild}/{r.paxInfant})
                      </span>
                    </td>
                    <td className="p-3 text-center font-bold text-emerald-300 whitespace-nowrap">
                      {r.baggageWeight} KG / {r.baggagePcs}P
                    </td>
                    <td className="p-3 text-center whitespace-nowrap">
                      <span className="font-black text-rose-400">{r.counterNoshow}</span>
                      {r.noshowPnr && r.noshowPnr !== 'NIL' && (
                        <span className="block text-[10px] font-mono text-red-300">
                          PNR: {r.noshowPnr}
                        </span>
                      )}
                    </td>
                    <td className="p-3 font-bold text-indigo-300 whitespace-nowrap">
                      {r.preparedBy}{' '}
                      <span className="text-[10px] text-slate-400 block">USBA-{r.usbaId}</span>
                    </td>
                    <td className="p-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        {onLoadFlightReport && r.rawFormData && (
                          <button
                            type="button"
                            onClick={() => onLoadFlightReport(r.rawFormData!)}
                            className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                            title="Open Full Report Card & Table"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>VIEW</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => deleteFlightReportFromCloud(r, userInfo)}
                          className="px-2.5 py-1.5 rounded-lg bg-rose-600/80 hover:bg-rose-500 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                          title="Delete Flight Report"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
