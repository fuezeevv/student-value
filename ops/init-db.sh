#!/bin/sh
set -eu
# This is first-start initialization only; existing databases are never reset.
export PGPASSWORD="$POSTGRES_PASSWORD"
psql --username postgres --dbname studentvalue1984 --set=ON_ERROR_STOP=1 <<'SQL'
\getenv app_password APP_DATABASE_PASSWORD
\getenv migration_password MIGRATION_DATABASE_PASSWORD
CREATE ROLE studentvalue_migrate LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD :'migration_password';
CREATE ROLE studentvalue_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD :'app_password';
ALTER DATABASE studentvalue1984 OWNER TO studentvalue_migrate;
REVOKE ALL ON DATABASE studentvalue1984 FROM PUBLIC;
GRANT CONNECT ON DATABASE studentvalue1984 TO studentvalue_app;
ALTER SCHEMA public OWNER TO studentvalue_migrate;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO studentvalue_app;
ALTER DEFAULT PRIVILEGES FOR ROLE studentvalue_migrate IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO studentvalue_app;
ALTER DEFAULT PRIVILEGES FOR ROLE studentvalue_migrate IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO studentvalue_app;
SQL
