import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const owner = searchParams.get('owner');

  if (!owner) {
    return NextResponse.json({ error: 'Owner parameter is required' }, { status: 400 });
  }

  try {
    // Fetch ethscriptions from the API
    const response = await fetch(`https://api.ethscriptions.com/api/ethscriptions?owner=${owner}`);
    
    if (!response.ok) {
      throw new Error(`API responded with status: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching ethscriptions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ethscriptions' },
      { status: 500 }
    );
  }
} 