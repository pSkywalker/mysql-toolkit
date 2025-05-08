const mysql = require('mysql');
import { Pool } from "mysql";

import { DbEnv } from "../models/DbEnv";

import logger from "../models/Logger";
import { QueryResult } from "../models/QueryResult";
import { MultiInsertResult } from "../models/MultiInsertResult";
import { TransactionResult } from "../models/TransactionResult";
import { SequentialQueryResult } from "../models/SequentialQueryResult";


export class Db_mysql1{ 
 
    private db : Pool;

    constructor(dbConfig : DbEnv ){ 

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

    public async sequentialQueryPromiseWrapper<T>( connection: any, query: string, logs: string, params: string[] ) : Promise<QueryResult<T>>{ 
        return new Promise< QueryResult<T> >( (resolve, reject) => { 
            connection.query({
                sql: query,
                timeout: 40000,
                values: params
            }, ( error : any, results: any, fields : any ) => {
                if( error ){ 
                    logger.error( {
                        code : error.code,
                        sql: error.sql,
                        msg: error.sqlMessage
                    } );
                    if( connection ){ 
                        connection.release();
                    }
                    return reject(new Error(`Failed to get database connection: ${error.sqlMessage}`));
                }
                logger.info(logs); 
                logger.info({ results: results, fields: fields });
                return resolve( { results: results, fields: fields } );
            })
        }) 
    }
  
    public async transactionItem(connection: any, query: string, params : string[], log: string ) : Promise<TransactionResult>{ 
        return new Promise< TransactionResult > ( ( resolve , reject )  => {
            connection.query( query, params , function( error: any, results: any, fields: any ) {
                logger.info( log );
                logger.info({ error, results, fields });
                return resolve( { error, results, fields } );
            });
        });
    }

    public async multiInsert( queries: string[], params : any , logs: string [] ) : Promise<MultiInsertResult>{ 
        return new Promise< MultiInsertResult > ( (resolve, reject ) => { 
            
            this.db.getConnection( ( error: any, connection: any ) =>{ 
                if( error ){ 
                    logger.error( {
                                    code : error.code,
                                    sql: error.sql,
                                    msg: error.sqlMessage
                                } );
                    if (connection) {
                        connection.release(); // Ensure the connection is released in case of error
                    }
                    return reject(new Error(`Failed to get database connection: ${error.sqlMessage}`));
                }
                connection.beginTransaction( async (err : any) => {
                    if( err ){ 
                        logger.error( {
                            code : err.code,
                            sql: err.sql,
                            msg: err.sqlMessage
                        });
                        if (connection) {
                            connection.release(); // Ensure the connection is released in case of error
                        }
                        return reject(new Error(err.sqlMessage))
                    }
                    let queriesValid = true;
                    let transactionResults = [];
                    for( let x = 0; x < queries.length; x++){

                        for( let y = 0; y < params[x].length; y++ ){
                            if( Array.isArray( params[x][y] ) ){
                                switch( params[x][y][1] ){
                                                            case "insertId":
                                                                        params[ x ][y] = transactionResults[ params[x][y][ 2 ] ].insertId;
                                                            break;
                                                            default:
                                                                    params[ x ][y] = transactionResults[ params[x][y][2] ].results[ params[x][y][1] ];
                                                            break;
                                                        }
                                                }
                            }
                        
                        //if( Array.isArray( params[x][y] && x != 0 ) ){ 
                        //	switch( params[x][1] ){ 
                        //		case "insertId":
                        //			params[ x ] = transactionResults[ params[x][ 2 ] ].results.insertId;
                        //		break;
                        //		deafult:
                        //			params[ x ] = transactionResults[ params[x][2] ].results[ params[x][1] ];
                        //		break;
                        //	}	
                        //}
                        let { error, results, fields } = await this.transactionItem(connection, queries[x] , params[x], logs[x] );	
                        if( error ) { 
                            logger.error( error ) ;
                             connection.rollback();
                             x = queries.length; 
                             queriesValid = false 
                            }
                        else { 
                            transactionResults.push( results ) 
                        }			
                    } 
                    if (queriesValid) {
                        connection.commit();
                        logger.info({ queryExecuted: true, results: transactionResults });
                        connection.release();
                        return resolve({ queryExecuted: true, results: transactionResults });
                    } else {
                        connection.rollback();
                        connection.release();
                        return reject(new Error("Error executing query"));
                    }
                });			
            })  
        
        } );
    }

    public async singleQuery<T>( query: string , logs : string[], params: string[]) : Promise<QueryResult<T>>{ 

        return new Promise<QueryResult<T>>( ( resolve , reject ) => { 

            logger.info( logs );
            this.db.query({
                sql: query,
                timeout: 40000,
                values: params
            }, (error: any , results: any, fields: any ) => {
                if( error ){ 
                    logger.error( {
                        code : error.code,
                        sql: error.sql,
                        msg: error.sqlMessage
                    } );
                    
                    return reject(new Error(`Query failed: ${error.sqlMessage}`));
                }
                logger.info( { results: results, fields: fields } );
                return resolve( { results: results, fields: fields } );
            });

        } );        

    }
    
    public async sequentialQuery<T>( queries : any, params: string[], logs: string[] /*, sequentialDependentKey: string*/ , returningObjectKeys : string[]) : Promise<SequentialQueryResult>{ 
        return new Promise< SequentialQueryResult >( ( resolve, reject ) => { 
            this.db.getConnection( async ( error: any, connection: any ) => { 
                if( error ){ 
                    logger.error( {
                        code : error.code,
                        sql: error.sql,
                        msg: error.sqlMessage
                    } );
                    if (connection) {
                        connection.release(); // Ensure the connection is released in case of error
                    }
                    return reject(new Error(error.sqlMessage));
                }

                let initialQ = await this.sequentialQueryPromiseWrapper<T>( connection , queries[0], logs[0], params );
                
                let returnArray = [];
                for( let x = 0; x < initialQ.results.length; x++ ){
                    let promises = [];
                    for( let y = 1; y < queries.length; y++ ){ 
                        logger.info( logs[x] );
                        promises.push( this.singleQuery<any>( 
                            queries[y][0], logs, 
                            [ (initialQ.results[x] as any)[ queries[y][1] ] ]
                        ));
                    }
                    let returnObj = await Promise.all( [
                        new Promise<any>( ( resolve, reject ) => { resolve(initialQ) } ),
                        ...promises
                    ] );
                        let obj : any = {};
                        for( let z = 0; z < returningObjectKeys.length; z++ ){ 
                            obj[returningObjectKeys[z]] = returnObj[z].results;
                        }
                        returnArray.push( obj );
                    
                    
                    logger.info( returnArray );
                }
                connection.release(); // Ensure the connection is released in case of error
                return resolve( 
                    returnArray
                )
            } );
    
        } );
    }

}

//type returnable = Promise<[ { key : { results: [ {key : string } ] } } ]>;
