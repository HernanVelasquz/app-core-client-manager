-- ============================================================================
-- SCRIPT DE CREACIÓN DE USUARIO (SINCRONIZADO CON auth.users Y app_core.iam_profiles)
-- Basado en las invariantes del dominio IAM (PerfilUsuario, UserEmail,
-- PlainPassword, UserFullName, RoleName, UserAvatarUrl, UserActiveStatus)
-- ============================================================================

do $$
declare
  -- 1. Parámetros del usuario a crear (edita estos valores según necesites)
  v_raw_email      varchar(150) := 'admin@yopmail.com';
  v_plain_password text         := 'FocusStudio2026!';
  v_full_name      varchar(150) := 'Administrator Sistem';
  v_role_name      varchar(80)  := 'Administrador'; -- 'Administrador' | 'Gerente' | 'Líder' | 'Desarrollador'
  v_avatar_url     text         := null;
  v_is_active      boolean      := true;
  v_created_by     uuid         := null;

  -- Variables internas
  v_email          varchar(150);
  v_user_id        uuid;
  v_role_id        uuid;
begin
  -- 2. Validación de invariantes de los Value Objects del dominio IAM
  v_email     := lower(trim(v_raw_email));
  v_full_name := trim(v_full_name);
  v_role_name := trim(v_role_name);

  if v_email = '' or length(v_email) > 150 or v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    raise exception 'InvalidArgumentError (UserEmail): El correo "%" no es válido.', v_raw_email;
  end if;

  if length(trim(v_plain_password)) = 0 or length(v_plain_password) < 8 or length(v_plain_password) > 128 then
    raise exception 'InvalidArgumentError (PlainPassword): La contraseña debe tener entre 8 y 128 caracteres.';
  end if;

  if v_full_name = '' or length(v_full_name) > 150 then
    raise exception 'InvalidArgumentError (UserFullName): El nombre completo es inválido.';
  end if;

  -- 3. Verificar que el rol exista en app_core.iam_roles
  select r.id
    into v_role_id
    from app_core.iam_roles r
   where r.name = v_role_name
   limit 1;

  if v_role_id is null then
    raise exception 'RoleNotFoundError: El rol "%" no existe en app_core.iam_roles.', v_role_name;
  end if;

  -- 4. Verificar si el usuario ya existe en auth.users
  select u.id
    into v_user_id
    from auth.users u
   where lower(u.email) = v_email
   limit 1;

  if v_user_id is null then
    v_user_id := gen_random_uuid();

    -- Insertar en auth.users (dispara automáticamente el trigger on_auth_user_created
    -- que ejecuta app_core.handle_new_auth_user() e inserta en app_core.iam_profiles)
    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    )
    values (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      v_email,
      crypt(v_plain_password, gen_salt('bf')),
      now(),
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      jsonb_build_object(
        'full_name', v_full_name,
        'role_name', v_role_name,
        'created_by', coalesce(v_created_by::text, '')
      ),
      now(),
      now(),
      '',
      '',
      '',
      ''
    );

    -- Registrar la identidad email en auth.identities (requerido por Supabase GoTrue para signInWithPassword)
    insert into auth.identities (
      id,
      user_id,
      provider_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    )
    values (
      gen_random_uuid(),
      v_user_id,
      v_user_id::text,
      jsonb_build_object(
        'sub', v_user_id::text,
        'email', v_email,
        'email_verified', true,
        'phone_verified', false
      ),
      'email',
      now(),
      now(),
      now()
    );
  else
    -- Si ya existía en auth.users, actualizar su contraseña y metadatos
    update auth.users
       set encrypted_password = crypt(v_plain_password, gen_salt('bf')),
           email_confirmed_at = coalesce(email_confirmed_at, now()),
           raw_user_meta_data = jsonb_build_object(
             'full_name', v_full_name,
             'role_name', v_role_name,
             'created_by', coalesce(v_created_by::text, '')
           ),
           updated_at = now()
     where id = v_user_id;
  end if;

  -- 5. Garantizar que el registro en app_core.iam_profiles refleje exactamente los atributos del agregado PerfilUsuario
  insert into app_core.iam_profiles (
    id,
    role_id,
    full_name,
    email,
    avatar_url,
    is_active,
    created_by
  )
  values (
    v_user_id,
    v_role_id,
    v_full_name,
    v_email,
    v_avatar_url,
    v_is_active,
    v_created_by
  )
  on conflict (id) do update
    set role_id    = excluded.role_id,
        full_name  = excluded.full_name,
        email      = excluded.email,
        avatar_url = excluded.avatar_url,
        is_active  = excluded.is_active,
        updated_at = now();

  raise notice 'Usuario "%" creado/actualizado con éxito en app_core.iam_profiles (ID: %, Rol: %).',
    v_email, v_user_id, v_role_name;
end;
$$;

