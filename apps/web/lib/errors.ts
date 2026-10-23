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
  SUSPENDED: "This website has been taken offline. Please contact us if you think this is a mistake.",
  UNDER_REVIEW: "We are taking a quick look at your website before it goes live.",
  PUBLISH_RATE_LIMITED: "You have published a few times already. Please try again a little later.",
  PUBLISH_FAILED: "We could not publish your website. Your live website has not changed.",
  PUBLISH_NOT_CONFIGURED: "Publishing is not available right now. Please try again later.",
  PUBLISH_NOT_FOUND: "We could not find that version.",
  PUBLISH_NOT_RESTORABLE: "That version can no longer be restored.",
  NO_LIVE_VERSION: "This website is not live right now.",
  UPLOAD_FAILED: "We could not upload your website. Please try again.",
  UPLOAD_VERIFY_FAILED: "We could not check your website after uploading it. Please try again.",
  POINTER_WRITE_FAILED: "We could not make your website live. Please try again.",
  PLUGIN_NOT_AVAILABLE: "This plugin is not available yet.",
  PLUGIN_NOT_ON_PLAN: "This plugin is not included in your plan.",
  PLUGIN_LIMIT_REACHED: "Your plan includes a limited number of plugins on each website. Turn one off or upgrade.",
  PLUGIN_ALREADY_ENABLED: "This plugin is already on.",
  NOT_ALLOWED: "Only owners and admins can do this.",
  RECIPIENT_LIMIT_REACHED: "You can add up to 3 extra email addresses.",
  RECIPIENT_EXISTS: "That email address is already on the list.",
  RECIPIENT_SUPPRESSED: "We cannot send messages to that email address.",
  MESSAGE_NOT_FOUND: "We could not find that message.",
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
