import XLSX from 'xlsx-js-style';
import { StoredFlightReport, ActivityLogEntry } from '../firebase';

// Helper to format 4-digit time or string to HH:MM
export const formatToHHMM = (val?: string): string => {
  if (!val) return '--';
  const clean = val.replace(/\D/g, '');
  if (clean.length === 4) {
    return `${clean.slice(0, 2)}:${clean.slice(2, 4)}`;
  }
  if (val.includes(':')) return val.trim();
  return val.trim() || '--';
};

// Helper to parse HH:MM or HHMM to minutes
export const parseTimeToMinutes = (val: string): number | null => {
  if (!val) return null;
  const clean = val.replace(/\D/g, '');
  if (clean.length === 4) {
    const hours = parseInt(clean.slice(0, 2), 10);
    const mins = parseInt(clean.slice(2, 4), 10);
    if (hours >= 0 && hours < 24 && mins >= 0 && mins < 60) {
      return hours * 60 + mins;
    }
  }
  if (val.includes(':')) {
    const parts = val.split(':');
    const hours = parseInt(parts[0], 10);
    const mins = parseInt(parts[1], 10);
    if (!isNaN(hours) && !isNaN(mins) && hours >= 0 && hours < 24 && mins >= 0 && mins < 60) {
      return hours * 60 + mins;
    }
  }
  return null;
};

// Helper for time difference and status
export const getTimeDiffAndStatus = (
  schedStr?: string,
  actStr?: string
): { diff: number; status: 'ON TIME' | 'EARLY' | 'DELAY'; minsStr: string } => {
  const sMin = parseTimeToMinutes(schedStr || '');
  const aMin = parseTimeToMinutes(actStr || '');
  if (sMin === null || aMin === null) {
    return { diff: 0, status: 'ON TIME', minsStr: '00' };
  }
  let diff = aMin - sMin;
  if (diff < -720) diff += 1440;
  else if (diff > 720) diff -= 1440;

  if (diff === 0) {
    return { diff: 0, status: 'ON TIME', minsStr: '00' };
  }
  if (diff > 0) {
    return { diff, status: 'DELAY', minsStr: String(diff).padStart(2, '0') };
  }
  return {
    diff: Math.abs(diff),
    status: 'EARLY',
    minsStr: String(Math.abs(diff)).padStart(2, '0'),
  };
};

