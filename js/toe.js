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
 * Main JavaScript file of TOE.
 * 
 * Requirements:
 *  - jQuery >= 1.7.x
 * 
 */

// jQuery 1.10 does not allow HTML in dialog titles, this snippet
// enables it again
$.widget("ui.dialog", $.extend({}, $.ui.dialog.prototype, {
  _title: function(title) {
    if (!this.options.title ) {
      title.html("&#160;");
    } else {
      title.html(this.options.title);
    }
  }
}));

var toe = {

  options: {
    single_click_timeout: 400, // timeout in ms
    snap_vertices: 5,          // snap to other vertex within 5 px range
    cookie_name: 'toe',        // cookie name
    cookie_expire_days: 30,    // cookie expire in days
    archive: null,             // open archive in read only mode
    readonly: false,
    geolocation_interval: 3000 // interval for getting current position
  },

  init: function(options) {
    if (!window.console) console = {};
    console.log = console.log || function(){};
    console.warn = console.warn || function(){};
    console.error = console.error || function(){};
    console.info = console.info || function(){};

    $.extend(this.options, options);

    // on window close, check if it's ok
    window.onbeforeunload = this.destroy;

    // initialize map
    this.map.init();

    // initialize file dialog, and open the file-open dialog in initialize
    this.dialog.init(false);

    if (options.archive)
      this._openArchive(options.archive);

    if (this.options.geolocation_interval)
      toe.CurrentPositionTracker.start();
  },

  hasUnsavedChanges: function() {
    //return (pois.changed || areas.changed);
    return false;
  },

  destroy: function() {
    toe._saveBounds();

    // show a confirmation dialog if user wants to leave the page without saving the changes
    if (toe.hasUnsavedChanges())
      return tr('unsaved_changes');
    else return null;
  },

  setReadonly: function(readonly) {
    this.options.readonly = readonly;
    if (this.options.readonly) {
      toe.control.Mode.element.hide();
      toe.control.Tools.element.hide();
    }
    else {
      toe.control.Mode.element.show();
      toe.control.Tools.element.show();
    }
    toe.AreaManager.setReadonly(readonly);
  },

  // loads view from cookie
  _loadBounds: function() {
    if (document.cookie.length > 0) {
      var start = document.cookie.indexOf(this.options.cookie_name + '=');
      if (start != -1) {
        var cookie_txt = document.cookie.substring(start);
        var end = cookie_txt.indexOf(';');
        if (end != -1) {
          // found view from cookie
          cookie_txt = cookie_txt.substring(0, end);
        }
        var bounds = toe.map.getLatLngBoundsByString(cookie_txt)
        return bounds;
      }
    }
    return false;
  },

  // save current view to cookie
  _saveBounds: function() {
    var expireDate = new Date();
    expireDate.setDate(expireDate.getDate() + this.options.cookie_expire_days);

    var cookieTxt = this.options.cookie_name + '=' + this.map.getBounds().toString();
    cookieTxt += ';expires=' + expireDate.toGMTString();
    //console.log("cookie:", cookieTxt);
    document.cookie = cookieTxt;
  },

  _openArchive: function(id) {
    console.log('open archive id', id);
    var self = this;
    $.getJSON('archive/', {
      id:     id
    }).success(function(data) {
      console.log('archive opened', data);
      toe.importData({ areas: data });
      toe.setReadonly(true);
    });
  }

  // gets bounds of all stuff we have on the map and zoom the map there
  /*
  zoom: function() {
    var bounds = new toe.map.LatLngBounds();
    if (areas.areas.length) {
      bounds.union(areas.getBounds());
    }
    console.log(bounds);
    if (pois.pois.length) {
      bounds.union(pois.getBounds());
    }
    console.log(bounds, pois.getBounds());
    if (!bounds.isEmpty()) {
      this.map.fitBounds(bounds);
    }
  }*/
};

toe.importData = function(data) {
  console.log("we are importing now!", data);
  var areas_imported = toe.AreaManager.importJSON(data.areas);
  //var pois_imported = toe.PoiManager.importJSON(data.pois);
  var pois_imported;
  console.log("areas imported: " + areas_imported);
  //console.log("POIs imported: " + pois_imported);
  if (pois_imported || areas_imported) {
    toe.dialog.OpenFile.close(); // we can close the dialog now
    toe.map.fitBounds();
  }
  else {
    // we imported nothing, invalid or empty data file
  }
};

