var FeedTypes = require('../../server/feed-types.json');

module.exports = function(AtomicFeed) {

    AtomicFeed.mixin('BaseFeed', {type: FeedTypes.ATOMIC});

};
