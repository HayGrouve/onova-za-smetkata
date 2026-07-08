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
import type * as bills from "../bills.js";
import type * as files from "../files.js";
import type * as guestSessions from "../guestSessions.js";
import type * as http from "../http.js";
import type * as items from "../items.js";
import type * as lib_assertAssignmentEditable from "../lib/assertAssignmentEditable.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_bill_ownership from "../lib/bill_ownership.js";
import type * as lib_clampParticipantUnits from "../lib/clampParticipantUnits.js";
import type * as lib_geminiReceipt from "../lib/geminiReceipt.js";
import type * as lib_guestSession from "../lib/guestSession.js";
import type * as lib_receiptStorage from "../lib/receiptStorage.js";
import type * as lib_splitUnits from "../lib/splitUnits.js";
import type * as lib_touchBill from "../lib/touchBill.js";
import type * as lib_validateBillForFinalize from "../lib/validateBillForFinalize.js";
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
  bills: typeof bills;
  files: typeof files;
  guestSessions: typeof guestSessions;
  http: typeof http;
  items: typeof items;
  "lib/assertAssignmentEditable": typeof lib_assertAssignmentEditable;
  "lib/auth": typeof lib_auth;
  "lib/bill_ownership": typeof lib_bill_ownership;
  "lib/clampParticipantUnits": typeof lib_clampParticipantUnits;
  "lib/geminiReceipt": typeof lib_geminiReceipt;
  "lib/guestSession": typeof lib_guestSession;
  "lib/receiptStorage": typeof lib_receiptStorage;
  "lib/splitUnits": typeof lib_splitUnits;
  "lib/touchBill": typeof lib_touchBill;
  "lib/validateBillForFinalize": typeof lib_validateBillForFinalize;
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
