<?php
/*
 * Copyright 2015 Tuomas Jaakola
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
 */

// This will create a KML DOM that can be used for KML export
class KMLGenerator {
    protected $pois, $areas;
    protected $dom, $parnode;
    
    public function __construct($pois, $areas, $use_timestamps = true) {
        $this->pois = $pois;
        $this->areas = $areas;
    }
    
    function generateDOM() {
        // Start XML file, create parent node
        $this->dom = new DOMDocument("1.0", "UTF-8");
        $this->dom->formatOutput = true;
        $node = $this->dom->createElement("kml");
        $node->setAttribute('xmlns', 'http://www.opengis.net/kml/2.2');
        $node->setAttribute('xmlns:atom', 'http://www.w3.org/2005/Atom');
        $this->parnode = $this->dom->appendChild($node);

        $document = $this->dom->createElement('Document');
        $this->parnode->appendChild($document);

        $this->addTag($document, 'name', 'TOE');
        $this->addTag($document, 'description', 'Made with toe.fi');
        $this->addTag($document, 'atom:link', 'http://toe.fi');

        $this->createStyle($document);
        $this->handleAreas($document);
        return $this->dom;
    }
  
    function createStyle($parent) {
        $style = $this->dom->createElement('Style');
        $style->setAttribute('id', 'area');
        $parent->appendChild($style);

        $line_style = $this->dom->createElement('LineStyle');
        $this->addtag($line_style, 'color', 'ff0000ff');
        $this->addtag($line_style, 'width', '2');
        $style->appendChild($line_style);
    }

    // convert each Area object to XML
    function handleAreas($parent_node) {
        if (count($this->areas)) {
            foreach ($this->areas as $area) {
                $this->createAreaNodes($area, $parent_node);
            }
        }
    }

    function createAreaNodes($area, $parent_node) {
        $placemark = $this->dom->createElement("Placemark");
        $parent_node->appendChild($placemark);

        if ($area->name && strlen($area->name)) {
            $this->addTag($placemark, 'name', $area->name);
        }
        $this->addTag($placemark, 'styleUrl', '#area');

        $polygon = $this->dom->createElement("Polygon");
        $placemark->appendChild($polygon);

        $boundaries = $this->dom->createElement("outerBoundaryIs");
        $polygon->appendChild($boundaries);

        $linear_ring = $this->dom->createElement("LinearRing");
        $boundaries->appendChild($linear_ring);
 
        $coordinates = $this->dom->createElement("coordinates");
        $linear_ring->appendChild($coordinates);
        $coordinates->textContent = $this->createPolygonCoordinates($area->path);
   }

   function createPolygonCoordinates($path) {
        $value = '';
        foreach ($path as $lat_lng) {
            $value .= $this->latLngToString($lat_lng) . " ";
        }
        // last coordinate must be same as first one
        $value .= $this->latLngToString($path[0]);
        return $value;
   }

    function addTag($parent, $tag, $content) {
        $elem = $this->dom->createElement($tag);
        $elem->nodeValue = $content;
        $parent->appendChild($elem);
        return $elem;
    }
 
    function latLngToString($latLng) {
        return "" . $latLng[1] . "," . $latLng[0];
    }
}

?>
