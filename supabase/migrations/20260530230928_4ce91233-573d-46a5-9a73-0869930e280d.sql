DO $$
DECLARE
  _user_id uuid;
  _existing uuid;
BEGIN
  SELECT id INTO _existing FROM auth.users WHERE lower(email) = lower('kumatech4@gmail.com') LIMIT 1;

  IF _existing IS NULL THEN
    _user_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change,
      email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      _user_id,
      'authenticated',
      'authenticated',
      'kumatech4@gmail.com',
      crypt('3mm@nuel.Kuma123#@', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"company_name":"Kuma Tech"}'::jsonb,
      now(), now(), '', '', '', ''
    );

    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(),
      _user_id,
      jsonb_build_object('sub', _user_id::text, 'email', 'kumatech4@gmail.com', 'email_verified', true),
      'email',
      _user_id::text,
      now(), now(), now()
    );
  END IF;

  PERFORM public.link_super_admin_by_email('kumatech4@gmail.com');
END $$;