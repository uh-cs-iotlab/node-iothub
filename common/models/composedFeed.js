var FeedTypes = require('../../server/feed-types.json');

module.exports = function(ComposedFeed) {

    ComposedFeed.mixin('FeedValidator', {type: FeedTypes.COMPOSED});
    ComposedFeed.mixin('BaseFeed', {type: FeedTypes.COMPOSED});

};
