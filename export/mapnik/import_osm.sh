#!/bin/sh

# Script for importing osm files to Postgresql and dumping data to a file.
# Uses osm2pgsql
#
# Make sure you have installed postgresql-contrib package.
# http://wiki.openstreetmap.org/wiki/Mapnik/PostGIS
# http://wiki.openstreetmap.org/wiki/Osm2pgsql

POSTGRES_USER=postgres
DB_USER=gisuser
DB=gis
STYLE="/tmp/default.style"
DUMP_FILE="/tmp/gis.sql.gz"

# check arguments
if [ -z "$1" ]; then
  echo "Usage: $0 FILE..."
  echo "Example: $0 finland-latest.osm.pbf ecuador-latest.osm.pbf
  exit 1
fi

# download latest default.style
wget -O $STYLE https://raw.github.com/openstreetmap/osm2pgsql/master/default.style

# delete db
sudo -u $POSTGRES_USER dropdb $DB
# recreate db
sudo -u $POSTGRES_USER createdb -E UTF8 -O $DB_USER $DB
sudo -u $POSTGRES_USER psql -d $DB -f /usr/share/postgresql/9.1/contrib/postgis-1.5/postgis.sql
sudo -u $POSTGRES_USER psql -d $DB -f /usr/share/postgresql/9.1/contrib/postgis-1.5/spatial_ref_sys.sql
sudo -u $POSTGRES_USER psql -d $DB -f /usr/share/postgresql/9.1/contrib/postgis_comments.sql
sudo -u $POSTGRES_USER psql -d $DB -c "GRANT SELECT ON spatial_ref_sys TO PUBLIC;"
sudo -u $POSTGRES_USER psql -d $DB -c "GRANT ALL ON geometry_columns TO $DB_USER;"
sudo -u $POSTGRES_USER psql -d $DB -c "CREATE EXTENSION hstore;"

# import all passed files
APPEND=""
for file in "$@"
do
  osm2pgsql $APPEND -k -S $STYLE -U $DB_USER -d $DB "$file"
  APPEND="-a"
done

# dump db to file
echo "Dumping database to $DUMP_FILE..."
sudo -u $POSTGRES_USER pg_dump $DB | gzip > $DUMP_FILE
echo "$DUMP_FILE written."

