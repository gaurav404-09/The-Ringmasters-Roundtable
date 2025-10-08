   "success": true,
//   "time_stamp": 1759405767141,
//   "data": [
//     {
//       "train_base": {
//         "train_no": "22654",
//         "train_name": "NZM TVC SF EXP",
//         "source_stn_name": "Hazrat Nizamuddin",
//         "source_stn_code": "NZM",
//         "dstn_stn_name": "Thiruvananthapuram Central",
//         "dstn_stn_code": "TVC",
//         "from_stn_name": "Hazrat Nizamuddin",
//         "from_stn_code": "NZM",
//         "to_stn_name": "Vasai Road",
//         "to_stn_code": "BSR",
//         "from_time": "05.00",
//         "to_time": "22.45",
//         "travel_time": "17.45",
//         "running_days": "1000000"
//       }
//     },}
    return json.data.map((t) => {
      const base = t.train_base || {};
      return {
        type: "train",
        provider: "AniCrad",
        from: base.from_stn_name || "Unknown",
        fromCode: base.from_stn_code || "Unknown",
        to: base.to_stn_name || "Unknown",
        toCode: base.to_stn_code || "Unknown",
        startTime: base.from_time || "N/A",
        endTime: base.to_time || "N/A",
        duration: base.travel_time || "N/A",
        price: t.fare || 1500,
        details: {
          trainName: base.train_name || "Unknown",
          trainNumber: base.train_no || "Unknown",
          sourceStation: base.source_stn_name || "Unknown",
          destinationStation: base.dstn_stn_name || "Unknown",
          runningDays: base.running_days || "Unknown",
        },
      };
    });
  } catch (err) {
    console.error("Error fetching train data:", err);
    return [];
  }
}