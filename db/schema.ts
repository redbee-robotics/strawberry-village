import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const farmPresence = sqliteTable("farm_presence", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  x: real("x").notNull(),
  z: real("z").notNull(),
  angle: real("angle").notNull(),
  action: text("action").notNull(),
  basket: integer("basket").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [index("farm_presence_updated_at_idx").on(table.updatedAt)]);
