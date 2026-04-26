-- activate_credentials_on_request_approval

CREATE OR REPLACE FUNCTION public.activate_credentials_on_request_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Solo actuar en transiciones a is_approved = true
  IF NEW.is_approved IS TRUE
     AND (OLD.is_approved IS DISTINCT FROM TRUE) THEN

    UPDATE public.credentials
       SET is_active = true
     WHERE user_id = NEW.user_id;

  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_activate_credentials_on_request_approval
  ON public.request;

CREATE TRIGGER trg_activate_credentials_on_request_approval
  AFTER UPDATE OF is_approved ON public.request
  FOR EACH ROW
  EXECUTE FUNCTION public.activate_credentials_on_request_approval();

