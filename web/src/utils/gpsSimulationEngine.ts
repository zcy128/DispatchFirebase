/**
 * Real-Time Client-Side GPS Vehicle Telematics Simulator
 * 
 * Simulates a school bus traveling along an OSRM driving polyline for the currently
 * inspected dispatch route. Progress reflects stop completions, realistic cruising
 * speeds, street heading angles, and brief boarding pauses at stops.
 */

export interface SimulatedVehicleState {
  lat: number;
  lng: number;
  heading: number; // degrees 0 - 360
  speedKmH: number; // 0 when boarding, 30-52 in transit
  status: 'en_route' | 'at_stop' | 'completed' | 'idle';
  currentStopSequence: number;
  nextStopTitle: string;
  nextStopSequence: number;
  distanceToNextStopMeters: number;
  unitNumber: string;
  driverName?: string;
  lastPingTime: string;
}

export interface StopCoordinateHint {
  sequence: number;
  title: string;
  lat: number;
  lng: number;
  isCompleted?: boolean;
}

/**
 * Calculates Great-Circle distance in meters between two lat/lng pairs.
 */
export function getDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculates initial heading (bearing) in degrees (0 - 360) from point 1 to point 2.
 */
export function getHeadingBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);

  const theta = Math.atan2(y, x);
  return (theta * (180 / Math.PI) + 360) % 360;
}

export class GpsSimulator {
  private path: [number, number][]; // [lat, lng][]
  private cumulativeDistances: number[]; // meters from start to index i
  private totalDistance: number;
  private currentDistance: number;
  private stops: StopCoordinateHint[];
  private unitNumber: string;
  private driverName: string;

  private isRunning: boolean = true;
  private speedMultiplier: number = 1.0;
  private pauseRemainingTicks: number = 0; // for boarding pause
  private lastHeading: number = 0;

  constructor(
    path: [number, number][],
    stops: StopCoordinateHint[],
    unitNumber: string = 'Bus 1001',
    driverName: string = 'Assigned Driver'
  ) {
    this.path = path.length > 0 ? path : [[45.368, -75.758]];
    this.stops = [...stops].sort((a, b) => a.sequence - b.sequence);
    this.unitNumber = unitNumber;
    this.driverName = driverName;

    // Precalculate cumulative distances along path
    this.cumulativeDistances = [0];
    let running = 0;
    for (let i = 1; i < this.path.length; i++) {
      const d = getDistanceMeters(
        this.path[i - 1][0],
        this.path[i - 1][1],
        this.path[i][0],
        this.path[i][1]
      );
      running += d;
      this.cumulativeDistances.push(running);
    }
    this.totalDistance = running;

    // Determine initial distance based on completed stops
    this.currentDistance = this.calculateInitialDistance();
  }

  private calculateInitialDistance(): number {
    if (this.totalDistance <= 0 || this.stops.length === 0) return 0;

    // Find last completed stop
    let lastCompletedIndex = -1;
    for (let i = 0; i < this.stops.length; i++) {
      if (this.stops[i].isCompleted) {
        lastCompletedIndex = i;
      }
    }

    if (lastCompletedIndex < 0) {
      // No stops completed yet, start near first stop
      return 0;
    }

    if (lastCompletedIndex >= this.stops.length - 1) {
      // All stops completed, sit at end of route
      return this.totalDistance;
    }

    // Between lastCompleted and next pending stop
    const lastStop = this.stops[lastCompletedIndex];
    const nextStop = this.stops[lastCompletedIndex + 1];

    const distA = this.findClosestDistanceOnPath(lastStop.lat, lastStop.lng);
    const distB = this.findClosestDistanceOnPath(nextStop.lat, nextStop.lng);

    // Place vehicle 25% of the way between last completed stop and next stop
    return distA + (distB - distA) * 0.25;
  }

  private findClosestDistanceOnPath(lat: number, lng: number): number {
    let closestDist = Infinity;
    let closestIndex = 0;

    for (let i = 0; i < this.path.length; i++) {
      const d = getDistanceMeters(lat, lng, this.path[i][0], this.path[i][1]);
      if (d < closestDist) {
        closestDist = d;
        closestIndex = i;
      }
    }

    return this.cumulativeDistances[closestIndex] || 0;
  }

  public setSpeedMultiplier(multiplier: number) {
    this.speedMultiplier = Math.max(0.5, Math.min(10, multiplier));
  }

  public getSpeedMultiplier(): number {
    return this.speedMultiplier;
  }

  public toggleRunning(): boolean {
    this.isRunning = !this.isRunning;
    return this.isRunning;
  }

