<?php
/*
 * Copyright 2012-2015 Arno Teigseth, Tuomas Jaakola
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
 * Exporting POI and area data.
 * Requires at least PHP 5.2.
 */

include("lib/common.php");

// data from browser should come already in UTF-8 encoding
$format = $_POST['format'];
$areas = array();
if (isset($_POST['areas']))
    $areas = json_decode($_POST['areas']); // area information is received as JSON
$pois = array();
if (isset($_POST['pois']))
    $pois = json_decode($_POST['pois']); // POI information is received as JSON

$archive_url = null;
if (isset($_POST['archive_url'])) {
    $archive_url = $_POST['archive_url'];
}
if (isset($_POST['archive_id']) && isset($cfg['archive_url'])) {
    // cfg overrides given archive_url
    $archive_url = sprintf($cfg['archive_url'], $_POST['archive_id']);
}

$qrcode = get_qrcode();

$export = null;
if (!strcmp("osm", $format)) {
    // export data in OSM format
    $export = new OSMExport($pois, $areas, $qrcode);
}
elseif (!strcmp("kmz", $format)) {
    $export = new KMZExport($pois, $areas, $qrcode);
}
elseif (!strcmp("pdf", $format)) {
    $export = new MapnikPDFExport($pois, $areas, $qrcode);
}
elseif (!strcmp("svg", $format)) {
    $export = new MapnikSVGExport($pois, $areas, $qrcode);
}

// download output as file
if ($export) {
    if ($export->export()) {
        // export succeed
        $export->printOutput();
    } else {
        // export failed
        $export->printError();
    }
}
exit;

function get_qrcode() {
    // generate QR code
    global $cfg;

    $archive_url = null;
    if (isset($_POST['archive_url'])) {
        $archive_url = $_POST['archive_url'];
    }
    if (isset($_POST['archive_id']) && isset($cfg['archive_url'])) {
        // cfg overrides given archive_url
        $archive_url = sprintf($cfg['archive_url'], $_POST['archive_id']);
    }

    if ($archive_url) {
        // generate QR code
        return Util::generate_qrcode($archive_url);
    }
    return false;
}

// EXPORT CLASSES
// --------------

class ExportBase {
    public $pois, $areas, $number, $bounds, $filetype, $error;
    
    public function __construct($pois, $areas, $qrcode) {
        $this->pois = $pois;
        $this->areas = $areas;
        $this->bounds = array();
        $this->qrcode = $qrcode;
        $this->error = '';

        // set number if there is just one area with number
        if (count($this->areas) == 1 && $this->areas[0]->number) {
          $this->number = $this->areas[0]->number;
        }
    }

    function printOutput() {
        $output = $this->getContent();
        $filename = $this->genFilename();
        header("Content-Type: " . $this->getFiletype());
        header("Content-Size: " . strlen($output));
        header("Content-Disposition: attachment; filename=\"".$filename."\"");
        header("Content-Length: " . strlen($output));
        header("Content-transfer-encoding: binary");
        echo $output;
    }

    function getError() {
        return $this->error;
    }

    function printError() {
        header('HTTP/1.0 500 Internal Server Error', true, 500);
        echo str_replace("\n", "<br>", $this->getError());
    }

    // Return string in format 'map-<number>_2010-10-28_180603.<ext>'
    protected function genFilenameWithExt($ext) {
        $prefix = "map";
        if ($this->number) {
            $prefix .= "-";
            // remove "special" characters from filename
            $prefix .= preg_replace("([\s\.~,;:\[\]\(\]])", '', $this->number);
        }
        return strftime($prefix . "_%Y-%m-%d_%H%M%S." . $ext);
    }
}

// OSM Exporter 
class OSMExport extends ExportBase {
    private $dom;

    function getFiletype() {
        return "text/xml";
    }

    function export() {
        $osm = new OSMGenerator($this->pois, $this->areas);
        $this->dom = $osm->generateDOM();
        return true;
    }

    function getContent() {
        return $this->dom->saveXML();
    }

    // Returns string in format 'map-<number>_2010-10-28-180603.osm'
    function genFilename() {
        return $this->genFilenameWithExt("osm");
    }
}

