type AddressParts = {
  street?: string | null;
  city?: string | null;
  region?: string | null;
  postal?: string | null;
  country?: string | null;
};

type JsonLd = Record<string, unknown> & {
  "@context": string;
  "@type": string;
  name: string;
};

export function buildJsonLd(input: {
  businessName?: string | null;
  tagline?: string | null;
  description?: string | null;
  schemaType?: string | null;
  address?: string | null;
  addressParts?: AddressParts | null;
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
  const ld: JsonLd = {
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
  const address = input.addressParts;
  if (address && typeof address === "object") {
    if (address.street || address.city || address.region || address.postal || address.country) {
      ld.address = {
        "@type": "PostalAddress",
        streetAddress: address.street || undefined,
        addressLocality: address.city || undefined,
        addressRegion: address.region || undefined,
        postalCode: address.postal || undefined,
        addressCountry: address.country || undefined,
      };
    }
  } else if (input.address) {
    ld.address = { "@type": "PostalAddress", streetAddress: input.address };
  }
  return JSON.stringify(ld);
}
