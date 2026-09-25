import React from 'react';
import { FlightFormData, UserInfo } from '../types';
import { formatDate, getRegistrationDetails } from '../data/aviationData';

interface Props {
  data: FlightFormData;
  user: UserInfo;
  mode: 'intl' | 'dom';
}

export const DepartureReportTable: React.FC<Props> = ({ data, user, mode }) => {
  const regDetails = getRegistrationDetails(data.acRegSuffix);
  const formattedDate = data.date ? formatDate(data.date, 'LONG') : 'N/A';
  const flightNo = `BS-${data.flightNoSuffix || 'XXX'}`;
  const routeParts = (data.route || '').split('-');
  const origin = routeParts[0] || user.stationName || 'DAC';
  const destination = routeParts[1] || 'N/A';

  const passengerString = `LOAD-${data.flightLoad || '0'}   ACTUAL-${data.paxMale || '0'}+${data.paxFemale || '0'}+${data.paxChild || '0'}+${data.paxInfant || '0'} =${data.paxTotal || '0'}+${data.paxInfant || '0'}`;
  const bagMailCgoString = `BAG: ${data.baggagePcs || '0'} PCS/${data.baggageWeight || '0'} KGS   MAIL: ${data.mail || '0'}   CGO: ${data.cargoPcs || '0'} PCS/${data.cargoWeight || '0'} KGS`;

  const specialHandlingParts: string[] = [];
  if (parseInt(data.maas || '0', 10) > 0) specialHandlingParts.push(`MAAS: ${data.maas}`);
  if (parseInt(data.umPax || '0', 10) > 0) specialHandlingParts.push(`UM: ${data.umPax}`);
  if (parseInt(data.vip || '0', 10) > 0) specialHandlingParts.push(`VIP: ${data.vip}`);
  if (parseInt(data.cip || '0', 10) > 0) specialHandlingParts.push(`CIP: ${data.cip}`);
  const specialHandlingOutput = specialHandlingParts.length > 0 ? specialHandlingParts.join(' / ') : 'NIL';

  const offloadParts: string[] = [];
  if (parseInt(data.gateNoShow || '0', 10) > 0) offloadParts.push(`GATE NO SHOW ${data.gateNoShow}`);
  if (parseInt(data.selfOffload || '0', 10) > 0) offloadParts.push(`SELF OFF ${data.selfOffload}`);
  if (mode === 'intl') {
    if (parseInt(data.refused || '0', 10) > 0) offloadParts.push(`REFUSED ${data.refused}`);
    if (parseInt(data.immigrationOff || '0', 10) > 0) offloadParts.push(`IMMI OFF ${data.immigrationOff}`);
  }
  const offloadString = offloadParts.length > 0 ? offloadParts.join(', ') : 'NIL';

  const pnrRegex = /\b[A-Z0-9]{6}\b/g;
  const pnrs = (data.remarks || '').match(pnrRegex);
  const noshowString = pnrs ? pnrs.join(', ') : 'NIL';

  const fireArmsValue = data.fireArms && data.fireArms.trim() ? data.fireArms.toUpperCase() : 'NIL';

  return (
    <div className="w-full flex justify-center py-2">
      {/* Actual A4 Sized Container Preview (210mm x 297mm proportions) */}
      <div
        id="printable-right-table"
        className="w-full max-w-[210mm] min-h-[297mm] bg-white text-black p-8 md:p-10 font-serif border border-neutral-300 rounded shadow-2xl relative"
        style={{
          fontFamily: "'Bookman Old Style', 'Times New Roman', serif",
          boxSizing: 'border-box',
        }}
      >
        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-3xl font-extrabold tracking-widest m-0 uppercase">US-BANGLA AIRLINES</h2>
          <h3 className="text-lg font-bold border-b-2 border-black pb-1.5 mt-1 tracking-wider uppercase">
            FLIGHT DEPARTURE REPORT
          </h3>
        </div>

        {/* Departure Table */}
        <table className="w-full border-2 border-black border-collapse text-[10.5pt]">
          <tbody>
            <tr className="border border-black">
              <td className="font-bold p-2 w-[35%] align-top">1. FLIGHT NO</td>
              <td className="p-2">: {flightNo} ({data.route || 'N/A'})</td>
            </tr>
            <tr className="border border-black">
              <td className="font-bold p-2 align-top">2. DATE</td>
              <td className="p-2">: {formattedDate}</td>
            </tr>
            <tr className="border border-black">
              <td className="font-bold p-2 align-top">3. DEPARTURE TIME</td>
              <td className="p-2 leading-relaxed">
                : STD: {data.std || 'N/A'} LT &nbsp; D/C: {data.doorClosed || 'N/A'} LT &nbsp; ATD: {data.chocksOff || 'N/A'} LT &nbsp; A/B: {data.airborne || 'N/A'} LT
                <div className="text-sm font-bold mt-1 text-black">: STATUS: {data.departureStatus || 'ON TIME'}</div>
              </td>
            </tr>
            <tr className="border border-black">
              <td className="font-bold p-2 align-top">4. A/C REGISTRATION</td>
              <td className="p-2">: {regDetails.display} ({data.acType || 'N/A'})</td>
            </tr>
            <tr className="border border-black">
              <td className="font-bold p-2 align-top">5. CAPTAIN</td>
              <td className="p-2">: CAPT. {data.captain || 'N/A'} ({data.configure || 'N/A'})</td>
            </tr>
            <tr className="border border-black">
              <td className="font-bold p-2 align-top">6. ORIGIN</td>
              <td className="p-2">: {origin}</td>
            </tr>
            <tr className="border border-black">
              <td className="font-bold p-2 align-top">7. DESTINATION</td>
              <td className="p-2">: {destination}</td>
            </tr>
            <tr className="border border-black">
              <td className="font-bold p-2 align-top">8. TOTAL PAX</td>
              <td className="p-2">: {passengerString}</td>
            </tr>
            <tr className="border border-black">
              <td className="font-bold p-2 align-top">9. TOTAL BAG/MAIL/CGO</td>
              <td className="p-2">: {bagMailCgoString}</td>
            </tr>
            <tr className="border border-black">
              <td className="font-bold p-2 align-top">10. CHECK IN STUFF</td>
              <td className="p-2">: {data.checkInStuff || 'N/A'}</td>
            </tr>
            <tr className="border border-black">
              <td className="font-bold p-2 align-top">11. LOADING STUFF / G7</td>
              <td className="p-2">: {data.loadingStuff || 'N/A'}</td>
            </tr>
            <tr className="border border-black">
              <td className="font-bold p-2 align-top">12. LOAD CONTROL</td>
              <td className="p-2">: {data.loadController || 'N/A'}</td>
            </tr>
            <tr className="border border-black">
              <td className="font-bold p-2 align-top">13. FUEL (UPLIFT)</td>
              <td className="p-2">: {data.fuelUplift || '0'} KGS</td>
            </tr>
            <tr className="border border-black">
              <td className="font-bold p-2 align-top">14. PAX HANDLING</td>
              <td className="p-2">: {data.paxHandling || 'N/A'}</td>
            </tr>
            <tr className="border border-black">
              <td className="font-bold p-2 align-top">15. VIP/CIP/MAAS/UM</td>
              <td className="p-2">: {specialHandlingOutput}</td>
            </tr>
            {/* 16. FIRE ARMS as requested */}
            <tr className="border border-black">
              <td className="font-bold p-2 align-top">16. FIRE ARMS</td>
              <td className="p-2">: {fireArmsValue}</td>
            </tr>
            {/* 17. REMARKS */}
            <tr className="border border-black">
              <td className="font-bold p-2 align-top">17. REMARKS</td>
              <td className="p-2 leading-relaxed">
                : &bull; OFFLOAD: {offloadString}
                <br />
                &bull; NOSHOW: {noshowString}
                {data.remarks && (
                  <div className="mt-1 font-semibold text-black">: {data.remarks}</div>
                )}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Footer Signatures */}
        <table className="w-full border-2 border-black border-collapse mt-8 text-[10.5pt]">
          <tbody>
            <tr className="border border-black">
              <td className="font-bold p-2.5 w-[35%]">PREPARED BY</td>
              <td className="p-2.5">: {user.userName.toUpperCase() || 'N/A'}</td>
            </tr>
            <tr className="border border-black">
              <td className="font-bold p-2.5">STUFF ID</td>
              <td className="p-2.5">: USBA-{user.usbaId.toUpperCase() || 'N/A'}</td>
            </tr>
            <tr className="border border-black">
              <td className="font-bold p-2.5 h-14 align-middle">SIGNATURE</td>
              <td className="p-2.5 align-middle">:</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
