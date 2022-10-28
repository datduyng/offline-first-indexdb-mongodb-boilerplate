import { OfflineModel } from "./OfflineModel";

export type SyncRequestInput = {
    operations: OfflineModel[],
    models: {
        [tableName: string]: {
            cid: number;
            lastModified: number;
        }[]
    },
    lastSynced: number,
}