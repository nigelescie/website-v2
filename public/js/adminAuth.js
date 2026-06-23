// Cognito Auth helpers for admin panel
// Requires amazon-cognito-identity-js loaded via CDN

// In-memory token storage — keeps JWTs out of localStorage (SEC-011)
const _sessionStorage = (() => {
    let store = {};
    return {
        setItem(k, v) { store[k] = v; },
        getItem(k) { return store[k] ?? null; },
        removeItem(k) { delete store[k]; },
        clear() { store = {}; },
    };
})();

function getCognitoUser(username) {
    const poolData = {
        UserPoolId: CONFIG.COGNITO.UserPoolId,
        ClientId: CONFIG.COGNITO.ClientId,
        Storage: _sessionStorage,
    };
    const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);
    return new AmazonCognitoIdentity.CognitoUser({ Username: username, Pool: userPool, Storage: _sessionStorage });
}

function getUserPool() {
    return new AmazonCognitoIdentity.CognitoUserPool({
        UserPoolId: CONFIG.COGNITO.UserPoolId,
        ClientId: CONFIG.COGNITO.ClientId,
        Storage: _sessionStorage,
    });
}

function getIdToken() {
    const pool = getUserPool();
    const user = pool.getCurrentUser();
    if (!user) return Promise.resolve(null);
    return new Promise((resolve) => {
        user.getSession((err, session) => {
            if (err || !session?.isValid()) return resolve(null);
            resolve(session.getIdToken().getJwtToken());
        });
    });
}

async function authenticatedFetch(url, options = {}) {
    const token = await getIdToken();
    if (!token) throw new Error('Not authenticated');
    return fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
            'Authorization': token,
        },
    });
}

function cognitoLogin(username, password) {
    return new Promise((resolve, reject) => {
        const authDetails = new AmazonCognitoIdentity.AuthenticationDetails({
            Username: username,
            Password: password,
        });
        const user = getCognitoUser(username);
        user.authenticateUser(authDetails, {
            onSuccess: (session) => resolve({ token: session.getIdToken().getJwtToken(), user }),
            onFailure: reject,
            newPasswordRequired: (userAttributes) => resolve({ newPasswordRequired: true, user, userAttributes }),
        });
    });
}

function cognitoForgotPassword(username) {
    return new Promise((resolve, reject) => {
        getCognitoUser(username).forgotPassword({ onSuccess: resolve, onFailure: reject });
    });
}

function cognitoConfirmPassword(username, code, newPassword) {
    return new Promise((resolve, reject) => {
        getCognitoUser(username).confirmPassword(code, newPassword, { onSuccess: resolve, onFailure: reject });
    });
}

function cognitoChangePassword(oldPassword, newPassword) {
    return new Promise((resolve, reject) => {
        const pool = getUserPool();
        const user = pool.getCurrentUser();
        if (!user) return reject(new Error('Not logged in'));
        user.getSession((err, session) => {
            if (err) return reject(err);
            user.changePassword(oldPassword, newPassword, (err2, result) => {
                if (err2) return reject(err2);
                resolve(result);
            });
        });
    });
}

function cognitoUpdateEmail(newEmail) {
    return new Promise((resolve, reject) => {
        const pool = getUserPool();
        const user = pool.getCurrentUser();
        if (!user) return reject(new Error('Not logged in'));
        user.getSession((err) => {
            if (err) return reject(err);
            const attrs = [new AmazonCognitoIdentity.CognitoUserAttribute({ Name: 'email', Value: newEmail })];
            user.updateAttributes(attrs, (err2, result) => {
                if (err2) return reject(err2);
                resolve(result);
            });
        });
    });
}

function cognitoGetEmail() {
    return new Promise((resolve, reject) => {
        const pool = getUserPool();
        const user = pool.getCurrentUser();
        if (!user) return resolve(null);
        user.getSession((err) => {
            if (err) return resolve(null);
            user.getUserAttributes((err2, attrs) => {
                if (err2) return resolve(null);
                const emailAttr = attrs?.find(a => a.getName() === 'email');
                resolve(emailAttr ? emailAttr.getValue() : null);
            });
        });
    });
}

function cognitoSignOut() {
    const pool = getUserPool();
    const user = pool.getCurrentUser();
    if (user) user.signOut();
}
