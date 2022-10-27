export interface TodoModel {
    cid?: number;
    _id?: string;
    name: string;
    done: boolean;
    _isDeleted: boolean;
    lastModified: number;
}