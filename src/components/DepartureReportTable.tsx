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
  const formattedDate = data.date ? formatDate(data.date, 'LONG').toUpperCase() : 'N/A';
  const flightNo = `BS-${data.flightNoSuffix || 'XXX'}`;
  const routeParts = (data.route || '').split('-');
  const origin = (routeParts[0] || user.stationName || 'DAC').toUpperCase();
  const destination = (routeParts[1] || 'N/A').toUpperCase();

  const passengerString = `LOAD-${data.flightLoad || '0'}   ACTUAL-${data.paxMale || '0'}+${data.paxFemale || '0'}+${data.paxChild || '0'}+${data.paxInfant || '0'} =${data.paxTotal || '0'}+${data.paxInfant || '0'}`;
  const bagMailCgoString = `BAG: ${data.baggagePcs || '0'} PCS/${data.baggageWeight || '0'} KGS   MAIL: ${(data.mail || '0').toUpperCase()}   CGO: ${data.cargoPcs || '0'} PCS/${data.cargoWeight || '0'} KGS`;

  const specialHandlingParts: string[] = [];
  if (parseInt(data.maas || '0', 10) > 0) specialHandlingParts.push(`MAAS: ${data.maas}`);
  if (parseInt(data.umPax || '0', 10) > 0) specialHandlingParts.push(`UM: ${data.umPax}`);
  if (parseInt(data.vip || '0', 10) > 0) specialHandlingParts.push(`VIP: ${data.vip}`);
  if (parseInt(data.cip || '0', 10) > 0) specialHandlingParts.push(`CIP: ${data.cip}`);
  const specialHandlingOutput = specialHandlingParts.length > 0 ? specialHandlingParts.join(' / ').toUpperCase() : 'NIL';

  const offloadParts: string[] = [];
  if (parseInt(data.gateNoShow || '0', 10) > 0) offloadParts.push(`GATE NO SHOW ${data.gateNoShow}`);
  if (parseInt(data.selfOffload || '0', 10) > 0) offloadParts.push(`SELF OFF ${data.selfOffload}`);
  if (mode === 'intl') {
    if (parseInt(data.refused || '0', 10) > 0) offloadParts.push(`REFUSED ${data.refused}`);
    if (parseInt(data.immigrationOff || '0', 10) > 0) offloadParts.push(`IMMI OFF ${data.immigrationOff}`);
  }
  const offloadString = offloadParts.length > 0 ? offloadParts.join(', ').toUpperCase() : 'NIL';

  // NOSHOW PNR: Use explicit input box if filled, else check remarks or NIL
  const noshowValue = data.noshowPnr && data.noshowPnr.trim()
    ? data.noshowPnr.trim().toUpperCase()
    : 'NIL';

  const fireArmsValue = data.fireArms && data.fireArms.trim() ? data.fireArms.toUpperCase() : 'NIL';
  const checkInStaffValue = (data.checkInStaff || data.checkInStuff || 'N/A').toUpperCase();
  const rampOfficerValue = (data.rampOfficer || data.loadingStuff || 'N/A').toUpperCase();
  const loadControllerValue = (data.loadController || 'N/A').toUpperCase();
  const paxHandlingValue = (data.paxHandling || 'N/A').toUpperCase();

  const isOutstation = (user.stationName || 'DAC').trim().toUpperCase() !== 'DAC';
  const s = isOutstation ? 1 : 0;

  return (
    <div className="w-full flex justify-center py-2 print:py-0 uppercase">
      {/* Actual A4 Sized Container Preview (210mm x 297mm proportions) */}
      <div
        id="printable-right-table"
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
            FLIGHT DEPARTURE REPORT
          </h3>
        </div>

        {/* Departure Table */}
        <table className="w-full border-2 border-black border-collapse text-[10.5pt] print:text-[9.5pt] text-black">
          <tbody>
            <tr className="border border-black">
              <td className="font-bold p-2 w-[35%] align-top border-r border-black">1. FLIGHT NO</td>
              <td className="p-2">: {flightNo} ({data.route || 'N/A'})</td>
            </tr>
            <tr className="border border-black">
              <td className="font-bold p-2 align-top border-r border-black">2. DATE</td>
              <td className="p-2">: {formattedDate}</td>
            </tr>
            {isOutstation && (
              <tr className="border border-black">
                <td className="font-bold p-2 align-top border-r border-black">3. ARRIVAL TIME</td>
                <td className="p-2 leading-relaxed">
                  : STA: {data.sta || 'N/A'} LT &nbsp; C/ON: {data.chocksOn || 'N/A'} LT &nbsp; DOOR OPEN: {data.doorOpen || 'N/A'} LT
                  <div className="text-sm print:text-[9.5pt] font-bold mt-0.5 text-black uppercase">
                    : STATUS: {(data.arrivalStatus || 'FLIGHT ON TIME ARRIVED').toUpperCase()}
                  </div>
                </td>
              </tr>
            )}
            <tr className="border border-black">
              <td className="font-bold p-2 align-top border-r border-black">{3 + s}. DEPARTURE TIME</td>
              <td className="p-2 leading-relaxed">
                : STD: {data.std || 'N/A'} LT &nbsp; D/C: {data.doorClosed || 'N/A'} LT &nbsp; ATD: {data.chocksOff || 'N/A'} LT &nbsp; A/B: {data.airborne || 'N/A'} LT
                <div className="text-sm print:text-[9.5pt] font-bold mt-0.5 text-black uppercase">
                  : STATUS: {(data.departureStatus || 'ON TIME').toUpperCase()}
                </div>
              </td>
            </tr>
            <tr className="border border-black">
              <td className="font-bold p-2 align-top border-r border-black">{4 + s}. A/C REGISTRATION</td>
              <td className="p-2">: {regDetails.display} ({(data.acType || 'N/A').toUpperCase()})</td>
            </tr>
            <tr className="border border-black">
              <td className="font-bold p-2 align-top border-r border-black">{5 + s}. CAPTAIN</td>
              <td className="p-2">: CAPT. {(data.captain || 'N/A').toUpperCase()} ({(data.configure || 'N/A').toUpperCase()})</td>
            </tr>
            <tr className="border border-black">
              <td className="font-bold p-2 align-top border-r border-black">{6 + s}. ORIGIN</td>
              <td className="p-2">: {origin}</td>
            </tr>
            <tr className="border border-black">
              <td className="font-bold p-2 align-top border-r border-black">{7 + s}. DESTINATION</td>
              <td className="p-2">: {destination}</td>
            </tr>
            <tr className="border border-black">
              <td className="font-bold p-2 align-top border-r border-black">{8 + s}. TOTAL PAX</td>
              <td className="p-2">: {passengerString}</td>
            </tr>
            <tr className="border border-black">
              <td className="font-bold p-2 align-top border-r border-black">{9 + s}. TOTAL BAG/MAIL/CGO</td>
              <td className="p-2">: {bagMailCgoString}</td>
            </tr>
            <tr className="border border-black">
              <td className="font-bold p-2 align-top border-r border-black">{10 + s}. CHECK IN STAFF</td>
              <td className="p-2">: {checkInStaffValue}</td>
            </tr>
            <tr className="border border-black">
              <td className="font-bold p-2 align-top border-r border-black">{11 + s}. RAMP OFFICER</td>
              <td className="p-2">: {rampOfficerValue}</td>
            </tr>
            <tr className="border border-black">
              <td className="font-bold p-2 align-top border-r border-black">{12 + s}. LOAD CONTROL</td>
              <td className="p-2">: {loadControllerValue}</td>
            </tr>
            <tr className="border border-black">
              <td className="font-bold p-2 align-top border-r border-black">{13 + s}. FUEL (UPLIFT)</td>
              <td className="p-2">: {data.fuelUplift || '0'} KGS</td>
            </tr>
            <tr className="border border-black">
              <td className="font-bold p-2 align-top border-r border-black">{14 + s}. PAX HANDLING</td>
              <td className="p-2">: {paxHandlingValue}</td>
            </tr>
            <tr className="border border-black">
              <td className="font-bold p-2 align-top border-r border-black">{15 + s}. VIP/CIP/MAAS/UM</td>
              <td className="p-2">: {specialHandlingOutput}</td>
            </tr>
            {/* FIRE ARMS */}
            <tr className="border border-black">
              <td className="font-bold p-2 align-top border-r border-black">{16 + s}. FIRE ARMS</td>
              <td className="p-2">: {fireArmsValue}</td>
            </tr>
            {/* REMARKS */}
            <tr className="border border-black">
              <td className="font-bold p-2 align-top border-r border-black">{17 + s}. REMARKS</td>
              <td className="p-2 leading-relaxed">
                : &bull; OFFLOAD: {offloadString}
                <br />
                &bull; NOSHOW: {noshowValue}
                {data.remarks && data.remarks.trim() && (
                  <div className="mt-0.5 font-semibold text-black uppercase">
                    : {data.remarks.trim().toUpperCase()}
                  </div>
                )}
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
