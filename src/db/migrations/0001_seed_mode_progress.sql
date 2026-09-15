-- Seeds the one row per mode that mode_progress always has.
-- current_level=4 is a placeholder overwritten by the placement test on first use.
INSERT INTO "mode_progress" ("mode", "current_level", "level_streak") VALUES
	('metric_lab', 4, 0),
	('granularity_trainer', 4, 0),
	('query_architecture', 4, 0),
	('sql_build', 4, 0);
