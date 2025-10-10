// Map of city names to IATA codes (manually curated subset of major cities).
export const cityToIata = {
  mumbai: 'BOM',
  delhi: 'DEL',
  bangalore: 'BLR',
  bengaluru: 'BLR',
  hyderabad: 'HYD',
  ahmedabad: 'AMD',
  chennai: 'MAA',
  kolkata: 'CCU',
  surat: 'STV',
  pune: 'PNQ',
  jaipur: 'JAI',
  lucknow: 'LKO',
  kanpur: 'KNU',
  nagpur: 'NAG',
  indore: 'IDR',
  thane: 'BOM',
  bhopal: 'BHO',
  visakhapatnam: 'VTZ',
  patna: 'PAT',
  vadodara: 'BDQ',
  varanasi: 'VNS',
  srinagar: 'SXR',
  jammu: 'IXJ',
  goa: 'GOI',
  dehradun: 'DED',
  udaipur: 'UDR',
  jodhpur: 'JDH',
  coimbatore: 'CJB',
  bhubaneswar: 'BBI',
  chandigarh: 'IXC',
  amritsar: 'ATQ',
  kochi: 'COK',
  trivandrum: 'TRV',
  madurai: 'IXM',
  tiruchirappalli: 'TRZ',
  mysore: 'MYQ',
  mangalore: 'IXE',
  agra: 'AGR',
  allahabad: 'IXD',
  gwalior: 'GWL',
  jabalpur: 'JLR',
  raipur: 'RPR',
  aurangabad: 'IXU',
  vadodara: 'BDQ',
  guwahati: 'GAU',
  imphal: 'IMF',
  aizawl: 'AJL',
  dimapur: 'DMU',
  shillong: 'SHL',
  leh: 'IXL',
  shimla: 'SLV',
  dharamshala: 'DHM',
  goa: 'GOI',
  pondicherry: 'PNY',
  chandigarh: 'IXC',
};

// Function to get IATA code for a city name
export const getIataCode = (cityName) => {
  if (!cityName) return '';
  const trimmed = cityName.trim();

  // If the user already entered a 3-letter code, accept it directly
  if (/^[A-Za-z]{3}$/.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  const cityKey = trimmed.toLowerCase().split(',')[0].trim();
  const mapped = cityToIata[cityKey];
  if (mapped) return mapped;

  const condensed = cityKey.replace(/[^a-z]/g, '');
  if (condensed.length >= 3) {
    return condensed.slice(0, 3).toUpperCase();
  }

  return '';
};

// Function to get city name from IATA code
export const getCityFromIata = (iataCode) => {
  if (!iataCode) return '';
  const entry = Object.entries(cityToIata).find(([_, code]) => code === iataCode);
  return entry ? entry[0].charAt(0).toUpperCase() + entry[0].slice(1) : iataCode;
};

export const formatCityWithCode = (suggestion) => {
  const code = getIataCode(suggestion);
  return code ? `${suggestion} (${code})` : suggestion;
};
