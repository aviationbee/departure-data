import React, { useRef, useState } from 'react';
import { FlightFormData, UserInfo } from '../types';
import { formatDate, AIRPORT_NAMES, getRegistrationDetails } from '../data/aviationData';
import { toJpeg } from 'html-to-image';
import {
  Plane,
  MapPin,
  Calendar,
  UserCheck,
  Users,
  CheckCircle2,
  Clock,
  Weight,
  Settings,
  Shield,
  Download,
  Fuel,
  Luggage,
  Package,
  Mail,
  Star,
  Accessibility,
  AlertTriangle,
  MessageSquare,
} from 'lucide-react';

interface Props {
  data: FlightFormData;
  user: UserInfo;
}

export const DeparturePhotoCard: React.FC<Props> = ({ data, user }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  // Parse Route and Origin/Dest names
  const routeParts = (data.route || '').split('-');
  const originCode = (routeParts[0] || user.stationName || 'DAC').toUpperCase();
  const destCode = (routeParts[1] || 'DAC').toUpperCase();
  const originCity = (AIRPORT_NAMES[originCode] || originCode).toUpperCase();
  const destCity = (AIRPORT_NAMES[destCode] || destCode).toUpperCase();

  const flightNumber = `BS-${data.flightNoSuffix || 'XXX'}`.toUpperCase();
  const displayDate = data.date ? formatDate(data.date, 'CARD').toUpperCase() : 'N/A';
  const regDetails = getRegistrationDetails(data.acRegSuffix);

  // Helper: treat empty, whitespace, 'NIL', or '0'/'00' as empty/zero
  const isZeroOrEmpty = (val?: string): boolean => {
    if (!val) return true;
    const trimmed = val.trim().toUpperCase();
    if (trimmed === '' || trimmed === 'NIL' || trimmed === 'N/A' || trimmed === '-') return true;
    if (/^0+$/.test(trimmed)) return true;
    return false;
  };

  // Passengers (restricted from showing actual count on photo card per management policy)
  const paxDisplay = 'AS SYSTEM';

  // Baggage
  const bagW = parseInt(data.baggageWeight, 10) || 0;
  const bagP = parseInt(data.baggagePcs, 10) || 0;
  const bagDisplay = bagW > 0 || bagP > 0 ? `${bagW} KGS ${bagP} PCS` : 'NIL';

  // Cargo
  const cgoW = parseInt(data.cargoWeight, 10) || 0;
  const cgoP = parseInt(data.cargoPcs, 10) || 0;
  const cargoDisplay = cgoW > 0 || cgoP > 0 ? `${cgoW} KGS ${cgoP} PCS` : 'NIL';

  // Mail
  const mailDisplay = isZeroOrEmpty(data.mail) ? 'NIL' : data.mail.trim().toUpperCase();

  // Fuel
  const fuelNum = parseInt(data.fuelUplift, 10) || 0;
  const fuelDisplay = !isZeroOrEmpty(data.fuelUplift) && fuelNum > 0 ? `${data.fuelUplift.trim()} KG` : 'NIL';

  // Special Handling
  const formatFig = (val: string, seat?: string) => {
    const num = parseInt(val, 10);
    if (!isNaN(num) && num > 0) {
      const validSeat = seat && !isZeroOrEmpty(seat) ? seat.trim().toUpperCase() : '';
      return validSeat ? `${String(num).padStart(2, '0')} (${validSeat})` : String(num).padStart(2, '0');
    }
    return 'NIL';
  };

  const vipDisplay = formatFig(data.vip);
  const cipDisplay = formatFig(data.cip);
  const maasDisplay = formatFig(data.maas);
  const wchrDisplay = formatFig(data.wchrFig, data.wchrSeat);
  const wchcDisplay = formatFig(data.wchcFig, data.wchcSeat);
  const umPaxDisplay = formatFig(data.umPax);
  const fireArmsDisplay = isZeroOrEmpty(data.fireArms) ? 'NIL' : data.fireArms.trim().toUpperCase();

  // Staff & Captain Values
  const captainDisplay = isZeroOrEmpty(data.captain) ? 'NIL' : data.captain.trim().toUpperCase();
  const configureDisplay = isZeroOrEmpty(data.configure) ? 'NIL' : data.configure.trim().toUpperCase();
  const checkInStaffValue = isZeroOrEmpty(data.checkInStaff || data.checkInStuff)
    ? 'NIL'
    : (data.checkInStaff || data.checkInStuff || '').trim().toUpperCase();
  const rampOfficerValue = isZeroOrEmpty(data.rampOfficer || data.loadingStuff)
    ? 'NIL'
    : (data.rampOfficer || data.loadingStuff || '').trim().toUpperCase();
  const loadControllerValue = isZeroOrEmpty(data.loadController)
    ? 'NIL'
    : data.loadController.trim().toUpperCase();

  // Clean Time Formatter (HHMM without colons if 4 chars)
  const formatTime4 = (timeStr: string) => {
    if (!timeStr || isZeroOrEmpty(timeStr)) return '----';
    const clean = timeStr.replace(/\D/g, '');
    if (clean.length === 4) return clean;
    return timeStr.toUpperCase();
  };

  // Station check: Outstation vs DAC
  const isOutstation = (user.stationName || 'DAC').trim().toUpperCase() !== 'DAC';

  // Arrival Status Styling (for Outstation)
  const arrivalStatusUpper = (data.arrivalStatus || 'FLIGHT ON TIME ARRIVED').toUpperCase();
  const isArrivalLate = arrivalStatusUpper.includes('LATE') || arrivalStatusUpper.includes('DELAY');
  const isArrivalEarly = arrivalStatusUpper.includes('EARLY');

  // Departure Status Styling
  const statusUpper = (data.departureStatus || 'FLIGHT ONTIME').toUpperCase();
  const isDelayed = statusUpper.includes('DELAY');
  const isEarly = statusUpper.includes('EARLY');

  // Check if Remarks or NOSHOW PNR Exist (ignore '0' or 'NIL' or empty)
  const hasValidRemarks = !isZeroOrEmpty(data.remarks);
  const hasValidNoshowPnr = !isZeroOrEmpty(data.noshowPnr);
  const hasRemarksContent = hasValidRemarks || hasValidNoshowPnr;

  // Download HD JPG Handler
  const handleDownloadJpg = async () => {
    if (!cardRef.current) return;
    try {
      setDownloading(true);
      const dataUrl = await toJpeg(cardRef.current, {
        quality: 0.98,
        pixelRatio: 2.5, // Crisp HD 300dpi output
        backgroundColor: '#f1f5f9',
      });
      const link = document.createElement('a');
      link.download = `${flightNumber}_${originCode}-${destCode}_${data.date || 'REPORT'}.jpg`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to generate image', err);
      alert('COULD NOT DOWNLOAD IMAGE. PLEASE TRY AGAIN.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex flex-col items-center w-full uppercase">
      {/* Action Bar */}
      <div className="no-print w-full flex justify-between items-center mb-3">
        <span className="text-xs font-sans font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
          <Plane className="w-4 h-4 text-sky-400" />
          <span>HD PHOTO CARD (READY TO SHARE)</span>
        </span>

        <button
          onClick={handleDownloadJpg}
          disabled={downloading}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-sans text-xs font-black shadow-lg hover:shadow-sky-500/30 flex items-center gap-2 cursor-pointer transition-all active:scale-95 disabled:opacity-50 uppercase"
        >
          <Download className="w-4 h-4" />
          <span>{downloading ? 'GENERATING HD JPG...' : 'DOWNLOAD HD JPG'}</span>
        </button>
      </div>

      {/* The Printable / Renderable Photo Card */}
      <div className="w-full overflow-x-auto pb-2 flex justify-center uppercase">
        <div
          ref={cardRef}
          className="w-[1020px] min-w-[1020px] bg-slate-100 rounded-3xl p-6 shadow-2xl border border-slate-300 font-sans text-slate-900 select-none relative overflow-hidden uppercase"
          style={{
            fontFamily: "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
            background: 'linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%)',
          }}
        >
          {/* TOP BANNER */}
          <div className="w-full rounded-2xl bg-gradient-to-r from-[#003b6d] via-[#025a9e] to-[#0072bc] p-4 text-white flex justify-between items-center shadow-md relative overflow-hidden">
            {/* Left: Airline Branding */}
            <div className="flex flex-col z-10">
              <h2 className="text-2xl font-black tracking-wider text-white uppercase drop-shadow-sm flex items-center gap-2">
                <span>US BANGLA AIRLINES</span>
              </h2>
              <span className="text-[11px] font-bold tracking-widest text-sky-200 uppercase">
                FLY FAST &bull; FLY SAFE
              </span>
            </div>

            {/* Center: Badge with Airplane */}
            <div className="flex items-center gap-3 z-10">
              <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm border-2 border-white/40 flex items-center justify-center shadow-inner">
                <Plane className="w-6 h-6 text-white rotate-[-30deg]" />
              </div>
              <h1 className="text-xl font-black tracking-widest text-white uppercase drop-shadow">
                STATION DEPARTURE REPORT
              </h1>
            </div>

            {/* Right: Big, Bold, Highlighted FLIGHT NO Badge for instant WhatsApp preview recognition */}
            <div className="relative z-10 bg-gradient-to-r from-amber-300 via-yellow-300 to-amber-400 text-slate-950 px-5 py-2 rounded-2xl border-2 border-white shadow-xl flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-slate-950 text-amber-300 flex items-center justify-center shadow-md shrink-0">
                <Plane className="w-6 h-6" />
              </div>
              <div className="flex flex-col leading-none">
                <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest mb-1">
                  FLIGHT NO.
                </span>
                <span className="text-3xl font-black text-slate-950 tracking-wider uppercase">
                  {flightNumber}
                </span>
              </div>
            </div>

            {/* Subtle curved background overlay */}
            <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-white/10 -skew-x-12 pointer-events-none" />
          </div>

          {/* ROW 1: 4 INFO PILLS */}
          <div className="grid grid-cols-4 gap-3.5 mt-4 uppercase">
            {/* From / To */}
            <div className="bg-white rounded-2xl p-3 border border-slate-300 shadow-sm flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow">
                <MapPin className="w-6 h-6" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider">
                  FROM / TO
                </span>
                <span className="text-base font-black text-slate-900 tracking-tight uppercase">
                  {originCode} &rarr; {destCode}
                </span>
                <span className="text-[9px] font-bold text-slate-600 truncate max-w-[140px] uppercase">
                  {originCity} &rarr; {destCity}
                </span>
              </div>
            </div>

            {/* Date */}
            <div className="bg-white rounded-2xl p-3 border border-slate-300 shadow-sm flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-blue-700 text-white flex items-center justify-center shadow">
                <Calendar className="w-6 h-6" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider">
                  DATE
                </span>
                <span className="text-sm font-black text-slate-900 uppercase">
                  {displayDate}
                </span>
              </div>
            </div>

            {/* Captain */}
            <div className="bg-white rounded-2xl p-3 border border-slate-300 shadow-sm flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-sky-700 text-white flex items-center justify-center shadow">
                <UserCheck className="w-6 h-6" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider">
                  CAPTAIN
                </span>
                <span className="text-sm font-black text-slate-900 uppercase truncate max-w-[135px]">
                  {captainDisplay}
                </span>
              </div>
            </div>

            {/* Crew Count / Configure */}
            <div className="bg-white rounded-2xl p-3 border border-slate-300 shadow-sm flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-indigo-700 text-white flex items-center justify-center shadow">
                <Users className="w-6 h-6" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider">
                  CREW COUNT
                </span>
                <span className="text-base font-black text-slate-900 uppercase">
                  {configureDisplay}
                </span>
              </div>
            </div>
          </div>

          {/* ROW 2: TIMINGS BAR (2-Part Arrival & Departure for Outstation, Single Bar for DAC) */}
          {isOutstation ? (
            <div className="grid grid-cols-2 gap-3.5 mt-3 uppercase">
              {/* LEFT PART: ARRIVAL INFORMATION (Soft Mint/Emerald Tint Background) */}
              <div className="bg-gradient-to-br from-emerald-50 via-teal-50/90 to-emerald-100/75 rounded-2xl p-3.5 border-2 border-emerald-500/60 shadow-sm flex flex-col justify-between gap-2.5">
                <div className="flex items-center justify-between border-b border-emerald-200/80 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-700 text-white flex items-center justify-center shadow">
                      <Clock className="w-4 h-4" />
                    </div>
                    <span className="text-[11px] font-black text-emerald-900 tracking-wider uppercase">
                      ARRIVAL INFO
                    </span>
                  </div>

                  <div className="flex items-center gap-5">
                    {/* # STA */}
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] font-black text-emerald-800 uppercase"># STA</span>
                      <span className="text-lg font-black text-slate-950 tracking-wider leading-tight">
                        {formatTime4(data.sta || '')}
                      </span>
                    </div>

                    {/* # C/ON */}
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] font-black text-emerald-800 uppercase"># C/ON</span>
                      <span className="text-lg font-black text-slate-950 tracking-wider leading-tight">
                        {formatTime4(data.chocksOn || '')}
                      </span>
                    </div>

                    {/* # DOOR OPEN */}
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] font-black text-emerald-800 uppercase"># DOOR OPEN</span>
                      <span className="text-lg font-black text-slate-950 tracking-wider leading-tight">
                        {formatTime4(data.doorOpen || '')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Arrival Status Badge: Early = Green, On Time = Yellow, Late/Delay = Red */}
                <div
                  className={`px-3.5 py-2 rounded-xl border-2 flex items-center justify-between gap-2 font-black text-xs tracking-wide shadow-sm uppercase ${
                    isArrivalLate
                      ? 'bg-red-100/95 text-red-600 border-red-500 font-black'
                      : isArrivalEarly
                      ? 'bg-emerald-100/95 text-emerald-700 border-emerald-500 font-black'
                      : 'bg-amber-100/95 text-amber-600 border-amber-400 font-black'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Plane className="w-4 h-4 rotate-90 shrink-0" />
                    <span className="font-black">{arrivalStatusUpper}</span>
                  </div>
                  {isArrivalLate ? (
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  ) : isArrivalEarly ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
                  )}
                </div>
              </div>

              {/* RIGHT PART: DEPARTURE INFORMATION (Soft Sky/Blue Tint Background) */}
              <div className="bg-gradient-to-br from-sky-50 via-blue-50/90 to-indigo-100/75 rounded-2xl p-3.5 border-2 border-sky-500/60 shadow-sm flex flex-col justify-between gap-2.5">
                <div className="flex items-center justify-between border-b border-sky-200/80 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-sky-700 text-white flex items-center justify-center shadow">
                      <Clock className="w-4 h-4" />
                    </div>
                    <span className="text-[11px] font-black text-sky-900 tracking-wider uppercase">
                      DEPARTURE INFO
                    </span>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* # STD */}
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] font-black text-sky-800 uppercase"># STD</span>
                      <span className="text-lg font-black text-slate-950 tracking-wider leading-tight">
                        {formatTime4(data.std)}
                      </span>
                    </div>

                    {/* # C/OFF */}
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] font-black text-sky-800 uppercase"># C/OFF</span>
                      <span className="text-lg font-black text-slate-950 tracking-wider leading-tight">
                        {formatTime4(data.chocksOff)}
                      </span>
                    </div>

                    {/* # DOOR CLOSED */}
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] font-black text-sky-800 uppercase"># DOOR CLOSED</span>
                      <span className="text-lg font-black text-slate-950 tracking-wider leading-tight">
                        {formatTime4(data.doorClosed)}
                      </span>
                    </div>

                    {/* # AIRBORNE */}
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] font-black text-sky-800 uppercase"># AIRBORNE</span>
                      <span className="text-lg font-black text-slate-950 tracking-wider leading-tight">
                        {formatTime4(data.airborne)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Departure Status Badge: Early = Green, On Time = Yellow, Delay = Red */}
                <div
                  className={`px-3.5 py-2 rounded-xl border-2 flex items-center justify-between gap-2 font-black text-xs tracking-wide shadow-sm uppercase ${
                    isDelayed
                      ? 'bg-red-100/95 text-red-600 border-red-500 font-black'
                      : isEarly
                      ? 'bg-emerald-100/95 text-emerald-700 border-emerald-500 font-black'
                      : 'bg-amber-100/95 text-amber-600 border-amber-400 font-black'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Plane className="w-4 h-4 shrink-0" />
                    <span className="font-black">{statusUpper}</span>
                  </div>
                  {isDelayed ? (
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  ) : isEarly ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-3.5 mt-3 border border-slate-300 shadow-sm flex justify-between items-center px-6 uppercase">
              <div className="flex items-center gap-8">
                <div className="w-10 h-10 rounded-xl bg-slate-800 text-white flex items-center justify-center shadow">
                  <Clock className="w-5 h-5" />
                </div>

                {/* STD */}
                <div className="flex flex-col items-center">
                  <span className="text-[11px] font-black text-slate-600 uppercase">STD</span>
                  <span className="text-xl font-black text-slate-950 tracking-wider">
                    {formatTime4(data.std)}
                  </span>
                </div>

                {/* D/C */}
                <div className="flex flex-col items-center">
                  <span className="text-[11px] font-black text-slate-600 uppercase"># D/C</span>
                  <span className="text-xl font-black text-slate-950 tracking-wider">
                    {formatTime4(data.doorClosed)}
                  </span>
                </div>

                {/* C/OFF */}
                <div className="flex flex-col items-center">
                  <span className="text-[11px] font-black text-slate-600 uppercase"># C/OFF</span>
                  <span className="text-xl font-black text-slate-950 tracking-wider">
                    {formatTime4(data.chocksOff)}
                  </span>
                </div>

                {/* A/B */}
                <div className="flex flex-col items-center">
                  <span className="text-[11px] font-black text-slate-600 uppercase"># A/B</span>
                  <span className="text-xl font-black text-slate-950 tracking-wider">
                    {formatTime4(data.airborne)}
                  </span>
                </div>
              </div>

              {/* Status Badge: Early = Green, On Time = Yellow, Delay = Red */}
              <div
                className={`px-5 py-2.5 rounded-xl border-2 flex items-center gap-2.5 font-black text-xs md:text-sm tracking-wide shadow-sm uppercase ${
                  isDelayed
                    ? 'bg-red-100/95 text-red-600 border-red-500 font-black'
                    : isEarly
                    ? 'bg-emerald-100/95 text-emerald-700 border-emerald-500 font-black'
                    : 'bg-amber-100/95 text-amber-600 border-amber-400 font-black'
                }`}
              >
                <Plane className="w-4 h-4" />
                <span className="font-black">{statusUpper}</span>
                {isDelayed ? (
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                ) : isEarly ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-amber-600" />
                )}
              </div>
            </div>
          )}

          {/* ROW 3: THREE FLIGHT DATA BOXES (LOAD SUMMARY, SPECIAL HANDLING, STAFF DETAILS) - HIGHLIGHTED & BOLD */}
          <div className="grid grid-cols-3 gap-4 mt-3 uppercase">
            {/* BOX 1: LOAD SUMMARY */}
            <div className="bg-white rounded-2xl border-2 border-cyan-700/30 shadow-md overflow-hidden flex flex-col">
              <div className="bg-gradient-to-r from-[#085f75] to-[#0e7490] text-white px-4 py-2.5 flex items-center gap-2 font-black text-xs md:text-[13px] uppercase tracking-wider shadow-sm">
                <Weight className="w-4 h-4 text-cyan-200" />
                <span className="font-extrabold tracking-wide">LOAD SUMMARY</span>
              </div>

              <div className="p-4 space-y-2.5 text-xs md:text-[12.5px] font-bold">
                <div className="flex justify-between items-center border-b border-slate-200 pb-1.5">
                  <span className="text-slate-700 flex items-center gap-2 font-extrabold">
                    <Fuel className="w-4 h-4 text-cyan-700" />
                    FUEL
                  </span>
                  <span className="font-black text-slate-950 text-sm tracking-tight">{fuelDisplay}</span>
                </div>

                <div className="flex justify-between items-center border-b border-slate-200 pb-1.5">
                  <span className="text-slate-700 flex items-center gap-2 font-extrabold">
                    <Users className="w-4 h-4 text-cyan-700" />
                    PASSENGERS
                  </span>
                  <span className="font-black text-slate-950 text-sm tracking-tight">{paxDisplay}</span>
                </div>

                <div className="flex justify-between items-center border-b border-slate-200 pb-1.5">
                  <span className="text-slate-700 flex items-center gap-2 font-extrabold">
                    <Luggage className="w-4 h-4 text-cyan-700" />
                    BAGGAGE
                  </span>
                  <span className="font-black text-slate-950 text-sm tracking-tight">{bagDisplay}</span>
                </div>

                <div className="flex justify-between items-center border-b border-slate-200 pb-1.5">
                  <span className="text-slate-700 flex items-center gap-2 font-extrabold">
                    <Package className="w-4 h-4 text-cyan-700" />
                    CARGO
                  </span>
                  <span className="font-black text-slate-950 text-sm tracking-tight">{cargoDisplay}</span>
                </div>

                <div className="flex justify-between items-center border-b border-slate-200 pb-1.5">
                  <span className="text-slate-700 flex items-center gap-2 font-extrabold">
                    <Mail className="w-4 h-4 text-cyan-700" />
                    MAIL
                  </span>
                  <span className="font-black text-slate-950 text-sm tracking-tight">{mailDisplay}</span>
                </div>

                <div className="flex justify-between items-center pt-0.5">
                  <span className="text-slate-700 flex items-center gap-2 font-extrabold">
                    <Shield className="w-4 h-4 text-cyan-700" />
                    FIRE ARMS
                  </span>
                  <span className="font-black text-slate-950 text-sm tracking-tight">{fireArmsDisplay}</span>
                </div>
              </div>
            </div>

            {/* BOX 2: SPECIAL HANDLING */}
            <div className="bg-white rounded-2xl border-2 border-teal-700/30 shadow-md overflow-hidden flex flex-col">
              <div className="bg-gradient-to-r from-[#0b635c] to-[#0f766e] text-white px-4 py-2.5 flex items-center gap-2 font-black text-xs md:text-[13px] uppercase tracking-wider shadow-sm">
                <Settings className="w-4 h-4 text-teal-200" />
                <span className="font-extrabold tracking-wide">SPECIAL HANDLING</span>
              </div>

              <div className="p-4 space-y-2.5 text-xs md:text-[12.5px] font-bold">
                <div className="flex justify-between items-center border-b border-slate-200 pb-1.5">
                  <span className="text-slate-700 flex items-center gap-2 font-extrabold">
                    <Star className="w-4 h-4 text-teal-700" />
                    VIP
                  </span>
                  <span className="font-black text-slate-950 text-sm">{vipDisplay}</span>
                </div>

                <div className="flex justify-between items-center border-b border-slate-200 pb-1.5">
                  <span className="text-slate-700 flex items-center gap-2 font-extrabold">
                    <Accessibility className="w-4 h-4 text-teal-700" />
                    CIP
                  </span>
                  <span className="font-black text-slate-950 text-sm">{cipDisplay}</span>
                </div>

                <div className="flex justify-between items-center border-b border-slate-200 pb-1.5">
                  <span className="text-slate-700 flex items-center gap-2 font-extrabold">
                    <Users className="w-4 h-4 text-teal-700" />
                    MAAS
                  </span>
                  <span className="font-black text-slate-950 text-sm">{maasDisplay}</span>
                </div>

                <div className="flex justify-between items-center border-b border-slate-200 pb-1.5">
                  <span className="text-slate-700 flex items-center gap-2 font-extrabold">
                    <Accessibility className="w-4 h-4 text-teal-700" />
                    WCHR
                  </span>
                  <span className="font-black text-slate-950 text-sm">{wchrDisplay}</span>
                </div>

                <div className="flex justify-between items-center border-b border-slate-200 pb-1.5">
                  <span className="text-slate-700 flex items-center gap-2 font-extrabold">
                    <Accessibility className="w-4 h-4 text-teal-700" />
                    WCHC
                  </span>
                  <span className="font-black text-slate-950 text-sm">{wchcDisplay}</span>
                </div>

                <div className="flex justify-between items-center pt-0.5">
                  <span className="text-slate-700 flex items-center gap-2 font-extrabold">
                    <UserCheck className="w-4 h-4 text-teal-700" />
                    UM PAX
                  </span>
                  <span className="font-black text-slate-950 text-sm">{umPaxDisplay}</span>
                </div>
              </div>
            </div>

            {/* BOX 3: STAFF DETAILS */}
            <div className="bg-white rounded-2xl border-2 border-indigo-700/30 shadow-md overflow-hidden flex flex-col">
              <div className="bg-gradient-to-r from-[#372f9d] to-[#4338ca] text-white px-4 py-2.5 flex items-center gap-2 font-black text-xs md:text-[13px] uppercase tracking-wider shadow-sm">
                <Users className="w-4 h-4 text-indigo-200" />
                <span className="font-extrabold tracking-wide">STAFF DETAILS</span>
              </div>

              <div className="p-4 space-y-3 text-xs md:text-[12.5px] font-bold">
                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <span className="text-slate-700 font-extrabold">LOAD CONTROL</span>
                  <span className="font-black text-slate-950 uppercase text-sm">
                    {loadControllerValue}
                  </span>
                </div>

                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <span className="text-slate-700 font-extrabold">RAMP OFFICER</span>
                  <span className="font-black text-slate-950 uppercase text-sm">
                    {rampOfficerValue}
                  </span>
                </div>

                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <span className="text-slate-700 font-extrabold">CHECK IN STAFF</span>
                  <span className="font-black text-slate-950 uppercase truncate max-w-[145px] text-sm">
                    {checkInStaffValue}
                  </span>
                </div>

                <div className="flex justify-between items-center pt-0.5">
                  <span className="text-slate-700 font-extrabold">REPORT BY</span>
                  <span className="font-black text-indigo-800 uppercase text-sm">
                    {(user.userName || 'N/A').toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* DEDICATED REMARKS BOX WITH NOSHOW PNR (SHOWN AFTER REMARKS) */}
          {hasRemarksContent && (
            <div className="mt-3 bg-gradient-to-r from-amber-50 to-amber-100/90 border-2 border-amber-400 rounded-2xl p-3.5 shadow-md flex items-start gap-3 uppercase">
              <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                <MessageSquare className="w-4 h-4 font-black" />
              </div>
              <div className="flex-1 space-y-1">
                <span className="font-black text-amber-950 uppercase text-xs tracking-wider block">
                  REMARKS:
                </span>
                {hasValidRemarks && (
                  <p className="font-black text-slate-950 text-xs md:text-sm tracking-wide leading-snug uppercase m-0">
                    {data.remarks.trim().toUpperCase()}
                  </p>
                )}
                {hasValidNoshowPnr && (
                  <div className="mt-1 flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-lg bg-red-100 border border-red-300 font-black text-red-900 text-xs tracking-wider">
                      NOSHOW PNR: {data.noshowPnr!.trim().toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* BOTTOM RIBBON BANNER */}
          <div className="mt-4 rounded-xl bg-gradient-to-r from-[#003b6d] via-[#025a9e] to-[#003b6d] text-white py-2 px-6 text-center font-black tracking-widest text-xs uppercase shadow flex items-center justify-center gap-3">
            <span className="w-8 h-0.5 bg-sky-300 inline-block" />
            <span>REGARDS FROM TEAM {originCode}</span>
            <span className="w-8 h-0.5 bg-sky-300 inline-block" />
          </div>
        </div>
      </div>
    </div>
  );
};
