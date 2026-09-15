-- Seeds the 3 fixed domains and their one dataset each (ADR 0001). Like domain_slug's enum
-- values, this set doesn't grow without a schema change, so it's seeded here rather than by app code.
WITH inserted_domains AS (
	INSERT INTO "domains" ("slug", "name") VALUES
		('ecommerce', 'E-commerce'),
		('saas', 'SaaS'),
		('fintech', 'Fintech')
	RETURNING id, slug
)
INSERT INTO "datasets" ("domain_id", "slug", "description")
SELECT id, slug || '-core', 'Synthetic ' || slug || ' dataset (see public/datasets/' || slug || '/)'
FROM inserted_domains;
