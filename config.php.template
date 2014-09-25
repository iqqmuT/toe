<?php

$cfg = array();

// --------------------------------------------------------------
// Map JavaScript library
// --------------------------------------------------------------
$JS_MAP_GOOGLE      = 'google';
$JS_MAP_OPEN_LAYERS = 'open_layers';
$JS_MAP_LEAFLET     = 'leaflet';

$cfg['js_map_library'] = $JS_MAP_GOOGLE;

// tile sources as JSON
$cfg['tile_sources_json'] = file_get_contents('export/mapnik/tiles.json');

// export styles as JSON
$cfg['export_styles_json'] = file_get_contents('export/mapnik/styles.json');

// --------------------------------------------------------------
// Area archive SQLite file, make sure web user has write access
// into it.
// --------------------------------------------------------------
$cfg['archive_file'] = 'db/archive.sqlite';

?>
