export interface TodoModel {
    cid?: number;
    _id?: string;
    name: string;
    done: number; // boolean can't be indexed
    _isDeleted: number; // boolean can't be indexed
    lastModified: number;
}