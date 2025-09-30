import axios from 'axios';

class FreeDataService {
  constructor() {
    this.nominatimBaseUrl = 'https://nominatim.openstreetmap.org';
    this.overpassBaseUrl = 'https://overpass-api.de/api/interpreter';
    this.weatherApiKey = process.env.VITE_OPENWEATHER_API_KEY || process.env.OPENWEATHER_API_KEY || 'your_openweather_api_key_here';
    this.weatherBaseUrl = 'https://api.openweathermap.org/data/2.5';
  }

  async getCoordinates(destination) {
    try {
      console.log(`\n=== Fetching coordinates for: ${destination} ===`);
      
      // For Goa, use a more specific query with higher limit and more details
      let query = destination;
      let params = {
        q: query,
        format: 'json',
        limit: 10,  // Increased limit to get more results
        addressdetails: 1,
        namedetails: 1,  // Include named details for better matching
        extratags: 1,
        countrycodes: 'in',  // Prioritize results in India
        'accept-language': 'en'  // Prefer English names
      };
      
      // Special handling for Goa
      const isGoa = destination.toLowerCase().includes('goa');
      if (isGoa) {
        query = 'Goa, India';
        params = {
          ...params,
          q: 'Goa, India',
          state: 'Goa',
          country: 'India',
          limit: 15  // Even more results for Goa
        };
      }
      
      console.log(`Querying Nominatim with:`, { query, ...params });
      
      const response = await axios.get(this.nominatimBaseUrl + '/search', {
        params,
        headers: { 
          'User-Agent': 'TravelApp/1.0 (https://yourapp.com; contact@yourapp.com)',
          'Referer': 'https://yourapp.com'
        },
        timeout: 15000  // Increased timeout for better reliability
      });

      console.log(`Nominatim returned ${response.data?.length || 0} results`);
      
      if (response.data && response.data.length > 0) {
        // Log top 3 results for debugging
        console.log('Top 3 results:');
        response.data.slice(0, 3).forEach((item, i) => {
          console.log(`${i+1}. ${item.display_name} (${item.lat}, ${item.lon}) - ${item.type} - importance: ${item.importance}`);
        });

        // For Goa, try to find the most relevant result
        if (isGoa) {
          // First, look for administrative areas in Goa with high importance
          const administrativeResults = response.data.filter(item => 
            item.type === 'administrative' && 
            item.address?.state?.toLowerCase() === 'goa' &&
            item.importance > 0.5
          );
          
          if (administrativeResults.length > 0) {
            // Sort by importance and take the highest
            const bestAdminResult = [...administrativeResults].sort((a, b) => b.importance - a.importance)[0];
            console.log(`Selected administrative area: ${bestAdminResult.display_name} (importance: ${bestAdminResult.importance})`);
            
            return {
              lat: parseFloat(bestAdminResult.lat),
              lon: parseFloat(bestAdminResult.lon),
              display_name: bestAdminResult.display_name,
              type: bestAdminResult.type,
              importance: bestAdminResult.importance
            };
          }
          
          // If no administrative area found, look for any result with Goa in the name and high importance
          const goaResults = response.data.filter(item => 
            (item.display_name?.toLowerCase().includes('goa') ||
             item.address?.state?.toLowerCase() === 'goa') &&
            item.importance > 0.4
          );
          
          if (goaResults.length > 0) {
            // Sort by importance and take the highest
            const bestGoaResult = [...goaResults].sort((a, b) => b.importance - a.importance)[0];
            console.log(`Selected Goa result: ${bestGoaResult.display_name} (importance: ${bestGoaResult.importance})`);
            
            return {
              lat: parseFloat(bestGoaResult.lat),
              lon: parseFloat(bestGoaResult.lon),
              display_name: bestGoaResult.display_name,
              type: bestGoaResult.type,
              importance: bestGoaResult.importance
            };
          }
        }
        
        // Default to first result if no specific result found
        const result = response.data[0];
        console.log(`Using first result: ${result.display_name} (${result.lat}, ${result.lon})`);
        
        return {
          lat: parseFloat(result.lat),
          lon: parseFloat(result.lon),
          display_name: result.display_name,
          type: result.type,
          importance: result.importance || 0
        };
      }
      
      throw new Error('No results found from geocoding service');
    } catch (error) {
      console.error(`Error in getCoordinates for ${destination}:`, error.message);
      console.error(error.stack);
      
      // Return default coordinates for Goa as fallback
      if (destination.toLowerCase().includes('goa')) {
        console.log('Using fallback coordinates for Goa, India');
        return {
          lat: 15.2993,
          lon: 74.1240,
          display_name: 'Goa, India',
          type: 'administrative',
          importance: 0.9
        };
      }
      
      throw new Error(`Failed to get coordinates for ${destination}: ${error.message}`);
    }
  }

  async queryOverpass(query, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`Overpass attempt ${attempt}/${retries}`);
        console.log('Sending query to Overpass API...');
        
        const startTime = Date.now();
        const response = await axios.post(this.overpassBaseUrl, query, {
          headers: {
            'Content-Type': 'text/plain',
            'User-Agent': 'TravelApp/1.0 (https://yourapp.com; contact@yourapp.com)'
          },
          timeout: 60000,  // Increased timeout to 60 seconds
          maxContentLength: 50 * 1024 * 1024,  // 50MB max content length
          maxBodyLength: 50 * 1024 * 1024     // 50MB max body length
        });
        
        const endTime = Date.now();
        console.log(`Overpass API response received in ${(endTime - startTime) / 1000} seconds`);
        
        if (!response.data) {
          console.error('Empty response from Overpass API');
          throw new Error('Empty response from Overpass API');
        }

