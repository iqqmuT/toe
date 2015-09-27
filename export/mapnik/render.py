#!/usr/bin/env python
# coding=utf8

# run this in mapnik stylesheet directory!
# Example:
# cd ~/mapnik-stylesheets
# echo '{"areas":[],"pois":[]}' | ../www/toe/export/mapnik/render.py -b "((61.477925877956785, 21.768811679687474), (61.488948601502614, 21.823743320312474))" -s 144x93
# force divisions to use float
from __future__ import division
import sys, os
import mapnik2
import cairo
import json
import argparse
import tempfile
import shutil
from globalmaptiles import GlobalMercator
from tileloader import GoogleTileLoader, TMSTileLoader, FTileLoader

#sys.stdout.write("areas: '" + str(areas) + "'\n")
#sys.stdout.write("pois: '" + str(areas) + "'\n")
#sys.exit(0)

# ensure minimum mapnik version
if not hasattr(mapnik2,'mapnik_version') and not mapnik2.mapnik_version() >= 600:
    raise SystemExit('This script requires Mapnik >=0.6.0)')

# Google bounds toString() gives following string:
# ((61.477925877956785, 21.768811679687474), (61.488948601502614, 21.823743320312474))
def googleBoundsToBox2d(google_bounds):
    parts = google_bounds.split(",")
    strip_str = "() "
    min_lat = float(parts[0].strip(strip_str))
    min_lng = float(parts[1].strip(strip_str))
    max_lat = float(parts[2].strip(strip_str))
    max_lng = float(parts[3].strip(strip_str))
    return (min_lng, min_lat, max_lng, max_lat)


class TileSourceParser:
    """Parses tiles.json containing information about tile sources."""
    def __init__(self, tile_src_file, tile_source):
        tile_src_file = os.path.join(sys.path[0], tile_src_file)
        f = open(tile_src_file, 'r')
        data = f.read()
        f.close()
        obj = json.loads(data)
        self.tiles = obj[tile_source]

    def get(self, key, default=None):
        return self.tiles.get(key, default)


class StyleParser:
    DEFAULT_STYLE="default"
    UNIT="unit"
    UNIT_CM="cm"
    UNIT_MM="mm"
    UNIT_PX="px"
    UNIT_INCH="in"
    DEFAULT_UNIT=UNIT_PX

    def __init__(self, style_file, style_name):
        styles_file = os.path.join(sys.path[0], style_file)
        f = open(styles_file, 'r')
        data = f.read()
        f.close()
        obj = json.loads(data)
        self.style = obj[style_name or self.DEFAULT_STYLE]

    def get(self, key, default=None):
        return self.style.get(key, default)

    def set(self, key, value):
        self.style[key] = value

    def get_px(self, key, default=None):
        value = self.get(key, default)
        if isinstance(value, list):
            # convert list values
            li = list()
            for v in value:
                li.append(self.to_px(v))
            value = li
        else:
            # convert value
            value = self.to_px(value)
        return value

    def to_px(self, value):
        """Returns value in px and converts units automatically.
           Unit may be told with 'unit' key in styles.json."""
        unit = self.get(self.UNIT, self.DEFAULT_UNIT)
        if unit == self.UNIT_PX:
            return value
        elif unit == self.UNIT_CM:
            return self._cm_to_px(value)
        elif unit == self.UNIT_MM:
            return self._mm_to_px(value)
        elif unit == self.UNIT_INCH:
            return self._inch_to_px(value)

    def _cm_to_px(self, v):
        return int(v * 72 / 2.54)

    def _mm_to_px(self, v):
        return int(v * 72 / 25.4)

    def _inch_to_px(self, v):
        return int(v * 72)

    def _get_unit(self):
        return self.get(self.UNIT, self.DEFAULT_UNIT)


class Layer(object):
    """Base class for Layer classes."""
    def __init__(self, renderer):
        self.renderer = renderer
        # for convenience
        self.ctx = renderer.get_context()
        self.m = renderer.get_map()
        self.tiles = renderer.get_tile_source()
        self.style = renderer.get_style()

    def draw(self):
        """Implement this in subclasses."""
        pass

class MapnikLayer(Layer):
    """Layer for Mapnik map."""
    def draw(self):
        zoom = self.style.get('zoom')
        # save context
        self.ctx.save()
        self.ctx.scale(zoom, zoom)
        mapnik2.render(self.m, self.ctx)
        # restore saved context
        self.ctx.restore()