// ------------------------------------------------------------
// Controls
// ------------------------------------------------------------
toe.control = {

  Mode: new function() {
    var self = this;
    this.NORMAL = 0;
    this.AREA = 1;

    this.selected = this.NORMAL;
    this.element = null;

    this.html = function() {
      var $main_div = $("<div />");
      $main_div.css({
        'margin': '5px',
        'index': '10px'
      });

      $normal = $('<div class="mode-div" id="mode_drag" title="' + tr("Stop drawing") + '"><div class="mode"><span style="display: inline-block;"><div class="mode-icon mode-drag selected"></div></span></div></div>');
      $normal.on('click', function() {
        self.selected = self.NORMAL;
        toe.AreaManager.disable();
        toe.map.changeDragMode();
        $('.mode-area').removeClass('selected');
        $('.mode-drag').addClass('selected');
      });
      $main_div.append($normal);

      $area = $('<div class="mode-div" id="mode_area" title="' + tr("Draw areas") + '"><div class="mode"><span style="display: inline-block;"><div class="mode-icon mode-area"></div></span></div></div>');
      $area.on('click', function() {
        self.selected = self.AREA;
        toe.AreaManager.enable();
        toe.map.changeAreaMode();
        $('.mode-drag').removeClass('selected');
        $('.mode-area').addClass('selected');
      });
      $main_div.append($area);

      this.element = $main_div;
      return this.element;
    };

    this.change = function(selection) {
      self.selected = selection;
    };

    var createMode = function(icon) {
      var $div = $('<div class="mode-div" />');
      var $innerdiv = $('<div class="mode"><span style="display: inline-block;"><div class="mode-icon mode-drag"></div></span></div>');
      $div.append($innerdiv);
      return $div;
    };
  },

  Tools: new function() {
    var self = this;
    this.NORMAL = 0;
    this.AREA = 1;

    this.selected = this.NORMAL;
    this.element = null;

    this.html = function() {
      var $main_div = $("<div />");

      var icon_css = {
        'position': 'absolute',
        'left': '0px',
        'top': '0px',
        'border': '0px none',
        'padding': '0px',
        'margin': '0px',
        'width': 'auto',
        'height': 'auto'
      };
      $open = createMode('<img src="images/tango/document-open.png" />', icon_css, tr("Open file"), function() {
        toe.dialog.OpenFile.open();
      });
      $main_div.append($open);
      $save = createMode('<img src="images/tango/document-save.png"/>', icon_css, tr("Save file"), function() {
        toe.dialog.SaveFile.open();
      });
      $main_div.append($save);

      $export = createMode('<img src="images/tango/document-print.png"/>', icon_css, tr("Print"), function() {
        toe.dialog.Print.open();
      });
      $main_div.append($export);

      $settings = createMode('<img src="images/tango/preferences-system.png"/>', icon_css, tr("Change settings"), function() {
        toe.dialog.Settings.open();
      });
      $main_div.append($settings);

      $clear = createMode('<img src="images/tango/edit-clear.png"/>', icon_css, tr("Clear drawings"), function() {
        toe.dialog.Settings.open();
      });
      $main_div.append($clear);

      $undo = createMode('<img src="images/tango/edit-undo.png"/>', icon_css, tr("Undo"), function() {
        toe.command.undo();
      });
      $main_div.append($undo);

      $redo = createMode('<img src="images/tango/edit-redo.png"/>', icon_css, tr("Redo"), function() {
        toe.command.redo();
      });
      $main_div.append($redo);

      $help = createMode('<img src="images/tango/help-browser.png"/>', icon_css, tr("Help"), function() {
        toe.dialog.Help.open();
      });
      $main_div.append($help);

      this.element = $main_div;
      return this.element;
    };

    this.change = function(selection) {
      self.selected = selection;
    };

    var createMode = function(icon, css, title, onClick) {
      var $div = $("<div />");
      $div.css({
        'line-height': '0',
        'margin-top': '5px',
        'margin-right': '5px'
      });
      var $innerdiv = $('<div title="' + title + '"><span style="display: inline-block;"><div style="width: 16px; height: 16px; overflow: hidden; position: relative"></div></span></div>');
      $innerdiv.css({
        'direction': 'ltr',
        'overflow': 'hidden',
        'text-align': 'left',
        'position': 'relative',
        'color': 'rgb(0,0,0)',
        'font-family': 'Arial,sans-serif',
        'font-size': '13px',
        'background': '-moz-linear-gradient(center top, rgb(255,255,255), rgb(230,230,230)) repeat scroll 0% 0% transparent',
        'padding': '4px',
        'border': '1px solid rgb(113, 123, 135)',
        'box-shadow': '0pt 2px 4px rgba(0, 0, 0, 0.4)',
        'font-weight': 'bold',
        'cursor': 'pointer'
      });
      $div.append($innerdiv);
      $icon_div = $(icon);
      $icon_div.css(css);
      $icon_div.on('click', onClick);
      $div.find('span').children('div').append($icon_div);
      return $div;
    };
  },
    
  Area: new function() {

    // area control
    this.visible = true;
    this.editable = true;
    var $ui;
    var $visible_ui;
    var self = this;

    var css_editable = {
      'background-color': 'rgb(240, 240, 240)',
      'font-weight': 'bold'
    };
    var css_readonly = {
      'background-color': 'white',
      'font-weight': 'normal'
    };
    var css_visible = { 'opacity': '1' };
    var css_invisible = { 'opacity': '0.1' };

    // creates control div
    this.html = function() {

      $ui = $('<div title="' + tr("Click to edit layer") + '">' + tr("Area") + '</div>');
      $ui.css({ 'cursor': 'pointer',
                'width': '95px',
                'font-family': 'Arial,sans-serif',
                'font-size': '12px',
                'text-align': 'right',
                'padding-right': '2px',
                'height': '15px'
      });
      if (this.editable) {
        $ui.css(css_editable);
      } else {
        $ui.css(css_readonly);
      }

      $visible_ui = $('<div title="' + tr("Click to toggle visibility") + '"><img src="images/stock-eye-20.png" alt="x" style="margin-top: 3px" /></div>');
      $visible_ui.css({
        'float': 'left',
        'padding-left': '4px',
        'padding-right': '4px'
      });
      $ui.append($visible_ui);
      $ui.click(function() {
        self.toggle_editable();
        poi_control.toggle_editable();
      });
      $visible_ui.click(function(event) {
        self.toggle_visible();
        event.stopPropagation();
      });

      return $ui;
    };

    this.toggle_visible = function() {
      console.log("AreaControl.toggle_visible()");
      if (this.visible) {
        this.visible = false;
        $visible_ui.css(css_invisible);
        areas.hide();
      } else {
        this.visible = true;
        $visible_ui.css(css_visible);
        areas.show();
      }
    };

    this.toggle_editable = function() {
      console.log("AreaControl.toggle_editable()");
      if (this.editable) {
          this.editable = false;
          $ui.css(css_readonly);
          areas.deactivate();
          areas.setClickable(false);
        } else {
          if (!this.visible) {
            // automatically enable visibility, if we are editable
            this.toggle_visible();
          }
          this.editable = true;
          $ui.css(css_editable);
          areas.setClickable(true);
        }
    };
  },

  Poi: new function() {
    // POI control
    this.visible = true;
    this.editable = false;
    var self = this;
    var $ui;
    var $visible_ui;

    var css_editable = {
      'background-color': 'rgb(240, 240, 240)',
      'font-weight': 'bold' };
    var css_readonly = {
      'background-color': 'white',
      'font-weight': 'normal'
    };
    var css_visible = { 'opacity': '1' };
    var css_invisible = { 'opacity': '0.1' };

    this.html = function() {
      $ui = $('<div title="' + tr("Click to edit layer") + '">' + tr("POI") + '</div>');
      $ui.css({
        'cursor': 'pointer',
        'width': '95px',
        'font-family': 'Arial,sans-serif',
        'font-size': '12px',
        'text-align': 'right',
        'padding-right': '2px',
        'height': '15px'
      });
      if (this.editable) {
        $ui.css(css_editable);
      } else {
        $ui.css(css_readonly);
      }

      $visible_ui = $('<div title="' + tr("Click to toggle visibility") + '"><img src="images/stock-eye-20.png" alt="x" style="margin-top: 3px" /></div>');
      $visible_ui.css({
        'float': 'left',
        'padding-left': '4px',
        'padding-right': '4px'
      });

      $ui.prepend($visible_ui);

      $ui.click(function() {
        self.toggle_editable();
        area_control.toggle_editable();
      });
      $visible_ui.click(function(event) {
        self.toggle_visible();
        event.stopPropagation();
      });
      return $ui;
    };

    this.toggle_visible = function() {
      console.log("PoiControl.toggle_visible()");
      if (this.visible) {
        this.visible = false;
        $visible_ui.css(css_invisible);
        pois.hide();
      } else {
        this.visible = true;
        $visible_ui.css(css_visible);
        pois.show();
      }
    };

    this.toggle_editable = function() {
      console.log("PoiControl.toggle_editable()");
      if (this.editable) {
        this.editable = false;
        $ui.css(css_readonly);
        pois.setDraggable(false);
      } else {
        if (!this.visible) {
          // automatically enable visibility, if we are editable
          this.toggle_visible();
        }
        this.editable = true;
        $ui.css(css_editable);
        pois.setDraggable(true);
      }
    };
  },

  // control for importing / exporting files
  Menu: new function() {
    var self = this;

    this.html = function() {
      var $div = $('<div></div>');
      $div.css({ 'cursor': 'pointer',
          'margin': '5px',
          'width': '95px',
          'font-family': 'Arial,sans-serif',
          'font-size': '12px',
          'text-align': 'center',
          'background-color': 'white',
          'border': '2px solid black'
      });
      var $file_ui = $('<div id="file_button" style="padding-left: 30px" title="' +  tr("Click to open / close menu") + '"><span style="float:left">' + tr("Menu") + '</span><span id="file_button_icon" class="ui-icon ui-icon-triangle-1-s" style="float: left;"></span><div style="clear:both"></div></div>');
      $div.append($file_ui);
      $menu_div = $('<div id="file_menu"></div>');
      $menu_div.css({ 'display': 'none' });
      $div.append($menu_div);
      var $open_file_ui = $('<div id="open_file_button" class="file_menu_item" title="' + tr("Import data from file") + '">' + tr("Open file") + '...</div>');
      $menu_div.append($open_file_ui);
      var $save_file_ui = $('<div id="save_file_button" class="file_menu_item" title="' + tr("Export data into file") + '">' + tr("Save file")+ '...</div>');
      $menu_div.append($save_file_ui);
      var $print_ui = $('<div id="print_button" class="file_menu_item">' + tr("Print") + '</div>');
      $menu_div.append($print_ui);
      var $settings_ui = $('<div id="settings_button" class="file_menu_item" title="' + tr("Change settings") + '">' + tr("Settings") + '</div>');
      $menu_div.append($settings_ui);
      var $help_ui = $('<div id="help_button" class="file_menu_item">' + tr("Help") + '</div>');
      $menu_div.append($help_ui);

      $file_ui.click(function() {
        // when user clicks 'File' it gives the dropdown menu
        if ($("#file_menu:visible").length) {
          $("#file_menu").slideUp();
          $("#file_button_icon").removeClass('ui-icon-triangle-1-n').addClass('ui-icon-triangle-1-s');
        } else {
          $("#file_menu").slideDown();
          $("#file_button_icon").removeClass('ui-icon-triangle-1-s').addClass('ui-icon-triangle-1-n');
        }
      });
      $settings_ui.click(function() {
        toe.dialog.Settings.open();
      });
      $open_file_ui.click(function() {
        toe.dialog.OpenFile.open();
      });
      $save_file_ui.click(function() {
        toe.dialog.SaveFile.open();
      });
      $print_ui.click(function() {
        toe.dialog.Print.open();
      });
      $help_ui.click(function() {
        toe.dialog.Help.open();
      });
      return $div;
    };
  }
};


