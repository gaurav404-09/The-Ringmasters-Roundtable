import { CohereClient } from "cohere-ai";
import dotenv from "dotenv";

dotenv.config();

const CLASS_MULTIPLIERS = {
  "1A": 3.5,
  "2A": 2.8,
  "3A": 2.2,
  "SL": 1.4,
  "CC": 1.8,
  "EC": 2.4,
  "FC": 2.1,
  "3E": 1.9,
  "2S": 1.2,
};

const MINIMUM_PRICE = 250;
const DEFAULT_RATE_PER_MINUTE = 2.8;

const cohereToken = process.env.COHERE_API_KEY;
const cohereClient = cohereToken
  ? new CohereClient({ token: cohereToken })
  : null;

const roundPrice = (value) => Math.max(MINIMUM_PRICE, Math.round(value / 10) * 10);

const parseTravelMinutes = (travelTime) => {
  if (!travelTime) return null;

  const normalized = String(travelTime).trim();
  if (!normalized) return null;

  const colonMatch = normalized.match(/^(\d{1,2}):(\d{1,2})$/);
  if (colonMatch) {
    const hours = Number(colonMatch[1]);
    const minutes = Number(colonMatch[2]);
    if (Number.isFinite(hours) && Number.isFinite(minutes)) {
      return hours * 60 + minutes;
    }
  }

  const hourMatch = normalized.match(/(\d+(?:\.\d+)?)\s*h/i);
  const minuteMatch = normalized.match(/(\d+(?:\.\d+)?)\s*m/i);

  const hours = hourMatch ? Number(hourMatch[1]) : 0;
  const minutes = minuteMatch ? Number(minuteMatch[1]) : 0;

  if (Number.isFinite(hours) || Number.isFinite(minutes)) {
    return Math.round(hours * 60 + minutes);
  }

  const pureNumber = Number(normalized.replace(/[^0-9.]/g, ""));
  if (Number.isFinite(pureNumber) && pureNumber > 0) {
    return Math.round(pureNumber * 60);
  }

  return null;
};

const pickTrainClass = (train = {}) => {
  if (train.class && typeof train.class === "string") {
    return train.class.trim().toUpperCase();
  }

  const classesField = train.train_base?.classes;
  if (Array.isArray(classesField) && classesField.length > 0) {
    return String(classesField[0]).trim().toUpperCase();
  }

  if (typeof classesField === "string" && classesField.trim().length > 0) {
    return classesField.trim().split(/\s+/)[0].toUpperCase();
  }

  return "SL";
};

const derivePriceHeuristically = (train) => {
  const durationMinutes = parseTravelMinutes(train?.train_base?.travel_time);
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    return null;
  }

  const distanceEstimate = Number(train?.train_base?.distance_from_to);
  const distanceKm = Number.isFinite(distanceEstimate) ? distanceEstimate : null;

  const baseMinutes = Math.max(durationMinutes, 90);
  const baseCost = (baseMinutes * DEFAULT_RATE_PER_MINUTE) / 1.0;

  const classCode = pickTrainClass(train);
  const classMultiplier = CLASS_MULTIPLIERS[classCode] || 1.5;

  let price = baseCost * classMultiplier;

  if (Number.isFinite(distanceKm) && distanceKm > 0) {
    const distanceFactor = Math.max(1, distanceKm / 250);
    price *= 0.85 + 0.15 * distanceFactor;
  }

  return roundPrice(price);
};

const buildCoherePrompt = (train) => {
  const origin = train?.train_base?.from_stn_name || train?.train_base?.from || "Origin";
  const destination = train?.train_base?.to_stn_name || train?.train_base?.to || "Destination";
  const number = train?.train_base?.train_no || "N/A";
  const name = train?.train_base?.train_name || "the train";
  const classCode = pickTrainClass(train);
  const travelTime = train?.train_base?.travel_time || "N/A";

  return `You are a railway pricing analyst. Estimate a realistic adult ticket price in Indian Rupees for the following train journey. Reply strictly as JSON with a single object like {"priceInINR": 1234} using a whole number.
Train number: ${number}
Train name: ${name}
Origin station: ${origin}
Destination station: ${destination}
Travel time: ${travelTime}
Coach class: ${classCode}
Ensure the price reflects typical Indian Railways pricing for this route and class.`;
};

const parseCoherePrice = (responseText) => {
  if (!responseText) return null;

  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);
    const value = Number(parsed.priceInINR || parsed.price || parsed.amount);
    if (Number.isFinite(value) && value > 0) {
      return roundPrice(value);
    }
  } catch (error) {
    console.error('[TrainPricing] Failed to parse Cohere price response:', error);
  }

  return null;
};

const generatePriceWithCohere = async (train) => {
  if (!cohereClient) {
    return null;
  }

  try {
    const prompt = buildCoherePrompt(train);
    const response = await cohereClient.chat({
      model: "command-r-08-2024",
      message: prompt,
      temperature: 0.2,
    });

    const output = response?.text || (Array.isArray(response) ? response[0]?.text : "");
    return parseCoherePrice(output);
  } catch (error) {
    console.error('[TrainPricing] Cohere pricing request failed:', error);
    return null;
  }
};

const fallbackPrice = (train) => {
  const lengthBased = (train?.train_base?.train_name || 'Train').length * 120;
  return roundPrice(lengthBased);
};

export async function ensureTrainPrice(train, { origin, destination } = {}) {
  if (!train) return null;

  if (Number.isFinite(train.price) && train.price > 0) {
    return {
      ...train,
      currency: train.currency || 'INR',
      metadata: {
        ...(train.metadata || {}),
        pricingSource: train.metadata?.pricingSource || 'provided',
      },
    };
  }

  let price = derivePriceHeuristically(train);
  let pricingSource = 'heuristic';

  if (!Number.isFinite(price) || price <= 0) {
    price = await generatePriceWithCohere(train);
    pricingSource = 'cohere';
  }

  if (!Number.isFinite(price) || price <= 0) {
    price = fallbackPrice(train);
    pricingSource = 'fallback';
  }

  return {
    ...train,
    price,
    currency: 'INR',
    metadata: {
      ...(train.metadata || {}),
      pricingSource,
      pricingComputedAt: new Date().toISOString(),
      origin: origin || train.metadata?.origin || train.train_base?.from_stn_code,
      destination: destination || train.metadata?.destination || train.train_base?.to_stn_code,
      class: pickTrainClass(train),
    },
  };
}
