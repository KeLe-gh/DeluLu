create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

select cron.schedule(
               'delulu-chat-push',
               '* * * * *',
               'select public.wake_chat_push_worker();'
       );

select cron.schedule(
               'delulu-chat-push-log-cleanup',
               '17 3 * * *',
               $cleanup$
                   delete from cron.job_run_details
        where jobid in (
            select jobid
            from cron.job
            where jobname in (
                'delulu-chat-push',
                'delulu-chat-push-log-cleanup'
            )
        )
        and end_time < now() - interval '7 days';
$cleanup$
);