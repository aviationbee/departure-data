export interface AircraftInfo {
  regSuffix: string;
  fullReg: string;
  type: string;
  seat: number | string;
  configNote?: string;
}

export const AIRCRAFT_DATABASE: { [reg: string]: AircraftInfo } = {
  AKG: { regSuffix: 'AKG', fullReg: 'S2-AKG', type: 'ATR 72 600', seat: 72 },
  AKH: { regSuffix: 'AKH', fullReg: 'S2-AKH', type: 'ATR 72 600', seat: 72 },
  AKI: { regSuffix: 'AKI', fullReg: 'S2-AKI', type: 'ATR 72 600', seat: 72 },
  AKJ: { regSuffix: 'AKJ', fullReg: 'S2-AKJ', type: 'ATR 72 600', seat: 72 },
  AKK: { regSuffix: 'AKK', fullReg: 'S2-AKK', type: 'ATR 72 600', seat: 72 },
  AKL: { regSuffix: 'AKL', fullReg: 'S2-AKL', type: 'ATR 72 600', seat: 72 },
  AKM: { regSuffix: 'AKM', fullReg: 'S2-AKM', type: 'ATR 72 600', seat: 72 },
  AKO: { regSuffix: 'AKO', fullReg: 'S2-AKO', type: 'ATR 72 600', seat: 72 },
  AKP: { regSuffix: 'AKP', fullReg: 'S2-AKP', type: 'ATR 72 600', seat: 78 },
  AJE: { regSuffix: 'AJE', fullReg: 'S2-AJE', type: 'BOEING 737', seat: 189, configNote: 'ALL ECONOMY' },
  AJF: { regSuffix: 'AJF', fullReg: 'S2-AJF', type: 'BOEING 737', seat: 189, configNote: 'ALL ECONOMY' },
  AJG: { regSuffix: 'AJG', fullReg: 'S2-AJG', type: 'BOEING 737', seat: 189, configNote: 'ALL ECONOMY' },
  AJH: { regSuffix: 'AJH', fullReg: 'S2-AJH', type: 'BOEING 737', seat: 189, configNote: 'ALL ECONOMY' },
  ALA: { regSuffix: 'ALA', fullReg: 'S2-ALA', type: 'AIRBUS 330', seat: 436, configNote: 'ALL ECONOMY' },
  ALB: { regSuffix: 'ALB', fullReg: 'S2-ALB', type: 'AIRBUS 330', seat: 436, configNote: 'ALL ECONOMY' },
  ALD: { regSuffix: 'ALD', fullReg: 'S2-ALD', type: 'AIRBUS 330', seat: 436, configNote: 'ALL ECONOMY' },
  SXA: { regSuffix: 'SXA', fullReg: 'HS-SXA', type: 'AIRBUS 320', seat: 180, configNote: 'ALL ECONOMY' },
  BBG: { regSuffix: 'BBG', fullReg: 'PK-BBG', type: 'BOEING 737', seat: 186, configNote: 'ALL ECONOMY' },
};

export const AC_REG_KEYS = Object.keys(AIRCRAFT_DATABASE);

