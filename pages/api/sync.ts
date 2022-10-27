
// next api route
// https://nextjs.org/docs/api-routes/introduction
// https://nextjs.org/docs/api-routes/api-middlewares
// https://nextjs.org/docs/api-routes/api-middlewares#custom-config

import { NextApiRequest, NextApiResponse } from "next";
import { getMongoDbClient } from "../../libs/monogodb.server";
import { OfflineModel } from "../../types/OfflineModel";

type SyncModel = {
    operations: OfflineModel[],
    models: {
        [tableName: string]: {
            cid: number;
            lastModified: number;
        }[]
    }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { method } = req;

    if (method !== 'POST') {
        return res.status(405).json({ errorMessage: 'Method not allowed' });
    }

    if (!req.body) {
        return res.status(400).json({ errorMessage: 'Bad request' });
    }

    const { operations, models } = req.body as SyncModel;

    try {
        if (operations.length == 0) {
            return res.status(200).json({ errorMessage: 'No operations' });
        }
        const db = await getMongoDbClient();

        // group by table name
        const groupedOperations = operations.reduce((acc, cur) => {
            if (!acc[cur.fromTable]) {
                acc[cur.fromTable] = [];
            }

            acc[cur.fromTable].push(cur);
            return acc;
        }, {} as { [tableName: string]: OfflineModel[] });

        // for each table. batch upsert and add
        for (const tableName in groupedOperations) {
            const tableOperations = groupedOperations[tableName];

            // upsert
            const upsertOperations = tableOperations.filter(o => o.operation === 'upsert');

            let bulkUpdateOps = upsertOperations.map(o => ({
                updateOne: {
                    filter: { cid: o.cid },
                    update: { $set: JSON.parse(o.rawModel) },
                    upsert: true
                }
            }));

            console.log("upsertModels", tableName, bulkUpdateOps);
            if (bulkUpdateOps.length > 0) {
                const bulkWrite = await db
                    .collection(tableName)
                    .bulkWrite(bulkUpdateOps);
                return res.status(200).json({
                    data: bulkWrite,
                });
            }
        }

        return res.status(200).json({ message: 'ok' });
    } catch (e) {
        return res.status(500).json({ errorMessage: e.message });
    }
}