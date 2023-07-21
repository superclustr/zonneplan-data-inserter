const { Octokit } = require("@octokit/rest");
const sodium = require('sodium-native');

async function setSecret(secretName, secretValue='', githubToken, owner, repo) {

    if (!secretValue) {
        console.warn('setSecret','secretValue is empty string') 
    };

    const octokit = new Octokit({
        auth: githubToken
    });

    // Get repository public key
    let { data: { key, key_id } } = await octokit.rest.actions.getRepoPublicKey({
        owner: owner,
        repo: repo
    });

    // Convert key from Base64 to Buffer
    const publicKey = Buffer.from(key, 'base64');

    const message = Buffer.from(secretValue);
    const encryptedValue = Buffer.alloc(message.length + sodium.crypto_box_SEALBYTES);

    sodium.crypto_box_seal(encryptedValue, message, publicKey);

    // Create or update secret
    try {
        await octokit.rest.actions.getRepoSecret({
            owner: owner,
            repo: repo,
            secret_name: secretName
        });

        // If secret exists, update it
        await octokit.rest.actions.createOrUpdateRepoSecret({
            owner: owner,
            repo: repo,
            secret_name: secretName,
            encrypted_value: encryptedValue.toString('base64'),
            key_id: key_id
        });
    } catch(err) {
        // If secret does not exist, create it
        if (err.status === 404) {
            await octokit.rest.actions.createOrUpdateRepoSecret({
                owner: owner,
                repo: repo,
                secret_name: secretName,
                encrypted_value: encryptedValue.toString('base64'),
                key_id: key_id
            });
        } else {
            throw err;
        }
    }
}



module.exports = {
    setSecret
}

