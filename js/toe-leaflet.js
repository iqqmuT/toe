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
 * Leaflet integration file of TOE.
 *
 */

toe.map = {

  init: function() {
    var mapOptions = {
      doubleClickZoom: false,
      touchZoom: true,
      center: new L.LatLng(53, 15), // europe
      zoom: 4
    };
    this.map = new L.Map('map_canvas', mapOptions);
      L.tileLayer('http://{s}.tiles.mapbox.com/v3/iqqmut.jgii6ia2/{z}/{x}/{y}.png', {
      attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="http://mapbox.com">Mapbox</a>',
    maxZoom: 18
    }).addTo(this.map);
    var lastView = toe._loadBounds();
    if (lastView !== false) {
      this.map.fitBounds(lastView);
    }

    this.map.addControl(new L.Control.MapMode());
    this.map.addControl(new L.Control.Tools());

    // add click listeners to the map
    this.map.on('click', function(event) { toe.handler.mapClicked(event); });
    this.map.on('dblclick', function(event) { toe.handler.mapDoubleClicked(event); });

    // initialize info window, there is just one window here
    this.infoWindow = new toe.map.InfoWindow();
  },

  changeDragMode: function() {
    this.map._container.style.cursor = '';
  },

  changeAreaMode: function() {
    this.map._container.style.cursor = 'crosshair';
  },

  /**
   * Fit map to given bounds, or if not given, gets bounds of all stuff we have on the map and zoom the map there
   */
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
    }
    //console.log(bounds, pois.getBounds());
    //console.log(bounds.isEmpty());
    if (!bounds.isEmpty()) {
      //console.log("fit bounds?", bounds, bounds.isEmpty());
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
    return this._toLatLng(event.latlng);
  },

  /**
   * Converts Leaflet LatLngBounds object to toe.map.LatLngBounds.
   * Private function.
   */
  _toBounds: function(leafletLatLngBounds) {
    return new toe.map.LatLngBounds(leafletLatLngBounds.getSouthWest(), leafletLatLngBounds.getNorthEast());
  },

  /**
   * Converts Leaflet LatLngBounds object to toe.map.LatLngBounds.
   * Private function.
   */
  _toLatLng: function(leafletLatLng) {
    return new toe.map.LatLng(leafletLatLng.lat, leafletLatLng.lng);
  }

};

/**
 * InfoWindow
 */
toe.map.InfoWindow = function() {
    this.base = L.Popup;
    this.base();
};

toe.map.InfoWindow.prototype = new L.Popup;

toe.map.InfoWindow.prototype.show = function(options) {
  this.on('contentupdate', options.ready);
  this.setContent(options.content);
  this.setLatLng(options.position);
  toe.map.map.openPopup(this);
};

toe.map.InfoWindow.prototype.hide = function() {
  toe.map.map.removeLayer(this);
};

/**
 * LatLng
 */
toe.map.LatLng = function(lat, lng) {
  this.base = L.LatLng;
  this.base(lat, lng);
};
// use hackish inheritance
// http://www.spheredev.org/wiki/Prototypes_in_JavaScript
toe.map.LatLng.prototype.__proto__ = L.LatLng.prototype;

// returns latLng as JSON array
toe.map.LatLng.prototype.toJSON = function() {
  return "[" + this.lat + "," + this.lng + "]";
};

toe.map.LatLng.prototype.getLat = function() {
  return this.lat;
};

toe.map.LatLng.prototype.getLng = function() {
  return this.lng;
};

/**
 * Converts LatLng to pixel point.
 */
toe.map.LatLng.prototype.toPoint = function() {
  return toe.map.map.latLngToLayerPoint(this);
};

toe.map.LatLng.prototype.toString = function() {
  return ('(' + this.lat + ', ' + this.lng + ')');
};


/**
 * LatLngBounds
 */
toe.map.LatLngBounds = function(sw, ne) {
  this.base = L.LatLngBounds;
  this.base(sw, ne);
};
toe.map.LatLngBounds.prototype = new L.LatLngBounds;

// Resizes LatLngBounds with given factor
toe.map.LatLngBounds.prototype.resize = function(factor) {
  var ne = this.getNorthEast();
  var sw = this.getSouthWest();
  var ce = this.getCenter();

  var lat = ce.lat - (factor * (ce.lat - ne.lat));
  var lng = ce.lng - (factor * (ce.lng - ne.lng));
  ne = new toe.map.LatLng(lat, lng);

  lat = ce.lat + (factor * (sw.lat - ce.lat));
  lng = ce.lng + (factor * (sw.lng - ce.lng));
  sw = new toe.map.LatLng(lat, lng);

  return new toe.map.LatLngBounds(sw, ne);
};

/**
 * Extends this bounds to contain the union of this and the given bounds.
 **/
toe.map.LatLngBounds.prototype.union = function(other) {
  this.extend(other.getSouthWest());
  this.extend(other.getNorthEast());
};

toe.map.LatLngBounds.prototype.isEmpty = function() {
  return (this.getNorthEast().lat === undefined);
};