// ------------------------------------------------------------
// Dialog
// ------------------------------------------------------------
toe.dialog = {

  init: function(autoOpen) {  
    this.OpenFile.init(autoOpen);
    this.SaveFile.init();
    this.Print.init();
    this.Help.init();
    this.Settings.init();
    $(".button").button();
  },

  Print: new function() {
    var $div;
    var self = this;

    this.init = function() {
      $div = $('#print_dialog');
      $div.dialog({
        'title': '<span class="ui-icon ui-icon-print" style="float:left; margin-right: 5px;"></span>' + tr('Print'),
        'width': '300px',
        'autoOpen': false,
        'resizable': false,
        'close': function() {
          toe.helper.SelectionBox.hide();
        }
      });
      $('#print_form').on('submit', exportFile);
    };

    this.open = function() {
      $div.dialog('open');
      toe.helper.SelectionBox.show();
      return false;
    };

    this.close = function() {
      $div.dialog('close');
      return false;
    };

    // in export form submit, send values as JSON to server
    var exportFile = function(event, doSubmit) {
      // print only selected area or all if none selected
      if (doSubmit === true) {
        // archive ajax query succeed
        $("#print_areas_json").val(toe.AreaManager.toJSON(true));
        $("#print_pois_json").val('[]');
        $("#print_map_bounds").val(toe.helper.SelectionBox.toString());
        self.close();
        return true;
      }
      else {
        // archive first
        toe.AreaManager.archive().success(function(id) {
          $("#print_archive_id").val(id);
          var archive_url = document.URL.split('?')[0];
          archive_url += '?a=' + id;
          console.log('archive url:', archive_url);
          $("#print_archive_url").val(archive_url);
          $('#print_form').trigger('submit', true);
        });
        return false;
      }
    };
  },

  OpenFile: new function() {
    var $div;

    this.init = function(autoOpen) {
      $div = $('#file_open_dialog');
      $div.dialog({
        'title': '<span class="ui-icon ui-icon-folder-open" style="float:left; margin-right: 5px;"></span>' + tr('Open file'),
        'width': '300px',
        'autoOpen': autoOpen,
        'resizable': false
      });
    };
    this.open = function() { $div.dialog('open');  };
    this.close = function() { $div.dialog('close'); };
  },

  SaveFile: new function() {
    var $div;
    var self = this;

    this.init = function(autoOpen) {
      $div = $('#file_save_dialog');
      $div.dialog({
        'title': '<span class="ui-icon ui-icon-arrowthickstop-1-s" style="float:left; margin-right: 5px;"></span>' + tr('Save file'),
        'width': '300px',
        'autoOpen': false,
        'resizable': false
      });
      $('#export_form').submit(exportFile);
    };

    this.open = function() {
      $div.dialog('open');
    };
    this.close = function() {
      $div.dialog('close');
    };

    // in export form submit, send values as JSON to server
    var exportFile = function() {
      console.log("exporting...");
      //$("#pois_json").val(pois.toJSON());
      $("#areas_json").val(toe.AreaManager.toJSON());
      $("#pois_json").val('[]');
      self.close();
      // disable changed flags from areas and pois
      toe.AreaManager.changed = false;
      //pois.changed = false;
      return true;
    };

  },

  Help: new function() {
    var $div;

    this.init = function(autoOpen) {
      $div = $('#help_dialog');
      $div.dialog({
        'title': '<span class="ui-icon ui-icon-help" style="float:left; margin-right: 5px;"></span>' + tr('Help'),
        'width': '500px',
        'autoOpen': false,
        'resizable': false
      });
    };
    this.open = function() {  $div.dialog('open');  };
    this.close = function() { $div.dialog('close'); };
  },

  Settings: new function() {
    var $div;
    var $self = this;

    this.init = function(autoOpen) {
      $div = $("#settings_dialog");
      $div.dialog({
        'title': '<span class="ui-icon ui-icon-wrench" style="float:left; margin-right: 5px;"></span>' + tr('Settings'),
        'width': '400px',
        'autoOpen': false,
        'resizable': false
      });
    };

    this.save = function() {
      // save settings from the dialog
      console.log("save settings");
      // save settings to cookie with ajax, get response as json
      var settings = $("#settings_form").serialize();
      $.get('settings.php?', settings, function(data) {
        console.log('response: ', data);
        if (data.changed) {
          if (data.redirect_url) {
            // setting changes require reload!
            window.location = data.redirect_url;
          }     
        }
        self.close();
      }, 'json');
      return false;
    };

    this.open = function() {  $div.dialog('open');  };
    this.close = function() { $div.dialog('close'); };
  }
};

