import { CohereClient } from "cohere-ai";
import { triggerPayloadSchema } from "./schemas.js";
import { TriggerPayloadValidationError } from "../utils/errors.js";
import { structuredLog } from "../utils/logger.js";
import dotenv from "dotenv";
dotenv.config();

let cohere = null;
const chatSessions = new Map();

function getCohereClient() {
  if (!cohere) {
    cohere = new CohereClient({ token: process.env.COHERE_API_KEY });
  }
  return cohere;
}


export async function processChatMessage(sessionId, text) {
  if (!chatSessions.has(sessionId)) {
    chatSessions.set(sessionId, { history: [], hasExplicitInterests: false });
  }

  const session = chatSessions.get(sessionId);
  
  const userTextLower = text.toLowerCase();
  const interestKeywords = ['food', 'culture', 'history', 'nature', 'adventure', 'leisure', 'museum', 'art', 'shopping', 'architecture', 'relax', 'beach', 'mountain', 'hiking', 'attraction', 'sight'];
  if (interestKeywords.some(kw => userTextLower.includes(kw))) {
    session.hasExplicitInterests = true;
  }

  const systemPrompt = `You are an AI Travel Concierge. 
Your goal is to gather these 4 exact details for a trip:
1. Destination (endCity)
2. Start City (assume Delhi if not provided, but confirm if needed)
3. Duration (numDays)
4. Travelers count and Specific interests (e.g., food, history)

RULES:
- Acknowledge provided details, ask for ONE missing detail at a time.
- DO NOT fabricate unstated parameters. If the user declines to specify interests, note that they left it open.
- ONCE you have all details, you MUST summarize the trip in plain language (stating explicitly if you assumed any defaults), and ask: "Should I go ahead and plan this trip?"
- DO NOT return the JSON trigger until the user replies "yes" (or affirmatively) to your summary.
- If the user replies "no" to the summary, ask what they want to change. DO NOT trigger the plan.
- To trigger the plan, return a JSON object exactly matching this schema:
  {
    "TRIGGER_PLAN": true,
    "startCity": "Delhi",
    "endCity": "Jaipur",
    "numDays": 3,
    "travelers": 2,
    "interests": ["culture", "food"]
  }
- ONLY return the JSON object when you have received an affirmative YES from the user on your summary. Otherwise, return a normal conversational string.`;

  const startTime = Date.now();
  let replyText = "";
  let isJsonTrigger = false;

  let isConfirmingSummary = false;
  if (session.history.length > 0) {
    const lastMsg = session.history[session.history.length - 1];
    if (lastMsg.role === 'CHATBOT' && lastMsg.message.toLowerCase().includes('should i go ahead')) {
      const isAffirmative = ['yes', 'yeah', 'sure', 'go ahead', 'yep', 'ok', 'okay'].some(kw => userTextLower.includes(kw));
      if (isAffirmative) {
        isConfirmingSummary = true;
      }
    }
  }

  try {
    const response = await getCohereClient().chat({
      model: "command-r-08-2024",
      message: text,
      preamble: systemPrompt,
      chatHistory: session.history,
      temperature: 0.3
    });

    replyText = response.text.trim();
    const latencyMs = Date.now() - startTime;

    // Cohere inconsistently wraps structured JSON output in markdown fences
    // even when instructed to return raw JSON only, sometimes with preamble text.
    let maybeJson = false;
    let rawJsonStr = "";

    const fenceMatch = replyText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      rawJsonStr = fenceMatch[1].trim();
      maybeJson = true;
    } else {
      const braceMatch = replyText.match(/\{[\s\S]*"TRIGGER_PLAN"[\s\S]*?\}/);
      if (braceMatch) {
        rawJsonStr = braceMatch[0].trim();
        maybeJson = true;
      }
    }
    
    let retried = false;
    if (isConfirmingSummary && !maybeJson) {
      structuredLog({
        step: 'chatAgent_retry',
        error: 'LLM failed to trigger pipeline after user confirmation — model wrote free text instead of JSON.',
        output: replyText
      });
      
      retried = true;
      const retryResponse = await getCohereClient().chat({
        model: "command-r-08-2024",
        message: text + " (CRITICAL: You MUST output ONLY the JSON object now, no conversational text. Use TRIGGER_PLAN.)",
        preamble: systemPrompt,
        chatHistory: session.history,
        temperature: 0.1
      });
      
      replyText = retryResponse.text.trim();
      
      const fenceMatchRetry = replyText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fenceMatchRetry) {
        rawJsonStr = fenceMatchRetry[1].trim();
        maybeJson = true;
      } else {
        const braceMatchRetry = replyText.match(/\{[\s\S]*"TRIGGER_PLAN"[\s\S]*?\}/);
        if (braceMatchRetry) {
          rawJsonStr = braceMatchRetry[0].trim();
          maybeJson = true;
        }
      }
      
      if (!maybeJson) {
        throw new TriggerPayloadValidationError('Failed to validate Trigger Payload after retry', replyText);
      }
    }

    let triggerPayload = null;

    if (maybeJson) {
      isJsonTrigger = true;
      try {
        const rawJson = JSON.parse(rawJsonStr);
        if (rawJson.TRIGGER_PLAN) {
          // Validate strictly with Zod
          triggerPayload = triggerPayloadSchema.parse(rawJson);
          
          if (!session.hasExplicitInterests && triggerPayload.interests && triggerPayload.interests.length > 0) {
            structuredLog({
              step: 'chatAgent_validation',
              input: triggerPayload.interests,
              error: 'WARNING: LLM fabricated interests despite none being stated. Correcting to empty array.'
            });
            triggerPayload.interests = [];
          }

          replyText = (retried ? "Sorry, I had to retry generating your trip plan — one moment. " : "") + "Perfect! I've got everything I need. Launching the agent ensemble now! 🚀";
          chatSessions.delete(sessionId);
        }
      } catch (e) {
        // Zod or parse error
        throw new TriggerPayloadValidationError('Failed to validate Trigger Payload', replyText);
      }
    }

    structuredLog({
      step: 'chatAgent_processMessage',
      input: text,
      output: isJsonTrigger ? triggerPayload : replyText,
      latencyMs
    });

    // Add to history if it wasn't a trigger
    if (!isJsonTrigger) {
      session.history.push({ role: 'USER', message: text });
      session.history.push({ role: 'CHATBOT', message: replyText });
    }

    return {
      reply: replyText,
      triggerPayload
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    structuredLog({
      step: 'chatAgent_processMessage',
      input: text,
      error,
      latencyMs
    });
    // Re-throw to ensure loud failure
    throw error;
  }
}
