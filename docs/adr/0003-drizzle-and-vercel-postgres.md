# Drizzle ORM on Vercel Postgres/Neon, not Prisma/Supabase

Chose Drizzle over Prisma for the operational database: Drizzle's SQL-like schema and lighter client suit Vercel's serverless functions better (faster cold starts, less codegen ceremony) for a schema this small, and Vercel Postgres/Neon was chosen over Supabase for direct integration with the already-locked Vercel deploy target rather than adopting a broader product (auth/storage/dashboard) this single-user, no-auth project doesn't need. Swapping either later means rewriting all query code and migrations.
