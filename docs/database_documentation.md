# Database Documentation

## Introduction

This document describes the Zonneplan InfluxDB 2.0 database, hosted on the [InfluxDB Cloud](https://us-east-1-1.aws.cloud2.influxdata.com). The database comprises two buckets: `zonneplan` and `zonneplan_monitoring`.

## Database Overview

The **`zonneplan`** bucket contains energy price data and other related metrics provided by our energy provider, Zonneplan. 

The bucket's primary measurement is `price_per_hour`, which includes the following fields:

- `created_at`: An ISO 8601 formatted string denoting when the data point was inserted into the database.
- `electricity_price`: A float representing the energy price in cents, e.g., `31.67766`. Prices are typically displayed in Euros, rounded to the nearest cent, like `€0.32`.
- `solar_yield` and `solar_percentage`: Floats representing the yield of installed solar panels. As we don't have any solar panels, these fields are always `0`.
- `sustainability_score`: A float indicating the percentage of sustainable energy at a given point in time, e.g., `10.5` for 10.5%.

This measurement also includes a tag key `tariff_group` with possible values of `high`, `normal`, or `low`, representing Zonneplan's classification of energy prices.

The **`zonneplan_monitoring`** bucket contains logs from the main service that pushes data into the database, alongside other tool metrics. The primary measurement in this bucket is `write`, with the following fields:

- `created`: The number of data points created.
- `updated`: The number of data points updated.

The `write` measurement has a `measurement` tag key, which refers to the specific measurement in the `zonneplan` bucket that has been reported on.

This bucket also contains an `error` measurement with the following fields:

- `message`: The JavaScript error message.
- `name`: The JavaScript error name.

This measurement has a `reporter` tag key, referring to the specific service that reported the error (e.g., `superclustr/zonneplan-data-inserter`). It also has a `type` tag key with values `fatal` for fatal errors, `warning` for warnings, and `neutral` for neutral errors.

## Data Retention

The InfluxDB instance has a data retention policy of 30 days. After this period, older data is automatically deleted. If you require longer data retention, please reach out to me at rroeper@superclustr.net. You might want to consider sponsoring a [Usage-Based Plan](https://www.influxdata.com/influxdb-pricing/) or hosting the database on your infrastructure.

## Accessing the Data

To access the data in the `zonneplan` and `zonneplan_monitoring` buckets, you can use either Flux or InfluxQL, InfluxDB's native querying languages. 

For instance, to retrieve the electricity price data for a specific day using Flux:

```flux
from(bucket: "zonneplan")
  |> range(start: -1d)
  |> filter(fn: (r) => r._measurement == "price_per_hour" and r._field == "electricity_price")
```

InfluxDB also provides client libraries for many popular programming languages, including Python, JavaScript, Go, and more. These libraries provide an easy way to interact with the InfluxDB API.

Please refer to the [InfluxDB documentation](https://docs.influxdata.com/influxdb/v2.0/) for more details on how to use InfluxDB, Flux, InfluxQL and the various client libraries.

## Conclusion

We hope this document gives you a better understanding of the structure and capabilities of the Zonneplan InfluxDB. If you have any further questions, don't hesitate to get in touch. Happy data exploring!
