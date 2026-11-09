/**
 * Generated data model types.
 * 
 * Note: This file is a local stub for development without deployment.
 * Run `npx convex dev` with authentication to generate proper typed versions.
 */
import type { DataModelFromSchemaDefinition, GenericId } from "convex/server";
import type schema from "../schema";

export type DataModel = DataModelFromSchemaDefinition<typeof schema>;

export type Id<TableName extends TableNames> = GenericId<TableName>;

export type TableNames = 
  | "users"
  | "tools" 
  | "borrowRequests"
  | "automationEvents"
  | "remindersSent";

export type Doc<TableName extends TableNames> = DataModel[TableName]["document"];
