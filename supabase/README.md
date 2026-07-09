# Database setup (P4+)

Run these SQL files in order in the Supabase SQL Editor for your Tenexity project:

1. `supabase/migrations/001_enable_pgvector.sql`
2. `supabase/migrations/002_create_chats_table.sql`
3. `supabase/migrations/003_create_nodes_table.sql`
4. `supabase/migrations/004_create_node_links_table.sql`
5. `supabase/migrations/005_setup_rls_policies.sql`

Or paste the combined file `supabase/migrations/p4_combined.sql` once.

After applying, refresh the app — chats and messages will persist across reloads.
