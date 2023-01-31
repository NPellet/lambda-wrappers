import { APIGatewayEvent } from 'aws-lambda'
import jwt from 'jsonwebtoken'
import { LambdaFactoryManager } from '../../src/lambda/Manager';


new LambdaFactoryManager().addValidation("authToken", async ( data: any, raw: APIGatewayEvent, key: string ) => {

    const authHeader = raw.headers.Authorization;

    if( ! authHeader ) {
        throw new Error("Unauthorized");
    }

    const token = authHeader.replace("Bearer ", "" );

    jwt.verify( token, key );

}, async () => {

    const key = await (await fetch("url_to_key")).json();
    return [ key ];
});