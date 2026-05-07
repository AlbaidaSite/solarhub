/**
 * Parses a "lat, lng" string in English (decimal point) or Spanish (decimal comma) format.
 *
 * Accepted formats:
 *   - English: "37.4084606, -6.0798973"   (1 comma total)
 *   - Spanish: "37,4084606, -6,0798973"   (3 commas total)
 *
 * Returns null for any other comma count, non-numeric values,
 * or coordinates outside lat ∈ [-90, 90] / lng ∈ [-180, 180].
 */
export function parseCoordinates(
  input: string
): { lat: number; lng: number } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const commaCount = (trimmed.match(/,/g) ?? []).length;

  let lat: number;
  let lng: number;

  if (commaCount === 3) {
    // Spanish decimal format: "37,4084606, -6,0798973"
    // Split on ", " (comma + space) to get the two halves; each half uses "," as decimal sep.
    const parts = trimmed.split(", ");
    if (parts.length !== 2) return null;
    lat = parseFloat(parts[0].replace(",", "."));
    lng = parseFloat(parts[1].replace(",", "."));
  } else if (commaCount === 1) {
    // English decimal format: "37.4084606, -6.0798973"
    const parts = trimmed.split(",").map((p) => p.trim());
    if (parts.length !== 2) return null;
    lat = parseFloat(parts[0]);
    lng = parseFloat(parts[1]);
  } else {
    return null;
  }

  if (isNaN(lat) || isNaN(lng)) return null;
  if (lat < -90 || lat > 90) return null;
  if (lng < -180 || lng > 180) return null;

  return { lat, lng };
}
