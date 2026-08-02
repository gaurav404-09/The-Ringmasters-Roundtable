import { processChatMessage } from './services/chatAgent.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '.env'), override: true });

async function runTests() {
  let successCount = 0;
  for (let i = 1; i <= 5; i++) {
    const sessionId = `test_session_${i}`;
    console.log(`\n=== Iteration ${i} ===`);
    
    try {
      // Step 1
      const res1 = await processChatMessage(sessionId, "Plan trip delhi to goa");
      console.log(`User: Plan trip delhi to goa`);
      console.log(`Bot: ${res1.reply}`);

      // Step 2
      const res2 = await processChatMessage(sessionId, "no of days 5, alone");
      console.log(`User: no of days 5, alone`);
      console.log(`Bot: ${res2.reply}`);

      // Step 3
      const res3 = await processChatMessage(sessionId, "yes");
      console.log(`User: yes`);
      console.log(`Bot: ${res3.reply}`);
      
      if (res3.triggerPayload) {
        console.log(`✅ TRIGGER SUCCESS! Payload:`, res3.triggerPayload);
        successCount++;
      } else {
        console.log(`❌ NO TRIGGER PAYLOAD RETURNED!`);
      }
    } catch (e) {
      console.log(`❌ ERROR in Iteration ${i}:`, e);
    }
  }
  
  console.log(`\n=== Final Result: ${successCount}/5 Successful Triggers ===`);
  process.exit(0);
}

runTests();
