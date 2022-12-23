
import { MessageType } from '../types';
import { GenericRecord }from './generic'

class GenericRecordTester<T> extends GenericRecord<T, any> {

    getBody() {
        return ""
    }

    getData() {
        return this.parse();
    }
}

describe("Testing Generic Record parser", function() {

    it("Parses JSON successfully", () => {

        const record = new GenericRecordTester( MessageType.Object );
        record.getBody = () => {
            return JSON.stringify({ a: "b" })
        }

        expect( () => {
            record.getData()
        }).not.toThrow();

        expect( record.getData() ).toStrictEqual( {a: "b" })
    })

    it("Throws when failing to parse a JSON",function() {

        const record = new GenericRecordTester( MessageType.Object );
        record.getBody = () => {
            return "";
        }

        expect( () => {
            record.getData()
        }).toThrow();

        expect( record.getMessageType() ).toBe( MessageType.Object );
    })


    it("Parses binary",function() {

        const record = new GenericRecordTester( MessageType.Binary );
        record.getBody = () => {
            return Buffer.from("abc").toString('base64');
        }

        expect( record.getData() ).toBeInstanceOf( Buffer );
        // @ts-ignore
        expect( record.getData().toString('ascii') ).toBe('abc');


        expect( record.getMessageType() ).toBe( MessageType.Binary );
    })


    it("Parses string",function() {

        const record = new GenericRecordTester( MessageType.String );
        record.getBody = () => {
            return "abc"
        }

        expect( typeof record.getData() ).toBe("string");
        // @ts-ignore
        expect( record.getData() ).toBe('abc');


        expect( record.getMessageType() ).toBe( MessageType.String );
    })


    it("Parses number",function() {

        const record = new GenericRecordTester( MessageType.Number );
        record.getBody = () => {
            return "123"
        }

        expect( typeof record.getData() ).toBe("number");
        // @ts-ignore
        expect( record.getData() ).toBe(123);

        expect( record.getMessageType() ).toBe( MessageType.Number );
    })
})