// db.ts
import Dexie, { Table } from 'dexie';
import { OfflineModel } from '../types/OfflineModel';
import { TodoModel } from '../types/TodoModel';
import { OfflineService } from './offline-service.client';


export class OfflineFirstDb extends Dexie {
    // 'friends' is added by dexie when declaring the stores()
    // We just tell the typing system this is the case
    todos!: Table<TodoModel>;
    offlineStorage!: Table<OfflineModel>;
    // _offlineService: OfflineService;
    // _offlineDb: any;

    constructor() {
        super('myDatabase');
        this.version(1).stores({
            todos: '++cid, name, done', // Primary key and indexed props
            offlineStorage: '++cid, opId, fromTable, rawModel',
        });
        // this._offlineService = new OfflineService();
    }

    async updateTodo(cid: number, todo: Partial<TodoModel>) {
        // get current todo
        return this.transaction('rw', this.todos, this.offlineStorage, async () => {
            const currentTodo = await this.todos.get(cid);

            const updatedTodo: Partial<TodoModel> = {
                ...currentTodo,
                ...todo,
            }

            this._upsertTodoInOfflineStorage(cid, updatedTodo);

            return this.todos.update(cid, updatedTodo);
        });
    }

    addTodo = async (todo: TodoModel) => {
        return this.transaction('rw', this.todos, this.offlineStorage, async () => {
            const cid = await this.todos.add(todo);
            // if offline
            // if (!this._offlineService.isOnline) {
            await this._upsertTodoInOfflineStorage(cid as any, todo);
            // }
            return cid;
        }).then((cid) => {
            return cid;
        });
    }

    deleteTodo = (cid: number) => {
        return this.updateTodo(cid, { cid, _isDeleted: true });
    }

    _upsertTodoInOfflineStorage = async (cid: number, todo: Partial<TodoModel>) => {
        todo.lastModified = Date.now();
        const opId = `todos:${cid}`;
        const offlineModel = await this.offlineStorage.get({ opId });

        if (offlineModel) {
            // update
            return this.offlineStorage.update(offlineModel.cid!, {
                rawModel: JSON.stringify(todo),
                operation: 'upsert',
                lastModified: Date.now(),
            });
        } else {
            // insert
            return this.offlineStorage.add({
                opId,
                fromTable: 'todos',
                operation: 'upsert',
                rawModel: JSON.stringify(todo),
                lastModified: Date.now(),
            });
        }
    }
}

export const offlineFirstDb = new OfflineFirstDb();