        if (response.data.elements) {
          console.log(`Got ${response.data.elements.length} elements from Overpass`);
          return response.data.elements;
        } else if (response.data.remark) {
          console.error('Overpass API remark:', response.data.remark);
          throw new Error(`Overpass API remark: ${response.data.remark}`);
        } else {
          console.error('Unexpected Overpass response format:', response.data);
          throw new Error('Unexpected response format from Overpass API');
        }
      } catch (error) {
        const waitTime = 2000 * attempt;
        console.error(`Overpass attempt ${attempt} failed:`, error.message);
        console.log(`Waiting ${waitTime/1000} seconds before retry...`);
        
        if (attempt === retries) {
          console.error('All Overpass API attempts failed');
          throw error;
        }
        
        // Wait with exponential backoff
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    console.error('All Overpass API attempts exhausted');
    return [];
  }

  /**
   * Fetches attractions for a given destination using Overpass API with bbox queries
   * @param {string} destination - The destination to search for attractions
   * @param {string} [budget='medium'] - Budget level (low/medium/high)
   * @returns {Promise<Array>} Array of processed attractions
   */
  async getAttractions(destination, budget = 'medium') {
    try {
      console.log(`\n=== Starting attraction search for: ${destination} ===`);
      const coords = await this.getCoordinates(destination);
      const { lat, lon, display_name } = coords;
      
      console.log(`Using coordinates: ${lat}, ${lon} for ${destination} (${display_name})`);

      // Try different approaches with increasing search radius
      const approaches = [
        { radiusKm: 5, timeout: 45, name: 'small' },
        { radiusKm: 10, timeout: 60, name: 'medium' },
        { radiusKm: 20, timeout: 90, name: 'large' }
      ];
      
      for (const approach of approaches) {
        try {
          console.log(`\n=== Trying ${approach.name} area (${approach.radiusKm}km radius) ===`);
          
          // Calculate bounding box for this approach
          const bbox = this.getBoundingBox(lat, lon, approach.radiusKm);
          const bboxStr = `${bbox.minLat},${bbox.minLon},${bbox.maxLat},${bbox.maxLon}`;
          
          console.log(`Using bounding box: ${bboxStr}`);
          
          // Build the Overpass QL query
          const query = this.buildAttractionsQuery(bboxStr, approach.timeout);
          
          // Execute the query
          const elements = await this.queryOverpass(query);
          console.log(`Attractions response: ${elements ? elements.length : 0} elements`);
          
          if (elements && elements.length > 0) {
            const processed = this.processAttractions(elements, destination);
            console.log(`Processed ${processed.length} attractions`);
            
            // If we got a reasonable number of results, return them
            if (processed.length >= 5) {
              return processed.slice(0, 50);  // Return up to 50 results
            }
            // Otherwise, try with a larger radius
          }
        } catch (error) {
          console.error(`Attractions approach with radius ${approach.radiusKm}km failed:`, error.message);
          // Continue to the next approach on error
          continue;
        }
      }

      console.log('No attractions found after trying all approaches');
      return [];
    } catch (error) {
      console.error('Error in getAttractions:', error);
      return [];
    }
  }
  
  /**
   * Builds an Overpass QL query for attractions within a bounding box
   * @param {string} bbox - Bounding box string "south,west,north,east"
   * @param {number} timeout - Query timeout in seconds
   * @returns {string} Overpass QL query string
   */
  buildAttractionsQuery(bbox, timeout) {
    return `
[out:json][timeout:${timeout}][bbox:${bbox}];
(
  // Tourism features (nodes, ways, relations)
  node["tourism"](if: t["name"]);
  way["tourism"](if: t["name"]);
  relation["tourism"](if: t["name"]);
  
  // Historic and cultural sites
  node["historic"](if: t["name"]);
  way["historic"](if: t["name"]);
  relation["historic"](if: t["name"]);
  
  // Natural features
  node["natural"~"beach|waterfall|peak|volcano|cliff|cave|arch|valley|canyon|dune|geyser|hot_spring|spring|geological|island|peninsula|cape|bay|lagoon"](if: t["name"]);
  way["natural"~"beach|waterfall|peak|volcano|cliff|cave|arch|valley|canyon|dune|geyser|hot_spring|spring|geological|island|peninsula|cape|bay|lagoon"](if: t["name"]);
  relation["natural"~"beach|waterfall|peak|volcano|cliff|cave|arch|valley|canyon|dune|geyser|hot_spring|spring|geological|island|peninsula|cape|bay|lagoon"](if: t["name"]);
  
  // Water features
  node["water"](if: t["name"]);
  way["water"](if: t["name"]);
  relation["water"](if: t["name"]);
  
  // Leisure areas
  node["leisure"~"park|garden|nature_reserve|recreation_ground|water_park|golf_course|marina"](if: t["name"]);
  way["leisure"~"park|garden|nature_reserve|recreation_ground|water_park|golf_course|marina"](if: t["name"]);
  relation["leisure"~"park|garden|nature_reserve|recreation_ground|water_park|golf_course|marina"](if: t["name"]);
  
  // Man-made features
  node["man_made"~"lighthouse|observatory|tower|bridge|castle|monument"](if: t["name"]);
  way["man_made"~"lighthouse|observatory|tower|bridge|castle|monument"](if: t["name"]);
  relation["man_made"~"lighthouse|observatory|tower|bridge|castle|monument"](if: t["name"]);
  
  // Religious sites
  node["amenity"~"place_of_worship"]["religion"](if: t["name"]);
  way["amenity"~"place_of_worship"]["religion"](if: t["name"]);
  relation["amenity"~"place_of_worship"]["religion"](if: t["name"]);
  
  // Viewpoints and lookouts
  node["tourism"="viewpoint"](if: t["name"]);
  way["tourism"="viewpoint"](if: t["name"]);
  
  // Museums and galleries
  node["tourism"~"museum|gallery"](if: t["name"]);
  way["tourism"~"museum|gallery"](if: t["name"]);
  relation["tourism"~"museum|gallery"](if: t["name"]);
  
  // Zoos and aquariums
  node["tourism"~"zoo|aquarium"](if: t["name"]);
  way["tourism"~"zoo|aquarium"](if: t["name"]);
  relation["tourism"~"zoo|aquarium"](if: t["name"]);
);

// Get center points for ways and relations
(._;>;);

// Output results with center points for ways/relations
out body center;
>;
out skel qt;`;
  }

  async getRestaurants(destination, budget = 'medium') {
    try {
      console.log(`Fetching restaurants for: ${destination}`);
      const coords = await this.getCoordinates(destination);
      const { lat, lon } = coords;
      console.log(`Using coordinates: ${lat}, ${lon} for restaurants in ${destination}`);

      // Try different approaches with increasing radius
      const approaches = [
        { radius: 2000, timeout: 20 },
        { radius: 5000, timeout: 30 },
        { radius: 10000, timeout: 40 }  // Larger radius for Goa
      ];

      for (const approach of approaches) {
        try {
          console.log(`Trying restaurants with radius ${approach.radius}m`);
          // More comprehensive query for restaurants
          const query = `[out:json][timeout:${approach.timeout}];
(
  // Node queries
  node["amenity"="restaurant"](around:${approach.radius},${lat},${lon});
  node["amenity"="cafe"](around:${approach.radius},${lat},${lon});
  node["amenity"="fast_food"](around:${approach.radius},${lat},${lon});
  node["amenity"="bar"](around:${approach.radius},${lat},${lon});
  node["amenity"="pub"](around:${approach.radius},${lat},${lon});
  
  // Way queries
  way["amenity"="restaurant"](around:${approach.radius},${lat},${lon});
  way["amenity"="cafe"](around:${approach.radius},${lat},${lon});
  
  // Relation queries
  relation["amenity"="restaurant"](around:${approach.radius},${lat},${lon});
  relation["amenity"="cafe"](around:${approach.radius},${lat},${lon});
);

// Convert ways and relations to nodes
(._;>;);

// Output results
out body;
>;
out skel qt;`;

          const elements = await this.queryOverpass(query);
          console.log(`Restaurants response: ${elements ? elements.length : 0} elements`);
          
          if (elements && elements.length > 0) {
            const processed = this.processRestaurants(elements, budget);
            console.log(`Processed ${processed.length} restaurants`);
            return processed.slice(0, 10);  // Return more results to ensure we have enough
          }
        } catch (error) {
          console.log(`Restaurant approach with radius ${approach.radius}m failed:`, error.message);
          continue;
        }
      }

      console.log('No restaurants found after trying all approaches');
      return [];
    } catch (error) {
      console.error('Error fetching restaurants:', error.message);
      return [];
    }
  }

  async getHotels(destination, budget = 'medium') {
    try {
      console.log(`Fetching hotels for: ${destination}`);
      const coords = await this.getCoordinates(destination);
      const { lat, lon } = coords;
      console.log(`Using coordinates: ${lat}, ${lon} for hotels in ${destination}`);

      // Try different approaches with increasing radius
      const approaches = [
        { radius: 2000, timeout: 20 },
        { radius: 5000, timeout: 30 },
        { radius: 10000, timeout: 40 }  // Larger radius for Goa
      ];

      for (const approach of approaches) {
        try {
          console.log(`Trying hotels with radius ${approach.radius}m`);
          // More comprehensive query for hotels
          const query = `[out:json][timeout:${approach.timeout}];
(
  // Node queries
  node["tourism"="hotel"](around:${approach.radius},${lat},${lon});
  node["tourism"="hostel"](around:${approach.radius},${lat},${lon});
  node["tourism"="guest_house"](around:${approach.radius},${lat},${lon});
  node["tourism"="apartment"](around:${approach.radius},${lat},${lon});
  node["tourism"="resort"](around:${approach.radius},${lat},${lon});
  node["tourism"="motel"](around:${approach.radius},${lat},${lon});
  
  // Way queries
  way["tourism"="hotel"](around:${approach.radius},${lat},${lon});
  way["tourism"="hostel"](around:${approach.radius},${lat},${lon});
  
  // Relation queries
  relation["tourism"="hotel"](around:${approach.radius},${lat},${lon});
  relation["tourism"="resort"](around:${approach.radius},${lat},${lon});
);

// Convert ways and relations to nodes
(._;>;);

// Output results
out body;
>;
out skel qt;`;

          const elements = await this.queryOverpass(query);
          console.log(`Hotels response: ${elements ? elements.length : 0} elements`);
          
          if (elements && elements.length > 0) {
            const processed = this.processHotels(elements, budget);
            console.log(`Processed ${processed.length} hotels`);
            return processed.slice(0, 8);  // Return more results to ensure we have enough
          }
        } catch (error) {
          console.log(`Hotel approach with radius ${approach.radius}m failed:`, error.message);
          continue;
        }
      }

      console.log('No hotels found after trying all approaches');
      return [];
    } catch (error) {
      console.error('Error fetching hotels:', error.message);
      return [];
    }
  }

  async getWeather(destination) {
    // Skip weather API call if no API key is provided
    if (!this.weatherApiKey || this.weatherApiKey === 'your_openweather_api_key_here') {
      console.log('Skipping weather API call - no API key provided');
      return {
        temperature: 'N/A',
        description: 'Weather data requires API key',
        humidity: 'N/A',
        windSpeed: 'N/A'
      };
    }

    try {
      const coords = await this.getCoordinates(destination);
      const { lat, lon } = coords;

      const response = await axios.get(`${this.weatherBaseUrl}/weather`, {
        params: {
          lat: lat,
          lon: lon,
          appid: this.weatherApiKey,
          units: 'metric'
        },
        timeout: 5000
      });

      return {
        temperature: Math.round(response.data.main.temp),
        description: response.data.weather[0].description,
        humidity: response.data.main.humidity,
        windSpeed: response.data.wind.speed
      };
    } catch (error) {
      console.error('Error fetching weather:', error.message);
      return {
        temperature: 'N/A',
        description: 'Weather data unavailable',
        humidity: 'N/A',
        windSpeed: 'N/A'
      };
    }
  }

  /**
   * Processes raw OSM elements into a clean list of attractions
   * @param {Array} elements - Raw OSM elements from Overpass API
   * @param {string} destination - Destination name for context
   * @returns {Array} Processed list of attractions
   */
  /**
   * Processes raw OSM elements into a clean list of attractions
   * @param {Array} elements - Raw OSM elements from Overpass API
   * @param {string} destination - Destination name for context
   * @returns {Array} Processed list of attractions
   */
  processAttractions(elements, destination = '') {
    if (!elements || !Array.isArray(elements)) {
      console.log('No elements to process in processAttractions');
      return [];
    }

    console.log(`\n=== Processing ${elements.length} elements for ${destination} ===`);
    
    // Track processing statistics
    const stats = {
      totalProcessed: 0,
      skippedNoTags: 0,
      skippedNoName: 0,
      skippedGeneric: 0,
      skippedUninteresting: 0,
      includedByType: {},
      includedByCategory: {},
      elementsBySource: { node: 0, way: 0, relation: 0, other: 0 }
    };
    
    // Generic terms to filter out
    const genericTerms = [
      'parking', 'toilet', 'restaurant', 'cafe', 'hotel', 'hostel', 'apartment', 
      'house', 'building', 'supermarket', 'bank', 'atm', 'pharmacy', 'hospital',
      'clinic', 'school', 'university', 'college', 'office', 'bus stop', 'bus station',
      'train station', 'airport', 'waste', 'trash', 'crossing', 'traffic', 'signal',
      'light', 'sign', 'post', 'pole', 'tree', 'garbage', 'recycling', 'bin', 'container'
    ];
    
    // Define categories for classification
    const categories = {
      'tourism': ['attraction', 'museum', 'zoo', 'aquarium', 'theme_park', 'viewpoint', 'gallery', 'artwork'],
      'historic': ['monument', 'castle', 'fort', 'ruins', 'memorial', 'archaeological_site', 'tomb', 'wayside_shrine'],
      'religion': ['place_of_worship', 'church', 'temple', 'mosque', 'synagogue', 'cathedral', 'shrine', 'monastery'],
      'natural': ['beach', 'waterfall', 'cave', 'mountain', 'volcano', 'geyser', 'spring', 'cliff', 'dune', 'valley', 'canyon', 'arch'],
      'water': ['lake', 'river', 'pond', 'lagoon', 'harbor', 'marina', 'bay', 'gulf', 'reservoir', 'dam'],
      'leisure': ['park', 'garden', 'nature_reserve', 'recreation_ground', 'water_park', 'golf_course', 'sports_centre', 'stadium', 'track'],
      'entertainment': ['cinema', 'theatre', 'arts_centre', 'casino', 'nightclub', 'music_venue', 'stadium'],
      'food_drink': ['restaurant', 'cafe', 'bar', 'pub', 'biergarten', 'food_court', 'ice_cream'],
      'shopping': ['mall', 'department_store', 'marketplace', 'shopping_centre', 'gift_shop', 'souvenirs', 'craft'],
      'accommodation': ['hotel', 'hostel', 'guest_house', 'apartment', 'resort', 'motel', 'bed_and_breakfast', 'camp_site']
    };
    
    // Initialize stats for includedByCategory
    Object.keys(categories).forEach(cat => {
      stats.includedByType[cat] = 0;
    });
    
    // Process each element
    const processedAttractions = elements
      .filter(element => {
        stats.totalProcessed++;
        
        // Track element type
        if (element.type === 'node') stats.elementsBySource.node++;
        else if (element.type === 'way') stats.elementsBySource.way++;
        else if (element.type === 'relation') stats.elementsBySource.relation++;
        else stats.elementsBySource.other++;
        
        // Skip if no tags
        if (!element.tags) {
          stats.skippedNoTags++;
          return false;
        }
        
        const tags = element.tags;
        
        // Skip if no name or very short name
        if (!tags.name || tags.name.trim().length < 3) {
          stats.skippedNoName++;
          return false;
        }
        
        // Skip generic or uninteresting elements
        const lowerName = tags.name.toLowerCase();
        const isGeneric = genericTerms.some(term => lowerName.includes(term));
        
        if (isGeneric) {
          stats.skippedGeneric++;
          return false;
        }
        
        // Check if element belongs to any interesting category
        for (const [category, values] of Object.entries(categories)) {
          if (tags[category] && values.includes(tags[category])) {
            stats.includedByType[category]++;
            return true;
          }
        }
        
        // Check for any interesting tags
        const hasInterestingTag = Object.entries(tags).some(([key, value]) => {
          const interestingKeys = ['tourism', 'historic', 'natural', 'leisure', 'amenity', 'shop'];
          const interestingValues = [
            'attraction', 'museum', 'gallery', 'viewpoint', 'zoo', 'aquarium',
            'theme_park', 'castle', 'fort', 'ruins', 'monument', 'memorial', 'archaeological_site',
            'tomb', 'church', 'mosque', 'temple', 'beach', 'waterfall', 'cave', 'mountain', 'volcano',
            'park', 'garden', 'nature_reserve', 'water_park', 'bar', 'pub', 'nightclub', 'theatre',
            'cinema', 'arts_centre', 'mall', 'marketplace', 'souvenirs'
          ];
          
          return interestingKeys.includes(key) || 
                 (typeof value === 'string' && interestingValues.some(v => value.toLowerCase().includes(v)));
        });
        
        if (hasInterestingTag) {
          // Determine the most relevant category
          for (const [category, values] of Object.entries(categories)) {
            if (tags[category] && values.includes(tags[category])) {
              stats.includedByType[category]++;
              return true;
            }
          }
          
          // If no specific category found, use a general one
          if (tags.tourism) stats.includedByType.tourism++;
          else if (tags.historic) stats.includedByType.historic++;
          else if (tags.natural) stats.includedByType.natural++;
          else if (tags.leisure) stats.includedByType.leisure++;
          else if (tags.amenity) stats.includedByType.amenity = (stats.includedByType.amenity || 0) + 1;
          else if (tags.shop) stats.includedByType.shopping = (stats.includedByType.shopping || 0) + 1;
          else if (tags.water) stats.includedByType.water = (stats.includedByType.water || 0) + 1;
          else if (tags.religion) stats.includedByType.religion = (stats.includedByType.religion || 0) + 1;
          else if (tags.entertainment) stats.includedByType.entertainment = (stats.includedByType.entertainment || 0) + 1;
          else if (tags.food_drink) stats.includedByType.food_drink = (stats.includedByType.food_drink || 0) + 1;
          else if (tags.accommodation) stats.includedByType.accommodation = (stats.includedByType.accommodation || 0) + 1;
          else stats.includedByType.tourism = (stats.includedByType.tourism || 0) + 1;
          
          return true;
        }
    });
    
    // Process filtered elements into attraction objects
    const processed = processedAttractions
      .map(element => {
        try {
        const tags = element.tags || {};
        const name = tags.name || 'Unnamed Attraction';
        
        // Determine the primary category and type
        let category = 'tourism';
        let type = 'attraction';
        
        // Find the most specific category
        for (const [cat, values] of Object.entries(categories)) {
          if (tags[cat] && values.includes(tags[cat])) {
            category = cat;
            type = tags[cat];
            break;
          }
        }
        
        // Get coordinates (handle nodes, ways, and relations)
        let lat, lon;
        if (element.lat && element.lon) {
          // Node
          lat = element.lat;
          lon = element.lon;
        } else if (element.center) {
          // Way or relation with center
          lat = element.center.lat;
          lon = element.center.lon;
        } else if (element.bounds) {
          // Fallback to bounds center
          lat = (element.bounds.minlat + element.bounds.maxlat) / 2;
          lon = (element.bounds.minlon + element.bounds.maxlon) / 2;
        }
        
        // Skip if no coordinates
        if (!lat || !lon) {
          return null;
        }
        
        // Build address components if available
        const address = {};
        if (tags['addr:street']) address.street = tags['addr:street'];
        if (tags['addr:city']) address.city = tags['addr:city'];
        if (tags['addr:state']) address.state = tags['addr:state'];
        if (tags['addr:postcode']) address.postcode = tags['addr:postcode'];
        if (tags['addr:country']) address.country = tags['addr:country'];
        
        // Create the attraction object
        const attraction = {
          id: element.id || `osm-${Math.random().toString(36).substr(2, 9)}`,
          name: name,
          type: this.getUserFriendlyType(type),
          category: category,
          description: this.generateDescription(name, type, category, address, tags),
          coordinates: { lat, lon },
          address: Object.keys(address).length > 0 ? address : undefined,
          tags: { ...tags },
          osmType: element.type,
          website: tags.website || tags['contact:website'],
          phone: tags.phone || tags['contact:phone'],
          openingHours: tags.opening_hours,
          wheelchair: tags.wheelchair,
          fee: tags.fee === 'yes',
          rating: parseFloat(tags.rating) || null
        };
        
          return attraction;
        } catch (error) {
          console.error('Error processing attraction element:', error);
          console.error('Problematic element:', JSON.stringify(element, null, 2));
          return null;
        }
      })
      .filter(attraction => attraction !== null)
      .filter(attraction => attraction.coordinates && attraction.coordinates.lat && attraction.coordinates.lon)
      .filter((attraction, index, self) => {
        // Remove duplicates based on name and coordinates
        const firstIndex = self.findIndex(a => 
          a.name === attraction.name && 
          Math.abs(a.coordinates.lat - attraction.coordinates.lat) < 0.0001 &&
          Math.abs(a.coordinates.lon - attraction.coordinates.lon) < 0.0001
        );
        return firstIndex === index;
      });
    
    // Log processing statistics
    console.log('\n=== Processing Statistics ===');
    console.log(`Total elements: ${stats.totalProcessed}`);
    console.log(`Skipped (no tags): ${stats.skippedNoTags}`);
    console.log(`Skipped (no name): ${stats.skippedNoName}`);
    console.log(`Skipped (generic): ${stats.skippedGeneric}`);
    console.log('\nElements by source:');
    Object.entries(stats.elementsBySource).forEach(([type, count]) => {
      if (count > 0) console.log(`- ${type}: ${count}`);
    });
    console.log('\nIncluded by category:');
    Object.entries(stats.includedByType)
      .filter(([_, count]) => count > 0)
      .forEach(([category, count]) => {
        console.log(`- ${category}: ${count}`);
      });
    
    console.log(`\nTotal attractions found: ${processed.length}`);
    
    return processed;
  }

  processRestaurants(elements, budget) {
    if (!elements || !Array.isArray(elements)) {
      console.log('No elements to process in processRestaurants');
      return [];
    }

    console.log(`Processing ${elements.length} elements in processRestaurants`);
    
    const processed = elements
      .filter(element => {
        // Be more lenient with filtering - only exclude elements with no tags at all
        if (!element.tags) {
          console.log('Restaurant element has no tags:', element.id);
          return false;
        }
        
        // Log elements that would have been filtered out by the old filter
        if (!element.tags.name && !element.tags.amenity) {
          console.log('Restaurant with no name/amenity tags, but keeping it:', element.id, element.tags);
        }
        
        return true;
      })
      .map(element => {
        try {
          // Determine the best name
          let name = element.tags.name || 
                    element.tags['name:en'] || 
                    element.tags.brand ||
                    element.tags.amenity ||
                    'Local Restaurant';
          
          // Clean up the name
          if (typeof name === 'string') {
            name = name.replace(/^_+/, '').replace(/_+/g, ' ').trim();
            name = name.charAt(0).toUpperCase() + name.slice(1);
          }
          
          // Determine cuisine type
          let cuisine = 'Local cuisine';
          if (element.tags.cuisine) {
            cuisine = Array.isArray(element.tags.cuisine) 
              ? element.tags.cuisine.join(', ') 
              : element.tags.cuisine;
            cuisine = cuisine.split(';').map(c => c.trim()).join(', ');
          }
          
          // Create a more descriptive description
          let description = element.tags.description || 
                          element.tags['description:en'] ||
                          element.tags.note ||
                          (element.tags.cuisine ? `Serving ${cuisine} cuisine` : 'A local dining spot');
          
          // Get coordinates - handle both node and way/relation elements
          let lat, lon;
          if (element.lat && element.lon) {
            // Node element
            lat = element.lat;
            lon = element.lon;
          } else if (element.center) {
            // Way or relation with center
            lat = element.center.lat;
            lon = element.center.lon;
          } else if (element.bounds) {
            // Fallback to bounds center if no center is available
            lat = (element.bounds.minlat + element.bounds.maxlat) / 2;
            lon = (element.bounds.minlon + element.bounds.maxlon) / 2;
          }
          
          // Create the restaurant object
          const restaurant = {
            id: element.id || `osm-${Math.random().toString(36).substr(2, 9)}`,
            name: name,
            type: element.tags.amenity || 'restaurant',
            cuisine: cuisine,
            description: description,
            location: this.formatLocation(element),
            coordinates: {
              lat: lat || 0,
              lon: lon || 0
            },
            priceRange: this.getBudgetSymbol(budget),
            tags: element.tags || {}
          };
          
          // Add additional useful information if available
          if (element.tags.website) restaurant.website = element.tags.website;
          if (element.tags['contact:website']) restaurant.website = element.tags['contact:website'];
          if (element.tags.opening_hours) restaurant.openingHours = element.tags.opening_hours;
          if (element.tags['contact:phone']) restaurant.phone = element.tags['contact:phone'];
          if (element.tags.phone) restaurant.phone = element.tags.phone;
          if (element.tags['addr:street']) restaurant.address = element.tags['addr:street'];
          if (element.tags['addr:city']) restaurant.city = element.tags['addr:city'];
          
          return restaurant;
          
        } catch (error) {
          console.error('Error processing restaurant element:', error);
          console.error('Problematic element:', JSON.stringify(element, null, 2));
          return null;
        }
      })
      .filter(restaurant => restaurant !== null) // Remove any failed processing
      .filter((restaurant, index, self) => {
        // Remove duplicates based on name and coordinates
        const firstIndex = self.findIndex(r => 
          r.name === restaurant.name && 
          r.coordinates.lat === restaurant.coordinates.lat && 
          r.coordinates.lon === restaurant.coordinates.lon
        );
        return firstIndex === index;
      });
      
    console.log(`Processed ${processed.length} restaurants after filtering`);
    return processed.slice(0, 12); // Return up to 12 restaurants
  }

  processHotels(elements, budget) {
    if (!elements || !Array.isArray(elements)) {
      console.log('No elements to process in processHotels');
      return [];
    }

    console.log(`Processing ${elements.length} elements in processHotels`);
    
    const processed = elements
      .filter(element => {
        // Be more lenient with filtering - only exclude elements with no tags at all
        if (!element.tags) {
          console.log('Hotel element has no tags:', element.id);
          return false;
        }
        
        // Log elements that would have been filtered out by the old filter
        if (!element.tags.name && !element.tags.tourism) {
          console.log('Hotel with no name/tourism tags, but keeping it:', element.id, element.tags);
        }
        
        return true;
      })
      .map(element => {
        try {
          // Determine the best name
          let name = element.tags.name || 
                    element.tags['name:en'] || 
                    element.tags.brand ||
                    element.tags.tourism ||
                    'Accommodation';
          
          // Clean up the name
          if (typeof name === 'string') {
            name = name.replace(/^_+/, '').replace(/_+/g, ' ').trim();
            name = name.charAt(0).toUpperCase() + name.slice(1);
          }
          
          // Determine accommodation type
          let type = element.tags.tourism || 'hotel';
          if (element.tags.hotel) {
            type = element.tags.hotel;
          } else if (element.tags.guest_house) {
            type = 'guest house';
          }
          
          // Create a more descriptive description
          let description = element.tags.description || 
                          element.tags['description:en'] ||
                          element.tags.note ||
                          `${type} accommodation`;
          
          // Get coordinates - handle both node and way/relation elements
          let lat, lon;
          if (element.lat && element.lon) {
            // Node element
            lat = element.lat;
            lon = element.lon;
          } else if (element.center) {
            // Way or relation with center
            lat = element.center.lat;
            lon = element.center.lon;
          } else if (element.bounds) {
            // Fallback to bounds center if no center is available
            lat = (element.bounds.minlat + element.bounds.maxlat) / 2;
            lon = (element.bounds.minlon + element.bounds.maxlon) / 2;
          }
          
          // Get star rating if available
          let stars = 'N/A';
          if (element.tags.stars) {
            stars = element.tags.stars;
            // Convert to number if it's a string that can be converted
            if (typeof stars === 'string' && !isNaN(parseFloat(stars))) {
              stars = parseFloat(stars);
              // Ensure it's between 1 and 5
              stars = Math.min(5, Math.max(1, stars));
            }
          }
          
          // Create the hotel object
          const hotel = {
            id: element.id || `osm-${Math.random().toString(36).substr(2, 9)}`,
            name: name,
            type: type,
            description: description,
            location: this.formatLocation(element),
            coordinates: {
              lat: lat || 0,
              lon: lon || 0
            },
            priceRange: this.getBudgetSymbol(budget),
            stars: stars,
            tags: element.tags || {}
          };
          
          // Add additional useful information if available
          if (element.tags.website) hotel.website = element.tags.website;
          if (element.tags['contact:website']) hotel.website = element.tags['contact:website'];
          if (element.tags.opening_hours) hotel.openingHours = element.tags.opening_hours;
          if (element.tags['contact:phone']) hotel.phone = element.tags['contact:phone'];
          if (element.tags.phone) hotel.phone = element.tags.phone;
          if (element.tags['addr:street']) hotel.address = element.tags['addr:street'];
          if (element.tags['addr:city']) hotel.city = element.tags['addr:city'];
          if (element.tags['contact:email']) hotel.email = element.tags['contact:email'];
          if (element.tags.email) hotel.email = element.tags.email;
          
          return hotel;
          
        } catch (error) {
          console.error('Error processing hotel element:', error);
          console.error('Problematic element:', JSON.stringify(element, null, 2));
          return null;
        }
      })
      .filter(hotel => hotel !== null) // Remove any failed processing
      .filter((hotel, index, self) => {
        // Remove duplicates based on name and coordinates
        const firstIndex = self.findIndex(h => 
          h.name === hotel.name && 
          h.coordinates.lat === hotel.coordinates.lat && 
          h.coordinates.lon === hotel.coordinates.lon
        );
        return firstIndex === index;
      });
      
    console.log(`Processed ${processed.length} hotels after filtering`);
    return processed.slice(0, 8); // Return up to 8 hotels
  }

  formatLocation(element) {
    if (element.tags) {
      const parts = [];
      if (element.tags['addr:street']) parts.push(element.tags['addr:street']);
      if (element.tags['addr:city']) parts.push(element.tags['addr:city']);
      if (parts.length > 0) return parts.join(', ');
    }
    return 'Location available';
  }

  /**
   * Calculate a bounding box around a point
   * @param {number} lat - Latitude of the center point
   * @param {number} lon - Longitude of the center point
   * @param {number} radiusInKm - Radius in kilometers
   * @returns {Object} Bounding box coordinates {minLat, minLon, maxLat, maxLon}
   */
  getBoundingBox(lat, lon, radiusInKm) {
    const R = 6371; // Earth's radius in km
    
    // Convert latitude and longitude from degrees to radians
    const latRad = lat * (Math.PI / 180);
    const lonRad = lon * (Math.PI / 180);
    
    // Angular distance in radians
    const dLat = radiusInKm / R;
    const dLon = radiusInKm / (R * Math.cos(latRad));
    
    // Calculate bounds
    const minLat = lat - (dLat * (180 / Math.PI));
    const maxLat = lat + (dLat * (180 / Math.PI));
    const minLon = lon - (dLon * (180 / Math.PI));
    const maxLon = lon + (dLon * (180 / Math.PI));
    
    return { minLat, minLon, maxLat, maxLon };
  }

  /**
   * Convert OSM tag values to user-friendly type names
   * @param {string} type - The OSM tag value
   * @returns {string} User-friendly type name
   */
  getUserFriendlyType(type) {
    if (!type) return 'Attraction';
    
    const typeMap = {
      // Natural features
      'beach': 'Beach',
      'waterfall': 'Waterfall',
      'cave': 'Cave',
      'peak': 'Mountain Peak',
      'volcano': 'Volcano',
      'spring': 'Hot Spring',
      'geyser': 'Geyser',
      'cliff': 'Cliff',
      'arch': 'Natural Arch',
      'valley': 'Valley',
      'canyon': 'Canyon',
      'dune': 'Sand Dune',
      'geological': 'Geological Formation',
      'island': 'Island',
      'peninsula': 'Peninsula',
      'cape': 'Cape',
      'bay': 'Bay',
      'lagoon': 'Lagoon',
      
      // Historic/cultural
      'castle': 'Castle',
      'fort': 'Fort',
      'ruins': 'Ruins',
      'monument': 'Monument',
      'memorial': 'Memorial',
      'archaeological_site': 'Archaeological Site',
      'battlefield': 'Battlefield',
      'tomb': 'Tomb',
      'wayside_shrine': 'Wayside Shrine',
      'church': 'Church',
      'temple': 'Temple',
      'mosque': 'Mosque',
      'synagogue': 'Synagogue',
      'cathedral': 'Cathedral',
      'shrine': 'Shrine',
      'monastery': 'Monastery',
      'palace': 'Palace',
      'manor': 'Manor',
      'city_walls': 'City Walls',
      'tower': 'Tower',
      'bridge': 'Historic Bridge',
      'mine': 'Historic Mine',
      
      // Leisure/entertainment
      'park': 'Park',
      'garden': 'Garden',
      'nature_reserve': 'Nature Reserve',
      'recreation_ground': 'Recreation Area',
      'water_park': 'Water Park',
      'golf_course': 'Golf Course',
      'sports_centre': 'Sports Center',
      'stadium': 'Stadium',
      'track': 'Racetrack',
      'pitch': 'Sports Field',
      'swimming_pool': 'Swimming Pool',
      'marina': 'Marina',
      'theme_park': 'Theme Park',
      'zoo': 'Zoo',
      'aquarium': 'Aquarium',
      'water_slide': 'Water Slide',
      'miniature_golf': 'Mini Golf',
      
      // Tourism
      'attraction': 'Tourist Attraction',
      'museum': 'Museum',
      'gallery': 'Art Gallery',
      'viewpoint': 'Viewpoint',
      'artwork': 'Artwork',
      'picnic_site': 'Picnic Site',
      'camp_site': 'Campsite',
      'caravan_site': 'Caravan Park',
      'alpine_hut': 'Mountain Hut',
      'wilderness_hut': 'Wilderness Hut',
      'chalet': 'Chalet',
      'hostel': 'Hostel',
      'hotel': 'Hotel',
      'motel': 'Motel',
      'guest_house': 'Guest House',
      'apartment': 'Apartment',
      'resort': 'Resort',
      'bed_and_breakfast': 'Bed & Breakfast',
      'camp_pitch': 'Camping Pitch',
      'caravan_site': 'Caravan Site',
      'apartment': 'Vacation Apartment',
      'chalet': 'Chalet',
      'camp_site': 'Campsite',
      'alpine_hut': 'Mountain Hut',
      'wilderness_hut': 'Wilderness Hut',
      'hostel': 'Hostel',
      'motel': 'Motel',
      'guest_house': 'Guest House',
      'bed_and_breakfast': 'Bed & Breakfast',
      'resort': 'Resort',
      'apartment': 'Vacation Apartment',
      'chalet': 'Chalet',
      'camp_site': 'Campsite',
      'alpine_hut': 'Mountain Hut',
      'wilderness_hut': 'Wilderness Hut',
      'hostel': 'Hostel',
      'motel': 'Motel',
      'guest_house': 'Guest House',
      'bed_and_breakfast': 'Bed & Breakfast',
      'resort': 'Resort',
      'apartment': 'Vacation Apartment'
    };
    
    // Try exact match first
    if (typeMap[type]) {
      return typeMap[type];
    }
    
    // Try case-insensitive match
    const lowerType = type.toLowerCase();
    for (const key in typeMap) {
      if (key.toLowerCase() === lowerType) {
        return typeMap[key];
      }
    }
    
    // Default: capitalize first letter of each word
    return type
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Generates a human-readable description for an attraction
   * @param {string} name - Attraction name
   * @param {string} type - Attraction type (e.g., 'museum', 'park')
   * @param {string} category - Category (e.g., 'tourism', 'natural')
   * @param {Object} address - Address components
   * @param {Object} tags - All OSM tags
   * @returns {string} Generated description
   */
  generateDescription(name, type, category, address, tags) {
    // Start with a basic description based on type
    const typeName = this.getUserFriendlyType(type) || 'attraction';
    let description = `${name} is a ${typeName}`;
    
    // Add location context if available
    const locationParts = [];
    if (address.city) locationParts.push(address.city);
    if (address.state && address.state !== address.city) locationParts.push(address.state);
    if (address.country) locationParts.push(address.country);
    
    if (locationParts.length > 0) {
      description += ` located in ${locationParts.join(', ')}`;
    }
    
    // Add additional details based on available tags
    const details = [];
    
    if (tags.description) {
      // Use the OSM description if available
      return tags.description;
    }
    
    if (tags['description:en']) {
      // Prefer English description if available
      return tags['description:en'];
    }
    
    // Add capacity information if available
    if (tags.capacity) {
      details.push(`can accommodate up to ${tags.capacity} people`);
    }
    
    // Add fee information
    if (tags.fee === 'yes') {
      details.push('has an entrance fee');
    } else if (tags.fee === 'no') {
      details.push('is free to enter');
    }
    
    // Add wheelchair accessibility
    if (tags.wheelchair === 'yes') {
      details.push('is wheelchair accessible');
    } else if (tags.wheelchair === 'limited') {
      details.push('has limited wheelchair access');
    }
    
    // Add opening hours if available
    if (tags.opening_hours) {
      details.push(`is open ${tags.opening_hours}`.toLowerCase());
    }
    
    // Add website if available
    if (tags.website || tags['contact:website']) {
      details.push('has an official website');
    }
    
    // Add contact information if available
    if (tags.phone || tags['contact:phone']) {
      details.push('has contact information available');
    }
    
    // Add the details to the description if we have any
    if (details.length > 0) {
      description += `. This ${typeName} ${details.join(', ')}.`;
    } else {
      description += '.';
    }
    
    return description;
  }

  getBudgetSymbol(budget) {
    if (budget === 'low') return '$';
    if (budget === 'high') return '$$$';
    return '$$';
  }
}

const freeDataService = new FreeDataService();
export default freeDataService;

// Named exports for convenience
export const getAttractions = (destination, budget) => freeDataService.getAttractions(destination, budget);
export const getRestaurants = (destination, budget) => freeDataService.getRestaurants(destination, budget);
export const getHotels = (destination, budget) => freeDataService.getHotels(destination, budget);
export const getWeather = (destination) => freeDataService.getWeather(destination);
export const getBudgetSymbol = (budget) => freeDataService.getBudgetSymbol(budget);
