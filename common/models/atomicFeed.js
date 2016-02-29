'use strict';

var FeedTypes = require('../../server/feed-types.json');

module.exports = function (AtomicFeed) {

    AtomicFeed.mixin('FeedValidator', {type: FeedTypes.ATOMIC});
    AtomicFeed.mixin('BaseFeed', {type: FeedTypes.ATOMIC});

};
