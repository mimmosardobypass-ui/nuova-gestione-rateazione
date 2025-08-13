
-- 1) Imposta automaticamente owner_uid (se nullo) all'INSERT
-- Funzione già esistente: public.fn_set_owner_uid()
-- Creiamo i trigger per le tre tabelle principali

drop trigger if exists tr_set_owner_uid_rateations on public.rateations;
create trigger tr_set_owner_uid_rateations
before insert on public.rateations
for each row
execute function public.fn_set_owner_uid();

drop trigger if exists tr_set_owner_uid_installments on public.installments;
create trigger tr_set_owner_uid_installments
before insert on public.installments
for each row
execute function public.fn_set_owner_uid();

drop trigger if exists tr_set_owner_uid_rateation_types on public.rateation_types;
create trigger tr_set_owner_uid_rateation_types
before insert on public.rateation_types
for each row
execute function public.fn_set_owner_uid();

-- 2) Ricalcolo automatico dello stato della rateazione quando cambiano le rate
-- Funzione già esistente: public.fn_recalc_status_dispatch()

drop trigger if exists tr_installments_recalc_status on public.installments;
create trigger tr_installments_recalc_status
after insert or update or delete on public.installments
for each row
execute function public.fn_recalc_status_dispatch();
