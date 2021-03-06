# TOE

TOE - TOE Online Editor.
With TOE you can create and edit map areas or territories using browser.

You can configure TOE to use one of these JavaScript map libraries:
 * Google Maps JavaScript API V3
 * OpenLayers
 * Leaflet

TOE uses following JavaScript libraries:
 * jQuery
 * jQuery UI

## Requirements for PHP server:
 * PHP >= 5.2
 * Magic quotes are disabled
 * SQLite3
 * GD library for PHP QR Code support

## Python libraries required for export PDF:
 * python-mapnik2
 * python-urllib3

## Installing

Copy config.php.template to config.php and edit it.
Do the same in export directory.

## Installing OpenStreetMaps data for exporting maps

Install Postgresql with PostGIS:
`sudo apt-get install postgresql-9.1-postgis postgresql-contrib`

Setup database by following instructions here:
http://wiki.openstreetmap.org/wiki/Mapnik/PostGIS

Use database with postgresql user 'gisuser'.

You can do the import on another machine:

`sudo apt-get install osm2pgsql`

`osm2pgsql -U gisuser -d gis country.osm.bz2`

Then dump database into SQL file:

`pg_dump gis | bzip2 > /tmp/gis.sql.bz2`

Move dump file into the production machine:

`cat /tmp/gis.sql.bz2 | bunzip2 | psql -U gisuser`

Install Mapnik related data:

http://wiki.openstreetmap.org/wiki/Mapnik

## QR Codes

If you want to print QR codes, install PHP QR Code to export/lib/phpqrcode.
http://phpqrcode.sourceforge.net/

Give right permission for web server to write into db directory. It will be used for archiving map hashes used in QR codes.

## Try it

http://toe.fi

## Docker Image

https://hub.docker.com/r/iqqmut/toe/

## License

TOE is published under GPLv3 license [http://www.gnu.org/licenses/gpl-3.0.html].

