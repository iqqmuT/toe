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
 * Google Maps integration file of TOE.
 *
 */

toe.map = {

  init: function() {
    var center = new google.maps.LatLng(53, 15); // europe
    var lastView = toe._loadBounds();
    if (lastView !== false) {
      center = lastView.getCenter();
    }

    // Available maps
    var osmMapTypeId = 'OSM';
    var mapTypeIds = [
      osmMapTypeId,
      google.maps.MapTypeId.ROADMAP,
      google.maps.MapTypeId.HYBRID,
      google.maps.MapTypeId.SATELLITE,
      google.maps.MapTypeId.TERRAIN
    ];
    for (var name in toe.options.tileSources) {
      if (name === osmMapTypeId)
        continue; // already in list
      mapTypeIds.push(name);
    }

    // set initial map type from options or default to OSM
    var getInitMapTypeId = function() {
      for (var i = 0; i < mapTypeIds.length; i++) {
        if (toe.options.mapType === mapTypeIds[i]) {
          return mapTypeIds[i];
        }
      }
      return osmMapTypeId;
    };

    var mapOptions = {
      zoom: 4,
      center: center,
      mapTypeId: getInitMapTypeId(),
      mapTypeControlOptions: {
        mapTypeIds: mapTypeIds,
        style: google.maps.MapTypeControlStyle.DROPDOWN_MENU
      },
      disableDefaultUI: false,
      scaleControl: false,
      disableDoubleClickZoom: true,
    };
    this.map = new google.maps.Map(document.getElementById('map_canvas'), mapOptions);

    if (lastView !== false) {
      this.map.fitBounds(lastView);
    }

    // copyright texts for different map types
    var copyrights = {};

    var getUrlFunc = function(tileSource) {
      return function(coord, zoom) {
        // convert tile indexing
        var converted = toe.map.tileIndexing[tileSource.indexing](coord.x, coord.y, zoom);
        var url = tileSource.url;
        url = url.replace('{x}', converted.x);
        url = url.replace('{y}', converted.y);
        url = url.replace('{z}', converted.z);
        return url;
      };
    };
    for (var name in toe.options.tileSources) {
      var tileSource = toe.options.tileSources[name];
      var getTileUrl = getUrlFunc(tileSource);
      var mapType = new google.maps.ImageMapType({
        getTileUrl: getTileUrl,
        tileSize: new google.maps.Size(256, 256),
        isPng: true,
        alt: tileSource.name,
        name: name,
        maxZoom: tileSource.maxZoom,
      });
      this.map.mapTypes.set(name, mapType);
      copyrights[name] = tileSource.copyright.ui;
    }

    var $mode_div = toe.control.Mode.html();
    this.map.controls[google.maps.ControlPosition.TOP_CENTER].push($mode_div[0]);

    var $tools_div = toe.control.Tools.html();
    this.map.controls[google.maps.ControlPosition.RIGHT].push($tools_div[0]);

    var copyright = copyrights[toe.map.map.getMapTypeId()] || '';
    var $copyright_div = toe.control.Copyright.html(copyright);
    this.map.controls[google.maps.ControlPosition.BOTTOM_RIGHT].push($copyright_div[0]);

    // add click listeners to the map
    google.maps.event.addListener(this.map, 'click', function(event) { toe.handler.mapClicked(event); });
    google.maps.event.addListener(this.map, 'dblclick', function(event) { toe.handler.mapDoubleClicked(event); });
    // change copyright text when map type is changed
    google.maps.event.addListener(this.map, 'maptypeid_changed', function() {
      var html = copyrights[toe.map.map.getMapTypeId()] || '';
      $('#map-copyright').html(html);
    });

    // dummy overlay, we will use this for converting
    this.overlay = new google.maps.OverlayView();
    this.overlay.draw = function () {};
    this.overlay.setMap(this.map);

    // initialize info window, there is just one window here
    this.infoWindow = new toe.map.InfoWindow({});
  },

  changeDragMode: function() {
    this.map.setOptions({ draggableCursor: '' });
  },

  changeAreaMode: function() {
    this.map.setOptions({ draggableCursor: 'crosshair' });
  },

  // gets bounds of all stuff we have on the map and zoom the map there
  fitBounds: function(bounds) {
    if (!bounds) {
      bounds = new this.LatLngBounds();
      if (toe.AreaManager.areas.length) {
        bounds.union(toe.AreaManager.getBounds());
      }
      /*
      console.log(bounds);
      if (toe.PoiManager.pois.length) {
        bounds.union(toe.PoiManager.getBounds());
      }*/
      //console.log(bounds, pois.getBounds());
    }
    if (!bounds.isEmpty()) {
      this.map.fitBounds(bounds);
    }
  },

  getBounds: function() {
    return this._toBounds(toe.map.map.getBounds());
  },

  /**
   * Returns toe.map.LatLng from (click) event.
   */
  getEventLatLng: function(event) {
    return this._toLatLng(event.latLng);
  },

  // private functions

  /**
   * Converts Google Maps LatLngBounds object to toe.map.LatLngBounds.
   * Private function.
   */
  _toBounds: function(googleLatLngBounds) {
    return new toe.map.LatLngBounds(googleLatLngBounds.getSouthWest(), googleLatLngBounds.getNorthEast());
  },

  /**
   * Converts Google Maps LatLng object to toe.map.LatLng.
   * Private function.
   */
  _toLatLng: function(googleLatLng) {
    return new toe.map.LatLng(googleLatLng.lat(), googleLatLng.lng());
  },

  /**
   * Converts Google Maps MVCArray of LatLngs to array of toe.map.LatLngs.
   */
  _toLatLngs: function(googleLatLngs) {
    var latLngs = [];
    for (var i = 0; i < googleLatLngs.getLength(); i++) {
      latLngs.push(this._toLatLng(googleLatLngs.getAt(i)));
    }
    return latLngs;
  }

};

