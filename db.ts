const mysql = require('mysql');

import { dbKeys } from "../env/keys/db";

export class Db{ 


    private db : any;

    constructor(){ 

        this.db = mysql.createPool({
            host        : dbKeys.host, 
            user        : dbKeys.user,
            password    : dbKeys.password,
            database    : dbKeys.database
        });

    }

    public sequentialQueryPromiseWrapper( connection: any, query: string, logs: string, params: string[] ) : Promise<any>{ 
        return new Promise< any >( (resolve, reject) => { 
            connection.query({
                sql: query,
                timeout: 40000,
                values: params
            }, ( error : any, results: any, fields : any ) => {
                if( error ){ 
                    console.log( {
                        code : error.code,
                        sql: error.sql,
                        msg: error.sqlMessage
                    } );
                    throw new Error();
                }
                console.log(logs); 
                resolve( { results: results, fields: fields } );
            })
        }) 
    }

  
    public transactionItem(connection: any, query: string, params : string[], log: string ){ 
	return new Promise< any > ( ( resolve , reject )  => {
		connection.query( query, params , function( error: any, results: any, fields: any ) {
			console.log( log );
			resolve( { error, results, fields } );
		});
	});
    }


    public multiInsert( queries: string[], params : any , logs: string [] ){ 
	return new Promise< any > ( (resolve, reject ) => { 
		
		this.db.getConnection( ( error: any, connection: any ) =>{ 
			if( error ){ 
				console.log( {
                        		code : error.code,
                       	 		sql: error.sql,
                       	 		msg: error.sqlMessage
                    		} );
				throw new Error();
			}
			connection.beginTransaction( async (err : any) => {
				if( err ){ 
					console.log(err);
					throw new Error();
				}
				let queriesValid = true;
				let transactionResults = [];
				for( let x = 0; x < queries.length; x++){

					for( let y = 0; y < params[x].length; y++ ){
					  	
						if( Array.isArray( params[x][y] ) ){
                                          	      	console.log( params[x][y] );
							switch( params[x][y][1] ){
                                           	            case "insertId":
								console.log( transactionResults );
                                            	                    params[ x ][y] = transactionResults[ params[x][y][ 2 ] ].insertId;
                                             	        break;
                                              	        deafult:
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
					if( error ) { console.log( error ) ; connection.rollback(); queriesValid = false }
					else { transactionResults.push( results ) }			
				} 
				if( queriesValid ){ connection.commit(); resolve( { queryExecuted: true, results: transactionResults } ) }
				else{ resolve( { queryExecuted : false } ) }
			});			
		})  
	
	} );
    }

    public singleQuery( query: string , logs : string[], params: string[]){ 

        return new Promise<any>( ( resolve , reject ) => { 

            console.log( logs  );
            this.db.query({
                sql: query,
                timeout: 40000,
                values: params
            }, (error: any , results: any, fields: any ) => {
                if( error ){ 
                    console.log( {
                        code : error.code,
                        sql: error.sql,
                        msg: error.sqlMessage
                    } );
                    throw new Error();
                }
                console.log( logs ); 
                resolve( { results: results, fields: fields } );
            });

        } );        

    }

    
    
    public sequentialQuery( queries : any, params: string[], logs: string[], sequentialDependentKey: string , returningObjectKeys : string[]) : Promise<any>{ 
        return new Promise< any >( ( resolve, reject ) => { 
            this.db.getConnection( async ( error: any, connection: any ) => { 
                if( error ){ 
                    console.log( {
                        code : error.code,
                        sql: error.sql,
                        msg: error.sqlMessage
                    } );
                    throw new Error();
                }

                let initialQ = await this.sequentialQueryPromiseWrapper( connection , queries[0], logs[0], params );
                connection.release();
                let returnArray = [];
                for( let x = 0; x < initialQ.results.length; x++ ){
                    let promises = [];
                    for( let y = 1; y < queries.length; y++ ){ 
                        console.log( logs[x] );
//                      console.log( queries[y] );
//			console.log( initialQ[ queries[y][1] ] )
//			console.log( initialQ )
                        promises.push( this.singleQuery( queries[y][0], logs, [initialQ.results[x][ queries[y][1] ]]) );
                    }
                    let returnObj = await Promise.all( [
                        new Promise<any>( ( resolve, reject ) => { resolve(initialQ) } ),
                        ...promises
                    ] );
                    //console.log( returnObj );
                        let obj : any = {};
                        for( let z = 0; z < returningObjectKeys.length; z++ ){ 
                            obj[returningObjectKeys[z]] = returnObj[z].results;
                        }
                        returnArray.push( obj );
                    
                    
//                    console.log( returnArray  );
                }

                resolve( 
                    returnArray
                )
            } );
    
        } );
    };

    
}

//type returnable = Promise<[ { key : { results: [ {key : string } ] } } ]>;
