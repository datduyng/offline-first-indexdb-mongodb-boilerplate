import { OfModel } from "./OfModel";

export interface TodoModel extends OfModel {
    _id?: string;
    name: string;
    done: number; // boolean can't be indexed
} ;
