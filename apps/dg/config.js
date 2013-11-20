// ==========================================================================
//                               DG.config
//
//  Copyright ©2013 KCP Technologies, Inc., a McGraw-Hill Education Company
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

// This stores data which is specific to each development environment.  Variables which cannot be stored because of
// one reason or another(e.g. security), are to be replaced here.
DG.config = (function() {
  return {

    // If there is a Basic Authentication required for any request to the server that is hosting the DG App
    // then it should be entered in the following string in the same form that will be found in the header request.
    // For example: "Basic ZDOSJAODWancowjDSOJDSA=", this is Basic followed by the base64 encoding of the
    // (username:password)
    headerAuthentication: "Basic ZGF0YWdhbWVzOjIwMTFmYXRob20="
  };
}());

/**
  @private
  Map from feature ID (e.g. 'docSavePermissions') to a function
  which returns a boolean value indicating whether the specified
  feature is supported in this configuration. Feature functions
  can use features of the URL, the logged-in user, debug state,
  etc. to determine whether a given feature should be supported.
  Clients should call the DG.supports() function rather than
  accessing this map directly.
 */
DG.supportFuncs = {

  /**
    Enable case table column header menus. Currently enabled
    only in developer builds for internal testing.
   */
  caseTableHeaderMenus: function() {
    var isSupported = false;
    //@if(debug)
      isSupported = true;
    //@endif
    return isSupported;
  },

  /**
    Enable the "Shared" check-box in the save document dialog
    for setting document permissions when documents are saved.
   */
  docSavePermissions: function() {
    return DG.IS_INQUIRY_SPACE_BUILD;
  }

};

/**
  Returns true if the specified feature is supported in the current
  configuration, false otherwise.
  @param  {String}  iFeatureID -- e.g. 'docSavePermissions'
  @returns {Boolean}  True if the feature is supported, false otherwise
 */
DG.supports = function( iFeatureID) {
  var featureFunc = DG.supportFuncs[ iFeatureID];
  return featureFunc ? featureFunc() : false;
};
