import { useEffect } from 'react';
import { Subject } from 'rxjs';
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

    useInterval(() => {
        // pull all keys on
        // sync offline data to server
        // batch create and delete

        (async () => {
            // higlight debug text in red
            console.log('%c Syncing ⌚....', 'color: green');
            // push all and sync
            try {
                await offlineFirstDb.transaction('rw', offlineFirstDb.todos, offlineFirstDb.offlineStorage, async () => {
                    const offlineStorage = await offlineFirstDb.offlineStorage.toArray();

                    if (offlineStorage.length == 0) {
                        console.log('%c No offline data to sync', 'color: yellow');
                        return;
                    }

                    if (_offlineService.isOnline) {
                        // push all to server and retry if fail.
                        const data = await fetch('/api/sync', {
                            method: 'POST',
                            body: JSON.stringify({
                                operations: offlineStorage,
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
                        }

                        if (!data.errorMessage) {
                            const newOfflineStorage = await offlineFirstDb.offlineStorage.toArray();
                            // convert array to map of cid
                            const newOfflineStorageMap = newOfflineStorage.reduce((acc, cur) => {
                                acc[cur.opId] = cur;
                                return acc;
                            }, {} as { [id: string]: OfflineModel });

                            const deleteIds = offlineStorage.filter(op => {
                                const newOp = newOfflineStorageMap[op.opId];
                                return newOp.lastModified <= op.lastModified;
                            }).map(op => op.cid!);
                            console.log(`Deletes: ${deleteIds}}
Origin: ${offlineStorage.map(op => op.cid!)}} 
`)
                            await offlineFirstDb.offlineStorage.bulkDelete(deleteIds);
                        }
                    } else {
                        console.log('%c No internet connection', 'color: yellow');
                    }
                });
            } catch (e) {
                console.error(e);
            }
        })()
    }, 3000);
}

