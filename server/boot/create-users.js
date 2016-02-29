'use strict';

var fs = require('fs');
var path = require('path');

module.exports = function (app) {

    var Role = app.models.HubRole;
    var User = app.models.HubUser;
    var RoleMapping = app.models.RoleMapping;

    var printErrorAndExit = function (message) {
        console.error('[ERROR] During admin authentication:');
        console.error(message);
        process.exit(1);
    };

    var getAdmins = function () {
        return new Promise((resolve, reject) => {
            Role.findOrCreate({name: 'admin'}, {name: 'admin'}, (err, role) => {
                if (err) reject(err);
                resolve(role);
            });
        })
        .then((role) => {
            return new Promise((resolve, reject) => {
                role.principals((err, principals) => {
                    if (err) reject(err);
                    resolve({role, principals});
                });
            });
        });
    };

    var isAdminCredentialsValid = function (creds) {
        var keys = Object.keys(creds);
        return keys.length >= 2 && keys.length <= 3;
    };

    var adminCredsConfFile = app.get('adminCredentials') || 'admin-creds.json';
    if (!path.isAbsolute(adminCredsConfFile)) {
        adminCredsConfFile = path.join(__dirname, '..', '..', adminCredsConfFile);
    }
    var existsP = new Promise((resolve, reject) => {
        fs.access(adminCredsConfFile, fs.R_OK, (err) => {
            if (err) reject(err);
            resolve();
        });
    });
    existsP
    .catch(err => printErrorAndExit(err.message));
    existsP
    .then(() => fs.readFileSync(adminCredsConfFile, 'utf8'))
    .then((adminCredsStr) => {
        return getAdmins()
        .then((adminInfos) => {
            var adminCreds = JSON.parse(adminCredsStr);
            if (!isAdminCredentialsValid(adminCreds)) {
                return Promise.reject(new Error(`The provided admin credentials are invalid.`));
            } else {
                var where = {};
                if (adminCreds.username) where.username = adminCreds.username;
                if (adminCreds.email) where.email = adminCreds.email;
                return User.findOrCreate(where, adminCreds)
                .then((user) => {
                    var adminRoleMapping = {
                        principalType: RoleMapping.USER,
                        principalId: user[0].id
                    };
                    return new Promise((resolve, reject) => {
                        adminInfos.role.principals(adminRoleMapping, (err, adminPrincipals) => {
                            if (err) reject(err);
                            resolve(adminPrincipals);
                        });
                    })
                    .then((adminPrincipals) => {
                        if (adminPrincipals.length === 0) {
                            return new Promise((resolve, reject) => {
                                adminInfos.role.principals.create(adminRoleMapping, (err) => {
                                    if (err) reject(err);
                                    resolve();
                                });
                            });
                        }
                    })
                    .then(() => user[0]);
                });
            }
        });
    })
    .then((user) => {
        var username = user.username || user.email;
        console.log(`User ${username} granted ad admin.`);
        if (process.env.DEV) {
            // Auto-login admin
            user.createAccessToken(0)
            .then((token) => {
                console.log(`User "${username}" logged in with token "${token.id}".`);
            }, (err) => {
                console.error(`[ERROR] Couldn't log in user "${username}": ${err.message}`);
            });
        }
    }, (err) => {
        printErrorAndExit(err.message);
    });
};
