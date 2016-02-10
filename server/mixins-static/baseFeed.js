var async = require('async');
var loopback = require('loopback');
var FeedData = require('../feed-data');
var FeedTypes = require('../feed-types.json');

module.exports = function(Model, mixinOptions) {

    Model.defineProperty('name', {type: 'string', required: true});
    Model.defineProperty('metadata', {type: 'string', default: ''});
    Model.defineProperty('keywords', { type: ['string'], default: [] });

    if (mixinOptions !== FeedTypes.EXECUTABLE) {
        Model.defineProperty('validated', { type: 'boolean', default: false });
        if (Model.settings.hidden) Model.settings.hidden.push('validated');
        else Model.settings.hidden = ['validated'];
    }

    /*!
     * Convert null callbacks to 404 error objects.
     * @param  {HttpContext} ctx
     * @param  {Function} cb
     */
    var convertNullToNotFoundError = function (ctx, cb) {
        if (ctx.result !== null) return cb();

        var modelName = ctx.method.sharedClass.name;
        var id = ctx.getArgByName('id');
        var error = new Error(`Unknown "${modelName}" id "${id}".`);
        error.statusCode = error.status = 404;
        error.code = 'MODEL_NOT_FOUND';
        cb(error);
    };

    if (mixinOptions && mixinOptions.type) {

        Model.sharedClass.http.path = `/feeds/${mixinOptions.type}`;

        var Role = Model.registry.findModel('Role'),
            RoleMapping = Model.registry.findModel('RoleMapping'),
            FeedRoleACL = Model.registry.findModel('FeedRoleACL');

        /** ===================================================================
        *
        *   Client methods
        *
        *   ================================================================= */

        Model.filteredFind = function (query, callback) {
            if (typeof query === 'function' && callback === undefined) {
                // filteredFind(callback);
                callback = query;
                query = {};
            }
            Model.find(query, function (err, models) {
                if (err) return callback(err);
                if (models.length === 0) return callback(null, []);
                /**
                * This manner to get the token is not documented but you can get infos here:
                * - https://github.com/strongloop/loopback/issues/569
                * - https://github.com/strongloop/loopback/pull/775
                */
                var accessToken = loopback.getCurrentContext().get('accessToken');
                if (!accessToken || !accessToken.userId) return callback({status: 401, name: 'Error', message: 'Access token not found.'});
                // Here we get the roles of the user that made the request
                Role.getRoles({
                    principalType: RoleMapping.USER,
                    principalId: accessToken.userId
                }, function (err, roles) {
                    if (err) return callback(err);
                    if (roles.length === 0) return callback(null, []);
                    // We only keep the static roles
                    var dynamicRoles = [Role.OWNER, Role.AUTHENTICATED, Role.UNAUTHENTICATED, Role.EVERYONE];
                    var roleIds = roles.filter((roleId) => dynamicRoles.indexOf(roleId) < 0);
                    // Then we keep only the feeds that the user has access to
                    async.filter(models, function (model, filterCallback) {
                        if (mixinOptions.type !== FeedTypes.EXECUTABLE && !model.validated) return filterCallback(false);
                        // The ACL has to be associated with one of the user's roles...
                        var whereFilter = {
                            roleId: {inq: roleIds},
                            // ...and also to the current feed id
                            [`${mixinOptions.type}Id`]: model.id
                        };
                        FeedRoleACL.findOne({where: whereFilter}, function (err, acl) {
                            filterCallback(err === undefined && acl !== null);
                        });
                    }, function (filteredModels) {
                        callback(null, filteredModels);
                    });
                });
            });
        };
        Model.remoteMethod(
            'filteredFind',
            {
                description: 'Find all instances of the feed matched by filter from the data source and filtered by feed ACL.',
                accessType: 'READ',
                accepts: {arg: 'query', type: 'object', description: 'Filter defining fields, where, include, order, offset, and limit'},
                returns: {arg: 'data', type: [Model], root: true},
                http: {verb: 'get', path: '/filtered/'}
            }
        );

        Model.filteredFindOne = function (query, callback) {
            if (typeof query === 'function' && callback === undefined) {
                // filteredFindOne(callback);
                callback = query;
                query = {};
            }
            Model.filteredFind(query, function (err, models) {
                if (err) return callback(err);
                callback(null, (models.length > 0 ? models[0] : null));
            });
        };
        Model.remoteMethod(
            'filteredFindOne',
            {
                description: 'Find first instance of the feed matched by filter from the data source and filtered by feed ACL.',
                accessType: 'READ',
                accepts: {arg: 'query', type: 'object', description: 'Filter defining fields, where, include, order, offset, and limit'},
                returns: {arg: 'data', type: Model, root: true},
                http: {verb: 'get', path: '/filtered/findOne'},
                rest: {after: convertNullToNotFoundError}
            }
        );

        Model.filteredFindById = function (id, query, callback) {
            if (typeof query === 'function' && callback === undefined) {
                // filteredFindById(id, callback);
                callback = query;
                query = {};
            }
            if (!query) query = {};
            if (!query.where) query.where = {};
            query.where.id = id;
            Model.filteredFindOne(query, callback);
        };
        Model.remoteMethod(
            'filteredFindById',
            {
                description: 'Find a feed instance by id from the data source and filtered by feed ACL.',
                accessType: 'READ',
                accepts: [
                    { arg: 'id', type: 'any', description: 'Feed id', required: true, http: {source: 'path'}},
                    { arg: 'query', type: 'object', description: 'Filter defining fields and include'}
                ],
                returns: {arg: 'data', type: Model, root: true},
                http: {verb: 'get', path: '/filtered/:id'},
                rest: {after: convertNullToNotFoundError}
            }
        );

        Model.filteredExists = function (id, callback) {
            Model.filteredFindById(id, function (err, model) {
                if (err) return callback(err);
                callback(null, model !== null);
            });
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

        Model.filteredCount = function (where, callback) {
            if (typeof where === 'function' && callback === undefined) {
                // count(callback)
                callback = where;
                where = {};
            }
            Model.filteredFind({where: where}, function (err, models) {
                callback(err, err ? null : models.length);
            });
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
            if (!body || !body.roleId) return cb({name: 'Validation Error', status: 422, message: 'The request body is not valid. Details: `roleId` can\'t be blank'});
            Model.exists(modelId, function(err, modelExists) {
                if (modelExists === false) return cb({name: 'Error', status: 404, message: `Unknown '${Model.modelName}' id '${modelId}'`});
                else if (err) return cb(err);
                Role.exists(body.roleId, function (err, roleExists) {
                    if (roleExists === false) return cb({name: 'Error', status: 404, message: `Unknown 'Role' id '${body.roleId}'`});
                    else if (err) return cb(err);
                    var aclBody = {
                        roleId: body.roleId,
                        readAccess: body.readAccess,
                        writeAccess: body.writeAccess,
                        [`${mixinOptions.type}Id`]: modelId
                    };
                    FeedRoleACL.create(aclBody, cb);
                });
            });
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
            Model.exists(modelId, function(err, modelExists) {
                if (modelExists === false) return cb({name: 'Error', status: 404, message: `Unknown '${Model.modelName}' id '${modelId}'`});
                else if (err) return cb(err);
                var predicate = {
                    [`${mixinOptions.type}Id`]: modelId
                };
                FeedRoleACL.find(predicate, cb);
            });
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

        if (mixinOptions !== FeedTypes.EXECUTABLE) {
            Model.isValidated = function (modelId, cb) {
                Model.findById(modelId).then((model) => {
                    return Promise.resolve(model.validated);
                }).then((validated) => {
                    cb(null, validated);
                }).catch((err) => {
                    cb(err);
                });
            };
            Model.remoteMethod(
                'isValidated',
                {
                    description: 'Check if the feed has already been validated',
                    accepts: {arg: 'id', type: 'string', required: true},
                    returns: {arg: 'validated', type: 'boolean'},
                    http: {verb: 'get', path: '/:id/validated'}
                }
            );

            Model.validate = function (modelId, cb) {
                var validatedChanged = false;
                Model.findById(modelId).then((model) => {
                    var feedDataCollection = `${Model.modelName}Data${model.getId()}`;
                    if (!model.validated) {
                        var createOptions = Object.assign({}, mixinOptions, {
                            feedDataCollection
                        });
                        return FeedData.create(Model, model, createOptions).then((FeedData) => {
                            return model.updateAttribute('validated', true).then(() => {
                                validatedChanged = true;
                                return Promise.resolve(FeedData);
                            });
                        });
                    } else {
                        return Promise.resolve(Model.registry.findModel(feedDataCollection));
                    }
                }).then((FeedData) => {
                    cb(null, {changed: validatedChanged});
                }).catch((err) => {
                    cb(err);
                });
            };
            Model.remoteMethod(
                'validate',
                {
                    description: 'Validate feed for use and create data collection',
                    accepts: {arg: 'id', type: 'string', required: true},
                    returns: {type: 'object', root: true},
                    http: {verb: 'post', path: '/:id/validate'}
                }
            );
        }

        /** ===================================================================
        *
        *   Operation hooks
        *
        *   ================================================================= */

        Model.observe('after save', function (ctx, next) {
            if (ctx.isNewInstance === true) {
                Role.findOne({where: {name: 'admin'}}, function (err, role) {
                    var aclBody = {
                        roleId: role.getId(),
                        [`${mixinOptions.type}Id`]: ctx.instance.getId()
                    };
                    FeedRoleACL.create(aclBody, function (err) {
                        next(err);
                    });
                });
            } else {
                next();
            }
        });

        Model.observe('after delete', function (ctx, next) {
            if (ctx.instance) {
                var predicate = {[`${mixinOptions.type}Id`]: ctx.instance.getId()};
                FeedRoleACL.destroyAll(predicate, function (err) {
                    next(err);
                });
            } else {
                FeedRoleACL.find(function (err, acls) {
                    if (err) return next(err);
                    var filteredAcls = acls.filter((acl) => acl[`${mixinOptions.type}Id`] !== undefined);
                    async.each(filteredAcls, function (acl, callback) {
                        // Check if the related feed still exists, and if not, destroy the ACL
                        Model.exists(acl[`${mixinOptions.type}Id`], function (err, modelExists) {
                            if (modelExists === false) acl.destroy(callback);
                            else callback();
                        });
                    }, function (err) {
                        next(err);
                    });
                });
            }
        });
    }

};
