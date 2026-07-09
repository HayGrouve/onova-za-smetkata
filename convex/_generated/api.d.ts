/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as assignments from "../assignments.js";
import type * as auth from "../auth.js";
import type * as backfill from "../backfill.js";
import type * as bills from "../bills.js";
import type * as cleanup from "../cleanup.js";
import type * as crons from "../crons.js";
import type * as files from "../files.js";
import type * as friendGroups from "../friendGroups.js";
import type * as guestSessions from "../guestSessions.js";
import type * as http from "../http.js";
import type * as items from "../items.js";
import type * as lib_assertAssignmentEditable from "../lib/assertAssignmentEditable.js";
import type * as lib_assertCanMutateAssignment from "../lib/assertCanMutateAssignment.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_billCalculations from "../lib/billCalculations.js";
import type * as lib_billListSummary from "../lib/billListSummary.js";
import type * as lib_billMetadataSchema from "../lib/billMetadataSchema.js";
import type * as lib_bill_ownership from "../lib/bill_ownership.js";
import type * as lib_clampParticipantUnits from "../lib/clampParticipantUnits.js";
import type * as lib_devMode from "../lib/devMode.js";
import type * as lib_friendGroupSchema from "../lib/friendGroupSchema.js";
import type * as lib_geminiReceipt from "../lib/geminiReceipt.js";
import type * as lib_guestAccess from "../lib/guestAccess.js";
import type * as lib_guestClaimSchema from "../lib/guestClaimSchema.js";
import type * as lib_guestFlowMessages from "../lib/guestFlowMessages.js";
import type * as lib_guestSession from "../lib/guestSession.js";
import type * as lib_itemSchema from "../lib/itemSchema.js";
import type * as lib_magicLinkEmail from "../lib/magicLinkEmail.js";
import type * as lib_money from "../lib/money.js";
import type * as lib_participantSchema from "../lib/participantSchema.js";
import type * as lib_paymentAmountSchema from "../lib/paymentAmountSchema.js";
import type * as lib_paymentSettingsSchema from "../lib/paymentSettingsSchema.js";
import type * as lib_rateLimit from "../lib/rateLimit.js";
import type * as lib_receiptImportSchema from "../lib/receiptImportSchema.js";
import type * as lib_receiptStorage from "../lib/receiptStorage.js";
import type * as lib_requireGuestSession from "../lib/requireGuestSession.js";
import type * as lib_shareToken from "../lib/shareToken.js";
import type * as lib_touchBill from "../lib/touchBill.js";
import type * as lib_validateBillForFinalize from "../lib/validateBillForFinalize.js";
import type * as lib_validation from "../lib/validation.js";
import type * as participants from "../participants.js";
import type * as paymentSettings from "../paymentSettings.js";
import type * as payments from "../payments.js";
import type * as receiptScan from "../receiptScan.js";
import type * as receiptScanAction from "../receiptScanAction.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  assignments: typeof assignments;
  auth: typeof auth;
  backfill: typeof backfill;
  bills: typeof bills;
  cleanup: typeof cleanup;
  crons: typeof crons;
  files: typeof files;
  friendGroups: typeof friendGroups;
  guestSessions: typeof guestSessions;
  http: typeof http;
  items: typeof items;
  "lib/assertAssignmentEditable": typeof lib_assertAssignmentEditable;
  "lib/assertCanMutateAssignment": typeof lib_assertCanMutateAssignment;
  "lib/auth": typeof lib_auth;
  "lib/billCalculations": typeof lib_billCalculations;
  "lib/billListSummary": typeof lib_billListSummary;
  "lib/billMetadataSchema": typeof lib_billMetadataSchema;
  "lib/bill_ownership": typeof lib_bill_ownership;
  "lib/clampParticipantUnits": typeof lib_clampParticipantUnits;
  "lib/devMode": typeof lib_devMode;
  "lib/friendGroupSchema": typeof lib_friendGroupSchema;
  "lib/geminiReceipt": typeof lib_geminiReceipt;
  "lib/guestAccess": typeof lib_guestAccess;
  "lib/guestClaimSchema": typeof lib_guestClaimSchema;
  "lib/guestFlowMessages": typeof lib_guestFlowMessages;
  "lib/guestSession": typeof lib_guestSession;
  "lib/itemSchema": typeof lib_itemSchema;
  "lib/magicLinkEmail": typeof lib_magicLinkEmail;
  "lib/money": typeof lib_money;
  "lib/participantSchema": typeof lib_participantSchema;
  "lib/paymentAmountSchema": typeof lib_paymentAmountSchema;
  "lib/paymentSettingsSchema": typeof lib_paymentSettingsSchema;
  "lib/rateLimit": typeof lib_rateLimit;
  "lib/receiptImportSchema": typeof lib_receiptImportSchema;
  "lib/receiptStorage": typeof lib_receiptStorage;
  "lib/requireGuestSession": typeof lib_requireGuestSession;
  "lib/shareToken": typeof lib_shareToken;
  "lib/touchBill": typeof lib_touchBill;
  "lib/validateBillForFinalize": typeof lib_validateBillForFinalize;
  "lib/validation": typeof lib_validation;
  participants: typeof participants;
  paymentSettings: typeof paymentSettings;
  payments: typeof payments;
  receiptScan: typeof receiptScan;
  receiptScanAction: typeof receiptScanAction;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
