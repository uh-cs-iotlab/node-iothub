'use strict';

var FeedTypes = require('../../server/feed-types.json');

module.exports = function (ExecutableFeed) {

    ExecutableFeed.mixin('BaseFeed', {type: FeedTypes.EXECUTABLE});

};