toe.map.LatLngBounds.prototype.toString = function() {
  var sw = toe.map._toLatLng(this.getSouthWest());
  var ne = toe.map._toLatLng(this.getNorthEast());
  return ('(' + sw.toString() + ', ' + ne.toString() + ')');
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
toe.map.Polygon = function(options) {
  this.base = L.Polygon;
  this.base(options.paths);
  //console.log("paths: ", options.paths);
  this.on('click', options.clicked);
  this.on('dblclick', options.dblclicked);
};
toe.map.Polygon.prototype.__proto__ = L.Polygon.prototype;

toe.map.Polygon.prototype.show = function() {
  toe.map.map.addLayer(this);
};

toe.map.Polygon.prototype.hide = function() {
  toe.map.map.removeLayer(this);
};

toe.map.Polygon.prototype.setColor = function(style) {
  this.setStyle({
    stroke: true,
    color: style.strokeColor,
    weight: style.strokeWeight,
    opacity: style.strokeOpacity,
    fillColor: style.fillColor,
    fillOpacity: style.fillOpacity
  });
};

/**
 * Add given latlng to path into given position in path.
 */
toe.map.Polygon.prototype.addToPath = function(idx, latLng) {
  this.spliceLatLngs(idx, 0, latLng);
};

/**
 * Remove latlng from path.
 */
toe.map.Polygon.prototype.removeFromPath = function(latLng) {
  var path = this.getLatLngs();
  for (var i = 0; i < path.length; i++) {
    if (path[i].equals(latLng)) {
      this.spliceLatLngs(i, 1); // update polygon path
      return true;
    }
  }
  return false; // given latLng not found
};

/**
 * Move latlng to another location in path.
 */
toe.map.Polygon.prototype.changePath = function(oldLatLng, newLatLng) {
  var path = this.getLatLngs();
  for (var i = 0; i < path.length; i++) {
    if (path[i].equals(oldLatLng)) {
      this.spliceLatLngs(i, 1, newLatLng); // update polygon path
      return true;
    }
  }
  return false; // given latLng not found
};

toe.map.Polygon.prototype.getBounds = function() {
  return new L.LatLngBounds(this.getLatLngs());
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

toe.map.Polygon.prototype.getToePath = function() {
  return this.getLatLngs();
};

/**
 * Rectangle
 */
toe.map.Rectangle = function(options) {
  this.base = L.Rectangle;
  var bounds = toe.map.map.getBounds();
  this.base(bounds);
};
toe.map.Rectangle.prototype.__proto__ = L.Rectangle.prototype;

toe.map.Rectangle.prototype.show = function(bounds) {
  toe.map.map.addLayer(this);
  this.setBounds(bounds);
};
toe.map.Rectangle.prototype.hide = function() {
  toe.map.map.removeLayer(this);
};
toe.map.Rectangle.prototype.toString = function() {
  console.log("toString", this.getBounds());
  return toe.map._toBounds(this.getBounds()).toString()
};


/**
 * AreaVertexMarker
 */
toe.map.AreaVertexMarker = function(options) {
  var icon = new L.Icon({
    iconUrl: 'images/red_dot.png',
    shadowUrl: null,
    iconSize: new L.Point(14, 14),
    iconAnchor: new L.Point(7, 7)
  });

  this.base = L.Marker;
  this.base(options.position, {
    icon: icon,
    clickable: true,
    draggable: true
  });
  toe.map.map.addLayer(this);
};

toe.map.AreaVertexMarker.prototype.__proto__ = L.Marker.prototype;

toe.map.AreaVertexMarker.prototype.remove = function() {
  toe.map.map.removeLayer(this);
};

toe.map.AreaVertexMarker.prototype.setDrag = function(func) {
  this.on('drag', func);
};

toe.map.AreaVertexMarker.prototype.setDragEnd = function(func) {
  this.on('dragend', func);
};

toe.map.AreaVertexMarker.prototype.setDoubleClick = function(func) {
  this.on('dblclick', func);
};

toe.map.AreaVertexMarker.prototype.getToeLatLng = function() {
  return toe.map._toLatLng(this.getLatLng());
};

toe.map.AreaVertexMarker.prototype.setToeLatLng = function(latLng) {
  this.setLatLng(latLng);
};

/**
 * CurrentPositionMarker
 */
toe.map.CurrentPositionMarker = function(options) {
  this.base = L.Circle;
  var radius = options.radius;
  this.base(options.position, radius, {
    stroke: true,
    color: '#00f',
    weight: 2,
    opacity: 0.5,
    fill: true,
    fillColor: '#00f',
    fillOpacity: 0.2,
    clickable: false
  });
  toe.map.map.addLayer(this);
};

toe.map.CurrentPositionMarker.prototype.__proto__ = L.Circle.prototype;

toe.map.CurrentPositionMarker.prototype.hide = function() {
  this.setOpacity(0);
};
toe.map.CurrentPositionMarker.prototype.show = function() {
  this.setOpacity(1);
};
toe.map.CurrentPositionMarker.prototype.setToeLatLng = function(latLng) {
  this.setLatLng(latLng);
};
toe.map.CurrentPositionMarker.prototype.setToeRadius = function(radius) {
  this.setRadius(radius);
};

L.Control.MapMode = L.Control.extend({
  options: {
    position: 'topright'
  },

  onAdd: function (map) {
    var div = toe.control.Mode.html();
    return div[0];
  }
});

L.Control.Tools = L.Control.extend({
  options: {
    position: 'topright'
  },

  onAdd: function (map) {
    var div = toe.control.Tools.html();
    return div[0];
  }
});
