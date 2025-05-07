export interface SequentialQueryObject {
    [key: string]: any[]; // key is from `returningObjectKeys`, value is the result array of type `T[]`
}

export type SequentialQueryResult = SequentialQueryObject[];