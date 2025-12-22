// app/api/mock/route.ts

import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    message: "Mock server endpoint",
    timestamp: new Date().toISOString(),
    online: true,
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  
  // Simulate random server failures for testing
  const shouldFail = Math.random() > 0.7;
  
  if (shouldFail) {
    return NextResponse.json(
      { error: "Server error - simulating failure" },
      { status: 500 }
    );
  }
  
  return NextResponse.json({
    success: true,
    data: body,
    receivedAt: new Date().toISOString(),
    message: "Request processed successfully",
  });
}

export async function PUT() {
  // Simulate slow response
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  return NextResponse.json({
    success: true,
    message: "Slow PUT request completed",
  });
}