'use strict';

var FeedTypes = require('../utils/feed-types');

module.exports = function (ComposedFeed) {

    ComposedFeed.mixin('FeedValidator', {type: FeedTypes.COMPOSED});
    ComposedFeed.mixin('BaseFeed', {type: FeedTypes.COMPOSED});

};
