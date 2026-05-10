
-- ============= ENUMS =============
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'employee');
CREATE TYPE public.business_role AS ENUM ('Barista', 'Accueil', 'Host', 'Cuisine');
CREATE TYPE public.contract_type AS ENUM ('Étudiant', 'Flexi', 'CDI');
CREATE TYPE public.profile_status AS ENUM ('invited', 'active', 'suspended');
CREATE TYPE public.invitation_status AS ENUM ('pending', 'accepted', 'expired', 'revoked');

-- ============= STUDIOS =============
CREATE TABLE public.studios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.studios ENABLE ROW LEVEL SECURITY;

INSERT INTO public.studios (name) VALUES ('Skult Rhodes'), ('Skult Châtelain');

-- ============= PROFILES =============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  phone TEXT,
  birth_date DATE,
  nationality TEXT,
  city TEXT,
  address TEXT,
  niss TEXT,
  iban TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  emergency_contact_relation TEXT,
  avatar_url TEXT,
  contract contract_type,
  studio_id UUID REFERENCES public.studios(id),
  hire_date DATE,
  student_card_valid BOOLEAN DEFAULT FALSE,
  status profile_status NOT NULL DEFAULT 'invited',
  score NUMERIC,
  quota_used NUMERIC,
  quota_max NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============= USER_ROLES =============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_business_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role business_role NOT NULL,
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_business_roles ENABLE ROW LEVEL SECURITY;

-- ============= HAS_ROLE FUNCTION =============
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- ============= INVITATIONS =============
CREATE TABLE public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  email TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  studio_id UUID REFERENCES public.studios(id),
  contract contract_type,
  business_roles business_role[] NOT NULL DEFAULT '{}',
  app_role app_role NOT NULL DEFAULT 'employee',
  hire_date DATE,
  status invitation_status NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ
);
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- ============= UPDATED_AT TRIGGER =============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============= RLS POLICIES =============

-- studios : tous les utilisateurs connectés peuvent voir
CREATE POLICY "Studios visibles par les utilisateurs connectés"
  ON public.studios FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins gèrent les studios"
  ON public.studios FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- profiles
CREATE POLICY "Utilisateurs voient leur propre profil"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);
CREATE POLICY "Admins et managers voient tous les profils"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));
CREATE POLICY "Utilisateurs modifient leur propre profil"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id);
CREATE POLICY "Admins modifient tous les profils"
  ON public.profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Système crée les profils"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins suppriment les profils"
  ON public.profiles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- user_roles
CREATE POLICY "Utilisateurs voient leurs rôles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins gèrent les rôles"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- user_business_roles
CREATE POLICY "Utilisateurs voient leurs rôles métier"
  ON public.user_business_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));
CREATE POLICY "Admins gèrent les rôles métier"
  ON public.user_business_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- invitations
CREATE POLICY "Admins gèrent les invitations"
  ON public.invitations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Lecture publique par token (pour activation)"
  ON public.invitations FOR SELECT TO anon, authenticated
  USING (true);

-- ============= HANDLE_NEW_USER TRIGGER =============
-- Crée automatiquement un profil quand un utilisateur s'inscrit, en utilisant les métadonnées d'invitation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation_token TEXT;
  v_invitation public.invitations%ROWTYPE;
  v_role business_role;
BEGIN
  v_invitation_token := NEW.raw_user_meta_data->>'invitation_token';

  -- Si invitation présente, charger les données et créer le profil correspondant
  IF v_invitation_token IS NOT NULL THEN
    SELECT * INTO v_invitation FROM public.invitations
    WHERE token = v_invitation_token AND status = 'pending' AND expires_at > now();

    IF FOUND THEN
      INSERT INTO public.profiles (id, email, first_name, last_name, phone, studio_id, contract, hire_date, status)
      VALUES (NEW.id, NEW.email, v_invitation.first_name, v_invitation.last_name, v_invitation.phone, v_invitation.studio_id, v_invitation.contract, v_invitation.hire_date, 'active');

      INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_invitation.app_role);

      FOREACH v_role IN ARRAY v_invitation.business_roles LOOP
        INSERT INTO public.user_business_roles (user_id, role) VALUES (NEW.id, v_role);
      END LOOP;

      UPDATE public.invitations SET status = 'accepted', accepted_at = now() WHERE id = v_invitation.id;
      RETURN NEW;
    END IF;
  END IF;

  -- Sinon, créer un profil basique (premier admin / signup direct)
  INSERT INTO public.profiles (id, email, first_name, last_name, status)
  VALUES (NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    'active');

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============= AVATAR STORAGE BUCKET =============
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT DO NOTHING;

CREATE POLICY "Avatars publics en lecture"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');
CREATE POLICY "Utilisateurs uploadent leur avatar"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Utilisateurs modifient leur avatar"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
