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
    "category": "${category}",
    "keywords": "comma,separated,keywords,for,image,search"
  }
]

IMPORTANT: Include relevant keywords in the 'keywords' field to help find appropriate images for each event.`;

    try {
      console.log("Sending request to Cohere API with prompt:", prompt);
      const response = await this.client.chat({
        model: "command-r-08-2024",
        message: prompt,  // Changed from object to string
        temperature: 0.5
      }).catch(err => {
        console.error("Error in Cohere API call:", err);
        throw err;
      });

      console.log("Raw Cohere API response:", response);
      console.log("Response type:", typeof response);
      console.log("Response keys:", Object.keys(response));

      // Extract the response content
      let output = response?.text || 
                 response?.text ||
                 (Array.isArray(response) ? response[0]?.text : '') ||
                 '';

      console.log("Extracted output:", output);

      if (output) {
        const jsonMatch = output.match(/\[[\s\S]*\]/); // Extract JSON array
        if (jsonMatch) {
          try {
            let parsed = JSON.parse(jsonMatch[0]);
            console.log("Successfully parsed JSON response:", parsed);
            
            // Process events to add images
            if (Array.isArray(parsed)) {
              parsed = await this.processEventsWithImages(parsed, city, category);
            }
            
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
    const fallbackEvents = [
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

    return this.processEventsWithImages(fallbackEvents, city, category);
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
