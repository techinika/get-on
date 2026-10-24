export const SETTINGS_ERROR_MAP: Record<string, string> = {
  PROJECT_BUSY: "Another change is running on this website. Please try again in a moment.",
  BACKUP_LIMIT_REACHED: "Your plan keeps limited manual backups. Delete one or upgrade.",
  BACKUP_STORAGE_FULL: "Your backup picture space is full. Backups will be saved without pictures.",
  BACKUP_NOT_FOUND: "We could not find that backup.",
  EXPORT_LIMIT_REACHED: "You have created too many export files today. Try again tomorrow.",
  IMPORT_TOO_BIG: "That file is too big.",
  IMPORT_NOT_VALID: "We could not read that file. Please choose a backup file made by Get-On.",
  IMPORT_TOO_NEW: "That file was made by a newer version of Get-On. Please update and try again.",
  IMPORT_EXPIRED: "That import file has expired.",
  REDIRECT_LIMIT_REACHED: "Your plan includes limited moved pages. Remove one or upgrade.",
  REDIRECT_SHADOWS_PAGE: "You already have a page at that address.",
  REDIRECT_LOOP: "That would send visitors in a circle.",
  REDIRECT_INVALID: "That moved page is not valid.",
  TRANSFER_EXPIRED: "That transfer request has ended.",
  TRANSFER_NOT_ALLOWED: "That transfer is not allowed.",
  TRANSFER_LIMIT_WEBSITES: "The receiving team does not have room for another website.",
  TRANSFER_LIMIT_PAGES: "The receiving team does not have room for that many pages.",
  TRANSFER_LIMIT_STORAGE: "The receiving team does not have enough storage for this website.",
  TRANSFER_BUSY: "Another change is running on this website. Please try again in a moment.",
  TRANSFER_BLOCKED: "That transfer cannot be completed right now.",
  DELETE_BLOCKED_SUSPENDED: "This website cannot be deleted while it is suspended or under review. Please contact us.",
  SUBDOMAIN_HELD: "That web address was used recently and is being kept for a while.",
  MAINTENANCE_INVALID: "That pause message is not valid.",
};

export function mapSettingsError(code?: string | null) {
  if (!code) return "Something went wrong. Please try again.";
  return SETTINGS_ERROR_MAP[code] || code;
}
