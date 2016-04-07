'use strict';

var FeedTypes = require('../utils/feed-types');

module.exports = function (AtomicFeed) {

    AtomicFeed.mixin('FeedValidator', {type: FeedTypes.ATOMIC});
    AtomicFeed.mixin('BaseFeed', {type: FeedTypes.ATOMIC});

};
