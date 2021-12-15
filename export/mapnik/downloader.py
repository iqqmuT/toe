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
"""

import sys
import Queue
import threading
import urllib3
import traceback

class DownloadThread(threading.Thread):
    def __init__(self, manager, queue):
        threading.Thread.__init__(self)
        self.manager = manager
        self.queue = queue

    def run(self):
        while True:
            # get url and headers from queue
            data = self.queue.get()
            # write output to a file
            try:
                r = self.manager.request(method='GET', url=data['url'], headers=data['headers'])
                f = open(data['output'], 'w')
                f.write(r.data)
                f.close()
            except IOError as e:
                sys.stderr.write('Could not save file: ' + str(e) + "\n")
            except Exception as e:
                sys.stderr.write(traceback.format_exc())
            self.queue.task_done()

class Downloader(object):
    def __init__(self, threads=5):
        manager = urllib3.PoolManager()
        self.queue = Queue.Queue()
        # spawn pool of threads
        for i in range(threads):
            t = DownloadThread(manager, self.queue)
            t.setDaemon(True)
            t.start()

    def download(self, output, url, headers=None):
         self.queue.put({ 'output':  output,
                          'url':     url,
                          'headers': headers })

    def wait(self):
         """Waits until every download has been processed"""
         self.queue.join()
