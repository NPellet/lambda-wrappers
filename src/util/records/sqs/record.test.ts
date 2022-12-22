import { SQSRecord } from 'aws-lambda';
import { MessageType } from '../../types';
import { AwsSQSRecord, failSQSRecord } from './record';

const testRecord: SQSRecord = {
  messageId: 'abc',
  receiptHandle: 'abc',
  body: JSON.stringify({ b: 'abc' }),
  attributes: {
    AWSTraceHeader: 'abc',
    ApproximateReceiveCount: 'abc',
    SentTimestamp: 'abc',
    SenderId: 'abc',
    ApproximateFirstReceiveTimestamp: 'abc',
  },
  messageAttributes: {},
  md5OfBody: 'abc',
  eventSource: 'abc',
  eventSourceARN: 'abc',
  awsRegion: 'abc',
};

describe('Testing SQS Record', () => {
  test('Output batch id matches message id', async () => {
    expect(failSQSRecord(new AwsSQSRecord(testRecord,MessageType.Object))).toMatchObject({
      itemIdentifier: testRecord.messageId,
    });
  });

  test('getMessageId works', async () => {
    const record = new AwsSQSRecord(testRecord,MessageType.Object);
    expect(record.getMessageId()).toBe(testRecord.messageId);
  });

  test('Fails parsing when bad json', async () => {
    const record = new AwsSQSRecord({ ...testRecord, body: 'bad_json' }, MessageType.Object);

    expect(() => {
      record.getData();
    }).toThrow();
  });

  test('Returns raw string with message attribute', async () => {
    const record = new AwsSQSRecord(testRecord, MessageType.String);

    expect(record.getData()).toBe(testRecord.body);
    expect(() => {
      record.getData();
    }).not.toThrow();

  });

  test('Getting binary data', async () => {
    const record = new AwsSQSRecord<Buffer>({
      ...testRecord,
      body: 'YSBzdHJpbmc=',
      
    }, MessageType.Binary);

    expect(record.getData()).toBeInstanceOf(Buffer);
    expect(record.getData().toString('ascii')).toBe('a string');
  });
});
