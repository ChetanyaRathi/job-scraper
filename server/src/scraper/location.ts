/** Keep only USA (or US-remote) roles. */

const NON_US_COUNTRY =
  /\b(canada|united kingdom|uk|england|scotland|wales|ireland|germany|france|spain|italy|netherlands|belgium|sweden|norway|denmark|finland|switzerland|austria|poland|portugal|czech|romania|hungary|ukraine|russia|india|singapore|japan|china|hong kong|korea|australia|new zealand|brazil|mexico|argentina|chile|colombia|israel|uae|dubai|saudi|qatar|south africa|nigeria|kenya|philippines|indonesia|malaysia|thailand|vietnam|taiwan|pakistan|bangladesh|egypt|turkey|greece|romania|serbia|croatia|estonia|latvia|lithuania|luxembourg|monaco|malta|iceland|remote[- ]?(emea|europe|apac|latam|eu|uk|canada|india|worldwide|global|anywhere))\b/i;

const US_EXPLICIT =
  /\b(united states|u\.?s\.?a?\.?\b|usa\b|u\.s\.\b|america)\b/i;

const US_REMOTE =
  /\b(remote\s*[-–—,]?\s*(us|u\.s\.|usa|united states)|united states\s*[-–—,]?\s*remote|us\s*only|usa\s*only|remote\s*\(?us\)?)\b/i;

// US state names and common abbreviations as , ST or space ST end
const US_STATE =
  /\b(alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new hampshire|new jersey|new mexico|new york|north carolina|north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|south dakota|tennessee|texas|utah|vermont|virginia|washington|west virginia|wisconsin|wyoming|district of columbia|puerto rico)\b/i;

const US_STATE_CODE =
  /(?:,\s*|\s)(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\b/;

const US_CITY =
  /\b(san francisco|san jose|san diego|los angeles|new york|nyc|brooklyn|manhattan|seattle|austin|boston|chicago|denver|atlanta|miami|dallas|houston|phoenix|portland|salt lake|bay area|silicon valley|washington,? d\.?c\.?|arlington|mclean|reston|bellevue|redmond|cupertino|mountain view|palo alto|menlo park|sunnyvale|santa clara|irvine|raleigh|durham|charlotte|nashville|minneapolis|pittsburgh|philadelphia|detroit|columbus|tampa|orlando|boulder|santa monica|venice|playa vista)\b/i;

const BARE_REMOTE = /^(remote|work from home|wfh|hybrid)?$/i;

export function isUsaLocation(location: string): boolean {
  const loc = location.trim();
  if (!loc) return false;

  // Explicit non-US / worldwide wins
  if (/\b(worldwide|global|anywhere in the world)\b/i.test(loc)) return false;
  if (NON_US_COUNTRY.test(loc) && !US_EXPLICIT.test(loc) && !US_REMOTE.test(loc)) {
    return false;
  }

  if (US_EXPLICIT.test(loc) || US_REMOTE.test(loc)) return true;
  if (US_STATE.test(loc) || US_STATE_CODE.test(loc) || US_CITY.test(loc)) return true;

  // Bare "Remote" from US-heavy ATS boards — treat as eligible
  if (BARE_REMOTE.test(loc) || /^remote\b/i.test(loc) && !NON_US_COUNTRY.test(loc)) {
    // "Remote - Canada" already rejected above; "Remote" / "Remote, US" ok
    if (/\bremote\b/i.test(loc) && !NON_US_COUNTRY.test(loc) && !/\b(emea|apac|latam|eu)\b/i.test(loc)) {
      // Prefer US-tagged remote; allow plain Remote
      if (US_EXPLICIT.test(loc) || US_REMOTE.test(loc) || /^remote\b/i.test(loc)) {
        // Exclude "Remote - EMEA" style already handled; exclude multi-country lists without US
        if (/\b(canada|uk|united kingdom|india|germany|ireland)\b/i.test(loc) && !US_EXPLICIT.test(loc)) {
          return false;
        }
        return /^remote\b/i.test(loc) || BARE_REMOTE.test(loc);
      }
    }
  }

  return false;
}

export function filterUsaJobs<T extends { location: string }>(jobs: T[]): T[] {
  return jobs.filter((job) => isUsaLocation(job.location));
}
