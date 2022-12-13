import { BaseSchema } from 'yup';
import { log } from '../lambda/utils/logger';

export const validateRecord = async <T>(
  record: { getData(): T },
  yupSchema?: BaseSchema
) => {
  if (yupSchema) {
    try {
      await yupSchema.validate(record.getData(), {
        abortEarly: true,
        strict: true,
      });
    } catch (e) {
      log.warn(`Lambda's input schema failed to validate.`);
      log.debug(e);
      log.debug('Input data:');
      log.debug(record.getData());

      throw e;
    }
  }
};
