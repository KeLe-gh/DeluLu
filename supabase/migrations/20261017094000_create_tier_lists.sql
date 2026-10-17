begin;

create table public.tier_lists (
                                   id uuid primary key,
                                   owner_id uuid not null default auth.uid()
                                       references auth.users(id) on delete cascade,
                                   title text not null
                                       check (char_length(btrim(title)) between 1 and 120),
                                   style_id text not null check (style_id = 'classic'),
                                   revision integer not null default 0 check (revision >= 0),
                                   created_at timestamptz not null default now(),
                                   updated_at timestamptz not null default now(),
                                   unique (owner_id, id)
);

create table public.tier_rows (
                                  id uuid primary key default gen_random_uuid(),
                                  owner_id uuid not null default auth.uid(),
                                  list_id uuid not null,
                                  label text not null
                                      check (char_length(btrim(label)) between 1 and 32),
                                  color text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
    position integer not null check (position >= 1),
    foreign key (owner_id, list_id)
        references public.tier_lists(owner_id, id)
        on delete cascade,
    unique (owner_id, list_id, id),
    unique (owner_id, list_id, position)
        deferrable initially deferred
);

alter table public.tier_lists enable row level security;
alter table public.tier_rows enable row level security;

create policy tier_lists_owner_access
on public.tier_lists for all to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

create policy tier_rows_owner_access
on public.tier_rows for all to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

revoke all on public.tier_lists, public.tier_rows
    from PUBLIC, anon, authenticated;

grant select, insert
      on public.tier_lists, public.tier_rows
          to authenticated;

create function public.create_tier_list(
    p_id uuid,
    p_title text,
    p_style_id text default 'classic'
)
    returns setof public.tier_lists
language plpgsql
security invoker
set search_path = ''
as $$
declare
saved public.tier_lists;
begin
    if auth.uid() is null then
        raise exception 'authentication_required'
            using errcode = '42501';
end if;

    if p_id is null
       or nullif(btrim(p_title), '') is null
       or char_length(btrim(p_title)) > 120
       or p_style_id is distinct from 'classic' then
        raise exception 'invalid_tier_list'
            using errcode = '22023';
end if;

insert into public.tier_lists (
    id, owner_id, title, style_id
)
values (
           p_id, auth.uid(), btrim(p_title), p_style_id
       )
    on conflict (id) do nothing
    returning * into saved;

if found then
        insert into public.tier_rows (
            owner_id, list_id, label, color, position
        )
select
    auth.uid(),
    p_id,
    preset.label,
    preset.color,
    preset.position
from (values
          ('S', '#ff7f7f', 1),
          ('A', '#ffbf7f', 2),
          ('B', '#ffff7f', 3),
          ('C', '#7fff7f', 4),
          ('D', '#7fbfff', 5),
          ('E', '#7f7fff', 6),
          ('F', '#ff7fff', 7)
     ) as preset(label, color, position);
else
select *
into saved
from public.tier_lists
where id = p_id;

if not found
           or saved.title is distinct from btrim(p_title)
           or saved.style_id is distinct from p_style_id then
            raise exception 'tier_list_conflict'
                using errcode = 'PT409';
end if;
end if;

return next saved;
end;
$$;

revoke execute
    on function public.create_tier_list(uuid, text, text)
    from PUBLIC, anon;

grant execute
on function public.create_tier_list(uuid, text, text)
    to authenticated;

commit;