export const ROUTE_MAP: { [route: string]: number[] } = {
  // DOMESTIC
  'DAC-CGP': [101, 103, 105, 107, 109, 111, 113, 115, 117, 119],
  'CGP-DAC': [102, 104, 106, 108, 110, 112, 114, 116, 118, 120],

  'DAC-ZYL': [531, 533, 535, 537, 539, 541],
  'ZYL-DAC': [532, 534, 536, 538, 540, 542],

  'DAC-CXB': [141, 143, 145, 147, 149, 151, 153, 155, 157, 159],
  'CXB-DAC': [142, 144, 146, 148, 150, 152, 154, 156, 158, 160],

  'DAC-RJH': [161, 163, 165, 167, 169],
  'RJH-DAC': [162, 164, 166, 168, 170],

  'DAC-SPD': [181, 183, 185, 187, 189, 191, 193, 195, 197, 199],
  'SPD-DAC': [182, 184, 186, 188, 190, 192, 194, 196, 198, 200],

  'DAC-BZL': [171, 173, 175, 177, 179],
  'BZL-DAC': [172, 174, 176, 178, 180],

  'DAC-JSR': [121, 123, 125, 127, 129],
  'JSR-DAC': [122, 124, 126, 128, 130],

  // INTERNATIONAL
  'DAC-DXB': [341, 343],
  'DXB-DAC': [342, 344],

  'DAC-SHJ': [345, 347],
  'SHJ-DAC': [346, 348],

  'DAC-AUH': [349, 351],
  'AUH-DAC': [350, 352],

  'DAC-RUH': [381, 383],
  'RUH-DAC': [382, 384],

  'DAC-JED': [361, 363],
  'JED-DAC': [362, 364],

  'DAC-MLE': [337, 339],
  'MLE-DAC': [338, 340],

  'DAC-BKK': [217, 219],
  'BKK-DAC': [218, 220],

  'DAC-MCT': [321, 323],
  'MCT-DAC': [322, 324],

  'DAC-DOH': [333, 335],
  'DOH-DAC': [334, 336],

  'DAC-CCU': [201, 203],
  'CCU-DAC': [202, 204],

  'DAC-MAA': [205, 207, 209],
  'MAA-DAC': [206, 208, 210],

  'DAC-CAN': [325, 327],
  'CAN-DAC': [326, 328],

  'DAC-SIN': [307, 309],
  'SIN-DAC': [308, 310],

  'DAC-KUL': [315, 317, 319],
  'KUL-DAC': [316, 318, 320],
};

export const AIRPORT_NAMES: { [code: string]: string } = {
  DAC: 'Dhaka',
  CGP: 'Chattogram',
  CXB: "Cox's Bazar",
  ZYL: 'Sylhet',
  JSR: 'Jashore',
  SPD: 'Saidpur',
  RJH: 'Rajshahi',
  BZL: 'Barishal',
  DXB: 'Dubai',
  SHJ: 'Sharjah',
  AUH: 'Abu Dhabi',
  DOH: 'Doha',
  MCT: 'Muscat',
  RUH: 'Riyadh',
  JED: 'Jeddah',
  SIN: 'Singapore',
  KUL: 'Kuala Lumpur',
  BKK: 'Bangkok',
  CAN: 'Guangzhou',
  CCU: 'Kolkata',
  MAA: 'Chennai',
  MLE: 'Malé',
};

export const CAPTAIN_SUGGESTIONS = [
  'AHMAD', 'LUTFOR', 'TARIQ', 'SHAKIL', 'TANVIR', 'RASHED', 'ALAM', 'HASAN', 'ZAMAN', 'ISLAM', 'KABIR', 'MAHMOOD'
];

export const COMMON_DELAY_REASONS = [
  'LAST PAX ACCEPTANCE',
  'LATE INBOUND AIRCRAFT',
  'AIR TRAFFIC CONTROL (ATC) CLEARANCE',
  'WEATHER AT DESTINATION / ENROUTE',
  'BAGGAGE LOADING & RECONCILIATION',
  'CREW DUTY / ROTATION',
  'SECURITY CHECK & BOARDING DELAY',
  'CARGO UPLIFT & WEIGHT BALANCE',
  'IMMIGRATION / CUSTOMS CLEARANCE',
  'TECHNICAL / MAINTENANCE RECTIFICATION',
];

export function getAircraftDetails(regInput: string): AircraftInfo {
  const clean = regInput.trim().toUpperCase().replace(/^(S2-|HS-|PK-)/, '');
  if (AIRCRAFT_DATABASE[clean]) {
    return AIRCRAFT_DATABASE[clean];
  }
  // Fallbacks
  return {
    regSuffix: clean,
    fullReg: `S2-${clean}`,
    type: '',
    seat: '',
  };
}

export function getAircraftType(regInput: string): string {
  const info = getAircraftDetails(regInput);
  return info.type;
}

export function getRegistrationDetails(rawReg: string) {
  const info = getAircraftDetails(rawReg);
  return {
    display: info.fullReg,
    ldm: info.fullReg.replace('-', ''),
    prefix: info.fullReg.slice(0, 3),
    seat: info.seat,
  };
}

export function getSeatConfig(regInput: string): string {
  const info = getAircraftDetails(regInput);
  if (info.seat) {
    return `C0Y${info.seat}`;
  }
  return 'C0Y189';
}

