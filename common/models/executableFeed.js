'use strict';

var FeedTypes = require('../utils/feed-types');

module.exports = function (ExecutableFeed) {

    ExecutableFeed.mixin('BaseFeed', {type: FeedTypes.EXECUTABLE});

};
