"""
Copyright 2013 Tuomas Jaakola

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

import Queue
import threading
import urllib3

class DownloadThread(threading.Thread):
    def __init__(self, manager, queue):
        threading.Thread.__init__(self)
        self.manager = manager
        self.queue = queue

    def run(self):
        while True:
            # get url and headers from queue
            data = self.queue.get()
            r = self.manager.request(method='GET', url=data['url'], headers=data['headers'])
            # write output to a file
            f = open(data['output'], 'w')
            f.write(r.data)
            f.close()
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
         print "URL: " + url
         self.queue.put({ 'output':  output,
                          'url':     url,
                          'headers': headers })

    def wait(self):
         """Waits until every download has been processed"""
         self.queue.join()
