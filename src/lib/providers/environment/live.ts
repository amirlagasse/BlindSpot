/**
 * The live provider: full method stubs, each naming the exact API it will call.
 *
 * Every method throws. That is the point. Selecting this provider before a
 * method is wired up should fail loudly at the call site rather than quietly
 * degrading to seeded data, because a user reading a number they believe came
 * from the EPA must not in fact be reading a state average.
 */

import { NotImplementedError } from './types';
import type { EnvironmentProvider, Reading } from './types';

export class LiveEnvironmentProvider implements EnvironmentProvider {
  readonly name = 'live';

  async getPM25(zip: string): Promise<Reading<number> | null> {
    // EPA Air Quality System API, annual summary by monitor:
    //   GET https://aqs.epa.gov/data/api/annualData/byCounty
    //     ?email=&key=&param=88101&bdate=&edate=&state=&county=
    // Parameter 88101 is PM2.5 local conditions. Needs a free AQS key, and the
    // ZIP has to be resolved to a county first (Census geocoder).
    throw new NotImplementedError(
      `getPM25(${zip})`,
      'the EPA Air Quality System API (aqs.epa.gov/data/api)',
    );
  }

  async getRadonZone(zip: string): Promise<Reading<1 | 2 | 3> | null> {
    // EPA Map of Radon Zones. County-level, published as a static dataset rather
    // than a live API, so this is a bundled lookup keyed on county FIPS.
    throw new NotImplementedError(
      `getRadonZone(${zip})`,
      'the EPA Map of Radon Zones county dataset',
    );
  }

  async getFloodZone(zip: string): Promise<Reading<string> | null> {
    // FEMA National Flood Hazard Layer, ArcGIS feature service:
    //   GET https://hazards.fema.gov/gis/nfhl/rest/services/public/NFHL/MapServer/28/query
    //     ?geometry=<lon,lat>&geometryType=esriGeometryPoint&outFields=FLD_ZONE&f=json
    throw new NotImplementedError(
      `getFloodZone(${zip})`,
      'the FEMA National Flood Hazard Layer ArcGIS service',
    );
  }

  async getTraumaCenterMinutes(zip: string): Promise<Reading<{
    minutes: number;
    level: 1 | 2 | 3;
  }> | null> {
    // Two calls. The American Trauma Society trauma center database gives
    // locations and levels; a routing API (Mapbox Directions or OSRM) turns the
    // nearest few into an actual drive time. Straight-line distance is not good
    // enough here: the whole point of the factor is real travel time.
    throw new NotImplementedError(
      `getTraumaCenterMinutes(${zip})`,
      'the American Trauma Society trauma center database plus a routing API',
    );
  }

  async getStateRoadFatalityRate(state: string): Promise<Reading<number> | null> {
    // NHTSA FARS, deaths by state, normalized by FHWA Highway Statistics VM-2
    // state VMT. FARS has an API at crashviewer.nhtsa.dot.gov/CrashAPI, though
    // it returns 403 to non-browser clients, so this may end up a bundled
    // annual refresh rather than a live call.
    throw new NotImplementedError(
      `getStateRoadFatalityRate(${state})`,
      'NHTSA FARS deaths normalized by FHWA VM-2 state vehicle miles',
    );
  }
}
