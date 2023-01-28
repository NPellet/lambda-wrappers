import { log } from '../lambda/utils/logger';

export const validateRecord = async <T>(
  record: { getData(): T, getRawRecord(): any  },
  validateMethod?: Array<( data: any, rawData: any ) => Promise<void>>
) => {
  if (validateMethod) {
    try {
      for( let o of validateMethod ) { // Should we make those concurrent ?
        await o(record.getData(), record.getRawRecord());
      }
      
    } catch (e) {
      log.warn(`Lambda's input schema failed to validate.`);
      log.debug(e);
      log.debug('Input data:');
      log.debug(record.getData());

      throw e;
    }
  }
};
