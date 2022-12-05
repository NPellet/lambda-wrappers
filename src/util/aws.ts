export const getAwsFromAccountFromArn = (arn: string) => {
  const parts = arn.split(':')
  if (parts.length >= 5) {
    return parts[4]
  }
  return undefined
}