// ------------------------------------------------------------
// Commands
// ------------------------------------------------------------
toe.command = {
  undoHistory: [],
  redoHistory: []
};

// run given command and if it succeed, add to undo history
// returns cmd.execute() result
toe.command.run = function(cmd) {
  var ret = cmd.execute();
  if (ret === undefined) {
    // error, command should return object containing success field
    console.log('ERROR: command function did not return correct value');
  }
  if (ret && ret.success) {
    this.undoHistory.push(cmd);
    this.redoHistory = [];
  }
  return ret;
};

toe.command.undo = function() {
  var cmd = this.undoHistory.pop();
  if (cmd) {
    cmd.undo();
    this.redoHistory.push(cmd);
  }
};

toe.command.redo = function() {
  var cmd = this.redoHistory.pop();
  if (cmd) {
    cmd.execute();
    this.undoHistory.push(cmd);
  }
};

// Create area
toe.command.CreateArea = function(latLng) {
  this.latLng = latLng;
  this.area = new toe.Area(null, '', '', [ this.latLng ]);
};

toe.command.CreateArea.prototype.execute = function() {
  this.area.addVertex(this.latLng);
  toe.AreaManager.add(this.area);
  this.area.show();
  return {
    success: true,
    area: this.area
  };
};

toe.command.CreateArea.prototype.undo = function() {
  this.area.deactivate();
  toe.AreaManager.remove(this.area);
};

// Add new vertex
toe.command.AddVertex = function(area, latLng) {
  this.area = area;
  this.latLng = latLng;
};

toe.command.AddVertex.prototype.execute = function() {
  this.area.addVertex(this.latLng);
  return { success: true };
};

toe.command.AddVertex.prototype.undo = function() {
  toe.VertexManager.removeByLatLng(this.latLng, this.area);
};

// Remove vertex
toe.command.RemoveVertex = function(area, latLng) {
  this.area = area;
  this.latLng = latLng;
};

toe.command.RemoveVertex.prototype.execute = function() {
  toe.VertexManager.removeByLatLng(this.latLng, this.area);
  return { success: true };
};

toe.command.RemoveVertex.prototype.undo = function() {
  this.area.addVertex(this.latLng);
};

// Move vertex
toe.command.MoveVertex = function(oldLatLng, newLatLng) {
  this.oldLatLng = oldLatLng;
  this.newLatLng = newLatLng;
};

toe.command.MoveVertex.prototype.execute = function() {
  var vertex = toe.VertexManager.findOne(this.oldLatLng);
  if (vertex) {
    vertex.move(this.newLatLng);
    return { success: true };
  }
  return { success: false };
};

toe.command.MoveVertex.prototype.undo = function() {
  var vertex = toe.VertexManager.findOne(this.newLatLng);
  if (vertex) {
    vertex.move(this.oldLatLng);
  }
};

// Merge vertices
toe.command.MergeVertices = function(area, target_boundary, boundary) {
  this.area = area;
  this.oldLatLng = boundary.latLng
  this.newLatLng = target_boundary.latLng;
};

toe.command.MergeVertices.prototype.execute = function() {
  var oldVertex = toe.VertexManager.findOne(this.oldLatLng);
  var newVertex = toe.VertexManager.findOne(this.newLatLng);
  if (oldVertex && newVertex) {
    //newVertex.merge(oldVertex);
    oldVertex.merge(newVertex);
    return { success: true };
  }
  return { success: false };
};

toe.command.MergeVertices.prototype.undo = function() {
};

// ------------------------------------------------------------
// Handler
// ------------------------------------------------------------
toe.handler = {
  mapClicked: function(event) {
    // this function will be overridden
    /*
  if (area_control.editable) {
    // event when areas are editable
    if (shift_is_down) {
      if (areas.active_area) {
        console.log("ADD TO AREA ", areas.active_area);
        areas.active_area.addBorder(event);
      } else {
        // create a new area
        console.log("CREATE NEW AREA!");
        var area = new Area(areas.get_new_id(), '', '', [ event.latLng ]);
        areas.add(area);
        area.show();
        area.activate();
      }
    } else {
      // normal click outside areas
      console.log("map clicked.", event);
      areas.deactivate();
    }
  } else if (poi_control.editable) {
    // event when POIs are editable
    if (shift_is_down) {
      console.log("CREATE NEW POI");
      pois.create(event.latLng);
    }
  }*/
  },

  mapDoubleClicked: function(event) {
    // this function will be replaced
  }
};


