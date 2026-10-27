export { setStaffContext, clearStaffContext, hasRole, isSuperAdmin, isCustomerSuccess, adminEmails, isAdminEmail } from "../admin";
export type { Role, Action } from "@get-on/permissions";

export * from "./data/repositories";

/** Approvals engine */
export { requestApproval, decideApproval, isStale, getPendingApprovals, executeApprovedAction } from "./approvals";
export { openCustomerTeam, openCustomerProject, openCustomerPage, editCustomerContent, publishCustomerPage } from "./access";