'use strict';

var loopback = require('loopback');
var FeedTypes = require('../../common/utils/feed-types');

module.exports = function (Model, mixinOptions) {

    Model.defineProperty('name', {type: 'string', required: true});
    Model.defineProperty('metadata', {type: 'string', default: ''});
    Model.defineProperty('keywords', {type: ['string'], default: []});

    /*!
     * Convert null callbacks to 404 error objects.
     * @param  {HttpContext} ctx
     * @param  {Function} cb
     */
    Model.convertNullToNotFoundError = function (ctx, cb) {
        if (ctx.result !== null) return cb();

        let modelName = ctx.method.sharedClass.name;
        let id = ctx.getArgByName('id');
        let error = new Error(`Unknown "${modelName}" id "${id}".`);
        error.statusCode = error.status = 404;
        error.code = 'MODEL_NOT_FOUND';
        cb(error);
    };

    if (mixinOptions && mixinOptions.type) {

        Model.sharedClass.http.path = `/feeds/${mixinOptions.type}`;

        let Role = Model.registry.findModel('HubRole');
        let RoleMapping = Model.registry.findModel('RoleMapping');
        let FeedRoleACL = Model.registry.findModel('FeedRoleACL');
        let Field = Model.registry.findModel('Field');

        /** ===================================================================
         *
         *   Client methods
         *
         *   ================================================================= */

        Model.filteredFind = function (query, options, cb) {
            if (typeof query === 'function' && options === undefined && cb === undefined) {
                // filteredFind(cb);
                cb = query;
                options = {};
                query = {};
            } else if (typeof options === 'function' && cb === undefined) {
                // filteredFind(query, cb)
                cb = options;
                options = {};
            }
            let reqP = Model.find(query)
            .then((models) => {
                if (models.length === 0) return [];
                let accessToken = null;
                if (options && options.accessToken) {
                    accessToken = options.accessToken;
                } else {
                    /**
                     * This manner to get the token is not documented but you can get infos here:
                     * - https://github.com/strongloop/loopback/issues/569
                     * - https://github.com/strongloop/loopback/pull/775
                     */
                    let context = loopback.getCurrentContext();
                    if (context) accessToken = context.get('accessToken');
                }
                if (!accessToken || !accessToken.userId) {
                    let err = new Error(`Access token not found.`);
                    err.statusCode = err.status = 401;
                    return Promise.reject(err);
                }
                // Here we get the roles of the user that made the request
                return new Promise((resolve, reject) => {
                    Role.getRoles({
                        principalType: RoleMapping.USER,
                        principalId: accessToken.userId
                    }, (err, roles) => {
                        if (err) reject(err);
                        resolve(roles);
                    });
                })
                .then((roles) => {
                    if (roles.length === 0) return [];
                    // We only keep the static roles
                    let dynamicRoles = [Role.OWNER, Role.AUTHENTICATED, Role.UNAUTHENTICATED, Role.EVERYONE];
                    let roleIds = roles.filter(roleId => dynamicRoles.indexOf(roleId) < 0);
                    return Promise.all(models.map((model) => {
                        if (model.validated === false) return null;
                        // The ACL has to be associated with one of the user's roles...
                        let whereFilter = {
                            roleId: {inq: roleIds},
                            // ...and also to the current feed id
                            [`${mixinOptions.type}Id`]: model.id
                        };
                        return FeedRoleACL.findOne({where: whereFilter})
                        .then(acl => acl !== null ? model : null, err => null);
                    }));
                });
            })
            .then(mappedModels => mappedModels.filter(model => model !== null));
            if (cb) reqP.then(models => cb(null, models), err => cb(err));
            return reqP;
        };
        Model.remoteMethod(
            'filteredFind',
            {
                description: 'Find all instances of the feed matched by filter from the data source and filtered by feed ACL.',
                accessType: 'READ',
                accepts: {
                    arg: 'query',
                    type: 'object',
                    description: 'Filter defining fields, where, include, order, offset, and limit'
                },
                returns: {arg: 'data', type: [Model], root: true},
                http: {verb: 'get', path: '/filtered/'}
            }
        );

        Model.filteredFindOne = function (query, cb) {
            if (typeof query === 'function' && callback === undefined) {
                // filteredFindOne(cb);
                cb = query;
                query = {};
            }
            query.limit = 1;
            let reqP = Model.filteredFind(query)
            .then(models => models.length > 0 ? models[0] : null);
            if (cb) reqP.then(model => cb(null, model), err => cb(err));
            return reqP;
        };
        Model.remoteMethod(
            'filteredFindOne',
            {
                description: 'Find first instance of the feed matched by filter from the data source and filtered by feed ACL.',
                accessType: 'READ',
                accepts: {
                    arg: 'query',
                    type: 'object',
                    description: 'Filter defining fields, where, include, order, offset, and limit'
                },
                returns: {arg: 'data', type: Model, root: true},
                http: {verb: 'get', path: '/filtered/findOne'},
                rest: {after: Model.convertNullToNotFoundError}
            }
        );

        Model.filteredFindById = function (id, query, cb) {
            if (typeof query === 'function' && callback === undefined) {
                // filteredFindById(id, cb);
                cb = query;
                query = {};
            }
            if (!query) query = {};
            if (!query.where) query.where = {};
            query.where.id = id;
            let reqP = Model.filteredFindOne(query);
            if (cb) reqP.then(model => cb(null, model), err => cb(err));
            return reqP;
        };
        Model.remoteMethod(
            'filteredFindById',
            {
                description: 'Find a feed instance by id from the data source and filtered by feed ACL.',
                accessType: 'READ',
                accepts: [
                    {arg: 'id', type: 'any', description: 'Feed id', required: true, http: {source: 'path'}},
                    {arg: 'query', type: 'object', description: 'Filter defining fields and include'}
                ],
                returns: {arg: 'data', type: Model, root: true},
                http: {verb: 'get', path: '/filtered/:id'},
                rest: {after: Model.convertNullToNotFoundError}
            }
        );

        Model.filteredExists = function (id, cb) {
            let reqP = Model.filteredFindById(id)
            .then(model => model !== null);
            if (cb) reqP.then(exists => cb(null, exists), err => cb(err));
            return reqP;
        };
        Model.remoteMethod(
            'filteredExists',
            {
                description: 'Check whether a feed instance, filtered by feed ACL, exists in the data source.',
                accessType: 'READ',
                accepts: {arg: 'id', type: 'any', description: 'Feed id', required: true},
                returns: {arg: 'exists', type: 'boolean'},
                http: {verb: 'get', path: '/filtered/:id/exists'}
            }
        );

        Model.filteredCount = function (where, cb) {
            if (typeof where === 'function' && cb === undefined) {
                // count(cb)
                cb = where;
                where = {};
            }
            let reqP = Model.filteredFind({where: where})
            .then(models => models.length);
            if (cb) reqP.then(count => cb(null, count), err => cb(err));
            return reqP;
        };
        Model.remoteMethod(
            'filteredCount',
            {
                description: 'Count instances of the feed matched by where from the data source and filtered by feed ACL.',
                accessType: 'READ',
                accepts: {arg: 'where', type: 'object', description: 'Criteria to match model instances'},
                returns: {arg: 'count', type: 'number'},
                http: {verb: 'get', path: '/filtered/count'}
            }
        );

        /** ===================================================================
         *
         *   Admin methods
         *
         *   ================================================================= */

        Model.createRoleAcl = function (modelId, body, cb) {
            let reqP;
            if (!body || !body.roleId) {
                let err = new Error(`The request body is not valid. Details: 'roleId' can't be blank`);
                err.name = 'Validation Error';
                err.statusCode = err.status = 422;
                reqP = Promise.reject(err);
            } else {
                reqP = Model.exists(modelId)
                .then(function (modelExists) {
                    if (modelExists === false) {
                        let err = new Error(`Unknown '${Model.modelName}' id '${modelId}'`);
                        err.statusCode = err.status = 404;
                        return Promise.reject(err);
                    }
                })
                .then(() => Role.exists(body.roleId))
                .then(function (roleExists) {
                    if (roleExists === false) {
                        let err = new Error(`Unknown 'Role' id '${body.roleId}'`);
                        err.statusCode = err.status = 404;
                        return Promise.reject(err);
                    }
                })
                .then(() => {
                    let aclBody = {
                        roleId: body.roleId,
                        readAccess: body.readAccess,
                        writeAccess: body.writeAccess,
                        [`${mixinOptions.type}Id`]: modelId
                    };
                    return FeedRoleACL.create(aclBody);
                });
            }
            if (cb) reqP.then(acl => cb(null, acl), err => cb(err));
            return reqP;
        };
        Model.remoteMethod(
            'createRoleAcl',
            {
                description: 'Associate a role ACL to this model instance.',
                accepts: [
                    {arg: 'id', type: 'string', required: true},
                    {arg: 'body', type: 'FeedRoleACL', http: {source: 'body'}}
                ],
                returns: {type: 'object', root: true},
                http: {verb: 'post', path: '/:id/role-acl'}
            }
        );

        Model.getRoleAcls = function (modelId, cb) {
            let reqP = Model.exists(modelId)
            .then(function (modelExists) {
                if (modelExists === false) {
                    let err = new Error(`Unknown '${Model.modelName}' id '${modelId}'`);
                    err.statusCode = err.status = 404;
                    return Promise.reject(err);
                }
            })
            .then(() => {
                let predicate = {
                    [`${mixinOptions.type}Id`]: modelId
                };
                return FeedRoleACL.find(predicate, cb);
            });
            if (cb) reqP.then(acls => cb(null, acls), err => cb(err));
            return reqP;
        };
        Model.remoteMethod(
            'getRoleAcls',
            {
                description: 'Find all role ACL associated to this model instance.',
                accepts: {arg: 'id', type: 'string', required: true},
                returns: {type: ['FeedRoleACL'], root: true},
                http: {verb: 'get', path: '/:id/role-acl'}
            }
        );

        /** ===================================================================
         *
         *   Operation hooks
         *
         *   ================================================================= */

        Model.observe('after save', function (ctx, next) {
            let hookP = Promise.resolve();
            if (ctx.isNewInstance === true) {
                hookP = new Promise((resolve, reject) => {
                    Role.findOne({where: {name: 'admin'}}, (err, role) => {
                        if (err) reject(err);
                        resolve(role);
                    });
                })
                .then((role) => {
                    let aclBody = {
                        roleId: role.getId(),
                        [`${mixinOptions.type}Id`]: ctx.instance.getId()
                    };
                    return FeedRoleACL.create(aclBody);
                });
            }
            hookP.then(() => next(), (err) => next(err));
        });


        Model.observe('before delete', function (ctx, next) {
            let hookP = Promise.resolve();
            // Get the ids of fields to delete if the feed is deleted
            // This is made in case of deleteAll() action because we can't access fields through one instance.
            if (!ctx.instance) {
                hookP = Model.find({where: ctx.where || {}})
                .then((models) => {
                    let fieldIds = models.map((model) => {
                        if (mixinOptions.type === FeedTypes.ATOMIC && model._field) {
                            return model._field.getId();
                        } else if (mixinOptions.type === FeedTypes.COMPOSED && model._fields) {
                            return model._fields.map(field => field.getId());
                        } else {
                            return [];
                        }
                    });
                    ctx.hookState.fieldIds = [].concat.apply([], fieldIds);
                });
            }
            hookP.then(() => next(), (err) => next(err));
        });

        Model.observe('after delete', function (ctx, next) {
            let hookP = Promise.resolve();
            if (ctx.instance) {
                let predicate = {[`${mixinOptions.type}Id`]: ctx.instance.getId()};
                hookP = FeedRoleACL.destroyAll(predicate)
                .then(() => {
                    if (mixinOptions.type === FeedTypes.ATOMIC && ctx.instance._field) {
                        return Field.deleteById(ctx.instance._field.getId());
                    } else if (mixinOptions.type === FeedTypes.COMPOSED && ctx.instance._fields) {
                        return Promise.all(ctx.instance._fields.map((field) => Field.deleteById(field.getId())));
                    }
                });
            } else {
                hookP = FeedRoleACL.find()
                .then((acls) => {
                    // Check for RoleACLs that are related to this type of feeds
                    let filteredAcls = acls.filter(acl => acl[`${mixinOptions.type}Id`] !== undefined);
                    return Promise.all(filteredAcls.map((acl) => {
                        // Check if the related feed still exists, and if not, destroy the ACL
                        return Model.exists(acl[`${mixinOptions.type}Id`])
                        .then((modelExists) => {
                            if (modelExists === false) return acl.destroy();
                        });
                    }));
                })
                .then(() => {
                    // Delete fields related to feeds that are been destroyed by deleteAll() operation.
                    let fieldIds = ctx.hookState.fieldIds;
                    if (fieldIds) {
                        return Promise.all(fieldIds.map(fieldId => Field.destroyById(fieldId)));
                    }
                });
            }
            hookP.then(() => next(), (err) => next(err));
        });
    }

};
