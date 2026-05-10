-- Garantiza relación 1<->1 entre cromo y cromo_labels:
-- cada fila de cromo_labels solo puede pertenecer a un cromo.
ALTER TABLE public.cromo
  ADD CONSTRAINT cromo_labels_id_key UNIQUE (labels_id);