/**
 * Tile indexing converters.
 */
toe.map.tileIndexing = {
  /**
   * Tile indexing: 'f'
   */
  f: function(x, y, z) {
    x = x - Math.pow(2, z - 1);
    var ymax = 1 << z;
    y = ymax - y - 1;
    y = y - Math.pow(2, z - 1);
    z = 18 - z;
    return { x: x, y: y, z: z };
  },

  /**
   * Tile indexing: 'tms'
   */
  tms: function(x, y, z) {
    var ymax = 1 << z;
    y = ymax - y - 1;
    return { x: x, y: y, z: z };
  },

  /**
   * Tile indexing: 'google'
   */
  google: function(x, y, z) {
    return { x: x, y: y, z: z };
  },
};

/**
 * InfoWindow
 */
toe.map.InfoWindow = class extends google.maps.InfoWindow {
  show(options) {
    this.setOptions({
      content: options.content,
      position: options.position
    });
    this.open(toe.map.map);

    // callback when ready
    google.maps.event.addListener(this, 'domready', function() {
      options.ready();
    });
  }

  hide() {
    this.close();
  }
};

/**
 * LatLng
 */
toe.map.LatLng = function(lat, lng) {
  this.base = google.maps.LatLng;
  this.base(lat, lng);
};
toe.map.LatLng.prototype = new google.maps.LatLng;

// returns latLng as JSON array
toe.map.LatLng.prototype.toJSON = function() {
  return "[" + this.lat() + "," + this.lng() + "]";
};

toe.map.LatLng.prototype.getLat = function() {
  return this.lat();
};

toe.map.LatLng.prototype.getLng = function() {
  return this.lng();
};

/**
 * Converts LatLng to pixel point.
 */
toe.map.LatLng.prototype.toPoint = function() {
  return toe.map.overlay.getProjection().fromLatLngToContainerPixel(this);
};

/**
 * LatLngBounds
 */
toe.map.LatLngBounds = function(sw, ne) {
  this.base = google.maps.LatLngBounds;
  this.base(sw, ne);
};
toe.map.LatLngBounds.prototype = new google.maps.LatLngBounds;