  public getIsRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Advances simulation by deltaSeconds (usually 1.0 - 1.5s).
   */
  public tick(deltaSeconds: number = 1.0): SimulatedVehicleState {
    if (!this.isRunning || this.totalDistance <= 0) {
      return this.getState();
    }

    // If currently paused at a stop boarding passengers
    if (this.pauseRemainingTicks > 0) {
      this.pauseRemainingTicks -= deltaSeconds;
      return this.getState(true);
    }

    // Average driving speed: ~40 km/h = ~11.1 m/s
    const baseSpeedMps = 11.1; // ~40 km/h
    const advanceMeters = baseSpeedMps * deltaSeconds * this.speedMultiplier;

    this.currentDistance += advanceMeters;

    // Loop back to start if finished to keep simulation alive
    if (this.currentDistance >= this.totalDistance) {
      this.currentDistance = 0;
    }

    // Check if we just crossed near a stop to trigger a brief boarding pause
    for (const stop of this.stops) {
      const stopDist = this.findClosestDistanceOnPath(stop.lat, stop.lng);
      const diff = Math.abs(this.currentDistance - stopDist);
      if (diff < advanceMeters * 1.2 && stop.sequence > 1) {
        // Pause for 4 seconds
        this.pauseRemainingTicks = 4.0;
        break;
      }
    }

    return this.getState();
  }

  public getState(isBoardingAtStop: boolean = false): SimulatedVehicleState {
    if (this.path.length === 0) {
      return {
        lat: 45.368,
        lng: -75.758,
        heading: 0,
        speedKmH: 0,
        status: 'idle',
        currentStopSequence: 1,
        nextStopTitle: 'Route Terminal',
        nextStopSequence: 1,
        distanceToNextStopMeters: 0,
        unitNumber: this.unitNumber,
        driverName: this.driverName,
        lastPingTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      };
    }

    // Find polyline segment for currentDistance
    let segmentIndex = 0;
    while (
      segmentIndex < this.cumulativeDistances.length - 1 &&
      this.cumulativeDistances[segmentIndex + 1] < this.currentDistance
    ) {
      segmentIndex++;
    }

    const nextIndex = Math.min(segmentIndex + 1, this.path.length - 1);
    const segStartDist = this.cumulativeDistances[segmentIndex];
    const segEndDist = this.cumulativeDistances[nextIndex];
    const segLen = segEndDist - segStartDist;

    let lat: number;
    let lng: number;

    if (segLen <= 0.001 || segmentIndex === nextIndex) {
      lat = this.path[segmentIndex][0];
      lng = this.path[segmentIndex][1];
    } else {
      const ratio = Math.max(0, Math.min(1, (this.currentDistance - segStartDist) / segLen));
      lat = this.path[segmentIndex][0] + ratio * (this.path[nextIndex][0] - this.path[segmentIndex][0]);
      lng = this.path[segmentIndex][1] + ratio * (this.path[nextIndex][1] - this.path[segmentIndex][1]);
    }

    // Calculate heading
    if (segmentIndex < this.path.length - 1) {
      this.lastHeading = getHeadingBearing(
        this.path[segmentIndex][0],
        this.path[segmentIndex][1],
        this.path[nextIndex][0],
        this.path[nextIndex][1]
      );
    }

    // Identify next stop
    let nextStop = this.stops[this.stops.length - 1];
    let prevStopSeq = 1;

    for (let i = 0; i < this.stops.length; i++) {
      const sDist = this.findClosestDistanceOnPath(this.stops[i].lat, this.stops[i].lng);
      if (sDist > this.currentDistance + 10) {
        nextStop = this.stops[i];
        prevStopSeq = i > 0 ? this.stops[i - 1].sequence : 1;
        break;
      }
    }

    const distToNext = nextStop
      ? Math.round(getDistanceMeters(lat, lng, nextStop.lat, nextStop.lng))
      : 0;

    const speed = isBoardingAtStop
      ? 0
      : Math.round((38 + Math.sin(this.currentDistance / 100) * 8) * (this.speedMultiplier > 2 ? 1.2 : 1));

    return {
      lat,
      lng,
      heading: Math.round(this.lastHeading),
      speedKmH: Math.max(0, speed),
      status: isBoardingAtStop ? 'at_stop' : this.currentDistance >= this.totalDistance - 10 ? 'completed' : 'en_route',
      currentStopSequence: prevStopSeq,
      nextStopTitle: nextStop ? nextStop.title : 'School Destination',
      nextStopSequence: nextStop ? nextStop.sequence : this.stops.length,
      distanceToNextStopMeters: distToNext,
      unitNumber: this.unitNumber,
      driverName: this.driverName,
      lastPingTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
  }
}
