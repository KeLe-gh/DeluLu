begin;

create table public.catalog_items (
                                      id uuid primary key default gen_random_uuid(),

                                      owner_id uuid not null default auth.uid()
                                          references auth.users(id) on delete cascade,

                                      name text not null
                                          check (length(btrim(name)) > 0),

                                      description text not null default '',

                                      profile_image_id uuid,
                                      background_image_id uuid,

                                      created_at timestamptz not null default now(),
                                      updated_at timestamptz not null default now(),

                                      revision integer not null default 0
                                          check (revision >= 0),

                                      unique (owner_id, id)
);

create table public.ranking_lists (
                                      id uuid primary key default gen_random_uuid(),

                                      owner_id uuid not null default auth.uid()
                                          references auth.users(id) on delete cascade,

                                      title text not null
                                          check (length(btrim(title)) > 0),

                                      description text not null default '',

                                      cover_image_id uuid,
                                      theme_id text not null default 'default',
                                      accent_color text,
                                      background_image_id uuid,

                                      created_at timestamptz not null default now(),
                                      updated_at timestamptz not null default now(),

                                      revision integer not null default 0
                                          check (revision >= 0),

                                      unique (owner_id, id)
);

create table public.ranking_entries (
                                        id uuid primary key default gen_random_uuid(),

                                        owner_id uuid not null default auth.uid(),

                                        list_id uuid not null,
                                        item_id uuid not null,

                                        position bigint not null
                                            check (
                                                position >= 1
                                                    and position <= 9007199254740991
                                                ),

                                        note text not null default '',

                                        foreign key (owner_id, list_id)
                                            references public.ranking_lists(owner_id, id)
                                            on delete cascade,

                                        foreign key (owner_id, item_id)
                                            references public.catalog_items(owner_id, id),

                                        unique (list_id, item_id),

                                        constraint ranking_entries_unique_position
                                            unique (list_id, position)
                                                deferrable initially deferred
);

create index ranking_entries_owner_item_idx
    on public.ranking_entries(owner_id, item_id);

alter table public.catalog_items
    enable row level security;

alter table public.ranking_lists
    enable row level security;

alter table public.ranking_entries
    enable row level security;

create policy catalog_items_owner_access
    on public.catalog_items
    for all
    to authenticated
    using (
        owner_id = (select auth.uid())
    )
    with check (
        owner_id = (select auth.uid())
    );

create policy ranking_lists_owner_access
    on public.ranking_lists
    for all
    to authenticated
    using (
        owner_id = (select auth.uid())
    )
    with check (
        owner_id = (select auth.uid())
    );

create policy ranking_entries_owner_access
    on public.ranking_entries
    for all
    to authenticated
    using (
        owner_id = (select auth.uid())
    )
    with check (
        owner_id = (select auth.uid())
    );

revoke all privileges on table
    public.catalog_items,
    public.ranking_lists,
    public.ranking_entries
    from PUBLIC, anon, authenticated;

grant usage on schema public
    to authenticated;

grant select, insert, update, delete on table
    public.catalog_items,
    public.ranking_lists,
    public.ranking_entries
    to authenticated;

commit;