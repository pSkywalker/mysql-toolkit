import mysql from 'mysql2';

import { DbEnv } from '../models/DbEnv';

export class Db {
    private db: any;

    constructor(dbConfig: DbEnv) {
        this.db = mysql.createPool({
            host: dbConfig.host,
            user: dbConfig.user,
            password: dbConfig.password,
            database: dbConfig.database,
            waitForConnections: dbConfig.waitForConnections,  
            connectionLimit: dbConfig.connectionLimit,
            queueLimit: dbConfig.queueLimit
        });
    }

    public sequentialQueryPromiseWrapper(connection: any, query: string, logs: string, params: string[]): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            connection.query({
                sql: query,
                timeout: 40000,
                values: params
            }, (error: any, results: any, fields: any) => {
                if (error) {
                    console.log({
                        code: error.code,
                        sql: error.sql,
                        msg: error.sqlMessage
                    });
                    reject(error);
                    return;
                }
                console.log(logs);
                resolve({ results: results, fields: fields });
            });
        });
    }

    public transactionItem(connection: any, query: string, params: string[], log: string): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            connection.query(query, params, (error: any, results: any, fields: any) => {
                console.log(log);
                if (error) {
                    reject(error);
                    return;
                }
                resolve({ error, results, fields });
            });
        });
    }

    public multiInsert(queries: string[], params: any, logs: string[]): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            this.db.getConnection((error: any, connection: any) => {
                if (error) {
                    console.log({
                        code: error.code,
                        sql: error.sql,
                        msg: error.sqlMessage
                    });
                    reject(error);
                    return;
                }

                connection.beginTransaction(async (err: any) => {
                    if (err) {
                        console.log(err);
                        reject(err);
                        return;
                    }

                    let queriesValid = true;
                    let transactionResults = [];
                    for (let x = 0; x < queries.length; x++) {
                        for (let y = 0; y < params[x].length; y++) {
                            if (Array.isArray(params[x][y])) {
                                console.log(params[x][y]);
                                switch (params[x][y][1]) {
                                    case "insertId":
                                        console.log(transactionResults);
                                        params[x][y] = transactionResults[params[x][y][2]].insertId;
                                        break;
                                    default:
                                        params[x][y] = transactionResults[params[x][y][2]].results[params[x][y][1]];
                                        break;
                                }
                            }
                        }

                        let { error, results, fields } = await this.transactionItem(connection, queries[x], params[x], logs[x]);
                        if (error) {
                            console.log(error);
                            connection.rollback();
                            queriesValid = false;
                        } else {
                            transactionResults.push(results);
                        }
                    }

                    if (queriesValid) {
                        connection.commit();
                        resolve({ queryExecuted: true, results: transactionResults });
                    } else {
                        resolve({ queryExecuted: false });
                    }
                });
            });
        });
    }

    public singleQuery(query: string, logs: string[], params: string[]): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            console.log(logs);
            this.db.query({
                sql: query,
                timeout: 40000,
                values: params
            }, (error: any, results: any, fields: any) => {
                if (error) {
                    console.log({
                        code: error.code,
                        sql: error.sql,
                        msg: error.sqlMessage
                    });
                    reject(error);
                    return;
                }
                console.log(logs);
                resolve({ results: results, fields: fields });
            });
        });
    }

    public sequentialQuery(queries: any, params: string[], logs: string[], sequentialDependentKey: string, returningObjectKeys: string[]): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            this.db.getConnection(async (error: any, connection: any) => {
                if (error) {
                    console.log({
                        code: error.code,
                        sql: error.sql,
                        msg: error.sqlMessage
                    });
                    reject(error);
                    return;
                }

                let initialQ = await this.sequentialQueryPromiseWrapper(connection, queries[0], logs[0], params);
                connection.release();
                let returnArray = [];

                for (let x = 0; x < initialQ.results.length; x++) {
                    let promises = [];
                    for (let y = 1; y < queries.length; y++) {
                        console.log(logs[x]);
                        promises.push(this.singleQuery(queries[y][0], logs, [initialQ.results[x][queries[y][1]]]));
                    }

                    let returnObj = await Promise.all([
                        new Promise<any>((resolve, reject) => { resolve(initialQ) }),
                        ...promises
                    ]);

                    let obj: any = {};
                    for (let z = 0; z < returningObjectKeys.length; z++) {
                        obj[returningObjectKeys[z]] = returnObj[z].results;
                    }
                    returnArray.push(obj);
                }

                resolve(returnArray);
            });
        });
    }
}