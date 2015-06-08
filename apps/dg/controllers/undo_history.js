// ==========================================================================
//                      DG.UndoHistory
//
//  The controller for managing undo/redo.
//
//  Based on concepts from Fathom, Ivy (https://github.com/concord-consortium/building-models/blob/master/src/code/utils/undo-redo.coffee),
//    and undo.js (https://github.com/jzaefferer/undo/blob/master/undo.js)
//
//  Author:   Aaron Unger
//
//  Copyright (c) 2015 by The Concord Consortium, Inc. All rights reserved.
//
//  Licensed under the Apache License, Version 2.0 (the "License");
//  you may not use this file except in compliance with the License.
//  You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
//  Unless required by applicable law or agreed to in writing, software
//  distributed under the License is distributed on an "AS IS" BASIS,
//  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//  See the License for the specific language governing permissions and
//  limitations under the License.
// ==========================================================================


/** @class

  @extends SC.Object
*/
DG.UndoHistory = SC.Object.create((function() {
/** @scope DG.UndoHistory.prototype */
  return {
    _undoStack: [],
    _redoStack: [],

    _executeInProgress: false,

    execute: function(command) {
      this._wrapAndRun(command.execute); // TODO Probably catch errors here... ?

      if (command.isUndoable) {
        this._undoStack.push(command);
        // Since we're not using set/get to access the stacks, notify changes manually.
        this.notifyPropertyChange('_undoStack');
      } else {
        // We've hit an not-undoable command, so clear our undo stack
        this._clearUndo();
      }
      // Clear the redo stack every time we add a new command. We *don't* support applying changes
      // from a different change tree to the current tree.
      this._clearRedo();
    },

    canUndo: function() {
      return this._undoStack.length > 0;
    }.property('_undoStack'),

    nextUndoCommand: function() {
      if (this._undoStack.length === 0) {
        return null;
      }
      return this._undoStack[this._undoStack.length-1];
    }.property('_undoStack'),

    undo: function() {
      var command = this._undoStack.pop();
      this._wrapAndRun(command.undo); // TODO Probably catch errors here... ?
      this._redoStack.push(command);

      // Since we're not using set/get to access the stacks, notify changes manually.
      this.notifyPropertyChange('_undoStack');
      this.notifyPropertyChange('_redoStack');
    },

    canRedo: function() {
      return this._redoStack.length > 0;
    }.property('_redoStack'),

    nextRedoCommand: function() {
      if (this._redoStack.length === 0) {
        return null;
      }
      return this._redoStack[this._redoStack.length-1];
    }.property('_redoStack'),

    redo: function() {
      var command = this._redoStack.pop();
      this._wrapAndRun(command.redo); // TODO Probably catch errors here... ?
      this._undoStack.push(command);

      // Since we're not using set/get to access the stacks, notify changes manually.
      this.notifyPropertyChange('_undoStack');
      this.notifyPropertyChange('_redoStack');
    },

    documentWasChanged: function() {
      if (this._executeInProgress) { return; } // This is fine, we're doing it as part of a Command action

      // Otherwise, this wasn't part of a command, so this change is not able to be undone.
      // Clear the stacks
      this._clearUndo();
      this._clearRedo();
    },

    // Wraps a command in a way so that documentWasChanged calls don't clear the stack
    _wrapAndRun: function(cmd) {
      this._executeInProgress = true;
      try {
        cmd();
      } finally {
        this._executeInProgress = false;
      }
    },

    _clearUndo: function() {
      this._undoStack.length = 0;
      this.notifyPropertyChange('_undoStack');
    },

    _clearRedo: function() {
      this._redoStack.length = 0;
      this.notifyPropertyChange('_redoStack');
    }

  }; // return from function closure
})()); // function closure

DG.Command = SC.Object.extend((function() {
  return {

    // Metadata to define
    name: null,
    undoString: null,
    redoString: null,

    isUndoable: true,

    // Functions to override
    execute: function() {},
    undo: function() {},
    redo: function() {
      this.execute();
    }

  }; // return from function closure
})()); // function closure