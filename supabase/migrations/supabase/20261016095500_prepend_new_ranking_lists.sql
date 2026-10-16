begin;

alter table public.ranking_lists
drop constraint ranking_lists_sort_order_range;

alter table public.ranking_lists
    add constraint ranking_lists_sort_order_range
        check (
            sort_order between
                -9007199254740991 and 9007199254740991
                and sort_order <> 0
            ),
alter column sort_order
        set default (
            -nextval(
                'public.ranking_list_sort_order_seq'::regclass
            )
        );

commit;