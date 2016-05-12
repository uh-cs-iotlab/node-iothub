'use strict';

module.exports = (app) => ({

    getAdminRoleId() {
        return app.models.HubRole.findOne({where: {name: 'admin'}})
        .then(adminRole => {
            if (!adminRole) return null;
            return adminRole.getId();
        });
    },

    createUser(userCreds, roleWhere) {
        return app.models.HubUser.create(userCreds)
        .then((user) => {
            if (roleWhere) {
                return new Promise((resolve, reject) => {
                    app.models.HubRole.findOne({where: roleWhere}, (err, role) => {
                        if (err) reject(err);
                        resolve(role);
                    });
                })
                .then((role) => {
                    return new Promise((resolve, reject) => {
                        role.principals.create({
                            principalType: app.models.RoleMapping.USER,
                            principalId: user.id
                        }, (err, principal) => {
                            if (err) reject(err);
                            resolve(principal);
                        });
                    });
                })
                .then(() => user);
            } else {
                return user;
            }
        });
    },

    login(userCreds) {
        return app.models.HubUser.login(userCreds);
    },

    removeUser(userId, tokenId) {
        var userP = Promise.resolve();
        if (tokenId) {
            userP = app.models.HubUser.logout(tokenId);
        }
        return userP
        .then(() => app.models.HubUser.destroyById(userId));
    }

});