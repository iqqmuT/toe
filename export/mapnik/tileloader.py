"""
Copyright 2013-2016 Tuomas Jaakola

This file is part of TOE.

TOE is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

TOE is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with TOE.  If not, see <http://www.gnu.org/licenses/>.

More information about tiles:
http://www.maptiler.org/google-maps-coordinates-tile-bounds-projection/

"""

import sys
import os
import math
import imghdr
from globalmaptiles import GlobalMercator
from downloader import Downloader

class TileLoader(object):
    TILE_WIDTH = 256 # tile is square
    TILE_FORMAT = 'png'

    def __init__(self, min_lat, min_lon, max_lat, max_lon, width, max_zoom = 18):
        self.tiles = []
        self.min_lat = min_lat
        self.min_lon = min_lon
        self.max_lat = max_lat
        self.max_lon = max_lon
        self.mercator = GlobalMercator()
        self.downloader = Downloader()
        # count how many horizontal tiles we need
        self.x_tiles_needed = math.ceil(width / self.TILE_WIDTH)
        self.max_zoom = max_zoom

    def download(self, cache_dir, url, http_headers):
        """Downloads tiles and returns list of downloaded tiles."""
        tile_files = {}
        tiles = self._get_tile_list()
        for (tx, ty, tz) in tiles:
            cx, cy, cz = self._convert_tile(tx, ty, tz)
            tile_url = url.replace('{x}', str(cx)).replace('{y}', str(cy)).replace('{z}', str(cz))
            tile_file = self._gen_tile_file(tx, ty, tz, cache_dir)
            self.downloader.download(tile_file, tile_url, http_headers)
            tile_files[tile_url] = tile_file

        # wait downloads to be finished
        self.downloader.wait()

        # validate all tiles
        valid = True
        for tile_url, tile_file in tile_files.iteritems():
            if self.TILE_FORMAT == 'png' and imghdr.what(tile_file) != 'png':
                sys.stderr.write("%s is not PNG image\n" % tile_url)
                valid = False
        if not valid:
            return None

        return tile_files.values()

    def _get_tile_list(self):
        """Returns list of tiles needed to cover bounding box."""
        tiles = []
        tile_info = self._find_tiles()
        if tile_info is not None:
            (tminx, tminy, tmaxx, tmaxy, tz) = tile_info
            for ty in range(tminy, tmaxy + 1):
                for tx in range(tminx, tmaxx + 1):
                    tiles.append((tx, ty, tz))
        return tiles

    def _find_tiles(self):
        """Returns optimal zoom level based on given width."""
        for zoom_level in range(1, self.max_zoom + 1):
            tminx, tminy = self._lat_lon_to_tile(self.min_lat, self.min_lon, zoom_level)
            tmaxx, tmaxy = self._lat_lon_to_tile(self.max_lat, self.max_lon, zoom_level)
            x_tiles = tmaxx + 1 - tminx
            if x_tiles > self.x_tiles_needed or zoom_level == self.max_zoom:
                # optimal zoom level found
                return (tminx, tminy, tmaxx, tmaxy, zoom_level)
        return None

    def _lat_lon_to_tile(self, lat, lon, zoom_level):
        """Converts given latLon to tile XY"""
        mx, my = self.mercator.LatLonToMeters(lat, lon)
        tx, ty = self.mercator.MetersToTile(mx, my, zoom_level)
        return (tx, ty)

    def _gen_tile_file(self, tx, ty, tz, cache_dir):
        """Returns filename where tile will be saved as."""
        filename = "%d_%d_%d.%s" % (tx, ty, tz, self.TILE_FORMAT)
        return os.path.join(cache_dir, filename)

class TMSTileLoader(TileLoader):
    def _convert_tile(self, tx, ty, tz):
        return tx, ty, tz

class GoogleTileLoader(TileLoader):
    def _convert_tile(self, tx, ty, tz):
        gx, gy = self.mercator.GoogleTile(tx, ty, tz)
        return gx, gy, tz

class FTileLoader(TileLoader):
    def _convert_tile(self, tx, ty, tz):
        fx = tx - 2**(tz - 1)
        fy = ty - 2**(tz - 1)
        fz = 18 - tz
        return fx, fy, fz
