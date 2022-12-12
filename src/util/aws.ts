export const getAwsAccountFromArn = (arn: string) => {
  const parts = arn.split(':');
  if (parts.length >= 5) {
    return parts[4];
  }
  return undefined;
};

export const getAwsResourceFromArn = (arn: string) => {
  const parts = arn.split(':');
  if (parts.length >= 6) {
    return parts[5];
  }
  return undefined;
};
