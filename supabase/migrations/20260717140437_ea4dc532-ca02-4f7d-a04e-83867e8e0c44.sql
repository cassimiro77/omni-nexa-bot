
DO $$
DECLARE
  u_id uuid := 'f3c170af-6d2d-49ce-805c-7a0b951519f5';
  u_email text := 'cassimiro77@gmail.com';
  new_org_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = u_id) THEN
    INSERT INTO public.profiles (id, email, full_name) VALUES (u_id, u_email, 'Cassimiro Vieira');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = u_id) THEN
    INSERT INTO public.organizations (name, slug, owner_user_id, status)
    VALUES ('Bolo & Memórias', 'bolo-e-memorias', u_id, 'active')
    RETURNING id INTO new_org_id;

    INSERT INTO public.organization_members (org_id, user_id, role)
    VALUES (new_org_id, u_id, 'owner');

    INSERT INTO public.departments (org_id, name, slug, is_default, ai_prompt)
    VALUES (new_org_id, 'Geral', 'geral', true, 'Atendimento geral. Seja cordial, objetivo e humano.');

    INSERT INTO public.settings (org_id, business_name, welcome_message, ai_system_prompt)
    VALUES (
      new_org_id,
      'Bolo & Memórias',
      'Oi! 👋 Aqui é a Renata, da Bolo & Memórias 🎂 Como posso te ajudar hoje?',
      'Você é a Renata, atendente virtual da confeitaria Bolo & Memórias. Fale de forma calorosa, próxima e humana, em português do Brasil, usando emojis com moderação (🎂🥰✨). Ajude o cliente a escolher bolos personalizados para aniversários, casamentos e eventos, coletando: ocasião, data do evento, número de convidados, sabor preferido, tema/decoração e região de entrega. Nunca invente preços — quando o cliente pedir orçamento, colete os dados e informe que a equipe retornará com o valor. Se pedirem para falar com humano, transfira imediatamente. Não peça CPF ou dados de cartão pelo chat.'
    );
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (u_id, 'admin') ON CONFLICT DO NOTHING;
END $$;
