# Zonneplan Energy Data Inserter

The [Zonneplan](https://www.zonneplan.nl/) Energy Data Inserter is a Node.js application designed to regularly insert energy data into an InfluxDB database. This data is fetched from the energy provider Zonneplan, and includes information such as the hourly energy price and sustainability scores.

The application is designed to run on GitHub Actions, and is scheduled via the `main.yaml` workflow. The workflow can also be manually triggered if needed.

## Getting Started

The `main.yaml` workflow file in the GitHub Actions defines how and when the job is run. It can be adjusted to run on a schedule that suits your needs, or triggered manually. 

To manually trigger the workflow, follow the steps in the Actions tab of the GitHub repository and choose `main.yaml`.

#### 1. Installing Modules
To install all necessary Node Modules please run the following command:

```bash
npm install
```

#### 2. Run
To execute the Zonneplan Energy Data Inserter please run:

```bash
npm run start
```

> **Note**: You may want to setup a Cron job to schedule the repeated execution of this command. Also, the Application is developed for and checked to be compatible with Node.js 18. You may use a later version at your own risk.

## Configuration

The application requires several environment variables to function correctly, including details for the Zonneplan API and the InfluxDB. These environment variables need to be set in the GitHub Secrets.

Here is a list of the required environment variables:

- `ZONNEPLAN_EMAIL` You E-Mail to login to Zonneplan. Please use a throw-away account, not your actual account (Only accesses semi-public data).
- `GITHUB_TOKEN` A GitHub Token with Read/Write Access to your Repositories Secrets.
- `GITHUB_REPOSITORY` The Name of your Repository (e.g. 'superclustr/zonneplan-scraper')
- `INFLUXDB_TOKEN` A InfluxDB Token you created to Access the Database.
- `INFLUXDB_URL` The Host of your Influx Database (e.g. 'https://us-east-1-1.aws.cloud2.influxdata.com')
- `INFLUXDB_ORG` The Organization of your Influx Database (e.g. 'acme')
- `INFLUXDB_BUCKET` The Bucket name you want to feed data into (e.g. 'zonneplan'). Beware this pre-defines the Monitoring Bucket name ending with '_monitoring'!

For detailed instructions on how to configure these, please refer to the [GitHub Secrets documentation](https://docs.github.com/en/actions/security-guides/encrypted-secrets).

## Code Overview

The application uses the `@influxdata/influxdb-client` package to write data to InfluxDB, and several custom modules to handle the communication with the Zonneplan API.

In general, the application will do the following:

1. Authenticate with Zonneplan API
2. Connect to the InfluxDB instance
3. Fetch energy data from the Zonneplan API
4. Write the fetched data to InfluxDB
5. Log how many data points were created and updated

The code also handles exceptions and will write any fatal errors to the InfluxDB.

## Database Documentation

Please refer to the [Zonneplan InfluxDB Documentation](./docs/database_documentation.md) for more details about the database structure and how to extract data from it.

## Contributing

Contributions are welcome! Please create an issue if you have any suggestions, questions or bug reports. If you wish to contribute to the code, feel free to create a pull request. Be sure to update the `main.yaml` workflow file if needed to reflect your changes.

## Contact

For additional data or information, reach out to me at rroeper@superclustr.net.

## Acknowledgements

This project uses the InfluxDB Client for JavaScript provided by InfluxData. Refer to their [official documentation](https://www.influxdata.com/blog/getting-started-with-influxdb-and-nodejs/) for more information on how to use it.
