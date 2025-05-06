export interface DbEnv{
    host        : string, 
    user        : string,
    password    : string,
    database    : string,
    waitForConnections: boolean,   
    connectionLimit: number,    
    queueLimit: number   
}