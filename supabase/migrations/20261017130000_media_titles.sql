begin;

create table public.media_titles (
                                     id uuid primary key,
                                     owner_id uuid not null default auth.uid()
                                         references auth.users(id) on delete cascade,
                                     name text not null
                                         check (char_length(btrim(name)) between 1 and 120),
                                     kind text not null
                                         check (kind in ('series', 'movie')),
                                     status text not null default 'watchlist'
                                         check (status in ('watchlist', 'watching', 'watched', 'dropped')),
                                     rating numeric
                                         check (rating between 0 and 10 and rating = trunc(rating, 1)),
                                     revision integer not null default 0
                                         check (revision >= 0),
                                     created_at timestamptz not null default now(),
                                     updated_at timestamptz not null default now()
);

create index media_titles_owner_status
    on public.media_titles (owner_id, status, created_at desc, id);

create function public.prepare_media_title()
    returns trigger
    language plpgsql
security invoker
set search_path = ''
as $$
begin
    new.name := btrim(new.name);

    if tg_op = 'INSERT' then
        new.revision := 0;
        new.created_at := clock_timestamp();
else
        new.id := old.id;
        new.owner_id := old.owner_id;
        new.created_at := old.created_at;
        new.revision := old.revision + 1;
end if;

    new.updated_at := clock_timestamp();

return new;
end;
$$;

create trigger media_titles_prepare
    before insert or update on public.media_titles
                         for each row execute function public.prepare_media_title();

alter table public.media_titles enable row level security;

create policy media_titles_owner_access
on public.media_titles for all to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

revoke all on public.media_titles
    from PUBLIC, anon, authenticated;

grant select on public.media_titles to authenticated;

grant insert (id, name, kind, status, rating)
    on public.media_titles to authenticated;

grant update (name, kind, status, rating)
    on public.media_titles to authenticated;

revoke execute on function public.prepare_media_title()
    from PUBLIC, anon, authenticated;

commit;