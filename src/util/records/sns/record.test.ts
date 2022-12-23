import { SNSEventRecord } from 'aws-lambda';
import { testSNSRecord } from '../../../test_utils/utils';
import { MessageType } from '../../types';
import { AwsSNSRecord } from './record';


describe('Testing SQS Record', () => {


  test('getMessageId works', async () => {
    const record = new AwsSNSRecord(testSNSRecord, MessageType.String);
    expect(record.getMessageId()).toBe(testSNSRecord.Sns.MessageId);
  });

  test('getRawRecord works', async () => {
    const record = new AwsSNSRecord(testSNSRecord, MessageType.String);
    expect(record.getRawRecord()).toBe(testSNSRecord);
  });

  test('getRawRecord works', async () => {
    const record = new AwsSNSRecord(testSNSRecord, MessageType.String);
    expect(record.getRawRecord()).toBe(testSNSRecord);
  });


  test('Fails parsing when bad json', async () => {
    const record = new AwsSNSRecord({ ...testSNSRecord, Sns: Object.assign({ ...testSNSRecord.Sns }, { "Message": 'bad_json' }) }, MessageType.Object);

    expect(() => {
      record.getData();
    }).toThrow();
  });

  test('Returns raw string with message attribute', async () => {
    const record = new AwsSNSRecord(testSNSRecord, MessageType.String);

    expect(record.getRawRecord()).toBe(testSNSRecord);

    expect(() => {
      record.getData();
    }).not.toThrow();

    expect(record.getData()).toBe(testSNSRecord.Sns.Message);
  });


  test('Getting binary data', async () => {
    const record = new AwsSNSRecord<Buffer>({ ...testSNSRecord, Sns: Object.assign({ ...testSNSRecord.Sns }, { "Message": 'YSBzdHJpbmc=' }) }, MessageType.Binary);
    expect(record.getData()).toBeInstanceOf(Buffer);
    expect(record.getData().toString('ascii')).toBe('a string');
  });
});