// ------------------------------------------------------------
// AreaManager
// ------------------------------------------------------------
toe.AreaManager = new function() {
  var self = this;
  var click_timeout = null;
  
  this.changed = false;
  this.active_area;
  this.areas = [];
  this.new_id = 1;

  // areas mode activated
  this.enable = function(event) {
    // hijack event listeners here
    toe.handler.mapClicked = self.mapClicked;
    toe.handler.mapDoubleClicked = self.mapDoubleClicked;
  };

  // areas mode disabled
  this.disable = function() {
    if (this.active_area) {
      this.deactivate();
    }
    toe.handler.mapClicked = function() { };
    toe.handler.mapDoubleClicked = function() { };
  };

  this.setReadonly = function(readonly) {
    for (var i = 0; i < this.areas.length; i++) {
      this.areas[i].setReadonly(readonly);
    }
  };

  this.mapClicked = function(event) {
    console.log("AREAS:MAPCLICKED", event);

    if (click_timeout) {
      clearTimeout(click_timeout);
    }
    click_timeout = setTimeout(function() {
      self.deactivate();
    }, toe.options.single_click_timeout);
  };

  this.mapDoubleClicked = function(event) {
    console.log("AREAS:MAP DBL CLICKED", event);
    clearTimeout(click_timeout);
    if (self.active_area) {
      // add new vertex to active area
      console.log("ADD TO AREA ", self.active_area);
      var latLng = toe.map.getEventLatLng(event);
      toe.command.run(new toe.command.AddVertex(self.active_area, latLng));
    } else {
      // create a new area
      console.log("CREATE NEW AREA!", toe.map.getEventLatLng(event));
      var latLng = toe.map.getEventLatLng(event);
      var ret = toe.command.run(new toe.command.CreateArea(latLng));
      if (ret.success) {
        ret.area.activate();
      }
    }
  };

  this.add = function(area) {
    if (this.findById(area.id)) {
      console.log("id " + area.id + " is reserved, generating a new id for area");
      area.id = this.getNewId();
    }
    this.areas.push(area);
    this.changed = true;
  };

  // removes all areas
  this.removeAll = function() {
    var tmp_areas = [];
    var i;
    for (i = 0; i < this.areas.length; i++) {
      tmp_areas.push(this.areas[i]);
    }
    for (i = 0; i < tmp_areas.length; i++) {
      this.remove(tmp_areas[i]);
    }
  };

  // remove given area
  this.remove = function(area) {
    for (var i = 0; i < this.areas.length; i++) {
      if (this.areas[i] == area) {
        area.remove();
        this.areas.splice(i, 1);
        this.changed = true;
        return true;
      }
    }
    return false;
  };

  // deactive the active area, if any
  this.deactivate = function() {
    if (this.active_area) {
      this.active_area.deactivate();
    }
  };

  // returns area with given id or null
  this.findById = function(id) {
    for (var i in this.areas) {
      if (this.areas[i].id == id)
        return this.areas[i];
    }
    return null;
  };

  this.getNewId = function() {
    var time = new Date();
    var new_id = "" + time.getTime();
    return "-" + new_id.substring(new_id.length - 8);
  };

  // this function is called when user clicks Save on AreaInfoWindow
  this.saveInfo = function(event) {
    var id = $("#area_id").val();
    var area = this.findById(id);
    if (area) {
      var number = $("#area_number").val();
      var name = $("#area_name").val();
      area.number = number;
      area.name = name;
      area.changed = true;
      toe.map.infoWindow.hide();
    }
    console.log("area_id: " + id);
    console.log(event);
    event.stopPropagation();
    this.changed = true;
    return false;
  };

  // show all areas
  this.show = function() {
    for (var i in this.areas) {
      this.areas[i].show();
    }
  };

  // hide all areas
  this.hide = function() {
    // first deactive any active area
    this.deactivate();
    for (var i in this.areas) {
      this.areas[i].hide();
    }
  };

  // serialize all areas or only selected area to JSON,
  // made for sending areas to server
  this.toJSON = function(onlySelectedArea) {
    var areas = this.areas;
    if (onlySelectedArea && toe.AreaManager.active_area) {
      areas = [ toe.AreaManager.active_area ];
    }
    var json = toe.util.arrayToJSON(areas);
    console.log("export areas: ", json);
    return json;
  };

  // import areas from JSON data
  // returns integer of how many AREAs imported
  this.importJSON = function(data) {
    var c = 0;
    for (var i in data) {
      var area = data[i];
      var path = [];
      var lat;
      var lng;
      for (var j in area.path) {
          lat = area.path[j][0];
          lng = area.path[j][1];
          path.push(new toe.map.LatLng(lat, lng));
      }
      // XXX the area-missing-number&name bug is here
      this.add(new toe.Area(area.id, area.number, area.name, path));
      c++;
    }
    if (toe.control.Area.visible) {
      this.show();
    }

    return c;
  };

  // returns bounds of all areas
  this.getBounds = function() {
    var bounds = new toe.map.LatLngBounds();
    for (var i in this.areas) {
      bounds.union(this.areas[i].polygon.getBounds());
    }
    return bounds;
  };

  // sets all areas clickable or not
  this.setClickable = function(value) {
    for (var i in this.areas) {
      this.areas[i].polygon.setOptions({ clickable: value });
    }
  };

  this.archive = function() {
    var jqxhr = $.post('archive/', {
      data: this.toJSON(true)
    });
    return jqxhr;
  };
};

