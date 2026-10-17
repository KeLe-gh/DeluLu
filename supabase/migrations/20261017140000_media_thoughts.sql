begin;

alter table public.media_titles
    add constraint media_titles_owner_id_id_key
        unique (owner_id, id);

create table public.media_thoughts (
                                       id uuid primary key,
                                       owner_id uuid not null default auth.uid(),
                                       title_id uuid not null,
                                       heading text not null default ''
                                           check (char_length(heading) <= 120),
                                       body text not null
                                           check (char_length(btrim(body)) between 1 and 20000),
                                       revision integer not null default 0
                                           check (revision >= 0),
                                       created_at timestamptz not null default now(),
                                       updated_at timestamptz not null default now(),
                                       foreign key (owner_id, title_id)
                                           references public.media_titles(owner_id, id)
                                           on delete cascade
);

create index media_thoughts_owner_title
    on public.media_thoughts (owner_id, title_id, id);

create function public.prepare_media_thought()
    returns trigger
    language plpgsql
security invoker
set search_path = ''
as $$
begin
    new.heading := btrim(new.heading);
    new.body := btrim(new.body);

    if tg_op = 'INSERT' then
        new.revision := 0;
        new.created_at := clock_timestamp();
else
        new.id := old.id;
        new.owner_id := old.owner_id;
        new.title_id := old.title_id;
        new.created_at := old.created_at;
        new.revision := old.revision + 1;
end if;

    new.updated_at := clock_timestamp();
return new;
end;
$$;

create trigger media_thoughts_prepare
    before insert or update on public.media_thoughts
                         for each row execute function public.prepare_media_thought();

alter table public.media_thoughts enable row level security;

create policy media_thoughts_owner_access
on public.media_thoughts for all to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

revoke all on public.media_thoughts
    from PUBLIC, anon, authenticated;

grant select, delete
    on public.media_thoughts to authenticated;

grant insert (id, title_id, heading, body)
    on public.media_thoughts to authenticated;

grant update (heading, body)
    on public.media_thoughts to authenticated;

revoke execute on function public.prepare_media_thought()
    from PUBLIC, anon, authenticated;

commit;