// Resizes LatLngBounds with given factor
toe.map.LatLngBounds.prototype.resize = function(factor) {
  var ne = this.getNorthEast();
  var sw = this.getSouthWest();
  var ce = this.getCenter();

  var lat = ce.lat() - (factor * (ce.lat() - ne.lat()));
  var lng = ce.lng() - (factor * (ce.lng() - ne.lng()));
  ne = new toe.map.LatLng(lat, lng);

  lat = ce.lat() + (factor * (sw.lat() - ce.lat()));
  lng = ce.lng() + (factor * (sw.lng() - ce.lng()));
  sw = new toe.map.LatLng(lat, lng);

  return new toe.map.LatLngBounds(sw, ne);
};

/**
 * Creates LatLngBounds from string which is in format of LatLngBounds.toString()
 */
toe.map.getLatLngBoundsByString = function(str) {
  var nums = str.match(/-?\d[\.\d]*/g);
  var sw = new toe.map.LatLng(nums[0], nums[1]);
  var ne = new toe.map.LatLng(nums[2], nums[3]);
  return new toe.map.LatLngBounds(sw, ne);
};

/**
 * Polygon
 */

class ToePolygon extends google.maps.Polygon {
  constructor(options) {
    super(options);
    this.addListener('click', options.clicked);
    this.addListener('dblclick', options.dblclicked);
  }
}
toe.map.Polygon = ToePolygon;

toe.map.Polygon.prototype.show = function() {
  this.setMap(toe.map.map);
};

toe.map.Polygon.prototype.hide = function() {
  this.setMap(null);
};

toe.map.Polygon.prototype.setColor = function(style) {
  this.setOptions(style);
};

/**
 * Add given latlng to path into given position in path.
 */
toe.map.Polygon.prototype.addToPath = function(idx, latLng) {
  this.getPath().insertAt(idx, latLng);
};

/**
 * Remove latlng from path.
 */
toe.map.Polygon.prototype.removeFromPath = function(latLng) {
  var path = this.getPath();
  for (var i = 0; i < path.getLength(); i++) {
    if (path.getAt(i).equals(latLng)) {
      path.removeAt(i); // update polygon path
      return true;
    }
  }
  return false; // given latLng not found
};

/**
 * Move latlng to another location in path.
 */
toe.map.Polygon.prototype.changePath = function(oldLatLng, newLatLng) {
  var path = this.getPath();
  for (var i = 0; i < path.getLength(); i++) {
    if (path.getAt(i).equals(oldLatLng)) {
      path.setAt(i, newLatLng); // update polygon path
      return true;
    }
  }
  return false; // given latLng not found
};

// Poygon getBounds extension - google-maps-extensions
// http://code.google.com/p/google-maps-extensions/source/browse/google.maps.Polygon.getBounds.js
toe.map.Polygon.prototype.getBounds = function() {
  var bounds = new google.maps.LatLngBounds();
  var paths = this.getPaths();
  var path;

  for (var p = 0; p < paths.getLength(); p++) {
    path = paths.getAt(p);
    for (var i = 0; i < path.getLength(); i++) {
      bounds.extend(path.getAt(i));
    }
  }

  return bounds;
};

// Polygon containsLatLng - method to determine if a latLng is within a polygon
toe.map.Polygon.prototype.containsLatLng = function(latLng) {
  // Exclude points outside of bounds as there is no way they are in the poly
  var bounds = this.getBounds();

  if(bounds != null && !bounds.contains(latLng)) {
    return false;
  }

  // Raycast point in polygon method
  var inPoly = false;

  var numPaths = this.getPaths().getLength();
  for(var p = 0; p < numPaths; p++) {
    var path = this.getPaths().getAt(p);
    var numPoints = path.getLength();
    var j = numPoints-1;

    for(var i=0; i < numPoints; i++) {
      var vertex1 = path.getAt(i);
      var vertex2 = path.getAt(j);

      if (vertex1.lng() < latLng.lng() && vertex2.lng() >= latLng.lng() || vertex2.lng() < latLng.lng() && vertex1.lng() >= latLng.lng())  {
        if (vertex1.lat() + (latLng.lng() - vertex1.lng()) / (vertex2.lng() - vertex1.lng()) * (vertex2.lat() - vertex1.lat()) < latLng.lat()) {
          inPoly = !inPoly;
        }
      }

      j = i;
    }
  }

  return inPoly;
};

