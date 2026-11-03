import { getSingletonGateway } from "../../../server/src/gateway.ts";

// this part have been added by yassine
async function dispatchToGateway(request: Request): Promise<Response> {
  const gateway = getSingletonGateway();
  return gateway.handleRequest(request, { runtimeLabel: "expo-api-gateway" });
}

export async function GET(request: Request): Promise<Response> {
  return dispatchToGateway(request);
}

export async function POST(request: Request): Promise<Response> {
  return dispatchToGateway(request);
}

export async function PATCH(request: Request): Promise<Response> {
  return dispatchToGateway(request);
}

export async function DELETE(request: Request): Promise<Response> {
  return dispatchToGateway(request);
}

export async function OPTIONS(request: Request): Promise<Response> {
  return dispatchToGateway(request);
}

