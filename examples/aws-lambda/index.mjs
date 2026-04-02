export const handler = async (event, context) => {
  return {
    statusCode: 200,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
    body: JSON.stringify({
      ok: true,
      provider: "aws",
      service: "aep-aws-minimal-provider",
      requestPath: event?.rawPath ?? null,
      functionName: context?.functionName ?? null,
      requestId: context?.awsRequestId ?? null,
    }),
  };
};
