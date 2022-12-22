import { SNSEventRecord } from 'aws-lambda';
import { MessageType } from '../../types';
import { AwsSNSRecord } from './record';

const testRecord: SNSEventRecord = {
  "EventSource": "src",
  "EventSubscriptionArn": "srcarn",
  "EventVersion": "version",
  "Sns": {
    "Message": "Hello world",
    "MessageAttributes": {},
    "MessageId": "messageId",
    "Signature": "",
    "SignatureVersion": "",
    "Timestamp": "",
    "Subject": "subject",
    "TopicArn": "topic",
    "SigningCertUrl": "",
    "Type": "",
    "UnsubscribeUrl": ""
  }
};

describe('Testing SQS Record', () => {


  test('getMessageId works', async () => {
    const record = new AwsSNSRecord(testRecord, MessageType.String);
    expect(record.getMessageId()).toBe(testRecord.Sns.MessageId);
  });

  test('getRawRecord works', async () => {
    const record = new AwsSNSRecord(testRecord, MessageType.String);
    expect(record.getRawRecord()).toBe(testRecord);
  });

  test('getRawRecord works', async () => {
    const record = new AwsSNSRecord(testRecord, MessageType.String);
    expect(record.getRawRecord()).toBe(testRecord);
  });


  test('Fails parsing when bad json', async () => {
    const record = new AwsSNSRecord({ ...testRecord, Sns: Object.assign({ ...testRecord.Sns }, { "Message": 'bad_json' }) }, MessageType.Object);

    expect(() => {
      record.getData();
    }).toThrow();
  });

  test('Returns raw string with message attribute', async () => {
    const record = new AwsSNSRecord(testRecord, MessageType.String);

    expect(record.getRawRecord()).toBe(testRecord);

    expect(() => {
      record.getData();
    }).not.toThrow();

    expect(record.getData()).toBe(testRecord.Sns.Message);
  });


  test('Getting binary data', async () => {
    const record = new AwsSNSRecord<Buffer>({ ...testRecord, Sns: Object.assign({ ...testRecord.Sns }, { "Message": 'YSBzdHJpbmc=' }) }, MessageType.Binary);
    expect(record.getData()).toBeInstanceOf(Buffer);
    expect(record.getData().toString('ascii')).toBe('a string');
  });
});
