import { CohereClient } from "cohere-ai";
import dotenv from "dotenv";

dotenv.config();

class CohereEventService {
  constructor() {
    this.client = new CohereClient({
      token: process.env.COHERE_API_KEY,
    });
  }

  // Utility: create a future date string
  getFutureDate(days) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().split("T")[0];
  }

  // Main event generation using Cohere
  async getEvents(city, dateRange = "next week", category = "general") {
    const prompt = `Generate 5 unique upcoming events in ${city} for ${dateRange} in the ${category} category. 
Format the response as a valid JSON array of objects with these exact property names:
[
  {
    "title": "Event Title",
    "date": "YYYY-MM-DD",
    "time": "HH:MM AM/PM",
    "location": "Venue Name, Area",
    "description": "Brief description",
    "price": "$",
    "category": "${category}"
  }
]`;

    try {
      console.log("Sending request to Cohere API with prompt:", prompt);
      const response = await this.client.chat({
        model: "command-r-08-2024",
        message: prompt,
        temperature: 0.5
      }).catch(err => {
        console.error("Error in Cohere API call:", err);
        throw err;
      });

      console.log("Raw Cohere API response:", response);
      console.log("Response type:", typeof response);
      console.log("Response keys:", Object.keys(response));

      // Try different response formats
      let output = response?.text || 
                 response?.output?.[0]?.text ||
                 response?.generations?.[0]?.text ||
                 "";

      console.log("Extracted output:", output);

      if (output) {
        const jsonMatch = output.match(/\[[\s\S]*\]/); // Extract JSON array
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            console.log("Successfully parsed JSON response:", parsed);
            return parsed;
          } catch (err) {
            console.error("⚠️ JSON parse failed:", err, "Output was:", jsonMatch[0]);
          }
        } else {
          console.log("No JSON array found in output");
        }
      } else {
        console.log("No output found in response");
      }

      return this.getFallbackEvents(city, category);
    } catch (err) {
      console.error("❌ Error calling Cohere API:", err);
      return this.getFallbackEvents(city, category);
    }
  }

  // Fallback events in case API fails
  getFallbackEvents(city, category) {
    return [
      {
        title: `${category.charAt(0).toUpperCase() + category.slice(1)} Festival`,
        date: this.getFutureDate(3),
        time: "6:00 PM",
        location: `${city} City Center`,
        description: `Experience the best of ${category} in this exciting festival.`,
        price: "$$",
        category: category,
      },
      {
        title: `${city} ${category} Workshop`,
        date: this.getFutureDate(5),
        time: "2:00 PM",
        location: `${city} Community Hall`,
        description: `Learn new skills and techniques in this hands-on ${category} workshop.`,
        price: "$",
        category: category,
      },
    ];
  }
}

// Exported function for server.js
const findEvents = async (city, dateRange, category) => {
  try {
    const service = new CohereEventService();
    return await service.getEvents(city, dateRange, category);
  } catch (err) {
    console.error("Error in findEvents:", err);
    const service = new CohereEventService();
    return service.getFallbackEvents(city, category || "general");
  }
};

export { findEvents };
