begin;

-- Wait until all account-related deletions have finished.
alter table public.ranking_entries
alter constraint ranking_entries_owner_id_item_id_fkey
    deferrable initially deferred;

commit;