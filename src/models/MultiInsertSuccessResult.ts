export interface MultiInsertSuccessResult {
    queryExecuted: true;
    results: any[]; // You can replace `any` with a more specific type if needed
  }
  
  export interface MultiInsertFailureResult {
    queryExecuted: false;
  }
  
  export type MultiInsertResult = MultiInsertSuccessResult | MultiInsertFailureResult;