// KMZ Exporter
class KMZExport extends ExportBase {
    private $dom;

    function getFiletype() {
        return "application/vnd.google-earth.kmz";
    }

    function export() {
        $kml = new KMLGenerator($this->pois, $this->areas);
        $this->dom = $kml->generateDOM();
        return true;
    }

    function getContent() {
        // KMZ is zipped doc.kml file
        // create temporary ZIP file and write XML there
        $xml = $this->dom->saveXML();

        $zip_name = tempnam('/tmp/', 'kml');
        $zip = new ZipArchive();
        if ($zip->open($zip_name, ZipArchive::CREATE) !== true) {
            // error when creating temp zip, dump xml
            return $xml;
        }
        $zip->addFromString('doc.kml', $xml);
        $zip->close();
        $content = file_get_contents($zip_name);
        unlink($zip_name);
        return $content;
    }

    function genFilename() {
        return $this->genFilenameWithExt("kmz");
    }
}

class MapnikExport extends ExportBase {
    protected $mapnik, $output_file;

    function export() {
        global $cfg;

        $descriptorspec = array(
            0 => array("pipe", "r"),  // stdin is a pipe that the child will read from
            1 => array("pipe", "w"),  // stdout is a pipe that the child will write to
            2 => array("pipe", "w") // stderr is a file to write to
            //2 => array("file", "/tmp/error-output.txt", "a") // stderr is a file to write to
        );

        $cwd = $cfg['mapnik_home'];
        $cmd = $this->getCommand();
        $input_data = '{"areas":' . $_POST['areas'] . ',"pois":' . $_POST['pois'] . '}';
        $process = proc_open($cmd, $descriptorspec, $pipes, $cwd);

        $return_value = -1;
        if (is_resource($process)) {
            // $pipes now looks like this:
            // 0 => writeable handle connected to child stdin
            // 1 => readable handle connected to child stdout
            // Any error output will be appended to /tmp/error-output.txt
            fwrite($pipes[0], $input_data);
            fclose($pipes[0]);

            $output = stream_get_contents($pipes[1]);
            fclose($pipes[1]);

            $this->error = stream_get_contents($pipes[2]);
            fclose($pipes[2]);

            // It is important that you close any pipes before calling
            // proc_close in order to avoid a deadlock
            $return_value = proc_close($process);

            if ($this->qrcode)
                unlink($this->qrcode);

            if ($return_value == 0) {
                $output = trim($output);
                if (file_exists($output)) {
                  $this->output_file = $output;
                  return true;
                }
                $this->error .= " ERROR: file '" . $output . "' does not exist!";
            }
            $this->error = $output . "\n" . $this->error;
            $this->error = "(" . $return_value . ") " . $this->error;
            $this->error = $cmd . "\n" . $this->error;
        }
        return false;
    }

    function getCommand() {
        global $cfg;

        $cmd = $cfg['mapnik_bin'];
        $bounds = $_POST['bbox'];
        $cmd .= ' --bbox "' . $bounds . '"';

        if (isset($_POST['format']))
            $cmd .= ' --outputformat ' . $_POST['format'];

        if (isset($_POST['map-source']))
            $cmd .= ' --tiles ' . $_POST['map-source'];

        if (isset($_POST['style']))
            $cmd .= ' --style ' . $_POST['style'];

        if ($this->qrcode)
            $cmd .= ' --qrcode ' . $this->qrcode;

        return $cmd;
    }

    function getContent() {
        return file_get_contents($this->output_file);
    }

}

class MapnikPDFExport extends MapnikExport {

    function getFiletype() {
        return "application/pdf";
    }

    // Returns filename in format 'map_<number>_2010-10-28_180623.pdf
    function genFilename() {
        return $this->genFilenameWithExt("pdf");
    }
}

class MapnikSVGExport extends MapnikExport {

    function getFiletype() {
        return "image/svg+xml";
    }

    // Returns filename in format 'map_<number>_2010-10-28_180623.svg
    function genFilename() {
        return $this->genFilenameWithExt("svg");
    }
}

?>
