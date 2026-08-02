import { getAttractions } from './services/freeDataService.js';

async function testAttractions() {
  try {
    console.log('Fetching attractions for Delhi...');
    const attractions = await getAttractions('Delhi');
    
    console.log(`\nFound ${attractions.length} attractions:`);
    attractions.forEach((attr, idx) => {
      console.log(`[${idx + 1}] ${attr.name} (Type: ${attr.type})`);
    });
    
    // Check for unwanted types
    const unwanted = attractions.filter(a => 
      ['hotel', 'guest_house', 'hostel', 'motel', 'apartment', 'camp_site', 'caravan_site', 'golf_course', 'fitness_centre']
      .includes(a.type)
    );
    
    if (unwanted.length > 0) {
      console.log('\n❌ FAILED: Found unwanted accommodation or leisure types:');
      console.log(unwanted);
    } else {
      console.log('\n✅ SUCCESS: No hotels, guest houses, or golf courses found in attractions list.');
    }
    
  } catch (err) {
    console.error('Error:', err);
  }
}

testAttractions();
