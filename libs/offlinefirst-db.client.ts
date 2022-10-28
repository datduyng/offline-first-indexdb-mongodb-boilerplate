import Dexie, { Table } from 'dexie';
import { MetaSyncModel } from '../types/MetaSyncModel';
import { OfflineModel } from '../types/OfflineModel';
import { OfModel } from '../types/OfModel';
import { TodoModel } from '../types/TodoModel';

type TableName = 'todos' | 'notes' | 'userConfigs';

type Config = {
    lastSynced: number;
}

const META_SYNC_CONFIG_KEY = 'meta-sync-config';
const defaultConfig: Config = {
    lastSynced: 0,
}
// get and set localStorage
export function getMetaSyncConfig() {
    const value = localStorage.getItem(META_SYNC_CONFIG_KEY);
    if (value) {
        return JSON.parse(value) as Config;
    }
    // setMetaConfigSync(defaultConfig)
    // localStorage.setItem(META_SYNC_CONFIG_KEY, JSON.stringify(defaultConfig));
    return defaultConfig;
};

export const setMetaConfigSync = (value: Config) => {
    localStorage.setItem(META_SYNC_CONFIG_KEY, JSON.stringify({
        ...getMetaSyncConfig(),
        ...value,
    }));
};

class OfflineFirstDbV2 extends Dexie {
    // 'friends' is added by dexie when declaring the stores()
    // We just tell the typing system this is the case
    todos!: Table<TodoModel>;
    notes!: Table<OfModel>;
    userConfigs!: Table<OfModel>;
    _offlineStorage!: Table<OfflineModel>;

    constructor() {
        super('myDatabase');
        this.version(2).stores({
            todos: '++cid, _isDeleted, name, done', // Primary key and indexed props
            notes: '++cid, _isDeleted, name', // Primary key and indexed props
            userConfigs: '++cid', // Primary key and indexed props
            _offlineStorage: '++cid, opId, fromTable, rawModel',
        });
    }

    addOne = async (tableName: TableName, data: Partial<OfModel>) => {
        return this.transaction('rw', this.table(tableName), this._offlineStorage, async () => {
            const cid = await this.table(tableName).add(data);
            await this._upsertOfflineStorage(tableName, cid as any, data);
            return cid;
        }).then((cid) => {
            return cid;
        });
    }

    deleteOne = (tableName: TableName, cid: number) => {
        return this.updateOne(tableName, cid, { cid, _isDeleted: 1 });
    }

    updateOne(tableName: TableName, cid: number, data: Partial<OfModel>) {
        // validate table name
        return this.transaction('rw', this.todos, this._offlineStorage, async () => {
            const currentData = await this.table(tableName).get(cid);

            const updatedData: Partial<OfModel> = {
                ...currentData,
                ...data,
            }

            this._upsertOfflineStorage(tableName, cid, updatedData);

            return this.table(tableName).update(cid, updatedData);
        });
    }

    async _upsertOfflineStorage(tableName: string, cid: number, data: Partial<OfModel>) {
        // TODO: validate table name
        data.lastModified = Date.now();
        const opId = `todos:${cid}`;
        const offlineModel = await this._offlineStorage.get({ opId });

        if (offlineModel) {
            // update
            return this._offlineStorage.update(offlineModel.cid!, {
                rawModel: JSON.stringify(data),
                operation: 'upsert',
                lastModified: Date.now(),
            });
        } else {
            // insert
            return this._offlineStorage.add({
                opId,
                fromTable: tableName,
                operation: 'upsert',
                rawModel: JSON.stringify(data),
                lastModified: Date.now(),
            });
        }
    }
}

export const offlineFirstDb = new OfflineFirstDbV2();

