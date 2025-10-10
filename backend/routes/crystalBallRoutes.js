import express from 'express';

const router = express.Router();

// == Crystal Ball API Route ==
router.post('/discover-destinations', async (req, res) => {
  const requestId = Math.random().toString(36).substring(2, 8);
  console.log(`\n=== Crystal Ball Request (ID: ${requestId}) ===`);
  console.log('Request body:', JSON.stringify(req.body, null, 2));

  try {
    const { vibe, setting, pace } = req.body;

    if (!vibe || !setting || !pace) {
      const errorMsg = 'Missing required fields: vibe, setting, and pace are required';
      console.error(`[${requestId}] Error: ${errorMsg}`);
      return res.status(400).json({ error: errorMsg });
    }

    console.log(`[${requestId}] Generating destinations for: ${vibe} + ${setting} + ${pace}`);

    // Destination database based on preferences - India Only
    const destinationDatabase = {
      adventure: {
        city: {
          slow: [
            { name: 'Jaipur, Rajasthan', description: 'Wander through the Pink City\'s royal palaces and vibrant bazaars at your own pace.', vibe: 'Royal Adventure Explorer', preview_activities: ['Explore Amber Fort', 'Walk through City Palace', 'Discover Hawa Mahal'] },
            { name: 'Udaipur, Rajasthan', description: 'Explore the City of Lakes with its majestic palaces and romantic boat rides.', vibe: 'Lake City Wanderer', preview_activities: ['Boat ride on Lake Pichola', 'Visit City Palace', 'Explore Jagdish Temple'] }
          ],
          medium: [
            { name: 'Delhi, India', description: 'Balance ancient Mughal heritage with modern urban adventures in the capital city.', vibe: 'Capital City Explorer', preview_activities: ['Tour Red Fort', 'Explore India Gate', 'Visit Chandni Chowk'] },
            { name: 'Mumbai, Maharashtra', description: 'Navigate the bustling financial capital while discovering Bollywood culture and street food.', vibe: 'Bollywood Urban Explorer', preview_activities: ['Visit Gateway of India', 'Explore Marine Drive', 'Experience Dharavi slum tour'] }
          ],
          fast: [
            { name: 'Bangalore, Karnataka', description: 'Dive into India\'s Silicon Valley with non-stop tech culture and vibrant nightlife.', vibe: 'Tech City Thrill-seeker', preview_activities: ['Explore Cubbon Park', 'Visit Bangalore Palace', 'Experience pub hopping'] },
            { name: 'Pune, Maharashtra', description: 'Experience rapid urban adventures in the Oxford of the East with its educational heritage.', vibe: 'Educational Hub Explorer', preview_activities: ['Visit Shaniwar Wada', 'Explore Osho Ashram', 'Trek to Sinhagad Fort'] }
          ]
        },
        nature: {
          slow: [
            { name: 'Munnar, Kerala', description: 'Immerse yourself in tea plantations and misty hills with gentle nature walks.', vibe: 'Tea Garden Seeker', preview_activities: ['Tea plantation tours', 'Gentle hill walks', 'Wildlife watching at Eravikulam'] },
            { name: 'Coorg, Karnataka', description: 'Cycle through coffee plantations and spice gardens at a leisurely countryside pace.', vibe: 'Coffee Country Wanderer', preview_activities: ['Coffee plantation tours', 'Spice garden visits', 'Abbey Falls exploration'] }
          ],
          medium: [
            { name: 'Manali, Himachal Pradesh', description: 'Trek through dramatic Himalayan landscapes with perfect balance of adventure and rest.', vibe: 'Himalayan Explorer', preview_activities: ['Rohtang Pass trek', 'Solang Valley adventures', 'Old Manali exploration'] },
            { name: 'Rishikesh, Uttarakhand', description: 'Discover spiritual and adventure activities along the holy Ganges river.', vibe: 'Spiritual Adventure Seeker', preview_activities: ['River rafting', 'Yoga sessions', 'Lakshman Jhula walks'] }
          ],
          fast: [
            { name: 'Leh-Ladakh, Jammu & Kashmir', description: 'Push your limits with high-altitude desert trekking and mountain biking adventures.', vibe: 'High Altitude Challenger', preview_activities: ['Khardung La pass', 'Pangong Tso lake trek', 'Monastery visits'] },
            { name: 'Jim Corbett, Uttarakhand', description: 'Adrenaline-packed wildlife safaris and jungle adventures in India\'s oldest national park.', vibe: 'Wildlife Adventure Seeker', preview_activities: ['Tiger safari', 'Jungle trekking', 'Bird watching expeditions'] }
          ]
        },
        coast: {
          slow: [
            { name: 'Gokarna, Karnataka', description: 'Watch endless sunsets over pristine beaches while exploring ancient temples.', vibe: 'Beach Temple Wanderer', preview_activities: ['Beach hopping', 'Temple visits', 'Sunset meditation'] },
            { name: 'Varkala, Kerala', description: 'Relax on cliff-top beaches with Ayurvedic treatments and spiritual experiences.', vibe: 'Cliff Beach Drifter', preview_activities: ['Cliff beach walks', 'Ayurvedic spa', 'Janardanaswamy Temple'] }
          ],
          medium: [
            { name: 'Andaman Islands', description: 'Dive into underwater adventures while enjoying tropical island relaxation.', vibe: 'Tropical Island Explorer', preview_activities: ['Scuba diving', 'Island hopping', 'Coral reef exploration'] },
            { name: 'Konkan Coast, Maharashtra', description: 'Navigate dramatic coastal roads and discover hidden beaches and fishing villages.', vibe: 'Konkan Coast Explorer', preview_activities: ['Beach exploration', 'Fort visits', 'Local fishing village tours'] }
          ],
          fast: [
            { name: 'Goa Beaches', description: 'High-energy beach parties and rapid exploration of diverse coastal experiences.', vibe: 'Beach Party Enthusiast', preview_activities: ['Water sports', 'Beach parties', 'Rapid beach hopping'] },
            { name: 'Pondicherry, Tamil Nadu', description: 'French colonial charm with rapid exploration of beaches and spiritual centers.', vibe: 'Franco-Indian Explorer', preview_activities: ['French Quarter tours', 'Auroville visits', 'Beach activities'] }
          ]
        }
      },
      relaxation: {
        city: {
          slow: [
            { name: 'Mysore, Karnataka', description: 'Find zen in royal palaces and traditional yoga practices in this peaceful cultural capital.', vibe: 'Royal Zen Seeker', preview_activities: ['Palace meditation', 'Traditional yoga sessions', 'Devaraja Market walks'] },
            { name: 'Pondicherry, Tamil Nadu', description: 'Savor French colonial charm and spiritual culture in elegant, unhurried surroundings.', vibe: 'Franco-Indian Relaxer', preview_activities: ['French Quarter strolls', 'Auroville meditation', 'Seaside cafés'] }
          ],
          medium: [
            { name: 'Kolkata, West Bengal', description: 'Balance cultural heritage with leisurely café culture and Hooghly river walks.', vibe: 'Cultural City Wanderer', preview_activities: ['Hooghly river cruises', 'Coffee house culture', 'Victoria Memorial tours'] },
            { name: 'Kochi, Kerala', description: 'Enjoy backwater culture with cozy spice markets and relaxed coastal lifestyle.', vibe: 'Spice Coast Enthusiast', preview_activities: ['Spice market visits', 'Chinese fishing nets', 'Backwater boat tours'] }
          ],
          fast: [
            { name: 'Chandigarh, Punjab', description: 'Efficient urban relaxation with world-class gardens, architecture, and wellness centers.', vibe: 'Planned City Wellness Seeker', preview_activities: ['Rock Garden visits', 'Sukhna Lake', 'Rose Garden walks'] },
            { name: 'Hyderabad, Telangana', description: 'Luxury relaxation with heritage sites, modern spas, and world-class shopping.', vibe: 'Nizami Luxury Relaxer', preview_activities: ['Charminar visits', 'Luxury spa treatments', 'Hitech City shopping'] }
          ]
        },
        nature: {
          slow: [
            { name: 'Wayanad, Kerala', description: 'Immerse in spice plantations, tribal culture, and spiritual healing in tropical serenity.', vibe: 'Spice Garden Spiritual Seeker', preview_activities: ['Spice plantation tours', 'Tribal village visits', 'Ayurvedic treatments'] },
            { name: 'Shimla, Himachal Pradesh', description: 'Breathe mountain air while enjoying gentle walks and colonial hill station charm.', vibe: 'Hill Station Relaxer', preview_activities: ['Mall Road walks', 'Ridge viewpoints', 'Colonial architecture tours'] }
          ],
          medium: [
            { name: 'Ooty, Tamil Nadu', description: 'Hill station eco-lodges and tea gardens combined with botanical gardens and lake relaxation.', vibe: 'Nilgiri Eco Relaxer', preview_activities: ['Tea garden tours', 'Botanical garden walks', 'Boat rides on Ooty Lake'] },
            { name: 'Mount Abu, Rajasthan', description: 'Desert state\'s only hill station with Jain temples and cool climate perfect for meditation.', vibe: 'Desert Hill Mystic', preview_activities: ['Dilwara temple visits', 'Nakki Lake boating', 'Sunset Point meditation'] }
          ],
          fast: [
            { name: 'Dharamshala, Himachal Pradesh', description: 'Tibetan culture and mountain resort luxury with quick access to spiritual activities.', vibe: 'Tibetan Mountain Relaxer', preview_activities: ['Dalai Lama temple visits', 'Tibetan monastery tours', 'Mountain trekking'] },
            { name: 'Nainital, Uttarakhand', description: 'Lake district relaxation with luxury resorts and pristine Himalayan wilderness.', vibe: 'Lake District Luxury Seeker', preview_activities: ['Naini Lake boating', 'Snow View Point', 'Mall Road shopping'] }
          ]
        },
        coast: {
          slow: [
            { name: 'Alleppey, Kerala', description: 'Ultimate backwater relaxation with houseboat stays and pristine lagoons.', vibe: 'Backwater Paradise Seeker', preview_activities: ['Houseboat stays', 'Sunset backwater cruises', 'Ayurvedic spa treatments'] },
            { name: 'Mahabalipuram, Tamil Nadu', description: 'Ancient shore temples and pristine beaches in an untouched coastal paradise.', vibe: 'Temple Beach Dweller', preview_activities: ['Shore temple visits', 'Beach meditation', 'Stone carving workshops'] }
          ],
          medium: [
            { name: 'Kovalam, Kerala', description: 'Balance beach relaxation with Ayurvedic treatments and local fishing culture.', vibe: 'Ayurvedic Beach Explorer', preview_activities: ['Beach relaxation', 'Ayurvedic treatments', 'Lighthouse visits'] },
            { name: 'Puri, Odisha', description: 'Sacred beach town with Jagannath temple and laid-back coastal culture.', vibe: 'Sacred Coast Relaxer', preview_activities: ['Jagannath temple visits', 'Beach walks', 'Sand art viewing'] }
          ],
          fast: [
            { name: 'Goa North Beaches', description: 'Beach shack culture with Portuguese architecture and vibrant nightlife.', vibe: 'Portuguese Beach Enthusiast', preview_activities: ['Beach shack hopping', 'Portuguese church tours', 'Sunset parties'] },
            { name: 'Diu, Gujarat', description: 'Portuguese colonial beaches with rapid exploration of forts and coastal experiences.', vibe: 'Colonial Coast Explorer', preview_activities: ['Diu Fort visits', 'Beach activities', 'Portuguese heritage tours'] }
          ]
        }
      },
      culture: {
        city: {
          slow: [
            { name: 'Varanasi, Uttar Pradesh', description: 'Ancient spiritual traditions and Ganges ghats await in this cradle of Indian heritage.', vibe: 'Spiritual Heritage Scholar', preview_activities: ['Ganga Aarti ceremonies', 'Ancient temple visits', 'Traditional music walks'] },
            { name: 'Agra, Uttar Pradesh', description: 'Where Mughal grandeur meets eternal love in a city rich with architectural treasures.', vibe: 'Mughal Heritage Walker', preview_activities: ['Taj Mahal exploration', 'Agra Fort wandering', 'Mehtab Bagh sunset views'] }
          ],
          medium: [
            { name: 'Hampi, Karnataka', description: 'Ancient Vijayanagara empire comes alive in this UNESCO World Heritage site.', vibe: 'Ancient Empire Enthusiast', preview_activities: ['Virupaksha Temple tours', 'Royal enclosure visits', 'Stone chariot exploration'] },
            { name: 'Khajuraho, Madhya Pradesh', description: 'Chandela dynasty temples tell stories of one of India\'s most artistic civilizations.', vibe: 'Temple Art Explorer', preview_activities: ['Erotic temple tours', 'Archaeological museum visits', 'Light and sound shows'] }
          ],
          fast: [
            { name: 'Rajasthan Golden Triangle', description: 'Royal heritage and desert culture collide in this dynamic cultural circuit.', vibe: 'Royal Culture Enthusiast', preview_activities: ['Multiple fort visits', 'Royal palace tours', 'Traditional folk shows'] },
            { name: 'Amritsar, Punjab', description: 'Sikh heritage and Punjabi culture showcase centuries of tradition and valor.', vibe: 'Sikh Heritage Explorer', preview_activities: ['Golden Temple visits', 'Wagah Border ceremony', 'Traditional Punjabi cuisine'] }
          ]
        },
        nature: {
          slow: [
            { name: 'Spiti Valley, Himachal Pradesh', description: 'Buddhist monasteries nestled in Trans-Himalayan valleys offer profound cultural immersion.', vibe: 'Trans-Himalayan Culture Seeker', preview_activities: ['Ancient monastery visits', 'Traditional festivals', 'High altitude cultural treks'] },
            { name: 'Zanskar Valley, Ladakh', description: 'Ancient Buddhist heritage and Ladakhi culture in spectacular mountain settings.', vibe: 'Ancient Buddhist Culture Explorer', preview_activities: ['Monastery explorations', 'Traditional weaving workshops', 'Buddhist cultural ceremonies'] }
          ],
          medium: [
            { name: 'Rajasthan Desert', description: 'Thar desert\'s ancient culture and Rajasthani traditions in dramatic desert landscapes.', vibe: 'Desert Culture Explorer', preview_activities: ['Desert fort tours', 'Camel safari cultural experiences', 'Desert village visits'] },
            { name: 'Sikkim Monasteries', description: 'Buddhist temples and traditional Sikkimese culture in pristine Himalayan settings.', vibe: 'Himalayan Buddhist Culture Seeker', preview_activities: ['Rumtek monastery exploration', 'Traditional dance shows', 'Monastery meditation sessions'] }
          ],
          fast: [
            { name: 'Arunachal Pradesh', description: 'Tribal cultures and Buddhist monasteries in rapid exploration of India\'s sunrise state.', vibe: 'Tribal Culture Enthusiast', preview_activities: ['Tawang monastery tours', 'Rapid tribal village visits', 'Traditional tribal dance shows'] },
            { name: 'Meghalaya Living Roots', description: 'Khasi tribal culture and living root bridges in Northeast India\'s cultural heartland.', vibe: 'Living Heritage Explorer', preview_activities: ['Living root bridge treks', 'Tribal cultural encounters', 'Traditional Khasi ceremonies'] }
          ]
        },
        coast: {
          slow: [
            { name: 'Kumari Amman, Tamil Nadu', description: 'Ancient Dravidian culture and traditional Tamil heritage by the Indian Ocean.', vibe: 'Dravidian Culture Seeker', preview_activities: ['Ancient temple visits', 'Traditional Tamil cooking classes', 'Classical dance performances'] },
            { name: 'Dwarka, Gujarat', description: 'Krishna\'s legendary city and ancient traditions along India\'s western coast.', vibe: 'Mythological Culture Explorer', preview_activities: ['Dwarkadhish temple visits', 'Traditional Gujarati performances', 'Coastal pilgrimage tours'] }
          ],
          medium: [
            { name: 'Konark, Odisha', description: 'Sun temple architecture and Odishan culture meet Bay of Bengal waves.', vibe: 'Temple Architecture Enthusiast', preview_activities: ['Sun Temple cultural tours', 'Traditional Odissi dance', 'Coastal heritage walks'] },
            { name: 'Goa Heritage', description: 'Portuguese and Konkani cultures blend in this coastal cultural crossroads.', vibe: 'Indo-Portuguese Culture Explorer', preview_activities: ['Heritage church tours', 'Traditional fado music', 'Konkani cultural experiences'] }
          ],
          fast: [
            { name: 'Chennai Cultural', description: 'Ancient Tamil culture meets modern South Indian traditions in this dynamic coastal city.', vibe: 'Tamil Culture Explorer', preview_activities: ['Kapaleeshwarar temple tours', 'Classical music concerts', 'Traditional craft workshops'] },
            { name: 'Visakhapatnam, Andhra Pradesh', description: 'Telugu heritage and coastal Andhra culture by the Bay of Bengal.', vibe: 'Coastal Telugu Culture Enthusiast', preview_activities: ['Simhachalam temple visits', 'Traditional Kuchipudi dance', 'Coastal heritage experiences'] }
          ]
        }
      }
    };

    // Get destinations based on preferences
    const destinations = destinationDatabase[vibe]?.[setting]?.[pace] || [];
    
    // If no exact match, provide some fallback destinations
    if (destinations.length === 0) {
      const fallbackDestinations = [
        { 
          name: 'Mystery Destination', 
          description: 'The crystal ball swirls with possibilities, but the vision remains clouded. Perhaps try different combinations to reveal clearer omens.', 
          vibe: 'Mysterious', 
          preview_activities: ['Explore the unknown', 'Discover hidden gems', 'Create your own adventure'] 
        }
      ];
      
      console.log(`[${requestId}] No destinations found for ${vibe}+${setting}+${pace}, returning fallback`);
      return res.json(fallbackDestinations);
    }

    // Randomly select 2-3 destinations from the matching category
    const selectedDestinations = destinations
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.min(3, destinations.length));

    console.log(`[${requestId}] ✅ Generated ${selectedDestinations.length} destinations`);
    res.json(selectedDestinations);

  } catch (error) {
    console.error(`[${requestId}] Error generating destinations:`, error);
    res.status(500).json({ 
      error: 'The Crystal Ball is cloudy. Please try again later.',
      message: error.message 
    });
  }
});

export default router;
