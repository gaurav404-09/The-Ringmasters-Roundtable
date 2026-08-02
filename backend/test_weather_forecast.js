import * as dotenv from 'dotenv';
dotenv.config({ path: '../.env' });
import { getWeather } from './services/freeDataService.js';

async function runTests() {
  const city = 'Delhi';
  
  // Helper to generate an array of 'YYYY-MM-DD' dates starting from a specific offset
  const getDates = (startOffsetDays, numDays) => {
    const dates = [];
    const now = new Date();
    for (let i = 0; i < numDays; i++) {
      const d = new Date(now.getTime() + (startOffsetDays + i) * 86400000);
      dates.push(d.toISOString().split('T')[0]);
    }
    return dates;
  };

  try {
    console.log('--- SCENARIO A & B: Trip starting today for 3 days ---');
    const datesAB = getDates(0, 3);
    console.log('Target dates:', datesAB);
    const weatherAB = await getWeather(city, datesAB);
    for (const date of datesAB) {
      const w = weatherAB[date];
      console.log(`${date}: ${w.available ? `${w.temp}°C, ${w.description}` : w.description}`);
    }

    console.log('\n--- SCENARIO C: Trip starting 10 days in the future for 3 days ---');
    const datesC = getDates(10, 3);
    console.log('Target dates:', datesC);
    const weatherC = await getWeather(city, datesC);
    for (const date of datesC) {
      const w = weatherC[date];
      console.log(`${date}: ${w.available ? `${w.temp}°C, ${w.description}` : w.description}`);
    }
    
  } catch (err) {
    console.error('Error during testing:', err);
  }
}

runTests();