// ------------------------------------------------------------
// VertexManager
// ------------------------------------------------------------
toe.VertexManager = new function() {
  var self = this;
  this.vertices = [];

  // returns array of vertices by given latLng
  this.find = function(latLng) {
    var result = [];
    for (var i = 0; i < this.vertices.length; i++) {
      if (this.vertices[i].latLng.equals(latLng))
        result.push(this.vertices[i]);
    }
    return result;
  };

  /**
   * Returns one Vertex by given latLng or null if not found.
   */
  this.findOne = function(latLng) {
    var verts = this.find(latLng);
    if (verts.length) {
      return verts[0];
    }
    return false;
  };

  this.add = function(latLng, area) {
    // see if this is already exists in vertices array
    console.log("VertexManager.add(", latLng, area, ")");
    var vertices_arr = this.find(latLng);
    var vertex;
    if (!vertices_arr.length) {
      // create a new vertex
      vertex = new toe.Vertex(latLng);
      this.vertices.push(vertex);
    }
    else {
      vertex = vertices_arr[0];
    }
    // link given area to vertex
    vertex.linkTo(area);
    return vertex;
  };

  // if area given, remove only given area from vertex
  // else remove whole vertex (remove vertices that don't belong
  // to any area anyway)
  this.removeByLatLng = function(latLng, area) {
    console.log("VertexManager.remove(", latLng, area, ")");
    var vertices_arr = this.find(latLng);
    for (var i = 0; i < vertices_arr.length; i++) {
      this.remove(vertices_arr[i], area);
    }
  };
  /**
   * Remove given vertex.
   * If area given, remove only given area from vertex.
   * When vertex does not belong to any area anymore,
   * it can be removed.
   */
  this.remove = function(vertex, area) {
    console.log("VertexManager.remove(", vertex, area, ")");
    vertex.unlink(area);
    if (vertex.empty()) {
      console.log("vertex is EMPTY!");
      // we no longer need this vertex, last link to area was gone
      for (var i = 0; i < this.vertices.length; i++) {
        if (this.vertices[i] == vertex) {
          this.vertices.splice(i, 1); // remove this from array
          delete vertex;
          break;
        }
      }
    }
  };

  // returns true if merged two vertices having same position
  // or false if no merging happened
  this.mergeVertex = function(vertex) {
    for (var i = 0; i < this.vertices.length; i++) {
      var other_vertex = this.vertices[i];
      if (vertex == other_vertex) continue;
      if (vertex.latLng.equals(other_vertex.latLng)) {
        for (var j = 0; j < other_vertex.areas.length; j++) {
          // copy areas from other vertex
          vertex.areas.push(other_vertex.areas[j]);
        }
        //  remove vertex
        //this.remove(other_vertex);
        this.vertices.splice(i, 1);
        delete other_vertex;
        return true; // merged 
      }
    }
    return false; // not merged
  };
}; // VertexManager


// ------------------------------------------------------------
// Vertex
// ------------------------------------------------------------
toe.Vertex = function(latLng) {
  this.latLng = latLng;
  this.areas = []; // array of areas into which this belongs
  this.marker = null;
}

// move vertex to given latLng
// if area is not given, move this vertex for all areas it
// is assigned to
toe.Vertex.prototype.move = function(latLng, area) {
  for (var i in this.areas) {
    if (!area || (area && this.areas[i] == area)) {
      if (this.areas[i].polygon.changePath(this.latLng, latLng)) {
        this.areas[i].changed = true;
      }
    }
  } // for
  this.latLng = latLng; //  update our information at last
  if (this.marker) {
    // move marker too
    this.marker.setToeLatLng(this.latLng);
  }
};


/**
 * Links vertex to given area.
 * If area was new for this vertex, returns true.
 */
toe.Vertex.prototype.linkTo = function(area) {
  if (!this.hasArea(area)) {
    // given area was new for this vertex
    this.areas.push(area);
    return true;
  }
  return false;
};

// if area is not given, remove this vertex from all areas
// it is assigned to
toe.Vertex.prototype.unlink = function(area) {
  console.log("vertex.remove(", area, ")");
  var new_areas = [];
  for (var i = 0; i < this.areas.length; i++) {
    if (!area || (area && this.areas[i] == area)) {
      if (this.areas[i].polygon.removeFromPath(this.latLng)) {
        this.areas[i].changed = true;
      }
      /*
      var path = this.areas[i].polygon.getPath();
      for (var j = 0; j < path.getLength(); j++) {
        if (path.getAt(j).equals(this.latLng)) {
          path.removeAt(j); // update polygon path
          this.areas[i].changed = true;
          break; // go to next area
        }
      }*/
    }
    else {
      // preserve this area
      new_areas.push(this.areas[i]);
    }
  } // for
  // replace areas, now given area should be missing
  // (or all areas)
  this.areas = new_areas;
  // remove marker if visible
  this.removeMarker();
};

// returns true if this vertex no longer is used
toe.Vertex.prototype.empty = function() {
  return (this.areas.length == 0);
};

toe.Vertex.prototype.findNearVertex = function(latLng, range) {
  //var point = overlay.getProjection().fromLatLngToContainerPixel(this.latLng);
  console.log("find near", latLng);
  var point = latLng.toPoint();
  for (var i = 0; i < toe.VertexManager.vertices.length; i++) {
    var vertex = toe.VertexManager.vertices[i];
    if (vertex == this) continue; // skip over this
    //var vertex_point = overlay.getProjection().fromLatLngToContainerPixel(vertex.latLng);
    var vertex_point = vertex.latLng.toPoint();
    if (toe.util.pointDistance(point, vertex_point) <= range) {
      return vertex;
    }
  }
  return null;
};

/**
 * Merges given vertex into this vertex.
 * Given vertex should have same latLng.
 * Removes given vertex.
 */
toe.Vertex.prototype.merge = function(vertex) {
  console.log('Vertex.merge()', this.areas);
  vertex.move(this.latLng);
  var unlinkAreas = [];
  // add areas
  for (var i = 0; i < vertex.areas.length; i++) {
    var added = this.linkTo(vertex.areas[i]);
    if (!added) {
      unlinkAreas.push(vertex.areas[i]);
    }
  }
  for (var i = 0; i < unlinkAreas.length; i++) {
    vertex.unlink(unlinkAreas[i]);
  }
  vertex.areas = [];
  toe.VertexManager.remove(vertex);
  this.showMarker();
};

/**
 * Returns true if vertex has given area.
 */
toe.Vertex.prototype.hasArea = function(area) {
  for (var i = 0; i < this.areas.length; i++) {
    if (this.areas[i] == area)
      return true;
  }
  return false;
};

/**
 * Shows AreaVertexMarker.
 */
toe.Vertex.prototype.showMarker = function() {
  if (this.marker) {
    // this vertex has already marker
    return false;
  }

  this.marker = new toe.map.AreaVertexMarker({
    position: this.latLng,
    title: tr('Drag to edit, dbl click to remove')
  });

  var self = this;
  this.marker.setDragEnd(function(event) {
    var latLng = this.getToeLatLng();
    var merged = false;
    if (toe.options.snap_vertices > 0) {
      // snap to another vertex within some range
      var vertex_near = self.findNearVertex(latLng, toe.options.snap_vertices);
      if (vertex_near) {
        toe.command.run(new toe.command.MergeVertices(toe.AreaManager.active_area, self, vertex_near));
        merged = true;
      }
    }
    if (!merged) {
      toe.command.run(new toe.command.MoveVertex(self.latLng, latLng));
    }
  });

  // marker delete functionality
  this.marker.setDoubleClick(function(event) {
    toe.command.run(new toe.command.RemoveVertex(toe.AreaManager.active_area, self.latLng));
  });
};

