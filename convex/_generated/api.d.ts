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
import type * as bills from "../bills.js";
import type * as files from "../files.js";
import type * as items from "../items.js";
import type * as lib_assertAssignmentEditable from "../lib/assertAssignmentEditable.js";
import type * as lib_geminiReceipt from "../lib/geminiReceipt.js";
import type * as lib_receiptStorage from "../lib/receiptStorage.js";
import type * as lib_splitUnits from "../lib/splitUnits.js";
import type * as lib_touchBill from "../lib/touchBill.js";
import type * as lib_validateBillForFinalize from "../lib/validateBillForFinalize.js";
import type * as participants from "../participants.js";
import type * as paymentSettings from "../paymentSettings.js";
import type * as payments from "../payments.js";
import type * as receiptScan from "../receiptScan.js";
import type * as receiptScanAction from "../receiptScanAction.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  assignments: typeof assignments;
  bills: typeof bills;
  files: typeof files;
  items: typeof items;
  "lib/assertAssignmentEditable": typeof lib_assertAssignmentEditable;
  "lib/geminiReceipt": typeof lib_geminiReceipt;
  "lib/receiptStorage": typeof lib_receiptStorage;
  "lib/splitUnits": typeof lib_splitUnits;
  "lib/touchBill": typeof lib_touchBill;
  "lib/validateBillForFinalize": typeof lib_validateBillForFinalize;
  participants: typeof participants;
  paymentSettings: typeof paymentSettings;
  payments: typeof payments;
  receiptScan: typeof receiptScan;
  receiptScanAction: typeof receiptScanAction;
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
