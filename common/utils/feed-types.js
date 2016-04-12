'use strict';

var FeedTypes = module.exports = {
    ATOMIC: 'atomic',
    COMPOSED: 'composed',
    EXECUTABLE: 'executable'
};
Object.defineProperties(FeedTypes, {
    getModelName: {
        enumerable: false,
        value: (feedType) => {
            switch (feedType) {
                case FeedTypes.ATOMIC:
                    return 'AtomicFeed';
                case FeedTypes.COMPOSED:
                    return 'ComposedFeed';
                case FeedTypes.EXECUTABLE:
                    return 'ExecutableFeed';
            }
        }
    },
    getFeedType: {
        enumerable: false,
        value: (data) => {
            let keys = Object.keys(data);
            if (keys.length === 0) return null;
            for (let key of keys) {
                let normalizedKey = key.toLocaleLowerCase();
                switch (normalizedKey) {
                    case 'field':
                        return {type: FeedTypes.ATOMIC, key};
                    case 'fields':
                        return {type: FeedTypes.COMPOSED, key};
                    default:
                        continue;
                }
            }
            return {type: FeedTypes.EXECUTABLE};
        }
    }
});
