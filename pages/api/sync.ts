
// next api route
// https://nextjs.org/docs/api-routes/introduction
// https://nextjs.org/docs/api-routes/api-middlewares
// https://nextjs.org/docs/api-routes/api-middlewares#custom-config

import { NextApiRequest, NextApiResponse } from "next";
import { getMongoDbClient } from "../../libs/monogodb.server";
import { OfflineModel } from "../../types/OfflineModel";
import { TodoModel } from "../../types/TodoModel";

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
        // if (operations.length == 0) {
        //     return res.status(200).json({ errorMessage: 'No operations' });
        // }
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

            let bulkUpdateOps = upsertOperations.map(o => {
                const model = JSON.parse(o.rawModel)
                delete model._id;
                return {
                    updateOne: {
                        filter: { cid: model.cid },
                        update: { $set: model },
                        upsert: true
                    }
                }
            });

            if (bulkUpdateOps.length > 0) {
                const bulkWrite = await db
                    .collection(tableName)
                    .bulkWrite(bulkUpdateOps);
                // return res.status(200).json({
                //     data: bulkWrite,
                // });
            }
        }

        // get all todos with column cid and lastModified
        const todos = await db.collection('todos')
            .find({}).toArray();

            
        // convert models array into a hashmap
        const localTodoIds = models['todos'].reduce((acc, cur) => {
            acc[cur.cid!] = cur;
            return acc;
        }, {} as { [cid: number]: Partial<TodoModel> });

        const needToBeUpdated: {
            [tableName: string]: { [cid: number]: TodoModel }
        } = {
            'todos': {}
        };

        // for each todo item in todos
        todos.forEach(todo => {
            // if the todo item is not in the models.todos
            const localTodo = localTodoIds[todo.cid];

            if (!localTodo) {
                // add to needToBeUpdated
                needToBeUpdated['todos'][todo.cid] = todo as any;
            } else {
                // compare lastModified
                if (!localTodo.lastModified || todo.lastModified > localTodo.lastModified) {
                    // add to needToBeUpdated
                    needToBeUpdated['todos'][todo.cid] = todo as any;
                }
            }
        });

        return res.status(200).json({ needToBeUpdated });
    } catch (e) {
        // console.error(e);
        return res.status(500).json({ errorMessage: (e as any).message });
    }
}