/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as challenges from "../challenges.js";
import type * as feed from "../feed.js";
import type * as games from "../games.js";
import type * as http from "../http.js";
import type * as migrations from "../migrations.js";
import type * as model_admin from "../model/admin.js";
import type * as model_auth from "../model/auth.js";
import type * as model_gameRules from "../model/gameRules.js";
import type * as model_validateMove from "../model/validateMove.js";
import type * as multiplayer from "../multiplayer.js";
import type * as reports from "../reports.js";
import type * as webhooks from "../webhooks.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  challenges: typeof challenges;
  feed: typeof feed;
  games: typeof games;
  http: typeof http;
  migrations: typeof migrations;
  "model/admin": typeof model_admin;
  "model/auth": typeof model_auth;
  "model/gameRules": typeof model_gameRules;
  "model/validateMove": typeof model_validateMove;
  multiplayer: typeof multiplayer;
  reports: typeof reports;
  webhooks: typeof webhooks;
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
