const cheerio = require('cheerio');

async function requestLogin(email) {
    const response = await fetch("https://app-api.zonneplan.nl/auth/request?email=" + email, {method: 'POST'});
    const body = await response.json();
    console.debug('requestLogin', {body});

    if(response.status !== 201) throw body.message;
}

async function verifyLogin(code) {
    const response = await fetch("https://mijn.zonneplan.nl/direct-inloggen/" + code);
    const body = await response.text();
    console.debug('verifyLogin', {body});

    if(response.status !== 200) throw body.message;
    
    const $ = cheerio.load(body);
    
    let uuid;

    // Search through each <a> and <script> tag
    $('a, script').each(function(i, element) {
        const content = $(element).html();
        // Extract UUID
        const match = content.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
        if (match) {
            uuid = match[0];
            return false; // Stop processing further
        }
    });
    
    return uuid;
}

async function requestOTP(uuid) {
    const response = await fetch("https://app-api.zonneplan.nl/auth/request/" + uuid);
    const body =  await response.json();
    console.debug('requestOTP', {body});

    if(response.status !== 200) throw body.message;

    return body.data.password;
}

async function requestCredentials(email, otp) {
    const response = await fetch("https://app-api.zonneplan.nl/oauth/token", {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            email,
            password: otp,
            grant_type: 'one_time_password'
        }),
    })
    const body = await response.json();
    console.debug('requestCredentials', {body});

    if(response.status !== 200) throw body.message;

    let expiryDate = new Date();
    expiryDate.setSeconds(expiryDate.getSeconds() + parseInt(body.expires_in));

    return {
        refreshToken: body.refresh_token,
        tokenType: body.token_type,
        expiryDate: expiryDate,
        accessToken: body.access_token
    };
}

async function refreshCredentials(email, refreshToken) {
    const response = await fetch("https://app-api.zonneplan.nl/oauth/token", {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            refresh_token: refreshToken,
            grant_type: 'refresh_token'
        }),
    })
    const body = await response.json();
    console.debug('refreshCredentials', {body});

    if(response.status !== 200) throw body.message;

    let expiryDate = new Date();
    expiryDate.setSeconds(expiryDate.getSeconds() + parseInt(body.expires_in));

    return {
        refreshToken: body.refresh_token,
        tokenType: body.token_type,
        expiryDate: expiryDate,
        accessToken: body.access_token
    };
}

async function getSummary(uuid, accessToken) {
    var headers = {
        'Authorization': `Bearer ${accessToken}`
    };

    const response = await fetch("https://app-api.zonneplan.nl/connections/" + uuid + "/summary", { headers });
    const body = await response.json();
    console.debug('getSummary', {body});

    if(response.status !== 200) throw body.message;

    return body.data;
}

async function getAccount(accessToken) {
    var headers = {
        'Authorization': `Bearer ${accessToken}`
    };

    const response = await fetch("https://app-api.zonneplan.nl/user-accounts/me", { headers })
    const body = await response.json();
    console.debug('getAccount', {body});

    if(response.status !== 200) throw body.message;

    return body.data;
}

module.exports = {
    requestLogin,
    verifyLogin,
    requestOTP,
    requestCredentials,
    refreshCredentials,
    getSummary,
    getAccount
}