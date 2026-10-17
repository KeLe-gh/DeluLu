begin;

create policy delulu_receive_own_list_updates
on realtime.messages for select to authenticated
                                    using (
                                    extension = 'broadcast'
                                    and topic = 'delulu:user:' || (select auth.uid())::text
                                    and (select realtime.topic()) = 'delulu:user:' || (select auth.uid())::text
                                    );

-- Empty notifications: clients load the data through the existing permission checks.
create function public.notify_delulu_user(p_user_id uuid)
    returns void language plpgsql security definer set search_path=''
as $$
declare marker text; transaction_id text;
begin
    if p_user_id is null then return; end if;

    marker := 'delulu.live_' || replace(p_user_id::text,'-','');
    transaction_id := txid_current()::text;

    -- One notification per account per transaction.
    if current_setting(marker,true) = transaction_id then return; end if;
    perform set_config(marker,transaction_id,true);

begin
        perform realtime.send(
            '{}'::jsonb,
            'lists_changed',
            'delulu:user:' || p_user_id::text,
            true
        );
exception when others then
        raise warning 'deluLu live notification unavailable: %',sqlerrm;
end;
end;
$$;

create function public.notify_delulu_list(p_kind text,p_list_id uuid)
    returns void language plpgsql security definer set search_path=''
as $$
declare recipient uuid;
begin
    if p_kind='ranking' then
        for recipient in
select owner_id from public.ranking_lists where id=p_list_id
union
select user_id from public.ranking_members where list_id=p_list_id
    loop
            perform public.notify_delulu_user(recipient);
end loop;
    elsif p_kind='tier' then
        for recipient in
select owner_id from public.tier_lists where id=p_list_id
union
select user_id from public.tier_members where list_id=p_list_id
    loop
            perform public.notify_delulu_user(recipient);
end loop;
end if;
end;
$$;

create function public.notify_delulu_list_change()
    returns trigger language plpgsql security definer set search_path=''
as $$
declare old_row jsonb; new_row jsonb; list_id uuid;
begin
    if TG_OP<>'INSERT' then old_row:=to_jsonb(OLD); end if;
    if TG_OP<>'DELETE' then new_row:=to_jsonb(NEW); end if;

    if TG_ARGV[1]='list' then
        list_id:=coalesce((new_row->>'id')::uuid,(old_row->>'id')::uuid);
else
        list_id:=coalesce(
            (new_row->>'list_id')::uuid,
            (old_row->>'list_id')::uuid
        );
end if;

    perform public.notify_delulu_list(TG_ARGV[0],list_id);

    if old_row->>'list_id' is distinct from new_row->>'list_id'
       and TG_OP='UPDATE' then
        perform public.notify_delulu_list(
            TG_ARGV[0],
            (old_row->>'list_id')::uuid
        );
end if;

    if TG_OP='DELETE' then return OLD; end if;
return NEW;
end;
$$;

create function public.notify_delulu_profile_change()
    returns trigger language plpgsql security definer set search_path=''
as $$
declare list record;
begin
for list in
select 'ranking' kind,list_id
from public.ranking_entries where item_id=OLD.id
union
select 'tier' kind,list_id
from public.tier_entries where item_id=OLD.id
    loop
        perform public.notify_delulu_list(list.kind,list.list_id);
end loop;

    if TG_OP='DELETE' then return OLD; end if;
return NEW;
end;
$$;

create trigger ranking_live_write
    after insert or update on public.ranking_lists
                        for each row execute function public.notify_delulu_list_change('ranking','list');

create trigger ranking_live_delete
    before delete on public.ranking_lists
    for each row execute function public.notify_delulu_list_change('ranking','list');

create trigger ranking_entries_live
    after insert or update or delete on public.ranking_entries
    for each row execute function public.notify_delulu_list_change('ranking','entry');

create trigger ranking_member_join_live
    after insert on public.ranking_members
    for each row execute function public.notify_delulu_list_change('ranking','member');

create trigger ranking_member_leave_live
    before delete on public.ranking_members
    for each row execute function public.notify_delulu_list_change('ranking','member');

create trigger tier_live_write
    after insert or update on public.tier_lists
                        for each row execute function public.notify_delulu_list_change('tier','list');

create trigger tier_live_delete
    before delete on public.tier_lists
    for each row execute function public.notify_delulu_list_change('tier','list');

create trigger tier_entries_live
    after insert or update or delete on public.tier_entries
    for each row execute function public.notify_delulu_list_change('tier','entry');

create trigger tier_rows_live
    after insert or update or delete on public.tier_rows
    for each row execute function public.notify_delulu_list_change('tier','entry');

create trigger tier_member_join_live
    after insert on public.tier_members
    for each row execute function public.notify_delulu_list_change('tier','member');

create trigger tier_member_leave_live
    before delete on public.tier_members
    for each row execute function public.notify_delulu_list_change('tier','member');

create trigger catalog_live_update
    after update on public.catalog_items
    for each row execute function public.notify_delulu_profile_change();

create trigger catalog_live_delete
    before delete on public.catalog_items
    for each row execute function public.notify_delulu_profile_change();

revoke all on function
    public.notify_delulu_user(uuid),
    public.notify_delulu_list(text,uuid),
    public.notify_delulu_list_change(),
    public.notify_delulu_profile_change()
    from PUBLIC,anon,authenticated;

commit;