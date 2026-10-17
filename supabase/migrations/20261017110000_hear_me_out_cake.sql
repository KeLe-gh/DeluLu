begin;

alter table public.tier_lists
drop constraint tier_lists_style_id_check;

alter table public.tier_lists
    add constraint tier_lists_style_id_check
        check (style_id in ('classic', 'cake'));

create or replace function public.create_tier_list(
    p_id uuid,
    p_title text,
    p_style_id text default 'classic'
)
returns setof public.tier_lists
language plpgsql security invoker
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
       or p_style_id is null
       or p_style_id not in ('classic', 'cake') then
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
        if p_style_id = 'classic' then
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
end if;
else
select * into saved
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