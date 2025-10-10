import { CohereClient } from "cohere-ai";
import dotenv from "dotenv";

dotenv.config();

class CohereItineraryService {
  constructor() {
    this.client = new CohereClient({
      token: process.env.COHERE_API_KEY,
    });
  }

  // Generate interest-based activities using Cohere AI
  async generateInterestBasedActivities(destination, interests, dayNumber, timeSlot = 'afternoon') {
    if (!interests || interests.length === 0) {
      return this.getFallbackActivities(destination, dayNumber, timeSlot);
    }

    const interestsList = Array.isArray(interests) ? interests.join(', ') : interests;
    
    const prompt = `Generate 3 unique ${timeSlot} activities in ${destination} for Day ${dayNumber} based on these interests: ${interestsList}.

Format the response as a valid JSON array with these exact properties:
[
  {
    "title": "Activity Name",
    "type": "activity_type",
    "location": "Specific location in ${destination}",
    "description": "Detailed description of the activity",
    "duration": "2h",
    "time": "15:30",
    "price": "$$",
    "includes": ["item1", "item2", "item3"],
    "interest_category": "primary_interest_matched"
  }
]

Activity types should be one of: shopping, nightlife, cultural, adventure, food, entertainment, wellness, sports, art, music, nature, photography, history, local_experience

Make sure activities are:
1. Specific to ${destination}
2. Realistic and actually available
3. Match the interests: ${interestsList}
4. Include local authentic experiences
5. Have appropriate timing for ${timeSlot}

IMPORTANT: Return only the JSON array, no additional text.`;

    try {
      console.log(`Generating interest-based activities for ${destination} with interests: ${interestsList}`);
      
      const response = await this.client.chat({
        model: "command-r-08-2024",
        message: prompt,
        temperature: 0.7
      });

      console.log("Cohere response for activities:", response);

      let output = response?.text || '';
      
      if (output) {
        const jsonMatch = output.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            console.log("Successfully parsed interest-based activities:", parsed);
            
            if (Array.isArray(parsed) && parsed.length > 0) {
              return parsed;
            }
          } catch (err) {
            console.error("JSON parse failed for activities:", err);
          }
        }
      }

      return this.getFallbackActivities(destination, dayNumber, timeSlot, interests);
    } catch (err) {
      console.error("Error generating interest-based activities:", err);
      return this.getFallbackActivities(destination, dayNumber, timeSlot, interests);
    }
  }

  // Generate shopping activities specifically
  async generateShoppingActivities(destination, dayNumber) {
    const prompt = `Generate 2 unique shopping experiences in ${destination} for Day ${dayNumber}.

Format as JSON array:
[
  {
    "title": "Shopping Location/Experience",
    "type": "shopping",
    "location": "Specific shopping area in ${destination}",
    "description": "What makes this shopping experience special",
    "duration": "2h",
    "time": "14:00",
    "price": "$$",
    "includes": ["local products", "unique items", "cultural shopping"],
    "interest_category": "shopping"
  }
]

Focus on:
- Local markets and authentic shopping experiences
- Unique products specific to ${destination}
- Mix of traditional and modern shopping
- Cultural shopping experiences

Return only JSON array.`;

    return this.generateFromPrompt(prompt, destination, 'shopping');
  }

  // Generate nightlife activities specifically
  async generateNightlifeActivities(destination, dayNumber) {
    const prompt = `Generate 2 unique nightlife experiences in ${destination} for Day ${dayNumber}.

Format as JSON array:
[
  {
    "title": "Nightlife Experience",
    "type": "nightlife",
    "location": "Specific venue/area in ${destination}",
    "description": "What makes this nightlife experience special",
    "duration": "3h",
    "time": "21:00",
    "price": "$$",
    "includes": ["live music", "local drinks", "cultural experience"],
    "interest_category": "nightlife"
  }
]

Focus on:
- Local bars, clubs, or entertainment venues
- Cultural nightlife experiences
- Live music or performances
- Safe and authentic experiences

Return only JSON array.`;

    return this.generateFromPrompt(prompt, destination, 'nightlife');
  }

  // Generic prompt generator
  async generateFromPrompt(prompt, destination, category) {
    try {
      const response = await this.client.chat({
        model: "command-r-08-2024",
        message: prompt,
        temperature: 0.7
      });

      let output = response?.text || '';
      
      if (output) {
        const jsonMatch = output.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            if (Array.isArray(parsed) && parsed.length > 0) {
              return parsed;
            }
          } catch (err) {
            console.error(`JSON parse failed for ${category}:`, err);
          }
        }
      }

      return this.getFallbackActivities(destination, 1, 'afternoon', [category]);
    } catch (err) {
      console.error(`Error generating ${category} activities:`, err);
      return this.getFallbackActivities(destination, 1, 'afternoon', [category]);
    }
  }

  // Fallback activities when AI fails
  getFallbackActivities(destination, dayNumber, timeSlot, interests = []) {
    const fallbackMap = {
      shopping: [
        {
          title: `${destination} Local Market`,
          type: 'shopping',
          location: `${destination} Central Market`,
          description: 'Explore local crafts, textiles, and authentic souvenirs',
          duration: '2h',
          time: '14:00',
          price: '$',
          includes: ['Local crafts', 'Authentic souvenirs', 'Cultural items'],
          interest_category: 'shopping'
        }
      ],
      nightlife: [
        {
          title: `${destination} Evening Entertainment`,
          type: 'nightlife',
          location: `${destination} Entertainment District`,
          description: 'Experience the local nightlife and cultural performances',
          duration: '3h',
          time: '21:00',
          price: '$$',
          includes: ['Live music', 'Local drinks', 'Cultural shows'],
          interest_category: 'nightlife'
        }
      ],
      cultural: [
        {
          title: `${destination} Cultural Experience`,
          type: 'cultural',
          location: `${destination} Cultural Center`,
          description: 'Immerse in local traditions and cultural practices',
          duration: '2h',
          time: '15:00',
          price: '$',
          includes: ['Cultural demonstrations', 'Traditional crafts', 'Local stories'],
          interest_category: 'cultural'
        }
      ],
      food: [
        {
          title: `${destination} Food Tour`,
          type: 'food',
          location: `${destination} Food District`,
          description: 'Taste authentic local cuisine and street food',
          duration: '2h',
          time: '16:00',
          price: '$$',
          includes: ['Local delicacies', 'Street food', 'Traditional recipes'],
          interest_category: 'food'
        }
      ]
    };

    // Return activities based on interests
    const activities = [];
    interests.forEach(interest => {
      if (fallbackMap[interest]) {
        activities.push(...fallbackMap[interest]);
      }
    });

    // If no specific interests or no matches, return a general activity
    if (activities.length === 0) {
      activities.push({
        title: `${destination} Local Experience`,
        type: 'local_experience',
        location: `${destination} City Center`,
        description: 'Discover the authentic local culture and hidden gems',
        duration: '2h',
        time: timeSlot === 'morning' ? '10:00' : timeSlot === 'afternoon' ? '15:00' : '19:00',
        price: '$',
        includes: ['Local insights', 'Hidden gems', 'Authentic experience'],
        interest_category: 'local_experience'
      });
    }

    return activities;
  }
}

export default CohereItineraryService;
