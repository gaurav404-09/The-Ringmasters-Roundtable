import { CityDataFetchError } from './utils/errors.js';

try {
  throw new CityDataFetchError("Test", "Delhi", "getAttractions", new Error("Inner"));
} catch (e) {
  console.log("e.name:", e.name);
  console.log("e instanceof CityDataFetchError:", e instanceof CityDataFetchError);
}
