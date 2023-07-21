const {InfluxDB, Point} = require('@influxdata/influxdb-client')
require('dotenv').config();

if(process.env.DEBUG !== 'true') console.debug = (...args) => {};

const {setSecret} = require('./src/github.js');
const {isEquivalent} = require('./src/utils.js');
const {
    requestLogin,
    verifyLogin,
    requestOTP,
    requestCredentials,
    refreshCredentials,
    getSummary,
    getAccount
} = require('./src/zonneplan.js');

function getEnv(name, isRequired=false, fallback) {
    const val = process.env[name];
    if(!val && isRequired) {
        console.error(`Missing required environment variable "${name}"`)
        process.exit(1)
    }
    return val ? val : fallback;
}

// Zonneplan
let zonneplanRefreshToken = getEnv('ZONNEPLAN_REFRESH_TOKEN');
let zonneplanAccessToken = getEnv('ZONNEPLAN_ACCESS_TOKEN');
let zonneplanExpiryDate = getEnv('ZONNEPLAN_EXPIRY_DATE');
let zonneplanConfirmLink = getEnv('ZONNEPLAN_CONFIRM_LINK');
let zonneplanTokenType = getEnv('ZONNEPLAN_TOKEN_TYPE');
let zonneplanEmail = getEnv('ZONNEPLAN_EMAIL', true);

// GitHub
let githubToken = getEnv('GITHUB_TOKEN');
let [
    githubRepoOwner,
    githubRepoName
] = getEnv('GITHUB_REPOSITORY', true).split('/');

// InfluxDB
let influxdbToken = getEnv('INFLUXDB_TOKEN', true);
let influxdbUrl = getEnv('INFLUXDB_URL', true);
let influxdbOrg = getEnv('INFLUXDB_ORG', true);
let influxdbBucket = getEnv('INFLUXDB_BUCKET', true);

(async () => {
    try {
        /**
         * Authenitcaticate
         */
        try {
            let credentials = {
                refreshToken: zonneplanRefreshToken,
                tokenType: zonneplanTokenType,
                expiryDate: zonneplanExpiryDate,
                accessToken: zonneplanAccessToken
            };;

            if(new Date(zonneplanExpiryDate || 0) < new Date()) {
                // Refresh token
                credentials = await refreshCredentials(zonneplanEmail, zonneplanRefreshToken);

            } else if(zonneplanConfirmLink) {
                // OAuth Dance
                const code = zonneplanConfirmLink.split('/').slice(-1);
                const uuid = await verifyLogin(code);
                const otp = await requestOTP(uuid);

                credentials = await requestCredentials(zonneplanEmail, otp);
            } else if(!zonneplanAccessToken || !zonneplanRefreshToken) {
                throw new Error('Unauthenicated.');
            }

            const {
                refreshToken,
                tokenType,
                expiryDate,
                accessToken
            } = credentials;

            console.debug('main', credentials)

            await setSecret('ZONNEPLAN_REFRESH_TOKEN', refreshToken, githubToken, githubRepoOwner, githubRepoName);
            await setSecret('ZONNEPLAN_TOKEN_TYPE', tokenType, githubToken, githubRepoOwner, githubRepoName);
            await setSecret('ZONNEPLAN_ACCESS_TOKEN', accessToken, githubToken, githubRepoOwner, githubRepoName);
            await setSecret('ZONNEPLAN_EXPIRY_DATE', expiryDate, githubToken, githubRepoOwner, githubRepoName);

            zonneplanRefreshToken = refreshToken;
            zonneplanTokenType = tokenType;
            zonneplanAccessToken = accessToken;
            zonneplanExpiryDate = expiryDate;

        } catch(err) {
            await requestLogin(zonneplanEmail);
            console.warn('Your saved login likely expired, a new login confirmation link was sent to ' + zonneplanEmail)
            console.warn('Please copy the link from the Email and trigger this workflow manuallay with it.\n');
            throw err;
        }

        /**
         * Connect Database
         */
        const client = new InfluxDB({url: influxdbUrl, token: influxdbToken});
        const writeApi = client.getWriteApi(influxdbOrg, influxdbBucket, 'ns');
        const writeApiMonitoring = client.getWriteApi(influxdbOrg, influxdbBucket + '_monitoring', 'ns');
        const queryApi = client.getQueryApi(influxdbOrg);
        
        /** 
         * Read Energy Prices
         */
        const account = await getAccount(zonneplanAccessToken);
        const data = await getSummary(account.address_groups[0].uuid, zonneplanAccessToken);

        const query = `from(bucket: "${influxdbBucket}") |> range(start: ${data.price_per_hour[0].datetime}, stop: 48h) |> filter(fn: (r) => r._measurement == "price_per_hour") |> filter(fn: (r) => r.tariff_group == "high" or r.tariff_group == "low" or r.tariff_group == "normal")`;
        const response = await queryApi.collectRows(query);

        const memory = {};
        for (const row of response) {
            if (!memory[new Date(row._time).toISOString()]) memory[new Date(row._time).toISOString()] = {};
            memory[new Date(row._time).toISOString()].datetime = new Date(row._time).toISOString();
            memory[new Date(row._time).toISOString()].tariff_group = row.tariff_group;
            memory[new Date(row._time).toISOString()][row._field] = row._value;
        }
        
        let created = 0, updated = 0;
        for (const record of data.price_per_hour.map(({ gas_price, ...rest }) => rest)) {
            if(isEquivalent({ ...record, datetime: new Date(record.datetime).toISOString()},memory[new Date(record.datetime).toISOString()])) {
                // No Updates
                continue;
            }

            

            // Write to Database
            const point = new Point('price_per_hour')
                .tag('tariff_group', record.tariff_group)
                .floatField('sustainability_score', record.sustainability_score / 10)
                .floatField('solar_percentage', record.solar_percentage / 10)
                .floatField('solar_yield', record.solar_yield / 10)
                .floatField('electricity_price', record.electricity_price / 100000)
                .stringField('created_at', new Date().toISOString())
                .timestamp(new Date(record.datetime));
            
            if(process.env.DEBUG !== 'true') writeApi.writePoint(point);

            if(memory[new Date(record.datetime).toISOString()]) {
                updated++;
            } else {
                created++;
            }
        }

        // Write to Database Log
        const point = new Point('write')
            .tag('measurement', 'price_per_hour')
            .intField('created', created)
            .intField('updated', updated)
            .timestamp(new Date());

        if(process.env.DEBUG !== 'true') writeApiMonitoring.writePoint(point);
        console.log(`Created ${created} and Updated ${updated} Datapoints in '${influxdbBucket}' Bucket.`);
        
        // Close Connections
        await writeApiMonitoring.close();
        await writeApi.close();

        process.exit(0);
    } catch (error) {
        if(!(error instanceof Error)) {
            error = new Error(error);
        }

        console.error('Unexpected', error);

        /**
         * Report error to Database
         */
        const client = new InfluxDB({url: influxdbUrl, token: influxdbToken});
        const writeApiMonitoring = client.getWriteApi(influxdbOrg, influxdbBucket + '_monitoring', 'ns');

        const point = new Point('error')
                .tag('type', 'fatal')
                .tag('reporter', `${githubRepoOwner}/${githubRepoName}`)
                .stringField('name', error.name)
                .stringField('message', error.message)
                .timestamp(new Date());
            
        if(process.env.DEBUG !== 'true') writeApiMonitoring.writePoint(point);
        await writeApiMonitoring.close();

        process.exit(1);
    }
})();