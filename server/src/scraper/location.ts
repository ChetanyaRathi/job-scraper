/** Keep only USA (or US-remote) roles. */

const NON_US_MARKERS =
  /\b(canada|united kingdom|\buk\b|england|scotland|wales|ireland|germany|france|spain|italy|netherlands|belgium|sweden|norway|denmark|finland|switzerland|austria|poland|portugal|romania|hungary|ukraine|india|singapore|japan|china|hong kong|korea|australia|new zealand|brazil|mexico|argentina|chile|colombia|israel|uae|dubai|saudi|qatar|south africa|philippines|indonesia|malaysia|thailand|vietnam|taiwan|pakistan|bangladesh|egypt|turkey|greece|luxembourg|emea|apac|latam|\beu\b|europe|worldwide|global|anywhere in the world)\b/i;

const US_EXPLICIT =
  /\b(united states|usa\b|u\.s\.a\.?\b|u\.s\.\b)\b/i;

const US_REMOTE =
  /\bremote\s*[-–—,]?\s*(us|u\.s\.|usa|united states)|united states\s*[-–—,]?\s*remote|(us|usa)\s*only\b/i;

const US_STATE =
  /\b(alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new hampshire|new jersey|new mexico|new york|north carolina|north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|south dakota|tennessee|texas|utah|vermont|virginia|washington|west virginia|wisconsin|wyoming|district of columbia|puerto rico)\b/i;

const US_STATE_CODE =
  /(?:,\s*|\s)(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\b/;

const US_CITY =
  /\b(san francisco|san jose|san diego|los angeles|new york|nyc|brooklyn|manhattan|seattle|austin|boston|chicago|denver|atlanta|miami|dallas|houston|phoenix|portland|bay area|silicon valley|washington,? d\.?c\.?|arlington|bellevue|redmond|cupertino|mountain view|palo alto|menlo park|sunnyvale|santa clara|irvine|raleigh|durham|charlotte|nashville|minneapolis|pittsburgh|philadelphia|boulder|santa monica)\b/i;

export function isUsaLocation(location: string): boolean {
  const loc = location.trim();
  if (!loc) return false;

  const hasUs =
    US_EXPLICIT.test(loc) ||
    US_REMOTE.test(loc) ||
    US_STATE.test(loc) ||
    US_STATE_CODE.test(loc) ||
    US_CITY.test(loc);

  if (hasUs) return true;

  // Plain "Remote" / "Hybrid" with no foreign country — common on US boards
  if (/^(remote|hybrid|work from home|wfh)\b/i.test(loc) && !NON_US_MARKERS.test(loc)) {
    return true;
  }

  return false;
}

export function filterUsaJobs<T extends { location: string }>(jobs: T[]): T[] {
  return jobs.filter((job) => isUsaLocation(job.location));
}
