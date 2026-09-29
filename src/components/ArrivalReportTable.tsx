import React from 'react';
import { FlightFormData, UserInfo } from '../types';
import { findRouteByFlightNo, formatDate, getRegistrationDetails } from '../data/aviationData';

interface Props {
  data: FlightFormData;
  user: UserInfo;
  mode: 'intl' | 'dom';
}

export const ArrivalReportTable: React.FC<Props> = ({ data, user }) => {
  const regDetails = getRegistrationDetails(data.acRegSuffix);

  // 1. DATE: Auto generated as today's date
  const todayIso = new Date().toISOString().split('T')[0];
  const formattedTodayDate = formatDate(todayIso, 'LONG').toUpperCase();

  // 2. FLT NO.: Arrival flight number (e.g. if departure flight is 172 -> arrival flight is 171 with auto-generated route)
  const rawFlightNum = (data.flightNoSuffix || '').trim();
  const parsedFlightNum = parseInt(rawFlightNum, 10);
  const arrivalFlightNumStr =
    !isNaN(parsedFlightNum) && parsedFlightNum > 0
      ? String(parsedFlightNum % 2 === 0 ? parsedFlightNum - 1 : parsedFlightNum)
      : rawFlightNum || 'XXX';

  const matchedArrivalRoute =
    arrivalFlightNumStr !== 'XXX' ? findRouteByFlightNo(arrivalFlightNumStr) : '';
  const fallbackArrivalRoute = (() => {
    const parts = (data.route || '').split('-').map((p) => p.trim().toUpperCase()).filter(Boolean);
    if (parts.length === 2) {
      if (parts[0] === 'DAC') return `${parts[0]}-${parts[1]}`;
      return `DAC-${parts[0]}`;
    }
    const stn = (user.stationName || '').trim().toUpperCase();
    return stn && stn !== 'DAC' ? `DAC-${stn}` : data.route || 'N/A';
  })();
  const arrivalRoute = matchedArrivalRoute || fallbackArrivalRoute;
  const arrivalFlightNoDisplay = `BS-${arrivalFlightNumStr} (${arrivalRoute})`;

  // 3. ORIGIN: Always DAC because it is coming from DAC
  const origin = 'DAC';

  // Helper: treat empty, '0', '00', 'NIL', 'N/A' as empty
  const isZeroOrEmpty = (val?: string): boolean => {
    if (!val) return true;
    const trimmed = val.trim().toUpperCase();
    if (trimmed === '' || trimmed === 'NIL' || trimmed === 'N/A' || trimmed === '-') return true;
    if (/^0+$/.test(trimmed)) return true;
    return false;
  };

  // 7. TOTAL PAX (e.g. 70+02 = 72)
  const adultPax = (data.arrPaxAdult || '').trim();
  const infantPax = (data.arrPaxInfant || '').trim();
  const adultNum = parseInt(adultPax, 10) || 0;
  const infantNum = parseInt(infantPax, 10) || 0;
  const arrivalPaxString =
    adultPax || infantPax
      ? `${adultPax || '0'}+${infantPax || '00'} = ${adultNum + infantNum}`
      : '0+00';

  // 8. TOTAL BAGGAGE/PCS (Weight & PCS)
  const arrivalBaggageString = `BAG: ${data.arrBaggageWeight || '0'} KGS / ${data.arrBaggagePcs || '0'} PCS`;

  // 9. TOTAL CGO/MAIL (e.g. CGO-100 KG/10 PCS, MAIL-01)
  const cgoWeight = (data.arrCargoWeight || '').trim() || '0';
  const cgoPcs = (data.arrCargoPcs || '').trim() || '0';
  const rawMail = (data.arrMail || '').trim();
  const mailNum = parseInt(rawMail, 10);
  const mailFormatted = !isZeroOrEmpty(rawMail)
    ? !isNaN(mailNum)
      ? String(mailNum).padStart(2, '0')
      : rawMail.toUpperCase()
    : '00';
  const totalCgoMailString = `CGO-${cgoWeight} KG/${cgoPcs} PCS, MAIL-${mailFormatted}`;

  // 10. PAX RECEIVING & 11. UNLOADING -> Name of RAMP OFFICER from data entry page
  const rampOfficerValue = (data.rampOfficer || data.loadingStuff || 'N/A').toUpperCase();

  // 12. VIP/CIP/MAAS -> Collected from Arrival input boxes
  const specialHandlingParts: string[] = [];
  if (!isZeroOrEmpty(data.arrVip)) specialHandlingParts.push(`VIP: ${data.arrVip!.trim()}`);
  if (!isZeroOrEmpty(data.arrCip)) specialHandlingParts.push(`CIP: ${data.arrCip!.trim()}`);
  if (!isZeroOrEmpty(data.arrMaas)) specialHandlingParts.push(`MAAS: ${data.arrMaas!.trim()}`);
  const specialHandlingOutput =
    specialHandlingParts.length > 0 ? specialHandlingParts.join(' / ').toUpperCase() : 'NIL';

  // 13. HANDLING -> Same name as PAX HANDLING from data entry page
  const paxHandlingValue = (data.paxHandling || 'N/A').toUpperCase();

  const remarksOutput =
    data.arrRemarks && data.arrRemarks.trim() ? data.arrRemarks.trim().toUpperCase() : 'NIL';

  return (
    <div className="w-full flex justify-center py-2 print:py-0 uppercase">
      {/* Actual A4 Sized Container Preview (210mm x 297mm proportions) */}
      <div
        id="printable-arrival-table"
        className="w-full max-w-[210mm] min-h-[297mm] print:min-h-0 bg-white text-black p-8 md:p-10 print:p-0 font-serif border border-neutral-300 print:border-0 rounded shadow-2xl print:shadow-none relative uppercase"
        style={{
          fontFamily: "'Bookman Old Style', 'Times New Roman', serif",
          boxSizing: 'border-box',
        }}
      >
        {/* Header */}
        <div className="text-center mb-5 print:mb-3.5">
          <h2 className="text-3xl print:text-2xl font-extrabold tracking-widest m-0 uppercase text-black">
            US-BANGLA AIRLINES
          </h2>
          <h3 className="text-lg print:text-base font-bold border-b-2 border-black pb-1.5 mt-1 tracking-wider uppercase text-black">
            OFFICIAL FLIGHT ARRIVAL REPORT
          </h3>
        </div>

        {/* Arrival Table */}
        <table className="w-full border-2 border-black border-collapse text-[10.5pt] print:text-[9.5pt] text-black">
          <tbody>
            <tr className="border border-black">
              <td className="font-bold p-2 w-[35%] align-top border-r border-black">1. DATE</td>
              <td className="p-2">: {formattedTodayDate}</td>
            </tr>
            <tr className="border border-black">
              <td className="font-bold p-2 align-top border-r border-black">2. FLT NO.</td>
              <td className="p-2">: {arrivalFlightNoDisplay}</td>
            </tr>
            <tr className="border border-black">
              <td className="font-bold p-2 align-top border-r border-black">3. ORIGIN</td>
              <td className="p-2">: {origin}</td>
            </tr>
            <tr className="border border-black">
              <td className="font-bold p-2 align-top border-r border-black">4. ARRIVAL TIME</td>
              <td className="p-2 leading-relaxed">
                : STA: {data.sta || 'N/A'} LT &nbsp; C/ON: {data.chocksOn || 'N/A'} LT &nbsp; DOOR OPEN: {data.doorOpen || 'N/A'} LT
                <div className="text-sm print:text-[9.5pt] font-bold mt-0.5 text-black uppercase">
                  : STATUS: {(data.arrivalStatus || 'FLIGHT ON TIME ARRIVED').toUpperCase()}
                </div>
              </td>
            </tr>
            <tr className="border border-black">
              <td className="font-bold p-2 align-top border-r border-black">5. A/C REG</td>
              <td className="p-2">: {regDetails.display} ({(data.acType || 'N/A').toUpperCase()})</td>
            </tr>
            <tr className="border border-black">
              <td className="font-bold p-2 align-top border-r border-black">6. CAPTAIN</td>
              <td className="p-2">: CAPT. {(data.captain || 'N/A').toUpperCase()} ({(data.configure || 'N/A').toUpperCase()})</td>
            </tr>
            <tr className="border border-black">
              <td className="font-bold p-2 align-top border-r border-black">7. TOTAL PAX</td>
              <td className="p-2">: {arrivalPaxString}</td>
            </tr>
            <tr className="border border-black">
              <td className="font-bold p-2 align-top border-r border-black">8. TOTAL BAGGAGE/PCS</td>
              <td className="p-2">: {arrivalBaggageString}</td>
            </tr>
            <tr className="border border-black">
              <td className="font-bold p-2 align-top border-r border-black">9. TOTAL CGO/MAIL</td>
              <td className="p-2">: {totalCgoMailString}</td>
            </tr>
            <tr className="border border-black">
              <td className="font-bold p-2 align-top border-r border-black">10. PAX RECEIVING</td>
              <td className="p-2">: {rampOfficerValue}</td>
            </tr>
            <tr className="border border-black">
              <td className="font-bold p-2 align-top border-r border-black">11. UNLOADING</td>
              <td className="p-2">: {rampOfficerValue}</td>
            </tr>
            <tr className="border border-black">
              <td className="font-bold p-2 align-top border-r border-black">12. VIP/CIP/MAAS</td>
              <td className="p-2">: {specialHandlingOutput}</td>
            </tr>
            <tr className="border border-black">
              <td className="font-bold p-2 align-top border-r border-black">13. HANDLING</td>
              <td className="p-2">: {paxHandlingValue}</td>
            </tr>
            <tr className="border border-black">
              <td className="font-bold p-2 align-top border-r border-black">14. (DOOR OPEN)</td>
              <td className="p-2">: {data.doorOpen ? `${data.doorOpen} LT` : 'N/A'}</td>
            </tr>
            <tr className="border border-black">
              <td className="font-bold p-2 align-top border-r border-black">REMARKS</td>
              <td className="p-2 leading-relaxed font-semibold text-black uppercase">
                : {remarksOutput}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Footer Signatures */}
        <table className="w-full border-2 border-black border-collapse mt-6 print:mt-4 text-[10.5pt] print:text-[9.5pt] text-black">
          <tbody>
            <tr className="border border-black">
              <td className="font-bold p-2.5 w-[35%] border-r border-black">PREPARED BY</td>
              <td className="p-2.5">: {user.userName.toUpperCase() || 'N/A'}</td>
            </tr>
            <tr className="border border-black">
              <td className="font-bold p-2.5 border-r border-black">STAFF ID</td>
              <td className="p-2.5">: USBA-{user.usbaId.toUpperCase() || 'N/A'}</td>
            </tr>
            <tr className="border border-black">
              <td className="font-bold p-2.5 h-14 print:h-11 align-middle border-r border-black">SIGNATURE</td>
              <td className="p-2.5 align-middle">:</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
