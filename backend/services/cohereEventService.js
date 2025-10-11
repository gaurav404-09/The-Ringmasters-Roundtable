import { CohereClient } from "cohere-ai";
import dotenv from "dotenv";
import fetch from 'node-fetch';

dotenv.config();

// Unsplash API configuration
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY || 'YOUR_UNSPLASH_ACCESS_KEY';
const UNSPLASH_API_URL = 'https://api.unsplash.com';

// Cache for storing image URLs to avoid duplicate API calls
const imageCache = new Map();

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
  async getEvents(city, dateRange = "the next two weeks", category = "culture") {
    const normalizedCity = city || "your city";
    const normalizedCategory = category || "culture";
    const prompt = `Generate between 5 and 7 specific upcoming events happening in ${normalizedCity} for ${dateRange} focusing on ${normalizedCategory}. 
Return a STRICT JSON array only (no prose) where every object has these fields:
[
  {
    "title": "Concise event title",
    "date": "YYYY-MM-DD",
    "time": "HH:MM AM/PM",
    "location": "Venue name, neighbourhood",
    "description": "1-2 sentence teaser",
    "price": "Free / $$ / $$$",
    "category": "${normalizedCategory}",
    "keywords": "3-6 comma separated keywords for imagery"
  }
]

Rules:
- Dates must be real upcoming calendar dates.
- Times should be realistic for the event type.
- Use venues and happenings that plausibly exist in ${normalizedCity}.
- Always include the keywords field.
- Do not include markdown or additional text outside the JSON array.`;

    try {
      const response = await this.client.responses.create({
        model: "command-r-08-2024",
        input: prompt,
        temperature: 0.4,
        max_tokens: 800
      });

      const output = response?.output_text?.trim();
      const parsed = await this.extractEventsFromOutput(output, normalizedCity, normalizedCategory);
      if (parsed?.length) {
        return parsed;
      }

      console.warn("Cohere returned no parsable events. Falling back.");
      return this.getFallbackEvents(normalizedCity, normalizedCategory);
    } catch (err) {
      console.error("❌ Error calling Cohere API:", err);
      return this.getFallbackEvents(normalizedCity, normalizedCategory);
    }
  }

  extractEventsFromOutput(rawText, city, category) {
    if (!rawText) {
      return null;
    }

    const jsonMatch = rawText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.warn("Cohere response did not contain JSON array.", rawText);
      return null;
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed)) {
        return null;
      }

      const cleaned = parsed
        .map((event) => this.normalizeEvent(event, city, category))
        .filter(Boolean);

      return this.processEventsWithImages(cleaned.slice(0, 7), city, category);
    } catch (error) {
      console.error("Failed to parse Cohere JSON response:", error);
      return null;
    }
  }

  normalizeEvent(event, city, category) {
    if (!event || typeof event !== "object") {
      return null;
    }

    const safeDate = event.date && !Number.isNaN(new Date(event.date).getTime())
      ? event.date
      : this.getFutureDate(3);

    const safeTime = typeof event.time === "string" && event.time.trim().length
      ? event.time.trim()
      : "7:00 PM";

    const keywords = (event.keywords || "")
      .toString()
      .split(/[,;]+/)
      .map((word) => word.trim())
      .filter(Boolean);

    if (keywords.length < 3) {
      keywords.push(city, category, "event");
    }

    return {
      title: (event.title || "Spotlight Event").toString().trim(),
      date: safeDate,
      time: safeTime,
      location: (event.location || `${city} • Venue TBA`).toString().trim(),
      description: (event.description || `Immersive ${category} showcase in ${city}.`).toString().trim(),
      price: (event.price || "$$").toString().trim(),
      category: event.category || category,
      keywords: keywords.join(","),
    };
  }

  // Generate a random Unsplash image URL based on keywords
  async getEventImageUrl(keywords = 'event', width = 800, height = 600) {
    const cacheKey = `${keywords}-${width}x${height}`;
    
    // Return cached URL if available
    if (imageCache.has(cacheKey)) {
      return imageCache.get(cacheKey);
    }

    try {
      const query = encodeURIComponent(keywords);
      const url = `${UNSPLASH_API_URL}/photos/random?query=${query}&client_id=${UNSPLASH_ACCESS_KEY}&w=${width}&h=${height}&fit=crop&crop=entropy&q=80&auto=format`;
      
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch image');
      
      const data = await response.json();
      const imageUrl = data.urls?.regular || `https://source.unsplash.com/random/${width}x${height}/?${query}`;
      
      // Cache the URL
      imageCache.set(cacheKey, imageUrl);
      return imageUrl;
    } catch (error) {
      console.error('Error fetching Unsplash image:', error);
      // Fallback to a generic Unsplash URL
      return `https://source.unsplash.com/random/${width}x${height}/?${encodeURIComponent(keywords)}`;
    }
  }

  // Process events to add image URLs
  async processEventsWithImages(events, city, category) {
    if (!Array.isArray(events)) return [];
    
    return Promise.all(events.map(async (event) => {
      try {
        const keywords = [
          event.title,
          event.category || category,
          event.location || city,
          'event',
        ].filter(Boolean).join(',');
        
        const imageUrl = await this.getEventImageUrl(keywords);
        return { ...event, imageUrl };
      } catch (error) {
        console.error('Error processing event image:', error);
        return { ...event, imageUrl: `https://source.unsplash.com/random/800x600/?${encodeURIComponent(category || 'event')}` };
      }
    }));
  }

  // Fallback events in case API fails
  async getFallbackEvents(city, category) {
    const normalizedCategory = category || "culture";
    const titleCategory = normalizedCategory.charAt(0).toUpperCase() + normalizedCategory.slice(1);

    const fallbackEvents = [
      {
        title: `${titleCategory} Showcase`,
        date: this.getFutureDate(3),
        time: "7:30 PM",
        location: `${city} City Center Atrium`,
        description: `A curated evening featuring standout ${normalizedCategory} talent from across ${city}.`,
        price: "$$",
        category: normalizedCategory,
        keywords: `${city},${normalizedCategory},showcase,event`
      },
      {
        title: `${city} After Dark Sessions`,
        date: this.getFutureDate(5),
        time: "9:00 PM",
        location: `${city} Warehouse District`,
        description: `Pop-up performances, street food collectives, and immersive art taking over the block.`,
        price: "Free",
        category: normalizedCategory,
        keywords: `${city},nightlife,pop-up,${normalizedCategory}`
      },
      {
        title: `${titleCategory} Day Lab`,
        date: this.getFutureDate(7),
        time: "1:00 PM",
        location: `${city} Innovation Hub`,
        description: `Hands-on workshops and panels with creators pioneering new waves in ${normalizedCategory}.`,
        price: "$$$",
        category: normalizedCategory,
        keywords: `${city},workshop,${normalizedCategory},festival`
      }
    ];

    return this.processEventsWithImages(fallbackEvents, city, normalizedCategory);
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
