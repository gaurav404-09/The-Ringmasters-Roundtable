import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();
const openai = new OpenAI({ apiKey: process.env.OPENAI_KEY });

export async function aiSuggest(travelOptions) {
  const prompt = `
I have the following travel options:
${JSON.stringify(travelOptions)}

Suggest the most budget-friendly and comfortable trip.
`;

  const res = await openai.chat.completions.create({
    model: "gpt-3.5-turbo", // <-- change from "gpt-4"
    messages: [{ role: "user", content: prompt }],
  });

  return res.choices[0].message.content;
}
