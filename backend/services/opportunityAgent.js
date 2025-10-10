import cron from 'node-cron';
import { createOpportunityIfNotExists } from './opportunitiesStore.js';
import { getAllTripsSnapshot } from './tripStore.js';
import { getFirestoreClient } from './firebaseAdmin.js';
import { getWeatherAlertsForCity } from './weatherInsights.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const parseBoolean = (value, fallback = false) => {
  if (value === undefined || value === null) {
    return fallback;
  }
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  return fallback;
};

const parseInteger = (value, fallback) => {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getAgentConfig = () => {
  const enabled = parseBoolean(process.env.PIP_AGENT_ENABLED, false);
  const cronExpression = process.env.PIP_AGENT_CRON || '0 */3 * * *';
  const maxTrips = Math.max(1, parseInteger(process.env.PIP_AGENT_MAX_TRIPS_PER_RUN, 3));
  const delayMs = Math.max(0, parseInteger(process.env.PIP_AGENT_DELAY_BETWEEN_TRIPS_MS, 20000));
  const weatherLookaheadDays = Math.max(0, parseInteger(process.env.PIP_WEATHER_ALERT_WINDOW_DAYS, 7));
  const avatarUrl = process.env.PIP_AVATAR_URL || null;

  return {
    enabled,
    cronExpression,
    maxTrips,
    delayMs,
    weatherLookaheadDays,
    avatarUrl,
  };
};

const buildPipData = (config, { title, message, actionButtonText }) => ({
  title,
  message,
  actionButtonText: actionButtonText || null,
  avatarUrl: config.avatarUrl,
});

const parseIsoDate = (value) => {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getTripDateRange = (trip) => {
  const start =
    parseIsoDate(trip?.startDate) ||
    parseIsoDate(trip?.start_date) ||
    parseIsoDate(trip?.result?.startDate) ||
    parseIsoDate(trip?.result?.start_date);

  const end =
    parseIsoDate(trip?.endDate) ||
    parseIsoDate(trip?.end_date) ||
    parseIsoDate(trip?.result?.endDate) ||
    parseIsoDate(trip?.result?.end_date);

  if (!start || !end) {
    return null;
  }

  const startOfDay = new Date(start);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(end);
  endOfDay.setHours(23, 59, 59, 999);

  return { start: startOfDay, end: endOfDay };
};

const isTripLive = (trip) => {
  const range = getTripDateRange(trip);
  if (!range) {
    return false;
  }
  const now = new Date();
  return now >= range.start && now <= range.end;
};

const isTripLiveOrStartingSoon = (trip, config) => {
  const range = getTripDateRange(trip);
  if (!range) {
    return false;
  }

  const now = new Date();
  const upcomingBoundary = new Date(now.getTime() + config.weatherLookaheadDays * 24 * 60 * 60 * 1000);
  if (range.end < now) {
    return false;
  }

  return range.start <= upcomingBoundary;
};

export const findPlanningOpportunities = (trip, config) => {
  if (!trip) {
    return [];
  }

  const opportunities = [];
  const rawItinerary = trip?.result?.itinerary ?? trip?.itinerary ?? [];
  const itinerary = Array.isArray(rawItinerary)
    ? rawItinerary
    : Object.values(rawItinerary || {});

  const opportunityTemplates = [
    {
      condition: (activity) => activity?.type === 'hotel' && Number(activity?.rating || 0) >= 9,
      create: (activity, dayIndex, activityIndex) => ({
        title: 'Upgrade unlocked! ✨',
        message: `${activity.title} looks like a 5-star stay. Want Pip to lock in the suite before prices jump?`,
        actionButtonText: 'Secure booking',
        fingerprint: `hotel-${trip.id}-${dayIndex}-${activityIndex}`,
      })
    },
    {
      condition: (activity) => activity?.type === 'sightseeing' && Number(activity?.rating || 0) >= 9,
      create: (activity, dayIndex, activityIndex) => ({
        title: 'Skip-the-line available! ⚡',
        message: `${activity.title} has a ${activity.rating}★ rating! Pip can book fast-track tickets to skip the 2-hour queue.`,
        actionButtonText: 'Book tickets',
        fingerprint: `fasttrack-${trip.id}-${dayIndex}-${activityIndex}`,
      })
    },
    {
      condition: (activity) => activity?.type === 'sightseeing',
      create: (activity, dayIndex, activityIndex) => ({
        title: 'Local tip! 💡',
        message: `Best time to visit ${activity.title} is early morning to avoid crowds. Want Pip to adjust your schedule?`,
        actionButtonText: 'Optimize timing',
        fingerprint: `timing-${trip.id}-${dayIndex}-${activityIndex}`,
      })
    },
    {
      condition: (activity) => activity?.title?.toLowerCase().includes('restaurant') || activity?.title?.toLowerCase().includes('lunch') || activity?.title?.toLowerCase().includes('dinner'),
      create: (activity, dayIndex, activityIndex) => ({
        title: 'Hidden gem alert! 💎',
        message: `Locals recommend trying the signature dish at ${activity.title}. Pip found a 20% off coupon!`,
        actionButtonText: 'Get coupon',
        fingerprint: `food-${trip.id}-${dayIndex}-${activityIndex}`,
      })
    },
  ];

  itinerary.forEach((day, dayIndex) => {
    if (!Array.isArray(day?.activities)) {
      return;
    }
    
    day.activities.forEach((activity, activityIndex) => {
      opportunityTemplates.forEach((template, templateIndex) => {
        if (template.condition(activity) && Math.random() > 0.3) { // 70% chance to generate
          const oppData = template.create(activity, dayIndex, activityIndex);
          opportunities.push({
            userId: trip.userId,
            tripId: trip.id,
            pipData: buildPipData(config, oppData),
            fingerprint: oppData.fingerprint,
          });
        }
      });
    });

    // Activity clustering
    if (day.activities?.length >= 2) {
      const first = day.activities[0];
      const second = day.activities[1];
      if (first?.title && second?.title) {
        opportunities.push({
          userId: trip.userId,
          tripId: trip.id,
          pipData: buildPipData(config, {
            title: 'Activity cluster detected! 📍',
            message: `${first.title} and ${second.title} are close by. Pip can bundle these visits to save you travel time!`,
            actionButtonText: 'Optimize route',
          }),
          fingerprint: `cluster-${trip.id}-${dayIndex}`,
        });
      }
    }

    // Price alerts
    if (day.activities?.length > 0 && Math.random() > 0.5) {
      const randomActivity = day.activities[Math.floor(Math.random() * day.activities.length)];
      if (randomActivity?.title) {
        opportunities.push({
          userId: trip.userId,
          tripId: trip.id,
          pipData: buildPipData(config, {
            title: 'Price alert! 💰',
            message: `${randomActivity.title} tickets are 25% cheaper if booked 48 hours in advance. Want Pip to secure your spot now?`,
            actionButtonText: 'Book early',
          }),
          fingerprint: `price-${trip.id}-${dayIndex}-${Math.random().toString(36).slice(2, 7)}`,
        });
      }
    }
  });

  // Add city-level opportunities
  const cities = [...new Set(itinerary.map(day => day?.city).filter(Boolean))];
  cities.forEach((city, cityIndex) => {
    if (Math.random() > 0.4) {
      opportunities.push({
        userId: trip.userId,
        tripId: trip.id,
        pipData: buildPipData(config, {
          title: 'Local event discovered! 🎭',
          message: `There's a cultural festival happening in ${city} during your visit. Free entry with live music and food stalls!`,
          actionButtonText: 'Add to itinerary',
        }),
        fingerprint: `event-${trip.id}-${city}-${cityIndex}`,
      });
    }
  });

  return opportunities;
};

export const findMonitoringOpportunities = (trip, config) => {
  if (!trip) {
    return [];
  }

  const opportunities = [];
  if (Array.isArray(trip?.events)) {
    trip.events.forEach((event, index) => {
      if (event?.isFree) {
        opportunities.push({
          userId: trip.userId,
          tripId: trip.id,
          pipData: buildPipData(config, {
            title: 'Free event alert! 🎉',
            message: `"${event.title}" just popped up near ${trip.endCity}. Want to RSVP?`,
            actionButtonText: 'View event',
          }),
          fingerprint: `event-${trip.id}-${index}`,
        });
      }
    });
  }

  if (Array.isArray(trip?.result?.events)) {
    Object.entries(trip.result.events).forEach(([city, cityEvents]) => {
      cityEvents.forEach((event, index) => {
        opportunities.push({
          userId: trip.userId,
          tripId: trip.id,
          pipData: buildPipData(config, {
            title: `News near ${city}! 📰`,
            message: `Pip heard chatter about ${event.title}. Looks like a crowd favorite.`,
            actionButtonText: 'Add to plan',
          }),
          fingerprint: `city-event-${trip.id}-${city}-${index}`,
        });
      });
    });
  }

  return opportunities;
};

export const findLiveOpportunities = (trip, userLocation, config) => {
  if (!trip || !userLocation) {
    return [];
  }

  const opportunities = [];
  const { lat, lng } = userLocation;
  if (lat && lng) {
    opportunities.push({
      userId: trip.userId,
      tripId: trip.id,
      pipData: buildPipData(config, {
        title: 'Close-by discovery 👀',
        message: `There's a hidden espresso bar just 3 minutes from your location. Fancy a quick break?`,
        actionButtonText: 'Add coffee stop',
      }),
      fingerprint: `live-${trip.id}-${Math.round(lat * 1000)}-${Math.round(lng * 1000)}`,
    });
  }

  return opportunities;
};

const collectCitiesForWeatherAlerts = (trip) => {
  const cities = new Set();
  const itineraryDays = trip?.result?.itinerary ?? trip?.itinerary ?? [];
  const itinerary = Array.isArray(itineraryDays)
    ? itineraryDays
    : Object.values(itineraryDays || {});

  itinerary.forEach((day) => {
    if (day?.city) {
      cities.add(day.city);
    }
  });

  if (trip?.startCity) {
    cities.add(trip.startCity);
  }
  if (trip?.endCity) {
    cities.add(trip.endCity);
  }

  return Array.from(cities).filter(Boolean);
};

export const findWeatherOpportunities = async (trip, config) => {
  if (!trip) {
    return [];
  }

  if (!isTripLiveOrStartingSoon(trip, config)) {
    console.log('[OpportunityAgent] Skipping weather alerts (trip not live or starting soon).');
    return [];
  }

  const cities = collectCitiesForWeatherAlerts(trip);
  if (!cities.length) {
    return [];
  }

  const alertsPerCity = await Promise.all(
    cities.map(async (city) => ({
      city,
      alerts: await getWeatherAlertsForCity(city),
    }))
  );

  const opportunities = [];
  alertsPerCity.forEach(({ city, alerts }) => {
    const rainAlerts = alerts.filter((alert) => alert?.code === 'rain' || alert?.code === 'storm');
    if (!rainAlerts.length) {
      console.log(`[OpportunityAgent] No rain alerts for ${city}.`);
      return;
    }

    rainAlerts.forEach((alert, index) => {
      opportunities.push({
        userId: trip.userId,
        tripId: trip.id,
        pipData: buildPipData(config, {
          title: alert.title,
          message: alert.message,
          actionButtonText: alert.code === 'storm' ? 'Plan rain backup' : 'Prep for rain',
        }),
        fingerprint: `weather-${trip.id}-${city}-${alert.date}-${alert.code}-${index}`,
      });
    });
  });

  return opportunities;
};

const attachUserIdToTrips = (tripBuckets) => {
  return tripBuckets.flatMap(({ uid, trips }) =>
    (trips || []).map((trip) => ({ ...trip, userId: uid }))
  );
};

export const runOpportunityAgent = async () => {
  const config = getAgentConfig();
  if (!config.enabled) {
    return;
  }
  try {
    console.log('[OpportunityAgent] Run started.');
    
    // Get active users
    const { getActiveUsers } = await import('./activeUsers.js');
    const activeUsers = getActiveUsers();
    
    if (!activeUsers.length) {
      console.log('[OpportunityAgent] No active users. Skipping run.');
      return;
    }
    
    console.log(`[OpportunityAgent] Active users: ${activeUsers.join(', ')}`);
    
    const firestore = getFirestoreClient();
    if (!firestore) {
      console.warn('[OpportunityAgent] Firestore unavailable. Falling back to JSON store.');
    }

    const tripBuckets = await getAllTripsSnapshot();
    const allTrips = attachUserIdToTrips(tripBuckets);
    
    // Filter trips to only include active users
    const trips = allTrips
      .filter(trip => activeUsers.includes(trip.userId))
      .slice(0, config.maxTrips);

    if (!trips.length) {
      console.log('[OpportunityAgent] No trips available for active users.');
      return;
    }

    console.log(`[OpportunityAgent] Evaluating ${trips.length} trip(s) for ${activeUsers.length} active user(s).`);

    let processed = 0;
    for (const trip of trips) {
      console.log(`[OpportunityAgent] Processing trip ${trip.id} for user ${trip.userId}.`);
      const opportunityGroups = await Promise.all([
        Promise.resolve(findPlanningOpportunities(trip, config)),
        Promise.resolve(findMonitoringOpportunities(trip, config)),
        findWeatherOpportunities(trip, config),
      ]);

      const opportunities = opportunityGroups.flat();
      if (!opportunities.length) {
        console.log(`[OpportunityAgent] No opportunities generated for trip ${trip.id}.`);
        continue;
      }

      console.log(`[OpportunityAgent] Writing ${opportunities.length} opportunity(ies) for trip ${trip.id}.`);
      await Promise.all(
        opportunities.map((opportunity) =>
          createOpportunityIfNotExists({
            userId: opportunity.userId,
            tripId: opportunity.tripId,
            pipData: opportunity.pipData,
          }, opportunity.fingerprint)
        )
      );

      processed += 1;
      if (processed < trips.length && config.delayMs > 0) {
        console.log(`[OpportunityAgent] Waiting ${config.delayMs}ms before processing next trip.`);
        await sleep(config.delayMs);
      }
    }
    console.log('[OpportunityAgent] Run finished.');
  } catch (error) {
    console.error('[OpportunityAgent] Error while generating opportunities:', error);
  }
};

export const startOpportunityScheduler = () => {
  const config = getAgentConfig();
  if (!config.enabled) {
    if (!startOpportunityScheduler.loggedDisabled) {
      console.log('[OpportunityAgent] Scheduler not started because PIP_AGENT_ENABLED is not true.');
      startOpportunityScheduler.loggedDisabled = true;
    }
    return;
  }

  if (startOpportunityScheduler.started) {
    return;
  }
  startOpportunityScheduler.started = true;

  cron.schedule(config.cronExpression, () => {
    runOpportunityAgent().catch((error) => {
      console.error('[OpportunityAgent] Scheduled job failed:', error);
    });
  });

  console.log(`[OpportunityAgent] Scheduler started with cron pattern: ${config.cronExpression}`);
};
