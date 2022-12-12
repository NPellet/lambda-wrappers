import { BaseSchema } from 'yup';
import { log } from '../lambda/utils/logger';
import { recordException } from './exceptions';

export const validateRecord = async <T>(
  record: { getData(): T },
  yupSchema?: BaseSchema
) => {
  if (yupSchema) {
    try {
      await yupSchema.validate(record.getData());
    } catch (e) {
      log.warn(
        `Lambda's input schema failed to validate. Rethrowing to fail lambda`
      );
      log.debug(e);
      recordException(e);
      throw e;
    }
  }
};
