/**
 * Custom Errors for loud, traceable failures across the architecture.
 * No silent fallbacks allowed.
 */

export class TriggerPayloadValidationError extends Error {
  constructor(message, rawOutput) {
    super(message);
    this.name = 'TriggerPayloadValidationError';
    this.rawOutput = rawOutput;
  }
}

export class PlannerOutputValidationError extends Error {
  constructor(message, rawOutput) {
    super(message);
    this.name = 'PlannerOutputValidationError';
    this.rawOutput = rawOutput;
  }
}

export class CriticOutputValidationError extends Error {
  constructor(message, rawOutput) {
    super(message);
    this.name = 'CriticOutputValidationError';
    this.rawOutput = rawOutput;
  }
}

export class RouteApprovalExhaustedError extends Error {
  constructor(message, history) {
    super(message);
    this.name = 'RouteApprovalExhaustedError';
    this.history = history; // Complete array of proposals and rejections
  }
}

export class RoutingDataFetchError extends Error {
  constructor(message, cityPair) {
    super(message);
    this.name = 'RoutingDataFetchError';
    this.cityPair = cityPair;
  }
}

export class InsufficientVenueDataError extends Error {
  constructor(message, city, shortfallCount) {
    super(message);
    this.name = 'InsufficientVenueDataError';
    this.city = city;
    this.shortfallCount = shortfallCount;
  }
}

export class CityDataFetchError extends Error {
  constructor(message, city, apiName, originalError) {
    super(message);
    this.name = 'CityDataFetchError';
    this.city = city;
    this.apiName = apiName;
    this.originalError = originalError;
  }
}

export class DatabaseConnectionError extends Error {
  constructor(message, originalError) {
    super(message);
    this.name = 'DatabaseConnectionError';
    this.originalError = originalError;
  }
}

export class McpToolCallError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'McpToolCallError';
    this.details = details;
  }
}
