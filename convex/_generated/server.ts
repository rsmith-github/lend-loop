/**
 * Generated Convex server utilities.
 * 
 * Note: This file is a local stub for development without deployment.
 * Run `npx convex dev` with authentication to generate proper typed versions.
 */
import {
  queryGeneric,
  mutationGeneric,
  internalQueryGeneric,
  internalMutationGeneric,
  actionGeneric,
  internalActionGeneric,
  httpActionGeneric,
} from "convex/server";
import type { DataModelFromSchemaDefinition } from "convex/server";
import schema from "../schema";

export type DataModel = DataModelFromSchemaDefinition<typeof schema>;

export const query = queryGeneric as typeof queryGeneric;
export const internalQuery = internalQueryGeneric as typeof internalQueryGeneric;
export const mutation = mutationGeneric as typeof mutationGeneric;
export const internalMutation = internalMutationGeneric as typeof internalMutationGeneric;
export const action = actionGeneric as typeof actionGeneric;
export const internalAction = internalActionGeneric as typeof internalActionGeneric;
export const httpAction = httpActionGeneric as typeof httpActionGeneric;