/**
 * Return read-only array of polygon path latlngs.
 */
toe.map.Polygon.prototype.getToePath = function() {
  return toe.map._toLatLngs(this.getPath());
};

/**
 * Rectangle
 */
class ToeRectangle extends google.maps.Rectangle {}
toe.map.Rectangle = ToeRectangle;

toe.map.Rectangle.prototype.show = function(bounds) {
  this.setMap(toe.map.map);
  this.setBounds(bounds);
};
toe.map.Rectangle.prototype.hide = function() {
  this.setMap(null);
};
toe.map.Rectangle.prototype.toString = function() {
  return toe.map._toBounds(this.getBounds()).toString()
};

/**
 * AreaVertexMarker
 */
toe.map.AreaVertexMarker = function(options) {
    options.map = toe.map.map;
    options.draggable = true;
    options.icon = new google.maps.MarkerImage('images/red_dot.png',
      new google.maps.Size(14, 14), // icon size
      new google.maps.Point(0,0),   // origin
      new google.maps.Point(7, 7)); // anchor
    options.shape = {
      coords: [1, 1, 1, 14, 14, 14, 14, 1],
      type: 'poly'
    };
    options.raiseOnDrag = false;
    options.cursor = 'move';

    // prototype "inheritance" does not work with Google Maps Marker
    this.googleMarker = new google.maps.Marker(options);
};

toe.map.AreaVertexMarker.prototype.remove = function() {
  this.googleMarker.setMap(null);
};
toe.map.AreaVertexMarker.prototype.setDrag = function(func) {
  google.maps.event.addListener(this.googleMarker, 'drag', func);
};

toe.map.AreaVertexMarker.prototype.setDragEnd = function(func) {
  google.maps.event.addListener(this.googleMarker, 'dragend', func);
};

toe.map.AreaVertexMarker.prototype.setDoubleClick = function(func) {
  google.maps.event.addListener(this.googleMarker, 'dblclick', func);
};

toe.map.AreaVertexMarker.prototype.getToeLatLng = function() {
  return toe.map._toLatLng(this.googleMarker.getPosition());
};

toe.map.AreaVertexMarker.prototype.setToeLatLng = function(latLng) {
  this.googleMarker.setPosition(latLng);
};

/**
 * CurrentPositionMarker
 */
class ToeCircle extends google.maps.Circle {
  constructor(options) {
    options.map = toe.map.map;
    options.center = options.position;
    options.draggable = false;
    options.clickable = false;
    options.editable = false;
    options.fillColor = '#00f';
    options.fillOpacity = 0.2,
    options.strokeColor = '#00f';
    options.strokeOpacity = 0.5;
    options.strokeWidth = 2;
    super(options);
  }
}
toe.map.CurrentPositionMarker = ToeCircle;

toe.map.CurrentPositionMarker.prototype.hide = function() {
  this.setVisible(false);
};
toe.map.CurrentPositionMarker.prototype.show = function() {
  this.setVisible(true);
};
toe.map.CurrentPositionMarker.prototype.setToeLatLng = function(latLng) {
  this.setCenter(latLng);
};
toe.map.CurrentPositionMarker.prototype.setToeRadius = function(radius) {
  this.setRadius(radius);
};

/**
 * Encoded path
 * https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 */
toe.map.encoding = {};
toe.map.encoding.encodePath = function(path) {
  return google.maps.geometry.encoding.encodePath(path);
};

toe.map.encoding.decodePath = function(path) {
  return google.maps.geometry.encoding.decodePath(path);
};