class AreaLayer(Layer):
    """Layer for area borders."""
    def __init__(self, renderer, areas):
        super(AreaLayer, self).__init__(renderer)
        self.areas = areas

    def draw(self):
        # save context before zoom so we can restore it later
        self.ctx.save()

        # apply zoom
        zoom = self.style.get('zoom')
        self.ctx.scale(zoom, zoom)

        # do not draw lines outside the map
        self.ctx.rectangle(0, 0, self.m.width, self.m.height)
        self.ctx.clip()

        for area in self.areas:
            self._draw_area(area)

        # set brush color and line width
        self.ctx.set_source_rgba(self.style.get('area_border_color')[0],
                                 self.style.get('area_border_color')[1],
                                 self.style.get('area_border_color')[2],
                                 self.style.get('area_border_color')[3])
        self.ctx.set_line_width(self.style.get('area_border_width') / zoom)
        self.ctx.stroke()

        # restore saved context
        self.ctx.restore()

    def _draw_area(self, area):
        coords = list()
        for coord in area['path']:
            coords.append(self.renderer.latlng_to_map(coord[0], coord[1]))
        if len(coords) < 2:
            pass # area has only one point?

        start = coords.pop()
        self.ctx.move_to(start.x, start.y)
        while len(coords):
            coord = coords.pop()
            self.ctx.line_to(coord.x, coord.y)
        self.ctx.close_path()


class CopyrightLayer(Layer):
    def __init__(self, renderer, text):
        super(CopyrightLayer, self).__init__(renderer)
        self.text = text

    def draw(self):
        self.ctx.save()
        zoom = 1
        self.ctx.scale(zoom, zoom)
        self.ctx.select_font_face("Sans", cairo.FONT_SLANT_NORMAL,
            cairo.FONT_WEIGHT_NORMAL)
        self.ctx.set_font_size(6)
        margin = self.style.get_px('copyright_margin', [ 3, 3 ])
        map_size = self.renderer.get_map_size()
        x = margin[0]
        y = map_size[1] - margin[1]
        self.ctx.move_to(x, y)
        self.ctx.show_text(self.text)
        self.ctx.restore()

class QRCodeLayer(Layer):
    def __init__(self, renderer, qrcode_file):
        super(QRCodeLayer, self).__init__(renderer)
        self.qrcode_file = qrcode_file

    def draw(self):
        self.ctx.save()
        zoom = 0.3
        self.ctx.scale(zoom, zoom)
        img = cairo.ImageSurface.create_from_png(self.qrcode_file)
        margin = self.style.get_px('qrcode_margin', [ 0, 0 ])
        map_size = self.renderer.get_map_size()
        x = int(1 / zoom * map_size[0]) - img.get_width() - margin[0]
        y = int(1 / zoom * map_size[1]) - img.get_height() - margin[1]
        self.ctx.set_source_surface(img, x, y)
        self.ctx.paint()
        self.ctx.restore()

class CustomMapLayer(Layer):
    def __init__(self, renderer, cache_dir):
        super(CustomMapLayer, self).__init__(renderer)
        self.cache_dir = cache_dir
        self.mercator = GlobalMercator()
        self.tileloader = None
        if self.tiles is not None:
            map_envelope = self.m.envelope()
            # map_envelope is in mercator projection, convert it to
            # long/lat projection
            envelope = renderer.merc_to_lnglat(map_envelope)
            min_lon = envelope.minx
            min_lat = envelope.miny
            max_lon = envelope.maxx
            max_lat = envelope.maxy

            width = self.m.width
            indexing = self.tiles.get('indexing')
            if indexing == 'google':
                self.tileloader = GoogleTileLoader(min_lat, min_lon, max_lat, max_lon, width)
            elif indexing == 'tms':
                self.tileloader = TMSTileLoader(min_lat, min_lon, max_lat, max_lon, width)
            elif indexing == 'f':
                self.tileloader = FTileLoader(min_lat, min_lon, max_lat, max_lon, width)

    def draw(self):
        # clip drawing area, so everything out will be clipped
        zoom = self.style.get('zoom')
        self.ctx.save()
        self.ctx.scale(zoom, zoom)
        self.ctx.rectangle(0, 0, self.m.width, self.m.height)
        self.ctx.clip()
        if self.tileloader is not None:
            for tile in self._get_tiles():
                tile.draw()
        self.ctx.restore()

    def _get_tiles(self):
        tiles = list()
        url = self.tiles.get('url')
        http_headers = self.tiles.get('http_headers')
        tile_files = self.tileloader.download(self.cache_dir, url, http_headers)
        for filename in tile_files:
            tile = TileLayer(self.renderer, filename, self.mercator)
            tiles.append(tile)
        return tiles

