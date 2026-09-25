import { FlightFormData, UserInfo } from '../types';
import { formatDate, getRegistrationDetails, getSeatConfig } from '../data/aviationData';

export function generateFlightDepartureMessage(
  data: FlightFormData,
  user: UserInfo,
  mode: 'intl' | 'dom' | 'ldm'
): string {
  const regDetails = getRegistrationDetails(data.acRegSuffix);
  const flightNo = `BS-${data.flightNoSuffix || 'XXX'}`;
  const timeUnit = mode === 'ldm' ? 'UTC' : 'LT';

  const dateStr = data.date || 'N/A';
  const route = data.route || 'N/A';
  const acReg = regDetails.display;
  const acType = data.acType || 'N/A';
  const captain = data.captain || 'N/A';
  const configure = data.configure || 'N/A';

  const std = data.std ? `${data.std} ${timeUnit}` : 'N/A';
  const doorClosed = data.doorClosed ? `${data.doorClosed} ${timeUnit}` : 'N/A';
  const chocksOff = data.chocksOff ? `${data.chocksOff} ${timeUnit}` : 'N/A';
  const airborne = data.airborne ? `${data.airborne} ${timeUnit}` : 'N/A';
  const departureStatus = data.departureStatus || 'ON TIME';
  const fuelUplift = data.fuelUplift || '0';

  let loadSummarySection = '';
  if (mode === 'ldm') {
    loadSummarySection = `PASSENGERS: AS PER SYSTEM
BAGGAGE: ${data.baggageWeight || '0'} KG / ${data.baggagePcs || '0'} PCS / COM NO ${data.baggageComNo || 'N/A'}
CREW BAG: ${data.crewBagPcs || '0'} PCS / COM NO ${data.crewBagComNo || 'N/A'}
CARGO: ${data.cargoWeight || '0'} KG / ${data.cargoPcs || '0'} PCS / COM NO ${data.cargoComNo || 'N/A'}
MAIL: ${data.mail || '0'}
UNDER LOAD: ${data.paxHandling || 'N/A'}`;
  } else {
    loadSummarySection = `PASSENGERS: AS PER SYSTEM
BAGGAGE: ${data.baggageWeight || '0'} KG / ${data.baggagePcs || '0'} PCS
CARGO: ${data.cargoWeight || '0'} KG / ${data.cargoPcs || '0'} PCS
MAIL: ${data.mail || '0'}`;
  }

  let paxHandlingSection = '';
  if (mode === 'dom') {
    paxHandlingSection = `COUNTER NOSHOW: ${data.counterNoshow || '0'}
GATE NO SHOW: ${data.gateNoShow || '0'}
SELF OFFLOAD: ${data.selfOffload || '0'}`;
  } else {
    paxHandlingSection = `COUNTER NOSHOW: ${data.counterNoshow || '0'}
GATE NO SHOW: ${data.gateNoShow || '0'}
SELF OFFLOAD: ${data.selfOffload || '0'}
REFUSED: ${data.refused || '0'}
IMMIGRATION OFF: ${data.immigrationOff || '0'}
IMMIGRATION NOT FACE: ${data.immigrationNotFace || '0'}
CUSTOM OFF: ${data.customOff || '0'}`;
  }

  let specialHandlingSection = '';
  if (mode === 'ldm') {
    specialHandlingSection = `MAAS: ${data.maas || '0'}
UM PAX: ${data.umPax || '0'}
WCHR: ${data.wchrFig || '0'} (${data.wchrSeat || 'N/A'})
WCHC: ${data.wchcFig || '0'} (${data.wchcSeat || 'N/A'})`;
  } else {
    specialHandlingSection = `VIP: ${data.vip || '0'}
CIP: ${data.cip || '0'}
MAAS: ${data.maas || '0'}
UM PAX: ${data.umPax || '0'}
FIRE ARMS: ${data.fireArms || 'NIL'}
WCHR: ${data.wchrFig || '0'} (${data.wchrSeat || 'N/A'})
WCHC: ${data.wchcFig || '0'} (${data.wchcSeat || 'N/A'})`;
  }

  return `FLIGHT DEPARTURE MESSAGE
--------------------------------------
DATE: ${dateStr}
FLIGHT NO: ${flightNo} (${route})
A/C REG: ${acReg}
A/C TYPE: ${acType}
CAPTAIN: ${captain}
CONFIGURE: ${configure}

FLIGHT OPERATIONS SUMMARY
--------------------------------------
STD: ${std}
DOOR CLOSED: ${doorClosed}
CHOCKS OFF: ${chocksOff}
AIRBORNE: ${airborne}
DEPARTURE STATUS: ${departureStatus}
FUEL UPLIFT: ${fuelUplift} KG

LOAD SUMMARY
--------------------------------------
${loadSummarySection}

PASSENGER HANDLING DETAILS
--------------------------------------
${paxHandlingSection}

SPECIAL HANDLING
--------------------------------------
${specialHandlingSection}

DUTY PERSONNEL:
--------------------------------------
RAMP OFFICER: ${(data.rampOfficer || data.loadingStuff || 'N/A').toUpperCase()}
CHECK IN STAFF: ${(data.checkInStaff || data.checkInStuff || 'N/A').toUpperCase()}
LOAD CONTROLLER: ${(data.loadController || 'N/A').toUpperCase()}

NOSHOW PNR:
--------------------------------------
${(data.noshowPnr || 'NIL').toUpperCase()}

REMARKS:
--------------------------------------
${(data.remarks || 'NIL').toUpperCase()}

--------------------------------------
PREPARED BY:
NAME: ${user.userName.toUpperCase() || 'N/A'}
ID: ${user.usbaId.toUpperCase() || 'N/A'}
STATION: ${user.stationName.toUpperCase() || 'DHAKA'}`;
}

