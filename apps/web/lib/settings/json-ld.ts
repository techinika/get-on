export function buildJsonLd(input: {
  businessName?: string | null;
  tagline?: string | null;
  description?: string | null;
  schemaType?: string | null;
  address?: string | null;
  addressParts?: any;
  phone?: string | null;
  email?: string | null;
  priceRange?: string | null;
  areaServed?: string | null;
  geo?: { lat?: number | null; lng?: number | null } | null;
  servesCuisine?: string | null;
  acceptsReservations?: boolean;
  url?: string | null;
}) {
  const type = input.schemaType || "LocalBusiness";
  const ld: any = {
    "@context": "https://schema.org",
    "@type": type,
    name: input.businessName || "",
  };
  if (input.description) ld.description = input.description;
  if (input.tagline) ld.slogan = input.tagline;
  if (input.url) ld.url = input.url;
  if (input.phone) ld.telephone = input.phone;
  if (input.email) ld.email = input.email;
  if (input.priceRange) ld.priceRange = input.priceRange;
  if (input.areaServed) ld.areaServed = input.areaServed;
  if (input.servesCuisine) ld.servesCuisine = input.servesCuisine;
  if (typeof input.acceptsReservations === "boolean") ld.acceptsReservations = input.acceptsReservations;
  if (input.geo?.lat != null && input.geo?.lng != null) {
    ld.geo = { "@type": "GeoCoordinates", latitude: input.geo.lat, longitude: input.geo.lng };
  }
  if (input.addressParts && typeof input.addressParts === "object") {
    const a = input.addressParts as any;
    if (a.street || a.city || a.region || a.postal || a.country) {
      ld.address = {
        "@type": "PostalAddress",
        streetAddress: a.street || undefined,
        addressLocality: a.city || undefined,
        addressRegion: a.region || undefined,
        postalCode: a.postal || undefined,
        addressCountry: a.country || undefined,
      };
    }
  } else if (input.address) {
    ld.address = { "@type": "PostalAddress", streetAddress: input.address };
  }
  return JSON.stringify(ld);
}
