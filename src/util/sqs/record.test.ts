import { SQSRecord } from 'aws-lambda';
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
    expect(failSQSRecord(new AwsSQSRecord(testRecord))).toMatchObject({
      itemIdentifier: testRecord.messageId,
    });
  });

  test('getMessageId works', async () => {
    const record = new AwsSQSRecord(testRecord);
    expect(record.getMessageId()).toBe(testRecord.messageId);
  });

  test('Fails parsing when bad json', async () => {
    const record = new AwsSQSRecord({ ...testRecord, body: 'bad_json' });

    expect(() => {
      record.getData();
    }).toThrow();
  });

  test('Returns raw string with message attribute', async () => {
    const record = new AwsSQSRecord({
      ...testRecord,
      messageAttributes: {
        type: {
          stringValue: 'string',
          dataType: 'string',
        },
      },
    });

    expect(record.getData()).toBe(testRecord.body);
  });

  test('Does not fails parsing when body is a string but message attribute type is string', async () => {
    const _record = {
      ...testRecord,
      body: 'bad_json',
      messageAttributes: {
        type: {
          stringValue: 'string',
          dataType: 'string',
        },
      },
    };

    const record = new AwsSQSRecord(_record);

    expect(record.getRawRecord()).toBe(_record);

    expect(() => {
      record.getData();
    }).not.toThrow();

    expect(record.getData()).toBe('bad_json');
  });

  test('Getting binary data', async () => {
    const record = new AwsSQSRecord<Buffer>({
      ...testRecord,
      body: 'YSBzdHJpbmc=',
      messageAttributes: {
        type: {
          stringValue: 'binary',
          dataType: 'string',
        },
      },
    });

    expect(record.getData()).toBeInstanceOf(Buffer);
    expect(record.getData().toString('ascii')).toBe('a string');
  });
});