/**
 * Removes AreaVertexMarker.
 */
toe.Vertex.prototype.removeMarker = function() {
  if (this.marker) {
    this.marker.remove();
    delete this.marker;
    this.marker = null;
  }
};

// ------------------------------------------------------------
// Area
// ------------------------------------------------------------
toe.Area = function(id, number, name, path) {
  this.id = id || toe.AreaManager.getNewId();
  this.number = number;
  this.name = name;
  this.edit_mode = false;
  this.changed = false;
  this.changed = false;
  this.click_timeout = null;

  var area = this;

  this.activated_options = {
    strokeColor: "#FF0000",
    strokeOpacity: 0.8,
    strokeWeight: 2,
    fillColor: "#FF0000",
    fillOpacity: 0.35,
    clickable: true
  };
  this.deactivated_options = {
    strokeColor: "#000000",
    strokeOpacity: 0.8,
    strokeWeight: 1,
    fillColor: "#000000",
    fillOpacity: 0.1,
    clickable: true
  };
  this.readonly_options = {
    strokeColor: "#FF0000",
    strokeOpacity: 0.8,
    strokeWeight: 2,
    fillColor: "#666666",
    fillOpacity: 0.1,
    clickable: false
  };

  this.polygon = new toe.map.Polygon({
    paths: path,
    clicked: function(event) {
      area.clicked(event);
    },
    dblclicked: function(event) {
      area.doubleClicked(event);
    }
  });
  this.polygon.setColor(this.deactivated_options);

  // use vertices array
  for (var i = 0; i < path.length; i++) {
    var latLng = path[i];
    toe.VertexManager.add(latLng, area);
  }
};

// method functions 
toe.Area.prototype.show = function() { this.polygon.show(); };
toe.Area.prototype.hide = function() { this.polygon.hide(); };

toe.Area.prototype.clicked = function(event) {
  console.log("area " + this.name + " clicked.", event);
  if (toe.control.Mode.selected == toe.control.Mode.AREA) {
    var self = this;
    this.click_timeout = setTimeout(function() {
      if (!self.edit_mode) {
        self.activate();
      } else {
        self.showInfoWindow();
      }
    }, toe.options.single_click_timeout);
  }
  else if (toe.control.Poi.editable) {
    if (shift_is_down) {
      console.log("CREATE NEW POI");
      pois.create(event.latLng);
    }
  }
};

toe.Area.prototype.doubleClicked = function(event) {
  console.log("area " + this.name + " clicked.", event);
  clearTimeout(this.click_timeout);
  if (toe.control.Mode.selected == toe.control.Mode.AREA) {
    if (toe.AreaManager.active_area) {
      var latLng = toe.map.getEventLatLng(event);
      toe.command.run(new toe.command.AddVertex(toe.AreaManager.active_area, latLng));
    }
  }
};

toe.Area.prototype.activate = function() {
  console.log("area.activate");
  // deactivate the previous active
  toe.AreaManager.deactivate();
  this.edit_mode = true;
  toe.AreaManager.active_area = this;

  this.polygon.setColor(this.activated_options);
  //if (area_control.editable) {
  this._showMarkers();
};

/**
 * Draws markers again.
 */
toe.Area.prototype.refreshMarkers = function() {
  this._removeMarkers();
  this._showMarkers();
};

/**
 * Show markers.
 */
toe.Area.prototype._showMarkers = function() {
  var vertices = this.getVertices();
  for (var i = 0; i < vertices.length; i++) {
    vertices[i].showMarker();
  }
};

/**
 * Remove markers
 */
toe.Area.prototype._removeMarkers = function() {
  var vertices = this.getVertices();
  for (var i = 0; i < vertices.length; i++) {
    vertices[i].removeMarker();
  }
};

toe.Area.prototype.deactivate = function() {
  console.log("area.deactivate");
  this.edit_mode = false;
  toe.AreaManager.active_area = null;

  this.polygon.setColor(this.deactivated_options);
  this._removeMarkers();

  if (!this.isArea()) {
    // this area is incomplete, remove as unneeded
    toe.AreaManager.remove(this);
  }
};

toe.Area.prototype.setReadonly = function(readonly) {
  if (readonly) {
    this.polygon.setColor(this.readonly_options);
  } else {
    this.deactivate();
  }
};

// adds a new vertex for area
toe.Area.prototype.addVertex = function(latLng) {
  console.log("add new vertex: ", this.name, latLng);

  var path = this.polygon.getToePath();
  for (var i = 0; i < path.length; i++) {
    if (path[i].equals(latLng)) {
      // we don't allow to add same latLng again
      return false;
    }
  }

  // edit polygon path
  // find the vertex
  var idx = toe.util.getNearestVertex(this.polygon.getToePath(), latLng)
  this.polygon.addToPath(idx, latLng);

  // see if this is already exists in vertices array
  //var cmd = new toe.command.Addvertex(latLng, this);
  //cmd.execute();
  var vertex = toe.VertexManager.add(latLng, this);
  if (this.isActive()) {
    vertex.showMarker();
  }
};

/**
 * Returns array of Vertex objects which belong to this area.
 */
toe.Area.prototype.getVertices = function() {
  var vertices = [];
  var path = this.polygon.getToePath();
  for (var i = 0; i < path.length; i++) {
    var verts = toe.VertexManager.find(path[i], this);
    for (var j = 0; j < verts.length; j++) {
      vertices.push(verts[j]);
    }
  }
  return vertices;
};

// remove this area and all belonging to it
toe.Area.prototype.remove = function() {
  this.polygon.hide();
  this._removeMarkers();
  var path = this.polygon.getToePath();
  for (var i = 0; i < path.length; i++) {
    toe.VertexManager.removeByLatLng(path[i], this);
  }
  toe.AreaManager.active_area = null;
};

