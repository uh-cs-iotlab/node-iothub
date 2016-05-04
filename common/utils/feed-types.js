'use strict';

var FeedTypes = module.exports = {
    ATOMIC: 'atomic',
    COMPOSED: 'composed',
    EXECUTABLE: 'executable',
    VIRTUAL: 'virtual'
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
                case FeedTypes.VIRTUAL:
                    return 'VirtualFeed';
            }
        }
    },
    getFieldKey: {
        enumerable: false,
        value: (feedType) => {
            switch (feedType) {
                case FeedTypes.ATOMIC:
                    return '_field';
                case FeedTypes.COMPOSED:
                    return '_fields';
                default:
                    return null;
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
                    case 'virtual':
                        return {type: FeedTypes.VIRTUAL, virtual: data.virtual};
                }
            }
            return {type: FeedTypes.EXECUTABLE};
        }
    }
});
