import { SourceConfig } from "../lambda/config";

export const defaultSourceConfig: SourceConfig = {
    _general: {
        recordExceptionOnLambdaFail: true
    },
	eventBridge: {
		failLambdaOnValidationFail: true
	}
}
