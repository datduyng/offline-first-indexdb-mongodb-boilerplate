export interface OfflineModel {
    cid?: number;
    opId: string;
    fromTable: string;
    operation: 'delete' | 'upsert';
    rawModel: string;
    lastModified: number;
}