class TileLayer(Layer):
    """Used by CustomMapLayer."""

    def __init__(self, renderer, filename, mercator):
        super(TileLayer, self).__init__(renderer)
        self.filename = filename
        self.mercator = mercator
        basename = os.path.basename(filename).split('.')[0]
        parts = basename.split('_')
        # XYZ is part of the tile filename
        self.tx = 0
        self.ty = 0
        self.tz = 0
        if (len(parts) == 3):
            self.tx, self.ty, self.tz = int(parts[0]), int(parts[1]), int(parts[2])

    def draw(self):
        zoom = self.style.get('zoom')
        (min_lat, min_lon, max_lat, max_lon) = self.mercator.TileLatLonBounds(self.tx, self.ty, self.tz)
        coord_nw = self.renderer.latlng_to_map(max_lat, min_lon)
        coord_se = self.renderer.latlng_to_map(min_lat, max_lon)

        tile_width = coord_se.x - coord_nw.x
        self.ctx.save()

        # assume it is png
        img = cairo.ImageSurface.create_from_png(self.filename)
        zoom = tile_width / 256
        self.ctx.scale(zoom, zoom)
        self.ctx.set_source_surface(img, int(1 / zoom * coord_nw.x), int(1 / zoom * coord_nw.y))
        self.ctx.paint()
        self.ctx.restore()


