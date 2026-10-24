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
  TEMPLATE_NOT_FOUND: "We could not find that design. Please choose another.",
  TEMPLATE_PLAN_REQUIRED: "That design is included in a bigger plan. Choose another design or see plans.",
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

export const SETTINGS_ERRORS: Record<string, string> = {
  PROJECT_BUSY: "Another change is running on this website. Please try again in a moment.",
  BACKUP_LIMIT_REACHED: "Your plan keeps limited manual backups. Delete one or upgrade.",
  BACKUP_STORAGE_FULL: "Your backup picture space is full. Backups will be saved without pictures.",
  BACKUP_NOT_FOUND: "We could not find that backup.",
  EXPORT_LIMIT_REACHED: "You have created export files today. Try again tomorrow.",
  IMPORT_TOO_BIG: "That file is too big.",
  IMPORT_NOT_VALID: "We could not read that file. Please choose a backup file made by Get-On.",
  IMPORT_TOO_NEW: "That file was made by a newer version of Get-On. Please update and try again.",
  IMPORT_EXPIRED: "That file has expired.",
  REDIRECT_LIMIT_REACHED: "Your plan includes limited moved pages. Remove one or upgrade.",
  REDIRECT_SHADOWS_PAGE: "You already have a page at that address.",
  REDIRECT_LOOP: "That would send visitors in a circle.",
  REDIRECT_INVALID: "That address is not valid.",
  TRANSFER_EXPIRED: "This transfer request has ended.",
  TRANSFER_NOT_ALLOWED: "You cannot accept this transfer.",
  TRANSFER_LIMIT_WEBSITES: "The receiving team does not have room for another website.",
  TRANSFER_LIMIT_PAGES: "This website has more pages than the receiving plan allows.",
  TRANSFER_LIMIT_STORAGE: "The receiving team does not have enough space.",
  TRANSFER_BUSY: "Another change is running on this website.",
  TRANSFER_BLOCKED: "This transfer cannot be completed right now.",
  DELETE_BLOCKED_SUSPENDED: "This website cannot be deleted while it is suspended or under review. Please contact us.",
  SUBDOMAIN_HELD: "That web address was used recently and is being kept for a while.",
  MAINTENANCE_INVALID: "That setting is not valid.",
};
