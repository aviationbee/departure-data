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
  const originCity = AIRPORT_NAMES[originCode] || originCode;
  const destCity = AIRPORT_NAMES[destCode] || destCode;

  const flightNumber = `BS-${data.flightNoSuffix || 'XXX'}`;
  const displayDate = data.date ? formatDate(data.date, 'CARD') : 'N/A';
  const regDetails = getRegistrationDetails(data.acRegSuffix);

  // Passengers
  const totalPax = parseInt(data.paxTotal, 10) || 0;
  const infantPax = parseInt(data.paxInfant, 10) || 0;
  const paxDisplay = totalPax > 0 ? `${totalPax} + ${String(infantPax).padStart(2, '0')} INF` : 'NIL';

  // Baggage
  const bagW = parseInt(data.baggageWeight, 10) || 0;
  const bagP = parseInt(data.baggagePcs, 10) || 0;
  const bagDisplay = bagW > 0 || bagP > 0 ? `${bagW} KGS ${bagP} PCS` : 'NIL';

  // Cargo
  const cgoW = parseInt(data.cargoWeight, 10) || 0;
  const cgoP = parseInt(data.cargoPcs, 10) || 0;
  const cargoDisplay = cgoW > 0 || cgoP > 0 ? `${cgoW} KGS ${cgoP} PCS` : 'NIL';

  // Mail
  const mailDisplay = data.mail ? data.mail.toUpperCase() : 'NIL';

  // Fuel
  const fuelDisplay = data.fuelUplift ? `${data.fuelUplift} KG` : 'NIL';

  // Special Handling
  const formatFig = (val: string, seat?: string) => {
    const num = parseInt(val, 10);
    if (!isNaN(num) && num > 0) {
      return seat ? `${String(num).padStart(2, '0')} (${seat})` : String(num).padStart(2, '0');
    }
    return 'NIL';
  };

  const vipDisplay = formatFig(data.vip);
  const cipDisplay = formatFig(data.cip);
  const maasDisplay = formatFig(data.maas);
  const wchrDisplay = formatFig(data.wchrFig, data.wchrSeat);
  const wchcDisplay = formatFig(data.wchcFig, data.wchcSeat);
  const fireArmsDisplay = data.fireArms && data.fireArms.trim() ? data.fireArms.toUpperCase() : 'NIL';

  // Clean Time Formatter (HHMM without colons if 4 chars)
  const formatTime4 = (timeStr: string) => {
    if (!timeStr) return '----';
    const clean = timeStr.replace(/\D/g, '');
    if (clean.length === 4) return clean;
    return timeStr;
  };

  // Departure Status Styling
  const statusUpper = (data.departureStatus || 'FLIGHT ONTIME').toUpperCase();
  const isDelayed = statusUpper.includes('DELAY');
  const isEarly = statusUpper.includes('EARLY');

  // Check if Remarks Exist
  const hasRemarks = data.remarks && data.remarks.trim() !== '' && data.remarks.trim().toUpperCase() !== 'NIL';

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
      alert('Could not download image. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex flex-col items-center w-full">
      {/* Action Bar */}
      <div className="no-print w-full flex justify-between items-center mb-3">
        <span className="text-xs font-sans font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
          <Plane className="w-4 h-4 text-sky-400" />
          <span>HD PHOTO CARD (READY TO SHARE)</span>
        </span>

        <button
          onClick={handleDownloadJpg}
          disabled={downloading}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-sans text-xs font-bold shadow-lg hover:shadow-sky-500/30 flex items-center gap-2 cursor-pointer transition-all active:scale-95 disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          <span>{downloading ? 'GENERATING HD JPG...' : 'DOWNLOAD HD JPG'}</span>
        </button>
      </div>

      {/* The Printable / Renderable Photo Card */}
      <div className="w-full overflow-x-auto pb-2 flex justify-center">
        <div
          ref={cardRef}
          className="w-[1020px] min-w-[1020px] bg-slate-100 rounded-3xl p-6 shadow-2xl border border-slate-300 font-sans text-slate-900 select-none relative overflow-hidden"
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
                Fly Fast &bull; Fly Safe
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

            {/* Right: Decorative Airplane Vector */}
            <div className="relative z-10 opacity-70">
              <Plane className="w-14 h-14 text-white/40 rotate-45 transform translate-x-2 -translate-y-1" />
            </div>

            {/* Subtle curved background overlay */}
            <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-white/10 -skew-x-12 pointer-events-none" />
          </div>

          {/* ROW 1: 5 INFO PILLS */}
          <div className="grid grid-cols-5 gap-3 mt-4">
            {/* Flight No */}
            <div className="bg-white rounded-2xl p-3 border border-slate-300 shadow-sm flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow">
                <Plane className="w-6 h-6" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider">
                  FLIGHT NO.
                </span>
                <span className="text-lg font-black text-slate-900 tracking-tight">
                  {flightNumber}
                </span>
              </div>
            </div>

            {/* From / To */}
            <div className="bg-white rounded-2xl p-3 border border-slate-300 shadow-sm flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow">
                <MapPin className="w-6 h-6" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider">
                  FROM / TO
                </span>
                <span className="text-base font-black text-slate-900 tracking-tight">
                  {originCode} &rarr; {destCode}
                </span>
                <span className="text-[9px] font-bold text-slate-600 truncate max-w-[110px]">
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
                <span className="text-sm font-black text-slate-900 uppercase truncate max-w-[105px]">
                  {data.captain || 'N/A'}
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
                  {data.configure || '2/5'}
                </span>
              </div>
            </div>
          </div>

          {/* ROW 2: TIMINGS BAR */}
          <div className="bg-white rounded-2xl p-3.5 mt-3 border border-slate-300 shadow-sm flex justify-between items-center px-6">
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

            {/* Status Badge */}
            <div
              className={`px-5 py-2.5 rounded-xl border flex items-center gap-2.5 font-black text-xs md:text-sm tracking-wide shadow-sm ${
                isDelayed
                  ? 'bg-amber-100/90 text-amber-950 border-amber-400 font-extrabold'
                  : isEarly
                  ? 'bg-sky-100/90 text-sky-950 border-sky-400 font-extrabold'
                  : 'bg-emerald-100/90 text-emerald-950 border-emerald-400 font-extrabold'
              }`}
            >
              <Plane className="w-4 h-4" />
              <span>{statusUpper}</span>
              {isDelayed ? (
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              )}
            </div>
          </div>

          {/* ROW 3: THREE FLIGHT DATA BOXES (LOAD SUMMARY, SPECIAL HANDLING, STAFF DETAILS) - HIGHLIGHTED & BOLD */}
          <div className="grid grid-cols-3 gap-4 mt-3">
            {/* BOX 1: LOAD SUMMARY */}
            <div className="bg-white rounded-2xl border-2 border-cyan-700/30 shadow-md overflow-hidden flex flex-col">
              <div className="bg-gradient-to-r from-[#085f75] to-[#0e7490] text-white px-4 py-2.5 flex items-center gap-2 font-black text-xs md:text-[13px] uppercase tracking-wider shadow-sm">
                <Weight className="w-4 h-4 text-cyan-200" />
                <span className="font-extrabold tracking-wide">LOAD SUMMARY</span>
              </div>

              <div className="p-4 space-y-3 text-xs md:text-[12.5px] font-bold">
                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <span className="text-slate-700 flex items-center gap-2 font-extrabold">
                    <Fuel className="w-4 h-4 text-cyan-700" />
                    FUEL
                  </span>
                  <span className="font-black text-slate-950 text-sm tracking-tight">{fuelDisplay}</span>
                </div>

                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <span className="text-slate-700 flex items-center gap-2 font-extrabold">
                    <Users className="w-4 h-4 text-cyan-700" />
                    PASSENGERS
                  </span>
                  <span className="font-black text-slate-950 text-sm tracking-tight">{paxDisplay}</span>
                </div>

                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <span className="text-slate-700 flex items-center gap-2 font-extrabold">
                    <Luggage className="w-4 h-4 text-cyan-700" />
                    BAGGAGE
                  </span>
                  <span className="font-black text-slate-950 text-sm tracking-tight">{bagDisplay}</span>
                </div>

                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <span className="text-slate-700 flex items-center gap-2 font-extrabold">
                    <Package className="w-4 h-4 text-cyan-700" />
                    CARGO
                  </span>
                  <span className="font-black text-slate-950 text-sm tracking-tight">{cargoDisplay}</span>
                </div>

                <div className="flex justify-between items-center pt-0.5">
                  <span className="text-slate-700 flex items-center gap-2 font-extrabold">
                    <Mail className="w-4 h-4 text-cyan-700" />
                    MAIL
                  </span>
                  <span className="font-black text-slate-950 text-sm tracking-tight">{mailDisplay}</span>
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
                    <Shield className="w-4 h-4 text-teal-700" />
                    FIRE ARMS
                  </span>
                  <span className="font-black text-slate-950 text-sm">{fireArmsDisplay}</span>
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
                    {data.loadController || 'N/A'}
                  </span>
                </div>

                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <span className="text-slate-700 font-extrabold">RAMP OFFICER</span>
                  <span className="font-black text-slate-950 uppercase text-sm">
                    {data.loadingStuff || 'N/A'}
                  </span>
                </div>

                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <span className="text-slate-700 font-extrabold">COUNTER</span>
                  <span className="font-black text-slate-950 uppercase truncate max-w-[145px] text-sm">
                    {data.checkInStuff || 'N/A'}
                  </span>
                </div>

                <div className="flex justify-between items-center pt-0.5">
                  <span className="text-slate-700 font-extrabold">REPORT BY</span>
                  <span className="font-black text-indigo-800 uppercase text-sm">
                    {user.userName || 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* NEW DEDICATED REMARKS BOX (IF HAVE REMARK IN DATA ENTRY PAGE) */}
          {hasRemarks && (
            <div className="mt-3 bg-gradient-to-r from-amber-50 to-amber-100/90 border-2 border-amber-400 rounded-2xl p-3 shadow-md flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                <MessageSquare className="w-4 h-4 font-black" />
              </div>
              <div className="flex-1">
                <span className="font-black text-amber-900 uppercase text-xs tracking-wider block mb-0.5">
                  REMARKS:
                </span>
                <p className="font-extrabold text-slate-900 text-xs md:text-sm tracking-wide leading-snug uppercase m-0">
                  {data.remarks}
                </p>
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
