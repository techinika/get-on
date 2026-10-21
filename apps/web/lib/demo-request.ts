import { z } from "zod";

export const WEBSITES_NEEDED_OPTIONS = [
  { value: "1", label: "Just 1" },
  { value: "2-5", label: "2 to 5" },
  { value: "6-20", label: "6 to 20" },
  { value: "20+", label: "More than 20" },
] as const;

export const MEETING_METHOD_OPTIONS = [
  { value: "video", label: "Video call" },
  { value: "phone", label: "Phone call" },
  { value: "whatsapp", label: "WhatsApp" },
] as const;

export const PREFERRED_TIME_OPTIONS = [
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
  { value: "any", label: "Any time" },
] as const;

export const WEBSITES_NEEDED = ["1", "2-5", "6-20", "20+"] as const;
export const MEETING_METHODS = ["video", "phone", "whatsapp"] as const;
export const PREFERRED_TIMES = ["morning", "afternoon", "evening", "any"] as const;

const PHONE_PATTERN = /^[0-9+()\-\s]{6,20}$/;

function emptyToUndefined(value: unknown): unknown {
  if (typeof value === "string" && value.trim() === "") return undefined;
  return value;
}

const optionalText = (max: number) =>
  z.preprocess(emptyToUndefined, z.string().trim().max(max).optional());

/**
 * Shared schema for the demo request form. The client uses it for instant
 * validation and the server action uses it again before anything is stored.
 */
export const demoRequestSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Please enter your name.")
    .max(80, "Please keep your name under 80 characters."),
  email: z
    .string()
    .trim()
    .min(1, "Please enter your email address.")
    .email("Please enter a valid email address.")
    .max(254, "Please use a shorter email address."),
  phone: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .trim()
      .regex(PHONE_PATTERN, "Please enter a valid phone number.")
      .optional(),
  ),
  businessName: z
    .string()
    .trim()
    .min(2, "Please enter your business name.")
    .max(80, "Please keep your business name under 80 characters."),
  businessType: optionalText(80),
  websitesNeeded: z.enum(WEBSITES_NEEDED, {
    errorMap: () => ({ message: "Please choose how many websites you need." }),
  }),
  meetingMethod: z.enum(MEETING_METHODS, {
    errorMap: () => ({ message: "Please choose how you would like to meet." }),
  }),
  preferredTime: z.enum(PREFERRED_TIMES, {
    errorMap: () => ({ message: "Please choose a time that suits you." }),
  }),
  timezone: optionalText(80),
  message: optionalText(500),
  consent: z.literal(true, {
    errorMap: () => ({ message: "Please agree that we can contact you." }),
  }),
});

export type DemoRequestInput = z.infer<typeof demoRequestSchema>;

export const DEMO_REQUEST_FIELDS = [
  "fullName",
  "email",
  "phone",
  "businessName",
  "businessType",
  "websitesNeeded",
  "meetingMethod",
  "preferredTime",
  "message",
  "consent",
] as const;

export type DemoRequestField = (typeof DEMO_REQUEST_FIELDS)[number];

export const RATE_LIMIT_PER_HOUR = 3;
export const RATE_LIMIT_PER_DAY = 5;