export function findRouteByFlightNo(flightNoStr: string): string {
  const flightNum = parseInt(flightNoStr.replace(/\D/g, ''), 10);
  if (isNaN(flightNum)) return '';
  for (const [routeValue, numbers] of Object.entries(ROUTE_MAP)) {
    if (numbers.includes(flightNum)) {
      return routeValue;
    }
  }
  return '';
}

export function parseTimeToMinutes(timeStr: string): number | null {
  if (!timeStr) return null;
  const clean = timeStr.replace(/\D/g, '');
  if (clean.length < 4) return null;
  const h = parseInt(clean.slice(0, 2), 10);
  const m = parseInt(clean.slice(2, 4), 10);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

export interface DepartureCalcResult {
  statusText: string;
  diffMinutes: number;
  isDelayed: boolean;
  isEarly: boolean;
  isOnTime: boolean;
}

export function calculateDepartureStatus(
  std: string,
  chocksOff: string,
  delayReason?: string
): DepartureCalcResult {
  const stdMin = parseTimeToMinutes(std);
  const offMin = parseTimeToMinutes(chocksOff);

  if (stdMin === null || offMin === null) {
    return {
      statusText: 'FLIGHT ONTIME',
      diffMinutes: 0,
      isDelayed: false,
      isEarly: false,
      isOnTime: true,
    };
  }

  let diff = offMin - stdMin;
  // Handle midnight wrap
  if (diff < -720) diff += 1440;
  else if (diff > 720) diff -= 1440;

  if (diff === 0) {
    return {
      statusText: 'FLIGHT ONTIME',
      diffMinutes: 0,
      isDelayed: false,
      isEarly: false,
      isOnTime: true,
    };
  }

  if (diff > 0) {
    const cleanReason = delayReason?.trim()
      ? delayReason.trim().toUpperCase().replace(/^DUE\s+TO\s+/i, '')
      : '';
    const reasonText = cleanReason ? ` DUE TO ${cleanReason}` : '';
    return {
      statusText: `${diff} MINS DELAY${reasonText}`,
      diffMinutes: diff,
      isDelayed: true,
      isEarly: false,
      isOnTime: false,
    };
  }

  const absDiff = Math.abs(diff);
  return {
    statusText: `FLIGHT ${absDiff} MINS EARLY`,
    diffMinutes: diff,
    isDelayed: false,
    isEarly: true,
    isOnTime: false,
  };
}

export function calculateArrivalStatus(sta?: string, chocksOn?: string): string {
  const staMin = parseTimeToMinutes(sta || '');
  const onMin = parseTimeToMinutes(chocksOn || '');

  if (staMin === null || onMin === null) {
    return 'FLIGHT ON TIME ARRIVED';
  }

  let diff = onMin - staMin;
  // Handle midnight wrap
  if (diff < -720) diff += 1440;
  else if (diff > 720) diff -= 1440;

  if (diff === 0) {
    return 'FLIGHT ON TIME ARRIVED';
  }

  if (diff > 0) {
    return `${diff} MINS LATE ARRIVED`;
  }

  const absDiff = Math.abs(diff);
  return `${absDiff} MINS EARLY ARRIVED`;
}

export function calculateGroundTime(chocksOn?: string, chocksOff?: string): string {
  const onMin = parseTimeToMinutes(chocksOn || '');
  const offMin = parseTimeToMinutes(chocksOff || '');

  if (onMin === null || offMin === null) {
    return '----';
  }

  let diff = offMin - onMin;
  // Handle midnight wrap
  if (diff < 0) {
    diff += 1440;
  }

  return `${diff} MINS`;
}

export function formatDate(dateString: string, format: 'DDMONYY' | 'DDMON' | 'DD' | 'LONG' | 'CARD' = 'DDMONYY'): string {
  if (!dateString) return 'N/A';
  const date = new Date(dateString + 'T00:00:00Z');
  if (isNaN(date.getTime())) return 'N/A';

  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = date.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' }).toUpperCase();
  const year = date.getUTCFullYear().toString().slice(-2);
  const fullYear = date.getUTCFullYear().toString();

  if (format === 'DDMON') return `${day}${month}`;
  if (format === 'DD') return day;
  if (format === 'LONG' || format === 'CARD') return `${day} ${month} ${fullYear}`;
  return `${day}${month}${year}`;
}
