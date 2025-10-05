// Mock train data for development (only used when ENABLE_MOCK_TRAINS=true)
const MOCK_TRAINS = process.env.ENABLE_MOCK_TRAINS === 'true' ? [
  {
    train_base: {
      from_stn_name: 'DEL',
      to_stn_name: 'BOM',
      from_stn_code: 'DEL',
      to_stn_code: 'BOM',
      from_time: '08:00',
      to_time: '12:00',
      travel_time: '4h 0m',
      train_name: 'RAJDHANI EXPRESS',
      train_number: '12345',
      running_days: 'Daily',
      classes: ['1A', '2A', '3A', 'SL']
    },
    price: 3500,
    class: '2A',
    seats_available: 24
  },
  {
    train_base: {
      from_stn_name: 'DEL',
      to_stn_name: 'BOM',
      from_stn_code: 'DEL',
      to_stn_code: 'BOM',
      from_time: '16:30',
      to_time: '21:15',
      travel_time: '4h 45m',
      train_name: 'SHATABDI EXPRESS',
      train_number: '12010',
      running_days: 'Daily',
      classes: ['CC', 'EC']
    },
    price: 2800,
    class: 'CC',
    seats_available: 12
  },
  {
    train_base: {
      from_stn_name: 'DEL',
      to_stn_name: 'BOM',
      from_stn_code: 'DEL',
      to_stn_code: 'BOM',
      from_time: '22:15',
      to_time: '09:30',
      travel_time: '11h 15m',
      train_name: 'DURONTO EXPRESS',
      train_number: '12213',
      running_days: 'Daily',
      classes: ['1A', '2A', '3A']
    },
    price: 4200,
    class: '1A',
    seats_available: 8
  }
] : [];

export async function getTrains(from, to, date) {
  try {
    // If mock data is not enabled, return empty array
    if (process.env.ENABLE_MOCK_TRAINS !== 'true') {
      console.log(`[${new Date().toISOString()}] Train API integration not implemented yet`);
      return [];
    }
    
    console.log(`[${new Date().toISOString()}] Using mock train data for ${from} to ${to} on ${date}`);
    
    // Return mock data with dynamic station names/codes
    return MOCK_TRAINS.map(train => ({
      ...train,
      train_base: {
        ...train.train_base,
        from_stn_name: from,
        to_stn_name: to,
        from_stn_code: from,
        to_stn_code: to
      }
    }));
  } catch (error) {
    console.error('Error in getTrains:', error);
    return [];
  }
}
