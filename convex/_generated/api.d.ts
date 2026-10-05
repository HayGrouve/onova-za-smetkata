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
import type * as backfill from "../backfill.js";
import type * as billing from "../billing.js";
import type * as billingStripe from "../billingStripe.js";
import type * as bills from "../bills.js";
import type * as cleanup from "../cleanup.js";
import type * as combinedPayments from "../combinedPayments.js";
import type * as crons from "../crons.js";
import type * as files from "../files.js";
import type * as friendGroups from "../friendGroups.js";
import type * as guestSessions from "../guestSessions.js";
import type * as hostOnboarding from "../hostOnboarding.js";
import type * as http from "../http.js";
import type * as items from "../items.js";
import type * as lib_assertAssignmentEditable from "../lib/assertAssignmentEditable.js";
import type * as lib_assertBillDraft from "../lib/assertBillDraft.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_billListSearch from "../lib/billListSearch.js";
import type * as lib_billListSummary from "../lib/billListSummary.js";
import type * as lib_bill_ownership from "../lib/bill_ownership.js";
import type * as lib_billingEnv from "../lib/billingEnv.js";
import type * as lib_createBill from "../lib/createBill.js";
import type * as lib_devMode from "../lib/devMode.js";
import type * as lib_geminiReceipt from "../lib/geminiReceipt.js";
import type * as lib_guestAccess from "../lib/guestAccess.js";
import type * as lib_guestSession from "../lib/guestSession.js";
import type * as lib_homeOverview from "../lib/homeOverview.js";
import type * as lib_hostOnboarding from "../lib/hostOnboarding.js";
import type * as lib_hostOnboardingBillHooks from "../lib/hostOnboardingBillHooks.js";
import type * as lib_hostTier from "../lib/hostTier.js";
import type * as lib_money from "../lib/money.js";
import type * as lib_ocrStart from "../lib/ocrStart.js";
import type * as lib_payRequest from "../lib/payRequest.js";
import type * as lib_rateLimit from "../lib/rateLimit.js";
import type * as lib_readReceiptPhoto from "../lib/readReceiptPhoto.js";
import type * as lib_receiptStorage from "../lib/receiptStorage.js";
import type * as lib_shareToken from "../lib/shareToken.js";
import type * as lib_stripeSubscription from "../lib/stripeSubscription.js";
import type * as lib_stripeWebhook from "../lib/stripeWebhook.js";
import type * as lib_touchBill from "../lib/touchBill.js";
import type * as lib_validateBillForFinalize from "../lib/validateBillForFinalize.js";
import type * as participants from "../participants.js";
import type * as paymentSettings from "../paymentSettings.js";
import type * as payments from "../payments.js";
import type * as quickScan from "../quickScan.js";
import type * as quickScanAction from "../quickScanAction.js";
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
  backfill: typeof backfill;
  billing: typeof billing;
  billingStripe: typeof billingStripe;
  bills: typeof bills;
  cleanup: typeof cleanup;
  combinedPayments: typeof combinedPayments;
  crons: typeof crons;
  files: typeof files;
  friendGroups: typeof friendGroups;
  guestSessions: typeof guestSessions;
  hostOnboarding: typeof hostOnboarding;
  http: typeof http;
  items: typeof items;
  "lib/assertAssignmentEditable": typeof lib_assertAssignmentEditable;
  "lib/assertBillDraft": typeof lib_assertBillDraft;
  "lib/auth": typeof lib_auth;
  "lib/billListSearch": typeof lib_billListSearch;
  "lib/billListSummary": typeof lib_billListSummary;
  "lib/bill_ownership": typeof lib_bill_ownership;
  "lib/billingEnv": typeof lib_billingEnv;
  "lib/createBill": typeof lib_createBill;
  "lib/devMode": typeof lib_devMode;
  "lib/geminiReceipt": typeof lib_geminiReceipt;
  "lib/guestAccess": typeof lib_guestAccess;
  "lib/guestSession": typeof lib_guestSession;
  "lib/homeOverview": typeof lib_homeOverview;
  "lib/hostOnboarding": typeof lib_hostOnboarding;
  "lib/hostOnboardingBillHooks": typeof lib_hostOnboardingBillHooks;
  "lib/hostTier": typeof lib_hostTier;
  "lib/money": typeof lib_money;
  "lib/ocrStart": typeof lib_ocrStart;
  "lib/payRequest": typeof lib_payRequest;
  "lib/rateLimit": typeof lib_rateLimit;
  "lib/readReceiptPhoto": typeof lib_readReceiptPhoto;
  "lib/receiptStorage": typeof lib_receiptStorage;
  "lib/shareToken": typeof lib_shareToken;
  "lib/stripeSubscription": typeof lib_stripeSubscription;
  "lib/stripeWebhook": typeof lib_stripeWebhook;
  "lib/touchBill": typeof lib_touchBill;
  "lib/validateBillForFinalize": typeof lib_validateBillForFinalize;
  participants: typeof participants;
  paymentSettings: typeof paymentSettings;
  payments: typeof payments;
  quickScan: typeof quickScan;
  quickScanAction: typeof quickScanAction;
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
