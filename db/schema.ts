import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
export const students = sqliteTable('students', {
  id: text('id').primaryKey(), username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(), salt: text('salt').notNull(),
  state: text('state').notNull(), revision: integer('revision').notNull().default(0),
  createdAt: integer('created_at').notNull(), updatedAt: integer('updated_at').notNull(),
});
export const sessions = sqliteTable('sessions', {
  tokenHash: text('token_hash').primaryKey(), studentId: text('student_id').notNull().references(()=>students.id,{onDelete:'cascade'}),
  expiresAt: integer('expires_at').notNull(),
},t=>[index('sessions_student_idx').on(t.studentId)]);
export const unlocks = sqliteTable('unlocks', {
  id: text('id').primaryKey(), studentId: text('student_id').notNull().references(()=>students.id,{onDelete:'cascade'}),
  itemId: text('item_id').notNull(), createdAt: integer('created_at').notNull(),
},t=>[uniqueIndex('unlocks_student_item_idx').on(t.studentId,t.itemId)]);
export const rateLimits=sqliteTable('rate_limits',{
  scope:text('scope').primaryKey(),count:integer('count').notNull(),resetAt:integer('reset_at').notNull(),
});
