<!DOCTYPE html>
<?php
/*
 * Copyright 2012 Arno Teigseth, Tuomas Jaakola
 * 
 * This file is part of TOE.
 *
 * TOE is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * TOE is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with TOE.  If not, see <http://www.gnu.org/licenses/>.
 *
 * index.php
 */

include("lib/common.php");
$archive_id = (isset($_GET['a'])) ? "'" . $_GET['a'] . "'" : 'null';

?>
<html lang="<?php print $lang; ?>">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="description" content="Create and edit map areas online with your browser." />
    <link rel="icon" type="image/png" href="images/toe-icon.png" />
    <meta name="viewport" content="initial-scale=1.0, user-scalable=no" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <link type="text/css" href="http://code.jquery.com/ui/1.10.2/themes/ui-darkness/jquery-ui.css" rel="stylesheet" />
    <link type="text/css" href="css/toe.css?v=1.0" rel="stylesheet" />
    <?php if ($maplib == $JS_MAP_GOOGLE) { ?>
      <script type="text/javascript" src="http://maps.google.com/maps/api/js?sensor=true"></script>
    <?php } ?>
    <?php if ($maplib == $JS_MAP_OPEN_LAYERS) { ?>
      <script src="http://www.openlayers.org/api/OpenLayers.js" type="text/javascript" />
    <?php } ?>
    <?php if ($maplib == $JS_MAP_LEAFLET) { ?>
      <link rel="stylesheet" href="http://cdn.leafletjs.com/leaflet-0.6.4/leaflet.css" />
      <script type="text/javascript" src="http://cdn.leafletjs.com/leaflet-0.6.4/leaflet.js"></script>
    <?php } ?>
    <script type="text/javascript" src="http://code.jquery.com/jquery-2.0.0.min.js"></script>
    <script type="text/javascript" src="http://code.jquery.com/ui/1.10.2/jquery-ui.js"></script>
    <script type="text/javascript" src="js/i18n.js"></script>
    <script type="text/javascript" src="js/toe.js?v=1.0"></script>
    <script type="text/javascript" src="js/toe-<?php print $maplib; ?>.js?v=1.0"></script>
    <script type="text/javascript">
      // set localization
      var translations = <?php print $localization->read_lang_file($lang); ?>;
      setLanguage('<?php print $lang; ?>', translations);
      // initialize
      $(document).ready(function() {
        toe.init({
          archive: <?php print $archive_id; ?>
        });
      });
    </script>
    <title>TOE</title>
  </head>
  <body>
    <div id="map_canvas" style="width:100%; height:100%"></div>

    <!-- dialogs -->
    <div id="file_open_dialog" style="display:none">
      <form action="import.php" method="post" enctype="multipart/form-data" target="upload_target" id="import_form">
        <?php print tr("Supported file formats"); ?>: .osm<br />
        <input type="file" name="import_file" id="import_file" /><br /><br />
        <input type="submit" id="open_button" name="" value="<?php print tr('Open'); ?>" class="button" />
      </form>
    </div>

    <div id="file_save_dialog" style="display:none">
      <form action="export/" method="post" id="export_form">
        <input type="hidden" name="bbox" value="" id="export_map_bounds" />
        <?php print tr("Choose format"); ?>:<br />
        <input type="radio" name="format" value="osm" checked="" id="export_format_osm"> <label for="export_format_osm">OSM (Openstreetmap)</label><br /><br />
        <textarea id="pois_json" name="pois" style="display:none"></textarea>
        <textarea id="areas_json" name="areas" style="display:none"></textarea>
        <input type="submit" name="" value="<?php print tr('Save') ?>" id="save_button" class="button" />
      </form>
    </div>

    <div id="print_dialog" style="display:none">
      <form action="export/" method="post" id="print_form">
        <input type="hidden" name="map-type" value="" id="print_map_type" />
        <input type="hidden" name="map-center" value="" id="print_map_center" />
        <input type="hidden" name="map-zoom" value="" id="print_map_zoom" />
        <input type="hidden" name="bbox" value="" id="print_map_bounds" />
        <input type="hidden" name="archive_id" value="" id="print_archive_id" />
        <input type="hidden" name="archive_url" value="" id="print_archive_url" />
        <textarea id="print_areas_json" name="areas" style="display:none"></textarea>
        <textarea id="print_pois_json" name="pois" style="display:none"></textarea>

        <table>
          <tbody>
            <tr>
              <td><?php print tr("Map"); ?>:</td>
              <td>
                <select name="map-source">
                  <option value="mapnik">OSM</option>
                  <?php foreach ($cfg['mapnik_tiles'] as $tiles => $title): ?>
                    <option value="<?php print $tiles; ?>"><?php print tr($title); ?></option>
                  <?php endforeach; ?>
                </select>
              </td>
            </tr>
            <tr>
              <td><?php print tr("Format"); ?>:</td>
              <td>
                <select name="format">
                  <option value="pdf">PDF</option>
                  <option value="svg">SVG</option>
                </select>
              </td>
            </tr>
            <tr>
              <td><?php print tr("Style"); ?>:</td>
              <td>
                <select name="style">
                  <?php foreach ($cfg['mapnik_styles'] as $style => $title): ?>
                    <option value="<?php print $style; ?>"><?php print tr($title); ?></option>
                  <?php endforeach; ?>
                </select>
              </td>
            </tr>
          </tbody>
        </table>
        <p><?php print tr("Printable area"); ?></p>
        <input type="submit" name="" value="<?php print tr('Print'); ?>" id="print_button" class="button" />
      </form>
    </div>

    <div id="help_dialog" style="display:none">
      <?php print tr('help_dialog'); ?>
    </div>

    <div id="settings_dialog" style="display:none">
      <form action="settings.php" method="post" id="settings_form">
        <input type="hidden" name="language_old" value="<?php print $lang; ?>" />
        <?php print tr("Language"); ?>:
        <select name="language_new">
          <?php print $localization->print_language_options(); ?>
        </select><br /><br />
        <?php print tr("setting_changes_note"); ?><br /><br />
        <input type="submit" name="" value="<?php print tr('Save'); ?>" id="save_settings_button" class="button" />
      </form>
    </div>

    <!-- hidden iframe for ajax file upload -->
    <iframe id="upload_target" name="upload_target" src="#" style="width:0;height:0;border:0px solid #fff; display: none"></iframe>
  </body>
</html>
