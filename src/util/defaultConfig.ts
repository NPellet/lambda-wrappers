import { SourceConfig } from "../lambda/config";

export const defaultSourceConfig: SourceConfig = {
	eventBridge: {
		failLambdaOnValidationFail: true
	}
}