export function generateLdmForDestination(data: FlightFormData, user: UserInfo): string {
  const destination = (data.route.split('-')[1] || '').toUpperCase();
  const regDetails = getRegistrationDetails(data.acRegSuffix);
  const regLdm = regDetails.ldm;

  const dynamicRegards = `REGARDS,
______________________________
${(user.userName || 'N/A').toUpperCase()}
LOAD CONTROL OFFICER II
USBA-${(user.usbaId || 'N/A').toUpperCase()} II DAC APT II`;

  const bagW = parseInt(data.baggageWeight, 10) || 0;
  const cgoW = parseInt(data.cargoWeight, 10) || 0;
  const totalLoad = bagW + cgoW;

  const isAirbus = (data.acType || '').toUpperCase().includes('AIRBUS');
  const isAtr = (data.acType || '').toUpperCase().includes('ATR');

  const dist = data.dist || {};
  const dist1 = isAirbus ? (dist.a1 || '0') : (dist.b1 || '0');
  const dist2 = isAirbus ? (dist.a2 || '0') : (dist.b2 || '0');
  const dist3 = isAirbus ? (dist.a3 || '0') : (dist.b3 || '0');
  const dist4 = isAirbus ? (dist.a4 || '0') : (dist.b4 || '0');
  const dist5 = isAirbus ? (dist.a5 || '0') : '0';

  const cleanRegForConfig = regLdm.replace(/^S2/, '').replace(/^PK/, '').replace(/^9H/, '');
  const seatConfig = getSeatConfig(cleanRegForConfig || data.acRegSuffix);

  const siLines: string[] = [];

  let crewBagSiLine = '';
  const crewPcs = parseInt(data.crewBagPcs || '0', 10);
  if (crewPcs > 0 && data.crewBagComNo && data.crewBagComNo !== 'N/A') {
    crewBagSiLine = `SI CREWBAG :${String(crewPcs).padStart(2, '0')}/C${data.crewBagComNo}`;
  }

  let comailSiLine = '';
  const mailPcs = parseInt((data.mail || '').replace(/\D/g, ''), 10);
  if (!isNaN(mailPcs) && mailPcs > 0) {
    if (mailPcs === 1) {
      comailSiLine = `SI COMAIL: ${String(mailPcs).padStart(2, '0')} PC`;
    } else {
      comailSiLine = `SI COMAIL: ${String(mailPcs).padStart(2, '0')} PCS`;
    }
  }

  const siWcLines: string[] = [];
  const wchrFigNum = parseInt(data.wchrFig || '0', 10);
  if (wchrFigNum > 0 && data.wchrSeat && data.wchrSeat !== 'N/A') {
    siWcLines.push(`SI WCHR: ${String(wchrFigNum).padStart(2, '0')} (${data.wchrSeat})`);
  }
  const wchcFigNum = parseInt(data.wchcFig || '0', 10);
  if (wchcFigNum > 0 && data.wchcSeat && data.wchcSeat !== 'N/A') {
    siWcLines.push(`SI WCHC: ${String(wchcFigNum).padStart(2, '0')} (${data.wchcSeat})`);
  }
  const wcSiString = siWcLines.join('\n');

  let ldm = '';

  switch (destination) {
    case 'DOH': {
      if (regLdm.includes('AL')) {
        const bagComsDoh = data.baggageComNo ? data.baggageComNo.split(',').map((s) => s.trim()) : [];
        const cgoComsDoh = data.cargoComNo ? data.cargoComNo.split(',').map((s) => s.trim()) : [];

        const getCptLineDoh = (cptNum: number) => {
          const sNum = String(cptNum);
          const hasBag = bagComsDoh.includes(sNum);
          const hasCgo = cgoComsDoh.includes(sNum);
          if (hasBag && hasCgo) return 'BAG/CGO BY';
          if (hasBag) return 'BAG BY';
          if (hasCgo) return 'CGO BY';
          return 'NIL';
        };

        ldm = `LDM\nBS${data.flightNoSuffix}/${formatDate(data.date, 'DDMONYY')}.${regLdm}.${seatConfig}.${data.configure}\n` +
          `-${destination}.${data.paxMale || '00'}/${data.paxFemale || '00'}/${data.paxChild || '00'}/${data.paxInfant || '00'}.T.${totalLoad}.1/${dist1}.2/${dist2}.3/${dist3}.4/${dist4}.5/${dist5}.PAX.00/${data.paxTotal || '000'}.PAD/0/0\n` +
          `CPT1- ${getCptLineDoh(1)}\n` +
          `CPT2- ${getCptLineDoh(2)}\n` +
          `CPT3- ${getCptLineDoh(3)}\n` +
          `CPT4- ${getCptLineDoh(4)}\n` +
          `CPT5- ${getCptLineDoh(5)}\n\n` +
          `${destination} FRE 0 POS 0 BAG ${data.baggagePcs || '0'} PCS /${data.baggageWeight || '0'} KGS EQP 0 TRA 0\n` +
          `${destination} FRE 0 POS 0 CGO ${data.cargoPcs || '0'} PCS/ ${data.cargoWeight || '0'} KGS EQP 0 TRA 0\n`;
      } else {
        ldm = `LDM\nBS${data.flightNoSuffix}/${formatDate(data.date, 'DDMONYY')}.${regLdm}.${seatConfig}.${data.configure}\n` +
          `-${destination}.${data.paxMale || '00'}/${data.paxFemale || '00'}/${data.paxChild || '00'}/${data.paxInfant || '00'}.T.${totalLoad}.1/${dist1}.2/${dist2}.3/${dist3}.4/${dist4}.PAX.00/${data.paxTotal || '000'}.PAD/0/0\n` +
          `CPT1- ${parseInt(dist1, 10) > 0 ? 'BAG/CGO BY' : 'NIL'}\n` +
          `CPT2- BAG BY\n` +
          `CPT3- BAG BY\n` +
          `CPT4- ${parseInt(dist4, 10) > 0 ? 'BAG/CGO BY' : 'NIL'}\n\n` +
          `${destination} FRE 0 POS 0 BAG ${data.baggagePcs || '0'} PCS /${data.baggageWeight || '0'} KGS EQP 0 TRA 0\n` +
          `${destination} FRE 0 POS 0 CGO ${data.cargoPcs || '0'} PCS/ ${data.cargoWeight || '0'} KGS EQP 0 TRA 0\n`;
      }

      if (crewBagSiLine) siLines.push(crewBagSiLine);
      if (wcSiString) siLines.push(wcSiString);
      if (comailSiLine) siLines.push(comailSiLine);
      if (siLines.length > 0) ldm += `\n${siLines.join('\n')}`;
      ldm += `\n\n\nEND\n\n\n${dynamicRegards}`;
      break;
    }

    case 'SHJ':
    case 'DXB':
    case 'AUH': {
      if (regLdm.includes('AL')) {
        const bagComs = data.baggageComNo ? data.baggageComNo.split(',').map((s) => s.trim()) : [];
        const cgoComs = data.cargoComNo ? data.cargoComNo.split(',').map((s) => s.trim()) : [];

        const getCptLineAirbus = (cptNum: number) => {
          const sNum = String(cptNum);
          const hasBag = bagComs.includes(sNum);
          const hasCgo = cgoComs.includes(sNum);
          if (hasBag && hasCgo) return 'BAG+CGO BY';
          if (hasBag) return 'BAG BY';
          if (hasCgo) return 'CGO BY';
          return 'NIL';
        };

        ldm = `LDM\nBS${data.flightNoSuffix}/${formatDate(data.date, 'DDMON')}.${regLdm}.${seatConfig}.${data.configure}\n` +
          `-${destination}.${data.paxMale || '00'}/${data.paxFemale || '00'}/${data.paxChild || '00'}/${data.paxInfant || '00'}.T.${totalLoad}.1/${dist1}.2/${dist2}.3/${dist3}.4/${dist4}.5/${dist5}.PAX/0/${data.paxTotal || '000'}.PAD/0/0\n\n` +
          `CPT1- ${getCptLineAirbus(1)}\n` +
          `CPT2- ${getCptLineAirbus(2)}\n` +
          `CPT3- ${getCptLineAirbus(3)}\n` +
          `CPT4- ${getCptLineAirbus(4)}\n` +
          `CPT5- ${getCptLineAirbus(5)}\n\n` +
          `${destination} C     ${data.cargoPcs || '0'}/     ${data.cargoWeight || '0'} M     0 B     ${data.baggagePcs || '0'}/     ${data.baggageWeight || '0'} O     0 T       0\n`;
      } else {
        const getCptLine = (cptNum: number, bComs: string[], cComs: string[]) => {
          const hasBag = bComs.includes(String(cptNum));
          const hasCgo = cComs.includes(String(cptNum));
          let content = 'NIL';
          if (hasBag && hasCgo) content = 'BAG+CGO BY';
          else if (hasBag) content = 'BAG BY';
          else if (hasCgo) content = 'CGO BY';
          return `CPT${cptNum}- ${content}`;
        };

        const bComs = (data.baggageComNo || '').split(',').map((s) => s.trim());
        const cComs = (data.cargoComNo || '').split(',').map((s) => s.trim());

        ldm = `LDM\nBS${data.flightNoSuffix}/${formatDate(data.date, 'DDMON')}.${regLdm}.${seatConfig}.${data.configure}\n` +
          `-${destination}.${data.paxMale || '00'}/${data.paxFemale || '00'}/${data.paxChild || '00'}/${data.paxInfant || '00'}.T.${totalLoad}.1/${dist1}.2/${dist2}.3/${dist3}.4/${dist4}.PAX/0/${data.paxTotal || '000'}.PAD/0/0\n\n` +
          `${getCptLine(1, bComs, cComs)}\n` +
          `${getCptLine(2, bComs, cComs)}\n` +
          `${getCptLine(3, bComs, cComs)}\n` +
          `${getCptLine(4, bComs, cComs)}\n\n` +
          `${destination} C     ${data.cargoPcs || '0'}/     ${data.cargoWeight || '0'} M     0 B     ${data.baggagePcs || '0'}/     ${data.baggageWeight || '0'} O     0 T       0\n`;
      }

      if (wcSiString) siLines.push(wcSiString);
      if (crewBagSiLine) siLines.push(crewBagSiLine);
      if (comailSiLine) siLines.push(comailSiLine);
      if (siLines.length > 0) ldm += `${siLines.join('\n')}\n`;
      ldm += `\n\n\nEND\n\n\n${dynamicRegards}`;
      break;
    }

    case 'MCT': {
      let loadLineMct = '';
      if (regLdm.includes('AL')) {
        loadLineMct = `-${destination}.${data.paxMale || '00'}/${data.paxFemale || '00'}/${data.paxChild || '00'}/${data.paxInfant || '00'}.T.${totalLoad}.1/${dist1}.2/${dist2}.3/${dist3}.4/${dist4}.5/${dist5}.PAX.00/${data.paxTotal || '000'}.PAD/0/0`;
      } else {
        loadLineMct = `-${destination}.${data.paxMale || '00'}/${data.paxFemale || '00'}/${data.paxChild || '00'}/${data.paxInfant || '00'}.T.${totalLoad}.1/${dist1}.2/${dist2}.3/${dist3}.4/${dist4}.PAX.00/${data.paxTotal || '000'}.PAD/0/0`;
      }

      ldm = `LDM\nBS${data.flightNoSuffix}/${formatDate(data.date, 'DDMON')}.${regLdm}.${seatConfig}.${data.configure}\n` +
        `${loadLineMct}\n\n` +
        `${destination} FRE 0 POS 0 BAG ${data.baggagePcs || '0'} PCS/${data.baggageWeight || '0'} KGS EQP 0 TRA 0\n` +
        `${destination} FRE 0 POS 0 CGO ${data.cargoPcs || '0'} PCS/${data.cargoWeight || '0'} KGS  EQP 0 TRA 0\n\n`;

      const maasNum = parseInt(data.maas || '0', 10);
      siLines.push(`SI: MAAS ${String(maasNum).padStart(2, '0')}`);
      if (wcSiString) siLines.push(wcSiString);
      if (crewBagSiLine) siLines.push(crewBagSiLine);
      if (comailSiLine) siLines.push(comailSiLine);
      ldm += `${siLines.join('\n')}\n`;
      ldm += `\n\n\nEND\n\n\n${dynamicRegards}`;
      break;
    }

    case 'RUH':
    case 'JED': {
      const wcLinesRuh: string[] = [];
      if (wchrFigNum > 0 && data.wchrSeat && data.wchrSeat !== 'N/A') {
        const formattedWchrSeat = data.wchrSeat.replace(/,\s*/g, '/');
        wcLinesRuh.push(`SI O/B 0 WCHR: ${String(wchrFigNum).padStart(2, '0')} SN ${formattedWchrSeat}`);
      }
      if (wchcFigNum > 0 && data.wchcSeat && data.wchcSeat !== 'N/A') {
        const formattedWchcSeat = data.wchcSeat.replace(/,\s*/g, '/');
        wcLinesRuh.push(`SI O/B 0 WCHC: ${String(wchcFigNum).padStart(2, '0')} SN ${formattedWchcSeat}`);
      }
      const wcStringRuh = wcLinesRuh.join('\n');

      const dists = isAirbus
        ? `.1/${dist1}.2/${dist2}.3/${dist3}.4/${dist4}.5/${dist5}`
        : `.1/${dist1}.2/${dist2}.3/${dist3}.4/${dist4}`;

      ldm = `LDM\nBS${data.flightNoSuffix}/${formatDate(data.date, 'DD')}.${regLdm}.${seatConfig}.${data.configure}\n` +
        `-${destination}.${data.paxMale || '00'}/${data.paxFemale || '00'}/${data.paxChild || '00'}/${data.paxInfant || '00'}.T${totalLoad}${dists}.PAX/0/${data.paxTotal || '000'}.PAD/0/0\n`;
      if (wcStringRuh) {
        ldm += `${wcStringRuh}\n`;
      }
      ldm += `SI ${destination} C     ${data.cargoPcs || '0'}/     ${data.cargoWeight || '0'} M     0    B     ${data.baggagePcs || '0'}/     ${data.baggageWeight || '0'} O     0 T     0\n`;
      if (crewBagSiLine) ldm += `${crewBagSiLine}\n`;
      if (comailSiLine) ldm += `${comailSiLine}\n`;
      ldm += `\nEND\n\n\n${dynamicRegards}`;
      break;
    }

    case 'CCU': {
      if (data.baggageComNo && data.baggageComNo !== 'N/A' && parseInt(data.baggagePcs || '0', 10) > 0) {
        siLines.push(`SI: ALL BAG LDD IN C: ${data.baggageComNo} - ${data.baggagePcs} PCS/ ${data.baggageWeight} KGS.`);
      }
      if (data.cargoComNo && data.cargoComNo !== 'N/A' && parseInt(data.cargoPcs || '0', 10) > 0) {
        siLines.push(`SI: ALL CGO LDD IN C: ${data.cargoComNo} - ${data.cargoPcs} PCS/ ${data.cargoWeight} KGS`);
      }
      if (parseInt(data.maas || '0', 10) > 0) {
        siLines.push(`SI MAAS - ${String(data.maas).padStart(2, '0')}`);
      }
      if (wcSiString) siLines.push(wcSiString);
      if (crewBagSiLine) siLines.push(crewBagSiLine);
      if (comailSiLine) siLines.push(comailSiLine);

      const distsCCU = isAirbus
        ? `.1/${dist1}.2/${dist2}.3/${dist3}.4/${dist4}.5/${dist5}`
        : `.1/${dist1}.2/${dist2}.3/${dist3}.4/${dist4}`;

      let loadLineCCU = '';
      if (isAtr) {
        loadLineCCU = `-${destination}.${data.paxMale || '00'}/${data.paxFemale || '00'}/${data.paxChild || '00'}/${data.paxInfant || '00'}.T.${totalLoad}.H- FWD&AFT.\nPAX.00/${data.paxTotal || '000'}.PAD.00/00`;
      } else {
        loadLineCCU = `-${destination}.${data.paxMale || '00'}/${data.paxFemale || '00'}/${data.paxChild || '00'}/${data.paxInfant || '00'}.T.${totalLoad}${distsCCU}.\nPAX.00/${data.paxTotal || '000'}.PAD.00/00`;
      }

      ldm = `LDM\n\nBS${data.flightNoSuffix}/${formatDate(data.date, 'DDMONYY')}.${regLdm}.${seatConfig}.${data.configure}\n` +
        `${loadLineCCU}\n\n` +
        (siLines.length > 0 ? siLines.join('\n') : '') +
        `\n\nEND\n\n\n${dynamicRegards}`;
      break;
    }

    default: {
      if (data.baggageComNo && data.baggageComNo !== 'N/A' && parseInt(data.baggagePcs || '0', 10) > 0) {
        siLines.push(`SI: ALL BAG LDD IN C: ${data.baggageComNo} - ${data.baggagePcs} PCS/ ${data.baggageWeight} KGS.`);
      }
      if (data.cargoComNo && data.cargoComNo !== 'N/A' && parseInt(data.cargoPcs || '0', 10) > 0) {
        siLines.push(`SI: ALL CGO LDD IN C: ${data.cargoComNo} - ${data.cargoPcs} PCS/ ${data.cargoWeight} KGS`);
      }
      if (parseInt(data.maas || '0', 10) > 0) {
        siLines.push(`SI MAAS - ${String(data.maas).padStart(2, '0')}`);
      }
      if (wcSiString) siLines.push(wcSiString);
      if (crewBagSiLine) siLines.push(crewBagSiLine);
      if (comailSiLine) siLines.push(comailSiLine);

      const distsDefault = isAirbus
        ? `.1/${dist1}.2/${dist2}.3/${dist3}.4/${dist4}.5/${dist5}`
        : `.1/${dist1}.2/${dist2}.3/${dist3}.4/${dist4}`;

      let loadLineDefault = '';
      if (isAtr) {
        loadLineDefault = `-${destination}.${data.paxMale || '00'}/${data.paxFemale || '00'}/${data.paxChild || '00'}/${data.paxInfant || '00'}.T.${totalLoad}.H- FWD&AFT.\nPAX.00/${data.paxTotal || '000'}.PAD.00/00`;
      } else {
        loadLineDefault = `-${destination}.${data.paxMale || '00'}/${data.paxFemale || '00'}/${data.paxChild || '00'}/${data.paxInfant || '00'}.T.${totalLoad}${distsDefault}.PAX.00/${data.paxTotal || '000'}.PAD.00/00`;
      }

      ldm = `LDM\n\nBS${data.flightNoSuffix}/${formatDate(data.date, 'DDMONYY')}.${regLdm}.${seatConfig}.${data.configure}\n` +
        `${loadLineDefault}\n\n` +
        (siLines.length > 0 ? siLines.join('\n') : '') +
        `\n\nEND\n\n\n${dynamicRegards}`;
      break;
    }
  }

  return ldm;
}