// Helper for ground time formatted
export const getGroundTimeFormatted = (ataStr?: string, atdStr?: string): string => {
  const aMin = parseTimeToMinutes(ataStr || '');
  const dMin = parseTimeToMinutes(atdStr || '');
  if (aMin === null || dMin === null) return '--';
  let diff = dMin - aMin;
  if (diff < 0) diff += 1440;
  const hours = Math.floor(diff / 60);
  const mins = diff % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

// Trigger download in browser
export const downloadWorkbookAsXlsx = (wb: XLSX.WorkBook, filename: string): void => {
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const cleanName = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  link.setAttribute('download', cleanName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// Standard thin border style
const thinBorder = {
  top: { style: 'thin', color: { rgb: '000000' } },
  bottom: { style: 'thin', color: { rgb: '000000' } },
  left: { style: 'thin', color: { rgb: '000000' } },
  right: { style: 'thin', color: { rgb: '000000' } },
};

/**
 * 1. OUTSTATION FLIGHT STATUS EXCEL (.xlsx)
 * Exactly matching Attachment 1:
 * - File Type: Microsoft Excel Worksheet (.xlsx)
 * - Row 1: Merged Title "Flight Status DD MONTH YYYY" (Bold 16pt, Centered)
 * - Row 2: Merged "US-Bangla Airlines" (Bold 13pt, Navy Blue #1E4B7A, White text)
 * - Row 3: Dark Header row (#3D3D3D) with 14 columns
 * - Row 4+: Data rows with status color highlights (DELAY red, EARLY green, ON TIME yellow/amber)
 */
export const exportOutstationFlightStatusXlsx = (
  reports: StoredFlightReport[],
  stationCode: string
): string => {
  const todayIso = new Date().toISOString().split('T')[0];
  const rawFlightDate = reports[0]?.date || todayIso;
  const parsedDate = new Date(rawFlightDate + 'T00:00:00Z');
  const formattedDateForHeader = !isNaN(parsedDate.getTime())
    ? `${String(parsedDate.getUTCDate()).padStart(2, '0')} ${parsedDate
        .toLocaleString('en-GB', { month: 'long', timeZone: 'UTC' })
        .toUpperCase()} ${parsedDate.getUTCFullYear()}`
    : rawFlightDate;

  const wb = XLSX.utils.book_new();
  const ws: XLSX.WorkSheet = {};

  // Row 1 (r=0): Flight Status Title
  ws['A1'] = {
    v: `Flight Status ${formattedDateForHeader}`,
    t: 's',
    s: {
      font: { name: 'Calibri', sz: 16, bold: true, color: { rgb: '000000' } },
      alignment: { horizontal: 'center', vertical: 'center' },
    },
  };

  // Row 2 (r=1): US-Bangla Airlines Subtitle
  ws['A2'] = {
    v: 'US-Bangla Airlines',
    t: 's',
    s: {
      font: { name: 'Calibri', sz: 13, bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: '1E4B7A' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: thinBorder,
    },
  };

  // Fill in empty merged cells for Row 1 & 2 so borders/styles look clean
  for (let c = 1; c < 14; c++) {
    const cellA1 = XLSX.utils.encode_cell({ r: 0, c });
    ws[cellA1] = {
      v: '',
      t: 's',
      s: { alignment: { horizontal: 'center', vertical: 'center' } },
    };
    const cellA2 = XLSX.utils.encode_cell({ r: 1, c });
    ws[cellA2] = {
      v: '',
      t: 's',
      s: {
        fill: { fgColor: { rgb: '1E4B7A' } },
        border: thinBorder,
      },
    };
  }

  // Row 3 (r=2): Table Headers
  const headers = [
    'Flight No',
    'STA',
    'ATA',
    'Minutes',
    'Status',
    'PAX',
    'Flight No',
    'STD',
    'ATD',
    'Minutes',
    'GT',
    'Status',
    'PAX',
    'REMARKS',
  ];

  headers.forEach((h, colIdx) => {
    const cellRef = XLSX.utils.encode_cell({ r: 2, c: colIdx });
    ws[cellRef] = {
      v: h,
      t: 's',
      s: {
        font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '3D3D3D' } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border: thinBorder,
      },
    };
  });

  // Row 4+ (r=3...): Data rows
  reports.forEach((r, rowIdx) => {
    const rIdx = 3 + rowIdx;
    const raw = r.rawFormData;

    // Arrival Flight Number
    const rawFltDigits = (r.flightNo || '').replace(/\D/g, '');
    const parsedFltNum = parseInt(rawFltDigits, 10);
    const autoArrNum =
      !isNaN(parsedFltNum) && parsedFltNum > 0
        ? String(parsedFltNum % 2 === 0 ? parsedFltNum - 1 : parsedFltNum)
        : '';
    const arvFlt = raw?.arrFlightNo?.trim()
      ? raw.arrFlightNo.trim().toUpperCase().startsWith('BS-')
        ? raw.arrFlightNo.trim().toUpperCase()
        : `BS-${raw.arrFlightNo.trim().toUpperCase()}`
      : autoArrNum
      ? `BS-${autoArrNum}`
      : r.flightNo || 'N/A';

    const staFormatted = formatToHHMM(r.sta || raw?.sta);
    const ataFormatted = formatToHHMM(
      r.chocksOn || raw?.chocksOn || r.doorOpen || raw?.doorOpen
    );
    const arrCalc = getTimeDiffAndStatus(
      r.sta || raw?.sta,
      r.chocksOn || raw?.chocksOn || r.doorOpen || raw?.doorOpen
    );

    const arrAdultPax = raw?.arrPaxAdult?.trim() || '00';
    const arrInfantPax = String(parseInt(raw?.arrPaxInfant?.trim() || '0', 10) || 0).padStart(
      2,
      '0'
    );
    const arvPax = `${arrAdultPax}+${arrInfantPax}`;

    // Departure Flight
    const depFlt = r.flightNo?.trim()
      ? r.flightNo.trim().toUpperCase().startsWith('BS-')
        ? r.flightNo.trim().toUpperCase()
        : `BS-${r.flightNo.trim().toUpperCase()}`
      : 'N/A';

    const stdFormatted = formatToHHMM(r.std || raw?.std);
    const atdFormatted = formatToHHMM(
      r.chocksOff || raw?.chocksOff || r.airborne || raw?.airborne
    );
    const depCalc = getTimeDiffAndStatus(
      r.std || raw?.std,
      r.chocksOff || raw?.chocksOff || r.airborne || raw?.airborne
    );
    const gtFormatted = getGroundTimeFormatted(
      r.chocksOn || raw?.chocksOn || r.doorOpen || raw?.doorOpen,
      r.chocksOff || raw?.chocksOff || r.airborne || raw?.airborne
    );

    const depAdultPax = r.paxTotal || raw?.paxTotal || '00';
    const depInfantPax = String(
      parseInt(r.paxInfant || raw?.paxInfant || '0', 10) || 0
    ).padStart(2, '0');
    const depPax = `${depAdultPax}+${depInfantPax}`;

    // Departure Remarks
    let depRemarks = '';
    if (depCalc.status === 'ON TIME') {
      depRemarks = 'FLT ON TIME';
    } else if (depCalc.status === 'EARLY') {
      depRemarks = `FLT ${String(depCalc.diff).padStart(4, '0')} HRS EARLY DEPARTURE`;
    } else {
      const arrLateStr =
        arrCalc.status === 'DELAY' && arrCalc.diff > 0
          ? ` DUE TO ${String(arrCalc.diff).padStart(4, '0')} HRS L/A`
          : '';
      const delayReasonVal = (r.delayReason || raw?.delayReason || '').trim().toUpperCase();
      const reasonStr = !arrLateStr && delayReasonVal ? ` DUE TO ${delayReasonVal}` : '';
      depRemarks = `FLT ${String(depCalc.diff).padStart(4, '0')} HRS DELAY${arrLateStr || reasonStr}`;
    }
    const customRemark = (r.remarks || raw?.remarks || '').trim().toUpperCase();
    if (customRemark && customRemark !== 'NIL' && customRemark !== depRemarks) {
      depRemarks = `${depRemarks} - ${customRemark}`;
    }

    const rowData = [
      arvFlt,
      staFormatted,
      ataFormatted,
      arrCalc.minsStr,
      arrCalc.status,
      arvPax,
      depFlt,
      stdFormatted,
      atdFormatted,
      depCalc.minsStr,
      gtFormatted,
      depCalc.status,
      depPax,
      depRemarks,
    ];

    rowData.forEach((val, colIdx) => {
      const cellRef = XLSX.utils.encode_cell({ r: rIdx, c: colIdx });
      let fgColor: { rgb: string } | undefined = undefined;
      let fontColor = { rgb: '000000' };

      // Status column highlights (Col 4: Arrival Status, Col 11: Departure Status)
      if (colIdx === 4) {
        if (arrCalc.status === 'DELAY') {
          fgColor = { rgb: 'FFD7D7' };
          fontColor = { rgb: 'DC2626' };
        } else if (arrCalc.status === 'EARLY') {
          fgColor = { rgb: 'D7FFD7' };
          fontColor = { rgb: '16A34A' };
        } else {
          fgColor = { rgb: 'FFF5CC' };
          fontColor = { rgb: 'B45309' };
        }
      } else if (colIdx === 11) {
        if (depCalc.status === 'DELAY') {
          fgColor = { rgb: 'FFD7D7' };
          fontColor = { rgb: 'DC2626' };
        } else if (depCalc.status === 'EARLY') {
          fgColor = { rgb: 'D7FFD7' };
          fontColor = { rgb: '16A34A' };
        } else {
          fgColor = { rgb: 'FFF5CC' };
          fontColor = { rgb: 'B45309' };
        }
      } else if (colIdx === 13) {
        // Remarks color matching status
        if (depCalc.status === 'DELAY') fontColor = { rgb: 'DC2626' };
        else if (depCalc.status === 'EARLY') fontColor = { rgb: '16A34A' };
        else fontColor = { rgb: 'B45309' };
      }

      ws[cellRef] = {
        v: val,
        t: 's',
        s: {
          font: {
            name: 'Calibri',
            sz: 11,
            bold: colIdx === 0 || colIdx === 6 || colIdx === 4 || colIdx === 11 || colIdx === 13,
            color: fontColor,
          },
          fill: fgColor ? { fgColor } : undefined,
          alignment: {
            horizontal: colIdx === 13 ? 'left' : 'center',
            vertical: 'center',
          },
          border: thinBorder,
        },
      };
    });
  });

  const totalRowCount = 3 + reports.length;
  ws['!ref'] = `A1:N${totalRowCount}`;
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 13 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 13 } },
  ];
  ws['!cols'] = [
    { wch: 14 }, // Arr Flt
    { wch: 10 }, // STA
    { wch: 10 }, // ATA
    { wch: 10 }, // Minutes
    { wch: 12 }, // Status
    { wch: 12 }, // Arr Pax
    { wch: 14 }, // Dep Flt
    { wch: 10 }, // STD
    { wch: 10 }, // ATD
    { wch: 10 }, // Minutes
    { wch: 10 }, // GT
    { wch: 12 }, // Status
    { wch: 12 }, // Dep Pax
    { wch: 55 }, // Remarks
  ];
  ws['!rows'] = [
    { hpt: 30 }, // Row 1
    { hpt: 26 }, // Row 2
    { hpt: 24 }, // Row 3
    ...Array(reports.length).fill({ hpt: 20 }),
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Flight Status');

  // Exact file name matching Attachment 1: "Flight Status 22 OCTOBER 2026.xlsx"
  const fileName = `Flight Status ${formattedDateForHeader}.xlsx`;
  downloadWorkbookAsXlsx(wb, fileName);
  return fileName;
};

/**
 * 2. STANDARD FULL FLIGHT DATA EXCEL (.xlsx)
 * Used by DAC station and Super Admin
 */
export const STANDARD_FLIGHT_HEADERS = [
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
  'ARR FLIGHT NO',
  'ARR ROUTE',
  'ARR PAX RECEIVING',
  'ARR PAX ADULT',
  'ARR PAX INFANT',
  'ARR BAG WEIGHT (KG)',
  'ARR BAG PCS',
  'ARR CARGO WEIGHT (KG)',
  'ARR CARGO PCS',
  'ARR MAIL',
  'ARR VIP',
  'ARR CIP',
  'ARR MAAS',
  'ARR REMARKS',
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
  'BAG COM NO',
  'CARGO WEIGHT (KG)',
  'CARGO PCS',
  'CARGO COM NO',
  'CREW BAG WEIGHT (KG)',
  'CREW BAG PCS',
  'CREW BAG COM NO',
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
  'PAX HANDLING',
  'REMARKS',
  'REPORT BY',
  'USBA ID',
  'SAVED AT',
];

export const exportStandardFlightReportsXlsx = (
  reports: StoredFlightReport[],
  filename: string
): void => {
  const wb = XLSX.utils.book_new();
  const ws: XLSX.WorkSheet = {};

  // Header Row (r=0)
  STANDARD_FLIGHT_HEADERS.forEach((h, colIdx) => {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: colIdx });
    ws[cellRef] = {
      v: h,
      t: 's',
      s: {
        font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '1E4B7A' } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border: thinBorder,
      },
    };
  });

  // Data rows (r=1...)
  reports.forEach((r, rowIdx) => {
    const rIdx = 1 + rowIdx;
    const raw = r.rawFormData;

    const rowData: (string | number)[] = [
      r.date || '',
      r.station || '',
      r.flightNo || '',
      r.route || '',
      r.acReg || '',
      r.acType || '',
      r.captain || '',
      String(r.configure || raw?.configure || '').trim(), // Crew config kept as text
      r.sta || raw?.sta || '',
      r.chocksOn || raw?.chocksOn || '',
      r.doorOpen || raw?.doorOpen || '',
      r.arrivalStatus || raw?.arrivalStatus || '',
      raw?.arrFlightNo || '',
      raw?.arrRoute || '',
      raw?.arrPaxReceiving || '',
      raw?.arrPaxAdult || '',
      raw?.arrPaxInfant || '',
      raw?.arrBaggageWeight || '',
      raw?.arrBaggagePcs || '',
      raw?.arrCargoWeight || '',
      raw?.arrCargoPcs || '',
      raw?.arrMail || '',
      raw?.arrVip || '',
      raw?.arrCip || '',
      raw?.arrMaas || '',
      raw?.arrRemarks || '',
      r.std || raw?.std || '',
      r.doorClosed || raw?.doorClosed || '',
      r.chocksOff || raw?.chocksOff || '',
      r.airborne || raw?.airborne || '',
      r.departureStatus || raw?.departureStatus || '',
      r.delayReason || raw?.delayReason || '',
      r.flightLoad || raw?.flightLoad || '',
      r.fuelUplift || raw?.fuelUplift || '',
      r.paxMale || raw?.paxMale || '',
      r.paxFemale || raw?.paxFemale || '',
      r.paxChild || raw?.paxChild || '',
      r.paxInfant || raw?.paxInfant || '',
      r.paxTotal || raw?.paxTotal || '',
      r.baggageWeight || raw?.baggageWeight || '',
      r.baggagePcs || raw?.baggagePcs || '',
      raw?.baggageComNo || '',
      r.cargoWeight || raw?.cargoWeight || '',
      r.cargoPcs || raw?.cargoPcs || '',
      raw?.cargoComNo || '',
      raw?.crewBagWeight || '',
      raw?.crewBagPcs || '',
      raw?.crewBagComNo || '',
      r.mail || raw?.mail || '',
      r.counterNoshow || raw?.counterNoshow || '',
      r.noshowPnr || raw?.noshowPnr || '',
      r.gateNoShow || raw?.gateNoShow || '',
      r.selfOffload || raw?.selfOffload || '',
      r.vip || raw?.vip || '',
      r.cip || raw?.cip || '',
      r.maas || raw?.maas || '',
      r.wchrSeat ? `${r.wchrFig} (${r.wchrSeat})` : r.wchrFig || '',
      r.wchcSeat ? `${r.wchcFig} (${r.wchcSeat})` : r.wchcFig || '',
      r.umPaxSeat ? `${r.umPax} (${r.umPaxSeat})` : r.umPax || '',
      r.fireArmsSeat ? `${r.fireArms} (${r.fireArmsSeat})` : r.fireArms || '',
      r.loadController || '',
      r.rampOfficer || '',
      r.checkInStaff || '',
      r.paxHandling || raw?.paxHandling || '',
      r.remarks || raw?.remarks || '',
      r.preparedBy || '',
      r.usbaId ? `USBA-${r.usbaId}` : '',
      r.createdAt ? new Date(r.createdAt).toLocaleString() : '',
    ];

    rowData.forEach((val, colIdx) => {
      const cellRef = XLSX.utils.encode_cell({ r: rIdx, c: colIdx });
      ws[cellRef] = {
        v: val,
        t: typeof val === 'number' ? 'n' : 's',
        s: {
          font: { name: 'Calibri', sz: 10 },
          alignment: {
            horizontal: colIdx <= 7 ? 'center' : 'left',
            vertical: 'center',
          },
          border: thinBorder,
        },
      };
    });
  });

  const totalRowCount = 1 + reports.length;
  ws['!ref'] = `A1:${XLSX.utils.encode_cell({ r: totalRowCount - 1, c: STANDARD_FLIGHT_HEADERS.length - 1 })}`;
  ws['!cols'] = STANDARD_FLIGHT_HEADERS.map((h) => ({
    wch: Math.max(12, h.length + 3),
  }));

  XLSX.utils.book_append_sheet(wb, ws, 'Flight Reports');
  downloadWorkbookAsXlsx(wb, filename);
};

