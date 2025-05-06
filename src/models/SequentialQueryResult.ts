export interface SequentialQueryObject<T> {
    [key: string]: T[]; // key is from `returningObjectKeys`, value is the result array of type `T[]`
}

export type SequentialQueryResult<T> = SequentialQueryObject<T>[];