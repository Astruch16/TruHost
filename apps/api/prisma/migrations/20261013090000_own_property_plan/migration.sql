-- "Own property": a 0% plan for properties TruHost staff own themselves (no management fee to pay themselves). A plan
-- like any other, so fees, summaries and statements need no special case. Fixed id: the app finds it by
-- OWN_PROPERTY_PLAN_ID (packages/shared). Should an admin already have a plan with this name, ours takes a longer one.
DO $$
DECLARE
  plan_name text := CASE
    WHEN EXISTS (SELECT 1 FROM "Plan" WHERE name = 'Own property') THEN 'Own property (no fee)'
    ELSE 'Own property'
  END;
BEGIN
  INSERT INTO "Plan" (id, name, description, "managementFeeBps", "createdAt")
  VALUES (
    '0192f5e0-0000-7000-8000-0000000000f0',
    plan_name,
    'No management fee: for properties TruHost staff own themselves.',
    0,
    now()
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO "AuditLog" (id, "actorType", action, "entityType", "entityId", after, "createdAt")
  VALUES (
    gen_random_uuid(), 'SYSTEM', 'plan.create', 'Plan', '0192f5e0-0000-7000-8000-0000000000f0',
    jsonb_build_object('name', plan_name, 'managementFeeBps', 0), now()
  );
END $$;
