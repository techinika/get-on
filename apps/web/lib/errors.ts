/**
 * Maps backend error codes to friendly, jargon-free copy (spec §9).
 * Never leak raw codes or database messages to the user.
 */
const ERROR_MESSAGES: Record<string, string> = {
  LIMIT_WEBSITES_REACHED: "You have reached the number of websites your plan includes.",
  LIMIT_PAGES_REACHED: "You have reached the number of pages your plan includes.",
  SUBDOMAIN_TAKEN: "That web address is taken. Try one of these.",
  SUBDOMAIN_RESERVED: "That web address cannot be used. Please pick another.",
  SUBDOMAIN_INVALID:
    "Please use only letters, numbers and dashes, with at least 3 characters.",
  NAME_REQUIRED: "Please enter your business name.",
  PLAN_NOT_FOUND: "We could not find that plan. Please try again.",
  TEAM_NOT_FOUND: "We could not find your team. Please try again.",
  PROJECT_NOT_FOUND: "We could not find that website. It may have been deleted.",
  PAGE_NOT_FOUND: "We could not find that page. It may have been deleted.",
  PAGE_PATH_TAKEN: "You already have a page with this address.",
  PAGE_IS_HOMEPAGE: "Make another page your homepage first.",
  FILE_TOO_LARGE: "Please choose a picture under 2 MB.",
  FILE_TYPE_INVALID: "Please choose a PNG or JPG picture.",
  NETWORK_ERROR: "You seem to be offline. We will keep your changes and save them when you are back.",
  UNKNOWN: "That did not work. Please try again.",
};

export function friendlyError(code: string | null | undefined): string {
  if (!code) return ERROR_MESSAGES.UNKNOWN!;
  return ERROR_MESSAGES[code] ?? ERROR_MESSAGES.UNKNOWN!;
}

export class AppError extends Error {
  code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}
