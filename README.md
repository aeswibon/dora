# Dora metrics

This is the repository that contains the code for calculating the dora metrics. It's uses Github APIs to fetch the data and then stores it in MongoDB database. The metrics are calculated using the data stored in the database.

## How to run the code

1. Clone the repository
2. Install the dependencies using `pnpm install`
3. Copy the `.env.example` file to `.env` and fill in the required values
4. Run the script using `pnpm dump` to fetch the data from Github and store it in the database
5. Run the server using `pnpm dev`

## Endpoints

`/dora` - Returns the metrics calculated using the data stored in the database

> Note: Make sure the MongoDB server is running in a replicaset as Prisma doesn't support standalone MongoDB servers for transaction
