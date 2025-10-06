// export function findCheapestTrip(flights, trains, hotels) {
//   const options = [];

//   flights.forEach((f) =>
//     hotels.forEach((h) => {
//       options.push({ transport: f, hotel: h, totalCost: f.price + h.price });
//     })
//   );

//   trains.forEach((t) =>
//     hotels.forEach((h) => {
//       options.push({ transport: t, hotel: h, totalCost: t.price + h.price });
//     })
//   );

//   return options.sort((a, b) => a.totalCost - b.totalCost)[0];
// }

// services/optimizer.js
export function findCheapestTrip(flights, trains, hotels) {
  const options = [];

  flights = flights || [];
  trains = trains || [];
  hotels = hotels || [];

  flights.forEach((f) =>
    hotels.forEach((h) => {
      const fp = parseFloat(f.price) || 0;
      const hp = parseFloat(h.price) || 0;
      options.push({ transport: f, hotel: h, totalCost: fp + hp });
    })
  );

  trains.forEach((t) =>
    hotels.forEach((h) => {
      const tp = parseFloat(t.price) || 0;
      const hp = parseFloat(h.price) || 0;
      options.push({ transport: t, hotel: h, totalCost: tp + hp });
    })
  );

  if (options.length === 0) return null;
  options.sort((a, b) => a.totalCost - b.totalCost);
  return options[0];
}
