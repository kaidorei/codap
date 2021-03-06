// ==========================================================================
//                            DG.PlotBackgroundView
//
//  Author:   William Finzer
//
//  Copyright (c) 2014 by The Concord Consortium, Inc. All rights reserved.
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

sc_require('components/graph/utilities/graph_drop_target');
sc_require('views/raphael_base');

/** @class  DG.PlotBackgroundView - The base class view for a plot.

  @extends DG.RaphaelBaseView
*/
DG.PlotBackgroundView = DG.RaphaelBaseView.extend( DG.GraphDropTarget,
/** @scope DG.PlotBackgroundView.prototype */ 
{
  autoDestroyProperties: [ '_backgroundForClick' ],

  displayProperties: ['xAxisView.model.lowerBound', 'xAxisView.model.upperBound',
                      'yAxisView.model.lowerBound', 'yAxisView.model.upperBound',
                      'xAxisView.model.attributeDescription.attributeStats.categoricalStats.numberOfCells',
                      'yAxisView.model.attributeDescription.attributeStats.categoricalStats.numberOfCells',
                      'graphModel.plotBackgroundColor', 'graphModel.plotBackgroundOpacity'],

  classNames: 'dg-plot-view'.w(),
  classNameBindings: ['graphModel.isTransparent:dg-plot-view-transparent'],

  /**
   * @property {DG.GraphModel}
   */
  graphModel: null,

  /**
    @property { DG.AxisView}
  */
  xAxisView: null,
  /**
    @property { DG.AxisView }
  */
  yAxisView: null,

  /**
   * Dynamically set to true/false during episodes such as marquee select
   * @property {Boolean}
   */
  tempDisallowDataTips: false,

  // Private properties
  _backgroundForClick: null,  // We make this once and keep it sized properly.

  colorDidChange: function() {
    var tStoredColor = this.getPath('graphModel.plotBackgroundColor') || 'white',
        tStoredOpacity = this.getPath('graphModel.plotBackgroundOpacity'),
        tNewColor = tStoredColor ? SC.Color.from( tStoredColor) : null;
    if( !tNewColor)
        return;
    if( !SC.none(tStoredOpacity))
        tNewColor.set('a', tStoredOpacity);
    this.set('backgroundColor', tNewColor.get('cssText'));
  }.observes('.graphModel.plotBackgroundColor', '.graphModel.plotBackgroundOpacity'),

  /**
   * Additional setup after creating the view
   */
  didCreateLayer:function () {
    var tGraphView = this.get( 'parentView' );
    sc_super();
    tGraphView.get( 'plotViews' ).forEach( function ( iPlotView ) {
      iPlotView.didCreateLayer();
    } );
    tGraphView.drawPlots();
  },

  init: function() {
    sc_super();
    this.set('backgroundColor', 'white');
    this.colorDidChange();
  },

  /**
   * Subclasses can override calling sc_super() and then adding layers at will.
   */
  initLayerManager: function() {
    sc_super();

    // if base class wasn't able to initialize the layer manager, e.g. because we
    // don't have paper yet, then this.get('layerManager') leads to an infinite loop.
    // For now, we avoid the infinite loop by testing the private _layerManager.
    if (!this._layerManager) return;

    var ln = DG.LayerNames;
    this.get('layerManager').addNamedLayer( ln.kBackground )
                  .addNamedLayer( ln.kGrid )
                  .addNamedLayer( ln.kIntervalShading )
                  .addNamedLayer( ln.kClick )
                  .addNamedLayer( ln.kGhost )
                  .addNamedLayer( ln.kConnectingLines )
                  .addNamedLayer( ln.kPoints )
                  .addNamedLayer( ln.kSelectedPoints )
                  .addNamedLayer( ln.kAdornments )
                  .addNamedLayer( ln.kDataTip );
  },

  /**
    We just have the background to draw. But it has a marquee behavior and a background click
    behavior to install.
  */
  doDraw: function doDraw() {
    var this_ = this,
        tFrame = this.get('frame' ),
        tXAxisView = this.get('xAxisView'),
        tYAxisView = this.get('yAxisView'),
        tBackgroundLayer = this.getPath('layerManager.' + DG.LayerNames.kBackground ),
        tGridLayer = this.getPath('layerManager.' + DG.LayerNames.kGrid),
        tBothWaysNumeric =( tXAxisView.get('isNumeric') && tYAxisView.get('isNumeric')),
        tY2AttributeID = this.getPath('graphModel.dataConfiguration.y2AttributeID'),
        tHasY2Attribute = tY2AttributeID && (tY2AttributeID !== DG.Analysis.kNullAttribute),
        tMarquee,
        tLastRect,
        tStartPt,
        tBaseSelection = [];//,
//        tToolTip;

    function createRulerLines() {

      function vLine( iX, iColor, iWidth) {
        tGridLayer.push(
          this_._paper.line( iX, tFrame.height, iX, 0)
                .attr( { stroke: iColor, 'stroke-width': iWidth }));
      }

      function hLine( iY, iColor, iWidth) {
        tGridLayer.push(
          this_._paper.line( 0, iY, tFrame.width, iY)
                  .attr( { stroke: iColor, 'stroke-width': iWidth }));
      }

      function drawVRule( iValue, iX) {
        vLine( iX, DG.PlotUtilities.kRuleColor, DG.PlotUtilities.kRuleWidth);
      }

      function drawHRule( iValue, iY) {
        hLine( iY, DG.PlotUtilities.kRuleColor, DG.PlotUtilities.kRuleWidth);
      }

      function drawZeroLines() {

        function drawLine( iAxisView, iDrawingFunc) {
          var tZeroCoord = iAxisView.get('zeroPixel');
          if( tZeroCoord && !iAxisView.get('isDateTime'))
            iDrawingFunc( tZeroCoord, DG.PlotUtilities.kZeroLineColor, DG.PlotUtilities.kZeroLineWidth);
        }

        drawLine( tXAxisView, vLine);
        drawLine( tYAxisView, hLine);
      }

      if( tBothWaysNumeric ) {
        tXAxisView.forEachTickDo( drawVRule);
        if( !tHasY2Attribute)
          tYAxisView.forEachTickDo( drawHRule);
        drawZeroLines();
      } // else suppress numeric grid lines for dot plots (numeric only on one axis), because it interferes with mean/median lines, etc.
    } // createRulerLines

    function startMarquee( iWindowX, iWindowY, iEvent) {
      // It's a little weird to put this altKey handling here because it makes the assumption
      //  that all subclasses have a different meaning for altKey dragging.
      if( iEvent.altKey)
        return; // Alt key has a different meaning

      this_.set('tempDisallowDataTips', true);

      if( iEvent.shiftKey)
        tBaseSelection = this_.getPath( 'graphModel.selection').toArray();
      // Only deselect everything if we are the currently selected component
      else if(DG.ComponentView.findComponentViewParent(this_) === DG.mainPage.docView.get('selectedChildView')) {
        SC.run(function(){
          this_.get('graphModel').selectAll( false);
        });
      }
      tStartPt = DG.ViewUtilities.windowToViewCoordinates(
                    { x: iWindowX, y: iWindowY }, this_);
      tMarquee = this_._paper.rect( tStartPt.x, tStartPt.y, 0, 0)
              .attr( { fill: DG.PlotUtilities.kMarqueeColor,
                    stroke: DG.RenderingUtilities.kTransparent });
      tLastRect = {x: tStartPt.x, y: tStartPt.y, width: 0, height: 0};
      this_.getPath('layerManager.' + DG.LayerNames.kAdornments ).push( tMarquee);
      this_.get('parentView' ).prepareToSelectPoints( );
    }

    function continueMarquee( idX, idY) {
      if( SC.none( tMarquee))
        return; // Alt key was down when we started

      var tX = (idX > 0) ? tStartPt.x : tStartPt.x + idX,
        tY = (idY > 0) ? tStartPt.y : tStartPt.y + idY,
        tWidth = Math.abs( idX),
        tHeight = Math.abs( idY),
        tRect = { x: tX, y: tY, width: tWidth, height: tHeight };
      tMarquee.attr( tRect);
      SC.run(function(){
        this_.get('parentView').selectPointsInRect( tRect, tBaseSelection, tLastRect);
      });
      tLastRect = tRect;
    }

    function endMarquee( idX, idY) {
      this_.set('tempDisallowDataTips', false);

      if( SC.none( tMarquee))
        return; // Alt key was down when we started

      this_.getPath('layerManager').removeElement( tMarquee);
      tMarquee = null;
      tBaseSelection = [];

      var tNumCases = this_.getPath( 'graphModel.casesController.selection.length');
      if( tNumCases > 0)  // We must have something > 0
        DG.logUser("marqueeSelection: %@", tNumCases);
      SC.run(function(){
        this_.get('parentView').completeSelection();
      });
    }

    function showCursor( iEvent) {
      if( iEvent.altKey) {
        var magnifyPlusCursorUrl = static_url('cursors/MagnifyPlus.cur'),
            magnifyMinusCursorUrl = static_url('cursors/MagnifyMinus.cur'),
            cursorUrl = iEvent.shiftKey ? magnifyMinusCursorUrl : magnifyPlusCursorUrl;
        this.attr( { cursor: DG.Browser.customCursorStr( cursorUrl, 8, 8) });
      }
      else
        this.attr( { cursor: 'auto' });
    }

/*
    function destroyZoomTip() {
      if( tToolTip) {
        tToolTip.hide();
        tToolTip.destroy();
        tToolTip = null;
      }
    }
*/

/*
    function mouseOver( iEvent) {
      if( !tHaveShowZoomTip) {
        var tZoomTipText = 'DG.GraphView.zoomTip'.loc();
        tToolTip = DG.ToolTip.create( { paperSource: this_,
                                            text: tZoomTipText,
                                            tipOrigin: {x: iEvent.layerX, y: iEvent.layerY},
            layerName: 'dataTip' });
        tToolTip.show();
        tHaveShowZoomTip = true;
        this_.invokeLater( destroyZoomTip, 5000);
      }
    }
*/

    var drawCellBands = function() {
      var tPaper = this.get('paper'),
          tXView = this.get('xAxisView'),
          tYView = this.get('yAxisView'),
          tNumXCells = tXView.getPath('model.numberOfCells'),
          tNumYCells = tYView.getPath('model.numberOfCells'),
          tXCellWidth = tXView.get('fullCellWidth'),
          tYCellWidth = tYView.get('fullCellWidth'),
          kIgnoreDragging = true,
          tIndex,
          tXCoord, tYCoord, tLeft, tTop;
      if (SC.none(tPaper))
        return;

      var drawVerticalLines = function () {
            var tHeight = tYCellWidth * tNumYCells;
            tYCoord = tYView.cellToCoordinate(0);
            tTop = tYCoord - tYCellWidth / 2;
            for (tIndex = 0; tIndex < tNumXCells; tIndex++) {
              var tLine;
              if (tIndex === 0)
                continue;
              tXCoord = tXView.cellToCoordinate(tIndex, kIgnoreDragging);
              tLeft = tXCoord - tXCellWidth / 2;
              tLine = tPaper.line(tLeft, tTop, tLeft, tTop + tHeight);
              tBackgroundLayer.push(
                  tLine.attr({stroke: DG.PlotUtilities.kRuleColor, 'stroke-width': 1}));
            }
          }.bind(this),

          drawHorizontalLines = function () {
            var tWidth = tXCellWidth * tNumXCells;
            tXCoord = tXView.cellToCoordinate(0);
            tLeft = tXCoord - tXCellWidth / 2;
            for (tIndex = 0; tIndex < tNumYCells - 1; tIndex++) {
              var tLine;
              tYCoord = tYView.cellToCoordinate(tIndex, kIgnoreDragging);
              tTop = tYCoord - tYCellWidth / 2;
              tLine = tPaper.line(tLeft, tTop + tYCellWidth, tLeft + tWidth, tTop + tYCellWidth);
              tBackgroundLayer.push(
                  tLine.attr({stroke: DG.PlotUtilities.kRuleColor, 'stroke-width': 1}));
            }
          }.bind(this);

      drawVerticalLines();
      drawHorizontalLines();

    }.bind( this); // drawCellBands

    tGridLayer.clear();
    tBackgroundLayer.clear();

    createRulerLines();

    drawCellBands();

    if( SC.none( this._backgroundForClick)) {
      this._backgroundForClick = this.getPath('layerManager.' + DG.LayerNames.kClick).push(
        this._paper.rect( 0, 0, 0, 0 )
                .attr( { fill: DG.RenderingUtilities.kSeeThrough,
                         stroke: DG.RenderingUtilities.kTransparent })
                .click( function( iEvent) {
                          this_.get('parentView').handleBackgroundClick( iEvent);
                        })
                .dblclick( function( iEvent) {
                          this_.get('parentView').handleBackgroundDblClick( iEvent);
                        })
                .drag( continueMarquee, startMarquee, endMarquee)
                .mousemove( showCursor)
                // The mouseover hint is annoying, and probably not useful.
                /*.mouseover( mouseOver)*/);
    }

    this._backgroundForClick.attr( { width: this.get('drawWidth'),
                                    height: this.get('drawHeight') } );

  },

  // We override to customize our dropHintString based on whether there are attributes or not
  dragStarted: function( iDrag) {
    // Call our mixin method first because it sets dropHintString
    DG.GraphDropTarget.dragStarted.call(this, iDrag);

    // Override mixin's setting
    var tDataConfig = this.getPath('graphModel.dataConfiguration'),
        tIsNotEmpty = tDataConfig && (tDataConfig.get('xAttributeID') ||
            tDataConfig.get('yAttributeID') || tDataConfig.get('legendAttributeID')),
        tHintString = (tIsNotEmpty ? 'DG.GraphView.dropInPlot' : 'DG.GraphView.addToEmptyX')
            .loc( iDrag.data.attribute.get('name' ));
    this.set('dropHintString', tHintString);
  }

});