/**
 * 3. ACTIVITY LOGS EXCEL (.xlsx)
 */
export const exportActivityLogsXlsx = (
  logs: ActivityLogEntry[],
  filename: string
): void => {
  const wb = XLSX.utils.book_new();
  const ws: XLSX.WorkSheet = {};
  const headers = ['DATE & TIME', 'STATION', 'USER NAME', 'USBA ID', 'ACTIVITY / ACTION', 'DETAILS'];

  headers.forEach((h, colIdx) => {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: colIdx });
    ws[cellRef] = {
      v: h,
      t: 's',
      s: {
        font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '1E4B7A' } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: thinBorder,
      },
    };
  });

  logs.forEach((log, rowIdx) => {
    const rIdx = 1 + rowIdx;
    const rowData = [
      log.createdAt ? new Date(log.createdAt).toLocaleString() : '',
      log.station || '',
      log.userName || '',
      log.usbaId ? `USBA-${log.usbaId}` : '',
      log.action || '',
      log.details || '',
    ];

    rowData.forEach((val, colIdx) => {
      const cellRef = XLSX.utils.encode_cell({ r: rIdx, c: colIdx });
      ws[cellRef] = {
        v: val,
        t: 's',
        s: {
          font: { name: 'Calibri', sz: 10 },
          alignment: {
            horizontal: colIdx === 5 ? 'left' : 'center',
            vertical: 'center',
          },
          border: thinBorder,
        },
      };
    });
  });

  const totalRowCount = 1 + logs.length;
  ws['!ref'] = `A1:${XLSX.utils.encode_cell({ r: totalRowCount - 1, c: headers.length - 1 })}`;
  ws['!cols'] = [
    { wch: 22 }, // Date & time
    { wch: 12 }, // Station
    { wch: 20 }, // User Name
    { wch: 16 }, // USBA ID
    { wch: 30 }, // Action
    { wch: 60 }, // Details
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Activity Logs');
  downloadWorkbookAsXlsx(wb, filename);
};
