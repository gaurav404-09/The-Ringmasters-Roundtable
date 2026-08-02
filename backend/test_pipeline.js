import { executeAgenticPipeline } from './services/multiAgentOrchestrator.js';
import { EventEmitter } from 'events';
import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

// Mock Firebase Admin so the final save doesn't crash
import admin from 'firebase-admin';
if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'demo-project' });
}

class MockSocket extends EventEmitter {
  constructor() {
    super();
    this.id = 'test_socket';
  }
  emit(event, data) {
    console.log(`[Socket] ${event}:`, JSON.stringify(data));
  }
}

async function run() {
  const socket = new MockSocket();
  const params = {
    startCity: 'Chennai',
    endCity: 'Mysore',
    numDays: 3,
    startDateStr: '2026-08-10',
    endDateStr: '2026-08-12',
    startDateObj: new Date('2026-08-10'),
    tripId: 'test_trip_123'
  };
  console.log("Starting pipeline test for Chennai to Mysore...");
  await executeAgenticPipeline(socket, params);
  console.log("Pipeline test completed successfully.");
  process.exit(0);
}

run().catch(err => {
  console.error("Pipeline test failed:", err);
  process.exit(1);
});