// shows a balloon of area info
toe.Area.prototype.showInfoWindow = function() {
  var contentString = '<div class="infowindow" id="area_infowindow"><form action="" method="post" id="area_form">' +
    '<input type="hidden" id="area_id" value="' + escape(this.id) + '" />' +
    '<table>' +
    '<tr><td></td><td>' +
    '<div class="area-functions">' +
    //'<a href="javascript:" id="area_print">' + tr("Print") + '</a> | <a href="javascript:" id="area_delete">' + tr("Delete") + '</a>' +
    //'<a href="javascript:" id="area_delete">' + tr("Delete") + '</a>' +
    '</div>' +
    '</td></tr>' +
    '<tr><td>' + tr("Number") + ':</td><td><input type="text" id="area_number" value="' + this.number + '" class="field first-focus" /></td></tr>' +
    '<tr><td>' + tr("Name") + ':</td><td><input type="text" id="area_name" value="' + this.name + '" class="field" /></td></tr>' +
    '<tr><td></td><td><input type="submit" id="area_submit" value="' + tr("Save") + '" onclick="return false;" />' +
    '<button id="area_delete">' + tr("Delete") + '</button>' +
    '</td></tr>' +
    '</table></form></div>';
    //'<script type="text/javascript">console.log("haha");; $(document).ready(function() { console.log("ready"); });</script>';
  var bounds = this.polygon.getBounds();

  var self = this;
  toe.map.infoWindow.show({
    content: contentString,
    position: bounds.getCenter(),
    ready: function() {
      $('.first-focus').focus();
      $('#area_submit').off('click').on('click', function(event) {
        toe.AreaManager.saveInfo(event);
        return false;
      });
      $('#area_print').off('click').on('click', function(event) {
        console.log("print this?");
      });
      $('#area_delete').off('click').on('click', function(event) {

        if (confirm(tr('area_removal_confirm'))) {
          if (toe.AreaManager.remove(self)) {
            toe.map.infoWindow.hide(); // shut info window
          }
        }
        return false;
      });
    }
  });
};

// serialize this area to JSON, for posting to server
toe.Area.prototype.toJSON = function() {
  var json = '{';
  json += '"id":"' + this.id + '",';
  json += '"number":"' + toe.util.encodeJSON(this.number) + '",';
  json += '"name":"' + toe.util.encodeJSON(this.name) + '",';
  json += '"path":[';
  var path = this.polygon.getToePath();
  for (var i = 0; i < path.length; i++) {
    if (i > 0) {
      json += ",";
    }
    json += path[i].toJSON();
  }
  json += ']';
  json += '}';
  return json;
};

// return array of POIs that are inside the area
toe.Area.prototype.getPOIs = function() {
  var area_pois = [];
  for (var i in pois.pois) {
    var poi = pois.pois[i];
    if (this.polygon.containsLatLng(poi.getPosition())) {
      area_pois.push(poi);
    }
  }
  return area_pois;
};

/**
 * Returns true if area has at least 3 points.
 */
toe.Area.prototype.isArea = function() {
  return (this.polygon.getToePath().length > 2);
};

/**
 * Returns true if this area is active.
 */
toe.Area.prototype.isActive = function() {
  return (toe.AreaManager.active_area == this);
};

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

toe.helper = {
  SelectionBox: new function() {

    var box = null;
    this.show = function() {
      if (!box) {
        box = new toe.map.Rectangle({
          editable: true
        });
      }
      var bounds = toe.map.getBounds();
      box.show(bounds.resize(0.85));
    };

    this.hide = function() {
      box.hide();
    };

    this.getBounds = function() {
      return box.getBounds();
    };

    this.toString = function() {
      return box.toString();
    };
  }
};

// ------------------------------------------------------------
// CurrentPositionTracker
// ------------------------------------------------------------
toe.CurrentPositionTracker = new function() {
  var self = this;
  var enabled = false;
  var marker = null;
  var watch_id = null;

  var handlePosition = function(position) {
    var pos = new toe.map.LatLng(position.coords.latitude,
                                 position.coords.longitude);
    self.setPosition(pos, position.coords.accuracy);
  };

  // start tracking of current position
  this.start = function() {
    // try HTML5 geolocation
    if (navigator.geolocation) {
      enabled = true;
      // start main loop
      watch_id = navigator.geolocation.watchPosition(handlePosition, function() {
        // error with tracking
        enabled = false;
      }, {
        // PositionOptions
        enableHighAccuracy: true
      });
    } else {
      // browser doesn't support geolocation
      enabled = false;
    }
  };

  // stop tracking of current position
  this.stop = function() {
    if (watch_id) {
      navigator.geolocation.clearWatch(watch_id);
    }
    enabled = false;
  };

  this.setPosition = function(pos, accuracy) {
    if (marker) {
      marker.setToeLatLng(pos);
      marker.setToeRadius(accuracy);
    } else {
      marker = new toe.map.CurrentPositionMarker({
        position: pos,
        radius: accuracy
      });
    }
  };

  this.isEnabled = function() { return enabled; };
};

// PRIVATE METHODS
// ---------------
toe.util = {
  encodeJSON: function(str) {
    if (!str) return '';
    var encoded = str.replace(/\n/g, "\\n");
    encoded = encoded.replace(/\"/g, "\\\"");
    //encoded = encoded.replace(/\'/g, "\\\'");
    return encoded;
  },

  // very simple function to create JSON array
  // element of array must have method .toJSON()
  arrayToJSON: function(arr) {
    var json = "[";
    for (var i in arr) {
      if (i > 0) {
        json += ",";
      }
      json += arr[i].toJSON();
    }
    json += "]";
    return json;
  },

  // -----------------------
  // math functions

  // returns index of vertex in path where c is nearest
  getNearestVertex: function(path, c) {
    var p1, p2;
    var smallestDistance;
    for (var i = 0; i < path.length; i++) {
      p1 = path[i];
      if (i == 0) p2 = path[path.length - 1];
      else p2 = path[i-1];

      var distance = this.distanceFromVertex(p1, p2, c);
      //console.log("distance: ", distance);
      if (!smallestDistance) smallestDistance = [ i, distance ];
      else if (distance < smallestDistance[1]) {
        smallestDistance = [ i, distance ];
      }
    }
    if (smallestDistance)
      return smallestDistance[0];  
    return 0;
  },

  distanceFromVertex: function(p1, p2, c) {
    // calc distance by measuring travel: (p1 - c - p2) - (p1 - p2)
    var ab = this.latLngDistance(p1, p2);
    var distance = this.latLngDistance(p1, c) + this.latLngDistance(p2, c) - ab;
    return distance;
  },

  // count distance in coordinates a2 = b2 + c2
  latLngDistance: function(a, b) {
    var x = a.getLng() - b.getLng();
    var y = a.getLat() - b.getLat();
    var d = Math.sqrt(Math.pow(x,2) + Math.pow(y,2));
    return d;
  },

  pointDistance: function(a, b) {
    // pythagorean theorem
    var x = a.x - b.x;
    var y = a.y - b.y;
    var d = Math.sqrt(Math.pow(x,2) + Math.pow(y,2));
    return d;
  },

};