class MapnikRenderer:

    STYLES_FILE="styles.json"
    TILES_FILE="tiles.json"
    COPYRIGHT_TEXT="© OpenStreetMap contributors, CC-BY-SA"

    def __init__(self, areas):
        self.areas = areas
        self.tiles = None
        self.style = None

        # Set up projections
        # long/lat in degrees, aka ESPG:4326 and "WGS 84"
        # we get data in this projection
        longlat = mapnik2.Projection('+proj=longlat +ellps=WGS84 +datum=WGS84 +no_defs')

        # Map uses spherical mercator (most common target map projection of osm data imported with osm2pgsql)
        self.merc = mapnik2.Projection('+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +no_defs +over')

        # transform objects (Box2d and Coord) to another projection
        self.lnglat_to_merc_transform = mapnik2.ProjTransform(longlat, self.merc)
        self.merc_to_lnglat_transform = mapnik2.ProjTransform(self.merc, longlat)

    def render(self, output_format, tile_source, style_name, qrcode):
        # parse styles
        self.style = StyleParser(self.STYLES_FILE, style_name)

        # parse tile sources
        if tile_source is not None and tile_source != 'OSM':
            self.tiles = TileSourceParser(self.TILES_FILE, tile_source)
            # force zoom 0.5 with tiles, seems to be good
            self.style.set('zoom', 0.5)

        try:
            mapfile = os.environ['MAPNIK_MAP_FILE']
        except KeyError:
            mapfile = "osm.xml"

        tile_cache_dir = None
        (tmp_file_handler, tmp_file) = tempfile.mkstemp()
        map_uri = tmp_file

        map_bounds = self.googleBoundsToBox2d(args.bbox)

        # Our bounds above are in long/lat, but our map
        # is in spherical mercator, so we need to transform
        # the bounding box to mercator to properly position
        # the Map when we call `zoom_to_box()`
        # bbox is in long/lat, transform it to mercator projection
        self.merc_bbox = self.lnglat_to_merc(map_bounds)

        # auto switch paper and map orientation
        # default orientation in styles is landscape
        self._get_sizes()

        # Create the map
        self.zoom = self.style.get('zoom')
        self.zoom_f = 1 / self.zoom # zoom factor

        self.m = mapnik2.Map(int(self.zoom_f * self.map_size[0]),
                             int(self.zoom_f * self.map_size[1]))
        mapnik2.load_map(self.m, mapfile)

        # ensure the target map projection is mercator
        self.m.srs = self.merc.params()

        # Mapnik internally will fix the aspect ratio of the bounding box
        # to match the aspect ratio of the target image width and height
        # This behavior is controlled by setting the `m.aspect_fix_mode`
        # and defaults to GROW_BBOX, but you can also change it to alter
        # the target image size by setting aspect_fix_mode to GROW_CANVAS
        #m.aspect_fix_mode = mapnik.GROW_CANVAS
        # Note: aspect_fix_mode is only available in Mapnik >= 0.6.0
        self.m.zoom_to_box(self.merc_bbox)

        # we will render the map to cairo surface
        surface = None
        if output_format == 'pdf':
            surface = cairo.PDFSurface(map_uri, self.paper_size[0], self.paper_size[1])
        elif output_format == 'svg':
            surface = cairo.SVGSurface(map_uri, self.m.width, self.m.height)
        self.ctx = cairo.Context(surface)

        # margins
        margin = self.style.get_px('margin')
        self.ctx.translate(margin[0],
                           margin[1])

        # create layers
        layers = list()

        # map layer
        if self.has_custom_map():
            # create temporary tile cache dir
            tile_cache_dir = tempfile.mkdtemp()
            layers.append(CustomMapLayer(self, tile_cache_dir))
        else:
            layers.append(MapnikLayer(self))

        # area borders layer
        layers.append(AreaLayer(self, self.areas))

        # copyright layer
        copyright_text = self.COPYRIGHT_TEXT
        if self.has_custom_map():
            copyright_text = self.tiles.get('copyright', None)
            if copyright_text is not None:
                copyright_text = copyright_text['export']
                layers.append(CopyrightLayer(self, copyright_text))

        # QR code layer
        if qrcode and self.style.get('qrcode', True):
            layers.append(QRCodeLayer(self, qrcode))

        # draw layers
        for layer in layers:
            layer.draw()

        surface.finish()
        self.output_file = map_uri

        # remove tile cache dir
        if tile_cache_dir is not None:
            shutil.rmtree(tile_cache_dir)

    def get_map(self):
        return self.m

    def get_context(self):
        return self.ctx

    # Google bounds toString() gives following string:
    # ((61.477925877956785, 21.768811679687474), (61.488948601502614, 21.823743320312474))
    def googleBoundsToBox2d(self, google_bounds):
        parts = google_bounds.split(",")
        strip_str = "() "
        min_lat = float(parts[0].strip(strip_str))
        min_lng = float(parts[1].strip(strip_str))
        max_lat = float(parts[2].strip(strip_str))
        max_lng = float(parts[3].strip(strip_str))
        return mapnik2.Box2d(min_lng, min_lat, max_lng, max_lat)

    def latlng_to_map(self, lat, lng):
        """Transforms given longlat Box2d or Coord to map projection."""
        coord = mapnik2.Coord(lng, lat)
        merc_coord = self.lnglat_to_merc(coord)
        return self.merc_to_map(merc_coord)

    def lnglat_to_merc(self, bbox):
        """Transforms given longlat Box2d or Coord to merc projection."""
        return self.lnglat_to_merc_transform.forward(bbox)

    def merc_to_lnglat(self, bbox):
        """Transforms given map Box2d or Coord to longlat projection."""
        return self.merc_to_lnglat_transform.forward(bbox)

    def merc_to_map(self, bbox):
        """Transforms given merc Box2d or Coord to map projection."""
        return self.m.view_transform().forward(bbox)

    def get_tile_source(self):
        return self.tiles

    def get_style(self):
        return self.style

    def get_map_size(self):
        return self.map_size

    def get_paper_size(self):
        return self.paper_size

    def _get_sizes(self):
        self.paper_size = self.style.get_px('paper_size')
        self.map_size = self.style.get_px('map_size')
        if self.style.get('orientation') == 'auto':
            bbox_landscape = self.merc_bbox.width() / self.merc_bbox.height() > 1
            map_landscape = self.map_size[0] / self.map_size[1] > 1
            # change map orientation if needed
            if (bbox_landscape and not map_landscape) or (not bbox_landscape and map_landscape):
                self.map_size.reverse()

            paper_landscape = self.paper_size[0] / self.paper_size[1] > 1
            # change paper orientation if needed
            if (bbox_landscape and not paper_landscape) or (not bbox_landscape and paper_landscape):
                self.paper_size.reverse()

    def get_output(self):
        return self.output_file

    def has_custom_map(self):
        return self.tiles is not None

if __name__ == "__main__":

    parser = argparse.ArgumentParser(description='Mapnik renderer.')
    parser.add_argument('-b', '--bbox', required=True)
    parser.add_argument('-f', '--outputformat', required=False, default='pdf')
    parser.add_argument('-t', '--tiles', required=False, default=None)
    parser.add_argument('-s', '--style', required=False, default=None)
    parser.add_argument('-q', '--qrcode', required=False, default=None)
    args = parser.parse_args()

    #sys.stdout.write("'" + str(args.bbox) + "'\n")

    stdin_data = sys.stdin.read()
    data = json.loads(stdin_data)
    areas = data['areas']
    pois = data['pois']

    r = MapnikRenderer(areas)
    r.render(args.outputformat, args.tiles, args.style, args.qrcode)
    fn = r.get_output()
    sys.stdout.write("%s" % fn)
