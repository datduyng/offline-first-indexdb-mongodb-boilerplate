import { useCallback, useEffect, useState } from 'react';
import { Subject } from 'rxjs';
import { useStore } from '../store';
import { OfflineModel } from '../types/OfflineModel';
import { TodoModel } from '../types/TodoModel';
import { offlineFirstDb } from './offlinefirst-db.client';
import { useInterval } from './use-interval';

declare const window: any; //declare window object

const isBrowser = typeof window !== 'undefined';
export class OfflineService {

    private internalConnectionChanged = new Subject<boolean>();

    constructor() {
        if (isBrowser) {
            window.addEventListener('online', () => this.updateOnlineStatus());
            window.addEventListener('offline', () => this.updateOnlineStatus());
        }


        //listen for the online/offline events

    }

    //return the connection state
    get connectionChanged() {
        return this.internalConnectionChanged.asObservable();
    }

    get isOnline() {
        return !!window.navigator.onLine;
    }

    private updateOnlineStatus() {
        console.log(window.navigator.onLine)
        this.internalConnectionChanged.next(window.navigator.onLine);
    }
}

const _offlineService = new OfflineService();

export const useOfflineSync = () => {
    // useEffect(() => {
    //     const supcription = _offlineService.connectionChanged.subscribe((isOnline) => {

    //         // from offline to online
    //         if (isOnline) {
    //             //sync offline data to server
    //             // batch create and delete
    //         }
    //         // from online to offline
    //         else {
    //             // don't do anything. Assume that data is stored in the browser
    //         }
    //     });

    //     return () => {
    //         //unsubscribe
    //         supcription.unsubscribe();
    //     }
    // }, []);
    const [setTodos] = useStore(state => {

        // is browser
        if (typeof window !== 'undefined') {
            window.STATE = state;
        }
        return [state.setTodos];
    });

    const doUpdate = useCallback(async (forceRefresh: boolean) => {
        // higlight debug text in red
        console.log('%c Syncing ⌚....', 'color: green');
        // push all and sync
        try {
            await offlineFirstDb.transaction('rw', offlineFirstDb.todos, offlineFirstDb._offlineStorage, async () => {
                const _offlineStorage = await offlineFirstDb._offlineStorage.toArray();

                if (_offlineStorage.length == 0 && !forceRefresh) {
                    console.log('%c No offline data to sync', 'color: yellow');
                    return;
                }

                if (_offlineService.isOnline) {
                    // push all to server and retry if fail.
                    const data = await fetch('/api/sync', {
                        method: 'POST',
                        body: JSON.stringify({
                            operations: _offlineStorage,
                            models: {
                                todos: (await offlineFirstDb.todos.toArray()).map(t => ({ lastModified: t.lastModified, cid: t.cid })),
                            }
                        }),
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    }).then(res => res.json());

                    const needToBeUpdated = data?.needToBeUpdated?.todos ? Object.values(data.needToBeUpdated.todos) as TodoModel[] : [];
                    // bulk update
                    if (needToBeUpdated.length > 0) {
                        await offlineFirstDb.todos.bulkPut(needToBeUpdated);
                        // get all todos
                        const todos = await offlineFirstDb.todos.toArray();
                        setTodos(todos.sort((a, d) => d.lastModified - a.lastModified));
                    }

                    if (!data.errorMessage) {
                        const newOfflineStorage = await offlineFirstDb._offlineStorage.toArray();
                        // convert array to map of cid
                        const newOfflineStorageMap = newOfflineStorage.reduce((acc, cur) => {
                            acc[cur.opId] = cur;
                            return acc;
                        }, {} as { [id: string]: OfflineModel });

                        const deleteIds = _offlineStorage.filter(op => {
                            const newOp = newOfflineStorageMap[op.opId];
                            return newOp.lastModified <= op.lastModified;
                        }).map(op => op.cid!);
                        console.log(`Deletes: ${deleteIds}
Origin: ${_offlineStorage.map(op => op.cid!)}
`)
                        if (deleteIds.length > 0) {

                            await offlineFirstDb._offlineStorage.bulkDelete(deleteIds);
                        }
                    }
                } else {
                    console.log('%c No internet connection', 'color: yellow');
                }
            });
        } catch (e) {
            console.error(e);
        }
    }, []);

    useInterval(() => {
        doUpdate(false);
    }, 4000);

    useEffect(() => {
        doUpdate(true);
    }, []);
}

